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
  { id: 'inquiry', label: 'Inquiry', icon: 'edit' },
  { id: 'inbound', label: 'Inbound', icon: 'download' },
  { id: 'outbound', label: 'Outbound', icon: 'truck' },
];

// 入库暂存每行可独立设置的币种（单价 = 成本价；行金额按行币种显示）
const CURRENCIES = ['USD', 'EUR', 'NGN', 'CNY', 'GBP'];

function emptyCarts() { return { inquiry: [], inbound: [], outbound: [] }; }

function cartTotalCount(carts) {
  const c = carts || {};
  return (c.inquiry || []).length + (c.inbound || []).length + (c.outbound || []).length;
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
      <Icon name="cart" size={20} />
      <span className="cart-fab-badge">{count > 99 ? '99+' : count}</span>
    </button>
  );
}

function WebCartFab({ count, onClick }) {
  if (!count) return null;
  return (
    <button type="button" className="web-cart-fab" onClick={onClick}
      title={t('Staging')} aria-label={t('Staging')}>
      <Icon name="cart" size={22} />
      <span className="cart-fab-badge">{count > 99 ? '99+' : count}</span>
    </button>
  );
}

// ============================================================
// Mobile cart sheet — one entry, three module carts on segments
// ============================================================

function H5CartSheet({ onClose, push }) {
  const { carts } = useApp();
  const [seg, setSeg] = useState(() => (carts.inquiry.length ? 'inquiry' : carts.inbound.length ? 'inbound' : 'outbound'));
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
  }, [carts]);
  return (
    <div className="h5-cart-mask" onClick={onClose}>
      <div className="h5-cart-sheet" ref={sheetRef} onClick={e => e.stopPropagation()}>
        <div className="h5-cart-grip" />
        <div className="h5-cart-head">
          <div className="h5-cart-title"><Icon name="cart" size={16} /><span>{t('Staging')}</span></div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
        </div>
        <div className="h5-cart-segs">
          {CART_MODULES.map(m => (
            <button type="button" key={m.id} className={`h5-cart-seg${seg === m.id ? ' on' : ''}`} onClick={() => setSeg(m.id)}>
              <Icon name={m.icon} size={13} />
              <span>{t(m.label)}</span>
              {(carts[m.id] || []).length > 0 && <span className="h5-cart-seg-n">{carts[m.id].length}</span>}
            </button>
          ))}
        </div>
        <div className="h5-cart-body" ref={bodyRef} style={bodyH ? { height: bodyH } : null}>
          {/* 三个页签全部常驻渲染：隐藏 pane 绝对定位（宽度一致、高度自然），
              供 useEffect 测量真实内容高度；未激活不可交互 */}
          <div className={`h5-cart-pane${seg === 'inquiry' ? ' on' : ''}`} style={bodyH ? { maxHeight: bodyH } : null}>
            <InquiryCartEditor onDone={onClose} push={push} />
          </div>
          <div className={`h5-cart-pane${seg === 'inbound' ? ' on' : ''}`} style={bodyH ? { maxHeight: bodyH } : null}>
            <InboundCartEditor onDone={onClose} />
          </div>
          <div className={`h5-cart-pane${seg === 'outbound' ? ' on' : ''}`} style={bodyH ? { maxHeight: bodyH } : null}>
            <OutboundCartEditor onDone={onClose} />
          </div>
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
  // 按供货方（商品归属租户）分组展示：提交时每个供货方生成一张询价单，
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
      {lines.length === 0 && <H5Empty icon="cart" message="Inquiry staging is empty" hint="Add upstream products while browsing the sourcing channel" />}
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
                      <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{p.model} · {t('Channel Sales Price')} <b style={{ color: '#D35400' }}>{money(p.price, p.currency).text}</b></div>
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
        <div className="h5-act-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <button type="button" className="h5-btn" onClick={() => { cartApi.clear('inquiry'); toast('Inquiry staging cleared', 'info'); }}><Icon name="trash" size={14} />{t('Clear')}</button>
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
// 供货方设置与出库收货方同一套交互：上游租户下拉（选中显示 名称 · 电话）
// + 手动输入（名称/手机号表单，提交时以 createSupplier 建档后选用）；
// 每行单价可独立设置币种，行金额与合计按币种分别小计（演示不折算）。
function InboundCartEditor({ onDone }) {
  const { db, account, act, carts, cartApi, toast } = useApp();
  const [note, setNote] = useState('');
  const [supId, setSupId] = useState('');
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const lines = carts.inbound || [];
  const stockOf = pid => (db.stock[account.tenantId] || {})[pid] || 0;
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  // 供货方候选：上游租户（供应商/上级代理）+ 已建档往来供货方（Supplier 型租户，
  // 含手动输入路径当场新建的），去重后上游优先
  const upstream = [...upstreamTenantIds(db, account.tenantId)]
    .map(id => db.tenants.find(x => x.id === id)).filter(x => x && x.status === 'Active');
  const filedSuppliers = db.tenants.filter(x => x.status === 'Active' && x.type === 'Supplier'
    && x.id !== account.tenantId && !upstream.some(u => u.id === x.id));
  const supOptions = upstream.concat(filedSuppliers);
  const supTenant = supOptions.find(x => x.id === supId);
  const supTenantPhone = supTenant
    ? ((db.accounts.find(a => a.tenantId === supTenant.id && a.main) || {}).phone || supTenant.contactPhone || '')
    : '';
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
  const confirm = () => {
    let sid = supId;
    if (supId === 'custom') {
      const name = String(supName || '').trim();
      if (!name) { toast('Supplier name is required', 'error'); return; }
      // 手动输入 → 当场建档（Supplier 型租户），本次选用且后续可再选；
      // 直接把新租户对象传给 submitInbound（同一次点击内 setDb 尚未生效）
      const tn = act.createSupplier({ name, phone: String(supPhone || '').trim() });
      sid = tn;
    } else if (!supId) { toast('Select or enter a supplier for the stock-in', 'error'); return; }
    if (cartApi.submitInbound(sid, note) && onDone) onDone();
  };
  return (
    <div>
      <div className="h5-cart-scroll">
      {lines.length === 0 && <H5Empty icon="warehouse" message="Inbound staging is empty" hint="Scan barcodes, or tap Stock In on the My Warehouse list" />}
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
                  <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{p.model} · {t('On Hand')} {onHand} {p.unit}</div>
                </div>
                <span className="h5-back" title={t('Remove')} onClick={() => cartApi.removeAt('inbound', i)} style={{ color: 'var(--danger)' }}><Icon name="trash" size={16} /></span>
              </div>
            {/* 物料单价（默认参考价/渠道价，可改）+ 独立币种 → 行金额 = 单价 × 数量；单价在前、数量在后 */}
              <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="muted" style={{ fontSize: 11.5 }}>{t('Unit Price')}</span>
                <span className="flex" style={{ alignItems: 'center', gap: 6 }}>
                  <Select value={lineCur(l, p)} onChange={v => cartApi.setField('inbound', i, 'currency', v)}
                    options={CURRENCIES.map(c => ({ value: c, label: c }))} style={{ height: 30, width: 82 }} />
                  <input className="input mono" style={{ height: 30, width: 92, textAlign: 'right' }} type="number" min="0" step="0.01"
                    value={ifnull(l.unitPrice, 0)} aria-label={t('Unit Price')} onChange={e => cartApi.setField('inbound', i, 'unitPrice', e.target.value)} />
                </span>
              </div>
            <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted mono" style={{ fontSize: 11.5 }}>{p.unit} × {l.qty}</span>
              <CartStepper value={l.qty} onChange={q => cartApi.setQty('inbound', i, q)} />
            </div>
              <div className="flex mt4" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="muted mono" style={{ fontSize: 11 }}>{onHand} → {onHand + qty} {p.unit}</span>
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
                <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{l.code || '—'}</div>
              </div>
              <span className="h5-back" title={t('Remove')} onClick={() => cartApi.removeAt('inbound', i)} style={{ color: 'var(--danger)' }}><Icon name="trash" size={16} /></span>
            </div>
            <div className="h5-form-row mt8" style={{ marginBottom: 0 }}><span className="k">{t('Name')} *</span><div style={{ flex: 1 }}><input className="input" style={{ height: 32, width: '100%' }} value={l.name} onChange={e => cartApi.setField('inbound', i, 'name', e.target.value)} placeholder={t('e.g. Solar Inverter 5kW')} /></div></div>
            <div className="h5-form-row" style={{ marginBottom: 0 }}><span className="k">{t('Unit')}</span><div style={{ flex: 1 }}><Select value={l.unit} onChange={v => cartApi.setField('inbound', i, 'unit', v)} options={['pcs', 'set', 'box', 'kg'].map(u => ({ value: u, label: u }))} style={{ height: 32 }} /></div></div>
            <div className="h5-form-row" style={{ marginBottom: 0 }}><span className="k">{t('Price')}</span>
              <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                <Select value={l.currency || 'USD'} onChange={v => cartApi.setField('inbound', i, 'currency', v)}
                  options={CURRENCIES.map(c => ({ value: c, label: c }))} style={{ height: 32, width: 84 }} />
                <input className="input" style={{ height: 32, flex: 1, minWidth: 0 }} type="number" value={l.price} onChange={e => cartApi.setField('inbound', i, 'price', e.target.value)} placeholder="0.00 (editable later)" />
              </div>
            </div>
            <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted mono" style={{ fontSize: 11.5 }}>{l.unit} × {(Number(l.qty) || 0)}</span>
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
              <span className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>{`${lines.length} items · ${totalQty} units`}</span>
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
            <div className="h5-form-row">
              <span className="k">{t('Supplier')} *</span>
              <div style={{ flex: 1 }}>
                <Select value={supId} onChange={v => { setSupId(v); if (v !== 'custom') { setSupName(''); setSupPhone(''); } }} placeholder={t('Select supplier')}
                  options={supOptions.map(x => ({ value: x.id, label: x.name + (x.type === 'Supplier' ? '' : ' (' + x.type + ')') }))
                    .concat([{ value: 'custom', label: t('Custom supplier…') }])} style={{ height: 32 }} />
              </div>
            </div>
            {supId === 'custom' && (
              <React.Fragment>
                <div className="h5-form-row">
                  <span className="k">{t('Supplier name')} *</span>
                  <div style={{ flex: 1 }}><input className="input" style={{ height: 32, width: '100%' }} value={supName} onChange={e => setSupName(e.target.value)} placeholder={t('e.g. Sunrise Trading Co.')} /></div>
                </div>
                <div className="h5-form-row" style={{ marginBottom: 0 }}>
                  <span className="k">{t('Supplier phone')}</span>
                  <div style={{ flex: 1 }}><input className="input" style={{ height: 32, width: '100%' }} value={supPhone} onChange={e => setSupPhone(e.target.value)} placeholder="+234 …" /></div>
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.5 }}><Icon name="info" size={11} /> {t('The supplier is filed as a partner record and becomes immediately selectable for this and future stock-in.')}</div>
              </React.Fragment>
            )}
            {supTenant && supTenantPhone && (
              <div className="muted mono" style={{ fontSize: 11, marginTop: 6 }}>{supTenant.name} · {supTenantPhone}</div>
            )}
            <div className="h5-form-row" style={{ marginBottom: 0 }}>
              <span className="k">{t('Stock-in note (optional)')}</span>
              <input className="input" style={{ height: 32, flex: 1 }} value={note} onChange={e => setNote(e.target.value)} placeholder={t('e.g. purchase arrival')} />
            </div>
          </div>
        </React.Fragment>
      )}
      </div>
      {lines.length > 0 && (
        <div className="h5-act-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <button type="button" className="h5-btn" onClick={() => { cartApi.clear('inbound'); toast('Inbound staging cleared', 'info'); }}><Icon name="trash" size={14} />{t('Clear')}</button>
          <button type="button" className="h5-btn primary" onClick={confirm}><Icon name="download" size={14} />{t('Confirm Stock In')}</button>
        </div>
      )}
    </div>
  );
}

// ---------- outbound cart (mobile) ----------
function OutboundCartEditor({ onDone }) {
  const { db, account, carts, cartApi, toast } = useApp();
  const [note, setNote] = useState('');
  // 收货方：可从下游租户选择，也可手动输入名称（可选手机号）；提交后随出库单留痕
  const [recvId, setRecvId] = useState('');
  const [recvName, setRecvName] = useState('');
  const [recvPhone, setRecvPhone] = useState('');
  const lines = carts.outbound || [];
  const stockOf = pid => (db.stock[account.tenantId] || {})[pid] || 0;
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  // 实际销售价：默认取渠道销售价及其币种，可在行内改价/改币种；
  // 行金额 = 实际销售价 × 数量，合计按币种分别小计（与入库一致）
  const saleCur = (l, p) => l.saleCurrency || (p ? p.currency : 'USD') || 'USD';
  const saleNum = (l, p) => Number(ifnull(l.salePrice, p ? p.price : 0)) || 0;
  const totalsByCur = {};
  lines.forEach(l => {
    const p = db.products.find(x => x.id === l.pid) || {};
    const cur = saleCur(l, p);
    totalsByCur[cur] = (totalsByCur[cur] || 0) + saleNum(l, p) * (Number(l.qty) || 0);
  });
  const downstream = db.relations.filter(r => r.upstream === account.tenantId)
    .map(r => db.tenants.find(x => x.id === r.downstream)).filter(x => x && x.status === 'Active');
  const recvTenant = downstream.find(x => x.id === recvId);
  const recvTenantPhone = recvTenant ? ((db.accounts.find(a => a.tenantId === recvTenant.id && a.main) || {}).phone || '') : '';
  const confirm = () => {
    const recv = recvId === 'custom'
      ? { name: recvName.trim(), phone: recvPhone.trim() }
      : recvTenant ? { name: recvTenant.name, phone: recvTenantPhone, tenantId: recvTenant.id } : null;
    if (!recv || !recv.name) { toast('Select or enter a receiver for the outbound', 'error'); return; }
    if (cartApi.submitOutbound(note, recv) && onDone) onDone();
  };
  return (
    <div>
      <div className="h5-cart-scroll">
      {lines.length === 0 && <H5Empty icon="truck" message="Outbound staging is empty" hint="Scan items, or tap Stock Out on the My Warehouse list" />}
      {lines.map((l, i) => {
        const p = db.products.find(x => x.id === l.pid) || {};
        const onHand = stockOf(l.pid);
        const qty = Number(l.qty) || 0;
        return (
          <div key={l.pid} className="h5-card" style={{ marginBottom: 8, padding: 12 }}>
            <div className="flex gap10" style={{ alignItems: 'center' }}>
              <img src={prodImg(p)} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{p.model} · {t('On Hand')} {onHand} {p.unit}</div>
              </div>
              <span className="h5-back" title={t('Remove')} onClick={() => cartApi.removeAt('outbound', i)} style={{ color: 'var(--danger)' }}><Icon name="trash" size={16} /></span>
            </div>
            {/* 价格体系：市场指导价 / 渠道销售价只读参考；实际销售价可改（默认渠道价及其币种）；价格区块在前、数量在后 */}
            <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted mono" style={{ fontSize: 11 }}>{t('Market Reference Price')}: <b>{money(ifnull(p.marketPrice, p.price), marketCurOf(p)).text}</b></span>
              <span className="muted mono" style={{ fontSize: 11 }}>{t('Channel Sales Price')}: <b>{money(p.price, p.currency).text}</b></span>
            </div>
            <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted" style={{ fontSize: 11.5 }}>{t('Actual Sales Price')}</span>
              <span className="flex" style={{ alignItems: 'center', gap: 6 }}>
                <Select value={saleCur(l, p)} onChange={v => cartApi.setField('outbound', i, 'saleCurrency', v)}
                  options={CURRENCIES.map(c => ({ value: c, label: c }))} style={{ height: 30, width: 82 }} />
                <input className="input mono" style={{ height: 30, width: 92, textAlign: 'right' }} type="number" min="0" step="0.01"
                  value={ifnull(l.salePrice, ifnull(p.price, 0))} aria-label={t('Actual Sales Price')} onChange={e => cartApi.setField('outbound', i, 'salePrice', e.target.value)} />
              </span>
            </div>
            <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted mono" style={{ fontSize: 11.5 }}>{p.unit} × {l.qty}</span>
              <CartStepper value={l.qty} onChange={q => cartApi.setQty('outbound', i, q)} />
            </div>
            <div className="flex mt4" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted mono" style={{ fontSize: 11 }}>{onHand} → {onHand - qty} {p.unit}</span>
              <span className="mono" style={{ fontSize: 11.5 }}>{t('Amount')}: <b style={{ color: '#D35400' }}>{money(qty * saleNum(l, p), saleCur(l, p)).text}</b></span>
            </div>
            {qty > onHand && <div style={{ color: 'var(--danger)', fontSize: 11.5, marginTop: 4, textAlign: 'right' }}>{t('Exceeds on-hand quantity')}</div>}
          </div>
        );
      })}
      {lines.length > 0 && (
        <React.Fragment>
          <div className="h5-card" style={{ padding: 12 }}>
            <div className="h5-form-row">
              <span className="k">{t('Receiver')} *</span>
              <div style={{ flex: 1 }}>
                <Select value={recvId} onChange={v => { setRecvId(v); if (v !== 'custom') { setRecvName(''); setRecvPhone(''); } }} placeholder={t('Select receiver')}
                  options={downstream.map(x => ({ value: x.id, label: x.name + (x.type === 'Supplier' ? '' : ' (' + x.type + ')') }))
                    .concat([{ value: 'custom', label: t('Custom receiver…') }])} style={{ height: 32 }} />
              </div>
            </div>
            {recvId === 'custom' && (
              <React.Fragment>
                <div className="h5-form-row">
                  <span className="k">{t('Receiver name')} *</span>
                  <div style={{ flex: 1 }}><input className="input" style={{ height: 32, width: '100%' }} value={recvName} onChange={e => setRecvName(e.target.value)} placeholder={t('e.g. Sunrise Retail Store')} /></div>
                </div>
                <div className="h5-form-row" style={{ marginBottom: 0 }}>
                  <span className="k">{t('Receiver phone')}</span>
                  <div style={{ flex: 1 }}><input className="input" style={{ height: 32, width: '100%' }} value={recvPhone} onChange={e => setRecvPhone(e.target.value)} placeholder="+234 …" /></div>
                </div>
              </React.Fragment>
            )}
            {recvTenant && recvTenantPhone && (
              <div className="muted mono" style={{ fontSize: 11, marginTop: 6 }}>{recvTenant.name} · {recvTenantPhone}</div>
            )}
            <div className="h5-form-row" style={{ marginBottom: 0 }}>
              <span className="k">{t('Outbound note (optional)')}</span>
              <input className="input" style={{ height: 32, flex: 1 }} value={note} onChange={e => setNote(e.target.value)} placeholder={t('e.g. transfer to another warehouse')} />
            </div>
          </div>
          {/* 合计金额 = Σ(实际销售价 × 数量)；多币种按币种分别小计，逐币种上下堆叠（与入库一致） */}
          <div className="h5-card" style={{ padding: '10px 12px', marginBottom: Object.keys(totalsByCur).length > 1 ? 4 : 8 }}>
            <div className="flex" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <span className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>{`${lines.length} items · ${totalQty} units`}</span>
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
        </React.Fragment>
      )}
      </div>
      {lines.length > 0 && (
        <div className="h5-act-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <button type="button" className="h5-btn" onClick={() => { cartApi.clear('outbound'); toast('Outbound staging cleared', 'info'); }}><Icon name="trash" size={14} />{t('Clear')}</button>
          <button type="button" className="h5-btn primary" onClick={confirm}><Icon name="truck" size={14} />{t('Confirm Stock Out')}</button>
        </div>
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

Object.assign(window, {
  emptyCarts, cartTotalCount, CART_MODULES, CURRENCIES,
  CartStepper, H5CartFab, WebCartFab, H5CartSheet,
  InquiryCartEditor, InboundCartEditor, OutboundCartEditor,
  NewSupplierDialog,
});
