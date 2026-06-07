use std::{
    collections::HashMap,
    ffi::OsString,
    future::Future,
    path::{Path, PathBuf},
    pin::Pin,
    sync::Arc,
};

use serde::{Deserialize, Serialize, de::DeserializeOwned};
#[cfg(unix)]
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    net::{UnixListener, UnixStream},
};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CellMode {
    Dev,
    Runtime,
}

impl CellMode {
    fn parse(value: &str) -> Result<Self, TransportError> {
        match value {
            "dev" => Ok(Self::Dev),
            "runtime" => Ok(Self::Runtime),
            other => Err(TransportError::Config(format!(
                "unsupported sidecar mode: {other}"
            ))),
        }
    }
}

#[derive(Clone, Debug)]
pub struct SidecarStamp {
    pub app: String,
    pub endpoint: String,
    pub mode: CellMode,
    pub namespace: String,
    pub source: String,
    pub version: u8,
}

#[derive(Clone, Debug)]
pub struct CellContext {
    pub app: String,
    pub endpoint: String,
    pub mode: CellMode,
    pub namespace: String,
    pub source: String,
    pub store: PathBuf,
}

impl CellContext {
    pub fn inspect_socket_for(&self, app: &str) -> PathBuf {
        inspect_socket_path(&self.namespace, app)
    }
}

#[derive(Debug)]
pub enum TransportError {
    Config(String),
    Io(std::io::Error),
    Json(serde_json::Error),
    Remote(String),
}

impl std::fmt::Display for TransportError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Config(message) => write!(formatter, "{message}"),
            Self::Io(error) => write!(formatter, "{error}"),
            Self::Json(error) => write!(formatter, "{error}"),
            Self::Remote(message) => write!(formatter, "{message}"),
        }
    }
}

impl std::error::Error for TransportError {}

impl From<std::io::Error> for TransportError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<serde_json::Error> for TransportError {
    fn from(error: serde_json::Error) -> Self {
        Self::Json(error)
    }
}

pub type TransportResult<T> = Result<T, TransportError>;

pub fn bootstrap<I>(args: I, expected_app: &str) -> TransportResult<CellContext>
where
    I: IntoIterator<Item = OsString>,
{
    let stamp = parse_stamp(args)?;
    if stamp.app != expected_app {
        return Err(TransportError::Config(format!(
            "sidecar stamp app mismatch: expected {expected_app}, received {}",
            stamp.app
        )));
    }
    let store = std::env::current_dir()
        .map_err(TransportError::Io)?
        .join(".tmp")
        .join("sidecar")
        .join(&stamp.namespace);
    Ok(CellContext {
        app: stamp.app,
        endpoint: stamp.endpoint,
        mode: stamp.mode,
        namespace: stamp.namespace,
        source: stamp.source,
        store,
    })
}

fn parse_stamp<I>(args: I) -> TransportResult<SidecarStamp>
where
    I: IntoIterator<Item = OsString>,
{
    for arg in args {
        let Some(value) = arg.to_str() else {
            continue;
        };
        if let Some(raw) = value.strip_prefix("--sidecar-stamp=") {
            return parse_stamp_value(raw);
        }
    }
    Err(TransportError::Config(
        "sidecar stamp arg is required".to_string(),
    ))
}

fn parse_stamp_value(raw: &str) -> TransportResult<SidecarStamp> {
    let mut values = HashMap::new();
    for part in raw.split(';').filter(|part| !part.is_empty()) {
        let Some((key, value)) = part.split_once('=') else {
            return Err(TransportError::Config(format!(
                "invalid sidecar stamp segment: {part}"
            )));
        };
        values.insert(key, percent_decode(value)?);
    }
    let version = required_stamp_field(&values, "v")?
        .parse::<u8>()
        .map_err(|_| {
            TransportError::Config("sidecar stamp version must be an integer".to_string())
        })?;
    if version != 1 {
        return Err(TransportError::Config(format!(
            "unsupported sidecar stamp version: {version}"
        )));
    }
    let app = required_stamp_field(&values, "a")?;
    let endpoint = required_stamp_field(&values, "e")?;
    let namespace = required_stamp_field(&values, "n")?;
    let mode = CellMode::parse(&required_stamp_field(&values, "m")?)?;
    let source = required_stamp_field(&values, "s")?;
    Ok(SidecarStamp {
        app,
        endpoint,
        mode,
        namespace,
        source,
        version,
    })
}

fn required_stamp_field(values: &HashMap<&str, String>, key: &str) -> TransportResult<String> {
    values
        .get(key)
        .cloned()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| TransportError::Config(format!("missing sidecar stamp field: {key}")))
}

fn percent_decode(value: &str) -> TransportResult<String> {
    let bytes = value.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len() {
                return Err(TransportError::Config(format!(
                    "invalid percent escape in sidecar stamp: {value}"
                )));
            }
            let hex = std::str::from_utf8(&bytes[index + 1..index + 3]).map_err(|_| {
                TransportError::Config(format!("invalid percent escape in sidecar stamp: {value}"))
            })?;
            let byte = u8::from_str_radix(hex, 16).map_err(|_| {
                TransportError::Config(format!("invalid percent escape in sidecar stamp: {value}"))
            })?;
            output.push(byte);
            index += 3;
        } else {
            output.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(output)
        .map_err(|_| TransportError::Config("sidecar stamp is not valid UTF-8".to_string()))
}

pub fn inspect_socket_path(namespace: &str, app: &str) -> PathBuf {
    PathBuf::from("/tmp")
        .join("mini-stim-sidecar")
        .join(namespace)
        .join(format!("{app}.sock"))
}

#[cfg(unix)]
#[derive(Debug, Deserialize, Serialize)]
struct EventRequest {
    id: String,
    kind: String,
    payload: serde_json::Value,
    verb: String,
}

#[cfg(unix)]
#[derive(Debug, Serialize)]
struct EventResponse {
    id: String,
    kind: &'static str,
    payload: serde_json::Value,
}

#[cfg(unix)]
#[derive(Debug, Serialize)]
struct EventError {
    id: String,
    kind: &'static str,
    error: EventErrorBody,
}

#[cfg(unix)]
#[derive(Debug, Serialize)]
struct EventErrorBody {
    code: &'static str,
    message: String,
}

type BoxedHandler = Arc<
    dyn Fn(
            serde_json::Value,
        ) -> Pin<Box<dyn Future<Output = TransportResult<serde_json::Value>> + Send>>
        + Send
        + Sync,
>;

#[derive(Default)]
pub struct InspectRegistry {
    handlers: HashMap<String, BoxedHandler>,
}

impl InspectRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register<Request, Response, Handler, Fut>(&mut self, verb: &str, handler: Handler)
    where
        Request: DeserializeOwned + Send + 'static,
        Response: Serialize + Send + 'static,
        Handler: Fn(Request) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = TransportResult<Response>> + Send + 'static,
    {
        let handler = Arc::new(handler);
        self.handlers.insert(
            verb.to_string(),
            Arc::new(move |payload| {
                let handler = Arc::clone(&handler);
                Box::pin(async move {
                    let request = serde_json::from_value(payload)?;
                    let response = handler(request).await?;
                    serde_json::to_value(response).map_err(TransportError::Json)
                })
            }),
        );
    }
}

pub async fn serve_inspect(socket_path: &Path, registry: InspectRegistry) -> TransportResult<()> {
    serve_inspect_impl(socket_path, registry).await
}

#[cfg(unix)]
async fn serve_inspect_impl(socket_path: &Path, registry: InspectRegistry) -> TransportResult<()> {
    if let Some(parent) = socket_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let _ = tokio::fs::remove_file(socket_path).await;
    let listener = UnixListener::bind(socket_path)?;
    let handlers = Arc::new(registry.handlers);
    loop {
        let (stream, _) = listener.accept().await?;
        let handlers = Arc::clone(&handlers);
        tokio::spawn(async move {
            let _ = handle_connection(stream, handlers).await;
        });
    }
}

#[cfg(not(unix))]
async fn serve_inspect_impl(
    _socket_path: &Path,
    _registry: InspectRegistry,
) -> TransportResult<()> {
    Err(TransportError::Config(
        "inspect Unix socket transport is only supported on Unix targets".to_string(),
    ))
}

#[cfg(unix)]
async fn handle_connection(
    stream: UnixStream,
    handlers: Arc<HashMap<String, BoxedHandler>>,
) -> TransportResult<()> {
    let mut reader = BufReader::new(stream);
    let mut frame = String::new();
    reader.read_line(&mut frame).await?;
    let request: EventRequest = serde_json::from_str(frame.trim_end())?;
    let response = match handlers.get(&request.verb) {
        Some(handler) if request.kind == "event" => match handler(request.payload).await {
            Ok(payload) => serde_json::to_string(&EventResponse {
                id: request.id,
                kind: "event_response",
                payload,
            })?,
            Err(error) => serde_json::to_string(&EventError {
                id: request.id,
                kind: "event_error",
                error: EventErrorBody {
                    code: "handler-error",
                    message: error.to_string(),
                },
            })?,
        },
        _ => serde_json::to_string(&EventError {
            id: request.id,
            kind: "event_error",
            error: EventErrorBody {
                code: "unknown-event",
                message: format!("unknown inspect event: {}", request.verb),
            },
        })?,
    };
    let mut stream = reader.into_inner();
    stream.write_all(response.as_bytes()).await?;
    stream.write_all(b"\n").await?;
    Ok(())
}

#[cfg(unix)]
#[derive(Debug, Deserialize)]
#[serde(tag = "kind")]
enum InvokeResponse {
    #[serde(rename = "event_response")]
    Response { payload: serde_json::Value },
    #[serde(rename = "event_error")]
    Error { error: EventErrorBodyResponse },
}

#[cfg(unix)]
#[derive(Debug, Deserialize)]
struct EventErrorBodyResponse {
    message: String,
}

pub async fn invoke<Request, Response>(
    socket_path: &Path,
    verb: &str,
    payload: Request,
) -> TransportResult<Response>
where
    Request: Serialize,
    Response: DeserializeOwned,
{
    invoke_impl(socket_path, verb, payload).await
}

#[cfg(unix)]
async fn invoke_impl<Request, Response>(
    socket_path: &Path,
    verb: &str,
    payload: Request,
) -> TransportResult<Response>
where
    Request: Serialize,
    Response: DeserializeOwned,
{
    let mut stream = UnixStream::connect(socket_path).await?;
    let request = EventRequest {
        id: uuid::Uuid::new_v4().to_string(),
        kind: "event".to_string(),
        payload: serde_json::to_value(payload)?,
        verb: verb.to_string(),
    };
    stream
        .write_all(serde_json::to_string(&request)?.as_bytes())
        .await?;
    stream.write_all(b"\n").await?;
    let mut reader = BufReader::new(stream);
    let mut frame = String::new();
    reader.read_line(&mut frame).await?;
    match serde_json::from_str::<InvokeResponse>(frame.trim_end())? {
        InvokeResponse::Response { payload } => {
            serde_json::from_value(payload).map_err(TransportError::Json)
        }
        InvokeResponse::Error { error } => Err(TransportError::Remote(error.message)),
    }
}

#[cfg(not(unix))]
async fn invoke_impl<Request, Response>(
    _socket_path: &Path,
    _verb: &str,
    _payload: Request,
) -> TransportResult<Response>
where
    Request: Serialize,
    Response: DeserializeOwned,
{
    Err(TransportError::Config(
        "inspect Unix socket transport is only supported on Unix targets".to_string(),
    ))
}
