// Example 1 from the article: parser combinators. The code is the article's,
// with `export` added.

// A parser is a function that takes an input (string)
// and, if it succeeds, returns a value of type T plus what wasn't consumed.
export type Parser<T> =
  (input: string) =>
    | { ok: true; value: T; rest: string }
    | { ok: false };

// Primitives (basic parsers)

export const char = (c: string): Parser<string> =>
  (input) =>
    input[0] === c
      ? { ok: true, value: c, rest: input.slice(1) }
      : { ok: false };

export const digit: Parser<number> = (input) => {
  const ch = input[0];
  return ch && /[0-9]/.test(ch)
    ? { ok: true, value: Number(ch), rest: input.slice(1) }
    : { ok: false };
};

// Combinators (they take parsers and return parsers)

// "This AND then that": combines two parsers in sequence.
export const and = <A, B>(pa: Parser<A>, pb: Parser<B>): Parser<[A, B]> =>
  (input) => {
    const r1 = pa(input);
    if (!r1.ok) return { ok: false };
    const r2 = pb(r1.rest);
    if (!r2.ok) return { ok: false };
    return { ok: true, value: [r1.value, r2.value], rest: r2.rest };
  };

// "This OR that": tries the first one and, if it fails, the second.
export const or = <A>(pa: Parser<A>, pb: Parser<A>): Parser<A> =>
  (input) => {
    const r1 = pa(input);
    return r1.ok ? r1 : pb(input);
  };

// "Repeat zero or more times": applies the parser until it fails.
export const many = <A>(pa: Parser<A>): Parser<A[]> =>
  (input) => {
    const out: A[] = [];
    let rest = input;
    while (true) {
      const r = pa(rest);
      if (!r.ok) break;
      out.push(r.value);
      rest = r.rest;
    }
    return { ok: true, value: out, rest };
  };

// One or more digits, as a number.
export const integer: Parser<number> = (input) => {
  const r = and(digit, many(digit))(input);
  if (!r.ok) return { ok: false };
  const [head, tail] = r.value;
  return { ok: true, value: Number([head, ...tail].join("")), rest: r.rest };
};

// Not in the article: the parser that always fails. It's the identity
// element of `or`, which the laws in test/parser.test.ts check.
export const fail = <A>(): Parser<A> => () => ({ ok: false });
