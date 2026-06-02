// Loaded via --require before Next.js. Overwrites any broken localStorage
// implementation injected by the host environment.
const store = Object.create(null)
const impl = {
  getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null },
  setItem(key, value) { store[key] = String(value) },
  removeItem(key) { delete store[key] },
  clear() { for (const k of Object.keys(store)) delete store[k] },
  key(index) { return Object.keys(store)[index] ?? null },
  get length() { return Object.keys(store).length },
}
Object.defineProperty(globalThis, 'localStorage', {
  value: impl,
  writable: true,
  configurable: true,
})
