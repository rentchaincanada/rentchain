import React from "react";
import { createPortal } from "react-dom";
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
  messagesUnread?: boolean;
  inboxUnread?: boolean;
};

function destinationUnread(label: string, messagesUnread: boolean, inboxUnread: boolean) {
  if (label === "Messages") return messagesUnread;
  if (label === "Unified Inbox") return inboxUnread;
  return false;
}

export function CommunicationsMenu({
  className = "",
  messagesUnread = false,
  inboxUnread = false,
}: Props) {
  const location = useLocation();
  const hasUnread = messagesUnread || inboxUnread;
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const menuId = React.useId();
  const [panelPosition, setPanelPosition] = React.useState({ top: 0, right: 12 });

  const updatePanelPosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPanelPosition({
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  }, []);

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
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
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

  React.useLayoutEffect(() => {
    if (!open) return undefined;
    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  React.useEffect(() => {
    if (!open) return;
    const current = panelRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const first = panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
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
        onClick={() => {
          if (!open) updatePanelPosition();
          setOpen((current) => !current);
        }}
      >
        <span>Communications</span>
        <ChevronDown size={15} aria-hidden="true" />
        {hasUnread ? <span className="rc-communications-menu__unread" aria-hidden="true" /> : null}
      </button>
      {open ? createPortal(
        <div
          ref={panelRef}
          id={menuId}
          className="rc-communications-menu__panel"
          role="menu"
          aria-label="Communications destinations"
          style={{ top: panelPosition.top, right: panelPosition.right }}
        >
          {COMMUNICATION_LINKS.map((item) => {
            const active = isActive(item);
            const unread = destinationUnread(item.label, messagesUnread, inboxUnread);
            return (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                className={active ? "is-active" : ""}
                aria-current={active ? "page" : undefined}
                aria-label={unread ? `${item.label}, unread activity` : item.label}
                onClick={() => setOpen(false)}
              >
                <span>{item.label}</span>
                <span className="rc-communications-menu__item-state">
                  {unread ? <span className="rc-communications-menu__child-unread" aria-hidden="true" /> : null}
                  {active ? <Check size={16} aria-hidden="true" /> : null}
                </span>
              </Link>
            );
          })}
        </div>,
        document.body
      ) : null}
    </div>
  );
}
