-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('PROJECT_CREATE', 'PROJECT_VIEW_ALL', 'PROJECT_MANAGE_ALL', 'USER_MANAGE');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('MANAGER', 'MEMBER', 'VIEWER');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'LEAD';

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN     "role" "ProjectRole" NOT NULL DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "permissions" "Permission"[] DEFAULT ARRAY[]::"Permission"[];

-- Project owners manage their own projects (application code also treats the
-- owner as a project manager; this keeps the stored role consistent).
UPDATE "ProjectMember" AS m
SET "role" = 'MANAGER'
FROM "Project" AS p
WHERE m."projectId" = p."id" AND m."userId" = p."ownerId";
