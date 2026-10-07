# Git & GitHub Tutorial

A beginner-friendly guide to version control with Git and collaboration with GitHub.

---

## 1. What are Git and GitHub?

- **Git** is a *version control system*. It runs on your computer and records snapshots ("commits") of your project over time, so you can see history, undo mistakes, and work on features in parallel.
- **GitHub** is a *website* that hosts Git repositories online. It adds collaboration features: sharing code, pull requests, issues, reviews, and backups.

> Analogy: Git is the "save game" system. GitHub is the cloud where you upload your save files so others can play too.

---

## 2. One-Time Setup

### Install Git

- **macOS:** `brew install git` (or run `git --version` and macOS will prompt to install)
- **Windows:** download from [git-scm.com](https://git-scm.com)
- **Linux:** `sudo apt install git`

Check it worked:

```bash
git --version
```

### Tell Git who you are

Every commit is stamped with a name and email. Set them once:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Set a default branch name and editor (optional but recommended):

```bash
git config --global init.defaultBranch main
git config --global core.editor "code --wait"   # use VS Code for messages
```

### Connect to GitHub

1. Create a free account at [github.com](https://github.com).
2. Authenticate. The easiest way is the **GitHub CLI**:

```bash
brew install gh      # macOS
gh auth login        # follow the prompts, choose HTTPS
```

This stores credentials so you won't be asked for a password on every push.

---

## 3. Core Mental Model

A file in a Git project moves through **three areas**:

```
Working Directory  --->  Staging Area  --->  Repository (history)
   (your edits)          (git add)          (git commit)
```

| Area | What it is | Command to move forward |
|------|-----------|-------------------------|
| Working directory | The actual files you edit | `git add` |
| Staging area (index) | A draft of your next commit | `git commit` |
| Repository | Permanent snapshots + history | `git push` (to GitHub) |

---

## 4. Starting a Repository

### Option A — Start locally

```bash
mkdir my-project
cd my-project
git init                # create an empty repo (.git folder)
```

### Option B — Clone an existing repo from GitHub

```bash
git clone https://github.com/username/repo-name.git
cd repo-name
```

---

## 5. The Everyday Workflow

This is the loop you'll repeat hundreds of times.

```bash
git status                 # what has changed?
git add file.md            # stage one file
git add .                   # stage everything changed
git commit -m "Describe what you did"
git push                    # send commits to GitHub
```

### Checking what's going on

```bash
git status                 # current state of working dir + staging
git diff                   # unstaged changes, line by line
git diff --staged          # changes that are staged
git log --oneline --graph  # commit history, compact
```

### Writing good commit messages

- Use the imperative mood: "Add login form", not "Added" or "Adds".
- Keep the first line under ~50 characters.
- Add a blank line + details below if needed.

```
Add student grade calculator

Handles weighted averages and drops the lowest quiz score.
```

---

## 6. Branching and Merging

Branches let you work on something without disturbing `main`.

```bash
git branch                     # list branches
git switch -c feature-x        # create and switch to a new branch
                               # (older syntax: git checkout -b feature-x)
# ...make commits...
git switch main                # go back to main
git merge feature-x            # bring feature-x changes into main
git branch -d feature-x        # delete the branch when done
```

### Merge conflicts

A conflict happens when two branches changed the same lines. Git marks the file:

```
<<<<<<< HEAD
text from your current branch
=======
text from the branch you're merging
>>>>>>> feature-x
```

To resolve:
1. Open the file, pick the correct final text, delete the `<<<`, `===`, `>>>` markers.
2. `git add the-file`
3. `git commit` (finishes the merge)

---

## 7. Connecting Local to GitHub

### Push a brand-new local repo to GitHub

Create an empty repo on GitHub first (no README), then:

```bash
git remote add origin https://github.com/username/repo-name.git
git branch -M main
git push -u origin main       # -u links your branch to origin/main
```

After the first `-u` push, you can just run `git push` and `git pull`.

Or let the CLI do all of it:

```bash
gh repo create my-project --public --source=. --push
```

### Keeping in sync

```bash
git pull      # fetch changes from GitHub and merge them into your branch
git fetch     # download changes but don't merge yet
```

Always `git pull` before you start working if others share the repo.

---

## 8. Pull Requests (the heart of GitHub collaboration)

A **Pull Request (PR)** proposes merging one branch into another, with room for discussion and review.

Typical flow:

```bash
git switch -c fix-typo
# edit files
git add .
git commit -m "Fix typo in README"
git push -u origin fix-typo
```

Then on GitHub: click **Compare & pull request**, write a description, and create it. Or with the CLI:

```bash
gh pr create --fill
gh pr view --web
```

Reviewers comment, you push more commits to the same branch (they appear automatically), and once approved someone clicks **Merge**.

---

## 9. .gitignore

Some files should never be committed (secrets, build output, OS junk). List patterns in a file named `.gitignore` at the repo root:

```gitignore
# dependencies
node_modules/

# secrets / environment
.env

# OS files
.DS_Store
Thumbs.db

# editor
.vscode/
.obsidian/workspace.json
```

GitHub offers ready-made templates when you create a repo, or see [github.com/github/gitignore](https://github.com/github/gitignore).

---

## 10. Undoing Things

| Goal | Command |
|------|---------|
| Discard unstaged changes to a file | `git restore file.md` |
| Unstage a file (keep the edits) | `git restore --staged file.md` |
| Fix the last commit message | `git commit --amend` |
| Undo last commit, keep changes staged | `git reset --soft HEAD~1` |
| Undo last commit, keep changes unstaged | `git reset HEAD~1` |
| Undo a commit safely on a shared branch | `git revert <commit-hash>` |
| See a lost commit / recover it | `git reflog` |

> Rule of thumb: `reset` rewrites history (fine on your own local branch), `revert` adds a new "undo" commit (safe for shared branches).

---

## 11. Quick Reference

```bash
# setup
git config --global user.name "Name"
git config --global user.email "email"

# start
git init
git clone <url>

# daily
git status
git add <file> | git add .
git commit -m "message"
git push
git pull

# branches
git switch -c <branch>
git switch <branch>
git merge <branch>
git branch -d <branch>

# inspect
git log --oneline --graph --all
git diff
git show <commit>

# remotes
git remote -v
git remote add origin <url>
git push -u origin main
```

---

## 12. Common Beginner Mistakes

- **Committing secrets** (`.env`, API keys). Add them to `.gitignore` *before* the first commit.
- **Huge commits** that mix ten unrelated changes. Commit small and often.
- **Working directly on `main`** for everything. Use branches for features/fixes.
- **Forgetting to pull** before starting, then hitting conflicts.
- **`git add .` blindly** — run `git status` first to see what you're staging.
- **Panicking after a bad command** — `git reflog` almost always lets you recover.

---

## 13. Practice Exercise

1. Create a folder `git-practice`, run `git init`.
2. Add a `README.md` with a title line. Commit it.
3. Create a branch `about`, add an `about.md`, commit, switch back to `main`, merge.
4. Create a repo on GitHub and push.
5. On GitHub's website, edit `README.md` directly and commit. Then `git pull` locally and confirm the change arrived.
6. Make conflicting edits to the same line locally and on GitHub, pull, and resolve the conflict.

---

## Further Reading

- [Pro Git book (free)](https://git-scm.com/book) — the definitive reference
- [GitHub Docs](https://docs.github.com/get-started)
- [Oh Sh*t, Git!?!](https://ohshitgit.com) — how to fix common mistakes
- [Learn Git Branching](https://learngitbranching.js.org) — interactive visual practice
