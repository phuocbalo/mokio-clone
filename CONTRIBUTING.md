# Working on Mokio

How to get the project onto your computer, run it, and share your changes. Commands work in PowerShell, Git Bash, macOS Terminal and Linux shells.

## 1. Before you start

Install these once:

| Tool | Why | Check |
|------|-----|-------|
| [Git](https://git-scm.com/downloads) | Get the code and share changes | `git --version` |
| [Node.js 22 or later](https://nodejs.org/) (LTS) | Run the app | `node -v` |
| A GitHub account | Push your work | |
| [Claude Code](https://claude.com/claude-code) (optional) | Turn on the AI features | `claude --version` |

Then:

1. **Accept the invitation.** The repository owner adds you as a collaborator, and GitHub emails you an invite. Accept it within 7 days (or open https://github.com/phuocbalo/mokio-clone/invitations). Without it you can still clone, but you cannot push.
2. **Tell Git who you are**, if you never have on this computer:

   ```bash
   git config --global user.name "Your Name"
   ```

   ```bash
   git config --global user.email "you@example.com"
   ```

3. **Sign in to Claude Code** (optional, for AI): run `claude` once in a terminal and sign in with your Claude account, then close it. AI work counts against your own Claude subscription.

## 2. Get the code (once)

Go to the folder where you keep projects (not inside another git project), then clone:

```bash
git clone https://github.com/phuocbalo/mokio-clone.git
```

```bash
cd mokio-clone
```

```bash
npm install
```

The first time you push, Git opens a browser window to sign in to GitHub. Let it save the login. (If you prefer SSH, clone `git@github.com:phuocbalo/mokio-clone.git` instead.)

## 3. Run it

```bash
npm run dev
```

Open http://localhost:5173 and sign in with a demo account. Every account uses the password `mokio-demo`:

| Email | Role |
|-------|------|
| linh@mokio.test | Owner |
| minh@mokio.test | Designer |
| hoa@mokio.test | Reviewer |
| khoa@mokio.test | Developer |

Keep the terminal open while you work; `Ctrl+C` stops it. Code changes reload in the browser by themselves.

With the server running, the hosted site https://phuocbalo.github.io/mokio-clone/ also uses it (reload the page; allow local network access if Chrome asks).

**Check AI is on:** open **Settings** in the app. It should say *AI: On*. If not, it says what is missing (Claude Code not installed, or not signed in).

## 4. Get the latest changes (every time you start work)

```bash
git switch main
```

```bash
git pull
```

```bash
npm install
```

Run `npm install` after every pull. It does nothing if nothing changed, and fixes "module not found" errors when someone added a package.

## 5. Make and share a change

`main` is the live branch: **every push to `main` redeploys the public site.** Work on your own branch and open a pull request.

1. Start a branch from up-to-date `main` (name it after the change):

   ```bash
   git switch -c fix-review-layout
   ```

2. Make your changes, then check them:

   ```bash
   npm run typecheck
   ```

   ```bash
   npm run build
   ```

3. Commit:

   ```bash
   git add -A
   ```

   ```bash
   git commit -m "Fix the review page at narrow widths"
   ```

4. Push the branch (the first push of a branch needs `-u origin <branch>`):

   ```bash
   git push -u origin fix-review-layout
   ```

5. Open the link Git prints, or go to https://github.com/phuocbalo/mokio-clone/pulls, and click **New pull request**. Ask someone to review it. After it is merged, go back to step 4.

If `main` moved on while you worked, bring it into your branch:

```bash
git pull origin main
```

If Git reports a conflict, open the files it lists, keep the right parts between the `<<<<<<<` and `>>>>>>>` markers, delete the markers, then `git add -A` and `git commit`.

## 6. Where things are

| Path | What |
|------|------|
| `client/src/pages/` | One file per page: sign-in, prototypes, review, options, spec, briefs, history, library, settings |
| `client/src/components/` | Top bar, sidebar, command palette, screen preview, buttons and menus |
| `client/src/lib/` | Data types, sample data (`seed.js`), state and actions, theme colours |
| `client/src/styles/` | `mokio.css` (base styles) and `extra.css` (additions) |
| `server/` | API: accounts (`db.ts`), Claude Code runner (`claude.ts`), AI prompts (`ai.ts`) |
| `.github/workflows/pages.yml` | Builds and publishes the site to GitHub Pages |

The [README](README.md) explains roles, where data is kept and how AI works.

## 7. Never commit these

Already ignored by `.gitignore`, but check `git status` before committing:

- `data/`: your local accounts database
- `node_modules/` and `dist/`
- `.env` or any password, API key or token

## 8. When something goes wrong

| Problem | Fix |
|---------|-----|
| `Port 5173 is in use` or `EADDRINUSE :8787` | Mokio is already running in another terminal. Use that one, or stop it with `Ctrl+C`. |
| The page says "Loading…" for a long time, or sign-in fails | The server is not running. Start `npm run dev` and reload. |
| "AI is off" | Open Settings and follow what it says. Run `claude` to sign in, then **Check again**. |
| A demo password stopped working | Your local accounts live in `data/mokio.db`. Stop the server, delete the `data` folder, start again: the demo team is recreated. |
| The sample prototypes look wrong | In the app, top bar → display settings (sliders icon) → **Reset sample data**. |
| `Cannot find module …` after a pull | Run `npm install`. |
| `git push` is rejected (`fetch first`) | Run `git pull`, fix any conflicts, then push again. |
| `Permission denied` / `403` on push | Accept the collaborator invite, then push again so Git asks you to sign in. |
| Warnings about `LF will be replaced by CRLF` | Harmless on Windows. |
