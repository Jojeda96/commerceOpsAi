import { Prisma } from '@prisma/client';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StreamingService } from '../streaming/streaming.service';
import { InvestigationOrchestratorService } from '../agents/orchestrator/investigation-orchestrator.service';
import { CreateInvestigationDto } from './dto/create-investigation.dto';

@Injectable()
export class InvestigationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly streaming: StreamingService,
    private readonly orchestrator: InvestigationOrchestratorService,
  ) {}

  async create(dto: CreateInvestigationDto) {
    const investigation = await this.prisma.investigation.create({
      data: {
        title:
          dto.question.substring(0, 80) +
          (dto.question.length > 80 ? '...' : ''),
        question: dto.question,
        status: 'PENDING',
        dateFrom: dto.dateFrom ? new Date(dto.dateFrom) : null,
        dateTo: dto.dateTo ? new Date(dto.dateTo) : null,
        sellerIdsJson: dto.sellerIds ? (dto.sellerIds as any) : Prisma.DbNull,
        categoriesJson: dto.categories
          ? (dto.categories as any)
          : Prisma.DbNull,
        customerStatesJson: dto.customerStates
          ? (dto.customerStates as any)
          : Prisma.DbNull,
      },
    });

    this.streaming.emit(investigation.id, 'investigation.queued', {
      investigationId: investigation.id,
      question: investigation.question,
    });

    return investigation;
  }

  async run(id: string) {
    const claimed = await this.prisma.investigation.updateMany({
      where: {
        id,
        status: { in: ['PENDING', 'FAILED'] },
      },
      data: {
        status: 'QUEUED',
      },
    });

    if (claimed.count === 0) {
      throw new BadRequestException(
        `La investigación ${id} no se puede ejecutar (no está en estado PENDING/FAILED o ya fue reclamada).`,
      );
    }

    // Disparar en segundo plano
    setImmediate(() => {
      this.orchestrator.executeInvestigation(id).catch((err: any) => {
        console.error(
          `Error en orchestrator para la investigación ${id}:`,
          err,
        );
      });
    });

    return {
      message: 'Workflow multiagente iniciado exitosamente.',
      investigationId: id,
      status: 'QUEUED',
    };
  }

  async findAll(page = 1, limit = 10, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [items, total] = await Promise.all([
      this.prisma.investigation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tasks: true,
          findings: true,
          recommendations: true,
        },
      }),
      this.prisma.investigation.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const investigation = await this.prisma.investigation.findUnique({
      where: { id },
      include: {
        tasks: { orderBy: { startedAt: 'asc' } },
        agentRuns: {
          include: {
            toolExecutions: true,
          },
          orderBy: { startedAt: 'asc' },
        },
        findings: {
          include: {
            evidence: {
              include: {
                evidence: true,
              },
            },
          },
        },
        criticFeedback: true,
        recommendations: true,
      },
    });

    if (!investigation) {
      throw new NotFoundException(`Investigación con ID ${id} no encontrada`);
    }

    const formattedFindings = investigation.findings.map((f: any) => ({
      ...f,
      methodClaims: f.methodClaimsJson || undefined,
      auditMessages: f.auditRationaleJson || undefined,
      evidenceQuality: f.evidenceQualityJson || undefined,
      numericClaims: f.numericClaimsJson || undefined,
      modelGovernance: f.modelGovernanceJson || undefined,
    }));

    const formattedRecommendations = investigation.recommendations.map(
      (r: any) => ({
        ...r,
        kind: r.kind || 'HYPOTHESIS_TO_TEST',
        evidenceBasis: r.evidenceBasisJson || undefined,
        validationRequirements: r.validationRequirementsJson || undefined,
        expectedImpactClaims: r.expectedImpactClaimsJson || undefined,
      }),
    );

    return {
      ...investigation,
      findings: formattedFindings,
      recommendations: formattedRecommendations,
    };
  }

  async getFindings(id: string) {
    await this.findOne(id);
    return this.prisma.finding.findMany({
      where: { investigationId: id },
      include: {
        evidence: {
          include: {
            evidence: true,
          },
        },
      },
    });
  }

  async getAgentRuns(id: string) {
    await this.findOne(id);
    return this.prisma.agentRun.findMany({
      where: { investigationId: id },
      include: {
        toolExecutions: true,
      },
      orderBy: { startedAt: 'asc' },
    });
  }

  async getReport(id: string) {
    const investigation = await this.findOne(id);
    if (
      investigation.status !== 'COMPLETED' &&
      investigation.status !== 'COMPLETED_WITH_WARNINGS'
    ) {
      throw new BadRequestException(
        `La investigación ${id} no está lista para generar reporte (status actual: ${investigation.status})`,
      );
    }

    return {
      investigationId: investigation.id,
      title: investigation.title,
      question: investigation.question,
      status: investigation.status,
      qualityScore: investigation.finalQualityScore,
      iterationCount: investigation.iterationCount,
      completedAt: investigation.completedAt,
      findings: investigation.findings,
      recommendations: investigation.recommendations,
      criticFeedback: investigation.criticFeedback,
    };
  }
}
