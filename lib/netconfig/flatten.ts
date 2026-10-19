import { tokenize } from "./util";

/**
 * Turns the hierarchical config syntaxes (Junos / PAN-OS "set" lines, curly-brace
 * output, PAN-OS XML) into flat token paths, e.g.
 *   ["interfaces","ge-0/0/0","unit","0","family","inet","address","10.0.0.1/24"]
 * Bracket lists "[ a b ]" are expanded into one path per member.
 */

export type Path = string[];

function expandLists(tokens: string[]): Path[] {
  const open = tokens.indexOf("[");
  if (open === -1) return [tokens];
  const close = tokens.indexOf("]", open);
  if (close === -1) return [tokens.filter((t) => t !== "[")];
  const head = tokens.slice(0, open);
  const members = tokens.slice(open + 1, close);
  const tail = tokens.slice(close + 1);
  return members.flatMap((m) => expandLists([...head, m, ...tail]));
}

function cleanTokens(line: string): string[] {
  // pad brackets so "[a b]" tokenizes correctly
  return tokenize(line.replace(/\[/g, " [ ").replace(/\]/g, " ] "));
}

export function flattenSetLines(text: string): Path[] {
  const out: Path[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!/^set\s/.test(line)) continue;
    out.push(...expandLists(cleanTokens(line.slice(4))));
  }
  return out;
}

export function flattenCurly(text: string): Path[] {
  const out: Path[] = [];
  const stack: string[][] = [];
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const raw of clean.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    line = line.replace(/^(inactive|protect):\s*/, "");
    if (line === "}") {
      stack.pop();
      continue;
    }
    if (line.endsWith("{")) {
      stack.push(cleanTokens(line.slice(0, -1)));
      continue;
    }
    if (line.endsWith(";")) line = line.slice(0, -1);
    const base = stack.flat();
    for (const p of expandLists([...base, ...cleanTokens(line)])) out.push(p);
  }
  return out;
}

const XML_ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decode(s: string): string {
  return s.replace(/&(lt|gt|amp|quot|apos);/g, (_, e: string) => XML_ENTITIES[e]);
}

export interface XmlResult {
  paths: Path[];
  rootAttrs: Record<string, string>;
}

/**
 * Minimal XML reader for PAN-OS exports. `<entry name="x">` becomes the token x,
 * `<member>v</member>` and text leaves become the last token of a path.
 */
export function flattenXml(text: string): XmlResult {
  const out: Path[] = [];
  const rootAttrs: Record<string, string> = {};
  const stack: string[] = [];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<(\/?)([A-Za-z_][\w:.-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  let first = true;
  while ((m = re.exec(text))) {
    if (m[3] !== undefined) {
      const closing = m[2] === "/";
      const tag = m[3];
      const attrs = m[4];
      const selfClose = m[5] === "/";
      if (closing) {
        stack.pop();
        continue;
      }
      if (first) {
        first = false;
        for (const a of Array.from(attrs.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g))) rootAttrs[a[1]] = decode(a[2]);
      }
      let token = tag;
      if (tag === "entry") {
        const n = /name\s*=\s*"([^"]*)"/.exec(attrs);
        token = n ? decode(n[1]) : "entry";
      }
      const tokenForPath = tag === "member" ? "" : token;
      stack.push(tokenForPath);
      if (selfClose) {
        // an empty entry is still meaningful (e.g. an ip entry); emit it
        if (tag === "entry") out.push(stack.filter(Boolean));
        stack.pop();
      }
    } else if (m[6] !== undefined || m[1] !== undefined) {
      const value = decode((m[6] ?? m[1]).trim());
      if (value) out.push([...stack.filter(Boolean), value]);
    }
  }
  return { paths: out, rootAttrs };
}
