import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hookCommand, hookOutput, message, ESTIMATE_COMMAND } from '../src/hook.js';
import { runEstimate, type EstimateResult } from '../src/estimate-cmd.js';
import { readLog } from '../src/accuracy.js';
import { writeConfig } from '../src/config.js';
import { parseSession } from '../src/transcripts/parse.js';
import { L, tmp } from './helpers.js';

const T = (m: number, s = 0) => `2026-01-01T10:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.000Z`;

/** Six similar, expensive past tasks in /work/demo. */
const sessions = () => {
  const lines = [L.cost('claude-test-1', 50)];
  for (let i = 0; i < 6; i++) lines.push(L.prompt(`migrate the database schema ${i}`, T(i)), L.reply(`m${i}`, T(i, 30), { input: 900_000 }));
  return [parseSession(lines.join('\n'))!];
};

function enabled(): string {
  const dir = tmp();
  writeConfig(dir, { hookEnabled: true });
  return dir;
}

const input = (prompt: string, extra: object = {}) => JSON.stringify({ prompt, cwd: '/work/demo', ...extra });
const note = (out: string) => (out ? JSON.parse(out).systemMessage as string : '');

describe('prompt note: only the first prompt of a session (a)', () => {
  it('notes the first prompt and stays quiet on the follow-ups', () => {
    const dir = enabled();
    const transcript = join(tmp(), 't.jsonl');
    const first = input('migrate the database schema', { session_id: 'now', transcript_path: transcript });
    expect(note(hookOutput(first, dir, sessions))).toContain('budgetline');
    writeFileSync(transcript, [L.prompt('migrate the database schema', T(0)), L.reply('a', T(1))].join('\n'));
    expect(hookOutput(input('migrate the database schema again', { session_id: 'now', transcript_path: transcript }), dir, sessions)).toBe('');
  });

  it('the real case: a short follow-up in a long session gets no note', () => {
    const dir = enabled();
    const transcript = join(tmp(), 'long.jsonl');
    const turns = Array.from({ length: 40 }, (_, i) => [L.prompt(`step ${i}`, T(i % 60)), L.reply(`r${i}`, T(i % 60, 30), { read: 200_000 })]);
    writeFileSync(transcript, turns.flat().join('\n'));
    const out = hookOutput(input('ok, now migrate the database schema too', { session_id: 'long', transcript_path: transcript }), dir, sessions);
    expect(out).toBe('');
  });

  it('a session seen for the first time with replies already (hook enabled mid-session, resume) is not a start', () => {
    const dir = enabled();
    const transcript = join(tmp(), 't.jsonl');
    writeFileSync(transcript, [L.prompt('hello', T(0)), L.reply('a', T(1))].join('\n'));
    expect(hookOutput(input('migrate the database schema', { session_id: 'new-id', transcript_path: transcript }), dir, sessions)).toBe('');
  });
});

describe('prompt note: no bias correction (b)', () => {
  it('ignores the accuracy log, whose bias was measured on whole sessions', () => {
    const plain = note(hookOutput(input('migrate the database schema', { session_id: 'a' }), enabled(), sessions));
    expect(plain).toContain('big task');
    const dir = enabled();
    const e = (min: number) => JSON.stringify({ ts: `2026-01-01T09:5${min}:00.000Z`, project: '/work/demo', low: 1, typical: 10, high: 20, raw: 10 });
    writeFileSync(join(dir, 'estimates.jsonl'), [e(5), e(6), e(7)].join('\n') + '\n');
    const log = readLog(join(dir, 'estimates.jsonl'));
    expect(runEstimate(sessions(), 'migrate the database schema', '/work/demo', null, false, { log })?.bias).not.toBeNull(); // the log does carry a bias
    expect(note(hookOutput(input('migrate the database schema', { session_id: 'a' }), dir, sessions))).toBe(plain);
    expect(existsSync(join(dir, 'estimates.jsonl')) && readFileSync(join(dir, 'estimates.jsonl'), 'utf8').split('\n').filter(Boolean)).toHaveLength(3);
  });
});

describe('prompt note: wording (c, d)', () => {
  const result = (lowConfidence: boolean) =>
    ({ est: { fewData: lowConfidence, wide: false }, eq: { low: 1e6, typical: 1.6e6, high: 3e6 }, usd: null, limit5h: { low: 5, typical: 12, high: 20 }, plan: true }) as unknown as EstimateResult;

  it('with low confidence it does not call the task big', () => {
    const m = message(result(true));
    expect(m).not.toMatch(/big task/);
    expect(m).toContain('low confidence');
    expect(m).toContain('~12% of your 5-hour limit');
  });

  it('with enough data it says the task looks big', () => {
    expect(message(result(false))).toContain('this looks like a big task');
  });

  it('points to the namespaced plugin command, which always resolves', () => {
    const plugin = JSON.parse(readFileSync('.claude-plugin/plugin.json', 'utf8'));
    expect(ESTIMATE_COMMAND).toBe(`/${plugin.name}:estimate`);
    expect(existsSync('commands/estimate.md')).toBe(true);
    expect(message(result(false))).toContain(ESTIMATE_COMMAND);
    expect(message(result(false))).not.toMatch(/Run \/estimate/);
  });
});

describe('prompt note: can be turned off (e)', () => {
  it('`hook disable` silences it, and the README says how', () => {
    const prev = process.env.BUDGETLINE_DATA;
    const dir = enabled();
    process.env.BUDGETLINE_DATA = dir;
    try {
      hookCommand({ positional: ['disable'], flags: {} } as never);
    } finally {
      if (prev === undefined) delete process.env.BUDGETLINE_DATA;
      else process.env.BUDGETLINE_DATA = prev;
    }
    expect(hookOutput(input('migrate the database schema', { session_id: 'z' }), dir, sessions)).toBe('');
    expect(readFileSync('README.md', 'utf8')).toContain('budgetline hook disable');
  });
});
