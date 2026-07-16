-- =============================================================
-- schema.sql — DDL for the jobs table
--
-- WHY TEXT for timestamps: SQLite has no native DATETIME type.
-- Storing ISO-8601 strings keeps the data human-readable and
-- sortable without any special SQLite functions.
--
-- WHY INTEGER for attempts/max_retries: SQLite's flexible typing
-- still enforces INTEGER affinity here which is what we want for
-- arithmetic comparisons in future worker/retry logic.
-- =============================================================

CREATE TABLE IF NOT EXISTS jobs (
  id          TEXT    PRIMARY KEY,
  command     TEXT    NOT NULL,
  state       TEXT    NOT NULL DEFAULT 'pending',
  attempts    INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);
