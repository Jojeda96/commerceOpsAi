import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { StreamingModule } from './streaming/streaming.module';
import { InvestigationsModule } from './investigations/investigations.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SimulationModule } from './simulation/simulation.module';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    DatabaseModule,
    StreamingModule,
    InvestigationsModule,
    AnalyticsModule,
    SimulationModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
