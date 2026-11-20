import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { writeAtomic } from '../fsutil.js';
import { parseSession } from './parse.js';
import type { Session } from './types.js';

interface SessionFiles {
  main: string;
  subagents: string[];
}

export interface LoadOptions {
  /** Claude Code config dir (contains projects/). */
  claudeDir: string;
  /** Cache file; omitted means no cache. */
  cacheFile?: string;
  /** Keep raw prompt text (bypasses the cache, which never stores it). */
  keepPrompts?: boolean;
}

/** Bumped when the cached Session shape changes: an older cache is ignored and rebuilt. */
export const CACHE_VERSION = 5;

interface CacheEntry {
  sig: string;
  session: Session | null;
}

export function listJsonl(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => join(dir, f));
}

/** Every main session transcript under <claudeDir>/projects with its subagent files. */
function findSessions(claudeDir: string): SessionFiles[] {
  const root = join(claudeDir, 'projects');
  if (!existsSync(root)) return [];
  const out: SessionFiles[] = [];
  for (const proj of readdirSync(root, { withFileTypes: true })) {
    if (!proj.isDirectory()) continue;
    const pdir = join(root, proj.name);
    for (const main of listJsonl(pdir)) {
      const sub = join(pdir, basename(main, '.jsonl'), 'subagents');
      out.push({ main, subagents: listJsonl(sub) });
    }
  }
  return out;
}

function signature(f: SessionFiles): string {
  return [f.main, ...f.subagents]
    .map((p) => {
      const st = statSync(p);
      return `${p}:${st.size}:${Math.round(st.mtimeMs)}`;
    })
    .join('|');
}

function readCache(file?: string): Record<string, CacheEntry> {
  if (!file || !existsSync(file)) return {};
  try {
    const c = JSON.parse(readFileSync(file, 'utf8'));
    return c.version === CACHE_VERSION ? c.entries : {};
  } catch {
    return {};
  }
}

function parseFiles(f: SessionFiles, keepPrompts: boolean): Session | null {
  const subs = f.subagents.map((p) => readFileSync(p, 'utf8'));
  return parseSession(readFileSync(f.main, 'utf8'), subs, { keepPrompts });
}

/** One session from its main transcript path, with its subagent transcripts (null if unreadable or empty). */
export function parseTranscript(main: string): Session | null {
  try {
    return parseFiles({ main, subagents: listJsonl(join(dirname(main), basename(main, '.jsonl'), 'subagents')) }, false);
  } catch {
    return null;
  }
}

/** The cached entry when the files are unchanged, else a fresh parse; null if unreadable. */
function entryFor(f: SessionFiles, old: Record<string, CacheEntry>, keepPrompts: boolean): { entry: CacheEntry; hit: boolean } | null {
  try {
    const sig = signature(f);
    const hit = old[f.main]?.sig === sig;
    return { entry: hit ? old[f.main]! : { sig, session: parseFiles(f, keepPrompts) }, hit };
  } catch {
    return null; // unreadable file (locked, deleted mid-scan): skip it
  }
}

/** Write the cache atomically; a failed write (read-only dir, EPERM on a rename in Windows) only costs a rescan. */
function saveCache(file: string, entries: Record<string, CacheEntry>): void {
  try {
    writeAtomic(file, JSON.stringify({ version: CACHE_VERSION, entries }));
  } catch {
    // the cache is optional: the next run rescans
  }
}

/** Load every session, reusing the cache for files that have not changed; rewrite it only if something did. */
export function loadSessions(opts: LoadOptions): Session[] {
  const useCache = !opts.keepPrompts && opts.cacheFile;
  const old = useCache ? readCache(opts.cacheFile) : {};
  const next: Record<string, CacheEntry> = {};
  const sessions: Session[] = [];
  let changed = false;
  for (const f of findSessions(opts.claudeDir)) {
    const r = entryFor(f, old, !!opts.keepPrompts);
    if (!r) continue;
    changed ||= !r.hit;
    next[f.main] = r.entry;
    if (r.entry.session) sessions.push(r.entry.session);
  }
  changed ||= Object.keys(old).length !== Object.keys(next).length;
  if (useCache && changed) saveCache(opts.cacheFile!, next);
  sessions.sort((a, b) => (a.start < b.start ? -1 : 1));
  return sessions;
}
