-- The mobile app schedules its own notifications; its channel holds a hashed schedule key, not an FCM token.
DELETE FROM "Channel" WHERE "kind" = 'FCM';
ALTER TYPE "ChannelKind" RENAME VALUE 'FCM' TO 'APP';
