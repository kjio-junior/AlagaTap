// js/notifications.js - OneSignal + Email notification system

export class NotificationManager {
    constructor(state, onUpdate) {
        this.state = state;
        this.onUpdate = onUpdate;
        this.onesignalInitialized = false;
        this.notificationCheckInterval = null;
        this.emailEnabled = false;
        this.formspreeEndpoint = 'https://formspree.io/f/mwlezwlj';
        
        this.emailEnabled = localStorage.getItem('notificationEmail') !== null;
        this.init();
    }
    
    async init() {
        // Initialize OneSignal (already configured in HTML)
        this.onesignalInitialized = true;
        await this.checkOneSignalStatus();
        
        // Check and start notification checker if enabled
        const toggle = document.getElementById('notificationToggle');
        if (toggle) {
            toggle.checked = this.state.notificationsEnabled || false;
            toggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                this.state.notificationsEnabled = enabled;
                this.onUpdate(this.state);
                
                if (enabled) {
                    this.startChecker();
                    this.showStatus('✅ Notifications enabled', 'success');
                } else {
                    this.stopChecker();
                    this.showStatus('🔕 Notifications disabled', '');
                }
            });
        }
        
        if (this.state.notificationsEnabled) {
            this.startChecker();
        }
        
        // Show email setup if not configured and notifications are enabled
        if (this.state.notificationsEnabled && !this.emailEnabled) {
            setTimeout(() => {
                this.showEmailSetup();
            }, 3000);
        }
    }
    
    async checkOneSignalStatus() {
        try {
            if (window.OneSignalDeferred) {
                window.OneSignalDeferred.push(async function(OneSignal) {
                    const isEnabled = await OneSignal.Notifications.permission;
                    if (isEnabled) {
                        this.showStatus('✅ Browser notifications active', 'success');
                    }
                });
            }
        } catch (error) {
            console.warn('OneSignal check failed:', error);
        }
    }
    
    // ===== EMAIL SETUP =====
    showEmailSetup() {
        if (localStorage.getItem('emailSetupShown') === 'true' && localStorage.getItem('notificationEmail')) {
            const currentEmail = localStorage.getItem('notificationEmail');
            if (!confirm(`Your current email is: ${currentEmail}\n\nDo you want to change it?`)) {
                return;
            }
        }
        
        const modal = document.createElement('div');
        modal.className = 'email-setup-modal';
        modal.innerHTML = `
            <div class="email-setup-content">
                <h3>📧 Email Reminders</h3>
                <p>Enter your email address to receive medication reminders via email.</p>
                <p style="font-size: 13px; color: var(--text-muted); margin-top: -8px;">
                    You'll get notifications 3 minutes before each dose.
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
                statusDiv.textContent = '⚠️ Please enter a valid email address.';
                return;
            }
            
            localStorage.setItem('notificationEmail', email);
            localStorage.setItem('emailSetupShown', 'true');
            this.emailEnabled = true;
            
            statusDiv.style.display = 'block';
            statusDiv.style.color = '#0052CC';
            statusDiv.textContent = '📧 Sending test email...';
            
            try {
                const response = await fetch(this.formspreeEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        email: email,
                        subject: 'AlagaTap: Test Notification',
                        message: 'Your medication reminders are set up! You will receive notifications 3 minutes before each dose.\n\n' +
                                'To test: Add a medication and set it 5 minutes from now.\n' +
                                'This is a self-reported dose log system.'
                    })
                });
                
                if (response.ok) {
                    statusDiv.style.color = '#00E5A3';
                    statusDiv.textContent = '✅ Test email sent to ' + email;
                    this.showStatus('✅ Email notifications enabled', 'success');
                    this.showToast('📧 Test email sent to ' + email);
                    document.dispatchEvent(new Event('emailUpdated'));
                    setTimeout(() => modal.remove(), 1500);
                } else {
                    throw new Error('Failed to send email');
                }
            } catch (error) {
                console.warn('Email send failed, using fallback:', error);
                const subject = 'AlagaTap: Test Notification';
                const body = 'Your medication reminders are set up! You will receive notifications 3 minutes before each dose.';
                window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                modal.remove();
                this.showToast('📧 Email client opened. Please send the test email.');
            }
        });
        
        document.getElementById('emailSkipBtn').addEventListener('click', () => {
            if (localStorage.getItem('notificationEmail')) {
                if (confirm('Remove your email from AlagaTap reminders?')) {
                    localStorage.removeItem('notificationEmail');
                    localStorage.removeItem('emailSetupShown');
                    this.emailEnabled = false;
                    modal.remove();
                    this.showToast('📧 Email removed from reminders');
                    this.showStatus('Email notifications disabled', '');
                    document.dispatchEvent(new Event('emailUpdated'));
                }
            } else {
                localStorage.setItem('emailSetupShown', 'true');
                modal.remove();
                this.showStatus('Email notifications skipped', '');
            }
        });
    }
    
    // ===== NOTIFICATION CHECKER =====
    startChecker() {
        this.stopChecker();
        this.notificationCheckInterval = setInterval(() => {
            this.checkScheduledDoses();
        }, 30000);
        this.checkScheduledDoses();
    }
    
    stopChecker() {
        if (this.notificationCheckInterval) {
            clearInterval(this.notificationCheckInterval);
            this.notificationCheckInterval = null;
        }
    }
    
    checkScheduledDoses() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const nowSeconds = now.getSeconds();
        
        this.state.medications.forEach(med => {
            const scheduleDate = new Date(med.schedule).toISOString().split('T')[0];
            if (scheduleDate !== today) return;
            
            const scheduleMin = this.getScheduleMinutes(med.schedule);
            const timeDiff = nowMin - scheduleMin;
            
            const alreadyLogged = this.state.logs.some(l => 
                l.medicationId === med.id && 
                l.timestamp.startsWith(today)
            );
            
            if (alreadyLogged) return;
            
            if (timeDiff >= -3 && timeDiff < 0 && nowSeconds < 5) {
                this.sendNotification(
                    `⏰ Upcoming: ${med.name}`,
                    `${med.name} (${med.dosage}) due in ${Math.abs(Math.floor(timeDiff))} minutes. ${this.getCompartmentLabel(med.compartment)} dose.`,
                    med
                );
            }
            
            if (timeDiff >= 0 && timeDiff <= 1 && nowSeconds < 10) {
                this.sendNotification(
                    `💊 Time for ${med.name}`,
                    `Take ${med.name} (${med.dosage}) - ${this.getCompartmentLabel(med.compartment)} dose.`,
                    med
                );
            }
            
            if (timeDiff > 1 && timeDiff % 15 < 1) {
                const overdueMinutes = Math.floor(timeDiff);
                this.sendNotification(
                    `⚠️ ${med.name} Overdue`,
                    `${med.name} is ${overdueMinutes} min overdue. ${this.getCompartmentLabel(med.compartment)} dose.`,
                    med
                );
            }
        });
    }
    
    // ===== SEND NOTIFICATIONS =====
    sendNotification(title, message, medication) {
        this.sendOneSignal(title, message, medication);
        if (this.emailEnabled) {
            this.sendEmail(title, message, medication);
        }
    }
    
    sendOneSignal(title, message, medication) {
        if (!window.OneSignal) return;
        
        window.OneSignalDeferred?.push(async function(OneSignal) {
            try {
                await OneSignal.Notifications.addNotification({
                    title: title,
                    body: message,
                    data: {
                        medicationId: medication ? medication.id : null
                    }
                });
                console.log('📱 OneSignal notification sent:', title);
            } catch (err) {
                console.warn('OneSignal send failed:', err);
            }
        });
    }
    
    sendEmail(title, message, medication) {
        const email = localStorage.getItem('notificationEmail');
        if (!email) return;
        
        const subject = `AlagaTap: ${title}`;
        const body = `${message}\n\n---\nLogged by: Self-Reported\nTime: ${new Date().toLocaleString()}\nMedication: ${medication ? medication.name : 'Unknown'}`;
        
        fetch(this.formspreeEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                subject: subject,
                message: body
            })
        }).catch(() => {
            window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        });
    }
    
    // ===== TEST NOTIFICATION =====
    testNotification() {
        if (!this.state.notificationsEnabled) {
            this.showToast('⚠️ Please enable notifications first');
            return;
        }
        
        this.sendNotification(
            '🧪 Test Notification',
            'Your notifications are working! You\'ll get reminders 3 minutes before each dose.',
            null
        );
        
        this.showToast('✅ Test notification sent! Check your phone/email.');
    }
    
    // ===== UI HELPERS =====
    showStatus(message, type = '') {
        const statusDiv = document.getElementById('notificationStatus');
        if (!statusDiv) return;
        statusDiv.className = `notification-status ${type}`;
        statusDiv.innerHTML = `<span class="status-message">${message}</span>`;
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
    
    // ===== HELPERS =====
    getScheduleMinutes(scheduleStr) {
        const d = new Date(scheduleStr);
        return d.getHours() * 60 + d.getMinutes();
    }
    
    getCompartmentLabel(compartment) {
        const labels = { 'A': 'Morning', 'B': 'Noon', 'C': 'Night', 'D': 'Custom' };
        return labels[compartment] || compartment;
    }
}

export function initNotifications(state, onUpdate) {
    const manager = new NotificationManager(state, onUpdate);
    return manager;
}