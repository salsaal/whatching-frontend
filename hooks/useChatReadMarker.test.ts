import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInboxUnreadStore } from "@/stores/inboxUnreadStore";

import { useChatReadMarker } from "./useChatReadMarker";

const screenState = { visible: true, focused: true };

beforeEach(() => {
  vi.useFakeTimers();
  screenState.visible = true;
  screenState.focused = true;
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (screenState.visible ? "visible" : "hidden")
  });
  document.hasFocus = () => screenState.focused;
});
afterEach(() => vi.useRealTimers());

const setup = (selectedId = "c1", isSelectionDeliberate = true) => {
  const onMarkRead = vi.fn();
  const view = renderHook(
    (props: { selectedId: string; isSelectionDeliberate: boolean }) =>
      useChatReadMarker({ ...props, onMarkRead }),
    { initialProps: { selectedId, isSelectionDeliberate } }
  );
  return { onMarkRead, view };
};

describe("marking the open chat read", () => {
  it("marks a chat they opened straight away", () => {
    const { onMarkRead, view } = setup();
    act(() => view.result.current("c1"));
    act(() => vi.advanceTimersByTime(0));
    expect(onMarkRead).toHaveBeenCalledWith("c1");
  });

  it("leaves alone a chat that opened by itself, or another chat", () => {
    const { onMarkRead, view } = setup("c1", false);
    act(() => view.result.current("c1"));
    act(() => view.result.current("c2"));
    act(() => vi.advanceTimersByTime(5000));
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it("marks new messages at most once a second", () => {
    const { onMarkRead, view } = setup();
    act(() => view.result.current("c1"));
    act(() => vi.advanceTimersByTime(0));
    for (let index = 0; index < 5; index += 1) {
      act(() => view.result.current("c1"));
      act(() => vi.advanceTimersByTime(100));
    }
    expect(onMarkRead).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(600));
    expect(onMarkRead).toHaveBeenCalledTimes(2);
  });

  it("marks the next chat at once when they switch quickly", () => {
    const { onMarkRead, view } = setup();
    act(() => view.result.current("c1"));
    act(() => vi.advanceTimersByTime(0));
    act(() => view.result.current("c1"));
    view.rerender({ selectedId: "c2", isSelectionDeliberate: true });
    act(() => view.result.current("c2"));
    act(() => vi.advanceTimersByTime(0));
    expect(onMarkRead).toHaveBeenLastCalledWith("c2");
    act(() => vi.advanceTimersByTime(2000));
    expect(onMarkRead).toHaveBeenCalledTimes(2);
  });

  it("waits while the tab is hidden, then marks on return", () => {
    const { onMarkRead, view } = setup();
    screenState.visible = false;
    act(() => view.result.current("c1"));
    act(() => vi.advanceTimersByTime(3000));
    expect(onMarkRead).not.toHaveBeenCalled();

    screenState.visible = true;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => vi.advanceTimersByTime(0));
    expect(onMarkRead).toHaveBeenCalledWith("c1");
  });

  it("waits while the window is in the background, then marks on focus", () => {
    const { onMarkRead, view } = setup();
    screenState.focused = false;
    act(() => view.result.current("c1"));
    act(() => vi.advanceTimersByTime(3000));
    expect(onMarkRead).not.toHaveBeenCalled();

    screenState.focused = true;
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    act(() => vi.advanceTimersByTime(0));
    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });

  it("doesn't mark a chat they left while away", () => {
    const { onMarkRead, view } = setup();
    screenState.visible = false;
    act(() => view.result.current("c1"));
    view.rerender({ selectedId: "c2", isSelectionDeliberate: true });
    screenState.visible = true;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it("tells the nav badge which chat is being read on screen", () => {
    const reading = () => useInboxUnreadStore.getState().readingId;
    const { view } = setup();
    expect(reading()).toBe("c1");

    screenState.focused = false;
    act(() => window.dispatchEvent(new Event("blur")));
    expect(reading()).toBe("");
    screenState.focused = true;
    act(() => window.dispatchEvent(new Event("focus")));
    expect(reading()).toBe("c1");

    screenState.visible = false;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(reading()).toBe("");
    screenState.visible = true;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(reading()).toBe("c1");

    view.rerender({ selectedId: "c1", isSelectionDeliberate: false });
    expect(reading()).toBe("");
    view.rerender({ selectedId: "c2", isSelectionDeliberate: true });
    expect(reading()).toBe("c2");
    view.unmount();
    expect(reading()).toBe("");
  });
});
