#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/args.ts
function parseArgs(argv, valued) {
  const out = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      out.positional.push(...argv.slice(i + 1));
      break;
    }
    if (!a.startsWith("--")) {
      out.positional.push(a);
      continue;
    }
    const [key, inline] = a.slice(2).split(/=(.*)/s, 2);
    if (inline !== void 0) out.flags[key] = inline;
    else if (valued.includes(key) && i + 1 < argv.length) out.flags[key] = argv[++i];
    else out.flags[key] = true;
  }
  return out;
}
function str(p, key) {
  const v = p.flags[key];
  return typeof v === "string" ? v : void 0;
}
function int(p, key, def) {
  const v = p.flags[key];
  if (v === void 0) return def;
  const n = Number(v);
  if (typeof v !== "string" || v.trim() === "" || !Number.isInteger(n) || n <= 0) {
    throw new Error(`--${key} must be a positive whole number (got ${JSON.stringify(v)})`);
  }
  return n;
}
function positive(p, key) {
  const v = p.flags[key];
  if (v === void 0) return void 0;
  const n = Number(v);
  if (typeof v !== "string" || !Number.isFinite(n) || n <= 0) throw new Error(`--${key} must be a positive number (got ${JSON.stringify(v)})`);
  return n;
}
function warnArg(p) {
  const v = p.flags.warn;
  if (v === void 0) return void 0;
  if (typeof v === "string" && /^\d+(\.\d+)?%$/.test(v.trim()) && parseFloat(v) > 0 && parseFloat(v) <= 100) return v.trim();
  return positive(p, "warn");
}
function dateArg(p, key) {
  const v = p.flags[key];
  if (v === void 0) return void 0;
  const m = typeof v === "string" ? /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(v) : null;
  const d = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? 1))) : null;
  if (!m || !d || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3] ?? 1)) {
    throw new Error(`--${key} must be a date like 2026-01-31 or 2026-01 (got ${JSON.stringify(v)})`);
  }
  return v;
}
var init_args = __esm({
  "src/args.ts"() {
    "use strict";
  }
});

// src/transcripts/types.ts
function emptyUsage() {
  return { input: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0, output: 0 };
}
function addUsage(into, u) {
  into.input += u.input;
  into.cacheWrite5m += u.cacheWrite5m;
  into.cacheWrite1h += u.cacheWrite1h;
  into.cacheRead += u.cacheRead;
  into.output += u.output;
}
function promptTokens(u) {
  return u.input + u.cacheWrite5m + u.cacheWrite1h + u.cacheRead;
}
function totalUsage(byModel) {
  const t = emptyUsage();
  for (const u of Object.values(byModel)) addUsage(t, u);
  return t;
}
var init_types = __esm({
  "src/transcripts/types.ts"() {
    "use strict";
  }
});

// src/cost.ts
function equivalent(u) {
  return u.input * WEIGHTS.input + u.cacheWrite5m * WEIGHTS.cacheWrite5m + u.cacheWrite1h * WEIGHTS.cacheWrite1h + u.cacheRead * WEIGHTS.cacheRead + u.output * WEIGHTS.output;
}
function sessionEquivalent(s) {
  return equivalent(totalUsage(s.usageByModel));
}
function taskEquivalent(t) {
  let sum3 = 0;
  for (const u of Object.values(t.usageByModel)) sum3 += equivalent(u);
  return sum3;
}
function learnPrices(sessions) {
  const cost = {};
  const eq = {};
  for (const s of sessions) {
    if (!s.reportedCost) continue;
    addSessionEq(s, eq);
    for (const [m, c] of Object.entries(s.reportedCost)) cost[m] = (cost[m] ?? 0) + c.costUSD;
  }
  const prices = {};
  for (const [m, e] of Object.entries(eq)) if (e > 0 && cost[m]) prices[m] = cost[m] / e;
  return prices;
}
function addSessionEq(s, eq) {
  for (const [m, u] of Object.entries(s.usageByModel)) {
    if (s.reportedCost?.[m]?.costUSD) eq[m] = (eq[m] ?? 0) + equivalent(u);
  }
}
function taskCost(t, prices) {
  let usd2 = 0;
  for (const [m, u] of Object.entries(t.usageByModel)) {
    const e = equivalent(u);
    if (e === 0) continue;
    const p = prices[m];
    if (p === void 0) return null;
    usd2 += e * p;
  }
  return usd2;
}
function percentile(values, q) {
  if (values.length === 0) return 0;
  const v = [...values].sort((a, b) => a - b);
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}
function sessionCost(s, prices, live) {
  const saved = s.reportedCost ? Object.values(s.reportedCost).reduce((a, c) => a + c.costUSD, 0) : void 0;
  if (saved !== void 0 || live !== void 0) return { usd: Math.max(saved ?? 0, live ?? 0), source: "reported" };
  return { usd: taskCost(s, prices), source: "estimated" };
}
var WEIGHTS;
var init_cost = __esm({
  "src/cost.ts"() {
    "use strict";
    init_types();
    WEIGHTS = { input: 1, cacheWrite5m: 1.25, cacheWrite1h: 2, cacheRead: 0.1, output: 5 };
  }
});

// src/history.ts
function filterSessions(sessions, f) {
  const proj = f.project?.toLowerCase();
  return sessions.filter(
    (s) => (!proj || s.project.toLowerCase().includes(proj)) && (!f.since || s.end >= f.since)
  );
}
function cacheWriteShare(u, eq) {
  return eq > 0 ? (u.cacheWrite5m * WEIGHTS.cacheWrite5m + u.cacheWrite1h * WEIGHTS.cacheWrite1h) / eq : 0;
}
function taskRows(sessions, prices) {
  const rows = [];
  for (const s of sessions) {
    let first = true;
    for (const t of s.tasks) {
      if (t.turns === 0 && t.subagents === 0) continue;
      const usage = totalUsage(t.usageByModel);
      const eq = taskEquivalent(t);
      rows.push({
        sessionId: s.id,
        sessionTitle: s.title,
        project: s.project,
        start: t.start,
        end: t.end,
        estimate: t.estimate === true,
        usage,
        eq,
        usd: taskCost(t, prices),
        turns: t.turns,
        subagents: t.subagents,
        subagentEq: equivalent(t.subagentUsage),
        initialContext: t.initialContext,
        initialUsage: t.initialUsage,
        opensSession: first,
        cacheWriteShare: cacheWriteShare(usage, eq),
        terms: t.terms,
        kind: t.kind,
        prompt: t.prompt
      });
      first = false;
    }
  }
  return rows;
}
function sessionRows(sessions, tasks, prices, live) {
  const count = /* @__PURE__ */ new Map();
  for (const t of tasks) count.set(t.sessionId, (count.get(t.sessionId) ?? 0) + 1);
  return sessions.filter((s) => count.has(s.id)).map((s) => {
    const usage = totalUsage(s.usageByModel);
    const cost = sessionCost(s, prices, live.get(s.id));
    const row = { id: s.id, title: s.title, project: s.project, start: s.start, tasks: count.get(s.id), usage };
    return { ...row, eq: sessionEquivalent(s), usd: cost.usd, costSource: cost.source };
  });
}
function buildHistory(all, filter, live = /* @__PURE__ */ new Map()) {
  const prices = learnPrices(all);
  const selected = filterSessions(all, filter);
  const tasks = taskRows(selected, prices);
  return { sessions: sessionRows(selected, tasks, prices, live), tasks, prices };
}
var init_history = __esm({
  "src/history.ts"() {
    "use strict";
    init_cost();
    init_types();
  }
});

// src/fsutil.ts
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, renameSync, rmSync, writeFileSync } from "node:fs";
function writeAtomic(file, text) {
  const tmp = `${file}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, text);
    renameSync(tmp, file);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
}
function privateDir(dir) {
  mkdirSync(dir, { recursive: true, mode: 448 });
  return dir;
}
function readJsonFile(file) {
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8");
  try {
    return text.trim() ? JSON.parse(text) : {};
  } catch (err) {
    throw new Error(`${file} is not valid JSON (${err.message}). Nothing was changed: fix the file and run the command again.`);
  }
}
function isJson(b) {
  if (!b.toString("utf8").trim()) return false;
  try {
    JSON.parse(b.toString("utf8"));
    return true;
  } catch {
    return false;
  }
}
function readNew(path, offset) {
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    if (size < offset) return { text: "", end: offset, shrunk: true };
    if (size === offset) return { text: "", end: offset, shrunk: false };
    const buf = Buffer.alloc(size - offset);
    readSync(fd, buf, 0, buf.length, offset);
    if (isJson(buf.subarray(buf.lastIndexOf(10) + 1))) return { text: buf.toString("utf8"), end: size, shrunk: false };
    const end = buf.lastIndexOf(10) + 1;
    return { text: buf.subarray(0, end).toString("utf8"), end: offset + end, shrunk: false };
  } finally {
    closeSync(fd);
  }
}
var init_fsutil = __esm({
  "src/fsutil.ts"() {
    "use strict";
  }
});

// src/paths.ts
import { homedir } from "node:os";
import { join } from "node:path";
import { cpSync, existsSync as existsSync2, renameSync as renameSync2 } from "node:fs";
function claudeDir(env = process.env) {
  return env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
}
function dataDir(env = process.env, home = homedir()) {
  if (env.BUDGETLINE_DATA) return privateDir(env.BUDGETLINE_DATA);
  const dir = join(home, ".budgetline");
  migrateLegacy(join(home, `.${LEGACY_NAME}`), dir);
  return privateDir(dir);
}
function migrateLegacy(legacy, dir) {
  if (existsSync2(dir) || !existsSync2(legacy)) return;
  try {
    renameSync2(legacy, dir);
  } catch {
    if (!existsSync2(dir)) cpSync(legacy, dir, { recursive: true });
  }
}
var LEGACY_NAME;
var init_paths = __esm({
  "src/paths.ts"() {
    "use strict";
    init_fsutil();
    LEGACY_NAME = "pre-budget";
  }
});

// src/jsonl.ts
import { appendFileSync, closeSync as closeSync2, existsSync as existsSync3, openSync as openSync2, readFileSync as readFileSync2, readSync as readSync2, statSync } from "node:fs";
function parseJsonl(text) {
  const out = [];
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    try {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") out.push(o);
    } catch {
    }
  }
  return out;
}
function readJsonl(file) {
  return existsSync3(file) ? parseJsonl(readFileSync2(file, "utf8")) : [];
}
function endsMidLine(file) {
  const size = existsSync3(file) ? statSync(file).size : 0;
  if (size === 0) return false;
  const fd = openSync2(file, "r");
  try {
    const b = Buffer.alloc(1);
    readSync2(fd, b, 0, 1, size - 1);
    return b[0] !== 10;
  } finally {
    closeSync2(fd);
  }
}
function appendJsonl(file, value) {
  appendFileSync(file, (endsMidLine(file) ? "\n" : "") + JSON.stringify(value) + "\n");
}
var init_jsonl = __esm({
  "src/jsonl.ts"() {
    "use strict";
  }
});

// src/text.ts
function terms(text) {
  const words = text.toLowerCase().normalize("NFD").replace(new RegExp("\\p{M}", "gu"), "").split(/[^\p{L}\p{N}]+/u);
  const out = [];
  for (const w of words) {
    if (w.length < 3 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
    out.push(w.length > 6 ? w.slice(0, 6) : w);
  }
  return out;
}
function isEstimateRequest(text) {
  return /^(\/(budgetline:)?estimate|budgetline:estimate)(\s|$)/i.test(text.trim());
}
function taskKind(text) {
  const t = text.toLowerCase().normalize("NFD").replace(new RegExp("\\p{M}", "gu"), "").replace(/^[¿\s]+/, "").trim();
  const asks = QUESTION_START.test(t) || t.endsWith("?");
  if (!asks) return "change";
  return REQUEST.test(t) || t.length >= 300 ? "change" : "question";
}
function isReviewOnly(text) {
  const t = plain(text);
  return REVIEW_VERB.test(t) && !WORK_VERB.test(t);
}
var STOPWORDS, QUESTION_START, ACTION_EN, ACTION_ES, REQUEST, plain, REVIEW_VERB, WORK_VERB;
var init_text = __esm({
  "src/text.ts"() {
    "use strict";
    STOPWORDS = new Set(
      "the and for with that this from into your you are was were have has had not but can will what when where which who how why all any its our out use using make please also then them there their these those just like some more than only want need should would could about los las del por para con una uno unos unas que como esto esta este estos estas pero sus m\xE1s mas muy sin sobre entre cuando donde quiero puedes hacer haz todo toda todos todas tambien tambi\xE9n ahora aqui aqu\xED eso esa ese ver mira dime".split(" ")
    );
    QUESTION_START = /^(cuant[oa]s?|que|cual(es)?|donde|como|por que|quien|hay|existe|what|how|where|which|why|who|is|are|does|do|can|could)\b/;
    ACTION_EN = "(add|implement|fix|refactor|create|build|update|remove|delete|migrate|write|change|rename|move|install|make|replace|convert)(s|es|ed|d|ing)?";
    ACTION_ES = "(anad|agreg|implement|arregl|corrig|crea|haz|hacer|cambia|modific|escrib|borr|elimin|refactor|migr|actualiz|instal|configur|renombr|mueve|mover)\\w*";
    REQUEST = new RegExp(
      `\\b(can you|could you|would you|will you|please|i want|i need|let'?s|puedes|podrias|quiero|necesito|hay que|por favor)\\b.*\\b(${ACTION_EN}|${ACTION_ES})\\b`
    );
    plain = (text) => text.toLowerCase().normalize("NFD").replace(new RegExp("\\p{M}", "gu"), "");
    REVIEW_VERB = /\b(review|explain|summari[sz]e|describ|document|audit|revis|explic|resum)\w*/;
    WORK_VERB = new RegExp(
      `\\b(${ACTION_EN}|${ACTION_ES}|(run|ship|bundle|compile|test|deploy|release|commit|publish|merge)(s|es|ed|d|ing)?|(compil|ejecut|lanz|despleg|publica|fusion|prueb|test)\\w*)\\b`
    );
  }
});

// src/transcripts/parse.ts
function promptText(o) {
  if (o.type !== "user" || o.isMeta || o.isSidechain) return null;
  const c = o.message?.content;
  if (typeof c === "string") return fromString(c);
  if (!Array.isArray(c) || c.some((b) => b?.type === "tool_result")) return null;
  const text = c.filter((b) => b?.type === "text").map((b) => String(b.text ?? "")).join("\n");
  return text ? fromString(text) : null;
}
function fromString(c) {
  const cmd = /<command-name>([^<]*)<\/command-name>/.exec(c);
  if (cmd) {
    const args = /<command-args>([^<]*)<\/command-args>/.exec(c);
    return `${cmd[1]} ${args?.[1] ?? ""}`.trim();
  }
  return SYSTEM_TAG.test(c.trimStart()) ? null : c;
}
function toUsage(u) {
  const cc = u.cache_creation;
  const total = Number(u.cache_creation_input_tokens ?? 0);
  const w1h = Number(cc?.ephemeral_1h_input_tokens ?? 0);
  return {
    input: Number(u.input_tokens ?? 0),
    cacheWrite1h: w1h,
    // no breakdown, or only the 1h part: the rest of the total is 5-minute writes
    cacheWrite5m: cc?.ephemeral_5m_input_tokens !== void 0 ? Number(cc.ephemeral_5m_input_tokens) : Math.max(0, total - w1h),
    cacheRead: Number(u.cache_read_input_tokens ?? 0),
    output: Number(u.output_tokens ?? 0)
  };
}
function response(o, seen) {
  if (o.type !== "assistant" || !o.message?.usage) return null;
  const model = String(o.message.model ?? "unknown");
  if (model === "<synthetic>") return null;
  const key = responseKey(o);
  if (seen.has(key)) return null;
  seen.add(key);
  return [model, toUsage(o.message.usage), String(o.timestamp ?? "")];
}
function newTask(index, ts, text, opts) {
  return {
    index,
    start: ts,
    end: ts,
    terms: terms(text),
    kind: taskKind(text),
    ...isEstimateRequest(text) ? { estimate: true } : {},
    prompt: opts.keepPrompts ? text : void 0,
    usageByModel: {},
    turns: 0,
    subagents: 0,
    subagentUsage: emptyUsage(),
    initialContext: 0
  };
}
function untitled(s, ts) {
  if (s.tasks[0]?.untitled) return s.tasks[0];
  const t = newTask(0, ts, "", {});
  t.untitled = true;
  s.tasks.unshift(t);
  s.tasks.forEach((x, i) => x.index = i);
  return t;
}
function add(s, task, model, u, ts) {
  addTo(task, model, u, ts);
  addUsage(s.usageByModel[model] ??= emptyUsage(), u);
}
function addTo(task, model, u, ts) {
  const slot = task.usageByModel[model] ??= emptyUsage();
  addUsage(slot, u);
  if (ts > task.end) task.end = ts;
}
function readMeta(o, s) {
  s.project ||= typeof o.cwd === "string" ? o.cwd : "";
  s.id ||= typeof o.sessionId === "string" ? o.sessionId : "";
  const titleField = TITLE_FIELD[o.type];
  if (titleField && typeof o[titleField] === "string") s.title = o[titleField];
  if (o.type === "cost-state" && o.modelUsage) s.reportedCost = reportedCost(o.modelUsage);
}
function reportedCost(modelUsage) {
  const out = {};
  for (const [m, v] of Object.entries(modelUsage)) out[m] = { costUSD: Number(v.costUSD ?? 0) };
  return out;
}
function readMain(lines, s, opts) {
  const seen = /* @__PURE__ */ new Set();
  let cur;
  for (const o of lines) {
    readMeta(o, s);
    const text = promptText(o);
    if (text !== null) {
      cur = newTask(s.tasks.length, String(o.timestamp ?? ""), text, opts);
      s.tasks.push(cur);
      continue;
    }
    const r = response(o, seen);
    if (!r) continue;
    const [model, u, ts] = r;
    cur ??= untitled(s, ts);
    if (cur.turns === 0) {
      cur.initialContext = promptTokens(u);
      cur.initialUsage = { ...u, output: 0 };
    }
    cur.turns++;
    add(s, cur, model, u, ts);
  }
}
function taskAt(tasks, ts) {
  let found;
  for (const t of tasks) if (t.start <= ts) found = t;
  return found;
}
function readSubagent(lines, s) {
  const seen = /* @__PURE__ */ new Set();
  let counted = false;
  for (const o of lines) {
    const r = response(o, seen);
    if (!r) continue;
    const [model, u, ts] = r;
    const task = taskAt(s.tasks, ts) ?? untitled(s, ts);
    if (!counted) {
      task.subagents++;
      counted = true;
    }
    add(s, task, model, u, ts);
    addUsage(task.subagentUsage, u);
  }
}
function parseSession(main2, subagents = [], opts = {}) {
  const s = { id: "", project: "", start: "", end: "", tasks: [], usageByModel: {} };
  readMain(parseJsonl(main2), s, opts);
  for (const text of subagents) readSubagent(parseJsonl(text), s);
  if (s.tasks.length === 0) return null;
  s.start = s.tasks.reduce((m, t) => t.start < m ? t.start : m, s.tasks[0].start);
  s.end = s.tasks.reduce((m, t) => t.end > m ? t.end : m, s.start);
  return s;
}
var SYSTEM_TAG, responseKey, TITLE_FIELD;
var init_parse = __esm({
  "src/transcripts/parse.ts"() {
    "use strict";
    init_jsonl();
    init_text();
    init_types();
    SYSTEM_TAG = /^<(command-|local-command-|system-reminder|task-notification|bash-|user-memory-input)/;
    responseKey = (o) => `${o.message?.id ?? o.uuid}|${o.requestId ?? ""}`;
    TITLE_FIELD = { "ai-title": "aiTitle", "custom-title": "customTitle" };
  }
});

// src/transcripts/scan.ts
import { existsSync as existsSync4, readdirSync, readFileSync as readFileSync3, statSync as statSync2 } from "node:fs";
import { basename, dirname, join as join2 } from "node:path";
function listJsonl(dir) {
  if (!existsSync4(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => join2(dir, f));
}
function findSessions(claudeDir2) {
  const root = join2(claudeDir2, "projects");
  if (!existsSync4(root)) return [];
  const out = [];
  for (const proj of readdirSync(root, { withFileTypes: true })) {
    if (!proj.isDirectory()) continue;
    const pdir = join2(root, proj.name);
    for (const main2 of listJsonl(pdir)) {
      const sub = join2(pdir, basename(main2, ".jsonl"), "subagents");
      out.push({ main: main2, subagents: listJsonl(sub) });
    }
  }
  return out;
}
function signature(f) {
  return [f.main, ...f.subagents].map((p) => {
    const st = statSync2(p);
    return `${p}:${st.size}:${Math.round(st.mtimeMs)}`;
  }).join("|");
}
function readCache(file) {
  if (!file || !existsSync4(file)) return {};
  try {
    const c = JSON.parse(readFileSync3(file, "utf8"));
    return c.version === CACHE_VERSION ? c.entries : {};
  } catch {
    return {};
  }
}
function parseFiles(f, keepPrompts) {
  const subs = f.subagents.map((p) => readFileSync3(p, "utf8"));
  return parseSession(readFileSync3(f.main, "utf8"), subs, { keepPrompts });
}
function parseTranscript(main2) {
  try {
    return parseFiles({ main: main2, subagents: listJsonl(join2(dirname(main2), basename(main2, ".jsonl"), "subagents")) }, false);
  } catch {
    return null;
  }
}
function entryFor(f, old, keepPrompts) {
  try {
    const sig = signature(f);
    const hit = old[f.main]?.sig === sig;
    return { entry: hit ? old[f.main] : { sig, session: parseFiles(f, keepPrompts) }, hit };
  } catch {
    return null;
  }
}
function saveCache(file, entries) {
  try {
    writeAtomic(file, JSON.stringify({ version: CACHE_VERSION, entries }));
  } catch {
  }
}
function loadSessions(opts) {
  const useCache = !opts.keepPrompts && opts.cacheFile;
  const old = useCache ? readCache(opts.cacheFile) : {};
  const next = {};
  const sessions = [];
  let changed = false;
  for (const f of findSessions(opts.claudeDir)) {
    const r = entryFor(f, old, !!opts.keepPrompts);
    if (!r) continue;
    changed ||= !r.hit;
    next[f.main] = r.entry;
    if (r.entry.session) sessions.push(r.entry.session);
  }
  changed ||= Object.keys(old).length !== Object.keys(next).length;
  if (useCache && changed) saveCache(opts.cacheFile, next);
  sessions.sort((a, b) => a.start < b.start ? -1 : 1);
  return sessions;
}
var CACHE_VERSION;
var init_scan = __esm({
  "src/transcripts/scan.ts"() {
    "use strict";
    init_fsutil();
    init_parse();
    CACHE_VERSION = 5;
  }
});

// src/data.ts
import { join as join3 } from "node:path";
function load(p) {
  const keepPrompts = p.flags["show-prompts"] === true;
  return loadSessions({ claudeDir: claudeDir(), cacheFile: join3(dataDir(), "index-v1.json"), keepPrompts });
}
async function readStdin() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}
var init_data = __esm({
  "src/data.ts"() {
    "use strict";
    init_paths();
    init_scan();
  }
});

// src/accuracy.ts
function logEstimate(file, project, eq, now = /* @__PURE__ */ new Date(), raw = eq.typical) {
  const e = { ts: now.toISOString(), project, low: eq.low, typical: eq.typical, high: eq.high, raw };
  appendJsonl(file, e);
}
function readLog(file) {
  return readJsonl(file);
}
function nextTask(e, rows) {
  const t0 = Date.parse(e.ts);
  let best;
  for (const r of rows) {
    const t = Date.parse(r.start);
    if (r.estimate || r.project.toLowerCase() !== e.project.toLowerCase() || t <= t0 || t - t0 > MATCH_WINDOW_MS) continue;
    if (!best || r.start < best.start) best = r;
  }
  return best;
}
function evaluate(log, rows) {
  const factors = [];
  let within = 0;
  for (const e of log) {
    const real = nextTask(e, rows);
    if (!real || e.typical <= 0 || real.eq <= 0) continue;
    if (real.eq >= e.low && real.eq <= e.high) within++;
    factors.push(Math.max(real.eq / e.typical, e.typical / real.eq));
  }
  return { n: factors.length, within, typicalFactor: factors.length ? percentile(factors, 0.5) : null };
}
function measuredBias(log, rows) {
  const ratios = [];
  for (const e of log) {
    const real = nextTask(e, rows);
    const base = e.raw ?? e.typical;
    if (real && base > 0 && real.eq > 0) ratios.push(real.eq / base);
  }
  return ratios.length >= MIN_BIAS ? { factor: percentile(ratios, 0.5), n: ratios.length } : null;
}
function accuracyLine(a) {
  if (a.n === 0) return "Accuracy so far: no estimate checked yet (each one is compared with the next task you run in that project).";
  const stats = `${a.n} estimate${a.n === 1 ? "" : "s"}, ${Math.round(a.within / a.n * 100)}% within range, typical error \xD7${a.typicalFactor.toFixed(1)}`;
  return a.n < MIN_JUDGE ? `Accuracy so far: ${stats}. Too few to judge yet.` : `Accuracy so far: ${stats}.`;
}
var MIN_BIAS, MATCH_WINDOW_MS, MIN_JUDGE;
var init_accuracy = __esm({
  "src/accuracy.ts"() {
    "use strict";
    init_cost();
    init_jsonl();
    MIN_BIAS = 3;
    MATCH_WINDOW_MS = 2 * 60 * 60 * 1e3;
    MIN_JUDGE = 5;
  }
});

// src/calibration.ts
function readSamples(file) {
  return readJsonl(file);
}
function hasPlanLimits(samples) {
  return samples.some((s) => typeof s.five === "number" || typeof s.seven === "number");
}
function readBilling(file) {
  const samples = readSamples(file);
  return { calibration: calibrate(samples), plan: hasPlanLimits(samples) };
}
function deltas(samples, w) {
  const bySession = /* @__PURE__ */ new Map();
  for (const s of samples) {
    const list = bySession.get(s.session);
    if (list) list.push(s);
    else bySession.set(s.session, [s]);
  }
  const acc = { pct: 0, usd: 0, pairs: 0 };
  const reset = w === "five" ? "fiveReset" : "sevenReset";
  for (const list of bySession.values()) {
    list.sort((a, b) => a.ts < b.ts ? -1 : 1);
    for (let i = 1; i < list.length; i++) addPair(acc, list[i - 1], list[i], w, reset);
  }
  return acc;
}
function addPair(acc, a, b, w, reset) {
  const dc = b.cost - a.cost;
  const dp = (b[w] ?? NaN) - (a[w] ?? NaN);
  if (a[reset] !== b[reset] || !(dc > 0) || !(dp >= 0)) return;
  acc.pct += dp;
  acc.usd += dc;
  acc.pairs++;
}
function calibrate(samples) {
  const five = deltas(samples, "five");
  if (five.pairs < MIN_PAIRS || five.usd < MIN_USD) return null;
  const seven = deltas(samples, "seven");
  return {
    fivePerUsd: five.pct / five.usd,
    sevenPerUsd: seven.pairs >= MIN_PAIRS && seven.usd >= MIN_USD ? seven.pct / seven.usd : null,
    pairs: five.pairs,
    usd: five.usd
  };
}
var MIN_PAIRS, MIN_USD;
var init_calibration = __esm({
  "src/calibration.ts"() {
    "use strict";
    init_jsonl();
    MIN_PAIRS = 10;
    MIN_USD = 1;
  }
});

// src/format.ts
function round2(n) {
  if (n === 0 || !Number.isFinite(n)) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(Math.abs(n))) - 1);
  return Math.round(n / p) * p;
}
function tokens(n) {
  const r = round2(n);
  if (r >= 1e6) return `${trim(r / 1e6)}M`;
  if (r >= 1e3) return `${trim(r / 1e3)}k`;
  return String(Math.round(r));
}
function tokensExact(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(Math.round(n));
}
function usd(n, approx = false) {
  if (n === null) return "n/a";
  const v = approx ? round2(n) : n;
  if (v < 0.01) return "<$0.01";
  return `$${v >= 100 ? Math.round(v) : approx ? trim(v) : String(Number(v.toFixed(2)))}`;
}
function trim(n) {
  return String(Number(n.toFixed(1)));
}
function pct(share) {
  return `${Math.round(share * 100)}%`;
}
function truncate(s, max) {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}\u2026` : one;
}
function table(head, rows, rightFrom = 1) {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const line = (r) => r.map((c, i) => i >= rightFrom ? c.padStart(widths[i]) : c.padEnd(widths[i])).join("  ").trimEnd();
  return [line(head), line(widths.map((w) => "-".repeat(w))), ...rows.map(line)].join("\n");
}
function projectName(cwd) {
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? cwd;
}
var init_format = __esm({
  "src/format.ts"() {
    "use strict";
  }
});

// src/session-line.ts
function money(n, approx = false) {
  return n !== null && approx ? `~${usd(n, true)}` : usd(n);
}
function costPart(f) {
  if (f.usd === null) return null;
  return `${money(f.usd, f.approx)}${f.plan ? " API value" : ""} this session`;
}
function eqPart(f) {
  if (f.eq === null || f.eq <= 0) return null;
  const g = f.guard;
  return `Equiv ${tokensExact(f.eq)}${g ? `/${tokensExact(g.budget)}${f.eq >= g.warnAt ? " \u26A0" : ""}` : ""}`;
}
function ctxPart(f) {
  if (!f.guard || typeof f.ctx !== "number") return null;
  return `ctx ${Math.round(f.ctx)}%${f.ctx >= f.guard.ctxWarn ? " \u26A0" : ""}`;
}
function sessionLine(f) {
  const parts = [pctPart("5h", f.five), pctPart("7d", f.seven), costPart(f), eqPart(f), ctxPart(f)];
  const shown = parts.filter((x) => x !== null);
  return shown.length ? shown.join(" \xB7 ") : "budgetline";
}
var pctPart;
var init_session_line = __esm({
  "src/session-line.ts"() {
    "use strict";
    init_format();
    pctPart = (label2, v) => typeof v === "number" ? `${label2}: ${Math.round(v)}%` : null;
  }
});

// src/transcripts/incremental.ts
import { readFileSync as readFileSync4 } from "node:fs";
import { basename as basename2, dirname as dirname2, join as join4 } from "node:path";
function advanceFile(path, prev = fresh()) {
  let p = prev;
  let next = readNew(path, p.offset);
  if (next.shrunk) {
    p = fresh();
    next = readNew(path, 0);
  }
  if (next.end === p.offset) return p;
  const seen = new Set(p.recent);
  let eq = p.eq;
  for (const o of parseJsonl(next.text)) {
    const r = response(o, seen);
    if (r) eq += equivalent(r[1]);
  }
  return { offset: next.end, eq, recent: [...seen].slice(-RECENT) };
}
function readCache2(file) {
  try {
    const c = JSON.parse(readFileSync4(file, "utf8"));
    return c && typeof c === "object" ? c : {};
  } catch {
    return {};
  }
}
function sessionEq(main2, dir) {
  const file = cacheFile(dir, main2);
  const old = readCache2(file);
  const files = [main2, ...listJsonl(join4(dirname2(main2), basename2(main2, ".jsonl"), "subagents"))];
  const next = {};
  let total = 0;
  for (const f of files) {
    try {
      next[f] = advanceFile(f, old[f]);
      total += next[f].eq;
    } catch {
      if (f === main2) return null;
    }
  }
  if (files.some((f) => next[f] && next[f] !== old[f])) {
    try {
      writeAtomic(join4(privateDir(join4(dir, "eq")), basename2(file)), JSON.stringify(next));
    } catch {
    }
  }
  return total;
}
var RECENT, fresh, cacheFile;
var init_incremental = __esm({
  "src/transcripts/incremental.ts"() {
    "use strict";
    init_cost();
    init_fsutil();
    init_jsonl();
    init_parse();
    init_scan();
    RECENT = 200;
    fresh = () => ({ offset: 0, eq: 0, recent: [] });
    cacheFile = (dir, main2) => join4(dir, "eq", `${basename2(main2, ".jsonl").replace(/[^\w-]/g, "_")}.json`);
  }
});

// src/config.ts
import { existsSync as existsSync5, readFileSync as readFileSync5, rmSync as rmSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join5 } from "node:path";
function readJson(file) {
  try {
    const o = existsSync5(file) ? JSON.parse(readFileSync5(file, "utf8")) : {};
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}
function migrate(dir) {
  if (!existsSync5(legacyHookFile(dir))) return;
  const old = readJson(legacyHookFile(dir));
  const cur = readJson(configFile(dir));
  const moved = {};
  if (typeof old.enabled === "boolean" && !("hookEnabled" in cur)) moved.hookEnabled = old.enabled;
  if (Number(old.threshold) > 0 && !("hookThreshold" in cur)) moved.hookThreshold = Number(old.threshold);
  try {
    writeFileSync2(configFile(dir), JSON.stringify({ ...cur, ...moved }, null, 2));
    rmSync2(legacyHookFile(dir), { force: true });
  } catch {
  }
}
function stored(dir) {
  migrate(dir);
  const raw = readJson(configFile(dir));
  for (const k of RETIRED) delete raw[k];
  return raw;
}
function readConfig(dir) {
  return { ...DEFAULTS, ...stored(dir) };
}
function writeConfig(dir, patch) {
  writeFileSync2(configFile(dir), JSON.stringify({ ...stored(dir), ...patch }, null, 2));
}
function warnTokens(c) {
  const w = c.sessionWarnTokens;
  if (typeof w === "string" && w.trim().endsWith("%")) return c.sessionBudgetTokens * parseFloat(w) / 100;
  return Number(w);
}
var DEFAULTS, RETIRED, configFile, legacyHookFile;
var init_config = __esm({
  "src/config.ts"() {
    "use strict";
    DEFAULTS = {
      hookEnabled: false,
      hookThreshold: 5e5,
      guardEnabled: false,
      sessionBudgetTokens: 2e5,
      sessionWarnTokens: 16e4,
      contextWarnPercent: 70
    };
    RETIRED = ["longSessionTokens"];
    configFile = (dir) => join5(dir, "config.json");
    legacyHookFile = (dir) => join5(dir, "hook.json");
  }
});

// src/guard-state.ts
import { readFileSync as readFileSync6, writeFileSync as writeFileSync3 } from "node:fs";
import { join as join6 } from "node:path";
function freshState() {
  return { offset: 0, lastKey: "", eq: 0, context: 0, warned: { budget: false, context: false } };
}
function readState(dir, session) {
  try {
    return JSON.parse(readFileSync6(stateFile(dir, session), "utf8"));
  } catch {
    return freshState();
  }
}
function writeState(dir, session, s) {
  privateDir(join6(dir, "guard"));
  writeFileSync3(stateFile(dir, session), JSON.stringify(s));
}
function applyLine(s, o) {
  if (o?.type !== "assistant" || o.isSidechain || !o.message?.usage || o.message.model === "<synthetic>") return;
  const key = `${o.message.id}|${o.requestId ?? ""}`;
  if (key === s.lastKey) return;
  s.lastKey = key;
  const u = toUsage(o.message.usage);
  s.eq += equivalent(u);
  s.context = promptTokens(u);
}
function advance(prev, transcript) {
  const own = { budget: prev.budget, warn: prev.warn };
  let s = prev.transcript && prev.transcript !== transcript ? { ...freshState(), ...own } : prev;
  let next = readNew(transcript, s.offset);
  if (next.shrunk) {
    s = { ...freshState(), ...own };
    next = readNew(transcript, 0);
  }
  s.transcript = transcript;
  const { text, end } = next;
  for (const o of parseJsonl(text)) applyLine(s, o);
  s.offset = end;
  return s;
}
var stateFile;
var init_guard_state = __esm({
  "src/guard-state.ts"() {
    "use strict";
    init_fsutil();
    init_cost();
    init_jsonl();
    init_parse();
    init_types();
    stateFile = (dir, session) => join6(dir, "guard", `${session.replace(/[^\w-]/g, "_")}.json`);
  }
});

// src/guard.ts
var guard_exports = {};
__export(guard_exports, {
  guardCommand: () => guardCommand,
  guardFigure: () => guardFigure,
  guardOutput: () => guardOutput,
  proposeBudget: () => proposeBudget,
  recordWindow: () => recordWindow,
  sessionBudget: () => sessionBudget,
  sessionConfig: () => sessionConfig,
  windowSize: () => windowSize
});
function windowSize(c, s) {
  const w = s.window || c.contextWindowTokens || DEFAULT_WINDOW;
  return s.context > w ? Math.max(LARGE_WINDOW, s.context) : w;
}
function sessionConfig(c, s) {
  if (!s.budget) return c;
  const share = c.sessionBudgetTokens > 0 ? `${Math.round(warnTokens(c) / c.sessionBudgetTokens * 100)}%` : "80%";
  return { ...c, sessionBudgetTokens: s.budget, sessionWarnTokens: s.warn ?? share };
}
function budgetNotice(c, s) {
  const used = `Equiv ${tokensExact(s.eq)}/${tokensExact(c.sessionBudgetTokens)}`;
  if (s.eq >= c.sessionBudgetTokens) {
    return {
      context: `budgetline: session budget exceeded (${used}, equivalent tokens). Do not start new work. Finish the current step without leaving anything half-done, then tell the user, summarize the current state and the next steps, and propose continuing in a fresh session with a ready-to-paste continuation prompt.`,
      user: `budgetline: session budget exceeded (${used})`
    };
  }
  if (s.eq >= warnTokens(c) && !s.warned.budget) {
    s.warned.budget = true;
    return { context: `budgetline: session at ${used}. Mention this to the user in one line.`, user: `budgetline: session at ${used}` };
  }
  return null;
}
function contextNotice(c, s) {
  const pct2 = Math.round(s.context / windowSize(c, s) * 100);
  if (pct2 < c.contextWarnPercent) {
    s.warned.context = false;
    return null;
  }
  if (s.warned.context) return null;
  s.warned.context = true;
  const msg = `budgetline: context at ${pct2}% of window; answer quality may degrade \u2014 consider wrapping up and starting a fresh session`;
  return { context: `${msg}. Tell the user about this now, in one line.`, user: msg };
}
function guardOutput(input, dir, c = readConfig(dir)) {
  if (!c.guardEnabled) return "";
  try {
    const { session_id: session, transcript_path: transcript, hook_event_name: event } = JSON.parse(input);
    if (!session || !transcript || !event) return "";
    const s = advance(readState(dir, session), transcript);
    s.eq = sessionEq(transcript, dir) ?? s.eq;
    const notices = [budgetNotice(sessionConfig(c, s), s), contextNotice(c, s)].filter((n) => n !== null);
    writeState(dir, session, s);
    if (!notices.length) return "";
    return JSON.stringify({
      hookSpecificOutput: { hookEventName: event, additionalContext: notices.map((n) => n.context).join("\n") },
      systemMessage: notices.map((n) => n.user).join(" \xB7 ")
    });
  } catch {
    return "";
  }
}
function guardFigure(dir, session) {
  const g = readConfig(dir);
  const c = session ? sessionConfig(g, readState(dir, session)) : g;
  return c.guardEnabled ? { budget: c.sessionBudgetTokens, warnAt: warnTokens(c), ctxWarn: c.contextWarnPercent } : void 0;
}
function proposeBudget(sessions) {
  const recent = sessions.filter((s) => s.eq > 0).sort((a, b) => a.start < b.start ? 1 : -1).slice(0, RECENT2);
  if (recent.length < 5) return { budget: FALLBACK_BUDGET, note: "not enough history yet, using the 2M fallback" };
  const budget = round2(percentile(recent.map((s) => s.eq), 0.75));
  return { budget, note: `based on your last ${recent.length} sessions: 75% of them used less than ${tokens(budget)} equivalent tokens` };
}
function enable(p, dir) {
  const patch = { guardEnabled: true };
  const budget = positive(p, "budget");
  const warn = warnArg(p);
  const ctx = positive(p, "context");
  if (ctx !== void 0 && ctx > 100) throw new Error("--context is a percentage of the window: 1-100");
  const win = str(p, "window") === "auto" ? void 0 : positive(p, "window");
  let note = "";
  if (budget) patch.sessionBudgetTokens = budget;
  else {
    const prop = proposeBudget(buildHistory(load(p), {}).sessions);
    patch.sessionBudgetTokens = prop.budget;
    note = `Budget ${tokens(prop.budget)}: ${prop.note}. Override with --budget.
`;
  }
  patch.sessionWarnTokens = warn ?? "80%";
  if (ctx) patch.contextWarnPercent = ctx;
  if (win) patch.contextWindowTokens = win;
  if (str(p, "window") === "auto") patch.contextWindowTokens = void 0;
  writeConfig(dir, patch);
  return `${note}Guard enabled. ${status(dir)}
Disable with: budgetline guard disable`;
}
function status(dir) {
  const c = readConfig(dir);
  if (!c.guardEnabled) return "Guard: disabled (default).";
  const win = tokens(c.contextWindowTokens || DEFAULT_WINDOW);
  return `Guard: enabled. Session budget ${tokens(c.sessionBudgetTokens)} equivalent tokens, warning at ${tokens(warnTokens(c))}; context warning at ${c.contextWarnPercent}% of the window (the size the status line reports; else ${win}).`;
}
function guardCommand(p) {
  const sub = p.positional[0];
  const dir = dataDir();
  if (sub === "enable") return enable(p, dir);
  if (sub === "disable") {
    writeConfig(dir, { guardEnabled: false });
    return "Guard disabled. Your settings are kept in config.json for next time.";
  }
  if (sub === "status") return status(dir);
  if (sub === "session") return sessionBudget(p, dir);
  throw new Error("usage: budgetline guard enable [--budget N] [--warn N|80%] [--context P] [--window N] | disable | status | session --budget N [--warn N|80%] [--session ID] | session --clear");
}
function sessionBudget(p, dir, env = process.env) {
  const session = str(p, "session") ?? env.CLAUDE_CODE_SESSION_ID;
  if (!session) throw new Error("no session: pass --session <id> (inside Claude Code the current one is used)");
  const s = readState(dir, session);
  if (p.flags.clear === true) {
    delete s.budget;
    delete s.warn;
  } else {
    const budget = positive(p, "budget");
    if (!budget) throw new Error("usage: budgetline guard session --budget N [--warn N|80%] [--session ID] | --clear");
    s.budget = budget;
    s.warn = warnArg(p);
    s.warned.budget = false;
  }
  writeState(dir, session, s);
  const g = readConfig(dir);
  const c = sessionConfig(g, s);
  const what = s.budget ? `budget ${tokens(c.sessionBudgetTokens)}, warning at ${tokens(warnTokens(c))}` : `back to the global budget (${tokens(g.sessionBudgetTokens)})`;
  const off = g.guardEnabled ? "" : "\nThe guard is disabled: turn it on with budgetline guard enable.";
  return `Session ${session.slice(0, 8)}: ${what}.${off}`;
}
function recordWindow(dir, session, size) {
  if (!session || !(Number(size) > 0) || !readConfig(dir).guardEnabled) return;
  const s = readState(dir, session);
  if (s.window === Number(size)) return;
  s.window = Number(size);
  writeState(dir, session, s);
}
var DEFAULT_WINDOW, LARGE_WINDOW, FALLBACK_BUDGET, RECENT2;
var init_guard = __esm({
  "src/guard.ts"() {
    "use strict";
    init_args();
    init_cost();
    init_incremental();
    init_data();
    init_format();
    init_history();
    init_config();
    init_guard_state();
    init_paths();
    DEFAULT_WINDOW = 2e5;
    LARGE_WINDOW = 1e6;
    FALLBACK_BUDGET = 2e6;
    RECENT2 = 30;
  }
});

// src/limits-log.ts
import { closeSync as closeSync3, existsSync as existsSync6, fstatSync as fstatSync2, openSync as openSync3, readFileSync as readFileSync7, readSync as readSync3 } from "node:fs";
function readRange(file, from, bytes) {
  const fd = openSync3(file, "r");
  try {
    const size = fstatSync2(fd).size;
    const len = Math.min(bytes, size);
    const buf = Buffer.alloc(len);
    readSync3(fd, buf, 0, len, from === "end" ? size - len : 0);
    return buf.toString("utf8");
  } finally {
    closeSync3(fd);
  }
}
function lastSample(samples, session) {
  for (let i = samples.length - 1; i >= 0; i--) if (samples[i].session === session) return samples[i];
  return void 0;
}
function lastOf(file, session) {
  const tail = parseJsonl(readRange(file, "end", TAIL_BYTES));
  for (let i = tail.length - 1; i >= 0; i--) if (tail[i].session === session) return tail[i];
  return void 0;
}
function prune(file, now) {
  const head = readRange(file, "start", 1024).split("\n")[0] ?? "";
  const first = parseJsonl(head)[0];
  const cutoff = now.getTime() - KEEP_DAYS * DAY_MS;
  if (!first || Date.parse(first.ts) >= cutoff - DAY_MS) return;
  const kept = parseJsonl(readFileSync7(file, "utf8")).filter((s) => Date.parse(s.ts) >= cutoff);
  try {
    writeAtomic(file, kept.map((s) => JSON.stringify(s) + "\n").join(""));
  } catch {
  }
}
function logSample(file, sample, now = /* @__PURE__ */ new Date()) {
  if (existsSync6(file)) {
    const last = lastOf(file, sample.session);
    if (last && same(last, sample)) return false;
  }
  appendJsonl(file, sample);
  prune(file, now);
  return true;
}
var KEEP_DAYS, DAY_MS, TAIL_BYTES, same;
var init_limits_log = __esm({
  "src/limits-log.ts"() {
    "use strict";
    init_fsutil();
    init_jsonl();
    KEEP_DAYS = 30;
    DAY_MS = 864e5;
    TAIL_BYTES = 16 * 1024;
    same = (a, b) => a.cost === b.cost && a.five === b.five && a.seven === b.seven && a.fiveReset === b.fiveReset && a.sevenReset === b.sevenReset && a.ctx === b.ctx;
  }
});

// src/session-cmd.ts
var session_cmd_exports = {};
__export(session_cmd_exports, {
  pickSession: () => pickSession,
  renderSession: () => renderSession,
  sessionCommand: () => sessionCommand,
  sessionFigures: () => sessionFigures
});
import { join as join7 } from "node:path";
function pickSession(sessions, id) {
  if (id) return sessions.find((s) => s.id.startsWith(id));
  return [...sessions].sort((a, b) => a.end < b.end ? 1 : -1)[0];
}
function sessionFigures(s, all, samples, dir) {
  const last = lastSample(samples, s.id);
  const cost = sessionCost(s, learnPrices(all), last?.cost);
  return {
    five: last?.five,
    seven: last?.seven,
    usd: cost.usd,
    approx: cost.source === "estimated",
    plan: hasPlanLimits(samples),
    eq: sessionEquivalent(s),
    ctx: last?.ctx,
    guard: guardFigure(dir, s.id)
  };
}
function renderSession(s, f, last) {
  const head = `Session ${s.id.slice(0, 8)}${s.title ? ` ${truncate(s.title, 40)}` : ""} (${projectName(s.project)}, ${s.start.slice(0, 16).replace("T", " ")})`;
  const source = last ? `5h/7d, ctx and $ are the last values the status line saw (${last.ts.slice(0, 19).replace("T", " ")} UTC); Equiv is read from the transcripts now.` : f.approx ? "No status line snapshot or recorded cost for this session: '~$' is an estimate from its tokens. Install the wrapper (budgetline statusline install) to compare live." : "No status line snapshot for this session: $ is the cost Claude Code recorded in the transcript.";
  return [head, sessionLine(f), "", source].join("\n");
}
function sessionCommand(p) {
  const all = load(p);
  const s = pickSession(all, str(p, "id"));
  if (!s) return "No Claude Code session found.";
  const dir = dataDir();
  const samples = readSamples(join7(dir, "limits.jsonl"));
  const f = sessionFigures(s, all, samples, dir);
  return p.flags.json ? JSON.stringify({ id: s.id, ...f, line: sessionLine(f) }, null, 2) : renderSession(s, f, lastSample(samples, s.id));
}
var init_session_cmd = __esm({
  "src/session-cmd.ts"() {
    "use strict";
    init_args();
    init_calibration();
    init_cost();
    init_data();
    init_format();
    init_guard();
    init_limits_log();
    init_paths();
    init_session_line();
  }
});

// src/base-cost.ts
function openings(rows) {
  return rows.filter((r) => r.opensSession && r.initialUsage && promptTokens(r.initialUsage) > 0).sort((a, b) => a.start < b.start ? 1 : -1).slice(0, RECENT3);
}
function baseCost(rows, project) {
  const own = openings(rows.filter((r) => r.project === project));
  const sameProject2 = own.length >= MIN_SESSIONS;
  const list = sameProject2 ? own : openings(rows);
  if (list.length < MIN_SESSIONS) return null;
  const tokens2 = percentile(list.map((r) => promptTokens(r.initialUsage)), 0.5);
  return {
    tokens: tokens2,
    startEq: percentile(list.map((r) => equivalent(r.initialUsage)), 0.5),
    perCallEq: tokens2 * WEIGHTS.cacheRead,
    sessions: list.length,
    sameProject: sameProject2
  };
}
function baseEq(b, turns, fresh2) {
  const calls = Math.max(1, turns);
  return fresh2 ? b.startEq + (calls - 1) * b.perCallEq : calls * b.perCallEq;
}
var RECENT3, MIN_SESSIONS, HIGH_BASE_TOKENS;
var init_base_cost = __esm({
  "src/base-cost.ts"() {
    "use strict";
    init_cost();
    init_types();
    RECENT3 = 20;
    MIN_SESSIONS = 3;
    HIGH_BASE_TOKENS = 4e4;
  }
});

// src/comparable.ts
function currentSession(rows, x) {
  if (x.session) return x.session;
  const now = (x.now ?? /* @__PURE__ */ new Date()).getTime();
  let latest;
  for (const r of rows) {
    if (r.project.toLowerCase() !== x.project.toLowerCase()) continue;
    if (!latest || r.end > latest.end) latest = r;
  }
  return latest && now - Date.parse(latest.end) < ACTIVE_MS ? latest.sessionId : void 0;
}
function comparableRows(rows, x) {
  const current = currentSession(rows, x);
  return rows.filter((r) => !r.estimate && r.sessionId !== current);
}
var ACTIVE_MS;
var init_comparable = __esm({
  "src/comparable.ts"() {
    "use strict";
    ACTIVE_MS = 10 * 60 * 1e3;
  }
});

// src/estimate.ts
function idf(rows) {
  const df = /* @__PURE__ */ new Map();
  for (const r of rows) for (const t of new Set(r.terms)) df.set(t, (df.get(t) ?? 0) + 1);
  const out = /* @__PURE__ */ new Map();
  for (const [t, n] of df) out.set(t, Math.log((rows.length + 1) / (n + 1)) + 1);
  return out;
}
function vector(ts, weights) {
  const v = /* @__PURE__ */ new Map();
  for (const t of ts) v.set(t, (v.get(t) ?? 0) + (weights.get(t) ?? 1));
  return v;
}
function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, x] of a) {
    na += x * x;
    dot += x * (b.get(t) ?? 0);
  }
  for (const y of b.values()) nb += y * y;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
function sameProject(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}
function similarTasks(rows, description, project) {
  const w = idf(rows);
  const q = vector(terms(description), w);
  return rows.map((row) => {
    const sim = cosine(q, vector(row.terms, w));
    return { row, sim: sameProject(row.project, project) ? sim * SAME_PROJECT_BOOST : sim };
  }).filter((x) => x.sim >= MIN_SIM).sort((a, b) => b.sim - a.sim).slice(0, MAX_SIMILAR);
}
function chooseBasis(rows, description, project) {
  const sim = similarTasks(rows, description, project);
  if (sim.length >= MIN_SIMILAR) {
    const avg = sim.reduce((a, x) => a + Math.min(x.sim, 1), 0) / sim.length;
    const same2 = sim.filter((x) => sameProject(x.row.project, project)).length;
    return { kind: "similar", rows: sim.map((x) => x.row), avgSimilarity: avg, sameProject: same2, closest: sim.slice(0, 3).map((x) => x.row) };
  }
  const local = rows.filter((r) => sameProject(r.project, project));
  const pool = local.length >= 20 ? local : rows;
  return { kind: "global", rows: pool, avgSimilarity: 0, sameProject: pool === local ? local.length : 0, closest: [] };
}
function range(values) {
  return { low: percentile(values, 0.25), typical: percentile(values, 0.5), high: percentile(values, 0.9) };
}
function estimateFromHistory(rows, description, project) {
  if (rows.length === 0) return null;
  const kind = taskKind(description);
  const sameKind = rows.filter((r) => r.kind === kind);
  const basis = chooseBasis(sameKind.length >= MIN_SIMILAR ? sameKind : rows, description, project);
  const eq = range(basis.rows.map((r) => r.eq));
  const priced2 = basis.rows.filter((r) => r.usd !== null);
  const usd2 = priced2.length >= basis.rows.length / 2 ? range(priced2.map((r) => r.usd)) : null;
  return {
    basis,
    eq,
    usd: usd2,
    wide: eq.low > 0 ? eq.high / eq.low > WIDE_RATIO : true,
    fewData: basis.kind === "global",
    medianTurns: percentile(basis.rows.map((r) => r.turns), 0.5),
    taskKind: kind
  };
}
function shift(r, by) {
  return { low: r.low + by, typical: r.typical + by, high: r.high + by };
}
function basisPrice(rows) {
  const priced2 = rows.filter((r) => r.usd !== null && r.eq > 0);
  const eq = priced2.reduce((a, r) => a + r.eq, 0);
  return eq > 0 ? priced2.reduce((a, r) => a + r.usd, 0) / eq : null;
}
var MIN_SIMILAR, WIDE_RATIO, MIN_SIM, MAX_SIMILAR, SAME_PROJECT_BOOST;
var init_estimate = __esm({
  "src/estimate.ts"() {
    "use strict";
    init_cost();
    init_text();
    MIN_SIMILAR = 5;
    WIDE_RATIO = 10;
    MIN_SIM = 0.12;
    MAX_SIMILAR = 25;
    SAME_PROJECT_BOOST = 1.25;
  }
});

// src/repo-context.ts
import { existsSync as existsSync7, readdirSync as readdirSync2, statSync as statSync3 } from "node:fs";
import { join as join8, relative, resolve } from "node:path";
function tokensOfBytes(bytes) {
  return Math.round(bytes / 4);
}
function fileTokens(cwd, p) {
  try {
    const st = statSync3(p);
    return st.isFile() ? { path: (relative(cwd, p) || p).replace(/\\/g, "/"), tokens: tokensOfBytes(st.size) } : null;
  } catch {
    return null;
  }
}
function baseFiles(cwd) {
  const out = [join8(cwd, "CLAUDE.md"), join8(cwd, ".claude", "CLAUDE.md"), join8(cwd, "CLAUDE.local.md")];
  const rules = join8(cwd, ".claude", "rules");
  if (existsSync7(rules)) {
    for (const f of readdirSync2(rules)) if (f.endsWith(".md")) out.push(join8(rules, f));
  }
  return out;
}
function citedPaths(description) {
  const words = description.match(/[@\w./\\-]+/g) ?? [];
  return [...new Set(words.map((w) => w.replace(/^@/, "").replace(/[.,;:]+$/, "")))].filter(
    (w) => /[/\\]/.test(w) || /\.[a-z0-9]{1,5}$/i.test(w)
  );
}
function sum2(files) {
  return files.reduce((a, f) => a + f.tokens, 0);
}
function repoContext(cwd, description) {
  const base = baseFiles(cwd).map((p) => fileTokens(cwd, p)).filter((f) => f !== null);
  const cited = citedFiles(cwd, description);
  return { base, baseTokens: sum2(base), cited, citedTokens: sum2(cited) };
}
function citedFiles(cwd, description) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const p of citedPaths(description)) {
    const abs = resolve(cwd, p);
    const key = process.platform === "win32" ? abs.toLowerCase() : abs;
    const f = seen.has(key) ? null : fileTokens(cwd, abs);
    if (!f) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}
function citedCost(citedTokens, turns) {
  return citedTokens * (WEIGHTS.cacheWrite1h + WEIGHTS.cacheRead * Math.max(0, turns - 1));
}
var init_repo_context = __esm({
  "src/repo-context.ts"() {
    "use strict";
    init_cost();
  }
});

// src/suggest.ts
function suggestions(input, max = 4) {
  return RULES.map((r) => r(input)).filter((s) => s !== null).slice(0, max);
}
var RULES;
var init_suggest = __esm({
  "src/suggest.ts"() {
    "use strict";
    init_base_cost();
    init_cost();
    init_format();
    init_text();
    RULES = [
      ({ base }) => base && base.tokens > HIGH_BASE_TOKENS ? `Every message here starts with ~${tokens(base.tokens)} tokens of fixed context. Run /context to see what fills it; disable plugins, MCP servers and skills you do not use in this project and trim CLAUDE.md/rules. Ask related quick questions in the same session: a new session pays the cache write again.` : null,
      ({ ctx }) => ctx.citedTokens > 2e4 ? `The files you cite are ~${tokens(ctx.citedTokens)} tokens. Point to functions or line ranges instead of whole files.` : null,
      ({ est }) => est.taskKind === "question" ? "For a quick question, ask it in a fresh session (or before a long task) so it does not re-read a long conversation." : null,
      ({ ctx, est }) => ctx.cited.length === 0 && est.eq.typical > 3e5 ? "Name the files involved. Open-ended exploration is where similar tasks got expensive." : null,
      ({ est }) => est.taskKind === "change" && (est.wide || est.eq.typical > 5e5) ? `Split it into smaller steps with a checkpoint each. Similar tasks took ~${Math.round(est.medianTurns)} turns and the expensive ones ran much longer.` : null,
      ({ description }) => isReviewOnly(description) ? "This reads like review/explain work: a cheaper model (e.g. /model sonnet or haiku) is usually enough." : null,
      ({ est }) => {
        const share = percentile(est.basis.rows.map((r) => r.cacheWriteShare), 0.5);
        return share > 0.3 ? `Similar tasks spent ~${Math.round(share * 100)}% on cache writes: do it in one sitting, without long pauses or model switches.` : null;
      },
      ({ est }) => {
        const eq = est.basis.rows.reduce((a, r) => a + r.eq, 0);
        const sub = est.basis.rows.reduce((a, r) => a + r.subagentEq, 0);
        return eq > 0 && sub / eq > 0.3 ? `~${Math.round(sub / eq * 100)}% of similar tasks went into subagents: ask for a direct approach or a narrower subagent brief.` : null;
      },
      ({ ctx }) => ctx.baseTokens > 1e4 ? `CLAUDE.md and always-loaded rules are ~${tokens(ctx.baseTokens)} tokens, paid on every turn. Trim what this task does not need.` : null
    ];
  }
});

// src/estimate-cmd.ts
var estimate_cmd_exports = {};
__export(estimate_cmd_exports, {
  estimateCommand: () => estimateCommand,
  estimateJson: () => estimateJson,
  renderEstimate: () => renderEstimate,
  runEstimate: () => runEstimate
});
import { join as join9, resolve as resolve2 } from "node:path";
function scale(r, k) {
  return { low: r.low * k, typical: r.typical * k, high: r.high * k };
}
function runEstimate(sessions, description, cwd, calibration, plan = calibration !== null, opts = {}) {
  return estimateFromRows(buildHistory(sessions, {}).tasks, description, cwd, calibration, plan, opts);
}
function estimateFromRows(rows, description, cwd, calibration, plan, opts) {
  const est = estimateFromHistory(comparableRows(rows, { project: cwd, session: opts.session, now: opts.now }), description, cwd);
  if (!est) return null;
  const ctx = repoContext(cwd, description);
  const extra = citedCost(ctx.citedTokens, est.medianTurns);
  const price = basisPrice(est.basis.rows);
  const bias = opts.log ? measuredBias(opts.log, rows) : null;
  const k = bias?.factor ?? 1;
  const raw = shift(est.eq, extra);
  const eq = scale(raw, k);
  const usdRange = est.usd && price !== null ? scale(shift(est.usd, extra * price), k) : null;
  const limit5h = usdRange && calibration ? scale(usdRange, calibration.fivePerUsd) : null;
  const base = baseCost(rows, cwd);
  const taskEq = base ? minus(eq, baseInTask(base, est)) : null;
  const tips = suggestions({ description, est, ctx, base });
  return { est, ctx, eq, usd: usdRange, limit5h, calibration, plan, base, taskEq, price, tips, bias, rawTypical: raw.typical };
}
function baseInTask(b, est) {
  const rows = est.basis.rows;
  const fresh2 = rows.length ? rows.filter((r) => r.opensSession).length / rows.length : 0;
  return baseEq(b, est.medianTurns, false) + fresh2 * (b.startEq - b.perCallEq);
}
function minus(r, by) {
  return { low: Math.max(0, r.low - by), typical: Math.max(0, r.typical - by), high: Math.max(0, r.high - by) };
}
function fmtRange(r, f) {
  return `${f(r.typical)} typical (range ${f(r.low)} \u2013 ${f(r.high)})`;
}
function pctFmt(n) {
  return n < 1 ? "<1%" : `${Math.round(n)}%`;
}
function basisLine(r) {
  const b = r.est.basis;
  if (b.kind === "similar") {
    return `Based on ${b.rows.length} similar past ${r.est.taskKind === "question" ? "questions" : "tasks"} (${b.sameProject} in this project, average similarity ${b.avgSimilarity.toFixed(2)}).`;
  }
  const what = r.est.taskKind === "question" ? "questions" : "tasks";
  return `Not enough similar past ${what}: this is the spread of all your past ${what} (${b.rows.length}${b.sameProject ? " in this project" : ""}), not a task-specific estimate.`;
}
function closestLines(r) {
  const c = r.est.basis.closest;
  if (!c.length) return [];
  const item = (t) => `"${truncate(t.sessionTitle ?? t.sessionId.slice(0, 8), 40)}" (${t.usd === null ? tokens(t.eq) : money(t.usd, true)})`;
  return [`Closest: ${c.map(item).join(", ")}. If these look unrelated, ignore the estimate.`];
}
function biasLines(r) {
  if (!r.bias) return [];
  const dir = r.bias.factor >= 1 ? "low" : "high";
  return [
    `Corrected \xD7${r.bias.factor.toFixed(1)} for measured bias: your last ${r.bias.n} checked estimates came out ${dir} (median actual/estimate). Uncorrected typical: ${tokens(r.rawTypical)}.`
  ];
}
function warnings(r) {
  const out = [];
  if (r.est.fewData) out.push("LOW CONFIDENCE: few comparable tasks. Treat the numbers as a rough prior.");
  if (r.est.wide) out.push(`WIDE RANGE: the high end is more than ${WIDE_RATIO}x the low end. Your similar tasks vary a lot, so the typical value is a guess.`);
  return out;
}
function limitLines(r) {
  if (r.limit5h) {
    return [`5-hour limit: ~${pctFmt(r.limit5h.typical)} typical (range ${pctFmt(r.limit5h.low)} \u2013 ${pctFmt(r.limit5h.high)}), from ${r.calibration.pairs} status line samples. Parallel sessions make this less accurate.`];
  }
  if (r.plan) return ["Usage-limit %: not calibrated yet (needs ~10 status line samples and $1 of usage)."];
  return ["Usage-limit %: none seen. On a Pro/Max plan, run `budgetline statusline install` to learn it; the $ is then API-equivalent value, not a bill."];
}
function moneyLine(r) {
  const label2 = r.plan ? "API-equivalent value" : "Cost";
  return r.usd ? `${label2}: ${fmtRange(r.usd, (n) => usd(n, true))}` : `${label2}: n/a (no recorded cost for these models yet)`;
}
function headline(r) {
  return r.plan ? [...limitLines(r), moneyLine(r)] : [moneyLine(r), ...limitLines(r)];
}
function priced(eq, price) {
  if (price === null) return tokens(eq);
  const d = eq * price;
  return `${tokens(eq)} (~$${d.toFixed(d < 0.1 ? 3 : 2)})`;
}
function baseLines(r) {
  const b = r.base;
  if (!b || !r.taskEq) return [];
  const where = b.sameProject ? "in this project" : `(all projects: fewer than 3 sessions here)`;
  return [
    `Base cost per message ${where}: ~${tokens(b.tokens)} tokens of fixed context (system prompt, tools, CLAUDE.md/rules, plugins, skills, memory). A session's first message writes it to the cache: ~${priced(b.startEq, r.price)} equivalent; each later API call re-reads it: ~${priced(b.perCallEq, r.price)}.`,
    `Task cost (beyond the fixed context): ${fmtRange(r.taskEq, tokens)} equivalent tokens.`
  ];
}
function contextLine(r) {
  const base = r.ctx.baseTokens ? `instruction files ~${tokens(r.ctx.baseTokens)} tokens per turn` : "no CLAUDE.md or rules found";
  const cited = r.ctx.cited.length ? `cited files ~${tokens(r.ctx.citedTokens)} tokens (${r.ctx.cited.map((f) => f.path).join(", ")})` : "no cited files found";
  return `Repo context: ${base}; ${cited}.`;
}
function renderEstimate(r) {
  const lines = [
    "budgetline estimate (local, approximate)",
    "",
    ...headline(r),
    `Tokens: ${fmtRange(r.eq, tokens)} equivalent (priced like input tokens)`,
    ...biasLines(r),
    "",
    basisLine(r),
    ...closestLines(r),
    ...warnings(r),
    contextLine(r),
    ...baseLines(r),
    "Session: this assumes a typical session. In a long session every turn re-reads the whole conversation, so it costs more; for a quick question, a fresh session is cheaper.",
    ...r.accuracy ? [r.accuracy] : [],
    "",
    "How to save:",
    ...r.tips.length ? r.tips.map((t) => `- ${t}`) : ["- Nothing obvious: the task looks reasonably scoped."]
  ];
  return lines.join("\n");
}
function estimateJson(r) {
  const { est, ...rest } = r;
  const basis = { kind: est.basis.kind, tasks: est.basis.rows.length, sameProject: est.basis.sameProject, avgSimilarity: est.basis.avgSimilarity };
  const usdMeaning = r.plan ? "api-equivalent-value" : "cost";
  return JSON.stringify({ ...rest, usdMeaning, basis, wide: est.wide, lowConfidence: est.fewData, biasFactor: r.bias?.factor ?? 1 }, null, 2);
}
function estimateCommand(p) {
  const description = p.positional.join(" ").trim();
  if (!description) throw new Error('describe the task, e.g. budgetline estimate "add a login page"');
  const cwd = resolve2(str(p, "cwd") ?? process.cwd());
  const { calibration, plan } = readBilling(join9(dataDir(), "limits.jsonl"));
  const rows = buildHistory(load(p), {}).tasks;
  const logFile = join9(dataDir(), "estimates.jsonl");
  const log = readLog(logFile);
  const session = str(p, "session") ?? process.env.CLAUDE_CODE_SESSION_ID;
  const r = estimateFromRows(rows, description, cwd, calibration, plan, { session, log });
  if (!r) return "No Claude Code history found yet: nothing to estimate from. Use Claude Code for a few tasks first.";
  r.accuracy = accuracyLine(evaluate(log, rows));
  logEstimate(logFile, cwd, r.eq, /* @__PURE__ */ new Date(), r.rawTypical);
  return p.flags.json ? estimateJson(r) : renderEstimate(r);
}
var init_estimate_cmd = __esm({
  "src/estimate-cmd.ts"() {
    "use strict";
    init_session_line();
    init_args();
    init_base_cost();
    init_accuracy();
    init_comparable();
    init_calibration();
    init_data();
    init_estimate();
    init_format();
    init_history();
    init_paths();
    init_repo_context();
    init_suggest();
  }
});

// src/launcher.ts
import { chmodSync, mkdirSync as mkdirSync2 } from "node:fs";
import { join as join10 } from "node:path";
import { fileURLToPath } from "node:url";
function currentCli() {
  return fileURLToPath(new URL("./cli.js", import.meta.url));
}
function launcherSource(fallbackCli) {
  return `#!/usr/bin/env node
// budgetline launcher, written by \`budgetline setup-statusline --write\`. Do not edit:
// it is rewritten on every install. It finds the current budgetline install so the status
// line keeps working after plugin updates. Local only: it reads two files and never uses the network.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const FALLBACK = ${JSON.stringify(fallbackCli)};
const env = process.env;
const root = env.CLAUDE_CODE_PLUGIN_CACHE_DIR || join(env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'plugins');
const inCache = (p) => resolve(p).toLowerCase().startsWith(resolve(root, 'cache').toLowerCase() + sep);

function fromRegistry() {
  try {
    const reg = JSON.parse(readFileSync(join(root, 'installed_plugins.json'), 'utf8'));
    const list = Object.entries(reg.plugins || {})
      .filter(([id]) => id.split('@')[0] === 'budgetline')
      .flatMap(([, v]) => (Array.isArray(v) ? v : []))
      .sort((a, b) => String(b.lastUpdated || '').localeCompare(String(a.lastUpdated || '')));
    for (const e of list) {
      const cli = typeof e.installPath === 'string' ? join(e.installPath, 'dist', 'cli.js') : '';
      if (cli && existsSync(cli)) return cli;
    }
  } catch {
    // no registry or unreadable: fall through
  }
  return null;
}

function locate() {
  if (existsSync(FALLBACK) && !inCache(FALLBACK)) return FALLBACK;
  return fromRegistry() || (existsSync(FALLBACK) ? FALLBACK : null);
}

const cli = locate();
if (!cli) {
  process.stdout.write('budgetline: install not found (plugin removed?). Reinstall it, then run: budgetline setup-statusline --write\\n');
} else {
  try {
    const m = await import(pathToFileURL(cli).href);
    process.exitCode = await m.main(process.argv.slice(2));
  } catch (err) {
    process.stdout.write('budgetline: ' + (err && err.message ? err.message : String(err)) + '\\n');
  }
}
`;
}
function writeLauncher(data, fallbackCli = currentCli()) {
  const file = launcherPath(data);
  mkdirSync2(join10(data, "bin"), { recursive: true, mode: 448 });
  writeAtomic(file, launcherSource(fallbackCli));
  try {
    chmodSync(file, 448);
  } catch {
  }
  return file;
}
function shellQuote(path, platform = process.platform) {
  const p = platform === "win32" ? path.replace(/\\/g, "/") : path;
  if (platform === "win32") {
    if (/["$`]/.test(p)) throw new Error(`cannot write a status line command for a path with " $ or \` in it: ${p}. Set BUDGETLINE_DATA to a plain folder and run it again.`);
    return `"${p}"`;
  }
  return `"${p.replace(/[\\"$`]/g, "\\$&")}"`;
}
function launcherCommand(data, platform = process.platform) {
  return `node ${shellQuote(launcherPath(data), platform)} statusline run`;
}
var launcherPath;
var init_launcher = __esm({
  "src/launcher.ts"() {
    "use strict";
    init_fsutil();
    launcherPath = (data) => join10(data, "bin", "budgetline.mjs");
  }
});

// src/statusline.ts
var statusline_exports = {};
__export(statusline_exports, {
  figuresFromInput: () => figuresFromInput,
  install: () => install,
  ownLine: () => ownLine,
  run: () => run,
  status: () => status2,
  statuslineCommand: () => statuslineCommand,
  toSample: () => toSample,
  uninstall: () => uninstall
});
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync as existsSync8, rmSync as rmSync3 } from "node:fs";
import { join as join11 } from "node:path";
function defaultPaths() {
  return { settings: join11(claudeDir(), "settings.json"), data: dataDir() };
}
function readOriginal(p) {
  try {
    return readJson2(backupFile(p))?.original ?? null;
  } catch {
    return null;
  }
}
function isOurs(statusLine) {
  const c = statusLine?.command;
  return typeof c === "string" && c.includes(MARKER) && (c.includes("budgetline") || c.includes(LEGACY_NAME));
}
function install(p = defaultPaths(), command = launcherCommand(p.data)) {
  const settings = readJson2(p.settings) ?? {};
  writeLauncher(p.data);
  if (isOurs(settings.statusLine)) return refresh(p, settings, command);
  if (existsSync8(p.settings)) copyFileSync(p.settings, join11(p.data, "settings.before-install.json"));
  writeAtomic(backupFile(p), JSON.stringify({ original: settings.statusLine ?? null }, null, 2));
  settings.statusLine = { ...settings.statusLine ?? {}, type: "command", command };
  writeSettings(p, settings);
  const kept = settings.statusLine && readJson2(backupFile(p)).original ? " Your existing status line still runs and shows as before." : "";
  return `Installed. Claude Code will log usage-limit snapshots to ${limitsFile(p)} (metrics only, no text).${kept}
Undo with: budgetline statusline uninstall`;
}
function refresh(p, settings, command) {
  if (settings.statusLine.command === command) return "The budgetline status line wrapper is already installed.";
  settings.statusLine = { ...settings.statusLine, command };
  writeSettings(p, settings);
  return `Updated the budgetline status line wrapper to: ${command}`;
}
function uninstall(p = defaultPaths()) {
  const settings = readJson2(p.settings) ?? {};
  if (!isOurs(settings.statusLine)) return "The budgetline wrapper is not the current status line: settings.json left unchanged.";
  const original = readOriginal(p);
  if (original) settings.statusLine = original;
  else delete settings.statusLine;
  writeSettings(p, settings);
  rmSync3(backupFile(p), { force: true });
  return `Uninstalled. Status line restored${original ? ` to: ${original.command}` : " (none)"}. Collected samples stay in ${limitsFile(p)}; delete it if you want.`;
}
function status2(p = defaultPaths()) {
  const installed = isOurs(readJson2(p.settings)?.statusLine);
  const samples = readSamples(limitsFile(p));
  const c = calibrate(samples);
  const cal = c ? `calibrated: ~${c.fivePerUsd.toFixed(1)}% of the 5-hour limit per $1 (${c.pairs} pairs, $${c.usd.toFixed(2)} observed)` : "not calibrated yet (needs ~10 paired samples and $1 of usage)";
  return `Status line wrapper: ${installed ? "installed" : "not installed"}. Samples: ${samples.length}. Limit %: ${cal}.`;
}
function toSample(input, now = /* @__PURE__ */ new Date()) {
  const rl = input?.rate_limits ?? {};
  if (!hasFigures(input, rl)) return null;
  return { ts: now.toISOString(), ...ids(input), ...windowFields(rl.five_hour ?? {}, rl.seven_day ?? {}), ...ctxField(input) };
}
function ctxField(input) {
  const ctx = input?.context_window?.used_percentage;
  return typeof ctx === "number" ? { ctx } : {};
}
function ids(input) {
  return { session: String(input.session_id ?? ""), model: String(input.model?.id ?? ""), cost: Number(input.cost?.total_cost_usd ?? 0) };
}
function windowFields(five, seven) {
  const out = {};
  if (typeof five.used_percentage === "number") Object.assign(out, { five: five.used_percentage, fiveReset: five.resets_at });
  if (typeof seven.used_percentage === "number") Object.assign(out, { seven: seven.used_percentage, sevenReset: seven.resets_at });
  return out;
}
function record(stdin, p) {
  try {
    const input = JSON.parse(stdin);
    const sample = toSample(input);
    if (sample) logSample(limitsFile(p), sample);
    recordWindow(p.data, String(input?.session_id ?? ""), input?.context_window?.context_window_size);
  } catch {
  }
}
function run(stdin, p = defaultPaths()) {
  record(stdin, p);
  const original = readOriginal(p);
  if (!original?.command || isOurs(original)) return ownLine(stdin, p.data, false);
  const r = spawnSync(original.command, { input: stdin, shell: true, encoding: "utf8", timeout: 5e3 });
  return (r.stdout ?? "").replace(/\r?\n$/, "");
}
function figuresFromInput(input, dir) {
  const rl = input.rate_limits ?? {};
  const cost = input.cost?.total_cost_usd;
  return {
    five: rl.five_hour?.used_percentage,
    seven: rl.seven_day?.used_percentage,
    usd: typeof cost === "number" ? cost : null,
    plan: Boolean(rl.five_hour || rl.seven_day),
    eq: transcriptEq(input.transcript_path, dir),
    ctx: input.context_window?.used_percentage,
    guard: dir ? guardFigure(dir, typeof input.session_id === "string" ? input.session_id : void 0) : void 0
  };
}
function transcriptEq(path, dir) {
  if (typeof path !== "string" || !path) return null;
  if (dir) return sessionEq(path, dir);
  const s = parseTranscript(path);
  return s ? sessionEquivalent(s) : null;
}
function ownLine(stdin, dir, record2 = true) {
  try {
    const input = JSON.parse(stdin);
    if (dir && record2) recordWindow(dir, String(input?.session_id ?? ""), input?.context_window?.context_window_size);
    return sessionLine(figuresFromInput(input ?? {}, dir));
  } catch {
    return "budgetline";
  }
}
async function statuslineCommand(p) {
  const sub = p.positional[0];
  if (sub === "install") return install();
  if (sub === "uninstall") return uninstall();
  if (sub === "status") return status2();
  if (sub === "run") return run(await readStdin());
  throw new Error("usage: budgetline statusline install | uninstall | status");
}
var MARKER, backupFile, limitsFile, readJson2, writeSettings, hasFigures;
var init_statusline = __esm({
  "src/statusline.ts"() {
    "use strict";
    init_calibration();
    init_limits_log();
    init_data();
    init_cost();
    init_guard();
    init_session_line();
    init_scan();
    init_incremental();
    init_paths();
    init_fsutil();
    init_launcher();
    MARKER = "statusline run";
    backupFile = (p) => join11(p.data, "statusline-backup.json");
    limitsFile = (p) => join11(p.data, "limits.jsonl");
    readJson2 = readJsonFile;
    writeSettings = (p, settings) => writeAtomic(p.settings, JSON.stringify(settings, null, 2) + "\n");
    hasFigures = (input, rl) => Boolean(rl.five_hour || rl.seven_day) || typeof input?.cost?.total_cost_usd === "number";
  }
});

// src/setup-statusline.ts
var setup_statusline_exports = {};
__export(setup_statusline_exports, {
  entry: () => entry,
  instructions: () => instructions,
  setupStatusline: () => setupStatusline,
  setupStatuslineCommand: () => setupStatuslineCommand
});
import { join as join12 } from "node:path";
import { createInterface } from "node:readline/promises";
function entry(command) {
  return JSON.stringify({ statusLine: { type: "command", command } }, null, 2);
}
function instructions(settings, command, data) {
  return [
    `Run \`budgetline setup-statusline --write\` to add this to ${settings}:`,
    "",
    entry(command),
    "",
    `The command runs a small launcher, ${launcherPath(data)}, that --write creates. It finds the`,
    "current budgetline install each time (this copy, else the plugin Claude Code has installed), so the",
    "status line keeps working after plugin updates. If you already have a status line, --write keeps it:",
    "budgetline runs it and shows its output unchanged."
  ].join("\n");
}
async function askTty(question) {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return /^y(es)?$/i.test((await rl.question(question)).trim());
  } finally {
    rl.close();
  }
}
async function setupStatusline(o) {
  const text = instructions(o.paths.settings, o.command, o.paths.data);
  if (!o.write) return text;
  if (!o.yes) {
    if (!o.interactive) throw new Error("--write needs a confirmation: run it in a terminal, or add --yes");
    const ok = await o.ask(`${text}

Write this to ${o.paths.settings}? A backup goes to ${o.paths.data}. [y/N] `);
    if (!ok) return "Nothing written.";
  }
  return install(o.paths, o.command);
}
function setupStatuslineCommand(p) {
  const dir = dataDir();
  return setupStatusline({
    write: p.flags.write === true,
    yes: p.flags.yes === true,
    interactive: Boolean(process.stdin.isTTY),
    paths: { settings: join12(claudeDir(), "settings.json"), data: dir },
    command: launcherCommand(dir),
    ask: askTty
  });
}
var init_setup_statusline = __esm({
  "src/setup-statusline.ts"() {
    "use strict";
    init_paths();
    init_launcher();
    init_statusline();
  }
});

// src/first-prompt.ts
import { existsSync as existsSync9, readFileSync as readFileSync8 } from "node:fs";
import { join as join13 } from "node:path";
function readSeen(dir) {
  try {
    const v = JSON.parse(readFileSync8(seenFile(dir), "utf8"));
    return Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}
function hasReply(transcript) {
  if (typeof transcript !== "string" || !existsSync9(transcript)) return false;
  try {
    return /"type"\s*:\s*"assistant"/.test(readFileSync8(transcript, "utf8"));
  } catch {
    return true;
  }
}
function isFirstPrompt(dir, session, transcript) {
  if (typeof session === "string" && session) {
    const seen = readSeen(dir);
    if (seen.includes(session)) return false;
    try {
      writeAtomic(seenFile(dir), JSON.stringify([...seen, session].slice(-KEEP)));
    } catch {
    }
  }
  return !hasReply(transcript);
}
var KEEP, seenFile;
var init_first_prompt = __esm({
  "src/first-prompt.ts"() {
    "use strict";
    init_fsutil();
    KEEP = 200;
    seenFile = (dir) => join13(dir, "prompt-note-sessions.json");
  }
});

// src/hook.ts
var hook_exports = {};
__export(hook_exports, {
  ESTIMATE_COMMAND: () => ESTIMATE_COMMAND,
  hookCommand: () => hookCommand,
  hookOutput: () => hookOutput,
  message: () => message
});
import { join as join14 } from "node:path";
function setEnabled(dir, enabled) {
  writeConfig(dir, { hookEnabled: enabled });
  return enabled ? "Hook enabled: the first prompt of a session gets a one-line budgetline note when it looks expensive. It never blocks a prompt. Disable with: budgetline hook disable" : "Hook disabled.";
}
function hookOutput(input, dir, sessions, cfg = readConfig(dir)) {
  if (!cfg.hookEnabled) return "";
  try {
    const { prompt, cwd, session_id: session, transcript_path: transcript } = JSON.parse(input);
    if (!isRealPrompt(prompt) || !isFirstPrompt(dir, session, transcript)) return "";
    const { calibration, plan } = readBilling(join14(dir, "limits.jsonl"));
    const opts = { session: typeof session === "string" ? session : void 0 };
    const r = runEstimate(sessions(), prompt, cwd || process.cwd(), calibration, plan, opts);
    if (!r || r.eq.typical < cfg.hookThreshold) return "";
    return JSON.stringify({ systemMessage: message(r) });
  } catch {
    return "";
  }
}
function message(r) {
  const limit = r.limit5h ? `~${Math.max(1, Math.round(r.limit5h.typical))}% of your 5-hour limit, ` : "";
  const cost = r.usd ? `, ~${usd(r.usd.typical, true)}${r.plan ? " API-equivalent value" : ""}` : "";
  const figures = `${limit}~${tokens(r.eq.typical)} equivalent tokens${cost} typical`;
  const more = `Range and savings tips: ${ESTIMATE_COMMAND} <task>.`;
  if (r.est.fewData || r.est.wide) return `budgetline: rough figure for tasks like this (low confidence): ${figures}. ${more}`;
  return `budgetline: this looks like a big task: ${figures}. ${more}`;
}
function hookCommand(p) {
  const sub = p.positional[0];
  const dir = dataDir();
  if (sub === "enable") return setEnabled(dir, true);
  if (sub === "disable") return setEnabled(dir, false);
  if (sub === "status") return `Prompt note (first prompt of each session): ${readConfig(dir).hookEnabled ? "enabled" : "disabled (default)"}.`;
  throw new Error("usage: budgetline hook enable | disable | status");
}
var ESTIMATE_COMMAND, isRealPrompt;
var init_hook = __esm({
  "src/hook.ts"() {
    "use strict";
    init_calibration();
    init_first_prompt();
    init_text();
    init_config();
    init_estimate_cmd();
    init_format();
    init_paths();
    ESTIMATE_COMMAND = "/budgetline:estimate";
    isRealPrompt = (prompt) => typeof prompt === "string" && prompt.trim() !== "" && !isEstimateRequest(prompt);
  }
});

// src/events.ts
var events_exports = {};
__export(events_exports, {
  eventsCommand: () => eventsCommand,
  eventsOutput: () => eventsOutput,
  mergeOutputs: () => mergeOutputs
});
function mergeOutputs(outputs) {
  const parsed = outputs.filter(Boolean).map((o) => JSON.parse(o));
  if (!parsed.length) return "";
  const merged = {};
  const messages = parsed.map((o) => o.systemMessage).filter(Boolean);
  if (messages.length) merged.systemMessage = messages.join(" \xB7 ");
  const specific = parsed.find((o) => o.hookSpecificOutput)?.hookSpecificOutput;
  if (specific) merged.hookSpecificOutput = specific;
  return JSON.stringify(merged);
}
async function eventsOutput(dir, stdin, sessions) {
  const c = readConfig(dir);
  if (!c.hookEnabled && !c.guardEnabled) return "";
  const input = await stdin();
  const outputs = [];
  if (c.hookEnabled) outputs.push((await Promise.resolve().then(() => (init_hook(), hook_exports))).hookOutput(input, dir, sessions, c));
  if (c.guardEnabled) outputs.push((await Promise.resolve().then(() => (init_guard(), guard_exports))).guardOutput(input, dir, c));
  try {
    return mergeOutputs(outputs);
  } catch {
    return "";
  }
}
async function eventsCommand(p) {
  if (p.positional[0] !== "run") throw new Error("usage: budgetline events run (called by the plugin hooks)");
  return eventsOutput(dataDir(), readStdin, () => load(p));
}
var init_events = __esm({
  "src/events.ts"() {
    "use strict";
    init_config();
    init_data();
    init_paths();
  }
});

// src/cli.ts
init_args();
init_history();
init_data();
init_accuracy();
init_calibration();
init_paths();
import { readFileSync as readFileSync9 } from "node:fs";
import { join as join15 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/render-history.ts
init_format();
init_session_line();

// src/insights.ts
init_cost();
var BIG_CONTEXT = 1e5;
function sum(rows, f) {
  return rows.reduce((a, r) => a + f(r), 0);
}
function topTasks(rows, n) {
  return [...rows].sort((a, b) => b.eq - a.eq).slice(0, n);
}
function patterns(rows) {
  const total = sum(rows, (r) => r.eq);
  if (total === 0) return [];
  const turnLimit = Math.max(30, percentile(rows.map((r) => r.turns), 0.9));
  const share = (m) => sum(m, (r) => r.eq) / total;
  const cache = rows.filter((r) => r.cacheWriteShare > 0.4);
  const turns = rows.filter((r) => r.turns >= turnLimit);
  const subs = rows.filter((r) => r.subagents > 0);
  const big = rows.filter((r) => r.initialContext >= BIG_CONTEXT);
  const out = [
    {
      id: "cache-writes",
      label: "Cache-write heavy (>40% of the task spent re-writing the prompt cache)",
      tasks: cache.length,
      share: share(cache),
      tip: "Avoid long pauses mid-task (the cache expires) and avoid switching model or editing CLAUDE.md mid-session."
    },
    {
      id: "many-turns",
      label: `Long loops (${Math.round(turnLimit)}+ turns)`,
      tasks: turns.length,
      share: share(turns),
      tip: "Split the task into steps with a clear stop, or give the exact files and the acceptance test up front."
    },
    {
      id: "subagents",
      label: "Spent inside subagents",
      tasks: subs.length,
      share: sum(subs, (r) => r.subagentEq) / total,
      tip: "Use subagents for broad searches only; give them a narrow brief and a cheaper model."
    },
    {
      id: "big-context",
      label: `Started with ${BIG_CONTEXT / 1e3}k+ tokens already in context (long sessions, big CLAUDE.md or MCP tools)`,
      tasks: big.length,
      share: share(big),
      tip: "Use /clear or a fresh session between unrelated tasks, /compact long ones, and trim always-loaded instructions and MCP servers."
    }
  ];
  return out.filter((p) => p.tasks > 0).sort((a, b) => b.share - a.share);
}

// src/render-history.ts
var moneyHead = (o) => o.plan ? "API value" : "Cost";
function limitCell(r, o) {
  if (!o.calibration) return [];
  return [r.usd === null ? "n/a" : `${Math.round(r.usd * o.calibration.fivePerUsd)}%`];
}
function label(id, title) {
  const short = id.slice(0, 8);
  return title ? `${short} ${truncate(title, 34)}` : short;
}
function sessionTable(rows, opts) {
  const limit = opts.limit;
  const recent = [...rows].sort((a, b) => a.start < b.start ? 1 : -1).slice(0, limit);
  return table(
    ["Session", "Project", "Date", "Tasks", "Input", "Cache W", "Cache R", "Output", "Equiv", moneyHead(opts)],
    recent.map((r) => [
      label(r.id, r.title),
      truncate(projectName(r.project), 18),
      r.start.slice(0, 10),
      String(r.tasks),
      tokensExact(r.usage.input),
      tokensExact(r.usage.cacheWrite5m + r.usage.cacheWrite1h),
      tokensExact(r.usage.cacheRead),
      tokensExact(r.usage.output),
      tokensExact(r.eq),
      money(r.usd, r.costSource === "estimated")
    ]),
    3
  );
}
function topTable(rows, total, opts) {
  const top = topTasks(rows, Math.min(opts.limit, 10));
  const t = table(
    ["Task", "Date", "Turns", "Subagents", "Start ctx", "Eq tokens", "Share", ...opts.calibration ? ["5h limit"] : [], moneyHead(opts)],
    top.map((r) => [
      label(r.sessionId, r.sessionTitle),
      r.start.slice(0, 10),
      String(r.turns),
      String(r.subagents),
      tokensExact(r.initialContext),
      tokensExact(r.eq),
      pct(r.eq / total),
      ...limitCell(r, opts),
      money(r.usd, true)
    ]),
    2
  );
  if (!opts.showPrompts) return t;
  const prompts = top.map((r, i) => `  ${i + 1}. ${truncate(r.prompt ?? "", 100)}`);
  return `${t}

Prompts (shown because of --show-prompts):
${prompts.join("\n")}`;
}
function totals(d, opts) {
  const eq = d.sessions.reduce((a, r) => a + r.eq, 0);
  const known = d.sessions.filter((r) => r.usd !== null);
  const cost = known.reduce((a, r) => a + (r.usd ?? 0), 0);
  const approx = known.some((r) => r.costSource === "estimated");
  const costNote = known.length < d.sessions.length ? ` (${d.sessions.length - known.length} sessions without a known price)` : "";
  return `${d.sessions.length} sessions, ${d.tasks.length} tasks, ${tokensExact(eq)} equivalent tokens, ${money(cost, approx)}${opts.plan ? " API-equivalent value" : ""}${costNote}`;
}
function renderHistory(d, opts) {
  if (d.tasks.length === 0) return "No Claude Code sessions found (looked in <config>/projects). Nothing to summarize yet.";
  const total = d.sessions.reduce((a, r) => a + r.eq, 0);
  const pats = patterns(d.tasks).map(
    (p) => `- ${p.label}: ${p.tasks} tasks, ${pct(p.share)} of spend.
  Tip: ${p.tip}`
  );
  return [
    `budgetline history: ${totals(d, opts)}`,
    "",
    sessionTable(d.sessions, opts),
    "",
    "What's expensive: top tasks",
    topTable(d.tasks, total, opts),
    "",
    "What's expensive: patterns",
    pats.length ? pats.join("\n") : "- Nothing stands out.",
    "",
    ...opts.accuracy ? ["How accurate budgetline estimates have been", opts.accuracy, ""] : [],
    "Equivalent tokens (Equiv) weight each token by its price relative to input (cache read 0.1, cache write 1.25-2, output 5); the guard and status line use the same unit.",
    "Session $ is what Claude Code reported for it (same figure and rounding as the status line); '~$' marks an estimate from its tokens (no cost recorded). Task $ is always an estimate (~).",
    opts.plan ? "On your plan the $ is API-equivalent value (what the API would charge); what limits you is the %. Prompts are hidden unless you pass --show-prompts." : "Costs use the real per-session cost Claude Code records; prompts are hidden unless you pass --show-prompts."
  ].join("\n");
}
function historyJson(d, opts) {
  const strip = ({ prompt, terms: terms2, sessionTitle, ...r }) => ({
    ...r,
    ...opts.showTitles ? { sessionTitle } : {},
    ...opts.showPrompts ? { prompt } : {}
  });
  const session = ({ title, ...r }) => opts.showTitles ? { ...r, title } : r;
  return JSON.stringify(
    { accuracy: opts.accuracy, usdMeaning: opts.plan ? "api-equivalent-value" : "cost", sessions: d.sessions.map(session), topTasks: topTasks(d.tasks, opts.limit).map(strip), patterns: patterns(d.tasks) },
    null,
    2
  );
}

// src/cli.ts
var HELP = `budgetline: See where your Claude Code budget goes \u2014 and stop hitting your limits.

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
var VALUED = ["id", "session", "project", "since", "limit", "cwd", "budget", "warn", "context", "window"];
function history(p) {
  const sessions = load(p);
  const live = liveCosts(readSamples(join15(dataDir(), "limits.jsonl")));
  const d = buildHistory(sessions, { project: str(p, "project"), since: dateArg(p, "since") }, live);
  const all = buildHistory(sessions, {}).tasks;
  const accuracy = accuracyLine(evaluate(readLog(join15(dataDir(), "estimates.jsonl")), all));
  const billing = readBilling(join15(dataDir(), "limits.jsonl"));
  const opts = { limit: int(p, "limit", 15), showPrompts: p.flags["show-prompts"] === true, showTitles: p.flags["show-titles"] === true, accuracy, ...billing };
  return p.flags.json ? historyJson(d, opts) : renderHistory(d, opts);
}
function liveCosts(samples) {
  const m = /* @__PURE__ */ new Map();
  for (const x of samples) m.set(x.session, x.cost);
  return m;
}
function version() {
  const pkg = join15(fileURLToPath2(import.meta.url), "..", "..", "package.json");
  return JSON.parse(readFileSync9(pkg, "utf8")).version;
}
var COMMANDS = {
  history: async () => history,
  session: async () => (await Promise.resolve().then(() => (init_session_cmd(), session_cmd_exports))).sessionCommand,
  estimate: async () => (await Promise.resolve().then(() => (init_estimate_cmd(), estimate_cmd_exports))).estimateCommand,
  statusline: async () => (await Promise.resolve().then(() => (init_statusline(), statusline_exports))).statuslineCommand,
  "setup-statusline": async () => (await Promise.resolve().then(() => (init_setup_statusline(), setup_statusline_exports))).setupStatuslineCommand,
  guard: async () => (await Promise.resolve().then(() => (init_guard(), guard_exports))).guardCommand,
  hook: async () => (await Promise.resolve().then(() => (init_hook(), hook_exports))).hookCommand,
  events: async () => (await Promise.resolve().then(() => (init_events(), events_exports))).eventsCommand
};
async function main(argv) {
  const p = parseArgs(argv, VALUED);
  const cmd = p.positional.shift();
  if (p.flags.version) {
    process.stdout.write(`${version()}
`);
    return 0;
  }
  const get = cmd ? COMMANDS[cmd] : void 0;
  if (!get || p.flags.help) {
    process.stdout.write(`${HELP}
`);
    return cmd && !get ? 1 : 0;
  }
  const out = await (await get())(p);
  if (out) process.stdout.write(`${out}
`);
  return 0;
}
var isEntry = process.argv[1] && fileURLToPath2(import.meta.url) === (await import("node:fs")).realpathSync(process.argv[1]);
if (isEntry) {
  main(process.argv.slice(2)).then(
    (code) => process.exitCode = code,
    (err) => {
      process.stderr.write(`budgetline: ${err.message}
`);
      process.exitCode = 1;
    }
  );
}
export {
  main
};
