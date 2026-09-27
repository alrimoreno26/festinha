CREATE TABLE "webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_key" text NOT NULL,
	"topic" text,
	"resource_id" text,
	"payload" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mp_checkout_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mp_status" text;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_key_uq" ON "webhook_events" USING btree ("provider","event_key");--> statement-breakpoint
CREATE INDEX "webhook_events_resource_idx" ON "webhook_events" USING btree ("resource_id");