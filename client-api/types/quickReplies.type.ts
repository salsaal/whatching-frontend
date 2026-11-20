export interface QuickReply {
  id: string;
  /** Lowercase letters, numbers, "-" and "_"; typed after "/" in the inbox. */
  shortcut: string;
  title: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuickReplyPayload {
  shortcut: string;
  title: string;
  text: string;
}

export interface QuickRepliesResponse {
  status: string;
  data: { quickReplies: QuickReply[] };
}

export interface QuickReplyResponse {
  status: string;
  data: { quickReply: QuickReply };
}
