# Nova Notes

A highly interactive, 3D-animated notes & todo list application with a clean **frontend + backend** architecture.

![Nova Notes preview](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite)
![Tailwind](https://img.shields.io/badge/TailwindCSS-3-06B6D4?style=for-the-badge&logo=tailwindcss)
![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express)
![Zustand](https://img.shields.io/badge/Zustand-4-FFCC00?style=for-the-badge)

---

## 📁 Folder Structure

```
nova-notes/
├── README.md
├── .env.example
├── backend/                  # Express API server
│   ├── package.json
│   ├── server.js             # Entry point (runs on :5001)
│   ├── .env.example
│   └── data/                 # JSON file database (notes.json, todos.json)
│       ├── notes.json
│       └── todos.json
└── frontend/                 # React + Vite SPA (runs on :5173)
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── index.css
    │   ├── api/
    │   │   └── index.js          # API client (fetch wrapper)
    │   ├── store/
    │   │   └── useStore.js       # Zustand state + API sync
    │   ├── components/
    │   │   ├── AmbientBackground.jsx   # Lazy-loaded Three.js starfield
    │   │   ├── CommandPalette.jsx      # Cmd+K palette
    │   │   ├── ExportDialog.jsx        # Markdown export
    │   │   ├── Header.jsx              # Search, theme + accent controls
    │   │   ├── InsightsPanel.jsx       # Local weekly review / focus list
    │   │   ├── NoteEditor.jsx
    │   │   ├── QuickCapture.jsx
    │   │   ├── Sidebar.jsx
    │   │   ├── TiltNoteCard.jsx        # 3D mouse-tilt cards
    │   │   └── TodoList.jsx            # Drag + keyboard reorder
    │   ├── lib/
    │   │   └── format.js               # Date, relative time, plurals
    │   └── views/
    │       ├── AnalyticsView.jsx
    │       ├── NotesView.jsx
    │       └── TodosView.jsx
    └── dist/                   # Production build output
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ (the backend uses `--env-file-if-exists`)
- npm

### 1. Start the backend

```bash
cd backend
npm install
cp .env.example .env   # optional, edit PORT if needed
npm start             # http://localhost:5001
```

### 2. Start the frontend (new terminal)

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

The frontend proxies `/api` requests to `http://localhost:5001` automatically via Vite.

### 3. Production build

```bash
# Backend
cd backend
npm start

# Frontend
cd frontend
npm run build          # outputs to frontend/dist/
npm run preview        # serve production build locally
```

### 4. API tests

```bash
cd backend
npm test               # node:test, no extra dependencies
```

The suite runs against a temporary data directory, so it never touches `backend/data`.

---

## ✨ Features

| Category | Features |
|---|---|
| **Notes** | Create, edit, pin, archive, delete, tag, search (title/content/tags), debounced autosave with save status |
| **Todos** | Add, complete, delete, drag-to-reorder, keyboard reorder, priority levels, due dates with overdue state, all/open/done filters, clear completed |
| **Design** | Editorial paper/ink theme, Newsreader + Inter + JetBrains Mono, three accent palettes, semantic CSS-variable tokens, reduced-motion support |
| **UI / 3D** | Optional 3D tilt on note cards (fine pointers only), lazy-loaded ambient Three.js starfield, Framer Motion with global reduced-motion policy |
| **Interactions** | Command palette (`Cmd+K` / `Ctrl+K`), quick capture (`Cmd+J` / `Ctrl+J`), appearance menu, responsive navigation drawer, skip link, focus states |
| **Insights** | Weekly review and focus list computed locally from your data — no external AI service is called |
| **Analytics** | Completion rate, streak, notes edited this week, seven-day completion chart from real `completedAt` timestamps |
| **Data** | REST API (Express) + JSON file database — no external database server required |

---

## 🧠 Tech Stack

- **Frontend:** React 18, Vite 5, Tailwind CSS, Framer Motion, Zustand, Lucide React, Three.js
- **Backend:** Express 4, CORS, Node.js file-system JSON store
- **State:** Zustand with API-synchronized actions

---

## 🔌 API Reference

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
| `PUT` | `/api/todos/reorder` | `{ todos: [...] }` | Bulk reorder todos |

### Health
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server health check |

---

## 🛠 Customization

- **Design tokens:** Light/dark surfaces, text, borders, and accent colors live as CSS variables in `frontend/src/index.css`; Tailwind maps them in `tailwind.config.js`.
- **Accent palettes:** Verdigris (default), Iris, and Ember are selectable from the header appearance menu and persist in `localStorage` (`nova.accent`). Add another palette by defining `[data-accent='your-name']` variables in `index.css`.
- **Theme:** Light/dark is chosen in the appearance menu and persisted under `nova.theme`; the pre-paint script in `index.html` prevents a flash of the wrong theme.
- **API base URL:** The client uses the relative `/api` path. Vite proxies it to `http://localhost:5001` in development (`frontend/vite.config.js`); in production, serve `dist/` behind a proxy that forwards `/api` to the backend.
- **Backend port and data directory:** Set `PORT` and `DATA_DIR` in `backend/.env` (defaults: `5001`, `backend/data`).

---

## 📄 License

MIT

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
