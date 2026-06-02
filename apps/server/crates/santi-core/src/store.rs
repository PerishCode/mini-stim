use std::{
    path::Path,
    sync::{Arc, Mutex},
};

use rusqlite::{Connection, OptionalExtension, params};
use uuid::Uuid;

use crate::{
    ConversationDetail, ConversationId, ConversationSummary, MessageId, MessageRecord, MessageRole,
    MessageState, SendMessageAccepted, Timestamp, TranscriptMessage, timestamp_now,
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
            VALUES (?1, ?2, ?3, ?4, 'openai', ?5, 'streaming', ?6)
            "#,
            params![
                response_run_id,
                conversation_id,
                user_message_id,
                assistant_message_id,
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

fn create_conversation(
    conn: &Connection,
    now: &Timestamp,
    first_text: &str,
) -> Result<ConversationId, String> {
    let conversation_id = format!("conv_{}", Uuid::new_v4());
    let title = first_text.chars().take(60).collect::<String>();
    conn.execute(
        r#"
        INSERT INTO conversations (conversation_id, title, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?3)
        "#,
        params![conversation_id, title, now],
    )
    .map_err(|error| error.to_string())?;
    Ok(conversation_id)
}

fn ensure_conversation(conn: &Connection, conversation_id: &str) -> Result<(), String> {
    let exists = conn
        .query_row(
            "SELECT 1 FROM conversations WHERE conversation_id = ?1",
            params![conversation_id],
            |_| Ok(()),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .is_some();
    if exists {
        Ok(())
    } else {
        Err("conversation not found".to_string())
    }
}

struct InsertMessage<'a> {
    conversation_id: &'a str,
    message_id: &'a str,
    conversation_position: i64,
    role: &'a str,
    state: &'a str,
    now: &'a str,
    completed_at: Option<&'a str>,
    response_run_id: Option<&'a str>,
}

fn insert_message(conn: &Connection, message: InsertMessage<'_>) -> Result<(), String> {
    conn.execute(
        r#"
        INSERT INTO messages (
          message_id, conversation_id, conversation_position, role, state,
          created_at, updated_at, completed_at, response_run_id
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7, ?8)
        "#,
        params![
            message.message_id,
            message.conversation_id,
            message.conversation_position,
            message.role,
            message.state,
            message.now,
            message.completed_at,
            message.response_run_id
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn next_message_position(conn: &Connection, conversation_id: &str) -> Result<i64, String> {
    conn.query_row(
        r#"
        SELECT COALESCE(MAX(conversation_position), -1) + 1
        FROM messages
        WHERE conversation_id = ?1
        "#,
        params![conversation_id],
        |row| row.get(0),
    )
    .map_err(|error| error.to_string())
}

fn upsert_text(conn: &Connection, message_id: &str, text: &str, now: &str) -> Result<(), String> {
    conn.execute(
        r#"
        INSERT INTO message_text_contents (message_id, text, updated_at)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(message_id) DO UPDATE SET
          text = excluded.text,
          updated_at = excluded.updated_at
        "#,
        params![message_id, text, now],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn touch_conversation(
    conn: &Connection,
    conversation_id: &str,
    message_id: &str,
    now: &str,
) -> Result<(), String> {
    conn.execute(
        r#"
        UPDATE conversations
        SET updated_at = ?2, last_message_id = ?3
        WHERE conversation_id = ?1
        "#,
        params![conversation_id, now, message_id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn conversation_summary(
    conn: &Connection,
    conversation_id: &str,
) -> Result<Option<ConversationSummary>, String> {
    conn.query_row(
        r#"
        SELECT conversation_id, title, created_at, updated_at
        FROM conversations
        WHERE conversation_id = ?1
        "#,
        params![conversation_id],
        |row| {
            Ok(ConversationSummary {
                conversation_id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                last_message_preview: None,
            })
        },
    )
    .optional()
    .map_err(|error| error.to_string())
}

fn messages_for_conversation(
    conn: &Connection,
    conversation_id: &str,
) -> Result<Vec<MessageRecord>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT m.message_id, m.conversation_id, m.role, m.state, m.created_at,
                   m.updated_at, m.completed_at, m.error, c.text
            FROM messages m
            JOIN message_text_contents c ON c.message_id = m.message_id
            WHERE m.conversation_id = ?1
            ORDER BY m.conversation_position
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(params![conversation_id], message_from_row)
        .map_err(|error| error.to_string())?;
    let mut messages = Vec::new();
    for row in rows {
        messages.push(row.map_err(|error| error.to_string())?);
    }
    Ok(messages)
}

fn message_by_id(conn: &Connection, message_id: &str) -> Result<Option<MessageRecord>, String> {
    conn.query_row(
        r#"
        SELECT m.message_id, m.conversation_id, m.role, m.state, m.created_at,
               m.updated_at, m.completed_at, m.error, c.text
        FROM messages m
        JOIN message_text_contents c ON c.message_id = m.message_id
        WHERE m.message_id = ?1
        "#,
        params![message_id],
        message_from_row,
    )
    .optional()
    .map_err(|error| error.to_string())
}

fn message_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<MessageRecord> {
    Ok(MessageRecord {
        message_id: row.get::<_, MessageId>(0)?,
        conversation_id: row.get::<_, ConversationId>(1)?,
        role: parse_role(row.get::<_, String>(2)?),
        state: parse_state(row.get::<_, String>(3)?),
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
        completed_at: row.get(6)?,
        error: row.get(7)?,
        text: row.get(8)?,
    })
}

fn parse_role(value: String) -> MessageRole {
    match value.as_str() {
        "assistant" => MessageRole::Assistant,
        _ => MessageRole::User,
    }
}

fn parse_state(value: String) -> MessageState {
    match value.as_str() {
        "streaming" => MessageState::Streaming,
        "completed" => MessageState::Completed,
        "failed" => MessageState::Failed,
        _ => MessageState::Created,
    }
}
