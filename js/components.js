// js/components.js — Rendering

import {
    formatTime, formatDateTime, getTodayStr, getTodayDay,
    getStatusText, getLastDoseTime, isMedToday, isOverdue,
    getDaysLabel, getSlotLabel, getAdherenceStats, getLogsForSummary,
    DAY_SHORT, DAY_COLORS, SLOT_ORDER, SLOT_LABELS
} from './utils.js';

// ----- Hero ---------------------------------------------------------------
export function renderHero(state, elements) {
    const { statusText, status } = getStatusText(state);
    const lastDose = getLastDoseTime(state);

    elements.statusDot.className = 'status-dot ' + status;
    elements.statusText.textContent = statusText;
    elements.heroTimestamp.textContent = lastDose
        ? 'Last dose: ' + formatDateTime(lastDose)
        : 'No doses recorded yet';
}

// ----- Weekly Pillbox Grid ------------------------------------------------
export function renderPillboxGrid(state, elements, callbacks) {
    const grid = elements.pillboxGrid;
    if (!grid) return;

    const today = getTodayDay();
    const todayStr = getTodayStr();
    let html = '';

    // --- Header row: empty corner + 7 day headers ---
    html += '<div class="pillbox-row pillbox-header-row">';
    html += '<div class="pillbox-corner"></div>';
    for (let d = 0; d < 7; d++) {
        const isToday = d === today;
        const cls = 'pillbox-day-header' + (isToday ? ' is-today' : '');
        html += '<div class="' + cls + '" style="background:' + DAY_COLORS[d] + ';" ' +
                'data-day="' + d + '">' + DAY_SHORT[d] + '</div>';
    }
    html += '</div>';

    // --- 3 rows: morning / noon / night ---
    SLOT_ORDER.forEach(function (slot) {
        html += '<div class="pillbox-row">';
        html += '<div class="pillbox-rowlabel">' + SLOT_LABELS[slot] + '</div>';

        for (let d = 0; d < 7; d++) {
            const meds = state.medications.filter(function (m) {
                return m.slot === slot &&
                    Array.isArray(m.days) && m.days.includes(d);
            });
            const isToday = d === today;
            const isLogged = meds.length > 0 && meds.every(function (m) {
                return state.logs.some(function (l) {
                    return l.medicationId === m.id && l.timestamp.startsWith(todayStr);
                });
            });
            const anyOverdue = isToday && meds.some(function (m) {
                return isOverdue(m) && !state.logs.some(function (l) {
                    return l.medicationId === m.id && l.timestamp.startsWith(todayStr);
                });
            });

            const dayColor = DAY_COLORS[d];
            let cls = 'pillbox-cell';
            if (meds.length > 0) cls += ' has-meds';
            if (isToday) cls += ' is-today';
            if (isLogged) cls += ' is-logged';
            if (anyOverdue) cls += ' is-overdue';

            const style = meds.length > 0
                ? 'background:' + dayColor + '22; border-color:' + dayColor + '; color:' + dayColor + ';'
                : '';

            let inner = '';
            if (meds.length > 0) {
                inner += '<span class="pillbox-count">' + meds.length + '</span>';
            }
            if (isLogged) {
                inner += '<svg class="pillbox-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">' +
                         '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
            }

            html += '<button type="button" class="' + cls + '" style="' + style + '" ' +
                    'data-day="' + d + '" data-slot="' + slot + '" ' +
                    'aria-label="' + SLOT_LABELS[slot] + ' on ' + DAY_SHORT[d] + '">' +
                    inner + '</button>';
        }
        html += '</div>';
    });

    grid.innerHTML = html;

    grid.querySelectorAll('.pillbox-cell').forEach(function (cell) {
        cell.addEventListener('click', function () {
            callbacks.onCellClick(parseInt(cell.dataset.day, 10), cell.dataset.slot);
        });
    });
}

// ----- Today's Doses List -------------------------------------------------
export function renderTodayList(state, elements, callbacks) {
    const list = elements.compartmentList;
    if (!list) return;

    const todayMeds = state.medications.filter(isMedToday);
    const todayStr = getTodayStr();

    if (todayMeds.length === 0) {
        list.innerHTML = '<div class="compartment-card empty-card">' +
            'No doses scheduled for today. Tap <strong>Add</strong> to schedule one.' +
            '</div>';
        return;
    }

    // Sort by time
    todayMeds.sort(function (a, b) {
        return a.time.localeCompare(b.time);
    });

    list.innerHTML = todayMeds.map(function (med) {
        const loggedToday = state.logs.some(function (l) {
            return l.medicationId === med.id && l.timestamp.startsWith(todayStr);
        });
        const overdue = isOverdue(med) && !loggedToday;
        const low = med.inventory <= 3;
        const out = med.inventory <= 0;
        const dayColor = DAY_COLORS[getTodayDay()];

        const slotTagStyle =
            'background:' + dayColor + '; color:#fff;';

        return '' +
            '<div class="compartment-card" data-med-id="' + med.id + '" ' +
                 'style="border-left: 4px solid ' + dayColor + ';">' +
                '<div class="compartment-info">' +
                    '<div>' +
                        '<span class="compartment-tag" style="' + slotTagStyle + '">' +
                            getSlotLabel(med.slot) + '</span>' +
                        '<span class="compartment-name">' + med.name + '</span>' +
                        (overdue ? ' <span style="color:#FF5252;font-size:12px;margin-left:6px;">(Overdue)</span>' : '') +
                        (loggedToday ? ' <span style="color:#00E5A3;font-size:12px;margin-left:6px;">&#10003; Logged</span>' : '') +
                    '</div>' +
                    '<div class="compartment-detail">' +
                        med.dosage + ' &middot; ' + formatTime(med.time) +
                    '</div>' +
                    '<div class="compartment-inventory">' +
                        (out ? 'Out of stock' :
                         low ? 'Refill needed: ' + med.inventory + ' doses left' :
                               med.inventory + ' doses remaining') +
                    '</div>' +
                '</div>' +
                '<div class="compartment-actions">' +
                    '<button class="btn-icon log-dose-btn" data-med-id="' + med.id + '" ' +
                            'title="Log dose"' + (loggedToday ? ' disabled style="opacity:.4;"' : '') + '>' +
                        '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                            '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
                        '</svg>' +
                    '</button>' +
                    '<button class="btn-icon edit-med-btn" data-med-id="' + med.id + '" title="Edit">' +
                        '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                            '<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>' +
                        '</svg>' +
                    '</button>' +
                    '<button class="btn-icon delete-med-btn" data-med-id="' + med.id + '" title="Delete">' +
                        '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                            '<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79"/>' +
                        '</svg>' +
                    '</button>' +
                '</div>' +
            '</div>';
    }).join('');

    list.querySelectorAll('.log-dose-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            callbacks.onLogDose(btn.dataset.medId);
        });
    });
    list.querySelectorAll('.edit-med-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            callbacks.onEditMed(btn.dataset.medId);
        });
    });
    list.querySelectorAll('.delete-med-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (confirm('Delete this medication entry?')) {
                callbacks.onDeleteMed(btn.dataset.medId);
            }
        });
    });
}

// ----- Warnings -----------------------------------------------------------
export function renderWarnings(state, elements) {
    const todayStr = getTodayStr();
    const overdueMeds = state.medications.filter(function (med) {
        if (!isMedToday(med)) return false;
        const logged = state.logs.some(function (l) {
            return l.medicationId === med.id && l.timestamp.startsWith(todayStr);
        });
        return !logged && isOverdue(med);
    });

    if (overdueMeds.length > 0) {
        elements.warningBanner.classList.remove('hidden');
        elements.warningBanner.classList.add('overdue');
        elements.warningText.textContent =
            'Overdue: ' + overdueMeds.map(function (m) { return m.name; }).join(', ');
    } else {
        elements.warningBanner.classList.add('hidden');
        elements.warningBanner.classList.remove('overdue');
    }
}

// ----- Refill -------------------------------------------------------------
export function renderRefillAlert(state, elements) {
    const lowMeds = state.medications.filter(function (m) {
        return m.inventory <= 3 && m.inventory > 0;
    });
    const emptyMeds = state.medications.filter(function (m) { return m.inventory <= 0; });

    if (emptyMeds.length > 0) {
        elements.refillAlert.classList.remove('hidden');
        elements.refillMessage.textContent =
            'Out of stock: ' + emptyMeds.map(function (m) { return m.name; }).join(', ');
        elements.refillAlert.style.borderColor = '#FF5252';
    } else if (lowMeds.length > 0) {
        elements.refillAlert.classList.remove('hidden');
        elements.refillMessage.textContent =
            'Low inventory: ' + lowMeds.map(function (m) {
                return m.name + ' (' + m.inventory + ' left)';
            }).join(', ');
        elements.refillAlert.style.borderColor = '#FFB800';
    } else {
        elements.refillAlert.classList.add('hidden');
    }
}

// ----- History ------------------------------------------------------------
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

    const sorted = state.logs.slice().sort(function (a, b) {
        return new Date(b.timestamp) - new Date(a.timestamp);
    }).slice(0, 30);

    list.innerHTML = sorted.map(function (log) {
        const med = state.medications.find(function (m) { return m.id === log.medicationId; });
        const name = med ? med.name : 'Unknown';
        const slot = med ? getSlotLabel(med.slot) : '?';
        return '<div class="history-item">' +
            '<span><span class="compartment">' + slot + '</span> ' + name + ' &middot; Self-Reported</span>' +
            '<span class="date">' + formatDateTime(log.timestamp) + '</span>' +
            '</div>';
    }).join('');
}

// ----- Summary ------------------------------------------------------------
export function renderSummary(state, elements) {
    const stats = getAdherenceStats(state);
    const logs = getLogsForSummary(state);

    elements.totalScheduled.textContent = stats.totalScheduled;
    elements.totalReported.textContent = stats.totalReported;
    elements.adherenceRate.textContent = stats.adherenceRate + '%';

    if (logs.length === 0) {
        elements.summaryHistory.innerHTML =
            '<div style="text-align:center;color:var(--text-muted);padding:16px;">No logs in this period</div>';
        return;
    }

    elements.summaryHistory.innerHTML = logs.map(function (log) {
        const med = state.medications.find(function (m) { return m.id === log.medicationId; });
        const name = med ? med.name : 'Unknown';
        const slot = med ? getSlotLabel(med.slot) : '?';
        return '<div class="history-item">' +
            '<span>' + slot + ' &middot; ' + name + '</span>' +
            '<span class="date">' + formatDateTime(log.timestamp) + '</span>' +
            '</div>';
    }).join('');
}

// ----- Cooldown -----------------------------------------------------------
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