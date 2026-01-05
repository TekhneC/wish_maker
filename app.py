from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from typing import Any

from flask import Flask, jsonify, render_template, request

DATABASE_PATH = os.path.join(os.path.dirname(__file__), "wishes.db")
MAX_WISH_LENGTH = 80

app = Flask(__name__)
init_db()


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS wishes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


def serialize_wish(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "text": row["text"],
        "created_at": row["created_at"],
    }


@app.route("/")
def index() -> str:
    return render_template("index.html", max_length=MAX_WISH_LENGTH)


@app.route("/api/wishes", methods=["POST"])
def create_wish() -> tuple[Any, int]:
    payload = request.get_json(silent=True) or {}
    text = str(payload.get("text", "")).strip()
    if not text:
        return jsonify({"error": "Wish text cannot be empty."}), 400
    if len(text) > MAX_WISH_LENGTH:
        return jsonify({"error": f"Wish text must be <= {MAX_WISH_LENGTH} chars."}), 400

    created_at = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO wishes (text, created_at) VALUES (?, ?)",
            (text, created_at),
        )
        wish_id = cursor.lastrowid
        row = conn.execute(
            "SELECT id, text, created_at FROM wishes WHERE id = ?", (wish_id,)
        ).fetchone()

    return jsonify(serialize_wish(row)), 201


@app.route("/api/wishes/recent")
def recent_wishes() -> Any:
    limit = request.args.get("limit", default=20, type=int)
    limit = max(1, min(limit, 100))
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, text, created_at FROM wishes ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return jsonify([serialize_wish(row) for row in rows])


@app.route("/api/wishes/random")
def random_wishes() -> Any:
    limit = request.args.get("limit", default=30, type=int)
    limit = max(1, min(limit, 100))
    exclude_ids = request.args.get("exclude_ids", "")
    exclude_list = [int(item) for item in exclude_ids.split(",") if item.strip().isdigit()]

    with get_db() as conn:
        if exclude_list:
            placeholders = ",".join("?" for _ in exclude_list)
            query = (
                "SELECT id, text, created_at FROM wishes "
                f"WHERE id NOT IN ({placeholders}) ORDER BY RANDOM() LIMIT ?"
            )
            params = (*exclude_list, limit)
            rows = conn.execute(query, params).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, text, created_at FROM wishes ORDER BY RANDOM() LIMIT ?",
                (limit,),
            ).fetchall()

    return jsonify([serialize_wish(row) for row in rows])


@app.route("/api/wishes/seed")
def seed_wishes() -> Any:
    recent_limit = request.args.get("recent", default=20, type=int)
    random_limit = request.args.get("random", default=30, type=int)
    recent_limit = max(1, min(recent_limit, 100))
    random_limit = max(1, min(random_limit, 100))

    with get_db() as conn:
        recent_rows = conn.execute(
            "SELECT id, text, created_at FROM wishes ORDER BY id DESC LIMIT ?",
            (recent_limit,),
        ).fetchall()
        exclude_ids = [row["id"] for row in recent_rows]

        if exclude_ids:
            placeholders = ",".join("?" for _ in exclude_ids)
            query = (
                "SELECT id, text, created_at FROM wishes "
                f"WHERE id NOT IN ({placeholders}) ORDER BY RANDOM() LIMIT ?"
            )
            params = (*exclude_ids, random_limit)
            random_rows = conn.execute(query, params).fetchall()
        else:
            random_rows = conn.execute(
                "SELECT id, text, created_at FROM wishes ORDER BY RANDOM() LIMIT ?",
                (random_limit,),
            ).fetchall()

    return jsonify(
        {
            "recent": [serialize_wish(row) for row in recent_rows],
            "random": [serialize_wish(row) for row in random_rows],
        }
    )


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)
