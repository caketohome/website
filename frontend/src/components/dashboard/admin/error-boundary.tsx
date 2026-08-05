"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Container, Heading, Text, Button } from "@medusajs/ui";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  moduleName?: string;
  onRetry?: () => void;
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class DashboardErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[DASHBOARD ERROR BOUNDARY] Module "${this.props.moduleName || "Dashboard Component"}" threw:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.compact) {
        return (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/30 dark:border-rose-900 text-xs flex flex-col gap-2 my-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-semibold">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{this.props.moduleName || "Widget Error"}</span>
              </div>
              <Button size="small" variant="secondary" onClick={this.handleReset} className="h-7 text-[11px] flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Retry
              </Button>
            </div>
            {this.state.error && (
              <Text className="text-[11px] font-mono text-rose-600 dark:text-rose-400 truncate">
                {this.state.error.message}
              </Text>
            )}
          </div>
        );
      }

      return (
        <Container className="p-6 border-2 border-rose-500/30 bg-rose-50/20 dark:bg-rose-950/20 my-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-100 dark:bg-rose-900/50 rounded-xl text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <Heading level="h3" className="text-base font-semibold text-rose-700 dark:text-rose-300">
                Dashboard Module Error: {this.props.moduleName || "Module Render Exception"}
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">
                A non-fatal error occurred while rendering this dashboard panel. Other modules remain fully functional.
              </Text>
            </div>
          </div>

          {this.state.error && (
            <div className="p-3 bg-ui-bg-subtle rounded-lg border border-ui-border-base text-xs font-mono overflow-x-auto text-rose-600 dark:text-rose-400">
              {this.state.error.name}: {this.state.error.message}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button size="small" onClick={this.handleReset} className="bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Retry Module
            </Button>
            <Button size="small" variant="secondary" onClick={() => window.location.reload()}>
              Reload Dashboard
            </Button>
          </div>
        </Container>
      );
    }

    return this.props.children;
  }
}

export const WidgetErrorBoundary = DashboardErrorBoundary;

