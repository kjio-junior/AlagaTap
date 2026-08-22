// js/notifications.js - Web Notifications API with 3-minute advance reminders
// Uses Service Worker-like background checking with setInterval

let notificationInterval = null;
let notificationTimeout = null;

export function initNotifications(state, onUpdate) {
    const toggle = document.getElementById('notificationToggle');
    if (!toggle) return;
    
    // Restore state
    toggle.checked = state.notificationsEnabled || false;
    
    // Request permission if enabled
    if (toggle.checked) {
        requestPermission();
        startNotificationChecker(state, onUpdate);
    }
    
    toggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        state.notificationsEnabled = enabled;
        onUpdate(state);
        
        if (enabled) {
            requestPermission();
            startNotificationChecker(state, onUpdate);
            showToast('🔔 Reminders enabled! You\'ll get notified 3 minutes before each dose.');
        } else {
            stopNotificationChecker();
            showToast('🔕 Reminders disabled');
        }
    });
    
    // Also check when page becomes visible again
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && state.notificationsEnabled) {
            checkScheduledDoses(state, onUpdate);
        }
    });
}

function requestPermission() {
    if (!('Notification' in window)) {
        console.warn('Notifications not supported in this browser');
        return;
    }
    
    if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showToast('✅ Notifications permission granted!');
            } else {
                showToast('⚠️ Please allow notifications for reminders to work.');
            }
        });
    }
}

function startNotificationChecker(state, onUpdate) {
    stopNotificationChecker();
    
    // Check every 30 seconds for better timing accuracy
    notificationInterval = setInterval(() => {
        checkScheduledDoses(state, onUpdate);
    }, 30000);
    
    // Also check immediately
    checkScheduledDoses(state, onUpdate);
    
    // Set up a more aggressive check for the next 5 minutes
    // This ensures notifications fire even if the tab is inactive
    scheduleNextCheck(state, onUpdate);
}

function scheduleNextCheck(state, onUpdate) {
    if (notificationTimeout) clearTimeout(notificationTimeout);
    
    // Check again in 15 seconds to catch any missed notifications
    notificationTimeout = setTimeout(() => {
        if (state.notificationsEnabled) {
            checkScheduledDoses(state, onUpdate);
            scheduleNextCheck(state, onUpdate);
        }
    }, 15000);
}

function stopNotificationChecker() {
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
    }
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }
}

function checkScheduledDoses(state, onUpdate) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const nowSeconds = now.getSeconds();
    
    state.medications.forEach(med => {
        const scheduleDate = new Date(med.schedule).toISOString().split('T')[0];
        
        // Only check today's medications
        if (scheduleDate !== today) return;
        
        const scheduleMin = getScheduleMinutes(med.schedule);
        const timeDiff = nowMin - scheduleMin;
        
        // Check if already logged today
        const alreadyLogged = state.logs.some(l => 
            l.medicationId === med.id && 
            l.timestamp.startsWith(today)
        );
        
        if (alreadyLogged) return;
        
        // Check for 3 minutes before schedule (timeDiff between -3 and 0)
        const isThreeMinutesBefore = timeDiff >= -3 && timeDiff < 0;
        const isAtScheduledTime = timeDiff >= 0 && timeDiff <= 1;
        const isOverdue = timeDiff > 1 && timeDiff <= 60;
        
        // Send notification 3 minutes before
        if (isThreeMinutesBefore && nowSeconds < 5) {
            // Send "coming up" notification
            const reminderTime = new Date(med.schedule);
            const timeStr = reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            sendNotification(
                '⏰ Upcoming Dose',
                `${med.name} (${med.dosage}) is due at ${timeStr}. Get ready to take your ${getCompartmentLabel(med.compartment)} dose.`,
                'reminder'
            );
        }
        
        // Send notification at scheduled time (with a small window)
        if (isAtScheduledTime && nowSeconds < 10) {
            sendNotification(
                '💊 Dose Time',
                `It's time to take ${med.name} (${med.dosage}) - ${getCompartmentLabel(med.compartment)} compartment.`,
                'due'
            );
        }
        
        // Send overdue notification (every 15 minutes)
        if (isOverdue && timeDiff % 15 < 1) {
            const overdueMinutes = Math.floor(timeDiff);
            sendNotification(
                '⚠️ Dose Overdue',
                `${med.name} (${med.dosage}) is ${overdueMinutes} minutes overdue. Please take your ${getCompartmentLabel(med.compartment)} dose.`,
                'overdue'
            );
        }
    });
}

function sendNotification(title, body, type = 'reminder') {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }
    
    // Create a unique key for this notification type and medication
    const key = `${type}_${body.substring(0, 30)}`;
    const lastSent = localStorage.getItem('notif_last_' + key);
    const now = Date.now();
    
    // Throttle: Don't send the same notification more than once every 5 minutes
    if (lastSent) {
        const diff = now - parseInt(lastSent);
        if (diff < 300000) return; // 5 minutes
    }
    
    try {
        // Create the notification with options for system notification bar
        const notification = new Notification('🔔 AlagaTap', {
            body: title + '\n' + body,
            icon: getNotificationIcon(type),
            tag: key,
            requireInteraction: true, // Stays until user interacts
            silent: false,
            vibrate: [200, 100, 200], // Vibrate pattern for mobile
            timestamp: now,
            data: { type, timestamp: now }
        });
        
        // Store when this was sent
        localStorage.setItem('notif_last_' + key, now.toString());
        
        // Auto-close after 30 seconds if not interacted with
        setTimeout(() => {
            try { notification.close(); } catch (e) {}
        }, 30000);
        
        // Handle click on notification
        notification.onclick = function() {
            window.focus();
            this.close();
            
            // If it's a "due" notification, open the app and highlight the medication
            if (type === 'due' || type === 'overdue') {
                // Find the medication from the body
                const medName = body.split('(')[0]?.trim();
                if (medName) {
                    const med = state.medications.find(m => m.name === medName);
                    if (med) {
                        // Scroll to and highlight the medication card
                        const cards = document.querySelectorAll('.compartment-card');
                        cards.forEach(card => {
                            if (card.dataset.medId === med.id) {
                                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                card.style.borderColor = '#0052CC';
                                card.style.borderWidth = '3px';
                                setTimeout(() => {
                                    card.style.borderColor = '';
                                    card.style.borderWidth = '';
                                }, 3000);
                            }
                        });
                    }
                }
            }
        };
        
        // Also log to console for debugging
        console.log(`🔔 Notification sent: ${title} - ${body.substring(0, 50)}...`);
        
    } catch (e) {
        console.warn('Failed to send notification:', e);
    }
}

function getNotificationIcon(type) {
    // Return different icons based on notification type
    // Using data URIs for SVG icons
    const icons = {
        reminder: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%230052CC"/><text x="50" y="65" text-anchor="middle" fill="white" font-size="50" font-family="sans-serif">⏰</text></svg>',
        due: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%2300E5A3"/><text x="50" y="65" text-anchor="middle" fill="white" font-size="50" font-family="sans-serif">💊</text></svg>',
        overdue: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23FF5252"/><text x="50" y="65" text-anchor="middle" fill="white" font-size="50" font-family="sans-serif">⚠️</text></svg>'
    };
    return icons[type] || icons.reminder;
}

// Helper functions
function getScheduleMinutes(scheduleStr) {
    const d = new Date(scheduleStr);
    return d.getHours() * 60 + d.getMinutes();
}

function getCompartmentLabel(compartment) {
    const labels = { 'A': 'Morning', 'B': 'Noon', 'C': 'Night', 'D': 'Custom' };
    return labels[compartment] || compartment;
}

function showToast(message) {
    // Simple toast function if not available globally
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: #1e293b;
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 500;
        font-size: 14px;
        z-index: 2000;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        animation: toastSlide 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Export for debugging
export function testNotification() {
    if (!('Notification' in window)) {
        console.warn('Notifications not supported');
        return;
    }
    
    if (Notification.permission !== 'granted') {
        Notification.requestPermission().then(() => {
            testNotification();
        });
        return;
    }
    
    sendNotification(
        '🧪 Test Notification',
        'This is a test notification from AlagaTap. Your reminders are working!',
        'reminder'
    );
    showToast('✅ Test notification sent!');
}

// Make test function available globally
window.testAlagaTapNotification = testNotification;