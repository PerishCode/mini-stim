use async_stream::try_stream;
use async_trait::async_trait;
use futures_core::Stream;
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use std::sync::Arc;

use crate::{ProviderClient, ProviderEvent, ProviderMetadata, ProviderRequest, ProviderStream};

#[derive(Debug, Clone)]
pub struct OpenAIProviderConfig {
    pub api_key: String,
    pub model: String,
    pub base_url: String,
    pub reasoning_effort: Option<String>,
    pub max_output_tokens: Option<u32>,
}

#[derive(Debug, Clone)]
pub struct OpenAIProvider {
    config: OpenAIProviderConfig,
    client: Client,
}

impl OpenAIProvider {
    pub fn new(config: OpenAIProviderConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }
}

#[async_trait]
impl ProviderClient for OpenAIProvider {
    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            provider: Arc::from("openai"),
            model: self.config.model.clone(),
        }
    }

    async fn stream_response(&self, request: ProviderRequest) -> Result<ProviderStream, String> {
        let response = self
            .client
            .post(format!(
                "{}/responses",
                self.config.base_url.trim_end_matches('/')
            ))
            .bearer_auth(&self.config.api_key)
            .json(&response_body(&self.config, request))
            .send()
            .await
            .map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("openai responses request failed: {status} {body}"));
        }
        Ok(Box::pin(parse_sse(response.bytes_stream())))
    }
}

fn response_body(config: &OpenAIProviderConfig, request: ProviderRequest) -> Value {
    let mut body = Map::from_iter([
        ("model".to_string(), json!(request.model)),
        ("input".to_string(), json!(response_input(request.input))),
        ("stream".to_string(), json!(true)),
        (
            "stream_options".to_string(),
            json!({
                "include_obfuscation": false
            }),
        ),
    ]);

    if let Some(reasoning_effort) = &config.reasoning_effort {
        body.insert(
            "reasoning".to_string(),
            json!({
                "effort": reasoning_effort
            }),
        );
    }
    if let Some(max_output_tokens) = config.max_output_tokens {
        body.insert("max_output_tokens".to_string(), json!(max_output_tokens));
    }

    Value::Object(body)
}

fn response_input(messages: Vec<crate::ProviderMessage>) -> Vec<ResponseInputMessage> {
    messages
        .into_iter()
        .map(|message| ResponseInputMessage {
            role: message.role,
            content: message.content,
        })
        .collect()
}

fn parse_sse(
    mut bytes: impl Stream<Item = Result<bytes::Bytes, reqwest::Error>> + Unpin + Send + 'static,
) -> impl Stream<Item = Result<ProviderEvent, String>> + Send + 'static {
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

fn parse_event(payload: &str) -> Result<Option<ProviderEvent>, String> {
    let value = serde_json::from_str::<OpenAIEvent>(payload).map_err(|error| error.to_string())?;
    match value.event_type.as_str() {
        "response.output_text.delta" => Ok(value
            .delta
            .filter(|delta| !delta.is_empty())
            .map(ProviderEvent::TextDelta)),
        "response.completed" => Ok(Some(ProviderEvent::Completed {
            provider_response_id: value
                .response
                .and_then(|response| response.id)
                .or(value.response_id),
        })),
        "error" => Ok(Some(ProviderEvent::Failed(
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
struct OpenAIEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    delta: Option<String>,
    #[serde(default)]
    response: Option<OpenAIResponse>,
    #[serde(default)]
    response_id: Option<String>,
    #[serde(default)]
    error: Option<OpenAIError>,
}

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIError {
    message: Option<String>,
    #[allow(dead_code)]
    raw: Option<Value>,
}
