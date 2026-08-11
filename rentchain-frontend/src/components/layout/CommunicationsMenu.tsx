import React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { isNavRouteActive } from "./navConfig";
import "./CommunicationsMenu.css";

const COMMUNICATION_LINKS = [
  { label: "Unified Inbox", to: "/landlord/unified-inbox", matchPaths: ["/landlord/inbox"] },
  { label: "Messages", to: "/messages", matchPaths: [] },
  { label: "Notices", to: "/notices", matchPaths: [] },
] as const;

type Props = {
  className?: string;
  hasUnread?: boolean;
};

export function CommunicationsMenu({ className = "", hasUnread = false }: Props) {
  const location = useLocation();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const menuId = React.useId();

  const isActive = React.useCallback(
    (item: (typeof COMMUNICATION_LINKS)[number]) =>
      [item.to, ...item.matchPaths].some((target) => isNavRouteActive(location.pathname, target)),
    [location.pathname]
  );

  React.useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const current = rootRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const first = rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    (current || first)?.focus();
  }, [open]);

  return (
    <div ref={rootRef} className={`rc-communications-menu ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className="rc-communications-menu__trigger"
        aria-label={hasUnread ? "Communications (unread)" : "Communications"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span>Communications</span>
        <ChevronDown size={15} aria-hidden="true" />
        {hasUnread ? <span className="rc-communications-menu__unread" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div id={menuId} className="rc-communications-menu__panel" role="menu" aria-label="Communications destinations">
          {COMMUNICATION_LINKS.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                className={active ? "is-active" : ""}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <span>{item.label}</span>
                {active ? <Check size={16} aria-hidden="true" /> : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
