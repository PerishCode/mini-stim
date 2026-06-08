use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

pub type Timestamp = String;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HealthResponse {
    pub ok: bool,
    pub service: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Session {
    pub id: String,
    pub parent_session_id: Option<String>,
    pub fork_point: Option<i64>,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Soul {
    pub id: String,
    pub memory: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActorType {
    Account,
    Soul,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MessageState {
    Pending,
    Fixed,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MessageContent {
    pub parts: Vec<MessagePart>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MessagePart {
    Text {
        text: String,
    },
    Image {
        mime_type: String,
        data_base64: String,
    },
}

impl MessageContent {
    pub fn text(text: impl Into<String>) -> Self {
        Self {
            parts: vec![MessagePart::Text { text: text.into() }],
        }
    }

    pub fn content_text(&self) -> String {
        self.parts
            .iter()
            .filter_map(|part| match part {
                MessagePart::Text { text } => Some(text.as_str()),
                MessagePart::Image { .. } => None,
            })
            .collect::<Vec<_>>()
            .join("\n\n")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Message {
    pub id: String,
    pub actor_type: ActorType,
    pub actor_id: String,
    pub content: MessageContent,
    pub state: MessageState,
    pub version: i64,
    pub deleted_at: Option<Timestamp>,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SessionMessageRef {
    pub session_id: String,
    pub message_id: String,
    pub session_seq: i64,
    pub created_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SessionMessage {
    pub relation: SessionMessageRef,
    pub message: Message,
    pub content_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MessageEvent {
    pub id: String,
    pub message_id: String,
    pub action: String,
    pub actor_type: ActorType,
    pub actor_id: String,
    pub base_version: i64,
    pub payload: Value,
    pub created_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SoulSession {
    pub id: String,
    pub soul_id: String,
    pub session_id: String,
    pub session_memory: String,
    pub provider_state: Option<Value>,
    pub next_seq: i64,
    pub last_seen_session_seq: i64,
    pub parent_soul_session_id: Option<String>,
    pub fork_point: Option<i64>,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TurnTriggerType {
    SessionSend,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TurnStatus {
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Turn {
    pub id: String,
    pub soul_session_id: String,
    pub trigger_type: TurnTriggerType,
    pub trigger_ref: Option<String>,
    pub input_through_session_seq: i64,
    pub base_soul_session_seq: i64,
    pub end_soul_session_seq: Option<i64>,
    pub status: TurnStatus,
    pub error_text: Option<String>,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
    pub finished_at: Option<Timestamp>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ToolCall {
    pub id: String,
    pub turn_id: String,
    pub tool_name: String,
    pub arguments: Value,
    pub created_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ToolResult {
    pub id: String,
    pub tool_call_id: String,
    pub output: Option<Value>,
    pub error_text: Option<String>,
    pub created_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Compact {
    pub id: String,
    pub turn_id: String,
    pub summary: String,
    pub start_session_seq: i64,
    pub end_session_seq: i64,
    pub created_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SessionEffect {
    pub id: String,
    pub session_id: String,
    pub effect_type: String,
    pub idempotency_key: String,
    pub status: String,
    pub source_hook_id: String,
    pub source_turn_id: String,
    pub result_ref: Option<String>,
    pub error_text: Option<String>,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SoulSessionTargetType {
    Message,
    Compact,
    ToolCall,
    ToolResult,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SoulSessionEntry {
    pub soul_session_id: String,
    pub target_type: SoulSessionTargetType,
    pub target_id: String,
    pub soul_session_seq: i64,
    pub created_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProviderInputMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateSessionResponse {
    pub session: Session,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SessionDetail {
    pub session: Session,
    pub messages: Vec<SessionMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SendSessionRequest {
    pub content: Vec<MessagePart>,
}

impl SendSessionRequest {
    pub fn text(&self) -> String {
        MessageContent {
            parts: self.content.clone(),
        }
        .content_text()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SendSessionResponse {
    pub session: Session,
    pub soul_session: SoulSession,
    pub turn: Turn,
    pub user_message: SessionMessage,
    pub assistant_message: SessionMessage,
    pub tool_calls: Vec<ToolCall>,
    pub tool_results: Vec<ToolResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SessionRuntimeSnapshot {
    pub session: Session,
    pub soul_session: Option<SoulSession>,
    pub messages: Vec<SessionMessage>,
    pub turns: Vec<Turn>,
    pub tool_calls: Vec<ToolCall>,
    pub tool_results: Vec<ToolResult>,
    pub compacts: Vec<Compact>,
    pub effects: Vec<SessionEffect>,
}

pub fn timestamp_now() -> Timestamp {
    use std::time::{SystemTime, UNIX_EPOCH};

    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch");
    format!("{}-{:03}", duration.as_secs(), duration.subsec_millis())
}

pub fn prefixed_id(prefix: &str) -> String {
    format!("{prefix}_{}", uuid::Uuid::new_v4().simple())
}
