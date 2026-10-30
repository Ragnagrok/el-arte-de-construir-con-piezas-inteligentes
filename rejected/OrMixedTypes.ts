// "If you try or(digit, char('a')), it stops too: or demands both return the same type."
// expects: error TS2345: Argument of type 'Parser<string>' is not assignable to parameter of type 'Parser<number>'
import { char, digit, or } from "../src/parser";
const p = or(digit, char("a"));
