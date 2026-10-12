# AttendEase Backend API

The RESTful API and database engine powering **AttendEase** — an enterprise attendance permission and roster management system for students, faculty, heads of department (HOD), and administrators. Built with **Node.js**, **Express**, **TypeScript**, and **Prisma ORM** with **PostgreSQL**.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Quick Start](#installation--quick-start)
- [Environment Configuration](#environment-configuration)
- [Database Setup & Migrations](#database-setup--migrations)
- [Default Seed Credentials](#default-seed-credentials)
- [Available Scripts](#available-scripts)
- [API Endpoints Overview](#api-endpoints-overview)
- [Security & Architecture](#security--architecture)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Role-Based Access Control (RBAC)**: Enforced authorization for `student`, `faculty`, `hod`, and `admin` roles.
- **Attendance Request Engine**: Full lifecycle support (submission, single & bulk review, approval/rejection audit trail, cancellation, and sharing).
- **Optimized Request Loading**: Fast prioritized fetching for pending requests with progressive loading and lazy historical queries.
- **Student Roster & Attendance Management**: Section-based rosters, period block marking, and attendance status tracking.
- **Admin Portal**: Bulk Excel/CSV student imports with duplicate resolution, user CRUD, password management, and coordinator assignments.
- **Multi-Channel Notifications**: Real-time WebSocket notifications, Email (Resend & SMTP), and WhatsApp alerts (Twilio, Green-API, Meta Cloud API).
- **Proof & Avatar Uploads**: Secure document and photo uploads via Cloudinary.
- **AI Chat Assistant**: Integrated campus assistant powered by OpenRouter.

---

## Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Runtime & Language** | [Node.js](https://nodejs.org/) & [TypeScript](https://www.typescriptlang.org/) | Type-safe backend runtime |
| **Web Framework** | [Express 4](https://expressjs.com/) | REST API server framework |
| **ORM & Database** | [Prisma 7](https://www.prisma.io/) + [PostgreSQL](https://www.postgresql.org/) | Type-safe ORM with `@prisma/adapter-pg` pool |
| **Authentication** | [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) & [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | JWT bearer token authentication and salted hashing |
| **Validation** | [Zod](https://zod.dev/) | Schema validation for endpoints and Excel imports |
| **Real-time** | [ws](https://github.com/websockets/ws) | WebSocket server for instant notifications |
| **File Processing** | [ExcelJS](https://github.com/exceljs/exceljs), [pdf-parse](https://github.com/modesty/pdf2json), [Multer](https://github.com/expressjs/multer) | Spreadsheet and PDF parsing |
| **External Services** | [Cloudinary](https://cloudinary.com/), [Resend](https://resend.com/), [Twilio](https://www.twilio.com/) | Cloud storage, transactional emails, and WhatsApp messaging |

---

## Project Structure

```
backend/
├── prisma/
│   └── schema.prisma         # PostgreSQL data models, relations, and enums
├── src/
│   ├── admin/                # Admin module (controllers, services, repositories, validators)
│   │   ├── config/           # Admin configuration and policy thresholds
│   │   ├── controllers/      # Admin request handlers
│   │   ├── routes/           # Student, User, Import, and Password routes
│   │   ├── services/         # Import parser, password policy, user logic
│   │   └── validators/       # Zod schemas for imports and CRUD operations
│   ├── db/
│   │   ├── prisma.ts         # Prisma client singleton with connection pooling
│   │   └── seed.ts           # Database seeder with sample students, faculty & HOD
│   ├── middleware/
│   │   ├── auth.ts           # JWT authentication and role-guard middleware
│   │   ├── errorHandler.ts   # Global error handling middleware
│   │   ├── rateLimiter.ts    # Rate limiting for auth and sensitive endpoints
│   │   └── requireAdmin.ts   # Admin-only route guard
│   ├── routes/
│   │   ├── auth.ts           # Login, registration, password reset, and tokens
│   │   ├── requests.ts       # Student permission requests and faculty reviews
│   │   ├── attendance.ts     # Attendance roster and period block records
│   │   ├── notifications.ts  # Notification inbox and read status
│   │   ├── share.ts          # Public verification and tokenized sharing
│   │   ├── activities.ts     # Student activity points and category logs
│   │   ├── announcements.ts  # System-wide and department banners/popups
│   │   ├── invigilation.ts   # Exam invigilation duty schedules
│   │   └── chat.ts           # AI assistant route
│   ├── services/             # Email, WhatsApp, Cloudinary, and Roster services
│   ├── utils/                # Helper utilities and token generators
│   └── index.ts              # Express application bootstrap and server entrypoint
├── prisma.config.ts          # Prisma CLI configuration
├── tsconfig.json             # TypeScript compiler settings
├── .env.example              # Environment variable template
└── package.json              # Dependencies and lifecycle scripts
```

---

## Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **PostgreSQL**: Local PostgreSQL server, or cloud-hosted instance (e.g., Supabase, Neon, AWS RDS)

---

## Installation & Quick Start

### 1. Navigate to the backend directory

```bash
cd backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create your `.env` configuration

Copy the provided `.env.example` file to `.env`:

```bash
cp .env.example .env
```

*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Open `.env` and set your PostgreSQL `DATABASE_URL` and `JWT_SECRET`:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/attendease?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
```

### 4. Push the schema & seed database

```bash
# Push Prisma schema to PostgreSQL
npm run db:push

# (Optional) Seed the database with sample users and faculty
npm run db:seed
```

### 5. Start the development server

```bash
npm run dev
```

The API server will run at **http://localhost:3000** with auto-reload enabled.

Verify that the server is running by opening:
- Health check: `http://localhost:3000/health`
- Root endpoint: `http://localhost:3000/`

---

## Environment Configuration

Configure the following variables in `backend/.env`:

### Database (Required)
| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/attendease?schema=public` |
| `DIRECT_URL` | Optional direct DB URL (bypasses pooler for migrations) | `postgresql://user:pass@localhost:5432/attendease` |

### Server & Security
| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port on which the Express server listens |
| `NODE_ENV` | `development` | Environment mode (`development` or `production`) |
| `JWT_SECRET` | `attendease_dev_secret_key_2026` | Secret key used for signing JWT authentication tokens |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed frontend origin for CORS |
| `CORS_ALLOWED_ORIGINS` | — | Comma-separated extra allowed origins for CORS |

### Cloudinary (Document & Avatar Storage)
| Variable | Description |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud account name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `CLOUDINARY_UPLOAD_PRESET` | Upload preset name (e.g. `attendease_proofs`) |

### Email Service (Optional)
| Variable | Description |
|---|---|
| `RESEND_API_KEY` | API Key for [Resend](https://resend.com) |
| `RESEND_FROM` | From email header for Resend (e.g. `AttendEase <onboarding@resend.dev>`) |
| `SMTP_HOST` / `SMTP_PORT` | SMTP server host and port (fallback) |
| `SMTP_USER` / `SMTP_PASS` | SMTP authentication credentials |

### WhatsApp Notifications (Optional)
| Variable | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Twilio API credentials |
| `TWILIO_WHATSAPP_FROM` | Twilio WhatsApp sender number |
| `GREEN_API_INSTANCE_ID` / `GREEN_API_API_TOKEN` | Green-API credentials (alternative provider) |
| `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp Cloud API credentials |

---

## Database Setup & Migrations

AttendEase uses Prisma ORM for database management:

```bash
# Generate Prisma Client code based on schema.prisma
npm run db:generate

# Push schema directly to the database without generating migration files
npm run db:push

# Seed the database with initial CSIT/CSD students, faculty, and HOD
npm run db:seed

# Launch Prisma Studio (interactive web GUI for browsing database rows)
npm run db:studio
```

---

## Default Seed Credentials

When you run `npm run db:seed`, the database is populated with the following demo accounts:

| Role | Username / Identifier | Password | Description |
|---|---|---|---|
| **Student** | `24B91A0720` | `24B91A0720` | Student (CSIT, 6th Semester) |
| **Faculty** | `gopinukala@gmail.com` | `1234` | Dr. NGK Murthy (CSIT) |
| **Faculty** | `suresh.mudunuri@srkrec.ac.in` | `1234` | Dr. Suresh Babu Mudunuri (CSD) |
| **HOD** | `hod.csit@college.edu` | `hod123` | Head of Department (CSIT) |

---

## Available Scripts

From the `backend/` directory, you can run:

- `npm run dev`: Starts the server with `tsx watch` for hot-reloading.
- `npm run build`: Generates the Prisma client and compiles TypeScript to `dist/`.
- `npm start`: Runs the compiled JavaScript build (`node dist/index.js`).
- `npm run db:generate`: Regenerates the Prisma Client.
- `npm run db:push`: Synchronizes the Prisma schema with the PostgreSQL database.
- `npm run db:seed`: Executes the seed script to create initial data.
- `npm run db:studio`: Opens the Prisma Studio database manager at `http://localhost:5555`.
- `npm test`: Runs test files matching `src/**/*.test.ts`.

---

## API Endpoints Overview

All protected routes expect an HTTP header:
`Authorization: Bearer <jwt-token>`

### Authentication (`/api/auth`)
- `POST /api/auth/login` — Login as student, faculty, HOD, or admin
- `POST /api/auth/register` — Student account registration
- `POST /api/auth/forgot-password` — Request password reset link or token
- `POST /api/auth/reset-password` — Complete password reset
- `POST /api/auth/logout` — Revoke and clear session token

### Attendance Requests (`/api/requests`)
- `GET /api/requests` — Fetch requests (Supports `status`, `limit`, and `skip` query filters)
- `POST /api/requests` — Student creates new permission request
- `GET /api/requests/:id` — Request detail with student information and audit history
- `PATCH /api/requests/:id` — Faculty or HOD approves/rejects a request
- `POST /api/requests/bulk-review` — Batch approve or reject multiple requests
- `POST /api/requests/upload-proof` — Upload supporting medical or internship certificates
- `DELETE /api/requests/:id` — Student cancels a pending request

### Admin Module (`/api/admin`)
- `GET /api/admin/students` — Paginated student list with search and department filters
- `POST /api/admin/students` — Create new student record
- `PUT /api/admin/students/:id` — Update existing student details
- `POST /api/admin/import/students` — Bulk import students from Excel (.xlsx) or CSV
- `GET /api/admin/users` — List system user accounts
- `PATCH /api/admin/users/:id/password` — Administrative password reset

### Roster & Attendance (`/api/attendance`, `/api/students/roster`)
- `GET /api/students/roster?year=3` — Fetch canonical student roster grouped by sections
- `GET /api/attendance` — Retrieve attendance records for selected period blocks
- `POST /api/attendance` — Submit period-level attendance roster

### Sharing & Verification (`/api/share`)
- `GET /api/share/:token` — Resolve and view a publicly shared permission request
- `POST /api/requests/:id/share-link` — Generate a shareable link or WhatsApp payload

### System (`/`)
- `GET /health` — Health check endpoint (`{ status: "ok", db: "connected" }`)

---

## Security & Architecture

- **Rate Limiting**: Sliding window rate limiting on authentication routes prevents brute-force login attempts.
- **Security Headers**: Standard defense-in-depth headers configured via middleware:
  - `X-Frame-Options: DENY` (Clickjacking prevention)
  - `X-Content-Type-Options: nosniff` (MIME sniffing prevention)
  - `Content-Security-Policy: frame-ancestors 'none'`
  - `Cache-Control: no-store` on sensitive API responses
- **CORS Whitelist**: Secure origin validation allowing only configured frontend domains and verified preview URLs.
- **Connection Pooling**: PostgreSQL connection pooling via `@prisma/adapter-pg` ensures database connection stability under concurrent load.
- **Error Handling**: Centralized `globalErrorHandler` ensures sanitized error messages in production without leaking internal stack traces.

---

## Troubleshooting

### `Error: DATABASE_URL environment variable is not set. Check backend/.env`
- Ensure a `.env` file exists inside the `backend/` directory (not only in the root workspace directory).
- Run `cp .env.example .env` and confirm `DATABASE_URL` is configured with a valid connection string.

### Prisma Client Out of Sync
If you updated `prisma/schema.prisma` or see type errors on queries:
```bash
npm run db:generate
```

### Database Connection Refused
- Confirm PostgreSQL service is running locally (`pg_isready` or check Windows Services).
- If connecting to Supabase or Neon, verify your IP is allowed or use the direct connection URL.
