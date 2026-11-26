import { beforeEach, describe, expect, it } from "vitest";

import {
  formatUnreadBadge,
  selectUnreadChatCount,
  useInboxUnreadStore
} from "./inboxUnreadStore";

const count = () => selectUnreadChatCount(useInboxUnreadStore.getState());
const store = () => useInboxUnreadStore.getState();

beforeEach(() => store().clear());

describe("unread chats badge", () => {
  it("starts from the unread chat list", () => {
    store().reset("org-1", ["a", "b"], 2);
    expect(count()).toBe(2);
  });

  it("adds and removes chats as they change", () => {
    store().reset("org-1", ["a"], 1);
    store().setUnread("org-1", "b", true);
    store().setUnread("org-1", "b", true);
    expect(count()).toBe(2);
    store().setUnread("org-1", "a", false);
    expect(count()).toBe(1);
    store().markRead("org-1", "b");
    expect(count()).toBe(0);
  });

  it("ignores events for another workspace", () => {
    store().reset("org-1", ["a"], 1);
    store().setUnread("org-2", "b", true);
    store().markRead("org-2", "a");
    expect(count()).toBe(1);
  });

  it("keeps count of unread chats past the loaded page", () => {
    store().reset("org-1", ["a", "b"], 150);
    expect(count()).toBe(150);
    // Read elsewhere and not loaded: one of the chats past the page.
    store().markRead("org-1", "zzz");
    expect(count()).toBe(149);
    // An update saying a chat isn't unread says nothing about the rest.
    store().setUnread("org-1", "yyy", false);
    expect(count()).toBe(149);
  });

  it("reads like WhatsApp", () => {
    expect(formatUnreadBadge(0)).toBe("");
    expect(formatUnreadBadge(7)).toBe("7");
    expect(formatUnreadBadge(99)).toBe("99");
    expect(formatUnreadBadge(100)).toBe("99+");
  });
});
