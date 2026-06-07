use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

pub type ConversationId = String;
pub type MessageId = String;
pub type ResponseRunId = String;
pub type Timestamp = String;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum MessageRole {
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum MessageState {
    Created,
    Streaming,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ConversationSummary {
    pub conversation_id: ConversationId,
    pub title: Option<String>,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
    pub last_message_preview: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ConversationDetail {
    pub conversation: ConversationSummary,
    pub messages: Vec<MessageRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MessageRecord {
    pub message_id: MessageId,
    pub conversation_id: ConversationId,
    pub role: MessageRole,
    pub state: MessageState,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
    pub completed_at: Option<Timestamp>,
    pub error: Option<String>,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SendMessageRequest {
    pub conversation_id: Option<ConversationId>,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SendMessageAccepted {
    pub conversation_id: ConversationId,
    pub user_message_id: MessageId,
    pub assistant_message_id: MessageId,
    pub response_run_id: ResponseRunId,
    pub user_message: MessageRecord,
    pub assistant_message: MessageRecord,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum StreamEvent {
    Accepted {
        accepted: Box<SendMessageAccepted>,
    },
    TextDelta {
        conversation_id: ConversationId,
        message_id: MessageId,
        delta: String,
    },
    MessageCompleted {
        conversation_id: ConversationId,
        message: Box<MessageRecord>,
        provider_response_id: Option<String>,
    },
    Failed {
        conversation_id: ConversationId,
        message_id: MessageId,
        error: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone)]
pub struct TranscriptMessage {
    pub role: MessageRole,
    pub text: String,
}

pub fn timestamp_now() -> Timestamp {
    use std::time::{SystemTime, UNIX_EPOCH};

    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch");
    format!("{}-{:03}", duration.as_secs(), duration.subsec_millis())
}
