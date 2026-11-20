# Changelog

## 0.3.1

- **Prompt note only on the first prompt of a session.** Follow-up messages no longer get
  a note: it appears only on the first prompt the hook sees for a session, while its
  transcript has no reply yet. It no longer applies the bias correction (measured on whole
  sessions, not on one message); with low confidence it gives the rough figure without
  calling the task big; it points to `/budgetline:estimate`, the name that always resolves.
  Turn it off with `budgetline hook disable` (see README, *Prompt note*).
- **Atomic transcript cache** (closes #2). The cache is written to a temporary file and
  renamed over the old one, so a hook never reads it half-written; a failed write or rename
  (EPERM on Windows) only costs a rescan. Appends to the estimate and limit logs start on a
  new line after a partial last line, so the new record stays whole. Thanks to **@bfs2021**
  for the fix and its test (#3).
- New tagline in `--help`: *See where your Claude Code budget goes — and stop hitting your
  limits.*

## 0.3.0

First public release. Everything runs locally from the transcripts Claude Code already
writes under `~/.claude/projects/`; nothing is sent anywhere.

- **`budgetline history`**: tokens (input, cache writes, cache reads, output), cost and
  Equiv per session, plus **What's expensive**: your top tasks and the patterns behind the
  spend (long loops, big carried context, subagents, cache rewrites), each with a tip.
  Filters: `--project`, `--since`, `--limit`; `--json` for scripts.
- **`budgetline session`**: the same breakdown for one session.
- **`budgetline estimate "<task>"`**: a low / typical / high range from similar past
  tasks, cost first, with the 3 closest past tasks, confidence warnings and savings tips.
  Each estimate is checked against the task you run next; **Accuracy so far** reports
  how often the range was right.
- **Usage-limit % in the status line** (optional): `5h` and `7d` limit use, the session's
  API value and Equiv. It wraps your existing status line instead of replacing it
  (`statusline install`, `setup-statusline`).
- **Guard** (opt-in): a session token budget and a context-full warning, delivered to
  Claude through hooks so they also work in long autonomous runs. It never blocks.
- **Pre-prompt note** (opt-in): one line added to prompts whose typical estimate is large.
- **Claude Code plugin**: `/budgetline:estimate` and `/budgetline:budget`, plus the
  hooks above, with no install step beyond the plugin itself.
- Node.js 20 or newer, no runtime dependencies, one bundled file.
