// The laws the article mentions, checked with fast-check: associativity and
// identity elements, on randomly generated pieces and inputs.
import { DatabaseSync } from "node:sqlite";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import * as P from "../src/parser";
import * as Q from "../src/predicate";
import { chain, parallel, type Step } from "../src/step";

// ---------------------------------------------------------------- parsers

type SP = P.Parser<string>;

// Sequence two string parsers and glue their results, so the type stays the same.
const seq = (p: SP, q: SP): SP => (input) => {
  const r = P.and(p, q)(input);
  return r.ok ? { ok: true, value: r.value[0] + r.value[1], rest: r.rest } : r;
};
const manyJoined = (p: SP): SP => (input) => {
  const r = P.many(p)(input);
  return r.ok ? { ok: true, value: r.value.join(""), rest: r.rest } : r;
};

// Random parsers over the alphabet "ab". `many` only wraps single characters:
// see the last test of this block for why.
const parser: fc.Arbitrary<SP> = fc.letrec<{ p: SP }>((tie) => ({
  p: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    fc.constantFrom("a", "b").map(P.char),
    fc.constant(P.fail<string>()),
    fc.constantFrom("a", "b").map((c) => manyJoined(P.char(c))),
    fc.tuple(tie("p"), tie("p")).map(([p, q]) => P.or(p, q)),
    fc.tuple(tie("p"), tie("p")).map(([p, q]) => seq(p, q))
  ),
})).p;

const input = fc.string({ unit: fc.constantFrom("a", "b"), maxLength: 8 });

describe("parser laws", () => {
  test("or is associative", () => {
    fc.assert(
      fc.property(parser, parser, parser, input, (p, q, r, s) => {
        expect(P.or(P.or(p, q), r)(s)).toEqual(P.or(p, P.or(q, r))(s));
      })
    );
  });

  test("fail is the identity of or, on both sides", () => {
    fc.assert(
      fc.property(parser, input, (p, s) => {
        expect(P.or(P.fail<string>(), p)(s)).toEqual(p(s));
        expect(P.or(p, P.fail<string>())(s)).toEqual(p(s));
      })
    );
  });

  test("and is associative, up to how the tuples nest", () => {
    fc.assert(
      fc.property(parser, parser, parser, input, (p, q, r, s) => {
        const left = P.and(P.and(p, q), r)(s);
        const right = P.and(p, P.and(q, r))(s);
        const flatLeft = left.ok ? { ...left, value: [...left.value[0], left.value[1]] } : left;
        const flatRight = right.ok ? { ...right, value: [right.value[0], ...right.value[1]] } : right;
        expect(flatLeft).toEqual(flatRight);
      })
    );
  });

  test("integer reads back any non-negative integer", () => {
    fc.assert(
      fc.property(fc.maxSafeNat(), fc.string({ unit: fc.constantFrom("x", "-", " ") }), (n, tail) => {
        expect(P.integer(String(n) + tail)).toEqual({ ok: true, value: n, rest: tail });
      })
    );
  });

  // Not a law: a limit of the article's `many`. If the inner parser can succeed
  // without consuming input, `many` never stops. Parsec refuses this case with
  // an error; here we count calls to show the loop instead of hanging.
  test("many over a parser that accepts the empty string never stops", () => {
    let calls = 0;
    const counted: P.Parser<string[]> = (s) => {
      if (++calls > 10_000) throw new Error("still looping");
      return P.many(P.char("a"))(s);
    };
    expect(() => P.many(counted)("b")).toThrow("still looping");
  });
});

// ---------------------------------------------------------------- predicates

// The laws of predicates are about which rows they select, not about the SQL
// text: (a AND b) AND c and a AND (b AND c) are different strings. So they're
// checked by running both sides against a random table in SQLite.

type Pred = Q.Predicate<Q.User>;

const atom: fc.Arbitrary<Pred> = fc.oneof(
  fc.integer({ min: 0, max: 100 }).map((n) => ({ sql: "age >= ?", params: [n] })),
  fc.integer({ min: 0, max: 100 }).map((n) => ({ sql: "age < ?", params: [n] })),
  fc.boolean().map((b) => ({ sql: "active = ?", params: [b] })),
  fc.constant(Q.isAdult),
  fc.constant(Q.hasActiveSub)
);

const predicate: fc.Arbitrary<Pred> = fc.letrec<{ p: Pred }>((tie) => ({
  p: fc.oneof(
    { depthSize: "small" },
    atom,
    tie("p").map((p) => Q.not(p)),
    fc.tuple(tie("p"), tie("p")).map(([p, q]) => Q.and(p, q))
  ),
})).p;

const users = fc.uniqueArray(
  fc.record({ id: fc.nat(1000), age: fc.integer({ min: 0, max: 100 }), active: fc.boolean() }),
  { selector: (u) => u.id, maxLength: 20 }
);

const db = new DatabaseSync(":memory:");
db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, age INTEGER NOT NULL, active INTEGER NOT NULL)");

// SQLite has no booleans, so the driver turns them into 1 and 0.
const bind = (params: unknown[]) =>
  params.map((v) => (typeof v === "boolean" ? Number(v) : v)) as (number | string)[];

const select = (rows: Q.User[], p: Pred): number[] => {
  db.exec("DELETE FROM users");
  const insert = db.prepare("INSERT INTO users VALUES (?, ?, ?)");
  for (const u of rows) insert.run(u.id, u.age, Number(u.active));
  return db
    .prepare(`SELECT id FROM users WHERE ${p.sql} ORDER BY id`)
    .all(...bind(p.params))
    .map((r) => Number((r as { id: number }).id));
};

describe("predicate laws (checked against SQLite)", () => {
  test("and is associative", () => {
    fc.assert(
      fc.property(users, predicate, predicate, predicate, (rows, a, b, c) => {
        expect(select(rows, Q.and(Q.and(a, b), c))).toEqual(select(rows, Q.and(a, Q.and(b, c))));
      })
    );
  });

  test("and is commutative", () => {
    fc.assert(
      fc.property(users, predicate, predicate, (rows, a, b) => {
        expect(select(rows, Q.and(a, b))).toEqual(select(rows, Q.and(b, a)));
      })
    );
  });

  // The columns are NOT NULL; with NULLs, SQL's three-valued logic breaks this one.
  test("not selects exactly the rows the predicate doesn't", () => {
    fc.assert(
      fc.property(users, predicate, (rows, a) => {
        const all = rows.map((u) => u.id).sort((x, y) => x - y);
        const yes = select(rows, a);
        const no = select(rows, Q.not(a));
        expect([...yes, ...no].sort((x, y) => x - y)).toEqual(all);
      })
    );
  });

  test("not undoes not", () => {
    fc.assert(
      fc.property(users, predicate, (rows, a) => {
        expect(select(rows, Q.not(Q.not(a)))).toEqual(select(rows, a));
      })
    );
  });
});

// ---------------------------------------------------------------- steps

// Random steps: small arithmetic functions, wrapped as async steps.
const step: fc.Arbitrary<Step<number, number>> = fc
  .tuple(fc.constantFrom("+", "*", "-"), fc.integer({ min: -5, max: 5 }))
  .map(([op, k]) => async (x: number) => (op === "+" ? x + k : op === "*" ? x * k : x - k));

const identity: Step<number, number> = async (x) => x;

describe("step laws", () => {
  test("chain is associative: chain(chain(a, b), c) ≡ chain(a, chain(b, c))", async () => {
    await fc.assert(
      fc.asyncProperty(step, step, step, fc.integer(), async (a, b, c, x) => {
        expect(await chain(chain(a, b), c)(x)).toBe(await chain(a, chain(b, c))(x));
      })
    );
  });

  test("the identity step is neutral for chain, on both sides", async () => {
    await fc.assert(
      fc.asyncProperty(step, fc.integer(), async (a, x) => {
        expect(await chain(identity, a)(x)).toBe(await a(x));
        expect(await chain(a, identity)(x)).toBe(await a(x));
      })
    );
  });

  test("parallel runs both steps on the same input", async () => {
    await fc.assert(
      fc.asyncProperty(step, step, fc.integer(), async (a, b, x) => {
        expect(await parallel(a, b)(x)).toEqual([await a(x), await b(x)]);
      })
    );
  });
});
