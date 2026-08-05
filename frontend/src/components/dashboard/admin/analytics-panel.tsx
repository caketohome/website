"use client";

import { memo } from "react";
import { EnterpriseReportsEngine } from "./enterprise-reports-engine";

export const AnalyticsPanel = memo(function AnalyticsPanel() {
  return (
    <div className="flex flex-col gap-6">
      <EnterpriseReportsEngine />
    </div>
  );
});
