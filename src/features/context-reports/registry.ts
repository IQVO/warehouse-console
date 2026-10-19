import type { ContextReportConfig } from "./types";
import { facilityCatalogGrowthConfig } from "./facilityLayout.config";
import { inventoryFlowAccuracyConfig } from "./inventoryStorage.config";
import { wesThroughputConfig } from "./wesWorkPlanning.config";
import { fulfillmentThroughputConfig } from "./fulfillmentExecution.config";
import { workforceLaborConfig } from "./workforceManagement.config";
import { orderFunnelConfig } from "./orderManagement.config";
import { processPathCatalogueGrowthConfig } from "./processPathManagement.config";
import { laborPerformanceConfig } from "./laborPerformance.config";
import { networkFulfillmentReportConfig } from "./networkFulfillment.config";
import { warehousePlanningShortageConfig } from "./warehousePlanning.config";
import { networkInventoryStuckTransfersConfig } from "./networkInventoryPlanning.config";
import { productMasterDataQualityConfig } from "./productMaster.config";
import { inboundReceivingPerformanceConfig } from "./inboundReceiving.config";
import { slottingPlanFunnelConfig } from "./slottingOptimization.config";
import { networkInventoryTransferFunnelConfig } from "./networkInventoryTransferFunnel.config";
import { networkInventoryStateDwellConfig } from "./networkInventoryStateDwell.config";
import { networkInventoryRebalanceRunsConfig } from "./networkInventoryRebalanceRuns.config";
import { warehousePlanningBottleneckFrequencyConfig } from "./warehousePlanningBottleneckFrequency.config";
import { warehousePlanningPlanThroughputConfig } from "./warehousePlanningPlanThroughput.config";

/**
 * Every bounded context's report, in one place, so App.tsx's route table
 * and ContextsScreen's report-links list both iterate the SAME list
 * rather than risking the two ever drifting out of sync.
 *
 * `path` is the route slug used at `/reports/<path>` -- matches the
 * context's own repo/directory name, mirroring the convention
 * REPORT_PREFIXES/REMOTE_PREFIXES already use in App.tsx for the remote
 * routes.
 */
export interface ReportRouteEntry {
  path: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a
  // heterogeneous registry of ContextReportConfig<T> for many DIFFERENT
  // T's has no sound common instantiation; each entry is only ever read
  // back through its own config object; renderBody in each remains fully
  // typed. Same shape unavoidably shows up in DataTable<T>/Column<T>
  // callers throughout this fleet.
  config: ContextReportConfig<any>;
}

export const REPORT_ROUTES: ReportRouteEntry[] = [
  { path: "order-management", config: orderFunnelConfig },
  { path: "inventory-storage", config: inventoryFlowAccuracyConfig },
  { path: "wes-work-planning", config: wesThroughputConfig },
  { path: "fulfillment-execution", config: fulfillmentThroughputConfig },
  { path: "workforce-management", config: workforceLaborConfig },
  { path: "facility-layout", config: facilityCatalogGrowthConfig },
  { path: "process-path-management", config: processPathCatalogueGrowthConfig },
  { path: "labor-performance", config: laborPerformanceConfig },
  { path: "network-fulfillment", config: networkFulfillmentReportConfig },
  // Phase 4.1 (connect-all): contexts whose reports readers were already
  // deployed but had no screen. WES tier (capacity planning).
  { path: "warehouse-planning", config: warehousePlanningShortageConfig },
  // WMS tier (network inventory movement).
  { path: "network-inventory-planning", config: networkInventoryStuckTransfersConfig },
  // WMS tier (product master data).
  { path: "product-master", config: productMasterDataQualityConfig },
  // WMS tier (inbound / dock).
  { path: "inbound-receiving", config: inboundReceivingPerformanceConfig },
  // WMS tier (forward-pick slotting; connect-all 2.2a shipped the reader).
  { path: "slotting-optimization", config: slottingPlanFunnelConfig },
  // Phase 4.1 follow-up: a context's further reports (no production screen
  // called them before). Slug is `<context>-<report>`; the context's first
  // report keeps the bare context slug above, and ContextReportRouteScreen
  // links the siblings by `contextId`.
  { path: "warehouse-planning-bottleneck-frequency", config: warehousePlanningBottleneckFrequencyConfig },
  { path: "warehouse-planning-plan-throughput", config: warehousePlanningPlanThroughputConfig },
  { path: "network-inventory-planning-transfer-funnel", config: networkInventoryTransferFunnelConfig },
  { path: "network-inventory-planning-state-dwell", config: networkInventoryStateDwellConfig },
  { path: "network-inventory-planning-rebalance-runs", config: networkInventoryRebalanceRunsConfig },
];
