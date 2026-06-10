use std::{ffi::OsString, path::PathBuf, sync::Arc};

use async_trait::async_trait;
pub use mini_stim_proto_server::{CellState, ServerCellClient};
pub use mini_stim_proto_transport::{
    CellContext, CellMode, CellRuntime, TransportError, TransportResult,
};
use mini_stim_proto_transport::{InspectRegistry, bootstrap as bootstrap_transport, invoke};
use serde::{Deserialize, Serialize};

pub const CLIENT_CELL: &str = "client";
const STATUS_EVENT: &str = "client.status";

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ClientCellStatus {
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
pub trait ClientCell: Send + Sync + 'static {
    async fn status(&self) -> TransportResult<ClientCellStatus>;
}

#[derive(Clone)]
pub struct ClientCellRuntime {
    context: CellContext,
}

impl ClientCellRuntime {
    pub fn context(&self) -> &CellContext {
        &self.context
    }

    pub fn server_client(&self) -> ServerCellClient {
        ServerCellClient::for_context(&self.context)
    }

    pub async fn register<T>(&self, implementation: T) -> TransportResult<()>
    where
        T: ClientCell,
    {
        let implementation = Arc::new(implementation);
        let mut registry = InspectRegistry::new();
        registry.register(STATUS_EVENT, move |_request: StatusRequest| {
            let implementation = Arc::clone(&implementation);
            async move { implementation.status().await }
        });
        mini_stim_proto_transport::serve_inspect(
            &self.context.inspect_socket_for(CLIENT_CELL),
            registry,
        )
        .await
    }
}

impl CellRuntime for ClientCellRuntime {
    fn context(&self) -> &CellContext {
        &self.context
    }
}

#[derive(Clone)]
pub struct ClientCellClient {
    socket_path: PathBuf,
}

impl ClientCellClient {
    pub fn for_context(context: &CellContext) -> Self {
        Self {
            socket_path: context.inspect_socket_for(CLIENT_CELL),
        }
    }

    pub async fn status(&self) -> TransportResult<ClientCellStatus> {
        invoke(&self.socket_path, STATUS_EVENT, StatusRequest {}).await
    }
}

pub fn bootstrap<I>(args: I) -> TransportResult<ClientCellRuntime>
where
    I: IntoIterator<Item = OsString>,
{
    Ok(ClientCellRuntime {
        context: bootstrap_transport(args, CLIENT_CELL)?,
    })
}
