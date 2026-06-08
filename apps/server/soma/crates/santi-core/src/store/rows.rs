use rusqlite::Row;
use serde_json::Value;

use crate::{
    ActorType, Compact, Message, MessageContent, MessageState, Session, SessionEffect,
    SessionMessage, SessionMessageRef, SoulSession, SoulSessionTargetType, ToolCall, ToolResult,
    Turn, TurnStatus, TurnTriggerType,
};

pub(super) fn map_session_row(row: &Row<'_>) -> rusqlite::Result<Session> {
    Ok(Session {
        id: row.get(0)?,
        parent_session_id: row.get(1)?,
        fork_point: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

pub(super) fn map_soul_session_row(row: &Row<'_>) -> rusqlite::Result<SoulSession> {
    let provider_state: Option<String> = row.get(4)?;
    Ok(SoulSession {
        id: row.get(0)?,
        soul_id: row.get(1)?,
        session_id: row.get(2)?,
        session_memory: row.get(3)?,
        provider_state: provider_state.and_then(|value| serde_json::from_str(&value).ok()),
        next_seq: row.get(5)?,
        last_seen_session_seq: row.get(6)?,
        parent_soul_session_id: row.get(7)?,
        fork_point: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

pub(super) fn map_session_message_row(row: &Row<'_>) -> rusqlite::Result<SessionMessage> {
    let content_json: String = row.get(7)?;
    let content = serde_json::from_str::<MessageContent>(&content_json).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(7, rusqlite::types::Type::Text, Box::new(error))
    })?;
    let actor_type = actor_type_from_db(row.get::<_, String>(5)?.as_str());
    let state = message_state_from_db(row.get::<_, String>(8)?.as_str());
    let message = Message {
        id: row.get(4)?,
        actor_type,
        actor_id: row.get(6)?,
        content,
        state,
        version: row.get(9)?,
        deleted_at: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    };
    let content_text = message.content.content_text();
    Ok(SessionMessage {
        relation: SessionMessageRef {
            session_id: row.get(0)?,
            message_id: row.get(1)?,
            session_seq: row.get(2)?,
            created_at: row.get(3)?,
        },
        message,
        content_text,
    })
}

pub(super) fn map_turn_row(row: &Row<'_>) -> rusqlite::Result<Turn> {
    Ok(Turn {
        id: row.get(0)?,
        soul_session_id: row.get(1)?,
        trigger_type: turn_trigger_from_db(row.get::<_, String>(2)?.as_str()),
        trigger_ref: row.get(3)?,
        input_through_session_seq: row.get(4)?,
        base_soul_session_seq: row.get(5)?,
        end_soul_session_seq: row.get(6)?,
        status: turn_status_from_db(row.get::<_, String>(7)?.as_str()),
        error_text: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
        finished_at: row.get(11)?,
    })
}

pub(super) fn map_tool_call_row(row: &Row<'_>) -> rusqlite::Result<ToolCall> {
    let arguments_text: String = row.get(3)?;
    let arguments = serde_json::from_str::<Value>(&arguments_text).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(3, rusqlite::types::Type::Text, Box::new(error))
    })?;
    Ok(ToolCall {
        id: row.get(0)?,
        turn_id: row.get(1)?,
        tool_name: row.get(2)?,
        arguments,
        created_at: row.get(4)?,
    })
}

pub(super) fn map_tool_result_row(row: &Row<'_>) -> rusqlite::Result<ToolResult> {
    let output_text: Option<String> = row.get(2)?;
    Ok(ToolResult {
        id: row.get(0)?,
        tool_call_id: row.get(1)?,
        output: output_text.and_then(|value| serde_json::from_str(&value).ok()),
        error_text: row.get(3)?,
        created_at: row.get(4)?,
    })
}

pub(super) fn map_compact_row(row: &Row<'_>) -> rusqlite::Result<Compact> {
    Ok(Compact {
        id: row.get(0)?,
        turn_id: row.get(1)?,
        summary: row.get(2)?,
        start_session_seq: row.get(3)?,
        end_session_seq: row.get(4)?,
        created_at: row.get(5)?,
    })
}

pub(super) fn map_session_effect_row(row: &Row<'_>) -> rusqlite::Result<SessionEffect> {
    Ok(SessionEffect {
        id: row.get(0)?,
        session_id: row.get(1)?,
        effect_type: row.get(2)?,
        idempotency_key: row.get(3)?,
        status: row.get(4)?,
        source_hook_id: row.get(5)?,
        source_turn_id: row.get(6)?,
        result_ref: row.get(7)?,
        error_text: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

pub(super) fn actor_type_db(value: &ActorType) -> &'static str {
    match value {
        ActorType::Account => "account",
        ActorType::Soul => "soul",
        ActorType::System => "system",
    }
}

fn actor_type_from_db(value: &str) -> ActorType {
    match value {
        "account" => ActorType::Account,
        "soul" => ActorType::Soul,
        "system" => ActorType::System,
        _ => ActorType::System,
    }
}

pub(super) fn message_state_db(value: &MessageState) -> &'static str {
    match value {
        MessageState::Pending => "pending",
        MessageState::Fixed => "fixed",
    }
}

fn message_state_from_db(value: &str) -> MessageState {
    match value {
        "pending" => MessageState::Pending,
        "fixed" => MessageState::Fixed,
        _ => MessageState::Fixed,
    }
}

fn turn_trigger_from_db(value: &str) -> TurnTriggerType {
    match value {
        "session_send" => TurnTriggerType::SessionSend,
        "system" => TurnTriggerType::System,
        _ => TurnTriggerType::System,
    }
}

fn turn_status_from_db(value: &str) -> TurnStatus {
    match value {
        "running" => TurnStatus::Running,
        "completed" => TurnStatus::Completed,
        "failed" => TurnStatus::Failed,
        _ => TurnStatus::Failed,
    }
}

pub(super) fn entry_type_db(value: &SoulSessionTargetType) -> &'static str {
    match value {
        SoulSessionTargetType::Message => "message",
        SoulSessionTargetType::Compact => "compact",
        SoulSessionTargetType::ToolCall => "tool_call",
        SoulSessionTargetType::ToolResult => "tool_result",
    }
}
