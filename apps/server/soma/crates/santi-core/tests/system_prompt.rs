use std::{fs, sync::Arc};

use async_trait::async_trait;
use futures_util::stream;
use santi_core::{
    MaterialKind, MaterialRequest, SantiService, SantiServiceConfig, SessionMaterial,
};
use santi_provider::{ProviderClient, ProviderMetadata, ProviderStream};

#[derive(Clone)]
struct FakeProvider;

#[async_trait]
impl ProviderClient for FakeProvider {
    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            provider: Arc::from("fake-provider"),
            model: "fake-model".to_string(),
        }
    }

    async fn stream_response(
        &self,
        _request: santi_provider::ProviderRequest,
    ) -> Result<ProviderStream, String> {
        Ok(Box::pin(stream::empty()))
    }
}

#[test]
fn renders_material_shape() {
    let harness = PromptHarness::open();
    harness.write_soul("---\nsanti_hint: true\n---\n# Soul");
    harness.write_session("# Session");

    let text = harness.system_prompt().text;

    assert!(text.contains("You are a distinct soul running inside this Santi instance."));
    assert!(text.contains("[santi-meta]"));
    assert!(text.contains("channel: mini-stim"));
    assert!(text.contains("soul_name: Liberte"));
    assert!(text.contains("[santi-soul]"));
    assert!(text.contains("[santi-session]"));
    assert!(text.contains("hint: Use soul memory"));
    assert!(text.contains("source: @soul/MEMORY.md"));
    assert!(text.contains("source: @session/MEMORY.md"));
    assert!(text.contains("content:\n---\nsanti_hint: true\n---\n# Soul"));
    assert!(text.contains("content:\n# Session"));
}

#[test]
fn reports_hidden_hint() {
    let harness = PromptHarness::open();
    harness.write_soul("---\nsanti_hint: false\n---\n# Soul");

    let text = harness.system_prompt().text;

    assert!(text.contains("hint: Hidden, enable by set santi_hint: true in @soul/MEMORY.md"));
}

#[test]
fn reports_invalid_hint() {
    let harness = PromptHarness::open();
    harness.write_soul("---\nsanti_hint: yes\n---\n# Soul");

    let text = harness.system_prompt().text;

    assert!(text.contains("hint: Invalid santi_hint in @soul/MEMORY.md. Use true|false."));
}

#[test]
fn reports_invalid_frontmatter() {
    let harness = PromptHarness::open();
    harness.write_soul("---\nsanti_hint true\n---\n# Soul");

    let text = harness.system_prompt().text;

    assert!(text.contains("hint: Invalid frontmatter in @soul/MEMORY.md. Use --- with santi_hint"));
}

struct PromptHarness {
    _temp: tempfile::TempDir,
    service: SantiService,
    session_id: String,
    runtime_root: std::path::PathBuf,
}

impl PromptHarness {
    fn open() -> Self {
        let temp = tempfile::tempdir().expect("temp dir");
        let runtime_root = temp.path().join("runtime");
        let service = SantiService::open(
            SantiServiceConfig {
                database_path: temp.path().join("santi.sqlite").display().to_string(),
                runtime_root: runtime_root.display().to_string(),
                execution_root: temp.path().join("execution").display().to_string(),
                bind_addr: Some("127.0.0.1:0".to_string()),
            },
            Arc::new(FakeProvider),
        )
        .expect("open service");
        let session_id = service
            .create_session()
            .expect("create session")
            .session
            .session
            .id;
        Self {
            _temp: temp,
            service,
            session_id,
            runtime_root,
        }
    }

    fn write_soul(&self, text: &str) {
        let path = self.runtime_root.join("souls").join("memory");
        fs::create_dir_all(&path).expect("create soul dir");
        fs::write(path.join("MEMORY.md"), text).expect("write soul");
    }

    fn write_session(&self, text: &str) {
        let path = self
            .runtime_root
            .join("sessions")
            .join(&self.session_id)
            .join("memory");
        fs::create_dir_all(&path).expect("create session dir");
        fs::write(path.join("MEMORY.md"), text).expect("write session");
    }

    fn system_prompt(&self) -> SessionMaterial {
        self.service
            .session_material(
                &self.session_id,
                MaterialRequest {
                    kind: MaterialKind::SystemPrompt,
                },
            )
            .expect("system prompt material")
    }
}
