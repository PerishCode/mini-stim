use santi_core::ChatStore;

#[test]
fn send_preserves_message_order() {
    let temp = tempfile::tempdir().expect("temp dir");
    let store = ChatStore::open(temp.path().join("chat.sqlite")).expect("open store");

    let accepted = store
        .begin_send(
            None,
            "hello ordering".to_string(),
            "test-provider",
            "test-model",
        )
        .expect("begin send");
    store
        .append_delta(
            &accepted.response_run_id,
            &accepted.assistant_message_id,
            "assistant reply",
        )
        .expect("append delta");
    let assistant = store
        .complete_run(
            &accepted.response_run_id,
            &accepted.assistant_message_id,
            Some("resp_test"),
        )
        .expect("complete run");

    let detail = store
        .conversation_detail(&accepted.conversation_id)
        .expect("load detail")
        .expect("conversation detail");

    assert_eq!(detail.messages.len(), 2);
    assert_eq!(detail.messages[0].message_id, accepted.user_message_id);
    assert_eq!(detail.messages[0].text, "hello ordering");
    assert_eq!(detail.messages[1].message_id, assistant.message_id);
    assert_eq!(detail.messages[1].text, "assistant reply");
}
