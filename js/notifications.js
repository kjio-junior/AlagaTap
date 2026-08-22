export class NotificationManager {
    constructor(state, onUpdate) {
        console.log('NotificationManager constructor called');
        this.state = state;
        this.onUpdate = onUpdate;
        this.notificationCheckInterval = null;
        this.emailEnabled = false;
        this.emailjsServiceId = 'service_8pm1t27';
        this.emailjsTemplateId = 'template_kzpgxam';
        this.emailjsPublicKey = 'mCeqJyqUw5x1XdUK2';
        this.emailEnabled = localStorage.getItem('notificationEmail') !== null;
        this.init();
    }
    
    async init() {
        console.log('Initializing NotificationManager');
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
                } else {
                    this.stopChecker();
                    this.showStatus('Email reminders disabled', '');
                }
            });
        }
        if (this.state.notificationsEnabled) {
            this.startChecker();
        }
        if (this.state.notificationsEnabled && !this.emailEnabled) {
            setTimeout(() => {
                this.showEmailSetup();
            }, 3000);
        }
        console.log('NotificationManager initialized');
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
            script.onerror = () => {
                resolve();
            };
            document.head.appendChild(script);
        });
    }
    
    showEmailSetup() {
        if (localStorage.getItem('emailSetupShown') === 'true' && localStorage.getItem('notificationEmail')) {
            const currentEmail = localStorage.getItem('notificationEmail');
            if (!confirm('Your current email is: ' + currentEmail + '\n\nDo you want to change it?')) {
                return;
            }
        }
        const modal = document.createElement('div');
        modal.className = 'email-setup-modal';
        modal.innerHTML = `
            <div class="email-setup-content">
                <h3>Email Reminders</h3>
                <p>Enter your email address to receive medication reminders.</p>
                <p style="font-size: 13px; color: var(--text-muted); margin-top: -8px;">
                    You will get notifications 3 minutes before each dose.
                </p>
                <div class="email-input-group" style="margin-top: 16px;">
                    <input type="email" id="emailInput" placeholder="your@email.com" 
                           value="${localStorage.getItem('notificationEmail') || ''}" 
                           style="flex: 1; padding: 10px 14px; border: 1.5px solid var(--border-color); border-radius: 8px; font-size: 15px; min-height: 48px; background: var(--bg-primary); color: var(--text-primary);" />
                    <button id="emailSetupBtn" class="btn-primary" style="min-height: 48px; white-space: nowrap;">
                        ${localStorage.getItem('notificationEmail') ? 'Update' : 'Save'}
                    </button>
                </div>
                <div id="emailSetupStatus" style="margin-top: 8px; font-size: 13px; display: none;"></div>
                <button class="setup-skip" id="emailSkipBtn" style="margin-top: 12px; background: none; border: none; color: var(--text-muted); font-size: 13px; cursor: pointer; width: 100%; text-align: center; padding: 8px;">
                    ${localStorage.getItem('notificationEmail') ? 'Remove Email' : 'Skip for now'}
                </button>
            </div>
        `;
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
            localStorage.setItem('emailSetupShown', 'true');
            this.emailEnabled = true;
            statusDiv.style.display = 'block';
            statusDiv.style.color = '#0052CC';
            statusDiv.textContent = 'Sending test email...';
            try {
                var result = await window.emailjs.send(
                    this.emailjsServiceId,
                    this.emailjsTemplateId,
                    {
                        to_email: email,
                        to_name: 'AlagaTap User',
                        title: 'Test Notification',
                        message: 'Your medication reminders are set up! You will receive notifications 3 minutes before each dose.',
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
                    document.dispatchEvent(new Event('emailUpdated'));
                    setTimeout(function() { modal.remove(); }, 1500);
                } else {
                    throw new Error('EmailJS error');
                }
            } catch (error) {
                console.warn('Email send failed:', error);
                statusDiv.style.color = '#FF5252';
                statusDiv.textContent = 'Failed to send test email. Please try again.';
                var subject = 'AlagaTap: Test Notification';
                var body = 'Your medication reminders are set up! You will receive notifications 3 minutes before each dose.';
                window.open('mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body), '_blank');
            }
        });
        document.getElementById('emailSkipBtn').addEventListener('click', function() {
            if (localStorage.getItem('notificationEmail')) {
                if (confirm('Remove your email from AlagaTap reminders?')) {
                    localStorage.removeItem('notificationEmail');
                    localStorage.removeItem('emailSetupShown');
                    this.emailEnabled = false;
                    modal.remove();
                    this.showToast('Email removed from reminders');
                    this.showStatus('Email notifications disabled', '');
                    document.dispatchEvent(new Event('emailUpdated'));
                }
            } else {
                localStorage.setItem('emailSetupShown', 'true');
                modal.remove();
                this.showStatus('Email notifications skipped', '');
            }
        }.bind(this));
    }
    
    startChecker() {
        this.stopChecker();
        this.notificationCheckInterval = setInterval(function() {
            this.checkScheduledDoses();
        }.bind(this), 30000);
        this.checkScheduledDoses();
    }
    
    stopChecker() {
        if (this.notificationCheckInterval) {
            clearInterval(this.notificationCheckInterval);
            this.notificationCheckInterval = null;
        }
    }
    
    checkScheduledDoses() {
        var now = new Date();
        var today = now.toISOString().split('T')[0];
        var nowMin = now.getHours() * 60 + now.getMinutes();
        var nowSeconds = now.getSeconds();
        this.state.medications.forEach(function(med) {
            var scheduleDate = new Date(med.schedule).toISOString().split('T')[0];
            if (scheduleDate !== today) return;
            var scheduleMin = this.getScheduleMinutes(med.schedule);
            var timeDiff = nowMin - scheduleMin;
            var alreadyLogged = this.state.logs.some(function(l) {
                return l.medicationId === med.id && l.timestamp.startsWith(today);
            });
            if (alreadyLogged) return;
            if (timeDiff >= -3 && timeDiff < 0 && nowSeconds < 5) {
                this.sendEmailNotification(
                    'Upcoming: ' + med.name,
                    med.name + ' (' + med.dosage + ') due in ' + Math.abs(Math.floor(timeDiff)) + ' minutes. ' + this.getCompartmentLabel(med.compartment) + ' dose.',
                    med
                );
            }
            if (timeDiff >= 0 && timeDiff <= 1 && nowSeconds < 10) {
                this.sendEmailNotification(
                    'Time for ' + med.name,
                    'Take ' + med.name + ' (' + med.dosage + ') - ' + this.getCompartmentLabel(med.compartment) + ' dose.',
                    med
                );
            }
            if (timeDiff > 1 && timeDiff % 15 < 1) {
                var overdueMinutes = Math.floor(timeDiff);
                this.sendEmailNotification(
                    med.name + ' Overdue',
                    med.name + ' is ' + overdueMinutes + ' min overdue. ' + this.getCompartmentLabel(med.compartment) + ' dose.',
                    med
                );
            }
        }.bind(this));
    }
    
    sendEmailNotification(title, message, medication) {
        var userEmail = localStorage.getItem('notificationEmail');
        if (!userEmail) {
            console.warn('No email configured');
            return;
        }
        if (!window.emailjs) {
            this.loadEmailJS().then(function() {
                if (window.emailjs) {
                    this.sendEmailNotification(title, message, medication);
                }
            }.bind(this));
            return;
        }
        var med = medication || {};
        var scheduledTime = med.schedule ? this.formatTime(med.schedule) : 'Unknown';
        var compartmentLabel = med.compartment ? this.getCompartmentLabel(med.compartment) : 'Unknown';
        var currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
                compartment: compartmentLabel,
                scheduled_time: scheduledTime,
                current_time: currentTime,
                from_name: 'AlagaTap'
            }
        ).then(function(result) {
            if (result.status === 200) {
                console.log('Email sent to:', userEmail);
            }
        }).catch(function(error) {
            console.warn('Email send failed:', error);
            var subject = 'AlagaTap: ' + title;
            var body = message + '\n\nMedication: ' + (med.name || 'Unknown') + '\nDosage: ' + (med.dosage || 'Unknown') + '\nCompartment: ' + compartmentLabel + '\nScheduled: ' + scheduledTime;
            window.open('mailto:' + userEmail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body), '_blank');
        });
    }
    
    testNotification() {
        if (!this.state.notificationsEnabled) {
            this.showToast('Please enable notifications first');
            return;
        }
        var userEmail = localStorage.getItem('notificationEmail');
        if (!userEmail) {
            this.showToast('Please set up your email first');
            this.showEmailSetup();
            return;
        }
        this.sendEmailNotification(
            'Test Notification',
            'Your notifications are working! You will get reminders 3 minutes before each dose.',
            null
        );
        this.showToast('Test email sent to ' + userEmail);
    }
    
    showStatus(message, type) {
        if (typeof type === 'undefined') type = '';
        var statusDiv = document.getElementById('notificationStatus');
        if (!statusDiv) return;
        statusDiv.className = 'notification-status ' + type;
        statusDiv.innerHTML = '<span class="status-message">' + message + '</span>';
    }
    
    showToast(message) {
        var existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function() {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(function() { toast.remove(); }, 300);
        }, 4000);
    }
    
    getScheduleMinutes(scheduleStr) {
        var d = new Date(scheduleStr);
        return d.getHours() * 60 + d.getMinutes();
    }
    
    getCompartmentLabel(compartment) {
        var labels = { 'A': 'Morning', 'B': 'Noon', 'C': 'Night', 'D': 'Custom' };
        return labels[compartment] || compartment;
    }
    
    formatTime(isoString) {
        if (!isoString) return 'Unknown';
        var d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

export function initNotifications(state, onUpdate) {
    console.log('initNotifications called');
    var manager = new NotificationManager(state, onUpdate);
    console.log('NotificationManager instance created');
    return manager;
}