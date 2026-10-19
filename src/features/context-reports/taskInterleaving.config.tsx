import type { ReactElement } from "react";
import { BarChart, Card, DataTable, LineChart } from "@warehouse/ui-kit";
import {
  formatDuration,
  formatNumber,
  formatPercent,
} from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { formatReportDay, trailingDays, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * task-interleaving's "Hint Adoption" report.
 *
 * Real endpoint + DTO shape read from task-interleaving/apis/openapi.yaml
 * (HintAdoptionReport, served by the ti-reports binary):
 *
 *   GET /reports/hint-adoption?from=&to=&siteId=&granularity=day
 *   -> { from, to, site_id?, granularity,
 *        days: [{ day, hints_issued, hints_consumed, hints_expired,
 *                 adoption_rate, consumed_first_rank, mean_detour_m,
 *                 time_to_consume: { count, p50_seconds, p95_seconds } }] }
 *   GET /reports/freshness -> { as_of, lag_seconds }
 *
 * Dense (zero days included). `adoption_rate` is consumed / (consumed +
 * expired) of the hints that ENDED in the day, and is null while none did;
 * `mean_detour_m` is null when nothing was consumed; the time_to_consume
 * percentiles are null when `count` is 0. Every null renders as "—" (no
 * reading), never a calm 0% / 0 m / 0s. A hint superseded by a newer one is
 * in no denominator (it emits neither ending event). The window-total
 * adoption rate is NOT shown: it would have to be re-derived from the
 * per-day counts, which the API defines per day; the table carries the
 * API's own rates. The screen asks for every site (no siteId). Wire is
 * snake_case; DTOs mirror it. Trailing 30 days. Freshness is the
 * context-level /reports/freshness.
 */
export interface ConsumeTimingDto {
  count: number;
  p50_seconds: number | null;
  p95_seconds: number | null;
}

export interface HintAdoptionDayDto {
  day: string;
  hints_issued: number;
  hints_consumed: number;
  hints_expired: number;
  adoption_rate: number | null;
  consumed_first_rank: number;
  mean_detour_m: number | null;
  time_to_consume: ConsumeTimingDto;
}

export interface HintAdoptionReportDto {
  from: string;
  to: string;
  site_id?: string;
  granularity: string;
  days: HintAdoptionDayDto[];
}

const WINDOW = trailingDays(30);

function issuedSeries(days: HintAdoptionDayDto[]): { label: string; value: number }[] {
  return [...days]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({ label: formatReportDay(d.day), value: d.hints_issued }));
}

function rate(d: HintAdoptionDayDto): string {
  return d.adoption_rate == null ? "—" : formatPercent(d.adoption_rate * 100);
}

function detour(d: HintAdoptionDayDto): string {
  return d.mean_detour_m == null ? "—" : `${formatNumber(d.mean_detour_m)} m`;
}

function renderBody(data: HintAdoptionReportDto): ReactElement {
  const days = data.days;
  const sum = (pick: (d: HintAdoptionDayDto) => number) =>
    days.reduce((acc, d) => acc + pick(d), 0);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Hints Issued per Day">
          <LineChart
            title="ISSUED"
            data={issuedSeries(days)}
            emptyState={<div>No interleaving hints in this window.</div>}
          />
        </Card>
        <Card title="Hint Outcomes (Window Totals)">
          <BarChart
            title="HINTS"
            data={[
              { label: "Issued", value: sum((d) => d.hints_issued) },
              { label: "Consumed", value: sum((d) => d.hints_consumed) },
              { label: "Expired", value: sum((d) => d.hints_expired) },
            ]}
            emptyState={<div>No interleaving hints in this window.</div>}
          />
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "var(--wh-space-2)",
              margin: "var(--wh-space-3) 0 0",
            }}
          >
            <dt>Consumed hints that were rank 1</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>
              {formatNumber(sum((d) => d.consumed_first_rank))}
            </dd>
          </dl>
        </Card>
      </div>

      <Card title="Hint Adoption by Day" padded={false}>
        <DataTable<HintAdoptionDayDto>
          columns={[
            { key: "day", header: "Day", render: (d) => formatReportDay(d.day) },
            {
              key: "hints_issued",
              header: "Issued",
              align: "right",
              render: (d) => formatNumber(d.hints_issued),
            },
            {
              key: "hints_consumed",
              header: "Consumed",
              align: "right",
              render: (d) => formatNumber(d.hints_consumed),
            },
            {
              key: "hints_expired",
              header: "Expired",
              align: "right",
              render: (d) => formatNumber(d.hints_expired),
            },
            {
              key: "adoption_rate",
              header: "Adoption Rate",
              align: "right",
              render: (d) => rate(d),
            },
            {
              key: "consumed_first_rank",
              header: "Consumed Rank 1",
              align: "right",
              render: (d) => formatNumber(d.consumed_first_rank),
            },
            {
              key: "mean_detour_m",
              header: "Mean Detour",
              align: "right",
              render: (d) => detour(d),
            },
            {
              key: "time_to_consume_p50",
              header: "Time to Consume p50",
              align: "right",
              render: (d) => formatDuration(d.time_to_consume.p50_seconds),
            },
            {
              key: "time_to_consume_p95",
              header: "Time to Consume p95",
              align: "right",
              render: (d) => formatDuration(d.time_to_consume.p95_seconds),
            },
          ]}
          rows={days}
          rowKey={(d) => d.day}
          emptyState={<div>No interleaving hints in this window.</div>}
        />
      </Card>
    </>
  );
}

export const taskInterleavingHintAdoptionConfig: ContextReportConfig<HintAdoptionReportDto> =
  {
    contextId: "task-interleaving",
    title: "Task Interleaving: Hint Adoption",
    subtitle:
      "How much of the issued interleaving advice operators take, per day -- hints issued, consumed and expired, the adoption rate, rank-1 picks, mean detour and time to consume. Trailing 30 days, every site.",
    reportUrl: withWindow(
      `${REPORTS_BASE_URL.taskInterleaving}/reports/hint-adoption`,
      WINDOW,
    ),
    freshnessUrl: `${REPORTS_BASE_URL.taskInterleaving}/reports/freshness`,
    renderBody,
  };
