/**
 * Enterprise Admin Skeleton Loaders
 * High-density animated pulse placeholders tailored for tables, grids, forms, and metrics.
 * Ensures zero layout shifts and instant perceived performance across all admin panels.
 */

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full border border-ui-border-base rounded-lg overflow-hidden bg-ui-bg-base animate-pulse">
      <div className="bg-ui-bg-subtle p-3 border-b border-ui-border-base flex items-center justify-between gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
        ))}
      </div>
      <div className="divide-y divide-ui-border-base">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-3 flex items-center justify-between gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-4 bg-slate-200 dark:bg-slate-800 rounded"
                style={{ width: `${Math.max(20, (c + 1) * 20)}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-ui-border-base bg-ui-bg-base p-3 flex flex-col gap-3">
          <div className="aspect-video w-full bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="flex gap-2 mt-1">
            <div className="h-5 w-14 bg-slate-200 dark:bg-slate-800 rounded-full" />
            <div className="h-5 w-14 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MetricsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-ui-border-base bg-ui-bg-base p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-7 w-7 bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
          <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded mt-1" />
          <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="flex flex-col gap-4 animate-pulse p-4 border border-ui-border-base rounded-xl bg-ui-bg-base">
      <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-9 w-full bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

