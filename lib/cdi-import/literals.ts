/**
 * Reads data literals out of the source scripts with acorn — the code is
 * parsed into a syntax tree and never evaluated. Only object / array /
 * string / number / boolean / null literals, template strings without
 * expressions and a unary minus before a number are accepted; any other
 * node is a LiteralError.
 */

import { parse, type Node } from "acorn";

export type Literal = string | number | boolean | null | Literal[] | { [k: string]: Literal };

export class LiteralError extends Error {
  constructor(
    readonly literalName: string,
    readonly nodeType: string,
  ) {
    super(`"${literalName}" is not a plain literal (found ${nodeType}); it is never evaluated.`);
    this.name = "LiteralError";
  }
}

type AnyNode = Node & Record<string, unknown>;

function keyOf(prop: AnyNode, name: string): string {
  if (prop.computed) throw new LiteralError(name, "computed key");
  const key = prop.key as AnyNode;
  if (key.type === "Identifier") return String(key.name);
  if (key.type === "Literal") return String(key.value);
  throw new LiteralError(name, String(key.type));
}

/** The value of a literal node, or LiteralError. */
export function literalValue(node: AnyNode, name: string): Literal {
  switch (node.type) {
    case "Literal": {
      const v = node.value;
      if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
      throw new LiteralError(name, "regex/bigint literal");
    }
    case "TemplateLiteral": {
      if ((node.expressions as unknown[]).length) throw new LiteralError(name, "template expression");
      return ((node.quasis as AnyNode[])[0]?.value as { cooked: string }).cooked ?? "";
    }
    case "UnaryExpression": {
      const arg = node.argument as AnyNode;
      if (node.operator === "-" && arg.type === "Literal" && typeof arg.value === "number") return -arg.value;
      throw new LiteralError(name, "UnaryExpression");
    }
    case "ArrayExpression":
      return (node.elements as (AnyNode | null)[]).map((e) => {
        if (!e) throw new LiteralError(name, "array hole");
        if (e.type === "SpreadElement") throw new LiteralError(name, "SpreadElement");
        return literalValue(e, name);
      });
    case "ObjectExpression": {
      const out: { [k: string]: Literal } = {};
      for (const p of node.properties as AnyNode[]) {
        if (p.type !== "Property" || p.kind !== "init" || p.method || p.shorthand) throw new LiteralError(name, p.type === "Property" ? "method/shorthand property" : String(p.type));
        out[keyOf(p, name)] = literalValue(p.value as AnyNode, name);
      }
      return out;
    }
    default:
      throw new LiteralError(name, String(node.type));
  }
}

function walk(node: unknown, visit: (n: AnyNode) => void): void {
  if (!node || typeof (node as AnyNode).type !== "string") return;
  visit(node as AnyNode);
  for (const k of Object.keys(node as object)) {
    if (k === "loc" || k === "range") continue;
    const v = (node as Record<string, unknown>)[k];
    if (Array.isArray(v)) v.forEach((c) => walk(c, visit));
    else if (v && typeof (v as AnyNode).type === "string") walk(v, visit);
  }
}

/**
 * Initialisers of the named variables (first declaration of each name, at any
 * depth) as plain values. A named variable whose initialiser isn't a literal
 * throws LiteralError; names that are absent are simply missing.
 */
export function extractLiterals(scripts: readonly string[], names: readonly string[]): Record<string, Literal> {
  const wanted = new Set(names);
  const out: Record<string, Literal> = {};
  for (const code of scripts) {
    if (!code.trim()) continue;
    const ast = parse(code, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true });
    walk(ast, (n) => {
      if (n.type !== "VariableDeclarator") return;
      const id = n.id as AnyNode;
      if (id.type !== "Identifier") return;
      const name = String(id.name);
      if (!wanted.has(name) || name in out || !n.init) return;
      out[name] = literalValue(n.init as AnyNode, name);
    });
  }
  return out;
}

/** Every variable whose initialiser is an object/array literal (name → value); non-literals are skipped. */
export function allLiteralObjects(scripts: readonly string[]): Map<string, Literal> {
  const out = new Map<string, Literal>();
  for (const code of scripts) {
    if (!code.trim()) continue;
    const ast = parse(code, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true });
    walk(ast, (n) => {
      if (n.type !== "VariableDeclarator" || !n.init) return;
      const id = n.id as AnyNode;
      const init = n.init as AnyNode;
      if (id.type !== "Identifier" || (init.type !== "ObjectExpression" && init.type !== "ArrayExpression")) return;
      const name = String(id.name);
      if (out.has(name)) return;
      try {
        out.set(name, literalValue(init, name));
      } catch {
        /* not data */
      }
    });
  }
  return out;
}
