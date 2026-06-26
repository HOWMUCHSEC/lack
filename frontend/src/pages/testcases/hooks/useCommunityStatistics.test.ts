import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { aggregateCategoryCounts } from './useCommunityStatistics'



describe('aggregateCategoryCounts', () => {
  /**
   * Property 3: Category 分布计数正确性
   * **Validates: Requirements 4.1, 4.3**
   *
   * For any random array of label_lv1 values (including nulls),
   * aggregateCategoryCounts groups by label, counts correctly,
   * excludes null entries, and all counts are > 0.
   */
  it('Property 3: Category 分布计数正确性', () => {
    const labelArb = fc.oneof(
      fc.constant(null),
      fc.constantFrom('Hate Speech', 'Violence', 'Self-Harm', 'Sexual Content', 'Misinformation', 'Privacy'),
    )

    fc.assert(
      fc.property(
        fc.array(labelArb, { minLength: 0, maxLength: 200 }),
        (labels) => {
          const result = aggregateCategoryCounts(labels)

          // (a) Each category count matches actual occurrences
          for (const entry of result) {
            const expected = labels.filter((l) => l === entry.label).length
            expect(entry.count).toBe(expected)
          }

          // (b) No null entries in result
          expect(result.every((r) => r.label !== null && r.label !== undefined)).toBe(true)

          // (c) All counts > 0
          expect(result.every((r) => r.count > 0)).toBe(true)

          // Total non-null labels should equal sum of all result counts
          const totalNonNull = labels.filter((l) => l !== null).length
          const totalResult = result.reduce((sum, r) => sum + r.count, 0)
          expect(totalResult).toBe(totalNonNull)
        },
      ),
      { numRuns: 200 },
    )
  })
})
