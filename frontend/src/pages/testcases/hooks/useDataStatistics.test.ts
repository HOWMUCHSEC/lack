import { describe, it, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'

// Mock DB.CountPrefix before importing the module under test
vi.mock('../../../../wailsjs/go/main/DB', () => ({
  CountPrefix: vi.fn(),
}))

// Mock supabase client with controllable from().select() chain
const mockFrom = vi.fn()
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => (mockFrom as (...a: unknown[]) => unknown)(...args),
  },
}))

import { fetchLocalCount, fetchCommunityCount, COMMUNITY_VENDOR_TABLES } from './useDataStatistics'
import * as DB from '../../../../wailsjs/go/main/DB'

const mockedCountPrefix = vi.mocked(DB.CountPrefix)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchLocalCount', () => {
  /**
   * Property 1: 本地计数聚合正确性
   * Validates: Requirements 1.1
   *
   * For any three non-negative integers a, b, c (representing counts for
   * sampleset:, hfdataset:, prompts: prefixes), fetchLocalCount returns a + b + c.
   */
  it('Property 1: 本地计数聚合正确性', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        async (a, b, c) => {
          mockedCountPrefix.mockReset()
          mockedCountPrefix
            .mockResolvedValueOnce(a)  // sampleset:
            .mockResolvedValueOnce(b)  // hfdataset:
            .mockResolvedValueOnce(c)  // prompts:

          const result = await fetchLocalCount()
          expect(result).toBe(a + b + c)
        },
      ),
      { numRuns: 200 },
    )
  })
})


describe('fetchCommunityCount', () => {
  /**
   * Property 1: 社区总数聚合正确性（含部分失败）
   * **Validates: Requirements 1.1, 1.3, 1.4**
   *
   * For any 5 non-negative integers and a random failure mask,
   * fetchCommunityCount returns the sum of counts for successful tables.
   * When all tables fail, it throws an error.
   */
  it('Property 1: 社区总数聚合正确性', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 5, maxLength: 5 }),
        fc.array(fc.boolean(), { minLength: 5, maxLength: 5 }),
        async (counts, failMask) => {
          mockFrom.mockReset()

          // Track call index to return the right value per table
          let callIndex = 0
          mockFrom.mockImplementation(() => ({
            select: () => {
              const i = callIndex++
              const shouldFail = failMask[i]
              if (shouldFail) {
                return Promise.resolve({ count: null, error: { message: 'fail' } })
              }
              return Promise.resolve({ count: counts[i], error: null })
            },
          }))

          const allFailed = failMask.every(Boolean)
          if (allFailed) {
            await expect(fetchCommunityCount()).rejects.toThrow('All vendor table count queries failed')
          } else {
            const expected = counts.reduce((sum, c, i) => sum + (failMask[i] ? 0 : c), 0)
            const result = await fetchCommunityCount()
            expect(result).toBe(expected)
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  it('COMMUNITY_VENDOR_TABLES does not include prompts_combined', () => {
    expect(COMMUNITY_VENDOR_TABLES).not.toContain('prompts_combined')
    expect(COMMUNITY_VENDOR_TABLES).toHaveLength(5)
  })
})
