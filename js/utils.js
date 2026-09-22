// js/utils.js — Utility functions

// ---- Day / Slot constants ------------------------------------------------
export const DAY_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_FULL   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_COLORS = ['#EF4444', '#EC4899', '#F97316', '#EAB308', '#22C55E', '#38BDF8', '#1E40AF'];

export const SLOT_ORDER  = ['morning', 'noon', 'night'];
export const SLOT_LABELS = { morning: 'Morning', noon: 'Noon', night: 'Night' };
export const SLOT_DEFAULT_TIME = { morning: '08:00', noon: '12:30', night: '21:00' };

// ---- Basic formatters ----------------------------------------------------
export function formatTime(hhmm) {
    // "08:00" → "8:00 AM"
    if (!hhmm) return '--';
    const parts = hhmm.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr12 = h % 12 === 0 ? 12 : h % 12;
    return hr12 + ':' + m + ' ' + ampm;
}

export function formatDateTime(isoString) {
    if (!isoString) return '--';
    const d = new Date(isoString);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
        ' at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

export function getTodayDay() {
    return new Date().getDay(); // 0 = Sunday
}

// ---- Medication helpers --------------------------------------------------
export function isMedOnDay(med, dayIndex) {
    return Array.isArray(med.days) && med.days.includes(dayIndex);
}

export function isMedToday(med) {
    return isMedOnDay(med, getTodayDay());
}

export function getScheduleMinutesFromTime(timeStr) {
    const parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
}

export function getMedScheduleDate(med) {
    // Returns a Date for today at med.time
    const [h, m] = (med.time || '08:00').split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
}

export function isOverdue(med) {
    if (!isMedToday(med)) return false;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const scheduleMin = getScheduleMinutesFromTime(med.time);
    return nowMin > scheduleMin + 30;
}

// ---- Label helpers -------------------------------------------------------
export function getDaysLabel(med) {
    if (!Array.isArray(med.days) || med.days.length === 0) return 'No days';
    if (med.days.length === 7) return 'Every day';
    if (med.days.length === 5 &&
        [1, 2, 3, 4, 5].every(function (d) { return med.days.includes(d); })) {
        return 'Weekdays';
    }
    if (med.days.length === 2 &&
        med.days.includes(0) && med.days.includes(6)) {
        return 'Weekends';
    }
    return med.days.slice().sort(function (a, b) { return a - b; })
        .map(function (d) { return DAY_SHORT[d]; }).join(', ');
}

export function getSlotLabel(slot) {
    return SLOT_LABELS[slot] || 'Slot';
}

// ---- Status (hero card) --------------------------------------------------
export function getStatusText(state) {
    const todayStr = getTodayStr();
    const todayMeds = state.medications.filter(isMedToday);
    const todayLogs = state.logs.filter(function (l) {
        return l.timestamp.startsWith(todayStr);
    });

    if (todayMeds.length === 0) {
        return { text: 'No doses scheduled today', status: 'pending' };
    }

    const allLogged = todayMeds.every(function (med) {
        return todayLogs.some(function (l) { return l.medicationId === med.id; });
    });

    if (allLogged) {
        return { text: "All Today's Doses Logged", status: 'logged' };
    }

    const hasOverdue = todayMeds.some(function (med) {
        return isOverdue(med) && !todayLogs.some(function (l) {
            return l.medicationId === med.id;
        });
    });

    if (hasOverdue) return { text: 'Dose Overdue', status: 'overdue' };
    if (todayLogs.length > 0) return { text: 'Some Doses Pending', status: 'pending' };
    return { text: 'Dose Pending', status: 'pending' };
}

export function getLastDoseTime(state) {
    if (state.logs.length === 0) return null;
    const sorted = state.logs.slice().sort(function (a, b) {
        return new Date(b.timestamp) - new Date(a.timestamp);
    });
    return sorted[0].timestamp;
}

// ---- Adherence -----------------------------------------------------------
export function getAdherenceStats(state, dateRange = 7) {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - dateRange);

    const relevantLogs = state.logs.filter(function (l) {
        return new Date(l.timestamp) >= cutoff;
    });

    // Total scheduled = for each medication, number of its days per week
    // proportional to the date range (7 days = full week).
    let totalScheduled = 0;
    state.medications.forEach(function (med) {
        const daysCount = Array.isArray(med.days) ? med.days.length : 0;
        totalScheduled += Math.round((daysCount / 7) * dateRange);
    });

    const totalReported = relevantLogs.length;

    return {
        totalScheduled,
        totalReported,
        adherenceRate: totalScheduled > 0
            ? Math.round((totalReported / totalScheduled) * 100)
            : 0
    };
}

export function getLogsForSummary(state) {
    return state.logs.slice()
        .sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); })
        .slice(0, 50);
}