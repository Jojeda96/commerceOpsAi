import { Annotation } from '@langchain/langgraph';
import {
  AgentName,
  FilterState,
  InvestigationTask,
  Finding,
  Evidence,
  Contradiction,
  CriticFeedback,
  Recommendation,
  FinalReport,
  AgentRunTrace,
  ToolExecutionTrace,
} from '@commerce-ops/shared-types';

export const CommerceOpsAnnotation = Annotation.Root({
  investigationId: Annotation<string>(),
  userQuestion: Annotation<string>(),
  filters: Annotation<FilterState>({
    value: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  investigationPlan: Annotation<InvestigationTask[]>({
    value: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  activeAgents: Annotation<AgentName[]>({
    value: (_, next) => next,
    default: () => [],
  }),
  completedAgents: Annotation<AgentName[]>({
    value: (prev, next) => [...new Set([...prev, ...next])],
    default: () => [],
  }),
  agentRunTraces: Annotation<AgentRunTrace[]>({
    value: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  toolExecutionTraces: Annotation<ToolExecutionTrace[]>({
    value: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  findings: Annotation<Finding[]>({
    value: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  evidence: Annotation<Evidence[]>({
    value: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  contradictions: Annotation<Contradiction[]>({
    value: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  criticFeedback: Annotation<CriticFeedback[]>({
    value: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  recommendations: Annotation<Recommendation[]>({
    value: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  finalReport: Annotation<FinalReport | undefined>({
    value: (_, next) => next,
    default: () => undefined,
  }),
  iteration: Annotation<number>({
    value: (_, next) => next,
    default: () => 0,
  }),
  maxIterations: Annotation<number>({
    value: (_, next) => next ?? 3,
    default: () => 3,
  }),
  requiresHumanReview: Annotation<boolean>({
    value: (_, next) => next ?? false,
    default: () => false,
  }),
  criticDecision: Annotation<string>({
    value: (_, next) => next ?? 'PENDING',
    default: () => 'PENDING',
  }),
  criticScore: Annotation<number>({
    value: (_, next) => next ?? 0,
    default: () => 0,
  }),
  requestedAgents: Annotation<AgentName[]>({
    value: (_, next) => next ?? [],
    default: () => [],
  }),
  modelPredictions: Annotation<any[]>({
    value: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

export type CommerceOpsStateType = typeof CommerceOpsAnnotation.State;
