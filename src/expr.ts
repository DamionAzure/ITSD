// A small, safe calculator for deck variables. It is NOT JavaScript: it is parsed and evaluated here, so a deck can't reach files, the network or the app.
//
//   score * 2 + bonus        arithmetic: + - * / % **  and ( )
//   score >= 10 and not done comparisons: == != < <= > >=  (a single = also means ==);  logic: and or not  (or && || !)
//   "Hi " + name             text in "double" or 'single' quotes; + joins text
//   min(a, b)  max(a, b, c)  round(x)  round(x, 1)  floor(x)  ceil(x)  abs(x)  sqrt(x)  len(text)  if(cond, a, b)
//   clamp(x, lo, hi)  sign(x)  pow(x, y)  mod(x, y) (never negative)  sin(x)  cos(x)  (radians)
//   random()  random(6)  random(3, 8)  randint(lo, hi)  pick(a, b, c)   a number 0..1; a whole number 1..6 or 3..8 (both ends included); one of the values
//        chance only works in actions (put roll = random(6)); not in text or conditions, they would change on every look
//   upper(t)  lower(t)  trim(t)  left(t, n)  right(t, n)  contains(t, part)  replace(t, old, new)  num(t)  str(x)
//   slide  slides  elapsed   built-in names: the current slide number, how many there are, seconds since the presentation started
//   true  false              yes/no values
//
// Names are deck variables (`::: var`, `::: input`). A variable that has no value yet counts as 0; "true" / "false" are yes/no; text that looks like a number is a number.

export type Val = number | string | boolean;
export class ExprError extends Error {}

type Tok = { t: "num" | "str" | "id" | "op"; v: string; at: number };
const OPS = ["**", "==", "!=", "<=", ">=", "&&", "||", "+", "-", "*", "/", "%", "<", ">", "=", "!", "(", ")", ","];

function lex(src: string): Tok[] {
  const out: Tok[] = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = src.slice(i).match(/^(?:\d+\.?\d*|\.\d+)/);
    if (num) { out.push({ t: "num", v: num[0], at: i }); i += num[0].length; continue; }
    const id = src.slice(i).match(/^[A-Za-z_]\w*/);
    if (id) { out.push({ t: "id", v: id[0], at: i }); i += id[0].length; continue; }
    if (c === '"' || c === "'") {
      const end = src.indexOf(c, i + 1);
      if (end < 0) throw new ExprError("text is missing its closing quote");
      out.push({ t: "str", v: src.slice(i + 1, end), at: i }); i = end + 1; continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new ExprError(`unexpected "${c}"`);
    out.push({ t: "op", v: op, at: i }); i += op.length;
  }
  return out;
}

type Node =
  | { k: "lit"; v: Val } | { k: "var"; n: string }
  | { k: "un"; op: string; a: Node } | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "call"; f: string; args: Node[] };

const FUNCS = new Set(["min", "max", "round", "floor", "ceil", "abs", "sqrt", "len", "if", "clamp", "sign", "pow", "mod", "sin", "cos", "random", "randint", "pick", "upper", "lower", "trim", "left", "right", "contains", "replace", "num", "str"]);
const IMPURE = new Set(["random", "randint", "pick"]); // these give a different answer every time they are evaluated
const WORD_OPS: Record<string, string> = { and: "&&", or: "||", not: "!" };

function parse(src: string): Node {
  const toks = lex(src); let p = 0;
  if (!toks.length) throw new ExprError("nothing to calculate");
  const peek = () => toks[p];
  const isOp = (...v: string[]) => { const t = peek(); return !!t && (t.t === "op" ? v.includes(t.v) : t.t === "id" && v.includes(WORD_OPS[t.v] ?? "\0")); };
  const take = () => toks[p++];
  const opName = (t: Tok) => (t.t === "id" ? WORD_OPS[t.v] : t.v === "=" ? "==" : t.v);
  const expect = (v: string) => { if (!(peek()?.t === "op" && peek().v === v)) throw new ExprError(`expected "${v}"`); p++; };

  const bin = (next: () => Node, ...ops: string[]) => () => {
    let a = next();
    while (isOp(...ops)) { const op = opName(take()); a = { k: "bin", op, a, b: next() }; }
    return a;
  };
  const primary = (): Node => {
    const t = take();
    if (!t) throw new ExprError("the expression ends too early");
    if (t.t === "num") return { k: "lit", v: parseFloat(t.v) };
    if (t.t === "str") return { k: "lit", v: t.v };
    if (t.t === "id") {
      if (t.v === "true" || t.v === "false") return { k: "lit", v: t.v === "true" };
      if (peek()?.t === "op" && peek().v === "(") {
        if (!FUNCS.has(t.v)) throw new ExprError(`unknown function ${t.v}()`);
        p++; const args: Node[] = [];
        if (!(peek()?.t === "op" && peek().v === ")")) do { args.push(or()); } while (peek()?.t === "op" && peek().v === "," && ++p);
        expect(")"); return { k: "call", f: t.v, args };
      }
      if (WORD_OPS[t.v]) throw new ExprError(`unexpected "${t.v}"`);
      return { k: "var", n: t.v };
    }
    if (t.v === "(") { const e = or(); expect(")"); return e; }
    throw new ExprError(`unexpected "${t.v}"`);
  };
  const unary = (): Node => {
    if (isOp("-", "+", "!")) { const op = opName(take()); return { k: "un", op, a: unary() }; }
    return primary();
  };
  const pow = (): Node => { const a = unary(); if (isOp("**")) { take(); return { k: "bin", op: "**", a, b: pow() }; } return a; };
  const mul = bin(pow, "*", "/", "%");
  const add = bin(mul, "+", "-");
  const cmp = bin(add, "==", "!=", "<=", ">=", "<", ">", "=");
  const and = bin(cmp, "&&");
  const or: () => Node = bin(and, "||");
  const tree = or();
  if (p < toks.length) throw new ExprError(`unexpected "${toks[p].v}"`);
  return tree;
}

export const toNum = (v: Val): number => (typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : Number.isFinite(Number(v)) && v.trim() !== "" ? Number(v) : 0);
export const truthy = (v: Val): boolean => (typeof v === "boolean" ? v : typeof v === "number" ? v !== 0 : v !== "" && v !== "0" && v.toLowerCase() !== "false");
/** A value as stored in a variable / shown in text. */
export const show = (v: Val): string => (typeof v === "number" ? String(Math.round(v * 1e9) / 1e9) : String(v));
const fin = (n: number) => (Number.isFinite(n) ? n : 0); // 1/0 and the like give 0, never Infinity or NaN
const eq = (a: Val, b: Val) => (typeof a === "string" || typeof b === "string" ? show(a) === show(b) : toNum(a) === toNum(b));
const lt = (a: Val, b: Val) => (typeof a === "string" && typeof b === "string" ? a < b : toNum(a) < toNum(b));

/** What a stored variable value means inside an expression. A missing variable is 0. */
export function fromStored(raw: string | undefined): Val {
  if (raw === undefined) return 0;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw.trim() !== "" && Number.isFinite(Number(raw)) ? Number(raw) : raw;
}

function run(n: Node, get: (name: string) => string | undefined): Val {
  const r = (x: Node) => run(x, get);
  switch (n.k) {
    case "lit": return n.v;
    case "var": return fromStored(get(n.n));
    case "un": { const a = r(n.a); return n.op === "!" ? !truthy(a) : n.op === "-" ? -toNum(a) : toNum(a); }
    case "bin": {
      if (n.op === "&&") { const a = r(n.a); return truthy(a) ? truthy(r(n.b)) : false; }
      if (n.op === "||") { const a = r(n.a); return truthy(a) ? true : truthy(r(n.b)); }
      const a = r(n.a), b = r(n.b);
      switch (n.op) {
        case "+": return typeof a === "string" || typeof b === "string" ? show(a) + show(b) : fin(toNum(a) + toNum(b));
        case "-": return fin(toNum(a) - toNum(b));
        case "*": return fin(toNum(a) * toNum(b));
        case "/": return fin(toNum(a) / toNum(b));
        case "%": return fin(toNum(a) % toNum(b));
        case "**": return fin(toNum(a) ** toNum(b));
        case "==": return eq(a, b);
        case "!=": return !eq(a, b);
        case "<": return lt(a, b);
        case ">": return lt(b, a);
        case "<=": return !lt(b, a);
        case ">=": return !lt(a, b);
      }
      return 0;
    }
    case "call": {
      if (n.f === "if") { if (n.args.length !== 3) throw new ExprError("if(condition, then, else) needs 3 parts"); return truthy(r(n.args[0])) ? r(n.args[1]) : r(n.args[2]); }
      const a = n.args.map(r), x = a.map(toNum);
      const need = (min: number, max = min) => { if (a.length < min || a.length > max) throw new ExprError(`${n.f}() takes ${min === max ? min : `${min} to ${max}`} value${max === 1 ? "" : "s"}`); };
      switch (n.f) {
        case "min": need(1, 99); return Math.min(...x);
        case "max": need(1, 99); return Math.max(...x);
        case "round": { need(1, 2); const d = 10 ** Math.max(0, Math.min(9, Math.floor(x[1] ?? 0))); return Math.round(x[0] * d) / d; }
        case "floor": need(1); return Math.floor(x[0]);
        case "ceil": need(1); return Math.ceil(x[0]);
        case "abs": need(1); return Math.abs(x[0]);
        case "sqrt": need(1); return fin(Math.sqrt(x[0]));
        case "len": need(1); return show(a[0]).length;
        case "clamp": need(3); return Math.min(Math.max(x[0], Math.min(x[1], x[2])), Math.max(x[1], x[2]));
        case "sign": need(1); return Math.sign(x[0]);
        case "pow": need(2); return fin(x[0] ** x[1]);
        case "mod": need(2); return x[1] === 0 ? 0 : ((x[0] % x[1]) + x[1]) % x[1];
        case "sin": need(1); return Math.sin(x[0]);
        case "cos": need(1); return Math.cos(x[0]);
        case "randint": { need(2); const lo = Math.ceil(Math.min(x[0], x[1])), hi = Math.floor(Math.max(x[0], x[1])); return lo + Math.floor(Math.random() * (hi - lo + 1)); }
        case "upper": need(1); return show(a[0]).toUpperCase();
        case "lower": need(1); return show(a[0]).toLowerCase();
        case "trim": need(1); return show(a[0]).trim();
        case "left": need(2); return show(a[0]).slice(0, Math.max(0, x[1]));
        case "right": need(2); return x[1] <= 0 ? "" : show(a[0]).slice(-x[1]);
        case "contains": need(2); return show(a[0]).toLowerCase().includes(show(a[1]).toLowerCase());
        case "replace": need(3); return show(a[0]).split(show(a[1])).join(show(a[2]));
        case "num": need(1); return toNum(a[0]);
        case "str": need(1); return show(a[0]);
        case "random": { // random() is 0..1, random(6) is 1..6, random(3, 8) is 3..8 (whole numbers, both ends included)
          need(0, 2); if (!a.length) return Math.random();
          const [lo, hi] = a.length === 1 ? [1, Math.floor(x[0])] : [Math.floor(x[0]), Math.floor(x[1])];
          const [l, h] = lo <= hi ? [lo, hi] : [hi, lo];
          return l + Math.floor(Math.random() * (h - l + 1));
        }
        case "pick": need(1, 99); return a[Math.floor(Math.random() * a.length)];
      }
      return 0;
    }
  }
}

export interface Expr { eval(get: (name: string) => string | undefined): Val; names: string[]; impure: boolean }
const cache = new Map<string, Expr>();
/** Parse once (cached). Throws ExprError with a plain-English message. */
export function parseExpr(src: string): Expr {
  const hit = cache.get(src); if (hit) return hit;
  const tree = parse(src);
  const names = new Set<string>(); let impure = false;
  (function walk(n: Node) { if (n.k === "var") names.add(n.n); else if (n.k === "un") walk(n.a); else if (n.k === "bin") { walk(n.a); walk(n.b); } else if (n.k === "call") { if (IMPURE.has(n.f)) impure = true; n.args.forEach(walk); } })(tree);
  const e: Expr = { eval: (get) => run(tree, get), names: [...names], impure };
  if (cache.size > 500) cache.clear();
  cache.set(src, e);
  return e;
}
