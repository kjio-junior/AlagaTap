// js/app.js

import { loadState, saveState, generateId } from './state.js';
import {
    formatTime, formatDateTime, formatDateShort,
    getDaysLabel,
    getTodayStr, getTodayDay, getDatesOfThisWeek,
    isMedToday, isOverdue, getSlotLabel,
    getAdherenceStats, getLogsForSummary,
    buildLogIndex, isLogged, buildLogStatusMap, getLogStatus,
    SLOT_DEFAULT_TIME, DAY_FULL, DAY_COLORS, t
} from './utils.js';
import { initNotifications } from './notifications.js';
import { ShareManager } from './share.js';
import {
    renderHero, renderPillboxGrid, renderTodayList, renderWarnings,
    renderRefillAlert, renderHistory, renderSummary, updateCooldown,
    renderDosePickerList
} from './components.js';

function applyLanguage() {
    const lang = state.language || 'en';
    if (elements.langToggle) elements.langToggle.checked = lang === 'tl';

    const addBtn = document.getElementById('addMedicationBtn');
    if (addBtn) addBtn.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> ${t('add', lang)}`;

    const recordBtn = document.getElementById('recordDoseBtn');
    if (recordBtn) recordBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> ${t('recordDoses', lang)}`;

    const headers = document.querySelectorAll('.section-title');
    if (headers.length >= 2) {
        if (headers[0].textContent.includes('Pillbox') || headers[0].textContent.includes('Lingguhan')) headers[0].textContent = t('weeklyPillbox', lang);
        if (headers[1].textContent.includes('Doses') || headers[1].textContent.includes('Dosis')) headers[1].textContent = t('todaysDoses', lang);
    }

    document.querySelectorAll('.toggle-text').forEach(label => {
        if (label.textContent.includes('Browser')) label.textContent = t('browserNotifs', lang);
        if (label.textContent.includes('Email')) label.textContent = t('emailReminders', lang);
        if (label.textContent.includes('Sound')) label.textContent = t('soundVibration', lang);
    });
}

function applyTextSize() {
    const size = state.textSize || 16;
    // Apply the size to the HTML root element
    document.documentElement.style.fontSize = size + 'px';

    // Update slider UI
    if (elements.textSizeSlider) elements.textSizeSlider.value = size;
    if (elements.textSizeValue) elements.textSizeValue.textContent = size + 'px';
}

// ---- Splash ----
(function runSplash() {
    const s = document.getElementById('splashScreen');
    if (!s) return;
    setTimeout(() => s.classList.add('hiding'), 1500);
    setTimeout(() => { if (s.parentNode) s.parentNode.removeChild(s); }, 2200);
})();

// ============================================================
// FIRST-RUN FLOW: Welcome → Role → Tutorial prompt → Tutorial
// ============================================================
const WELCOME_KEY  = 'alagaTapWelcomed';
const ROLE_KEY     = 'alagaTapUserRole';
const TUTORIAL_KEY = 'alagaTapTutorialSeen';

let currentTutorialSlide = 0;
const TOTAL_TUTORIAL_SLIDES = 7;

function shouldRunFirstRun() {
    return localStorage.getItem(WELCOME_KEY) !== 'true';
}

function openWelcomeModal() {
    const modal = document.getElementById('welcomeModal');
    const roleScreen = document.getElementById('welcomeScreenRole');
    const tourScreen = document.getElementById('welcomeScreenTour');
    if (!modal) return;

    roleScreen.classList.remove('hidden');
    tourScreen.classList.add('hidden');
    openModal(modal);
}

function closeWelcomeModal() {
    const modal = document.getElementById('welcomeModal');
    if (modal) closeModal(modal);
}

function pickRole(role) {
    localStorage.setItem(ROLE_KEY, role);
    console.log('[AlagaTap] User role:', role);

    // Move to tour prompt screen
    document.getElementById('welcomeScreenRole').classList.add('hidden');
    document.getElementById('welcomeScreenTour').classList.remove('hidden');
}

function finishFirstRun() {
    localStorage.setItem(WELCOME_KEY, 'true');
    closeWelcomeModal();
}

function openTutorial(startSlide) {
    currentTutorialSlide = startSlide || 0;
    updateTutorialSlide();
    openModal(document.getElementById('tutorialModal'));
}

function closeTutorial() {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    closeModal(document.getElementById('tutorialModal'));
}

function updateTutorialSlide() {
    document.querySelectorAll('.tutorial-slide').forEach((slide, idx) => {
        slide.classList.toggle('hidden', idx !== currentTutorialSlide);
    });
    document.querySelectorAll('.progress-dot').forEach((dot, idx) => {
        dot.classList.toggle('active', idx === currentTutorialSlide);
    });

    const backBtn = document.getElementById('tutorialBack');
    const nextBtn = document.getElementById('tutorialNext');
    backBtn.style.visibility = currentTutorialSlide === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = currentTutorialSlide === TOTAL_TUTORIAL_SLIDES - 1
        ? 'Get Started'
        : 'Next';
}

function nextTutorialSlide() {
    if (currentTutorialSlide < TOTAL_TUTORIAL_SLIDES - 1) {
        currentTutorialSlide++;
        updateTutorialSlide();
    } else {
        closeTutorial();
        showToast('Welcome to AlagaTap!');
    }
}

function prevTutorialSlide() {
    if (currentTutorialSlide > 0) {
        currentTutorialSlide--;
        updateTutorialSlide();
    }
}

function setupFirstRunListeners() {
    // Role buttons
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', () => pickRole(btn.dataset.role));
    });

    // Skip setup
    document.getElementById('welcomeSkip')?.addEventListener('click', finishFirstRun);

    // Tour prompt actions
    document.getElementById('tourSkip')?.addEventListener('click', finishFirstRun);
    document.getElementById('tourStart')?.addEventListener('click', () => {
        finishFirstRun();
        setTimeout(() => openTutorial(0), 250);
    });

    // Tutorial nav
    document.getElementById('tutorialNext')?.addEventListener('click', nextTutorialSlide);
    document.getElementById('tutorialBack')?.addEventListener('click', prevTutorialSlide);
    document.getElementById('tutorialClose')?.addEventListener('click', closeTutorial);

    // Help button → help menu
    document.getElementById('helpBtn')?.addEventListener('click', () => {
        openModal(document.getElementById('helpMenuModal'));
    });

    // Help menu → replay tour
    document.getElementById('replayTourBtn')?.addEventListener('click', () => {
        closeModal(document.getElementById('helpMenuModal'));
        setTimeout(() => openTutorial(0), 250);
    });

    // Help menu → feature guide
    document.getElementById('featureGuideBtn')?.addEventListener('click', () => {
        closeModal(document.getElementById('helpMenuModal'));
        setTimeout(() => {
            openModal(document.getElementById('featureGuideModal'));
        }, 250);
    });

    // Keyboard nav (nice-to-have)
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('tutorialModal');
        if (!modal || modal.classList.contains('hidden')) return;
        if (e.key === 'ArrowRight') nextTutorialSlide();
        if (e.key === 'ArrowLeft')  prevTutorialSlide();
        if (e.key === 'Escape')     closeTutorial();
    });
}

// ---- DOM ----
const elements = {
    themeToggle: document.getElementById('themeToggle'),
    langToggle: document.getElementById('langToggle'),
    textSizeSlider: document.getElementById('textSizeSlider'),
    textSizeValue: document.getElementById('textSizeValue'),
    settingsBtn: document.getElementById('settingsBtn'),
    printBtn: document.getElementById('printBtn'),
    printContainer: document.getElementById('printContainer'),
    printBody: document.getElementById('printBody'),
    printDate: document.getElementById('printDate'),
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
    medNotes: document.getElementById('medNotes'),
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
    heroGreeting: document.getElementById('heroGreeting'),
    heroStreak: document.getElementById('heroStreak'),
    toastContainer: document.getElementById('toastContainer'),
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

// ============================================================
// UNDO SYSTEM
// ============================================================
let lastAction = null;
let undoTimer = null;

function snapshotBeforeLog(medId, date) {
    const med = state.medications.find(m => m.id === medId);
    if (!med) return null;

    const prevLog = state.logs.find(l => l.medicationId === medId && l.date === date);

    return {
        medId,
        date,
        prevInventory: med.inventory,
        prevLog: prevLog ? JSON.parse(JSON.stringify(prevLog)) : null,
        capturedAt: Date.now()
    };
}

function performUndo() {
    if (!lastAction) return;

    const { medId, date, prevInventory, prevLog } = lastAction;

    // Restore inventory
    const med = state.medications.find(m => m.id === medId);
    if (med) med.inventory = prevInventory;

    // Remove the action's log for this (medId, date)
    state.logs = state.logs.filter(l => !(l.medicationId === medId && l.date === date));

    // Restore the previous log if it existed
    if (prevLog) state.logs.push(prevLog);

    lastAction = null;
    if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }

    saveState(state);
    renderAll();

    showToast('Undone.', { type: 'warning', duration: 2000 });
}

// Called by logDose before mutating state
function captureUndo(snapshot) {
    lastAction = snapshot;
    if (undoTimer) clearTimeout(undoTimer);
    undoTimer = setTimeout(() => { lastAction = null; }, 6500);
}

// ---- Theme ----
function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    if (elements.themeToggle) elements.themeToggle.checked = theme === 'dark';
    saveState(state);
}

// ---- Render ----
function renderAll() {
    renderHero(state, elements);
    renderPillboxGrid(state, elements, {
        onCellClick:   openCompartmentModal,
        onSwipeTaken:  dateSwipeTaken,
        onSwipeMissed: dateSwipeMissed
    });
    renderTodayList(state, elements, {
        onLogDose:    openDosePickerAt,
        onSkipDose:   quickSkipToday,
        onRefill:     refillMedication,       // ← new
        onEditMed:    openEditModal,
        onDeleteMed:  openDeleteModal,
        onAddClick:   () => { resetMedicationForm(); openModal(elements.medicationModal); }
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

function quickSkipToday(medId) {
    const med = state.medications.find(m => m.id === medId);
    if (!med) return;

    // If already logged today, ask before overwriting
    const todayStr = getTodayStr();
    const existing = state.logs.find(l =>
        l.medicationId === medId && l.date === todayStr
    );

    if (existing && existing.status !== 'skipped') {
        const ok = confirm(
            'Today\'s ' + med.name + ' is already marked as ' +
            (existing.status || 'taken') + '.\n\nChange to Skipped?'
        );
        if (!ok) return;
    }

    logDose(medId, todayStr, 'skipped');
}

// ---- CRUD ----
function addMedication(data) {
    state.medications.push({
        id: generateId(),
        name: data.name.trim(),
        dosage: data.dosage.trim(),
        notes: data.notes,
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
    med.notes = data.notes;
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
    const isToday  = date === todayStr;

    const existingLog = state.logs.find(l => l.medicationId === medId && l.date === date);
    const existingStatus = existingLog ? (existingLog.status || 'taken') : null;

    if (status === 'taken' && isToday && existingStatus !== 'taken' &&
        state.cooldownUntil && Date.now() < state.cooldownUntil) {
        const remaining = Math.ceil((state.cooldownUntil - Date.now()) / 1000);
        showToast('Cooldown active — wait ' + remaining + 's before logging another taken dose.', {
            type: 'warning'
        });
        return;
    }

    // === Capture undo snapshot BEFORE mutating ===
    const snapshot = snapshotBeforeLog(medId, date);

    // ---- Inventory adjustments ----
    if (existingStatus === 'taken' && status !== 'taken') {
        // Refund: was taken, now not taken
        med.inventory = Math.min(med.maxInventory || 14, med.inventory + 1);
    } else if (existingStatus !== 'taken' && status === 'taken') {
        // Deduct: being marked as taken
        if (med.inventory <= 0) {
            alert('No doses remaining. Please refill this medication.');
            return;
        }
        med.inventory = Math.max(0, med.inventory - 1);
    }
    // (skipped ↔ missed or same → same: no change)

    // Replace any existing log for this (medId, date)
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

    // Cooldown only starts on a fresh 'taken' for today
    if (status === 'taken' && isToday) {
        state.cooldownUntil = Date.now() + 5 * 60 * 1000;
        startCooldownTimer();
    }

    state.lastDoseTimestamp = new Date().toISOString();
    saveState(state);
    renderAll();

    // Refresh picker if open
    if (!elements.dosePickerModal.classList.contains('hidden')) {
        renderDosePickerList(state, elements, date, med.slot);
    }

    const when = isToday ? '' : ' for ' + formatDateShort(date);
    const statusText = status === 'taken' ? 'taken'
                     : status === 'skipped' ? 'skipped'
                     : 'missed';
    const verb = 'marked as ' + statusText;

    showToast(
        getSlotLabel(med.slot) + ' ' + med.name + ' ' + verb + when + '.',
        {
            type: status === 'taken' ? 'success'
                : status === 'skipped' ? 'warning'
                : 'error',
            duration: 6500,
            action: {
                label: 'Undo',
                onClick: performUndo
            }
        }
    );

    if (snapshot) captureUndo(snapshot);
    feedbackSuccess(status);

    if (notificationManager && typeof notificationManager.updateBadge === 'function') {
        notificationManager.updateBadge();
    }

}

window.logDoseFromAlert = function (medId, date, status) {
    logDose(medId, date, status);
};

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
    elements.medNotes.value = med.notes || '';
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
    elements.medNotes.value = '';
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

// ============================================================
// CALENDAR EXPORT (.ics)
// ============================================================
const DAY_ICS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function pad2(n) { return String(n).padStart(2, '0'); }

function formatICSDate(date, utc) {
    const y = utc ? date.getUTCFullYear() : date.getFullYear();
    const mo = utc ? date.getUTCMonth() + 1 : date.getMonth() + 1;
    const d = utc ? date.getUTCDate() : date.getDate();
    const h = utc ? date.getUTCHours() : date.getHours();
    const mi = utc ? date.getUTCMinutes() : date.getMinutes();
    const s = utc ? date.getUTCSeconds() : date.getSeconds();
    return y + pad2(mo) + pad2(d) + 'T' + pad2(h) + pad2(mi) + pad2(s) + (utc ? 'Z' : '');
}

function escapeICS(str) {
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

function foldLine(line) {
    // Fold at 75 octets per RFC 5545, continuation lines start with a space
    const bytes = new TextEncoder().encode(line);
    if (bytes.length <= 75) return line;
    const out = [];
    let start = 0;
    while (start < line.length) {
        let end = Math.min(start + 75, line.length);
        out.push((start === 0 ? '' : ' ') + line.slice(start, end));
        start = end;
    }
    return out.join('\r\n');
}

function generateICS(medications, reminderMinutes) {
    const now = new Date();
    const dtstamp = formatICSDate(now, true);
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//AlagaTap//Medication Reminders//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
    ];

    medications.forEach(med => {
        if (!Array.isArray(med.days) || med.days.length === 0) return;
        if (!med.time) return;

        const [hh, mm] = med.time.split(':').map(Number);

        // First matching day on or after today
        let firstDate = null;
        for (let offset = 0; offset < 7; offset++) {
            const cand = new Date(now);
            cand.setDate(now.getDate() + offset);
            cand.setHours(hh, mm, 0, 0);
            if (med.days.includes(cand.getDay())) {
                firstDate = cand;
                break;
            }
        }
        if (!firstDate) return;

        const dtstart = formatICSDate(firstDate, false);
        const byday = med.days.map(d => DAY_ICS[d]).join(',');

        lines.push('BEGIN:VEVENT');
        lines.push('UID:' + med.id + '@alagatap');
        lines.push('DTSTAMP:' + dtstamp);
        lines.push('DTSTART:' + dtstart);
        lines.push('RRULE:FREQ=WEEKLY;BYDAY=' + byday);
        lines.push('SUMMARY:' + escapeICS('Take ' + med.name + ' (' + med.dosage + ')'));
        lines.push('DESCRIPTION:' + escapeICS(
            'Slot: ' + getSlotLabel(med.slot) + '. Dosage: ' + med.dosage +
            '. Log your dose in AlagaTap.'
        ));

        // Pre-alert
        lines.push('BEGIN:VALARM');
        lines.push('ACTION:DISPLAY');
        lines.push('DESCRIPTION:' + escapeICS(med.name + ' in ' + reminderMinutes + ' min'));
        lines.push('TRIGGER:-PT' + reminderMinutes + 'M');
        lines.push('END:VALARM');

        // On-time alert
        lines.push('BEGIN:VALARM');
        lines.push('ACTION:DISPLAY');
        lines.push('DESCRIPTION:' + escapeICS('Take ' + med.name + ' now'));
        lines.push('TRIGGER:PT0M');
        lines.push('END:VALARM');

        lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');

    // Fold and join with CRLF
    return lines.map(foldLine).join('\r\n') + '\r\n';
}

function exportCalendar() {
    if (!state.medications || state.medications.length === 0) {
        showToast('Add a medication first, then export again.', { type: 'warning' });
        return;
    }

    const reminderMinutes = 3;
    const ics = generateICS(state.medications, reminderMinutes);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alagatap-reminders.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast('Calendar file downloaded. Open it in your calendar app.', { type: 'success' });
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

// ============================================================
// TOAST (stackable, with optional Undo action)
// ============================================================
function showToast(message, options) {
    options = options || {};
    const duration = options.duration != null ? options.duration : 3000;
    const type     = options.type || 'default';
    const action   = options.action || null;   // { label, onClick }

    const container = elements.toastContainer || document.body;
    const toast = document.createElement('div');
    toast.className = 'toast-notification' +
        (type !== 'default' ? ' ' + type : '');

    const msg = document.createElement('span');
    msg.className = 'toast-msg';
    msg.textContent = message;
    toast.appendChild(msg);

    let dismissTimer = null;

    function dismiss() {
        if (dismissTimer) clearTimeout(dismissTimer);
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.25s ease';
        setTimeout(() => toast.remove(), 260);
    }

    if (action) {
        const btn = document.createElement('button');
        btn.className = 'toast-action';
        btn.textContent = action.label;
        btn.addEventListener('click', () => {
            try { action.onClick(); } catch (err) { console.warn(err); }
            dismiss();
        });
        toast.appendChild(btn);
    }

    container.appendChild(toast);

    if (duration > 0) {
        dismissTimer = setTimeout(dismiss, duration);
    }
}

// ============================================================
// FEEDBACK — vibration + subtle sound on log actions
// ============================================================
let audioCtx = null;

function feedbackSuccess(status) {
    // Vibration
    if (navigator.vibrate) {
        if (status === 'taken')   navigator.vibrate([20, 40, 20]);
        else if (status === 'skipped') navigator.vibrate(15);
        else /* missed */         navigator.vibrate([30, 50, 30]);
    }

    // Sound — only if the user has interacted (AudioContext policy)
    try {
        if (!audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            audioCtx = new Ctx();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        // Different tone per status
        osc.type = 'sine';
        osc.frequency.value =
            status === 'taken'   ? 880 :
            status === 'skipped' ? 660 : 440;

        const now = audioCtx.currentTime;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

        osc.start(now);
        osc.stop(now + 0.2);
    } catch (e) {
        /* silent fail — feedback is a bonus, not critical */
    }
}

// ============================================================
// SWIPE-TO-LOG HANDLERS
// ============================================================
function dateSwipeTaken(date, slot) {
    // Find the first scheduled med in that slot+date
    const dow = new Date(date + 'T12:00:00').getDay();
    const candidates = state.medications.filter(m =>
        m.slot === slot && Array.isArray(m.days) && m.days.includes(dow)
    );
    if (candidates.length === 0) return;

    const target = candidates[0];
    logDose(target.id, date, 'taken');
}

function dateSwipeMissed(date, slot) {
    const dow = new Date(date + 'T12:00:00').getDay();
    const candidates = state.medications.filter(m =>
        m.slot === slot && Array.isArray(m.days) && m.days.includes(dow)
    );
    if (candidates.length === 0) return;

    const target = candidates[0];
    logDose(target.id, date, 'missed');
}

// ============================================================
// REFILL
// ============================================================
function refillMedication(medId) {
    const med = state.medications.find(m => m.id === medId);
    if (!med) return;

    const max = med.maxInventory || 14;
    if (med.inventory >= max) {
        showToast(med.name + ' is already full.', { duration: 2000 });
        return;
    }

    const previous = med.inventory;
    med.inventory = max;

    saveState(state);
    renderAll();

    showToast(
        med.name + ' refilled to ' + max + ' doses.',
        {
            type: 'success',
            duration: 6500,
            action: {
                label: 'Undo',
                onClick: () => {
                    med.inventory = previous;
                    saveState(state);
                    renderAll();
                    showToast('Refill undone.', { type: 'warning', duration: 2000 });
                }
            }
        }
    );
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
            notes: elements.medNotes.value.trim(),
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

    // First-run flow setup
    setupFirstRunListeners();

    elements.settingsBtn?.addEventListener('click', () => {
        openModal(document.getElementById('settingsModal'));
    });

    setTheme(state.theme || 'light');

    elements.langToggle?.addEventListener('change', e => {
        state.language = e.target.checked ? 'tl' : 'en';
        saveState(state);
        applyLanguage();
        renderAll();
    });

    // Text Size Slider
    if (elements.textSizeSlider) {
        // Live update as they drag
        elements.textSizeSlider.addEventListener('input', e => {
            const newSize = parseInt(e.target.value, 10);
            state.textSize = newSize;
            applyTextSize();
        });

        // Save to localStorage when they release the slider
        elements.textSizeSlider.addEventListener('change', () => {
            saveState(state);
        });
    }

    applyLanguage();
    applyTextSize();

    elements.printBtn?.addEventListener('click', () => {
        if (state.medications.length === 0) {
            showToast('No medications to print.', { type: 'warning' });
            return;
        }

        elements.printDate.textContent = 'Generated: ' + new Date().toLocaleDateString();
        elements.printBody.innerHTML = state.medications.map(med => {
            const days = getDaysLabel(med);
            const schedule = `${days} at ${formatTime(med.time)} (${getSlotLabel(med.slot)})`;
            return `<tr>
                <td><strong>${med.name}</strong></td>
                <td>${med.dosage}</td>
                <td>${schedule}</td>
                <td>${med.notes || '—'}</td>
            </tr>`;
        }).join('');
        window.print();
    });

    elements.themeToggle?.addEventListener('change', e => {
        setTheme(e.target.checked ? 'dark' : 'light');
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
    document.getElementById('exportIcsBtn')?.addEventListener('click', exportCalendar);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = navigator.standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isStandalone) {
        const hint = document.getElementById('icsHint');
        if (hint) hint.style.display = 'block';
    }
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

    // Trigger the welcome flow on first visit (after splash fades)
    if (shouldRunFirstRun()) {
        setTimeout(openWelcomeModal, 2400);
    }

    setInterval(() => {
        renderAll();
        checkMidnightReset();
    }, 30000);
}

document.addEventListener('DOMContentLoaded', init);