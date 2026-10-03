CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"observation_id" uuid,
	"product_id" uuid,
	"kind" text DEFAULT 'other' NOT NULL,
	"original_name" text,
	"stored_name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attribute_defs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"unit" text,
	"options" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_original" text,
	"country" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"template" text,
	"system_key" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"store_name" text,
	"channel_type" text DEFAULT 'other' NOT NULL,
	"url" text,
	"country" text,
	"city" text,
	"default_currency" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"variant_id" uuid,
	"product_id" uuid,
	"category_id" uuid,
	"raw_name" text,
	"raw_spec" text,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"snap_unit_size" numeric(14, 4),
	"snap_unit_size_unit" text,
	"snap_pack_count" integer,
	"snap_is_mixed_set" boolean DEFAULT false NOT NULL,
	"merchant_id" uuid,
	"merchant_name_raw" text,
	"market_country" text,
	"market_city" text,
	"channel_type" text,
	"observed_at" timestamp with time zone NOT NULL,
	"timezone" text,
	"recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"amount" numeric(16, 4),
	"currency" text,
	"quote_unit" text DEFAULT 'item' NOT NULL,
	"quote_qty" numeric(14, 4) DEFAULT '1' NOT NULL,
	"quote_pack_description" text,
	"sale_type" text DEFAULT 'retail' NOT NULL,
	"price_type" text DEFAULT 'regular' NOT NULL,
	"original_amount" numeric(16, 4),
	"promo_condition" text,
	"promo_valid_until" timestamp with time zone,
	"tax_status" text DEFAULT 'unknown' NOT NULL,
	"shipping_status" text DEFAULT 'unknown' NOT NULL,
	"shipping_amount" numeric(16, 4),
	"stock_status" text,
	"min_order_qty" integer,
	"condition" text,
	"source_url" text,
	"notes" text,
	"expected_photos" integer DEFAULT 0 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"void_reason" text,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_tags" (
	"product_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "product_tags_product_id_tag_id_pk" PRIMARY KEY("product_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"brand_id" uuid,
	"name" text NOT NULL,
	"name_original" text,
	"series" text,
	"attrs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"custom_attrs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"label" text,
	"barcode" text,
	"unit_size" numeric(14, 4),
	"unit_size_unit" text,
	"pack_count" integer,
	"pack_description" text,
	"edition" text,
	"is_mixed_set" boolean DEFAULT false NOT NULL,
	"attrs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_observation_id_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_defs" ADD CONSTRAINT "attribute_defs_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_client_id_uq" ON "attachments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "attachments_obs_idx" ON "attachments" USING btree ("observation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attribute_defs_cat_key_uq" ON "attribute_defs" USING btree ("category_id","key");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_name_uq" ON "brands" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "categories_system_key_uq" ON "categories" USING btree ("system_key");--> statement-breakpoint
CREATE INDEX "merchants_name_idx" ON "merchants" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "observations_client_id_uq" ON "observations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "observations_variant_idx" ON "observations" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "observations_status_idx" ON "observations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "observations_observed_idx" ON "observations" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_uq" ON "tags" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "variants_product_idx" ON "variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "variants_barcode_idx" ON "variants" USING btree ("barcode");