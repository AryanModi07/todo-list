# Todo List (Flask + animated glass UI)

A todo list app with a Python (Flask) backend powering every action,
a frosted "liquid glass" interface, an animated smoky background, and
a full set of micro-interactions: confetti on completion, drag-and-drop
reordering, due dates with overdue highlighting, filter tabs, and an
animated custom alert dialog (no native `alert()` popups).

Tasks are stored **in memory only** — no database file, no cookies,
no sessions — so the list resets whenever the server restarts and
never persists across browser sessions.

## Features

- **Add / Complete / Undo / Remove / Edit** — every action is a real
  HTTP call to the Flask API, not just client-side JavaScript
- **Inline editing** — double-click any task's text to edit it (and
  its due date) without leaving the list
- **Due dates with overdue highlighting** — optional date picker per
  task; overdue, incomplete tasks get a red-tinted card and a pulsing
  badge
- **Filter tabs** — switch between All / Active / Completed
- **Clear completed** — bulk-remove every completed task in one click
- **Drag-and-drop reordering** — grab the handle on the left of any
  task to reorder the list; the new order is saved on the server
- **Stats widget** — live Total / Active / Done counters that animate
  by counting up/down, plus a circular progress ring
- **Confetti burst** — fires when you complete a task (a bigger burst
  when the last active task is completed)
- **Animated checkmark + strikethrough** — the checkmark draws itself
  in and the strikethrough line sweeps across the text instead of
  snapping in instantly
- **Form validation** — empty/too-long task text and malformed due
  dates are rejected server-side in Python, with an inline error
  message and an input-shake animation
- **Animated custom alert dialog** — replaces native `alert()` with a
  frosted, spring-animated modal that confirms every action
- **Smoky, animated background** — a slowly hue-shifting gradient,
  drifting blurred "smoke" shapes, soft light rays, film grain, and a
  vignette, all behind a translucent glass card

## Run it

```bash
pip install -r requirements.txt
python app.py
```

Then open **http://127.0.0.1:5000** in your browser.

## How buttons map to Python

| Action            | HTTP request                     | Flask route          |
|--------------------|-----------------------------------|------------------------|
| Add                | `POST /api/tasks`                | `add_task()`           |
| Complete / Undo    | `PATCH /api/tasks/<id>/toggle`   | `toggle_task()`        |
| Remove             | `DELETE /api/tasks/<id>`         | `delete_task()`        |
| Save (edit)        | `PUT /api/tasks/<id>`            | `update_task()`        |
| Clear completed    | `DELETE /api/tasks/completed`    | `clear_completed()`    |
| Drag-and-drop save | `PATCH /api/tasks/reorder`       | `reorder_tasks()`      |

All validation (empty text, 100-character limit, due-date format)
happens server-side in Python (`validate_text()` and
`validate_due_date()` in `app.py`). The frontend just displays
whatever error the server returns.

## Project structure

```
todo-app/
├── app.py                 # Flask backend + all API routes
├── requirements.txt
├── .gitignore
├── templates/
│   └── index.html         # Page markup: card, filter bar, stats widget, modal
└── static/
    ├── css/style.css      # Glass card, smoke/grain background, all animations
    └── js/script.js       # Calls the Flask API for every action; drag-and-drop,
                            # filtering, confetti, stats counters, custom alert
```

## Notes

- No database, no auth, no persistence by design — restart the server
  and the list is empty again.
- Everything renders inline in a single page (`templates/index.html`);
  there's no client-side framework, just vanilla JS talking to Flask.
