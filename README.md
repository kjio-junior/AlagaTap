# AlagaTap

**A QR-Assisted Smart Pill Storage & Physical-to-Digital Dose Logging Platform**

AlagaTap bridges a physical weekly pillbox with a mobile-first web dashboard. Scan a QR code, log doses in one tap, and share a read-only adherence view with caregivers — no app store, no login, no install required.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [File Structure](#file-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Data Model](#data-model)
- [How It Works](#how-it-works)
- [Caregiver Sharing](#caregiver-sharing)
- [Accessibility](#accessibility)
- [Known Limitations](#known-limitations)
- [License](#license)

---

## Features

### Core
- **Mobile-first dashboard** — Optimized for 375–430px viewports, centered on desktop
- **QR-code entry** — Opens instantly in any browser, no install required
- **Zero-login** — State lives in `localStorage`; no account, no server, no backend

### Medication Management
- **21-compartment pillbox model** — 7 days × 3 daily slots (Morning / Noon / Night)
- **Per-day color coding** — Sunday red, Monday pink, Tuesday orange, Wednesday yellow, Thursday green, Friday light blue, Saturday dark blue
- **Custom schedules** — Assign any medication to any combination of days and any slot
- **Inventory tracking** — Automatic decrement on dose logging, low-stock and out-of-stock alerts

### Dose Logging
- **Record Doses picker** — Choose *Taken* or *Missed* for any scheduled dose, including doses from previous days
- **Idempotent logs** — Composite key `(medicationId, date)` prevents duplicates; re-logging overwrites the status
- **Inventory refund** — Changing a log from *Taken* to *Missed* restores the dose to inventory
- **5-minute cooldown** — Accidental double-tap protection on fresh *Taken* logs for today (does not block *Missed* logs or past-date logs)

### Alerts & Reminders
- **Email reminders** — Powered by EmailJS; fires 3 minutes before each scheduled dose and again on overdue
- **Missed-dose banner** — Visual alert for overdue doses
- **Refill warnings** — Triggers when remaining doses fall below threshold

### Caregiver Sharing
- **URL-encoded read-only links** — Full schedule, today's status, recent history, and adherence summary compressed into a single shareable URL
- **QR code export** — Generates a scannable code for quick handoff
- **Zero-server sharing** — Data lives entirely in the URL; nothing is stored remotely

### Interface
- **Light / dark mode** — Persisted preference, high-contrast palette
- **Splash screen** — Animated healthcare-themed loading screen with graceful fade-out
- **Senior-friendly** — Minimum 48px touch targets, large typography, clean SVG iconography

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Markup | Semantic HTML5 |
| Styling | Modern CSS3 + Tailwind CSS (CDN) |
| Logic | Vanilla JavaScript (ES6 modules) |
| Persistence | `localStorage` |
| Email | [EmailJS](https://www.emailjs.com/) (browser SDK) |
| Compression | [LZString](https://github.com/pieroxy/lz-string) (for share links) |
| QR codes | [QRCode.js](https://github.com/davidshimjs/qrcodejs) |
| Hosting | [Vercel](https://vercel.com/) (static site) |

No build step. No bundler. No framework. No database.

---

## File Structure

```
alagatap/
├── index.html              # Single-page shell + all modals
├── css/
│   └── styles.css          # Full stylesheet (design tokens, dark mode, layouts)
├── js/
│   ├── app.js              # Main application controller
│   ├── state.js            # State shape, load/save, migrations
│   ├── utils.js            # Date, format, status, log-index helpers
│   ├── components.js       # Renderers (hero, pillbox, picker, history, etc.)
│   ├── notifications.js    # EmailJS reminder engine
│   └── share.js            # Caregiver share link encode/decode + read-only view
├── manifest.json           # PWA manifest
├── vercel.json             # Security headers + CSP
└── README.md
```

---

## Getting Started

### Local development

Any static file server works. Two common options:

**Python**
```bash
python -m http.server 8000
```

**VS Code Live Server**
Right-click `index.html` → *Open with Live Server*

Then open [http://localhost:8000](http://localhost:8000).

> **Note:** Open the site via a server, not `file://`. ES module imports will fail on the `file://` protocol.

---

## Configuration

### EmailJS (required for email reminders)

1. Create a free account at [emailjs.com](https://www.emailjs.com/)
2. Add an **Email Service** (Gmail, Outlook, etc.) and copy the **Service ID**
3. Create an **Email Template** with these variables:

   ```
   To: {{to_email}}
   From Name: AlagaTap
   Reply To: {{to_email}}
   Subject: AlagaTap: {{title}}
   ```

   Body (HTML or plain text):
   ```
   {{title}}

   Medication: {{medication_name}}
   Dosage: {{dosage}}
   Slot: {{compartment}}
   Scheduled: {{scheduled_time}}
   Current: {{current_time}}

   ---
   This is a Self-Reported Dose Log.
   ```

4. Copy your **Public Key** from Account → API Keys
5. Open `js/notifications.js` and replace the three constants:

   ```javascript
   this.emailjsServiceId  = 'service_XXXXXXX';
   this.emailjsTemplateId = 'template_XXXXXXX';
   this.emailjsPublicKey  = 'XXXXXXXXXXXXXXXX';
   ```

6. Also update the public key in `index.html`:

   ```javascript
   emailjs.init('XXXXXXXXXXXXXXXX');
   ```

### Reminder timing

To change the advance window (default: 3 minutes), edit `js/notifications.js`:

```javascript
this.REMINDER_MINUTES_BEFORE = 3;
```

---

## Deployment

### Vercel (recommended)

1. Push the repository to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Framework Preset: **Other**
4. Leave Build Command, Output Directory, and Install Command empty
5. Deploy

The included `vercel.json` adds security headers (CSP, X-Frame-Options, nosniff) and correct MIME types for `manifest.json` and `sw.js`.

> **Warning:** Do not add `"builds"` or `"routes"` to `vercel.json`. They override Vercel's auto-detection and cause alias drift, stale deploys, and build pipeline conflicts.

### Any static host

GitHub Pages, Netlify, Cloudflare Pages, or S3 will all work. No server runtime required.

---

## Data Model

Everything lives in `localStorage` under the key `alagaTapData`.

```javascript
{
  theme: 'light' | 'dark',
  medications: [
    {
      id: 'med_1700000000000_abc',
      name: 'Amlodipine',
      dosage: '5mg, 1 tablet',
      days: [0, 1, 2, 3, 4, 5, 6],   // 0 = Sunday
      slot: 'morning',                // 'morning' | 'noon' | 'night'
      time: '08:00',                  // 24-hour HH:MM
      inventory: 12,
      maxInventory: 14,
      createdAt: '2025-01-01T00:00:00.000Z'
    }
  ],
  logs: [
    {
      id: 'log_1700000000000_xyz',
      timestamp: '2025-01-15T08:03:22.000Z',  // when logged
      medicationId: 'med_1700000000000_abc',
      slot: 'morning',
      date: '2025-01-15',                     // which day the dose is FOR
      status: 'taken' | 'missed',
      doseType: 'Self-Reported'
    }
  ],
  cooldownUntil: 1700000000000 | null,
  notificationsEnabled: true | false,
  lastResetDate: '2025-01-15',
  scheduleFrequency: 'daily' | 'weekly' | 'monthly'
}
```

The **log identity is the composite key `(medicationId, date)`** — not `timestamp`, not `medicationId` alone. This is what makes the pillbox grid show the correct day when logging catch-up doses.

A `Set` index (`medId|date` → `status`) is rebuilt on each render for O(1) lookups.

---

## How It Works

### Logging flow

1. User taps **Record Doses** on the hero card, or taps any pillbox cell → **Log**
2. `renderDosePickerList(state, elements, targetDate, filterSlot)` renders the relevant doses
3. Each row offers **Taken** and **Missed** buttons
4. `logDose(medId, date, status)`:
   - Removes any existing log for that `(medId, date)` pair
   - Pushes a fresh log with the new status
   - Adjusts inventory (+1 on *taken → missed*, −1 on *unlogged → taken*)
   - Starts the 5-minute cooldown only for today's fresh *Taken*

### Reminder engine

A 20-second `setInterval` plus a `visibilitychange` listener checks scheduled doses. Reminders use `localStorage` dedup keys (`alagatap_reminder_<medId>_<date>_<type>`) so each reminder fires exactly once per dose per day — even if the tab is throttled or reopened. Types:

- `pre` — 3 minutes before schedule
- `ontime` — 0–4 minutes after
- `overdue_1`, `overdue_2`… — every 30 minutes overdue

### Share link

`ShareManager.generateShareLink()` serializes medications and logs into a compact object, compresses it with LZString, and appends it to the URL as `?share=<compressed>`. The receiving side detects the parameter on load and calls `renderReadOnlyView()`, which rebuilds a stripped-down dashboard with no interactive controls.

---

## Caregiver Sharing

**What the caregiver sees:**

| Section | Content |
|---------|---------|
| **Banner** | Read-only indicator with share date |
| **Today's Status** | Three tiles — Taken / Missed / Pending counts |
| **Medication Schedule** | Grouped by Morning / Noon / Night, with dosage, time, and day pattern |
| **Recent History** | Last 20 logs with Taken/Missed badges and `for [date]` labels |
| **Adherence Summary** | Scheduled / reported / rate + self-reported disclaimer |

**What the caregiver cannot do:** edit medications, log doses, change settings, or access the sharer's email.

The link carries all data in the URL itself, so **no server stores anything**. Whoever holds the link sees the snapshot as of the moment it was generated.

---

## Accessibility

AlagaTap is designed for senior citizens and low-vision users:

- **Minimum 48px tap targets** on every interactive element
- **High-contrast palette** in both light and dark mode
- **Large typography** — base sizes start at 15px, headings at 20px+
- **SVG iconography** — no ambiguous emojis; every icon has an accessible label
- **Reduced-motion support** — splash animations respect `prefers-reduced-motion`
- **Screen reader labels** — every button has an `aria-label` or visible text

---

## Known Limitations

### Reminders require an open tab

Email reminders fire from a client-side timer. If the browser tab is fully closed when the reminder window passes, no email is sent. This is a hard browser limitation without a server or push subscription.

**Workarounds:**
- Keep the tab open in the background on a phone or tablet
- Add a server-side cron (Vercel Cron, Firebase Functions) that hits the EmailJS API on schedule
- Integrate a push subscription service (OneSignal, Web Push) for closed-app delivery

### `localStorage` is origin-bound

Data does not sync across devices and is cleared when the user clears browser data. Use **Export** in the app footer to back up to a JSON file; **Import** to restore.

### EmailJS rate limits

The free tier allows 200 emails/month. For a single user with 3 daily doses, that's roughly 60 days of runway. Upgrade or migrate to a transactional provider (Resend, Postmark, SendGrid) if you scale.

---

## Disclaimer

All dose entries in AlagaTap are **Self-Reported Dose Logs**. They record what the user or their caregiver *reported* taking. They do **not** verify biological ingestion. AlagaTap is a logging aid, not a medical device, and is not a substitute for professional medical advice, diagnosis, or treatment.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Acknowledgments

Built as a QR-assisted medication adherence tool for senior citizens and their caregivers. Uses [EmailJS](https://www.emailjs.com/), [LZString](https://github.com/pieroxy/lz-string), [QRCode.js](https://github.com/davidshimjs/qrcodejs), and [Inter](https://rsms.me/inter/). Icons styled after [Heroicons](https://heroicons.com/).