import { percentile } from './cost.js';
import { appendJsonl, readJsonl } from './jsonl.js';
import type { Range } from './estimate.js';
import type { TaskRow } from './history.js';

/** One logged estimate. Metrics only: never the task description. */
export interface EstimateLog {
  ts: string;
  project: string;
  /** Equivalent-token range. */
  low: number;
  typical: number;
  high: number;
  /** Typical before the bias correction (absent in logs older than 0.2.1: they were never corrected). */
  raw?: number;
}

/** Measured bias of past estimates: multiply a new estimate by `factor`. */
export interface Bias {
  /** Median of actual / uncorrected typical. */
  factor: number;
  /** Estimates it is based on. */
  n: number;
}

/** Bias is applied only once this many estimates have been checked. */
export const MIN_BIAS = 3;

export interface Accuracy {
  /** Estimates matched with a real task. */
  n: number;
  within: number;
  /** Median of max(actual/typical, typical/actual): 1 = exact, 2 = off by 2x. */
  typicalFactor: number | null;
}

/** The next task must start within this time of the estimate to count as "the" task. */
const MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;
const MIN_JUDGE = 5;

export function logEstimate(file: string, project: string, eq: Range, now = new Date(), raw = eq.typical): void {
  const e: EstimateLog = { ts: now.toISOString(), project, low: eq.low, typical: eq.typical, high: eq.high, raw };
  appendJsonl(file, e);
}

export function readLog(file: string): EstimateLog[] {
  return readJsonl<EstimateLog>(file);
}

/** The first task in the same project that started after the estimate, within the window. */
function nextTask(e: EstimateLog, rows: TaskRow[]): TaskRow | undefined {
  const t0 = Date.parse(e.ts);
  let best: TaskRow | undefined;
  for (const r of rows) {
    const t = Date.parse(r.start);
    if (r.estimate || r.project.toLowerCase() !== e.project.toLowerCase() || t <= t0 || t - t0 > MATCH_WINDOW_MS) continue;
    if (!best || r.start < best.start) best = r;
  }
  return best;
}

export function evaluate(log: EstimateLog[], rows: TaskRow[]): Accuracy {
  const factors: number[] = [];
  let within = 0;
  for (const e of log) {
    const real = nextTask(e, rows);
    if (!real || e.typical <= 0 || real.eq <= 0) continue;
    if (real.eq >= e.low && real.eq <= e.high) within++;
    factors.push(Math.max(real.eq / e.typical, e.typical / real.eq));
  }
  return { n: factors.length, within, typicalFactor: factors.length ? percentile(factors, 0.5) : null };
}

/**
 * Median of actual / uncorrected estimate over the checked estimates, or null with fewer
 * than MIN_BIAS. Measured against the raw figure so the correction never feeds on itself.
 */
export function measuredBias(log: EstimateLog[], rows: TaskRow[]): Bias | null {
  const ratios: number[] = [];
  for (const e of log) {
    const real = nextTask(e, rows);
    const base = e.raw ?? e.typical;
    if (real && base > 0 && real.eq > 0) ratios.push(real.eq / base);
  }
  return ratios.length >= MIN_BIAS ? { factor: percentile(ratios, 0.5), n: ratios.length } : null;
}

export function accuracyLine(a: Accuracy): string {
  if (a.n === 0) return 'Accuracy so far: no estimate checked yet (each one is compared with the next task you run in that project).';
  const stats = `${a.n} estimate${a.n === 1 ? '' : 's'}, ${Math.round((a.within / a.n) * 100)}% within range, typical error ×${a.typicalFactor!.toFixed(1)}`;
  return a.n < MIN_JUDGE ? `Accuracy so far: ${stats}. Too few to judge yet.` : `Accuracy so far: ${stats}.`;
}
