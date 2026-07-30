import { Annotation } from '@langchain/langgraph';
import {
  AgentName,
  AnalysisScope,
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
import { createEmptyScope } from '../scope/analysis-scope.resolver';

export const CommerceOpsAnnotation = Annotation.Root({
  investigationId: Annotation<string>(),
  userQuestion: Annotation<string>(),
  analysisScope: Annotation<AnalysisScope>({
    value: (_, next) => next,
    default: () => createEmptyScope(),
  }),
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
    value: (prev, next) => {
      const merged = [...prev];
      for (const item of next) {
        const itemKey = (item as any).findingKey || `${item.agent || (item as any).agentName}:${item.title}`;
        for (let i = 0; i < merged.length; i++) {
          const existingKey = (merged[i] as any).findingKey || `${merged[i].agent || (merged[i] as any).agentName}:${merged[i].title}`;
          if (existingKey === itemKey && merged[i].status !== 'SUPERSEDED') {
            merged[i] = {
              ...merged[i],
              status: 'SUPERSEDED',
            };
            (item as any).supersedesFindingId = merged[i].id;
          }
        }
        merged.push({
          ...item,
          status: item.status || 'ACTIVE',
        });
      }
      return merged;
    },
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
