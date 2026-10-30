import { and, isAdult, type Predicate } from "../src/predicate";
// A different table whose rows happen to have the same shape as User's.
type Customer = { id: number; age: number; active: boolean };
const isLoyal: Predicate<Customer> = { sql: "active = ?", params: [true] };
export const mixed = and(isAdult, isLoyal);
