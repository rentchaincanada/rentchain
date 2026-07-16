import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  FileText,
  ListChecks,
  MonitorCheck,
  Plus,
  Printer,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Button, Card, Input } from "../components/ui/Ui";
import { useAuth } from "../context/useAuth";
import {
  createSchedulingDayNote,
  deleteSchedulingDayNote,
  fetchSchedulingDayNotesRange,
  updateSchedulingDayNote,
} from "../api/schedulingDayNotesApi";
import {
  clearMigratedLegacySchedulingDayNotes,
  dateKeyFromLocalDate,
  legacySchedulingDayNoteFingerprint,
  markLegacySchedulingDayNotesMigrated,
  readLegacySchedulingDayNotes,
  type SchedulingDayNote,
  type SchedulingDayNotesByDate,
} from "../lib/schedulingDayNotes";
import { parseSchedulingNote, type SchedulingNoteParseResult } from "../lib/schedulingNoteParser";
import { radius, spacing, text } from "../styles/tokens";

type CalendarView = "day" | "week" | "month";

type WorkspaceItem = {
  title: string;
  detail: string;
  status: string;
  to: string;
};

const viewings: WorkspaceItem[] = [
  {
    title: "No viewings scheduled",
    detail: "Application viewings will appear here when scheduled.",
    status: "Clear",
    to: "/applications",
  },
];

const maintenanceRequests: WorkspaceItem[] = [
  {
    title: "Maintenance queue",
    detail: "Review incoming maintenance requests and scheduling needs.",
    status: "Open queue",
    to: "/maintenance",
  },
];

const workOrders: WorkspaceItem[] = [
  {
    title: "Work order schedule",
    detail: "Track contractor windows and due work orders.",
    status: "Review",
    to: "/work-orders",
  },
];

const screeningActivities: WorkspaceItem[] = [
  {
    title: "No screening activity scheduled",
    detail: "Manual screening and provider activity will appear here.",
    status: "Clear",
    to: "/screening",
  },
];

const reviewItems = [
  "Review same-time notes, viewing appointments, maintenance windows, and work orders before confirming the day plan.",
  "Parser suggestions are advisory. No calendar event or reminder has been created.",
  "Connected conflict detection is not enabled yet.",
];

const scheduleHours = Array.from({ length: 16 }, (_, index) => index + 7);

function dayKey(date: Date) {
  return dateKeyFromLocalDate(date);
}

function parseDateKey(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function viewFromParam(value: string | null): CalendarView {
  if (value === "week" || value === "7-day") return "week";
  if (value === "month" || value === "30-day") return "month";
  return "day";
}

function formatDay(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatMonth(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatHour(hour: number) {
  const value = hour % 12 || 12;
  return `${value} ${hour >= 12 ? "PM" : "AM"}`;
}

function startOfMonthGrid(date: Date) {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  return new Date(date.getFullYear(), date.getMonth(), 1 - monthStart.getDay());
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return new Date(start.getFullYear(), start.getMonth(), start.getDate());
}

function buildMonthDays(date: Date) {
  const first = startOfMonthGrid(date);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(first);
    day.setDate(first.getDate() + index);
    return day;
  });
}

function buildWeekDays(date: Date) {
  const first = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(first);
    day.setDate(first.getDate() + index);
    return day;
  });
}

function dateKeysInRange(startDate: string, endDate: string) {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  if (!start || !end) return [];
  const keys: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    keys.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function SectionHeader({
  icon: Icon,
  title,
  actionTo,
  actionLabel,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  title: string;
  actionTo?: string;
  actionLabel?: string;
}) {
  return (
    <div className="scheduling-section-header">
      <div className="scheduling-section-title">
        <Icon size={17} strokeWidth={2.2} aria-hidden="true" />
        <h2>{title}</h2>
      </div>
      {actionTo && actionLabel ? (
        <Link to={actionTo} className="scheduling-link-button">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function WorkspaceList({
  title,
  icon,
  items,
  actionTo,
  actionLabel,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  items: WorkspaceItem[];
  actionTo: string;
  actionLabel: string;
}) {
  return (
    <Card className="scheduling-card" style={{ display: "grid", gap: spacing.md }}>
      <SectionHeader icon={icon} title={title} actionTo={actionTo} actionLabel={actionLabel} />
      <div className="scheduling-item-list">
        {items.map((item) => (
          <Link key={item.title} to={item.to} className="scheduling-item-row">
            <span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </span>
            <em>{item.status}</em>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function DeleteNoteDialog({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const [confirmationReady, setConfirmationReady] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setConfirmationReady(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (confirmationReady) {
      dialogRef.current?.querySelector<HTMLButtonElement>("[data-confirm-delete-note]")?.focus();
    }
  }, [confirmationReady]);

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "grid",
        placeItems: "center",
        padding: spacing.md,
        background: "rgba(15, 23, 42, 0.42)",
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-scheduling-note-title"
        aria-describedby="delete-scheduling-note-description"
        aria-busy={busy || undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onCancel();
        }}
        style={{
          width: "min(100%, 420px)",
          display: "grid",
          gap: spacing.md,
          padding: spacing.lg,
          borderRadius: radius.lg,
          background: "#fff",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)",
        }}
      >
        <div style={{ display: "grid", gap: spacing.xs }}>
          <h2 id="delete-scheduling-note-title" style={{ margin: 0, fontSize: "1.2rem" }}>
            Delete note?
          </h2>
          <p id="delete-scheduling-note-description" style={{ margin: 0, color: text.secondary, lineHeight: 1.5 }}>
            This will remove this workspace scheduling note from the selected day.
          </p>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm, flexWrap: "wrap" }}>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            data-confirm-delete-note
            onClick={onConfirm}
            disabled={busy || !confirmationReady}
            style={{ background: "#b91c1c", color: "#fff" }}
          >
            {busy ? "Deleting" : "Delete note"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SchedulingWorkspacePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = React.useMemo(() => new Date(), []);
  const requestedDate = React.useMemo(() => parseDateKey(searchParams.get("date")), [searchParams]);
  const initialSelectedDate = requestedDate || new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [calendarView, setCalendarView] = React.useState<CalendarView>(() => viewFromParam(searchParams.get("view")));
  const [activeMonth, setActiveMonth] = React.useState(() => new Date(initialSelectedDate.getFullYear(), initialSelectedDate.getMonth(), 1));
  const [selectedDate, setSelectedDate] = React.useState(() => initialSelectedDate);
  const [notesByDate, setNotesByDate] = React.useState<SchedulingDayNotesByDate>({});
  const [noteDraft, setNoteDraft] = React.useState("");
  const [notesLoading, setNotesLoading] = React.useState(false);
  const [notesError, setNotesError] = React.useState<string | null>(null);
  const [notesStatus, setNotesStatus] = React.useState<string | null>(null);
  const [draftSaving, setDraftSaving] = React.useState(false);
  const [savingNoteIds, setSavingNoteIds] = React.useState<Record<string, boolean>>({});
  const [pendingDeleteNote, setPendingDeleteNote] = React.useState<SchedulingDayNote | null>(null);
  const legacyNotesScope = React.useMemo(
    () => ({
      actorLandlordId: user?.actorLandlordId,
      landlordId: user?.landlordId,
      userId: user?.id,
      email: user?.email,
    }),
    [user?.actorLandlordId, user?.email, user?.id, user?.landlordId]
  );
  const [legacyNotesByDate, setLegacyNotesByDate] = React.useState<SchedulingDayNotesByDate>({});
  const [legacyReviewOpen, setLegacyReviewOpen] = React.useState(false);
  const [legacyNoticeDismissed, setLegacyNoticeDismissed] = React.useState(false);
  const [legacyMigrationRunning, setLegacyMigrationRunning] = React.useState(false);
  const [legacyMigrationError, setLegacyMigrationError] = React.useState<string | null>(null);

  const selectedKey = dayKey(selectedDate);
  const selectedNotes = notesByDate[selectedKey] || [];
  const weekDays = React.useMemo(() => buildWeekDays(selectedDate), [selectedDate]);
  const monthDays = React.useMemo(() => buildMonthDays(activeMonth), [activeMonth]);
  const visibleRange = React.useMemo(() => {
    if (calendarView === "week") {
      return {
        startDate: dayKey(weekDays[0]),
        endDate: dayKey(weekDays[weekDays.length - 1]),
      };
    }
    if (calendarView === "month") {
      return {
        startDate: dayKey(monthDays[0]),
        endDate: dayKey(monthDays[monthDays.length - 1]),
      };
    }
    return { startDate: selectedKey, endDate: selectedKey };
  }, [calendarView, monthDays, selectedKey, weekDays]);
  const selectedParsedNotes = React.useMemo(
    () => selectedNotes.map((note) => ({ note, parsed: parseSchedulingNote({ noteId: note.id, text: note.text, date: selectedKey }) })),
    [selectedKey, selectedNotes]
  );
  const selectedNotePlan = React.useMemo(() => {
    const grouped = scheduleHours.reduce<Record<number, Array<{ note: SchedulingDayNote; parsed: SchedulingNoteParseResult }>>>((result, hour) => {
      result[hour] = [];
      return result;
    }, {});
    const suggestions: Array<{ note: SchedulingDayNote; parsed: SchedulingNoteParseResult }> = [];
    const needsReview: Array<{ note: SchedulingDayNote; parsed: SchedulingNoteParseResult }> = [];
    const unscheduled: Array<{ note: SchedulingDayNote; parsed: SchedulingNoteParseResult }> = [];
    selectedParsedNotes.forEach((entry) => {
      const hour = entry.parsed.timeMinutes === undefined ? null : Math.floor(entry.parsed.timeMinutes / 60);
      if (entry.parsed.placementType === "exact_time" && hour !== null && hour >= 7 && hour <= 22) {
        grouped[hour].push(entry);
      } else if (entry.parsed.placementType === "daypart") {
        suggestions.push(entry);
      } else if (entry.parsed.needsReview) {
        needsReview.push(entry);
      } else {
        unscheduled.push(entry);
      }
    });
    return { grouped, suggestions, needsReview, unscheduled };
  }, [selectedParsedNotes]);
  const hasSameTimeWorkspaceNotes = React.useMemo(() => {
    const noteCountByTime = new Map<number, number>();
    selectedParsedNotes.forEach(({ parsed }) => {
      if (parsed.placementType !== "exact_time" || parsed.timeMinutes === undefined) return;
      noteCountByTime.set(parsed.timeMinutes, (noteCountByTime.get(parsed.timeMinutes) || 0) + 1);
    });
    return [...noteCountByTime.values()].some((count) => count > 1);
  }, [selectedParsedNotes]);
  const legacyNotes = React.useMemo(
    () =>
      Object.entries(legacyNotesByDate).flatMap(([date, notes]) =>
        notes.map((note) => ({ date, note, fingerprint: legacySchedulingDayNoteFingerprint(date, note) }))
      ),
    [legacyNotesByDate]
  );

  React.useEffect(() => {
    setLegacyNotesByDate(readLegacySchedulingDayNotes(legacyNotesScope));
    setLegacyNoticeDismissed(false);
    setLegacyMigrationError(null);
  }, [legacyNotesScope]);

  React.useEffect(() => {
    const nextDate = parseDateKey(searchParams.get("date"));
    const nextView = viewFromParam(searchParams.get("view"));
    if (nextDate) {
      setSelectedDate(nextDate);
      setActiveMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    }
    setCalendarView(nextView);
  }, [searchParams]);

  const syncRoute = React.useCallback(
    (nextView: CalendarView, nextDate: Date) => {
      setSearchParams({ view: nextView, date: dayKey(nextDate) }, { replace: true });
    },
    [setSearchParams]
  );

  React.useEffect(() => {
    let active = true;
    setNotesLoading(true);
    setNotesError(null);
    fetchSchedulingDayNotesRange(visibleRange)
      .then((nextNotes) => {
        if (!active) return;
        setNotesByDate((current) => {
          const next = { ...current };
          dateKeysInRange(visibleRange.startDate, visibleRange.endDate).forEach((dateKey) => {
            delete next[dateKey];
          });
          return { ...next, ...nextNotes };
        });
      })
      .catch(() => {
        if (!active) return;
        setNotesError("Scheduling notes could not be loaded. Try refreshing this view.");
      })
      .finally(() => {
        if (active) setNotesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visibleRange]);

  const replaceNotesForDate = React.useCallback((dateKey: string, notes: SchedulingDayNote[]) => {
    setNotesByDate((current) => {
      const next = { ...current };
      if (notes.length) next[dateKey] = notes;
      else delete next[dateKey];
      return next;
    });
  }, []);

  const selectDate = (date: Date, nextView: CalendarView = "day") => {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    setSelectedDate(next);
    setActiveMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    setCalendarView(nextView);
    syncRoute(nextView, next);
    setNoteDraft("");
  };

  const selectView = (nextView: CalendarView) => {
    setCalendarView(nextView);
    syncRoute(nextView, selectedDate);
  };

  const addNote = async () => {
    const text = noteDraft.trim();
    if (!text) {
      return;
    }
    setDraftSaving(true);
    setNotesError(null);
    setNotesStatus(null);
    try {
      const note = await createSchedulingDayNote(selectedKey, { noteText: text, source: "scheduling" });
      replaceNotesForDate(selectedKey, [...selectedNotes, note]);
      setNoteDraft("");
      setNotesStatus("Workspace note saved.");
    } catch {
      setNotesError("Scheduling note could not be saved. No notification or calendar event was created.");
    } finally {
      setDraftSaving(false);
    }
  };

  const updateNote = (noteId: string, value: string) => {
    replaceNotesForDate(
      selectedKey,
      selectedNotes.map((note) => (note.id === noteId ? { ...note, text: value } : note))
    );
  };

  const saveNote = async (note: SchedulingDayNote) => {
    const text = note.text.trim();
    if (!text) {
      setNotesError("Scheduling note text is required. Delete the note if it is no longer needed.");
      return;
    }
    setSavingNoteIds((current) => ({ ...current, [note.id]: true }));
    setNotesError(null);
    setNotesStatus(null);
    try {
      const saved = await updateSchedulingDayNote(selectedKey, note.id, { noteText: text, source: "scheduling" });
      replaceNotesForDate(
        selectedKey,
        selectedNotes.map((current) => (current.id === saved.id ? saved : current))
      );
      setNotesStatus("Workspace note saved.");
    } catch {
      setNotesError("Scheduling note could not be saved. Refresh this view and try again.");
    } finally {
      setSavingNoteIds((current) => ({ ...current, [note.id]: false }));
    }
  };

  const confirmDeleteNote = async () => {
    if (!pendingDeleteNote) return;
    const noteId = pendingDeleteNote.id;
    setSavingNoteIds((current) => ({ ...current, [noteId]: true }));
    setNotesError(null);
    setNotesStatus(null);
    try {
      await deleteSchedulingDayNote(selectedKey, noteId);
      replaceNotesForDate(
        selectedKey,
        selectedNotes.filter((note) => note.id !== noteId)
      );
      setPendingDeleteNote(null);
      setNotesStatus("Workspace note deleted.");
    } catch {
      setNotesError("Scheduling note could not be deleted. Refresh this view and try again.");
    } finally {
      setSavingNoteIds((current) => ({ ...current, [noteId]: false }));
    }
  };

  const openDeleteConfirmation = (note: SchedulingDayNote) => {
    setPendingDeleteNote(note);
  };

  const migrateLegacyNotes = async () => {
    setLegacyMigrationRunning(true);
    setLegacyMigrationError(null);
    const createdByDate: SchedulingDayNotesByDate = {};
    try {
      for (const legacy of legacyNotes) {
        const created = await createSchedulingDayNote(legacy.date, {
          noteText: legacy.note.text,
          source: "scheduling",
        });
        markLegacySchedulingDayNotesMigrated(legacyNotesScope, [legacy.fingerprint]);
        createdByDate[legacy.date] = [...(createdByDate[legacy.date] || []), created];
      }
      clearMigratedLegacySchedulingDayNotes(legacyNotesScope);
      setLegacyNotesByDate({});
      setLegacyReviewOpen(false);
      setNotesByDate((current) => {
        const next = { ...current };
        Object.entries(createdByDate).forEach(([date, notes]) => {
          next[date] = [...(next[date] || []), ...notes];
        });
        return next;
      });
      setNotesStatus(`${legacyNotes.length} browser-saved ${legacyNotes.length === 1 ? "note" : "notes"} moved to workspace notes.`);
    } catch {
      setLegacyNotesByDate(readLegacySchedulingDayNotes(legacyNotesScope));
      setLegacyMigrationError(
        "Some browser-saved notes could not be moved. Your original browser data was kept; retry to move the remaining notes."
      );
    } finally {
      setLegacyMigrationRunning(false);
    }
  };

  const moveMonth = (offset: number) => {
    setActiveMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const moveDay = (offset: number) => {
    const next = new Date(selectedDate);
    next.setDate(selectedDate.getDate() + offset);
    selectDate(next, "day");
  };

  return (
    <div className="scheduling-workspace rc-print-area">
      <style>{`
        .scheduling-workspace {
          --schedule-card: #fffaf1;
          --schedule-panel: #fff6e8;
          --schedule-muted-panel: #f7efe2;
          --schedule-border: rgba(91, 70, 48, 0.16);
          --schedule-border-strong: rgba(91, 70, 48, 0.28);
          --schedule-text: #211c17;
          --schedule-muted: #63594d;
          --schedule-pine: #245842;
          --schedule-pine-soft: rgba(36, 88, 66, 0.12);
          --schedule-shadow: 0 10px 24px rgba(59, 44, 28, 0.1);
          display: grid;
          gap: ${spacing.lg};
          color: var(--schedule-text);
          max-width: 1320px;
          margin: 0 auto;
        }
        .scheduling-card {
          background: var(--schedule-card) !important;
          border-color: var(--schedule-border) !important;
          box-shadow: var(--schedule-shadow) !important;
        }
        .scheduling-migration-card {
          display: grid;
          gap: ${spacing.sm};
          border-color: rgba(36, 88, 66, 0.38) !important;
          background: var(--schedule-panel) !important;
        }
        .scheduling-migration-card h2,
        .scheduling-migration-card p {
          margin: 0;
        }
        .scheduling-migration-card p,
        .scheduling-migration-list small {
          color: var(--schedule-muted);
          line-height: 1.5;
        }
        .scheduling-migration-list {
          display: grid;
          gap: 8px;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .scheduling-migration-list li {
          display: grid;
          gap: 3px;
          padding: 10px 12px;
          border: 1px solid var(--schedule-border);
          border-radius: ${radius.md};
          background: var(--schedule-card);
          overflow-wrap: anywhere;
        }
        .scheduling-workspace input {
          background: #fffefb !important;
          border-color: var(--schedule-border-strong) !important;
          color: var(--schedule-text) !important;
        }
        .scheduling-workspace input::placeholder {
          color: #73685c;
          opacity: 1;
        }
        .scheduling-workspace input:focus {
          border-color: rgba(36, 88, 66, 0.42) !important;
          box-shadow: 0 0 0 3px rgba(36, 88, 66, 0.18) !important;
        }
        .scheduling-workspace button:not(.scheduling-day) {
          border: 1px solid var(--schedule-border) !important;
          background: var(--schedule-card) !important;
          color: var(--schedule-text) !important;
          box-shadow: none !important;
        }
        .scheduling-workspace button:not(.scheduling-day):hover,
        .scheduling-link-button:hover,
        .scheduling-item-row:hover {
          border-color: var(--schedule-border-strong) !important;
          background: var(--schedule-panel) !important;
        }
        .scheduling-workspace button.scheduling-primary-action {
          border-color: rgba(36, 88, 66, 0.42) !important;
          background: var(--schedule-pine) !important;
          color: #fffaf1 !important;
        }
        .scheduling-hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: ${spacing.md};
          flex-wrap: wrap;
        }
        .scheduling-hero h1 {
          margin: 0;
          font-size: 1.65rem;
          letter-spacing: 0;
        }
        .scheduling-hero p {
          margin: 6px 0 0;
          color: var(--schedule-muted);
          line-height: 1.5;
        }
        .scheduling-layout {
          display: grid;
          grid-template-columns: minmax(320px, 0.92fr) minmax(360px, 1.08fr);
          gap: ${spacing.lg};
          align-items: start;
        }
        .scheduling-left,
        .scheduling-right {
          display: grid;
          gap: ${spacing.md};
        }
        .scheduling-toolbar,
        .scheduling-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: ${spacing.sm};
          flex-wrap: wrap;
        }
        .scheduling-month-title {
          display: inline-flex;
          align-items: center;
          gap: ${spacing.sm};
          font-weight: 800;
        }
        .scheduling-view-toggle {
          display: inline-flex;
          padding: 3px;
          border: 1px solid var(--schedule-border);
          border-radius: ${radius.pill};
          background: var(--schedule-muted-panel);
        }
        .scheduling-view-toggle button,
        .scheduling-month-controls button {
          border: 0;
          border-radius: ${radius.pill};
          background: transparent;
          color: var(--schedule-muted);
          font-weight: 800;
          padding: 8px 11px;
          cursor: pointer;
        }
        .scheduling-view-toggle button.is-active {
          background: var(--schedule-card) !important;
          color: var(--schedule-pine) !important;
          box-shadow: 0 1px 2px rgba(59,44,28,0.12) !important;
        }
        .scheduling-calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 7px;
        }
        .scheduling-weekday {
          color: var(--schedule-muted);
          font-size: 0.78rem;
          font-weight: 800;
          text-align: center;
        }
        .scheduling-day {
          min-height: 70px;
          border: 1px solid var(--schedule-border);
          border-radius: ${radius.md};
          background: var(--schedule-card);
          color: var(--schedule-text);
          cursor: pointer;
          display: grid;
          align-content: space-between;
          padding: 8px;
          text-align: left;
        }
        .scheduling-day.is-muted {
          color: var(--schedule-muted);
          background: var(--schedule-muted-panel);
        }
        .scheduling-day.is-selected {
          border-color: rgba(36, 88, 66, 0.42);
          background: var(--schedule-pine-soft);
          box-shadow: 0 0 0 3px rgba(36,88,66,0.16);
        }
        .scheduling-day strong {
          font-size: 0.9rem;
        }
        .scheduling-day span {
          justify-self: start;
          font-size: 0.72rem;
          font-weight: 800;
          color: var(--schedule-pine);
          background: var(--schedule-pine-soft);
          border-radius: ${radius.pill};
          padding: 3px 6px;
        }
        .scheduling-day-summary {
          display: grid;
          gap: ${spacing.sm};
        }
        .scheduling-hour-list {
          display: grid;
          gap: 8px;
        }
        .scheduling-hour-row {
          display: grid;
          grid-template-columns: 74px minmax(0, 1fr);
          gap: ${spacing.sm};
          align-items: start;
          border: 1px solid var(--schedule-border);
          border-radius: ${radius.md};
          padding: 10px;
          background: var(--schedule-muted-panel);
        }
        .scheduling-hour-label {
          color: var(--schedule-pine);
          font-weight: 900;
          font-size: 0.82rem;
          white-space: nowrap;
        }
        .scheduling-slot-notes {
          display: grid;
          gap: 6px;
          min-width: 0;
        }
        .scheduling-slot-note {
          border: 1px solid var(--schedule-border);
          border-radius: ${radius.md};
          padding: 8px 10px;
          background: var(--schedule-card);
          color: var(--schedule-text);
          line-height: 1.4;
          overflow-wrap: anywhere;
        }
        .scheduling-agenda-list {
          display: grid;
          gap: ${spacing.sm};
        }
        .scheduling-agenda-day {
          display: grid;
          grid-template-columns: minmax(110px, 0.42fr) minmax(0, 1fr);
          gap: ${spacing.sm};
          text-align: left;
          border: 1px solid var(--schedule-border);
          border-radius: ${radius.md};
          padding: 11px 12px;
          background: var(--schedule-muted-panel);
          color: var(--schedule-text);
          cursor: pointer;
        }
        .scheduling-agenda-day strong,
        .scheduling-agenda-day span {
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .scheduling-section-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .scheduling-section-title h2 {
          margin: 0;
          font-size: 1.05rem;
        }
        .scheduling-link-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          padding: 8px 12px;
          border: 1px solid var(--schedule-border);
          border-radius: ${radius.pill};
          color: var(--schedule-text);
          text-decoration: none;
          font-weight: 800;
          background: var(--schedule-card);
          white-space: nowrap;
        }
        .scheduling-item-list {
          display: grid;
          gap: ${spacing.sm};
        }
        .scheduling-item-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: ${spacing.sm};
          padding: 12px;
          border: 1px solid var(--schedule-border);
          border-radius: ${radius.md};
          text-decoration: none;
          color: var(--schedule-text);
          background: var(--schedule-muted-panel);
        }
        .scheduling-item-row span {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .scheduling-item-row small {
          color: var(--schedule-muted);
          line-height: 1.35;
        }
        .scheduling-item-row em {
          font-style: normal;
          font-weight: 800;
          color: var(--schedule-pine);
          white-space: nowrap;
        }
        .scheduling-note-actions,
        .scheduling-note-list,
        .scheduling-note-row,
        .scheduling-shortcuts {
          display: flex;
          gap: ${spacing.sm};
          flex-wrap: wrap;
        }
        .scheduling-note-list {
          display: grid;
          gap: ${spacing.sm};
        }
        .scheduling-note-row {
          align-items: center;
          border: 1px solid var(--schedule-border);
          border-radius: ${radius.md};
          background: var(--schedule-muted-panel);
          padding: ${spacing.sm};
        }
        .scheduling-note-row input {
          flex: 1 1 220px;
          min-width: 0;
        }
        .scheduling-local-note {
          color: var(--schedule-muted);
          font-size: 0.82rem;
          line-height: 1.4;
        }
        .scheduling-review-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: ${spacing.sm};
        }
        .scheduling-review-list li {
          border: 1px solid var(--schedule-border);
          border-radius: ${radius.md};
          padding: 11px 12px;
          background: var(--schedule-muted-panel);
          color: var(--schedule-muted);
          line-height: 1.45;
        }
        @media (max-width: 980px) {
          .scheduling-layout {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 640px) {
          .scheduling-workspace {
            gap: ${spacing.md};
          }
          .scheduling-hero h1 {
            font-size: 1.4rem;
          }
          .scheduling-day {
            min-height: 54px;
            padding: 7px;
          }
          .scheduling-day span {
            display: none;
          }
          .scheduling-hour-row,
          .scheduling-agenda-day {
            grid-template-columns: 1fr;
          }
          .scheduling-calendar-grid {
            gap: 5px;
          }
          .scheduling-item-row {
            align-items: flex-start;
            flex-direction: column;
          }
          .scheduling-note-actions .scheduling-link-button,
          .scheduling-shortcuts .scheduling-link-button {
            width: 100%;
          }
          .scheduling-note-row input,
          .scheduling-note-row button,
          .scheduling-note-actions input,
          .scheduling-note-actions button {
            width: 100%;
          }
        }
        @media print {
          .scheduling-workspace {
            max-width: none;
            gap: 14px;
            padding: 0 !important;
          }
          .scheduling-workspace .no-print {
            display: none !important;
          }
          .scheduling-card,
          .scheduling-hour-row,
          .scheduling-note-row,
          .scheduling-item-row,
          .scheduling-review-list li {
            box-shadow: none !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .scheduling-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <Card elevated className="scheduling-hero scheduling-card">
        <div>
          <h1>Scheduling</h1>
          <p>Calendar view for viewings, maintenance, work orders, screening, and notes.</p>
        </div>
        <div className="scheduling-note-actions no-print">
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Printer size={16} aria-hidden="true" />
              Print / Save PDF
            </span>
          </Button>
          <Link to="/dashboard" className="scheduling-link-button">
            Back to Dashboard
          </Link>
        </div>
      </Card>

      {legacyNotes.length && !legacyNoticeDismissed ? (
        <Card className="scheduling-card scheduling-migration-card" aria-label="Browser-saved notes migration">
          <h2>Browser-saved notes found</h2>
          <p>
            These {legacyNotes.length} {legacyNotes.length === 1 ? "note was" : "notes were"} saved on this browser before
            workspace notes were enabled. You can move {legacyNotes.length === 1 ? "it" : "them"} into workspace notes so
            {legacyNotes.length === 1 ? " it is" : " they are"} available across devices for this landlord account.
          </p>
          {legacyReviewOpen ? (
            <ul className="scheduling-migration-list" aria-label="Browser-saved notes review">
              {legacyNotes.map(({ date, note, fingerprint }) => (
                <li key={fingerprint}>
                  <strong>{date}</strong>
                  <span>{note.text}</span>
                  <small>A new workspace note will be created. Existing workspace notes for this date will not be changed.</small>
                </li>
              ))}
            </ul>
          ) : null}
          {legacyMigrationError ? <div role="alert">{legacyMigrationError}</div> : null}
          <div className="scheduling-note-actions">
            <Button type="button" onClick={() => setLegacyReviewOpen((open) => !open)} disabled={legacyMigrationRunning}>
              {legacyReviewOpen ? "Hide review" : "Review notes"}
            </Button>
            <Button
              type="button"
              className="scheduling-primary-action"
              onClick={migrateLegacyNotes}
              disabled={legacyMigrationRunning}
            >
              {legacyMigrationRunning ? "Moving notes..." : "Move to workspace notes"}
            </Button>
            <Button type="button" onClick={() => setLegacyNoticeDismissed(true)} disabled={legacyMigrationRunning}>
              Not now
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="scheduling-layout">
        <div className="scheduling-left">
          <Card className="scheduling-card" style={{ display: "grid", gap: spacing.md }}>
            <div className="scheduling-toolbar">
              <div className="scheduling-month-title">
                <CalendarDays size={18} strokeWidth={2.2} aria-hidden="true" />
                <span>
                  {calendarView === "day"
                    ? `${formatDay(selectedDate)} schedule`
                    : calendarView === "week"
                      ? `7 days from ${formatDay(startOfWeek(selectedDate))}`
                      : `${formatMonth(activeMonth)} overview`}
                </span>
              </div>
              <div className="scheduling-view-toggle" aria-label="Calendar view">
                <button
                  type="button"
                  className={calendarView === "day" ? "is-active" : ""}
                  onClick={() => selectView("day")}
                >
                  Day
                </button>
                <button
                  type="button"
                  className={calendarView === "week" ? "is-active" : ""}
                  onClick={() => selectView("week")}
                >
                  7 days
                </button>
                <button
                  type="button"
                  className={calendarView === "month" ? "is-active" : ""}
                  onClick={() => selectView("month")}
                >
                  30 days
                </button>
              </div>
            </div>

            <div className="scheduling-toolbar">
              {calendarView === "month" ? (
                <div className="scheduling-month-controls">
                  <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">
                    Prev
                  </button>
                  <button type="button" onClick={() => moveMonth(1)} aria-label="Next month">
                    Next
                  </button>
                </div>
              ) : (
                <div className="scheduling-month-controls">
                  <button type="button" onClick={() => moveDay(-1)} aria-label="Previous day">
                    Prev
                  </button>
                  <button type="button" onClick={() => moveDay(1)} aria-label="Next day">
                    Next
                  </button>
                </div>
              )}
              <strong style={{ color: text.muted, fontSize: "0.9rem" }}>{formatDay(selectedDate)}</strong>
            </div>

            {calendarView === "day" ? (
              <div className="scheduling-day-summary" aria-label="Selected day schedule">
                <div className="scheduling-local-note">
                  7 AM-10 PM schedule. Workspace notes with clear times are placed into hourly slots; other notes stay unscheduled.
                </div>
                {notesLoading ? <div className="scheduling-local-note">Loading saved scheduling notes.</div> : null}
                {selectedNotes.length === 0 ? (
                  <div className="scheduling-local-note">No saved notes for this day.</div>
                ) : null}
                <div className="scheduling-hour-list" aria-label="7 AM-10 PM schedule">
                  {scheduleHours.map((hour) => {
                    const notes = selectedNotePlan.grouped[hour] || [];
                    return (
                      <div key={hour} className="scheduling-hour-row" aria-label={`Schedule slot ${formatHour(hour)}`}>
                        <div className="scheduling-hour-label">{formatHour(hour)}</div>
                        <div className="scheduling-slot-notes">
                          {notes.length ? (
                            notes.map(({ note, parsed }) => {
                              return (
                                <div key={note.id} className="scheduling-slot-note">
                                  <strong>{parsed.timeLabel || formatHour(hour)}</strong>
                                  <div>{note.text}</div>
                                  {parsed.needsReview ? (
                                    <small className="scheduling-local-note">Needs review · {parsed.reason}</small>
                                  ) : null}
                                </div>
                              );
                            })
                          ) : (
                            <span className="scheduling-local-note">No scheduled notes</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "grid", gap: spacing.sm }}>
                  <strong>Suggested day plan</strong>
                  <div className="scheduling-local-note">
                    Suggested from note text. AI-assisted scheduling is advisory; no calendar event has been created.
                  </div>
                  {selectedNotePlan.suggestions.length ? (
                    <div className="scheduling-note-list" aria-label="Suggested day plan">
                      {selectedNotePlan.suggestions.map(({ note, parsed }) => (
                        <div key={note.id} className="scheduling-slot-note">
                          <strong>{parsed.timeLabel}</strong>
                          <div>{note.text}</div>
                          <small className="scheduling-local-note">Suggested by note parser · {parsed.reason}</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="scheduling-local-note">No daypart suggestions for this day.</div>
                  )}
                </div>
                <div style={{ display: "grid", gap: spacing.sm }}>
                  <strong>Needs review</strong>
                  {selectedNotePlan.needsReview.length ? (
                    <div className="scheduling-note-list" aria-label="Notes needing review">
                      {selectedNotePlan.needsReview.map(({ note, parsed }) => (
                        <div key={note.id} className="scheduling-slot-note">
                          {parsed.timeLabel ? <strong>{parsed.timeLabel}</strong> : null}
                          <div>{note.text}</div>
                          <small className="scheduling-local-note">Needs review · {parsed.reason}</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="scheduling-local-note">No ambiguous timing cues need review.</div>
                  )}
                </div>
                <div style={{ display: "grid", gap: spacing.sm }}>
                  <strong>Unscheduled notes</strong>
                  {selectedNotePlan.unscheduled.length ? (
                    <div className="scheduling-note-list" aria-label="Unscheduled notes">
                      {selectedNotePlan.unscheduled.map(({ note }) => (
                        <div key={note.id} className="scheduling-slot-note">
                          {note.text}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="scheduling-local-note">No unscheduled notes for this day.</div>
                  )}
                </div>
              </div>
            ) : calendarView === "week" ? (
              <div className="scheduling-agenda-list" aria-label="7-day agenda summary">
                {weekDays.map((day) => {
                  const key = dayKey(day);
                  const notes = notesByDate[key] || [];
                  return (
                    <button key={key} type="button" className="scheduling-agenda-day" onClick={() => selectDate(day, "day")}>
                      <strong>{formatDay(day)}</strong>
                      <span>
                        {notes.length
                          ? `${notes.length} saved ${notes.length === 1 ? "note" : "notes"} - ${notes.slice(0, 2).map((note) => note.text).join("; ")}`
                          : "No saved notes"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="scheduling-calendar-grid" aria-label="30-day scheduling overview">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="scheduling-weekday">
                    {day}
                  </div>
                ))}
                {monthDays.map((day) => {
                  const key = dayKey(day);
                  const isSelected = key === selectedKey;
                  const isMuted = day.getMonth() !== activeMonth.getMonth();
                  return (
                    <button
                      key={key}
                      type="button"
                      className={[
                        "scheduling-day",
                        isSelected ? "is-selected" : "",
                        isMuted ? "is-muted" : "",
                      ].filter(Boolean).join(" ")}
                      onClick={() => selectDate(day, "day")}
                      aria-pressed={isSelected}
                    >
                      <strong>{day.getDate()}</strong>
                      {notesByDate[key]?.length ? <span>{notesByDate[key].length} note{notesByDate[key].length === 1 ? "" : "s"}</span> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="scheduling-card" style={{ display: "grid", gap: spacing.md }}>
            <SectionHeader icon={FileText} title="Notes" />
            <div style={{ display: "grid", gap: spacing.sm }}>
              <strong>{formatDay(selectedDate)}</strong>
              <div className="scheduling-local-note">
                Notes are saved as workspace notes for this landlord account.
              </div>
              {notesError ? <div className="scheduling-local-note" role="alert">{notesError}</div> : null}
              {notesStatus ? <div className="scheduling-local-note">{notesStatus}</div> : null}
              {selectedNotes.length ? (
                <div className="scheduling-note-list" aria-label="Saved schedule notes">
                  {selectedNotes.map((note, index) => (
                    <div key={note.id} className="scheduling-note-row">
                      <Input
                        aria-label={`Edit note ${index + 1}`}
                        value={note.text}
                        onChange={(event) => updateNote(note.id, event.target.value)}
                        placeholder="Note text"
                      />
                      <Button type="button" variant="secondary" onClick={() => saveNote(note)} disabled={Boolean(savingNoteIds[note.id])}>
                        {savingNoteIds[note.id] ? "Saving" : "Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => openDeleteConfirmation(note)}
                        disabled={Boolean(savingNoteIds[note.id])}
                      >
                        {savingNoteIds[note.id] ? "Deleting" : "Delete"}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="scheduling-local-note">No saved notes for this day.</div>
              )}
              <Input
                className="scheduling-note-draft-input"
                aria-label="New schedule note"
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Add a workspace note for this day"
              />
              <div className="scheduling-note-actions">
                <Button type="button" className="scheduling-primary-action" onClick={addNote} aria-label="Add note" disabled={draftSaving}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Plus size={16} aria-hidden="true" />
                    {draftSaving ? "Saving" : "Add note"}
                  </span>
                </Button>
                <Button type="button" variant="ghost" onClick={() => setNoteDraft("")} disabled={!noteDraft || draftSaving}>
                  Clear draft
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="scheduling-right">
          <WorkspaceList
            title="Viewings"
            icon={MonitorCheck}
            items={viewings}
            actionTo="/applications"
            actionLabel="Open Applications"
          />
          <WorkspaceList
            title="Maintenance Requests"
            icon={Wrench}
            items={maintenanceRequests}
            actionTo="/maintenance"
            actionLabel="Open Maintenance"
          />
          <WorkspaceList
            title="Work Orders"
            icon={ClipboardList}
            items={workOrders}
            actionTo="/work-orders"
            actionLabel="Open Work Orders"
          />
          <WorkspaceList
            title="Screening Activities"
            icon={ShieldCheck}
            items={screeningActivities}
            actionTo="/screening"
            actionLabel="Open Screening"
          />

          <Card className="scheduling-card" style={{ display: "grid", gap: spacing.md }}>
            <SectionHeader icon={ListChecks} title="Screening Shortcuts" />
            <div className="scheduling-shortcuts">
              <Link to="/screening" className="scheduling-link-button">
                Connect Screening Provider
              </Link>
              <Link to="/screening/manual" className="scheduling-link-button">
                Screen Manually
              </Link>
            </div>
          </Card>

          <Card className="scheduling-card" style={{ display: "grid", gap: spacing.md }}>
            <SectionHeader icon={ListChecks} title="Scheduling Review" />
            <ul className="scheduling-review-list" aria-label="Read-only scheduling recommendations">
              {hasSameTimeWorkspaceNotes ? (
                <li>Multiple workspace notes share the same time. Review before confirming the schedule.</li>
              ) : null}
              {reviewItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      {pendingDeleteNote ? (
        <DeleteNoteDialog
          busy={Boolean(savingNoteIds[pendingDeleteNote.id])}
          onCancel={() => setPendingDeleteNote(null)}
          onConfirm={() => {
            void confirmDeleteNote();
          }}
        />
      ) : null}
    </div>
  );
}
