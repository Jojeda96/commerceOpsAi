import { execSync } from 'child_process';

describe('PR-00 / V4.4: Schema & Migration Parity Contract', () => {
  it('should fail when DATABASE_URL is missing or schema drift exists', () => {
    expect(() => {
      execSync('node scripts/check-schema-migration-parity.js', {
        env: { ...process.env, DATABASE_URL: '' },
        stdio: 'pipe',
      });
    }).toThrow();
  });
});
