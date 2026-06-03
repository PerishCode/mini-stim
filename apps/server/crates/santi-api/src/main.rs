use std::{env, net::SocketAddr};

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{
        IntoResponse,
        sse::{Event, KeepAlive, Sse},
    },
    routing::{get, post},
};
use futures_util::StreamExt;
use santi_core::{
    ChatService, ChatServiceConfig, ConversationDetail, ConversationSummary, ErrorResponse,
    SendMessageRequest, StreamEvent,
};
use santi_provider::{OpenAIProvider, OpenAIProviderConfig};
use std::sync::Arc;
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
    }));
    let service = ChatService::open(
        ChatServiceConfig {
            database_path: env::var("SANTI_DB").unwrap_or_else(|_| ".tmp/santi.sqlite".to_string()),
        },
        provider,
    )?;
    let port = env::var("SANTI_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(43307);
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .map_err(|error| error.to_string())?;
    println!("santi-api listening on http://{address}");
    axum::serve(listener, router(service))
        .await
        .map_err(|error| error.to_string())
}

fn router(service: ChatService) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/openapi.json", get(openapi))
        .route("/api/conversations", get(list_conversations))
        .route(
            "/api/conversations/{conversation_id}",
            get(get_conversation),
        )
        .route("/api/messages/stream", post(stream_message))
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
    path = "/api/health",
    responses((status = 200, body = HealthResponse))
)]
async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        ok: true,
        service: "santi-api".to_string(),
    })
}

#[utoipa::path(
    get,
    path = "/api/conversations",
    responses(
        (status = 200, body = [ConversationSummary]),
        (status = 500, body = ErrorResponse)
    )
)]
async fn list_conversations(
    State(service): State<ChatService>,
) -> Result<Json<Vec<ConversationSummary>>, ApiError> {
    service
        .list_conversations()
        .map(Json)
        .map_err(ApiError::internal)
}

#[utoipa::path(
    get,
    path = "/api/conversations/{conversation_id}",
    params(("conversation_id" = String, Path)),
    responses(
        (status = 200, body = ConversationDetail),
        (status = 404, body = ErrorResponse),
        (status = 500, body = ErrorResponse)
    )
)]
async fn get_conversation(
    State(service): State<ChatService>,
    Path(conversation_id): Path<String>,
) -> Result<Json<ConversationDetail>, ApiError> {
    service
        .conversation(&conversation_id)
        .map_err(ApiError::internal)?
        .map(Json)
        .ok_or_else(|| ApiError::not_found("conversation not found"))
}

#[utoipa::path(
    post,
    path = "/api/messages/stream",
    request_body = SendMessageRequest,
    responses(
        (status = 200, description = "Server-sent stream of StreamEvent JSON payloads"),
        (status = 500, body = ErrorResponse)
    )
)]
async fn stream_message(
    State(service): State<ChatService>,
    Json(request): Json<SendMessageRequest>,
) -> Sse<impl futures_core::Stream<Item = Result<Event, axum::Error>>> {
    let stream = service.send_message(request).map(|event| {
        let event = match event {
            Ok(event) => event,
            Err(error) => StreamEvent::Failed {
                conversation_id: "".to_string(),
                message_id: "".to_string(),
                error,
            },
        };
        Event::default().json_data(event).map_err(axum::Error::new)
    });
    Sse::new(stream).keep_alive(KeepAlive::default())
}

async fn openapi() -> Json<utoipa::openapi::OpenApi> {
    Json(ApiDoc::openapi())
}

#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
struct HealthResponse {
    ok: bool,
    service: String,
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
    paths(health, list_conversations, get_conversation, stream_message),
    components(schemas(
        ConversationDetail,
        ConversationSummary,
        ErrorResponse,
        HealthResponse,
        santi_core::MessageRecord,
        santi_core::MessageRole,
        santi_core::MessageState,
        SendMessageRequest,
        StreamEvent
    ))
)]
struct ApiDoc;
