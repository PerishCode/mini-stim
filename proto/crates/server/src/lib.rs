use std::{ffi::OsString, path::PathBuf, sync::Arc};

use async_trait::async_trait;
pub use mini_stim_proto_transport::{
    CellContext, CellMode, CellRuntime, TransportError, TransportResult,
};
use mini_stim_proto_transport::{InspectRegistry, bootstrap as bootstrap_transport, invoke};
use serde::{Deserialize, Serialize};

pub const SERVER_CELL: &str = "server";
const STATUS_EVENT: &str = "server.status";

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CellState {
    Starting,
    Running,
    Stopped,
    Failed,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ServerCellStatus {
    pub error: Option<String>,
    pub mode: CellMode,
    pub pid: Option<u32>,
    pub state: CellState,
    pub updated_at: String,
    pub url: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct StatusRequest {}

#[async_trait]
pub trait ServerCell: Send + Sync + 'static {
    async fn status(&self) -> TransportResult<ServerCellStatus>;
}

#[derive(Clone)]
pub struct ServerCellRuntime {
    context: CellContext,
}

impl ServerCellRuntime {
    pub fn context(&self) -> &CellContext {
        &self.context
    }

    pub fn server_client(&self) -> ServerCellClient {
        ServerCellClient {
            socket_path: self.context.inspect_socket_for(SERVER_CELL),
        }
    }

    pub async fn register<T>(&self, implementation: T) -> TransportResult<()>
    where
        T: ServerCell,
    {
        let implementation = Arc::new(implementation);
        let mut registry = InspectRegistry::new();
        registry.register(STATUS_EVENT, move |_request: StatusRequest| {
            let implementation = Arc::clone(&implementation);
            async move { implementation.status().await }
        });
        mini_stim_proto_transport::serve_inspect(
            &self.context.inspect_socket_for(SERVER_CELL),
            registry,
        )
        .await
    }
}

impl CellRuntime for ServerCellRuntime {
    fn context(&self) -> &CellContext {
        &self.context
    }
}

#[derive(Clone)]
pub struct ServerCellClient {
    socket_path: PathBuf,
}

impl ServerCellClient {
    pub fn for_context(context: &CellContext) -> Self {
        Self {
            socket_path: context.inspect_socket_for(SERVER_CELL),
        }
    }

    pub async fn status(&self) -> TransportResult<ServerCellStatus> {
        invoke(&self.socket_path, STATUS_EVENT, StatusRequest {}).await
    }
}

pub fn bootstrap<I>(args: I) -> TransportResult<ServerCellRuntime>
where
    I: IntoIterator<Item = OsString>,
{
    Ok(ServerCellRuntime {
        context: bootstrap_transport(args, SERVER_CELL)?,
    })
}
