// ============================================================
// cart.jsx — staging-list interaction for Inquiry / Inbound / Outbound
// ("staging" is the user-facing umbrella term; code identifiers keep the
// historical cart names: carts / cartApi / CartStepper / ...)
// Staging STATE lives in App (app.jsx) and is exposed through AppCtx as
// `carts` + `cartApi`; this file renders the shared UI pieces:
//   - H5CartFab / WebCartFab      floating entry with line-count badge
//   - H5CartSheet                 mobile bottom sheet (3 module carts)
//   - InquiryCartEditor / InboundCartEditor / OutboundCartEditor
//   - NewSupplierDialog           on-the-spot supplier profile (stock-in)
//   - WebInquiryCartDialog        web console inquiry cart
// The three carts are kept SEPARATE by module and survive page
// navigation (state lives at App level); submit or clear empties them.
// ============================================================

const CART_MODULES = [
  { id: 'inbound', label: 'Inbound', icon: 'stockIn' },
  { id: 'outbound', label: 'Outbound', icon: 'stockOut' },
  { id: 'inquiry', label: 'Inquiry', icon: 'inquiry' },
];

// 入库暂存每行可独立设置的币种（采购价 Purchase Price；行金额按行币种显示）
const CURRENCIES = ['USD', 'EUR', 'NGN', 'CNY', 'GBP'];

// R110 — 移动端悬浮滚动条（暂存面板 .h5-cart-scroll）：原生滚动条隐藏，
// 改为滚动时浮现的胶囊细滚动条（4px、半透明主色）+ 上/下 overscroll 渐隐
// 提示；停止滚动约 700ms 后淡出。捕获期 scroll 委托 + 逐容器懒建覆盖层
// 实现（覆盖层绝对定位，不参与布局与面板测高，不影响任何硬约束）。
(function initH5FloatingScrollbar() {
  var SEL = '.h5-cart-scroll';
  var HIDE_MS = 700;
  var timer = null;
  function hostFor(sc) {
    var parent = sc.parentNode;
    if (!parent) return null;
    var h = sc.__fsbHost;
    if (h && h.parentNode === parent) return h;
    if (h && h.parentNode) h.parentNode.removeChild(h);
    parent.classList.add('h5-fsb-host');
    h = document.createElement('div');
    h.className = 'h5-fsb';
    h.appendChild(document.createElement('div')).className = 'h5-fsb-thumb';
    h.appendChild(document.createElement('div')).className = 'h5-fsb-top';
    h.appendChild(document.createElement('div')).className = 'h5-fsb-bot';
    parent.appendChild(h);
    sc.__fsbHost = h;
    return h;
  }
  function onScroll(e) {
    var sc = e.target;
    if (!sc || !sc.classList || !sc.closest || !sc.closest('.h5-app')) return;
    if (!sc.matches || !sc.matches(SEL)) return;
    var h = hostFor(sc);
    if (!h) return;
    var vh = sc.clientHeight, sh = sc.scrollHeight, st = sc.scrollTop;
    if (sh - vh <= 2) { h.classList.remove('show'); return; }
    h.style.height = vh + 'px';
    var th = Math.max(28, Math.round(vh * vh / sh));
    var maxTop = vh - th;
    var ty = maxTop > 0 ? Math.round((st / (sh - vh)) * maxTop) : 0;
    var thumb = h.firstChild;
    thumb.style.height = th + 'px';
    thumb.style.top = ty + 'px';
    h.classList.toggle('can-top', st > 2);
    h.classList.toggle('can-bot', st < sh - vh - 2);
    h.classList.add('show');
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { h.classList.remove('show'); }, HIDE_MS);
  }
  document.addEventListener('scroll', onScroll, true);
})();

// R107 — u-upload 风格图片上传：本地 FileReader 预览 + CropModal 编辑器
// （裁剪/比例锁/缩放/旋转/翻转）；R110 起移除预设备选图，仅保留上传入口
function H5UploadField({ value, onChange }) {
  const fileRef = React.useRef(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const pick = (e) => {
    const f = (e.target.files || [])[0];
    e.target.value = '';
    if (!f || !/^image\//.test(f.type)) return;
    const r = new FileReader();
    r.onload = () => { onChange(String(r.result)); setEditOpen(true); };
    r.readAsDataURL(f);
  };
  return (
    <div className="h5-upload">
      {value ? (
        <React.Fragment>
          <div className="h5-upload-thumb">
            <img src={value} alt="" />
            <span className="h5-upload-del" title={t('Delete')} onClick={() => onChange('')}><Icon name="close" size={9} /></span>
            <span className="h5-upload-edit" onClick={() => setEditOpen(true)}>{t('Crop image')}</span>
          </div>
          <button type="button" className="h5-upload-re" onClick={() => fileRef.current.click()}><Icon name="camera" size={12} />{t('Re-upload')}</button>
        </React.Fragment>
      ) : (
        <button type="button" className="h5-upload-add" onClick={() => fileRef.current.click()}>
          <Icon name="camera" size={20} />
          <span>{t('Upload Image')}</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pick} />
      {editOpen && value ? (
        <CropModal src={value} onApply={du => { onChange(du); setEditOpen(false); }} onClose={() => setEditOpen(false)} />
      ) : null}
    </div>
  );
}

// R07/R11 — carts 顶层结构（两条同批改，形状一次定型）：
//   inquiry        : 行数组（不变）
//   inbound        : { supplierId, supplierName, supplierPhone, lines }
//                    （R07 方案 A：供应商选择提升到容器层，「先选供应商」的
//                     约束在数据结构层成立，batchScanIn / H5ScanPage / 两端
//                     编辑器读同一份状态，双端口径一致 AC-07-08）
//   outbound       : 购物车数组（R11），每车 { id, receiver, lines, createdAt }，
//                    receiver 为 null 表示未绑定，此时不可加货（AC-11-02）
//   outboundActiveId / outboundSeq : 当前车 id / 车序号
// 行结构与旧 outbound 行完全一致，不改。
function emptyCarts() {
  return {
    inquiry: [],
    inbound: { supplierId: '', supplierName: '', supplierPhone: '', lines: [] },
    outbound: [{ id: 'c-1', receiver: null, lines: [], createdAt: '' }],
    outboundActiveId: 'c-1',
    outboundSeq: 1,
  };
}

// ---- R07/R11 归一化读取层 ------------------------------------------------
// 所有读 carts.inbound / carts.outbound 的代码一律经这里，禁止把两者直接
// 当数组用。数组分支只是防御旧形状（正常不会出现——app.jsx 初始化即用新形状）。
function inLines(carts) {
  const c = (carts || {}).inbound;
  return Array.isArray(c) ? c : ((c || {}).lines || []);
}
function inSupplier(carts) {
  const c = (carts || {}).inbound;
  return Array.isArray(c) ? { supplierId: '', supplierName: '', supplierPhone: '' }
    : (c || { supplierId: '', supplierName: '', supplierPhone: '' });
}
function outCarts(carts) {
  const o = (carts || {}).outbound;
  // 旧形状 = 行数组（元素是 {pid,qty,…} 行对象，无 .lines）；新形状 = 车对象
  // 数组（元素含 .lines）。空数组按旧形状包成一辆空车（与 removeCart 补车
  // 语义一致，两端展示不破）。判别必须看元素结构，不能只看 Array.isArray。
  const oldShape = Array.isArray(o) && (!o.length || !o[0] || !Array.isArray(o[0].lines));
  if (oldShape) return [{ id: 'c-1', receiver: null, lines: o, createdAt: '' }];
  return o || [];
}
function activeCart(carts) {
  const list = outCarts(carts);
  return list.find(c => c.id === (carts || {}).outboundActiveId) || list[0] || null;
}
function outLines(carts) { return (activeCart(carts) || {}).lines || []; }
// outbound 页签角标 = Σ 各车行数（R11）
function outLineCount(carts) { return outCarts(carts).reduce((s, c) => s + (((c || {}).lines) || []).length, 0); }

function cartTotalCount(carts) {
  const c = carts || {};
  return (c.inquiry || []).length + inLines(c).length + outLineCount(c);
}

// ---------- shared qty stepper (same visual language as the scan pages) ----------
function CartStepper({ value, onChange }) {
  const q = Number(value) || 0;
  return (
    <span className="h5-stepper">
      <button type="button" aria-label={t('Qty')} onClick={() => onChange(Math.max(1, q - 1))} disabled={q <= 1}><Icon name="minus" size={13} /></button>
      <input type="number" min="1" aria-label={t('Qty')} value={value}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))} />
      <button type="button" aria-label={t('Qty')} onClick={() => onChange(q + 1)}><Icon name="plus" size={13} /></button>
    </span>
  );
}

// ============================================================
// Floating cart entries (badge = line count across the module carts)
// ============================================================

var CART_FAB_POS_KEY = 'tl-h5-cart-fab-pos';
var CART_FAB_MARGIN = 10; // 逤手机框内边最少留白

function clampFabPos(x, y, appW, appH, size) {
  return {
    x: Math.max(CART_FAB_MARGIN, Math.min(x, appW - size - CART_FAB_MARGIN)),
    y: Math.max(CART_FAB_MARGIN, Math.min(y, appH - size - CART_FAB_MARGIN))
  };
}

function H5CartFab({ count, bottom, onClick }) {
  const [pos, setPos] = useState(null);
  const [dragging, setDragging] = useState(false);
  const btnRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const posLoadedRef = useRef(false);

  // 恢复本次会话拖放过的位置（count=0 时按钮未挂载，需等首个非零 count 再试）
  useEffect(function () {
    if (!count || posLoadedRef.current) return;
    posLoadedRef.current = true;
    try {
      const raw = sessionStorage.getItem(CART_FAB_POS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      const app = btnRef.current && btnRef.current.closest('.h5-app');
      if (app && isFinite(p.x) && isFinite(p.y)) {
        const r = app.getBoundingClientRect();
        setPos(clampFabPos(p.x, p.y, r.width, r.height, 48));
      }
    } catch (e) { /* ignore corrupt storage */ }
  }, [count]);

  // 当前逻辑坐标（相对 .h5-app）；未拖拽过时用默认右下定位推算
  function logicalPos() {
    const btn = btnRef.current;
    const app = btn && btn.closest('.h5-app');
    if (app) {
      const br = btn.getBoundingClientRect();
      const ar = app.getBoundingClientRect();
      return { x: br.left - ar.left, y: br.top - ar.top, w: br.width, h: br.height };
    }
    return null;
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return; // 忽略右/中键，触屏 button=0
    const btn = btnRef.current;
    if (!btn) return;
    const p = logicalPos();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: p ? p.x : 0,
      originY: p ? p.y : 0,
      size: p ? p.w : 48,
      moved: false
    };
    if (btn.setPointerCapture) {
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
    }
  }

  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved) {
      if (Math.sqrt(dx * dx + dy * dy) < 5) return; // 5px 拖拽阈值，未超过视为点击
      d.moved = true;
      setDragging(true);
    }
    const app = btnRef.current && btnRef.current.closest('.h5-app');
    if (!app) return;
    const ar = app.getBoundingClientRect();
    const next = clampFabPos(d.originX + dx, d.originY + dy, ar.width, ar.height, d.size);
    d.last = next;
    setPos(next);
  }

  function endDrag(e) {
    const d = dragRef.current;
    if (!d || (e && e.pointerId !== undefined && e.pointerId !== d.pointerId)) return;
    dragRef.current = null;
    setDragging(false);
    if (d.moved) {
      suppressClickRef.current = true; // 拖拽结束不误触打开面板
      setTimeout(function () { suppressClickRef.current = false; }, 300);
      if (d.last) {
        try { sessionStorage.setItem(CART_FAB_POS_KEY, JSON.stringify(d.last)); } catch (err) { /* storage full */ }
      }
    }
  }

  if (!count) return null;
  return (
    <button type="button" ref={btnRef}
      className={'h5-cart-fab' + (dragging ? ' dragging' : '')}
      style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : { bottom: bottom || 84 }}
      onClick={function () {
        if (suppressClickRef.current) { suppressClickRef.current = false; return; }
        onClick();
      }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={endDrag} onPointerCancel={endDrag}
      title={t('Staging')} aria-label={t('Staging')}>
      <NavIcon name="staging" size={20} />
      <span className="cart-fab-badge">{count > 99 ? '99+' : count}</span>
    </button>
  );
}

function WebCartFab({ count, onClick }) {
  // R07 — 常驻：供应商优先流程要求先打开暂存弹窗选供应商/绑收货方，
  // 空车时也必须有入口（角标为 0 时不显示数字）。
  return (
    <button type="button" className="web-cart-fab" onClick={onClick}
      title={t('Staging')} aria-label={t('Staging')}>
      <NavIcon name="staging" size={22} />
      {!!count && <span className="cart-fab-badge">{count > 99 ? '99+' : count}</span>}
    </button>
  );
}

// ============================================================
// Mobile cart sheet — one entry, three module carts on segments
// ============================================================

function H5CartSheet({ onClose, push, context = 'all' }) {
  const { carts } = useApp();
  // R19 — 按入口上下文过滤可见模块（AC-19-01~05）：不相关页签不渲染（不是禁用）。
  // 'all'（通用暂存入口）显示全部三页签；单一上下文只渲染对应 pane。
  const visibleMods = (context && context !== 'all' && CART_MODULES.some(m => m.id === context))
    ? CART_MODULES.filter(m => m.id === context)
    : CART_MODULES;
  // R117 — 页签重排（入库→出库→询价）：高频仓配作业在前，询价选品低频在后。
  // 默认落在第一个非空模块（与页签顺序一致），全空落在首项「入库」。
  const [seg, setSeg] = useState(() => (inLines(carts).length ? 'inbound' : outLineCount(carts) ? 'outbound' : 'inquiry'));
  // R19 — 默认页签不在可见集合时（上下文进入）回落到第一个可见模块
  const activeSeg = visibleMods.some(m => m.id === seg) ? seg : visibleMods[0].id;
  const sheetRef = useRef(null);
  const bodyRef = useRef(null);
  // 面板高度规则：三个页签内容都常驻渲染（未激活 pane 隐藏但仍参与测高，
  // 含空态文案），body 高度 = 三页签内容自然高度的最大值，且总面板不超过
  // 手机屏高 3/4（超出则封顶，各 pane 内部滚动）。内容变化时重算，
  // 切换页签不再改变面板高度；面板贴底（下边距 0，仅顶圆角）。
  const [bodyH, setBodyH] = useState(null);
  useEffect(() => {
    const sheet = sheetRef.current;
    const body = bodyRef.current;
    if (!sheet || !body) return;
    // R19 — 单页签（上下文进入）不固定高度：内容自然撑开，避免固定高度留白
    if (visibleMods.length === 1) { setBodyH(null); return; }
    // R19 — 条件渲染后 DOM 里只剩可见 pane，测高天然只测可见集合
    const panes = [...body.querySelectorAll('.h5-cart-pane')];
    if (!panes.length) return;
    let max = 0;
    panes.forEach(p => {
      // 激活 pane 被 min-height:100% 拉伸（给吸底操作行留 sticky 空间），
      // 测高前先归零，保证量到纯内容高度 —— 面板高度规则语义不变
      const on = p.classList.contains('on');
      // 激活 pane 是 flex 布局（内容区/操作行分离），测高前临时转回块布局，
      // 与隐藏 pane 同构，保证量到纯内容自然高度 —— 面板高度规则语义不变
      if (on) { p.style.minHeight = '0px'; p.style.display = 'block'; }
      max = Math.max(max, p.scrollHeight);
      if (on) { p.style.minHeight = ''; p.style.display = ''; }
    });
    // 面板顶部非内容区（grip + 标题行 + 页签栏 + sheet 自身 padding）
    const chrome = sheet.offsetHeight - body.offsetHeight;
    const screenH = sheet.parentElement ? sheet.parentElement.clientHeight : window.innerHeight;
    const cap = Math.max(180, Math.round(screenH * 3 / 4) - chrome);
    setBodyH(Math.min(max, cap));
  }, [carts, visibleMods.length]);
  return (
    <div className="h5-cart-mask" onClick={onClose}>
      <div className="h5-cart-sheet" ref={sheetRef} onClick={e => e.stopPropagation()}>
        <div className="h5-cart-grip" />
        <div className="h5-cart-head">
          <div className="h5-cart-title"><NavIcon name="staging" size={16} /><span>{t('Staging')}{visibleMods.length === 1 ? ' · ' + t(visibleMods[0].label) : ''}</span></div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
        </div>
        {/* R19/AC-19-07 — 单页签时不渲染切换控件 */}
        {visibleMods.length > 1 && (
        <div className="h5-cart-segs">
          {visibleMods.map(m => (
            <button type="button" key={m.id} className={`h5-cart-seg${activeSeg === m.id ? ' on' : ''}`} onClick={() => setSeg(m.id)}>
              <NavIcon name={m.icon} size={13} />
              <span>{t(m.label)}</span>
              {/* R11 — outbound 角标 = Σ 各车行数 */}
              {(() => { const n = m.id === 'outbound' ? outLineCount(carts) : (carts[m.id] || []).length; return n > 0 ? <span className="h5-cart-seg-n">{n}</span> : null; })()}
            </button>
          ))}
        </div>
        )}
        <div className="h5-cart-body" ref={bodyRef} style={bodyH ? { height: bodyH } : null}>
          {/* R19 — 只渲染上下文允许的 pane（AC-19-05：不渲染，不是禁用）。
              多页签时未激活 pane 仍常驻（绝对定位、宽度一致），供测高取最大值 */}
          {visibleMods.map(m => (
            <div key={m.id} className={`h5-cart-pane${activeSeg === m.id ? ' on' : ''}`} style={bodyH ? { maxHeight: bodyH } : null}>
              {m.id === 'inbound' ? <InboundCartEditor onDone={p => {
                if (p && p.mode === 'wizard') { onClose(); if (push) push({ name: 'inboundWizard', result: p.result }); }
                else onClose();
              }} />
              : m.id === 'outbound' ? <OutboundCartEditor onDone={onClose} />
              : <InquiryCartEditor onDone={onClose} push={push} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- inquiry cart (mobile) ----------
// Lines are upstream-owned products picked while browsing; submitting
// creates ONE inquiry per supplier (tenant boundary enforced by
// act.saveInquiry upstream checks).
function InquiryCartEditor({ onDone, push }) {
  const { db, carts, cartApi, toast } = useApp();
  const [date, setDate] = useState('');
  const lines = carts.inquiry || [];
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  // 按供货方（商品归属商户）分组展示：提交时每个供货方生成一张询价单，
  // 并把询价单发送到该供货方的 WhatsApp 对话界面
  const groups = [];
  lines.forEach((l, i) => {
    const p = db.products.find(x => x.id === l.pid) || {};
    let g = groups.find(x => x.ownerId === p.ownerId);
    if (!g) { g = { ownerId: p.ownerId, lines: [] }; groups.push(g); }
    g.lines.push({ l, i });
  });
  const submit = () => {
    const res = cartApi.submitInquiry(date);
    if (res && res.ok) {
      if (onDone) onDone();
      // 单一供货方 → 直接进入 WhatsApp 对话；多个供货方 → 先进入 WhatsApp
      // 发送列表，再逐个打开对话
      if (push && res.docs && res.docs.length) {
        if (res.docs.length === 1) push({ name: 'waChat', docId: res.docs[0].id });
        else push({ name: 'waInbox', docIds: res.docs.map(d => d.id) });
      }
    }
  };
  return (
    <div>
      <div className="h5-cart-scroll">
      {lines.length === 0 && <H5Empty icon="cart" message="Inquiry staging is empty" hint="Browse channel products in Inquiry and tap Inquire to add them to the inquiry staging" />}
      {groups.map(g => {
        const tn = db.tenants.find(x => x.id === g.ownerId);
        return (
          <div key={g.ownerId} className="h5-card" style={{ marginBottom: 8, padding: 12 }}>
            <div className="flex gap8" style={{ alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #F0F2F5' }}>
              <span className="wa-avatar" style={{ width: 26, height: 26, fontSize: 12 }}>{tn ? tn.name[0] : '?'}</span>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700 }}>{tn ? tn.name : g.ownerId}</div>
              <span className="mini-chip wa"><Icon name="whatsapp" size={11} />{t('1 inquiry / supplier')}</span>
            </div>
            {g.lines.map(({ l, i }) => {
              const p = db.products.find(x => x.id === l.pid) || {};
              return (
                <div key={l.pid} style={{ paddingTop: 8 }}>
                  <div className="flex gap10" style={{ alignItems: 'center' }}>
                    <img src={prodImg(p)} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                      <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{p.model} · {t('Price on quote')}</div>
                    </div>
                    <span className="h5-back" title={t('Remove')} onClick={() => cartApi.removeAt('inquiry', i)} style={{ color: 'var(--danger)' }}><Icon name="trash" size={16} /></span>
                  </div>
                  <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                    <CartStepper value={l.qty} onChange={q => cartApi.setQty('inquiry', i, q)} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {lines.length > 0 && (
        <React.Fragment>
          <div className="h5-card" style={{ padding: 12 }}>
            <div className="h5-form-row" style={{ marginBottom: 0 }}>
              <span className="k">{t('Delivery Date')} *</span>
              <input className="input" style={{ height: 32, flex: 1 }} type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.5 }}><Icon name="info" size={11} /> {t('Lines are grouped by supplier — one inquiry is created per supplier.')}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.5 }}><Icon name="whatsapp" size={11} /> {t("After submitting, each inquiry is sent to the supplier's WhatsApp chat.")}</div>
          </div>
        </React.Fragment>
      )}
      </div>
      {lines.length > 0 && (
        <div className="h5-act-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button type="button" className="h5-btn plain error" onClick={() => { cartApi.clear('inquiry'); toast('Inquiry staging cleared', 'info'); }}><Icon name="trash" size={14} />{t('Clear')}</button>
          <button type="button" className="h5-btn primary" onClick={submit}><Icon name="whatsapp" size={14} />{t('Submit Inquiry')}</button>
        </div>
      )}
    </div>
  );
}

// ---------- inbound cart (mobile) ----------
// Shared by the merged Scan-to-Stock-In page AND the cart sheet: the list
// (existing products restock / new products quick-profiled), the stock-in
// note, the REQUIRED supplier, and the one-tap confirm that records every
// line as an IN movement.
// 供货方设置与出库收货方同一套交互：上游商户下拉（选中显示 名称 · 电话）
// + 手动输入（名称/手机号表单，提交时以 createSupplier 建档后选用）；
// 每行单价可独立设置币种，行金额与合计按币种分别小计（演示不折算）。
function InboundCartEditor({ onDone }) {
  const { db, account, carts, cartApi, toast } = useApp();
  const [note, setNote] = useState('');
  const [picking, setPicking] = useState(false);    // R07 — 已选定时点「切换」回到选择态
  const [supSwitch, setSupSwitch] = useState(null); // R07 — 待二次确认的切换目标（AC-07-05）
  const [supOpen, setSupOpen] = useState(false);    // 新建供应商弹窗（当场建档后选用）
  const [invOpen, setInvOpen] = useState(false);     // R09 邀请供应商弹窗（发邀请码）
  // R07 方案 A — 供应商选择存在 carts.inbound 容器层，双端读同一份状态
  const sup = inSupplier(carts);
  const supId = sup.supplierId || '';
  const lines = inLines(carts);
  const supplierLocked = !!supId;
  const stockOf = pid => (db.stock[account.tenantId] || {})[pid] || 0;
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  // 供货方候选四类（AC-07-02）：上游商户 + 已建档供货方（去重、上游优先），
  // 外加固定项「自产」（R08，不建租户）与「新建供应商…」（当场 createSupplier）
  const upstream = [...upstreamTenantIds(db, account.tenantId)]
    .map(id => db.tenants.find(x => x.id === id)).filter(x => x && x.status === 'Active');
  const filedSuppliers = db.tenants.filter(x => x.status === 'Active' && x.type === 'Supplier'
    && x.id !== account.tenantId && !upstream.some(u => u.id === x.id));
  const supOptions = upstream.concat(filedSuppliers);
  const tenantPhoneOf = id => {
    const tn = db.tenants.find(x => x.id === id) || {};
    return ((db.accounts.find(a => a.tenantId === id && a.main) || {}).phone || tn.contactPhone || '');
  };
  // 行币种：exist 行默认物料币种，new 行默认 USD，均可在行内改
  const lineCur = (l, p) => l.currency || (p ? p.currency : 'USD') || 'USD';
  // 合计按币种分别小计：Σ(物料单价 × 数量)，多币种不相加成一个数（演示不折算）
  const totalsByCur = {};
  lines.forEach(l => {
    const p = l.kind === 'exist' ? (db.products.find(x => x.id === l.pid) || null) : null;
    const cur = lineCur(l, p);
    const unit = Number(l.kind === 'exist' ? l.unitPrice : l.price) || 0;
    totalsByCur[cur] = (totalsByCur[cur] || 0) + unit * (Number(l.qty) || 0);
  });
  // R07 — 选定/切换供应商：已有行且已有供应商时弹二次确认；确认后仅变更归属、行保留
  const applySupplier = (patch) => {
    if (lines.length > 0 && supplierLocked) setSupSwitch(patch);
    else { cartApi.setInSupplier(patch); setPicking(false); }
  };
  const chooseSupplier = (v) => {
    if (!v) return;
    if (v === 'custom') { setSupOpen(true); setPicking(false); return; }
    applySupplier(v === 'self'
      ? { supplierId: 'self', supplierName: '', supplierPhone: '' }
      : { supplierId: v, supplierName: (db.tenants.find(x => x.id === v) || {}).name || v, supplierPhone: tenantPhoneOf(v) });
  };
  const confirm = () => {
    if (!supplierLocked) { toast('Select or enter a supplier for the stock-in', 'error'); return; }
    // R06 —— 入库成功后不直接关闭，改为把结果交给两步向导
    const r = cartApi.submitInbound(note);
    if (r && r.ok && onDone) onDone({ mode: 'wizard', result: r });
  };
  return (
    <div>
      <div className="h5-cart-scroll">
      {/* R07/AC-07-01、AC-07-04 — 首屏供应商选择区；选定后收起为固定卡片（名称+联系方式） */}
      <div className="h5-card" style={{ padding: 12, marginBottom: 8, borderColor: supplierLocked ? 'var(--primary)' : undefined }}>
        {!supplierLocked || picking ? (
          <React.Fragment>
            <div className="h5-form-row" style={{ marginBottom: 0 }}>
              <span className="k">{t('Supplier')} *</span>
              <div style={{ flex: 1 }}>
                <Select value="" onChange={chooseSupplier} placeholder={t('Select supplier first')}
                  options={supOptions.map(x => ({ value: x.id, label: x.name + (x.type === 'Supplier' ? '' : ' (' + x.type + ')') }))
                    .concat([{ value: 'self', label: t('Self-produced') }])
                    .concat([{ value: 'custom', label: t('New supplier…') }])} style={{ height: 32 }} />
              </div>
            </div>
            {/* R09 — 邀请供应商：对未入驻的供货方发邀请码 */}
            <button type="button" className="h5-btn plain mt8" style={{ width: '100%' }} onClick={() => setInvOpen(true)}><Icon name="link" size={14} />{t('Invite Supplier')}</button>
            {supplierLocked && picking && (
              <button type="button" className="h5-btn plain mt8" style={{ width: '100%' }} onClick={() => setPicking(false)}>{t('Cancel')}</button>
            )}
            <div className="muted" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.5 }}><Icon name="info" size={11} /> {t('Select a supplier first — then scan or add products')}</div>
          </React.Fragment>
        ) : (
          <div className="flex gap10" style={{ alignItems: 'center' }}>
            <span className="cell-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}><Icon name={supId === 'self' ? 'warehouse' : 'truck'} size={18} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex gap6" style={{ alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{supId === 'self' ? t('Self-produced') : (sup.supplierName || supId)}</span>
                {supId === 'self' ? <Tag tone="teal" dot>{t('Self-produced')}</Tag> : <Tag tone="info">{t('Supplier')}</Tag>}
              </div>
              {supId !== 'self' && <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{sup.supplierPhone || '—'}</div>}
            </div>
            <button type="button" className="h5-btn plain" style={{ height: 30 }} onClick={() => setPicking(true)}><Icon name="edit" size={13} />{t('Switch')}</button>
          </div>
        )}
      </div>
      {/* R07/AC-07-01 — 未选供应商时商品区禁用（扫码/加货在 cartApi.add 处同样被拦，AC-07-03） */}
      {!supplierLocked && (
        <div className="h5-card" style={{ padding: '20px 12px', textAlign: 'center', opacity: 0.7 }}>
          <Icon name="lock" size={20} style={{ color: '#94A3B8' }} />
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t('Product area is disabled until a supplier is selected')}</div>
        </div>
      )}
      {supplierLocked && lines.length === 0 && <H5Empty icon="warehouse" message={t('Inbound staging is empty')} hint={t('Scan barcodes on Scan / Stock In, or enter a Material Barcode and tap Add, or tap Stock In on the My Warehouse list')} />}
      {lines.map((l, i) => {
        const qty = Number(l.qty) || 0;
        if (l.kind === 'exist') {
          const p = db.products.find(x => x.id === l.pid) || {};
          const onHand = stockOf(l.pid);
          return (
            <div key={l.pid} className="h5-card" style={{ marginBottom: 8, padding: 12 }}>
              <div className="flex gap10" style={{ alignItems: 'center' }}>
                <img src={prodImg(p)} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex gap6" style={{ alignItems: 'center' }}><span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span><Tag tone="success">{t('Existing product')}</Tag></div>
                  <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{p.model} · {t('On Hand')} {onHand} {t(p.unit)}</div>
                </div>
                <span className="h5-back" title={t('Remove')} onClick={() => cartApi.removeAt('inbound', i)} style={{ color: 'var(--danger)' }}><Icon name="trash" size={16} /></span>
              </div>
            {/* 采购价（默认参考价/渠道价，可改）+ 独立币种 → 行金额 = 采购价 × 数量；采购价在前、数量在后 */}
              <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="muted" style={{ fontSize: 11.5 }}>{t('Purchase Price')}</span>
                <span className="flex" style={{ alignItems: 'center', gap: 8 }}>
                  <Select value={lineCur(l, p)} onChange={v => cartApi.setField('inbound', i, 'currency', v)}
                    options={CURRENCIES.map(c => ({ value: c, label: c }))} style={{ height: 30, width: 82 }} />
                  <input className="input mono" style={{ height: 30, width: 92, textAlign: 'right' }} type="number" min="0" step="0.01"
                    value={ifnull(l.unitPrice, 0)} aria-label={t('Purchase Price')} onChange={e => cartApi.setField('inbound', i, 'unitPrice', e.target.value)} />
                </span>
              </div>
            <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted mono" style={{ fontSize: 11.5 }}>{t(p.unit)} × {l.qty}</span>
              <CartStepper value={l.qty} onChange={q => cartApi.setQty('inbound', i, q)} />
            </div>
              <div className="flex mt4" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="muted mono" style={{ fontSize: 11 }}>{onHand} → {onHand + qty} {t(p.unit)}</span>
                <span className="mono" style={{ fontSize: 11.5 }}>{t('Amount')}: <b style={{ color: '#D35400' }}>{money(qty * (Number(l.unitPrice) || 0), lineCur(l, p)).text}</b></span>
              </div>
            </div>
          );
        }
        return (
          <div key={i} className="h5-card" style={{ marginBottom: 8, padding: 12, border: '1px dashed var(--primary)' }}>
            <div className="flex gap10" style={{ alignItems: 'center' }}>
              <span className="cell-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}><Icon name="plus" size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex gap6" style={{ alignItems: 'center' }}><span style={{ fontSize: 13, fontWeight: 600 }}>{t('New product — quick profile')}</span><Tag tone="info">{t('Not in warehouse yet')}</Tag></div>
                {/* R04/R05 — 新品行展示条码（若有），否则回落到扫码原值 */}
                <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{l.barcode || l.code || '—'}</div>
              </div>
              <span className="h5-back" title={t('Remove')} onClick={() => cartApi.removeAt('inbound', i)} style={{ color: 'var(--danger)' }}><Icon name="trash" size={16} /></span>
            </div>
            <div className="h5-form-row mt8" style={{ marginBottom: 0 }}><span className="k">{t('Name')} *</span><div style={{ flex: 1 }}><input className="input" style={{ height: 32, width: '100%' }} value={l.name} onChange={e => cartApi.setField('inbound', i, 'name', e.target.value)} placeholder={t('e.g. Solar Inverter 5kW')} /></div></div>
            <div className="h5-form-row" style={{ marginBottom: 0 }}><span className="k">{t('Unit')}</span><div style={{ flex: 1 }}><Select value={l.unit} onChange={v => cartApi.setField('inbound', i, 'unit', v)} options={['pcs', 'set', 'box', 'kg'].map(u => ({ value: u, label: u }))} style={{ height: 32 }} /></div></div>
            <div className="h5-form-row" style={{ marginBottom: 0 }}><span className="k">{t('Purchase Price')}</span>
              <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                <Select value={l.currency || 'USD'} onChange={v => cartApi.setField('inbound', i, 'currency', v)}
                  options={CURRENCIES.map(c => ({ value: c, label: c }))} style={{ height: 32, width: 84 }} />
                <input className="input" style={{ height: 32, flex: 1, minWidth: 0 }} type="number" value={l.price} onChange={e => cartApi.setField('inbound', i, 'price', e.target.value)} placeholder="0.00 (editable later)" />
              </div>
            </div>
            {/* R107 — 物料详情折叠区移至采购价行后（采购价在前、数量在后）：
                图片（u-upload 上传+裁剪编辑）/型号/品牌/规格/类目（点选多选），默认折叠可展开（仅本卡） */}
            <div className={'h5-collapse' + (l.detailOpen ? ' open' : '')}>
              <button type="button" className="h5-collapse-head" aria-expanded={!!l.detailOpen}
                onClick={() => cartApi.setField('inbound', i, 'detailOpen', !l.detailOpen)}>
                <span className="h5-collapse-title">{t('Material Details')}</span>
                <span className="h5-collapse-chev"><Icon name="chevronDown" size={14} /></span>
              </button>
              <div className="h5-collapse-body">
                <div className="h5-form-row h5-form-row-top" style={{ padding: '2px 0 7px' }}><span className="k">{t('Image')}</span>
                  <H5UploadField value={ifnull(l.image, '')} onChange={v => cartApi.setField('inbound', i, 'image', v)} />
                </div>
                <div className="h5-form-row" style={{ marginBottom: 0 }}><span className="k">{t('Model')}</span>
                  <div style={{ flex: 1 }}><input className="input" style={{ height: 32, width: '100%' }} value={ifnull(l.model, '')} onChange={e => cartApi.setField('inbound', i, 'model', e.target.value)} placeholder={String(l.code || '')} /></div>
                </div>
                <div className="h5-form-row" style={{ marginBottom: 0 }}><span className="k">{t('Brand')}</span>
                  <div style={{ flex: 1 }}><input className="input" style={{ height: 32, width: '100%' }} value={ifnull(l.brand, '')} onChange={e => cartApi.setField('inbound', i, 'brand', e.target.value)} /></div>
                </div>
                <div className="h5-form-row" style={{ marginBottom: 0 }}><span className="k">{t('Spec')}</span>
                  <div style={{ flex: 1 }}><input className="input" style={{ height: 32, width: '100%' }} value={ifnull(l.spec, '')} onChange={e => cartApi.setField('inbound', i, 'spec', e.target.value)} /></div>
                </div>
                <div className="h5-form-row h5-form-row-top" style={{ marginBottom: 0 }}><span className="k">{(l.categories || []).length ? t('Category') + ' (' + (l.categories || []).length + ')' : t('Category')}</span>
                  <div className="h5-catsel">
                    {(db.categories || []).map(c => {
                      const on = (l.categories || []).indexOf(c.id) > -1;
                      return (
                        <button key={c.id} type="button" className={'h5-catsel-item' + (on ? ' on' : '')}
                          onClick={() => cartApi.setField('inbound', i, 'categories', on ? (l.categories || []).filter(x => x !== c.id) : (l.categories || []).concat([c.id]))}>
                          {on ? <Icon name="check" size={10} /> : null}{c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted mono" style={{ fontSize: 11.5 }}>{t(l.unit)} × {(Number(l.qty) || 0)}</span>
              <CartStepper value={l.qty} onChange={q => cartApi.setQty('inbound', i, q)} />
            </div>
            <div className="mono" style={{ fontSize: 11.5, marginTop: 4, textAlign: 'right' }}>{t('Amount')}: <b style={{ color: '#D35400' }}>{money((Number(l.qty) || 0) * (Number(l.price) || 0), l.currency || 'USD').text}</b></div>
          </div>
        );
      })}
      {lines.length > 0 && (
        <React.Fragment>
          {/* 合计金额 = Σ(物料单价 × 数量)；多币种按币种分别小计，逐币种上下堆叠 */}
          <div className="h5-card" style={{ padding: '10px 12px', marginBottom: Object.keys(totalsByCur).length > 1 ? 4 : 8 }}>
            <div className="flex" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <span className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>{`${tItems(lines.length)} · ${totalQty} ${t('units')}`}</span>
              <div style={{ textAlign: 'right' }}>
                <div className="muted" style={{ fontSize: 11, lineHeight: 1.6 }}>{t('Total')}</div>
                {Object.keys(totalsByCur).map(c => (
                  <div key={c} className="mono" style={{ fontSize: 13, fontWeight: 700, color: '#D35400', lineHeight: 1.6 }}>{money(totalsByCur[c], c).text}</div>
                ))}
              </div>
            </div>
          </div>
          {Object.keys(totalsByCur).length > 1 && (
            <div className="muted" style={{ fontSize: 11, margin: '0 4px 8px', lineHeight: 1.5 }}><Icon name="info" size={11} /> {t('Multi-currency lines are subtotaled per currency — demo, no FX conversion')}</div>
          )}
          <div className="h5-card" style={{ padding: 12 }}>
            <div className="h5-form-row h5-form-row-top" style={{ marginBottom: 0 }}>
              <span className="k">{t('Stock-in note (optional)')}</span>
              <textarea className="textarea h5-note-area" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder={t('e.g. purchase arrival')}></textarea>
            </div>
          </div>
        </React.Fragment>
      )}
      </div>
      {lines.length > 0 && (
        <div className="h5-act-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button type="button" className="h5-btn plain error" onClick={() => { cartApi.clear('inbound'); toast('Inbound staging cleared', 'info'); }}><Icon name="trash" size={14} />{t('Clear')}</button>
          <button type="button" className="h5-btn success" onClick={confirm}><NavIcon name="stockIn" size={14} />{t('Confirm Stock In')}</button>
        </div>
      )}
      {/* R07/AC-07-05 — 切换供应商二次确认：保留已加商品，仅变更归属 */}
      {supSwitch && (
        <ConfirmDialog title={t('Switch Supplier')}
          message={t('Switching keeps the added items and only changes the supplier attribution. Continue?')}
          confirmText={t('Switch')}
          onConfirm={() => { cartApi.setInSupplier(supSwitch); setSupSwitch(null); setPicking(false); }}
          onClose={() => setSupSwitch(null)} />
      )}
      {/* R07/R08 — 新建供应商：当场建档（Supplier 型商户）后立即选用；「自产」不在此路径、不建租户 */}
      {supOpen && (
        <NewSupplierDialog onClose={() => setSupOpen(false)}
          onCreated={tn => { setSupOpen(false); applySupplier({ supplierId: tn.id, supplierName: tn.name, supplierPhone: tn.phone || '' }); }} />
      )}
      {/* R09 — 邀请供应商弹窗 */}
      {invOpen && <InviteDialog role="supplier" onClose={() => setInvOpen(false)} />}
    </div>
  );
}

// ---------- outbound cart (mobile) ----------
function OutboundCartEditor({ onDone }) {
  const { db, account, carts, cartApi, toast } = useApp();
  const [note, setNote] = useState('');
  const [delCart, setDelCart] = useState(null);   // R11 — 待删除确认的车（AC-11-08）
  const [picking, setPicking] = useState(false);  // 收货方已绑定时点「更换」回到选择态
  const [custom, setCustom] = useState(false);    // 自由输入收货方表单
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  // R11 — outbound 是车数组；编辑器只操作当前车，各行/价/合计随车隔离（AC-11-04/05）
  const cartsList = outCarts(carts);
  const cur = activeCart(carts) || { id: '', receiver: null, lines: [] };
  const cartId = cur.id;
  const lines = cur.lines || [];
  const recv = cur.receiver || null;
  const stockOf = pid => (db.stock[account.tenantId] || {})[pid] || 0;
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  // 实际销售价：默认取渠道销售价及其币种，可在行内改价/改币种；
  // 行金额 = 实际销售价 × 数量，合计按币种分别小计（每车独立合计）
  const saleCur = (l, p) => l.saleCurrency || (p ? p.currency : 'USD') || 'USD';
  const saleNum = (l, p) => Number(ifnull(l.salePrice, p ? p.price : 0)) || 0;
  const totalsByCur = {};
  lines.forEach(l => {
    const p = db.products.find(x => x.id === l.pid) || {};
    const c = saleCur(l, p);
    totalsByCur[c] = (totalsByCur[c] || 0) + saleNum(l, p) * (Number(l.qty) || 0);
  });
  // R10 —— 行三列金额（原始/折后/优惠）+ 五行汇总（与 docAmountBreakdown 同口径）
  const cartPct = (cur.discountPct === undefined || cur.discountPct === null) ? 0 : (Number(cur.discountPct) || 0);
  const lineAmtMap = {};
  let amtSubtotal = 0, amtDiscount = 0;
  lines.forEach(l => {
    const p = db.products.find(x => x.id === l.pid) || {};
    const a = lineAmounts([{ qty: l.qty, price: saleNum(l, p) }], cartPct)[0];
    const rowPct = (l.discountPct === undefined || l.discountPct === null) ? cartPct : (Number(l.discountPct) || 0);
    const a2 = lineAmounts([{ qty: l.qty, price: saleNum(l, p) }], cartPct)[0];
    a2.pct = rowPct;
    a2.gross = Math.round(saleNum(l, p) * (Number(l.qty) || 0) * 100) / 100;
    a2.net = Math.round(a2.gross * (1 - rowPct / 100) * 100) / 100;
    a2.saving = Math.round((a2.gross - a2.net) * 100) / 100;
    lineAmtMap[l.pid] = a2;
    amtSubtotal += a2.gross;
    amtDiscount += a2.saving;
  });
  const settings = db.settings || {};
  const taxRate = (settings.taxRate === undefined || settings.taxRate === null) ? null : Number(settings.taxRate);
  const amtTax = taxRate === null ? 0 : Math.round((amtSubtotal - amtDiscount) * taxRate) / 100;
  const amtFreight = (cur.freight === undefined || cur.freight === null) ? (settings.freightEnabled ? Number(settings.defaultFreight) || 0 : 0) : Number(cur.freight);
  const amtCurrency = (lines[0] ? (saleCur(lines[0], db.products.find(x => x.id === lines[0].pid) || {})) : 'USD');
  const amtSummary = {
    subtotal: Math.round(amtSubtotal * 100) / 100,
    discountTotal: Math.round(amtDiscount * 100) / 100,
    taxAmount: amtTax, taxRate, freight: amtFreight,
    total: Math.round((amtSubtotal - amtDiscount + amtTax + amtFreight) * 100) / 100,
    currency: amtCurrency,
  };
  const downstream = db.relations.filter(r => r.upstream === account.tenantId)
    .map(r => db.tenants.find(x => x.id === r.downstream)).filter(x => x && x.status === 'Active');
  const recvTenantPhone = id => ((db.accounts.find(a => a.tenantId === id && a.main) || {}).phone || '');
  // 车标签：收货方名（未绑定显示「未绑定」）；同名收货方按出现次序加 #n（AC-11-03，渲染时判定）
  const labels = cartsList.map(c => (c.receiver && c.receiver.name) || '');
  const tabTitle = (idx) => {
    const nm = labels[idx];
    if (!nm) return t('Unbound');
    const dup = labels.filter(x => x === nm).length;
    return dup > 1 ? nm + ' #' + (labels.slice(0, idx + 1).filter(x => x === nm).length) : nm;
  };
  const bindReceiver = (recvObj) => { cartApi.setReceiver(cartId, recvObj); setPicking(false); setCustom(false); };
  const applyCustom = () => {
    const name = String(custName || '').trim();
    if (!name) { toast('Enter the receiver name', 'error'); return; }
    bindReceiver({ name, phone: String(custPhone || '').trim(), tenantId: null });
    setCustName(''); setCustPhone('');
  };
  const confirm = () => {
    if (!recv || !recv.name) { toast('Bind a receiver for this cart first', 'error'); return; }
    if (cartApi.submitOutbound(note) && onDone) onDone();
  };
  return (
    <div>
      <div className="h5-cart-scroll">
      {/* R11/AC-11-09 — 原型不持久化，刷新后恢复初始演示态（界面标注） */}
      <div className="muted" style={{ fontSize: 11, margin: '0 2px 8px', lineHeight: 1.5 }}><Icon name="info" size={11} /> {t('Prototype only — carts are not persisted; refresh restores the initial state')}</div>
      {/* R11 — 车标签栏：收货方名 + 件数；切车 / 新建车 */}
      <div className="flex gap6" style={{ overflowX: 'auto', paddingBottom: 2, marginBottom: 8 }}>
        {cartsList.map((c, idx) => {
          const n = (c.lines || []).length;
          const on = c.id === cartId;
          return (
            <button key={c.id} type="button" className={'h5-chip' + (on ? ' on' : '')} style={{ flexShrink: 0 }}
              onClick={() => cartApi.switchCart(c.id)}>
              {tabTitle(idx)}{n > 0 ? ` · ${n}` : ''}
            </button>
          );
        })}
        <button type="button" className="h5-chip" style={{ flexShrink: 0, borderStyle: 'dashed' }} title={t('New Cart')}
          onClick={() => { if (cartApi.newCart() === false) toast('Cart limit reached (10)', 'warning'); }}>
          <Icon name="plus" size={11} />{t('New Cart')}
        </button>
      </div>
      {/* 当前车 — 收货方（未绑定 → 选择卡；已绑定 → 固定卡 + 更换/删车） */}
      <div className="h5-card" style={{ padding: 12, marginBottom: 8, borderColor: recv ? 'var(--primary)' : undefined }}>
        {!recv || picking ? (
          <React.Fragment>
            <div className="h5-form-row" style={{ marginBottom: 0 }}>
              <span className="k">{t('Receiver')} *</span>
              <div style={{ flex: 1 }}>
                <Select value="" onChange={v => {
                  if (v === 'custom') { setCustom(true); return; }
                  setCustom(false);
                  const tn = downstream.find(x => x.id === v);
                  if (tn) bindReceiver({ name: tn.name, phone: recvTenantPhone(tn.id), tenantId: tn.id });
                }} placeholder={t('Select receiver')}
                  options={downstream.map(x => ({ value: x.id, label: x.name + (x.type === 'Supplier' ? '' : ' (' + x.type + ')') }))
                    .concat([{ value: 'custom', label: t('Custom receiver…') }])} style={{ height: 32 }} />
              </div>
            </div>
            {custom && (
              <React.Fragment>
                <div className="h5-form-row mt8"><span className="k">{t('Receiver name')} *</span>
                  <div style={{ flex: 1 }}><input className="input" style={{ height: 32, width: '100%' }} value={custName} onChange={e => setCustName(e.target.value)} placeholder={t('e.g. Sunrise Retail Store')} /></div>
                </div>
                <div className="h5-form-row"><span className="k">{t('Receiver phone')}</span>
                  <div style={{ flex: 1 }}><input className="input" style={{ height: 32, width: '100%' }} value={custPhone} onChange={e => setCustPhone(e.target.value)} placeholder="+234 …" /></div>
                </div>
                <button type="button" className="h5-btn primary" style={{ width: '100%', marginTop: 8 }} onClick={applyCustom}><Icon name="check" size={14} />{t('Bind Receiver')}</button>
              </React.Fragment>
            )}
            {picking && !custom && (
              <button type="button" className="h5-btn plain mt8" style={{ width: '100%' }} onClick={() => setPicking(false)}>{t('Cancel')}</button>
            )}
            <div className="muted" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.5 }}><Icon name="info" size={11} /> {t('Bind a receiver for this cart before adding items')}</div>
          </React.Fragment>
        ) : (
          <div className="flex gap10" style={{ alignItems: 'center' }}>
            <span className="cell-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}><Icon name="truck" size={18} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex gap6" style={{ alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{recv.name}</span>
                {recv.tenantId ? <Tag tone="info">{t('Receiver')}</Tag> : <Tag tone="warning">{t('Custom receiver…')}</Tag>}
              </div>
              <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{recv.phone || '—'}</div>
            </div>
            <button type="button" className="h5-btn plain" style={{ height: 30 }} onClick={() => setPicking(true)}><Icon name="edit" size={13} />{t('Switch')}</button>
            {cartsList.length > 0 && (
              <button type="button" className="h5-btn plain error" style={{ height: 30 }} title={t('Delete this cart?')} onClick={() => setDelCart(cartId)}><Icon name="trash" size={13} /></button>
            )}
          </div>
        )}
      </div>
      {lines.length === 0 && <H5Empty icon="truck" message={t('This cart is empty')} hint={t('Bind a receiver, then scan items on Scan / Stock Out, or tap Stock Out on the My Warehouse list')} />}
      {lines.map((l, i) => {
        const p = db.products.find(x => x.id === l.pid) || {};
        const onHand = stockOf(l.pid);
        const qty = Number(l.qty) || 0;
        const lineAmt = lineAmtMap[l.pid] || { gross: 0, net: 0, saving: 0, pct: 0 };
        return (
          <div key={l.pid} className="h5-card" style={{ marginBottom: 8, padding: 12 }}>
            <div className="flex gap10" style={{ alignItems: 'center' }}>
              <img src={prodImg(p)} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{p.model} · {t('On Hand')} {onHand} {t(p.unit)}</div>
              </div>
              <span className="h5-back" title={t('Remove')} onClick={() => cartApi.removeAt('outbound', i, cartId)} style={{ color: 'var(--danger)' }}><Icon name="trash" size={16} /></span>
            </div>
            {/* 价格体系：市场指导价 / 渠道销售价只读参考；实际销售价可改（默认渠道价及其币种）；价格区块在前、数量在后 */}
            <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted mono" style={{ fontSize: 11 }}>{t('Market guide price')}: <b>{money(ifnull(p.marketPrice, p.price), marketCurOf(p)).text}</b></span>
              <span className="muted mono" style={{ fontSize: 11 }}>{t('Channel sale price')}: <b>{money(p.price, p.currency).text}</b></span>
            </div>
            <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted" style={{ fontSize: 11.5 }}>{t('Channel sale price')}</span>
              <span className="flex" style={{ alignItems: 'center', gap: 8 }}>
                <Select value={saleCur(l, p)} onChange={v => cartApi.setField('outbound', i, 'saleCurrency', v, cartId)}
                  options={CURRENCIES.map(c => ({ value: c, label: c }))} style={{ height: 30, width: 82 }} />
                <input className="input mono" style={{ height: 30, width: 92, textAlign: 'right' }} type="number" min="0" step="0.01"
                  value={ifnull(l.salePrice, ifnull(p.price, 0))} aria-label={t('Channel sale price')} onChange={e => cartApi.setField('outbound', i, 'salePrice', e.target.value, cartId)} />
              </span>
            </div>
            <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted mono" style={{ fontSize: 11.5 }}>{t(p.unit)} × {l.qty}</span>
              <CartStepper value={l.qty} onChange={q => cartApi.setQty('outbound', i, q, cartId)} />
            </div>
            {/* R10 —— 单行折扣（行折扣优先于整单折扣）+ 原始价/折后价/优惠金额三列 */}
            <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted" style={{ fontSize: 11.5 }}>{t('Line discount')}</span>
              <span className="flex" style={{ alignItems: 'center', gap: 6 }}>
                <input className="input mono" style={{ height: 28, width: 72, textAlign: 'right' }} type="number" min="0" step="0.01"
                  value={ifnull(l.discountPct, '')} placeholder={ifnull(cur.discountPct, 0) ? String(cur.discountPct) : '0'}
                  aria-label={t('Line discount')} onChange={e => cartApi.setField('outbound', i, 'discountPct', e.target.value === '' ? null : Number(e.target.value), cartId)} />
                <span className="muted mono" style={{ fontSize: 11 }}>%</span>
              </span>
            </div>
            <div className="flex mt4" style={{ gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span className="muted mono" style={{ fontSize: 11 }}>{t('Original')}: <b>{money(lineAmt.gross, saleCur(l, p)).text}</b></span>
              <span className="muted mono" style={{ fontSize: 11 }}>{t('Discounted')}: <b>{money(lineAmt.net, saleCur(l, p)).text}</b></span>
              <span className="muted mono" style={{ fontSize: 11 }}>{t('Saving')}: <b>{money(lineAmt.saving, saleCur(l, p)).text}</b></span>
            </div>
            <div className="flex mt4" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted mono" style={{ fontSize: 11 }}>{onHand} → {onHand - qty} {t(p.unit)}</span>
              <span className="mono" style={{ fontSize: 11.5 }}>{t('Amount')}: <b style={{ color: '#D35400' }}>{money(qty * saleNum(l, p), saleCur(l, p)).text}</b></span>
            </div>
            {qty > onHand && <div style={{ color: 'var(--danger)', fontSize: 11.5, marginTop: 4, textAlign: 'right' }}>{t('Exceeds on-hand quantity')}</div>}
            {/* R10/AC-10-14 — 折后单价低于采购价：警告不拦截（判据 purchasePriceOf） */}
            {saleNum(l, p) * (1 - (lineAmt.pct || 0) / 100) < (purchasePriceOf(p) || 0) && (
              <div className="flex gap6" style={{ alignItems: 'center', justifyContent: 'flex-end', color: 'var(--warning)', fontSize: 11.5, marginTop: 4 }}><Icon name="warn" size={12} />{t('Discounted price is below the purchase price — please double-check')}</div>
            )}
          </div>
        );
      })}
      {lines.length > 0 && (
        <React.Fragment>
          {/* 合计金额 = Σ(实际销售价 × 数量)；多币种按币种分别小计（每车独立） */}
          <div className="h5-card" style={{ padding: '10px 12px', marginBottom: Object.keys(totalsByCur).length > 1 ? 4 : 8 }}>
            <div className="flex" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <span className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>{`${tItems(lines.length)} · ${totalQty} ${t('units')}`}</span>
              <div style={{ textAlign: 'right' }}>
                <div className="muted" style={{ fontSize: 11, lineHeight: 1.6 }}>{t('Total')}</div>
                {Object.keys(totalsByCur).map(c => (
                  <div key={c} className="mono" style={{ fontSize: 13, fontWeight: 700, color: '#D35400', lineHeight: 1.6 }}>{money(totalsByCur[c], c).text}</div>
                ))}
              </div>
            </div>
          </div>
          {Object.keys(totalsByCur).length > 1 && (
            <div className="muted" style={{ fontSize: 11, margin: '0 4px 8px', lineHeight: 1.5 }}><Icon name="info" size={11} /> {t('Multi-currency lines are subtotaled per currency — demo, no FX conversion')}</div>
          )}
          {/* R10 —— 折扣申请：整体折扣 + 单行折扣 + 运费 + 五行汇总 */}
          <div className="h5-card" style={{ padding: 12, marginBottom: 8 }}>
            <div className="h5-form-row" style={{ marginBottom: 8 }}>
              <span className="k">{t('Request discount')}</span>
              <div className="flex" style={{ alignItems: 'center', gap: 8 }}>
                <input className="input mono" style={{ height: 30, width: 84, textAlign: 'right' }} type="number" min="0" step="0.01"
                  value={ifnull(cur.discountPct, '')} placeholder="0" aria-label={t('Overall discount')}
                  onChange={e => cartApi.setCartField(cartId, 'discountPct', e.target.value === '' ? null : Number(e.target.value))} />
                <span className="muted mono" style={{ fontSize: 11.5 }}>%</span>
              </div>
            </div>
            <div className="h5-form-row" style={{ marginBottom: 0 }}>
              <span className="k">{t('Courier fee amount')}</span>
              <div className="flex" style={{ alignItems: 'center', gap: 8 }}>
                <input className="input mono" style={{ height: 30, width: 84, textAlign: 'right' }} type="number" min="0" step="0.01"
                  value={ifnull(cur.freight, '')} placeholder="0" aria-label={t('Courier fee amount')}
                  onChange={e => cartApi.setCartField(cartId, 'freight', e.target.value === '' ? null : Number(e.target.value))} />
                <span className="muted mono" style={{ fontSize: 11.5 }}>{t('Freight')}</span>
              </div>
            </div>
          </div>
          <div className="h5-card" style={{ padding: '10px 12px', marginBottom: 8 }}>
            <AmountSummary
              subtotal={amtSummary.subtotal}
              discountTotal={amtSummary.discountTotal}
              taxAmount={amtSummary.taxAmount}
              taxRate={amtSummary.taxRate}
              freight={amtSummary.freight}
              total={amtSummary.total}
              currency={amtSummary.currency} />
          </div>
          <div className="h5-card" style={{ padding: 12 }}>
            <div className="h5-form-row h5-form-row-top" style={{ marginBottom: 0 }}>
              <span className="k">{t('Outbound note (optional)')}</span>
              <textarea className="textarea h5-note-area" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder={t('e.g. transfer to another warehouse')}></textarea>
            </div>
          </div>
        </React.Fragment>
      )}
      </div>
      {lines.length > 0 && (
        <div className="h5-act-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button type="button" className="h5-btn plain error" onClick={() => { cartApi.clear('outbound'); toast('This cart cleared', 'info'); }}><Icon name="trash" size={14} />{t('Clear')}</button>
          <button type="button" className="h5-btn warning" onClick={confirm}><NavIcon name="stockOut" size={14} />{t('Confirm Stock Out')}</button>
        </div>
      )}
      {/* R11/AC-11-08 — 删除购物车二次确认：商品不回流到其他车 */}
      {delCart && (
        <ConfirmDialog title={t('Delete this cart?')} danger confirmText={t('Delete')}
          message={t('Deleting the cart discards its items — they do not flow back to other carts. Continue?')}
          onConfirm={() => { cartApi.removeCart(delCart); setDelCart(null); }}
          onClose={() => setDelCart(null)} />
      )}
    </div>
  );
}

// ============================================================
// New supplier — filed on the spot as a partner tenant and
// immediately selectable for this and future stock-in
// ============================================================

function NewSupplierDialog({ onClose, onCreated }) {
  const { act, toast } = useApp();
  const [f, setF] = useState({ name: '', contact: '', phone: '' });
  const [err, setErr] = useState('');
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const save = () => {
    const name = String(f.name || '').trim();
    if (!name) { setErr('Supplier name is required'); return; }
    const tn = act.createSupplier({ name, contact: String(f.contact || '').trim(), phone: String(f.phone || '').trim() });
    toast(`Supplier "${name}" created — available for this and future stock-in`, 'success');
    if (onCreated) onCreated(tn);
    onClose();
  };
  return (
    <Dialog title={t('New Supplier')} width="92%" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />{t('Cancel')}</button>
        <button className="btn primary" onClick={save}><Icon name="check" size={13} />{t('Create & Select')}</button>
      </React.Fragment>}>
      <div className="h5-form-row"><span className="k">{t('Supplier Name')} *</span>
        <input className="input" style={{ height: 32, flex: 1 }} value={f.name} onChange={e => { set('name', e.target.value); setErr(''); }} placeholder={t('e.g. Sunrise Trading Co.')} />
      </div>
      {err && <div className="field-error" style={{ margin: '4px 0 8px 118px' }}>{t(err)}</div>}
      <div className="h5-form-row"><span className="k">{t('Contact person')}</span>
        <input className="input" style={{ height: 32, flex: 1 }} value={f.contact} onChange={e => set('contact', e.target.value)} placeholder={t('e.g. Ada Obi')} />
      </div>
      <div className="h5-form-row" style={{ borderBottom: 'none' }}><span className="k">{t('Phone')}</span>
        <input className="input" style={{ height: 32, flex: 1 }} value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="+234 ..." />
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.6 }}><Icon name="info" size={12} /> {t('The supplier is filed as a partner record and becomes immediately selectable for this and future stock-in.')}</div>
    </Dialog>
  );
}

// (Web 控制台询价车弹窗已由 web-staging.jsx 的 WebStagingDialog 取代：
//  三模块暂存 + 按供货方分组 + 提交后 WhatsApp 对话窗口)

// R19 — 按上下文打开暂存面板：深层组件（商品详情的询价/入库/出库按钮）
// 调用；mobile.jsx / web.jsx 监听 tl-open-staging 事件，各自打开对应端的
// 暂存面板并带上 context（AC-19-06 上下文切换时页签集合同步更新）。
function openStaging(context) {
  window.dispatchEvent(new CustomEvent('tl-open-staging', { detail: { context: context || 'all' } }));
}

Object.assign(window, {
  emptyCarts, cartTotalCount, CART_MODULES, CURRENCIES, openStaging,
  inLines, inSupplier, outCarts, activeCart, outLines, outLineCount,
  CartStepper, H5CartFab, WebCartFab, H5CartSheet,
  InquiryCartEditor, InboundCartEditor, OutboundCartEditor,
  NewSupplierDialog,
});
