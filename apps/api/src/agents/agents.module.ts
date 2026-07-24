import { Module } from '@nestjs/common';
import { InvestigationOrchestratorService } from './orchestrator/investigation-orchestrator.service';

@Module({
  providers: [InvestigationOrchestratorService],
  exports: [InvestigationOrchestratorService],
})
export class AgentsModule {}
