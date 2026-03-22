import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <div>
          <h3 className="text-base font-semibold text-foreground">Something went wrong</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={this.handleReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }
}
