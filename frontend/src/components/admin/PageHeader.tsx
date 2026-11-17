"use client";

import React from "react";

/* ─────────────────────────────────────────────────────────────────────────────
 * PageHeader — Reusable page header with title, description, and actions
 * ────────────────────────────────────────────────────────────────────────── */

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, icon: Icon, badge, actions, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-5">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="mt-0.5 shrink-0 w-9 h-9 rounded-lg bg-brand-navy flex items-center justify-center">
            <Icon className="w-4.5 h-4.5 text-brand-gold" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 truncate">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">{description}</p>
          )}
          {children}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 mt-2 sm:mt-0 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
