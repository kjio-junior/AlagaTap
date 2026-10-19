// js/state.js — State management with localStorage persistence

export const STORAGE_KEY = 'alagaTapData';

// Default demo data — one medication per slot (every day)
const defaultState = {
    theme: 'light',
    textSize: 16,
    language: 'en',
    browserNotificationsEnabled: false,
    emailRemindersEnabled: false,
    soundEnabled: true,
    medications: [
        {
            id: 'med_1',
            name: 'Amlodipine',
            dosage: '5mg, 1 tablet',
            notes: 'Take with breakfast',
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
            notes: '',
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
            notes: 'Avoid grapefruit',
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
    lastResetDate: null,
    scheduleFrequency: 'daily'
};

export function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.medications)) {
                parsed.medications.forEach(function (m) {
                    if (!m.compartment) {
                        if (!Array.isArray(m.days)) m.days = [0, 1, 2, 3, 4, 5, 6];
                        if (!m.slot) m.slot = 'morning';
                        if (!m.time) m.time = '08:00';
                    }
                    if (typeof m.notes !== 'string') m.notes = '';
                });
            }
            if (typeof parsed.browserNotificationsEnabled !== 'boolean') {
                parsed.browserNotificationsEnabled = parsed.notificationsEnabled === true;
            }
            if (typeof parsed.emailRemindersEnabled !== 'boolean') {
                parsed.emailRemindersEnabled = !!localStorage.getItem('notificationEmail');
            }
            if (typeof parsed.soundEnabled !== 'boolean') {
                parsed.soundEnabled = true;
            }
            // Migrate old string-based text sizes
            if (parsed.textSize === 'normal') parsed.textSize = 16;
            if (parsed.textSize === 'large') parsed.textSize = 20;
            if (typeof parsed.textSize !== 'number') parsed.textSize = 16;
            if (!parsed.language) parsed.language = 'en';
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