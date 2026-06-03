use rusqlite::{Connection, OptionalExtension, params};
use uuid::Uuid;

use crate::{
    ConversationId, ConversationSummary, MessageId, MessageRecord, MessageRole, MessageState,
    Timestamp,
};

pub(super) fn create_conversation(
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

pub(super) fn ensure_conversation(conn: &Connection, conversation_id: &str) -> Result<(), String> {
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

pub(super) struct InsertMessage<'a> {
    pub(super) conversation_id: &'a str,
    pub(super) message_id: &'a str,
    pub(super) conversation_position: i64,
    pub(super) role: &'a str,
    pub(super) state: &'a str,
    pub(super) now: &'a str,
    pub(super) completed_at: Option<&'a str>,
    pub(super) response_run_id: Option<&'a str>,
}

pub(super) fn insert_message(conn: &Connection, message: InsertMessage<'_>) -> Result<(), String> {
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

pub(super) fn next_message_position(
    conn: &Connection,
    conversation_id: &str,
) -> Result<i64, String> {
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

pub(super) fn upsert_text(
    conn: &Connection,
    message_id: &str,
    text: &str,
    now: &str,
) -> Result<(), String> {
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

pub(super) fn touch_conversation(
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

pub(super) fn conversation_summary(
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

pub(super) fn messages_for_conversation(
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

pub(super) fn message_by_id(
    conn: &Connection,
    message_id: &str,
) -> Result<Option<MessageRecord>, String> {
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
