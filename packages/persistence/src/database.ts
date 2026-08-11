import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as schema from './schema';

export interface PersistenceDatabase {
  client: Database.Database;
  db: BetterSQLite3Database<typeof schema>;
  close(): void;
}

export function getDefaultDatabasePath(): string {
  return process.env.WORKFLOW_ENGINE_DB_PATH ?? resolve(process.cwd(), '.runtime', 'workflow-engine.sqlite');
}

export function createPersistenceDatabase(filePath = getDefaultDatabasePath()): PersistenceDatabase {
  mkdirSync(dirname(filePath), { recursive: true });
  const client = new Database(filePath);
  client.pragma('journal_mode = WAL');
  client.pragma('foreign_keys = ON');
  client.pragma('busy_timeout = 5000');
  migrate(client);

  return {
    client,
    db: drizzle(client, { schema }),
    close: () => client.close(),
  };
}

function migrate(client: Database.Database): void {
  client.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      current_draft_id TEXT NOT NULL,
      published_version_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflow_drafts (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL UNIQUE,
      revision INTEGER NOT NULL,
      definition_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflow_versions (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      definition_json TEXT NOT NULL,
      change_summary TEXT,
      published_at TEXT NOT NULL,
      UNIQUE(workflow_id, version),
      UNIQUE(workflow_id, checksum)
    );
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      definition_checksum TEXT NOT NULL,
      status TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      input_json TEXT NOT NULL,
      output_json TEXT,
      temporal_workflow_id TEXT,
      temporal_run_id TEXT,
      resumed_from_run_id TEXT,
      resumed_from_invocation_id TEXT,
      failure_code TEXT,
      failure_message TEXT,
      next_event_sequence INTEGER NOT NULL DEFAULT 0,
      started_at TEXT,
      ended_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS run_steps (
      id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      branch_path_json TEXT NOT NULL,
      iteration_path_json TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt INTEGER NOT NULL DEFAULT 0,
      input_json TEXT,
      output_json TEXT,
      failure_code TEXT,
      failure_message TEXT,
      started_at TEXT,
      ended_at TEXT,
      PRIMARY KEY(run_id, id)
    );
    CREATE TABLE IF NOT EXISTS run_events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      type TEXT NOT NULL,
      invocation_id TEXT,
      idempotency_key TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(run_id, sequence),
      UNIQUE(run_id, idempotency_key)
    );
    CREATE TABLE IF NOT EXISTS run_waits (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      invocation_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      response_schema_json TEXT,
      response_json TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      UNIQUE(run_id, invocation_id)
    );
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      invocation_id TEXT,
      node_id TEXT,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      uri TEXT NOT NULL,
      content_type TEXT,
      size INTEGER,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflow_triggers (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      type TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      config_json TEXT NOT NULL,
      secret_reference TEXT,
      version_policy TEXT NOT NULL DEFAULT 'latest',
      pinned_version_id TEXT,
      external_registration_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS adapter_statuses (
      adapter_id TEXT PRIMARY KEY,
      available INTEGER NOT NULL,
      setup_hint TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS worker_heartbeats (
      worker_id TEXT PRIMARY KEY,
      task_queue TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      metadata_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS runtime_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}
