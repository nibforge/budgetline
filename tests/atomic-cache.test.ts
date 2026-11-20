import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadSessions } from '../src/transcripts/scan.js';
import { logEstimate, readLog } from '../src/accuracy.js';
import { fakeClaudeDir, L, tmp } from './helpers.js';

/* Based on the test contributed by bfs2021 in nibforge/budgetline#3 (issue #2). */

const fsMock = vi.hoisted(() => ({
  renames: [] as [string, string][],
  /** Write half of the text, then fail, as a crash or a full disk would. */
  cutWrites: false,
  failRename: false,
}));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    writeFileSync: (file: string, data: string, ...rest: unknown[]) => {
      if (!fsMock.cutWrites) return (actual.writeFileSync as (...a: unknown[]) => void)(file, data, ...rest);
      actual.writeFileSync(file, String(data).slice(0, String(data).length >> 1));
      throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
    },
    renameSync: (src: string, dest: string) => {
      fsMock.renames.push([src, dest]);
      if (fsMock.failRename) throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
      return actual.renameSync(src, dest);
    },
  };
});

const T = (s: number) => `2026-01-01T10:00:${String(s).padStart(2, '0')}.000Z`;
const session = (p: string) => ({ main: [L.prompt(p, T(0)), L.reply(p, T(1))] });

describe('atomic transcript cache (#2)', () => {
  beforeEach(() => {
    fsMock.renames = [];
    fsMock.cutWrites = false;
    fsMock.failRename = false;
  });

  it('installs the cache with rename, never writing the final path in place', () => {
    const cacheFile = join(tmp(), 'index-v1.json');
    loadSessions({ claudeDir: fakeClaudeDir({ a: session('hi') }), cacheFile });
    expect(fsMock.renames.some(([, dest]) => dest === cacheFile)).toBe(true);
  });

  it('a write cut short leaves the previous cache whole, and is not fatal', () => {
    const cacheFile = join(tmp(), 'index-v1.json');
    loadSessions({ claudeDir: fakeClaudeDir({ a: session('one') }), cacheFile });
    const before = readFileSync(cacheFile, 'utf8');
    const claudeDir = fakeClaudeDir({ a: session('one'), b: session('two') });
    fsMock.cutWrites = true;
    const sessions = loadSessions({ claudeDir, cacheFile });
    expect(sessions).toHaveLength(2);
    expect(readFileSync(cacheFile, 'utf8')).toBe(before);
    expect(() => JSON.parse(readFileSync(cacheFile, 'utf8'))).not.toThrow();
  });

  it('a failed rename (EPERM on Windows) is not fatal and leaves no temporary file', () => {
    const cacheFile = join(tmp(), 'index-v1.json');
    const claudeDir = fakeClaudeDir({ a: session('hi') });
    fsMock.failRename = true;
    expect(loadSessions({ claudeDir, cacheFile })).toHaveLength(1);
    expect(readdirSync(dirname(cacheFile))).toEqual([]);
  });

  it('ignores a truncated cache file and rebuilds it', () => {
    const cacheFile = join(tmp(), 'index-v1.json');
    writeFileSync(cacheFile, '{"version":5,"entries":');
    expect(loadSessions({ claudeDir: fakeClaudeDir({ a: session('hi') }), cacheFile })).toHaveLength(1);
    expect(() => JSON.parse(readFileSync(cacheFile, 'utf8'))).not.toThrow();
  });
});

describe('accuracy log with a partial last line (#2)', () => {
  it('readers skip the partial line and the next record stays whole', () => {
    const file = join(tmp(), 'estimates.jsonl');
    const eq = { low: 1, typical: 2, high: 3 };
    logEstimate(file, '/p', eq, new Date(T(0)));
    writeFileSync(file, readFileSync(file, 'utf8') + '{"ts":"2026-01-01T10:00:01.000Z","proj');
    expect(readLog(file)).toHaveLength(1);
    logEstimate(file, '/p', eq, new Date(T(2)));
    expect(readLog(file).map((e) => e.ts)).toEqual([T(0), T(2)]);
  });
});
