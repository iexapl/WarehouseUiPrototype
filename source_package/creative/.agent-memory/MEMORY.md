# 项目记忆 — TierLink Warehouse 原型

## 架构约定（无构建步骤原型）

- 应用为浏览器内 Babel 方案：`index.html` 依次加载 `*.jsx`（`type="text/babel"`），跨文件共享靠各文件末尾 `Object.assign(window, {...})` 导出。
- **源码必须保持 ES2019 安全**（详见 topics/webview-white-screen.md）：`@babel/standalone` 对 `text="text/babel"` 只做 JSX 转换，可选链 `?.`、空值合并 `??` 会原样下发，旧内核 WebView（飞书内置浏览器/旧安卓）解析即 SyntaxError → 整脚本失败 → 白屏。取空值用 `ifnull(v, d)`（data.jsx 中定义）或 `(x || {}).y`；勿用 `Object.fromEntries`。
- `index.html` 含启动兜底（boot guard）：`#root` 内加载占位、20s 看门狗、CDN `onerror` 检测、`window.__showBootError` 失败面板、`#runtime-error-bar` 全局错误条；`app.jsx` 末尾有 `AppErrorBoundary`。挂载点为 `<AppErrorBoundary><App /></AppErrorBoundary>`。新增脚本标签不要加 `crossorigin="anonymous"`（受限网络下 CORS 校验失败会整块拒绝加载，曾致双端白屏）。
- 移动端手机框由 `ios-frame.jsx` 的 `IOSDevice` 提供，`--ios-safe-top`/`--ios-safe-bottom` CSS 变量定义安全区；`.h5-header` 依赖 `--ios-safe-top`（改状态栏必须同步改该变量，且 `.h5-header` 为 border-box）。

## 回归验证

- **商品归属模型**：商品带 `ownerId`（演示数据：5 个基础商品属 t-sup，p-kit/p-pole 属 t-lag，p-fan 属 t-iba）。询价仅限上游租户商品（`canInquireProduct`/`upstreamTenantIds`，data.jsx），调价/调库存仅本租户商品（`canManageProduct`）；app.jsx 的 act 层另有同规则守卫。用户新建/导入的商品 ownerId = 创建者租户。

- E2E 套件在 `tmp/e2e/`（gitignore，不随页面下发）：`mvp-full-test.html`（121 项）、`guest-wa-test.html`（14 项，**必须带 `?doc=CK-20260821-002&token=demo` 查询参数运行**，否则整套失败）、`zh-scan.html`（中文扫描，pre id 为 `scan-results`，基线 8 处专有名词/规格标记；新商品名/型号/品牌需同步加进其 OK 豁免清单）、`boundary-test.html`（错误边界 3 项）、`round3-test.html`（租户边界：调价/调库存仅本租户商品、询价仅上游商品、工具栏收敛/标题内边距，50 项）、`web-boundary-test.html`（Web 控制台 Owner 列/入口门控/询价上游限定，12 项）。
- 运行方式：`python3 -m http.server 8124` + headless chrome `--dump-dom --virtual-time-budget`，从 pre 元素解析结果。模拟 CDN 不可达用 `--proxy-server="http://127.0.0.1:1" --proxy-bypass-list="127.0.0.1"`（`--host-resolver-rules` 会被沙箱代理绕过，无效）。

## 踩坑经验

- **平台管理员是 Alex Morgan（a-alex）**；David Chen 是供应商 t-sup 的成员账号，别拿他当平台账号写测试。
- headless virtual-time 下 `.h5-page` 的 slideIn 动画会停在 translateX(40px) 起始帧（真实浏览器 0.22s 即完成）：几何断言要相对 `.h5-page` 测量，不要相对 `.h5-app`，否则误报偏移 40px。
- 移动端单层导航：任何 push 页面点返回都直接回 Tab 视图（不会回上一页），测试里不要连点两次返回。
- `navigator.clipboard.writeText` 返回 Promise，同步 try/catch 捕获不了拒绝——必须链 `.catch()`；headless 与内嵌 WebView 常拒绝剪贴板权限，未接 catch 会变成 unhandledrejection 打断 E2E。
- multi_edit 工具会把替换文本里的 `$` 折叠成 `# 项目记忆 — TierLink Warehouse 原型

## 架构约定（无构建步骤原型）

- 应用为浏览器内 Babel 方案：`index.html` 依次加载 `*.jsx`（`type="text/babel"`），跨文件共享靠各文件末尾 `Object.assign(window, {...})` 导出。
- **源码必须保持 ES2019 安全**（详见 topics/webview-white-screen.md）：`@babel/standalone` 对 `text="text/babel"` 只做 JSX 转换，可选链 `?.`、空值合并 `??` 会原样下发，旧内核 WebView（飞书内置浏览器/旧安卓）解析即 SyntaxError → 整脚本失败 → 白屏。取空值用 `ifnull(v, d)`（data.jsx 中定义）或 `(x || {}).y`；勿用 `Object.fromEntries`。
- `index.html` 含启动兜底（boot guard）：`#root` 内加载占位、20s 看门狗、CDN `onerror` 检测、`window.__showBootError` 失败面板、`#runtime-error-bar` 全局错误条；`app.jsx` 末尾有 `AppErrorBoundary`。挂载点为 `<AppErrorBoundary><App /></AppErrorBoundary>`。新增脚本标签不要加 `crossorigin="anonymous"`（受限网络下 CORS 校验失败会整块拒绝加载，曾致双端白屏）。
- 移动端手机框由 `ios-frame.jsx` 的 `IOSDevice` 提供，`--ios-safe-top`/`--ios-safe-bottom` CSS 变量定义安全区；`.h5-header` 依赖 `--ios-safe-top`（改状态栏必须同步改该变量，且 `.h5-header` 为 border-box）。

：需要写 `$('sel')` 时改用 `[...document.querySelectorAll('sel')]`。
