-- Black and white (graphite) is the default accent now; accounts still on the old default move to it.
ALTER TABLE "User" ALTER COLUMN "accent" SET DEFAULT 'graphite';
UPDATE "User" SET "accent" = 'graphite' WHERE "accent" = 'teal';
