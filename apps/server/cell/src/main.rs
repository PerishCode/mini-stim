use std::{
    fs::OpenOptions,
    net::TcpListener,
    path::Path,
    process::Stdio,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use async_trait::async_trait;
use mini_stim_proto_server::{CellState, ServerCell, ServerCellStatus, TransportResult, bootstrap};
use mini_stim_proto_transport::{CellContext, CellMode, TransportError};
use tokio::{process::Command, sync::Mutex, time::sleep};

#[derive(Clone)]
struct ServerCellState {
    status: Arc<Mutex<ServerCellStatus>>,
}

#[async_trait]
impl ServerCell for ServerCellState {
    async fn status(&self) -> TransportResult<ServerCellStatus> {
        Ok(self.status.lock().await.clone())
    }
}

#[tokio::main]
async fn main() -> Result<(), TransportError> {
    let runtime = bootstrap(std::env::args_os())?;
    let context = runtime.context().clone();
    let store = context.store.join("server");
    let log_path = store.join("logs").join("soma.log");
    tokio::fs::create_dir_all(log_path.parent().expect("log path has parent")).await?;

    let status = Arc::new(Mutex::new(ServerCellStatus {
        error: None,
        mode: context.mode.clone(),
        pid: None,
        state: CellState::Starting,
        updated_at: now_stamp(),
        url: None,
    }));
    let inspect_state = ServerCellState {
        status: Arc::clone(&status),
    };
    let inspect_task = tokio::spawn(async move { runtime.register(inspect_state).await });

    let port = allocate_port()?;
    let url = format!("http://127.0.0.1:{port}");
    let db_path = store.join("santi.sqlite");
    if let Some(parent) = db_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let child = Arc::new(Mutex::new(spawn_server_soma(
        &context, &port, &db_path, &log_path,
    )?));
    {
        let mut current = status.lock().await;
        current.pid = child.lock().await.id();
        current.url = Some(url.clone());
        current.updated_at = now_stamp();
    }

    match wait_for_health(&format!("{url}/api/health"), Duration::from_secs(45)).await {
        Ok(()) => {
            let mut current = status.lock().await;
            current.state = CellState::Running;
            current.updated_at = now_stamp();
        }
        Err(error) => {
            let mut current = status.lock().await;
            current.error = Some(error.to_string());
            current.state = CellState::Failed;
            current.updated_at = now_stamp();
        }
    }

    tokio::select! {
        result = watch_child(Arc::clone(&child)) => {
            let mut current = status.lock().await;
            current.state = match result {
                Ok(status) if status.success() => CellState::Stopped,
                Ok(status) => {
                    current.error = Some(format!("server soma exited with {status}"));
                    CellState::Failed
                }
                Err(error) => {
                    current.error = Some(error.to_string());
                    CellState::Failed
                }
            };
            current.updated_at = now_stamp();
        }
        _ = shutdown_signal() => {
            let mut child = child.lock().await;
            let _ = child.start_kill();
            let _ = child.wait().await;
            let mut current = status.lock().await;
            current.state = CellState::Stopped;
            current.updated_at = now_stamp();
        }
        result = inspect_task => {
            if let Ok(Err(error)) = result {
                let mut current = status.lock().await;
                current.error = Some(error.to_string());
                current.state = CellState::Failed;
                current.updated_at = now_stamp();
            }
        }
    }

    Ok(())
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

async fn watch_child(
    child: Arc<Mutex<tokio::process::Child>>,
) -> Result<std::process::ExitStatus, std::io::Error> {
    loop {
        if let Some(status) = child.lock().await.try_wait()? {
            return Ok(status);
        }
        sleep(Duration::from_millis(200)).await;
    }
}

fn allocate_port() -> Result<u16, TransportError> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    Ok(listener.local_addr()?.port())
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

fn now_stamp() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("unix:{seconds}")
}
