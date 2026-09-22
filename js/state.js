// js/state.js — State management with localStorage persistence

export const STORAGE_KEY = 'alagaTapData';

// Default demo data — one medication per slot (every day)
const defaultState = {
    theme: 'light',
    medications: [
        {
            id: 'med_1',
            name: 'Amlodipine',
            dosage: '5mg, 1 tablet',
            days: [0, 1, 2, 3, 4, 5, 6],   // every day
            slot: 'morning',
            time: '08:00',
            inventory: 12,
            maxInventory: 14,
            createdAt: new Date().toISOString()
        },
        {
            id: 'med_2',
            name: 'Metformin',
            dosage: '500mg, 1 tablet',
            days: [0, 1, 2, 3, 4, 5, 6],
            slot: 'noon',
            time: '12:30',
            inventory: 10,
            maxInventory: 14,
            createdAt: new Date().toISOString()
        },
        {
            id: 'med_3',
            name: 'Atorvastatin',
            dosage: '20mg, 1 tablet',
            days: [0, 1, 2, 3, 4, 5, 6],
            slot: 'night',
            time: '21:00',
            inventory: 8,
            maxInventory: 14,
            createdAt: new Date().toISOString()
        }
    ],
    logs: [],
    lastDoseTimestamp: null,
    cooldownUntil: null,
    caregiverShareCode: 'share_' + Math.random().toString(36).substring(2, 10),
    notificationsEnabled: false,
    lastResetDate: null,
    scheduleFrequency: 'daily'
};

export function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            // Migrate legacy compartment field if present
            if (Array.isArray(parsed.medications)) {
                parsed.medications = parsed.medications.map(function (m) {
                    // Old model had `compartment: 'A'|'B'|'C'` and `schedule` (ISO).
                    // If so, translate to new model (days + slot + time).
                    if (m.compartment && !m.slot) {
                        const map = { A: 'morning', B: 'noon', C: 'night' };
                        m.slot = map[m.compartment] || 'morning';
                        m.days = [0, 1, 2, 3, 4, 5, 6];
                        if (m.schedule) {
                            const d = new Date(m.schedule);
                            const hh = String(d.getHours()).padStart(2, '0');
                            const mm = String(d.getMinutes()).padStart(2, '0');
                            m.time = hh + ':' + mm;
                        } else {
                            m.time = '08:00';
                        }
                        delete m.compartment;
                        delete m.schedule;
                    }
                    // Safety: ensure days array exists
                    if (!Array.isArray(m.days)) m.days = [0, 1, 2, 3, 4, 5, 6];
                    if (!m.slot) m.slot = 'morning';
                    if (!m.time) m.time = '08:00';
                    return m;
                });
            }
            return Object.assign({}, defaultState, parsed);
        }
    } catch (e) {
        console.warn('Failed to load state, using defaults', e);
    }
    return JSON.parse(JSON.stringify(defaultState));
}

export function saveState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save state', e);
    }
}

export function generateId() {
    return 'med_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
}