import type { ReactElement } from "react";
import { formatDuration, secondsSince } from "@warehouse/ui-kit";

/**
 * Polling is stated plainly rather than disguised as real time. There is
 * no SSE or WebSocket anywhere in this fleet, so claiming "live" would be
 * a lie; "updated 4s ago" is both honest and more useful.
 */
export function LiveIndicator({
  stale,
  lastUpdatedAt,
  onRefresh,
}: {
  stale: boolean;
  lastUpdatedAt: number | null;
  onRefresh: () => void;
}): ReactElement {
  const age = lastUpdatedAt ? secondsSince(new Date(lastUpdatedAt).toISOString()) : null;
  return (
    <div className={`wh-floor__live${stale ? " wh-floor__live--stale" : ""}`}>
      <span aria-hidden className="wh-floor__live-dot" />
      <span>
        {stale
          ? "refresh failed — showing last known"
          : age == null
            ? "updating…"
            : `updated ${formatDuration(age)} ago`}
      </span>
      <button type="button" className="wh-exception__toggle" onClick={onRefresh}>
        Refresh
      </button>
    </div>
  );
}
