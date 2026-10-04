-- CreateTable
CREATE TABLE "resumes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_driver" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "page_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "key" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "content_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "resumes_storage_key_key" ON "resumes"("storage_key");

-- CreateIndex
CREATE INDEX "resumes_user_id_created_at_idx" ON "resumes"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Only the drivers StorageService knows about.
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_storage_driver_check"
  CHECK ("storage_driver" IN ('s3', 'database', 'local'));
