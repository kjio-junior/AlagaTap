// js/notifications.js — EmailJS + browser notifications + alerts + badge
// Three independent channels: browser notifications, email reminders, sound.
// Each has its own toggle. Enabling one does not require or prompt for another.

import {
    getTodayStr,
    getSlotLabel,
    formatTime,
    getScheduleMinutesFromTime,
    buildLogStatusMap
} from './utils.js';

export class NotificationManager {
    constructor(state, onUpdate) {
        this.state = state;
        this.onUpdate = onUpdate;

        // ---- Timers / listeners ----
        this.checkInterval = null;
        this.visibilityHandler = null;
        this._titleTimer = null;
        this.originalTitle = document.title;

        // ---- EmailJS config ----
        this.emailjsServiceId  = 'service_8pm1t27';
        this.emailjsTemplateId = 'template_kzpgxam';
        this.emailjsPublicKey  = 'mCeqJyqUw5x1XdUK2';

        // ---- Behaviour ----
        this.REMINDER_MINUTES_BEFORE = 3;

        // ---- Runtime ----
        this.audioCtx = null;
        this.audioUnlocked = false;
        this._currentAlert = null;

        this.init();
    }

    // ================================================================
    // INIT
    // ================================================================
    async init() {
        await this.loadEmailJS();
        await this.registerServiceWorker();
        this.attachAudioUnlock();
        this.showIOSHintIfNeeded();

        // ---- Browser notifications toggle ----
        const browserToggle = document.getElementById('browserToggle');
        if (browserToggle) {
            browserToggle.checked = this.state.browserNotificationsEnabled || false;
            browserToggle.addEventListener('change', (e) => {
                this.handleBrowserToggle(e.target.checked);
            });
        }
        this.renderBrowserStatus();

        // ---- Email reminders toggle ----
        const emailToggle = document.getElementById('emailToggle');
        if (emailToggle) {
            emailToggle.checked = this.state.emailRemindersEnabled || false;
            emailToggle.addEventListener('change', (e) => {
                this.handleEmailToggle(e.target.checked);
            });
        }

        const emailInputInline = document.getElementById('emailInputInline');
        if (emailInputInline) {
            emailInputInline.value = localStorage.getItem('notificationEmail') || '';
            emailInputInline.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.saveEmailInline();
                }
            });
        }

        const saveEmailBtn = document.getElementById('saveEmailBtn');
        if (saveEmailBtn) {
            saveEmailBtn.addEventListener('click', () => this.saveEmailInline());
        }
        this.renderEmailStatus();

        // ---- Sound toggle ----
        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) {
            soundToggle.checked = this.state.soundEnabled !== false;
            soundToggle.addEventListener('change', (e) => {
                this.state.soundEnabled = e.target.checked;
                this.onUpdate(this.state);
                if (e.target.checked) {
                    this.playChime('taken');
                    this.vibrate([20, 40, 20]);
                    this.showToast('Sound & vibration enabled');
                } else {
                    this.showToast('Sound & vibration disabled');
                }
            });
        }

        // ---- Alert modal ----
        this.wireAlertModal();

        // ---- Start the checker if anything is on ----
        if (this.shouldCheckerRun()) this.startChecker();

        this.updateBadge();
    }

    shouldCheckerRun() {
        return this.state.browserNotificationsEnabled === true
            || this.state.emailRemindersEnabled === true;
    }

    // ================================================================
    // BROWSER NOTIFICATIONS TOGGLE
    // ================================================================
    async handleBrowserToggle(enabled) {
        this.state.browserNotificationsEnabled = enabled;

        if (!enabled) {
            this.onUpdate(this.state);
            this.renderBrowserStatus();
            this.maybeStopChecker();
            return;
        }

        // iOS in a Safari tab → show install hint instead of permission
        if (this.isIOSNonStandalone()) {
            this.showIOSHintBanner();
            this.renderBrowserStatus(
                'Add AlagaTap to Home Screen for iPhone notifications',
                'warning'
            );
            this.state.browserNotificationsEnabled = false;
            const toggle = document.getElementById('browserToggle');
            if (toggle) toggle.checked = false;
            this.onUpdate(this.state);
            return;
        }

        const permission = await this.requestNotificationPermission();

        if (permission === 'granted') {
            this.onUpdate(this.state);
            this.renderBrowserStatus('Enabled — you will see pop-up alerts', 'success');
            this.startChecker();
        } else if (permission === 'denied') {
            this.renderBrowserStatus('Blocked — enable in browser settings', 'error');
            this.state.browserNotificationsEnabled = false;
            const toggle = document.getElementById('browserToggle');
            if (toggle) toggle.checked = false;
            this.onUpdate(this.state);
        } else if (permission === 'unsupported') {
            this.renderBrowserStatus('Not supported here — try Email Reminders', 'warning');
            this.state.browserNotificationsEnabled = false;
            const toggle = document.getElementById('browserToggle');
            if (toggle) toggle.checked = false;
            this.onUpdate(this.state);
        }
    }

    async requestNotificationPermission() {
        if (!('Notification' in window)) return 'unsupported';
        if (Notification.permission === 'granted') return 'granted';
        if (Notification.permission === 'denied') return 'denied';
        try {
            return await Notification.requestPermission();
        } catch (e) {
            return 'unsupported';
        }
    }

    renderBrowserStatus(message, type) {
        const el = document.getElementById('browserStatus');
        if (!el) return;

        if (!message) {
            if (!('Notification' in window)) {
                message = 'Not supported in this browser';
                type = 'warning';
            } else if (Notification.permission === 'granted') {
                message = this.state.browserNotificationsEnabled
                    ? 'Enabled — you will see pop-up alerts'
                    : 'Turn on to get on-screen alerts';
                type = this.state.browserNotificationsEnabled ? 'success' : '';
            } else if (Notification.permission === 'denied') {
                message = 'Blocked — enable in browser settings';
                type = 'error';
            } else {
                message = 'Turn on to get on-screen alerts';
                type = '';
            }
        }

        el.className = 'notification-status ' + (type || '');
        el.innerHTML = '<span class="status-message">' + message + '</span>';
    }

    // ================================================================
    // EMAIL REMINDERS TOGGLE
    // ================================================================
    handleEmailToggle(enabled) {
        this.state.emailRemindersEnabled = enabled;
        this.onUpdate(this.state);

        const emailInline = document.getElementById('emailInline');
        const savedEmail = localStorage.getItem('notificationEmail');

        if (enabled) {
            if (!savedEmail) {
                if (emailInline) emailInline.classList.remove('hidden');
                this.renderEmailStatus('Enter your email above', '');
                setTimeout(() => {
                    document.getElementById('emailInputInline')?.focus();
                }, 100);
            } else {
                if (emailInline) emailInline.classList.add('hidden');
                this.renderEmailStatus('Reminders will be sent to ' + savedEmail, 'success');
            }
            this.startChecker();
        } else {
            if (emailInline) emailInline.classList.add('hidden');
            this.renderEmailStatus(
                savedEmail ? 'Email saved but reminders off' : 'No email saved yet',
                ''
            );
            this.maybeStopChecker();
        }
    }

    async saveEmailInline() {
        const input = document.getElementById('emailInputInline');
        const statusEl = document.getElementById('emailInlineStatus');
        const email = (input?.value || '').trim();

        if (!email || !email.includes('@') || !email.includes('.')) {
            if (statusEl) {
                statusEl.textContent = 'Please enter a valid email address';
                statusEl.style.color = '#FF5252';
            }
            return;
        }

        localStorage.setItem('notificationEmail', email);
        this.state.emailRemindersEnabled = true;
        this.onUpdate(this.state);

        if (statusEl) {
            statusEl.textContent = 'Sending test email…';
            statusEl.style.color = '#0052CC';
        }

        try {
            if (!window.emailjs) await this.loadEmailJS();

            const result = await window.emailjs.send(
                this.emailjsServiceId,
                this.emailjsTemplateId,
                {
                    to_email: email,
                    to_name: 'AlagaTap User',
                    title: 'Email reminders set up',
                    message: 'Your medication reminders will be sent here. You will get reminders ' +
                             this.REMINDER_MINUTES_BEFORE + ' minutes before each dose.',
                    medication_name: 'Test',
                    dosage: 'Test',
                    compartment: 'Test',
                    scheduled_time: 'Test',
                    current_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    from_name: 'AlagaTap'
                }
            );

            if (result.status === 200) {
                if (statusEl) {
                    statusEl.textContent = 'Test email sent to ' + email;
                    statusEl.style.color = '#00E5A3';
                }
                this.renderEmailStatus('Reminders will be sent to ' + email, 'success');
                this.showToast('Test email sent to ' + email);
                setTimeout(() => {
                    document.getElementById('emailInline')?.classList.add('hidden');
                }, 1600);
                this.startChecker();
            } else {
                throw new Error('send failed');
            }
        } catch (err) {
            console.warn('[AlagaTap] Email test failed:', err);
            if (statusEl) {
                statusEl.textContent = 'Could not send test email. Check your connection.';
                statusEl.style.color = '#FF5252';
            }
            this.renderEmailStatus('Email saved, but test failed', 'warning');
        }
    }

    renderEmailStatus(message, type) {
        const el = document.getElementById('emailStatus');
        if (!el) return;

        if (!message) {
            const saved = localStorage.getItem('notificationEmail');
            if (!saved) {
                message = 'No email saved yet';
                type = '';
            } else if (this.state.emailRemindersEnabled) {
                message = 'Reminders will be sent to ' + saved;
                type = 'success';
            } else {
                message = 'Email saved: ' + saved;
                type = '';
            }
        }

        el.className = 'notification-status ' + (type || '');
        el.innerHTML = '<span class="status-message">' + message + '</span>';
    }

    // ================================================================
    // CHECKER START / STOP
    // ================================================================
    startChecker() {
        this.stopChecker();
        this.checkScheduledDoses();

        this.checkInterval = setInterval(() => this.checkScheduledDoses(), 20000);

        this.visibilityHandler = () => {
            if (!document.hidden) {
                this.checkScheduledDoses();
                this.restoreTitle();
            }
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);
        window.addEventListener('focus', this.visibilityHandler);
    }

    stopChecker() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            window.removeEventListener('focus', this.visibilityHandler);
            this.visibilityHandler = null;
        }
        this.restoreTitle();
    }

    maybeStopChecker() {
        if (!this.shouldCheckerRun()) this.stopChecker();
    }

    // ================================================================
    // MAIN REMINDER LOOP
    // ================================================================
    checkScheduledDoses() {
        if (!Array.isArray(this.state.medications)) return;

        const todayStr = getTodayStr();
        const targetDay = new Date(todayStr + 'T12:00:00').getDay();
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const statusMap = buildLogStatusMap(this.state.logs);

        this.state.medications.forEach((med) => {
            if (!Array.isArray(med.days) || !med.days.includes(targetDay)) return;

            // FIX: composite-key check — logs are keyed by (medicationId, date).
            if (statusMap.has(med.id + '|' + todayStr)) return;

            const scheduleMin = getScheduleMinutesFromTime(med.time);
            const timeDiff = nowMin - scheduleMin;
            const before = this.REMINDER_MINUTES_BEFORE;

            // ---- Pre-reminder ----
            if (timeDiff >= -(before + 1) && timeDiff <= -(before - 1)) {
                if (!this.hasSent(med.id, todayStr, 'pre')) {
                    this.markSent(med.id, todayStr, 'pre');
                    this.fireReminder('pre', med, todayStr,
                        'Upcoming: ' + med.name,
                        med.name + ' due in ' + Math.abs(timeDiff) +
                        ' min. ' + getSlotLabel(med.slot) + ' dose.');
                }
                return;
            }

            // ---- On-time ----
            if (timeDiff >= 0 && timeDiff <= 4) {
                if (!this.hasSent(med.id, todayStr, 'ontime')) {
                    this.markSent(med.id, todayStr, 'ontime');
                    this.fireReminder('ontime', med, todayStr,
                        'Time for ' + med.name,
                        'Take ' + med.name + ' (' + med.dosage + ') — ' +
                        getSlotLabel(med.slot) + ' dose.');
                }
                return;
            }

            // ---- Overdue — every 30 min ----
            if (timeDiff >= 30 && timeDiff % 30 === 0) {
                const slotKey = 'overdue_' + Math.floor(timeDiff / 30);
                if (!this.hasSent(med.id, todayStr, slotKey)) {
                    this.markSent(med.id, todayStr, slotKey);
                    this.fireReminder('overdue', med, todayStr,
                        med.name + ' is overdue',
                        med.name + ' (' + med.dosage + ') is ' + timeDiff +
                        ' min overdue. Please log it.');
                }
            }
        });

        this.updateBadge();
    }

    fireReminder(type, med, date, title, message) {
        // Email — its own flag
        if (this.state.emailRemindersEnabled && localStorage.getItem('notificationEmail')) {
            this.sendEmailNotification(title, message, med);
        }

        // Browser — its own flag + permission
        if (this.state.browserNotificationsEnabled
            && 'Notification' in window
            && Notification.permission === 'granted') {
            this.sendBrowserNotification(title, message, med);
        }

        // Sound — independent
        if (this.state.soundEnabled !== false) {
            this.playChime(type);
            this.vibrate([200, 100, 200]);
        }

        // In-page modal — always shown while the checker is running
        if (type === 'ontime' || type === 'overdue') {
            this.enqueueAlert(med, date);
        }

        // Title flash when tab is hidden
        if (document.hidden) this.flashTitle(title);
    }

    // ================================================================
    // BROWSER NOTIFICATIONS
    // ================================================================
    async sendBrowserNotification(title, message, med) {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;

        const options = {
            body: message,
            tag: 'alagatap-' + med.id,
            requireInteraction: true,
            vibrate: [200, 100, 200],
            data: { medId: med.id }
            // no icon — SVG icons render inconsistently in notifications
        };

        try {
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                await reg.showNotification('AlagaTap: ' + title, options);
            } else {
                new Notification('AlagaTap: ' + title, options);
            }
        } catch (err) {
            try {
                new Notification('AlagaTap: ' + title, options);
            } catch (e) {
                console.warn('[AlagaTap] Notification failed:', e);
            }
        }
    }

    // ================================================================
    // EMAIL (EmailJS)
    // ================================================================
    async loadEmailJS() {
        if (window.emailjs) {
            try { window.emailjs.init(this.emailjsPublicKey); } catch (e) { /* ignore */ }
            return;
        }
        await new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
            s.onload = () => {
                try { if (window.emailjs) window.emailjs.init(this.emailjsPublicKey); } catch (e) { /* ignore */ }
                resolve();
            };
            s.onerror = () => resolve();
            document.head.appendChild(s);
        });
    }

    sendEmailNotification(title, message, medication) {
        const userEmail = localStorage.getItem('notificationEmail');
        if (!userEmail || !window.emailjs) return;

        const med = medication || {};
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        window.emailjs.send(
            this.emailjsServiceId,
            this.emailjsTemplateId,
            {
                to_email: userEmail,
                to_name: 'AlagaTap User',
                title: title,
                message: message,
                medication_name: med.name || 'Unknown',
                dosage: med.dosage || 'Unknown',
                compartment: med.slot ? getSlotLabel(med.slot) : 'Unknown',
                scheduled_time: med.time ? formatTime(med.time) : 'Unknown',
                current_time: currentTime,
                from_name: 'AlagaTap'
            }
        ).catch((err) => console.warn('[AlagaTap] Email failed:', err));
    }

    // ================================================================
    // SOUND & VIBRATION
    // ================================================================
    attachAudioUnlock() {
        const unlock = () => {
            try {
                if (!this.audioCtx) {
                    const Ctx = window.AudioContext || window.webkitAudioContext;
                    if (!Ctx) return;
                    this.audioCtx = new Ctx();
                }
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                if (this.audioCtx.state === 'running') {
                    this.audioUnlocked = true;
                    document.removeEventListener('touchstart', unlock);
                    document.removeEventListener('click', unlock);
                    document.removeEventListener('keydown', unlock);
                }
            } catch (e) { /* silent */ }
        };
        document.addEventListener('touchstart', unlock, { passive: true });
        document.addEventListener('click', unlock);
        document.addEventListener('keydown', unlock);
    }

    playChime(type) {
        if (!this.audioUnlocked || !this.audioCtx) return;
        try {
            const ctx = this.audioCtx;
            if (ctx.state === 'suspended') ctx.resume();

            const freqs = type === 'pre'    ? [660, 880]
                        : type === 'ontime' ? [880, 1100]
                        : [440, 550];

            freqs.forEach((f, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.value = f;
                const t = ctx.currentTime + i * 0.15;
                gain.gain.setValueAtTime(0.0001, t);
                gain.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
                osc.start(t);
                osc.stop(t + 0.2);
            });
        } catch (e) { /* silent */ }
    }

    vibrate(pattern) {
        if (navigator.vibrate) {
            try { navigator.vibrate(pattern); } catch (e) { /* silent */ }
        }
    }

    // ================================================================
    // TITLE FLASH
    // ================================================================
    flashTitle(text) {
        if (this._titleTimer) clearInterval(this._titleTimer);
        let on = true;
        this._titleTimer = setInterval(() => {
            document.title = on ? '⏰ ' + text : this.originalTitle;
            on = !on;
        }, 1000);
    }

    restoreTitle() {
        if (this._titleTimer) {
            clearInterval(this._titleTimer);
            this._titleTimer = null;
        }
        document.title = this.originalTitle;
    }

    // ================================================================
    // FULL-SCREEN ALERT MODAL
    // ================================================================
    wireAlertModal() {
        const taken = document.getElementById('alertTakenBtn');
        const missed = document.getElementById('alertMissedBtn');
        const close = document.getElementById('alertCloseBtn');

        if (taken) {
            taken.addEventListener('click', () => {
                if (this._currentAlert && typeof window.logDoseFromAlert === 'function') {
                    window.logDoseFromAlert(this._currentAlert.medId, this._currentAlert.date, 'taken');
                }
                this.closeAlert();
            });
        }
        if (missed) {
            missed.addEventListener('click', () => {
                if (this._currentAlert && typeof window.logDoseFromAlert === 'function') {
                    window.logDoseFromAlert(this._currentAlert.medId, this._currentAlert.date, 'missed');
                }
                this.closeAlert();
            });
        }
        if (close) {
            close.addEventListener('click', () => this.closeAlert());
        }
    }

    enqueueAlert(med, date) {
        // Don't stack — just replace
        this._currentAlert = { medId: med.id, date: date };
        this.showAlert(med);
    }

    showAlert(med) {
        const modal = document.getElementById('alertModal');
        if (!modal) return;

        const nameEl = document.getElementById('alertMedName');
        const detailEl = document.getElementById('alertMedDetail');
        if (nameEl) nameEl.textContent = med.name;
        if (detailEl) {
            detailEl.textContent =
                med.dosage + ' · ' + getSlotLabel(med.slot) + ' · ' + formatTime(med.time);
        }

        modal.classList.remove('hidden');
        setTimeout(() => document.getElementById('alertTakenBtn')?.focus(), 50);
    }

    closeAlert() {
        const modal = document.getElementById('alertModal');
        if (modal) modal.classList.add('hidden');
        this._currentAlert = null;
    }

    // ================================================================
    // APP BADGE
    // ================================================================
    updateBadge() {
        if (!('setAppBadge' in navigator)) return;
        try {
            const todayStr = getTodayStr();
            const targetDay = new Date(todayStr + 'T12:00:00').getDay();
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            const statusMap = buildLogStatusMap(this.state.logs);

            let count = 0;
            this.state.medications.forEach((m) => {
                if (!Array.isArray(m.days) || !m.days.includes(targetDay)) return;
                if (statusMap.has(m.id + '|' + todayStr)) return;
                if (nowMin > getScheduleMinutesFromTime(m.time)) count++;
            });

            if (count > 0) navigator.setAppBadge(count);
            else if (navigator.clearAppBadge) navigator.clearAppBadge();
        } catch (e) { /* silent */ }
    }

    // ================================================================
    // iOS HINT
    // ================================================================
    isIOSNonStandalone() {
        const ua = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isStandalone = window.navigator.standalone === true
            || window.matchMedia('(display-mode: standalone)').matches;
        return isIOS && !isStandalone;
    }

    showIOSHintIfNeeded() {
        // Only show when the user tries to enable browser notifications.
        // Nothing to do on load.
    }

    showIOSHintBanner() {
        const el = document.getElementById('iosInstallHint');
        if (!el) return;
        el.classList.remove('hidden');
        const dismiss = document.getElementById('iosHintDismiss');
        if (dismiss) {
            dismiss.onclick = () => {
                el.classList.add('hidden');
                localStorage.setItem('alagaTapIOSHintDismissed', 'true');
            };
        }
    }

    // ================================================================
    // DEDUP (per medication / day / reminder type)
    // ================================================================
    hasSent(medId, date, type) {
        return localStorage.getItem(
            'alagatap_reminder_' + medId + '_' + date + '_' + type
        ) !== null;
    }

    markSent(medId, date, type) {
        localStorage.setItem(
            'alagatap_reminder_' + medId + '_' + date + '_' + type,
            Date.now().toString()
        );
    }

    // ================================================================
    // SERVICE WORKER
    // ================================================================
    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return null;
        try {
            await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;
            return true;
        } catch (err) {
            console.warn('[AlagaTap] SW registration failed:', err);
            return null;
        }
    }

    // ================================================================
    // HELPERS
    // ================================================================
    showToast(message) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, { duration: 2500 });
        } else {
            console.log('[AlagaTap] ' + message);
        }
    }
}

export function initNotifications(state, onUpdate) {
    return new NotificationManager(state, onUpdate);
}