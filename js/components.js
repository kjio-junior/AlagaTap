// js/components.js - Component rendering functions
import { 
    formatTime, formatDate, formatDateTime, getTodayStr, 
    getStatusText, getLastDoseTime, getCompartmentLabel,
    isOverdue, getAdherenceStats, getLogsForSummary
} from './utils.js';

export function renderHero(state, elements) {
    const { statusText, status } = getStatusText(state);
    const lastDose = getLastDoseTime(state);
    
    elements.statusDot.className = `status-dot ${status}`;
    elements.statusText.textContent = statusText;
    elements.heroTimestamp.textContent = lastDose 
        ? `Last dose: ${formatDateTime(lastDose)}` 
        : 'No doses recorded yet';
}

export function renderCompartmentList(state, elements, callbacks) {
    const list = elements.compartmentList;
    if (!list) return;
    
    if (state.medications.length === 0) {
        list.innerHTML = `
            <div class="compartment-card" style="justify-content:center; padding:24px; color: var(--text-muted);">
                No medications added yet. Tap "Add" to get started.
            </div>
        `;
        return;
    }
    
    const today = getTodayStr();
    
    list.innerHTML = state.medications.map(med => {
        const overdue = isOverdue(med.schedule);
        const loggedToday = state.logs.some(l => 
            l.medicationId === med.id && 
            l.timestamp.startsWith(today)
        );
        const inventoryLow = med.inventory <= 3;
        const inventoryCritical = med.inventory <= 0;
        
        return `
            <div class="compartment-card" data-med-id="${med.id}">
                <div class="compartment-info">
                    <div>
                        <span class="compartment-tag">${med.compartment}</span>
                        <span class="compartment-name">${med.name}</span>
                        ${overdue && !loggedToday ? '<span style="color: #FF5252; font-size:12px; margin-left:6px;">(Overdue)</span>' : ''}
                        ${loggedToday ? '<span style="color: #00E5A3; font-size:12px; margin-left:6px;">✓ Logged</span>' : ''}
                    </div>
                    <div class="compartment-detail">${med.dosage} · ${getCompartmentLabel(med.compartment)} · ${formatTime(med.schedule)}</div>
                    <div class="compartment-inventory">
                        ${inventoryCritical ? '⚠️ Out of stock' : 
                          inventoryLow ? `⚠️ Refill needed: ${med.inventory} doses left` : 
                          `${med.inventory} doses remaining`}
                    </div>
                </div>
                <div class="compartment-actions">
                    <button class="btn-icon log-dose-btn" data-med-id="${med.id}" title="Log dose" ${loggedToday ? 'disabled style="opacity:0.4;"' : ''}>
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                    <button class="btn-icon edit-med-btn" data-med-id="${med.id}" title="Edit">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                    </button>
                    <button class="btn-icon delete-med-btn" data-med-id="${med.id}" title="Delete">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Attach event listeners
    list.querySelectorAll('.log-dose-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.medId;
            callbacks.onLogDose(id);
        });
    });
    
    list.querySelectorAll('.edit-med-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.medId;
            callbacks.onEditMed(id);
        });
    });
    
    list.querySelectorAll('.delete-med-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.medId;
            if (confirm('Delete this medication entry?')) {
                callbacks.onDeleteMed(id);
            }
        });
    });
}

export function renderWarnings(state, elements) {
    const today = getTodayStr();
    const overdueMeds = state.medications.filter(med => {
        const loggedToday = state.logs.some(l => 
            l.medicationId === med.id && 
            l.timestamp.startsWith(today)
        );
        return !loggedToday && isOverdue(med.schedule);
    });
    
    const banner = elements.warningBanner;
    const text = elements.warningText;
    
    if (overdueMeds.length > 0) {
        banner.classList.remove('hidden');
        banner.classList.add('overdue');
        text.textContent = `Overdue: ${overdueMeds.map(m => m.name).join(', ')}`;
    } else {
        banner.classList.add('hidden');
        banner.classList.remove('overdue');
    }
}

export function renderRefillAlert(state, elements) {
    const alert = elements.refillAlert;
    const message = elements.refillMessage;
    
    const lowMeds = state.medications.filter(m => m.inventory <= 3 && m.inventory > 0);
    const emptyMeds = state.medications.filter(m => m.inventory <= 0);
    
    if (emptyMeds.length > 0) {
        alert.classList.remove('hidden');
        message.textContent = `Out of stock: ${emptyMeds.map(m => m.name).join(', ')}. Refill needed immediately.`;
        alert.style.borderColor = '#FF5252';
    } else if (lowMeds.length > 0) {
        alert.classList.remove('hidden');
        message.textContent = `Low inventory: ${lowMeds.map(m => `${m.name} (${m.inventory} left)`).join(', ')}`;
        alert.style.borderColor = '#FFB800';
    } else {
        alert.classList.add('hidden');
    }
}

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
        list.innerHTML = '<div class="history-item" style="justify-content:center; color: var(--text-muted);">No intake history yet</div>';
        return;
    }
    
    const sorted = [...state.logs].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    ).slice(0, 30);
    
    list.innerHTML = sorted.map(log => {
        const med = state.medications.find(m => m.id === log.medicationId);
        const name = med ? med.name : 'Unknown';
        const compartment = med ? med.compartment : '?';
        return `
            <div class="history-item">
                <span>
                    <span class="compartment">${compartment}</span> 
                    ${name} · Self-Reported
                </span>
                <span class="date">${formatDateTime(log.timestamp)}</span>
            </div>
        `;
    }).join('');
}

export function renderSummary(state, elements) {
    const stats = getAdherenceStats(state);
    const logs = getLogsForSummary(state);
    
    elements.totalScheduled.textContent = stats.totalScheduled;
    elements.totalReported.textContent = stats.totalReported;
    elements.adherenceRate.textContent = stats.adherenceRate + '%';
    
    const historyContainer = elements.summaryHistory;
    if (logs.length === 0) {
        historyContainer.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding:16px;">No logs in this period</div>';
        return;
    }
    
    historyContainer.innerHTML = logs.map(log => {
        const med = state.medications.find(m => m.id === log.medicationId);
        const name = med ? med.name : 'Unknown';
        const compartment = med ? med.compartment : '?';
        return `
            <div class="history-item">
                <span>${compartment} · ${name}</span>
                <span class="date">${formatDateTime(log.timestamp)}</span>
            </div>
        `;
    }).join('');
}

export function renderShareLink(state, element) {
    element.textContent = `alagatap://view/${state.caregiverShareCode}`;
}

export function updateCooldown(state, elements) {
    const now = Date.now();
    const cooldown = state.cooldownUntil || 0;
    const indicator = elements.cooldownIndicator;
    const timer = elements.cooldownTimer;
    const recordBtn = elements.recordDoseBtn;
    
    if (cooldown > now) {
        indicator.classList.remove('hidden');
        const remaining = Math.ceil((cooldown - now) / 1000);
        timer.textContent = remaining;
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