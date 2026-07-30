import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaTraceSinkService } from './prisma-trace-sink.service';
import { setGlobalTraceSink } from './trace-context';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [PrismaTraceSinkService],
  exports: [PrismaTraceSinkService],
})
export class ObservabilityModule implements OnModuleInit {
  constructor(private readonly prismaTraceSink: PrismaTraceSinkService) {}

  onModuleInit() {
    setGlobalTraceSink(this.prismaTraceSink);
  }
}
