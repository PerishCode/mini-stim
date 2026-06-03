use async_trait::async_trait;
use futures_core::Stream;
use std::{pin::Pin, sync::Arc};

#[derive(Debug, Clone)]
pub struct ProviderMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct ProviderRequest {
    pub model: String,
    pub input: Vec<ProviderMessage>,
}

#[derive(Debug, Clone)]
pub struct ProviderMetadata {
    pub provider: Arc<str>,
    pub model: String,
}

#[derive(Debug, Clone)]
pub enum ProviderEvent {
    TextDelta(String),
    Completed {
        provider_response_id: Option<String>,
    },
    Failed(String),
}

pub type ProviderStream =
    Pin<Box<dyn Stream<Item = Result<ProviderEvent, String>> + Send + 'static>>;

#[async_trait]
pub trait ProviderClient: Send + Sync {
    fn metadata(&self) -> ProviderMetadata;

    async fn stream_response(&self, request: ProviderRequest) -> Result<ProviderStream, String>;
}
