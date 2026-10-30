// Example 2 from the article: queries without string concatenation.
// `esAdulto` and `tieneSubActiva` are `isAdult` and `hasActiveSub` here.

// A predicate is a WHERE fragment typed by the table T.
export type Predicate<T> = {
  sql: string;
  params: unknown[];
  // The `_phantom` parameter isn't used at run time; it tells TypeScript
  // which table this predicate applies to.
  readonly _phantom?: (t: T) => void;
};

export type User = { id: number; age: number; active: boolean };

// Primitives over User

export const isAdult: Predicate<User> = {
  sql: "age >= ?",
  params: [18],
};

export const hasActiveSub: Predicate<User> = {
  sql: "active = ?",
  params: [true],
};

// Combinators that compose predicates

export const and = <T>(p1: Predicate<T>, p2: Predicate<T>): Predicate<T> => ({
  sql: `(${p1.sql}) AND (${p2.sql})`,
  params: [...p1.params, ...p2.params],
});

export const not = <T>(p: Predicate<T>): Predicate<T> => ({
  sql: `NOT (${p.sql})`,
  params: p.params,
});

export const vipUsers: Predicate<User> = and(isAdult, hasActiveSub);
// vipUsers.sql    -> "(age >= ?) AND (active = ?)"
// vipUsers.params -> [18, true]
