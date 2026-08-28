-- CreateEnum
CREATE TYPE "Department" AS ENUM ('ALL', 'RECRUITMENT', 'SALES', 'INTERNAL_TASKS', 'CLIENT_PROJECTS', 'PROCUREMENT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "department" "Department" NOT NULL DEFAULT 'ALL';
