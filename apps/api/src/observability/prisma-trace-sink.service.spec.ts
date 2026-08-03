import { PrismaTraceSinkService } from './prisma-trace-sink.service';

describe('PrismaTraceSinkService', () => {
  let sink: PrismaTraceSinkService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      agentRun: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'db-run-1' }),
        update: jest.fn().mockResolvedValue({ id: 'db-run-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'db-run-1' }),
      },
      toolExecution: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'db-tool-1' }),
        update: jest.fn().mockResolvedValue({ id: 'db-tool-1' }),
      },
    };
    sink = new PrismaTraceSinkService(mockPrisma);
  });

  it('persists agent started immediately', async () => {
    await sink.onAgentStarted({
      localRunId: 'run-1',
      investigationId: 'inv-1',
      agentName: 'SALES',
      iteration: 1,
      startedAt: new Date(),
    });

    expect(mockPrisma.agentRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          localRunId: 'run-1',
        }),
      }),
    );
  });

  it('persists agent failed status on error', async () => {
    mockPrisma.agentRun.findFirst.mockResolvedValueOnce({ id: 'db-run-1' });

    await sink.onAgentFailed({
      localRunId: 'run-1',
      completedAt: new Date(),
      durationMs: 1500,
      errorMessage: 'Network timeout',
    });

    expect(mockPrisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'db-run-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          errorMessage: 'Network timeout',
        }),
      }),
    );
  });
});
