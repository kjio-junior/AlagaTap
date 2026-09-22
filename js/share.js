// js/share.js — Caregiver share link (v3.0, includes slot/days/status)

import {
    formatTime, formatDateShort, formatDateTime,
    getSlotLabel, getTodayStr, getTodayDay, DAY_SHORT
} from './utils.js';

export class ShareManager {
    constructor(state, elements) {
        this.state = state;
        this.elements = elements;
    }

    // ============================================================
    // ENCODE
    // ============================================================
    generateShareLink() {
        const shareData = {
            v: '3.0',
            g: new Date().toISOString(),
            m: this.state.medications.map(m => ({
                id:   m.id,
                n:    m.name,
                d:    m.dosage,
                slot: m.slot,
                days: m.days,
                time: m.time,
                inv:  m.inventory
            })),
            l: this.state.logs.slice(-50).map(l => ({
                t:      l.timestamp,
                medId:  l.medicationId,
                slot:   l.slot,
                date:   l.date,
                status: l.status || 'taken'
            }))
        };

        try {
            const json = JSON.stringify(shareData);
            const compressed = window.LZString.compressToEncodedURIComponent(json);
            const baseUrl = window.location.origin + window.location.pathname;
            const url = baseUrl + '?share=' + compressed;
            this.saveShareHistory(url);
            return url;
        } catch (err) {
            console.error('Failed to generate share link:', err);
            return null;
        }
    }

    // ============================================================
    // DECODE
    // ============================================================
    loadSharedData() {
        const params = new URLSearchParams(window.location.search);
        const compressed = params.get('share');
        if (!compressed) return null;
        try {
            const json = window.LZString.decompressFromEncodedURIComponent(compressed);
            if (!json) return null;
            const data = JSON.parse(json);
            return { data, type: 'compressed' };
        } catch (err) {
            console.warn('Failed to load share data:', err);
            return null;
        }
    }

    // ============================================================
    // RENDER READ-ONLY VIEW
    // ============================================================
    renderReadOnlyView(shared) {
        const meds = (shared.m || []).map(m => ({
            id:        m.id || m.n,
            name:      m.n,
            dosage:    m.d,
            slot:      m.slot || 'morning',
            days:      Array.isArray(m.days) ? m.days : [0,1,2,3,4,5,6],
            time:      m.time || '08:00',
            inventory: m.inv != null ? m.inv : 0
        }));

        const logs = (shared.l || []).map(l => ({
            timestamp:     l.t,
            medicationId:  l.medId,
            slot:          l.slot,
            date:          l.date,
            status:        l.status || 'taken'
        }));

        const container = document.getElementById('app');
        container.innerHTML = '';

        // ---- Header banner ----
        const banner = document.createElement('div');
        banner.className = 'ro-banner';
        banner.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0;">' +
                '<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>' +
            '</svg>' +
            '<div>' +
                '<div style="font-weight:600;">Read-Only View</div>' +
                '<div style="font-size:12px;opacity:.75;">Shared ' +
                    new Date(shared.g).toLocaleDateString() + '</div>' +
            '</div>';
        container.appendChild(banner);

        // ---- Brand header ----
        const brand = document.createElement('div');
        brand.className = 'ro-brand';
        brand.innerHTML =
            '<span class="ro-brand-name">AlagaTap</span>' +
            '<span class="ro-brand-badge">Shared</span>';
        container.appendChild(brand);

        // ---- Today's status card ----
        const todayStr = getTodayStr();
        const todayDay = getTodayDay();
        const statusMap = new Map();
        logs.forEach(l => statusMap.set(l.medicationId + '|' + l.date, l.status));

        const todayMeds = meds.filter(m => m.days.includes(todayDay));
        const takenToday  = todayMeds.filter(m => statusMap.get(m.id + '|' + todayStr) === 'taken').length;
        const missedToday = todayMeds.filter(m => statusMap.get(m.id + '|' + todayStr) === 'missed').length;
        const pendingToday = todayMeds.length - takenToday - missedToday;

        const statusCard = document.createElement('div');
        statusCard.className = 'ro-status-card';
        statusCard.innerHTML =
            '<div class="ro-status-title">Today &mdash; ' + DAY_SHORT[todayDay] + '</div>' +
            '<div class="ro-status-pills">' +
                '<div class="ro-pill ro-pill-taken">' +
                    '<div class="ro-pill-num">' + takenToday + '</div>' +
                    '<div class="ro-pill-lbl">Taken</div>' +
                '</div>' +
                '<div class="ro-pill ro-pill-missed">' +
                    '<div class="ro-pill-num">' + missedToday + '</div>' +
                    '<div class="ro-pill-lbl">Missed</div>' +
                '</div>' +
                '<div class="ro-pill ro-pill-pending">' +
                    '<div class="ro-pill-num">' + pendingToday + '</div>' +
                    '<div class="ro-pill-lbl">Pending</div>' +
                '</div>' +
            '</div>';
        container.appendChild(statusCard);

        // ---- Medication schedule ----
        if (meds.length > 0) {
            const scheduleSection = document.createElement('section');
            scheduleSection.className = 'ro-section';
            scheduleSection.innerHTML = '<h2 class="ro-section-title">Medication Schedule</h2>';

            // Group by slot
            ['morning', 'noon', 'night'].forEach(slot => {
                const slotMeds = meds.filter(m => m.slot === slot);
                if (slotMeds.length === 0) return;

                const group = document.createElement('div');
                group.className = 'ro-slot-group';
                group.innerHTML =
                    '<div class="ro-slot-header slot-' + slot + '">' + getSlotLabel(slot) + '</div>' +
                    slotMeds.map(m => {
                        const daysLabel = this._formatDays(m.days);
                        return '<div class="ro-med-row">' +
                            '<div class="ro-med-name">' + this._esc(m.name) + '</div>' +
                            '<div class="ro-med-detail">' + this._esc(m.dosage) +
                                ' &middot; ' + formatTime(m.time) +
                                ' &middot; ' + daysLabel + '</div>' +
                        '</div>';
                    }).join('');
                scheduleSection.appendChild(group);
            });
            container.appendChild(scheduleSection);
        }

        // ---- Intake history (recent 20) ----
        const historySection = document.createElement('section');
        historySection.className = 'ro-section';
        historySection.innerHTML = '<h2 class="ro-section-title">Recent Intake History</h2>';

        const recent = logs.slice().sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        ).slice(0, 20);

        if (recent.length === 0) {
            historySection.innerHTML += '<div class="ro-empty">No intake recorded yet.</div>';
        } else {
            const list = document.createElement('div');
            list.className = 'ro-history-list';
            list.innerHTML = recent.map(l => {
                const med = meds.find(m => m.id === l.medicationId);
                const name = med ? med.name : 'Unknown';
                const slot = med ? getSlotLabel(med.slot) : getSlotLabel(l.slot);
                const badge = l.status === 'missed'
                    ? '<span class="status-badge missed">Missed</span>'
                    : '<span class="status-badge taken">Taken</span>';
                const forDate = l.date ? ' · for ' + formatDateShort(l.date) : '';
                return '<div class="history-item">' +
                    '<span><span class="compartment">' + slot + '</span> ' +
                        this._esc(name) +
                        '<span style="color:var(--text-muted);font-size:12px;">' + forDate + '</span> ' +
                        badge +
                    '</span>' +
                    '<span class="date">' + formatDateTime(l.timestamp) + '</span>' +
                '</div>';
            }).join('');
            historySection.appendChild(list);
        }
        container.appendChild(historySection);

        // ---- Adherence summary ----
        let totalScheduled = 0;
        meds.forEach(m => { totalScheduled += m.days.length; });  // per week
        const totalReported = logs.length;
        const rate = totalScheduled > 0
            ? Math.round((totalReported / totalScheduled) * 100)
            : 0;

        const summarySection = document.createElement('section');
        summarySection.className = 'ro-section';
        summarySection.innerHTML =
            '<h2 class="ro-section-title">Adherence Summary</h2>' +
            '<div class="ro-summary-grid">' +
                '<div class="ro-summary-item">' +
                    '<div class="ro-summary-num">' + totalScheduled + '</div>' +
                    '<div class="ro-summary-lbl">Scheduled / week</div>' +
                '</div>' +
                '<div class="ro-summary-item">' +
                    '<div class="ro-summary-num">' + totalReported + '</div>' +
                    '<div class="ro-summary-lbl">Reported</div>' +
                '</div>' +
                '<div class="ro-summary-item">' +
                    '<div class="ro-summary-num">' + rate + '%</div>' +
                    '<div class="ro-summary-lbl">Adherence</div>' +
                '</div>' +
            '</div>' +
            '<p style="font-size:11px;color:var(--text-muted);margin-top:12px;text-align:center;line-height:1.5;">' +
                'All doses are self-reported. This view reflects what was logged by the user or their caregiver, ' +
                'not verified biological intake.' +
            '</p>';
        container.appendChild(summarySection);
    }

    // ============================================================
    // HELPERS
    // ============================================================
    _formatDays(days) {
        if (!Array.isArray(days) || days.length === 0) return '—';
        if (days.length === 7) return 'Every day';
        if (days.length === 5 && [1,2,3,4,5].every(d => days.includes(d))) return 'Weekdays';
        if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
        return days.slice().sort((a,b) => a-b).map(d => DAY_SHORT[d]).join(', ');
    }

    _esc(str) {
        return String(str).replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[c]));
    }

    saveShareHistory(url) {
        const history = JSON.parse(localStorage.getItem('alagaTapShareHistory') || '[]');
        history.unshift({
            url: url,
            date: new Date().toISOString(),
            medications: this.state.medications.length
        });
        if (history.length > 10) history.pop();
        localStorage.setItem('alagaTapShareHistory', JSON.stringify(history));
    }

    getShareHistory() {
        return JSON.parse(localStorage.getItem('alagaTapShareHistory') || '[]');
    }
}