import { join } from 'node:path';
import type { Parsed } from './args.js';
import { readBilling } from './calibration.js';
import { isFirstPrompt } from './first-prompt.js';
import { isEstimateRequest } from './text.js';
import { readConfig, writeConfig, type Config } from './config.js';
import { runEstimate, type EstimateResult } from './estimate-cmd.js';
import { tokens, usd } from './format.js';
import { dataDir } from './paths.js';
import type { Session } from './transcripts/types.js';

function setEnabled(dir: string, enabled: boolean): string {
  writeConfig(dir, { hookEnabled: enabled });
  return enabled
    ? 'Hook enabled: the first prompt of a session gets a one-line budgetline note when it looks expensive. It never blocks a prompt. Disable with: budgetline hook disable'
    : 'Hook disabled.';
}

/** The plugin command that shows the full estimate (the namespaced name always resolves). */
export const ESTIMATE_COMMAND = '/budgetline:estimate';

/**
 * UserPromptSubmit hook body. Returns the hook's stdout: empty (do nothing) unless the hook
 * is enabled, this is the session's first prompt (isFirstPrompt) and the typical estimate
 * is above the threshold. Never blocks the prompt.
 */
export function hookOutput(input: string, dir: string, sessions: () => Session[], cfg: Config = readConfig(dir)): string {
  if (!cfg.hookEnabled) return '';
  try {
    const { prompt, cwd, session_id: session, transcript_path: transcript } = JSON.parse(input);
    if (!isRealPrompt(prompt) || !isFirstPrompt(dir, session, transcript)) return '';
    const { calibration, plan } = readBilling(join(dir, 'limits.jsonl'));
    // No `log`: the bias correction was measured on whole sessions, not on one message.
    const opts = { session: typeof session === 'string' ? session : undefined };
    const r = runEstimate(sessions(), prompt, cwd || process.cwd(), calibration, plan, opts);
    if (!r || r.eq.typical < cfg.hookThreshold) return '';
    return JSON.stringify({ systemMessage: message(r) });
  } catch {
    return '';
  }
}

/** A prompt worth a note: non-empty text that is not an /estimate request. */
const isRealPrompt = (prompt: unknown): prompt is string => typeof prompt === 'string' && prompt.trim() !== '' && !isEstimateRequest(prompt);

/** With low confidence the note only states the rough figure: it does not call the task big. */
export function message(r: EstimateResult): string {
  const limit = r.limit5h ? `~${Math.max(1, Math.round(r.limit5h.typical))}% of your 5-hour limit, ` : '';
  const cost = r.usd ? `, ~${usd(r.usd.typical, true)}${r.plan ? ' API-equivalent value' : ''}` : '';
  const figures = `${limit}~${tokens(r.eq.typical)} equivalent tokens${cost} typical`;
  const more = `Range and savings tips: ${ESTIMATE_COMMAND} <task>.`;
  if (r.est.fewData || r.est.wide) return `budgetline: rough figure for tasks like this (low confidence): ${figures}. ${more}`;
  return `budgetline: this looks like a big task: ${figures}. ${more}`;
}

export function hookCommand(p: Parsed): string {
  const sub = p.positional[0];
  const dir = dataDir();
  if (sub === 'enable') return setEnabled(dir, true);
  if (sub === 'disable') return setEnabled(dir, false);
  if (sub === 'status') return `Prompt note (first prompt of each session): ${readConfig(dir).hookEnabled ? 'enabled' : 'disabled (default)'}.`;
  throw new Error('usage: budgetline hook enable | disable | status');
}
