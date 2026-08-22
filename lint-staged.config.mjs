export default {
  // 代码文件：lint 修复 + 格式化
  '*.{ts,tsx,vue,mjs}': ['eslint --fix', 'prettier --write'],
  // 其他文本：仅格式化
  '*.{json,md,yml,yaml,css}': ['prettier --write'],
}
