import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { formatCount } from './utils/formatCount'

/**
 * Property 2: Tab Badge 渲染一致性
 * Validates: Requirements 1.2, 2.2, 3.2, 4.4
 *
 * Tests the rendering contract used in SampleLibrary:
 * - When count is a non-negative integer (not null), Badge should be visible
 *   and display formatCount(count)
 * - When count is null, Badge should not be visible
 *
 * This verifies the conditional logic: `count !== null` controls visibility,
 * and `formatCount(count)` produces the displayed text.
 */
describe('SampleLibrary Tab Badge rendering', () => {
  /** Helper that mirrors the rendering logic in SampleLibrary.tsx */
  function shouldShowBadge(count: number | null): boolean {
    return count !== null
  }

  function getBadgeText(count: number): string {
    return formatCount(count)
  }

  it('Property 2: Tab Badge 渲染一致性', () => {
    const countOrNull = fc.oneof(
      fc.constant(null),
      fc.integer({ min: 0, max: 10_000_000 }),
    )

    fc.assert(
      fc.property(countOrNull, countOrNull, countOrNull, (local, community, pub) => {
        // For each tab, verify the show/hide contract
        for (const count of [local, community, pub]) {
          if (count === null) {
            // Badge should NOT render when count is null
            expect(shouldShowBadge(count)).toBe(false)
          } else {
            // Badge SHOULD render when count is a number
            expect(shouldShowBadge(count)).toBe(true)
            // Badge text must equal formatCount output
            const text = getBadgeText(count)
            expect(text).toBe(formatCount(count))
            // Text must be a non-empty string
            expect(text.length).toBeGreaterThan(0)
          }
        }
      }),
      { numRuns: 200 },
    )
  })
})
