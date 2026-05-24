import { useEffect, useRef, useState } from 'react';

/**
 * `useState` whose value is mirrored into `sessionStorage`, so it survives
 * component unmount / route navigation within the same browser tab. Values
 * are wiped when the tab closes — which is what you want for things like
 * search boxes, filters, and pagination: sticky during a session, but never
 * silently reapplying weeks later.
 *
 * The `key` must be unique across the app. Prefix with the screen name to
 * avoid collisions (e.g. `'invoiceList.all.search'`).
 *
 * Reads run once during the initial `useState` call and never again, so
 * mounting/unmounting is cheap. Writes are debounced via a microtask flush
 * isn't worth it here — the values are small and writes are rare (user
 * interaction), so a direct `setItem` on every change is fine.
 */
export function usePersistentState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return typeof initial === 'function' ? (initial as () => T)() : initial;
    }
    try {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      // Corrupt entry — fall through to the initial value and overwrite below.
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });

  // Skip the first effect so we don't immediately rewrite the value we just
  // read. Subsequent updates persist.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota or private-browsing failure — non-fatal, the UI still works.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
