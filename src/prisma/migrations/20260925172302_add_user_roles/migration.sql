/*
  Warnings:

  - Added the required column `owner_id` to the `diagnostic_centres` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'CENTRE_HEAD');

-- AlterTable
ALTER TABLE "diagnostic_centres" ADD COLUMN     "owner_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'PATIENT';

-- AddForeignKey
ALTER TABLE "diagnostic_centres" ADD CONSTRAINT "diagnostic_centres_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
