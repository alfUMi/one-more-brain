-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "extractedText" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiMonth" TEXT;

-- Search also covers text read from images. A generated column can't be altered, so rebuild it.
DROP INDEX "Item_search_idx";
ALTER TABLE "Item" DROP COLUMN "search";
ALTER TABLE "Item" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("quote", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("body", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("extractedText", '')), 'C') ||
    setweight(to_tsvector('simple', coalesce("pageTitle", '')), 'C') ||
    setweight(to_tsvector('simple', coalesce("url", '')), 'D')
) STORED;
CREATE INDEX "Item_search_idx" ON "Item" USING GIN ("search");
