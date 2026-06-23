use std::{
    path::{Component, Path, PathBuf},
    process::Command,
};

use santi_provider::{FunctionCallOutput, ProviderFunctionCall};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::SantiStreamPayload;

use super::SantiService;

impl SantiService {
    pub(super) fn handle_tool_call(
        &self,
        session_id: &str,
        soul_session_id: &str,
        turn_id: &str,
        call: ProviderFunctionCall,
    ) -> Result<FunctionCallOutput, String> {
        let tool_call =
            self.store
                .append_tool_call(turn_id, &call.call_id, &call.name, &call.arguments)?;
        self.publish_stream(
            session_id,
            SantiStreamPayload::ToolCallCreated {
                tool_call: tool_call.clone(),
            },
        );
        let dispatch = self.dispatch_tool(session_id, soul_session_id, &call);
        let (output, error_text) = match dispatch {
            Ok(output) => (Some(output), None),
            Err(error) => (None, Some(error)),
        };
        let result =
            self.store
                .append_tool_result(&call.call_id, output.clone(), error_text.clone())?;
        self.publish_stream(
            session_id,
            SantiStreamPayload::ToolResultCreated {
                tool_result: result.clone(),
            },
        );
        Ok(FunctionCallOutput {
            call_id: call.call_id.clone(),
            call,
            output: serde_json::to_string(&json!({
                "ok": error_text.is_none(),
                "output": result.output,
                "error": result.error_text,
            }))
            .map_err(|error| error.to_string())?,
            assistant_content: None,
            reasoning_content: None,
        })
    }

    fn dispatch_tool(
        &self,
        session_id: &str,
        _soul_session_id: &str,
        call: &ProviderFunctionCall,
    ) -> Result<Value, String> {
        match call.name.as_str() {
            "shell" => {
                let args = parse_tool_args::<ShellArgs>(&call.arguments)?;
                self.run_shell(session_id, args)
            }
            name => Err(format!("unsupported tool: {name}")),
        }
    }

    fn run_shell(&self, session_id: &str, args: ShellArgs) -> Result<Value, String> {
        std::fs::create_dir_all(self.soul_memory_dir()).map_err(|error| error.to_string())?;
        std::fs::create_dir_all(self.session_memory_dir(session_id))
            .map_err(|error| error.to_string())?;
        let cwd = self.resolve_shell_cwd(session_id, args.cwd.as_deref())?;
        std::fs::create_dir_all(&cwd).map_err(|error| error.to_string())?;
        let mut command = shell_command(&args.command);
        let output = command
            .current_dir(&cwd)
            .env("SANTI_SOUL_MEMORY_DIR", self.soul_memory_dir())
            .env(
                "SANTI_SESSION_MEMORY_DIR",
                self.session_memory_dir(session_id),
            )
            .output()
            .map_err(|error| format!("failed to run shell: {error}"))?;
        Ok(json!({
            "exit_code": output.status.code().unwrap_or(-1),
            "stdout": String::from_utf8_lossy(&output.stdout),
            "stderr": String::from_utf8_lossy(&output.stderr),
            "shell": default_shell_name(),
            "cwd": cwd.display().to_string(),
        }))
    }

    fn resolve_shell_cwd(&self, session_id: &str, cwd: Option<&str>) -> Result<PathBuf, String> {
        let Some(cwd) = cwd else {
            return Ok(self.execution_root());
        };
        if let Some(path) = cwd.strip_prefix("@soul") {
            return aliased_path(self.soul_memory_dir(), path, "@soul");
        }
        if let Some(path) = cwd.strip_prefix("@session") {
            return aliased_path(self.session_memory_dir(session_id), path, "@session");
        }
        Ok(PathBuf::from(cwd))
    }

    pub(super) fn runtime_root(&self) -> PathBuf {
        PathBuf::from(&self.config.runtime_root)
    }

    pub(super) fn execution_root(&self) -> PathBuf {
        PathBuf::from(&self.config.execution_root)
    }

    pub(super) fn soul_memory_dir(&self) -> PathBuf {
        self.runtime_root().join("souls").join("memory")
    }

    pub(super) fn soul_memory_file(&self) -> PathBuf {
        self.soul_memory_dir().join("MEMORY.md")
    }

    pub(super) fn session_memory_dir(&self, session_id: &str) -> PathBuf {
        self.runtime_root()
            .join("sessions")
            .join(session_id)
            .join("memory")
    }

    pub(super) fn session_memory_file(&self, session_id: &str) -> PathBuf {
        self.session_memory_dir(session_id).join("MEMORY.md")
    }
}

#[derive(Debug, Deserialize)]
struct ShellArgs {
    command: String,
    cwd: Option<String>,
}

fn shell_command(command: &str) -> Command {
    #[cfg(windows)]
    {
        let mut shell = Command::new("pwsh");
        shell
            .arg("-NoLogo")
            .arg("-NoProfile")
            .arg("-Command")
            .arg(command);
        shell
    }

    #[cfg(not(windows))]
    {
        let mut shell = Command::new("/bin/bash");
        shell.arg("-lc").arg(command);
        shell
    }
}

fn default_shell_name() -> &'static str {
    if cfg!(windows) { "pwsh" } else { "bash" }
}

fn aliased_path(root: PathBuf, suffix: &str, alias: &str) -> Result<PathBuf, String> {
    if suffix.is_empty() {
        return Ok(root);
    }
    let Some(path) = suffix.strip_prefix('/') else {
        return Err(format!("invalid cwd alias: {alias}{suffix}"));
    };
    let path = Path::new(path);
    if path.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        return Err(format!("cwd alias cannot escape {alias}"));
    }
    Ok(root.join(path))
}

fn parse_tool_args<T: for<'de> Deserialize<'de>>(value: &Value) -> Result<T, String> {
    serde_json::from_value(value.clone()).map_err(|error| error.to_string())
}
