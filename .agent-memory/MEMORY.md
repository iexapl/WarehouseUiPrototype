# 项目记忆 — TierLink WMS 原型

## 应用版本

- 当前应用 `app_17dufj267uz`（暂存单改造版）：扫码入库单入口（连续识别、一次确认）；询价/入库/出库三暂存单；入库确认时选/新建供货方。
- 界面统称已从「购物车/Cart」全量改为「暂存单/Staging」（FAB、面板标题、空态、toast）；三车标签 = Inquiry/Inbound/Outbound Staging（询价/入库/出库暂存）。代码标识符保留历史命名 cart/cartApi/CART_MODULES。
- 移动端仓库页按钮模型（2026-09-10 改造）：我的仓库列表项 = 调价 / 入库 / 出库 / 查看库存（入库/出库把物料加入对应暂存，已在车中 +1）；采购渠道列表项 = 单「询价」按钮直接加入询价暂存（原加入询价车按钮、quickInq 快速询价弹窗、页头 Inquire 多选模式均已删除，pickMode/picked 状态整体移除）；商品详情页同步。adjustStock 移动端页面已无入口（Web 端「调整库存」保留）。
- 购物车架构：`cart.jsx` 提供共享组件（InboundCartEditor/OutboundCartEditor/InquiryCartEditor/H5CartFab/H5CartSheet/NewSupplierDialog/WebCartFab/WebInquiryCartDialog）；三车数据 `{ inquiry, inbound, outbound }` 是 **App 层 useState**，必须放在 lang-remount key 之上（语言切换不丢车）；`cartApi` useMemo 引用 `act`，**必须定义在 `act` 之后**（放前面会 TDZ ReferenceError 白屏）。
- 移动端购物车 UI：`.h5-cart-fab`（.h5-app 内 absolute，z-index 60）+ `.h5-cart-mask/.h5-cart-sheet` 底部面板；Web 端 `.web-cart-fab`（fixed）+ Dialog。样式在 styles.css 末尾「Shopping-cart」区块。
- 新建供货方：`act.createSupplier` 建一个 Supplier 型租户（无链路关系），入库流水带 `supplierId`，reason 组合 `note · Supplier: X · Batch scan stock-in (scan)`。

## 架构约定（无构建步骤原型）

- 应用为浏览器内 Babel 方案：`index.html` 依次加载 `*.jsx`（`type="text/babel"`），跨文件共享靠各文件末尾 `Object.assign(window, {...})` 导出（顶层 function/const 声明也在全局词法作用域共享）。
- **源码必须保持 ES2019 安全**（详见 topics/webview-white-screen.md）：`@babel/standalone` 对 `text/babel` 只做 JSX 转换，可选链 `?.`、空值合并 `??` 会原样下发，旧内核 WebView 解析即 SyntaxError → 整脚本失败 → 白屏。取空值用 `ifnull(v, d)`（data.jsx）或 `(x || {}).y`；勿用 `Object.fromEntries`。
- `index.html` 含启动兜底（boot guard）：`#root` 加载占位、20s 看门狗、CDN `onerror` 检测、`window.__showBootError`、`#runtime-error-bar` 全局错误条；`app.jsx` 末尾有 AppErrorBoundary。新增脚本标签不要加 `crossorigin="anonymous"`（受限网络下 CORS 校验失败会整块拒绝加载）。
- 移动端手机框由 `ios-frame.jsx` 的 IOSDevice 提供，`--ios-safe-top`/`--ios-safe-bottom` 定义安全区；`.h5-header` 为 border-box 且依赖 `--ios-safe-top`。
- i18n（i18n.jsx）：ZH 字典 + PATTERNS 数组按序匹配，**具体模式必须排在宽松模式之前**（如 `^Supplier: (.+)$` 会吞掉 `… · Batch scan stock-in (scan)` 组合串，导致半截英文残留）。

## 回归验证

- **商品归属模型**：商品带 `ownerId`（5 个基础商品属 t-sup，p-kit/p-pole 属 t-lag，p-fan 属 t-iba）。询价仅上游租户商品（`canInquireProduct`/`upstreamTenantIds`），调价/调库存仅本租户商品（`canManageProduct`）；act 层另有同规则守卫。新建/导入商品 ownerId = 创建者租户。
- E2E 推荐用 `agent-browser` CLI（google-chrome + CDP，沙箱已装）：
  - React 受控 input 要用原生 setter：`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(inp, v)` + `dispatchEvent(new Event('input',{bubbles:true}))`。
  - 点击列表项（登录账号等）必须用 `agent-browser snapshot -i` 拿 `@eN` ref 再 click——用 eval 找「包含文本的祖先元素」点击不会触发 React handler。
  - React 18 批处理：click 后同一 eval 块内同步读 DOM 是旧值，断言要拆到下一个 eval。
- 原应用 E2E 套件在 `tmp/e2e/`（gitignore）：`mvp-full-test.html`、`guest-wa-test.html`（须带 `?doc=CK-20260821-002&token=demo`）、`zh-scan.html`、`boundary-test.html`、`round3-test.html`、`web-boundary-test.html`；运行方式 `python3 -m http.server 8124` + headless chrome `--dump-dom --virtual-time-budget`。模拟 CDN 不可达用 `--proxy-server="http://127.0.0.1:1" --proxy-bypass-list="127.0.0.1"`。

## 踩坑经验

- **平台管理员是 Alex Morgan（a-alex）**；David Chen 是供应商 t-sup 的成员账号，别拿他当平台账号写测试。
- headless virtual-time 下 `.h5-page` 的 slideIn 动画停在 translateX(40px) 起始帧：几何断言要相对 `.h5-page` 测量，不要相对 `.h5-app`。
- 移动端单层导航：push 页面点返回直接回 Tab 视图，不要连点两次返回。
- `navigator.clipboard.writeText` 返回 Promise，同步 try/catch 捕获不了拒绝——必须链 `.catch()`，否则 unhandledrejection 打断 E2E。
- 多轮编辑注意：连续 eval 报 `SyntaxError: Unexpected token/end of input` 多为 shell 引号嵌套问题，简化表达式重试即可，通常非页面错误。
- JSX 三元表达式删分支时极易多留/漏掉闭合括号（本应用两次因此白屏，症状 = "MobileStage is not defined"，因 mobile.jsx 整文件解析失败）。自查法：①node 数花括号平衡；②浏览器里 `Babel.transform(await (await fetch('/mobile.jsx')).text(), {presets:[['react',{runtime:'classic'}]]})` 精确定位行号。
