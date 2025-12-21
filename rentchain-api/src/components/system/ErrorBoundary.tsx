import React from "react";

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
  info?: React.ErrorInfo;
};

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            padding: "24px",
            background: "#0b1220",
            color: "#fefefe",
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 720,
              margin: "0 auto",
              background: "rgba(30,41,59,0.85)",
              borderRadius: 14,
              padding: "20px",
              border: "1px solid rgba(148,163,184,0.4)",
              boxShadow: "0 18px 36px rgba(0,0,0,0.4)",
            }}
          >
            <h1 style={{ margin: "0 0 8px", fontSize: "1.4rem" }}>
              Render crashed
            </h1>
            {this.state.error?.message && (
              <p style={{ margin: "0 0 12px", color: "#e2e8f0" }}>
                {this.state.error.message}
              </p>
            )}
            {this.state.info?.componentStack && (
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: "0.8rem",
                  background: "rgba(15,23,42,0.9)",
                  borderRadius: 10,
                  padding: "12px",
                  color: "#cbd5e1",
                  border: "1px solid rgba(148,163,184,0.3)",
                }}
              >
                {this.state.info.componentStack}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
