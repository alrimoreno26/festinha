CREATE TYPE "public"."customization_level" AS ENUM('none', 'theme', 'full');--> statement-breakpoint
CREATE TYPE "public"."delivery_method" AS ENUM('download', 'pickup', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."package_kind" AS ENUM('digital', 'custom_digital', 'printed');--> statement-breakpoint
CREATE TYPE "public"."production_status" AS ENUM('in_production', 'ready', 'delivered');--> statement-breakpoint
CREATE TABLE "order_files" (
	"order_id" text NOT NULL,
	"file_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "order_files_order_id_file_id_pk" PRIMARY KEY("order_id","file_id")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customization" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_method" "delivery_method" DEFAULT 'download' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_address" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "production_status" "production_status";--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "kind" "package_kind" DEFAULT 'digital' NOT NULL;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "customization_level" "customization_level" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_files" ADD CONSTRAINT "order_files_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_files" ADD CONSTRAINT "order_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_files_file_idx" ON "order_files" USING btree ("file_id");