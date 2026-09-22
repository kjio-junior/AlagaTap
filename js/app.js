// js/app.js

import { loadState, saveState, generateId } from './state.js';
import {
    formatTime, formatDateTime, formatDateShort,
    getDaysLabel,
    getTodayStr, getTodayDay, getDatesOfThisWeek,
    isMedToday, isOverdue, getSlotLabel,
    getAdherenceStats, getLogsForSummary,
    buildLogIndex, isLogged, buildLogStatusMap, getLogStatus,
    SLOT_DEFAULT_TIME, DAY_FULL, DAY_COLORS
} from './utils.js';
import { initNotifications } from './notifications.js';
import { ShareManager } from './share.js';
import {
    renderHero, renderPillboxGrid, renderTodayList, renderWarnings,
    renderRefillAlert, renderHistory, renderSummary, updateCooldown,
    renderDosePickerList
} from './components.js';

// ---- Splash ----
(function runSplash() {
    const s = document.getElementById('splashScreen');
    if (!s) return;
    setTimeout(() => s.classList.add('hiding'), 1500);
    setTimeout(() => { if (s.parentNode) s.parentNode.removeChild(s); }, 2200);
})();

// ---- DOM ----
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
    modalTitle: document.getElementById('modalTitle'),
    editId: document.getElementById('editId'),
    medName: document.getElementById('medName'),
    medDosage: document.getElementById('medDosage'),
    medSlot: document.getElementById('medSlot'),
    medTime: document.getElementById('medTime'),
    medInventory: document.getElementById('medInventory'),
    dayCheckboxes: document.getElementById('dayCheckboxes'),
    medicationForm: document.getElementById('medicationForm'),
    compartmentTitle: document.getElementById('compartmentTitle'),
    compartmentModalBody: document.getElementById('compartmentModalBody'),
    addToCompartmentBtn: document.getElementById('addToCompartmentBtn'),
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
    dosePickerModal: document.getElementById('dosePickerModal'),
    dosePickerList: document.getElementById('dosePickerList'),
};
elements.onPickerAction = function (medId, date, status) {
    logDose(medId, date, status);
};

let state = loadState();
let historyOpen = false;
let cooldownInterval = null;
let notificationManager = null;
let pendingCompartment = null;         // {day, slot} for "Add from cell"
let pendingLog = { medId: null, date: null }; // <-- the new pending-log context

// ---- Theme ----
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

// ---- Render ----
function renderAll() {
    renderHero(state, elements);
    renderPillboxGrid(state, elements, { onCellClick: openCompartmentModal });
    renderTodayList(state, elements, {
        onLogDose: openDosePickerAt,
        onEditMed: openEditModal,
        onDeleteMed: openDeleteModal
    });
    renderWarnings(state, elements);
    renderRefillAlert(state, elements);
    renderHistory(state, elements, historyOpen);
    updateCooldown(state, elements);
    if (elements.dosePickerModal && !elements.dosePickerModal.classList.contains('hidden')) {
        renderDosePickerList(state, elements);
    }
}

function openDosePickerAt(medId) {
    renderDosePickerList(state, elements);
    openModal(elements.dosePickerModal);
}

// ---- CRUD ----
function addMedication(data) {
    state.medications.push({
        id: generateId(),
        name: data.name.trim(),
        dosage: data.dosage.trim(),
        days: data.days.slice(),
        slot: data.slot,
        time: data.time,
        inventory: parseInt(data.inventory) || 14,
        maxInventory: parseInt(data.inventory) || 14,
        createdAt: new Date().toISOString()
    });
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

// ================= LOG DOSE (with status) =================
// A log is uniquely identified by (medicationId, date).
function logDose(medId, date, status) {
    const med = state.medications.find(m => m.id === medId);
    if (!med) return;

    const todayStr = getTodayStr();
    const isToday = date === todayStr;

    const existingLog = state.logs.find(l => l.medicationId === medId && l.date === date);
    const existingStatus = existingLog ? (existingLog.status || 'taken') : null;

    // Cooldown only blocks a FRESH 'taken' for TODAY
    if (status === 'taken' && isToday && existingStatus !== 'taken' &&
        state.cooldownUntil && Date.now() < state.cooldownUntil) {
        const remaining = Math.ceil((state.cooldownUntil - Date.now()) / 1000);
        showToast('Cooldown active — wait ' + remaining + 's before logging another taken dose.');
        return;
    }

    if (existingStatus === 'taken' && status === 'missed') {
        med.inventory = Math.min(med.maxInventory || 14, med.inventory + 1);
    } else if (existingStatus !== 'taken' && status === 'taken') {
        if (med.inventory <= 0) {
            alert('No doses remaining. Please refill this medication.');
            return;
        }
        med.inventory = Math.max(0, med.inventory - 1);
    }
    if (existingLog) {
        state.logs = state.logs.filter(l => l !== existingLog);
    }

    state.logs.push({
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        timestamp: new Date().toISOString(),
        medicationId: med.id,
        slot: med.slot,
        date: date,
        status: status,
        doseType: 'Self-Reported'
    });

    // Cooldown only starts when logging a fresh 'taken' for today
    if (status === 'taken' && isToday) {
        state.cooldownUntil = Date.now() + 5 * 60 * 1000;
        startCooldownTimer();
    }
    state.lastDoseTimestamp = new Date().toISOString();

    saveState(state);
    renderAll();

    // Refresh picker if it's open — reuse last used context
    if (!elements.dosePickerModal.classList.contains('hidden')) {
        renderDosePickerList(state, elements, date, med.slot);
    }

    const label = status === 'taken' ? 'taken' : 'missed';
    const when = isToday ? '' : ' for ' + formatDateShort(date);
    showToast(getSlotLabel(med.slot) + ' ' + med.name + ' marked as ' + label + when + '.');
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

// ---- Midnight reset ----
function checkMidnightReset() {
    const today = getTodayStr();
    if (state.lastResetDate !== today) {
        state.lastResetDate = today;
        saveState(state);
        renderAll();
    }
}

// ---- Modal helpers ----
function openModal(m) { m.classList.remove('hidden'); }
function closeModal(m) { m.classList.add('hidden'); }

// ---- Confirm dose modal ----
function openConfirmModal(medId, targetDate) {
    const med = state.medications.find(m => m.id === medId);
    if (!med) return;

    if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
        showToast('Cooldown active. Please wait.');
        return;
    }

    const date = targetDate || getTodayStr();
    pendingLog = { medId: medId, date: date };

    const isToday = date === getTodayStr();
    const dateLabel = isToday ? 'today' : formatDateShort(date);

    elements.confirmDetails.textContent =
        getSlotLabel(med.slot) + ' · ' + med.name + ' ' + med.dosage + ' · ' + dateLabel;
    openModal(elements.confirmModal);
}

// ---- Compartment modal ----
function openCompartmentModal(day, slot, cellDate) {
    const todayStr = getTodayStr();
    const isToday = day === getTodayDay();
    const isFuture = cellDate > todayStr;
    const dayColor = DAY_COLORS[day];
    const logIndex = buildLogIndex(state.logs);

    const meds = state.medications.filter(m =>
        m.slot === slot && Array.isArray(m.days) && m.days.includes(day)
    );

    elements.compartmentTitle.innerHTML =
        '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' +
        dayColor + ';margin-right:8px;"></span>' +
        DAY_FULL[day] + ' · ' + getSlotLabel(slot) +
        ' <span style="font-size:12px;color:var(--text-muted);font-weight:400;">(' +
        formatDateShort(cellDate) + ')</span>';

    if (meds.length === 0) {
        elements.compartmentModalBody.innerHTML =
            '<div class="empty-hint">No medication in this compartment.</div>';
    } else {
        elements.compartmentModalBody.innerHTML = meds.map(med => {
            const logged = isLogged(logIndex, med.id, cellDate);
            return `<div class="med-row">
                <div class="info">
                    <div class="name">${med.name}</div>
                    <div class="detail">${med.dosage} · ${formatTime(med.time)}</div>
                    <div class="detail" style="font-size:12px;color:var(--text-muted);">
                        ${med.inventory} doses remaining
                        ${logged ? ' · <span style="color:#00B88A;">Logged</span>' : ''}
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;">
                    ${(!isFuture && !logged)
                        ? `<button class="btn-primary btn-tiny log-from-comp" data-med-id="${med.id}" data-date="${cellDate}">Log</button>`
                        : isFuture
                            ? `<span style="font-size:11px;color:var(--text-muted);">Scheduled</span>`
                            : ''}
                    <button class="btn-secondary btn-tiny edit-from-comp" data-med-id="${med.id}">Edit</button>
                </div>
            </div>`;
        }).join('');
    }

    pendingCompartment = { day: day, slot: slot };

    elements.compartmentModalBody.querySelectorAll('.log-from-comp').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(elements.compartmentModal);
            renderDosePickerList(state, elements, cellDate, slot);
            openModal(elements.dosePickerModal);
        });
    });
    elements.compartmentModalBody.querySelectorAll('.edit-from-comp').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(elements.compartmentModal);
            openEditModal(btn.dataset.medId);
        });
    });

    openModal(elements.compartmentModal);
}

// ---- Edit modal ----
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

    elements.dayCheckboxes.querySelectorAll('input[type=checkbox]').forEach(cb => {
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

    elements.dayCheckboxes.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.checked = pendingCompartment ? (parseInt(cb.value, 10) === pendingCompartment.day) : true;
    });
}

function handleSlotChange() {
    const slot = elements.medSlot.value;
    const current = elements.medTime.value;
    const defaults = Object.values(SLOT_DEFAULT_TIME);
    if (!current || defaults.includes(current)) {
        elements.medTime.value = SLOT_DEFAULT_TIME[slot];
    }
}

// ---- Delete modal ----
let pendingDeleteId = null;
function openDeleteModal(medId) {
    const med = state.medications.find(m => m.id === medId);
    if (!med) return;

    pendingDeleteId = medId;

    const nameEl = document.getElementById('deleteMedName');
    const daysEl = document.getElementById('deleteMedDays');
    const slotEl = document.getElementById('deleteMedSlot');

    if (nameEl) nameEl.textContent = med.name + ' (' + med.dosage + ')';
    if (daysEl) daysEl.textContent = getDaysLabel(med);
    if (slotEl) slotEl.textContent = getSlotLabel(med.slot) + ' · ' + formatTime(med.time);

    const modal = document.getElementById('deleteModal');
    if (modal) openModal(modal);
    else if (confirm('Delete this medication from all scheduled days?')) deleteMedication(medId);
}

// ---- Summary ----
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
        logs: logs.map(l => {
            const med = state.medications.find(m => m.id === l.medicationId);
            return Object.assign({}, l, {
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

// ---- Export/Import ----
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
    reader.onload = e => {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.medications && imported.logs !== undefined) {
                imported.medications.forEach(m => {
                    if (!Array.isArray(m.days)) m.days = [0,1,2,3,4,5,6];
                    if (!m.slot) m.slot = 'morning';
                    if (!m.time) m.time = '08:00';
                });
                imported.logs.forEach(l => {
                    if (!l.date) {
                        const d = new Date(l.timestamp);
                        l.date = d.getFullYear() + '-' +
                                 String(d.getMonth() + 1).padStart(2, '0') + '-' +
                                 String(d.getDate()).padStart(2, '0');
                    }
                    if (!l.id) l.id = 'log_' + Math.random().toString(36).substring(2, 10);
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

// ---- Toast ----
function showToast(message) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ---- Medication form ----
function setupMedicationForm() {
    elements.medSlot.addEventListener('change', handleSlotChange);

    elements.medicationForm.addEventListener('submit', e => {
        e.preventDefault();

        const days = [];
        elements.dayCheckboxes.querySelectorAll('input[type=checkbox]').forEach(cb => {
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

// ---- Init ----
function init() {
    const shareManager = new ShareManager(state, elements);
    const sharedData = shareManager.loadSharedData();
    if (sharedData) {
        shareManager.renderReadOnlyView(sharedData.data);
        setTheme(state.theme || 'light');
        return;
    }

    setTheme(state.theme || 'light');

    elements.themeToggle.addEventListener('click', () => {
        setTheme(state.theme === 'light' ? 'dark' : 'light');
    });

    // Hero "Record Dose" — earliest unlogged TODAY
    elements.recordDoseBtn.addEventListener('click', () => {
        const todayMeds = state.medications.filter(isMedToday);
        if (todayMeds.length === 0) {
            alert('No doses scheduled today. Tap Add to schedule one.');
            return;
        }
        renderDosePickerList(state, elements);
        openModal(elements.dosePickerModal);
    });

    elements.addMedicationBtn.addEventListener('click', () => {
        pendingCompartment = null;
        resetMedicationForm();
        openModal(elements.medicationModal);
    });

    elements.addToCompartmentBtn.addEventListener('click', () => {
        closeModal(elements.compartmentModal);
        resetMedicationForm();
        openModal(elements.medicationModal);
    });

    setupMedicationForm();

    // Confirm log (uses pendingLog internally)
    elements.confirmLogBtn.addEventListener('click', logDose);

    // Delete confirmation
    const confirmDelBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDelBtn) {
        confirmDelBtn.addEventListener('click', () => {
            if (!pendingDeleteId) return;
            deleteMedication(pendingDeleteId);
            pendingDeleteId = null;
            const modal = document.getElementById('deleteModal');
            if (modal) closeModal(modal);
            showToast('Medication deleted.');
        });
    }

    // History
    elements.historyToggle.addEventListener('click', () => {
        historyOpen = !historyOpen;
        renderHistory(state, elements, historyOpen);
    });

    // Summary
    document.getElementById('summaryBtn').addEventListener('click', generateSummary);
    elements.exportSummaryBtn.addEventListener('click', exportSummary);

    // Caregiver
    document.getElementById('caregiverBtn').addEventListener('click', () => {
        const shareUrl = shareManager.generateShareLink();
        if (!shareUrl) { alert('Failed to generate share link.'); return; }
        elements.shareLink.textContent = shareUrl;
        const qrContainer = elements.qrCode;
        if (window.QRCode && qrContainer) {
            qrContainer.innerHTML = '';
            try {
                new QRCode(qrContainer, {
                    text: shareUrl, width: 150, height: 150,
                    colorDark: '#0052CC', colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
            } catch (err) { console.warn('QR gen failed:', err); }
        }
        openModal(elements.caregiverModal);
    });

    elements.copyLinkBtn.addEventListener('click', () => {
        const link = elements.shareLink.textContent;
        if (!link || link === 'Generating link…') return;
        const fallback = () => {
            const ta = document.createElement('textarea');
            ta.value = link; document.body.appendChild(ta);
            ta.select(); document.execCommand('copy'); ta.remove();
            showToast('Link copied.');
        };
        if (navigator.clipboard) {
            navigator.clipboard.writeText(link).then(() => showToast('Link copied.')).catch(fallback);
        } else fallback();
    });

    elements.refreshShareLink.addEventListener('click', () => {
        const shareUrl = shareManager.generateShareLink();
        if (shareUrl) { elements.shareLink.textContent = shareUrl; showToast('New share link generated.'); }
    });

    elements.shareHistoryBtn.addEventListener('click', () => {
        const history = shareManager.getShareHistory();
        if (history.length === 0) { showToast('No share history yet.'); return; }
        alert('Share History:\n' + history.map((h, i) =>
            (i + 1) + '. ' + new Date(h.date).toLocaleDateString() + ' - ' + h.medications + ' medications'
        ).join('\n'));
    });

    // Export/Import
    elements.exportBtn.addEventListener('click', exportData);
    elements.importBtn.addEventListener('click', () => elements.importFileInput.click());
    elements.importFileInput.addEventListener('change', e => {
        if (e.target.files.length) { importData(e.target.files[0]); e.target.value = ''; }
    });

    // Modal close
    document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modal;
            if (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) closeModal(modal);
                if (modalId === 'deleteModal') pendingDeleteId = null;
            }
        });
    });
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) {
                closeModal(modal);
                if (modal.id === 'deleteModal') pendingDeleteId = null;
            }
        });
    });

    notificationManager = initNotifications(state, saveState);

    checkMidnightReset();
    renderAll();
    startCooldownTimer();

    setInterval(() => {
        renderAll();
        checkMidnightReset();
    }, 30000);
}

document.addEventListener('DOMContentLoaded', init);