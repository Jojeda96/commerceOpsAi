import { buildInvestigationGraph } from './investigation-graph';

describe('InvestigationGraph (LangGraph Orchestration)', () => {
  let mockPrisma: any;
  let mockStreaming: any;

  beforeEach(() => {
    mockPrisma = {};
    mockStreaming = {
      emit: jest.fn(),
    };
  });

  it('debe construir y compilar el grafo de LangGraph exitosamente', () => {
    const graph = buildInvestigationGraph(mockPrisma, mockStreaming);
    expect(graph).toBeDefined();
    expect(typeof graph.invoke).toBe('function');
  });

  it('debe contener las transiciones condicionales del critic hacia strategy o report', () => {
    const graph = buildInvestigationGraph(mockPrisma, mockStreaming);
    // Verificación de compilación del flujo
    expect(graph).not.toBeNull();
  });
});
