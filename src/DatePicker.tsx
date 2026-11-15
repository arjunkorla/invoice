/**
 * Lightweight date picker (no dependency) for Invoice date / Due date.
 *
 * - Stores and emits the same "YYYY-MM-DD" strings as before.
 * - Shows the date like the invoice documents ("15 Nov 2026").
 * - Accepts typed dates on desktop (e.g. 15/11/2026, 2026-11-15, 15 Nov 2026).
 *   On touch devices the field opens the calendar without the keyboard.
 * - Keyboard: ArrowDown/Enter opens; arrows move by day/week; PageUp/PageDown
 *   by month; Home/End to week start/end; Enter selects; Escape closes.
 * - The popover is portalled to <body>, positioned below (or above) the field
 *   and clamped inside the viewport so it is never clipped.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatDate, today } from "./lib";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_ABBR = MONTHS.map((m) => m.slice(0, 3).toLowerCase());

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function fromISO(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
const addDays = (iso: string, days: number) => {
  const d = fromISO(iso)!;
  d.setDate(d.getDate() + days);
  return toISO(d);
};
const addMonths = (iso: string, months: number) => {
  const d = fromISO(iso)!;
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
};

/** Parse a typed date. Returns "YYYY-MM-DD" or null. Day-first, like Kuwait. */
export function parseDateInput(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  if (!t) return null;
  let y: number, m: number, d: number;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/.exec(t))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[- ]([a-z]{3,})[- ](\d{4})$/.exec(t))) {
    [d, m, y] = [Number(match[1]), MONTH_ABBR.indexOf(match[2].slice(0, 3)) + 1, Number(match[3])];
  } else if ((match = /^([a-z]{3,}) (\d{1,2}) (\d{4})$/.exec(t))) {
    [d, m, y] = [Number(match[2]), MONTH_ABBR.indexOf(match[1].slice(0, 3)) + 1, Number(match[3])];
  } else return null;
  const date = new Date(y, m - 1, d);
  return m >= 1 && date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
    ? toISO(date)
    : null;
}

const POP_WIDTH = 304;
const GAP = 6;
const MARGIN = 8;

export function DatePicker({
  value,
  onChange,
  label,
  min,
  allowClear = false,
  placeholder = "Select a date",
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  /** Earliest selectable date (YYYY-MM-DD). */
  min?: string;
  allowClear?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const popId = `${id}-calendar`;
  const inputRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const editing = useRef(false);
  const [text, setText] = useState(value ? formatDate(value) : "");
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [cursor, setCursor] = useState(value || today());
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const todayIso = today();

  useEffect(() => {
    if (!editing.current) setText(value ? formatDate(value) : "");
  }, [value]);

  const isDisabled = (iso: string) => !!min && iso < min;

  const openPicker = () => {
    if (open && !closing) return;
    setCursor(value || (min && todayIso < min ? min : todayIso));
    setClosing(false);
    setOpen(true);
  };
  const closePicker = () => {
    if (!open || closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 120);
  };
  const select = (iso: string) => {
    if (isDisabled(iso)) return;
    onChange(iso);
    editing.current = false;
    setText(formatDate(iso));
    closePicker();
  };

  // Position the popover against the field, flipping above when there is no
  // room below, and keep it inside the viewport horizontally.
  const scrolledForRoom = useRef(false);
  useLayoutEffect(() => {
    if (!open) {
      scrolledForRoom.current = false;
      return;
    }
    const place = () => {
      const field = inputRef.current?.getBoundingClientRect();
      const pop = popRef.current;
      if (!field || !pop) return;
      const vw = document.documentElement.clientWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const width = Math.min(POP_WIDTH, vw - MARGIN * 2);
      const height = pop.offsetHeight;
      const below = vh - field.bottom - GAP - MARGIN;
      const above = field.top - GAP - MARGIN;
      // Small screens: if the calendar fits neither below nor above, scroll the
      // field up (CSS scroll-margin keeps it clear of the header) instead of
      // covering it; the scroll listener then re-places the popover.
      if (below < height && above < height && !scrolledForRoom.current) {
        scrolledForRoom.current = true;
        inputRef.current?.scrollIntoView({ block: "start" });
        requestAnimationFrame(place); // in case the page could not scroll
        return;
      }
      const showAbove = below < height && above > below;
      const top = showAbove
        ? Math.max(MARGIN, field.top - GAP - height)
        : Math.min(field.bottom + GAP, Math.max(MARGIN, vh - height - MARGIN));
      const left = Math.min(Math.max(MARGIN, field.left), vw - width - MARGIN);
      setPos({ top, left, above: showAbove });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
    };
  }, [open, cursor]);

  // Close on outside press.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target) || inputRef.current?.parentElement?.contains(target))
        return;
      commitText();
      closePicker();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  });

  /** Apply typed text: valid (and not before min) dates are kept, else revert. */
  const commitText = () => {
    if (!editing.current) return;
    editing.current = false;
    const parsed = parseDateInput(text);
    if (!text.trim() && allowClear) {
      onChange("");
      setText("");
    } else if (parsed && !isDisabled(parsed)) {
      onChange(parsed);
      setText(formatDate(parsed));
    } else {
      setText(value ? formatDate(value) : "");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || (e.key === "Enter" && !editing.current)) {
        e.preventDefault();
        openPicker();
      } else if (e.key === "Enter") {
        commitText();
      }
      return;
    }
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      PageUp: () => addMonths(cursor, -1),
      PageDown: () => addMonths(cursor, 1),
      Home: () => addDays(cursor, -fromISO(cursor)!.getDay()),
      End: () => addDays(cursor, 6 - fromISO(cursor)!.getDay()),
    };
    if (moves[e.key] && !editing.current) {
      e.preventDefault();
      setCursor(moves[e.key]());
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (editing.current) {
        commitText();
        closePicker();
      } else select(cursor);
    } else if (e.key === "Escape") {
      e.preventDefault();
      commitText();
      closePicker();
    } else if (e.key === "Tab") {
      commitText();
      closePicker();
    }
  };

  // Build the 6-week grid for the cursor's month (weeks start on Sunday).
  const cursorDate = fromISO(cursor)!;
  const first = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  const monthLabel = `${MONTHS[cursorDate.getMonth()]} ${cursorDate.getFullYear()}`;

  return (
    <div className={`date-field ${open && !closing ? "is-open" : ""}`}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        aria-activedescendant={open ? `${popId}-${cursor}` : undefined}
        autoComplete="off"
        inputMode={coarse ? "none" : "text"}
        placeholder={placeholder}
        value={text}
        onClick={openPicker}
        onFocus={() => coarse && openPicker()}
        onChange={(e) => {
          editing.current = true;
          setText(e.target.value);
        }}
        onBlur={() => {
          if (!open) commitText();
        }}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="date-toggle"
        tabIndex={-1}
        aria-label={`Open calendar for ${label}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (open && !closing) closePicker();
          else {
            inputRef.current?.focus();
            openPicker();
          }
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            id={popId}
            role="dialog"
            aria-label={`${label} calendar`}
            className={`datepicker-pop ${closing ? "closing" : ""} ${pos?.above ? "above" : ""}`}
            style={{
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: `min(${POP_WIDTH}px, calc(100vw - ${MARGIN * 2}px))`,
            }}
            // Keep focus in the input so keyboard navigation keeps working.
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="dp-header">
              <button type="button" className="dp-nav" aria-label="Previous month" onClick={() => setCursor(addMonths(cursor, -1))}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <strong aria-live="polite">{monthLabel}</strong>
              <button type="button" className="dp-nav" aria-label="Next month" onClick={() => setCursor(addMonths(cursor, 1))}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>
            <div className="dp-grid" role="grid" aria-label={monthLabel}>
              {WEEKDAYS.map((w) => (
                <span key={w} className="dp-weekday" role="columnheader">
                  {w}
                </span>
              ))}
              {days.map((d) => {
                const iso = toISO(d);
                const outside = d.getMonth() !== cursorDate.getMonth();
                const disabled = isDisabled(iso);
                const classes = [
                  "dp-day",
                  outside && "outside",
                  iso === todayIso && "today",
                  iso === value && "selected",
                  iso === cursor && "focused",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button
                    key={iso}
                    id={`${popId}-${iso}`}
                    type="button"
                    role="gridcell"
                    tabIndex={-1}
                    className={classes}
                    disabled={disabled}
                    aria-selected={iso === value}
                    aria-label={formatDate(iso)}
                    onClick={() => select(iso)}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="dp-footer">
              <button type="button" className="dp-link" disabled={isDisabled(todayIso)} onClick={() => select(todayIso)}>
                Today
              </button>
              {allowClear && value && (
                <button
                  type="button"
                  className="dp-link muted"
                  onClick={() => {
                    onChange("");
                    setText("");
                    closePicker();
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
