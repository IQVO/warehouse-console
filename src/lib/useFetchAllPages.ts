import { useCallback, useEffect, useRef, useState } from "react";
import { FetchError } from "@warehouse/ui-kit";

/** Hard stop on a collection walk: a producer that keeps returning a nextCursor must not loop the console forever. */
export const MAX_PAGES = 50;
const PAGE_LIMIT = 500;

interface Page<T> {
  items: T[];
  nextCursor?: string;
}

function isPage<T>(body: unknown): body is Page<T> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return false;
  const items: unknown = Reflect.get(body, "items");
  const next: unknown = Reflect.get(body, "nextCursor");
  return Array.isArray(items) && (next === undefined || next === null || typeof next === "string");
}

/**
 * Reads a whole fleet collection: GETs `url` (limit=500), follows `nextCursor`
 * (as the `cursor` query parameter) until it is absent, and returns every
 * item. A 200 that is not a `{items,nextCursor}` page (a bare array, a missing
 * or null `items`) is REFUSED with a FetchError, never read as an empty list;
 * so is a walk that exceeds MAX_PAGES, rather than silently truncating.
 */
export async function fetchAllPages<T>(url: string, signal?: AbortSignal): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | undefined;
  for (let pages = 0; pages < MAX_PAGES; pages++) {
    const u = new URL(url, window.location.origin);
    u.searchParams.set("limit", String(PAGE_LIMIT));
    if (cursor) u.searchParams.set("cursor", cursor);
    const res = await fetch(u.toString(), { signal });
    if (!res.ok) {
      throw new FetchError(`Request failed with ${res.status} ${res.statusText}`, res.status, url);
    }
    const body: unknown = await res.json();
    if (!isPage<T>(body)) {
      throw new FetchError("Response is not a {items,nextCursor} page", res.status, url);
    }
    all.push(...body.items);
    if (!body.nextCursor) return all;
    cursor = body.nextCursor;
  }
  throw new FetchError(`Collection exceeds ${MAX_PAGES} pages; refusing to truncate`, null, url);
}

export interface AllPagesState<T> {
  /** Last GOOD complete walk; null until the first one succeeds. */
  data: T[] | null;
  error: Error | null;
}

/** Polling counterpart of `useFetch` for a paged collection. Keeps the last good data across a failed refresh. */
export function useFetchAllPages<T>(url: string | null, opts?: { pollMs?: number }): AllPagesState<T> {
  const pollMs = opts?.pollMs;
  const [state, setState] = useState<AllPagesState<T>>({ data: null, error: null });
  const [targetUrl, setTargetUrl] = useState(url);
  if (targetUrl !== url) {
    setTargetUrl(url);
    setState({ data: null, error: null });
  }
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    if (!url) return;
    const id = ++requestId.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await fetchAllPages<T>(url, controller.signal);
      if (id !== requestId.current) return;
      setState({ data, error: null });
    } catch (err) {
      if (controller.signal.aborted || id !== requestId.current) return;
      const error = err instanceof Error ? err : new FetchError(String(err), null, url);
      setState((s) => ({ ...s, error }));
    }
  }, [url]);

  useEffect(() => {
    if (!url) return;
    // eslint-disable-next-line react/set-state-in-effect
    void run();
    if (!pollMs) return;
    const interval = setInterval(() => void run(), pollMs);
    return () => clearInterval(interval);
  }, [url, run, pollMs]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return state;
}
