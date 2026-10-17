-- Entrega por motoboy sai; entra o envio pelo Melhor Envio. Renomeia o valor do enum (mantém pedidos existentes).
ALTER TYPE "public"."delivery_method" RENAME VALUE 'delivery' TO 'shipping';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_address" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_code" text;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "shipping_box" jsonb;--> statement-breakpoint
-- O endereço em texto livre (motoboy) vira o campo "rua" do endereço estruturado, para não se perder.
UPDATE "orders" SET "shipping_address" = jsonb_build_object('postalCode', '', 'street', "delivery_address", 'number', '', 'complement', '', 'district', '', 'city', '', 'state', '') WHERE "delivery_address" IS NOT NULL;
