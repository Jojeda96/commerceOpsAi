-- CreateTable
CREATE TABLE "olist_customers" (
    "id" TEXT NOT NULL,
    "customer_unique_id" TEXT NOT NULL,
    "customer_zip_code_prefix" TEXT NOT NULL,
    "customer_city" TEXT NOT NULL,
    "customer_state" TEXT NOT NULL,

    CONSTRAINT "olist_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "olist_sellers" (
    "id" TEXT NOT NULL,
    "seller_zip_code_prefix" TEXT NOT NULL,
    "seller_city" TEXT NOT NULL,
    "seller_state" TEXT NOT NULL,

    CONSTRAINT "olist_sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "olist_orders" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_status" TEXT NOT NULL,
    "order_purchase_timestamp" TIMESTAMP(3) NOT NULL,
    "order_approved_at" TIMESTAMP(3),
    "order_delivered_carrier_date" TIMESTAMP(3),
    "order_delivered_customer_date" TIMESTAMP(3),
    "order_estimated_delivery_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olist_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "olist_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_item_id" INTEGER NOT NULL,
    "product_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "shipping_limit_date" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "freight_value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "olist_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "olist_order_payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "payment_sequential" INTEGER NOT NULL,
    "payment_type" TEXT NOT NULL,
    "payment_installments" INTEGER NOT NULL,
    "payment_value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "olist_order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "olist_order_reviews" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "review_score" INTEGER NOT NULL,
    "review_comment_title" TEXT,
    "review_comment_message" TEXT,
    "review_creation_date" TIMESTAMP(3) NOT NULL,
    "review_answer_timestamp" TIMESTAMP(3) NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "sentiment" TEXT,
    "primary_topic" TEXT,
    "secondary_topics" TEXT[],
    "translated_text" TEXT,

    CONSTRAINT "olist_order_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "olist_products" (
    "id" TEXT NOT NULL,
    "product_category_name" TEXT,
    "product_name_length" INTEGER,
    "product_description_length" INTEGER,
    "product_photos_qty" INTEGER,
    "product_weight_g" DOUBLE PRECISION,
    "product_length_cm" DOUBLE PRECISION,
    "product_height_cm" DOUBLE PRECISION,
    "product_width_cm" DOUBLE PRECISION,

    CONSTRAINT "olist_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "olist_geolocation" (
    "id" TEXT NOT NULL,
    "geolocation_zip_code_prefix" TEXT NOT NULL,
    "geolocation_lat" DOUBLE PRECISION NOT NULL,
    "geolocation_lng" DOUBLE PRECISION NOT NULL,
    "geolocation_city" TEXT NOT NULL,
    "geolocation_state" TEXT NOT NULL,

    CONSTRAINT "olist_geolocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_category_translation" (
    "id" TEXT NOT NULL,
    "product_category_name" TEXT NOT NULL,
    "product_category_name_english" TEXT NOT NULL,

    CONSTRAINT "product_category_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigations" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "date_from" TIMESTAMP(3),
    "date_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "iteration_count" INTEGER NOT NULL DEFAULT 0,
    "final_quality_score" DOUBLE PRECISION,

    CONSTRAINT "investigations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_tasks" (
    "id" TEXT NOT NULL,
    "investigation_id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "depends_on" TEXT[],
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "investigation_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "investigation_id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "model" TEXT,
    "prompt_version" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "estimated_cost" DOUBLE PRECISION,
    "duration_ms" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_executions" (
    "id" TEXT NOT NULL,
    "agent_run_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "parameters_json" JSONB NOT NULL,
    "result_summary" TEXT,
    "raw_result_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "investigation_id" TEXT NOT NULL,
    "agent_run_id" TEXT,
    "agent_name" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "finding_type" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "tool_execution_id" TEXT,
    "evidence_type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "row_count" INTEGER,
    "sample_size" INTEGER,
    "query_hash" TEXT,
    "raw_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding_evidence" (
    "finding_id" TEXT NOT NULL,
    "evidence_id" TEXT NOT NULL,

    CONSTRAINT "finding_evidence_pkey" PRIMARY KEY ("finding_id","evidence_id")
);

-- CreateTable
CREATE TABLE "critic_feedback" (
    "id" TEXT NOT NULL,
    "investigation_id" TEXT NOT NULL,
    "finding_id" TEXT,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "required_action" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "critic_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "investigation_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "expected_impact" TEXT,
    "assumptions_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_alerts" (
    "id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL,
    "metrics_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "business_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_predictions" (
    "id" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "prediction" TEXT NOT NULL,
    "probability" DOUBLE PRECISION,
    "features_json" JSONB NOT NULL,
    "explanation_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "olist_customers_customer_state_idx" ON "olist_customers"("customer_state");

-- CreateIndex
CREATE INDEX "olist_customers_customer_city_idx" ON "olist_customers"("customer_city");

-- CreateIndex
CREATE INDEX "olist_sellers_seller_state_idx" ON "olist_sellers"("seller_state");

-- CreateIndex
CREATE UNIQUE INDEX "olist_orders_order_id_key" ON "olist_orders"("order_id");

-- CreateIndex
CREATE INDEX "olist_orders_order_purchase_timestamp_idx" ON "olist_orders"("order_purchase_timestamp");

-- CreateIndex
CREATE INDEX "olist_orders_order_status_idx" ON "olist_orders"("order_status");

-- CreateIndex
CREATE INDEX "olist_orders_customer_id_idx" ON "olist_orders"("customer_id");

-- CreateIndex
CREATE INDEX "olist_order_items_seller_id_idx" ON "olist_order_items"("seller_id");

-- CreateIndex
CREATE INDEX "olist_order_items_product_id_idx" ON "olist_order_items"("product_id");

-- CreateIndex
CREATE INDEX "olist_order_items_order_id_idx" ON "olist_order_items"("order_id");

-- CreateIndex
CREATE INDEX "olist_order_payments_order_id_idx" ON "olist_order_payments"("order_id");

-- CreateIndex
CREATE INDEX "olist_order_reviews_review_score_idx" ON "olist_order_reviews"("review_score");

-- CreateIndex
CREATE INDEX "olist_order_reviews_order_id_idx" ON "olist_order_reviews"("order_id");

-- CreateIndex
CREATE INDEX "olist_products_product_category_name_idx" ON "olist_products"("product_category_name");

-- CreateIndex
CREATE INDEX "olist_geolocation_geolocation_zip_code_prefix_idx" ON "olist_geolocation"("geolocation_zip_code_prefix");

-- CreateIndex
CREATE UNIQUE INDEX "product_category_translation_product_category_name_key" ON "product_category_translation"("product_category_name");

-- AddForeignKey
ALTER TABLE "olist_orders" ADD CONSTRAINT "olist_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "olist_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olist_order_items" ADD CONSTRAINT "olist_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "olist_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olist_order_items" ADD CONSTRAINT "olist_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "olist_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olist_order_items" ADD CONSTRAINT "olist_order_items_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "olist_sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olist_order_payments" ADD CONSTRAINT "olist_order_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "olist_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olist_order_reviews" ADD CONSTRAINT "olist_order_reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "olist_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_tasks" ADD CONSTRAINT "investigation_tasks_investigation_id_fkey" FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_investigation_id_fkey" FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_investigation_id_fkey" FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_tool_execution_id_fkey" FOREIGN KEY ("tool_execution_id") REFERENCES "tool_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "critic_feedback" ADD CONSTRAINT "critic_feedback_investigation_id_fkey" FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "critic_feedback" ADD CONSTRAINT "critic_feedback_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_investigation_id_fkey" FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
