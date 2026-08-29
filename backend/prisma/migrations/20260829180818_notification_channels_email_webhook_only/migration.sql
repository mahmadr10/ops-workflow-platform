-- Slack, Discord, and Teams adapters were removed; only Email and the generic Webhook remain.
-- Postgres cannot drop enum values directly, so we rebuild the enum with the reduced value set.
CREATE TYPE "NotificationChannel_new" AS ENUM ('EMAIL', 'WEBHOOK');

ALTER TABLE "notifications" ALTER COLUMN "channel" TYPE "NotificationChannel_new" USING ("channel"::text::"NotificationChannel_new");
ALTER TABLE "reminder_rules" ALTER COLUMN "channels" TYPE "NotificationChannel_new"[] USING ("channels"::text[]::"NotificationChannel_new"[]);

DROP TYPE "NotificationChannel";
ALTER TYPE "NotificationChannel_new" RENAME TO "NotificationChannel";
