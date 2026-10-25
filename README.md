# TDL

A highly interactive, 3D-animated notes & todo list application with a clean **frontend + backend** architecture, MongoDB persistence, JWT authentication, and per-user data.

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite)
![Tailwind](https://img.shields.io/badge/TailwindCSS-3-06B6D4?style=for-the-badge&logo=tailwindcss)
![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)
![Zustand](https://img.shields.io/badge/Zustand-4-FFCC00?style=for-the-badge)

---

## Folder Structure

```
nova-notes/
├── README.md
├── .env.example                  # Documentation only; the app reads backend/.env
├── backend/                      # Express API + MongoDB
│   ├── package.json
│   ├── server.js                 # Entry point (connects to MongoDB, runs on :5001)
│   ├── app.js                    # Express wiring, auth routes, data + AI routes
│   ├── db.js                     # Mongoose connection, health ping, URI masking
│   ├── .env.example
│   ├── lib/
│   │   ├── auth.js               # bcrypt hashing, JWT signing/verification, middleware
│   │   ├── sanitize.js           # Input clamping/coercion
│   │   ├── dto.js                # MongoDB documents → camelCase API types
│   │   ├── errors.js             # Mongo/Express error → status mapping
│   │   ├── rate-limit.js         # In-memory login/signup throttle
│   │   ├── gemini.js             # Server-side Gemini client
│   │   └── ai.js                 # Prompt builders + model-output normalizers
│   ├── models/
│   │   ├── note.js               # notes collection (per-user indexes)
│   │   ├── todo.js               # todos collection (per-user indexes)
│   │   └── user.js               # accounts collection (email + bcrypt hash)
│   ├── repositories/
│   │   ├── notes.repo.js         # MongoDB queries scoped to one userId
│   │   ├── todos.repo.js
│   │   ├── users.repo.js
│   │   └── index.js
│   ├── scripts/
│   │   └── import-data.js        # JSON (Supabase/legacy) → MongoDB importer
│   └── test/                     # node:test suites (in-memory repos)
└── frontend/                     # React + Vite SPA (runs on :5173)
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx                # Auth gate + app shell
        ├── index.css
        ├── api/index.js           # Fetch wrapper with the JWT
        ├── lib/auth.js            # Token storage + /api/auth client
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
- A MongoDB database — [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier is enough) or a local `mongod`

### 1. Prepare MongoDB

1. Create a cluster and a database user in Atlas.
2. Copy the connection string and add a database name before the query string, for example:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/nova_notes?retryWrites=true&w=majority`
3. For local development, allow your IP in **Network Access** (or `0.0.0.0/0` for a throwaway database).
4. Nothing else is required: the backend creates the `users`, `notes`, and `todos` collections and their indexes on first use. Set `MONGO_AUTO_INDEX=false` if an operator manages indexes separately.

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
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/nova_notes?retryWrites=true&w=majority
JWT_SECRET=replace-with-a-long-random-value
JWT_EXPIRES_IN=30d
AUTH_RATE_LIMIT_MAX=20

# Optional: enables the AI planner, note help, and summaries.
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
```

Generate a JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The server refuses to start when `MONGODB_URI` or `JWT_SECRET` is missing, or when MongoDB cannot be reached. That way a misconfigured deployment fails loudly instead of serving empty data.

### 3. Start the frontend (new terminal)

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

The frontend needs **no environment variables**. It calls the backend through the relative `/api` path (Vite proxies `/api` to `http://localhost:5001`) and stores its JWT in `localStorage`. Create an account and you are signed in immediately — there is no email-confirmation step.

### 4. Production build

```bash
# terminal 1
cd backend
npm start

# terminal 2
cd frontend
npm run build            # outputs to frontend/dist/
npm run preview          # serve the build; /api is proxied to :5001
```

### 5. API tests

```bash
cd backend
npm test
```

The suite uses an in-memory repository implementation, so it needs no MongoDB instance and never touches your real data. It guards the API contract, authentication, validation, ordering, and error paths.

---

## Authentication & data isolation

- Signup and login use email + password against the `users` collection.
- Passwords are hashed with **bcrypt** (cost 12) and the hash is never returned by the API.
- A successful login returns a **signed JWT** (`HS256`, 30 days by default). The browser stores it and attaches `Authorization: Bearer <token>` to every request.
- Express verifies the token, then builds repositories scoped to that account. **Every notes/todos query filters on `userId`**, so one account cannot read or mutate another account's records.
- Tokens are stateless. Signing out clears the browser token; `/api/auth/logout` exists so clients have one explicit endpoint to call.
- When an API request returns `401`, the client clears the stored token and returns to the sign-in screen.
- `/api/auth/signup` and `/api/auth/login` are throttled per IP + email (20 attempts per 15 minutes by default, `AUTH_RATE_LIMIT_MAX`).
- `/api/health` and `/api/ai/status` are public. Everything else returns `401` without a valid token.

### Current auth limitations

- There is no email verification, password reset flow, or refresh-token rotation. `JWT_EXPIRES_IN` controls how long a session lasts.
- Rate limiting is per process. For multiple backend instances, put a shared limiter (Redis or an API gateway) in front of `/api/auth`.
- Rotating `JWT_SECRET` signs every user out.

The AI endpoints are protected too, so visitors cannot spend your Gemini quota without an account.

---

## Features

| Category | Features |
|---|---|
| **Auth** | Email/password signup + login, bcrypt hashing, 30-day JWT sessions, session restore on reload, sign-out, per-user private workspace |
| **Notes** | Create, edit, pin, archive, delete, tag, search (title/content/tags), debounced autosave with save status, AI improve + summarize per note |
| **Todos** | Card-based task board with due dates **and times**, priority sorting (or manual order / due-date order), recurring tasks (daily or weekly), drag onto completed/carried-over boxes, inline carry action, clear completed |
| **Reminders** | In-app toasts plus browser/mobile notifications from 10 minutes before a task's due time, with a per-browser permission control in the header |
| **AI (Gemini)** | Planner that turns a topic, pasted text, or PDF into notes + tasks automatically; student-friendly note rewriting; per-note summaries; a "Study brief" that summarizes every note on the Notes tab |
| **Design** | Editorial paper/ink theme, Newsreader + Inter + JetBrains Mono, single brand palette, semantic CSS-variable tokens, reduced-motion support |
| **UI / 3D** | Clean note cards with a subtle hover lift, liquid completion bag, lazy-loaded ambient Three.js starfield, Framer Motion with global reduced-motion policy |
| **Interactions** | Command palette (`Cmd+K` / `Ctrl+K`), quick capture (`Cmd+J` / `Ctrl+J`), responsive navigation drawer, skip link, focus states |
| **Insights** | Weekly review and focus list computed locally from your data |
| **Analytics** | Completion rate, streak, notes edited this week, seven-day completion chart from real `completedAt` timestamps |
| **Data** | MongoDB with per-user indexes, account-scoped queries, REST API via Express |

### Notifications

Click the bell in the header to allow browser notifications. TDL reminds you from 10 minutes before a task's due time until shortly after it, once per due moment. In-app toasts appear even when browser permission is denied.

- Notifications are delivered by the page or the installed app. Keep TDL open (or installed) for reminders; there is no push server.
- Service workers and notifications require `https://` or `localhost`.
- On iPhone, add TDL to the Home Screen first — Safari only exposes notifications to installed web apps.
- Reminder history is stored per browser in `localStorage`, so refreshing does not re-alert the same due moment.

---

## Tech Stack

- **Frontend:** React 18, Vite 5, Tailwind CSS, Framer Motion, Zustand, Lucide React, Three.js
- **Backend:** Express 4, Mongoose 8, bcryptjs, jsonwebtoken
- **Database:** MongoDB (Atlas or self-hosted)
- **Auth:** Email + password with bcrypt hashes and signed JWTs
- **AI:** Google Gemini via the Generative Language REST API (server-side key)
- **State:** Zustand with API-synchronized actions

---

## API Reference

Base URL: `http://localhost:5001`

All routes except `/api/health`, `/api/ai/status`, and the auth endpoints require:

```http
Authorization: Bearer <jwt>
```

### Auth
| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/api/auth/signup` | `{ email, password }` | Create an account; returns `{ token, user }` |
| `POST` | `/api/auth/login` | `{ email, password }` | Sign in; returns `{ token, user }` |
| `GET` | `/api/auth/me` | — | Return the signed-in `{ user }` |
| `POST` | `/api/auth/logout` | — | Always `{ success: true }`; the client discards its token |

Passwords must be 8–200 characters. Emails are normalized to lowercase.

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

`dueTime` is a 24-hour `HH:MM` string or `null`. `repeat` is `none`, `daily`, or `weekly`; completing a recurring task rolls its due date forward instead of closing it.

### AI (Gemini)
| Method | Endpoint | Body | Description |
|---|---|---|---|
| `GET` | `/api/ai/status` | — | `{ configured, model }`; public, no key required |
| `POST` | `/api/ai/plan` | `{ topic?, file? }` | Generate and save notes + tasks; `file` is `{ name, mimeType, data }` (base64) |
| `POST` | `/api/ai/notes/enhance` | `{ title, content }` | Rewrite a note into structured study notes |
| `POST` | `/api/ai/notes/summarize` | `{ title, content }` or `{ notes: [...] }` | Summarize one note or a collection |

All AI routes return `503` when `GEMINI_API_KEY` is missing, and `401` without a session. Uploads are handled server-side and forwarded to Gemini; the browser only talks to this API.

### Health
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | `200` when MongoDB answers, `503` when it does not |

### Error format

All failures return `{ "error": "..." }` with `400` (validation), `401` (missing/expired session or bad credentials), `409` (duplicate email/id), `429` (too many auth attempts), `503` (database unavailable or auth not configured) or `500` (unexpected).

---

## Customization

- **Design tokens:** Surfaces, text, borders, and the brand color live as CSS variables in `frontend/src/index.css`; Tailwind maps them in `tailwind.config.js`.
- **Theme:** The app uses a single light theme; the former light/dark switcher has been removed and any stored `nova.theme` preference is cleared on load.
- **Brand color:** A single fixed teal palette. The former accent picker, its command, and its `localStorage` preference (`nova.accent`) have been removed.
- **API base URL:** The client uses the relative `/api` path. Vite proxies it to `http://localhost:5001` in development (`frontend/vite.config.js`); in production, serve `dist/` behind a proxy that forwards `/api` to the backend.
- **Backend port:** `PORT` in `backend/.env`.
- **Session lifetime:** `JWT_EXPIRES_IN` in `backend/.env` (for example `12h`, `7d`, `30d`).
- **Database:** `MONGODB_URI` in `backend/.env`. Use a dedicated database name (for example `nova_notes`).

---

## Data model

### `users`
- `_id`: ObjectId
- `email`: unique, lowercase
- `passwordHash`: bcrypt hash (`select: false`, never serialized)
- `createdAt`, `updatedAt`

### `notes`
- `_id`: text id (`n_<uuid>`), the same id the API exposes
- `userId`: owner account id
- `title`, `content`, `tags[]`, `pinned`, `archived`
- `createdAt`, `updatedAt` (Date)
- Indexes: `{ userId, createdAt }`, `{ userId, archived, updatedAt }`, `{ userId, tags }`

### `todos`
- `_id`: text id (`t_<uuid>`)
- `userId`: owner account id
- `text`, `priority`, `completed`, `dueDate` (string), `dueTime` (`HH:MM`), `repeat`
- `completedAt` (Date | null), `createdAt` (Date), `sortOrder` (number)
- Indexes: `{ userId, sortOrder, createdAt }`, `{ userId, completed, sortOrder }`, `{ userId, dueDate }`

`backend/lib/dto.js` is the only mapping layer between storage and the camelCase API contract with epoch-millisecond timestamps. New todos take `min(sortOrder) - 1`, so creating a task is one read plus one insert without shifting every document. Reorder assigns dense positions with one `bulkWrite` and returns the canonical list so racing clients converge.

---

## Migrating existing Supabase data

The app no longer talks to Supabase at runtime. Passwords cannot be exported from Supabase Auth (hashes are not portable to bcrypt), so **each user must sign up again in MongoDB**. Their notes and todos can then be imported:

1. In the Supabase SQL Editor, export one user's rows as a JSON array (replace the UUID from **Authentication → Users**):

   ```sql
   select json_agg(n) from public.notes n where n.user_id = '<SUPABASE-USER-UUID>';
   select json_agg(t) from public.todos t where t.user_id = '<SUPABASE-USER-UUID>';
   ```

   Save the two JSON values as `notes.json` and `todos.json`.

2. Start the app and create the destination account with the same email.

3. Run the importer from `backend/`:

   ```bash
   npm run import -- --email you@example.com --notes ../notes.json --todos ../todos.json

   # Validate first without writing:
   npm run import -- --email you@example.com --notes ../notes.json --todos ../todos.json --dry-run
   ```

The importer accepts Supabase snake_case (`due_date`, `created_at`) and camelCase records, upserts by the original id (so it is safe to re-run), and scopes every document to the destination account. `--replace --yes` additionally deletes that account's documents that are absent from the files.

Legacy `backend/data/notes.json` and `todos.json` exports can be imported with the same command.

---

## License

MIT
