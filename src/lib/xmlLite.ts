// A small, strict-enough XML reader for listing feeds: elements, attributes, text, CDATA, comments and the usual entities. It is
// deliberately limited so a hostile file cannot hurt the server: no DTD and no custom or external entities (so no "billion laughs" or
// file reads), a cap on size, depth and number of elements, and any malformed input is a plain error. The result has the shape most
// XML libraries give: an element with children is an object, a repeated element becomes an array, an attribute is "@_name", an element
// with only text is that string, and one with text and attributes keeps its text under "#text". Pure, unit tested.

export const XML_MAX_BYTES = 2 * 1024 * 1024;
const MAX_DEPTH = 24;
const MAX_ELEMENTS = 60_000;

export class XmlError extends Error {}

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, ent: string) => {
    if (ent[0] === "#") {
      const code = ent[1] === "x" || ent[1] === "X" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return NAMED[ent] ?? m; // an unknown entity is left as written, never expanded
  });
}

type Node = Record<string, unknown>;

function add(target: Node, key: string, value: unknown) {
  const have = target[key];
  if (have === undefined) target[key] = value;
  else if (Array.isArray(have)) have.push(value);
  else target[key] = [have, value];
}

/** Parses XML text into plain objects. Throws XmlError for anything malformed or too big. */
export function parseXml(input: string): unknown {
  const src = input.replace(/^\uFEFF/, "");
  if (src.length > XML_MAX_BYTES) throw new XmlError("The XML file is too large.");
  let i = 0;
  let elements = 0;
  const root: Node = {};
  const stack: { name: string; node: Node; text: string; attrs: boolean }[] = [{ name: "", node: root, text: "", attrs: false }];

  const fail = (msg: string): never => { throw new XmlError(`Invalid XML: ${msg}`); };

  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt === -1) { stack[stack.length - 1].text += src.slice(i); break; }
    if (lt > i) stack[stack.length - 1].text += src.slice(i, lt);
    if (src.startsWith("<!--", lt)) {
      const end = src.indexOf("-->", lt + 4);
      if (end === -1) fail("unclosed comment");
      i = end + 3;
    } else if (src.startsWith("<![CDATA[", lt)) {
      const end = src.indexOf("]]>", lt + 9);
      if (end === -1) fail("unclosed CDATA");
      stack[stack.length - 1].text += src.slice(lt + 9, end).replace(/&/g, "&amp;").replace(/</g, "&lt;"); // kept literal, decoded back below
      i = end + 3;
    } else if (src.startsWith("<?", lt)) {
      const end = src.indexOf("?>", lt + 2);
      if (end === -1) fail("unclosed declaration");
      i = end + 2;
    } else if (src.startsWith("<!", lt)) {
      // a DOCTYPE could define entities: refuse it outright
      fail("DOCTYPE declarations are not allowed");
    } else if (src[lt + 1] === "/") {
      const end = src.indexOf(">", lt + 2);
      if (end === -1) fail("unclosed closing tag");
      const name = src.slice(lt + 2, end).trim();
      const top = stack[stack.length - 1];
      if (stack.length === 1 || top.name !== name) fail(`unexpected </${name}>`);
      stack.pop();
      const text = decode(top.text).trim();
      const hasChildren = Object.keys(top.node).some(k => !k.startsWith("@_"));
      const value: unknown = hasChildren || top.attrs ? (text ? { ...top.node, "#text": text } : top.node) : text;
      add(stack[stack.length - 1].node, top.name, value);
      i = end + 1;
    } else {
      // an opening (or self-closing) tag, with attributes
      let j = lt + 1;
      let quote = "";
      while (j < src.length) {
        const ch = src[j];
        if (quote) { if (ch === quote) quote = ""; } else if (ch === '"' || ch === "'") quote = ch; else if (ch === ">") break;
        j++;
      }
      if (j >= src.length) fail("unclosed tag");
      const selfClosing = src[j - 1] === "/";
      const inner = src.slice(lt + 1, selfClosing ? j - 1 : j).trim();
      const nameMatch = /^[^\s/>]+/.exec(inner);
      if (!nameMatch) fail("empty tag name");
      const name = nameMatch![0];
      if (!/^[A-Za-z_][\w:.-]*$/.test(name)) fail(`bad tag name ${name}`);
      if (++elements > MAX_ELEMENTS) fail("too many elements");
      const node: Node = {};
      let attrs = false;
      const attrRe = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let m: RegExpExecArray | null;
      const rest = inner.slice(name.length);
      while ((m = attrRe.exec(rest))) { node[`@_${m[1]}`] = decode(m[3] ?? m[4] ?? ""); attrs = true; }
      if (rest.replace(attrRe, "").trim() !== "") fail(`bad attributes in <${name}>`);
      if (selfClosing) {
        add(stack[stack.length - 1].node, name, attrs ? node : "");
      } else {
        if (stack.length > MAX_DEPTH) fail("nested too deeply");
        stack.push({ name, node, text: "", attrs });
      }
      i = j + 1;
    }
  }
  if (stack.length !== 1) fail(`<${stack[stack.length - 1].name}> is not closed`);
  if (stack[0].text.trim() !== "") fail("text outside the root element");
  if (Object.keys(root).length === 0) fail("no elements found");
  return root;
}
