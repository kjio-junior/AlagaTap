// js/components.js — Rendering

import {
    formatTime, formatDateTime, formatDateShort,
    getTodayStr, getTodayDay, getDatesOfThisWeek,
    getStatusText, getLastDoseTime, isMedToday, isOverdue,
    getSlotLabel, getAdherenceStats, getLogsForSummary,
    buildLogIndex, isLogged,
    buildLogStatusMap,
    DAY_SHORT, DAY_COLORS, SLOT_ORDER, SLOT_LABELS,
    getGreeting, getStreak
} from './utils.js';

// ================= HERO =================
export function renderHero(state, elements) {
    const { statusText, status } = getStatusText(state);
    const lastDose = getLastDoseTime(state);

    // Greeting
    if (elements.heroGreeting) {
        elements.heroGreeting.textContent = getGreeting();
    }

    // Streak
    if (elements.heroStreak) {
        const streak = getStreak(state);
        if (streak >= 2) {
            elements.heroStreak.classList.remove('hidden');
            elements.heroStreak.innerHTML =
                '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
                    '<path d="M12.75 3.75a.75.75 0 00-1.5 0v.75H7.5A2.25 2.25 0 005.25 6.75v10.5A2.25 2.25 0 007.5 19.5h9a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0016.5 4.5h-3.75v-.75zM9 9.75h6M9 13.5h6M9 17.25h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>' +
                    '<path d="M12.5 8.25l-1.5 3h2.25l-1.5 3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
                '</svg>' +
                streak + ' day streak';
        } else {
            elements.heroStreak.classList.add('hidden');
        }
    }

    elements.statusDot.className = 'status-dot ' + status;
    elements.statusText.textContent = statusText;
    elements.heroTimestamp.textContent = lastDose
        ? 'Last dose: ' + formatDateTime(lastDose)
        : 'No doses recorded yet';
}

// ================= SWIPE-TO-LOG =================
// Right swipe = Taken. Left swipe = Missed.
// Threshold: 55px of horizontal travel.
const SWIPE_THRESHOLD = 55;
const SWIPE_MAX_VERTICAL = 40;

function attachSwipeHandlers(cell, date, callbacks) {
    let startX = 0, startY = 0, currentX = 0, swiping = false, cancelled = false;

    cell.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        currentX = startX;
        swiping = false;
        cancelled = false;
    }, { passive: true });

    cell.addEventListener('touchmove', e => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;

        // If user moves vertically first, cancel — they're scrolling
        if (!swiping && Math.abs(dy) > SWIPE_MAX_VERTICAL) {
            cancelled = true;
            return;
        }

        if (Math.abs(dx) > 10) {
            swiping = true;
            e.preventDefault();
        }

        if (!swiping || cancelled) return;

        currentX = t.clientX;
        const clamped = Math.max(-90, Math.min(90, dx));
        cell.style.transform = 'translateX(' + clamped + 'px)';

        cell.classList.toggle('swiping-right', dx > 0);
        cell.classList.toggle('swiping-left', dx < 0);
        cell.classList.toggle('swipe-taken', dx > SWIPE_THRESHOLD);
        cell.classList.toggle('swipe-missed', dx < -SWIPE_THRESHOLD);
    }, { passive: false });

    cell.addEventListener('touchend', () => {
        const dx = currentX - startX;

        cell.style.transform = '';
        cell.classList.remove(
            'swiping-left', 'swiping-right',
            'swipe-taken', 'swipe-missed'
        );

        if (!swiping || cancelled) return;
        cell.dataset.swiped = '1';

        if (dx >= SWIPE_THRESHOLD) {
            if (typeof callbacks.onSwipeTaken === 'function') {
                callbacks.onSwipeTaken(date, cell.dataset.slot);
            }
        } else if (dx <= -SWIPE_THRESHOLD) {
            if (typeof callbacks.onSwipeMissed === 'function') {
                callbacks.onSwipeMissed(date, cell.dataset.slot);
            }
        }
    });

    cell.addEventListener('touchcancel', () => {
        cell.style.transform = '';
        cell.classList.remove(
            'swiping-left', 'swiping-right',
            'swipe-taken', 'swipe-missed'
        );
    });
}

// ================= PILLBOX GRID =================
export function renderPillboxGrid(state, elements, callbacks) {
    const grid = elements.pillboxGrid;
    if (!grid) return;

    const todayDay = getTodayDay();
    const weekDates = getDatesOfThisWeek();
    const statusMap = buildLogStatusMap(state.logs);

    let html = '';

    // Header row
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
                m.slot === slot && Array.isArray(m.days) && m.days.includes(d)
            );

            const statuses = cellMeds.map(m => statusMap.get(m.id + '|' + cellDate) || null);
            const allLogged = cellMeds.length > 0 && statuses.every(s => s !== null);
            const allTaken  = allLogged && statuses.every(s => s === 'taken');
            const anyMissed = statuses.some(s => s === 'missed');
            const anySkipped = statuses.some(s => s === 'skipped');
            const isToday   = d === todayDay;

            const cellOverdue = isToday && cellMeds.some(m =>
                !statusMap.has(m.id + '|' + cellDate) && isOverdue(m)
            );

            const dayColor = DAY_COLORS[d];
            let cls = 'pillbox-cell';
            if (cellMeds.length > 0) cls += ' has-meds';
            if (isToday) cls += ' is-today';
            if (allTaken) cls += ' is-logged';
            if (allLogged && anyMissed && !allTaken) cls += ' is-missed';
            if (allLogged && anySkipped && !anyMissed && !allTaken) cls += ' is-skipped';
            if (!allLogged && statuses.some(s => s !== null)) cls += ' is-partial';
            if (cellOverdue) cls += ' is-overdue';

            const style = cellMeds.length > 0
                ? 'background:' + dayColor + '22; border-color:' + dayColor + '; color:' + dayColor + ';'
                : '';

            let inner = '';
            if (cellMeds.length > 0) {
                inner += '<span class="pillbox-count">' + cellMeds.length + '</span>';
            }
            if (allTaken) {
                inner += '<svg class="pillbox-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">' +
                            '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>' +
                         '</svg>';
            } else if (allLogged && anyMissed) {
                inner += '<svg class="pillbox-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">' +
                            '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>' +
                         '</svg>';
            } else if (allLogged && anySkipped) {
                inner += '<svg class="pillbox-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
                            '<path d="M13 5l7 7-7 7M5 5l7 7-7 7"/>' +
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
        const day = parseInt(cell.dataset.day, 10);
        const slot = cell.dataset.slot;
        const date = cell.dataset.date;

        // Tap
        cell.addEventListener('click', e => {
            if (cell.dataset.swiped === '1') {
                cell.dataset.swiped = '0';
                return;
            }
            callbacks.onCellClick(day, slot, date);
        });

        // Swipe
        attachSwipeHandlers(cell, date, callbacks);
    });
}

// ================= TODAY'S DOSES =================
export function renderTodayList(state, elements, callbacks) {
    const list = elements.compartmentList;
    if (!list) return;

    const todayStr = getTodayStr();
    const todayDay = getTodayDay();
    const statusMap = buildLogStatusMap(state.logs);
    const todayMeds = state.medications.filter(isMedToday);

    if (todayMeds.length === 0) {
        list.innerHTML = '<div class="compartment-card empty-card">No doses scheduled for today. Tap <strong>Add</strong> to schedule one.</div>';
        return;
    }

    todayMeds.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    list.innerHTML = todayMeds.map(med => {
        const status = statusMap.get(med.id + '|' + todayStr) || null;
        const overdue = !status && isOverdue(med);
        const low = med.inventory <= 3;
        const out = med.inventory <= 0;
        const dayColor = DAY_COLORS[todayDay];

        const takenBadge   = status === 'taken'   ? '<span class="status-badge taken">Taken</span>'   : '';
        const missedBadge  = status === 'missed'  ? '<span class="status-badge missed">Missed</span>' : '';
        const skippedBadge = status === 'skipped' ? '<span class="status-badge skipped">Skipped</span>' : '';
        const overdueTag   = overdue ? '<span style="color:#FF5252;font-size:12px;margin-left:6px;">(Overdue)</span>' : '';

        const canRefill = med.inventory < (med.maxInventory || 14);
        const refillBtn = canRefill
            ? `<button class="btn-icon refill-btn${low ? ' pulse' : ''}"
                       data-med-id="${med.id}"
                       title="Refill to ${med.maxInventory || 14} doses">
                   <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                       <path d="M4 4v6h6M20 20v-6h-6"/>
                       <path d="M20 10a8 8 0 00-14.93-4M4 14a8 8 0 0014.93 4"/>
                   </svg>
               </button>`
            : '';

        // Skip button only shows when today's dose is not yet recorded
        const skipQuickBtn = !status
            ? `<button class="btn-icon skip-dose-btn" data-med-id="${med.id}" title="Skip today's dose">
                   <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                       <path d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
                   </svg>
               </button>`
            : '';

        return `
            <div class="compartment-card" data-med-id="${med.id}" style="border-left: 4px solid ${dayColor};">
                <div class="compartment-info">
                    <div>
                        <span class="compartment-tag" style="background:${dayColor}; color:#fff;">
                            ${getSlotLabel(med.slot)}
                        </span>
                        <span class="compartment-name">${med.name}</span>
                        ${overdueTag}
                        ${takenBadge}
                        ${skippedBadge}
                        ${missedBadge}
                    </div>
                    <div class="compartment-detail">${med.dosage} &middot; ${formatTime(med.time)}</div>
                    <div class="compartment-inventory">
                        ${out ? 'Out of stock' :
                          low ? 'Refill needed: ' + med.inventory + ' doses left' :
                                med.inventory + ' doses remaining'}
                    </div>
                </div>
                <div class="compartment-actions">
                    <button class="btn-icon log-dose-btn" data-med-id="${med.id}" title="Log dose" ${status ? 'disabled style="opacity:.4;"' : ''}>
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </button>
                    ${refillBtn}
                    ${skipQuickBtn}
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
    list.querySelectorAll('.refill-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            if (typeof callbacks.onRefill === 'function') {
                callbacks.onRefill(btn.dataset.medId);
            }
        });
    });
    list.querySelectorAll('.skip-dose-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            if (typeof callbacks.onSkipDose === 'function') {
                callbacks.onSkipDose(btn.dataset.medId);
            }
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

// ================= DOSE PICKER LIST =================
// targetDate: 'YYYY-MM-DD' — defaults to today.
// filterSlot: 'morning' | 'noon' | 'night' — optional; defaults to all slots.
export function renderDosePickerList(state, elements, targetDate, filterSlot) {
    const list = elements.dosePickerList;
    if (!list) return;

    const dateStr   = targetDate || getTodayStr();
    const isToday   = dateStr === getTodayStr();
    const targetDay = new Date(dateStr + 'T12:00:00').getDay();
    const statusMap = buildLogStatusMap(state.logs);

    const medsForDate = state.medications.filter(m => {
        if (!Array.isArray(m.days) || !m.days.includes(targetDay)) return false;
        if (filterSlot && m.slot !== filterSlot) return false;
        return true;
    }).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    if (medsForDate.length === 0) {
        list.innerHTML = '<div class="picker-empty">No doses scheduled for ' +
            (isToday ? 'today' : formatDateShort(dateStr)) + '.</div>';
        return;
    }

    const headerHTML = !isToday
        ? '<div class="picker-date-header">Recording for <strong>' +
          formatDateShort(dateStr) + '</strong></div>'
        : '';

    const cooldownActive = state.cooldownUntil && Date.now() < state.cooldownUntil;

    list.innerHTML = headerHTML + medsForDate.map(med => {
        const status = statusMap.get(med.id + '|' + dateStr) || null;
        const rowCls = 'picker-row' +
            (status === 'taken'   ? ' is-taken'   : '') +
            (status === 'missed'  ? ' is-missed'  : '') +
            (status === 'skipped' ? ' is-skipped' : '');

        const takenActive   = status === 'taken'   ? ' is-active' : '';
        const missedActive  = status === 'missed'  ? ' is-active' : '';
        const skippedActive = status === 'skipped' ? ' is-active' : '';

        const takenDisabled = (cooldownActive && isToday && status !== 'taken') ? ' disabled' : '';
        const slotCls = 'picker-slot slot-' + med.slot;

        return `
            <div class="${rowCls}">
                <div class="picker-main">
                    <div class="picker-time">${formatTime(med.time)}</div>
                    <div class="picker-info">
                        <div class="picker-name">
                            <span class="${slotCls}">${getSlotLabel(med.slot)}</span>
                            ${med.name}
                        </div>
                        <div class="picker-detail">${med.dosage} · ${med.inventory} left</div>
                    </div>
                </div>
                <div class="picker-actions">
                    <button type="button" class="picker-btn taken${takenActive}"${takenDisabled}
                            data-med-id="${med.id}" data-date="${dateStr}" data-status="taken">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M5 13l4 4L19 7"/>
                        </svg>
                        Taken
                    </button>
                    <button type="button" class="picker-btn skipped${skippedActive}"
                            data-med-id="${med.id}" data-date="${dateStr}" data-status="skipped">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
                        </svg>
                        Skipped
                    </button>
                    <button type="button" class="picker-btn missed${missedActive}"
                            data-med-id="${med.id}" data-date="${dateStr}" data-status="missed">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                        Missed
                    </button>
                </div>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.picker-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            if (typeof elements.onPickerAction === 'function') {
                elements.onPickerAction(btn.dataset.medId, btn.dataset.date, btn.dataset.status);
            }
        });
    });
}

// ================= WARNINGS =================
export function renderWarnings(state, elements) {
    const todayStr = getTodayStr();
    const statusMap = buildLogStatusMap(state.logs);
    const overdueMeds = state.medications.filter(med => {
        if (!isMedToday(med)) return false;
        if (statusMap.has(med.id + '|' + todayStr)) return false;
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
        const status = log.status || 'taken';
        const badge = status === 'missed'
            ? '<span class="status-badge missed">Missed</span>'
            : status === 'skipped'
                ? '<span class="status-badge skipped">Skipped</span>'
                : '<span class="status-badge taken">Taken</span>';

        return `<div class="history-item">
            <span>
                <span class="compartment">${slot}</span>
                ${name}
                <span style="color:var(--text-muted);font-size:12px;"> · for ${forDate}</span>
                ${badge}
            </span>
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
        const status = log.status || 'taken';
        const badge = status === 'missed'
            ? '<span class="status-badge missed">Missed</span>'
            : status === 'skipped'
                ? '<span class="status-badge skipped">Skipped</span>'
                : '<span class="status-badge taken">Taken</span>';

        return `<div class="history-item">
            <span>${slot} · ${name} · for ${forDate} ${badge}</span>
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