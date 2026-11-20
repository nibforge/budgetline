# Security policy

## Reporting a vulnerability

Please report security issues **privately**, not in a public issue or pull request:
use [Report a vulnerability](https://github.com/nibforge/budgetline/security/advisories/new)
(GitHub private vulnerability reporting).

Include what you found, how to reproduce it, and the version (`budgetline --version`).
Do not include real transcripts, prompts or project paths.

You will get a reply as soon as possible. Fixes are released as a new npm version and
credited in the release notes unless you prefer otherwise.

## Scope

budgetline runs locally, makes no network calls and writes only to its own data folder.
Of particular interest: anything that reads outside `~/.claude` and the data folder,
writes elsewhere, leaks transcript content, or runs commands it should not.

## Supported versions

Only the latest published version receives fixes.
