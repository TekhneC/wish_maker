from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data" / "wishes.db"
MAX_MESSAGE_LENGTH = 80
DEFAULT_RECENT_LIMIT = 12
DEFAULT_RANDOM_LIMIT = 10

app = Flask(__name__, static_folder="static", template_folder="templates")


def ensure_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS wishes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/")
def index() -> str:
    return render_template("index.html")


@app.route("/api/messages", methods=["GET"])
def get_messages() -> Any:
    ensure_db()
    recent_limit = max(0, int(request.args.get("recent", DEFAULT_RECENT_LIMIT)))
    random_limit = max(0, int(request.args.get("random", DEFAULT_RANDOM_LIMIT)))
    exclude_ids = request.args.get("exclude", "")
    exclude_list = [int(item) for item in exclude_ids.split(",") if item.strip().isdigit()]

    with get_db() as conn:
        recent_rows = conn.execute(
            "SELECT id, message, created_at FROM wishes ORDER BY created_at DESC LIMIT ?",
            (recent_limit,),
        ).fetchall()

        recent_ids = [row["id"] for row in recent_rows]
        combined_exclude = list({*exclude_list, *recent_ids})

        placeholders = ",".join("?" for _ in combined_exclude)
        if random_limit > 0:
            if combined_exclude:
                random_rows = conn.execute(
                    f"""
                    SELECT id, message, created_at FROM wishes
                    WHERE id NOT IN ({placeholders})
                    ORDER BY RANDOM() LIMIT ?
                    """,
                    (*combined_exclude, random_limit),
                ).fetchall()
            else:
                random_rows = conn.execute(
                    "SELECT id, message, created_at FROM wishes ORDER BY RANDOM() LIMIT ?",
                    (random_limit,),
                ).fetchall()
        else:
            random_rows = []

    return jsonify(
        {
            "recent": [dict(row) for row in recent_rows],
            "random": [dict(row) for row in random_rows],
        }
    )


@app.route("/api/messages", methods=["POST"])
def post_message() -> Any:
    ensure_db()
    data = request.get_json(silent=True) or {}
    raw_message = data.get("message", "")
    if not isinstance(raw_message, str):
        return jsonify({"error": "Invalid message."}), 400

    message = raw_message.strip()
    if not message:
        return jsonify({"error": "Message cannot be empty."}), 400
    if len(message) > MAX_MESSAGE_LENGTH:
        return jsonify({"error": f"Message too long (max {MAX_MESSAGE_LENGTH})."}), 400

    created_at = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO wishes (message, created_at) VALUES (?, ?)",
            (message, created_at),
        )
        conn.commit()
        message_id = cursor.lastrowid

    return jsonify({"id": message_id, "message": message, "created_at": created_at}), 201


if __name__ == "__main__":
    ensure_db()
    app.run(host="127.0.0.1", port=5000, debug=True)
