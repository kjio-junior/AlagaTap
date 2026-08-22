// js/app.js - Main application
import { loadState, saveState, generateId } from './state.js';
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
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    heroTimestamp: document.getElementById('heroTimestamp'),
    recordDoseBtn: document.getElementById('recordDoseBtn'),
    cooldownIndicator: document.getElementById('cooldownIndicator'),
    cooldownTimer: document.getElementById('cooldownTimer'),
    warningBanner: document.getElementById('warningBanner'),
    warningText: document.getElementById('warningText'),
    refillAlert: document.getElementById('refillAlert'),
    refillMessage: document.getElementById('refillMessage'),
    compartmentList: document.getElementById('compartmentList'),
    addMedicationBtn: document.getElementById('addMedicationBtn'),
    historyToggle: document.getElementById('historyToggle'),
    historyList: document.getElementById('historyList'),
    historyArrow: document.getElementById('historyArrow'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFileInput: document.getElementById('importFileInput'),
    medicationModal: document.getElementById('medicationModal'),
    confirmModal: document.getElementById('confirmModal'),
    summaryModal: document.getElementById('summaryModal'),
    caregiverModal: document.getElementById('caregiverModal'),
    totalScheduled: document.getElementById('totalScheduled'),
    totalReported: document.getElementById('totalReported'),
    adherenceRate: document.getElementById('adherenceRate'),
    summaryHistory: document.getElementById('summaryHistory'),
    exportSummaryBtn: document.getElementById('exportSummaryBtn'),
    shareLink: document.getElementById('shareLink'),
    refreshShareLink: document.getElementById('refreshShareLink'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),
    shareHistoryBtn: document.getElementById('shareHistoryBtn'),
    qrCode: document.getElementById('qrCode'),
    confirmDetails: document.getElementById('confirmDetails'),
    confirmLogBtn: document.getElementById('confirmLogBtn'),
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
let notificationManager = null;

// ===== THEME MANAGEMENT =====
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
    const med = state.medications.find(function(m) { return m.id === id; });
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
    state.medications = state.medications.filter(function(m) { return m.id !== id; });
    state.logs = state.logs.filter(function(l) { return l.medicationId !== id; });
    saveState(state);
    renderAll();
}

// Dose logging
function logDose(medId) {
    const med = state.medications.find(function(m) { return m.id === medId; });
    if (!med) return;
    
    if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
        return;
    }
    
    if (med.inventory <= 0) {
        alert('No doses remaining. Please refill this medication.');
        return;
    }
    
    med.inventory = Math.max(0, med.inventory - 1);
    
    state.logs.push({
        timestamp: new Date().toISOString(),
        medicationId: med.id,
        compartment: med.compartment,
        doseType: 'Self-Reported'
    });
    
    state.lastDoseTimestamp = new Date().toISOString();
    state.cooldownUntil = Date.now() + 5 * 60 * 1000;
    
    saveState(state);
    renderAll();
    startCooldownTimer();
    closeModal(elements.confirmModal);
}

function startCooldownTimer() {
    if (cooldownInterval) clearInterval(cooldownInterval);
    cooldownInterval = setInterval(function() {
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
    const med = state.medications.find(function(m) { return m.id === medId; });
    if (!med) return;
    
    if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
        showToast('Cooldown active. Please wait.');
        return;
    }
    
    selectedMedId = medId;
    elements.confirmDetails.textContent = 
        getCompartmentLabel(med.compartment) + ' · ' + med.name + ' ' + med.dosage;
    openModal(elements.confirmModal);
}

// ===== OPEN EDIT MODAL - FIXED TIMEZONE (USING UTC METHODS) =====
function openEditModal(medId) {
    const med = state.medications.find(function(m) { return m.id === medId; });
    if (!med) return;
    
    elements.modalTitle.textContent = 'Edit Medication';
    elements.editId.value = med.id;
    elements.medName.value = med.name;
    elements.medDosage.value = med.dosage;
    elements.medCompartment.value = med.compartment;
    
    // ===== FIX: Use UTC values directly from the stored ISO string =====
    // The stored date is in UTC format: "2026-08-22T16:12:00.000Z"
    // We need to extract the UTC year, month, day, hours, minutes
    var utcDate = new Date(med.schedule);
    
    // Get UTC values directly
    var year = utcDate.getUTCFullYear();
    var month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
    var day = String(utcDate.getUTCDate()).padStart(2, '0');
    var hours = String(utcDate.getUTCHours()).padStart(2, '0');
    var minutes = String(utcDate.getUTCMinutes()).padStart(2, '0');
    
    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    elements.medSchedule.value = year + '-' + month + '-' + day + 'T' + hours + ':' + minutes;
    // ==============================================================
    
    elements.medInventory.value = med.inventory;
    
    openModal(elements.medicationModal);
}

// ===== RESET MEDICATION FORM =====
function resetMedicationForm() {
    elements.modalTitle.textContent = 'Add Medication';
    elements.editId.value = '';
    elements.medName.value = '';
    elements.medDosage.value = '';
    elements.medCompartment.value = 'A';
    
    // Set default to current LOCAL time
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    var hours = String(now.getHours()).padStart(2, '0');
    var minutes = String(now.getMinutes()).padStart(2, '0');
    elements.medSchedule.value = year + '-' + month + '-' + day + 'T' + hours + ':' + minutes;
    
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
        logs: logs.map(function(log) {
            const med = state.medications.find(function(m) { return m.id === log.medicationId; });
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
    a.download = 'alagatap_summary_' + getTodayStr() + '.json';
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
    a.download = 'alagatap_backup_' + getTodayStr() + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.medications && imported.logs !== undefined) {
                state = imported;
                saveState(state);
                renderAll();
                showToast('Data imported successfully.');
            } else {
                alert('Invalid backup file format.');
            }
        } catch (err) {
            alert('Error reading file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function showToast(message) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
}

// Add email setup inline
function addEmailSetupUI() {
    const notificationSection = document.getElementById('notificationSection');
    if (!notificationSection) return;
    
    if (document.getElementById('emailSetupInline')) return;
    
    const emailDiv = document.createElement('div');
    emailDiv.id = 'emailSetupInline';
    emailDiv.className = 'email-setup-inline';
    var emailDisplay = localStorage.getItem('notificationEmail') ? '✓ ' + localStorage.getItem('notificationEmail') : 'Not set';
    emailDiv.innerHTML = `
        <span class="email-label">
            Email: 
            <span class="email-status" id="emailStatusDisplay">
                ${emailDisplay}
            </span>
        </span>
        <button id="emailSetupBtnInline" class="btn-secondary btn-sm">
            ${localStorage.getItem('notificationEmail') ? 'Change' : 'Set Email'}
        </button>
    `;
    notificationSection.appendChild(emailDiv);
    
    document.getElementById('emailSetupBtnInline').addEventListener('click', function() {
        if (notificationManager) {
            notificationManager.showEmailSetup();
        } else {
            alert('Please enable notifications first.');
        }
    });
}

// ===== MEDICATION FORM SUBMIT - FIXED =====
function setupMedicationForm() {
    elements.medicationForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Convert local time to UTC for storage
        var localDateTime = elements.medSchedule.value;
        var localDate = new Date(localDateTime);
        var utcISO = localDate.toISOString();
        
        var data = {
            name: elements.medName.value,
            dosage: elements.medDosage.value,
            compartment: elements.medCompartment.value,
            schedule: utcISO,
            inventory: elements.medInventory.value
        };
        
        var editId = elements.editId.value;
        if (editId) {
            updateMedication(editId, data);
        } else {
            addMedication(data);
        }
        closeModal(elements.medicationModal);
        resetMedicationForm();
    });
}

// ===== INITIALIZE =====
function init() {
    const shareManager = new ShareManager(state, elements);
    const sharedData = shareManager.loadSharedData();
    if (sharedData) {
        shareManager.renderReadOnlyView(sharedData.data);
        setTheme(state.theme || 'light');
        return;
    }
    
    setTheme(state.theme || 'light');
    
    // Theme toggle
    elements.themeToggle.addEventListener('click', function() {
        setTheme(state.theme === 'light' ? 'dark' : 'light');
    });
    
    // Record dose
    elements.recordDoseBtn.addEventListener('click', function() {
        if (state.medications.length === 0) {
            alert('Please add a medication first.');
            return;
        }
        var today = getTodayStr();
        var pending = state.medications.find(function(med) {
            return !state.logs.some(function(l) {
                return l.medicationId === med.id && l.timestamp.startsWith(today);
            });
        });
        if (pending) {
            openConfirmModal(pending.id);
        } else {
            openConfirmModal(state.medications[0].id);
        }
    });
    
    // Add medication
    elements.addMedicationBtn.addEventListener('click', function() {
        resetMedicationForm();
        openModal(elements.medicationModal);
    });
    
    // Setup medication form
    setupMedicationForm();
    
    // Confirm log
    elements.confirmLogBtn.addEventListener('click', function() {
        if (selectedMedId) {
            logDose(selectedMedId);
        }
    });
    
    // History toggle
    elements.historyToggle.addEventListener('click', function() {
        historyOpen = !historyOpen;
        renderHistory(state, elements, historyOpen);
    });
    
    // Summary
    document.getElementById('summaryBtn').addEventListener('click', generateSummary);
    elements.exportSummaryBtn.addEventListener('click', exportSummary);
    
    // Caregiver sharing
    document.getElementById('caregiverBtn').addEventListener('click', function() {
        var shareUrl = shareManager.generateShareLink();
        if (shareUrl) {
            elements.shareLink.textContent = shareUrl;
            var qrContainer = elements.qrCode;
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
    elements.copyLinkBtn.addEventListener('click', function() {
        var link = elements.shareLink.textContent;
        if (link && link !== 'Generating link...') {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(link).then(function() {
                    showToast('Link copied to clipboard!');
                }).catch(function() {
                    var textArea = document.createElement('textarea');
                    textArea.value = link;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    textArea.remove();
                    showToast('Link copied!');
                });
            } else {
                var textArea = document.createElement('textarea');
                textArea.value = link;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
                showToast('Link copied!');
            }
        }
    });
    
    // Refresh share link
    elements.refreshShareLink.addEventListener('click', function() {
        var shareUrl = shareManager.generateShareLink();
        if (shareUrl) {
            elements.shareLink.textContent = shareUrl;
            showToast('New share link generated');
        }
    });
    
    // Share history
    elements.shareHistoryBtn.addEventListener('click', function() {
        var history = shareManager.getShareHistory();
        if (history.length === 0) {
            showToast('No share history yet');
            return;
        }
        var historyText = history.map(function(h, i) {
            return (i+1) + '. ' + new Date(h.date).toLocaleDateString() + ' - ' + h.medications + ' medications';
        }).join('\n');
        alert('Share History:\n' + historyText);
    });
    
    // Export/Import
    elements.exportBtn.addEventListener('click', exportData);
    elements.importBtn.addEventListener('click', function() { elements.importFileInput.click(); });
    elements.importFileInput.addEventListener('change', function(e) {
        if (e.target.files.length) {
            importData(e.target.files[0]);
            e.target.value = '';
        }
    });
    
    // Modal close buttons
    document.querySelectorAll('.modal-close, [data-modal]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var modalId = btn.dataset.modal;
            if (modalId) {
                var modal = document.getElementById(modalId);
                if (modal) closeModal(modal);
            }
        });
    });
    
    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(function(modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeModal(modal);
        });
    });
    
    // Initialize Notifications (EmailJS)
    notificationManager = initNotifications(state, saveState);
    console.log('✅ NotificationManager initialized');
    
    // Add email setup UI
    setTimeout(function() {
        addEmailSetupUI();
    }, 500);
    
    // Test notification button (DEBUG - remove after testing)
    document.getElementById('testNotifBtn')?.addEventListener('click', function() {
        if (notificationManager) {
            notificationManager.testNotification();
        } else {
            alert('Notification system is loading. Please try again.');
        }
    });
    
    // Check midnight reset
    checkMidnightReset();
    
    // Initial render
    renderAll();
    startCooldownTimer();
    
    // Periodic refresh
    setInterval(function() {
        renderAll();
        checkMidnightReset();
    }, 30000);
}

document.addEventListener('DOMContentLoaded', init);