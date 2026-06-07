use std::{env, process::Stdio};

use tokio::process::Command;

#[tokio::main]
async fn main() -> Result<(), String> {
    dotenvy::dotenv().ok();
    match env::args().nth(1).as_deref() {
        Some("dev") | None => dev().await,
        Some(command) => Err(format!("unknown command: {command}")),
    }
}

async fn dev() -> Result<(), String> {
    let host = env::var("MINI_STIM_CLIENT_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = env::var("MINI_STIM_CLIENT_PORT").unwrap_or_else(|_| "41420".to_string());
    let web_root = env::var("MINI_STIM_CLIENT_WEB_ROOT")
        .unwrap_or_else(|_| "apps/client/soma/web".to_string());
    let mut child = Command::new("pnpm")
        .args([
            "exec",
            "vite",
            "--host",
            &host,
            "--port",
            &port,
            "--strictPort",
        ])
        .current_dir(web_root)
        .stdin(Stdio::null())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|error| error.to_string())?;

    tokio::select! {
        status = child.wait() => {
            let status = status.map_err(|error| error.to_string())?;
            if status.success() {
                Ok(())
            } else {
                Err(format!("vite exited with {status}"))
            }
        }
        _ = shutdown_signal() => {
            let _ = child.start_kill();
            let _ = child.wait().await;
            Ok(())
        }
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
