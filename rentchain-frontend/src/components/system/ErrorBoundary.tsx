// src/components/system/ErrorBoundary.tsx
import React from "react";

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Render crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f172a",
            color: "#e5e7eb",
            fontFamily:
              "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            padding: "2rem",
          }}
        >
          <div
            style={{
              maxWidth: 520,
              background: "rgba(15,23,42,0.9)",
              borderRadius: "1rem",
              padding: "2rem",
              border: "1px solid rgba(148,163,184,0.25)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
          >
            <h1 style={{ marginBottom: "0.75rem" }}>Render crashed</h1>
            <p style={{ marginBottom: "1rem", color: "#cbd5e1" }}>
              A runtime error occurred while rendering the app.
            </p>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontSize: "0.8rem",
                color: "#fca5a5",
              }}
            >
              {this.state.error?.message}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
