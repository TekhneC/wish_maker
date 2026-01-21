from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from flask import Flask, jsonify, render_template, request

DB_PATH = Path(__file__).resolve().parent / "data.db"
MAX_LENGTH = 80
DEFAULT_RECENT_LIMIT = 10
DEFAULT_RANDOM_LIMIT = 12

app = Flask(__name__)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS wishes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


init_db()


def parse_int(value: str | None, default: int, minimum: int, maximum: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return max(minimum, min(parsed, maximum))


def parse_exclude_ids(value: str | None) -> list[int]:
    if not value:
        return []
    ids: list[int] = []
    for item in value.split(","):
        item = item.strip()
        if not item:
            continue
        try:
            ids.append(int(item))
        except ValueError:
            continue
    return ids


def fetch_recent(conn: sqlite3.Connection, limit: int) -> list[dict]:
    rows = conn.execute(
        "SELECT id, text, created_at FROM wishes ORDER BY datetime(created_at) DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]


def fetch_random(
    conn: sqlite3.Connection, limit: int, exclude_ids: Iterable[int]
) -> list[dict]:
    exclude_ids = list(exclude_ids)
    if not exclude_ids:
        rows = conn.execute(
            "SELECT id, text, created_at FROM wishes ORDER BY RANDOM() LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]

    placeholders = ",".join("?" for _ in exclude_ids)
    query = (
        "SELECT id, text, created_at FROM wishes "
        f"WHERE id NOT IN ({placeholders}) "
        "ORDER BY RANDOM() LIMIT ?"
    )
    rows = conn.execute(query, (*exclude_ids, limit)).fetchall()
    return [dict(row) for row in rows]


@app.route("/")
def index() -> str:
    return render_template("index.html", max_length=MAX_LENGTH)


@app.route("/api/init")
def init_data():
    recent_limit = parse_int(
        request.args.get("recent_limit"), DEFAULT_RECENT_LIMIT, 1, 30
    )
    random_limit = parse_int(
        request.args.get("random_limit"), DEFAULT_RANDOM_LIMIT, 1, 30
    )
    exclude_ids = parse_exclude_ids(request.args.get("exclude_ids"))

    with get_connection() as conn:
        recent = fetch_recent(conn, recent_limit)
        exclude_set = set(exclude_ids)
        exclude_set.update(item["id"] for item in recent)
        random_wishes = fetch_random(conn, random_limit, exclude_set)

    return jsonify({"recent": recent, "random": random_wishes})


@app.route("/api/submit", methods=["POST"])
def submit_wish():
    payload = request.get_json(silent=True) or {}
    text = str(payload.get("text", "")).strip()

    if not text:
        return jsonify({"error": "empty"}), 400
    if len(text) > MAX_LENGTH:
        return jsonify({"error": "too_long"}), 400

    created_at = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO wishes (text, created_at) VALUES (?, ?)",
            (text, created_at),
        )
        conn.commit()
        wish_id = cursor.lastrowid

    return jsonify({"id": wish_id, "text": text, "created_at": created_at})

@app.route("/api/delete/<int:wish_id>", methods=["DELETE"])
def delete_wish(wish_id):
    try:
        with get_connection() as conn:
            conn.execute("DELETE FROM wishes WHERE id = ?", (wish_id,))
            conn.commit()
        return jsonify({"status": "deleted", "id": wish_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5000, debug=True)
