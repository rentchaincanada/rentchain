/**
 * Deterministic JSON canonicalizer.
 * - Objects: lexicographically sorted keys, omit undefined, include null.
 * - Arrays: preserve order, canonicalize elements.
 * - Primitives: standard JSON rules.
 */
export function canonicalize(value: any): string {
  return _canon(value);
}

function _canon(v: any): string {
  if (v === null || typeof v !== "object") {
    // primitives and null
    return JSON.stringify(v);
  }

  if (Array.isArray(v)) {
    const parts = v.map((item) => _canon(item));
    return `[${parts.join(",")}]`;
  }

  // object: sort keys, omit undefined
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  const parts: string[] = [];
  for (const k of keys) {
    parts.push(`${JSON.stringify(k)}:${_canon(v[k])}`);
  }
  return `{${parts.join(",")}}`;
}
