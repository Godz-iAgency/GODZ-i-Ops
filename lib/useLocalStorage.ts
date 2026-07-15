"use client";
import { useEffect, useState } from "react";

// Local-only persistence for the personal ritual tabs (Today, 100 Days, Search,
// Links) that don't touch Airtable. Replaces the Claude-artifact-only
// `window.storage` API with plain browser localStorage.
export function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw));
    } catch {
      // ignore
    } finally {
      setLoaded(true);
    }
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [value, loaded, key]);

  return [value, setValue];
}
