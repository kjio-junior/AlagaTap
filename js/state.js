// js/state.js - State management with localStorage persistence
export const STORAGE_KEY = 'alagaTapData';

const defaultState = {
    theme: 'light',
    medications: [
        {
            id: 'med_1',
            name: 'Amlodipine',
            dosage: '5mg, 1 tablet',
            compartment: 'A',
            schedule: new Date(new Date().setHours(8, 0, 0, 0)).toISOString(),
            inventory: 12,
            maxInventory: 14,
            createdAt: new Date().toISOString()
        },
        {
            id: 'med_2',
            name: 'Metformin',
            dosage: '500mg, 1 tablet',
            compartment: 'B',
            schedule: new Date(new Date().setHours(12, 30, 0, 0)).toISOString(),
            inventory: 10,
            maxInventory: 14,
            createdAt: new Date().toISOString()
        },
        {
            id: 'med_3',
            name: 'Atorvastatin',
            dosage: '20mg, 1 tablet',
            compartment: 'C',
            schedule: new Date(new Date().setHours(21, 0, 0, 0)).toISOString(),
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
            return { ...defaultState, ...parsed };
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