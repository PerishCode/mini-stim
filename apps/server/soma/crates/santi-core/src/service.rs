use futures_util::StreamExt;
use santi_provider::{
    FunctionCallOutput, ProviderClient, ProviderEvent, ProviderFunctionCall, ProviderMessage,
    ProviderRequest,
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::{path::PathBuf, process::Command, sync::Arc};
use tokio::sync::broadcast;

use crate::service_prompt::{
    provider_tools, render_self_assessment_instructions, tooling_instructions,
};
use crate::{
    ActorType, CreateSessionResponse, MessageContent, MessageState, SantiStore, SantiStreamEvent,
    SantiStreamPayload, SendSessionRequest, SendSessionResponse, SessionDetail,
    SessionRuntimeSnapshot, SessionSummary, UpdateSessionRequest, prefixed_id, timestamp_now,
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
            let mut stream = self.provider.stream_response(request).await?;
            let mut calls = Vec::new();
            let mut completed_response_id = None;

            while let Some(event) = stream.next().await {
                match event? {
                    ProviderEvent::TextDelta(delta) => {
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
                        calls.push(call);
                    }
                    ProviderEvent::Completed {
                        provider_response_id,
                    } => {
                        completed_response_id = provider_response_id;
                        break;
                    }
                    ProviderEvent::Failed(error) => return Err(error),
                }
            }

            if calls.is_empty() {
                break completed_response_id;
            }

            let mut outputs = Vec::new();
            for call in calls {
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

    fn handle_tool_call(
        &self,
        session_id: &str,
        soul_session_id: &str,
        turn_id: &str,
        call: ProviderFunctionCall,
    ) -> Result<FunctionCallOutput, String> {
        let tool_call =
            self.store
                .append_tool_call(turn_id, &call.call_id, &call.name, &call.arguments)?;
        self.publish_stream(
            session_id,
            SantiStreamPayload::ToolCallCreated {
                tool_call: tool_call.clone(),
            },
        );
        let dispatch = self.dispatch_tool(session_id, soul_session_id, &call);
        let (output, error_text) = match dispatch {
            Ok(output) => (Some(output), None),
            Err(error) => (None, Some(error)),
        };
        let result =
            self.store
                .append_tool_result(&call.call_id, output.clone(), error_text.clone())?;
        self.publish_stream(
            session_id,
            SantiStreamPayload::ToolResultCreated {
                tool_result: result.clone(),
            },
        );
        Ok(FunctionCallOutput {
            call_id: call.call_id.clone(),
            call,
            output: serde_json::to_string(&json!({
                "ok": error_text.is_none(),
                "output": result.output,
                "error": result.error_text,
            }))
            .map_err(|error| error.to_string())?,
        })
    }

    fn dispatch_tool(
        &self,
        session_id: &str,
        soul_session_id: &str,
        call: &ProviderFunctionCall,
    ) -> Result<Value, String> {
        match call.name.as_str() {
            "write_soul_memory" => {
                let args = parse_tool_args::<WriteMemoryArgs>(&call.arguments)?;
                let soul = self.store.write_soul_memory(&args.text)?;
                Ok(json!({ "ok": true, "soul_id": soul.id }))
            }
            "write_session_memory" => {
                let args = parse_tool_args::<WriteMemoryArgs>(&call.arguments)?;
                let soul_session = self
                    .store
                    .write_session_memory(soul_session_id, &args.text)?;
                Ok(json!({ "ok": true, "soul_session_id": soul_session.id }))
            }
            "shell" => {
                let args = parse_tool_args::<ShellArgs>(&call.arguments)?;
                self.run_shell(session_id, args)
            }
            name => Err(format!("unsupported tool: {name}")),
        }
    }

    fn run_shell(&self, session_id: &str, args: ShellArgs) -> Result<Value, String> {
        std::fs::create_dir_all(self.soul_memory_dir()).map_err(|error| error.to_string())?;
        let cwd = args
            .cwd
            .map(PathBuf::from)
            .unwrap_or_else(|| self.execution_root());
        std::fs::create_dir_all(&cwd).map_err(|error| error.to_string())?;
        let mut command = shell_command(&args.command);
        let output = command
            .current_dir(&cwd)
            .env("SANTI_SOUL_MEMORY_DIR", self.soul_memory_dir())
            .env(
                "SANTI_SESSION_MEMORY_DIR",
                self.session_memory_dir(session_id),
            )
            .output()
            .map_err(|error| format!("failed to run shell: {error}"))?;
        Ok(json!({
            "exit_code": output.status.code().unwrap_or(-1),
            "stdout": String::from_utf8_lossy(&output.stdout),
            "stderr": String::from_utf8_lossy(&output.stderr),
            "shell": default_shell_name(),
        }))
    }

    fn runtime_root(&self) -> PathBuf {
        PathBuf::from(&self.config.runtime_root)
    }

    fn execution_root(&self) -> PathBuf {
        PathBuf::from(&self.config.execution_root)
    }

    fn soul_memory_dir(&self) -> PathBuf {
        self.runtime_root().join("souls").join("memory")
    }

    fn session_memory_dir(&self, session_id: &str) -> PathBuf {
        self.runtime_root()
            .join("sessions")
            .join(session_id)
            .join("memory")
    }
}

#[derive(Debug, Deserialize)]
struct WriteMemoryArgs {
    text: String,
}

#[derive(Debug, Deserialize)]
struct ShellArgs {
    command: String,
    cwd: Option<String>,
}

fn shell_command(command: &str) -> Command {
    #[cfg(windows)]
    {
        let mut shell = Command::new("pwsh");
        shell
            .arg("-NoLogo")
            .arg("-NoProfile")
            .arg("-Command")
            .arg(command);
        shell
    }

    #[cfg(not(windows))]
    {
        let mut shell = Command::new("/bin/bash");
        shell.arg("-lc").arg(command);
        shell
    }
}

fn default_shell_name() -> &'static str {
    if cfg!(windows) { "pwsh" } else { "bash" }
}

fn parse_tool_args<T: for<'de> Deserialize<'de>>(value: &Value) -> Result<T, String> {
    serde_json::from_value(value.clone()).map_err(|error| error.to_string())
}
