// js/notifications.js - Complete with PWA support for mobile

let notificationInterval = null;
let notificationTimeout = null;
let serviceWorkerRegistered = false;
let pushSubscription = null;

export async function initNotifications(state, onUpdate) {
    const toggle = document.getElementById('notificationToggle');
    if (!toggle) return;
    
    // Register Service Worker for PWA support
    await registerServiceWorker();
    
    // Restore state
    toggle.checked = state.notificationsEnabled || false;
    
    // Request permission if enabled
    if (toggle.checked) {
        await requestPermission();
        startNotificationChecker(state, onUpdate);
    }
    
    toggle.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        state.notificationsEnabled = enabled;
        onUpdate(state);
        
        if (enabled) {
            const permission = await requestPermission();
            if (permission === 'granted') {
                startNotificationChecker(state, onUpdate);
                showToast('🔔 Reminders enabled! You\'ll get notified 3 minutes before each dose.');
                // Ask to install as PWA for better mobile support
                promptPWAInstall();
            } else {
                toggle.checked = false;
                state.notificationsEnabled = false;
                onUpdate(state);
                showToast('⚠️ Please allow notifications in your browser settings.');
            }
        } else {
            stopNotificationChecker();
            showToast('🔕 Reminders disabled');
        }
    });
    
    // Check when page becomes visible
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && state.notificationsEnabled) {
            checkScheduledDoses(state, onUpdate);
        }
    });
    
    // Handle messages from service worker
    navigator.serviceWorker?.addEventListener('message', (event) => {
        if (event.data.type === 'HIGHLIGHT_MEDICATION') {
            highlightMedication(event.data.medicationId);
        }
    });
}

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.warn('Service Workers not supported');
        return false;
    }
    
    try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);
        serviceWorkerRegistered = true;
        
        // Check for existing push subscription
        pushSubscription = await registration.pushManager.getSubscription();
        console.log('Push subscription:', pushSubscription ? 'Active' : 'None');
        
        return true;
    } catch (error) {
        console.warn('Service Worker registration failed:', error);
        return false;
    }
}

async function requestPermission() {
    if (!('Notification' in window)) {
        console.warn('Notifications not supported');
        return 'denied';
    }
    
    if (Notification.permission === 'granted') {
        return 'granted';
    }
    
    if (Notification.permission === 'default') {
        try {
            const permission = await Notification.requestPermission();
            console.log('Notification permission:', permission);
            
            if (permission === 'granted' && serviceWorkerRegistered) {
                // Subscribe to push notifications
                await subscribeToPush();
            }
            
            return permission;
        } catch (error) {
            console.warn('Permission request failed:', error);
            return 'denied';
        }
    }
    
    return Notification.permission;
}

async function subscribeToPush() {
    if (!serviceWorkerRegistered || !('PushManager' in window)) {
        return null;
    }
    
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array('BEl62iUYgUj0b8fUwQnV9hZmqE4WXhZ3oVXyA7bK8dL5mN6oP7qR8sT9uV0wX1yZ2aB3cD4eF5gH6iJ7kL8')
        });
        
        pushSubscription = subscription;
        console.log('Push subscription successful:', subscription);
        
        // Store subscription in localStorage
        localStorage.setItem('pushSubscription', JSON.stringify(subscription));
        
        return subscription;
    } catch (error) {
        console.warn('Push subscription failed:', error);
        return null;
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function promptPWAInstall() {
    // Check if already installed
    if (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
        return;
    }
    
    // Check if we've prompted before
    if (localStorage.getItem('pwaPromptShown')) {
        return;
    }
    
    // Show install prompt
    const banner = document.createElement('div');
    banner.className = 'pwa-install-banner';
    banner.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 16px;
        right: 16px;
        background: white;
        border-radius: 16px;
        padding: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        z-index: 999;
        border: 2px solid #0052CC;
        max-width: 400px;
        margin: 0 auto;
    `;
    banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
            <span style="font-size:28px;">📱</span>
            <div>
                <h4 style="font-weight:600; margin:0; font-size:16px;">Install for Better Reminders</h4>
                <p style="margin:4px 0 0; font-size:13px; color:#64748b;">Get notifications even when the app is closed</p>
            </div>
        </div>
        <div style="display:flex; gap:8px;">
            <button onclick="this.closest('.pwa-install-banner').remove(); localStorage.setItem('pwaPromptShown','true')" 
                    style="flex:1; padding:10px; border:1px solid #e2e8f0; border-radius:8px; background:transparent; cursor:pointer;">
                Not Now
            </button>
            <button onclick="installPWA()" 
                    style="flex:1; padding:10px; border:none; border-radius:8px; background:#0052CC; color:white; cursor:pointer; font-weight:600;">
                Install App
            </button>
        </div>
    `;
    document.body.appendChild(banner);
    localStorage.setItem('pwaPromptShown', 'true');
    
    // Auto-hide after 30 seconds
    setTimeout(() => {
        if (banner.parentNode) banner.remove();
    }, 30000);
}

// Install PWA
window.installPWA = async function() {
    if ('beforeinstallprompt' in window) {
        const deferredPrompt = window.deferredPrompt;
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            console.log('Installation result:', result.outcome);
            window.deferredPrompt = null;
        }
    } else {
        // Show instructions for manual install
        alert('To install:\n\n' +
              'Chrome: Tap the menu (⋮) → "Install app"\n' +
              'Safari: Tap Share → "Add to Home Screen"');
    }
    document.querySelector('.pwa-install-banner')?.remove();
};

// Listen for beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    console.log('PWA install prompt available');
});

function startNotificationChecker(state, onUpdate) {
    stopNotificationChecker();
    
    // Check every 30 seconds for mobile
    notificationInterval = setInterval(() => {
        checkScheduledDoses(state, onUpdate);
    }, 30000);
    
    // Also check immediately
    checkScheduledDoses(state, onUpdate);
    scheduleNextCheck(state, onUpdate);
}

function scheduleNextCheck(state, onUpdate) {
    if (notificationTimeout) clearTimeout(notificationTimeout);
    
    // More frequent checks for mobile
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
        
        if (scheduleDate !== today) return;
        
        const scheduleMin = getScheduleMinutes(med.schedule);
        const timeDiff = nowMin - scheduleMin;
        
        const alreadyLogged = state.logs.some(l => 
            l.medicationId === med.id && 
            l.timestamp.startsWith(today)
        );
        
        if (alreadyLogged) return;
        
        // 3 minutes before
        const isThreeMinutesBefore = timeDiff >= -3 && timeDiff < 0;
        const isAtScheduledTime = timeDiff >= 0 && timeDiff <= 1;
        const isOverdue = timeDiff > 1 && timeDiff <= 60;
        
        if (isThreeMinutesBefore && nowSeconds < 5) {
            const reminderTime = new Date(med.schedule);
            const timeStr = reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            sendNotification(
                `⏰ ${med.name} Coming Up`,
                `${med.name} (${med.dosage}) due at ${timeStr}. ${getCompartmentLabel(med.compartment)} dose.`,
                'reminder',
                med.id
            );
        }
        
        if (isAtScheduledTime && nowSeconds < 10) {
            sendNotification(
                `💊 Time for ${med.name}`,
                `Take ${med.name} (${med.dosage}) - ${getCompartmentLabel(med.compartment)} dose.`,
                'due',
                med.id
            );
        }
        
        if (isOverdue && timeDiff % 15 < 1) {
            const overdueMinutes = Math.floor(timeDiff);
            sendNotification(
                `⚠️ ${med.name} Overdue`,
                `${med.name} is ${overdueMinutes} min overdue. ${getCompartmentLabel(med.compartment)} dose.`,
                'overdue',
                med.id
            );
        }
    });
}

function sendNotification(title, body, type = 'reminder', medicationId = null) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }
    
    const key = `${type}_${medicationId || body.substring(0, 20)}`;
    const lastSent = localStorage.getItem('notif_last_' + key);
    const now = Date.now();
    
    if (lastSent) {
        const diff = now - parseInt(lastSent);
        if (diff < 300000) return;
    }
    
    try {
        const notificationOptions = {
            body: body,
            tag: key,
            requireInteraction: true,
            silent: false,
            vibrate: [200, 100, 200],
            timestamp: now,
            data: { 
                type, 
                timestamp: now,
                medicationId: medicationId,
                url: window.location.href
            }
        };
        
        // Try to use service worker for better mobile support
        if (serviceWorkerRegistered && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, notificationOptions);
            });
        } else {
            // Fallback to regular notification
            const notification = new Notification('🔔 AlagaTap', {
                ...notificationOptions,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%230052CC"/><text x="50" y="65" text-anchor="middle" fill="white" font-size="50" font-family="sans-serif">💊</text></svg>'
            });
            
            notification.onclick = function() {
                window.focus();
                this.close();
                if (medicationId) {
                    highlightMedication(medicationId);
                }
            };
            
            setTimeout(() => {
                try { notification.close(); } catch (e) {}
            }, 30000);
        }
        
        localStorage.setItem('notif_last_' + key, now.toString());
        console.log(`🔔 Notification: ${title}`);
        
    } catch (e) {
        console.warn('Failed to send notification:', e);
    }
}

function highlightMedication(medicationId) {
    if (!medicationId) return;
    
    const cards = document.querySelectorAll('.compartment-card');
    cards.forEach(card => {
        if (card.dataset.medId === medicationId) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.borderColor = '#0052CC';
            card.style.borderWidth = '3px';
            card.style.boxShadow = '0 0 20px rgba(0,82,204,0.3)';
            setTimeout(() => {
                card.style.borderColor = '';
                card.style.borderWidth = '';
                card.style.boxShadow = '';
            }, 5000);
        }
    });
}

function getScheduleMinutes(scheduleStr) {
    const d = new Date(scheduleStr);
    return d.getHours() * 60 + d.getMinutes();
}

function getCompartmentLabel(compartment) {
    const labels = { 'A': 'Morning', 'B': 'Noon', 'C': 'Night', 'D': 'Custom' };
    return labels[compartment] || compartment;
}

function showToast(message) {
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
        max-width: 90%;
        text-align: center;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Test function
export function testNotification() {
    if (!('Notification' in window)) {
        console.warn('Notifications not supported');
        return;
    }
    
    if (Notification.permission !== 'granted') {
        Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
                sendTestNotification();
            } else {
                showToast('⚠️ Please allow notifications to test.');
            }
        });
        return;
    }
    
    sendTestNotification();
}

function sendTestNotification() {
    sendNotification(
        '🧪 Test Notification',
        'Your notifications are working! You\'ll get reminders 3 minutes before each dose.',
        'reminder',
        null
    );
    showToast('✅ Test notification sent! Check your notification bar.');
}

window.testAlagaTapNotification = testNotification;