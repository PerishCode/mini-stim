use async_stream::try_stream;
use async_trait::async_trait;
use futures_core::Stream;
use futures_util::StreamExt;
use reqwest::Client;
use serde::Deserialize;
use serde_json::{Map, Value, json};
use std::sync::Arc;

use crate::{
    FunctionCallOutput, ProviderClient, ProviderEvent, ProviderFunctionCall, ProviderMetadata,
    ProviderRequest, ProviderStream, ProviderTool,
};

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
        ("input".to_string(), response_input(&request)),
        ("stream".to_string(), json!(true)),
        ("store".to_string(), json!(false)),
        (
            "stream_options".to_string(),
            json!({
                "include_obfuscation": false
            }),
        ),
    ]);

    if let Some(instructions) = request
        .instructions
        .filter(|instructions| !instructions.trim().is_empty())
    {
        body.insert("instructions".to_string(), json!(instructions));
    }
    if let Some(tools) = request.tools {
        body.insert("tools".to_string(), json!(map_tools(tools)));
    }
    if let Some(previous_response_id) = request.previous_response_id {
        body.insert(
            "previous_response_id".to_string(),
            json!(previous_response_id),
        );
    }
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

fn response_input(request: &ProviderRequest) -> Value {
    if let Some(outputs) = &request.function_call_outputs {
        return json!(map_function_call_outputs(outputs));
    }

    json!(
        request
            .input
            .iter()
            .map(|message| {
                let content_type = if message.role == "assistant" {
                    "output_text"
                } else {
                    "input_text"
                };
                json!({
                    "role": message.role,
                    "content": [
                        {
                            "type": content_type,
                            "text": message.content,
                        }
                    ],
                })
            })
            .collect::<Vec<_>>()
    )
}

fn map_tools(tools: Vec<ProviderTool>) -> Vec<Value> {
    tools
        .into_iter()
        .map(|tool| match tool {
            ProviderTool::Function(tool) => json!({
                "type": "function",
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.parameters,
            }),
        })
        .collect()
}

fn map_function_call_outputs(outputs: &[FunctionCallOutput]) -> Vec<Value> {
    outputs
        .iter()
        .map(|output| {
            json!({
                "type": "function_call_output",
                "call_id": output.call_id,
                "output": output.output,
            })
        })
        .collect()
}

fn parse_sse(
    mut bytes: impl Stream<Item = Result<bytes::Bytes, reqwest::Error>> + Unpin + Send + 'static,
) -> impl Stream<Item = Result<ProviderEvent, String>> + Send + 'static {
    try_stream! {
        let mut buffer = String::new();
        let mut current_response_id: Option<String> = None;
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
                    for event in parse_event(payload, &mut current_response_id)? {
                        yield event;
                    }
                }
            }
        }
    }
}

fn parse_event(
    payload: &str,
    current_response_id: &mut Option<String>,
) -> Result<Vec<ProviderEvent>, String> {
    let value = serde_json::from_str::<OpenAIEvent>(payload).map_err(|error| error.to_string())?;
    match value.event_type.as_str() {
        "response.created" | "response.in_progress" => {
            if let Some(response_id) = response_id_from_value(&value.raw) {
                *current_response_id = Some(response_id);
            }
            Ok(Vec::new())
        }
        "response.output_text.delta" => Ok(value
            .delta
            .filter(|delta| !delta.is_empty())
            .map(|delta| vec![ProviderEvent::TextDelta(delta)])
            .unwrap_or_default()),
        "response.output_text.done" => Ok(Vec::new()),
        "response.output_item.done" => parse_output_item_done(value.raw, current_response_id),
        "response.completed" => Ok(vec![ProviderEvent::Completed {
            provider_response_id: value
                .response
                .and_then(|response| response.id)
                .or(value.response_id),
        }]),
        "error" => Ok(vec![ProviderEvent::Failed(
            value
                .error
                .and_then(|error| error.message)
                .unwrap_or_else(|| "openai stream error".to_string()),
        )]),
        _ => Ok(Vec::new()),
    }
}

fn parse_output_item_done(
    raw: Value,
    current_response_id: &Option<String>,
) -> Result<Vec<ProviderEvent>, String> {
    let Some(item) = raw.get("item") else {
        return Ok(Vec::new());
    };
    if item.get("type").and_then(Value::as_str) != Some("function_call") {
        return Ok(Vec::new());
    }
    let response_id = current_response_id
        .clone()
        .or_else(|| response_id_from_value(&raw))
        .ok_or_else(|| "missing response id for function call".to_string())?;
    let call_id = item
        .get("call_id")
        .and_then(Value::as_str)
        .ok_or_else(|| "missing function_call call_id".to_string())?
        .to_string();
    let name = item
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| "missing function_call name".to_string())?
        .to_string();
    let arguments_raw = item
        .get("arguments")
        .and_then(Value::as_str)
        .unwrap_or("{}")
        .to_string();
    let arguments = serde_json::from_str::<Value>(&arguments_raw)
        .map_err(|error| format!("invalid function_call arguments: {error}"))?;

    Ok(vec![ProviderEvent::FunctionCallRequested(
        ProviderFunctionCall {
            response_id,
            item_id: item.get("id").and_then(Value::as_str).map(str::to_string),
            call_id,
            name,
            arguments_raw,
            arguments,
        },
    )])
}

fn response_id_from_value(value: &Value) -> Option<String> {
    value
        .get("response")
        .and_then(|response| response.get("id"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            value
                .get("response_id")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
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
    #[serde(flatten)]
    raw: Value,
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
