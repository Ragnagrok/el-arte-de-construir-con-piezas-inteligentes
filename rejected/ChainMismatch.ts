// "If you chain a step that returns string with one that expects User, the compiler stops you."
// expects: error TS2345: Argument of type 'Step<string, string>' is not assignable to parameter of type 'Step<string, User>'
import { chain, type Step } from "../src/step";
type User = { id: number; name: string };
const summarize: Step<string, string> = async (s) => s.slice(0, 10);
const greet: Step<User, string> = async (u) => `hi ${u.name}`;
const p = chain(summarize, greet);
