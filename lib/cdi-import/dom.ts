/**
 * HTML → tree with parse5 (a parser only: it never runs scripts or loads
 * resources), plus small selection helpers. Script text stays a string.
 */

import { parse, type DefaultTreeAdapterMap } from "parse5";

export type HtmlDocument = DefaultTreeAdapterMap["document"];
export type HtmlNode = DefaultTreeAdapterMap["node"];
export type HtmlElement = DefaultTreeAdapterMap["element"];

export function parseHtml(html: string): HtmlDocument {
  return parse(html);
}

export function isElement(n: HtmlNode | null | undefined): n is HtmlElement {
  return !!n && typeof (n as HtmlElement).tagName === "string";
}

export function children(n: HtmlNode): HtmlNode[] {
  const c = (n as { childNodes?: HtmlNode[] }).childNodes ?? [];
  const content = (n as { content?: { childNodes?: HtmlNode[] } }).content;
  return content?.childNodes ? [...c, ...content.childNodes] : c;
}

export function elementChildren(n: HtmlNode): HtmlElement[] {
  return children(n).filter(isElement);
}

export function attr(n: HtmlNode, name: string): string | null {
  if (!isElement(n)) return null;
  const a = n.attrs.find((x) => x.name === name);
  return a ? a.value : null;
}

export function classes(n: HtmlNode): string[] {
  return (attr(n, "class") ?? "").split(/\s+/).filter(Boolean);
}

export function hasClass(n: HtmlNode, c: string): boolean {
  return classes(n).includes(c);
}

/** Every descendant element (document order) matching `pred`. */
export function findAll(root: HtmlNode, pred: (e: HtmlElement) => boolean): HtmlElement[] {
  const out: HtmlElement[] = [];
  const walk = (n: HtmlNode) => {
    for (const c of children(n)) {
      if (isElement(c)) {
        if (pred(c)) out.push(c);
        walk(c);
      }
    }
  };
  walk(root);
  return out;
}

export function findFirst(root: HtmlNode, pred: (e: HtmlElement) => boolean): HtmlElement | null {
  return findAll(root, pred)[0] ?? null;
}

export interface Selector {
  tag?: string;
  cls?: string;
  attr?: string;
  id?: string;
}

export function matches(e: HtmlElement, s: Selector): boolean {
  if (s.tag && e.tagName !== s.tag) return false;
  if (s.cls && !hasClass(e, s.cls)) return false;
  if (s.attr && attr(e, s.attr) == null) return false;
  if (s.id && attr(e, "id") !== s.id) return false;
  return true;
}

export function select(root: HtmlNode, s: Selector): HtmlElement[] {
  return findAll(root, (e) => matches(e, s));
}

export function selectOne(root: HtmlNode, s: Selector): HtmlElement | null {
  return findFirst(root, (e) => matches(e, s));
}

export function closest(n: HtmlNode, pred: (e: HtmlElement) => boolean): HtmlElement | null {
  let p: HtmlNode | null = n;
  while (p) {
    if (isElement(p) && pred(p)) return p;
    p = ((p as { parentNode?: HtmlNode | null }).parentNode ?? null) as HtmlNode | null;
  }
  return null;
}

const NEVER_TEXT = new Set(["script", "style", "template", "svg", "button", "input", "select", "textarea", "noscript"]);

/**
 * Text of a node (entities decoded by parse5). `skip` drops matching elements
 * (and their text); scripts, styles, buttons and form fields never count.
 */
export function textContent(n: HtmlNode, opts: { skip?: (e: HtmlElement) => boolean } = {}): string {
  if ((n as { nodeName: string }).nodeName === "#text") return (n as DefaultTreeAdapterMap["textNode"]).value;
  if (isElement(n)) {
    if (NEVER_TEXT.has(n.tagName)) return "";
    if (opts.skip?.(n)) return "";
    if (n.tagName === "br") return "\n";
  }
  return children(n).map((c) => textContent(c, opts)).join("");
}

/** Text with whitespace collapsed to single spaces and trimmed. */
export function cleanText(n: HtmlNode, opts: { skip?: (e: HtmlElement) => boolean } = {}): string {
  return textContent(n, opts).replace(/\s+/g, " ").trim();
}

/** The raw text of every <script> element that isn't a data payload. */
export function scriptTexts(doc: HtmlDocument): string[] {
  return select(doc, { tag: "script" })
    .filter((s) => {
      const type = (attr(s, "type") ?? "").toLowerCase();
      return !type || type.includes("javascript") || type === "module";
    })
    .map((s) => children(s).map((c) => ((c as { nodeName: string }).nodeName === "#text" ? (c as DefaultTreeAdapterMap["textNode"]).value : "")).join(""));
}
