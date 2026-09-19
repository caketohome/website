"use client";

import React, { useState } from "react";
import {
  AlertTriangle, RefreshCw, Inbox, Loader2, Check, X, ChevronLeft, ChevronRight,
  Copy, CheckCheck, Search, Filter, Calendar
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
 * SHARED ADMIN UI COMPONENTS
 * ═══════════════════════════════════════════════════════════════════════ */

/* ── MetricCard ── */
interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  subtitle?: string; // alias for subtext
  trend?: { value: string; positive: boolean };
  icon?: React.ElementType;
  loading?: boolean;
  error?: boolean;
}

export function MetricCard({ label, value, subtext, subtitle, trend, icon: Icon, loading, error }: MetricCardProps) {
  const displayText = subtext || subtitle;
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
        <div className="h-3 w-20 bg-slate-200 rounded mb-3" />
        <div className="h-7 w-16 bg-slate-200 rounded mb-1" />
        <div className="h-2.5 w-24 bg-slate-100 rounded" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-4">
        <div className="text-xs text-red-500 font-medium">{label}</div>
        <div className="text-sm text-red-400 mt-1">Unable to load</div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition-all group">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-slate-300 group-hover:text-[#D4AF37] transition-colors" />}
      </div>
      <div className="text-2xl font-bold text-slate-900 mt-1.5">{value}</div>
      <div className="flex items-center gap-2 mt-1">
        {displayText && <span className="text-[11px] text-slate-400">{displayText}</span>}
        {trend && (
          <span className={`text-[11px] font-semibold ${trend.positive ? "text-emerald-600" : "text-red-500"}`}>
            {trend.positive ? "↑" : "↓"} {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── StatusBadge ── */
type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "gold";

const BADGE_STYLES: Record<BadgeVariant, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  neutral: "bg-slate-50 text-slate-600 border-slate-200",
  gold: "bg-[#FDF9EF] text-[#997A1E] border-[#D4AF37]/30",
};

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  status?: string; // alias/mapping for variant
  dot?: boolean;
  size?: "sm" | "md";
}

function resolveBadgeVariant(v?: BadgeVariant, s?: string): BadgeVariant {
  if (v) return v;
  if (!s) return "neutral";
  const lower = s.toLowerCase();
  if (lower === "active" || lower === "published" || lower === "delivered" || lower === "paid" || lower === "completed" || lower === "verified") return "success";
  if (lower === "gold" || lower === "premium" || lower === "pro") return "gold";
  if (lower === "danger" || lower === "error" || lower === "cancelled" || lower === "failed" || lower === "blocked") return "danger";
  if (lower === "warning" || lower === "draft" || lower === "pending" || lower === "needs_attention") return "warning";
  if (lower === "info" || lower === "processing" || lower === "shipped" || lower === "dispatched") return "info";
  return "neutral";
}

export function StatusBadge({ label, variant, status, dot = false, size = "sm" }: StatusBadgeProps) {
  const resolvedVariant = resolveBadgeVariant(variant, status);
  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full border font-medium
        ${BADGE_STYLES[resolvedVariant]}
        ${size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${
          resolvedVariant === "success" ? "bg-emerald-500" :
          resolvedVariant === "warning" ? "bg-amber-500" :
          resolvedVariant === "danger" ? "bg-red-500" :
          resolvedVariant === "info" ? "bg-blue-500" :
          resolvedVariant === "gold" ? "bg-[#D4AF37]" :
          "bg-slate-400"
        }`} />
      )}
      {label}
    </span>
  );
}

/* ── EmptyState ── */
interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void } | React.ReactNode;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {description && <p className="text-xs text-slate-400 mt-1 max-w-sm">{description}</p>}
      {action && (
        React.isValidElement(action) ? (
          <div className="mt-4">{action}</div>
        ) : typeof action === "object" && "label" in action && "onClick" in action ? (
          <button
            onClick={(action as { label: string; onClick: () => void }).onClick}
            className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#1D2F5D] hover:bg-[#152347] rounded-lg transition-colors"
          >
            {(action as { label: string; onClick: () => void }).label}
          </button>
        ) : null
      )}
    </div>
  );
}

/* ── ErrorState ── */
interface ErrorStateProps {
  message?: string;
  detail?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Unable to load this data.", detail, onRetry }: ErrorStateProps) {
  const [showDetail, setShowDetail] = useState(false);
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-3">
        <AlertTriangle className="w-5 h-5 text-red-500" />
      </div>
      <h3 className="text-sm font-semibold text-red-700">{message}</h3>
      <p className="text-xs text-slate-500 mt-1">Please retry or contact an administrator.</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
      {detail && (
        <button onClick={() => setShowDetail(!showDetail)} className="mt-2 text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
          {showDetail ? "Hide" : "Show"} technical details
        </button>
      )}
      {showDetail && detail && (
        <pre className="mt-2 text-[10px] text-slate-500 bg-slate-50 p-3 rounded-lg max-w-md overflow-x-auto text-left border border-slate-200">
          {detail}
        </pre>
      )}
    </div>
  );
}

/* ── LoadingSkeleton ── */
interface LoadingSkeletonProps {
  rows?: number;
  type?: "table" | "cards" | "form";
}

export function LoadingSkeleton({ rows = 5, type = "table" }: LoadingSkeletonProps) {
  if (type === "cards") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
            <div className="h-3 w-20 bg-slate-200 rounded mb-3" />
            <div className="h-6 w-24 bg-slate-200 rounded mb-2" />
            <div className="h-2.5 w-32 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }
  if (type === "form") {
    return (
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i}>
            <div className="h-3 w-24 bg-slate-200 rounded mb-1.5" />
            <div className="h-9 bg-slate-100 rounded-lg border border-slate-200" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="animate-pulse">
      <div className="h-10 bg-slate-100 rounded-t-lg border border-slate-200" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 border-b border-slate-100 flex items-center px-4 gap-4">
          <div className="h-3 w-16 bg-slate-200 rounded" />
          <div className="h-3 w-32 bg-slate-100 rounded" />
          <div className="h-3 w-20 bg-slate-100 rounded ml-auto" />
        </div>
      ))}
    </div>
  );
}

/* ── ConfirmDialog ── */
interface ConfirmDialogProps {
  open?: boolean;
  isOpen?: boolean; // alias for open
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, isOpen, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", variant = "danger", onConfirm, onCancel
}: ConfirmDialogProps) {
  const isVisible = open !== undefined ? open : !!isOpen;
  if (!isVisible) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-6" role="alertdialog" aria-labelledby="confirm-title">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            variant === "danger" ? "bg-red-50" : variant === "warning" ? "bg-amber-50" : "bg-blue-50"
          }`}>
            <AlertTriangle className={`w-5 h-5 ${
              variant === "danger" ? "text-red-500" : variant === "warning" ? "text-amber-500" : "text-blue-500"
            }`} />
          </div>
          <h2 id="confirm-title" className="text-sm font-bold text-slate-900">{title}</h2>
        </div>
        <p className="text-xs text-slate-600 mb-5 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors ${
              variant === "danger" ? "bg-red-600 hover:bg-red-700" :
              variant === "warning" ? "bg-amber-600 hover:bg-amber-700" :
              "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Pagination ── */
interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
}

export function Pagination({ page, totalPages, onPageChange, totalItems, pageSize }: PaginationProps) {
  return (
    <div className="flex items-center justify-between py-3 px-1 text-xs text-slate-500">
      <span>
        {totalItems !== undefined
          ? `Showing ${((page - 1) * (pageSize || 20)) + 1}–${Math.min(page * (pageSize || 20), totalItems)} of ${totalItems}`
          : `Page ${page} of ${totalPages}`}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (page <= 3) {
            pageNum = i + 1;
          } else if (page >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = page - 2 + i;
          }
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                pageNum === page
                  ? "bg-[#1D2F5D] text-white"
                  : "hover:bg-slate-100 text-slate-600"
              }`}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── FilterBar ── */
interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}

export function FilterBar({ searchValue, onSearchChange, searchPlaceholder = "Search...", filters, actions }: FilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 pb-3">
      {onSearchChange && (
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 w-full sm:w-64 focus-within:ring-2 focus-within:ring-[#D4AF37]/30 focus-within:border-[#D4AF37] transition-all">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchValue || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            suppressHydrationWarning
            className="flex-1 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 outline-none border-none !bg-transparent !border-transparent"
            style={{ backgroundColor: 'transparent', borderColor: 'transparent' }}
          />
        </div>
      )}
      {filters && <div className="flex items-center gap-2 flex-wrap">{filters}</div>}
      {actions && <div className="flex items-center gap-2 sm:ml-auto shrink-0">{actions}</div>}
    </div>
  );
}

/* ── SaveBar ── */
interface SaveBarProps {
  show: boolean;
  saving?: boolean;
  lastSaved?: string;
  onSave: () => void;
  onCancel: () => void;
}

export function SaveBar({ show, saving, lastSaved, onSave, onCancel }: SaveBarProps) {
  if (!show) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] px-6 py-3 flex items-center justify-between">
      <div className="text-xs text-slate-500">
        {saving ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving changes...
          </span>
        ) : lastSaved ? (
          `Last saved: ${lastSaved}`
        ) : (
          "You have unsaved changes"
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#1D2F5D] hover:bg-[#152347] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

/* ── Toast ── */
type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  visible: boolean;
  onClose: () => void;
}

export function Toast({ message, variant = "success", visible, onClose }: ToastProps) {
  if (!visible) return null;
  const styles: Record<ToastVariant, string> = {
    success: "bg-emerald-600",
    error: "bg-red-600",
    warning: "bg-amber-600",
    info: "bg-blue-600",
  };
  const icons: Record<ToastVariant, React.ReactNode> = {
    success: <Check className="w-4 h-4" />,
    error: <X className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    info: <AlertTriangle className="w-4 h-4" />,
  };

  return (
    <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 px-4 py-3 rounded-xl text-white text-xs font-medium shadow-xl ${styles[variant]} animate-in slide-in-from-bottom-4 fade-in duration-300`}>
      {icons[variant]}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 p-0.5 hover:bg-white/20 rounded transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ── CopyButton ── */
interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

/* ── PermissionGate ── */
interface PermissionGateProps {
  user: any;
  module: string;
  action?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({ user, module, action = "VIEW", fallback, children }: PermissionGateProps) {
  // Check permissions using StaffAccessControl if available
  try {
    const { StaffAccessControl } = require("@frontend/lib/staff-access-control");
    if (!StaffAccessControl.isTabPermitted(user, module)) {
      return <>{fallback || null}</>;
    }
  } catch {
    // If StaffAccessControl is unavailable, allow access
  }
  return <>{children}</>;
}

/* ── PrimaryButton / SecondaryButton ── */
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ElementType;
  size?: "sm" | "md";
  className?: string;
  type?: "button" | "submit";
}

export function PrimaryButton({ children, onClick, disabled, loading, icon: Icon, size = "md", className = "", type = "button" }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 font-semibold text-white bg-[#1D2F5D] hover:bg-[#152347] rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed
        ${size === "sm" ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-xs"}
        ${className}
      `}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : Icon ? <Icon className="w-3.5 h-3.5" /> : null}
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, disabled, loading, icon: Icon, size = "md", className = "", type = "button" }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed
        ${size === "sm" ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-xs"}
        ${className}
      `}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : Icon ? <Icon className="w-3.5 h-3.5" /> : null}
      {children}
    </button>
  );
}

/* ── GoldButton (Accent) ── */
export function GoldButton({ children, onClick, disabled, loading, icon: Icon, size = "md", className = "", type = "button" }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 font-semibold text-[#1D2F5D] bg-[#D4AF37] hover:bg-[#C5A059] rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed
        ${size === "sm" ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-xs"}
        ${className}
      `}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : Icon ? <Icon className="w-3.5 h-3.5" /> : null}
      {children}
    </button>
  );
}

/* ── SectionCard ── */
interface SectionCardProps {
  title?: string;
  subtitle?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  badge?: React.ReactNode;
}

export function SectionCard({ title, subtitle, description, action, children, className = "", badge }: SectionCardProps) {
  const desc = description || subtitle;
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {(title || action || desc || badge) && (
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              {title && <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>}
              {badge}
            </div>
            {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
          </div>
          {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ── FormSection ── */
interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, description, children, className = "" }: FormSectionProps) {
  return (
    <div className={`pt-4 first:pt-0 pb-6 border-b border-slate-100 last:border-b-0 space-y-4 ${className}`}>
      <div>
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{title}</h4>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/* ── FieldHelp ── */
interface FieldHelpProps {
  children: React.ReactNode;
  state?: "default" | "good" | "warning" | "danger";
}

export function FieldHelp({ children, state = "default" }: FieldHelpProps) {
  const colorMap = {
    default: "text-slate-400",
    good: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-red-600",
  };
  return <p className={`text-[11px] mt-1 ${colorMap[state]}`}>{children}</p>;
}

/* ── ResponsiveDataTable ── */
interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

interface ResponsiveDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  keyExtractor: (item: T) => string | number;
  onRowClick?: (item: T) => void;
}

export function ResponsiveDataTable<T>({
  columns,
  data,
  loading,
  emptyTitle = "No records found",
  emptyDescription,
  keyExtractor,
  onRowClick,
}: ResponsiveDataTableProps<T>) {
  if (loading) {
    return <LoadingSkeleton rows={5} type="table" />;
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-[#F8FAFC]">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`py-3 px-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider ${
                  c.hideOnMobile ? "hidden md:table-cell" : ""
                } ${c.className || ""}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs">
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick && onRowClick(item)}
              className={`hover:bg-slate-50 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`py-3 px-4 text-slate-700 ${
                    c.hideOnMobile ? "hidden md:table-cell" : ""
                  } ${c.className || ""}`}
                >
                  {c.render ? c.render(item) : (item as any)[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const DataTable = ResponsiveDataTable;

/* ── Modal ── */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export function Modal({ open, onClose, title, description, children, maxWidth = "md" }: ModalProps) {
  if (!open) return null;
  const widthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full ${widthClasses[maxWidth]} max-h-[90vh] flex flex-col overflow-hidden`}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

/* ── Drawer ── */
interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "md" | "lg" | "xl";
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = "md" }: DrawerProps) {
  if (!open) return null;
  const widthClasses = {
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="fixed inset-0" onClick={onClose} />
      <div className={`relative bg-white w-full ${widthClasses[width]} h-full shadow-2xl flex flex-col border-l border-slate-200 z-10`}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="p-4 border-t border-slate-100 bg-slate-50">{footer}</div>}
      </div>
    </div>
  );
}

/* ── AuditTimeline ── */
interface AuditTimelineItem {
  id: string;
  title: string;
  timestamp: string;
  actor?: string;
  detail?: string;
  type?: "create" | "update" | "delete" | "status";
}

export function AuditTimeline({ items }: { items: AuditTimelineItem[] }) {
  if (!items || items.length === 0) {
    return <p className="text-xs text-slate-400 py-2">No audit entries recorded.</p>;
  }

  return (
    <div className="space-y-3 relative before:absolute before:inset-0 before:left-2.5 before:w-0.5 before:bg-slate-200">
      {items.map((it) => (
        <div key={it.id} className="relative flex items-start gap-3 pl-6">
          <div className="absolute left-1.5 top-1.5 w-2 h-2 rounded-full bg-[#1D2F5D] ring-4 ring-white" />
          <div className="flex-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-800">{it.title}</span>
              <span className="text-[10px] text-slate-400">{it.timestamp}</span>
            </div>
            {it.actor && <span className="text-[11px] text-slate-500 block">By: {it.actor}</span>}
            {it.detail && <p className="text-[11px] text-slate-600 mt-0.5">{it.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

