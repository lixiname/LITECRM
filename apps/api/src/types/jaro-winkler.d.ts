// jaro-winkler@0.2.8 为 CommonJS 无类型包（零依赖，符合供应链红线），此处补最小声明
declare module 'jaro-winkler' {
  /** 返回 0~1 的 Jaro-Winkler 字符串相似度 */
  function jaroWinkler(a: string, b: string): number
  export = jaroWinkler
}
