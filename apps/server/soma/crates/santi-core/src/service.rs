use async_stream::stream;
use futures_core::Stream;
use futures_util::StreamExt;
use santi_provider::{ProviderClient, ProviderEvent, ProviderMessage, ProviderRequest};
use std::sync::Arc;

use crate::{ChatStore, ConversationDetail, ConversationSummary, SendMessageRequest, StreamEvent};

#[derive(Clone)]
pub struct ChatService {
    store: ChatStore,
    provider: Arc<dyn ProviderClient>,
}

#[derive(Debug, Clone)]
pub struct ChatServiceConfig {
    pub database_path: String,
}

impl ChatService {
    pub fn open(
        config: ChatServiceConfig,
        provider: Arc<dyn ProviderClient>,
    ) -> Result<Self, String> {
        let store = ChatStore::open(config.database_path)?;
        Ok(Self { store, provider })
    }

    pub fn list_conversations(&self) -> Result<Vec<ConversationSummary>, String> {
        self.store.list_conversations()
    }

    pub fn conversation(
        &self,
        conversation_id: &str,
    ) -> Result<Option<ConversationDetail>, String> {
        self.store.conversation_detail(conversation_id)
    }

    pub fn send_message(
        &self,
        request: SendMessageRequest,
    ) -> impl Stream<Item = Result<StreamEvent, String>> + Send + 'static + use<> {
        let store = self.store.clone();
        let provider = self.provider.clone();
        stream! {
            let provider_metadata = provider.metadata();
            let accepted = match store.begin_send(
                request.conversation_id,
                request.text,
                &provider_metadata.provider,
                &provider_metadata.model,
            ) {
                Ok(accepted) => accepted,
                Err(error) => {
                    yield Err(error);
                    return;
                }
            };
            yield Ok(StreamEvent::Accepted {
                accepted: Box::new(accepted.clone()),
            });

            let transcript = match store.transcript(&accepted.conversation_id) {
                Ok(transcript) => transcript,
                Err(error) => {
                    yield Err(error);
                    return;
                }
            };
            let provider_request = ProviderRequest {
                model: provider_metadata.model.clone(),
                input: transcript
                    .into_iter()
                    .map(|message| ProviderMessage {
                        role: match message.role {
                            crate::MessageRole::User => "user".to_string(),
                            crate::MessageRole::Assistant => "assistant".to_string(),
                        },
                        content: message.text,
                    })
                    .collect(),
            };
            let mut upstream = match provider.stream_response(provider_request).await {
                Ok(upstream) => Box::pin(upstream),
                Err(error) => {
                    let _ = store.fail_run(
                        &accepted.response_run_id,
                        &accepted.assistant_message_id,
                        &error,
                    );
                    yield Ok(StreamEvent::Failed {
                        conversation_id: accepted.conversation_id,
                        message_id: accepted.assistant_message_id,
                        error,
                    });
                    return;
                }
            };

            while let Some(event) = upstream.next().await {
                match event {
                    Ok(ProviderEvent::TextDelta(delta)) => {
                        if let Err(error) = store.append_delta(
                            &accepted.response_run_id,
                            &accepted.assistant_message_id,
                            &delta,
                        ) {
                            yield Err(error);
                            return;
                        }
                        yield Ok(StreamEvent::TextDelta {
                            conversation_id: accepted.conversation_id.clone(),
                            message_id: accepted.assistant_message_id.clone(),
                            delta,
                        });
                    }
                    Ok(ProviderEvent::Completed { provider_response_id }) => {
                        match store.complete_run(
                            &accepted.response_run_id,
                            &accepted.assistant_message_id,
                            provider_response_id.as_deref(),
                        ) {
                            Ok(message) => {
                                yield Ok(StreamEvent::MessageCompleted {
                                    conversation_id: accepted.conversation_id.clone(),
                                    message: Box::new(message),
                                    provider_response_id,
                                });
                            }
                            Err(error) => yield Err(error),
                        }
                        return;
                    }
                    Ok(ProviderEvent::Failed(error)) | Err(error) => {
                        let _ = store.fail_run(
                            &accepted.response_run_id,
                            &accepted.assistant_message_id,
                            &error,
                        );
                        yield Ok(StreamEvent::Failed {
                            conversation_id: accepted.conversation_id.clone(),
                            message_id: accepted.assistant_message_id.clone(),
                            error,
                        });
                        return;
                    }
                }
            }
        }
    }
}
