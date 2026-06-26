import { useMemo } from 'react'
import { useUser, type UserPlan } from './use-user'

const PLAN_ORDER: Record<UserPlan, number> = {
  trial: 0,
  pro: 1,
  team: 2,
}

/**
 * 比较两个 plan 等级
 * @returns 负数表示 a < b，0 表示相等，正数表示 a > b
 */
export function comparePlan(a: UserPlan, b: UserPlan): number {
  return PLAN_ORDER[a] - PLAN_ORDER[b]
}

/**
 * 检查当前 plan 是否满足所需 plan
 */
export function canAccessPlan(current: UserPlan, required: UserPlan): boolean {
  return PLAN_ORDER[current] >= PLAN_ORDER[required]
}

/**
 * Plan 权限访问 Hook
 * 提供当前用户 plan 及权限检查方法
 */
export function usePlanAccess() {
  const { user } = useUser()
  const currentPlan = user?.plan ?? 'trial'

  const canAccess = useMemo(
    () => (required: UserPlan) => canAccessPlan(currentPlan, required),
    [currentPlan]
  )

  return {
    plan: currentPlan,
    canAccess,
    isPro: PLAN_ORDER[currentPlan] >= PLAN_ORDER.pro,
    isTeam: currentPlan === 'team',
  }
}
