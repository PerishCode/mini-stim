use std::{
    path::Path,
    sync::{Arc, Mutex},
};

use rusqlite::{Connection, params};
use uuid::Uuid;

use crate::store_rows::{
    InsertMessage, conversation_summary, create_conversation, ensure_conversation, insert_message,
    message_by_id, messages_for_conversation, next_message_position, touch_conversation,
    upsert_text,
};
use crate::{
    ConversationDetail, ConversationId, ConversationSummary, MessageRecord, SendMessageAccepted,
    TranscriptMessage, timestamp_now,
};

const CHAT_SCHEMA_VERSION: u32 = 1;

#[derive(Clone)]
pub struct ChatStore {
    conn: Arc<Mutex<Connection>>,
}

impl ChatStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, String> {
        if let Some(parent) = path.as_ref().parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let conn = Connection::open(path).map_err(|error| error.to_string())?;
        let store = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        store.migrate()?;
        Ok(store)
    }

    fn migrate(&self) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        let version = conn
            .query_row("PRAGMA user_version", [], |row| row.get::<_, u32>(0))
            .map_err(|error| error.to_string())?;
        if version != CHAT_SCHEMA_VERSION {
            conn.execute_batch(
                r#"
                DROP TABLE IF EXISTS response_stream_deltas;
                DROP TABLE IF EXISTS response_runs;
                DROP TABLE IF EXISTS message_text_contents;
                DROP TABLE IF EXISTS messages;
                DROP TABLE IF EXISTS conversations;
                "#,
            )
            .map_err(|error| error.to_string())?;
        }
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS conversations (
              conversation_id TEXT PRIMARY KEY,
              title TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              last_message_id TEXT
            );

            CREATE TABLE IF NOT EXISTS messages (
              message_id TEXT PRIMARY KEY,
              conversation_id TEXT NOT NULL,
              conversation_position INTEGER NOT NULL,
              role TEXT NOT NULL,
              state TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              completed_at TEXT,
              error TEXT,
              provider_response_id TEXT,
              response_run_id TEXT
            );

            CREATE INDEX IF NOT EXISTS messages_conversation_idx
              ON messages(conversation_id, conversation_position);

            CREATE TABLE IF NOT EXISTS message_text_contents (
              message_id TEXT PRIMARY KEY,
              text TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS response_runs (
              response_run_id TEXT PRIMARY KEY,
              conversation_id TEXT NOT NULL,
              user_message_id TEXT NOT NULL,
              assistant_message_id TEXT NOT NULL,
              provider TEXT NOT NULL,
              model TEXT NOT NULL,
              provider_response_id TEXT,
              state TEXT NOT NULL,
              started_at TEXT NOT NULL,
              completed_at TEXT,
              error TEXT
            );

            CREATE TABLE IF NOT EXISTS response_stream_deltas (
              response_run_id TEXT NOT NULL,
              position INTEGER NOT NULL,
              text TEXT NOT NULL,
              created_at TEXT NOT NULL,
              PRIMARY KEY (response_run_id, position)
            );
            "#,
        )
        .map_err(|error| error.to_string())?;
        conn.pragma_update(None, "user_version", CHAT_SCHEMA_VERSION)
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn list_conversations(&self) -> Result<Vec<ConversationSummary>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                r#"
                SELECT conversation_id, title, created_at, updated_at
                FROM conversations
                ORDER BY updated_at DESC, conversation_id DESC
                "#,
            )
            .map_err(|error| error.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(ConversationSummary {
                    conversation_id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                    last_message_preview: None,
                })
            })
            .map_err(|error| error.to_string())?;
        let mut conversations = Vec::new();
        for row in rows {
            conversations.push(row.map_err(|error| error.to_string())?);
        }
        Ok(conversations)
    }

    pub fn conversation_detail(
        &self,
        conversation_id: &str,
    ) -> Result<Option<ConversationDetail>, String> {
        let conn = self.conn.lock().unwrap();
        let conversation = conversation_summary(&conn, conversation_id)?;
        let Some(conversation) = conversation else {
            return Ok(None);
        };
        Ok(Some(ConversationDetail {
            conversation,
            messages: messages_for_conversation(&conn, conversation_id)?,
        }))
    }

    pub fn begin_send(
        &self,
        request_conversation_id: Option<ConversationId>,
        text: String,
        provider: &str,
        model: &str,
    ) -> Result<SendMessageAccepted, String> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction().map_err(|error| error.to_string())?;
        let now = timestamp_now();
        let conversation_id = match request_conversation_id {
            Some(conversation_id) => {
                ensure_conversation(&tx, &conversation_id)?;
                conversation_id
            }
            None => create_conversation(&tx, &now, &text)?,
        };
        let user_message_id = format!("msg_{}", Uuid::new_v4());
        let assistant_message_id = format!("msg_{}", Uuid::new_v4());
        let response_run_id = format!("run_{}", Uuid::new_v4());
        let next_position = next_message_position(&tx, &conversation_id)?;
        insert_message(
            &tx,
            InsertMessage {
                conversation_id: &conversation_id,
                message_id: &user_message_id,
                conversation_position: next_position,
                role: "user",
                state: "completed",
                now: &now,
                completed_at: Some(&now),
                response_run_id: None,
            },
        )?;
        upsert_text(&tx, &user_message_id, &text, &now)?;
        insert_message(
            &tx,
            InsertMessage {
                conversation_id: &conversation_id,
                message_id: &assistant_message_id,
                conversation_position: next_position + 1,
                role: "assistant",
                state: "streaming",
                now: &now,
                completed_at: None,
                response_run_id: Some(&response_run_id),
            },
        )?;
        upsert_text(&tx, &assistant_message_id, "", &now)?;
        tx.execute(
            r#"
            INSERT INTO response_runs (
              response_run_id, conversation_id, user_message_id,
              assistant_message_id, provider, model, state, started_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'streaming', ?7)
            "#,
            params![
                response_run_id,
                conversation_id,
                user_message_id,
                assistant_message_id,
                provider,
                model,
                now
            ],
        )
        .map_err(|error| error.to_string())?;
        touch_conversation(&tx, &conversation_id, &assistant_message_id, &now)?;
        tx.commit().map_err(|error| error.to_string())?;
        let user_message = message_by_id(&conn, &user_message_id)?
            .ok_or_else(|| "user message missing".to_string())?;
        let assistant_message = message_by_id(&conn, &assistant_message_id)?
            .ok_or_else(|| "assistant message missing".to_string())?;
        Ok(SendMessageAccepted {
            conversation_id,
            user_message_id,
            assistant_message_id,
            response_run_id,
            user_message,
            assistant_message,
        })
    }

    pub fn transcript(&self, conversation_id: &str) -> Result<Vec<TranscriptMessage>, String> {
        let conn = self.conn.lock().unwrap();
        let messages = messages_for_conversation(&conn, conversation_id)?;
        Ok(messages
            .into_iter()
            .filter(|message| !message.text.is_empty())
            .map(|message| TranscriptMessage {
                role: message.role,
                text: message.text,
            })
            .collect())
    }

    pub fn append_delta(
        &self,
        response_run_id: &str,
        assistant_message_id: &str,
        delta: &str,
    ) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        let now = timestamp_now();
        let position = conn
            .query_row(
                "SELECT COUNT(*) FROM response_stream_deltas WHERE response_run_id = ?1",
                params![response_run_id],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| error.to_string())?;
        conn.execute(
            r#"
            INSERT INTO response_stream_deltas (
              response_run_id, position, text, created_at
            )
            VALUES (?1, ?2, ?3, ?4)
            "#,
            params![response_run_id, position, delta, now],
        )
        .map_err(|error| error.to_string())?;
        conn.execute(
            r#"
            UPDATE message_text_contents
            SET text = text || ?2, updated_at = ?3
            WHERE message_id = ?1
            "#,
            params![assistant_message_id, delta, now],
        )
        .map_err(|error| error.to_string())?;
        conn.execute(
            "UPDATE messages SET updated_at = ?2 WHERE message_id = ?1",
            params![assistant_message_id, now],
        )
        .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn complete_run(
        &self,
        response_run_id: &str,
        assistant_message_id: &str,
        provider_response_id: Option<&str>,
    ) -> Result<MessageRecord, String> {
        let conn = self.conn.lock().unwrap();
        let now = timestamp_now();
        conn.execute(
            r#"
            UPDATE response_runs
            SET state = 'completed', provider_response_id = ?2, completed_at = ?3
            WHERE response_run_id = ?1
            "#,
            params![response_run_id, provider_response_id, now],
        )
        .map_err(|error| error.to_string())?;
        conn.execute(
            r#"
            UPDATE messages
            SET state = 'completed',
                completed_at = ?2,
                updated_at = ?2,
                provider_response_id = ?3
            WHERE message_id = ?1
            "#,
            params![assistant_message_id, now, provider_response_id],
        )
        .map_err(|error| error.to_string())?;
        message_by_id(&conn, assistant_message_id)?
            .ok_or_else(|| "assistant message missing".to_string())
    }

    pub fn fail_run(
        &self,
        response_run_id: &str,
        assistant_message_id: &str,
        error: &str,
    ) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        let now = timestamp_now();
        conn.execute(
            r#"
            UPDATE response_runs
            SET state = 'failed', completed_at = ?2, error = ?3
            WHERE response_run_id = ?1
            "#,
            params![response_run_id, now, error],
        )
        .map_err(|error| error.to_string())?;
        conn.execute(
            r#"
            UPDATE messages
            SET state = 'failed', completed_at = ?2, updated_at = ?2, error = ?3
            WHERE message_id = ?1
            "#,
            params![assistant_message_id, now, error],
        )
        .map_err(|error| error.to_string())?;
        Ok(())
    }
}
