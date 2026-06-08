use std::{env, fs::OpenOptions, net::TcpListener, path::Path, process::Stdio, time::Duration};

use mini_stim_proto_client::{CellMode, TransportError, bootstrap};
use mini_stim_proto_transport::CellContext;
use tokio::{process::Command, time::sleep};

#[tokio::main]
async fn main() -> Result<(), TransportError> {
    let runtime = bootstrap(std::env::args_os())?;
    let context = runtime.context().clone();
    let store = context.store.join("client");
    let log_path = store.join("logs").join("soma.log");
    tokio::fs::create_dir_all(log_path.parent().expect("log path has parent")).await?;

    let server_url = wait_for_server_url(&context, Duration::from_secs(45)).await?;
    let port = allocate_port()?;
    let url = format!("http://127.0.0.1:{port}");
    let mut child = spawn_client_soma(&context, port, &server_url, &log_path)?;
    let pid = child.id();

    match wait_for_health(&url, Duration::from_secs(45)).await {
        Ok(()) => print_ready("client", &url, &context.endpoint, pid),
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
                    return Err(TransportError::Config(format!("client soma exited with {status}")));
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

async fn wait_for_server_url(
    _context: &CellContext,
    timeout: Duration,
) -> Result<String, TransportError> {
    let started = std::time::Instant::now();
    while started.elapsed() < timeout {
        if let Ok(url) = env::var("MINI_STIM_SERVER_URL")
            && !url.trim().is_empty()
        {
            return Ok(url);
        }
        sleep(Duration::from_millis(150)).await;
    }
    Err(TransportError::Config(
        "server cell did not report a ready URL".to_string(),
    ))
}

fn print_ready(role: &str, endpoint: &str, runtime_endpoint: &str, pid: Option<u32>) {
    let instance_id = pid.map(|value| value.to_string()).unwrap_or_default();
    println!(
        "{{\"role\":\"{role}\",\"endpoint\":\"{endpoint}\",\"runtime_endpoint\":\"{runtime_endpoint}\",\"instance_id\":\"{instance_id}\"}}"
    );
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
