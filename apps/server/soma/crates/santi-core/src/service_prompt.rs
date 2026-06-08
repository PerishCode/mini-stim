use santi_provider::{ProviderFunctionTool, ProviderTool};
use serde_json::json;

pub(crate) fn render_self_assessment_instructions() -> String {
    [
        "<santi-self-assessment>",
        "When asked to assess your own runtime or product capability:",
        "- Ground the answer in visible facts from the santi-meta block, the santi-runtime block, the tool list, and the current conversation.",
        "- When tool results are available, label tool-confirmed facts separately from runtime/context-only facts and unknowns.",
        "- Treat missing facts as unknown; do not infer service health, permissions, durable product-ledger state, or external process state unless visible or tool-confirmed.",
        "- Keep the next action tied to the integrated stim -> santi product loop.",
        "</santi-self-assessment>",
    ]
    .join("\n")
}

pub(crate) fn tooling_instructions() -> String {
    [
        "<santi-tools>",
        "Available tools:",
        "- write_soul_memory(text: string): replace the current soul_memory core index text.",
        "- write_session_memory(text: string): replace the current session_memory core index text.",
        "- shell(command: string, cwd?: string): run a shell command inside the current execution workspace. Unix-like systems use bash by default; Windows uses pwsh by default.",
        "Rules:",
        "- soul_memory and session_memory are replace-whole core indexes, not append-only note stores.",
        "- Do not claim memory has been updated unless the tool call has completed.",
        "- Use shell when the user asks you to inspect or run something in the local workspace.",
        "</santi-tools>",
    ]
    .join("\n")
}

pub(crate) fn provider_tools() -> Vec<ProviderTool> {
    vec![
        ProviderTool::Function(ProviderFunctionTool {
            name: "write_soul_memory".to_string(),
            description: "Replace the current soul_memory core index text.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "The full replacement text for the current soul_memory core index."
                    }
                },
                "required": ["text"],
                "additionalProperties": false
            }),
        }),
        ProviderTool::Function(ProviderFunctionTool {
            name: "write_session_memory".to_string(),
            description: "Replace the current session_memory core index text.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "The full replacement text for the current session_memory core index."
                    }
                },
                "required": ["text"],
                "additionalProperties": false
            }),
        }),
        ProviderTool::Function(ProviderFunctionTool {
            name: "shell".to_string(),
            description: "Run a shell command inside the current execution workspace. Unix-like systems use bash by default; Windows uses pwsh by default."
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
                        "description": "Optional working directory."
                    }
                },
                "required": ["command"],
                "additionalProperties": false
            }),
        }),
    ]
}
