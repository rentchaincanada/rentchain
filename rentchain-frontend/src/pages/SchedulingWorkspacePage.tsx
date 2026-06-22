import React from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  FileText,
  ListChecks,
  MonitorCheck,
  Plus,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Button, Card, Input } from "../components/ui/Ui";
import { colors, radius, spacing, text } from "../styles/tokens";

type CalendarView = "month" | "week";

type WorkspaceItem = {
  title: string;
  detail: string;
  status: string;
  to: string;
};

type ScheduleNote = {
  id: string;
  text: string;
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
  "No upcoming viewing conflicts detected.",
  "No maintenance windows are scheduled for the selected day.",
  "Work order sequencing is ready for review from the Work Orders workspace.",
  "Suggested scheduling windows will appear as calendar data becomes available.",
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDay(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatMonth(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
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
    <Card style={{ display: "grid", gap: spacing.md }}>
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

export default function SchedulingWorkspacePage() {
  const today = React.useMemo(() => new Date(), []);
  const [calendarView, setCalendarView] = React.useState<CalendarView>("month");
  const [activeMonth, setActiveMonth] = React.useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = React.useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [notesByDate, setNotesByDate] = React.useState<Record<string, ScheduleNote[]>>({});
  const [noteDraft, setNoteDraft] = React.useState("");

  const selectedKey = dayKey(selectedDate);
  const selectedNotes = notesByDate[selectedKey] || [];
  const days = calendarView === "month" ? buildMonthDays(activeMonth) : buildWeekDays(selectedDate);

  const selectDate = (date: Date) => {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    setSelectedDate(next);
    setActiveMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    setNoteDraft("");
  };

  const addNote = () => {
    const note: ScheduleNote = {
      id: `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text: noteDraft.trim(),
    };
    setNotesByDate((current) => {
      const currentNotes = current[selectedKey] || [];
      return { ...current, [selectedKey]: [...currentNotes, note] };
    });
    setNoteDraft("");
  };

  const updateNote = (noteId: string, value: string) => {
    setNotesByDate((current) => {
      const nextNotes = (current[selectedKey] || []).map((note) =>
        note.id === noteId ? { ...note, text: value } : note
      );
      return { ...current, [selectedKey]: nextNotes };
    });
  };

  const deleteNote = (noteId: string) => {
    setNotesByDate((current) => {
      const nextNotes = (current[selectedKey] || []).filter((note) => note.id !== noteId);
      const next = { ...current };
      if (nextNotes.length) {
        next[selectedKey] = nextNotes;
      } else {
        delete next[selectedKey];
      }
      return next;
    });
  };

  const moveMonth = (offset: number) => {
    setActiveMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <div className="scheduling-workspace">
      <style>{`
        .scheduling-workspace {
          display: grid;
          gap: ${spacing.lg};
          color: ${text.primary};
          max-width: 1320px;
          margin: 0 auto;
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
          color: ${text.muted};
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
          border: 1px solid ${colors.border};
          border-radius: ${radius.pill};
          background: #f8fafc;
        }
        .scheduling-view-toggle button,
        .scheduling-month-controls button {
          border: 0;
          border-radius: ${radius.pill};
          background: transparent;
          color: ${text.secondary};
          font-weight: 800;
          padding: 8px 11px;
          cursor: pointer;
        }
        .scheduling-view-toggle button.is-active {
          background: ${colors.card};
          color: ${colors.accent};
          box-shadow: 0 1px 2px rgba(15,23,42,0.12);
        }
        .scheduling-calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 7px;
        }
        .scheduling-weekday {
          color: ${text.subtle};
          font-size: 0.78rem;
          font-weight: 800;
          text-align: center;
        }
        .scheduling-day {
          min-height: 70px;
          border: 1px solid ${colors.border};
          border-radius: ${radius.md};
          background: #fff;
          color: ${text.primary};
          cursor: pointer;
          display: grid;
          align-content: space-between;
          padding: 8px;
          text-align: left;
        }
        .scheduling-day.is-muted {
          color: ${text.subtle};
          background: #f8fafc;
        }
        .scheduling-day.is-selected {
          border-color: ${colors.accent};
          box-shadow: 0 0 0 3px rgba(37,99,235,0.16);
        }
        .scheduling-day strong {
          font-size: 0.9rem;
        }
        .scheduling-day span {
          justify-self: start;
          font-size: 0.72rem;
          font-weight: 800;
          color: #166534;
          background: rgba(34,197,94,0.12);
          border-radius: ${radius.pill};
          padding: 3px 6px;
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
          border: 1px solid ${colors.border};
          border-radius: ${radius.pill};
          color: ${text.primary};
          text-decoration: none;
          font-weight: 800;
          background: #fff;
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
          border: 1px solid ${colors.border};
          border-radius: ${radius.md};
          text-decoration: none;
          color: ${text.primary};
          background: #f8fafc;
        }
        .scheduling-item-row span {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .scheduling-item-row small {
          color: ${text.muted};
          line-height: 1.35;
        }
        .scheduling-item-row em {
          font-style: normal;
          font-weight: 800;
          color: ${colors.accent};
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
          border: 1px solid ${colors.border};
          border-radius: ${radius.md};
          background: #f8fafc;
          padding: ${spacing.sm};
        }
        .scheduling-note-row input {
          flex: 1 1 220px;
          min-width: 0;
        }
        .scheduling-local-note {
          color: ${text.subtle};
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
          border: 1px solid ${colors.border};
          border-radius: ${radius.md};
          padding: 11px 12px;
          background: #f8fafc;
          color: ${text.secondary};
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
      `}</style>

      <Card elevated className="scheduling-hero">
        <div>
          <h1>Scheduling</h1>
          <p>Calendar view for viewings, maintenance, work orders, screening, and notes.</p>
        </div>
        <Link to="/dashboard" className="scheduling-link-button">
          Back to Dashboard
        </Link>
      </Card>

      <div className="scheduling-layout">
        <div className="scheduling-left">
          <Card style={{ display: "grid", gap: spacing.md }}>
            <div className="scheduling-toolbar">
              <div className="scheduling-month-title">
                <CalendarDays size={18} strokeWidth={2.2} aria-hidden="true" />
                <span>{calendarView === "month" ? formatMonth(activeMonth) : `Week of ${formatDay(startOfWeek(selectedDate))}`}</span>
              </div>
              <div className="scheduling-view-toggle" aria-label="Calendar view">
                <button
                  type="button"
                  className={calendarView === "month" ? "is-active" : ""}
                  onClick={() => setCalendarView("month")}
                >
                  Month
                </button>
                <button
                  type="button"
                  className={calendarView === "week" ? "is-active" : ""}
                  onClick={() => setCalendarView("week")}
                >
                  7-day
                </button>
              </div>
            </div>

            <div className="scheduling-toolbar">
              <div className="scheduling-month-controls">
                <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">
                  Prev
                </button>
                <button type="button" onClick={() => moveMonth(1)} aria-label="Next month">
                  Next
                </button>
              </div>
              <strong style={{ color: text.muted, fontSize: "0.9rem" }}>{formatDay(selectedDate)}</strong>
            </div>

            <div className="scheduling-calendar-grid" aria-label="Scheduling calendar">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="scheduling-weekday">
                  {day}
                </div>
              ))}
              {days.map((day) => {
                const key = dayKey(day);
                const isSelected = key === selectedKey;
                const isMuted = day.getMonth() !== activeMonth.getMonth() && calendarView === "month";
                return (
                  <button
                    key={key}
                    type="button"
                    className={[
                      "scheduling-day",
                      isSelected ? "is-selected" : "",
                      isMuted ? "is-muted" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => selectDate(day)}
                    aria-pressed={isSelected}
                  >
                    <strong>{day.getDate()}</strong>
                    {notesByDate[key]?.length ? <span>{notesByDate[key].length} note{notesByDate[key].length === 1 ? "" : "s"}</span> : null}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card style={{ display: "grid", gap: spacing.md }}>
            <SectionHeader icon={FileText} title="Notes" />
            <div style={{ display: "grid", gap: spacing.sm }}>
              <strong>{formatDay(selectedDate)}</strong>
              <div className="scheduling-local-note">Notes are local to this Phase 1 scheduling preview.</div>
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
                      <Button type="button" variant="secondary" onClick={() => updateNote(note.id, note.text)}>
                        Save
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => deleteNote(note.id)}>
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="scheduling-local-note">No notes for this day.</div>
              )}
              <Input
                aria-label="New schedule note"
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Add another note for this day"
              />
              <div className="scheduling-note-actions">
                <Button type="button" onClick={addNote} aria-label="Add note">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Plus size={16} aria-hidden="true" />
                    Add note
                  </span>
                </Button>
                <Button type="button" variant="ghost" onClick={() => setNoteDraft("")} disabled={!noteDraft}>
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

          <Card style={{ display: "grid", gap: spacing.md }}>
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

          <Card style={{ display: "grid", gap: spacing.md }}>
            <SectionHeader icon={ListChecks} title="Scheduling Review" />
            <ul className="scheduling-review-list" aria-label="Read-only scheduling recommendations">
              {reviewItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
