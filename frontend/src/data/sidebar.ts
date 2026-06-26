import {
  WaveformIcon,
  CommandIcon,
  FolderUserIcon,
  LayoutIcon,
  TestTubeIcon,
  SparkleIcon,
  ShieldCheckIcon,
  CheckSquareIcon,
  DatabaseIcon,
  Icon,
} from '@phosphor-icons/react'

// 团队列表
export const teams = [
  {
    name: 'Lack',
    logo: WaveformIcon,
    url: 'https://github.com/',
  },
  {
    name: '文档',
    logo: CommandIcon,
    url: 'https://github.com',
  },
]

// 主导航菜单 - 使用 i18n 键
export const navMain = [
  {
    titleKey: 'nav:dashboard',
    url: '/dashboard',
    icon: LayoutIcon,
    iconClassName: 'text-sky-500',
    isActive: true,
  },
  {
    titleKey: 'nav:securityScan',
    url: '/security/mcp',
    icon: ShieldCheckIcon,
    iconClassName: 'text-rose-500',
    items: [
      {
        titleKey: 'nav:mcpScan',
        url: '/security/mcp',
      },
      {
        titleKey: 'nav:aiInfrastructure',
        url: '/security/ai-infrastructure',
      },
      {
        titleKey: 'nav:aiCloudSecurity',
        url: '/security/ai-cloud',
      },
    ],
  },
  {
    titleKey: 'nav:workPlanning',
    url: '/projects',
    icon: FolderUserIcon,
    iconClassName: 'text-amber-500',
    items: [
      {
        titleKey: 'nav:allProjects',
        url: '/projects',
      },
      {
        titleKey: 'nav:allObjectives',
        url: '/objectives',
      },
      {
        titleKey: 'nav:projectTemplates',
        url: '/projects/templates',
      },
      {
        titleKey: 'nav:objectiveTemplates',
        url: '/objectives/templates',
      },
    ],
  },
  {
    titleKey: 'nav:dataSamples',
    url: '/data',
    icon: DatabaseIcon,
    iconClassName: 'text-blue-500',
    items: [
      {
        titleKey: 'nav:dataManagement',
        url: '/data/samples',
      },
      {
        titleKey: 'nav:realtimeGeneration',
        url: '/data/generation',
        items: [
          {
            titleKey: 'nav:generalText',
            url: '/data/generation/text',
          },
          {
            titleKey: 'nav:advancedTools',
            url: '/data/generation/tools',
          },
        ],
      },
    ],
  },
  {
    titleKey: 'nav:modelEvaluation',
    url: '/tasks',
    icon: CheckSquareIcon,
    iconClassName: 'text-green-500',
    items: [
      {
        titleKey: 'nav:taskList',
        url: '/tasks',
      },
      {
        titleKey: 'nav:evaluationReports',
        url: '/tasks/reports',
      },
    ],
  },
  {
    titleKey: 'nav:testManagement',
    url: '/testcases',
    icon: TestTubeIcon,
    iconClassName: 'text-violet-500',
    items: [
      {
        titleKey: 'nav:testCases',
        url: '/testcases',
      },
      {
        titleKey: 'nav:variableManagement',
        url: '/testcases/variables',
      },
    ],
  },
  {
    titleKey: 'nav:researchCenter',
    url: '/research',
    icon: SparkleIcon,
    iconClassName: 'text-emerald-400',
    items: [
      {
        titleKey: 'nav:paperInsights',
        url: '/research/papers',
        dot: true,
        dotColor: 'green',
      },
      {
        titleKey: 'nav:infoAggregation',
        url: '/research/aggregation',
      },
    ],
  },
]

// 项目列表（改为帮助链接）- 使用 i18n 键
export const projects: Project[] = []

// 类型定义
export type Team = {
  name: string
  logo: Icon
  url: string
}

export type NavItem = {
  title: string
  url: string
  icon: Icon
  isActive?: boolean
  items?: {
    title: string
    url: string
    dot?: boolean
    dotColor?: string
    items?: {
      title: string
      url: string
    }[]
  }[]
  iconClassName?: string
}

export type Project = {
  nameKey: string
  url: string
  icon: Icon
}
