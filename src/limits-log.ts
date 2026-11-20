import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs';
import type { LimitSample } from './calibration.js';
import { writeAtomic } from './fsutil.js';
import { appendJsonl, parseJsonl } from './jsonl.js';

/** Samples older than this are dropped. Calibration only needs recent pairs. */
export const KEEP_DAYS = 30;
const DAY_MS = 86_400_000;
/** The status line runs after every message: it reads only this much of the end of the file. */
const TAIL_BYTES = 16 * 1024;

function readRange(file: string, from: 'start' | 'end', bytes: number): string {
  const fd = openSync(file, 'r');
  try {
    const size = fstatSync(fd).size;
    const len = Math.min(bytes, size);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, from === 'end' ? size - len : 0);
    return buf.toString('utf8');
  } finally {
    closeSync(fd);
  }
}

const same = (a: LimitSample, b: LimitSample) =>
  a.cost === b.cost && a.five === b.five && a.seven === b.seven && a.fiveReset === b.fiveReset && a.sevenReset === b.sevenReset && a.ctx === b.ctx;

/** The last sample of `session` in the whole file (the status line's latest figures for it). */
export function lastSample(samples: LimitSample[], session: string): LimitSample | undefined {
  for (let i = samples.length - 1; i >= 0; i--) if (samples[i]!.session === session) return samples[i];
  return undefined;
}

/** The last sample of `session` near the end of the file, if any. */
function lastOf(file: string, session: string): LimitSample | undefined {
  const tail = parseJsonl<LimitSample>(readRange(file, 'end', TAIL_BYTES));
  for (let i = tail.length - 1; i >= 0; i--) if (tail[i]!.session === session) return tail[i];
  return undefined;
}

/** Rewrite the file without samples older than KEEP_DAYS, but only once its first one is a day past that. */
function prune(file: string, now: Date): void {
  const head = readRange(file, 'start', 1024).split('\n')[0] ?? '';
  const first = parseJsonl<LimitSample>(head)[0];
  const cutoff = now.getTime() - KEEP_DAYS * DAY_MS;
  if (!first || Date.parse(first.ts) >= cutoff - DAY_MS) return;
  const kept = parseJsonl<LimitSample>(readFileSync(file, 'utf8')).filter((s) => Date.parse(s.ts) >= cutoff);
  try {
    writeAtomic(file, kept.map((s) => JSON.stringify(s) + '\n').join(''));
  } catch {
    // pruning is housekeeping: try again with the next sample
  }
}

/** Append a sample only if %, cost or reset time changed since the session's last one; keep the file bounded. */
export function logSample(file: string, sample: LimitSample, now = new Date()): boolean {
  if (existsSync(file)) {
    const last = lastOf(file, sample.session);
    if (last && same(last, sample)) return false;
  }
  appendJsonl(file, sample);
  prune(file, now);
  return true;
}
