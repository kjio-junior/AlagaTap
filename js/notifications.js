// js/notifications.js — EmailJS reminder system (weekly pillbox model)

import {
    isMedToday, getScheduleMinutesFromTime, getSlotLabel, formatTime,
    getTodayStr, DAY_FULL
} from './utils.js';

export class NotificationManager {
    constructor(state, onUpdate) {
        this.state = state;
        this.onUpdate = onUpdate;
        this.checkInterval = null;
        this.visibilityHandler = null;
        this.emailEnabled = false;

        // ===== EmailJS configuration =====
        this.emailjsServiceId  = 'service_8pm1t27';
        this.emailjsTemplateId = 'template_kzpgxam';
        this.emailjsPublicKey  = 'mCeqJyqUw5x1XdUK2';
        // ==================================

        // Minutes-before-schedule to fire the "upcoming" reminder
        this.REMINDER_MINUTES_BEFORE = 3;

        this.emailEnabled = localStorage.getItem('notificationEmail') !== null;
        this.init();
    }

    async init() {
        await this.loadEmailJS();

        const toggle = document.getElementById('notificationToggle');
        if (toggle) {
            toggle.checked = this.state.notificationsEnabled || false;
            toggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                this.state.notificationsEnabled = enabled;
                this.onUpdate(this.state);

                if (enabled) {
                    this.startChecker();
                    this.showStatus('Email reminders enabled', 'success');
                    if (!this.emailEnabled) {
                        setTimeout(() => this.showEmailSetup(), 800);
                    }
                } else {
                    this.stopChecker();
                    this.showStatus('Email reminders disabled', '');
                }
            });
        }

        if (this.state.notificationsEnabled) this.startChecker();

        if (this.state.notificationsEnabled && !this.emailEnabled) {
            setTimeout(() => this.showEmailSetup(), 3000);
        }
    }

    async loadEmailJS() {
        return new Promise((resolve) => {
            if (window.emailjs) {
                window.emailjs.init(this.emailjsPublicKey);
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
            script.onload = () => {
                window.emailjs.init(this.emailjsPublicKey);
                resolve();
            };
            script.onerror = () => resolve();
            document.head.appendChild(script);
        });
    }

    // ------------------------------------------------------------------
    startChecker() {
        this.stopChecker();

        this.checkScheduledDoses();
        this.checkInterval = setInterval(() => this.checkScheduledDoses(), 20000);

        this.visibilityHandler = () => {
            if (!document.hidden) this.checkScheduledDoses();
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
    }

    // ------------------------------------------------------------------
    // Main reminder logic
    // ------------------------------------------------------------------
    checkScheduledDoses() {
        const now = new Date();
        const todayStr = getTodayStr();
        const nowMin = now.getHours() * 60 + now.getMinutes();

        this.state.medications.forEach((med) => {
            // Skip medications not scheduled for today
            if (!isMedToday(med)) return;

            // Skip if already logged today
            const alreadyLogged = this.state.logs.some((l) =>
                l.medicationId === med.id && l.timestamp.startsWith(todayStr)
            );
            if (alreadyLogged) return;

            const scheduleMin = getScheduleMinutesFromTime(med.time);
            const timeDiff = nowMin - scheduleMin;
            const before = this.REMINDER_MINUTES_BEFORE;

            // Pre-reminder: fires once within the window
            if (timeDiff >= -(before + 1) && timeDiff <= -(before - 1)) {
                if (!this.hasSent(med.id, todayStr, 'pre')) {
                    this.markSent(med.id, todayStr, 'pre');
                    this.sendEmailNotification(
                        'Upcoming: ' + med.name,
                        med.name + ' (' + med.dosage + ') is due in ' +
                        Math.abs(timeDiff) + ' minute(s) at ' + formatTime(med.time) +
                        ' — ' + getSlotLabel(med.slot) + ' dose.',
                        med
                    );
                }
                return;
            }

            // On-time reminder: 0-4 min after
            if (timeDiff >= 0 && timeDiff <= 4) {
                if (!this.hasSent(med.id, todayStr, 'ontime')) {
                    this.markSent(med.id, todayStr, 'ontime');
                    this.sendEmailNotification(
                        'Time for ' + med.name,
                        'Take ' + med.name + ' (' + med.dosage + ') — ' +
                        getSlotLabel(med.slot) + ' dose.',
                        med
                    );
                }
                return;
            }

            // Overdue reminders: at 30, 60, 90 min…
            if (timeDiff >= 30 && timeDiff % 30 === 0) {
                const slotKey = 'overdue_' + Math.floor(timeDiff / 30);
                if (!this.hasSent(med.id, todayStr, slotKey)) {
                    this.markSent(med.id, todayStr, slotKey);
                    this.sendEmailNotification(
                        med.name + ' is overdue',
                        med.name + ' (' + med.dosage + ') is ' + timeDiff +
                        ' minutes overdue. Please log your ' +
                        getSlotLabel(med.slot) + ' dose.',
                        med
                    );
                }
            }
        });
    }

    // ---- Dedup helpers ----
    hasSent(medId, date, type) {
        return localStorage.getItem('alagatap_reminder_' + medId + '_' + date + '_' + type) !== null;
    }

    markSent(medId, date, type) {
        localStorage.setItem(
            'alagatap_reminder_' + medId + '_' + date + '_' + type,
            Date.now().toString()
        );
    }

    // ------------------------------------------------------------------
    // Email setup
    // ------------------------------------------------------------------
    showEmailSetup() {
        if (document.getElementById('emailSetupModal')) return;

        const modal = document.createElement('div');
        modal.id = 'emailSetupModal';
        modal.className = 'email-setup-modal';
        modal.innerHTML =
            '<div class="email-setup-content">' +
                '<h3>Email Reminders</h3>' +
                '<p>Enter your email address to receive medication reminders.</p>' +
                '<p style="font-size:13px;color:var(--text-muted);margin-top:-8px;">' +
                    'You will get a reminder ' + this.REMINDER_MINUTES_BEFORE + ' minutes before each dose.' +
                '</p>' +
                '<div class="email-input-group" style="margin-top:16px;">' +
                    '<input type="email" id="emailInput" placeholder="your@email.com" ' +
                        'value="' + (localStorage.getItem('notificationEmail') || '') + '" ' +
                        'style="flex:1;padding:10px 14px;border:1.5px solid var(--border-color);' +
                        'border-radius:8px;font-size:15px;min-height:48px;' +
                        'background:var(--bg-primary);color:var(--text-primary);" />' +
                    '<button id="emailSetupBtn" class="btn-primary" style="min-height:48px;">' +
                        (localStorage.getItem('notificationEmail') ? 'Update' : 'Save') +
                    '</button>' +
                '</div>' +
                '<div id="emailSetupStatus" style="margin-top:8px;font-size:13px;display:none;"></div>' +
                '<button class="setup-skip" id="emailSkipBtn" ' +
                    'style="margin-top:12px;background:none;border:none;color:var(--text-muted);' +
                    'font-size:13px;cursor:pointer;width:100%;text-align:center;padding:8px;">' +
                    (localStorage.getItem('notificationEmail') ? 'Remove Email' : 'Skip for now') +
                '</button>' +
            '</div>';

        document.body.appendChild(modal);

        document.getElementById('emailSetupBtn').addEventListener('click', async () => {
            const email = document.getElementById('emailInput').value.trim();
            const statusDiv = document.getElementById('emailSetupStatus');

            if (!email || !email.includes('@')) {
                statusDiv.style.display = 'block';
                statusDiv.style.color = '#FF5252';
                statusDiv.textContent = 'Please enter a valid email address.';
                return;
            }

            localStorage.setItem('notificationEmail', email);
            this.emailEnabled = true;

            statusDiv.style.display = 'block';
            statusDiv.style.color = '#0052CC';
            statusDiv.textContent = 'Sending test email…';

            try {
                const result = await window.emailjs.send(
                    this.emailjsServiceId,
                    this.emailjsTemplateId,
                    {
                        to_email: email,
                        to_name: 'AlagaTap User',
                        title: 'Test Notification',
                        message: 'Your medication reminders are set up. You will receive reminders ' +
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
                    statusDiv.style.color = '#00E5A3';
                    statusDiv.textContent = 'Test email sent to ' + email;
                    this.showStatus('Email notifications enabled', 'success');
                    this.showToast('Test email sent to ' + email);
                    setTimeout(() => modal.remove(), 1500);
                } else {
                    throw new Error('EmailJS error');
                }
            } catch (err) {
                console.warn('Email send failed:', err);
                statusDiv.style.color = '#FF5252';
                statusDiv.textContent = 'Failed to send test email. Please try again.';
            }
        });

        document.getElementById('emailSkipBtn').addEventListener('click', () => {
            if (localStorage.getItem('notificationEmail')) {
                if (confirm('Remove your email from AlagaTap reminders?')) {
                    localStorage.removeItem('notificationEmail');
                    this.emailEnabled = false;
                    modal.remove();
                    this.showToast('Email removed from reminders');
                    this.showStatus('Email notifications disabled', '');
                }
            } else {
                modal.remove();
                this.showStatus('Email notifications skipped', '');
            }
        });
    }

    // ------------------------------------------------------------------
    sendEmailNotification(title, message, medication) {
        const userEmail = localStorage.getItem('notificationEmail');
        if (!userEmail) return;
        if (!window.emailjs) {
            this.loadEmailJS().then(() => {
                if (window.emailjs) this.sendEmailNotification(title, message, medication);
            });
            return;
        }

        const med = medication || {};
        const scheduledTime = med.time ? formatTime(med.time) : 'Unknown';
        const slotLabel = med.slot ? getSlotLabel(med.slot) : 'Unknown';
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
                compartment: slotLabel,
                scheduled_time: scheduledTime,
                current_time: currentTime,
                from_name: 'AlagaTap'
            }
        ).then((result) => {
            if (result.status === 200) {
                console.log('[AlagaTap] Email sent:', title, '->', userEmail);
            }
        }).catch((err) => {
            console.warn('[AlagaTap] Email send failed:', err);
        });
    }

    // ------------------------------------------------------------------
    showStatus(message, type) {
        type = type || '';
        const el = document.getElementById('notificationStatus');
        if (!el) return;
        el.className = 'notification-status ' + type;
        el.innerHTML = '<span class="status-message">' + message + '</span>';
    }

    showToast(message) {
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
        }, 4000);
    }
}

export function initNotifications(state, onUpdate) {
    return new NotificationManager(state, onUpdate);
}