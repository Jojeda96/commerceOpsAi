import * as fs from 'fs';
import * as path from 'path';

describe('Frontend Investigation Detail Page Data Contract (PR-00 / PR-02)', () => {
  it('should not contain hardcoded analytical constants in page.tsx', () => {
    const pagePath = path.join(__dirname, 'page.tsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    const forbiddenLiterals = [
      '61779',
      '5722',
      '96478',
      '7826',
      '26.3',
      '18.2',
      '3.46',
      '5.24',
      'SNAPSHOT_TABLE_EMPTY',
    ];

    const violations: string[] = [];

    for (const literal of forbiddenLiterals) {
      if (content.includes(literal)) {
        violations.push(literal);
      }
    }

    expect(violations).toEqual([]);
  });
});
