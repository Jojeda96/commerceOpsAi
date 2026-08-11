import * as path from 'node:path';
import * as fs from 'node:fs';

describe('Test 8.10 - No personal credentials in source files', () => {
  it('should not contain jose:jose123 or hardcoded postgresql credentials in test source code', () => {
    const patterns = ['jose' + ':jose123', 'postgresql://' + 'jose'];
    const srcDir = path.resolve(__dirname, '../../src');
    const testDir = path.resolve(__dirname, '..');
    const selfPath = path.normalize(__filename);

    const violations: string[] = [];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (
          entry.name.endsWith('.ts') &&
          path.normalize(fullPath) !== selfPath
        ) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          for (const pattern of patterns) {
            if (content.includes(pattern)) {
              violations.push(
                `${fullPath} contains forbidden pattern: "${pattern}"`,
              );
            }
          }
        }
      }
    }

    scanDir(srcDir);
    scanDir(testDir);

    expect(violations).toHaveLength(0);
  });
});
