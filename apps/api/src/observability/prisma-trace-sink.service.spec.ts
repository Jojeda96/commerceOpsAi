import { PrismaTraceSinkService } from './prisma-trace-sink.service';

describe('PrismaTraceSinkService', () => {
  let sink: PrismaTraceSinkService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      agentRun: {
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ id: 'db-run-1' }),
      },
      toolExecution: {
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
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

    expect(mockPrisma.agentRun.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { localRunId: 'run-1' },
      }),
    );
  });

  it('persists agent failed status on error', async () => {
    await sink.onAgentFailed({
      localRunId: 'run-1',
      completedAt: new Date(),
      durationMs: 1500,
      errorMessage: 'Network timeout',
    });

    expect(mockPrisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { localRunId: 'run-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          errorMessage: 'Network timeout',
        }),
      }),
    );
  });
});
