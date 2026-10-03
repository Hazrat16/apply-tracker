-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "canonical_job_url" TEXT;

-- CreateIndex
CREATE INDEX "applications_user_id_canonical_job_url_idx" ON "applications"("user_id", "canonical_job_url");
