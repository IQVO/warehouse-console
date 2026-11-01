import type { ReactElement } from "react";
import {
  SEVERITY_RANK,
  type OpenException,
  type PathBrief,
  type Severity,
} from "./types";

export function PathCard({
  siteCode,
  path,
}: {
  siteCode: string;
  path: PathBrief;
}): ReactElement {
  const worst = worstSeverity(path.exceptions);
  const cls = worst ? ` wh-path--${worst}` : "";

  return (
    <article className={`wh-path${cls}`}>
      <header className="wh-path__head">
        <span className="wh-path__name">
          {siteCode} · {path.pathId}
        </span>
        <span className="wh-path__process">{path.processPath}</span>
      </header>

      <dl className="wh-path__metrics">
        <Metric
          label="Backlog"
          value={path.backlog?.backlogDepth}
          alarm={path.backlog?.overAlarmThreshold}
        />
        <Metric label="WIP" value={path.backlog?.wip} />
        <Metric label="Queue" value={path.queue?.depth} />
        <Metric
          label="Heads"
          value={
            path.staffing
              ? `${path.staffing.activeHeads}/${path.staffing.plannedHeads}`
              : undefined
          }
          warn={path.staffing?.understaffed}
        />
        {/* The only comparison this screen makes, and it is not an
            invented threshold: warehouse-ops-agent's own deriveExceptions
            treats `Stuck.Count > 0` as one of its correlated signals, so
            this mirrors the upstream definition rather than picking a
            cutoff of our own. Everything else reads a boolean the backend
            already computed. */}
        <Metric
          label="Stuck"
          value={path.stuck?.count}
          alarm={(path.stuck?.count ?? 0) > 0}
        />
      </dl>

      {path.unavailable && path.unavailable.length > 0 && (
        <ul className="wh-path__unavailable">
          {path.unavailable.map((entry, i) => {
            const [service, ...rest] = entry.split(":");
            return (
              <li key={i}>
                <span className="wh-path__unavailable-service">
                  no signal from {service.trim()}
                </span>
                {rest.length > 0 && rest.join(":").trim()
                  ? ` — ${rest.join(":").trim()}`
                  : ""}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

/**
 * `undefined` means the upstream did not answer. It renders "—" in warning
 * tone, never 0 -- "no reading" and "a reading of zero" are different
 * operational facts and must not look alike.
 */
function Metric({
  label,
  value,
  alarm,
  warn,
}: {
  label: string;
  value?: number | string | null;
  alarm?: boolean;
  warn?: boolean;
}): ReactElement {
  const missing = value === undefined || value === null;
  const cls = missing
    ? " wh-path__metric-value--nosignal"
    : alarm
      ? " wh-path__metric-value--alarm"
      : warn
        ? " wh-path__metric-value--warn"
        : "";
  return (
    <>
      <dt className="wh-path__metric-label">{label}</dt>
      <dd className={`wh-path__metric-value${cls}`}>
        {missing ? "—" : value}
        {missing && <span className="wh-visually-hidden"> no signal</span>}
      </dd>
    </>
  );
}

function worstSeverity(exceptions?: OpenException[]): Severity | null {
  if (!exceptions || exceptions.length === 0) return null;
  return exceptions.reduce<Severity>(
    (worst, e) =>
      SEVERITY_RANK[e.severity] < SEVERITY_RANK[worst] ? e.severity : worst,
    "info",
  );
}
