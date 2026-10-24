# TDL

A highly interactive, 3D-animated notes & todo list application with a clean **frontend + backend** architecture, Supabase authentication, and per-user data.

![TDL preview](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite)
![Tailwind](https://img.shields.io/badge/TailwindCSS-3-06B6D4?style=for-the-badge&logo=tailwindcss)
![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?style=for-the-badge&logo=supabase)
![Zustand](https://img.shields.io/badge/Zustand-4-FFCC00?style=for-the-badge)

---

## Folder Structure

```
nova-notes/
├── README.md
├── .env.example
├── supabase/
│   ├── config.toml               # Supabase CLI local-development config
│   └── schema.sql                # Tables, indexes, RLS policies
├── backend/                      # Express API + Supabase
│   ├── package.json
│   ├── server.js                 # Entry point (checks Supabase, runs on :5001)
│   ├── app.js                    # Express wiring + routes (storage-agnostic)
│   ├── .env.example
│   ├── lib/
│   │   ├── supabase.js           # Anon client + per-user client + health probe
│   │   ├── auth.js               # Bearer token verification middleware
│   │   ├── sanitize.js           # Input clamping/coercion
│   │   ├── dto.js                # Postgres rows → camelCase API types
│   │   └── errors.js             # Postgres/Express error → status mapping
│   ├── repositories/
│   │   ├── notes.repo.js         # Supabase queries scoped to one user
│   │   ├── todos.repo.js
│   │   └── index.js
│   ├── test/                     # node:test suites (in-memory repos)
│   └── test-utils/memory-repos.js
└── frontend/                     # React + Vite SPA (runs on :5173)
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    ├── .env.example
    └── src/
        ├── main.jsx
        ├── App.jsx                # Auth gate + app shell
        ├── index.css
        ├── api/index.js           # Fetch wrapper with the access token
        ├── lib/supabase.js        # Browser auth client
        ├── store/useStore.js      # Zustand state, auth, API sync
        ├── components/            # AmbientBackground, AuthScreen, CommandPalette,
        │                          # ExportDialog, Header, InsightsPanel, NoteEditor,
        │                          # QuickCapture, ReminderCenter, Sidebar, ...
        ├── lib/format.js
        └── views/                 # AnalyticsView, NotesView, TodosView
```

---

## Quick Start

### Prerequisites
- Node.js 22+
- npm
- A free [Supabase](https://supabase.com/) project

### 1. Create the database

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste and run [`supabase/schema.sql`](supabase/schema.sql).
   This creates `notes` and `todos`, enables Row Level Security, and adds owner-only policies.
3. Open **Authentication → Providers → Email** and make sure Email is enabled.
   - For local development, you can turn **Confirm email** off so signup logs you in immediately.
   - If you leave confirmation on, set **Authentication → URL Configuration → Site URL** to
     `http://localhost:5173` and click the link in the confirmation email before signing in.
   - For a deployed app, set the **Site URL** to your frontend origin (for example,
     `https://your-app.vercel.app`) so confirmation links return to the right place.
4. Copy the **Project URL** and **anon public key** from **Project Settings → API**.

> The anon key is meant to be public. It only works with the policies in `schema.sql`.
> The service-role key is **not** used anywhere in this app.

### 2. Start the backend

```bash
cd backend
npm install
cp .env.example .env     # PowerShell: Copy-Item .env.example .env
npm start                # http://localhost:5001
```

`backend/.env`:

```ini
PORT=5001
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR-ANON-KEY

# Optional: enables the AI planner, note help, and summaries.
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

The server refuses to start if Supabase is unreachable or the schema has not been applied, so a
misconfigured connection fails loudly instead of serving empty data.

### 3. Start the frontend (new terminal)

```bash
cd frontend
npm install
cp .env.example .env     # then add the same URL + anon key
npm run dev              # http://localhost:5173
```

`frontend/.env`:

```ini
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

The frontend proxies `/api` requests to `http://localhost:5001` via Vite. Create an account, confirm
your email if required, and sign in.

### 4. Local Supabase (optional)

If you have Docker and the Supabase CLI, you can run the whole stack locally instead of using a hosted
project:

```bash
npx supabase start
```

`supabase start` prints the local API URL and keys. Put the publishable/anon key in both `.env` files
(never the service-role/secret key). You can run `npx supabase status` at any time to print them again.
Local email confirmations are off, so signup logs you in immediately.

Apply [`supabase/schema.sql`](supabase/schema.sql) to the local database:

```bash
# macOS / Linux / Git Bash
docker exec -i supabase_db_nova-notes psql -U postgres -d postgres < supabase/schema.sql

# PowerShell
Get-Content -Raw supabase/schema.sql | docker exec -i supabase_db_nova-notes psql -U postgres -d postgres
```

Stop the stack with `npx supabase stop`; add `--no-backup` to discard local data. The local config
sets the auth site URL to `http://localhost:5173`.

### 5. Production build

```bash
# terminal 1
cd backend
npm start

# terminal 2
cd frontend
npm run build            # outputs to frontend/dist/
npm run preview          # serve the build; /api is proxied to :5001
```

### 6. API tests

```bash
cd backend
npm test
```

The suite uses an in-memory repository implementation, so it needs no Supabase project and never
touches your real data. It guards the API contract, validation, ordering, and error paths.

---

## Authentication & data isolation

- Signup and login use **Supabase Auth** (email + password) in the browser.
- The browser stores the session, refreshes it automatically, and attaches
  `Authorization: Bearer <access_token>` to every `/api` request.
- Express verifies the token with Supabase, then creates a **user-scoped Supabase client** for that
  request. Repositories run as the user, so Postgres Row Level Security applies.
- Every query also filters on `user_id` as defence in depth.
- Signing out clears the local workspace. Another account never sees the first account's notes or
  tasks, even in the same browser.
- `/api/health` and `/api/ai/status` are public. Everything else returns `401` without a valid token.

The AI endpoints are protected too, so visitors cannot spend your Gemini quota without an account.

---

## Features

| Category | Features |
|---|---|
| **Auth** | Email/password signup + login, session persistence and refresh, email confirmation support, sign-out, per-user private workspace |
| **Notes** | Create, edit, pin, archive, delete, tag, search (title/content/tags), debounced autosave with save status, AI improve + summarize per note |
| **Todos** | Card-based task board with due dates **and times**, priority sorting (or manual order / due-date order), recurring tasks (daily or weekly), drag onto completed/carried-over boxes, inline carry action, clear completed |
| **Reminders** | In-app toasts plus browser/mobile notifications from 10 minutes before a task's due time, with a per-browser permission control in the header |
| **AI (Gemini)** | Planner that turns a topic, pasted text, or PDF into notes + tasks automatically; student-friendly note rewriting; per-note summaries; a "Study brief" that summarizes every note on the Notes tab |
| **Design** | Editorial paper/ink theme, Newsreader + Inter + JetBrains Mono, single brand palette, semantic CSS-variable tokens, reduced-motion support |
| **UI / 3D** | Clean note cards with a subtle hover lift, liquid completion bag, lazy-loaded ambient Three.js starfield, Framer Motion with global reduced-motion policy |
| **Interactions** | Command palette (`Cmd+K` / `Ctrl+K`), quick capture (`Cmd+J` / `Ctrl+J`), responsive navigation drawer, skip link, focus states |
| **Insights** | Weekly review and focus list computed locally from your data |
| **Analytics** | Completion rate, streak, notes edited this week, seven-day completion chart from real `completedAt` timestamps |
| **Data** | Supabase Postgres, per-user RLS, indexed list/reorder queries, REST API via Express |

### Notifications

Click the bell in the header to allow browser notifications. TDL reminds you from 10 minutes before a
task's due time until shortly after it, once per due moment. In-app toasts appear even when browser
permission is denied.

- Notifications are delivered by the page or the installed app. Keep TDL open (or installed) for
  reminders; there is no push server.
- Service workers and notifications require `https://` or `localhost`.
- On iPhone, add TDL to the Home Screen first — Safari only exposes notifications to installed web
  apps.
- Reminder history is stored per browser in `localStorage`, so refreshing does not re-alert the same
  due moment.

---

## Tech Stack

- **Frontend:** React 18, Vite 5, Tailwind CSS, Framer Motion, Zustand, Lucide React, Three.js
- **Auth + Database:** Supabase Auth and Postgres (Row Level Security)
- **Backend:** Express 4, `@supabase/supabase-js` (anon key + user JWT)
- **AI:** Google Gemini via the Generative Language REST API (server-side key)
- **State:** Zustand with API-synchronized actions

---

## API Reference

Base URL: `http://localhost:5001`

All routes except `/api/health` and `/api/ai/status` require:

```http
Authorization: Bearer <supabase-access-token>
```

### Notes
| Method | Endpoint | Body | Description |
|---|---|---|---|
| `GET` | `/api/notes` | — | List the signed-in user's notes |
| `POST` | `/api/notes` | `{ title, content, tags, pinned, archived }` | Create note |
| `PUT` | `/api/notes/:id` | Partial note fields | Update note |
| `DELETE` | `/api/notes/:id` | — | Delete note |

### Todos
| Method | Endpoint | Body | Description |
|---|---|---|---|
| `GET` | `/api/todos` | — | List the signed-in user's todos |
| `POST` | `/api/todos` | `{ text, priority, dueDate, dueTime, repeat, completed }` | Create todo |
| `PUT` | `/api/todos/:id` | Partial todo fields | Update todo |
| `DELETE` | `/api/todos/:id` | — | Delete todo |
| `PUT` | `/api/todos/reorder` | `{ todos: [...] }` | Bulk reorder (ids or `{ id }` objects) |

`dueTime` is a 24-hour `HH:MM` string or `null`. `repeat` is `none`, `daily`, or `weekly`;
completing a recurring task rolls its due date forward instead of closing it.

### AI (Gemini)
| Method | Endpoint | Body | Description |
|---|---|---|---|
| `GET` | `/api/ai/status` | — | `{ configured, model }`; public, no key required |
| `POST` | `/api/ai/plan` | `{ topic?, file? }` | Generate and save notes + tasks; `file` is `{ name, mimeType, data }` (base64) |
| `POST` | `/api/ai/notes/enhance` | `{ title, content }` | Rewrite a note into structured study notes |
| `POST` | `/api/ai/notes/summarize` | `{ title, content }` or `{ notes: [...] }` | Summarize one note or a collection |

All AI routes return `503` when `GEMINI_API_KEY` is missing, and `401` without a session. Uploads are
handled server-side and forwarded to Gemini; the browser only talks to this API.

### Health
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | `200` when Supabase answers, `503` when it does not |

### Error format

All failures return `{ "error": "..." }` with `400` (validation), `401` (missing/expired session),
`403` (not your record), `404` (missing record), `409` (duplicate id), `503` (database unavailable or
schema not applied) or `500` (unexpected).

---

## Customization

- **Design tokens:** Surfaces, text, borders, and the brand color live as CSS variables in `frontend/src/index.css`; Tailwind maps them in `tailwind.config.js`.
- **Theme:** The app uses a single light theme; the former light/dark switcher has been removed and any stored `nova.theme` preference is cleared on load.
- **Brand color:** A single fixed teal palette. The former accent picker, its command, and its `localStorage` preference (`nova.accent`) have been removed.
- **API base URL:** The client uses the relative `/api` path. Vite proxies it to `http://localhost:5001` in development (`frontend/vite.config.js`); in production, serve `dist/` behind a proxy that forwards `/api` to the backend.
- **Backend port:** `PORT` in `backend/.env`. Supabase keys live in `backend/.env` and `frontend/.env`.

---

## Data model notes

- `notes` and `todos` are Postgres tables in the `public` schema. Both have a text `id` (`n_<uuid>` /
  `t_<uuid>`), `user_id uuid references auth.users(id)`, and `created_at` / `updated_at` timestamps.
- RLS is enabled on both tables with a single owner policy:
  `auth.uid() = user_id` for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
- Postgres rows use snake_case (`due_date`, `completed_at`, `sort_order`). `backend/lib/dto.js` is the
  only mapping layer back to the camelCase API contract (`dueDate`, `completedAt`) with epoch-ms
  timestamps.
- Todo order is an explicit sparse `sort_order`. New todos take `min(sort_order) - 1` (one insert, no
  shifting). Reorder assigns dense positions with one upsert and returns the canonical list so
  racing clients converge.
- `dueDate` stays a string to preserve the API contract (`string | null`). New dates are stored at
  local noon; legacy date-only strings still render on the correct day. `dueTime` is a separate
  `HH:MM` field, and `repeat` holds the recurrence rule. Completing a recurring task advances
  `dueDate` rather than setting `completed`.
- Deleting an auth user cascades to that user's notes, todos, and (because `user_id` is a foreign key)
  leaves no orphaned rows.

### Moving from MongoDB

This version no longer reads MongoDB. Each row must belong to a Supabase auth user, so old MongoDB
documents cannot be copied in without a `user_id`. If you need to keep existing data, export the
collections, add the UUID of the account you signed up with to every record, and insert them into
`notes` / `todos` (the column names are listed in `supabase/schema.sql`). New accounts otherwise
start with an empty workspace.

---

## License

MIT
