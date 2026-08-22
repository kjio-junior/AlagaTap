// js/notifications.js - EmailJS ONLY notification system
// NO FORMPREE - Sends directly to user's email

console.log('📧 notifications.js loaded');

export class NotificationManager {
    constructor(state, onUpdate) {
        console.log('🔧 NotificationManager constructor called');
        this.state = state;
        this.onUpdate = onUpdate;
        this.notificationCheckInterval = null;
        this.emailEnabled = false;
        
        // ===== REPLACE WITH YOUR EMAILJS VALUES =====
        this.emailjsServiceId = 'service_8pm1t27'; // Your Service ID
        this.emailjsTemplateId = 'template_kzpgxam'; // Your Template ID
        this.emailjsPublicKey = 'mCeqJyqUw5x1XdUK2'; // Your Public Key
        // ===================================================
        
        console.log('📧 EmailJS config:', {
            serviceId: this.emailjsServiceId,
            templateId: this.emailjsTemplateId,
            publicKey: this.emailjsPublicKey
        });
        
        this.emailEnabled = localStorage.getItem('notificationEmail') !== null;
        this.init();
    }
    
    async init() {
        console.log('🔄 NotificationManager.init() called');
        
        // Load EmailJS SDK
        await this.loadEmailJS();
        
        // Notification toggle
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
        
        // Show email setup if not configured
        if (this.state.notificationsEnabled && !this.emailEnabled) {
            setTimeout(() => {
                this.showEmailSetup();
            }, 3000);
        }
        
        console.log('✅ NotificationManager initialized');
    }
    
    async loadEmailJS() {
        console.log('📥 Loading EmailJS...');
        return new Promise((resolve) => {
            if (window.emailjs) {
                console.log('✅ EmailJS already loaded');
                window.emailjs.init(this.emailjsPublicKey);
                resolve();
                return;
            }
            
            console.log('⏳ Loading EmailJS from CDN...');
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
            script.onload = () => {
                console.log('✅ EmailJS loaded from CDN');
                window.emailjs.init(this.emailjsPublicKey);
                resolve();
            };
            script.onerror = () => {
                console.warn('⚠️ Failed to load EmailJS');
                resolve();
            };
            document.head.appendChild(script);
        });
    }
    
    // ===== EMAIL SETUP =====
    showEmailSetup() {
        console.log('📧 Showing email setup');
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
        
        // ===== SAVE EMAIL BUTTON - EMAILJS ONLY =====
        document.getElementById('emailSetupBtn').addEventListener('click', async () => {
            const email = document.getElementById('emailInput').value.trim();
            const statusDiv = document.getElementById('emailSetupStatus');
            
            if (!email || !email.includes('@')) {
                statusDiv.style.display = 'block';
                statusDiv.style.color = '#FF5252';
                statusDiv.textContent = 'Please enter a valid email address.';
                return;
            }
            
            // Save email locally
            localStorage.setItem('notificationEmail', email);
            localStorage.setItem('emailSetupShown', 'true');
            this.emailEnabled = true;
            
            statusDiv.style.display = 'block';
            statusDiv.style.color = '#0052CC';
            statusDiv.textContent = 'Sending test email via EmailJS...';
            
            try {
                // ===== EMAILJS - SEND DIRECTLY TO USER =====
                const result = await window.emailjs.send(
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
                    statusDiv.textContent = '✓ Test email sent to ' + email;
                    this.showStatus('Email notifications enabled', 'success');
                    this.showToast('Test email sent to ' + email);
                    document.dispatchEvent(new Event('emailUpdated'));
                    setTimeout(() => modal.remove(), 1500);
                } else {
                    throw new Error('EmailJS error');
                }
            } catch (error) {
                console.warn('Email send failed:', error);
                statusDiv.style.color = '#FF5252';
                statusDiv.textContent = 'Failed to send test email. Please try again.';
                // Fallback: open email client
                const subject = 'AlagaTap: Test Notification';
                const body = 'Your medication reminders are set up! You will receive notifications 3 minutes before each dose.';
                window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
            }
        });
        
        document.getElementById('emailSkipBtn').addEventListener('click', () => {
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
            
            // 3 minutes before
            if (timeDiff >= -3 && timeDiff < 0 && nowSeconds < 5) {
                this.sendEmailNotification(
                    `Upcoming: ${med.name}`,
                    `${med.name} (${med.dosage}) due in ${Math.abs(Math.floor(timeDiff))} minutes. ${this.getCompartmentLabel(med.compartment)} dose.`,
                    med
                );
            }
            
            // At scheduled time
            if (timeDiff >= 0 && timeDiff <= 1 && nowSeconds < 10) {
                this.sendEmailNotification(
                    `Time for ${med.name}`,
                    `Take ${med.name} (${med.dosage}) - ${this.getCompartmentLabel(med.compartment)} dose.`,
                    med
                );
            }
            
            // Overdue (every 15 minutes)
            if (timeDiff > 1 && timeDiff % 15 < 1) {
                const overdueMinutes = Math.floor(timeDiff);
                this.sendEmailNotification(
                    `${med.name} Overdue`,
                    `${med.name} is ${overdueMinutes} min overdue. ${this.getCompartmentLabel(med.compartment)} dose.`,
                    med
                );
            }
        });
    }
    
    // ===== SEND EMAIL NOTIFICATION - EMAILJS ONLY =====
    sendEmailNotification(title, message, medication) {
        const userEmail = localStorage.getItem('notificationEmail');
        if (!userEmail) {
            console.warn('No email configured');
            return;
        }
        
        // If EmailJS not loaded, try loading it
        if (!window.emailjs) {
            this.loadEmailJS().then(() => {
                if (window.emailjs) {
                    this.sendEmailNotification(title, message, medication);
                }
            });
            return;
        }
        
        const med = medication || {};
        const scheduledTime = med.schedule ? this.formatTime(med.schedule) : 'Unknown';
        const compartmentLabel = med.compartment ? this.getCompartmentLabel(med.compartment) : 'Unknown';
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // ===== EMAILJS - SEND DIRECTLY TO USER =====
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
        ).then((result) => {
            if (result.status === 200) {
                console.log('✅ Email sent to:', userEmail);
                console.log('📋 Medication:', med.name);
                console.log('⏰ Scheduled:', scheduledTime);
            }
        }).catch((error) => {
            console.warn('❌ Email send failed:', error);
            // Fallback: open email client
            const subject = `AlagaTap: ${title}`;
            const body = `${message}\n\nMedication: ${med.name || 'Unknown'}\nDosage: ${med.dosage || 'Unknown'}\nCompartment: ${compartmentLabel}\nScheduled: ${scheduledTime}`;
            window.open(`mailto:${userEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
        });
    }
    
    // ===== TEST NOTIFICATION (DEBUG) =====
    testNotification() {
        console.log('🧪 testNotification() called');
        if (!this.state.notificationsEnabled) {
            this.showToast('Please enable notifications first');
            return;
        }
        
        const userEmail = localStorage.getItem('notificationEmail');
        if (!userEmail) {
            this.showToast('Please set up your email first');
            this.showEmailSetup();
            return;
        }
        
        console.log('📧 Sending test email to:', userEmail);
        this.sendEmailNotification(
            'Test Notification',
            'Your notifications are working! You will get reminders 3 minutes before each dose.',
            null
        );
        
        this.showToast('Test email sent to ' + userEmail);
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
    
    formatTime(isoString) {
        if (!isoString) return 'Unknown';
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

console.log('📧 NotificationManager class defined');

export function initNotifications(state, onUpdate) {
    console.log('📧 initNotifications() called');
    const manager = new NotificationManager(state, onUpdate);
    console.log('📧 NotificationManager instance created:', manager);
    return manager;
}