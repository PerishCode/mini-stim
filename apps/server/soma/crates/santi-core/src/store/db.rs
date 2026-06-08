use rusqlite::{Connection, OptionalExtension, params};

use crate::{
    ActorType, Compact, Session, SessionEffect, SessionMessage, Soul, SoulSession,
    SoulSessionEntry, SoulSessionTargetType, ToolCall, ToolResult, Turn, timestamp_now,
};

use super::rows::*;

pub(super) fn ensure_session(conn: &Connection, session_id: &str) -> Result<(), String> {
    let exists = conn
        .query_row(
            "SELECT 1 FROM sessions WHERE id = ?1 LIMIT 1",
            params![session_id],
            |_| Ok(()),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    exists.ok_or_else(|| "session not found".to_string())
}

pub(super) fn next_session_seq(conn: &Connection, session_id: &str) -> Result<i64, String> {
    conn.query_row(
        "SELECT COALESCE(MAX(session_seq), 0) + 1 FROM r_session_messages WHERE session_id = ?1",
        params![session_id],
        |row| row.get(0),
    )
    .map_err(|error| error.to_string())
}

pub(super) fn append_entry_in_tx(
    conn: &Connection,
    soul_session_id: &str,
    target_type: SoulSessionTargetType,
    target_id: &str,
) -> Result<SoulSessionEntry, String> {
    let now = timestamp_now();
    let allocated_seq = conn
        .query_row(
            r#"
            UPDATE soul_sessions
            SET next_seq = next_seq + 1, updated_at = ?2
            WHERE id = ?1
            RETURNING next_seq - 1
            "#,
            params![soul_session_id, now],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| error.to_string())?;
    conn.execute(
        r#"
        INSERT INTO r_soul_session_messages (
          soul_session_id, target_type, target_id, soul_session_seq, created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5)
        "#,
        params![
            soul_session_id,
            entry_type_db(&target_type),
            target_id,
            allocated_seq,
            now
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(SoulSessionEntry {
        soul_session_id: soul_session_id.to_string(),
        target_type,
        target_id: target_id.to_string(),
        soul_session_seq: allocated_seq,
        created_at: now,
    })
}

pub(super) fn session_by_id(
    conn: &Connection,
    session_id: &str,
) -> Result<Option<Session>, String> {
    conn.query_row(
        r#"
        SELECT id, parent_session_id, fork_point, created_at, updated_at
        FROM sessions
        WHERE id = ?1
        LIMIT 1
        "#,
        params![session_id],
        map_session_row,
    )
    .optional()
    .map_err(|error| error.to_string())
}

pub(super) fn soul_by_id(conn: &Connection, soul_id: &str) -> Result<Option<Soul>, String> {
    conn.query_row(
        "SELECT id, memory, created_at, updated_at FROM souls WHERE id = ?1 LIMIT 1",
        params![soul_id],
        |row| {
            Ok(Soul {
                id: row.get(0)?,
                memory: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        },
    )
    .optional()
    .map_err(|error| error.to_string())
}

pub(super) fn soul_session_by_pair(
    conn: &Connection,
    soul_id: &str,
    session_id: &str,
) -> Result<Option<SoulSession>, String> {
    conn.query_row(
        r#"
        SELECT id, soul_id, session_id, session_memory, provider_state, next_seq,
               last_seen_session_seq, parent_soul_session_id, fork_point, created_at, updated_at
        FROM soul_sessions
        WHERE soul_id = ?1 AND session_id = ?2
        LIMIT 1
        "#,
        params![soul_id, session_id],
        map_soul_session_row,
    )
    .optional()
    .map_err(|error| error.to_string())
}

pub(super) fn soul_session_by_id(
    conn: &Connection,
    soul_session_id: &str,
) -> Result<Option<SoulSession>, String> {
    conn.query_row(
        r#"
        SELECT id, soul_id, session_id, session_memory, provider_state, next_seq,
               last_seen_session_seq, parent_soul_session_id, fork_point, created_at, updated_at
        FROM soul_sessions
        WHERE id = ?1
        LIMIT 1
        "#,
        params![soul_session_id],
        map_soul_session_row,
    )
    .optional()
    .map_err(|error| error.to_string())
}

pub(super) fn message_by_id(
    conn: &Connection,
    message_id: &str,
) -> Result<Option<SessionMessage>, String> {
    conn.query_row(
        r#"
        SELECT r.session_id, r.message_id, r.session_seq, r.created_at,
               m.id, m.actor_type, m.actor_id, m.content, m.state, m.version,
               m.deleted_at, m.created_at, m.updated_at
        FROM r_session_messages r
        JOIN messages m ON m.id = r.message_id
        WHERE r.message_id = ?1
        LIMIT 1
        "#,
        params![message_id],
        map_session_message_row,
    )
    .optional()
    .map_err(|error| error.to_string())
}

pub(super) fn session_messages(
    conn: &Connection,
    session_id: &str,
) -> Result<Vec<SessionMessage>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT r.session_id, r.message_id, r.session_seq, r.created_at,
                   m.id, m.actor_type, m.actor_id, m.content, m.state, m.version,
                   m.deleted_at, m.created_at, m.updated_at
            FROM r_session_messages r
            JOIN messages m ON m.id = r.message_id
            WHERE r.session_id = ?1 AND m.deleted_at IS NULL
            ORDER BY r.session_seq ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(params![session_id], map_session_message_row)
        .map_err(|error| error.to_string())?;
    collect_rows(rows)
}

pub(super) fn turn_by_id(conn: &Connection, turn_id: &str) -> Result<Option<Turn>, String> {
    conn.query_row(
        r#"
        SELECT id, soul_session_id, trigger_type, trigger_ref, input_through_session_seq,
               base_soul_session_seq, end_soul_session_seq, status, error_text,
               created_at, updated_at, finished_at
        FROM turns
        WHERE id = ?1
        LIMIT 1
        "#,
        params![turn_id],
        map_turn_row,
    )
    .optional()
    .map_err(|error| error.to_string())
}

pub(super) fn compact_by_id(
    conn: &Connection,
    compact_id: &str,
) -> Result<Option<Compact>, String> {
    conn.query_row(
        r#"
        SELECT id, turn_id, summary, start_session_seq, end_session_seq, created_at
        FROM compacts WHERE id = ?1 LIMIT 1
        "#,
        params![compact_id],
        map_compact_row,
    )
    .optional()
    .map_err(|error| error.to_string())
}

pub(super) fn turn_soul_session_id(conn: &Connection, turn_id: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT soul_session_id FROM turns WHERE id = ?1 LIMIT 1",
        params![turn_id],
        |row| row.get(0),
    )
    .map_err(|error| error.to_string())
}

pub(super) fn call_soul_id(conn: &Connection, tool_call_id: &str) -> Result<String, String> {
    conn.query_row(
        r#"
        SELECT t.soul_session_id
        FROM tool_calls c
        JOIN turns t ON t.id = c.turn_id
        WHERE c.id = ?1
        LIMIT 1
        "#,
        params![tool_call_id],
        |row| row.get(0),
    )
    .map_err(|error| error.to_string())
}

pub(super) fn tool_call_by_id(
    conn: &Connection,
    tool_call_id: &str,
) -> Result<Option<ToolCall>, String> {
    conn.query_row(
        "SELECT id, turn_id, tool_name, arguments, created_at FROM tool_calls WHERE id = ?1 LIMIT 1",
        params![tool_call_id],
        map_tool_call_row,
    )
    .optional()
    .map_err(|error| error.to_string())
}

pub(super) fn tool_result_by_id(
    conn: &Connection,
    tool_result_id: &str,
) -> Result<Option<ToolResult>, String> {
    conn.query_row(
        "SELECT id, tool_call_id, output, error_text, created_at FROM tool_results WHERE id = ?1 LIMIT 1",
        params![tool_result_id],
        map_tool_result_row,
    )
    .optional()
    .map_err(|error| error.to_string())
}

pub(super) fn turns_for_soul_session(
    conn: &Connection,
    soul_session_id: &str,
) -> Result<Vec<Turn>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, soul_session_id, trigger_type, trigger_ref, input_through_session_seq,
                   base_soul_session_seq, end_soul_session_seq, status, error_text,
                   created_at, updated_at, finished_at
            FROM turns
            WHERE soul_session_id = ?1
            ORDER BY created_at ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(params![soul_session_id], map_turn_row)
        .map_err(|error| error.to_string())?;
    collect_rows(rows)
}

pub(super) fn soul_tool_calls(
    conn: &Connection,
    soul_session_id: &str,
) -> Result<Vec<ToolCall>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT c.id, c.turn_id, c.tool_name, c.arguments, c.created_at
            FROM tool_calls c
            JOIN turns t ON t.id = c.turn_id
            WHERE t.soul_session_id = ?1
            ORDER BY c.created_at ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(params![soul_session_id], map_tool_call_row)
        .map_err(|error| error.to_string())?;
    collect_rows(rows)
}

pub(super) fn tool_calls_for_turn(
    conn: &Connection,
    turn_id: &str,
) -> Result<Vec<ToolCall>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, turn_id, tool_name, arguments, created_at FROM tool_calls WHERE turn_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(params![turn_id], map_tool_call_row)
        .map_err(|error| error.to_string())?;
    collect_rows(rows)
}

pub(super) fn soul_tool_results(
    conn: &Connection,
    soul_session_id: &str,
) -> Result<Vec<ToolResult>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT r.id, r.tool_call_id, r.output, r.error_text, r.created_at
            FROM tool_results r
            JOIN tool_calls c ON c.id = r.tool_call_id
            JOIN turns t ON t.id = c.turn_id
            WHERE t.soul_session_id = ?1
            ORDER BY r.created_at ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(params![soul_session_id], map_tool_result_row)
        .map_err(|error| error.to_string())?;
    collect_rows(rows)
}

pub(super) fn tool_results_for_turn(
    conn: &Connection,
    turn_id: &str,
) -> Result<Vec<ToolResult>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT r.id, r.tool_call_id, r.output, r.error_text, r.created_at
            FROM tool_results r
            JOIN tool_calls c ON c.id = r.tool_call_id
            WHERE c.turn_id = ?1
            ORDER BY r.created_at ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(params![turn_id], map_tool_result_row)
        .map_err(|error| error.to_string())?;
    collect_rows(rows)
}

pub(super) fn compacts_for_soul_session(
    conn: &Connection,
    soul_session_id: &str,
) -> Result<Vec<Compact>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT c.id, c.turn_id, c.summary, c.start_session_seq, c.end_session_seq, c.created_at
            FROM compacts c
            JOIN turns t ON t.id = c.turn_id
            WHERE t.soul_session_id = ?1
            ORDER BY c.created_at ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(params![soul_session_id], map_compact_row)
        .map_err(|error| error.to_string())?;
    collect_rows(rows)
}

pub(super) fn session_effects(
    conn: &Connection,
    session_id: &str,
) -> Result<Vec<SessionEffect>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, session_id, effect_type, idempotency_key, status, source_hook_id,
                   source_turn_id, result_ref, error_text, created_at, updated_at
            FROM session_effects
            WHERE session_id = ?1
            ORDER BY created_at ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(params![session_id], map_session_effect_row)
        .map_err(|error| error.to_string())?;
    collect_rows(rows)
}

pub(super) fn session_message_to_provider(
    message: &SessionMessage,
) -> Option<crate::ProviderInputMessage> {
    let role = match message.message.actor_type {
        ActorType::Account => "user",
        ActorType::Soul => "assistant",
        ActorType::System => "system",
    };
    let content = message.message.content.content_text();
    if content.trim().is_empty() {
        None
    } else {
        Some(crate::ProviderInputMessage {
            role: role.to_string(),
            content,
        })
    }
}

pub(super) fn collect_rows<T>(
    rows: impl Iterator<Item = rusqlite::Result<T>>,
) -> Result<Vec<T>, String> {
    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|error| error.to_string())?);
    }
    Ok(items)
}
