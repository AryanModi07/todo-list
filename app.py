"""
Todo List - Flask backend

All button actions (add, remove, complete/undo, edit, reorder, clear
completed) are powered by this Python server through a small JSON
API. Tasks are kept in memory only (no database file, no
cookies/sessions), so they do NOT persist across server restarts or
browser sessions - exactly as requested.
"""

from datetime import date

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# ---------------------------------------------------------------
# In-memory "database"
# ---------------------------------------------------------------
tasks = []
next_id = 1


def find_task(task_id):
    return next((t for t in tasks if t["id"] == task_id), None)


def validate_text(text):
    if text is None:
        return "Task text is required."
    trimmed = text.strip()
    if len(trimmed) == 0:
        return "Task cannot be empty."
    if len(trimmed) > 100:
        return "Task must be 100 characters or fewer."
    return None


def validate_due_date(due_date):
    """due_date is optional. If present, must be YYYY-MM-DD."""
    if due_date is None or due_date == "":
        return None
    try:
        date.fromisoformat(due_date)
    except ValueError:
        return "Due date must be in YYYY-MM-DD format."
    return None


# ---------------------------------------------------------------
# Page route
# ---------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------
# API routes - one for each button action
# ---------------------------------------------------------------
@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    return jsonify(tasks)


@app.route("/api/tasks", methods=["POST"])
def add_task():
    global next_id
    data = request.get_json(silent=True) or {}
    text = data.get("text", "")
    due_date = data.get("due_date") or None

    error = validate_text(text)
    if error:
        return jsonify({"error": error}), 400

    error = validate_due_date(due_date)
    if error:
        return jsonify({"error": error}), 400

    task = {
        "id": next_id,
        "text": text.strip(),
        "completed": False,
        "due_date": due_date,
    }
    tasks.append(task)
    next_id += 1
    return jsonify(task), 201


@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    task = find_task(task_id)
    if task is None:
        return jsonify({"error": "Task not found."}), 404

    data = request.get_json(silent=True) or {}
    text = data.get("text", "")
    due_date = data.get("due_date", task.get("due_date"))
    if due_date == "":
        due_date = None

    error = validate_text(text)
    if error:
        return jsonify({"error": error}), 400

    error = validate_due_date(due_date)
    if error:
        return jsonify({"error": error}), 400

    task["text"] = text.strip()
    task["due_date"] = due_date
    return jsonify(task)


@app.route("/api/tasks/<int:task_id>/toggle", methods=["PATCH"])
def toggle_task(task_id):
    task = find_task(task_id)
    if task is None:
        return jsonify({"error": "Task not found."}), 404

    task["completed"] = not task["completed"]
    return jsonify(task)


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    task = find_task(task_id)
    if task is None:
        return jsonify({"error": "Task not found."}), 404

    tasks.remove(task)
    return jsonify({"deleted": task_id})


@app.route("/api/tasks/completed", methods=["DELETE"])
def clear_completed():
    """Bulk-remove every completed task. Powers the 'Clear completed' button."""
    global tasks
    removed_ids = [t["id"] for t in tasks if t["completed"]]
    tasks = [t for t in tasks if not t["completed"]]
    return jsonify({"deleted": removed_ids})


@app.route("/api/tasks/reorder", methods=["PATCH"])
def reorder_tasks():
    """
    Accepts {"order": [id1, id2, id3, ...]} representing the new
    top-to-bottom order and rearranges the in-memory list to match.
    Powers drag-and-drop reordering.
    """
    global tasks
    data = request.get_json(silent=True) or {}
    order = data.get("order")

    if not isinstance(order, list):
        return jsonify({"error": "order must be a list of task ids."}), 400

    by_id = {t["id"]: t for t in tasks}
    if set(order) != set(by_id.keys()):
        return jsonify({"error": "order must contain exactly the current task ids."}), 400

    tasks = [by_id[task_id] for task_id in order]
    return jsonify(tasks)


if __name__ == "__main__":
    app.run(debug=True)
