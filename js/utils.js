// js/utils.js

export const DAY_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_FULL   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_COLORS = ['#EF4444', '#EC4899', '#F97316', '#EAB308', '#22C55E', '#38BDF8', '#1E40AF'];
export const SLOT_ORDER = ['morning', 'noon', 'night'];
export const SLOT_LABELS = { morning: 'Morning', noon: 'Noon', night: 'Night' };
export const SLOT_DEFAULT_TIME = { morning: '08:00', noon: '12:30', night: '21:00' };

// ---------- Dates (always local, never UTC) ----------
export function localDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
}

export function getTodayStr() {
    return localDateStr(new Date());
}

export function getTodayDay() {
    return new Date().getDay();
}

// Returns ['2026-09-21' (Sun), '2026-09-22' (Mon), ... '2026-09-27' (Sat)]
export function getDatesOfThisWeek() {
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    sunday.setHours(0, 0, 0, 0);
    const out = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(sunday);
        d.setDate(sunday.getDate() + i);
        out.push(localDateStr(d));
    }
    return out;
}

// ---------- Formatting ----------
export function formatTime(hhmm) {
    if (!hhmm) return '--';
    const [h, m] = hhmm.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr12 = h % 12 === 0 ? 12 : h % 12;
    return hr12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}

export function formatDateTime(isoString) {
    if (!isoString) return '--';
    const d = new Date(isoString);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
        ' at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateShort(dateStr) {
    if (!dateStr) return '--';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ---------- Medication helpers ----------
export function isMedOnDay(med, dayIndex) {
    return Array.isArray(med.days) && med.days.includes(dayIndex);
}

export function isMedToday(med) {
    return isMedOnDay(med, getTodayDay());
}

export function getScheduleMinutesFromTime(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
}

export function isOverdue(med) {
    if (!isMedToday(med)) return false;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return nowMin > getScheduleMinutesFromTime(med.time) + 30;
}

export function getSlotLabel(slot) {
    return SLOT_LABELS[slot] || 'Slot';
}

export function getDaysLabel(med) {
    if (!Array.isArray(med.days) || med.days.length === 0) return 'No days';
    if (med.days.length === 7) return 'Every day';
    if (med.days.length === 5 && [1,2,3,4,5].every(d => med.days.includes(d))) return 'Weekdays';
    if (med.days.length === 2 && med.days.includes(0) && med.days.includes(6)) return 'Weekends';
    return med.days.slice().sort((a,b) => a-b).map(d => DAY_SHORT[d]).join(', ');
}

// ================= LOG INDEX (the fix) =================
// A dose's identity is (medicationId, date). We build a Set for O(1) lookups.
export function buildLogIndex(logs) {
    const set = new Set();
    (logs || []).forEach(l => {
        if (l.medicationId && l.date) set.add(l.medicationId + '|' + l.date);
    });
    return set;
}

export function isLogged(logIndex, medId, date) {
    return logIndex.has(medId + '|' + date);
}

// ---------- Status (hero card) ----------
export function getStatusText(state) {
    const todayStr = getTodayStr();
    const todayMeds = state.medications.filter(isMedToday);

    if (todayMeds.length === 0) {
        return { text: 'No doses scheduled today', status: 'pending' };
    }

    const map = buildLogStatusMap(state.logs);
    const recorded = todayMeds.filter(m => map.has(m.id + '|' + todayStr));

    if (recorded.length === todayMeds.length) {
        const anyMissed = recorded.some(m => map.get(m.id + '|' + todayStr) === 'missed');
        return anyMissed
            ? { text: "All Today's Doses Recorded (some missed)", status: 'logged' }
            : { text: "All Today's Doses Taken", status: 'logged' };
    }

    const hasOverdue = todayMeds.some(m =>
        isOverdue(m) && !map.has(m.id + '|' + todayStr)
    );

    if (hasOverdue) return { text: 'Dose Overdue', status: 'overdue' };
    if (recorded.length > 0) {
        return { text: recorded.length + ' of ' + todayMeds.length + ' Recorded', status: 'pending' };
    }
    return { text: 'Dose Pending', status: 'pending' };
}

export function getLastDoseTime(state) {
    if (!state.logs || state.logs.length === 0) return null;
    const sorted = [...state.logs].sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    return sorted[0].timestamp;
}

// ---------- Adherence ----------
export function getAdherenceStats(state, days = 7) {
    let totalScheduled = 0;
    state.medications.forEach(med => {
        const perWeek = (med.days || []).length;
        totalScheduled += Math.round(perWeek * (days / 7));
    });

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = localDateStr(cutoff);

    const totalReported = (state.logs || []).filter(l => l.date >= cutoffStr).length;

    return {
        totalScheduled,
        totalReported,
        adherenceRate: totalScheduled > 0
            ? Math.round((totalReported / totalScheduled) * 100)
            : 0
    };
}

export function getLogsForSummary(state) {
    return [...(state.logs || [])]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 50);
}

// ---------- Status helpers ----------
export function getStatusLabel(status) {
    return status === 'missed' ? 'Missed' : 'Taken';
}

// Update buildLogIndex to also expose per-key status
// (leave the existing Set version — we add a Map alongside it)
export function buildLogStatusMap(logs) {
    const map = new Map();
    (logs || []).forEach(l => {
        if (l.medicationId && l.date) {
            map.set(l.medicationId + '|' + l.date, l.status || 'taken');
        }
    });
    return map;
}

export function getLogStatus(map, medId, date) {
    return map.get(medId + '|' + date) || null; // 'taken' | 'missed' | null
}