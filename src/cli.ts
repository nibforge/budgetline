#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dateArg, int, parseArgs, str, type Parsed } from './args.js';
import { buildHistory } from './history.js';
import { load } from './data.js';
import { accuracyLine, evaluate, readLog } from './accuracy.js';
import { readBilling, readSamples, type LimitSample } from './calibration.js';
import { dataDir } from './paths.js';
import { historyJson, renderHistory } from './render-history.js';

const HELP = `budgetline: See where your Claude Code budget goes — and stop hitting your limits.

Usage:
  budgetline history  [--project <text>] [--since <YYYY-MM-DD>] [--limit N] [--json] [--show-prompts] [--show-titles]
  budgetline session  [--id <session id prefix>] [--json]   (same figures as the status line)
  budgetline estimate "<task description>" [--cwd <dir>] [--session <id>] [--json]
  budgetline statusline install | uninstall | status
  budgetline setup-statusline [--write [--yes]]   (prints the settings.json entry; --write installs it)
  budgetline hook enable | disable | status   (note on the first prompt of a session if it looks expensive)
  budgetline guard enable [--budget 200000] [--warn 160000|80%] [--context 70] [--window N] | disable | status
  budgetline guard session --budget N [--warn N|80%] [--session <id>] | --clear   (this session only)

Everything runs locally. Nothing is sent anywhere.
Prompt text is never printed unless you pass --show-prompts; --json leaves out session titles unless you pass --show-titles.`;

const VALUED = ['id', 'session', 'project', 'since', 'limit', 'cwd', 'budget', 'warn', 'context', 'window'];

type Handler = (p: Parsed) => Promise<string> | string;

function history(p: Parsed): string {
  const sessions = load(p);
  const live = liveCosts(readSamples(join(dataDir(), 'limits.jsonl')));
  const d = buildHistory(sessions, { project: str(p, 'project'), since: dateArg(p, 'since') }, live);
  const all = buildHistory(sessions, {}).tasks;
  const accuracy = accuracyLine(evaluate(readLog(join(dataDir(), 'estimates.jsonl')), all));
  const billing = readBilling(join(dataDir(), 'limits.jsonl'));
  const opts = { limit: int(p, 'limit', 15), showPrompts: p.flags['show-prompts'] === true, showTitles: p.flags['show-titles'] === true, accuracy, ...billing };
  return p.flags.json ? historyJson(d, opts) : renderHistory(d, opts);
}

/** Last cost the status line saw per session (cumulative, so the last one is the total). */
function liveCosts(samples: LimitSample[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of samples) m.set(x.session, x.cost);
  return m;
}

function version(): string {
  const pkg = join(fileURLToPath(import.meta.url), '..', '..', 'package.json');
  return JSON.parse(readFileSync(pkg, 'utf8')).version;
}

const COMMANDS: Record<string, () => Promise<Handler>> = {
  history: async () => history,
  session: async () => (await import('./session-cmd.js')).sessionCommand,
  estimate: async () => (await import('./estimate-cmd.js')).estimateCommand,
  statusline: async () => (await import('./statusline.js')).statuslineCommand,
  'setup-statusline': async () => (await import('./setup-statusline.js')).setupStatuslineCommand,
  guard: async () => (await import('./guard.js')).guardCommand,
  hook: async () => (await import('./hook.js')).hookCommand,
  events: async () => (await import('./events.js')).eventsCommand,
};

export async function main(argv: string[]): Promise<number> {
  const p = parseArgs(argv, VALUED);
  const cmd = p.positional.shift();
  if (p.flags.version) {
    process.stdout.write(`${version()}\n`);
    return 0;
  }
  const get = cmd ? COMMANDS[cmd] : undefined;
  if (!get || p.flags.help) {
    process.stdout.write(`${HELP}\n`);
    return cmd && !get ? 1 : 0;
  }
  const out = await (await get())(p);
  if (out) process.stdout.write(`${out}\n`);
  return 0;
}

const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === (await import('node:fs')).realpathSync(process.argv[1]);
if (isEntry) {
  main(process.argv.slice(2)).then(
    (code) => (process.exitCode = code),
    (err: Error) => {
      process.stderr.write(`budgetline: ${err.message}\n`);
      process.exitCode = 1;
    },
  );
}
