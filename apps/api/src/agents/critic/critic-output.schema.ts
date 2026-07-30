import { z } from 'zod';

export const agentNameSchema = z.enum([
  'SUPERVISOR',
  'SALES',
  'LOGISTICS',
  'CUSTOMER_EXPERIENCE',
  'SELLER_PERFORMANCE',
  'ANOMALY',
  'DATA_SCIENCE',
  'STRATEGY',
  'CRITIC',
]);

export const requiredActionSchema = z.object({
  agentName: agentNameSchema,
  actionCode: z.string(),
  description: z.string(),
  findingIds: z.array(z.string()),
});

export const criticOutputSchema = z.object({
  decision: z.enum([
    'APPROVED',
    'APPROVED_WITH_WARNINGS',
    'REQUIRES_MORE_ANALYSIS',
    'REJECTED',
  ]),
  criticScore: z.number().min(0).max(100),
  summary: z.string(),
  requestedAgents: z.array(agentNameSchema),
  requiredActions: z.array(requiredActionSchema),
  feedbackList: z.array(
    z.object({
      findingId: z.string().optional(),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
      message: z.string(),
      requiredAction: z.string().optional(),
    }),
  ),
});

export type CriticOutput = z.infer<typeof criticOutputSchema>;
