// js/components.js

import {
    formatTime, formatDateTime, formatDateShort,
    getTodayStr, getTodayDay, getDatesOfThisWeek,
    getStatusText, getLastDoseTime, isMedToday, isOverdue,
    getSlotLabel, getAdherenceStats, getLogsForSummary,
    buildLogIndex, isLogged,
    DAY_SHORT, DAY_COLORS, SLOT_ORDER, SLOT_LABELS
} from './utils.js';

// ================= HERO =================
export function renderHero(state, elements) {
    const { statusText, status } = getStatusText(state);
    const lastDose = getLastDoseTime(state);

    elements.statusDot.className = 'status-dot ' + status;
    elements.statusText.textContent = statusText;
    elements.heroTimestamp.textContent = lastDose
        ? 'Last dose: ' + formatDateTime(lastDose)
        : 'No doses recorded yet';
}

// ================= PILLBOX GRID =================
export function renderPillboxGrid(state, elements, callbacks) {
    const grid = elements.pillboxGrid;
    if (!grid) return;

    const todayDay = getTodayDay();
    const weekDates = getDatesOfThisWeek();    // Sun..Sat
    const logIndex = buildLogIndex(state.logs); // Set of "medId|date"

    let html = '';

    // Header: 7 day headers with the day-of-month under each
    html += '<div class="pillbox-row pillbox-header-row">';
    for (let d = 0; d < 7; d++) {
        const isToday = d === todayDay;
        const cls = 'pillbox-day-header' + (isToday ? ' is-today' : '');
        const dayNum = new Date(weekDates[d] + 'T12:00:00').getDate();
        html += '<div class="' + cls + '" style="background:' + DAY_COLORS[d] + ';" data-day="' + d + '">' +
                    '<div class="pillbox-day-name">' + DAY_SHORT[d] + '</div>' +
                    '<div class="pillbox-day-num">' + dayNum + '</div>' +
                '</div>';
    }
    html += '</div>';

    // 3 slot rows
    SLOT_ORDER.forEach(slot => {
        html += '<div class="pillbox-rowlabel">' + SLOT_LABELS[slot] + '</div>';
        html += '<div class="pillbox-row">';

        for (let d = 0; d < 7; d++) {
            const cellDate = weekDates[d];
            const cellMeds = state.medications.filter(m =>
                m.slot === slot &&
                Array.isArray(m.days) && m.days.includes(d)
            );
            const isToday = d === todayDay;

            // A cell is "logged" ONLY if every med in it has a log for this exact date
            const cellLogged = cellMeds.length > 0 && cellMeds.every(m =>
                isLogged(logIndex, m.id, cellDate)
            );

            const cellOverdue = isToday && cellMeds.some(m =>
                !isLogged(logIndex, m.id, cellDate) && isOverdue(m)
            );

            const dayColor = DAY_COLORS[d];
            let cls = 'pillbox-cell';
            if (cellMeds.length > 0) cls += ' has-meds';
            if (isToday) cls += ' is-today';
            if (cellLogged) cls += ' is-logged';
            if (cellOverdue) cls += ' is-overdue';

            const style = cellMeds.length > 0
                ? 'background:' + dayColor + '22; border-color:' + dayColor + '; color:' + dayColor + ';'
                : '';

            let inner = '';
            if (cellMeds.length > 0) {
                inner += '<span class="pillbox-count">' + cellMeds.length + '</span>';
            }
            if (cellLogged) {
                inner += '<svg class="pillbox-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">' +
                            '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>' +
                         '</svg>';
            }

            html += '<button type="button" class="' + cls + '" style="' + style + '" ' +
                        'data-day="' + d + '" data-slot="' + slot + '" data-date="' + cellDate + '" ' +
                        'aria-label="' + SLOT_LABELS[slot] + ' on ' + DAY_SHORT[d] + '">' +
                        inner +
                    '</button>';
        }
        html += '</div>';
    });

    grid.innerHTML = html;

    grid.querySelectorAll('.pillbox-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            callbacks.onCellClick(
                parseInt(cell.dataset.day, 10),
                cell.dataset.slot,
                cell.dataset.date
            );
        });
    });
}

// ================= TODAY'S DOSES =================
export function renderTodayList(state, elements, callbacks) {
    const list = elements.compartmentList;
    if (!list) return;

    const todayStr = getTodayStr();
    const todayDay = getTodayDay();
    const logIndex = buildLogIndex(state.logs);
    const todayMeds = state.medications.filter(isMedToday);

    if (todayMeds.length === 0) {
        list.innerHTML = '<div class="compartment-card empty-card">No doses scheduled for today. Tap <strong>Add</strong> to schedule one.</div>';
        return;
    }

    // Earliest scheduled time first
    todayMeds.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    list.innerHTML = todayMeds.map(med => {
        const logged = isLogged(logIndex, med.id, todayStr);
        const overdue = !logged && isOverdue(med);
        const low = med.inventory <= 3;
        const out = med.inventory <= 0;
        const dayColor = DAY_COLORS[todayDay];

        return `
            <div class="compartment-card" data-med-id="${med.id}" style="border-left: 4px solid ${dayColor};">
                <div class="compartment-info">
                    <div>
                        <span class="compartment-tag" style="background:${dayColor}; color:#fff;">
                            ${getSlotLabel(med.slot)}
                        </span>
                        <span class="compartment-name">${med.name}</span>
                        ${overdue ? '<span style="color:#FF5252;font-size:12px;margin-left:6px;">(Overdue)</span>' : ''}
                        ${logged ? '<span style="color:#00E5A3;font-size:12px;margin-left:6px;">&#10003; Logged</span>' : ''}
                    </div>
                    <div class="compartment-detail">${med.dosage} &middot; ${formatTime(med.time)}</div>
                    <div class="compartment-inventory">
                        ${out ? 'Out of stock' :
                          low ? 'Refill needed: ' + med.inventory + ' doses left' :
                                med.inventory + ' doses remaining'}
                    </div>
                </div>
                <div class="compartment-actions">
                    <button class="btn-icon log-dose-btn" data-med-id="${med.id}" title="Log dose" ${logged ? 'disabled style="opacity:.4;"' : ''}>
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </button>
                    <button class="btn-icon edit-med-btn" data-med-id="${med.id}" title="Edit">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>
                        </svg>
                    </button>
                    <button class="btn-icon delete-med-btn" data-med-id="${med.id}" title="Delete">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.log-dose-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            callbacks.onLogDose(btn.dataset.medId);
        });
    });
    list.querySelectorAll('.edit-med-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            callbacks.onEditMed(btn.dataset.medId);
        });
    });
    list.querySelectorAll('.delete-med-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            callbacks.onDeleteMed(btn.dataset.medId);
        });
    });
}

// ================= WARNINGS =================
export function renderWarnings(state, elements) {
    const todayStr = getTodayStr();
    const logIndex = buildLogIndex(state.logs);
    const overdueMeds = state.medications.filter(med => {
        if (!isMedToday(med)) return false;
        if (isLogged(logIndex, med.id, todayStr)) return false;
        return isOverdue(med);
    });

    if (overdueMeds.length > 0) {
        elements.warningBanner.classList.remove('hidden');
        elements.warningBanner.classList.add('overdue');
        elements.warningText.textContent = 'Overdue: ' + overdueMeds.map(m => m.name).join(', ');
    } else {
        elements.warningBanner.classList.add('hidden');
        elements.warningBanner.classList.remove('overdue');
    }
}

// ================= REFILL =================
export function renderRefillAlert(state, elements) {
    const lowMeds = state.medications.filter(m => m.inventory <= 3 && m.inventory > 0);
    const emptyMeds = state.medications.filter(m => m.inventory <= 0);

    if (emptyMeds.length > 0) {
        elements.refillAlert.classList.remove('hidden');
        elements.refillMessage.textContent = 'Out of stock: ' + emptyMeds.map(m => m.name).join(', ');
        elements.refillAlert.style.borderColor = '#FF5252';
    } else if (lowMeds.length > 0) {
        elements.refillAlert.classList.remove('hidden');
        elements.refillMessage.textContent = 'Low inventory: ' + lowMeds.map(m => m.name + ' (' + m.inventory + ' left)').join(', ');
        elements.refillAlert.style.borderColor = '#FFB800';
    } else {
        elements.refillAlert.classList.add('hidden');
    }
}

// ================= HISTORY =================
export function renderHistory(state, elements, isOpen) {
    const list = elements.historyList;
    const arrow = elements.historyArrow;

    if (!isOpen) {
        list.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
        return;
    }
    list.classList.remove('hidden');
    arrow.style.transform = 'rotate(180deg)';

    if (state.logs.length === 0) {
        list.innerHTML = '<div class="history-item" style="justify-content:center;color:var(--text-muted);">No intake history yet</div>';
        return;
    }

    const sorted = [...state.logs].sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    ).slice(0, 30);

    list.innerHTML = sorted.map(log => {
        const med = state.medications.find(m => m.id === log.medicationId);
        const name = med ? med.name : 'Unknown';
        const slot = med ? getSlotLabel(med.slot) : '?';
        const forDate = log.date ? formatDateShort(log.date) : '--';
        return `<div class="history-item">
            <span><span class="compartment">${slot}</span> ${name} &middot; for ${forDate}</span>
            <span class="date">${formatDateTime(log.timestamp)}</span>
        </div>`;
    }).join('');
}

// ================= SUMMARY =================
export function renderSummary(state, elements) {
    const stats = getAdherenceStats(state);
    const logs = getLogsForSummary(state);

    elements.totalScheduled.textContent = stats.totalScheduled;
    elements.totalReported.textContent = stats.totalReported;
    elements.adherenceRate.textContent = stats.adherenceRate + '%';

    if (logs.length === 0) {
        elements.summaryHistory.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:16px;">No logs in this period</div>';
        return;
    }

    elements.summaryHistory.innerHTML = logs.map(log => {
        const med = state.medications.find(m => m.id === log.medicationId);
        const name = med ? med.name : 'Unknown';
        const slot = med ? getSlotLabel(med.slot) : '?';
        const forDate = log.date ? formatDateShort(log.date) : '--';
        return `<div class="history-item">
            <span>${slot} &middot; ${name} &middot; for ${forDate}</span>
            <span class="date">${formatDateTime(log.timestamp)}</span>
        </div>`;
    }).join('');
}

// ================= COOLDOWN =================
export function updateCooldown(state, elements) {
    const now = Date.now();
    const cooldown = state.cooldownUntil || 0;
    const indicator = elements.cooldownIndicator;
    const timer = elements.cooldownTimer;
    const recordBtn = elements.recordDoseBtn;

    if (cooldown > now) {
        indicator.classList.remove('hidden');
        timer.textContent = Math.ceil((cooldown - now) / 1000);
        recordBtn.disabled = true;
        recordBtn.style.opacity = '0.5';
        recordBtn.style.cursor = 'not-allowed';
    } else {
        indicator.classList.add('hidden');
        recordBtn.disabled = false;
        recordBtn.style.opacity = '1';
        recordBtn.style.cursor = 'pointer';
    }
}