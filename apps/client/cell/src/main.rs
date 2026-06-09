use std::{
    env,
    fs::OpenOptions,
    path::Path,
    process::Stdio,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use async_trait::async_trait;
use mini_stim_proto_client::{
    CellMode, CellRuntime, CellState, ClientCell, ClientCellStatus, ServerCellClient,
    TransportError, bootstrap,
};
use mini_stim_proto_transport::CellContext;
use tokio::sync::RwLock;
use tokio::{process::Command, time::sleep};

#[tokio::main]
async fn main() -> Result<(), TransportError> {
    let runtime = bootstrap(std::env::args_os())?;
    let context = runtime.context().clone();
    let store = context.store.join("client");
    let log_path = store.join("logs").join("soma.log");
    tokio::fs::create_dir_all(log_path.parent().expect("log path has parent")).await?;

    let state = Arc::new(RwLock::new(ClientRuntimeState::new(context.mode.clone())));
    let inspect_runtime = runtime.clone();
    let inspect_state = Arc::clone(&state);
    tokio::spawn(async move {
        if let Err(error) = inspect_runtime
            .register(ClientStatus {
                state: inspect_state,
            })
            .await
        {
            eprintln!("client inspect failed: {error}");
        }
    });

    let server_client = runtime.server_client();
    let server_url = wait_for_server_url(&server_client, Duration::from_secs(45)).await?;
    let port = runtime.acquire_tcp_port("web.port", "client web")?;
    let url = format!("http://127.0.0.1:{port}");
    let mut child = spawn_client_soma(&context, port, &server_url, &log_path)?;
    let pid = child.id();
    state.write().await.pid = pid;

    match wait_for_health(&url, Duration::from_secs(45)).await {
        Ok(()) => {
            state.write().await.mark_running(url.clone(), pid);
            print_ready("client", &url, &context.endpoint, pid);
        }
        Err(error) => {
            state.write().await.mark_failed(error.to_string());
            let _ = child.start_kill();
            let _ = child.wait().await;
            return Err(error);
        }
    }

    let mut active_server_url = server_url;
    let soma = ClientSoma {
        context: context.clone(),
        log_path,
        port,
        state: Arc::clone(&state),
        url,
    };
    tokio::select! {
        result = maintain_client_soma(
            &soma,
            &server_client,
            &mut active_server_url,
            &mut child,
        ) => result?,
        _ = shutdown_signal() => {}
    }

    let _ = child.start_kill();
    let _ = child.wait().await;
    state.write().await.mark_stopped();

    Ok(())
}

struct ClientSoma {
    context: CellContext,
    log_path: std::path::PathBuf,
    port: u16,
    state: Arc<RwLock<ClientRuntimeState>>,
    url: String,
}

async fn maintain_client_soma(
    soma: &ClientSoma,
    server_client: &ServerCellClient,
    active_server_url: &mut String,
    child: &mut tokio::process::Child,
) -> Result<(), TransportError> {
    loop {
        tokio::select! {
            result = child.wait() => {
                match result {
                    Ok(status) if status.success() => {
                        soma.state.write().await.mark_stopped();
                        return Ok(());
                    }
                    Ok(status) => {
                        let message = format!("client soma exited with {status}");
                        soma.state.write().await.mark_failed(message.clone());
                        return Err(TransportError::Config(message));
                    }
                    Err(error) => {
                        soma.state.write().await.mark_failed(error.to_string());
                        return Err(TransportError::Io(error));
                    }
                }
            }
            _ = sleep(Duration::from_secs(2)) => {
                let Some(server_url) = current_server_url(server_client).await? else {
                    continue;
                };
                if server_url == *active_server_url {
                    continue;
                }
                restart_client_soma(soma, &server_url, child).await?;
                *active_server_url = server_url;
            }
        }
    }
}

async fn restart_client_soma(
    soma: &ClientSoma,
    server_url: &str,
    child: &mut tokio::process::Child,
) -> Result<(), TransportError> {
    let _ = child.start_kill();
    let _ = child.wait().await;
    soma.state.write().await.mark_starting();

    let mut replacement = spawn_client_soma(&soma.context, soma.port, server_url, &soma.log_path)?;
    let pid = replacement.id();
    soma.state.write().await.pid = pid;
    if let Err(error) = wait_for_health(&soma.url, Duration::from_secs(45)).await {
        soma.state.write().await.mark_failed(error.to_string());
        let _ = replacement.start_kill();
        let _ = replacement.wait().await;
        return Err(error);
    }
    soma.state.write().await.mark_running(soma.url.clone(), pid);
    *child = replacement;
    Ok(())
}

async fn wait_for_server_url(
    server_client: &ServerCellClient,
    timeout: Duration,
) -> Result<String, TransportError> {
    let started = std::time::Instant::now();
    while started.elapsed() < timeout {
        if let Some(url) = current_server_url(server_client).await? {
            return Ok(url);
        }
        sleep(Duration::from_millis(150)).await;
    }
    Err(TransportError::Config(
        "server cell did not report a ready URL".to_string(),
    ))
}

async fn current_server_url(
    server_client: &ServerCellClient,
) -> Result<Option<String>, TransportError> {
    if let Ok(status) = server_client.status().await
        && status.state == CellState::Running
        && let Some(url) = status.url
        && !url.trim().is_empty()
    {
        return Ok(Some(url));
    }
    if let Ok(url) = env::var("MINI_STIM_SERVER_URL")
        && !url.trim().is_empty()
    {
        return Ok(Some(url));
    }
    Ok(None)
}

fn print_ready(role: &str, endpoint: &str, runtime_endpoint: &str, pid: Option<u32>) {
    let instance_id = pid.map(|value| value.to_string()).unwrap_or_default();
    println!(
        "{{\"role\":\"{role}\",\"endpoint\":\"{endpoint}\",\"runtime_endpoint\":\"{runtime_endpoint}\",\"instance_id\":\"{instance_id}\"}}"
    );
}

#[derive(Clone)]
struct ClientRuntimeState {
    error: Option<String>,
    mode: CellMode,
    pid: Option<u32>,
    state: CellState,
    updated_at: String,
    url: Option<String>,
}

impl ClientRuntimeState {
    fn new(mode: CellMode) -> Self {
        Self {
            error: None,
            mode,
            pid: None,
            state: CellState::Starting,
            updated_at: timestamp(),
            url: None,
        }
    }

    fn mark_starting(&mut self) {
        self.error = None;
        self.pid = None;
        self.state = CellState::Starting;
        self.updated_at = timestamp();
    }

    fn mark_running(&mut self, url: String, pid: Option<u32>) {
        self.error = None;
        self.pid = pid;
        self.state = CellState::Running;
        self.updated_at = timestamp();
        self.url = Some(url);
    }

    fn mark_failed(&mut self, error: String) {
        self.error = Some(error);
        self.state = CellState::Failed;
        self.updated_at = timestamp();
    }

    fn mark_stopped(&mut self) {
        self.state = CellState::Stopped;
        self.updated_at = timestamp();
    }
}

struct ClientStatus {
    state: Arc<RwLock<ClientRuntimeState>>,
}

#[async_trait]
impl ClientCell for ClientStatus {
    async fn status(&self) -> Result<ClientCellStatus, TransportError> {
        let state = self.state.read().await.clone();
        Ok(ClientCellStatus {
            error: state.error,
            mode: state.mode,
            pid: state.pid,
            state: state.state,
            updated_at: state.updated_at,
            url: state.url,
        })
    }
}

fn spawn_client_soma(
    context: &CellContext,
    port: u16,
    server_url: &str,
    log_path: &Path,
) -> Result<tokio::process::Child, TransportError> {
    if context.mode != CellMode::Dev {
        return Err(TransportError::Config(
            "client cell only implements dev mode".to_string(),
        ));
    }
    let log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)?;
    let stderr = log.try_clone()?;
    let mut command = Command::new("cargo");
    command
        .args(["run", "--quiet", "-p", "mini-stim-client-soma", "--", "dev"])
        .env("MINI_STIM_CLIENT_HOST", "127.0.0.1")
        .env("MINI_STIM_CLIENT_PORT", port.to_string())
        .env("MINI_STIM_CLIENT_WEB_ROOT", "apps/client/soma/web")
        .env("SANTI_API_ENDPOINT", server_url)
        .env("MINI_STIM_CELL_MODE", "dev")
        .env("MINI_STIM_CELL_NAMESPACE", &context.namespace)
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(stderr));
    command.spawn().map_err(TransportError::Io)
}

fn timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

async fn wait_for_health(url: &str, timeout: Duration) -> Result<(), TransportError> {
    let started = std::time::Instant::now();
    let client = reqwest::Client::new();
    while started.elapsed() < timeout {
        if let Ok(response) = client.get(url).send().await
            && response.status().is_success()
        {
            return Ok(());
        }
        sleep(Duration::from_millis(150)).await;
    }
    Err(TransportError::Config(format!(
        "client soma did not become healthy at {url}"
    )))
}

async fn shutdown_signal() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{SignalKind, signal};
        let mut terminate = signal(SignalKind::terminate()).expect("install SIGTERM handler");
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {}
            _ = terminate.recv() => {}
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
