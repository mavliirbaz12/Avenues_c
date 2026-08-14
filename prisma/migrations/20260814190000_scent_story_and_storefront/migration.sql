-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "bestFor" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sensoryNarrative" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "StoreSetting" ADD COLUMN     "announcementEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "announcementHref" TEXT,
ADD COLUMN     "announcementText" TEXT,
ADD COLUMN     "brandBannerUrl" TEXT,
ADD COLUMN     "heroPosterUrl" TEXT,
ADD COLUMN     "heroVideoUrl" TEXT;

