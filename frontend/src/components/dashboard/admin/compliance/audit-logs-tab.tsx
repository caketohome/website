"use client";

import { useState } from "react";
import { Container, Heading, Text, Input, Badge } from "@medusajs/ui";
import { ScrollText, Search, Filter, ShieldCheck, Clock, User } from "lucide-react";

export function AuditLogsTab({
  auditLogs,
}: {
  auditLogs: any[];
}) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "compliance" | "security" | "settings">("all");

  const filteredLogs = (auditLogs || []).filter((log) => {
    const text = typeof log === "string" ? log : log.action || log.message || log.title || "";
    const matchSearch = text.toLowerCase().includes(search.toLowerCase());

    if (!matchSearch) return false;
    if (filterType === "compliance") {
      return (
        text.toLowerCase().includes("gst") ||
        text.toLowerCase().includes("fssai") ||
        text.toLowerCase().includes("compliance") ||
        text.toLowerCase().includes("business profile")
      );
    }
    if (filterType === "security") {
      return text.toLowerCase().includes("security") || text.toLowerCase().includes("auth") || text.toLowerCase().includes("login");
    }
    if (filterType === "settings") {
      return text.toLowerCase().includes("setting") || text.toLowerCase().includes("delivery") || text.toLowerCase().includes("invoice");
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-amber-600" />
            <Heading level="h3" className="text-base font-bold">Statutory & Administrative Audit Logs</Heading>
          </div>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Immutable log of all compliance updates, GSTIN verifications, FSSAI changes, and platform alterations.
          </Text>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search audit trail by keyword, GSTIN, store name, or action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterType === "all"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800"
            }`}
          >
            All Logs ({auditLogs?.length || 0})
          </button>
          <button
            onClick={() => setFilterType("compliance")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterType === "compliance"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800"
            }`}
          >
            Compliance & Statutory
          </button>
          <button
            onClick={() => setFilterType("security")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterType === "security"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800"
            }`}
          >
            Security & Auth
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <Container className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No audit logs match your search criteria.
            </div>
          ) : (
            filteredLogs.map((log, idx) => {
              const text = typeof log === "string" ? log : log.action || log.message || log.title || "";
              const timestamp = typeof log === "object" && log.timestamp ? log.timestamp : null;
              const actor = typeof log === "object" && log.user ? log.user : "Super Admin";

              const isCompliance =
                text.toLowerCase().includes("gst") ||
                text.toLowerCase().includes("fssai") ||
                text.toLowerCase().includes("compliance") ||
                text.toLowerCase().includes("business profile");

              return (
                <div
                  key={idx}
                  className="p-4 flex items-start justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isCompliance
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    }`}>
                      {isCompliance ? <ShieldCheck className="w-4 h-4" /> : <ScrollText className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {text}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {actor}
                        </span>
                        {timestamp && (
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" /> {new Date(timestamp).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isCompliance && (
                    <Badge color="green" size="small">Compliance</Badge>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Container>
    </div>
  );
}
