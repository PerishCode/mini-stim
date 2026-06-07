use async_trait::async_trait;
use futures_util::StreamExt;
use futures_util::stream;
use santi_core::{ChatService, ChatServiceConfig, SendMessageRequest, StreamEvent};
use santi_provider::{
    ProviderClient, ProviderEvent, ProviderMetadata, ProviderRequest, ProviderStream,
};
use std::sync::{Arc, Mutex};

#[derive(Clone, Default)]
struct FakeProvider {
    requests: Arc<Mutex<Vec<ProviderRequest>>>,
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
        self.requests.lock().unwrap().push(request);
        Ok(Box::pin(stream::iter(vec![
            Ok(ProviderEvent::TextDelta("hi".to_string())),
            Ok(ProviderEvent::Completed {
                provider_response_id: Some("fake-response-id".to_string()),
            }),
        ])))
    }
}

#[tokio::test]
async fn service_uses_provider_trait() {
    let temp = tempfile::tempdir().expect("temp dir");
    let provider = Arc::new(FakeProvider::default());
    let service = ChatService::open(
        ChatServiceConfig {
            database_path: temp.path().join("chat.sqlite").display().to_string(),
        },
        provider.clone(),
    )
    .expect("open service");

    let events = service
        .send_message(SendMessageRequest {
            conversation_id: None,
            text: "hello provider".to_string(),
        })
        .collect::<Vec<_>>()
        .await;

    assert_eq!(events.len(), 3);
    let accepted = match &events[0] {
        Ok(StreamEvent::Accepted { accepted }) => accepted,
        other => panic!("unexpected first event: {other:?}"),
    };
    match &events[1] {
        Ok(StreamEvent::TextDelta { delta, .. }) => assert_eq!(delta, "hi"),
        other => panic!("unexpected second event: {other:?}"),
    }
    match &events[2] {
        Ok(StreamEvent::MessageCompleted {
            provider_response_id,
            message,
            ..
        }) => {
            assert_eq!(provider_response_id.as_deref(), Some("fake-response-id"));
            assert_eq!(message.text, "hi");
        }
        other => panic!("unexpected third event: {other:?}"),
    }

    let requests = provider.requests.lock().unwrap();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].model, "fake-model");
    assert_eq!(requests[0].input.len(), 1);
    assert_eq!(requests[0].input[0].role, "user");
    assert_eq!(requests[0].input[0].content, "hello provider");

    let detail = service
        .conversation(&accepted.conversation_id)
        .expect("load detail")
        .expect("conversation");
    assert_eq!(detail.messages.len(), 2);
    assert_eq!(detail.messages[0].text, "hello provider");
    assert_eq!(detail.messages[1].text, "hi");
}
