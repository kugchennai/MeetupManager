---
description: Complete API reference for interacting with Meetup Manager programmatically. Use this skill to create, manage, and query events, speakers, volunteers, venues, SOP checklists, and members via REST API endpoints without using the dashboard UI.
alwaysApply: false
---

---
name: meetup-manager
description: Complete API reference for interacting with Meetup Manager programmatically. Enables AI agents to manage events, speakers, volunteers, venues, SOP checklists, and members via REST API endpoints.
---

# Meetup Manager API Skill

This skill provides complete documentation for interacting with Meetup Manager via its REST API. Use this to programmatically manage community meetups, events, speakers, volunteers, and all related operations.

## Base URL

```
https://your-domain.com/api
```

For local development:
```
http://localhost:3000/api
```

## Authentication

> **⚠️ CRITICAL: You MUST obtain a session token before making ANY API calls.**
> 
> All API endpoints (except login) require authentication. Without a valid session token or cookie, you will receive `401 Unauthorized` errors.
> 
> **Session Duration:** Session tokens are valid for **7 days** (604800 seconds). After expiration, you must obtain a new session key.

Meetup Manager supports **dual authentication** - Google OAuth for web users and token-based auth for programmatic/API access.

### Cookie Names by Environment

| Environment | Protocol | Cookie Name |
|-------------|----------|-------------|
| Local Development | HTTP | `authjs.session-token` |
| Production (Vercel) | HTTPS | `__Secure-authjs.session-token` |

> **Important:** Production deployments on Vercel/HTTPS use the `__Secure-` prefix. Always check both names if authentication fails.

### For AI Agents: Getting an Access Token

Since AI agents cannot complete interactive Google OAuth flows, you have **three options**:

#### Option 1: Token Endpoint (Recommended for Agents)

If your email is already registered as a user (via previous OAuth sign-in), you can get a token directly:

```http
POST /api/auth/token
Content-Type: application/json

{
  "email": "your-email@example.com",
  "name": "Your Name",
  "image": "https://..."
}
```

**Requirements:**
- Email must already exist in the system (signed in via OAuth before), OR
- Email matches `SUPER_ADMIN_EMAIL` env var, OR  
- Email exists in the Volunteer directory

Response:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "opaque-token...",
  "expiresIn": 604800,
  "user": {
    "id": "usr_...",
    "email": "your-email@example.com",
    "globalRole": "EVENT_LEAD"
  }
}
```

Use the access token in all subsequent requests:
```http
Authorization: Bearer eyJ...
```

#### Option 2: Session Cookie (Browser-based)

This is the **most common method** when the user is already signed in via browser:

1. Open browser DevTools (F12)
2. Go to Application/Storage → Cookies → `localhost` (or your domain)
3. Find the session cookie (see table above for correct name based on environment)
4. Copy the cookie value - this IS your session key
5. Use it in API calls via **Cookie header** (recommended for production):

```http
GET /api/dashboard
Cookie: __Secure-authjs.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2...
```

Or via **Authorization Bearer** (also works):
```http
Authorization: Bearer eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2...
```

**Example cookie name:** `__Secure-authjs.session-token` (production)  
**Example cookie value:** `eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoi...`

**Session Duration:** 7 days (expires automatically after 604800 seconds)

> **Note:** The cookie value is an encrypted JWT token. Pass it directly without decoding or modification.

#### Option 3: User Provides Token

Ask the user to:
1. Sign in to Meetup Manager via Google OAuth
2. Provide you with their session cookie or a generated API token
3. You use that token for all API calls on their behalf

### Refresh Token

When the access token expires (7 days), use the refresh token:

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "opaque-token..."
}
```

Response:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "new-opaque-token...",
  "expiresIn": 604800
}
```

### Web (Cookie-based)

For browser-based clients, Google OAuth sets session cookies automatically. No additional configuration needed.

---

## Troubleshooting Authentication

### Common 401 Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Wrong cookie name | Use `__Secure-authjs.session-token` for HTTPS/production, `authjs.session-token` for local HTTP |
| `401 Unauthorized` | Token expired | Session expired after 7 days. Get new token from browser or use refresh token |
| `401 Unauthorized` | Modified token | Don't decode or modify the cookie value. Use it exactly as copied |
| `401 Unauthorized` | Wrong header format | Use `Cookie: __Secure-authjs.session-token=...` or `Authorization: Bearer ...` |
| `403 Forbidden` | Insufficient role | Check your role vs required role for the action |

### Testing Your Token

Quick test to verify your token works:
```http
GET /api/dashboard
Cookie: __Secure-authjs.session-token={your-token}
```

Expected: `200 OK` with user data  
If `401`: Token is invalid or expired

### Token Format Reference

**Valid production token example:**
```
eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoi...}
```
- Starts with `eyJ` (base64 encoded JSON)
- Contains multiple `.` separators
- Long string (200+ characters)

**Invalid token examples:**
- `undefined` - Cookie not found
- `[object Object]` - Accidentally stringified object
- Short string (< 50 chars) - Wrong cookie copied

## Role-Based Access Control

### Global Roles (Hierarchy)
| Role | Level | Capabilities |
|------|-------|--------------|
| `VIEWER` | 0 | Read-only access to assigned events |
| `VOLUNTEER` | 1 | Read events, self-assign tasks, toggle own task status |
| `EVENT_LEAD` | 2 | Create/manage events, speakers, volunteers, venues |
| `ADMIN` | 3 | Full access, manage members (except admins), audit log |
| `SUPER_ADMIN` | 4 | Everything + manage admins, settings, member removal |

### Event Roles (Per-Event)
| Role | Level | Capabilities |
|------|-------|--------------|
| `VIEWER` | 0 | Read event data |
| `VOLUNTEER` | 1 | Read event data |
| `ORGANIZER` | 2 | Create/update within event |
| `LEAD` | 3 | Full event control including delete |

### Permission Matrix

| Feature | VIEWER | VOLUNTEER | EVENT_LEAD | ADMIN | SUPER_ADMIN |
|---------|--------|-----------|------------|-------|-------------|
| Dashboard | full | limited (scoped) | full | full | full |
| View Events | full | limited (assigned only) | full | full | full |
| Create Events | none | none | full | full | full |
| Edit/Delete Events | none | none | limited | limited | full |
| Speakers | none | none | full | full | full |
| Venue Partners | none | none | full | full | full |
| Volunteers | none | none | full | full | full |
| Promote Volunteer → Member | none | none | none | full | full |
| SOP Tasks (own) | none | limited | full | full | full |
| SOP Templates | none | none | view only | full | full |
| Change Event Template | none | none | none | full | full |
| Members Management | none | none | none | limited | full |
| Audit Log | none | none | none | full | full |
| Email & Test Email | none | none | none | full | full |
| Public Code of Conduct (View) | full | full | full | full | full |
| Public Code of Conduct (Edit) | none | none | none | none | full |
| Discord Integration | none | none | none | full | full |
| App Settings | none | none | none | none | full |

**Access levels:** `full` = complete access, `limited` = restricted access, `none` = no access

### Key Rules

1. **Admins and Super Admins bypass all event-level role checks** — they have full access to every event
2. **Only Super Admins can assign the Admin role, delete members, or change app-wide settings**
3. **Admins cannot modify other Admins** — role changes between Admins require Super Admin intervention
4. **Volunteers can only see events they're assigned to**, and can only manage their own tasks (toggle status, self-assign)
5. **Member deletion is a soft-delete** — the account is deactivated but data is preserved; any owned events or entities must be reassigned first
6. **Event Leads can view SOP templates** but only Admins+ can create, edit, or delete them

## Pagination

List endpoints support pagination via query parameters:

```http
GET /api/events?page=1&limit=20
GET /api/audit-log?page=1&limit=50
GET /api/email/log?page=1&limit=100&template=event-created
```

**Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)

**Response includes pagination metadata:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "totalPages": 5
  }
}
```

## Rate Limiting

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Standard API | 100 requests | 1 minute |
| Auth endpoints | 10 requests | 1 minute |
| Burst capacity | 20 requests | - |

**Response Headers:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

**When rate limited (429):**
```json
{
  "error": "Too Many Requests",
  "retryAfter": 30
}
```

## Date/Time Handling

- **All API dates are in UTC** (ISO 8601 format)
- **Format:** `2026-03-21T03:30:00.000Z`
- **Timezone:** Always UTC, convert to local for display

**JavaScript example:**
```javascript
// Parse UTC date from API
const eventDate = new Date('2026-03-21T03:30:00.000Z');

// Convert to local timezone
const localDate = eventDate.toLocaleString();
// "3/20/2026, 8:30:00 PM" (PST example)
```

**Creating dates:**
```javascript
// Create UTC date for API
const date = new Date('2026-04-15T18:00:00.000Z').toISOString();
// "2026-04-15T18:00:00.000Z"
```

## Core Resources

> **Remember:** All API calls below require the session key in the Cookie or Authorization header:
> ```http
> Cookie: __Secure-authjs.session-token={your-session-key}
> ```
> Or:
> ```http
> Authorization: Bearer {your-session-key}
> ```

### Events

#### List Events
```http
GET /api/events
```

Query parameters:
- `filter=upcoming|past|all` - Default: `upcoming`

Response:
```json
[
  {
    "id": "evt_...",
    "title": "Community Meetup #42",
    "description": "...",
    "date": "2026-04-15T18:00:00.000Z",
    "endDate": "2026-04-15T21:00:00.000Z",
    "venue": "Community Center",
    "pageLink": "https://...",
    "status": "SCHEDULED",
    "createdById": "usr_...",
    "createdAt": "2026-03-01T...",
    "updatedAt": "2026-03-01T...",
    "speakers": [...],
    "volunteers": [...],
    "venuePartners": [...],
    "checklists": [...]
  }
]
```

#### Get Single Event
```http
GET /api/events/{id}
```

#### Create Event
```http
POST /api/events
Content-Type: application/json

{
  "title": "Community Meetup #42",
  "description": "Join us for networking and talks",
  "date": "2026-04-15T18:00:00.000Z",
  "endDate": "2026-04-15T21:00:00.000Z",
  "venue": "Community Center",
  "pageLink": "https://meetup.com/...",
  "templateId": "tmpl_..."
}
```

> Note: Providing `templateId` auto-generates SOP checklist from template.

#### Update Event
```http
PATCH /api/events/{id}
Content-Type: application/json

{
  "title": "Updated Title",
  "status": "LIVE",
  "venue": "New Venue"
}
```

#### Delete Event
```http
DELETE /api/events/{id}
```

#### Change Event Template
```http
POST /api/events/{id}/change-template
Content-Type: application/json

{
  "templateId": "tmpl_...",
  "regenerateTasks": true
}
```

---

### Event Members

#### Add Member to Event
```http
POST /api/events/{id}/members
Content-Type: application/json

{
  "userId": "usr_...",
  "eventRole": "ORGANIZER"
}
```

#### Remove Member from Event
```http
DELETE /api/events/{id}/members/{userId}
```

---

### Speakers

#### List Speakers (Directory)
```http
GET /api/speakers
```

#### Get Single Speaker
```http
GET /api/speakers/{id}
```

#### Create Speaker
```http
POST /api/speakers
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1-555-1234",
  "bio": "Expert in...",
  "topic": "AI in Community Building",
  "photoUrl": "https://..."
}
```

#### Update Speaker
```http
PATCH /api/speakers/{id}
Content-Type: application/json

{
  "bio": "Updated bio...",
  "topic": "New Topic"
}
```

#### Delete Speaker
```http
DELETE /api/speakers/{id}
```

### Event Speakers (Linking)

#### Add Speaker to Event
```http
POST /api/events/{eventId}/speakers
Content-Type: application/json

{
  "speakerId": "spk_...",
  "status": "INVITED",
  "priority": "HIGH",
  "notes": "Confirm AV needs",
  "followUpBy": "2026-04-10T12:00:00.000Z"
}
```

Status options: `INVITED`, `CONFIRMED`, `DECLINED`, `CANCELLED`
Priority options: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

#### Remove Speaker from Event
```http
DELETE /api/events/{eventId}/speakers?speakerId={speakerId}
```

> **Note:** To update speaker status (INVITED → CONFIRMED, etc.), modify the Speaker entity directly via `PATCH /api/speakers/{id}`.

---

### Volunteers

#### List Volunteers (Directory)
```http
GET /api/volunteers
```

#### Get Single Volunteer
```http
GET /api/volunteers/{id}
```

#### Create Volunteer
```http
POST /api/volunteers
Content-Type: application/json

{
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "+1-555-5678",
  "discordId": "johnsmith#1234",
  "role": "Registration Desk"
}
```

#### Update Volunteer
```http
PATCH /api/volunteers/{id}
Content-Type: application/json

{
  "role": "Stage Manager",
  "discordId": "newdiscord#5678"
}
```

#### Delete Volunteer
```http
DELETE /api/volunteers/{id}
```

#### Promote Volunteer to Member
```http
POST /api/volunteers/{id}/convert
Content-Type: application/json

{
  "role": "EVENT_LEAD"
}
```

> Converts volunteer to full member account. Volunteer record is removed after promotion.

### Event Volunteers (Linking)

#### Add Volunteer to Event
```http
POST /api/events/{eventId}/volunteers
Content-Type: application/json

{
  "volunteerId": "vol_...",
  "assignedRole": "Registration",
  "status": "CONFIRMED",
  "priority": "MEDIUM"
}
```

Status options: `PENDING`, `CONFIRMED`, `ACTIVE`, `NO_SHOW`

#### Remove Volunteer from Event
```http
DELETE /api/events/{eventId}/volunteers?volunteerId={volunteerId}
```

> **Note:** To update volunteer status or assigned role, modify the Volunteer entity directly via `PATCH /api/volunteers/{id}`.

---

### Venue Partners

#### List Venues
```http
GET /api/venues
```

#### Get Single Venue
```http
GET /api/venues/{id}
```

#### Create Venue
```http
POST /api/venues
Content-Type: application/json

{
  "name": "Tech Hub Center",
  "contactName": "Alice Manager",
  "email": "alice@techhub.com",
  "phone": "+1-555-9999",
  "address": "123 Main St, City",
  "capacity": 150,
  "notes": "Great AV setup, parking available",
  "website": "https://techhub.com",
  "photoUrl": "https://..."
}
```

#### Update Venue
```http
PATCH /api/venues/{id}
Content-Type: application/json

{
  "capacity": 200,
  "notes": "Updated: New projector installed"
}
```

#### Delete Venue
```http
DELETE /api/venues/{id}
```

### Event Venues (Linking)

#### Add Venue to Event
```http
POST /api/events/{eventId}/venues
Content-Type: application/json

{
  "venuePartnerId": "ven_...",
  "status": "INQUIRY",
  "priority": "HIGH",
  "cost": "500.00",
  "notes": "Negotiating discount for non-profit"
}
```

Status options: `INQUIRY`, `PENDING`, `CONFIRMED`, `DECLINED`, `CANCELLED`

#### Update Event Venue
```http
PATCH /api/events/{eventId}/venues/{linkId}
Content-Type: application/json

{
  "status": "CONFIRMED",
  "cost": "450.00",
  "confirmationDate": "2026-03-20T10:00:00.000Z"
}
```

#### Remove Venue from Event
```http
DELETE /api/events/{eventId}/venues/{linkId}
```

#### Send Venue Request Email
```http
POST /api/events/{eventId}/venues/{linkId}/request-email
```

> Sends venue booking request email to venue contact.

---

### SOP Checklists & Tasks

#### List Checklists for Event
```http
GET /api/checklists?eventId={eventId}
```

#### Create Checklist
```http
POST /api/checklists
Content-Type: application/json

{
  "eventId": "evt_...",
  "title": "Pre-Event Checklist",
  "sortOrder": 0
}
```

#### Update Checklist
```http
PATCH /api/checklists/{id}
Content-Type: application/json

{
  "title": "Updated Checklist Name"
}
```

#### Delete Checklist
```http
DELETE /api/checklists/{id}
```

### Tasks

#### List Tasks in Checklist
```http
GET /api/checklists/{checklistId}/tasks
```

#### Create Task
```http
POST /api/checklists/{checklistId}/tasks
Content-Type: application/json

{
  "title": "Book catering",
  "description": "Contact caterer for 100 people",
  "status": "TODO",
  "priority": "HIGH",
  "deadline": "2026-04-10T12:00:00.000Z",
  "assigneeId": "usr_...",
  "volunteerAssigneeId": "vol_...",
  "sortOrder": 1
}
```

Status options: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`

#### Update Task
```http
PATCH /api/checklists/{checklistId}/tasks/{taskId}
Content-Type: application/json

{
  "status": "DONE",
  "blockedReason": null
}
```

#### Delete Task
```http
DELETE /api/checklists/{checklistId}/tasks/{taskId}
```

---

### SOP Templates

#### List Templates
```http
GET /api/templates
```

#### Get Single Template
```http
GET /api/templates/{id}
```

#### Get Default Template
```http
GET /api/templates/default
```

#### Create Template
```http
POST /api/templates
Content-Type: application/json

{
  "name": "Standard Meetup Template",
  "description": "Default template for community meetups",
  "defaultTasks": [
    {
      "section": "PRE_EVENT",
      "title": "Book venue",
      "relativeDays": -14,
      "priority": "CRITICAL"
    },
    {
      "section": "PRE_EVENT",
      "title": "Confirm speakers",
      "relativeDays": -7,
      "priority": "HIGH"
    },
    {
      "section": "ON_DAY",
      "title": "Setup registration desk",
      "relativeDays": 0,
      "priority": "HIGH"
    },
    {
      "section": "POST_EVENT",
      "title": "Send thank you emails",
      "relativeDays": 1,
      "priority": "MEDIUM"
    }
  ]
}
```

Sections: `PRE_EVENT`, `ON_DAY`, `POST_EVENT`

#### Update Template
```http
PATCH /api/templates/{id}
Content-Type: application/json

{
  "name": "Updated Template Name",
  "defaultTasks": [...]
}
```

#### Delete Template
```http
DELETE /api/templates/{id}
```

---

### Members (User Management)

#### List Members
```http
GET /api/members/list
```

Response includes soft-deleted members with `deletedAt` field.

#### Add Member
```http
POST /api/members
Content-Type: application/json

{
  "email": "newmember@example.com",
  "name": "New Member",
  "role": "EVENT_LEAD"
}
```

> Sends invitation email. If email matches existing volunteer, prompts promotion flow.

#### Update Member Role
```http
PATCH /api/members/{id}
Content-Type: application/json

{
  "globalRole": "ADMIN"
}
```

Role options: `VIEWER`, `VOLUNTEER`, `EVENT_LEAD`, `ADMIN`, `SUPER_ADMIN`

#### Remove Member (Soft Delete)
```http
DELETE /api/members/{id}
Content-Type: application/json

{
  "reassignToId": "usr_..."
}
```

> If member owns entities (events, speakers, etc.), `reassignToId` is required to transfer ownership.

---

### Dashboard

#### Get Dashboard Data
```http
GET /api/dashboard
```

Response:
```json
{
  "nextEvent": {
    "id": "evt_...",
    "title": "...",
    "date": "...",
    "venue": "...",
    "status": "...",
    "progress": 75,
    "tasksCompleted": 15,
    "tasksTotal": 20
  },
  "myTasks": [...],
  "overdueTasks": [...],
  "stats": {
    "totalEvents": 42,
    "upcomingEvents": 5,
    "pastEvents": 37,
    "todayEvents": 1,
    "totalSpeakers": 28,
    "totalVolunteers": 15,
    "tasksCompletedThisWeek": 12
  },
  "recentActivity": [...]
}
```

---

### Audit Log

#### Get Audit Logs
```http
GET /api/audit-log
```

Query parameters:
- `entityType` - Filter by: `Event`, `Speaker`, `Volunteer`, `Task`, `Template`, `EventSpeaker`, `EventVolunteer`, `Member`
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)

Response:
```json
{
  "logs": [
    {
      "id": "log_...",
      "userId": "usr_...",
      "action": "UPDATE",
      "entityType": "Event",
      "entityId": "evt_...",
      "entityName": "Community Meetup #42",
      "changes": {
        "status": { "from": "DRAFT", "to": "SCHEDULED" },
        "venue": { "from": "TBD", "to": "Community Center" }
      },
      "createdAt": "2026-03-01T..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "totalPages": 5
  }
}
```

---

### App Settings

#### Get Settings
```http
GET /api/settings
```

Response:
```json
{
  "volunteerPromotionThreshold": 3,
  "groupName": "Tech Community",
  "codeOfConduct": "<html>...",
  "hasLightLogo": true,
  "hasDarkLogo": true
}
```

#### Update Settings
```http
PATCH /api/settings
Content-Type: application/json

{
  "volunteerPromotionThreshold": 5,
  "groupName": "New Group Name",
  "codeOfConduct": "<html>Updated content...</html>"
}
```

> `SUPER_ADMIN` only.

#### Get Public Settings
```http
GET /api/settings/public
```

Returns public-facing settings (no auth required).

#### Upload Logo
```http
POST /api/settings/logo
Content-Type: multipart/form-data

file: <binary>
variant: light|dark
```

#### Get Logo
```http
GET /api/settings/logo?variant=light|dark
```

---

### Discord Integration

#### Get Discord Config
```http
GET /api/discord/config
```

#### Update Discord Config
```http
PATCH /api/discord/config
Content-Type: application/json

{
  "botToken": "...",
  "guildId": "123456789",
  "channelId": "987654321",
  "reminderEnabled": true
}
```

#### Test Discord Connection
```http
POST /api/discord/test
```

Sends a test message to verify bot connectivity.

---

### Email System

#### Send Test Email
```http
POST /api/email/test
Content-Type: application/json

{
  "template": "member-invitation",
  "to": "test@example.com"
}
```

Available templates: `member-invitation`, `volunteer-welcome`, `volunteer-promotion`, `event-created`, `event-reminder`, `task-assigned`, `task-due-soon`, `task-overdue`, `speaker-invitation`, `venue-confirmed`, `weekly-digest`

#### Email Workflows Reference

| # | Workflow | Trigger | Recipients | Subject |
|---|----------|---------|------------|---------|
| 1 | **Member Invitation** | Admin invites new member | Invited email | "You've been invited to join {Group Name}" |
| 2 | **Volunteer Welcome** | Volunteer added with email | Volunteer's email | "Welcome to {Group Name} as a volunteer" |
| 3 | **Volunteer Promotion** | Volunteer promoted to Member | Volunteer's email | "You've been promoted to Member in {Group Name}" |
| 4 | **Event Created** | Event created or status → SCHEDULED | All Members, Admins, Super Admins + event members | "New Event: {Event Title}" |
| 5 | **Event Reminder** | 2 days before event (cron) | Event team + confirmed speakers | "Reminder: {Event Title} in 2 days" |
| 6 | **Task Assigned** | Task assigned / reassigned | Assigned user | "New Task Assigned: {Task Title}" |
| 7 | **Task Due Soon** | Task deadline within 3 days (cron) | Assigned user | "Task Due Soon: {Task Title}" |
| 8 | **Task Overdue** | Task past deadline (cron) | Assigned user (CC: Event Lead if 3+ days overdue) | "Task Overdue: {Task Title}" |
| 9 | **Speaker Invitation** | Speaker added to event | Speaker's email | "Speaking Opportunity: {Event Title}" |
| 10 | **Venue Confirmed** | Venue status → CONFIRMED | Event Lead | "Venue Confirmed: {Venue Name} for {Event Title}" |
| 11 | **Weekly Digest** | Every Monday 09:00 UTC (cron) | All active members | "Weekly Digest: {Group Name}" |

**Features:**
- All emails include branded HTML templates with group logo (if uploaded)
- Event reminder emails include `.ics` calendar attachments
- Email delivery is tracked in `EmailLog` table with status (PENDING/SENT/FAILED)
- Emails are sent fire-and-forget (don't block API responses)
- Failures are logged but don't affect user-facing operations

#### Get Email Logs
```http
GET /api/email/log
```

Query parameters:
- `template` - Filter by template name
- `status` - Filter by: `PENDING`, `SENT`, `FAILED`
- `page`, `limit` - Pagination

---

### Cron Jobs (Scheduled Tasks)

These endpoints are protected by `CRON_SECRET` header:

```http
Authorization: Bearer {CRON_SECRET}
```

#### Daily Reminders
```http
GET /api/cron/reminders
```

Sends Discord notifications for:
- Tasks due within 3 days
- Overdue tasks

#### Event Reminders
```http
GET /api/cron/event-reminders
```

Sends email reminders for events happening in 2 days.

#### Weekly Digest
```http
GET /api/cron/weekly-digest
```

Sends weekly summary email to all members (runs Monday 09:00 UTC).

---

## Common Workflows

### Create Event with Full Setup

```javascript
// 1. Create the event
const event = await fetch('/api/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Tech Meetup April',
    description: 'Monthly community gathering',
    date: '2026-04-15T18:00:00.000Z',
    endDate: '2026-04-15T21:00:00.000Z',
    venue: 'Community Center',
    templateId: 'tmpl_default'
  })
}).then(r => r.json());

// 2. Add speakers
await fetch(`/api/events/${event.id}/speakers`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    speakerId: 'spk_...',
    status: 'INVITED',
    priority: 'HIGH'
  })
});

// 3. Add volunteers
await fetch(`/api/events/${event.id}/volunteers`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    volunteerId: 'vol_...',
    assignedRole: 'Registration',
    status: 'CONFIRMED'
  })
});

// 4. Link venue
await fetch(`/api/events/${event.id}/venues`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    venuePartnerId: 'ven_...',
    status: 'CONFIRMED',
    cost: '500.00'
  })
});

// 5. Assign tasks
const checklist = event.checklists[0];
await fetch(`/api/checklists/${checklist.id}/tasks/${taskId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    assigneeId: 'usr_...',
    deadline: '2026-04-10T12:00:00.000Z'
  })
});
```

### Bulk Import Speakers

```javascript
const speakers = [
  { name: 'Alice', email: 'alice@example.com', topic: 'AI' },
  { name: 'Bob', email: 'bob@example.com', topic: 'Web Dev' }
];

for (const speaker of speakers) {
  const created = await fetch('/api/speakers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(speaker)
  }).then(r => r.json());
  
  await fetch(`/api/events/${eventId}/speakers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      speakerId: created.id,
      status: 'INVITED'
    })
  });
}
```

### Get Event Status Report

```javascript
const event = await fetch(`/api/events/${eventId}`).then(r => r.json());

const report = {
  title: event.title,
  date: event.date,
  status: event.status,
  speakers: {
    total: event.speakers.length,
    confirmed: event.speakers.filter(s => s.status === 'CONFIRMED').length,
    invited: event.speakers.filter(s => s.status === 'INVITED').length
  },
  volunteers: {
    total: event.volunteers.length,
    confirmed: event.volunteers.filter(v => v.status === 'CONFIRMED').length
  },
  venue: event.venuePartners.find(v => v.status === 'CONFIRMED')?.venuePartner.name || 'Not confirmed',
  tasks: event.checklists.flatMap(c => c.tasks).reduce((acc, t) => {
    acc.total++;
    acc[t.status.toLowerCase()]++;
    return acc;
  }, { total: 0, todo: 0, in_progress: 0, blocked: 0, done: 0 })
};
```

### Quick Workflows

#### Create Event + Add Speaker + Assign Tasks
```javascript
// Step 1: Create event with template
const event = await api.createEvent({
  title: 'React Workshop',
  date: '2026-04-20T18:00:00.000Z',
  endDate: '2026-04-20T21:00:00.000Z',
  venue: 'Tech Hub',
  templateId: 'tmpl_default'
});

// Step 2: Create speaker
const speaker = await api.request('/speakers', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Sarah Chen',
    email: 'sarah@example.com',
    topic: 'React Performance'
  })
});

// Step 3: Link speaker to event
await api.request(`/events/${event.id}/speakers`, {
  method: 'POST',
  body: JSON.stringify({
    speakerId: speaker.id,
    status: 'INVITED'
  })
});

// Step 4: Assign tasks
const task = event.checklists[0].tasks[0];
await api.request(`/checklists/${event.checklists[0].id}/tasks/${task.id}`, {
  method: 'PATCH',
  body: JSON.stringify({
    assigneeId: 'usr_...',
    deadline: '2026-04-15T12:00:00.000Z'
  })
});
```

#### Complete Overdue Tasks
```javascript
// Get dashboard to find overdue tasks
const dashboard = await api.getDashboard();

// Mark each overdue task as done
for (const task of dashboard.overdueTasks) {
  await api.request(`/checklists/${task.checklistId}/tasks/${task.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'DONE' })
  });
}
```

#### List Events with Pagination
```javascript
// Get first page
const page1 = await api.request('/events?page=1&limit=20');

// Get next page if more exist
if (page1.pagination.page < page1.pagination.totalPages) {
  const page2 = await api.request('/events?page=2&limit=20');
}
```

---

## Quick Reference: Permissions

### Minimum Role Required by Action

| Action | API Endpoint | Minimum Role |
|--------|--------------|--------------|
| **Events** |
| View events | `GET /api/events` | VIEWER (own), EVENT_LEAD (all) |
| Create event | `POST /api/events` | EVENT_LEAD |
| Update event | `PATCH /api/events/{id}` | ORGANIZER (event), ADMIN (any) |
| Delete event | `DELETE /api/events/{id}` | LEAD (own), SUPER_ADMIN (any) |
| **Speakers** |
| View speakers | `GET /api/speakers` | EVENT_LEAD |
| Create speaker | `POST /api/speakers` | EVENT_LEAD |
| Link to event | `POST /api/events/{id}/speakers` | EVENT_LEAD |
| **Volunteers** |
| View volunteers | `GET /api/volunteers` | EVENT_LEAD |
| Create volunteer | `POST /api/volunteers` | EVENT_LEAD |
| Promote to member | `POST /api/volunteers/{id}/convert` | ADMIN |
| **Members** |
| View members | `GET /api/members/list` | ADMIN |
| Add member | `POST /api/members` | ADMIN |
| Change role | `PATCH /api/members/{id}` | ADMIN (up to EVENT_LEAD), SUPER_ADMIN (any) |
| Delete member | `DELETE /api/members/{id}` | SUPER_ADMIN |
| **Templates** |
| View templates | `GET /api/templates` | EVENT_LEAD |
| Create template | `POST /api/templates` | ADMIN |
| **Settings** |
| View settings | `GET /api/settings` | SUPER_ADMIN |
| Update settings | `PATCH /api/settings` | SUPER_ADMIN |

### Role Hierarchy Quick Check
```javascript
const ROLE_LEVEL = { VIEWER: 0, VOLUNTEER: 1, EVENT_LEAD: 2, ADMIN: 3, SUPER_ADMIN: 4 };

function canPerform(userRole, requiredRole) {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[requiredRole];
}

// Examples:
canPerform('ADMIN', 'EVENT_LEAD'); // true - Admin can do Event Lead actions
canPerform('EVENT_LEAD', 'ADMIN'); // false - Event Lead cannot do Admin actions
```

---

## Error Handling

### Common HTTP Status Codes

| Code | Meaning | Typical Cause |
|------|---------|---------------|
| 200 | OK | Success |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid JSON or missing required fields |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Business logic conflict (e.g., duplicate email) |
| 422 | Unprocessable Entity | Validation failed |
| 500 | Server Error | Unexpected server error |

### Error Response Format

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

---

## Rate Limits

- Standard API: 100 requests/minute per user
- Cron endpoints: No limit (require `CRON_SECRET`)
- Auth endpoints: 10 requests/minute per IP

---

## SDK Helper Functions

When building AI agents, use these patterns:

### Type-Safe API Client with Error Handling

```typescript
class MeetupManagerAPI {
  constructor(
    private baseUrl: string, 
    private token?: string,
    private isProduction: boolean = true
  ) {}
  
  private getAuthHeader(): Record<string, string> {
    if (!this.token) return {};
    
    // Production: Use Cookie header (more reliable)
    if (this.isProduction) {
      return {
        'Cookie': `__Secure-authjs.session-token=${this.token}`
      };
    }
    
    // Local development: Bearer token works
    return {
      'Authorization': `Bearer ${this.token}`
    };
  }
  
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
        ...options?.headers
      }
    });
    
    // Handle specific error codes
    if (res.status === 401) {
      throw new Error('Session expired or invalid. Please provide a new session token.');
    }
    if (res.status === 403) {
      throw new Error('Permission denied. Your role does not have access to this resource.');
    }
    if (res.status === 409) {
      const data = await res.json();
      throw new Error(`Conflict: ${data.error || 'Resource already exists'}`);
    }
    if (res.status === 422) {
      const data = await res.json();
      throw new Error(`Validation failed: ${JSON.stringify(data.details || data.error)}`);
    }
    if (res.status === 429) {
      throw new Error('Rate limit exceeded. Please wait before retrying.');
    }
    if (!res.ok) {
      throw new Error(`API Error ${res.status}: ${res.statusText}`);
    }
    
    return res.json();
  }
  
  // Test if token is valid
  async verifyToken(): Promise<boolean> {
    try {
      await this.request('/dashboard');
      return true;
    } catch {
      return false;
    }
  }
  
  // Events
  listEvents = (filter?: string) => this.request(`/events${filter ? `?filter=${filter}` : ''}`);
  getEvent = (id: string) => this.request(`/events/${id}`);
  createEvent = (data: any) => this.request('/events', { method: 'POST', body: JSON.stringify(data) });
  updateEvent = (id: string, data: any) => this.request(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  deleteEvent = (id: string) => this.request(`/events/${id}`, { method: 'DELETE' });
  
  // Dashboard
  getDashboard = () => this.request('/dashboard');
  
  // ... other methods
}

// Usage example:
const api = new MeetupManagerAPI('https://kugmanager.vercel.app', userToken, true);

// Verify token before operations
const isValid = await api.verifyToken();
if (!isValid) {
  console.error('Please sign in again and provide a new session token');
  return;
}

// Now make API calls
const dashboard = await api.getDashboard();
const events = await api.listEvents('upcoming');
```

### Batch Operations

```typescript
// Create multiple events from a list
async function batchCreateEvents(api: MeetupManagerAPI, events: any[]) {
  const results = [];
  for (const event of events) {
    try {
      const created = await api.createEvent(event);
      results.push({ success: true, data: created });
    } catch (error) {
      results.push({ success: false, error, input: event });
    }
  }
  return results;
}
```

---

## Testing

### Health Check

```http
GET /api/dashboard
Authorization: Bearer {token}
```

Returns 200 if service is healthy and token is valid.

### Verify Permissions

```javascript
const checkPermission = async (userId: string, eventId: string, action: string) => {
  try {
    await fetch(`/api/events/${eventId}`, { method: 'PATCH', body: '{}' });
    return true;
  } catch (e) {
    return false;
  }
};
```

---

## AI Agent Usage Guide

### Step-by-Step: First-Time Setup

Since Meetup Manager uses session-based authentication, follow this workflow:

**Step 1: Obtain Session Key (REQUIRED)**

Before ANY API calls, you MUST get a session token. Choose ONE method:

**Method A: Extract from Browser (Easiest)**
```
Agent: "I need your session cookie to access the Meetup Manager API.
Please:
1. Open Meetup Manager in your browser (sign in if needed)
2. Press F12 → Application → Cookies
3. Find 'authjs.session-token'
4. Copy the value and paste it here"
```

**Method B: Token Endpoint (If user pre-registered)**
```http
POST /api/auth/token
Content-Type: application/json

{
  "email": "user@example.com"
}
```
> Note: Email must already exist in the system (user signed in via OAuth before)

**Step 2: Store Session Key**
```javascript
const sessionKey = "eyJhbGciOiJIUzI1NiIs..."; // From user
```

**Step 3: Use in ALL API Calls**
```http
GET /api/events
Authorization: Bearer {sessionKey}
```

**⚠️ REMINDER: Every API request must include the Authorization header with your session key.**

### Handling Token Expiration

```javascript
async function callWithRefresh(fn, refreshToken) {
  try {
    return await fn();
  } catch (e) {
    if (e.status === 401) {
      // Token expired, refresh it
      const newTokens = await fetch('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken })
      }).then(r => r.json());
      
      // Retry with new token
      return await fn(newTokens.accessToken);
    }
    throw e;
  }
}
```

### Common Agent Workflows

#### "Create an event for me"

```javascript
// 1. Get user's token (they must provide it or have pre-registered)
const token = await getUserToken();

// 2. Check their role/permissions
const dashboard = await fetch('/api/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// 3. Verify they can create events (EVENT_LEAD+ or ADMIN)
const userRole = dashboard.user?.globalRole;
if (!['EVENT_LEAD', 'ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
  return "You need EVENT_LEAD or higher role to create events.";
}

// 4. Create the event
const event = await fetch('/api/events', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: "New Meetup",
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
    venue: "TBD"
  })
}).then(r => r.json());

return `Created event "${event.title}" with ID: ${event.id}`;
```

#### "What events am I assigned to?"

```javascript
const token = await getUserToken();

// VOLUNTEER role only sees their assigned events
const events = await fetch('/api/events', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

return events.map(e => `${e.title} - ${e.date} (${e.status})`).join('\n');
```

#### "Show my tasks"

```javascript
const token = await getUserToken();
const dashboard = await fetch('/api/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

return dashboard.myTasks.map(t => 
  `[${t.priority}] ${t.title} (due: ${t.deadline || 'No deadline'})`
).join('\n');
```

### Error Handling for Agents

| Scenario | Agent Response |
|----------|----------------|
| `401 Unauthorized` | "I need your session key to access Meetup Manager. Please provide your session cookie (authjs.session-token for local, __Secure-authjs.session-token for production) from the browser, or sign in first. Note: Sessions expire after 7 days." |
| `403 Forbidden` | "You don't have permission to do this. Your role is X, but you need Y." |
| `409 Conflict` | "There's a conflict - perhaps this email already exists or there's a duplicate entry." |
| `422 Unprocessable Entity` | "The data you provided is invalid. Check required fields and formats." |
| `429 Too Many Requests` | "Rate limit exceeded. Please wait a moment before trying again." |
| `500 Internal Server Error` | "Server error. Please try again in a few moments." |
| User not registered | "You need to sign into Meetup Manager via Google first before I can access the API on your behalf." |

**If you get 401 on EVERY request:** You forgot to include the Authorization/Cookie header. Make sure EVERY API call includes:
```http
Cookie: __Secure-authjs.session-token={session-key}
```
Or:
```http
Authorization: Bearer {session-key}
```

### Security Notes for Agents

1. **Never store user tokens long-term** without encryption
2. **Ask for explicit confirmation** before destructive operations (delete, reassign ownership)
3. **Log actions** you perform on behalf of users for audit purposes
4. **Respect role boundaries** - don't try to bypass permission checks
5. **Refresh tokens securely** - don't expose them in logs or error messages


---

## Appendix: Enums & Constants Reference

### GlobalRole
| Value | Level | Description |
|-------|-------|-------------|
| `VIEWER` | 0 | Read-only access |
| `VOLUNTEER` | 1 | Read events, manage own tasks |
| `EVENT_LEAD` | 2 | Create/manage events, speakers, volunteers |
| `ADMIN` | 3 | Full access except admin management |
| `SUPER_ADMIN` | 4 | Complete control |

### EventRole
| Value | Level | Description |
|-------|-------|-------------|
| `VIEWER` | 0 | Read event data |
| `VOLUNTEER` | 1 | Read event data |
| `ORGANIZER` | 2 | Create/update within event |
| `LEAD` | 3 | Full event control |

### EventStatus
| Value | Description |
|-------|-------------|
| `DRAFT` | Initial state, not publicly visible |
| `SCHEDULED` | Confirmed date, visible to team |
| `LIVE` | Currently happening |
| `COMPLETED` | Event finished |

### SpeakerStatus
| Value | Description |
|-------|-------------|
| `INVITED` | Initial invitation sent |
| `CONFIRMED` | Speaker confirmed attendance |
| `DECLINED` | Speaker declined invitation |
| `CANCELLED` | Previously confirmed but cancelled |

### VolunteerStatus
| Value | Description |
|-------|-------------|
| `PENDING` | Awaiting confirmation |
| `CONFIRMED` | Confirmed for event |
| `ACTIVE` | Currently participating |
| `NO_SHOW` | Confirmed but didn't attend |

### VenuePartnerStatus
| Value | Description |
|-------|-------------|
| `INQUIRY` | Initial inquiry sent |
| `PENDING` | Awaiting response |
| `CONFIRMED` | Venue booked |
| `DECLINED` | Venue unavailable |
| `CANCELLED` | Previously confirmed but cancelled |

### TaskStatus
| Value | Description |
|-------|-------------|
| `TODO` | Not started |
| `IN_PROGRESS` | Currently working on it |
| `BLOCKED` | Blocked, needs resolution |
| `DONE` | Completed |

### Priority
| Value | Level | Description |
|-------|-------|-------------|
| `LOW` | 0 | Can be deferred |
| `MEDIUM` | 1 | Standard priority |
| `HIGH` | 2 | Urgent attention needed |
| `CRITICAL` | 3 | Blocker for event success |

### SOPSection
| Value | Description |
|-------|-------------|
| `PRE_EVENT` | Tasks before the event |
| `ON_DAY` | Tasks on event day |
| `POST_EVENT` | Tasks after the event |

### AuditAction
| Value | Description |
|-------|-------------|
| `CREATE` | New entity created |
| `UPDATE` | Entity modified |
| `DELETE` | Entity removed |

### EmailStatus
| Value | Description |
|-------|-------------|
| `PENDING` | Queued for sending |
| `SENT` | Successfully delivered |
| `FAILED` | Delivery failed |

### Entity Types (for Audit Log)
- `Event`
- `Speaker`
- `Volunteer`
- `SOPTask`
- `SOPTemplate`
- `EventSpeaker`
- `EventVolunteer`
- `User`
- `AppSetting`
- `VenuePartner`

---

## Data Models Quick Reference

### Event
```typescript
{
  id: string;
  title: string;
  description?: string;
  date: Date;           // Event start
  endDate: Date;        // Event end
  venue?: string;       // Simple venue name
  pageLink?: string;    // External event page
  status: EventStatus;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Speaker
```typescript
{
  id: string;
  name: string;
  email?: string;
  phone?: string;
  bio?: string;
  topic?: string;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Volunteer
```typescript
{
  id: string;
  name: string;
  email?: string;
  phone?: string;
  discordId?: string;
  role?: string;        // General role/description
  userId?: string;      // Linked user account
  createdAt: Date;
  updatedAt: Date;
}
```

### VenuePartner
```typescript
{
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  capacity?: number;
  notes?: string;
  website?: string;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### SOPTask
```typescript
{
  id: string;
  checklistId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  ownerId?: string;           // User who created
  assigneeId?: string;        // Assigned user
  volunteerAssigneeId?: string; // Assigned volunteer
  deadline?: Date;
  completedAt?: Date;
  blockedReason?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Common Query Patterns

### Filter Events
```javascript
// Upcoming events (default)
GET /api/events?filter=upcoming

// Past events
GET /api/events?filter=past

// All events
GET /api/events?filter=all
```

### Paginated Audit Logs
```javascript
// Page 1, 50 items (default)
GET /api/audit-log

// Page 2, 25 items
GET /api/audit-log?page=2&limit=25

// Filter by entity type
GET /api/audit-log?entityType=Event

// Combined
GET /api/audit-log?entityType=Task&page=1&limit=100
```

### Email Logs
```javascript
// By template
GET /api/email/log?template=task-assigned

// By status
GET /api/email/log?status=FAILED

// Combined with pagination
GET /api/email/log?template=event-created&status=SENT&page=1&limit=50
```

---

## Date Handling

All dates are in **ISO 8601 format** (UTC):
```
2026-04-15T18:00:00.000Z
```

When creating events or tasks, always include the timezone offset or use UTC:
```javascript
// JavaScript
new Date().toISOString();  // "2026-03-16T11:30:00.000Z"

// Relative dates (e.g., 7 days from now)
new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
```

---

## File Uploads

### Logo Upload
```http
POST /api/settings/logo
Content-Type: multipart/form-data

file: <binary data>
variant: light|dark
```

**Supported formats:** PNG, JPEG, SVG, WebP  
**Max size:** 200KB

---

## Tips for AI Agents

### 1. Check Before Creating
Always check if an entity exists before creating to avoid duplicates:
```javascript
// Check if speaker exists
const existing = await fetch(`/api/speakers`).then(r => r.json());
const found = existing.find(s => s.email === "speaker@example.com");

if (found) {
  // Link existing speaker to event
  await linkSpeakerToEvent(found.id);
} else {
  // Create new speaker
  const created = await createSpeaker({ email: "speaker@example.com", ... });
  await linkSpeakerToEvent(created.id);
}
```

### 2. Handle Soft Deletes
Users are soft-deleted. Check for `deletedAt` field:
```javascript
// When listing members, check if active
const activeMembers = members.filter(m => !m.deletedAt);
```

### 3. Cascade Considerations
- Deleting an Event → cascades to EventSpeaker, EventVolunteer, EventVenuePartner, SOPChecklist, SOPTask
- Deleting a Speaker → cascades to EventSpeaker links
- Deleting a Volunteer → cascades to EventVolunteer links and task assignments
- Deleting a VenuePartner → cascades to EventVenuePartner links

### 4. Audit Logging
All create/update/delete operations are automatically audit-logged. No need to log separately.

### 5. Email Sending
Emails are sent fire-and-forget. The API will return 200 immediately, and emails are processed asynchronously. Check `EmailLog` for delivery status.

### 6. Discord Notifications
Discord notifications silently fail if not configured. No error is returned to the API caller.

---

## Changelog

### Skill Version 1.0
- Initial complete API documentation
- All REST endpoints documented
- Authentication patterns for AI agents
- Role-based access control reference
- Common workflow examples
- SDK helper patterns
- Enums & constants reference

