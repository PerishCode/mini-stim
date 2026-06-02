use async_stream::try_stream;
use futures_core::Stream;
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::{MessageRole, TranscriptMessage};

#[derive(Debug, Clone)]
pub struct OpenAiResponsesConfig {
    pub api_key: String,
    pub model: String,
    pub base_url: String,
}

#[derive(Debug, Clone)]
pub struct OpenAiResponsesClient {
    config: OpenAiResponsesConfig,
    client: Client,
}

#[derive(Debug, Clone)]
pub enum OpenAiStreamEvent {
    TextDelta(String),
    Completed { response_id: Option<String> },
    Failed(String),
}

impl OpenAiResponsesClient {
    pub fn new(config: OpenAiResponsesConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }

    pub fn model(&self) -> &str {
        &self.config.model
    }

    pub async fn stream_response(
        &self,
        transcript: Vec<TranscriptMessage>,
    ) -> Result<impl Stream<Item = Result<OpenAiStreamEvent, String>> + Send + 'static, String>
    {
        let response = self
            .client
            .post(format!(
                "{}/responses",
                self.config.base_url.trim_end_matches('/')
            ))
            .bearer_auth(&self.config.api_key)
            .json(&json!({
                "model": self.config.model,
                "input": response_input(transcript),
                "stream": true,
                "stream_options": {
                    "include_obfuscation": false
                }
            }))
            .send()
            .await
            .map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("openai responses request failed: {status} {body}"));
        }
        Ok(parse_sse(response.bytes_stream()))
    }
}

fn response_input(transcript: Vec<TranscriptMessage>) -> Vec<ResponseInputMessage> {
    transcript
        .into_iter()
        .map(|message| ResponseInputMessage {
            role: match message.role {
                MessageRole::User => "user".to_string(),
                MessageRole::Assistant => "assistant".to_string(),
            },
            content: message.text,
        })
        .collect()
}

fn parse_sse(
    mut bytes: impl Stream<Item = Result<bytes::Bytes, reqwest::Error>> + Unpin + Send + 'static,
) -> impl Stream<Item = Result<OpenAiStreamEvent, String>> + Send + 'static {
    try_stream! {
        let mut buffer = String::new();
        while let Some(chunk) = bytes.next().await {
            let chunk = chunk.map_err(|error| error.to_string())?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));
            while let Some(index) = buffer.find('\n') {
                let line = buffer[..index].trim_end_matches('\r').to_string();
                buffer = buffer[index + 1..].to_string();
                if let Some(payload) = line.strip_prefix("data: ") {
                    if payload == "[DONE]" {
                        continue;
                    }
                    if let Some(event) = parse_event(payload)? {
                        yield event;
                    }
                }
            }
        }
    }
}

fn parse_event(payload: &str) -> Result<Option<OpenAiStreamEvent>, String> {
    let value = serde_json::from_str::<OpenAiEvent>(payload).map_err(|error| error.to_string())?;
    match value.event_type.as_str() {
        "response.output_text.delta" => Ok(value
            .delta
            .filter(|delta| !delta.is_empty())
            .map(OpenAiStreamEvent::TextDelta)),
        "response.completed" => Ok(Some(OpenAiStreamEvent::Completed {
            response_id: value
                .response
                .and_then(|response| response.id)
                .or(value.response_id),
        })),
        "error" => Ok(Some(OpenAiStreamEvent::Failed(
            value
                .error
                .and_then(|error| error.message)
                .unwrap_or_else(|| "openai stream error".to_string()),
        ))),
        _ => Ok(None),
    }
}

#[derive(Debug, Clone, Serialize)]
struct ResponseInputMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct OpenAiEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    delta: Option<String>,
    #[serde(default)]
    response: Option<OpenAiResponse>,
    #[serde(default)]
    response_id: Option<String>,
    #[serde(default)]
    error: Option<OpenAiError>,
}

#[derive(Debug, Deserialize)]
struct OpenAiResponse {
    id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAiError {
    message: Option<String>,
    #[allow(dead_code)]
    raw: Option<Value>,
}
