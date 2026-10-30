// "If you try and(digit, \"hola\"), the compiler stops you."
// expects: error TS2345: Argument of type 'string' is not assignable to parameter of type 'Parser<unknown>'
import { and, digit } from "../src/parser";
const p = and(digit, "hola");
