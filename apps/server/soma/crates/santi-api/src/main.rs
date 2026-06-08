use std::{convert::Infallible, env, net::SocketAddr, path::PathBuf, sync::Arc};

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{
        IntoResponse, Sse,
        sse::{Event, KeepAlive},
    },
    routing::{get, post},
};
use futures_core::Stream;
use santi_core::{
    CreateSessionResponse, ErrorResponse, HealthResponse, SantiService, SantiServiceConfig,
    SantiStreamEvent, SantiStreamPayload, SendSessionRequest, SendSessionResponse, Session,
    SessionDetail, SessionRuntimeSnapshot, prefixed_id, timestamp_now,
};
use santi_provider::{OpenAIProvider, OpenAIProviderConfig};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use utoipa::OpenApi;

#[tokio::main]
async fn main() -> Result<(), String> {
    dotenvy::dotenv().ok();
    match env::args().nth(1).as_deref() {
        Some("export-openapi") => {
            println!(
                "{}",
                serde_json::to_string_pretty(&ApiDoc::openapi())
                    .map_err(|error| error.to_string())?
            );
            Ok(())
        }
        Some("serve") | None => serve().await,
        Some(command) => Err(format!("unknown command: {command}")),
    }
}

async fn serve() -> Result<(), String> {
    let provider = Arc::new(OpenAIProvider::new(OpenAIProviderConfig {
        api_key: env::var("OPENAI_API_KEY")
            .map_err(|_| "OPENAI_API_KEY is required".to_string())?,
        model: env::var("OPENAI_MODEL").map_err(|_| "OPENAI_MODEL is required".to_string())?,
        base_url: env::var("OPENAI_RESPONSES_BASE_URL")
            .unwrap_or_else(|_| "https://api.openai.com/v1".to_string()),
        reasoning_effort: optional_env("OPENAI_REASONING_EFFORT"),
        max_output_tokens: optional_env("OPENAI_MAX_OUTPUT_TOKENS")
            .map(|value| {
                value
                    .parse::<u32>()
                    .map_err(|_| "OPENAI_MAX_OUTPUT_TOKENS must be an unsigned integer".to_string())
            })
            .transpose()?,
    }));
    let database_path = env::var("SANTI_DB").map_err(|_| "SANTI_DB is required".to_string())?;
    let runtime_root = env::var("SANTI_RUNTIME_ROOT").unwrap_or_else(|_| {
        db_parent(&database_path)
            .join("runtime")
            .display()
            .to_string()
    });
    let execution_root = env::var("SANTI_EXECUTION_ROOT").unwrap_or_else(|_| {
        db_parent(&database_path)
            .join("execution")
            .display()
            .to_string()
    });
    let service = SantiService::open(
        SantiServiceConfig {
            database_path,
            runtime_root,
            execution_root,
            bind_addr: Some(bind_addr_string()),
        },
        provider,
    )?;
    let address: SocketAddr = bind_addr_string()
        .parse()
        .map_err(|_| "SANTI_HOST/SANTI_PORT did not form a valid socket address".to_string())?;
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .map_err(|error| error.to_string())?;
    println!("santi-api listening on http://{address}");
    axum::serve(listener, router(service))
        .await
        .map_err(|error| error.to_string())
}

fn db_parent(database_path: &str) -> PathBuf {
    PathBuf::from(database_path)
        .parent()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn bind_addr_string() -> String {
    let host = env::var("SANTI_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = env::var("SANTI_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(43307);
    format!("{host}:{port}")
}

fn optional_env(name: &str) -> Option<String> {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn router(service: SantiService) -> Router {
    Router::new()
        .route("/api/v1/health", get(health))
        .route("/api/v1/openapi.json", get(openapi))
        .route("/api/v1/sessions", post(create_session).get(list_sessions))
        .route("/api/v1/sessions/{session_id}", get(get_session))
        .route("/api/v1/sessions/{session_id}/messages", get(list_messages))
        .route("/api/v1/sessions/{session_id}/events", get(session_events))
        .route("/api/v1/sessions/{session_id}/send", post(send_session))
        .route(
            "/api/v1/sessions/{session_id}/runtime",
            get(runtime_snapshot),
        )
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(service)
}

#[utoipa::path(
    get,
    path = "/api/v1/health",
    responses((status = 200, body = HealthResponse))
)]
async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        ok: true,
        service: "santi-api".to_string(),
    })
}

#[utoipa::path(
    post,
    path = "/api/v1/sessions",
    responses((status = 200, body = CreateSessionResponse), (status = 500, body = ErrorResponse))
)]
async fn create_session(
    State(service): State<SantiService>,
) -> Result<Json<CreateSessionResponse>, ApiError> {
    service
        .create_session()
        .map(Json)
        .map_err(ApiError::internal)
}

#[utoipa::path(
    get,
    path = "/api/v1/sessions",
    responses((status = 200, body = [Session]), (status = 500, body = ErrorResponse))
)]
async fn list_sessions(
    State(service): State<SantiService>,
) -> Result<Json<Vec<Session>>, ApiError> {
    service
        .list_sessions()
        .map(Json)
        .map_err(ApiError::internal)
}

#[utoipa::path(
    get,
    path = "/api/v1/sessions/{session_id}",
    params(("session_id" = String, Path)),
    responses(
        (status = 200, body = SessionDetail),
        (status = 404, body = ErrorResponse),
        (status = 500, body = ErrorResponse)
    )
)]
async fn get_session(
    State(service): State<SantiService>,
    Path(session_id): Path<String>,
) -> Result<Json<SessionDetail>, ApiError> {
    service
        .session(&session_id)
        .map_err(ApiError::internal)?
        .map(Json)
        .ok_or_else(|| ApiError::not_found("session not found"))
}

#[utoipa::path(
    get,
    path = "/api/v1/sessions/{session_id}/messages",
    params(("session_id" = String, Path)),
    responses(
        (status = 200, body = [santi_core::SessionMessage]),
        (status = 404, body = ErrorResponse),
        (status = 500, body = ErrorResponse)
    )
)]
async fn list_messages(
    State(service): State<SantiService>,
    Path(session_id): Path<String>,
) -> Result<Json<Vec<santi_core::SessionMessage>>, ApiError> {
    service
        .session(&session_id)
        .map_err(ApiError::internal)?
        .map(|detail| Json(detail.messages))
        .ok_or_else(|| ApiError::not_found("session not found"))
}

async fn session_events(
    State(service): State<SantiService>,
    Path(session_id): Path<String>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, ApiError> {
    let session = service
        .session(&session_id)
        .map_err(ApiError::internal)?
        .ok_or_else(|| ApiError::not_found("session not found"))?;
    drop(session);

    let mut receiver = service.subscribe_stream();
    let open_session_id = session_id.clone();
    let stream = async_stream::stream! {
        yield Ok(sse_event(SantiStreamEvent {
            event_id: prefixed_id("stream"),
            session_id: open_session_id,
            created_at: timestamp_now(),
            payload: SantiStreamPayload::StreamOpen,
        }));

        loop {
            match receiver.recv().await {
                Ok(event) if event.session_id == session_id => yield Ok(sse_event(event)),
                Ok(_) => {}
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {}
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
            }
        }
    };
    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}

#[utoipa::path(
    post,
    path = "/api/v1/sessions/{session_id}/send",
    params(("session_id" = String, Path)),
    request_body = SendSessionRequest,
    responses(
        (status = 200, body = SendSessionResponse),
        (status = 404, body = ErrorResponse),
        (status = 500, body = ErrorResponse)
    )
)]
async fn send_session(
    State(service): State<SantiService>,
    Path(session_id): Path<String>,
    Json(request): Json<SendSessionRequest>,
) -> Result<Json<SendSessionResponse>, ApiError> {
    service
        .send_session(&session_id, request)
        .await
        .map(Json)
        .map_err(ApiError::internal)
}

#[utoipa::path(
    get,
    path = "/api/v1/sessions/{session_id}/runtime",
    params(("session_id" = String, Path)),
    responses(
        (status = 200, body = SessionRuntimeSnapshot),
        (status = 404, body = ErrorResponse),
        (status = 500, body = ErrorResponse)
    )
)]
async fn runtime_snapshot(
    State(service): State<SantiService>,
    Path(session_id): Path<String>,
) -> Result<Json<SessionRuntimeSnapshot>, ApiError> {
    service
        .runtime_snapshot(&session_id)
        .map_err(ApiError::internal)?
        .map(Json)
        .ok_or_else(|| ApiError::not_found("session not found"))
}

async fn openapi() -> Json<utoipa::openapi::OpenApi> {
    Json(ApiDoc::openapi())
}

fn sse_event(event: SantiStreamEvent) -> Event {
    Event::default()
        .id(event.event_id.clone())
        .event(sse_event_name(&event.payload))
        .data(serde_json::to_string(&event).unwrap_or_else(|_| "{}".to_string()))
}

fn sse_event_name(payload: &SantiStreamPayload) -> &'static str {
    match payload {
        SantiStreamPayload::StreamOpen => "stream_open",
        SantiStreamPayload::MessageCreated { .. } => "message_created",
        SantiStreamPayload::MessageDelta { .. } => "message_delta",
        SantiStreamPayload::MessageCompleted { .. } => "message_completed",
        SantiStreamPayload::ToolCallCreated { .. } => "tool_call_created",
        SantiStreamPayload::ToolResultCreated { .. } => "tool_result_created",
        SantiStreamPayload::TurnStarted { .. } => "turn_started",
        SantiStreamPayload::TurnFailed { .. } => "turn_failed",
    }
}

struct ApiError {
    status: StatusCode,
    code: &'static str,
    message: String,
}

impl ApiError {
    fn internal(message: String) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            code: "internal",
            message,
        }
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            code: "not-found",
            message: message.into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (
            self.status,
            Json(ErrorResponse {
                code: self.code.to_string(),
                message: self.message,
            }),
        )
            .into_response()
    }
}

#[derive(OpenApi)]
#[openapi(
    paths(
        health,
        create_session,
        list_sessions,
        get_session,
        list_messages,
        send_session,
        runtime_snapshot
    ),
    components(schemas(
        CreateSessionResponse,
        ErrorResponse,
        HealthResponse,
        SendSessionRequest,
        SendSessionResponse,
        Session,
        SessionDetail,
        SessionRuntimeSnapshot,
        santi_core::ActorType,
        santi_core::Compact,
        santi_core::Message,
        santi_core::MessageContent,
        santi_core::MessagePart,
        santi_core::MessageState,
        santi_core::SessionEffect,
        santi_core::SessionMessage,
        santi_core::SessionMessageRef,
        santi_core::SoulSession,
        santi_core::ToolCall,
        santi_core::ToolResult,
        santi_core::Turn,
        santi_core::TurnStatus,
        santi_core::TurnTriggerType
    ))
)]
struct ApiDoc;
