import { describe, expect, it } from 'vitest';
import { currentStatementAnchor, daysRemainingInPeriod, statementPeriod } from './date';

describe('statement periods', () => {
  it('starts the day after the previous close and includes the closing day', () => {
    expect(statementPeriod('2026-06', 15, 'p1')).toMatchObject({
      start: '2026-05-16',
      end: '2026-06-15'
    });
  });

  it('clamps day 31 across short and leap-year months without gaps', () => {
    expect(statementPeriod('2024-02', 31, 'p1')).toMatchObject({
      start: '2024-02-01',
      end: '2024-02-29'
    });
    expect(statementPeriod('2026-03', 31, 'p1')).toMatchObject({
      start: '2026-03-01',
      end: '2026-03-31'
    });
  });

  it('selects the cycle that contains today and counts remaining days inclusively', () => {
    expect(currentStatementAnchor(15, new Date('2026-06-16T12:00:00'))).toBe('2026-07');
    expect(daysRemainingInPeriod('2026-06-16', '2026-07-15', new Date('2026-07-15T12:00:00'))).toBe(1);
  });
});
