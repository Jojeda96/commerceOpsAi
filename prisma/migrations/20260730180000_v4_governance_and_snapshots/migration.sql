-- AlterTable
ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "execution_kind" TEXT NOT NULL DEFAULT 'LLM',
ADD COLUMN IF NOT EXISTS "local_run_id" TEXT;

-- AlterTable
ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "metrics_json" JSONB;

-- AlterTable
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "model_governance_json" JSONB,
ADD COLUMN IF NOT EXISTS "numeric_claims_json" JSONB,
ADD COLUMN IF NOT EXISTS "operational_status" TEXT NOT NULL DEFAULT 'ACTIONABLE';

-- AlterTable
ALTER TABLE "model_predictions" ADD COLUMN IF NOT EXISTS "model_name" TEXT NOT NULL DEFAULT 'xgboost',
ADD COLUMN IF NOT EXISTS "operationally_actionable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "recommendations" ADD COLUMN IF NOT EXISTS "expected_impact_claims_json" JSONB;

-- AlterTable
ALTER TABLE "tool_executions" ADD COLUMN IF NOT EXISTS "local_execution_id" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "delivery_feature_snapshots" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "feature_contract_version" TEXT NOT NULL,
    "prediction_moment" TEXT NOT NULL DEFAULT 'ORDER_PURCHASE',
    "purchase_date" TIMESTAMP(3) NOT NULL,
    "primary_seller_state" TEXT NOT NULL,
    "customer_state" TEXT NOT NULL,
    "primary_category" TEXT NOT NULL,
    "total_price" DOUBLE PRECISION NOT NULL,
    "total_freight" DOUBLE PRECISION NOT NULL,
    "total_weight_g" DOUBLE PRECISION NOT NULL,
    "total_volume_cm3" DOUBLE PRECISION NOT NULL,
    "item_count" INTEGER NOT NULL,
    "seller_count" INTEGER NOT NULL,
    "estimated_delivery_days" DOUBLE PRECISION NOT NULL,
    "shipping_window_days" DOUBLE PRECISION NOT NULL,
    "route_distance_km" DOUBLE PRECISION,
    "purchase_dow" INTEGER NOT NULL,
    "purchase_hour" INTEGER NOT NULL,
    "purchase_month" INTEGER NOT NULL,
    "purchase_week" INTEGER NOT NULL,
    "seller_prior_orders" INTEGER NOT NULL,
    "seller_prior_late_rate_smoothed" DOUBLE PRECISION NOT NULL,
    "route_prior_orders" INTEGER NOT NULL,
    "route_prior_late_rate_smoothed" DOUBLE PRECISION NOT NULL,
    "category_prior_orders" INTEGER NOT NULL,
    "category_prior_late_rate_smoothed" DOUBLE PRECISION NOT NULL,
    "is_delayed" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_feature_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_feature_snapshots_order_id_key" ON "delivery_feature_snapshots"("order_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "delivery_feature_snapshots_purchase_date_idx" ON "delivery_feature_snapshots"("purchase_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "delivery_feature_snapshots_primary_seller_state_customer_st_idx" ON "delivery_feature_snapshots"("primary_seller_state", "customer_state");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "delivery_feature_snapshots_primary_category_idx" ON "delivery_feature_snapshots"("primary_category");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "agent_runs_local_run_id_key" ON "agent_runs"("local_run_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "model_predictions_investigation_id_idx" ON "model_predictions"("investigation_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "model_predictions_finding_id_idx" ON "model_predictions"("finding_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "model_predictions_model_version_idx" ON "model_predictions"("model_version");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tool_executions_local_execution_id_key" ON "tool_executions"("local_execution_id");
