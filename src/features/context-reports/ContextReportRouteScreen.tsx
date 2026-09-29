import type { ReactElement } from "react";
import { useParams } from "react-router-dom";
import { ContextReportScreen } from "./ContextReportScreen";
import { REPORT_ROUTES } from "./registry";
import { NotFoundScreen } from "../not-found/NotFoundScreen";
import { useDocumentTitle } from "../../shell/useDocumentTitle";

/**
 * Resolves `/reports/:context` to that context's own config via the
 * shared registry, so App.tsx needs one Route for all nine rather than
 * nine near-identical ones. An unmatched slug (typo'd deep link, or a
 * context whose report hasn't shipped yet) falls through to the shell's
 * own NotFoundScreen exactly like an unmatched top-level route -- this is
 * still inside the shell's route tree, not a 404 from a remote.
 */
export function ContextReportRouteScreen(): ReactElement {
  const { context } = useParams<{ context: string }>();
  const entry = REPORT_ROUTES.find((r) => r.path === context);

  useDocumentTitle(entry?.config.title);

  if (!entry) {
    return <NotFoundScreen />;
  }
  return <ContextReportScreen config={entry.config} />;
}
