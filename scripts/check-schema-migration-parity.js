const { execSync } = require('child_process');
const path = require('path');

function checkSchemaMigrationParity() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
  console.log('Checking database schema vs prisma/schema.prisma parity...');

  try {
    const output = execSync(
      `npx prisma migrate diff --from-url "${databaseUrl}" --to-schema-datamodel "${schemaPath}" --exit-code`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    );

    console.log('PASS: 0 schema drift detected.');
    process.exit(0);
  } catch (error) {
    console.error('FAIL: Schema drift detected between applied migrations and prisma/schema.prisma!');
    if (error.stdout) {
      console.error('\n--- Pending Drift SQL Diff ---');
      console.error(error.stdout);
    }
    if (error.stderr) {
      console.error(error.stderr);
    }
    process.exit(error.status || 1);
  }
}

checkSchemaMigrationParity();
