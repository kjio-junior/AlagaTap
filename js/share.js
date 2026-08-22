// js/share.js - URL-based sharing with compression for GitHub Pages
// Uses LZString for compression (loaded from CDN)

export class ShareManager {
    constructor(state, elements) {
        this.state = state;
        this.elements = elements;
        this.shareCode = null;
    }

    // Generate a shareable URL with compressed data
    generateShareLink() {
        // Only share essential data (reduce URL size)
        const shareData = {
            m: this.state.medications.map(m => ({
                n: m.name,
                d: m.dosage,
                c: m.compartment,
                s: m.schedule,
                inv: m.inventory
            })),
            l: this.state.logs.slice(-50).map(l => ({
                t: l.timestamp,
                c: l.compartment,
                m: l.medicationId,
                dt: l.doseType || 'Self-Reported'
            })),
            v: '2.0',
            gen: new Date().toISOString()
        };

        try {
            // Compress with LZString (available via CDN)
            const jsonString = JSON.stringify(shareData);
            const compressed = window.LZString.compressToEncodedURIComponent(jsonString);
            
            // Build the shareable URL
            const baseUrl = window.location.origin + window.location.pathname;
            const shareUrl = `${baseUrl}?share=${compressed}`;
            
            // Generate a short code for display
            this.shareCode = 'share_' + Math.random().toString(36).substring(2, 10);
            
            // Store in localStorage for history
            this.saveShareHistory(shareUrl, this.shareCode);
            
            return shareUrl;
        } catch (error) {
            console.error('Failed to generate share link:', error);
            // Fallback: use simple base64 encoding
            return this.generateSimpleShareLink();
        }
    }

    // Fallback: Simple base64 encoding (less efficient but works)
    generateSimpleShareLink() {
        try {
            const data = {
                m: this.state.medications.map(m => ({
                    n: m.name,
                    d: m.dosage,
                    c: m.compartment,
                    s: m.schedule
                })),
                l: this.state.logs.slice(-20).map(l => ({
                    t: l.timestamp,
                    c: l.compartment
                }))
            };
            
            const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
            const baseUrl = window.location.origin + window.location.pathname;
            return `${baseUrl}?sharedata=${encoded}`;
        } catch (error) {
            console.error('Failed to generate simple share link:', error);
            return null;
        }
    }

    // Load shared data from URL
    loadSharedData() {
        const params = new URLSearchParams(window.location.search);
        
        // Check for compressed share
        const compressed = params.get('share');
        if (compressed) {
            try {
                const decompressed = window.LZString.decompressFromEncodedURIComponent(compressed);
                if (decompressed) {
                    const data = JSON.parse(decompressed);
                    return { data, type: 'compressed' };
                }
            } catch (e) {
                console.warn('Failed to decompress share data');
            }
        }
        
        // Check for simple base64 share
        const simple = params.get('sharedata');
        if (simple) {
            try {
                const decoded = JSON.parse(decodeURIComponent(escape(atob(simple))));
                return { data: decoded, type: 'simple' };
            } catch (e) {
                console.warn('Failed to decode simple share data');
            }
        }
        
        return null;
    }

    // Render read-only view of shared data
    renderReadOnlyView(sharedData) {
        const container = document.getElementById('app');
        
        // Add read-only banner
        const banner = document.createElement('div');
        banner.className = 'readonly-banner';
        banner.innerHTML = `
            <div class="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 flex items-center gap-3">
                <svg class="icon text-blue-600 dark:text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                <div>
                    <span class="font-semibold">Read-Only View</span>
                    <span class="text-sm text-gray-600 dark:text-gray-400">· Shared by Caregiver</span>
                    ${sharedData.gen ? `<span class="text-xs text-gray-500 dark:text-gray-500 ml-2">Generated: ${new Date(sharedData.gen).toLocaleDateString()}</span>` : ''}
                </div>
                <button onclick="window.history.back()" class="ml-auto text-sm bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 px-3 py-1 rounded-full">
                    ← Back
                </button>
            </div>
        `;
        container.prepend(banner);

        // Render medications (read-only)
        const medList = document.getElementById('compartmentList');
        if (medList && sharedData.m) {
            medList.innerHTML = sharedData.m.map(m => `
                <div class="compartment-card opacity-80 cursor-default">
                    <div class="compartment-info">
                        <div>
                            <span class="compartment-tag">${m.c}</span>
                            <span class="compartment-name">${m.n}</span>
                        </div>
                        <div class="compartment-detail">${m.d} · Target: ${this.formatTime(m.s)}</div>
                        ${m.inv !== undefined ? `<div class="compartment-inventory">${m.inv} doses remaining</div>` : ''}
                    </div>
                    <span class="text-sm text-gray-400 dark:text-gray-600">🔒</span>
                </div>
            `).join('');
        } else if (medList) {
            medList.innerHTML = '<div class="text-center text-gray-500 py-4">No medications in shared data</div>';
        }

        // Render logs (read-only)
        const historyList = document.getElementById('historyList');
        if (historyList && sharedData.l && sharedData.l.length > 0) {
            historyList.innerHTML = sharedData.l.map(l => `
                <div class="history-item">
                    <span>
                        <span class="font-medium">${l.c}</span>
                        ${l.dt || 'Self-Reported'}
                    </span>
                    <span class="date">${this.formatDateTime(l.t)}</span>
                </div>
            `).join('');
        } else if (historyList) {
            historyList.innerHTML = '<div class="text-center text-gray-500 py-4">No logs in shared data</div>';
        }

        // Disable all interactive elements
        document.querySelectorAll('button:not(.modal-close):not([onclick])').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        });

        // Update hero status for read-only
        const statusText = document.getElementById('statusText');
        const statusDot = document.getElementById('statusDot');
        const heroTimestamp = document.getElementById('heroTimestamp');
        if (statusText) {
            statusText.textContent = '📋 Viewing Shared Data';
            statusDot.className = 'status-dot logged';
        }
        if (heroTimestamp) {
            heroTimestamp.textContent = `Shared on ${this.formatDateTime(sharedData.gen || new Date().toISOString())}`;
        }

        // Hide record button
        const recordBtn = document.getElementById('recordDoseBtn');
        if (recordBtn) {
            recordBtn.disabled = true;
            recordBtn.style.opacity = '0.5';
            recordBtn.style.cursor = 'not-allowed';
        }

        // Show message
        this.showToast('📋 Viewing shared medication schedule');
    }

    // Save share history
    saveShareHistory(url, code) {
        const history = JSON.parse(localStorage.getItem('alagaTapShareHistory') || '[]');
        history.unshift({
            code,
            url,
            date: new Date().toISOString(),
            medications: this.state.medications.length
        });
        // Keep only last 10
        if (history.length > 10) history.pop();
        localStorage.setItem('alagaTapShareHistory', JSON.stringify(history));
    }

    // Get share history
    getShareHistory() {
        return JSON.parse(localStorage.getItem('alagaTapShareHistory') || '[]');
    }

    // Format helpers
    formatTime(isoString) {
        if (!isoString) return '--';
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    formatDateTime(isoString) {
        if (!isoString) return '--';
        const d = new Date(isoString);
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + this.formatTime(isoString);
    }

    showToast(message) {
        // Remove existing toast
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
        }, 3000);
    }
}