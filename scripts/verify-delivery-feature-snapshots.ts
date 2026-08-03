import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main() {
  console.log(' verifying delivery_feature_snapshots table readiness...');

  if (!process.env.DATABASE_URL) {
    console.warn('⚠️ DATABASE_URL environment variable is not defined.');
    console.warn('Reason code: DATABASE_URL_MISSING');
    process.exit(0);
  }

  const prisma = new PrismaClient();

  try {
    const checkTable: any[] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'delivery_feature_snapshots'
      ) as "exists";
    `;

    const exists = Boolean(checkTable[0]?.exists);
    if (!exists) {
      console.warn('⚠️ Table delivery_feature_snapshots does NOT exist.');
      console.warn('Reason code: SNAPSHOT_TABLE_MISSING');
      process.exit(0);
    }

    const countRes: any[] = await prisma.$queryRaw`
      SELECT COUNT(*)::int as total FROM delivery_feature_snapshots;
    `;
    const total = Number(countRes[0]?.total || 0);

    console.log(`✅ Table delivery_feature_snapshots exists. Total rows: ${total}`);
    if (total === 0) {
      console.warn('⚠️ Table is empty. Reason code: SNAPSHOT_TABLE_EMPTY');
    }
  } catch (err) {
    console.error('❌ Error checking delivery_feature_snapshots:', err);
    process.exit(0);
  } finally {
    await prisma.$disconnect();
  }
}

main();
