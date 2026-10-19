// The world and the accessibility mirror live in different React trees, and
// the canvas reads this every frame rather than re-rendering — so this is a
// plain mutable cell, not state.
//
// Lumen opens by default: a visitor who only scrolls should still arrive at a
// lit, labelled pipeline without having to operate a disclosure first.
export const DEFAULT_ENTRY = "Lumen Technologies";

const world = { activeEntry: DEFAULT_ENTRY as string | null };
const listeners = new Set<() => void>();

export function setActiveEntry(name: string | null) {
  if (world.activeEntry === name) return;
  world.activeEntry = name;
  listeners.forEach((listener) => listener());
}

export function getActiveEntry() {
  return world.activeEntry;
}

/** Server and first client render have to agree, so both read the default. */
export function getServerActiveEntry() {
  return DEFAULT_ENTRY;
}

export function subscribeActiveEntry(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
