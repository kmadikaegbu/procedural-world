# Installing React

A beginner-friendly guide to setting up a React project on your computer.

---

## 1. What You Need First

React runs on **Node.js**. You need Node (which includes `npm`) installed before anything else.

### Install Node.js

- **Recommended:** download the **LTS** version from [nodejs.org](https://nodejs.org).
- **macOS (Homebrew):** `brew install node`
- **Windows:** use the installer from nodejs.org, or `winget install OpenJS.NodeJS.LTS`
- **Version manager (best for the long run):** [nvm](https://github.com/nvm-sh/nvm)
  ```bash
  nvm install --lts
  nvm use --lts
  ```

Check it worked:

```bash
node --version    # should print v20.x or newer
npm --version
```

> You want Node **18 or newer** for modern React tooling. 20+ is ideal.

---

## 2. The Recommended Way: Vite

The React team no longer recommends **Create React App**. For a plain single-page app, use **Vite** — it's fast, small, and current.

### Create the project

```bash
npm create vite@latest my-app
```

You'll be asked a few questions:

- **Select a framework:** `React`
- **Select a variant:** `JavaScript` (or `TypeScript` if your class uses it)

Then:

```bash
cd my-app
npm install       # download React and all dependencies
npm run dev       # start the development server
```

Open the URL it prints (usually `http://localhost:5173`). Edit `src/App.jsx` and the page updates instantly.

### One-liner (skip the prompts)

```bash
npm create vite@latest my-app -- --template react
cd my-app && npm install && npm run dev
```

---

## 3. Project Structure

```
my-app/
├── node_modules/      # installed dependencies (never edit, never commit)
├── public/            # static files served as-is
├── src/
│   ├── App.jsx        # your main component
│   ├── main.jsx       # entry point — mounts React into the page
│   └── index.css      # styles
├── index.html         # the single HTML page
├── package.json       # project info + dependencies + scripts
└── vite.config.js     # Vite configuration
```

### Common scripts (`package.json`)

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the local dev server with hot reload |
| `npm run build` | Create an optimized production build in `dist/` |
| `npm run preview` | Serve the production build locally to test it |

---

## 4. Adding React to an Existing Project

If you already have a project and just want the packages:

```bash
npm install react react-dom
```

For JSX support you'll also need a build tool (Vite, or a bundler with a React plugin). Plain `npm install react` alone won't make `.jsx` files work without one.

---

## 5. Alternative: A Full Framework (Next.js)

If you need routing, server rendering, or a backend, the React team recommends a framework like **Next.js**:

```bash
npx create-next-app@latest my-app
cd my-app
npm run dev
```

Choose Vite for a simple client-side app; choose Next.js for a full website/app.

---

## 6. Alternative: No Install (for quick experiments)

To try React without installing anything, add these scripts to an HTML file:

```html
<script src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
```

Good for a 5-minute demo; not for real projects.

---

## 7. Verify Your Install

```bash
cd my-app
npm run dev
```

You should see the Vite + React starter page. Then:

1. Open `src/App.jsx`.
2. Change the heading text.
3. Save — the browser updates without a refresh.

If that works, React is installed correctly.

---

## 8. .gitignore

Vite creates a `.gitignore` for you. Make sure it includes:

```gitignore
node_modules/
dist/
.env
.DS_Store
```

**Never commit `node_modules/`** — anyone can rebuild it with `npm install`.

---

## 9. Troubleshooting

| Problem | Fix |
|---------|-----|
| `command not found: npm` | Node isn't installed or not on your PATH. Reinstall Node, restart the terminal. |
| `npm create vite` hangs or errors | Update npm: `npm install -g npm@latest` |
| Port 5173 already in use | Stop the other process, or run `npm run dev -- --port 3000` |
| `EACCES` permission errors on npm | Don't use `sudo`. Use a version manager like nvm instead. |
| Weird dependency errors after pulling changes | Delete `node_modules` and `package-lock.json`, then `npm install` |
| Old Node version | `nvm install --lts && nvm use --lts` |

---

## 10. Quick Reference

```bash
# check prerequisites
node --version
npm --version

# new React project (Vite)
npm create vite@latest my-app -- --template react
cd my-app
npm install
npm run dev

# build for production
npm run build
npm run preview

# add React to an existing project
npm install react react-dom
```

---

## Further Reading

- [React official docs — Start a New Project](https://react.dev/learn/start-a-new-react-project)
- [Vite Guide](https://vite.dev/guide/)
- [Next.js docs](https://nextjs.org/docs)
- [Node.js downloads](https://nodejs.org)
