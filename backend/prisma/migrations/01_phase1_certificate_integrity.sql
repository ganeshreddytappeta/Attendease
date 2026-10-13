-- ==============================================================================
-- AttendEase Certificate System: Phase 1.1 Database Integrity Migration Plan
-- Target Engine: PostgreSQL 15+ (Supabase)
-- Status: Reviewable Migration Script (Safe, Additive, Non-Destructive)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. COORDINATOR ASSIGNMENT COLUMN & RELATION INTEGRITY
-- ------------------------------------------------------------------------------
-- Add coordinatorId to student_activities to track responsible faculty coordinator
ALTER TABLE "student_activities"
ADD COLUMN IF NOT EXISTS "coordinatorId" TEXT;

-- Foreign key linking student_activities.coordinatorId to User.userId (canonical model)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_student_activities_coordinator'
  ) THEN
    ALTER TABLE "student_activities"
    ADD CONSTRAINT "fk_student_activities_coordinator"
    FOREIGN KEY ("coordinatorId") REFERENCES "User"("userId")
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_student_activities_coordinator"
ON "student_activities" ("coordinatorId");


-- ------------------------------------------------------------------------------
-- 2. DAILY REQUEST LIMIT & DATABASE UNIQUENESS
-- ------------------------------------------------------------------------------
-- Add requestDate column to store the canonical Asia/Kolkata calendar day (YYYY-MM-DD)
ALTER TABLE "certificate_requests"
ADD COLUMN IF NOT EXISTS "requestDate" TEXT;

-- Backfill existing rows with their Asia/Kolkata calendar date
UPDATE "certificate_requests"
SET "requestDate" = TO_CHAR("requestedAt" AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')
WHERE "requestDate" IS NULL;

-- Pre-check note for DBAs prior to index creation:
-- Any duplicates existing in historical data must be reviewed:
--   SELECT "studentId", "activityId", "requestDate", COUNT(*)
--   FROM "certificate_requests"
--   GROUP BY "studentId", "activityId", "requestDate"
--   HAVING COUNT(*) > 1;

-- Enforce strict database-level daily rate limit:
-- Exactly one request per (student, activity, IST calendar day), regardless of status
CREATE UNIQUE INDEX IF NOT EXISTS "certificate_requests_student_activity_day_unique"
ON "certificate_requests" ("studentId", "activityId", "requestDate");


-- ------------------------------------------------------------------------------
-- 3. ACTIVE CERTIFICATE CONCURRENCY SAFEGUARD
-- ------------------------------------------------------------------------------
-- Pre-check note for DBAs:
--   SELECT "activityId", COUNT(*)
--   FROM "issued_certificates"
--   WHERE "revokedAt" IS NULL
--   GROUP BY "activityId"
--   HAVING COUNT(*) > 1;

-- Guarantee that no more than ONE active (non-revoked) certificate can exist per activity.
-- Uses a PostgreSQL partial unique index, allowing multiple historical revoked certificates.
CREATE UNIQUE INDEX IF NOT EXISTS "issued_certificates_active_activity_unique"
ON "issued_certificates" ("activityId")
WHERE "revokedAt" IS NULL;


-- ------------------------------------------------------------------------------
-- 4. FOREIGN KEY RELATION INTEGRITY & CASCADE PROTECTION
-- ------------------------------------------------------------------------------
-- Ensure IssuedCertificate.activityId is bound to student_activities with Restrict
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_issued_certificates_activity'
  ) THEN
    ALTER TABLE "issued_certificates"
    ADD CONSTRAINT "fk_issued_certificates_activity"
    FOREIGN KEY ("activityId") REFERENCES "student_activities"("id")
    ON DELETE RESTRICT;
  END IF;
END $$;

-- Link revokedById to User.userId (CORRECTED from "users" to "User")
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_issued_certificates_revoked_by'
  ) THEN
    ALTER TABLE "issued_certificates"
    ADD CONSTRAINT "fk_issued_certificates_revoked_by"
    FOREIGN KEY ("revokedById") REFERENCES "User"("userId")
    ON DELETE SET NULL;
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 5. PERFORMANCE INDEXES FOR AUDIT & REVIEWS
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_certificate_requests_pending_activity"
ON "certificate_requests" ("activityId", "status");

CREATE INDEX IF NOT EXISTS "idx_activity_audit_logs_action"
ON "activity_audit_logs" ("action", "timestamp" DESC);

COMMIT;
