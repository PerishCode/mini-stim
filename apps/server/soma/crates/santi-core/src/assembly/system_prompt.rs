use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::{SoulProfile, SoulSession, Timestamp, timestamp_from_system_time};

const SOUL_SOURCE: &str = "@soul/MEMORY.md";
const SESSION_SOURCE: &str = "@session/MEMORY.md";
const SANTI_CHANNEL: &str = "mini-stim";
const SANTI_HINT: &str = "Use soul memory for global identity, values, worldview, methods, and self-understanding. Use session memory for local doing/todo. Keep memory concise and index workspace sources.";

pub(crate) struct SystemPromptRequest<'a> {
    pub session_id: &'a str,
    pub soul_session: &'a SoulSession,
    pub soul_profile: &'a SoulProfile,
    pub soul_memory_path: PathBuf,
    pub session_memory_path: PathBuf,
}

pub(crate) fn render_system_prompt(request: SystemPromptRequest<'_>) -> Result<String, String> {
    let soul_memory = read_memory_material(&request.soul_memory_path)?;
    let session_memory = read_memory_material(&request.session_memory_path)?;
    let hint = render_hint(frontmatter_hint_state(&soul_memory.content));

    Ok([
        "You are a distinct soul running inside this Santi instance.".to_string(),
        render_meta(request, &hint),
        render_memory_section("santi-soul", SOUL_SOURCE, &soul_memory),
        render_memory_section("santi-session", SESSION_SOURCE, &session_memory),
    ]
    .join("\n\n"))
}

fn render_meta(request: SystemPromptRequest<'_>, hint: &str) -> String {
    [
        "[santi-meta]".to_string(),
        format!("channel: {SANTI_CHANNEL}"),
        format!("soul_id: {}", request.soul_session.soul_id),
        format!("soul_name: {}", request.soul_profile.soul_name),
        format!("session_id: {}", request.session_id),
        format!("hint: {hint}"),
    ]
    .join("\n")
}

fn render_memory_section(name: &str, source: &str, memory: &MemoryMaterial) -> String {
    [
        format!("[{name}]"),
        format!("source: {source}"),
        format!(
            "updated_at: {}",
            memory.updated_at.as_deref().unwrap_or("null")
        ),
        "content:".to_string(),
        memory.content.clone(),
    ]
    .join("\n")
}

fn read_memory_material(path: &Path) -> Result<MemoryMaterial, String> {
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => return Err(error.to_string()),
    };
    let updated_at = match fs::metadata(path) {
        Ok(metadata) => metadata
            .modified()
            .ok()
            .and_then(|modified| timestamp_from_system_time(modified).ok()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(error.to_string()),
    };
    Ok(MemoryMaterial {
        content,
        updated_at,
    })
}

fn render_hint(state: HintState) -> String {
    match state {
        HintState::Enabled => {
            format!("{SANTI_HINT} disable by set santi_hint: false in {SOUL_SOURCE}")
        }
        HintState::Hidden => {
            format!("Hidden, enable by set santi_hint: true in {SOUL_SOURCE}")
        }
        HintState::InvalidFrontmatter => {
            format!("Invalid frontmatter in {SOUL_SOURCE}. Use --- with santi_hint: true|false.")
        }
        HintState::InvalidValue => {
            format!("Invalid santi_hint in {SOUL_SOURCE}. Use true|false.")
        }
    }
}

fn frontmatter_hint_state(content: &str) -> HintState {
    let frontmatter = match frontmatter(content) {
        Frontmatter::Missing => return HintState::Hidden,
        Frontmatter::Invalid => return HintState::InvalidFrontmatter,
        Frontmatter::Present(frontmatter) => frontmatter,
    };
    let value = match frontmatter_value(frontmatter, "santi_hint") {
        FrontmatterValue::Missing => return HintState::Hidden,
        FrontmatterValue::Invalid => return HintState::InvalidFrontmatter,
        FrontmatterValue::Found(value) => value,
    };
    match value {
        "true" => HintState::Enabled,
        "false" => HintState::Hidden,
        _ => HintState::InvalidValue,
    }
}

fn frontmatter(content: &str) -> Frontmatter<'_> {
    let mut lines = content.lines();
    if lines.next() != Some("---") {
        return Frontmatter::Missing;
    }
    let body_start = 4;
    for (offset, line) in content[body_start..].lines().enumerate() {
        if line == "---" {
            let end = content[body_start..]
                .lines()
                .take(offset)
                .map(|line| line.len() + 1)
                .sum::<usize>();
            return Frontmatter::Present(&content[body_start..body_start + end]);
        }
    }
    Frontmatter::Invalid
}

fn frontmatter_value<'a>(frontmatter: &'a str, key: &str) -> FrontmatterValue<'a> {
    for line in frontmatter.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((candidate, value)) = line.split_once(':') else {
            return FrontmatterValue::Invalid;
        };
        if candidate.trim() == key {
            return FrontmatterValue::Found(value.trim());
        }
    }
    FrontmatterValue::Missing
}

#[derive(Debug, PartialEq, Eq)]
enum HintState {
    Enabled,
    Hidden,
    InvalidFrontmatter,
    InvalidValue,
}

enum Frontmatter<'a> {
    Missing,
    Present(&'a str),
    Invalid,
}

enum FrontmatterValue<'a> {
    Missing,
    Found(&'a str),
    Invalid,
}

struct MemoryMaterial {
    content: String,
    updated_at: Option<Timestamp>,
}
