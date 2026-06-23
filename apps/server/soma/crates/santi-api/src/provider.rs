use std::{env, sync::Arc};

use santi_provider::{
    DeepSeekProvider, DeepSeekProviderConfig, OpenAIProvider, OpenAIProviderConfig, ProviderClient,
};

pub(crate) fn from_env() -> Result<Arc<dyn ProviderClient>, String> {
    match env::var("SANTI_PROVIDER")
        .unwrap_or_else(|_| "openai".to_string())
        .as_str()
    {
        "openai" => openai_provider(),
        "deepseek" => deepseek_provider(),
        provider => Err(format!("unsupported SANTI_PROVIDER: {provider}")),
    }
}

fn openai_provider() -> Result<Arc<dyn ProviderClient>, String> {
    Ok(Arc::new(OpenAIProvider::new(OpenAIProviderConfig {
        api_key: env::var("OPENAI_API_KEY")
            .map_err(|_| "OPENAI_API_KEY is required".to_string())?,
        model: env::var("OPENAI_MODEL").map_err(|_| "OPENAI_MODEL is required".to_string())?,
        base_url: env::var("OPENAI_RESPONSES_BASE_URL")
            .unwrap_or_else(|_| "https://api.openai.com/v1".to_string()),
        reasoning_effort: optional_env("OPENAI_REASONING_EFFORT"),
        reasoning_summary: optional_env("OPENAI_REASONING_SUMMARY"),
        max_output_tokens: optional_u32_env("OPENAI_MAX_OUTPUT_TOKENS")?,
    })))
}

fn deepseek_provider() -> Result<Arc<dyn ProviderClient>, String> {
    Ok(Arc::new(DeepSeekProvider::new(DeepSeekProviderConfig {
        api_key: env::var("DEEPSEEK_API_KEY")
            .map_err(|_| "DEEPSEEK_API_KEY is required".to_string())?,
        model: env::var("DEEPSEEK_MODEL").unwrap_or_else(|_| "deepseek-v4-pro".to_string()),
        base_url: env::var("DEEPSEEK_BASE_URL")
            .unwrap_or_else(|_| "https://api.deepseek.com".to_string()),
        thinking: optional_env("DEEPSEEK_THINKING"),
        reasoning_effort: optional_env("DEEPSEEK_REASONING_EFFORT"),
        max_tokens: optional_u32_env("DEEPSEEK_MAX_TOKENS")?,
    })))
}

fn optional_u32_env(name: &str) -> Result<Option<u32>, String> {
    optional_env(name)
        .map(|value| {
            value
                .parse::<u32>()
                .map_err(|_| format!("{name} must be an unsigned integer"))
        })
        .transpose()
}

fn optional_env(name: &str) -> Option<String> {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}
