-- CreateEnum
CREATE TYPE "AiTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "CoverLetterTone" AS ENUM ('PROFESSIONAL', 'FRIENDLY', 'ENTHUSIASTIC');

-- CreateTable
CREATE TABLE "resume_matches" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "resume_id" UUID NOT NULL,
    "status" "AiTaskStatus" NOT NULL DEFAULT 'PENDING',
    "score" INTEGER,
    "summary" TEXT,
    "matched_skills" TEXT[],
    "missing_skills" TEXT[],
    "suggestions" TEXT[],
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "resume_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cover_letters" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "resume_id" UUID,
    "tone" "CoverLetterTone" NOT NULL,
    "instructions" TEXT,
    "status" "AiTaskStatus" NOT NULL DEFAULT 'PENDING',
    "content" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cover_letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resume_matches_application_id_resume_id_key" ON "resume_matches"("application_id", "resume_id");

-- CreateIndex
CREATE INDEX "cover_letters_application_id_created_at_idx" ON "cover_letters"("application_id", "created_at");

-- AddForeignKey
ALTER TABLE "resume_matches" ADD CONSTRAINT "resume_matches_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_matches" ADD CONSTRAINT "resume_matches_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
