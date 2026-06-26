import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { GlobalLoadingProvider } from '@/components/app-loading-overlay'
import { UserProvider } from '@/hooks/use-user'
import { DetailsSheetProvider } from '@/components/details/DetailsSheetProvider'
import { useDeviceGate } from '@/hooks/use-device-gate'
import IllegalTerminalOverlay from '@/components/IllegalTerminalDialog'
import { MainLayout } from '@/components/layout'
import { PageSkeleton } from '@/components/ui/page-skeleton'

// 登录页同步加载，其他页面懒加载
import LoginPage from '@/pages/Login'

const DashboardPage = lazy(() => import('@/pages/Dashboard'))

// 项目管理
const AllProjectsPage = lazy(() => import('@/pages/projects/AllProjects'))
const ProjectTemplatesPage = lazy(() => import('@/pages/projects/ProjectTemplates'))

// 目标管理
const AllObjectivesPage = lazy(() => import('@/pages/objectives/AllObjectives'))
const ObjectiveTemplatesPage = lazy(() => import('@/pages/objectives/ObjectiveTemplates'))

// 任务中心
const TaskCenterPage = lazy(() => import('@/pages/tasks/TaskCenter'))
const TaskDetailsPage = lazy(() => import('@/pages/tasks/TaskDetails'))
const ReportListPage = lazy(() => import('@/pages/tasks/ReportList'))
const EvaluationReportPage = lazy(() => import('@/pages/tasks/EvaluationReport'))

// 测试执行
const RealTimeMonitorPage = lazy(() => import('@/pages/execution/RealTimeMonitor'))

// 测试用例库
const TestCaseLibraryPage = lazy(() => import('@/pages/testcases/TestCaseLibrary'))
const SetsStorePage = lazy(() => import('@/pages/testcases/SetsStore'))
const LocalSetsPage = lazy(() => import('@/pages/testcases/LocalSets'))
const VariablesManagerPage = lazy(() => import('@/pages/testcases/VariablesManager'))
const SampleLibraryPage = lazy(() => import('@/pages/testcases/SampleLibrary'))

// 数据生成
const GeneralTextPage = lazy(() => import('@/pages/data/GeneralText'))
const AdvancedToolsPage = lazy(() => import('@/pages/data/AdvancedTools'))

// 安全扫描
const MCPScanPage = lazy(() => import('@/pages/security/MCPScan'))
const MCPReportDetailsPage = lazy(() => import('@/pages/security/MCPReportDetails'))
const MCPSessionDetailsPage = lazy(() => import('@/pages/security/MCPSessionDetails'))
const AIInfrastructurePage = lazy(() => import('@/pages/security/AIInfrastructure'))
const AICloudSecurityPage = lazy(() => import('@/pages/security/AICloudSecurity'))

// 研究中心
const PaperInsightsPage = lazy(() => import('@/pages/research/PaperInsights'))
const PaperDetailsPage = lazy(() => import('@/pages/research/PaperDetails'))
const InformationAggregationPage = lazy(() => import('@/pages/research/InformationAggregation'))

// 帮助和设置
const AccountSettingsPage = lazy(() => import('@/pages/AccountSettings'))
const NotFoundPage = lazy(() => import('@/pages/NotFound'))

export default function App() {
  const { checking, allowed, hasUser, localMacs, recheck } = useDeviceGate()

  if (hasUser && !checking && !allowed) {
    return <IllegalTerminalOverlay visible={true} localMacs={localMacs} onRetry={recheck} />
  }
  return (
    <UserProvider>
      <GlobalLoadingProvider>
        <DetailsSheetProvider>
          <Routes>
            {/* 登录页无侧边栏 */}
            <Route path="/" element={<LoginPage />} />

            {/* 主布局：侧边栏固定，内容区域懒加载 */}
            <Route element={
              <Suspense fallback={<PageSkeleton />}>
                <MainLayout />
              </Suspense>
            }>
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* 项目管理 */}
              <Route path="/projects" element={<AllProjectsPage />} />
              <Route path="/projects/templates" element={<ProjectTemplatesPage />} />

              {/* 目标管理 */}
              <Route path="/objectives" element={<AllObjectivesPage />} />
              <Route path="/objectives/templates" element={<ObjectiveTemplatesPage />} />

              {/* 任务中心 */}
              <Route path="/tasks" element={<TaskCenterPage />} />
              <Route path="/tasks/reports" element={<ReportListPage />} />
              <Route path="/tasks/reports/:id" element={<EvaluationReportPage />} />
              <Route path="/tasks/:id" element={<TaskDetailsPage />} />

              {/* 测试执行 */}
              <Route path="/execution/monitor" element={<RealTimeMonitorPage />} />

              {/* 测试用例库 */}
              <Route path="/testcases" element={<TestCaseLibraryPage />} />
              <Route path="/testcases/sets" element={<SetsStorePage />} />
              <Route path="/testcases/local-sets" element={<LocalSetsPage />} />
              <Route path="/testcases/variables" element={<VariablesManagerPage />} />
              <Route path="/data/samples" element={<SampleLibraryPage />} />
              <Route path="/data/generation/text" element={<GeneralTextPage />} />
              <Route path="/data/generation/tools" element={<AdvancedToolsPage />} />
              <Route path="/security/mcp" element={<MCPScanPage />} />
              <Route path="/security/mcp/reports/:id" element={<MCPReportDetailsPage />} />
              <Route path="/security/mcp/session/:id" element={<MCPSessionDetailsPage />} />
              <Route path="/security/ai-infrastructure" element={<AIInfrastructurePage />} />
              <Route path="/security/ai-cloud" element={<AICloudSecurityPage />} />
              <Route path="/research/papers/:id" element={<PaperDetailsPage />} />
              <Route path="/research/papers" element={<PaperInsightsPage />} />
              <Route path="/research/aggregation" element={<InformationAggregationPage />} />

              {/* 帮助和设置 */}
              <Route path="/account" element={<AccountSettingsPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </DetailsSheetProvider>
      </GlobalLoadingProvider>
    </UserProvider>
  )
}
