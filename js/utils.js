// js/utils.js - Utility functions
export function formatTime(isoString) {
    if (!isoString) return '--';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(isoString) {
    if (!isoString) return '--';
    const d = new Date(isoString);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatDateTime(isoString) {
    if (!isoString) return '--';
    return `${formatDate(isoString)} at ${formatTime(isoString)}`;
}

export function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

export function getCurrentMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

export function getScheduleMinutes(scheduleStr) {
    const d = new Date(scheduleStr);
    return d.getHours() * 60 + d.getMinutes();
}

export function isOverdue(scheduleStr) {
    const now = new Date();
    const schedule = new Date(scheduleStr);
    const today = getTodayStr();
    const scheduleDate = schedule.toISOString().split('T')[0];
    if (scheduleDate !== today) return false;
    
    const nowMin = getCurrentMinutes();
    const scheduleMin = getScheduleMinutes(scheduleStr);
    return nowMin > scheduleMin + 30;
}

export function getCompartmentLabel(compartment) {
    const labels = {
        'A': 'Morning',
        'B': 'Noon',
        'C': 'Night',
        'D': 'Custom'
    };
    return labels[compartment] || compartment;
}

export function getStatusText(state) {
    const today = getTodayStr();
    const todayLogs = state.logs.filter(l => l.timestamp.startsWith(today));
    
    if (todayLogs.length === 0) {
        return { text: 'Dose Pending', status: 'pending' };
    }
    
    const allLogged = state.medications.every(med => 
        todayLogs.some(l => l.medicationId === med.id)
    );
    
    if (allLogged) {
        return { text: 'All Scheduled Doses Logged', status: 'logged' };
    }
    
    const hasOverdue = state.medications.some(med => 
        isOverdue(med.schedule) && 
        !todayLogs.some(l => l.medicationId === med.id)
    );
    
    if (hasOverdue) {
        return { text: 'Dose Overdue', status: 'overdue' };
    }
    
    return { text: 'Some Doses Pending', status: 'pending' };
}

export function getLastDoseTime(state) {
    if (state.logs.length === 0) return null;
    const sorted = [...state.logs].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    return sorted[0].timestamp;
}

export function getAdherenceStats(state, dateRange = 7) {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - dateRange);
    
    const relevantLogs = state.logs.filter(l => 
        new Date(l.timestamp) >= cutoff
    );
    
    const totalScheduled = state.medications.length * dateRange;
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
    return [...state.logs]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 50);
}