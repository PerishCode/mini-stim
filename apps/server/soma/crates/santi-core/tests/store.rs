use rusqlite::Connection;
use santi_core::{ActorType, MessageContent, MessageState, SantiStore};

#[test]
fn schema_matches_runtime() {
    let temp = tempfile::tempdir().expect("temp dir");
    let db = temp.path().join("santi.sqlite");
    let store = SantiStore::open(&db).expect("open store");
    drop(store);

    let conn = Connection::open(db).expect("open sqlite");
    for table in [
        "accounts",
        "souls",
        "sessions",
        "messages",
        "r_session_messages",
        "message_events",
        "session_effects",
        "soul_sessions",
        "turns",
        "tool_calls",
        "tool_results",
        "compacts",
        "r_soul_session_messages",
    ] {
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                [table],
                |row| row.get(0),
            )
            .expect("table lookup");
        assert_eq!(exists, 1, "missing table {table}");
    }
}

#[test]
fn appends_relations_in_order() {
    let temp = tempfile::tempdir().expect("temp dir");
    let store = SantiStore::open(temp.path().join("santi.sqlite")).expect("open store");
    let session = store.create_session().expect("create session");
    let user = store
        .append_message(
            &session.id,
            ActorType::Account,
            store.default_account_id(),
            MessageContent::text("hello ordering"),
            MessageState::Fixed,
        )
        .expect("append user")
        .session_message;
    let soul_session = store
        .acquire_soul_session(&session.id)
        .expect("acquire soul session")
        .soul_session;
    let entry = store
        .append_message_ref(&soul_session.id, &user.message.id)
        .expect("append message ref");

    assert_eq!(user.relation.session_seq, 1);
    assert_eq!(entry.soul_session_seq, 1);
    let input = store
        .assembly_input(&soul_session.id)
        .expect("assembly input");
    assert_eq!(input.len(), 1);
    assert_eq!(input[0].role, "user");
    assert_eq!(input[0].content, "hello ordering");
}

#[test]
fn titles_from_first_message() {
    let temp = tempfile::tempdir().expect("temp dir");
    let store = SantiStore::open(temp.path().join("santi.sqlite")).expect("open store");
    let session = store.create_session().expect("create session");
    assert_eq!(session.title, None);
    let title = "first visible session title with enough detail to remain durable";

    store
        .append_message(
            &session.id,
            ActorType::Account,
            store.default_account_id(),
            MessageContent::text(format!("  {title}  ")),
            MessageState::Fixed,
        )
        .expect("append first message");
    store
        .append_message(
            &session.id,
            ActorType::Account,
            store.default_account_id(),
            MessageContent::text("should not replace title"),
            MessageState::Fixed,
        )
        .expect("append second message");

    let session = store
        .session(&session.id)
        .expect("load session")
        .expect("session exists");
    assert_eq!(session.title.as_deref(), Some(title));
}

#[test]
fn trims_session_title() {
    let temp = tempfile::tempdir().expect("temp dir");
    let store = SantiStore::open(temp.path().join("santi.sqlite")).expect("open store");
    let session = store.create_session().expect("create session");

    let session = store
        .update_session_title(&session.id, Some("  renamed title  ".to_string()))
        .expect("update title")
        .expect("session exists");
    assert_eq!(session.title.as_deref(), Some("renamed title"));

    let session = store
        .update_session_title(&session.id, Some("   ".to_string()))
        .expect("clear title")
        .expect("session exists");
    assert_eq!(session.title, None);
}
