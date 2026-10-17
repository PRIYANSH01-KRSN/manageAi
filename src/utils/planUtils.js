// Client-side helpers: calendar export, forgiving streaks, check-in mode suggestions.
import { toDateKey } from '../services/plannerEngine';

/* ---------------- Calendar (.ics) export ---------------- */

function icsDate(dateKey, minutes) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setMinutes(d.getMinutes() + minutes);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

const icsEscape = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function buildIcs(plan) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ChronosFlow//Study Plan//EN', 'CALSCALE:GREGORIAN'];
  const stamp = icsDate(toDateKey(new Date()), new Date().getHours() * 60 + new Date().getMinutes());
  plan.days.forEach((day) => {
    day.sessions.forEach((s) => {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${s.id}@chronosflow`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsDate(day.dateKey, s.startMin)}`,
        `DTEND:${icsDate(day.dateKey, s.endMin)}`,
        `SUMMARY:${icsEscape(s.taskTitle)}`,
        `DESCRIPTION:${icsEscape(`Start: ${s.coaching?.starter || ''}\n${s.reason || ''}`)}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT5M',
        'ACTION:DISPLAY',
        `DESCRIPTION:${icsEscape(s.taskTitle)}`,
        'END:VALARM',
        'END:VEVENT'
      );
    });
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcs(plan) {
  const blob = new Blob([buildIcs(plan)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `study-plan-${toDateKey(new Date())}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------- Forgiving day streak ---------------- */

// Counts study *days*, not sessions. One missed day per week is forgiven with a "freeze".
export function advanceStreak(streak, today = new Date()) {
  const s = { count: 0, lastDate: null, freezeWeek: null, ...(streak || {}) };
  const todayKey = toDateKey(today);
  if (s.lastDate === todayKey) return s;

  const weekKey = `${today.getFullYear()}-${Math.floor((today - new Date(today.getFullYear(), 0, 1)) / (7 * 86400000))}`;
  const daysSince = s.lastDate ? Math.round((new Date(`${todayKey}T00:00:00`) - new Date(`${s.lastDate}T00:00:00`)) / 86400000) : null;

  if (daysSince === 1) {
    s.count += 1;
  } else if (daysSince === 2 && s.freezeWeek !== weekKey) {
    s.count += 1;
    s.freezeWeek = weekKey; // forgiven gap
    s.usedFreeze = true;
  } else {
    s.count = 1;
  }
  s.lastDate = todayKey;
  return s;
}

export function currentStreakCount(streak, today = new Date()) {
  if (!streak?.lastDate) return 0;
  const days = Math.round((new Date(`${toDateKey(today)}T00:00:00`) - new Date(`${streak.lastDate}T00:00:00`)) / 86400000);
  return days <= 2 ? streak.count : 0;
}

/* ---------------- Check-in → day mode ---------------- */

export function suggestDayMode({ mood = 3, energy = 3, sleepQuality = 3, stress = 3 }) {
  const low = [mood, energy, sleepQuality].filter((v) => v <= 2).length;
  if ((mood <= 1 && energy <= 2) || (energy <= 1 && sleepQuality <= 1) || low === 3) return 'RECOVERY';
  if (low >= 1 || stress >= 5) return 'LIGHT';
  return 'FULL';
}

// Gentle support prompt when mood has been very low for several days in a row.
export function needsSupportNudge(checkins = {}) {
  const recent = Object.entries(checkins)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 3)
    .map(([, c]) => c.mood || 3);
  return recent.length >= 3 && recent.every((m) => m <= 2);
}
