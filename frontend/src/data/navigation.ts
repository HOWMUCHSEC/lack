import {
  BarChartIcon,
  CameraIcon,
  ClipboardListIcon,
  DatabaseIcon,
  FileCodeIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  ListIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react'

export const sidebarUser = {
  name: '用户',
  email: 'm@example.com',
  avatar: '/avatars/shadcn.jpg',
}

export const navMain = [
  {
    title: '控制台',
    url: '#',
    icon: LayoutDashboardIcon,
  },
  {
    title: '生命周期',
    url: '#',
    icon: ListIcon,
  },
  {
    title: '分析',
    url: '#',
    icon: BarChartIcon,
  },
  {
    title: '项目',
    url: '#',
    icon: FolderIcon,
  },
  {
    title: '团队',
    url: '#',
    icon: UsersIcon,
  },
]

export const navClouds = [
  {
    title: '采集',
    icon: CameraIcon,
    isActive: true,
    url: '#',
    items: [
      {
        title: '进行中的提案',
        url: '#',
      },
      {
        title: '已归档',
        url: '#',
      },
    ],
  },
  {
    title: '提案',
    icon: FileTextIcon,
    url: '#',
    items: [
      {
        title: '进行中的提案',
        url: '#',
      },
      {
        title: '已归档',
        url: '#',
      },
    ],
  },
  {
    title: '提示词',
    icon: FileCodeIcon,
    url: '#',
    items: [
      {
        title: '进行中的提案',
        url: '#',
      },
      {
        title: '已归档',
        url: '#',
      },
    ],
  },
]

export const navSecondary = [
  {
    title: '设置',
    url: '#',
    icon: SettingsIcon,
  },
  {
    title: '获取帮助',
    url: '#',
    icon: HelpCircleIcon,
  },
  {
    title: '搜索',
    url: '#',
    icon: SearchIcon,
  },
]

export const documents = [
  {
    name: '数据仓库',
    url: '#',
    icon: DatabaseIcon,
  },
  {
    name: '报表',
    url: '#',
    icon: ClipboardListIcon,
  },
  {
    name: '文档助手',
    url: '#',
    icon: FileIcon,
  },
]

export const siteHeader = {
  title: '文档',
}
