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
  { id: 'inquiry', label: 'Inquiry Staging', icon: 'edit' },
  { id: 'inbound', label: 'Inbound Staging', icon: 'download' },
  { id: 'outbound', label: 'Outbound Staging', icon: 'truck' },
];

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

function H5CartFab({ count, bottom, onClick }) {
  if (!count) return null;
  return (
    <button type="button" className="h5-cart-fab" style={{ bottom: bottom || 84 }} onClick={onClick}
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
  return (
    <div className="h5-cart-mask" onClick={onClose}>
      <div className="h5-cart-sheet" onClick={e => e.stopPropagation()}>
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
        <div className="h5-cart-body">
          {seg === 'inquiry' && <InquiryCartEditor onDone={onClose} push={push} />}
          {seg === 'inbound' && <InboundCartEditor onDone={onClose} />}
          {seg === 'outbound' && <OutboundCartEditor onDone={onClose} />}
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
          <div className="h5-act-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>{`${lines.length} items · ${totalQty} units · ${groups.length} suppliers`}</div>
            <button type="button" className="h5-btn" onClick={() => { cartApi.clear('inquiry'); toast('Inquiry staging cleared', 'info'); }}><Icon name="trash" size={14} />{t('Clear')}</button>
            <button type="button" className="h5-btn primary" onClick={submit}><Icon name="whatsapp" size={14} />{t('Submit Inquiry')}</button>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

// ---------- inbound cart (mobile) ----------
// Shared by the merged Scan-to-Stock-In page AND the cart sheet: the list
// (existing products restock / new products quick-profiled), the stock-in
// note, the REQUIRED supplier (with on-the-spot New Supplier), and the
// one-tap confirm that records every line as an IN movement.
function InboundCartEditor({ onDone }) {
  const { db, account, carts, cartApi, toast } = useApp();
  const [note, setNote] = useState('');
  const [supplier, setSupplier] = useState('');
  const [supOpen, setSupOpen] = useState(false);
  const lines = carts.inbound || [];
  const stockOf = pid => (db.stock[account.tenantId] || {})[pid] || 0;
  const suppliers = db.tenants.filter(x => x.status === 'Active' && x.id !== account.tenantId);
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  // 合计金额：Σ(物料单价 × 数量)（exist 行用暂存单内可改的 unitPrice，new 行用快速建档价）
  const totalAmount = lines.reduce((s, l) => s + (Number(l.kind === 'exist' ? l.unitPrice : l.price) || 0) * (Number(l.qty) || 0), 0);
  const firstExist = lines.find(l => l.kind === 'exist');
  const totalCur = (firstExist ? (db.products.find(p => p.id === firstExist.pid) || {}).currency : 'USD') || 'USD';
  const confirm = () => {
    if (!supplier) { toast('Select a supplier for the stock-in', 'error'); return; }
    if (cartApi.submitInbound(supplier, note) && onDone) onDone();
  };
  return (
    <div>
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
              <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="muted" style={{ fontSize: 11.5 }}>{t('Qty')} · {p.unit}</span>
                <CartStepper value={l.qty} onChange={q => cartApi.setQty('inbound', i, q)} />
              </div>
              {/* 物料单价（默认参考价/渠道价，可改）→ 行金额 = 单价 × 数量 */}
              <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="muted" style={{ fontSize: 11.5 }}>{t('Unit Price')} · {p.currency}</span>
                <input className="input mono" style={{ height: 30, width: 116, textAlign: 'right' }} type="number" min="0" step="0.01"
                  value={ifnull(l.unitPrice, 0)} aria-label={t('Unit Price')} onChange={e => cartApi.setField('inbound', i, 'unitPrice', e.target.value)} />
              </div>
              <div className="flex mt4" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="muted mono" style={{ fontSize: 11 }}>{onHand} → {onHand + qty} {p.unit}</span>
                <span className="mono" style={{ fontSize: 11.5 }}>{t('Amount')}: <b style={{ color: '#D35400' }}>{money(qty * (Number(l.unitPrice) || 0), p.currency).text}</b></span>
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
            <div className="h5-form-row" style={{ marginBottom: 0 }}><span className="k">{t('Price')}</span><div style={{ flex: 1 }}><input className="input" style={{ height: 32, width: '100%' }} type="number" value={l.price} onChange={e => cartApi.setField('inbound', i, 'price', e.target.value)} placeholder="0.00 (editable later)" /></div></div>
            <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted" style={{ fontSize: 11.5 }}>{t('Qty')} · {l.unit}</span>
              <CartStepper value={l.qty} onChange={q => cartApi.setQty('inbound', i, q)} />
            </div>
            <div className="mono" style={{ fontSize: 11.5, marginTop: 4, textAlign: 'right' }}>{t('Amount')}: <b style={{ color: '#D35400' }}>{money((Number(l.qty) || 0) * (Number(l.price) || 0), 'USD').text}</b></div>
          </div>
        );
      })}
      {lines.length > 0 && (
        <React.Fragment>
          {/* 合计金额 = Σ(物料单价 × 数量) */}
          <div className="h5-card" style={{ padding: '10px 12px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="muted" style={{ fontSize: 12 }}>{`${lines.length} items · ${totalQty} units`}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{t('Total')} <span className="mono" style={{ color: '#D35400' }}>{money(totalAmount, totalCur).text}</span></span>
          </div>
          <div className="h5-card" style={{ padding: 12 }}>
            <div className="h5-form-row">
              <span className="k">{t('Supplier')} *</span>
              <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Select value={supplier} onChange={v => setSupplier(v)} placeholder={t('Select supplier')}
                  options={suppliers.map(x => ({ value: x.id, label: x.name + (x.type === 'Supplier' ? '' : ' (' + x.type + ')') }))} style={{ height: 32, flex: 1, minWidth: 0 }} />
                <button type="button" className="btn" style={{ height: 32, flexShrink: 0 }} onClick={() => setSupOpen(true)}><Icon name="plus" size={13} />{t('New Supplier')}</button>
              </div>
            </div>
            <div className="h5-form-row" style={{ marginBottom: 0 }}>
              <span className="k">{t('Stock-in note (optional)')}</span>
              <input className="input" style={{ height: 32, flex: 1 }} value={note} onChange={e => setNote(e.target.value)} placeholder={t('e.g. purchase arrival')} />
            </div>
          </div>
          <div className="h5-act-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>{t('Unit price × qty = stock-in amount')}</div>
            <button type="button" className="h5-btn" onClick={() => { cartApi.clear('inbound'); toast('Inbound staging cleared', 'info'); }}><Icon name="trash" size={14} />{t('Clear')}</button>
            <button type="button" className="h5-btn primary" onClick={confirm}><Icon name="download" size={14} />{t('Confirm Batch Stock In')}</button>
          </div>
        </React.Fragment>
      )}
      {supOpen && (
        <NewSupplierDialog onClose={() => setSupOpen(false)} onCreated={tn => { setSupOpen(false); setSupplier(tn.id); }} />
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
            <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted" style={{ fontSize: 11.5 }}>{t('Qty')} · {p.unit}</span>
              <CartStepper value={l.qty} onChange={q => cartApi.setQty('outbound', i, q)} />
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
          <div className="h5-act-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>{`${lines.length} items · ${totalQty} units`}</div>
            <button type="button" className="h5-btn" onClick={() => { cartApi.clear('outbound'); toast('Outbound staging cleared', 'info'); }}><Icon name="trash" size={14} />{t('Clear')}</button>
            <button type="button" className="h5-btn primary" onClick={confirm}><Icon name="truck" size={14} />{t('Confirm Batch Outbound')}</button>
          </div>
        </React.Fragment>
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

// ============================================================
// Web console — inquiry cart dialog (scan flows are mobile-only,
// so the web floating cart carries the sourcing-channel picks)
// ============================================================

function WebInquiryCartDialog({ onClose }) {
  const { db, carts, cartApi, toast } = useApp();
  const [date, setDate] = useState('');
  const lines = carts.inquiry || [];
  const submit = () => {
    const res = cartApi.submitInquiry(date);
    if (res && res.count > 0) onClose();
  };
  return (
    <Dialog title={t('Inquiry Staging')} width="720px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={() => { cartApi.clear('inquiry'); toast('Inquiry staging cleared', 'info'); }}><Icon name="trash" size={13} />Clear</button>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn primary" onClick={submit} disabled={!lines.length}><Icon name="check" size={13} />Submit Inquiry</button>
      </React.Fragment>}>
      <div className="form">
        <FormRow label="Delivery Date" required>
          <Input value={date} onChange={setDate} type="date" />
        </FormRow>
        <div className="form-grid-hr"></div>
        <div className="form-row span2">
          <label className="form-label">Item Lines <span className="req">*</span></label>
          {lines.length === 0 && <div className="banner info"><Icon name="info" size={15} /><div>Inquiry staging is empty — add upstream products from the Sourcing Channel tab.</div></div>}
          {lines.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Product</th><th style={{ width: 150 }}>Supplier</th><th style={{ width: 110 }}>Ref Price</th><th style={{ width: 130 }}>Qty</th><th style={{ width: 36 }}></th></tr></thead>
                <tbody>
                  {lines.map((l, i) => {
                    const p = db.products.find(x => x.id === l.pid) || {};
                    return (
                      <tr key={l.pid}>
                        <td>
                          <div className="flex gap10">
                            <img src={prodImg(p)} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                              <div className="cell-sub mono">{p.model}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className="small">{productOwnerName(db, p)}</span></td>
                        <td><Money amount={p.price || 0} currency={p.currency} /></td>
                        <td><Input value={String(l.qty)} onChange={v => cartApi.setQty('inquiry', i, Math.max(0, parseInt(v, 10) || 0))} type="number" /></td>
                        <td><button className="btn sm text danger-text" onClick={() => cartApi.removeAt('inquiry', i)}><Icon name="trash" size={13} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="muted small" style={{ marginTop: 8 }}><Icon name="info" size={12} /> Lines are grouped by supplier — one inquiry is created per supplier.</div>
        </div>
      </div>
    </Dialog>
  );
}

Object.assign(window, {
  emptyCarts, cartTotalCount, CART_MODULES,
  CartStepper, H5CartFab, WebCartFab, H5CartSheet,
  InquiryCartEditor, InboundCartEditor, OutboundCartEditor,
  NewSupplierDialog, WebInquiryCartDialog,
});
