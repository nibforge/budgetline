# Contributing

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Setup

```sh
npm install
npm run verify   # lint, types, tests, build, and a check that dist/cli.js is up to date
```

Try your change with `node dist/cli.js history` or `node dist/cli.js estimate "<task>"`,
and as a plugin with `claude --plugin-dir .`.

## Ground rules

- **No runtime dependencies.** The CLI ships as one bundled file, `dist/cli.js`.
- **`dist/cli.js` is committed**, because the plugin runs it without a build step, but
  only the maintainer rebuilds and commits it (see below).
- **Nothing leaves the machine.** budgetline reads local transcripts and writes only to
  its own data folder. No network calls, no telemetry.
- **New behaviour comes with a test.** Tests use temporary folders, never your real
  `~/.claude` or `~/.budgetline`.
- Keep files under 300 lines and functions under 50.

## What a pull request may touch

Pull requests change `src/` and `tests/` (and docs) only. Please do **not** change:

- `dist/` (the bundle the plugin runs),
- `package.json` or `package-lock.json`,
- `.github/workflows/`,
- `hooks/` or `commands/` (the plugin's hooks and commands).

The maintainer reviews the source change, builds `dist/cli.js` and publishes releases.
A pull request that touches these paths will be closed, and its source change may be
applied by the maintainer with credit to you.

## Pull requests

Small and focused is best. Describe what changed and how you checked it. CI runs
`npm run verify` on Linux, macOS and Windows with Node 20 and 22.

Never paste real transcripts, prompts or project paths into an issue or a test fixture.
