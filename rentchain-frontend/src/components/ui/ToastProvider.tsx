import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type ToastVariant = "success" | "warning" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  description?: string;
  variant?: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastContextValue = {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const variant: ToastVariant = toast.variant || "info";
    const next: Toast = {
      id,
      variant,
      ...toast,
    };
    setToasts((prev) => [...prev, next]);

    // Auto-dismiss after 3.5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      toasts,
      showToast,
      dismissToast,
    }),
    [toasts, showToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
};

const ToastViewport: React.FC = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;

  const { toasts, dismissToast } = ctx;

  const bgForVariant = (variant?: ToastVariant) => {
    switch (variant) {
      case "success":
        return "rgba(22,163,74,0.95)";
      case "warning":
        return "rgba(234,179,8,0.95)";
      case "error":
        return "rgba(220,38,38,0.95)";
      case "info":
      default:
        return "rgba(37,99,235,0.95)";
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: `max(16px, calc(env(safe-area-inset-top) + 12px))`,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 9999,
        pointerEvents: "none",
        width: "min(92vw, 420px)",
        alignItems: "stretch",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            pointerEvents: "auto",
            width: "100%",
            borderRadius: 999,
            padding: "8px 12px",
            backgroundColor: bgForVariant(toast.variant),
            color: "#f9fafb",
            boxShadow: "0 10px 25px rgba(15,23,42,0.8)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontWeight: 500,
                marginBottom: toast.description ? 2 : 0,
              }}
            >
              {toast.message}
            </div>
            {toast.description && (
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.9,
                }}
              >
                {toast.description}
              </div>
            )}
          </div>

          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.();
                dismissToast(toast.id);
              }}
              style={{
                border: "none",
                outline: "none",
                cursor: "pointer",
                borderRadius: 999,
                padding: "4px 8px",
                backgroundColor: "rgba(15,23,42,0.2)",
                color: "#f9fafb",
                fontSize: 12,
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              {toast.actionLabel}
            </button>
          )}

          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            style={{
              border: "none",
              outline: "none",
              cursor: "pointer",
              background: "transparent",
              color: "#e5e7eb",
              padding: 0,
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
