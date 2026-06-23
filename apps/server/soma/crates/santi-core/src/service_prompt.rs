use santi_provider::{ProviderFunctionTool, ProviderTool};
use serde_json::json;

pub(crate) fn provider_tools() -> Vec<ProviderTool> {
    vec![ProviderTool::Function(ProviderFunctionTool {
        name: "shell".to_string(),
        description: "Run a shell command. By default commands run in the current execution workspace. Use cwd \"@soul\" to work in the current soul memory workspace, where @soul/MEMORY.md is the global memory source. Use cwd \"@session\" to work in the current session memory workspace, where @session/MEMORY.md is the local doing/todo memory source. Unix-like systems use bash by default; Windows uses pwsh by default."
            .to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The shell command to execute."
                },
                "cwd": {
                    "type": "string",
                    "description": "Optional working directory. Supports @soul, @soul/<path>, @session, and @session/<path> aliases."
                }
            },
            "required": ["command"],
            "additionalProperties": false
        }),
    })]
}
