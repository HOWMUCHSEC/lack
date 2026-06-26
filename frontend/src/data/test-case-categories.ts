export interface TestCaseCategory {
  id: string
  name: string
  description: string
  group: string
  subcategories?: string[]
}

export const categoryGroups = [
  { id: 'personal-safety', name: '人身安全' },
  { id: 'illegal', name: '违法违规' },
  { id: 'misinformation', name: '信息误导' },
  { id: 'privacy-ip', name: '隐私版权' },
  { id: 'behavior', name: '行为规范' },
  { id: 'other', name: '其他' },
] as const

export type CategoryGroupId = (typeof categoryGroups)[number]['id']

export const testCaseCategories: TestCaseCategory[] = [
  {
    id: 'violence',
    name: '暴力 / 危害他人',
    description: '描述性暴力、血腥描写、虐待与折磨、制造/使用武器、袭击、绑架、家暴',
    group: 'personal-safety',
  },
  {
    id: 'self-harm',
    name: '自伤 / 自杀 / 危害自身',
    description: '自杀方法、鼓励自残、饮食失调等',
    group: 'personal-safety',
  },
  {
    id: 'sexual',
    name: '性与裸露',
    description: '成人性描写、性服务招揽、色情诱导、未成年人性相关（CSAM）（高度敏感，必须零容忍）',
    group: 'personal-safety',
  },
  {
    id: 'hate-harassment',
    name: '仇恨 / 骚扰 / 霸凌',
    description: '针对受保护群体的仇恨言论、去人性化、人身攻击、跟踪骚扰、辱骂',
    group: 'personal-safety',
  },
  {
    id: 'terrorism',
    name: '恐怖主义 / 极端主义',
    description: '宣传、招募、赞颂暴力活动、制作煽动性材料的实操指南',
    group: 'illegal',
  },
  {
    id: 'illegal-activities',
    name: '违法与危险活动',
    description:
      '制造/购买违禁品（枪支、毒品、爆炸物）、黑客入侵、诈骗、盗刷、伪造证件、绕过付费墙',
    group: 'illegal',
  },
  {
    id: 'biosafety',
    name: '生物安全 / 化学安全',
    description: '病原体培养、增毒、扩散路线、有毒化学品/爆炸物的配方与放大步骤',
    group: 'illegal',
  },
  {
    id: 'cybersecurity',
    name: '网络安全 / 恶意软件',
    description: '编写利用程序、勒索/木马、零日利用细节、绕过安全产品、社工话术模板',
    group: 'illegal',
  },
  {
    id: 'health-misinfo',
    name: '医疗与健康误导',
    description: '诊断/处方/替代疗法的错误建议、反疫苗/伪科学疗法的错误宣称',
    group: 'misinformation',
  },
  {
    id: 'legal-finance',
    name: '法律与金融建议',
    description: '具体法律意见、逃税/洗钱指南、投资/交易建议、内幕提示、虚假财务建议',
    group: 'misinformation',
  },
  {
    id: 'misinfo',
    name: '虚假信息 / 操纵',
    description: '捏造事实、伪造引文、医疗/选举错误信息、协助造谣、操纵舆论、协同水军',
    group: 'misinformation',
  },
  {
    id: 'political',
    name: '政治敏感与选举完整性',
    description: '定向劝诱投票、压制投票、政见操控脚本、海外影响行动、国家级宣传协助',
    group: 'misinformation',
  },
  {
    id: 'privacy-pii',
    name: '隐私与个人数据',
    description: '收集、推断、泄露个人敏感信息、人肉搜索、定位、刷库合并',
    group: 'privacy-ip',
  },
  {
    id: 'copyright',
    name: '版权与知识产权',
    description: '盗版下载链接、规避DRM、批量抓取付费内容、未经许可的长篇受版权文本输出',
    group: 'privacy-ip',
  },
  {
    id: 'addiction',
    name: '成瘾与不良嗜好',
    description: '赌博诱导、烟酒/毒品滥用的鼓励与教程',
    group: 'behavior',
  },
  {
    id: 'academic-misconduct',
    name: '工作场所与学术不端',
    description: '代写、考试作弊、抄袭/改写绕检、KPI 造假、验收舞弊',
    group: 'behavior',
  },
  {
    id: 'commercial-abuse',
    name: '商业不当与平台滥用',
    description: '垃圾信息（Spam）、SEO 作恶、刷榜、刷评、自动化滥用（批量注册、薅券脚本）',
    group: 'behavior',
  },
  {
    id: 'age-inappropriate',
    name: '年龄不当内容',
    description: '向未成年人展示不宜内容、引导不恰当互动',
    group: 'behavior',
  },
  {
    id: 'multimodal',
    name: '图像/多模态特有',
    description: '深度伪造（Deepfake）、以假乱真、血腥画面、裸露检测、面部与车牌可识别信息',
    group: 'other',
  },
  {
    id: 'cultural-ethical',
    name: '文化与伦理敏感',
    description: '宗教/民族禁忌冒犯、灾难幸灾乐祸、身心障碍刻板印象与歧视',
    group: 'other',
  },
]
