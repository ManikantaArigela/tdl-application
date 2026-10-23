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
```

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
| **Notes** | Create, edit, pin, archive, delete, tag, search (title/content/tags), debounced autosave with save status |
| **Todos** | Card-based task board with priority rails, due dates with overdue state, drag onto completed/carried-over boxes, inline carry action, keyboard reorder, clear completed |
| **Design** | Editorial paper/ink theme, Newsreader + Inter + JetBrains Mono, single brand palette, semantic CSS-variable tokens, reduced-motion support |
| **UI / 3D** | Animated note cards (tilt, cursor spotlight, sheen, spring entrance), liquid completion bag, lazy-loaded ambient Three.js starfield, Framer Motion with global reduced-motion policy |
| **Interactions** | Command palette (`Cmd+K` / `Ctrl+K`), quick capture (`Cmd+J` / `Ctrl+J`), appearance menu, responsive navigation drawer, skip link, focus states |
| **Insights** | Weekly review and focus list computed locally from your data — no external AI service is called |
| **Analytics** | Completion rate, streak, notes edited this week, seven-day completion chart from real `completedAt` timestamps |
| **Data** | REST API (Express) + MongoDB via Mongoose — atomic per-document updates, indexed list/reorder queries |

---

## Tech Stack

- **Frontend:** React 18, Vite 5, Tailwind CSS, Framer Motion, Zustand, Lucide React, Three.js
- **Backend:** Express 4, Mongoose 8, MongoDB
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
| `POST` | `/api/todos` | `{ text, priority, dueDate, completed }` | Create todo |
| `PUT` | `/api/todos/:id` | Partial todo fields | Update todo |
| `DELETE` | `/api/todos/:id` | — | Delete todo |
| `PUT` | `/api/todos/reorder` | `{ todos: [...] }` | Bulk reorder (ids or `{ id }` objects) |

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
- `dueDate` is stored as a string to keep the existing API contract (`string | null`). Normalizing it
  to a `Date` is a follow-up if server-side due-date queries are needed.

---

## License

MIT
