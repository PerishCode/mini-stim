use std::{
    path::Path,
    sync::{Arc, Mutex},
};

use rusqlite::{Connection, params};

use crate::{
    ActorType, MessageContent, MessageState, Session, SessionMessage, SoulSession,
    SoulSessionEntry, SoulSessionTargetType, Turn, prefixed_id, timestamp_now,
};

mod db;
mod rows;
mod runtime;
mod schema;

use db::*;
use rows::{actor_type_db, map_session_row, message_state_db};
use schema::SCHEMA;

const SANTI_SCHEMA_VERSION: u32 = 3;
const DEFAULT_ACCOUNT_ID: &str = "account_local";
const DEFAULT_SOUL_ID: &str = "soul_default";

#[derive(Clone)]
pub struct SantiStore {
    conn: Arc<Mutex<Connection>>,
}

#[derive(Debug, Clone)]
pub struct AppendedMessage {
    pub session_message: SessionMessage,
}

#[derive(Debug, Clone)]
pub struct AcquiredSoulSession {
    pub soul_session: SoulSession,
}

#[derive(Debug, Clone)]
pub struct StartedTurn {
    pub turn: Turn,
}

impl SantiStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, String> {
        if let Some(parent) = path.as_ref().parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let conn = Connection::open(path).map_err(|error| error.to_string())?;
        let store = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        store.migrate()?;
        store.seed_defaults()?;
        Ok(store)
    }

    fn migrate(&self) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        let version = conn
            .query_row("PRAGMA user_version", [], |row| row.get::<_, u32>(0))
            .map_err(|error| error.to_string())?;
        if version != SANTI_SCHEMA_VERSION {
            conn.execute_batch(
                r#"
                DROP TABLE IF EXISTS response_stream_deltas;
                DROP TABLE IF EXISTS response_runs;
                DROP TABLE IF EXISTS message_text_contents;
                DROP TABLE IF EXISTS conversations;
                DROP TABLE IF EXISTS r_soul_session_messages;
                DROP TABLE IF EXISTS compacts;
                DROP TABLE IF EXISTS tool_results;
                DROP TABLE IF EXISTS tool_calls;
                DROP TABLE IF EXISTS turns;
                DROP TABLE IF EXISTS soul_sessions;
                DROP TABLE IF EXISTS session_effects;
                DROP TABLE IF EXISTS message_events;
                DROP TABLE IF EXISTS r_session_messages;
                DROP TABLE IF EXISTS messages;
                DROP TABLE IF EXISTS sessions;
                DROP TABLE IF EXISTS souls;
                DROP TABLE IF EXISTS accounts;
                "#,
            )
            .map_err(|error| error.to_string())?;
        }
        conn.execute_batch(SCHEMA)
            .map_err(|error| error.to_string())?;
        conn.pragma_update(None, "user_version", SANTI_SCHEMA_VERSION)
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    fn seed_defaults(&self) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        let now = timestamp_now();
        conn.execute(
            r#"
            INSERT OR IGNORE INTO accounts (id, name, created_at, updated_at)
            VALUES (?1, 'Local Account', ?2, ?2)
            "#,
            params![DEFAULT_ACCOUNT_ID, now],
        )
        .map_err(|error| error.to_string())?;
        conn.execute(
            r#"
            INSERT OR IGNORE INTO souls (id, memory, created_at, updated_at)
            VALUES (?1, '', ?2, ?2)
            "#,
            params![DEFAULT_SOUL_ID, now],
        )
        .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn default_account_id(&self) -> &'static str {
        DEFAULT_ACCOUNT_ID
    }

    pub fn default_soul_id(&self) -> &'static str {
        DEFAULT_SOUL_ID
    }

    pub fn list_sessions(&self) -> Result<Vec<Session>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, title, parent_session_id, fork_point, created_at, updated_at
                FROM sessions
                ORDER BY updated_at DESC, id DESC
                "#,
            )
            .map_err(|error| error.to_string())?;
        let rows = stmt
            .query_map([], map_session_row)
            .map_err(|error| error.to_string())?;
        collect_rows(rows)
    }

    pub fn create_session(&self) -> Result<Session, String> {
        let conn = self.conn.lock().unwrap();
        let session_id = prefixed_id("sess");
        let now = timestamp_now();
        conn.execute(
            r#"
            INSERT INTO sessions (id, title, parent_session_id, fork_point, created_at, updated_at)
            VALUES (?1, NULL, NULL, NULL, ?2, ?2)
            "#,
            params![session_id, now],
        )
        .map_err(|error| error.to_string())?;
        session_by_id(&conn, &session_id)?.ok_or_else(|| "created session missing".to_string())
    }

    pub fn session(&self, session_id: &str) -> Result<Option<Session>, String> {
        let conn = self.conn.lock().unwrap();
        session_by_id(&conn, session_id)
    }

    pub fn update_session_title(
        &self,
        session_id: &str,
        title: Option<String>,
    ) -> Result<Option<Session>, String> {
        let conn = self.conn.lock().unwrap();
        if session_by_id(&conn, session_id)?.is_none() {
            return Ok(None);
        }
        let now = timestamp_now();
        conn.execute(
            "UPDATE sessions SET title = ?2, updated_at = ?3 WHERE id = ?1",
            params![session_id, normalize_session_title(title), now],
        )
        .map_err(|error| error.to_string())?;
        session_by_id(&conn, session_id)
    }

    pub fn session_messages(&self, session_id: &str) -> Result<Vec<SessionMessage>, String> {
        let conn = self.conn.lock().unwrap();
        session_messages(&conn, session_id)
    }

    pub fn runtime_snapshot(
        &self,
        session_id: &str,
    ) -> Result<Option<crate::SessionRuntimeSnapshot>, String> {
        let conn = self.conn.lock().unwrap();
        let Some(session) = session_by_id(&conn, session_id)? else {
            return Ok(None);
        };
        let soul_session = soul_session_by_pair(&conn, DEFAULT_SOUL_ID, session_id)?;
        Ok(Some(crate::SessionRuntimeSnapshot {
            session,
            soul_session: soul_session.clone(),
            messages: session_messages(&conn, session_id)?,
            turns: if let Some(soul_session) = &soul_session {
                turns_for_soul_session(&conn, &soul_session.id)?
            } else {
                Vec::new()
            },
            tool_calls: if let Some(soul_session) = &soul_session {
                soul_tool_calls(&conn, &soul_session.id)?
            } else {
                Vec::new()
            },
            tool_results: if let Some(soul_session) = &soul_session {
                soul_tool_results(&conn, &soul_session.id)?
            } else {
                Vec::new()
            },
            compacts: if let Some(soul_session) = &soul_session {
                compacts_for_soul_session(&conn, &soul_session.id)?
            } else {
                Vec::new()
            },
            effects: session_effects(&conn, session_id)?,
        }))
    }

    pub fn append_message(
        &self,
        session_id: &str,
        actor_type: ActorType,
        actor_id: &str,
        content: MessageContent,
        state: MessageState,
    ) -> Result<AppendedMessage, String> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction().map_err(|error| error.to_string())?;
        ensure_session(&tx, session_id)?;
        let message_id = prefixed_id("msg");
        let now = timestamp_now();
        let next_seq = next_session_seq(&tx, session_id)?;
        let content_json = serde_json::to_string(&content).map_err(|error| error.to_string())?;
        tx.execute(
            r#"
            INSERT INTO messages (
              id, actor_type, actor_id, content, state, version, deleted_at, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, 1, NULL, ?6, ?6)
            "#,
            params![
                message_id,
                actor_type_db(&actor_type),
                actor_id,
                content_json,
                message_state_db(&state),
                now
            ],
        )
        .map_err(|error| error.to_string())?;
        tx.execute(
            r#"
            INSERT INTO r_session_messages (session_id, message_id, session_seq, created_at)
            VALUES (?1, ?2, ?3, ?4)
            "#,
            params![session_id, message_id, next_seq, now],
        )
        .map_err(|error| error.to_string())?;
        let title = if actor_type == ActorType::Account && next_seq == 1 {
            session_title(&content)
        } else {
            None
        };
        if let Some(title) = title {
            tx.execute(
                "UPDATE sessions SET title = COALESCE(title, ?2), updated_at = ?3 WHERE id = ?1",
                params![session_id, title, now],
            )
            .map_err(|error| error.to_string())?;
        } else {
            tx.execute(
                "UPDATE sessions SET updated_at = ?2 WHERE id = ?1",
                params![session_id, now],
            )
            .map_err(|error| error.to_string())?;
        }
        tx.commit().map_err(|error| error.to_string())?;
        Ok(AppendedMessage {
            session_message: message_by_id(&conn, &message_id)?
                .ok_or_else(|| "created message missing".to_string())?,
        })
    }

    pub fn acquire_soul_session(&self, session_id: &str) -> Result<AcquiredSoulSession, String> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction().map_err(|error| error.to_string())?;
        ensure_session(&tx, session_id)?;
        let now = timestamp_now();
        let existing = soul_session_by_pair(&tx, DEFAULT_SOUL_ID, session_id)?;
        let soul_session = if let Some(existing) = existing {
            existing
        } else {
            let soul_session_id = prefixed_id("ss");
            tx.execute(
                r#"
                INSERT INTO soul_sessions (
                  id, soul_id, session_id, session_memory, provider_state, next_seq,
                  last_seen_session_seq, parent_soul_session_id, fork_point, created_at, updated_at
                )
                VALUES (?1, ?2, ?3, '', NULL, 1, 0, NULL, NULL, ?4, ?4)
                "#,
                params![soul_session_id, DEFAULT_SOUL_ID, session_id, now],
            )
            .map_err(|error| error.to_string())?;
            soul_session_by_id(&tx, &soul_session_id)?
                .ok_or_else(|| "created soul_session missing".to_string())?
        };
        tx.commit().map_err(|error| error.to_string())?;
        Ok(AcquiredSoulSession { soul_session })
    }

    pub fn append_message_ref(
        &self,
        soul_session_id: &str,
        message_id: &str,
    ) -> Result<SoulSessionEntry, String> {
        self.append_soul_session_entry(soul_session_id, SoulSessionTargetType::Message, message_id)
    }

    pub fn start_turn(
        &self,
        soul_session_id: &str,
        trigger_ref: &str,
        input_through_session_seq: i64,
    ) -> Result<StartedTurn, String> {
        let conn = self.conn.lock().unwrap();
        let turn_id = prefixed_id("turn");
        let now = timestamp_now();
        conn.execute(
            r#"
            INSERT INTO turns (
              id, soul_session_id, trigger_type, trigger_ref, input_through_session_seq,
              base_soul_session_seq, end_soul_session_seq, status, error_text,
              created_at, updated_at, finished_at
            )
            SELECT ?1, id, 'session_send', ?3, ?4, next_seq - 1, NULL, 'running',
                   NULL, ?5, ?5, NULL
            FROM soul_sessions
            WHERE id = ?2
            "#,
            params![
                turn_id,
                soul_session_id,
                trigger_ref,
                input_through_session_seq,
                now
            ],
        )
        .map_err(|error| error.to_string())?;
        Ok(StartedTurn {
            turn: turn_by_id(&conn, &turn_id)?.ok_or_else(|| "created turn missing".to_string())?,
        })
    }
}

fn session_title(content: &MessageContent) -> Option<String> {
    let title = content
        .content_text()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    normalize_session_title(Some(title))
}

fn normalize_session_title(title: Option<String>) -> Option<String> {
    let title = title?;
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.to_string())
}
