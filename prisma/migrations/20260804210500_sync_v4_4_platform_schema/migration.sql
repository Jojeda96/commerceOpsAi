-- AlterTable
ALTER TABLE "agent_runs" ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "iteration" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "critic_feedback" ADD COLUMN     "iteration" INTEGER,
ADD COLUMN     "requested_agents_json" JSONB,
ADD COLUMN     "required_actions_json" JSONB;

-- AlterTable
ALTER TABLE "evidence" ADD COLUMN     "agent_name" TEXT,
ADD COLUMN     "applied_scope_json" JSONB,
ADD COLUMN     "iteration" INTEGER,
ADD COLUMN     "reason_code" TEXT,
ADD COLUMN     "scope_hash" TEXT,
ADD COLUMN     "status" TEXT;

-- AlterTable
ALTER TABLE "findings" ADD COLUMN     "audit_rationale_json" JSONB,
ADD COLUMN     "audit_status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "confidence_kind" TEXT,
ADD COLUMN     "confidence_rationale" JSONB,
ADD COLUMN     "evidence_quality_json" JSONB,
ADD COLUMN     "finding_key" TEXT,
ADD COLUMN     "iteration" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "method_claims_json" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "supersedes_finding_id" TEXT,
ALTER COLUMN "confidence" DROP NOT NULL;

-- AlterTable
ALTER TABLE "investigations" ADD COLUMN     "resolved_scope_json" JSONB,
ADD COLUMN     "termination_reason" TEXT;

-- AlterTable
ALTER TABLE "model_predictions" ALTER COLUMN "probability" SET NOT NULL,
ALTER COLUMN "investigation_id" DROP DEFAULT,
ALTER COLUMN "scenario_id" DROP DEFAULT,
ALTER COLUMN "deployment_status" DROP DEFAULT,
ALTER COLUMN "threshold" DROP DEFAULT,
ALTER COLUMN "predicted_delayed" DROP DEFAULT,
ALTER COLUMN "risk_level" DROP DEFAULT;

-- AlterTable
ALTER TABLE "recommendations" ADD COLUMN     "evidence_basis_json" JSONB,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'HYPOTHESIS_TO_TEST',
ADD COLUMN     "validation_requirements_json" JSONB;

-- AlterTable
ALTER TABLE "tool_executions" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "result_status" TEXT,
ADD COLUMN     "scope_hash" TEXT,
ADD COLUMN     "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
ALTER TABLE "model_predictions" ADD CONSTRAINT "model_predictions_investigation_id_fkey" FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_predictions" ADD CONSTRAINT "model_predictions_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
