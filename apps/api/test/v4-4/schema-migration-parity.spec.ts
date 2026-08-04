import { execSync } from 'child_process';
import * as path from 'path';

describe('PR-00 / V4.4: Schema & Migration Parity Contract', () => {
  const scriptPath = path.resolve(__dirname, '../../../scripts/check-schema-migration-parity.js');

  it('should fail when DATABASE_URL is missing or schema drift exists', () => {
    expect(() => {
      execSync(`node "${scriptPath}"`, {
        env: { ...process.env, DATABASE_URL: '' },
        stdio: 'pipe',
      });
    }).toThrow();
  });
});
