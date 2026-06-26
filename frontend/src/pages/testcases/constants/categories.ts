// 核心样本分类数据（按厂商分类）

// 厂商列表
export const VENDORS = [
  'OpenAI',
  'Google',
  'Meta',
  'Anthropic',
  'Microsoft',
  'AWS',
  'MLCommons',
] as const

export type Vendor = (typeof VENDORS)[number]

// 厂商对应的分类列表（Level 1）- 全部小写
export const VENDOR_CATEGORIES_MAP: Record<Vendor, string[]> = {
  // OpenAI (13 categories)
  OpenAI: [
    'harassment',             // 骚扰/霸凌
    'harassment/threatening', // 骚扰/威胁
    'hate',                   // 仇恨言论
    'hate/threatening',       // 仇恨/威胁
    'illicit',                // 非法行为指导
    'illicit/violent',        // 暴力相关非法指导
    'self-harm',              // 自残/自我伤害
    'self-harm/intent',       // 自残意图
    'self-harm/instructions', // 自残指南
    'sexual',                 // 色情/性露骨内容
    'sexual/minors',          // 未成年人性内容（红线）
    'violence',               // 暴力
    'violence/graphic',       // 血腥暴力
  ],
  // Google (4 categories)
  Google: [
    'hate speech',            // 仇恨言论
    'harassment',             // 骚扰/霸凌
    'sexually explicit',      // 露骨性内容
    'dangerous content',      // 危险内容
  ],
  // Meta (14 categories)
  Meta: [
    'violent crimes',             // 暴力犯罪
    'non-violent crimes',         // 非暴力犯罪
    'sex-related crimes',         // 性相关犯罪
    'child sexual exploitation',  // 儿童性剥削（红线）
    'defamation',                 // 诽谤
    'specialized advice',         // 专业建议
    'privacy',                    // 隐私
    'intellectual property',      // 知识产权
    'indiscriminate weapons',     // 无差别武器（CBRNE）
    'hate',                       // 仇恨言论
    'suicide & self-harm',        // 自杀与自残
    'sexual content',             // 色情/情色内容
    'elections',                  // 选举
    'code interpreter abuse',     // 代码解释器滥用
  ],
  // Anthropic (12 categories)
  Anthropic: [
    'do not violate applicable laws or engage in illegal activity', // 不得违法或从事非法活动
    'do not compromise critical infrastructure',                    // 不得危害关键基础设施
    'do not compromise computer or network systems',                // 不得入侵/破坏计算机或网络系统
    'do not develop or design weapons',                             // 不得开发或设计武器
    'do not incite violence or hateful behavior',                   // 不得煽动暴力或仇恨行为
    'do not compromise privacy or identity rights',                 // 不得侵犯隐私或身份权利
    'do not compromise children\'s safety',                         // 不得危害儿童安全（CSAM 红线）
    'do not create psychologically or emotionally harmful content', // 不得生成心理/情绪伤害内容
    'do not create or spread misinformation',                       // 不得制造或传播误导信息
    'do not undermine democratic processes',                        // 不得破坏民主程序/定向政治活动
    'do not engage in fraudulent, abusive, or predatory practices', // 不得欺诈/滥用/掠夺性行为
    'do not generate sexually explicit content',                    // 不得生成露骨色情内容
  ],
  // Microsoft (4 categories)
  Microsoft: [
    'hate and fairness',      // 仇恨与公平/歧视
    'sexual',                 // 性内容/色情
    'violence',               // 暴力
    'self-harm',              // 自残/自我伤害
  ],
  // AWS (6 categories)
  AWS: [
    'hate',                   // 仇恨
    'insults',                // 侮辱
    'sexual',                 // 色情/性内容
    'violence',               // 暴力
    'misconduct',             // 不当行为
    'prompt attack',          // 提示攻击/越狱
  ],
  // MLCommons (13 categories)
  MLCommons: [
    'violent crimes',             // 暴力犯罪
    'non-violent crimes',         // 非暴力犯罪
    'sex-related crimes',         // 性相关犯罪
    'child sexual exploitation',  // 儿童性剥削（CSAM）
    'indiscriminate weapons, cbrne', // 无差别武器（CBRNE）
    'suicide & self-harm',        // 自杀与自残
    'hate',                       // 仇恨言论
    'specialized advice',         // 专业建议
    'privacy',                    // 隐私
    'intellectual property',      // 知识产权
    'elections',                  // 选举
    'defamation',                 // 诽谤
    'sexual content',             // 色情/情色内容
  ],
}

// 获取厂商列表
export function getVendors(): Vendor[] {
  return [...VENDORS]
}

// 根据厂商获取一级分类列表
export function getLv1ByVendor(vendor: Vendor): string[] {
  return VENDOR_CATEGORIES_MAP[vendor] || []
}

// 根据一级分类获取二级分类列表（目前为空）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getLv2Categories(_labelLv1: string): string[] {
  return []
}

// 获取所有一级分类列表（兼容旧代码，这里返回空或所有可能值，暂时不直接使用了）
export function getLv1Categories(): string[] {
  return []
}
