import { appendFileSync, closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs';

/* eslint-disable @typescript-eslint/no-explicit-any -- JSONL lines are untyped JSON */

/** Parse JSON Lines; blank, truncated or corrupt lines (and non-objects) are skipped, never fatal. */
export function parseJsonl<T = Record<string, any>>(text: string): T[] {
  const out: T[] = [];
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    try {
      const o = JSON.parse(raw);
      if (o && typeof o === 'object') out.push(o);
    } catch {
      // skip the line
    }
  }
  return out;
}

/** Read a JSON Lines file; a missing file is an empty list. */
export function readJsonl<T>(file: string): T[] {
  return existsSync(file) ? parseJsonl<T>(readFileSync(file, 'utf8')) : [];
}

/** True when the file exists, is not empty and its last byte is not a newline (a write cut short). */
function endsMidLine(file: string): boolean {
  const size = existsSync(file) ? statSync(file).size : 0;
  if (size === 0) return false;
  const fd = openSync(file, 'r');
  try {
    const b = Buffer.alloc(1);
    readSync(fd, b, 0, 1, size - 1);
    return b[0] !== 0x0a;
  } finally {
    closeSync(fd);
  }
}

/** Append one JSON line; after a partial last line, start on a new line so this record stays whole. */
export function appendJsonl(file: string, value: unknown): void {
  appendFileSync(file, (endsMidLine(file) ? '\n' : '') + JSON.stringify(value) + '\n');
}
