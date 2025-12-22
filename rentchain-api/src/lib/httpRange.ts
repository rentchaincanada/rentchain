export function parseRange(rangeHeader: string | undefined, size: number) {
  if (!rangeHeader) return null;
  const m = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!m) return null;

  const startStr = m[1];
  const endStr = m[2];

  let start: number | null = startStr ? Number(startStr) : null;
  let end: number | null = endStr ? Number(endStr) : null;

  if (start !== null && (!Number.isFinite(start) || start < 0)) return null;
  if (end !== null && (!Number.isFinite(end) || end < 0)) return null;

  if (start === null && end !== null) {
    const len = end;
    if (len <= 0) return null;
    start = Math.max(size - len, 0);
    end = size - 1;
  }

  if (start !== null && end === null) {
    end = size - 1;
  }

  if (start === null || end === null) return null;
  if (start > end) return null;
  if (start >= size) return null;

  end = Math.min(end, size - 1);

  return { start, end };
}
