# TDL

A highly interactive, 3D-animated notes & todo list application with a clean **frontend + backend** architecture.

![TDL preview](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite)
![Tailwind](https://img.shields.io/badge/TailwindCSS-3-06B6D4?style=for-the-badge&logo=tailwindcss)
![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-8-47A248?style=for-the-badge&logo=mongodb)
![Zustand](https://img.shields.io/badge/Zustand-4-FFCC00?style=for-the-badge)

---

## Folder Structure

```
nova-notes/
├── README.md
├── .env.example
├── backend/                     # Express API + MongoDB
│   ├── package.json
│   ├── server.js                # Entry point (boots DB, runs on :5001)
│   ├── app.js                   # Express wiring + routes (storage-agnostic)
│   ├── db.js                    # Mongoose connection, ping, shutdown
│   ├── .env.example
│   ├── lib/
│   │   ├── sanitize.js          # Input clamping/coercion shared with the importer
│   │   ├── dto.js               # The only place storage types become API types
│   │   └── errors.js            # Mongo/Express error → status mapping
│   ├── models/
│   │   ├── note.js
│   │   └── todo.js
│   ├── repositories/
│   │   ├── notes.repo.js
│   │   ├── todos.repo.js
│   │   └── index.js
│   ├── scripts/
│   │   └── import-json.js       # Legacy JSON → MongoDB importer
│   ├── test/                    # node:test suites
│   └── test-utils/mongo.js      # mongodb-memory-server lifecycle
└── frontend/                    # React + Vite SPA (runs on :5173)
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── api/index.js         # API client (fetch wrapper)
        ├── store/useStore.js    # Zustand state + API sync
        ├── components/          # AmbientBackground, CommandPalette, ExportDialog,
        │                        # Header, InsightsPanel, NoteEditor, QuickCapture,
        │                        # Sidebar, TiltNoteCard, TodoList
        ├── lib/format.js
        └── views/               # AnalyticsView, NotesView, TodosView
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm
- MongoDB 6+ running locally, **or** a MongoDB Atlas connection string

### 1. Start the backend

```bash
cd backend
npm install
cp .env.example .env     # set MONGODB_URI if not using localhost
npm start                # http://localhost:5001
```

`backend/.env`:

```ini
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/nova_notes
GEMINI_API_KEY=            # optional: enables the AI planner, note help, and summaries
GEMINI_MODEL=gemini-2.5-flash
```

`GEMINI_API_KEY` is read only by the backend; it is never sent to the browser. Get a key from
[Google AI Studio](https://aistudio.google.com/apikey). Without it, every AI action returns a clear
"not configured" message and the rest of the app keeps working.

The server refuses to start if MongoDB is unreachable and prints the masked URI, so a misconfigured
connection fails loudly instead of serving empty data.

### 2. Start the frontend (new terminal)

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

The frontend proxies `/api` requests to `http://localhost:5001` automatically via Vite.

### 3. Production build

```bash
cd backend
npm start

cd frontend
npm run build            # outputs to frontend/dist/
npm run preview          # serve production build locally
```

### 4. API tests

```bash
cd backend
npm test
```

The suite boots an in-memory MongoDB (`mongodb-memory-server`), so it never touches your real
database and needs no running server. The first run downloads the mongod binary once.

---

## Migrating legacy JSON data

Older versions stored data in `backend/data/notes.json` and `todos.json`. The importer is
idempotent, validates every record through the same sanitizers as the API, preserves ids and
timestamps, derives todo order from the array position, and backs the files up before writing.

```bash
cd backend
npm run import -- --dry-run     # validate only, no connection required
npm run import                  # upsert into MongoDB
```

Flags: `--data-dir DIR`, `--batch N`, `--verbose`, `--replace --yes` (deletes records absent
from the JSON files; never runs without `--yes`).

---

## Features

| Category | Features |
|---|---|
| **Notes** | Create, edit, pin, archive, delete, tag, search (title/content/tags), debounced autosave with save status, AI improve + summarize per note |
| **Todos** | Card-based task board with due dates **and times**, priority sorting (or manual order / due-date order), recurring tasks (daily or weekly), drag onto completed/carried-over boxes, inline carry action, clear completed |
| **Reminders** | In-app toasts plus browser/mobile notifications from 10 minutes before a task's due time, with a per-browser permission control in the header |
| **AI (Gemini)** | Planner that turns a topic, pasted text, or PDF into notes + tasks automatically; student-friendly note rewriting; per-note summaries; a "Study brief" that summarizes every note on the Notes tab |
| **Design** | Editorial paper/ink theme, Newsreader + Inter + JetBrains Mono, single brand palette, semantic CSS-variable tokens, reduced-motion support |
| **UI / 3D** | Clean note cards with a subtle hover lift, liquid completion bag, lazy-loaded ambient Three.js starfield, Framer Motion with global reduced-motion policy |
| **Interactions** | Command palette (`Cmd+K` / `Ctrl+K`), quick capture (`Cmd+J` / `Ctrl+J`), responsive navigation drawer, skip link, focus states |
| **Insights** | Weekly review and focus list computed locally from your data |
| **Analytics** | Completion rate, streak, notes edited this week, seven-day completion chart from real `completedAt` timestamps |
| **Data** | REST API (Express) + MongoDB via Mongoose — atomic per-document updates, indexed list/reorder queries |

### Notifications

Click the bell in the header to allow browser notifications. TDL reminds you from 10 minutes before a
task's due time until shortly after it, once per due moment. In-app toasts appear even when browser
permission is denied.

- Notifications are delivered by the page or the installed app. Keep TDL open (or installed) for
  reminders; there is no push server.
- Service workers and notifications require `https://` or `localhost`.
- On iPhone, add TDL to the Home Screen first — Safari only exposes notifications to installed web
  apps.

---

## Tech Stack

- **Frontend:** React 18, Vite 5, Tailwind CSS, Framer Motion, Zustand, Lucide React, Three.js
- **Backend:** Express 4, Mongoose 8, MongoDB
- **AI:** Google Gemini via the Generative Language REST API (server-side key)
- **State:** Zustand with API-synchronized actions

---

## API Reference

Base URL: `http://localhost:5001`

### Notes
| Method | Endpoint | Body | Description |
|---|---|---|---|
| `GET` | `/api/notes` | — | List all notes |
| `POST` | `/api/notes` | `{ title, content, tags, pinned, archived }` | Create note |
| `PUT` | `/api/notes/:id` | Partial note fields | Update note |
| `DELETE` | `/api/notes/:id` | — | Delete note |

### Todos
| Method | Endpoint | Body | Description |
|---|---|---|---|
| `GET` | `/api/todos` | — | List all todos |
| `POST` | `/api/todos` | `{ text, priority, dueDate, dueTime, repeat, completed }` | Create todo |
| `PUT` | `/api/todos/:id` | Partial todo fields | Update todo |
| `DELETE` | `/api/todos/:id` | — | Delete todo |
| `PUT` | `/api/todos/reorder` | `{ todos: [...] }` | Bulk reorder (ids or `{ id }` objects) |

`dueTime` is a 24-hour `HH:MM` string or `null`. `repeat` is `none`, `daily`, or `weekly`;
completing a recurring task rolls its due date forward instead of closing it.

### AI (Gemini)
| Method | Endpoint | Body | Description |
|---|---|---|---|
| `GET` | `/api/ai/status` | — | `{ configured, model }`; no key required |
| `POST` | `/api/ai/plan` | `{ topic?, file? }` | Generate and save notes + tasks; `file` is `{ name, mimeType, data }` (base64) |
| `POST` | `/api/ai/notes/enhance` | `{ title, content }` | Rewrite a note into structured study notes |
| `POST` | `/api/ai/notes/summarize` | `{ title, content }` or `{ notes: [...] }` | Summarize one note or a collection |

All AI routes return `503` when `GEMINI_API_KEY` is missing. Uploads are handled server-side and
forwarded to Gemini; the browser only talks to this API.

> **Deployment note:** the API has no authentication. If you expose TDL publicly, put it behind auth
> or a reverse proxy that protects `/api/ai/*`, otherwise visitors can spend your Gemini quota.

### Health
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | `200` when MongoDB answers a ping, `503` when it does not |

### Error format

All failures return `{ "error": "..." }` with `400` (validation), `404` (missing record),
`409` (duplicate id), `503` (database unavailable) or `500` (unexpected).

---

## Customization

- **Design tokens:** Surfaces, text, borders, and the brand color live as CSS variables in `frontend/src/index.css`; Tailwind maps them in `tailwind.config.js`.
- **Theme:** The app uses a single light theme; the former light/dark switcher has been removed and any stored `nova.theme` preference is cleared on load.
- **Brand color:** A single fixed teal palette. The former accent picker, its command, and its `localStorage` preference (`nova.accent`) have been removed.
- **API base URL:** The client uses the relative `/api` path. Vite proxies it to `http://localhost:5001` in development (`frontend/vite.config.js`); in production, serve `dist/` behind a proxy that forwards `/api` to the backend.
- **Backend port and database:** Set `PORT` and `MONGODB_URI` in `backend/.env`.

---

## Data model notes

- `_id` is the same string id the API exposes (`n_<uuid>` / `t_<uuid>`), so ids are stable across the
  JSON → MongoDB move and imports are pure upserts.
- Timestamps are stored as `Date` and serialized back to epoch milliseconds in `lib/dto.js`, which is
  the only mapping layer. Mongoose documents are never sent to clients.
- Todo order is an explicit sparse `order` field. New todos take `min(order) - 1` (one insert, no
  shifting), and reorder assigns dense positions with a single `bulkWrite`. Reorder is not a
  cross-document transaction; on a replica set the server could wrap it, and clients always receive
  the canonical list afterwards so they converge.
- `dueDate` is stored as a string to keep the existing API contract (`string | null`). New dates are
  stored at local noon; legacy date-only strings still render on the correct day. `dueTime` is a
  separate `HH:MM` field so a task can have a date without a time, and `repeat` holds the recurrence
  rule. Completing a recurring task advances `dueDate` rather than setting `completed`.

---

## License

MIT
