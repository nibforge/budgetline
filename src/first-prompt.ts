import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeAtomic } from './fsutil.js';

/** Sessions already seen by the prompt note; the oldest are dropped past this. */
const KEEP = 200;

const seenFile = (dir: string) => join(dir, 'prompt-note-sessions.json');

function readSeen(dir: string): string[] {
  try {
    const v = JSON.parse(readFileSync(seenFile(dir), 'utf8'));
    return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/** The transcript already holds a reply: the session has had at least one turn. */
function hasReply(transcript: unknown): boolean {
  if (typeof transcript !== 'string' || !existsSync(transcript)) return false;
  try {
    return /"type"\s*:\s*"assistant"/.test(readFileSync(transcript, 'utf8'));
  } catch {
    return true; // unreadable: do not guess that it is a new session
  }
}

/**
 * The rule for the automatic note: only the FIRST prompt of a session is estimated.
 * A session counts as new when this hook has not seen its id yet AND its transcript has no
 * reply yet (so enabling the hook mid-session, or resuming one, does not count as a start).
 * Every later prompt in the session is a follow-up and gets no note.
 */
export function isFirstPrompt(dir: string, session: unknown, transcript: unknown): boolean {
  if (typeof session === 'string' && session) {
    const seen = readSeen(dir);
    if (seen.includes(session)) return false;
    try {
      writeAtomic(seenFile(dir), JSON.stringify([...seen, session].slice(-KEEP)));
    } catch {
      // read-only data dir: the transcript check below still applies
    }
  }
  return !hasReply(transcript);
}
