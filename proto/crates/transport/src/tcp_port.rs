use std::{io::ErrorKind, net::TcpListener, path::Path};

use crate::{TransportError, TransportResult};

pub fn acquire_stored_tcp_port(port_path: &Path, label: &str) -> TransportResult<u16> {
    if let Some(port) = read_stored_tcp_port(port_path, label)? {
        match reserve_tcp_port(port) {
            Ok(listener) => {
                drop(listener);
                return Ok(port);
            }
            Err(error) => {
                eprintln!(
                    "{label} could not reuse stored TCP port {port}: {error}; allocating a new port"
                );
            }
        }
    }
    let port = allocate_tcp_port()?;
    write_stored_tcp_port(port_path, port)?;
    Ok(port)
}

fn read_stored_tcp_port(port_path: &Path, label: &str) -> TransportResult<Option<u16>> {
    let raw = match std::fs::read_to_string(port_path) {
        Ok(raw) => raw,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(TransportError::Io(error)),
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    match trimmed.parse::<u16>() {
        Ok(port) => Ok(Some(port)),
        Err(error) => {
            eprintln!(
                "{label} ignored invalid stored TCP port at {}: {error}",
                port_path.display()
            );
            Ok(None)
        }
    }
}

fn write_stored_tcp_port(port_path: &Path, port: u16) -> TransportResult<()> {
    if let Some(parent) = port_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(port_path, format!("{port}\n"))?;
    Ok(())
}

fn reserve_tcp_port(port: u16) -> Result<TcpListener, std::io::Error> {
    TcpListener::bind(("127.0.0.1", port))
}

fn allocate_tcp_port() -> TransportResult<u16> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}
