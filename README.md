# The Art of Building with Smart Pieces

Proof of concept for the article *The Art of Building with Smart Pieces: Combinators in the Age
of LLMs*
([English](https://blog.ragnagrok.com/en/2026-04-29-el-arte-de-construir-con-piezas-inteligentes) ·
[español](https://blog.ragnagrok.com/es/2026-04-29-el-arte-de-construir-con-piezas-inteligentes)):
the article's four examples in TypeScript, made runnable, with the laws it mentions checked by
[fast-check](https://github.com/dubzzz/fast-check) and the mistakes it says the compiler stops
actually stopped.

The idea in one line: a combinator takes pieces of one shape and returns a piece of **the same
shape**, so it can keep being combined; the types say how pieces fit, and the laws say which
combinations mean the same thing.

## What's here

| File | What it is |
|---|---|
| `src/parser.ts` | Example 1: `Parser<T>`, `char`, `digit`, `and`, `or`, `many`, `integer`. The article's code, plus `fail`. |
| `src/predicate.ts` | Example 2: typed SQL predicates, `and`, `not`, `vipUsers`. |
| `src/ui.tsx` | Example 3: `withLoading` and `withAuth` as combinators over React components. |
| `src/step.ts` | Example 4: `Step<I, O>`, `prompt`, `extractJSON`, `chain`, `parallel`, `retryUntil`, `analyzeReview`. |
| `test/examples.test.tsx` | What each example returns, including the article's `vipUsers.sql` and `.params`. |
| `test/laws.test.ts` | The laws, on random pieces and inputs (see below). |
| `rejected/*` | What does **not** typecheck, each with the error it expects on its `// expects:` line. |
| `examples/SameShape.ts` | What typechecks and arguably shouldn't: the limit of phantom types. |
| `mutants/no-parentheses.diff` | A plausible bug in the predicate combinators that only a law catches. |
| `check.sh` | Runs all of the above. |

Spanish names from the article, in English here: `esAdulto` → `isAdult`, `tieneSubActiva` →
`hasActiveSub`, `usuariosVip` → `vipUsers`, `Perfil` → `Profile`, `PerfilProtegido` →
`ProtectedProfile`, `analizarReseña` → `analyzeReview`.

The article leaves a few things undefined (`Spinner`, the body of `withAuth`, `llm`,
`fillTemplate`, `Schema`, `parseAndValidate`, `reviewSchema`). The minimal versions here are
mine. The model is injected (`prompt(llm)(template)` instead of a global `llm`), so the tests run
with a fake one and no network.

## The laws

| Pieces | Law | How it's checked |
|---|---|---|
| parsers | `or` is associative; `fail` is its identity on both sides | random parsers over `"ab"`, random inputs |
| parsers | `and` is associative, up to how the tuples nest | same |
| parsers | `integer` reads back any non-negative integer | random integers and tails |
| predicates | `and` is associative and commutative; `not` undoes `not`; `not p` selects exactly the rows `p` doesn't | **by running both sides in SQLite** on random tables: `(a) AND ((b) AND (c))` and `((a) AND (b)) AND (c)` are different strings, and the law is about which rows they select |
| steps | `chain(chain(a, b), c) ≡ chain(a, chain(b, c))`; the identity step is neutral; `parallel` runs both steps on the same input | random arithmetic steps |

The last predicate law is the one that earns its keep. `mutants/no-parentheses.diff` drops the
parentheses that `and` and `not` put around their arguments. Every example still returns
something that looks right, and associativity, commutativity and double negation all still hold.
But `NOT a AND b` means `(NOT a) AND b` in SQL, so `not` stops selecting the complement:

```
Counterexample: [[{"id":0,"age":0,"active":false}],
  {"sql":"NOT age >= ? AND active = ? AND NOT active = ? AND age >= ?","params":[0,false,false,18]}]
```

## The rejected ones

- `AndWithString.ts`: `and(digit, "hola")`. *"hola" isn't a `Parser<B>` for any `B`.*
- `OrMixedTypes.ts`: `or(digit, char("a"))`. One is `Parser<number>`, the other `Parser<string>`.
- `MixedTables.ts`: `and(isAdult, isPublished)`, a predicate over `User` with one over `Post`.
- `ChainMismatch.ts`: chaining a step that returns `string` into one that expects a `User`.
- `MissingIsLoading.tsx`: using the wrapped profile without the `isLoading` prop `withLoading` added.

## Running it

With Node 24 and pnpm 10:

```sh
pnpm install
./check.sh        # typecheck, tests and laws, rejected files, the mutant
pnpm test         # just the tests
```

## What this proof of concept doesn't cover

- **Phantom types are structural.** `Predicate<User>` doesn't mix with `Predicate<Post>` because
  the two row types differ. Two tables whose rows have the same shape mix without complaint
  (`examples/SameShape.ts`). A brand per table (a field like `readonly __table?: "users"`) closes
  that gap.
- **`many` loops on a parser that accepts the empty string.** `many(many(char("a")))` never
  returns: the inner `many` always succeeds without consuming anything. Parsec reports this case
  as an error; the article's version, like most minimal ones, doesn't. A test shows the loop by
  counting calls.
- **The laws are checked, not proved.** fast-check tries a hundred random cases per law by
  default; a law that fails rarely can slip through.
- **SQL's `NULL`.** The table's columns are `NOT NULL`. With `NULL`s, three-valued logic breaks
  the complement law: a row where `age` is `NULL` is selected by neither `age >= 18` nor
  `NOT (age >= 18)`.
- **No real model.** `analyzeReview` runs against a fake model that always answers the same JSON.

## Further reading

- Hutton and Meijer (1996), [*Monadic Parser Combinators*](https://people.cs.nott.ac.uk/pszgmh/monparsing.pdf).
- Leijen and Meijer (2001), *Parsec: Direct Style Monadic Parser Combinators For The Real World*.
- [QuickCheck](https://hackage.haskell.org/package/QuickCheck): checking properties instead of single cases.
- [Parsimmon](https://github.com/jneen/parsimmon) and [Arcsecond](https://github.com/francisrstokes/arcsecond), parser combinators in TypeScript; [Drizzle](https://orm.drizzle.team/), typed queries.
