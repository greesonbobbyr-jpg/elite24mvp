-- AlterTable
ALTER TABLE "PlayerProfile" ADD COLUMN     "photoCutoutUrl" TEXT,
ADD COLUMN     "photoMeta" JSONB;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "photoCutoutUrl" TEXT,
ADD COLUMN     "photoMeta" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "photoCutoutUrl" TEXT,
ADD COLUMN     "photoMeta" JSONB;
