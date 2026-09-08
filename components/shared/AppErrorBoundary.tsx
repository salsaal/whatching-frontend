import { AlertTriangle } from "lucide-react";
import { Component, ErrorInfo, ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  resetKey: string;
}

interface State {
  error: Error | null;
}

// Without this, any render-time throw anywhere in the tree (a null-pointer
// on an unexpected API shape, a bad third-party render) unmounts the whole
// app to a blank white screen with no recovery path. This catches it and
// swaps in a friendly fallback instead, and self-resets on route change so
// navigating away from the broken page recovers without a full reload.
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f7faf8] p-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <div className="space-y-1">
            <h1 className="font-heading text-xl font-semibold">
              Something went wrong
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              This page hit an unexpected error. Your data is safe -- try
              reloading, or head back to the dashboard.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/")}
            >
              Go to dashboard
            </Button>
            <Button onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
