import type { components } from "./openapi";

export type { components, paths } from "./openapi";

export type ConversationSummary =
  components["schemas"]["ConversationSummary"];
export type ConversationDetail = components["schemas"]["ConversationDetail"];
export type MessageRecord = components["schemas"]["MessageRecord"];
export type SendMessageRequest =
  components["schemas"]["SendMessageRequest"];
export type StreamEvent = components["schemas"]["StreamEvent"];
