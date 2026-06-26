/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string
  /** 版本类型: 'personal' (个人版) | 'enterprise' (企业版), 默认 enterprise */
  readonly VITE_EDITION?: 'personal' | 'enterprise'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
