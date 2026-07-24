import { StateGraph, END, Send } from '@langchain/langgraph';
import { CommerceOpsAnnotation, CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { createSupervisorNode } from '../supervisor/supervisor.node';
import { createSalesNode } from '../sales/sales.node';
import { createLogisticsNode } from '../logistics/logistics.node';
import { createCustomerExperienceNode } from '../customer-experience/cx.node';
import { createSellerPerformanceNode } from '../seller-performance/seller.node';
import { createAnomalyNode } from '../anomaly/anomaly.node';
import { createDataScienceNode } from '../data-science/ds.node';
import { createCriticNode } from '../critic/critic.node';
import { createStrategyNode } from '../strategy/strategy.node';
import { createReportNode } from './report.node';

export function buildInvestigationGraph(prisma: PrismaService, streaming: StreamingService) {
  const supervisorNode = createSupervisorNode(prisma, streaming);
  const salesNode = createSalesNode(prisma, streaming);
  const logisticsNode = createLogisticsNode(prisma, streaming);
  const cxNode = createCustomerExperienceNode(prisma, streaming);
  const sellerNode = createSellerPerformanceNode(prisma, streaming);
  const anomalyNode = createAnomalyNode(prisma, streaming);
  const dsNode = createDataScienceNode(streaming);
  const criticNode = createCriticNode(streaming);
  const strategyNode = createStrategyNode(streaming);
  const reportNode = createReportNode(streaming);

  const workflow = new StateGraph(CommerceOpsAnnotation)
    .addNode('supervisor', supervisorNode)
    .addNode('sales_agent', salesNode)
    .addNode('logistics_agent', logisticsNode)
    .addNode('cx_agent', cxNode)
    .addNode('seller_agent', sellerNode)
    .addNode('anomaly_agent', anomalyNode)
    .addNode('ds_agent', dsNode)
    .addNode('critic', criticNode)
    .addNode('strategy', strategyNode)
    .addNode('generate_report', reportNode)

    .addEdge('__start__', 'supervisor')

    // Fan-out: Enviar a TODOS los agentes seleccionados en paralelo usando Send()
    .addConditionalEdges('supervisor', (state: CommerceOpsStateType) => {
      const active = state.activeAgents || [];
      const agentNodeMap: Record<string, string> = {
        SALES: 'sales_agent',
        LOGISTICS: 'logistics_agent',
        CUSTOMER_EXPERIENCE: 'cx_agent',
        SELLER_PERFORMANCE: 'seller_agent',
        ANOMALY: 'anomaly_agent',
        DATA_SCIENCE: 'ds_agent',
      };

      const sends: Send[] = [];
      for (const agent of active) {
        const nodeName = agentNodeMap[agent];
        if (nodeName) {
          sends.push(new Send(nodeName, state));
        }
      }

      // Fallback: si no hay agentes seleccionados, enviar a logistics
      if (sends.length === 0) {
        sends.push(new Send('logistics_agent', state));
      }

      return sends;
    })

    // Todos los agentes especialistas convergen en el critic
    .addEdge('sales_agent', 'critic')
    .addEdge('logistics_agent', 'critic')
    .addEdge('cx_agent', 'critic')
    .addEdge('seller_agent', 'critic')
    .addEdge('anomaly_agent', 'critic')
    .addEdge('ds_agent', 'critic')

    .addConditionalEdges('critic', (state: CommerceOpsStateType) => {
      const lastFeedback = state.criticFeedback[state.criticFeedback.length - 1];
      if (lastFeedback?.severity === 'HIGH' && state.iteration < state.maxIterations) {
        return 'supervisor';
      }
      return 'strategy';
    })
    .addEdge('strategy', 'generate_report')
    .addEdge('generate_report', END);

  return workflow.compile();
}
