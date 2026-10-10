-- Phase 6, step 1 of 2 — run BEFORE the Phase 6 code goes live.
-- The new code creates logins without the legacy role, so the column must
-- accept that. Nothing is removed here: the previous build keeps working
-- (it still fills the column), and so does the new one.
ALTER TABLE "User" ALTER COLUMN "role" DROP NOT NULL;
