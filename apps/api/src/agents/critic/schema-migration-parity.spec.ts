import { execSync } from 'child_process';
import * as path from 'path';

describe('PR-06: Schema & Migration Parity Contract', () => {
  const scriptPath = path.resolve(
    __dirname,
    '../../../../../scripts/check-schema-migration-parity.js',
  );

  it('should fail when DATABASE_URL is missing or empty', () => {
    expect(() => {
      execSync(`node "${scriptPath}"`, {
        env: { ...process.env, DATABASE_URL: '' },
        stdio: 'pipe',
      });
    }).toThrow();
  });

  it('should pass schema parity check when run against migrated database', () => {
    const dbUrl =
      process.env.DATABASE_URL ||
      'postgresql://jose:jose123@localhost:5434/commerce_ops_clean_verify?schema=public';

    const output = execSync(`node "${scriptPath}"`, {
      env: { ...process.env, DATABASE_URL: dbUrl },
      encoding: 'utf-8',
    });

    expect(output).toContain('PASS: 0 schema drift detected.');
  });
});
