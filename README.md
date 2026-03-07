# Meetup Manager

A full-stack app for organizing community meetups. Manage events, speakers, volunteers, venue partners, and SOP checklists with role-based access control, audit logging, and Discord integration.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router + Turbopack) |
| Language | TypeScript |
| Database | PostgreSQL + Prisma 7 (driver adapter with raw `pg` pool) |
| Auth | NextAuth.js v5 (Google OAuth, JWT sessions) + custom mobile token auth |
| Styling | Tailwind CSS 4 + custom design system |
| Animations | Motion (Framer Motion successor) |
| Icons | Lucide React |
| Testing | Playwright (E2E) |
| Deployment | Vercel (with Cron Jobs) |
| Notifications | Discord Bot API + Email (SMTP/Gmail) |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your:
# - DATABASE_URL (PostgreSQL connection string)
# - AUTH_SECRET (run: openssl rand -base64 32)
# - AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET (from Google Cloud Console)
# - SUPER_ADMIN_EMAIL (your email for initial super admin)
# - DISCORD_BOT_TOKEN (optional, for Discord notifications)
# - CRON_SECRET (optional, for scheduled reminders)
# - SMTP_HOST (smtp.gmail.com for Gmail)
# - SMTP_PORT (587 for Gmail TLS)
# - SMTP_USER (your Gmail address)
# - SMTP_PASS (Gmail App Password — see Email section below)
# - SMTP_FROM ("Your App Name <your-email@gmail.com>")

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed default SOP template
npx tsx prisma/seed.ts

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Google Sign-In (OAuth) Setup

This app uses NextAuth v5 with Google as the web sign-in provider.

1. Open **Google Cloud Console** → **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Add **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-domain.com/api/auth/callback/google` (production)
5. Copy credentials into `.env`:
   - `AUTH_GOOGLE_ID`
   - `AUTH_GOOGLE_SECRET`
6. Ensure these are also set:
   - `AUTH_SECRET`
   - `SUPER_ADMIN_EMAIL`

---

## Features

### Dashboard

- **Bento grid layout** with responsive 3-4 column grid
- **Next Event hero card** — title, date, venue, status badge, SOP progress bar (tasks completed / total), direct link to detail
- **Stat cards** — total events (with today / upcoming / past breakdown), speakers count, volunteers count
- **My Tasks panel** — top 10 incomplete tasks assigned to the current user with inline checkbox to toggle status, priority badge, deadline, and link to parent event
- **Overdue Tasks panel** — up to 10 overdue tasks with owner avatars and red-highlighted deadlines
- **Recent Activity feed** — last 10 audit log entries with relative timestamps
- **Role-aware rendering** — volunteers see only their scoped data; "New Event" button only visible for Event Lead+

### Event Management

- **Full lifecycle** — create, edit, and delete events with status progression: `DRAFT → SCHEDULED → LIVE → COMPLETED`
- **Card grid listing** with smart date badges ("Today" with pulse-glow, "Upcoming", "Ended"), speaker / volunteer / checklist counts, and member avatar stacks
- **Filter tabs** — Upcoming / Past / All with live counts
- **5-tab detail view**:
  - **Overview** — bento grid with About section, SOP progress bar (percentage + task count), stat cards for speakers / volunteers / venue partners, and event lead info
  - **Speakers** — linked speakers with status badges; add/remove via searchable picker modal
  - **Volunteers** — linked volunteers with status + role; dual-tab picker (From Members / From Directory); convert-to-member button for admins
  - **Venue Partners** — expandable cards with contact info, capacity, cost, confirmation date, and notes; status dropdown (INQUIRY / PENDING / CONFIRMED / DECLINED / CANCELLED); venue confirmation conflict modal; auto-syncs `event.venue` field and SOP tasks when a venue partner is confirmed
  - **SOP Checklist** — grouped tasks (Pre-Event / On-Day / Post-Event) with color-coded section headers, per-section progress bars, collapse/expand all, inline editing (priority, deadline, assignee), self-assign mode for volunteers, overdue highlighting, and venue-confirmation guard on venue tasks
- **SOP template integration** — select a template at creation to auto-generate checklists with tasks, priorities, and deadlines calculated relative to the event date
- **Volunteer scoping** — `VOLUNTEER` role users only see events they're assigned to (via volunteer profile or event membership)
- **Cascade deletion** — removing an event cascades to all linked speakers, volunteers, venues, and checklists

### Speaker Directory

- **Bento grid cards** with avatar (Google photo or gradient initials), name, email, phone, topic, and action buttons
- **Event contributions widget** — linked events with color-coded status badges per event
- **Status count aggregation** — API returns confirmed / invited / declined counts per speaker
- **CRUD via modal forms** with inline validation
- **Volunteer-scoped visibility** — volunteers only see speakers from their assigned events

### Volunteer Management

- **Data table** with columns: Name, Email, Discord, Role, Events, Actions
- **Event contributions widget** with status badges
- **Promote-to-Member flow** — configurable threshold (from App Settings), validates email, creates or reactivates user with `EVENT_LEAD` role, removes volunteer record after promotion; visible only for admins when the volunteer meets the threshold
- **Member-volunteer conflict guard** — prevents adding a volunteer whose email belongs to an existing member (409 response, directs to existing member)
- **Dual-source event linking** — volunteers can be linked from the directory or from the member list (auto-creates a Volunteer record for members)
- **User-volunteer link** — volunteers linked to user accounts can sign in and self-assign tasks
- **Task assignment** — event-level volunteers can be assigned to SOP checklist tasks; `VOLUNTEER` role users can self-assign ("Take" button) on unassigned tasks

### Venue Partner Management

- **Bento grid cards** showing venue details (address, capacity, contact, email, phone)
- **Full CRUD** with modal forms, delete confirmation, and event count / status breakdown per venue
- **Event linking** with status workflow: `INQUIRY → PENDING → CONFIRMED / DECLINED / CANCELLED`
- **Cost tracking** (Decimal), confirmation dates, and notes per event link
- **Volunteer-scoped visibility** — volunteers only see venues linked to their events

### SOP Templates & Checklists

- **Template management** — create, edit, duplicate ("Copy" suffix), and delete reusable templates
- **Three-section task editor** — Pre-Event, On-Day, Post-Event tasks with title, relative days (before/after event), and priority (LOW / MEDIUM / HIGH / CRITICAL)
- **Expandable preview** — view all tasks grouped by section with priority badges and relative day labels
- **Checklist generation** — apply a template to an event to bulk-create tasks with auto-calculated deadlines
- **Task features** — status (TODO / IN_PROGRESS / BLOCKED / DONE), priority, deadline, owner, assignee, volunteer assignee, blocked reason, sort order
- **Volunteer-restricted editing** — volunteers can only toggle status (TODO ↔ DONE) and self-assign/unassign; full editing for Event Lead+
- **Auto-completion tracking** — sets `completedAt` when status → DONE, clears it when un-done

### Members & Role Management

- **Member list** with avatar, name, email, role, event contributions, joined date
- **Inline role dropdown** — change roles with optimistic UI and rollback on failure
- **Add Member modal** — invite by email with optional name and role (scoped by caller: Super Admin can assign Admin; Admin can only assign Member)
- **Remove Member flow** — confirmation dialog showing ownership count (events, speakers, volunteers, venue partners, tasks); if the member owns entities, forces selection of an admin to reassign all ownership to; soft-deletes the user
- **Soft-delete reactivation** — re-adding a previously removed member restores their account
- **Volunteer collision detection** — adding an email belonging to a volunteer directs to the "Promote to Member" flow

### Features & Permissions

- **Permissions & Access** — read-only reference page showing global roles, permission matrix, event roles, and key rules
- **Email Workflows** — visual reference for all 11 automated email notifications with trigger conditions, recipients, and subject lines; accessible to all authenticated users at `/settings/permissions/email-workflows`
- **Public Code of Conduct** — policy page at `/docs/code-of-conduct` with publicly visible content and Super Admin-managed updates from Settings

### Audit Trail

- **Activity feed** with user avatar, action badge (CREATE / UPDATE / DELETE with color-coding), entity type label, entity name, and timestamp
- **Change diff display** — field-level before → after changes with strikethrough and highlight styling
- **Entity type filter** — filter by Event, Speaker, Volunteer, Task, Template, Event Speaker, Event Volunteer, Member
- **Paginated API** (50 per page) with entity name backfill for legacy logs
- **Tracked entities** — Event, Speaker, Volunteer, SOPTask, SOPTemplate, EventSpeaker, EventVolunteer, User, AppSetting, VenuePartner
- **Fire-and-forget logging** with `diffChanges()` utility for field-level diff computation

### Discord Integration

- **Bot notifications** (raw fetch, no SDK dependency):
  - Task assigned notification (blue embed)
  - Deadline approaching warning — tasks due within 3 days (yellow embed, batches up to 10)
  - Overdue task alerts (red embed, batches up to 10)
  - New event created notification (green embed)
- **Admin configuration** — set bot token, guild ID, channel ID, and enable/disable reminders
- **Test endpoint** — send a test message to verify bot connectivity
- **Scheduled reminders** — Vercel Cron job runs daily at 09:00 UTC, finds approaching and overdue tasks, sends Discord notifications if reminders are enabled
- **Graceful degradation** — all notification functions silently skip if no bot token is configured

### Email Notifications (SMTP / Gmail)

11 automated email workflows powered by **Nodemailer** + **React Email** (JSX-based templates with branded layout).

> **📧 Full documentation:** [docs/email-flows.md](docs/email-flows.md)

| # | Workflow | Trigger | Recipients |
|---|---------|---------|------------|
| 1 | **Member Invitation** | Admin invites a new member | Invited email |
| 2 | **Volunteer Welcome** | Volunteer added with email | Volunteer's email |
| 3 | **Volunteer Promotion** | Volunteer promoted to Member | Volunteer's email |
| 4 | **Event Created** | Event created or status → SCHEDULED | All Members, Admins, Super Admins + event members |
| 5 | **Event Reminder** | 2 days before event (cron) | Event team + confirmed speakers |
| 6 | **Task Assigned** | Task assigned / reassigned | Assigned user |
| 7 | **Task Due Soon** | Task deadline within 3 days (cron) | Assigned user |
| 8 | **Task Overdue** | Task past deadline (cron) | Assigned user (CC: Event Lead if 3+ days overdue) |
| 9 | **Speaker Invitation** | Speaker added to event | Speaker's email |
| 10 | **Venue Confirmed** | Venue status → CONFIRMED | Event Lead |
| 11 | **Weekly Digest** | Every Monday 09:00 UTC (cron) | All active members |

**Key features:**
- **Gmail App Password** — uses SMTP with Gmail's app-specific passwords (no OAuth complexity)
- **Branded HTML templates** — JSX-based email templates with amber/gold accent, responsive design, inline CSS (via `@react-email/components`)
- **Custom branding** — emails automatically use the configured group name as the sender and embed the uploaded logo in the header via CID attachment (works in all email clients without external image hosting)
- **Template preview** — test endpoint supports all 12 templates with realistic sample data; settings UI includes a template selector dropdown for previewing any email
- **ICS calendar attachments** — event reminder emails include a downloadable `.ics` file
- **EmailLog tracking** — every email sent is logged to the database with status (`PENDING` → `SENT` / `FAILED`), recipient, subject, and template name
- **Fire-and-forget** — email sends never block API responses; failures are logged but don't affect the user-facing operation
- **Graceful degradation** — all email functions silently skip if SMTP is not configured
- **Test endpoint** — `POST /api/email/test` sends a test email to verify SMTP connectivity; supports a `template` body param to preview any of the 12 templates (Admin+)
- **Email log API** — `GET /api/email/log` returns paginated email logs with filtering by template and status (Admin+)
- **Cron jobs** — daily event reminders, daily task deadline/overdue checks, weekly digest

#### Gmail SMTP Setup

1. **Enable 2-Step Verification** on your Google Account: [myaccount.google.com/security](https://myaccount.google.com/security)
2. **Generate an App Password**: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Select app: "Mail"
   - Select device: "Other" → name it "Meetup Manager"
   - Copy the 16-character password
3. **Add to `.env`**:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=xxxx-xxxx-xxxx-xxxx
   SMTP_FROM="Meetup Manager <your-email@gmail.com>"
   ```
4. **Verify**: Sign in as Super Admin → call `POST /api/email/test` to send a test email

#### Environment Variables (Email)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | Yes | — | SMTP server hostname (`smtp.gmail.com`) |
| `SMTP_PORT` | No | `587` | SMTP port (587 for TLS, 465 for SSL) |
| `SMTP_USER` | Yes | — | SMTP username (Gmail address) |
| `SMTP_PASS` | Yes | — | SMTP password (Gmail App Password) |
| `SMTP_FROM` | No | `SMTP_USER` | Sender display name and email (`"App Name <email>"`) |

### Authentication & Authorization

- **Google OAuth** (web) via NextAuth v5 with JWT-based sessions
- **Mobile token auth** — `POST /api/auth/token` issues access token (JWT, 7 day) + refresh token (opaque, 30 day); `POST /api/auth/refresh` rotates tokens
- **Dual auth support** — API routes accept both cookie sessions (web) and Bearer tokens (mobile) via unified `getAuthSession()` helper
- **Sign-in gates** — only the Super Admin email, existing non-deleted users, and emails matching volunteer records can sign in; volunteer emails auto-provision a `VOLUNTEER` account
- **Soft-delete enforcement** — deleted users are blocked from sign-in and JWT issuance
- **Middleware protection** — all routes except `/`, `/unauthorized`, `/api`, and static assets require authentication

### App Settings

- **Volunteer promotion threshold** — Super Admin-only setting to configure the minimum event contributions before a volunteer can be promoted to member
- **Group logo upload** — upload light and dark logo variants (PNG, JPEG, SVG, WebP, max 200KB); the light logo is automatically embedded in all email headers via CID attachment
- **Public Code of Conduct editor** — Super Admin-only save control for HTML policy content displayed on the public Code of Conduct page
- **Key-value store** — extensible `AppSetting` model for future settings
- **Logo serving endpoint** — `GET /api/settings/logo?variant=light|dark` serves stored logos as real images with caching headers (public, no auth required)
- **Audit-logged** — all setting changes are tracked

---

## Roles & Permissions

### Global Roles (hierarchy 0 → 4)

| Role | Display Name | Level | Capabilities |
|------|-------------|-------|-------------|
| `VIEWER` | Temporary Viewer | 0 | Read-only access to assigned events |
| `VOLUNTEER` | Volunteer | 1 | Read assigned events, self-assign tasks, toggle own task status |
| `EVENT_LEAD` | Member | 2 | Create and manage events, read all events, manage speakers / volunteers / venues |
| `ADMIN` | Admin | 3 | Full access to all events, manage members (except other admins), audit log |
| `SUPER_ADMIN` | Super Admin | 4 | Everything + manage admins, app settings, public Code of Conduct publishing, member removal with ownership reassignment |

### Event Roles (per-event, hierarchy 0 → 3)

| Role | Level | Capabilities |
|------|-------|-------------|
| `VIEWER` | 0 | Read event data |
| `VOLUNTEER` | 1 | Read event data |
| `ORGANIZER` | 2 | Create / update within event |
| `LEAD` | 3 | Full event control including delete |

---

## Design System

12 reusable components built with Tailwind CSS + CVA patterns:

| Component | Description |
|-----------|-------------|
| **BentoGrid / BentoCard** | Responsive grid (1→4 columns) with configurable span, hover glow effects |
| **Button** | 4 variants (primary, secondary, ghost, danger) × 4 sizes (sm, md, lg, icon) |
| **EmptyState** | Centered placeholder with icon, title, description, and optional action |
| **EventContributions** | Expandable event list with status badges per linked entity |
| **Modal** | Portal-based dialog with backdrop blur, Escape close, scroll lock |
| **OwnerAvatar / AvatarStack** | Avatar with Google photo or gradient initials fallback; overlapping stack with "+N" overflow |
| **PageHeader** | Title bar with description and right-aligned action slot |
| **PriorityBadge** | Color-coded pill for LOW / MEDIUM / HIGH / CRITICAL (critical has pulse animation) |
| **Skeleton / CardSkeleton / TableRowSkeleton** | Shimmer loading placeholders for cards and tables |
| **StatCard** | Dashboard metric card with icon, value, trend indicator, and hover lift |
| **StatusBadge** | Universal status pill supporting task, speaker, volunteer, event, and venue statuses |

### Layout

| Component | Description |
|-----------|-------------|
| **AppShell** | Root wrapper with sidebar + top bar + main content (max 1400px) |
| **Sidebar** | Fixed left nav with role-based menu items, collapsible |
| **TopBar** | Header with `⌘K` search trigger, dark/light theme toggle, user menu |
| **CommandPalette** | `⌘K` palette with role-filtered commands, arrow key navigation |

---

## Database Models

```
User ──< EventMember >── Event
  │                        │
  │  ┌─ EventSpeaker >─────┤
  │  │                      │
  └──┤  EventVolunteer >────┤
     │                      │
     ├─ EventVenuePartner >─┤
     │                      │
     └─ SOPChecklist >──────┘
            │
            └──< SOPTask

Speaker ──< EventSpeaker
Volunteer ──< EventVolunteer
VenuePartner ──< EventVenuePartner

SOPTemplate (standalone, JSON defaultTasks)
AuditLog (standalone, tracks all changes)
AppSetting (key-value config store)
DiscordConfig (bot settings)
EmailLog (tracks all sent emails)
RefreshToken ──< User
```

---

## Project Structure

```
src/
├── app/
│   ├── api/              # REST API routes
│   │   ├── auth/         # Token auth + refresh endpoints
│   │   ├── events/       # Event CRUD + member management
│   │   ├── speakers/     # Speaker CRUD
│   │   ├── volunteers/   # Volunteer CRUD + convert-to-member
│   │   ├── venues/       # Venue partner CRUD
│   │   ├── checklists/   # Checklist + task CRUD
│   │   ├── templates/    # SOP template CRUD
│   │   ├── members/      # Member management + role changes
│   │   ├── dashboard/    # Aggregated dashboard data
│   │   ├── audit-log/    # Paginated audit logs
│   │   ├── settings/     # App settings CRUD + logo endpoint
│   │   ├── discord/      # Discord config + test
│   │   ├── email/        # Email test (12 templates) + log endpoints
│   │   └── cron/         # Scheduled reminder + email jobs
│   ├── dashboard/        # Dashboard page
│   ├── events/           # Event list + detail + new event pages
│   ├── speakers/         # Speaker directory page
│   ├── volunteers/       # Volunteer directory page
│   ├── venues/           # Venue partner directory page
│   ├── settings/         # Settings hub + sub-pages
│   │   ├── members/      # Member management page
│   │   ├── audit-log/    # Audit log viewer
│   │   ├── templates/    # SOP template editor
│   │   ├── discord/      # Discord config page
│   │   └── permissions/  # Features & Permissions + Email Workflows
│   └── login/            # Login page
├── components/
│   ├── design-system/    # 12 reusable UI components
│   └── layout/           # App shell, sidebar, top bar, command palette
├── lib/
│   ├── auth.ts           # NextAuth config + callbacks
│   ├── auth-helpers.ts   # Dual auth session resolver
│   ├── permissions.ts    # Role hierarchy + access checks
│   ├── audit.ts          # Audit logging + diff utility
│   ├── discord.ts        # Discord bot message helpers
│   ├── email.ts          # Core SMTP email service (Nodemailer)
│   ├── prisma.ts         # Prisma client (with soft-delete middleware)
│   ├── utils.ts          # Shared utilities
│   └── emails/           # Email notification system
│       ├── components/   # Shared email layout (React Email)
│       ├── templates/    # 11 branded email templates
│       ├── triggers.ts   # High-level email trigger functions
│       └── ics.ts        # ICS calendar file generator
├── generated/prisma/     # Generated Prisma client
└── types/                # TypeScript type extensions
```

---

## Roadmap

- **Agentic features** — AI-powered automation capabilities are in the pipeline

---

## Contributing

Contributions are welcome! Whether it's a bug fix, new feature, or documentation improvement — we'd love your help. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, database management guides, and development workflow details.
