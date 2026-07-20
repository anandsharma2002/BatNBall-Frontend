import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n) => String(n).padStart(2, '0');

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const parseValue = (val) => {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const formatDisplay = (date) => {
  if (!date) return '';
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toLocalIso = (date) => {
  if (!date) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// ─── DateTimePicker Component ─────────────────────────────────────────────────
const DateTimePicker = ({ value, onChange, required }) => {
  const selectedDate = parseValue(value);

  const today = new Date();
  const [viewYear, setViewYear] = useState(selectedDate ? selectedDate.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate ? selectedDate.getMonth() : today.getMonth());
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('date');

  const [hour, setHour] = useState(selectedDate ? selectedDate.getHours() : today.getHours());
  const [minute, setMinute] = useState(selectedDate ? selectedDate.getMinutes() : today.getMinutes());

  const containerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (selectedDate) {
      setHour(selectedDate.getHours());
      setMinute(selectedDate.getMinutes());
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }, [value]);

  const emit = (day, h = hour, m = minute) => {
    const d = new Date(viewYear, viewMonth, day, h, m);
    onChange(toLocalIso(d));
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const isSelected = (day) => {
    if (!selectedDate) return false;
    return selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day;
  };

  const isToday = (day) => {
    return today.getFullYear() === viewYear &&
      today.getMonth() === viewMonth &&
      today.getDate() === day;
  };

  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const daysInPrevMonth = getDaysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1);

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, outside: false });
  }
  const remaining = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, outside: true });
  }

  const handleHourChange = (newHour) => {
    setHour(newHour);
    if (selectedDate) {
      onChange(toLocalIso(new Date(viewYear, viewMonth, selectedDate.getDate(), newHour, minute)));
    }
  };

  const handleMinuteChange = (newMin) => {
    setMinute(newMin);
    if (selectedDate) {
      onChange(toLocalIso(new Date(viewYear, viewMonth, selectedDate.getDate(), hour, newMin)));
    }
  };

  const dayStyle = (day, outside) => ({
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: isSelected(day) && !outside ? '800' : '500',
    cursor: outside ? 'default' : 'pointer',
    color: outside
      ? 'var(--text-muted)'
      : isSelected(day)
        ? '#fff'
        : isToday(day)
          ? 'var(--accent-color)'
          : 'var(--text-color)',
    background: isSelected(day) && !outside ? 'var(--secondary-color)' : 'transparent',
    border: isToday(day) && !isSelected(day) && !outside ? '1.5px solid var(--accent-color)' : 'none',
    transition: 'background 0.15s',
  });

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.7rem 0.9rem',
          border: `1px solid ${open ? 'var(--accent-color)' : 'var(--border-color)'}`,
          borderRadius: '8px', background: 'var(--input-bg)',
          cursor: 'pointer', fontSize: '0.9rem',
          color: selectedDate ? 'var(--text-color)' : 'var(--text-muted)',
          transition: 'border-color 0.2s',
          boxShadow: open ? '0 0 0 3px rgba(198,165,103,0.18)' : 'none',
        }}
      >
        <Calendar size={15} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
        <span style={{ flex: 1 }}>
          {selectedDate ? formatDisplay(selectedDate) : 'Select date & time...'}
        </span>
        <Clock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>

      {/* Hidden for form validation */}
      <input
        type="datetime-local" value={value || ''} onChange={() => {}}
        required={required}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        tabIndex={-1}
      />

      {/* Popup */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 500,
          background: 'var(--dominant-color)', border: '1px solid var(--border-color)',
          borderRadius: '14px', boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          width: '290px', overflow: 'hidden', animation: 'fadeIn 0.12s ease',
        }}>

          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
            {[{ key: 'date', icon: <Calendar size={13} />, label: 'Date' },
              { key: 'time', icon: <Clock size={13} />, label: 'Time' }].map(t => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{
                flex: 1, padding: '0.6rem', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: '700',
                color: tab === t.key ? 'var(--accent-color)' : 'var(--text-muted)',
                background: 'none', border: 'none',
                borderBottom: tab === t.key ? '2px solid var(--accent-color)' : '2px solid transparent',
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px',
                marginBottom: '-1px', transition: 'all 0.15s',
              }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* ── Date tab ── */}
          {tab === 'date' && (
            <div style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                <button type="button" onClick={prevMonth} style={{
                  background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '6px',
                  padding: '0.3rem', cursor: 'pointer', color: 'var(--text-color)', display: 'flex', alignItems: 'center'
                }}><ChevronLeft size={15} /></button>
                <span style={{ fontWeight: '800', fontSize: '0.88rem', color: 'var(--text-color)' }}>
                  {MONTHS[viewMonth]} {viewYear}
                </span>
                <button type="button" onClick={nextMonth} style={{
                  background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '6px',
                  padding: '0.3rem', cursor: 'pointer', color: 'var(--text-color)', display: 'flex', alignItems: 'center'
                }}><ChevronRight size={15} /></button>
              </div>

              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: '0.2rem' }}>
                {DAYS.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)', padding: '0.15rem 0' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '1px' }}>
                {cells.map((cell, idx) => (
                  <div
                    key={idx}
                    onClick={() => !cell.outside && emit(cell.day)}
                    style={dayStyle(cell.day, cell.outside)}
                    onMouseEnter={e => { if (!cell.outside && !isSelected(cell.day)) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={e => { if (!cell.outside && !isSelected(cell.day)) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {cell.day}
                  </div>
                ))}
              </div>

              {/* Quick actions row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={() => onChange('')} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Clear</button>
                <button type="button" onClick={() => {
                  const now = new Date();
                  setViewYear(now.getFullYear()); setViewMonth(now.getMonth());
                  setHour(now.getHours()); setMinute(now.getMinutes());
                  onChange(toLocalIso(now));
                }} style={{ fontSize: '0.75rem', color: 'var(--accent-color)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '700' }}>Now</button>
              </div>
            </div>
          )}

          {/* ── Time tab ── */}
          {tab === 'time' && (
            <div style={{ padding: '1.1rem 1rem' }}>
              <div style={{ textAlign: 'center', fontSize: '2.8rem', fontWeight: '900', letterSpacing: '0.08em', marginBottom: '1.1rem' }}>
                <span style={{ color: 'var(--secondary-color)' }}>{pad(hour)}</span>
                <span style={{ color: 'var(--border-color)' }}>:</span>
                <span style={{ color: 'var(--accent-color)' }}>{pad(minute)}</span>
              </div>

              <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Hour — {pad(hour)}
              </label>
              <input type="range" min={0} max={23} value={hour} onChange={e => handleHourChange(Number(e.target.value))}
                style={{ width: '100%', margin: '0.35rem 0 0.85rem', accentColor: 'var(--secondary-color)', cursor: 'pointer' }} />

              <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Minute — {pad(minute)}
              </label>
              <input type="range" min={0} max={59} value={minute} onChange={e => handleMinuteChange(Number(e.target.value))}
                style={{ width: '100%', margin: '0.35rem 0 0', accentColor: 'var(--accent-color)', cursor: 'pointer' }} />

              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.9rem', justifyContent: 'center' }}>
                {[0, 15, 30, 45].map(m => (
                  <button key={m} type="button" onClick={() => handleMinuteChange(m)} style={{
                    padding: '0.28rem 0.55rem', borderRadius: '6px', fontSize: '0.76rem', fontWeight: '700',
                    border: '1px solid var(--border-color)',
                    background: minute === m ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)',
                    color: minute === m ? 'var(--dominant-color)' : 'var(--text-color)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>:{pad(m)}</button>
                ))}
              </div>

              <button type="button" onClick={() => setOpen(false)} style={{
                width: '100%', marginTop: '1rem', padding: '0.6rem',
                background: 'var(--secondary-color)', color: '#fff', border: 'none',
                borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer',
              }}>
                Done ✓
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DateTimePicker;
