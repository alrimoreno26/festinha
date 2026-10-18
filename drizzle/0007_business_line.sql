CREATE TYPE "public"."order_file_role" AS ENUM('delivery', 'customer');--> statement-breakpoint
CREATE TYPE "public"."product_line" AS ENUM('festas', 'empresas');--> statement-breakpoint
ALTER TYPE "public"."customization_level" ADD VALUE 'business';--> statement-breakpoint
CREATE TABLE "customer_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"key" text NOT NULL,
	"filename" text NOT NULL,
	"size" bigint NOT NULL,
	"mime" text NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" text,
	"file_id" text,
	CONSTRAINT "customer_uploads_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "order_files" ADD COLUMN "role" "order_file_role" DEFAULT 'delivery' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "variant" jsonb;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "line" "product_line" DEFAULT 'festas' NOT NULL;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "variants" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_uploads" ADD CONSTRAINT "customer_uploads_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_uploads" ADD CONSTRAINT "customer_uploads_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_uploads_ip_idx" ON "customer_uploads" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "customer_uploads_pending_idx" ON "customer_uploads" USING btree ("order_id","created_at");