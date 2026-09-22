// js/app.js — Main application

import { loadState, saveState, generateId } from './state.js';
import {
    formatTime, formatDateTime, getTodayStr, getTodayDay,
    getStatusText, getLastDoseTime, getDaysLabel, getSlotLabel,
    getAdherenceStats, getLogsForSummary, isMedToday, isOverdue,
    SLOT_DEFAULT_TIME, DAY_FULL, DAY_COLORS
} from './utils.js';
import { initNotifications } from './notifications.js';
import { ShareManager } from './share.js';
import {
    renderHero, renderPillboxGrid, renderTodayList, renderWarnings,
    renderRefillAlert, renderHistory, renderSummary, updateCooldown
} from './components.js';

// ---------------- Splash ----------------
(function runSplash() {
    const splash = document.getElementById('splashScreen');
    if (!splash) return;
    setTimeout(() => splash.classList.add('hiding'), 1500);
    setTimeout(() => {
        if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
    }, 2200);
})();

// ---------------- DOM ----------------
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
    pillboxGrid: document.getElementById('pillboxGrid'),
    compartmentList: document.getElementById('compartmentList'),
    addMedicationBtn: document.getElementById('addMedicationBtn'),
    historyToggle: document.getElementById('historyToggle'),
    historyList: document.getElementById('historyList'),
    historyArrow: document.getElementById('historyArrow'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFileInput: document.getElementById('importFileInput'),
    medicationModal: document.getElementById('medicationModal'),
    compartmentModal: document.getElementById('compartmentModal'),
    confirmModal: document.getElementById('confirmModal'),
    summaryModal: document.getElementById('summaryModal'),
    caregiverModal: document.getElementById('caregiverModal'),
    // form fields
    modalTitle: document.getElementById('modalTitle'),
    editId: document.getElementById('editId'),
    medName: document.getElementById('medName'),
    medDosage: document.getElementById('medDosage'),
    medSlot: document.getElementById('medSlot'),
    medTime: document.getElementById('medTime'),
    medInventory: document.getElementById('medInventory'),
    dayCheckboxes: document.getElementById('dayCheckboxes'),
    medicationForm: document.getElementById('medicationForm'),
    // compartment modal
    compartmentTitle: document.getElementById('compartmentTitle'),
    compartmentModalBody: document.getElementById('compartmentModalBody'),
    addToCompartmentBtn: document.getElementById('addToCompartmentBtn'),
    // summary
    totalScheduled: document.getElementById('totalScheduled'),
    totalReported: document.getElementById('totalReported'),
    adherenceRate: document.getElementById('adherenceRate'),
    summaryHistory: document.getElementById('summaryHistory'),
    exportSummaryBtn: document.getElementById('exportSummaryBtn'),
    // share
    shareLink: document.getElementById('shareLink'),
    refreshShareLink: document.getElementById('refreshShareLink'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),
    shareHistoryBtn: document.getElementById('shareHistoryBtn'),
    qrCode: document.getElementById('qrCode'),
    // confirm
    confirmDetails: document.getElementById('confirmDetails'),
    confirmLogBtn: document.getElementById('confirmLogBtn'),
};

let state = loadState();
let historyOpen = false;
let cooldownInterval = null;
let selectedMedId = null;
let notificationManager = null;
let pendingCompartment = null; // {day, slot} — used when adding from a cell

// ---------------- Theme ----------------
function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    saveState(state);
    updateThemeIcon();
}
function updateThemeIcon() {
    const isDark = state.theme === 'dark';
    elements.themeIcon.innerHTML = isDark
        ? '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />'
        : '<path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />';
}

// ---------------- Render ----------------
function renderAll() {
    renderHero(state, elements);
    renderPillboxGrid(state, elements, { onCellClick: openCompartmentModal });
    renderTodayList(state, elements, {
        onLogDose: openConfirmModal,
        onEditMed: openEditModal,
        onDeleteMed: deleteMedication
    });
    renderWarnings(state, elements);
    renderRefillAlert(state, elements);
    renderHistory(state, elements, historyOpen);
    updateCooldown(state, elements);
}

// ---------------- Medication CRUD ----------------
function addMedication(data) {
    const med = {
        id: generateId(),
        name: data.name.trim(),
        dosage: data.dosage.trim(),
        days: data.days.slice(),
        slot: data.slot,
        time: data.time,
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
    med.days = data.days.slice();
    med.slot = data.slot;
    med.time = data.time;
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

// ---------------- Dose logging ----------------
function logDose(medId) {
    const med = state.medications.find(m => m.id === medId);
    if (!med) return;
    if (state.cooldownUntil && Date.now() < state.cooldownUntil) return;
    if (med.inventory <= 0) {
        alert('No doses remaining. Please refill this medication.');
        return;
    }

    med.inventory = Math.max(0, med.inventory - 1);
    state.logs.push({
        timestamp: new Date().toISOString(),
        medicationId: med.id,
        slot: med.slot,
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
    cooldownInterval = setInterval(() => {
        updateCooldown(state, elements);
        if (state.cooldownUntil && Date.now() > state.cooldownUntil) {
            clearInterval(cooldownInterval);
            cooldownInterval = null;
            updateCooldown(state, elements);
        }
    }, 500);
}

// ---------------- Midnight reset ----------------
function checkMidnightReset() {
    const today = getTodayStr();
    if (state.lastResetDate !== today) {
        state.lastResetDate = today;
        saveState(state);
        renderAll();
    }
}

// ---------------- Modals ----------------
function openModal(modal) { modal.classList.remove('hidden'); }
function closeModal(modal) { modal.classList.add('hidden'); }

function openConfirmModal(medId) {
    const med = state.medications.find(m => m.id === medId);
    if (!med) return;
    if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
        showToast('Cooldown active. Please wait.');
        return;
    }
    selectedMedId = medId;
    elements.confirmDetails.textContent =
        getSlotLabel(med.slot) + ' · ' + med.name + ' ' + med.dosage;
    openModal(elements.confirmModal);
}

// ---- Compartment (cell) modal ----
function openCompartmentModal(day, slot) {
    const todayStr = getTodayStr();
    const isToday = day === getTodayDay();
    const dayColor = DAY_COLORS[day];
    const meds = state.medications.filter(m =>
        m.slot === slot && Array.isArray(m.days) && m.days.includes(day)
    );

    elements.compartmentTitle.innerHTML =
        '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' +
        dayColor + ';margin-right:8px;"></span>' +
        DAY_FULL[day] + ' · ' + getSlotLabel(slot);

    if (meds.length === 0) {
        elements.compartmentModalBody.innerHTML =
            '<div class="empty-hint">No medication in this compartment.</div>';
    } else {
        elements.compartmentModalBody.innerHTML = meds.map(function (med) {
            const logged = state.logs.some(function (l) {
                return l.medicationId === med.id && l.timestamp.startsWith(todayStr);
            });
            return '<div class="med-row">' +
                '<div class="info">' +
                    '<div class="name">' + med.name + '</div>' +
                    '<div class="detail">' + med.dosage + ' · ' + formatTime(med.time) + '</div>' +
                    '<div class="detail" style="font-size:12px;color:var(--text-muted);">' +
                        med.inventory + ' doses remaining' +
                        (logged ? ' · <span style="color:#00B88A;">Logged today</span>' : '') +
                    '</div>' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;gap:4px;">' +
                    (isToday && !logged
                        ? '<button class="btn-primary btn-tiny log-from-comp" data-med-id="' + med.id + '">Log</button>'
                        : '') +
                    '<button class="btn-secondary btn-tiny edit-from-comp" data-med-id="' + med.id + '">Edit</button>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    // Store context for "Add here"
    pendingCompartment = { day: day, slot: slot };

    // Wire up buttons
    elements.compartmentModalBody.querySelectorAll('.log-from-comp').forEach(function (btn) {
        btn.addEventListener('click', function () {
            closeModal(elements.compartmentModal);
            openConfirmModal(btn.dataset.medId);
        });
    });
    elements.compartmentModalBody.querySelectorAll('.edit-from-comp').forEach(function (btn) {
        btn.addEventListener('click', function () {
            closeModal(elements.compartmentModal);
            openEditModal(btn.dataset.medId);
        });
    });

    openModal(elements.compartmentModal);
}

// ---- Add/Edit medication modal ----
function openEditModal(medId) {
    const med = state.medications.find(m => m.id === medId);
    if (!med) return;

    elements.modalTitle.textContent = 'Edit Medication';
    elements.editId.value = med.id;
    elements.medName.value = med.name;
    elements.medDosage.value = med.dosage;
    elements.medSlot.value = med.slot;
    elements.medTime.value = med.time;
    elements.medInventory.value = med.inventory;

    // Days
    elements.dayCheckboxes.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
        cb.checked = Array.isArray(med.days) && med.days.includes(parseInt(cb.value, 10));
    });

    pendingCompartment = null;
    openModal(elements.medicationModal);
}

function resetMedicationForm() {
    elements.modalTitle.textContent = 'Add Medication';
    elements.editId.value = '';
    elements.medName.value = '';
    elements.medDosage.value = '';
    elements.medSlot.value = pendingCompartment ? pendingCompartment.slot : 'morning';
    elements.medTime.value = SLOT_DEFAULT_TIME[elements.medSlot.value] || '08:00';
    elements.medInventory.value = '14';

    // Default days: if adding from a specific cell, pre-check that day only
    elements.dayCheckboxes.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
        if (pendingCompartment) {
            cb.checked = parseInt(cb.value, 10) === pendingCompartment.day;
        } else {
            cb.checked = true; // default: every day
        }
    });
}

// Auto-adjust default time when slot changes (only if user hasn't typed a custom time)
function handleSlotChange() {
    const slot = elements.medSlot.value;
    const currentTime = elements.medTime.value;
    // If the current time matches one of the slot defaults, update it
    const defaults = Object.values(SLOT_DEFAULT_TIME);
    if (!currentTime || defaults.includes(currentTime)) {
        elements.medTime.value = SLOT_DEFAULT_TIME[slot];
    }
}

// ---------------- Summary ----------------
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
        logs: logs.map(function (log) {
            const med = state.medications.find(m => m.id === log.medicationId);
            return Object.assign({}, log, {
                medicationName: med ? med.name : 'Unknown',
                slot: med ? med.slot : '?'
            });
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

// ---------------- Export/Import ----------------
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
    reader.onload = function (e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.medications && imported.logs !== undefined) {
                imported.medications.forEach(function (m) {
                    if (!Array.isArray(m.days)) m.days = [0,1,2,3,4,5,6];
                    if (!m.slot) m.slot = 'morning';
                    if (!m.time) m.time = '08:00';
                });
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

// ---------------- Toast ----------------
function showToast(message) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
}

// ---------------- Medication form ----------------
function setupMedicationForm() {
    elements.medSlot.addEventListener('change', handleSlotChange);

    elements.medicationForm.addEventListener('submit', function (e) {
        e.preventDefault();

        // Collect checked days
        const days = [];
        elements.dayCheckboxes.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
            if (cb.checked) days.push(parseInt(cb.value, 10));
        });

        if (days.length === 0) {
            alert('Please select at least one day.');
            return;
        }

        const data = {
            name: elements.medName.value,
            dosage: elements.medDosage.value,
            days: days,
            slot: elements.medSlot.value,
            time: elements.medTime.value,
            inventory: elements.medInventory.value
        };

        const editId = elements.editId.value;
        if (editId) updateMedication(editId, data);
        else addMedication(data);

        closeModal(elements.medicationModal);
        pendingCompartment = null;
        resetMedicationForm();
    });
}

// ---------------- Init ----------------
function init() {
    const shareManager = new ShareManager(state, elements);
    const sharedData = shareManager.loadSharedData();
    if (sharedData) {
        shareManager.renderReadOnlyView(sharedData.data);
        setTheme(state.theme || 'light');
        return;
    }

    setTheme(state.theme || 'light');

    elements.themeToggle.addEventListener('click', function () {
        setTheme(state.theme === 'light' ? 'dark' : 'light');
    });

    // Record dose — picks the earliest pending dose today
    elements.recordDoseBtn.addEventListener('click', function () {
        const todayStr = getTodayStr();
        const pending = state.medications
            .filter(isMedToday)
            .filter(function (med) {
                return !state.logs.some(function (l) {
                    return l.medicationId === med.id && l.timestamp.startsWith(todayStr);
                });
            })
            .sort(function (a, b) { return a.time.localeCompare(b.time); });

        if (pending.length === 0) {
            alert('All of today\u2019s doses are already logged.');
            return;
        }
        openConfirmModal(pending[0].id);
    });

    // Add medication (global)
    elements.addMedicationBtn.addEventListener('click', function () {
        pendingCompartment = null;
        resetMedicationForm();
        openModal(elements.medicationModal);
    });

    // Add medication from a compartment cell
    elements.addToCompartmentBtn.addEventListener('click', function () {
        closeModal(elements.compartmentModal);
        resetMedicationForm();
        openModal(elements.medicationModal);
    });

    setupMedicationForm();

    // Confirm log
    elements.confirmLogBtn.addEventListener('click', function () {
        if (selectedMedId) logDose(selectedMedId);
    });

    // History
    elements.historyToggle.addEventListener('click', function () {
        historyOpen = !historyOpen;
        renderHistory(state, elements, historyOpen);
    });

    // Summary
    document.getElementById('summaryBtn').addEventListener('click', generateSummary);
    elements.exportSummaryBtn.addEventListener('click', exportSummary);

    // Caregiver
    document.getElementById('caregiverBtn').addEventListener('click', function () {
        const shareUrl = shareManager.generateShareLink();
        if (!shareUrl) {
            alert('Failed to generate share link.');
            return;
        }
        elements.shareLink.textContent = shareUrl;
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
            } catch (err) {
                console.warn('QR generation failed:', err);
            }
        }
        openModal(elements.caregiverModal);
    });

    elements.copyLinkBtn.addEventListener('click', function () {
        const link = elements.shareLink.textContent;
        if (!link || link === 'Generating link…') return;
        const fallback = function () {
            const ta = document.createElement('textarea');
            ta.value = link;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            showToast('Link copied.');
        };
        if (navigator.clipboard) {
            navigator.clipboard.writeText(link).then(function () {
                showToast('Link copied.');
            }).catch(fallback);
        } else fallback();
    });

    elements.refreshShareLink.addEventListener('click', function () {
        const shareUrl = shareManager.generateShareLink();
        if (shareUrl) {
            elements.shareLink.textContent = shareUrl;
            showToast('New share link generated.');
        }
    });

    elements.shareHistoryBtn.addEventListener('click', function () {
        const history = shareManager.getShareHistory();
        if (history.length === 0) { showToast('No share history yet.'); return; }
        const text = history.map(function (h, i) {
            return (i + 1) + '. ' + new Date(h.date).toLocaleDateString() +
                ' - ' + h.medications + ' medications';
        }).join('\n');
        alert('Share History:\n' + text);
    });

    // Export / Import
    elements.exportBtn.addEventListener('click', exportData);
    elements.importBtn.addEventListener('click', function () { elements.importFileInput.click(); });
    elements.importFileInput.addEventListener('change', function (e) {
        if (e.target.files.length) {
            importData(e.target.files[0]);
            e.target.value = '';
        }
    });

    // Modal close buttons
    document.querySelectorAll('.modal-close, [data-modal]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const modalId = btn.dataset.modal;
            if (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) closeModal(modal);
            }
        });
    });
    document.querySelectorAll('.modal-overlay').forEach(function (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeModal(modal);
        });
    });

    // Notifications
    notificationManager = initNotifications(state, saveState);

    checkMidnightReset();
    renderAll();
    startCooldownTimer();

    setInterval(function () {
        renderAll();
        checkMidnightReset();
    }, 30000);
}

document.addEventListener('DOMContentLoaded', init);