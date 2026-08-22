// js/notifications.js - Web Notifications API handler
let notificationInterval = null;

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
        } else {
            stopNotificationChecker();
        }
    });
}

function requestPermission() {
    if (!('Notification' in window)) {
        console.warn('Notifications not supported');
        return;
    }
    
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function startNotificationChecker(state, onUpdate) {
    stopNotificationChecker();
    
    // Check every minute
    notificationInterval = setInterval(() => {
        checkScheduledDoses(state, onUpdate);
    }, 60000);
    
    // Also check immediately
    checkScheduledDoses(state, onUpdate);
}

function stopNotificationChecker() {
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
    }
}

function checkScheduledDoses(state, onUpdate) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const nowMin = now.getHours() * 60 + now.getMinutes();
    
    state.medications.forEach(med => {
        const scheduleDate = new Date(med.schedule).toISOString().split('T')[0];
        if (scheduleDate !== today) return;
        
        const scheduleMin = getScheduleMinutes(med.schedule);
        const timeDiff = nowMin - scheduleMin;
        
        // Check if dose is due (within 5 minute window) or overdue
        const isDue = timeDiff >= 0 && timeDiff <= 5;
        const isOverdue = timeDiff > 5 && timeDiff <= 60;
        
        // Check if already logged today
        const alreadyLogged = state.logs.some(l => 
            l.medicationId === med.id && 
            l.timestamp.startsWith(today)
        );
        
        if (alreadyLogged) return;
        
        if (isDue) {
            sendNotification(
                'Dose Due',
                `${med.name} (${med.dosage}) - ${getCompartmentLabel(med.compartment)} compartment is due now.`
            );
        } else if (isOverdue && timeDiff % 15 < 2) {
            // Send reminder every 15 minutes for overdue
            sendNotification(
                'Dose Overdue',
                `${med.name} (${med.dosage}) - ${getCompartmentLabel(med.compartment)} dose is overdue.`
            );
        }
    });
}

function sendNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }
    
    // Check if a similar notification was sent recently (throttle)
    const key = `${title}_${body}`;
    const lastSent = localStorage.getItem('notif_last_' + key);
    if (lastSent) {
        const diff = Date.now() - parseInt(lastSent);
        if (diff < 120000) return; // 2 minute throttle
    }
    
    try {
        const notification = new Notification('AlagaTap: ' + title, {
            body: body,
            tag: key,
            requireInteraction: true
        });
        
        localStorage.setItem('notif_last_' + key, Date.now().toString());
        
        setTimeout(() => notification.close(), 10000);
    } catch (e) {
        console.warn('Failed to send notification', e);
    }
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