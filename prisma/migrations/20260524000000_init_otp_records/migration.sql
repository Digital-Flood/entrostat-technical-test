CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "OtpStatus" AS ENUM ('ACTIVE', 'VERIFIED', 'SUPERSEDED', 'EXPIRED');

CREATE TYPE "OtpIssueReason" AS ENUM ('REQUEST', 'RESEND');

CREATE TABLE "otp_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "status" "OtpStatus" NOT NULL DEFAULT 'ACTIVE',
    "issue_reason" "OtpIssueReason" NOT NULL DEFAULT 'REQUEST',
    "request_group_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resend_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "superseded_at" TIMESTAMP(3),
    "superseded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otp_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "otp_records_email_created_at_idx" ON "otp_records"("email", "created_at" DESC);

CREATE INDEX "otp_records_email_status_created_at_idx" ON "otp_records"("email", "status", "created_at" DESC);

CREATE INDEX "otp_records_request_group_created_at_idx" ON "otp_records"("request_group_id", "created_at" DESC);

CREATE INDEX "otp_records_superseded_by_id_idx" ON "otp_records"("superseded_by_id");

ALTER TABLE "otp_records"
    ADD CONSTRAINT "otp_records_superseded_by_id_fkey"
    FOREIGN KEY ("superseded_by_id") REFERENCES "otp_records"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
