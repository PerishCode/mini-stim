use std::{fs::OpenOptions, net::TcpListener, path::Path, process::Stdio, time::Duration};

use mini_stim_proto_server::bootstrap;
use mini_stim_proto_transport::{CellContext, CellMode, TransportError};
use tokio::{process::Command, time::sleep};

#[tokio::main]
async fn main() -> Result<(), TransportError> {
    let runtime = bootstrap(std::env::args_os())?;
    let context = runtime.context().clone();
    let store = context.store.join("server");
    let log_path = store.join("logs").join("soma.log");
    tokio::fs::create_dir_all(log_path.parent().expect("log path has parent")).await?;

    let port = allocate_port()?;
    let url = format!("http://127.0.0.1:{port}");
    let db_path = store.join("santi.sqlite");
    if let Some(parent) = db_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let mut child = spawn_server_soma(&context, &port, &db_path, &log_path)?;
    let pid = child.id();

    match wait_for_health(&format!("{url}/api/v1/health"), Duration::from_secs(45)).await {
        Ok(()) => print_ready("server", &url, &context.endpoint, pid),
        Err(error) => {
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
                    return Err(TransportError::Config(format!("server soma exited with {status}")));
                }
                Err(error) => return Err(TransportError::Io(error)),
            }
        }
        _ = shutdown_signal() => {
            let _ = child.start_kill();
            let _ = child.wait().await;
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

fn allocate_port() -> Result<u16, TransportError> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    Ok(listener.local_addr()?.port())
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
