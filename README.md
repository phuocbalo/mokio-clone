# Mokio

Design app prototypes with Claude. A team drafts screens from a brief, reviews them by pinning comments to elements, compares layout options, keeps a spec, plans large changes from one brief, and works with git-style branches and pull requests. Every AI step runs through **Claude Code on your computer**.

## Run it

You need Node 22 or later, and [Claude Code](https://claude.com/claude-code) installed and signed in (`claude`, then sign in).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173.

## Accounts

Accounts and roles are real: they are stored by the server in `data/mokio.db` (SQLite) on this computer. The demo team is created on first start:

| Name      | Email            | Role      |
|-----------|------------------|-----------|
| Linh Tran | linh@mokio.test  | Owner     |
| Minh Pham | minh@mokio.test  | Designer  |
| Hoa Le    | hoa@mokio.test   | Reviewer  |
| Khoa Vu   | khoa@mokio.test  | Developer |

The demo password for all four is `mokio-demo`. New sign-ups start as developers; an owner changes roles in **Settings**.

| Role      | Can do |
|-----------|--------|
| Owner     | Everything, including editing library design systems, archiving prototypes and changing roles. Can preview Mokio as another role from the bar at the top. |
| Designer  | Create prototypes, send review rounds to Claude, apply options, commit, merge, edit the spec, run briefs. |
| Reviewer  | Comment, approve screens and pull requests, pick options, edit the spec. |
| Developer | Read and comment. |

Permissions are checked in the web app and again on the server before any AI task runs.

## Where data lives

- **Accounts and sessions**: the server, in `data/mokio.db`.
- **Prototypes, comments, option rounds, spec, briefs and history**: this browser's local storage, per account and per sample scenario. Reset it from the display settings in the top bar.

## How AI works

The server runs `claude -p --output-format json --json-schema …` with tools turned off, in an empty temporary folder, and returns structured JSON. Each feature is one task in [server/ai.ts](server/ai.ts):

| Task | Used by |
|------|---------|
| `draftPrototype` | New prototype from a brief |
| `reviewRound` | Sending review comments to Claude |
| `optionsRound` | Options board and "More like this" |
| `prReview` | "Ask AI to review" on a pull request |
| `specAsk` | "Ask AI to change the spec" |
| `briefPlan` | Planning a brief |
| `dsAdjust`, `dsCapture` | Design system editor and capture |
| `commitMessage` | "Let AI write the message" |

AI work counts against your Claude subscription's usage limits. Set `MOKIO_MODEL` to choose a model. Settings shows whether Claude Code is installed and signed in.

## What is simulated

Git operations (clone, fetch, pull, push, branches, pull requests) are a model kept with the prototype data; nothing touches a real repository. Screens are drawn from a fixed toolkit of seven screen kinds, three layouts each, three navigation styles.

## Layout

- `server/`: Express API, accounts (`db.ts`), Claude Code runner (`claude.ts`), AI tasks (`ai.ts`).
- `client/src/lib/`: data types, sample data, stores, actions, theme generator.
- `client/src/components/`: shell bar, sidebar, command palette, screen preview, UI parts.
- `client/src/pages/`: sign-in, prototypes, screen map, review, options, spec, briefs, history, full-window view, design systems, settings.

## Build

```bash
npm run build
```

```bash
npm start
```

`npm start` serves the built app and the API together on http://localhost:8787 (set `MOKIO_API_PORT` to change it).
