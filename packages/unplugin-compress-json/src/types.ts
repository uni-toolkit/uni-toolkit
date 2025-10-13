export interface Options {
  /**
   * 控制插件在哪些环境下启用
   * - 'development': 仅在开发环境启用
   * - 'production': 仅在生产环境启用  
   * - 'all': 在所有环境下都启用
   * @default 'production'
   */
  mode?: 'development' | 'production' | 'all'
}
