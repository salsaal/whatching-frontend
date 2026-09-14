// Node 22+ ships an experimental native `localStorage` global that's
// non-functional without a --localstorage-file backing path (see the
// "Warning: `--localstorage-file` was provided without a valid path"
// noise this produces). It appears to shadow jsdom's own working
// implementation in this environment, so any store using zustand's
// `persist` + `createJSONStorage(() => localStorage)` fails with
// "storage.setItem is not a function". Force a real, working in-memory
// implementation before any test module (and therefore any store) loads.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  writable: true,
  configurable: true
});
