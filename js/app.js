// js/app.js - Main application entry point
import { STORAGE_KEY, loadState, saveState, generateId } from './state.js';
import { 
    formatTime, formatDateTime, getTodayStr, isOverdue,
    getStatusText, getLastDoseTime, getCompartmentLabel,
    getAdherenceStats, getLogsForSummary 
} from './utils.js';
import { initNotifications } from './notifications.js';
import { ShareManager } from './share.js';
import {
    renderHero, renderCompartmentList, renderWarnings, 
    renderRefillAlert, renderHistory, renderSummary,
    renderShareLink, updateCooldown
} from './components.js';

// DOM Elements
const elements = {
    // Theme
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    
    // Hero
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    heroTimestamp: document.getElementById('heroTimestamp'),
    recordDoseBtn: document.getElementById('recordDoseBtn'),
    cooldownIndicator: document.getElementById('cooldownIndicator'),
    cooldownTimer: document.getElementById('cooldownTimer'),
    
    // Warnings
    warningBanner: document.getElementById('warningBanner'),
    warningText: document.getElementById('warningText'),
    refillAlert: document.getElementById('refillAlert'),
    refillMessage: document.getElementById('refillMessage'),
    
    // Compartments
    compartmentList: document.getElementById('compartmentList'),
    addMedicationBtn: document.getElementById('addMedicationBtn'),
    
    // History
    historyToggle: document.getElementById('historyToggle'),
    historyList: document.getElementById('historyList'),
    historyArrow: document.getElementById('historyArrow'),
    
    // Data
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFileInput: document.getElementById('importFileInput'),
    
    // Modals
    medicationModal: document.getElementById('medicationModal'),
    confirmModal: document.getElementById('confirmModal'),
    summaryModal: document.getElementById('summaryModal'),
    caregiverModal: document.getElementById('caregiverModal'),
    
    // Summary
    totalScheduled: document.getElementById('totalScheduled'),
    totalReported: document.getElementById('totalReported'),
    adherenceRate: document.getElementById('adherenceRate'),
    summaryHistory: document.getElementById('summaryHistory'),
    exportSummaryBtn: document.getElementById('exportSummaryBtn'),
    
    // Caregiver
    shareLink: document.getElementById('shareLink'),
    refreshShareLink: document.getElementById('refreshShareLink'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),
    shareHistoryBtn: document.getElementById('shareHistoryBtn'),
    qrCode: document.getElementById('qrCode'),
    
    // Confirm
    confirmDetails: document.getElementById('confirmDetails'),
    confirmLogBtn: document.getElementById('confirmLogBtn'),
    
    // Medication form
    modalTitle: document.getElementById('modalTitle'),
    editId: document.getElementById('editId'),
    medName: document.getElementById('medName'),
    medDosage: document.getElementById('medDosage'),
    medCompartment: document.getElementById('medCompartment'),
    medSchedule: document.getElementById('medSchedule'),
    medInventory: document.getElementById('medInventory'),
    medicationForm: document.getElementById('medicationForm'),
};

// State
let state = loadState();
let historyOpen = false;
let cooldownInterval = null;
let selectedMedId = null;

// Initialize Share Manager
const shareManager = new ShareManager(state, elements);

// Theme management
function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    saveState(state);
    updateThemeIcon();
}

function updateThemeIcon() {
    const isDark = state.theme === 'dark';
    elements.themeIcon.innerHTML = isDark 
        ? `<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />`
        : `<path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />`;
}

// Render all components
function renderAll() {
    renderHero(state, elements);
    renderCompartmentList(state, elements, {
        onLogDose: openConfirmModal,
        onEditMed: openEditModal,
        onDeleteMed: deleteMedication
    });
    renderWarnings(state, elements);
    renderRefillAlert(state, elements);
    renderHistory(state, elements, historyOpen);
    updateCooldown(state, elements);
}

// Medication CRUD
function addMedication(data) {
    const med = {
        id: generateId(),
        name: data.name.trim(),
        dosage: data.dosage.trim(),
        compartment: data.compartment,
        schedule: data.schedule,
        inventory: parseInt(data.inventory) || 14,
        maxInventory: parseInt(data.inventory) || 14,
        createdAt: new Date().toISOString()
    };
    state.medications.push(med);
    saveState(state);
    renderAll();
}

function updateMedication(id, data) {
    const med = state.medications.find(m => m.id === id);
    if (!med) return;
    
    med.name = data.name.trim();
    med.dosage = data.dosage.trim();
    med.compartment = data.compartment;
    med.schedule = data.schedule;
    med.inventory = parseInt(data.inventory) || med.inventory;
    med.maxInventory = parseInt(data.inventory) || med.maxInventory;
    
    saveState(state);
    renderAll();
}

function deleteMedication(id) {
    state.medications = state.medications.filter(m => m.id !== id);
    state.logs = state.logs.filter(l => l.medicationId !== id);
    saveState(state);
    renderAll();
}

// Dose logging
function logDose(medId) {
    const med = state.medications.find(m => m.id === medId);
    if (!med) return;
    
    // Check cooldown
    if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
        return;
    }
    
    // Check inventory
    if (med.inventory <= 0) {
        alert('No doses remaining. Please refill this medication.');
        return;
    }
    
    // Decrement inventory
    med.inventory = Math.max(0, med.inventory - 1);
    
    // Add log
    state.logs.push({
        timestamp: new Date().toISOString(),
        medicationId: med.id,
        compartment: med.compartment,
        doseType: 'Self-Reported'
    });
    
    state.lastDoseTimestamp = new Date().toISOString();
    
    // Set cooldown (5 minutes)
    state.cooldownUntil = Date.now() + 5 * 60 * 1000;
    
    saveState(state);
    renderAll();
    startCooldownTimer();
    closeModal(elements.confirmModal);
}

// Cooldown timer
function startCooldownTimer() {
    if (cooldownInterval) clearInterval(cooldownInterval);
    cooldownInterval = setInterval(() => {
        updateCooldown(state, elements);
        if (state.cooldownUntil && Date.now() > state.cooldownUntil) {
            clearInterval(cooldownInterval);
            cooldownInterval = null;
            updateCooldown(state, elements);
        }
    }, 500);
}

// Midnight reset
function checkMidnightReset() {
    const today = getTodayStr();
    if (state.lastResetDate !== today) {
        // Ask user about medication frequency
        const frequency = prompt(
            'How often is your medication taken?\nEnter: daily, weekly, or monthly',
            state.scheduleFrequency || 'daily'
        );
        if (frequency && ['daily', 'weekly', 'monthly'].includes(frequency.toLowerCase())) {
            state.scheduleFrequency = frequency.toLowerCase();
        }
        state.lastResetDate = today;
        saveState(state);
        renderAll();
    }
}

// Modal functions
function openModal(modal) {
    modal.classList.remove('hidden');
}

function closeModal(modal) {
    modal.classList.add('hidden');
}

function openConfirmModal(medId) {
    const med = state.medications.find(m => m.id === medId);
    if (!med) return;
    
    // Check cooldown
    if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
        shareManager.showToast('⏳ Cooldown active. Please wait.');
        return;
    }
    
    selectedMedId = medId;
    elements.confirmDetails.textContent = 
        `${getCompartmentLabel(med.compartment)} · ${med.name} ${med.dosage}`;
    openModal(elements.confirmModal);
}

function openEditModal(medId) {
    const med = state.medications.find(m => m.id === medId);
    if (!med) return;
    
    elements.modalTitle.textContent = 'Edit Medication';
    elements.editId.value = med.id;
    elements.medName.value = med.name;
    elements.medDosage.value = med.dosage;
    elements.medCompartment.value = med.compartment;
    elements.medSchedule.value = med.schedule.substring(0, 16);
    elements.medInventory.value = med.inventory;
    
    openModal(elements.medicationModal);
}

function resetMedicationForm() {
    elements.modalTitle.textContent = 'Add Medication';
    elements.editId.value = '';
    elements.medName.value = '';
    elements.medDosage.value = '';
    elements.medCompartment.value = 'A';
    // Set default schedule to now
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - offset)).toISOString().slice(0, 16);
    elements.medSchedule.value = localISOTime;
    elements.medInventory.value = '14';
}

// Summary functions
function generateSummary() {
    renderSummary(state, elements);
    openModal(elements.summaryModal);
}

function exportSummary() {
    const stats = getAdherenceStats(state);
    const logs = getLogsForSummary(state);
    const data = {
        generatedAt: new Date().toISOString(),
        stats: stats,
        logs: logs.map(log => {
            const med = state.medications.find(m => m.id === log.medicationId);
            return {
                ...log,
                medicationName: med ? med.name : 'Unknown',
                compartment: med ? med.compartment : '?'
            };
        })
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alagatap_summary_${getTodayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Export/Import
function exportData() {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alagatap_backup_${getTodayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.medications && imported.logs !== undefined) {
                state = imported;
                saveState(state);
                renderAll();
                shareManager.showToast('✅ Data imported successfully.');
            } else {
                alert('Invalid backup file format.');
            }
        } catch (err) {
            alert('Error reading file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// Event Listeners
function init() {
    // Check if this is a shared view
    const sharedData = shareManager.loadSharedData();
    if (sharedData) {
        shareManager.renderReadOnlyView(sharedData.data);
        // Still initialize theme
        setTheme(state.theme || 'light');
        return; // Skip normal initialization
    }
    
    // Normal initialization
    setTheme(state.theme || 'light');
    
    // Theme toggle
    elements.themeToggle.addEventListener('click', () => {
        setTheme(state.theme === 'light' ? 'dark' : 'light');
    });
    
    // Record dose main button
    elements.recordDoseBtn.addEventListener('click', () => {
        if (state.medications.length === 0) {
            alert('Please add a medication first.');
            return;
        }
        // Find first pending medication
        const today = getTodayStr();
        const pending = state.medications.find(med => 
            !state.logs.some(l => l.medicationId === med.id && l.timestamp.startsWith(today))
        );
        if (pending) {
            openConfirmModal(pending.id);
        } else {
            // All logged, use first medication
            openConfirmModal(state.medications[0].id);
        }
    });
    
    // Add medication
    elements.addMedicationBtn.addEventListener('click', () => {
        resetMedicationForm();
        openModal(elements.medicationModal);
    });
    
    // Medication form submit
    elements.medicationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
            name: elements.medName.value,
            dosage: elements.medDosage.value,
            compartment: elements.medCompartment.value,
            schedule: new Date(elements.medSchedule.value).toISOString(),
            inventory: elements.medInventory.value
        };
        
        const editId = elements.editId.value;
        if (editId) {
            updateMedication(editId, data);
        } else {
            addMedication(data);
        }
        closeModal(elements.medicationModal);
        resetMedicationForm();
    });
    
    // Confirm log
    elements.confirmLogBtn.addEventListener('click', () => {
        if (selectedMedId) {
            logDose(selectedMedId);
        }
    });
    
    // History toggle
    elements.historyToggle.addEventListener('click', () => {
        historyOpen = !historyOpen;
        renderHistory(state, elements, historyOpen);
    });
    
    // Summary
    document.getElementById('summaryBtn').addEventListener('click', generateSummary);
    elements.exportSummaryBtn.addEventListener('click', exportSummary);
    
    // Caregiver sharing
    document.getElementById('caregiverBtn').addEventListener('click', () => {
        const shareUrl = shareManager.generateShareLink();
        if (shareUrl) {
            elements.shareLink.textContent = shareUrl;
            // Generate QR code
            const qrContainer = elements.qrCode;
            if (window.QRCode && qrContainer) {
                qrContainer.innerHTML = '';
                try {
                    new QRCode(qrContainer, {
                        text: shareUrl,
                        width: 150,
                        height: 150,
                        colorDark: '#0052CC',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.H
                    });
                } catch (e) {
                    console.warn('QR generation failed:', e);
                    qrContainer.innerHTML = '<div class="text-sm text-gray-500">QR code unavailable</div>';
                }
            }
            openModal(elements.caregiverModal);
        } else {
            alert('Failed to generate share link. Please try again.');
        }
    });
    
    // Copy link
    elements.copyLinkBtn.addEventListener('click', () => {
        const link = elements.shareLink.textContent;
        if (link && link !== 'Generating link...') {
            navigator.clipboard?.writeText(link).then(() => {
                shareManager.showToast('✅ Link copied to clipboard!');
            }).catch(() => {
                // Fallback
                const textArea = document.createElement('textarea');
                textArea.value = link;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
                shareManager.showToast('✅ Link copied!');
            });
        }
    });
    
    // Refresh share link
    elements.refreshShareLink.addEventListener('click', () => {
        const shareUrl = shareManager.generateShareLink();
        if (shareUrl) {
            elements.shareLink.textContent = shareUrl;
            shareManager.showToast('🔄 New share link generated');
        }
    });
    
    // Share history
    elements.shareHistoryBtn.addEventListener('click', () => {
        const history = shareManager.getShareHistory();
        if (history.length === 0) {
            shareManager.showToast('📭 No share history yet');
            return;
        }
        const historyText = history.map((h, i) => 
            `${i+1}. ${new Date(h.date).toLocaleDateString()} - ${h.medications} medications`
        ).join('\n');
        alert('Share History:\n' + historyText);
    });
    
    // Export/Import
    elements.exportBtn.addEventListener('click', exportData);
    elements.importBtn.addEventListener('click', () => elements.importFileInput.click());
    elements.importFileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            importData(e.target.files[0]);
            e.target.value = '';
        }
    });
    
    // Modal close buttons
    document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modal;
            if (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) closeModal(modal);
            }
        });
    });
    
    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });

            // Test notification button
    document.getElementById('testNotifBtn')?.addEventListener('click', () => {
        if (window.testAlagaTapNotification) {
            window.testAlagaTapNotification();
        } else {
            showToast('⚠️ Loading notification system...');
            setTimeout(() => {
                if (window.testAlagaTapNotification) {
                    window.testAlagaTapNotification();
                } else {
                    alert('Please enable notifications first using the toggle switch.');
                }
            }, 1000);
        }
    });
    // Initialize notifications
    initNotifications(state, saveState);
    
    // Check midnight reset
    checkMidnightReset();
    
    // Initial render
    renderAll();
    startCooldownTimer();
    
    // Periodic refresh (every 30 seconds)
    setInterval(() => {
        renderAll();
        checkMidnightReset();
    }, 30000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);