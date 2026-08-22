// js/notifications.js - OneSignal + Email notification system
// No installation required! Works on mobile and desktop

export class NotificationManager {
    constructor(state, onUpdate) {
        this.state = state;
        this.onUpdate = onUpdate;
        this.onesignalInitialized = false;
        this.notificationCheckInterval = null;
        this.emailEnabled = false;
        
        // Get environment variables
        this.onesignalAppId = import.meta.env?.VITE_ONESIGNAL_APP_ID || 'YOUR_ONESIGNAL_APP_ID';
        this.onesignalSafariId = import.meta.env?.VITE_ONEWSIGNAL_SAFARI_ID || 'web.onesignal.auto.1234567890';
        this.formspreeId = import.meta.env?.VITE_FORMSPREE_ID || 'YOUR_FORM_ID';
        
        // Check if email is configured
        this.emailEnabled = localStorage.getItem('notificationEmail') !== null;
        
        // Initialize
        this.init();
    }
    
    async init() {
        // Initialize OneSignal
        await this.initOneSignal();
        
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
        
        // If enabled, start checker
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
    
    // ===== ONESIGNAL SETUP =====
    async initOneSignal() {
        try {
            // Wait for OneSignal to load
            if (!window.OneSignal) {
                console.warn('OneSignal not loaded, waiting...');
                await new Promise(resolve => {
                    const checkInterval = setInterval(() => {
                        if (window.OneSignal) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 100);
                });
            }
            
            // Initialize OneSignal
            window.OneSignal = window.OneSignal || [];
            window.OneSignal.push(() => {
                OneSignal.init({
                    appId: this.onesignalAppId,
                    allowLocalhostAsSecureOrigin: true,
                    notifyButton: {
                        enable: false
                    },
                    safari_web_id: this.onesignalSafariId
                });
            });
            
            this.onesignalInitialized = true;
            console.log('✅ OneSignal initialized');
            
            // Check if already subscribed
            await this.checkOneSignalStatus();
            
            // Listen for subscription changes
            window.OneSignal.push(() => {
                OneSignal.on('subscriptionChange', (isSubscribed) => {
                    console.log('OneSignal subscription changed:', isSubscribed);
                    if (isSubscribed) {
                        this.showStatus('✅ Browser notifications enabled', 'success');
                    }
                });
            });
            
        } catch (error) {
            console.warn('OneSignal init failed:', error);
            this.showStatus('⚠️ Browser notifications unavailable', 'error');
        }
    }
    
    async checkOneSignalStatus() {
        return new Promise((resolve) => {
            if (!window.OneSignal) {
                resolve(false);
                return;
            }
            
            window.OneSignal.push(() => {
                OneSignal.isPushNotificationsEnabled().then((isEnabled) => {
                    if (isEnabled) {
                        this.showStatus('✅ Browser notifications active', 'success');
                    }
                    resolve(isEnabled);
                });
            });
        });
    }
    
    // ===== EMAIL NOTIFICATIONS =====
    showEmailSetup() {
        // Check if already shown or skipped
        if (localStorage.getItem('emailSetupShown') === 'true') return;
        
        const modal = document.createElement('div');
        modal.className = 'email-setup-modal';
        modal.innerHTML = `
            <div class="email-setup-content">
                <h3>📧 Get Email Reminders</h3>
                <p>Enter your email address to receive medication reminders (optional).<br>
                <small style="color: var(--text-muted);">We'll only use this for sending reminders.</small></p>
                <div class="email-input-group">
                    <input type="email" id="emailInput" placeholder="your@email.com" />
                    <button id="emailSetupBtn" class="btn-primary">Save</button>
                </div>
                <button class="setup-skip" id="emailSkipBtn">Skip for now</button>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('emailSetupBtn').addEventListener('click', () => {
            const email = document.getElementById('emailInput').value.trim();
            if (email && email.includes('@')) {
                localStorage.setItem('notificationEmail', email);
                localStorage.setItem('emailSetupShown', 'true');
                this.emailEnabled = true;
                modal.remove();
                this.showStatus('✅ Email notifications enabled', 'success');
                this.sendTestEmail();
                this.showToast('📧 Test email sent to ' + email);
            } else {
                alert('Please enter a valid email address.');
            }
        });
        
        document.getElementById('emailSkipBtn').addEventListener('click', () => {
            localStorage.setItem('emailSetupShown', 'true');
            modal.remove();
            this.showStatus('Email notifications skipped', '');
        });
    }
    
    sendTestEmail() {
        const email = localStorage.getItem('notificationEmail');
        if (!email) return;
        
        fetch(`https://formspree.io/f/${this.formspreeId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                subject: 'AlagaTap: Test Notification',
                message: 'Your medication reminders are set up! You will receive notifications 3 minutes before each dose.'
            })
        }).catch(() => {
            // Fallback: open email client
            window.location.href = `mailto:${email}?subject=AlagaTap%20Test&body=Your%20medication%20reminders%20are%20set%20up!`;
        });
    }
    
    // ===== NOTIFICATION CHECKER =====
    startChecker() {
        this.stopChecker();
        
        // Check every 30 seconds
        this.notificationCheckInterval = setInterval(() => {
            this.checkScheduledDoses();
        }, 30000);
        
        // Check immediately
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
            
            // 3 minutes before
            if (timeDiff >= -3 && timeDiff < 0 && nowSeconds < 5) {
                this.sendNotification(
                    `⏰ Upcoming: ${med.name}`,
                    `${med.name} (${med.dosage}) due in ${Math.abs(Math.floor(timeDiff))} minutes. ${this.getCompartmentLabel(med.compartment)} dose.`,
                    med
                );
            }
            
            // At scheduled time
            if (timeDiff >= 0 && timeDiff <= 1 && nowSeconds < 10) {
                this.sendNotification(
                    `💊 Time for ${med.name}`,
                    `Take ${med.name} (${med.dosage}) - ${this.getCompartmentLabel(med.compartment)} dose.`,
                    med
                );
            }
            
            // Overdue (every 15 minutes)
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
        // Send via OneSignal (browser push)
        this.sendOneSignal(title, message, medication);
        
        // Send via Email (if configured)
        if (this.emailEnabled) {
            this.sendEmail(title, message, medication);
        }
    }
    
    sendOneSignal(title, message, medication) {
        if (!window.OneSignal) return;
        
        window.OneSignal.push(() => {
            OneSignal.sendSelfNotification(
                title,
                message,
                null,
                {
                    medicationId: medication ? medication.id : null
                }
            ).then(() => {
                console.log('📱 OneSignal notification sent:', title);
            }).catch(err => {
                console.warn('OneSignal send failed:', err);
            });
        });
    }
    
    sendEmail(title, message, medication) {
        const email = localStorage.getItem('notificationEmail');
        if (!email) return;
        
        const subject = `AlagaTap: ${title}`;
        const body = `${message}\n\n---\nLogged by: Self-Reported\nTime: ${new Date().toLocaleString()}\nMedication: ${medication ? medication.name : 'Unknown'}`;
        
        fetch(`https://formspree.io/f/${this.formspreeId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                subject: subject,
                message: body
            })
        }).catch(() => {
            // Fallback: open email client
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

// Export for use in app.js
export function initNotifications(state, onUpdate) {
    const manager = new NotificationManager(state, onUpdate);
    return manager;
}