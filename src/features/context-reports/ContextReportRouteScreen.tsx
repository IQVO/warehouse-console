import type { ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import { ContextReportScreen } from "./ContextReportScreen";
import { REPORT_ROUTES } from "./registry";
import { NotFoundScreen } from "../not-found/NotFoundScreen";
import { useDocumentTitle } from "../../shell/useDocumentTitle";

/**
 * Resolves `/reports/:context` to that context's own config via the
 * shared registry, so App.tsx needs one Route for all of them rather
 * than one near-identical Route per report. An unmatched slug (typo'd deep link, or a
 * context whose report hasn't shipped yet) falls through to the shell's
 * own NotFoundScreen exactly like an unmatched top-level route -- this is
 * still inside the shell's route tree, not a 404 from a remote.
 *
 * A context may register SEVERAL reports (warehouse-planning serves three,
 * network-inventory-planning four): the first keeps the bare context slug, the
 * rest use `<context>-<report>`. Every registry entry of the same `contextId`
 * is listed as a sibling link above the screen so the extra reports are
 * reachable without typing a URL.
 */
export function ContextReportRouteScreen(): ReactElement {
  const { context } = useParams<{ context: string }>();
  const entry = REPORT_ROUTES.find((r) => r.path === context);

  useDocumentTitle(entry?.config.title);

  if (!entry) {
    return <NotFoundScreen />;
  }
  const siblings = REPORT_ROUTES.filter(
    (r) => r.config.contextId === entry.config.contextId,
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--wh-space-4)" }}>
      {siblings.length > 1 && (
        <nav
          aria-label={`${entry.config.contextId} reports`}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--wh-space-3)",
            fontSize: "var(--wh-font-size-sm)",
          }}
        >
          {siblings.map((s) =>
            s.path === entry.path ? (
              <span key={s.path} aria-current="page" style={{ fontWeight: 600 }}>
                {s.config.title}
              </span>
            ) : (
              <Link
                key={s.path}
                to={`/reports/${s.path}`}
                style={{ color: "var(--wh-color-accent)", textDecoration: "none" }}
              >
                {s.config.title}
              </Link>
            ),
          )}
        </nav>
      )}
      <ContextReportScreen key={entry.path} config={entry.config} />
    </div>
  );
}
