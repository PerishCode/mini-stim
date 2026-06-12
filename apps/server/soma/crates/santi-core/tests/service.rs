use async_trait::async_trait;
use futures_util::stream;
use santi_core::{MessagePart, SantiService, SantiServiceConfig, SendSessionRequest};
use santi_provider::{
    ProviderClient, ProviderEvent, ProviderFunctionCall, ProviderMetadata, ProviderRequest,
    ProviderStream,
};
use serde_json::json;
use std::sync::{Arc, Mutex};

#[derive(Clone, Default)]
struct FakeProvider {
    requests: Arc<Mutex<Vec<ProviderRequest>>>,
    request_tool: bool,
}

#[async_trait]
impl ProviderClient for FakeProvider {
    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            provider: Arc::from("fake-provider"),
            model: "fake-model".to_string(),
        }
    }

    async fn stream_response(&self, request: ProviderRequest) -> Result<ProviderStream, String> {
        let index = {
            let mut requests = self.requests.lock().unwrap();
            requests.push(request);
            requests.len()
        };
        if self.request_tool && index == 1 {
            return Ok(Box::pin(stream::iter(vec![
                Ok(ProviderEvent::FunctionCallRequested(ProviderFunctionCall {
                    response_id: "resp_tool".to_string(),
                    item_id: Some("item_tool".to_string()),
                    item: json!({
                        "type": "function_call",
                        "id": "item_tool",
                        "call_id": "call_shell",
                        "name": "shell",
                        "arguments": r#"{"command":"printf tool-ok"}"#,
                    }),
                    call_id: "call_shell".to_string(),
                    name: "shell".to_string(),
                    arguments_raw: r#"{"command":"printf tool-ok"}"#.to_string(),
                    arguments: json!({ "command": "printf tool-ok" }),
                })),
                Ok(ProviderEvent::Completed {
                    provider_response_id: Some("resp_tool".to_string()),
                }),
            ])));
        }
        Ok(Box::pin(stream::iter(vec![
            Ok(ProviderEvent::TextDelta("hi from runtime".to_string())),
            Ok(ProviderEvent::Completed {
                provider_response_id: Some("fake-response-id".to_string()),
            }),
        ])))
    }
}

#[tokio::test]
async fn sends_with_runtime() {
    let temp = tempfile::tempdir().expect("temp dir");
    let provider = Arc::new(FakeProvider::default());
    let service = SantiService::open(
        SantiServiceConfig {
            database_path: temp.path().join("santi.sqlite").display().to_string(),
            runtime_root: temp.path().join("runtime").display().to_string(),
            execution_root: temp.path().join("execution").display().to_string(),
            bind_addr: Some("127.0.0.1:0".to_string()),
        },
        provider.clone(),
    )
    .expect("open service");

    let session = service.create_session().expect("create session").session;
    let response = service
        .send_session(
            &session.session.id,
            SendSessionRequest {
                content: vec![MessagePart::Text {
                    text: "hello provider".to_string(),
                }],
            },
        )
        .await
        .expect("send session");

    assert_eq!(response.user_message.content_text, "hello provider");
    assert_eq!(response.assistant_message.content_text, "hi from runtime");
    assert_eq!(response.turn.status, santi_core::TurnStatus::Completed);

    let requests = provider.requests.lock().unwrap();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].model, "fake-model");
    assert_eq!(requests[0].input.len(), 1);
    assert_eq!(requests[0].input[0].role, "user");
    assert_eq!(requests[0].input[0].content, "hello provider");
    let instructions = requests[0]
        .instructions
        .as_deref()
        .expect("runtime instructions");
    assert!(instructions.contains("You are santi"));
    assert!(instructions.contains("<santi-runtime>"));
    assert!(instructions.contains("<santi-tools>"));
    let tool_names = requests[0]
        .tools
        .as_ref()
        .expect("tools")
        .iter()
        .map(|tool| match tool {
            santi_provider::ProviderTool::Function(tool) => tool.name.as_str(),
        })
        .collect::<Vec<_>>();
    assert_eq!(
        tool_names,
        vec!["write_soul_memory", "write_session_memory", "shell"]
    );

    let detail = service
        .session(&session.session.id)
        .expect("load detail")
        .expect("session");
    assert_eq!(detail.messages.len(), 2);
    let runtime = service
        .runtime_snapshot(&session.session.id)
        .expect("runtime snapshot")
        .expect("session runtime");
    assert_eq!(runtime.turns.len(), 1);
}

#[tokio::test]
async fn dispatches_tools() {
    let temp = tempfile::tempdir().expect("temp dir");
    let provider = Arc::new(FakeProvider {
        request_tool: true,
        ..FakeProvider::default()
    });
    let service = SantiService::open(
        SantiServiceConfig {
            database_path: temp.path().join("santi.sqlite").display().to_string(),
            runtime_root: temp.path().join("runtime").display().to_string(),
            execution_root: temp.path().join("execution").display().to_string(),
            bind_addr: Some("127.0.0.1:0".to_string()),
        },
        provider.clone(),
    )
    .expect("open service");

    let session = service.create_session().expect("create session").session;
    let response = service
        .send_session(
            &session.session.id,
            SendSessionRequest {
                content: vec![MessagePart::Text {
                    text: "run tool".to_string(),
                }],
            },
        )
        .await
        .expect("send session");

    assert_eq!(response.assistant_message.content_text, "hi from runtime");
    assert_eq!(response.tool_calls.len(), 1);
    assert_eq!(response.tool_calls[0].tool_name, "shell");
    assert_eq!(response.tool_results.len(), 1);
    assert!(response.tool_results[0].error_text.is_none());

    let requests = provider.requests.lock().unwrap();
    assert_eq!(requests.len(), 2);
    assert!(requests[1].previous_response_id.is_none());
    assert!(requests[1].function_call_outputs.is_some());
}
