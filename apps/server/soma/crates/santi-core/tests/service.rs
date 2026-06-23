use async_trait::async_trait;
use futures_util::stream;
use santi_core::{
    MessagePart, ObjectBucket, ObjectUri, SantiService, SantiServiceConfig, SendSessionRequest,
};
use santi_provider::{
    ProviderClient, ProviderEvent, ProviderFunctionCall, ProviderMetadata, ProviderRequest,
    ProviderStream,
};
use serde_json::json;
use std::sync::{Arc, Mutex};
use tokio::time::{Duration, sleep};

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
                        "arguments": r#"{"command":"pwd && printf \"\\n$SANTI_SESSION_MEMORY_DIR\"","cwd":"@session"}"#,
                    }),
                    call_id: "call_shell".to_string(),
                    name: "shell".to_string(),
                    arguments_raw: r#"{"command":"pwd && printf \"\\n$SANTI_SESSION_MEMORY_DIR\"","cwd":"@session"}"#.to_string(),
                    arguments: json!({
                        "command": "pwd && printf \"\\n$SANTI_SESSION_MEMORY_DIR\"",
                        "cwd": "@session"
                    }),
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
    assert_eq!(response.turn.status, santi_core::TurnStatus::Running);
    let runtime = wait_for_completed_turn(&service, &session.session.id, &response.turn.id).await;
    assert!(
        runtime
            .messages
            .iter()
            .any(|message| message.content_text == "hi from runtime")
    );

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
    assert!(instructions.contains("You are a distinct soul running inside this Santi instance."));
    assert!(instructions.contains("[santi-meta]"));
    assert!(instructions.contains("channel: mini-stim"));
    assert!(instructions.contains("soul_name: Liberte"));
    assert!(instructions.contains("[santi-soul]"));
    assert!(instructions.contains("[santi-session]"));
    assert!(instructions.contains("source: @soul/MEMORY.md"));
    assert!(instructions.contains("source: @session/MEMORY.md"));
    assert!(!instructions.contains("<santi-runtime>"));
    assert!(!instructions.contains("<santi-tools>"));
    let tool_names = requests[0]
        .tools
        .as_ref()
        .expect("tools")
        .iter()
        .map(|tool| match tool {
            santi_provider::ProviderTool::Function(tool) => tool.name.as_str(),
        })
        .collect::<Vec<_>>();
    assert_eq!(tool_names, vec!["shell"]);

    let detail = service
        .session(&session.session.id)
        .expect("load detail")
        .expect("session");
    assert_eq!(detail.messages.len(), 2);
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

    assert_eq!(response.turn.status, santi_core::TurnStatus::Running);
    let runtime = wait_for_completed_turn(&service, &session.session.id, &response.turn.id).await;
    assert!(
        runtime
            .messages
            .iter()
            .any(|message| message.content_text == "hi from runtime")
    );
    assert_eq!(runtime.tool_calls.len(), 1);
    assert_eq!(runtime.tool_calls[0].tool_name, "shell");
    assert_eq!(runtime.tool_results.len(), 1);
    assert!(runtime.tool_results[0].error_text.is_none());
    let output = runtime.tool_results[0]
        .output
        .as_ref()
        .expect("tool output");
    let stdout = output
        .get("stdout")
        .and_then(|value| value.as_str())
        .expect("shell stdout");
    let session_memory_dir = format!("runtime/sessions/{}/memory", session.session.id);
    assert!(stdout.contains(&session_memory_dir));
    let cwd = output
        .get("cwd")
        .and_then(|value| value.as_str())
        .expect("shell cwd");
    assert!(cwd.ends_with(&session_memory_dir));

    let requests = provider.requests.lock().unwrap();
    assert_eq!(requests.len(), 2);
    assert!(requests[1].previous_response_id.is_none());
    assert!(requests[1].function_call_outputs.is_some());
}

async fn wait_for_completed_turn(
    service: &SantiService,
    session_id: &str,
    turn_id: &str,
) -> santi_core::SessionRuntimeSnapshot {
    for _ in 0..50 {
        let runtime = service
            .runtime_snapshot(session_id)
            .expect("runtime snapshot")
            .expect("session runtime");
        if runtime
            .turns
            .iter()
            .any(|turn| turn.id == turn_id && turn.status == santi_core::TurnStatus::Completed)
        {
            return runtime;
        }
        sleep(Duration::from_millis(20)).await;
    }
    panic!("turn did not complete");
}

#[tokio::test]
async fn bucket_objects_are_scoped() {
    let temp = tempfile::tempdir().expect("temp dir");
    let service = SantiService::open(
        SantiServiceConfig {
            database_path: temp.path().join("santi.sqlite").display().to_string(),
            runtime_root: temp.path().join("runtime").display().to_string(),
            execution_root: temp.path().join("execution").display().to_string(),
            bind_addr: Some("127.0.0.1:0".to_string()),
        },
        Arc::new(FakeProvider::default()),
    )
    .expect("open service");
    let session = service.create_session().expect("create session").session;
    let bucket = ObjectBucket::new("soul_default", session.session.id.as_str()).expect("bucket");
    let uri = ObjectUri::new(bucket.clone(), "avatars/santi.svg").expect("uri");

    let meta = service
        .put_bucket_object(&uri, b"<svg>avatar</svg>")
        .expect("put object");
    assert_eq!(meta.uri.as_santi_uri(), uri.as_santi_uri());
    assert_eq!(meta.len, 17);
    assert_eq!(
        service
            .renderable_ref(&uri.as_santi_uri())
            .expect("renderable ref"),
        format!(
            "/api/v1/bucket/soul_default/{}/avatars/santi.svg",
            session.session.id
        )
    );

    let object = service
        .get_bucket_object("soul_default", &session.session.id, "avatars/santi.svg")
        .expect("get object")
        .expect("object exists");
    assert_eq!(object.bytes, b"<svg>avatar</svg>");
    let objects = service
        .list_bucket_objects(&bucket, Some("avatars"))
        .expect("list objects");
    assert_eq!(objects.len(), 1);
    assert_eq!(objects[0].uri.key, "avatars/santi.svg");
    let objects = service
        .list_bucket_objects(&bucket, Some("avatars/santi"))
        .expect("list object prefix");
    assert_eq!(objects.len(), 1);
    assert!(service.delete_bucket_object(&uri).expect("delete object"));
    assert!(
        service
            .get_bucket_object("soul_default", &session.session.id, "avatars/santi.svg")
            .expect("get deleted object")
            .is_none()
    );
}

#[tokio::test]
async fn bucket_rejects_unsafe_keys() {
    let temp = tempfile::tempdir().expect("temp dir");
    let service = SantiService::open(
        SantiServiceConfig {
            database_path: temp.path().join("santi.sqlite").display().to_string(),
            runtime_root: temp.path().join("runtime").display().to_string(),
            execution_root: temp.path().join("execution").display().to_string(),
            bind_addr: Some("127.0.0.1:0".to_string()),
        },
        Arc::new(FakeProvider::default()),
    )
    .expect("open service");
    let session = service.create_session().expect("create session").session;

    assert!(
        service
            .get_bucket_object("soul_default", &session.session.id, "../escape.txt")
            .expect_err("unsafe key")
            .contains("object key")
    );
    assert!(
        service
            .get_bucket_object("soul_default", &session.session.id, "bad//key.txt")
            .expect_err("empty segment")
            .contains("object key")
    );
    assert!(
        service
            .get_bucket_object("unknown_soul", &session.session.id, "safe.txt")
            .expect_err("unknown soul")
            .contains("soul not found")
    );
}
