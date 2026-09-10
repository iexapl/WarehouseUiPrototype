# WebView 白屏根因与修复（已验证）

## 现象
- 登录页整页白屏，电脑浏览器 + 手机（飞书 App 内 / 手机浏览器）均复现；沙箱内同链接正常，无法本地复现。

## 根因（三个叠加）
1. **旧内核语法炸裂**：源码 47 处 `?.`/`??`。`@babel/standalone` 的 script-tag 模式只应用 react preset（剥 JSX），新语法原样下发；旧 WebView（Chrome < 80 / iOS < 13.4）解析即 SyntaxError，该脚本整体失败 → 依赖组件 undefined → 白屏。手机端旧内核最易命中。
2. **crossorigin="anonymous" 拒载**：三个 CDN `<script>` 原带 `crossorigin`。classic script 本不需要 CORS；在部分代理/安全软件环境下带该属性反而触发 CORS 校验失败，脚本被整块拒绝 → 连 React 都没有 → 双端白屏。
3. **零兜底**：`#root` 为空、无错误边界、无看门狗，任何一步失败都是纯白屏。

## 修复
- 全部 `?.`/`??` 改写：`ifnull(v, d)`（data.jsx 定义，`v == null ? d : v`，保留 0/'' 语义）与 `(x.find(...) || {}).y`；`Object.fromEntries` 改 reduce。
- 删除 script 标签 `crossorigin="anonymous"`。
- `index.html` boot guard：`#root` 加载占位（React 18 createRoot 首次 render 会自动清掉）、20s 看门狗 + "继续等待"续 30s、CDN `onerror` → `__cdnFailed` 立即弹双语失败面板（重试/继续等待 + 错误详情）、`window.onerror`/`unhandledrejection` → 启动前收集进面板、启动后 `#runtime-error-bar` 可见化（10s 自动消失）。
- `app.jsx` 追加 `AppErrorBoundary`（getDerivedStateFromError + cloneElement 换 key 重试）。
- `i18n.jsx` localStorage 读写 try/catch（锁定 WebView 下 localStorage 访问可抛 SecurityError）。
- 挂载脚本前置 `typeof React/App` 检查并 `__showBootError`。

## 验证要点
- 正常路径：占位消失、登录页渲染、无错误 UI。
- CDN 全挂（`--proxy-server` 死代理 + bypass 本地）：失败面板立即出现且列出三个 CDN 组件名。
- `boundary-test.html` B1–B3：捕获渲染异常 / 重试后仍异常保持面板 / 健康子树正常渲染。
- 回归：mvp-full 121/121、guest（带查询参数）14/14、zh-scan 基线 7 条不变。
