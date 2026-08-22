# AlagaTap - Smart Pill Storage & Dose Logging Platform

A QR-Assisted Smart Pill Storage and Physical-to-Digital Dose Logging Platform designed for senior citizens and caregivers.

## Features

- **Mobile-First Design** - Optimized for smartphones (375-430px)
- **Dark/Light Mode** - High contrast for accessibility
- **Medication Management** - Add, edit, delete medications with schedules
- **Dose Logging** - One-tap logging with 5-minute cooldown
- **Adherence Tracking** - Self-reported dose logs with history
- **Browser Notifications** - Reminders for scheduled doses
- **Caregiver Sharing** - Read-only shareable links with QR codes
- **Data Persistence** - LocalStorage with export/import backup
- **Privacy-First** - All data stays on your device


## Sharing with Caregivers

- Click the Caregiver icon to generate a shareable link
- The link contains compressed data in the URL
- Share via WhatsApp, email, or QR code
- Recipients see a read-only view of your medication schedule

## Data Storage

- All data is stored in your browser's LocalStorage
- Export/Import JSON backup functionality
- No external databases or servers required

## Technologies Used

- HTML5
- CSS3 with Tailwind CSS
- Vanilla JavaScript ES6+
- LZString for URL compression
- QRCode.js for QR generation
