mod thinking;
mod tools;

use futures_util::StreamExt;
use santi_provider::{ProviderClient, ProviderEvent, ProviderMessage, ProviderRequest};
use std::sync::Arc;
use tokio::sync::broadcast;

use crate::service_prompt::{
    provider_tools, render_self_assessment_instructions, tooling_instructions,
};
use crate::{
    ActorType, CreateSessionResponse, MessageContent, MessageState, SantiStore, SantiStreamEvent,
    SantiStreamPayload, SendSessionRequest, SendSessionResponse, SessionDetail,
    SessionRuntimeSnapshot, SessionSummary, ThinkingCompletionReason, ThinkingSpan,
    TurnActivityState, UpdateSessionRequest, prefixed_id, timestamp_now,
};

#[derive(Clone)]
pub struct SantiService {
    pub(crate) store: SantiStore,
    provider: Arc<dyn ProviderClient>,
    pub(crate) config: SantiServiceConfig,
    stream_events: broadcast::Sender<SantiStreamEvent>,
}

#[derive(Debug, Clone)]
pub struct SantiServiceConfig {
    pub database_path: String,
    pub runtime_root: String,
    pub execution_root: String,
    pub bind_addr: Option<String>,
}

impl SantiService {
    pub fn open(
        config: SantiServiceConfig,
        provider: Arc<dyn ProviderClient>,
    ) -> Result<Self, String> {
        let store = SantiStore::open(&config.database_path)?;
        Ok(Self {
            store,
            provider,
            config,
            stream_events: broadcast::channel(1024).0,
        })
    }

    pub fn subscribe_stream(&self) -> broadcast::Receiver<SantiStreamEvent> {
        self.stream_events.subscribe()
    }

    pub fn create_session(&self) -> Result<CreateSessionResponse, String> {
        Ok(CreateSessionResponse {
            session: self.store.create_session()?,
        })
    }

    pub fn list_sessions(&self) -> Result<Vec<SessionSummary>, String> {
        self.store.list_sessions()
    }

    pub fn session(&self, session_id: &str) -> Result<Option<SessionDetail>, String> {
        let Some(session) = self.store.session(session_id)? else {
            return Ok(None);
        };
        Ok(Some(SessionDetail {
            profile: self
                .store
                .runtime_snapshot(session_id)?
                .map(|snapshot| snapshot.profile)
                .ok_or_else(|| "session disappeared".to_string())?,
            session,
            messages: self.store.session_messages(session_id)?,
        }))
    }

    pub fn update_session(
        &self,
        session_id: &str,
        request: UpdateSessionRequest,
    ) -> Result<Option<SessionSummary>, String> {
        self.store.update_session_title(session_id, request.title)
    }

    pub fn runtime_snapshot(
        &self,
        session_id: &str,
    ) -> Result<Option<SessionRuntimeSnapshot>, String> {
        self.store.runtime_snapshot(session_id)
    }

    pub async fn send_session(
        &self,
        session_id: &str,
        request: SendSessionRequest,
    ) -> Result<SendSessionResponse, String> {
        let text = request.text();
        if text.trim().is_empty() {
            return Err("send content must contain text".to_string());
        }

        let user_message = self
            .store
            .append_message(
                session_id,
                ActorType::Account,
                self.store.default_account_id(),
                MessageContent {
                    parts: request.content,
                },
                MessageState::Fixed,
            )?
            .session_message;
        let soul_session = self.store.acquire_soul_session(session_id)?.soul_session;
        self.store
            .append_message_ref(&soul_session.id, &user_message.message.id)?;
        self.publish_stream(
            session_id,
            SantiStreamPayload::MessageCreated {
                message: user_message.clone(),
            },
        );
        let turn = self
            .store
            .start_turn(
                &soul_session.id,
                &user_message.message.id,
                user_message.relation.session_seq,
            )?
            .turn;
        self.publish_stream(
            session_id,
            SantiStreamPayload::TurnStarted { turn: turn.clone() },
        );

        let send_result = self
            .run_provider_turn(session_id, &soul_session.id, &turn.id)
            .await;

        let (assistant_text, provider_response_id) = match send_result {
            Ok(value) => value,
            Err(error) => {
                let _ = self.store.fail_turn(&turn.id, &error);
                self.publish_stream(
                    session_id,
                    SantiStreamPayload::TurnFailed {
                        turn_id: turn.id.clone(),
                        error: error.clone(),
                    },
                );
                return Err(error);
            }
        };

        if assistant_text.trim().is_empty() {
            let error = "provider completed without assistant output".to_string();
            let _ = self.store.fail_turn(&turn.id, &error);
            self.publish_stream(
                session_id,
                SantiStreamPayload::TurnFailed {
                    turn_id: turn.id.clone(),
                    error: error.clone(),
                },
            );
            return Err(error);
        }

        let assistant_message = self
            .store
            .append_message(
                session_id,
                ActorType::Soul,
                self.store.default_soul_id(),
                MessageContent::text(assistant_text),
                MessageState::Fixed,
            )?
            .session_message;
        self.store
            .append_message_ref(&soul_session.id, &assistant_message.message.id)?;
        let completed_turn = self.store.complete_turn(
            &turn.id,
            assistant_message.relation.session_seq,
            provider_response_id,
        )?;
        self.publish_stream(
            session_id,
            SantiStreamPayload::MessageCompleted {
                turn_id: turn.id.clone(),
                message: assistant_message.clone(),
            },
        );

        let snapshot = self
            .store
            .runtime_snapshot(session_id)?
            .ok_or_else(|| "soul_session disappeared".to_string())?;
        let soul_session = snapshot
            .soul_session
            .ok_or_else(|| "soul_session disappeared".to_string())?;
        let soul_profile = snapshot
            .soul_profile
            .ok_or_else(|| "soul_profile disappeared".to_string())?;
        Ok(SendSessionResponse {
            session: SessionSummary {
                session: snapshot.session,
                profile: snapshot.profile,
            },
            soul_session,
            soul_profile,
            turn: completed_turn,
            user_message,
            assistant_message,
            thinking_spans: self.store.thinking_spans_for_turn(&turn.id)?,
            tool_calls: self.store.tool_calls_for_turn(&turn.id)?,
            tool_results: self.store.tool_results_for_turn(&turn.id)?,
        })
    }

    async fn run_provider_turn(
        &self,
        session_id: &str,
        soul_session_id: &str,
        turn_id: &str,
    ) -> Result<(String, Option<String>), String> {
        let mut assistant_text = String::new();
        let mut function_call_outputs = Vec::new();

        let final_response_id = loop {
            let input = self
                .store
                .assembly_input(soul_session_id)?
                .into_iter()
                .map(|message| ProviderMessage {
                    role: message.role,
                    content: message.content,
                })
                .collect();
            let metadata = self.provider.metadata();
            let request = ProviderRequest {
                model: metadata.model,
                instructions: Some(self.runtime_instructions(session_id, soul_session_id)?),
                input,
                tools: Some(provider_tools()),
                previous_response_id: None,
                function_call_outputs: if function_call_outputs.is_empty() {
                    None
                } else {
                    Some(function_call_outputs.clone())
                },
            };
            self.publish_turn_activity(session_id, turn_id, TurnActivityState::Requesting, None);
            let mut stream = self.provider.stream_response(request).await?;
            let mut calls = Vec::new();
            let mut completed_response_id = None;
            let mut active_provider_response_id = None;
            let mut current_thinking_span: Option<ThinkingSpan> = None;
            let mut summary_thinking_span: Option<ThinkingSpan> = None;
            let mut reasoning_summary = String::new();

            while let Some(event) = stream.next().await {
                let event = match event {
                    Ok(event) => event,
                    Err(error) => {
                        self.fail_current_thinking_span(
                            session_id,
                            &mut current_thinking_span,
                            error.clone(),
                        )?;
                        return Err(error);
                    }
                };
                match event {
                    ProviderEvent::ResponseStarted {
                        provider_response_id,
                    }
                    | ProviderEvent::ResponseInProgress {
                        provider_response_id,
                    } => {
                        active_provider_response_id = provider_response_id.clone();
                        self.ensure_thinking_span(
                            session_id,
                            turn_id,
                            &mut current_thinking_span,
                            &mut summary_thinking_span,
                            provider_response_id.clone(),
                        )?;
                        self.publish_turn_activity(
                            session_id,
                            turn_id,
                            TurnActivityState::Thinking,
                            provider_response_id,
                        );
                    }
                    ProviderEvent::ReasoningSummaryDelta(delta) => {
                        reasoning_summary.push_str(&delta);
                        self.update_thinking_span_summary(
                            session_id,
                            &mut summary_thinking_span,
                            reasoning_summary.clone(),
                        )?;
                    }
                    ProviderEvent::ReasoningSummaryDone(summary) => {
                        reasoning_summary = summary;
                        self.update_thinking_span_summary(
                            session_id,
                            &mut summary_thinking_span,
                            reasoning_summary.clone(),
                        )?;
                    }
                    ProviderEvent::TextDelta(delta) => {
                        if assistant_text.is_empty() {
                            self.complete_current_thinking_span(
                                session_id,
                                &mut current_thinking_span,
                                ThinkingCompletionReason::FirstTextDelta,
                            )?;
                            self.publish_turn_activity(
                                session_id,
                                turn_id,
                                TurnActivityState::Generating,
                                active_provider_response_id.clone(),
                            );
                        }
                        assistant_text.push_str(&delta);
                        self.publish_stream(
                            session_id,
                            SantiStreamPayload::MessageDelta {
                                message_id: format!("stream_{turn_id}"),
                                turn_id: turn_id.to_string(),
                                role: ActorType::Soul,
                                text: delta,
                            },
                        );
                    }
                    ProviderEvent::FunctionCallRequested(call) => {
                        self.complete_current_thinking_span(
                            session_id,
                            &mut current_thinking_span,
                            ThinkingCompletionReason::ToolCallRequested,
                        )?;
                        self.publish_turn_activity(
                            session_id,
                            turn_id,
                            TurnActivityState::CallingTool,
                            active_provider_response_id.clone(),
                        );
                        calls.push(call);
                    }
                    ProviderEvent::Completed {
                        provider_response_id,
                    } => {
                        active_provider_response_id = provider_response_id.clone();
                        self.complete_current_thinking_span(
                            session_id,
                            &mut current_thinking_span,
                            ThinkingCompletionReason::ProviderCompleted,
                        )?;
                        completed_response_id = provider_response_id;
                        break;
                    }
                    ProviderEvent::Failed(error) => {
                        self.fail_current_thinking_span(
                            session_id,
                            &mut current_thinking_span,
                            error.clone(),
                        )?;
                        return Err(error);
                    }
                }
            }

            if calls.is_empty() {
                break completed_response_id;
            }

            let mut outputs = Vec::new();
            for call in calls {
                self.publish_turn_activity(
                    session_id,
                    turn_id,
                    TurnActivityState::RunningTool,
                    active_provider_response_id.clone(),
                );
                outputs.push(self.handle_tool_call(session_id, soul_session_id, turn_id, call)?);
            }
            function_call_outputs.extend(outputs);
        };

        Ok((assistant_text, final_response_id))
    }

    fn runtime_instructions(
        &self,
        session_id: &str,
        soul_session_id: &str,
    ) -> Result<String, String> {
        let snapshot = self
            .store
            .runtime_snapshot(session_id)?
            .ok_or_else(|| "session not found".to_string())?;
        let soul_session = snapshot
            .soul_session
            .ok_or_else(|| "soul_session not found".to_string())?;
        let metadata = self.provider.metadata();
        Ok(
            [
                "You are santi, a customized personal agent service.".to_string(),
                format!(
                    "<santi-meta>\nsession_id: {session_id}\nsoul_id: {}\nhas_soul_memory: unknown\nhas_session_memory: {}\nhas_request_instructions: false\n</santi-meta>",
                    soul_session.soul_id,
                    !soul_session.session_memory.trim().is_empty()
                ),
                render_self_assessment_instructions(),
                format!(
                    "<santi-runtime>\nservice_name: santi\nassembly_mode: mini-stim-sidecar\nlaunch_profile: dev\nbind_addr: {}\nprovider_model: {}\nprovider_api: responses\nprovider_gateway_base_url: unknown\nSANTI_SOUL_MEMORY_DIR: {}\nSANTI_SESSION_MEMORY_DIR: {}\nfallback_cwd: {}\nsoul_session_id: {}\n</santi-runtime>",
                    self.config.bind_addr.as_deref().unwrap_or("unknown"),
                    metadata.model,
                    self.soul_memory_dir().display(),
                    self.session_memory_dir(session_id).display(),
                    self.execution_root().display(),
                    soul_session_id
                ),
                tooling_instructions(),
            ]
            .join("\n\n"),
        )
    }

    fn publish_stream(&self, session_id: &str, payload: SantiStreamPayload) {
        let _ = self.stream_events.send(SantiStreamEvent {
            event_id: prefixed_id("stream"),
            session_id: session_id.to_string(),
            created_at: timestamp_now(),
            payload,
        });
    }
}
