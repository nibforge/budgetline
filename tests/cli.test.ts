import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/cli.js';
import { parseArgs } from '../src/args.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { claudeDir } from '../src/paths.js';
import { L, fakeClaudeDir, tmp } from './helpers.js';

function capture(): { out: () => string } {
  let buf = '';
  vi.spyOn(process.stdout, 'write').mockImplementation((s: string | Uint8Array) => {
    buf += String(s);
    return true;
  });
  return { out: () => buf };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('cli', () => {
  it('parses flags, values and positional text', () => {
    expect(parseArgs(['estimate', 'add a page', '--cwd', 'x', '--json', '--limit=3'], ['cwd', 'limit'])).toEqual({
      positional: ['estimate', 'add a page'],
      flags: { cwd: 'x', json: true, limit: '3' },
    });
  });

  it('prints help and fails on an unknown command', async () => {
    const c = capture();
    expect(await main(['--help'])).toBe(0);
    expect(c.out()).toContain('budgetline estimate');
    expect(c.out()).toContain('See where your Claude Code budget goes — and stop hitting your limits.');
    expect(c.out()).not.toMatch(/before you hit Enter/i);
    expect(await main(['nope'])).toBe(1);
  });

  it('runs history and estimate end to end on a fake config dir', async () => {
    const dir = fakeClaudeDir({ s1: { main: [L.prompt('private words here', '2026-01-01T10:00:00.000Z'), L.reply('a', '2026-01-01T10:01:00.000Z')] } });
    vi.stubEnv('CLAUDE_CONFIG_DIR', dir);
    vi.stubEnv('BUDGETLINE_DATA', tmp());
    const c = capture();
    await main(['history']);
    await main(['estimate', 'something new', '--cwd', tmp()]);
    expect(c.out()).toContain('1 sessions, 1 tasks');
    expect(c.out()).toContain('LOW CONFIDENCE');
    expect(c.out()).not.toContain('private words');
  });

  it('rejects a bad history --limit instead of ignoring it (review)', async () => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', fakeClaudeDir({}));
    vi.stubEnv('BUDGETLINE_DATA', tmp());
    for (const bad of ['0', '-3', '2.5', 'abc', '']) {
      await expect(main(['history', `--limit=${bad}`])).rejects.toThrow(/--limit must be a positive whole number/);
    }
    await expect(main(['history', '--limit'])).rejects.toThrow(/--limit/);
    const c = capture();
    expect(await main(['history', '--limit', '2'])).toBe(0);
    expect(c.out()).toContain('No Claude Code sessions found');
  });

  it('finds transcripts under CLAUDE_CONFIG_DIR, else ~/.claude', () => {
    expect(claudeDir({ CLAUDE_CONFIG_DIR: join('x', 'cfg') })).toBe(join('x', 'cfg'));
    expect(claudeDir({})).toBe(join(homedir(), '.claude'));
  });
});
