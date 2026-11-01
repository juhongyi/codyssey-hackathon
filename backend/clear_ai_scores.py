"""One-time pre-release cleanup. Run before enabling user self-assessments."""

import os

import psycopg
from psycopg.types.json import Jsonb

from utils.assessments import without_generated_scores


def clear_ai_scores(conn):
    rows = conn.execute("SELECT id, raw_plan, plans FROM boards FOR UPDATE").fetchall()
    for board_id, raw, plans in rows:
        cleaned = without_generated_scores({"plans": plans})["plans"]
        for plan in cleaned:
            plan["scores"] = {}
        conn.execute(
            "UPDATE boards SET raw_plan = %s, plans = %s WHERE id = %s",
            (Jsonb(without_generated_scores(raw)), Jsonb(cleaned), board_id),
        )
    return len(rows)


if __name__ == "__main__":
    with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
        count = clear_ai_scores(connection)
    print(f"Cleared AI assessments from {count} boards.")
