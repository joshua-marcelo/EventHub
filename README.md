# EventHub: A QR-Based Event Management and Attendance System with Automated Digital Certificate Generation for the College Local Council of Wesleyan University–Philippines

## Project Overview

**EventHub** is a web-based event management and attendance system developed for the College Local Council (CLC) of Wesleyan University–Philippines.

The system aims to streamline event organization, student registration, attendance monitoring, and digital certificate generation through a centralized platform.

EventHub provides dedicated functionalities for administrators, event organizers, and student participants, making university events easier to organize, manage, and attend.

## Problem Statement

Traditional event management processes often rely on manual registration, paper-based attendance sheets, and manually prepared certificates.

These methods can lead to several challenges:

- Time-consuming event registration and attendance recording.
- Inaccurate attendance records and duplicate entries.
- Difficulty monitoring participants during events.
- Delays in preparing and distributing certificates.
- Scattered event announcements and registration information.
- Additional administrative workload for student organizers.

These challenges highlight the need for a centralized digital solution that improves the efficiency and organization of university events.

## Proposed Solution

**EventHub** addresses these challenges by providing an integrated platform for managing university events from registration to certificate distribution.

The system enables authorized organizers to create and publish events, manage participant registrations, and share event details through direct links and QR codes.

During events, participants can scan a rotating attendance QR code using their mobile devices. The system validates their registration, records attendance, and displays check-in updates in real time.

After the event, eligible participants can receive automatically generated digital certificates, reducing manual work for organizers.

## System Features

### 1. Administrator Module

- Approve or reject organizer applications.
- Manage organizer access and permissions.
- Manage college, program, and event category information.
- Search user accounts and view a read-only account summary.
- Suspend, reinstate, or revoke organizers and cancel published events, with a required reason.

### 2. Event Organizer Module

- Create, edit, and publish events.
- Manage event details, schedules, venues, and participant limits.
- Generate shareable event registration QR codes.
- Share event links through supported platforms.
- View and manage participant registrations.
- Start and manage QR-based attendance sessions.
- Monitor participant check-ins in real time.
- Review attendance records.
- Generate automated digital certificates.
- Access event reports and export records.

### 3. Student Participant Module

- Create an account with email verification.
- Complete and manage student profile information.
- Browse and search available university events.
- View event details and register online.
- Access registered and attended events.
- Scan QR codes for attendance check-in.
- View attendance status.
- Download eligible digital certificates.
- Verify issued certificates.

## How the System Works

**Step 1 — Event Creation**

An approved organizer creates an event by entering the required information, including the event title, description, date, time, venue, and registration details.

**Step 2 — Event Publishing and Sharing**

The organizer publishes the event, making it available through the EventHub event feed. A shareable registration QR code and direct event link allow students to access its details conveniently.

**Step 3 — Participant Registration**

Students create an account, complete their profile, browse available events, and register for their chosen activities.

**Step 4 — QR-Based Attendance**

During an event, the organizer displays a rotating attendance QR code on a laptop or designated screen.

Registered participants scan the QR code using their mobile devices. The system validates the check-in and records attendance while updating the organizer's live attendance display.

**Step 5 — Digital Certificate Generation**

After the event, the system determines participant eligibility based on verified attendance and applicable event requirements.

Authorized organizers can generate digital certificates for eligible participants.

**Step 6 — Certificate Download and Verification**

Participants can download their certificates, which include verification information to help establish certificate authenticity.

## Project Objectives

1. Develop a centralized event management system for the College Local Council of Wesleyan University–Philippines.
2. Simplify event creation, publishing, and participant registration.
3. Implement QR-based attendance tracking to improve attendance recording.
4. Provide real-time attendance monitoring for event organizers.
5. Automate the generation and distribution of digital certificates.
6. Reduce manual administrative tasks and improve overall event management efficiency.

## Technology Stack

| Technology | Purpose |
|---|---|
| Next.js | Full-stack web application framework |
| React | User interface development |
| TypeScript | Type-safe application development |
| Tailwind CSS | Responsive interface styling |
| shadcn/ui | Reusable UI components |
| Supabase | Backend services |
| PostgreSQL | Relational database |
| Supabase Auth | Authentication and user access |
| Supabase Storage | File and image storage |
| Vercel | Web application deployment |
| GitHub | Source code management and version control |

## Expected Benefits

**For the College Local Council:** A centralized platform that simplifies event organization, attendance management, and certificate distribution.

**For Event Organizers:** Reduced paperwork, easier event promotion, convenient registration monitoring, and automated attendance and certificate processes.

**For Student Participants:** Easier access to university events, convenient registration, faster attendance check-in, and accessible digital certificates.

## Project Status

The EventHub core MVP is implemented and verified against the development environment: authentication and onboarding, role-based dashboards, organizer applications, event management, registration QR sharing, rotating QR attendance with live monitoring, digital certificates with public verification and revocation, and event reports with CSV export.

The automated checks pass on a production build: 108 unit tests, 269 database/RLS assertions, and 230 live integration and browser checks. See [docs/FINAL_QA.md](docs/FINAL_QA.md) for what is tested, what still needs manual configuration (Supabase email templates, SMTP, production project), and what requires physical phones or production.

## Getting Started (development)

Requirements: Node.js 22 and access to the **development** Supabase project.

```bash
npm install
cp .env.example .env.local   # fill in the development URL and publishable key
npm run dev                  # http://localhost:3000
```

The app needs only the public Supabase URL, the publishable key, and `NEXT_PUBLIC_APP_URL`. It never uses a service-role key.

## Testing

```bash
npm run typecheck
npm run lint
npm test          # unit tests
npm run build
```

Database (pgTAP) suites live in `supabase/tests/database/`, and live integration and browser scripts live in `scripts/`. Each script refuses to run outside the development project and a local server. See [docs/FINAL_QA.md](docs/FINAL_QA.md#rerunning-the-live-checks) for the fixture and cleanup procedure.

## Deployment

Production uses a separate Supabase project and Vercel. Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for migrations, Auth URL settings, email templates and SMTP, Vercel environment variables, the domain, administrator provisioning, and production smoke tests.

## Documentation

- [docs/SYSTEM_SPEC.md](docs/SYSTEM_SPEC.md): system specification
- [docs/PLAN.md](docs/PLAN.md): implementation plan
- [docs/DECISIONS.md](docs/DECISIONS.md): decision log
- [docs/FINAL_QA.md](docs/FINAL_QA.md): final QA checklist and verification results
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): production deployment guide
- [supabase/templates/README.md](supabase/templates/README.md): authentication email templates

---

**EventHub — Simplifying University Event Management Through QR Technology and Digital Automation.**