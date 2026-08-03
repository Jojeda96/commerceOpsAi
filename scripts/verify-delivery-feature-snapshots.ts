import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main() {
  console.log('🔍 Verifying delivery_feature_snapshots table readiness...');

  const isStrict = process.env.SNAPSHOT_VERIFY_STRICT !== 'false';
  const expectation = process.env.SNAPSHOT_EXPECTATION || 'EMPTY_ALLOWED';

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not defined.');
    console.error('Reason code: DATABASE_URL_MISSING');
    if (isStrict) process.exit(1);
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
      console.error('❌ Table delivery_feature_snapshots does NOT exist.');
      console.error('Reason code: SNAPSHOT_TABLE_MISSING');
      if (isStrict) process.exit(1);
      process.exit(0);
    }

    const countRes: any[] = await prisma.$queryRaw`
      SELECT COUNT(*)::int as total FROM delivery_feature_snapshots;
    `;
    const total = Number(countRes[0]?.total || 0);

    console.log(`✅ Table delivery_feature_snapshots exists. Total rows: ${total}`);
    if (total === 0) {
      console.warn('⚠️ Table is empty. Reason code: SNAPSHOT_TABLE_EMPTY');
      if (expectation === 'POPULATED_REQUIRED') {
        console.error('❌ Populated snapshots required but table is empty.');
        if (isStrict) process.exit(1);
      }
    }
  } catch (err) {
    console.error('❌ Error checking delivery_feature_snapshots:', err);
    if (isStrict) process.exit(1);
    process.exit(0);
  } finally {
    await prisma.$disconnect();
  }
}

main();
