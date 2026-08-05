"use client";

/**
 * Dashboard Panel Skeleton Loader
 * Displays an animated pulse placeholder while a lazy-loaded admin panel is loading.
 * Matches the general layout of dashboard panels (header + grid cards).
 */
export function DashboardPanelSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse p-4 border border-ui-border-base rounded-xl bg-ui-bg-subtle/40">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-6 w-56 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-80 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
        <div className="h-9 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
      </div>

      {/* Action bar skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-64 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
      </div>

      {/* Content cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4 flex flex-col gap-3">
            <div className="h-32 w-full bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="flex gap-2 mt-2">
              <div className="h-6 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
              <div className="h-6 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

