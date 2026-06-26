import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { formatCount } from './formatCount'

describe('formatCount', () => {
  /**
   * Property 3: formatCount 格式化正确性
   * Validates: Requirements 4.1, 4.2, 4.3
   *
   * For any non-negative integer n:
   * - If n < 1000, formatCount(n) === n.toString()
   * - If n >= 1000, formatCount(n) matches /^\d+(\.\d)?k$/ and the parsed value is within 100 of n
   */
  it('Property 3: formatCount 格式化正确性', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000 }), (n) => {
        const result = formatCount(n)

        if (n < 1000) {
          expect(result).toBe(n.toString())
        } else {
          // Must match pattern like "1k", "1.2k", "12.3k"
          expect(result).toMatch(/^\d+(\.\d)?k$/)

          // Parse back and check precision within 100
          const numeric = parseFloat(result.replace('k', '')) * 1000
          expect(Math.abs(numeric - n)).toBeLessThanOrEqual(100)
        }
      }),
      { numRuns: 200 },
    )
  })
})
