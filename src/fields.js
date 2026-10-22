export const fieldValue = (data, path) =>
  path.split(".").reduce((value, key) => value?.[key], data);

export function setFieldValue(data, path, value) {
  const next = structuredClone(data);
  const keys = path.split(".");
  let target = next;
  for (const key of keys.slice(0, -1)) target = target[key] ||= {};
  target[keys.at(-1)] = value;
  return next;
}
