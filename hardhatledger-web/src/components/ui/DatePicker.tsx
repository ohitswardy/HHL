import { useState, useRef, useEffect, useCallback, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { HiCalendar, HiChevronLeft, HiChevronRight } from 'react-icons/hi';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplay(d: Date) {
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

function parseValue(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

interface DayCell {
  date: Date;
  day: number;
  otherMonth: boolean;
  today: boolean;
  disabled: boolean;
}

function buildCalendar(year: number, month: number, minDate?: Date, maxDate?: Date): DayCell[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);
  const prevMonthDays = daysInMonth(year, month - 1);
  const cells: DayCell[] = [];

  // Previous month fill
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthDays - i);
    cells.push({ date: d, day: prevMonthDays - i, otherMonth: true, today: false, disabled: isDisabled(d, minDate, maxDate) });
  }
  // Current month
  for (let i = 1; i <= totalDays; i++) {
    const d = new Date(year, month, i);
    cells.push({ date: d, day: i, otherMonth: false, today: isSameDay(d, today), disabled: isDisabled(d, minDate, maxDate) });
  }
  // Next month fill
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    cells.push({ date: d, day: i, otherMonth: true, today: false, disabled: isDisabled(d, minDate, maxDate) });
  }
  return cells;
}

function isDisabled(d: Date, minDate?: Date, maxDate?: Date) {
  if (minDate && d < minDate) return true;
  if (maxDate && d > maxDate) return true;
  return false;
}

/* ─── SINGLE DATE PICKER ──────────────────────────────────────────────── */

interface DatePickerProps {
  label?: string;
  error?: string;
  value?: string; // 'YYYY-MM-DD'
  onChange?: (e: { target: { value: string } }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inline?: boolean;
  min?: string;
  max?: string;
  name?: string;
  required?: boolean;
}

export function DatePicker({
  label,
  error,
  value,
  onChange,
  placeholder = 'Select date\u2026',
  disabled,
  className = '',
  inline = false,
  min,
  max,
  name,
}: DatePickerProps) {
  const parsed = parseValue(value);
  const today = new Date();
  const [isOpen, setIsOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const [openUpward, setOpenUpward] = useState(false);
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const minDate = useMemo(() => parseValue(min) ?? undefined, [min]);
  const maxDate = useMemo(() => parseValue(max) ?? undefined, [max]);
  const cells = useMemo(() => buildCalendar(viewYear, viewMonth, minDate, maxDate), [viewYear, viewMonth, minDate, maxDate]);

  // Sync view when value changes externally
  useEffect(() => {
    if (parsed) { setViewYear(parsed.getFullYear()); setViewMonth(parsed.getMonth()); }
  }, [value]);

  const computePanelStyle = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const GAP = 6;
    const panelWidth = Math.min(300, window.innerWidth - GAP * 2);
    const panelHeight = 360;
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const flyUp = spaceBelow < panelHeight && spaceAbove > spaceBelow;

    setOpenUpward(flyUp);

    const left = Math.min(
      Math.max(GAP, rect.left),
      Math.max(GAP, window.innerWidth - panelWidth - GAP),
    );

    if (flyUp) {
      setPanelStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top + GAP,
        left,
        width: panelWidth,
        zIndex: 1200,
      });
      return;
    }

    setPanelStyle({
      position: 'fixed',
      top: rect.bottom + GAP,
      left,
      width: panelWidth,
      zIndex: 1200,
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const panelEl = document.getElementById(`${id}-panel`);
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        !(panelEl && panelEl.contains(target))
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, id]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    const reposition = () => computePanelStyle();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen, computePanelStyle]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const selectDay = useCallback((cell: DayCell) => {
    if (cell.disabled) return;
    onChange?.({ target: { value: formatDate(cell.date) } });
    setIsOpen(false);
  }, [onChange]);

  const goToday = () => {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    onChange?.({ target: { value: formatDate(t) } });
    setIsOpen(false);
  };

  const clear = () => {
    onChange?.({ target: { value: '' } });
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setIsOpen(false);
    if ((e.key === 'Enter' || e.key === ' ') && !isOpen) {
      e.preventDefault();
      computePanelStyle();
      setIsOpen(true);
    }
  };

  const triggerId = `${id}-dp`;

  return (
    <div ref={containerRef} className={`w-full ${inline ? 'neu-datepicker-inline' : ''} ${className}`} style={{ position: 'relative' }}>
      {label && <label className="neu-label" htmlFor={triggerId}>{label}</label>}
      <div
        className={`neu-inset${error ? ' shadow-[inset_3px_3px_6px_var(--n-shadow-dark-sm),inset_-3px_-3px_6px_var(--n-shadow-light-sm),0_0_0_1.5px_var(--n-danger)]' : ''}`}
        style={{ position: 'relative' }}
      >
        <button
          type="button"
          id={triggerId}
          className={`neu-datepicker-trigger${!parsed ? ' placeholder' : ''}`}
          onClick={() => {
            if (disabled) return;
            if (!isOpen) computePanelStyle();
            setIsOpen((v) => !v);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={label || placeholder}
        >
          {parsed ? formatDisplay(parsed) : placeholder}
        </button>
        <HiCalendar className="neu-datepicker-icon" style={{ width: 16, height: 16 }} />
        {name && <input type="hidden" name={name} value={value ?? ''} />}
      </div>

      {isOpen && createPortal(
        <div
          id={`${id}-panel`}
          className={`neu-cal-panel${openUpward ? ' open-upward' : ''}`}
          role="dialog"
          aria-label="Date picker"
          style={panelStyle}
        >
          {/* Header */}
          <div className="neu-cal-header">
            <button type="button" onClick={prevMonth} aria-label="Previous month">
              <HiChevronLeft className="w-4 h-4" />
            </button>
            <span className="neu-cal-title">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} aria-label="Next month">
              <HiChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday labels */}
          <div className="neu-cal-weekdays">
            {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
          </div>

          {/* Day grid */}
          <div className="neu-cal-grid">
            {cells.map((cell, i) => {
              const isSelected = parsed ? isSameDay(cell.date, parsed) : false;
              return (
                <button
                  key={i}
                  type="button"
                  className={`neu-cal-day${isSelected ? ' selected' : ''}${cell.today ? ' today' : ''}${cell.otherMonth ? ' other-month' : ''}${cell.disabled ? ' disabled' : ''}`}
                  onClick={() => selectDay(cell)}
                  disabled={cell.disabled}
                  tabIndex={cell.otherMonth ? -1 : 0}
                  aria-label={formatDate(cell.date)}
                  aria-selected={isSelected}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="neu-cal-footer">
            <button type="button" onClick={clear}>Clear</button>
            <button type="button" className="today-btn" onClick={goToday}>Today</button>
          </div>
        </div>,
        document.body,
      )}

      {error && <p className="neu-error">{error}</p>}
    </div>
  );
}

/* ─── DATE RANGE PICKER ───────────────────────────────────────────────── */

interface DateRangePickerProps {
  label?: string;
  error?: string;
  valueFrom?: string;
  valueTo?: string;
  onChangeFrom?: (e: { target: { value: string } }) => void;
  onChangeTo?: (e: { target: { value: string } }) => void;
  placeholderFrom?: string;
  placeholderTo?: string;
  disabled?: boolean;
  className?: string;
  inline?: boolean;
  min?: string;
  max?: string;
}

export function DateRangePicker({
  label,
  error,
  valueFrom,
  valueTo,
  onChangeFrom,
  onChangeTo,
  placeholderFrom = 'From',
  placeholderTo = 'To',
  disabled,
  className = '',
  inline = false,
  min,
  max,
}: DateRangePickerProps) {
  return (
    <div className={className}>
      {label && <label className="neu-label">{label}</label>}
      <div className="flex gap-2">
        <DatePicker
          value={valueFrom}
          onChange={onChangeFrom}
          placeholder={placeholderFrom}
          disabled={disabled}
          inline={inline}
          min={min}
          max={valueTo || max}
        />
        <DatePicker
          value={valueTo}
          onChange={onChangeTo}
          placeholder={placeholderTo}
          disabled={disabled}
          inline={inline}
          min={valueFrom || min}
          max={max}
        />
      </div>
      {error && <p className="neu-error">{error}</p>}
    </div>
  );
}
