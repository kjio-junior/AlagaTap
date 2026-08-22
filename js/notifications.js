// js/notifications.js - SIMPLE TEST VERSION
console.log('🔥🔥🔥 notifications.js IS LOADING! 🔥🔥🔥');

export class NotificationManager {
    constructor(state, onUpdate) {
        console.log('✅ NotificationManager constructor called!');
        this.state = state;
        this.onUpdate = onUpdate;
        this.emailEnabled = false;
    }
}

export function initNotifications(state, onUpdate) {
    console.log('✅ initNotifications() called!');
    return new NotificationManager(state, onUpdate);
}