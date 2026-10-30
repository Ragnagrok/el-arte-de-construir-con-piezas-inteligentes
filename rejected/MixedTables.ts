// "Predicate<User> doesn't mix with Predicate<Post>": combining predicates over two tables.
// expects: error TS2345: Argument of type 'Predicate<Post>' is not assignable to parameter of type 'Predicate<User>'
import { and, isAdult, type Predicate } from "../src/predicate";
type Post = { id: number; title: string; published: boolean };
const isPublished: Predicate<Post> = { sql: "published = ?", params: [true] };
const p = and(isAdult, isPublished);
