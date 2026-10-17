export const readField = (data, path) =>
  path.split(".").reduce((v, k) => v?.[k], data);
// Read line structure without innerText (which applies CSS text-transform).
export function elementText(element) {
  if (element.childNodes.length === 1 && element.firstChild.nodeName === "BR")
    return "";
  const walk = (node) => {
    if (node.nodeType === 3) return node.nodeValue;
    if (node.nodeName === "BR")
      return node.hasAttribute("data-caret-guard") ? "" : "\n";
    let value = "";
    for (const child of node.childNodes) {
      if (
        ["DIV", "P"].includes(child.nodeName) &&
        value &&
        !value.endsWith("\n")
      )
        value += "\n";
      value += walk(child);
    }
    return value;
  };
  return walk(element);
}
export function writeField(data, path, value) {
  const next = structuredClone(data),
    keys = path.split(".");
  let target = next;
  for (const key of keys.slice(0, -1)) {
    if (target[key] === undefined) target[key] = {};
    target = target[key];
  }
  target[keys.at(-1)] = value;
  return next;
}
// Preserve ZWNJ/ZWJ: these are meaningful in Dari and Pashto joining.
export const plainText = (value) =>
  String(value)
    .normalize("NFC")
    .replace(/\r\n?|[\u2028\u2029]/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\p{Cf}/gu, (c) => (c === "\u200c" || c === "\u200d" ? c : ""))
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u00ad\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g,
      "",
    );
export function fieldLimit(path, data, definitions, limits) {
  if (path.startsWith("templateText.")) return limits?.templateText || 1000;
  if (path.startsWith("optionalSections.")) {
    const [, index, , , key] = path.split(".");
    const section = data.optionalSections[index];
    return definitions[section.type]?.fields[key]?.maxLength || 80;
  }
  const key = /\.bullets\.\d+$/.test(path) ? "bullet" : path.split(".").at(-1);
  return limits?.[key] || (/^skills\./.test(path) ? 100 : 240);
}
