use std::{
    fs::OpenOptions,
    path::Path,
    process::Stdio,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use async_trait::async_trait;
use mini_stim_proto_server::{CellRuntime, CellState, ServerCell, ServerCellStatus, bootstrap};
use mini_stim_proto_transport::{CellContext, CellMode, TransportError};
use tokio::sync::RwLock;
use tokio::{process::Command, time::sleep};

#[tokio::main]
async fn main() -> Result<(), TransportError> {
    let runtime = bootstrap(std::env::args_os())?;
    let context = runtime.context().clone();
    let store = context.store.join("server");
    let log_path = store.join("logs").join("soma.log");
    tokio::fs::create_dir_all(log_path.parent().expect("log path has parent")).await?;

    let port = runtime.acquire_tcp_port("api.port", "server API")?;
    let url = format!("http://127.0.0.1:{port}");
    let db_path = store.join("santi.sqlite");
    if let Some(parent) = db_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let state = Arc::new(RwLock::new(ServerRuntimeState::new(context.mode.clone())));
    let inspect_runtime = runtime.clone();
    let inspect_state = Arc::clone(&state);
    tokio::spawn(async move {
        if let Err(error) = inspect_runtime
            .register(ServerStatus {
                state: inspect_state,
            })
            .await
        {
            eprintln!("server inspect failed: {error}");
        }
    });

    let mut child = spawn_server_soma(&context, &port, &db_path, &log_path)?;
    let pid = child.id();
    state.write().await.pid = pid;

    match wait_for_health(&format!("{url}/api/v1/health"), Duration::from_secs(45)).await {
        Ok(()) => {
            state.write().await.mark_running(url.clone(), pid);
            print_ready("server", &url, &context.endpoint, pid);
        }
        Err(error) => {
            state.write().await.mark_failed(error.to_string());
            let _ = child.start_kill();
            let _ = child.wait().await;
            return Err(error);
        }
    }

    tokio::select! {
        result = child.wait() => {
            match result {
                Ok(status) if status.success() => {}
                Ok(status) => {
                    state.write().await.mark_failed(format!("server soma exited with {status}"));
                    return Err(TransportError::Config(format!("server soma exited with {status}")));
                }
                Err(error) => {
                    state.write().await.mark_failed(error.to_string());
                    return Err(TransportError::Io(error));
                }
            }
        }
        _ = shutdown_signal() => {
            let _ = child.start_kill();
            let _ = child.wait().await;
            state.write().await.mark_stopped();
        }
    }

    Ok(())
}

#[derive(Clone)]
struct ServerRuntimeState {
    error: Option<String>,
    mode: CellMode,
    pid: Option<u32>,
    state: CellState,
    updated_at: String,
    url: Option<String>,
}

impl ServerRuntimeState {
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

struct ServerStatus {
    state: Arc<RwLock<ServerRuntimeState>>,
}

#[async_trait]
impl ServerCell for ServerStatus {
    async fn status(&self) -> Result<ServerCellStatus, TransportError> {
        let state = self.state.read().await.clone();
        Ok(ServerCellStatus {
            error: state.error,
            mode: state.mode,
            pid: state.pid,
            state: state.state,
            updated_at: state.updated_at,
            url: state.url,
        })
    }
}

fn spawn_server_soma(
    context: &CellContext,
    port: &u16,
    db_path: &Path,
    log_path: &Path,
) -> Result<tokio::process::Child, TransportError> {
    let log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)?;
    let stderr = log.try_clone()?;
    let mut command = Command::new("cargo");
    command
        .args([
            "run",
            "--quiet",
            "-p",
            "mini-stim-server-soma",
            "--",
            "serve",
        ])
        .env("SANTI_HOST", "127.0.0.1")
        .env("SANTI_PORT", port.to_string())
        .env("SANTI_DB", db_path)
        .env("MINI_STIM_CELL_MODE", format_mode(&context.mode))
        .env("MINI_STIM_CELL_NAMESPACE", &context.namespace)
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(stderr));
    command.spawn().map_err(TransportError::Io)
}

fn print_ready(role: &str, endpoint: &str, runtime_endpoint: &str, pid: Option<u32>) {
    let instance_id = pid.map(|value| value.to_string()).unwrap_or_default();
    println!(
        "{{\"role\":\"{role}\",\"endpoint\":\"{endpoint}\",\"runtime_endpoint\":\"{runtime_endpoint}\",\"instance_id\":\"{instance_id}\"}}"
    );
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
        "server soma did not become healthy at {url}"
    )))
}

fn format_mode(mode: &CellMode) -> &'static str {
    match mode {
        CellMode::Dev => "dev",
        CellMode::Runtime => "runtime",
    }
}

fn timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
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
