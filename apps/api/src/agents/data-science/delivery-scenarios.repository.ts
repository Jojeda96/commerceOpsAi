import { PrismaClient } from '@prisma/client';
import {
  DeliveryFeatureSnapshotsRepository,
  ScenarioSnapshotRow,
  FeatureSnapshotFilters,
} from './delivery-feature-snapshots.repository';

export type DeliveryScenarioRow = ScenarioSnapshotRow;

export type GetScenariosOptions = FeatureSnapshotFilters;

export class DeliveryScenariosRepository {
  private readonly snapshotRepo: DeliveryFeatureSnapshotsRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.snapshotRepo = new DeliveryFeatureSnapshotsRepository(prisma);
  }

  async getScenarios(
    options: GetScenariosOptions = {},
  ): Promise<DeliveryScenarioRow[]> {
    return this.snapshotRepo.findSnapshots(options);
  }
}
