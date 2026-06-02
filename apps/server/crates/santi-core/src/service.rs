use async_stream::stream;
use futures_core::Stream;
use futures_util::StreamExt;

use crate::{
    ChatStore, ConversationDetail, ConversationSummary, OpenAiResponsesClient, SendMessageRequest,
    StreamEvent, openai::OpenAiStreamEvent,
};

#[derive(Clone)]
pub struct ChatService {
    store: ChatStore,
    openai: OpenAiResponsesClient,
}

#[derive(Debug, Clone)]
pub struct ChatServiceConfig {
    pub database_path: String,
    pub openai_api_key: String,
    pub openai_model: String,
    pub openai_base_url: String,
}

impl ChatService {
    pub fn open(config: ChatServiceConfig) -> Result<Self, String> {
        let store = ChatStore::open(config.database_path)?;
        let openai = OpenAiResponsesClient::new(crate::OpenAiResponsesConfig {
            api_key: config.openai_api_key,
            model: config.openai_model,
            base_url: config.openai_base_url,
        });
        Ok(Self { store, openai })
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
        let openai = self.openai.clone();
        stream! {
            let accepted = match store.begin_send(
                request.conversation_id,
                request.text,
                openai.model(),
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
            let mut upstream = match openai.stream_response(transcript).await {
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
                    Ok(OpenAiStreamEvent::TextDelta(delta)) => {
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
                    Ok(OpenAiStreamEvent::Completed { response_id }) => {
                        match store.complete_run(
                            &accepted.response_run_id,
                            &accepted.assistant_message_id,
                            response_id.as_deref(),
                        ) {
                            Ok(message) => {
                                yield Ok(StreamEvent::MessageCompleted {
                                    conversation_id: accepted.conversation_id.clone(),
                                    message: Box::new(message),
                                    provider_response_id: response_id,
                                });
                            }
                            Err(error) => yield Err(error),
                        }
                        return;
                    }
                    Ok(OpenAiStreamEvent::Failed(error)) | Err(error) => {
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
