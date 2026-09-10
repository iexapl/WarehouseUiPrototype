// ============================================================
// cart.jsx — shopping-cart interaction for Inquiry / Inbound / Outbound
// Cart STATE lives in App (app.jsx) and is exposed through AppCtx as
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
  { id: 'inquiry', label: 'Inquiry Cart', icon: 'edit' },
  { id: 'inbound', label: 'Inbound Cart', icon: 'download' },
  { id: 'outbound', label: 'Outbound Cart', icon: 'truck' },
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
      title={t('Carts')} aria-label={t('Carts')}>
      <Icon name="cart" size={20} />
      <span className="cart-fab-badge">{count > 99 ? '99+' : count}</span>
    </button>
  );
}

function WebCartFab({ count, onClick }) {
  if (!count) return null;
  return (
    <button type="button" className="web-cart-fab" onClick={onClick}
      title={t('Inquiry Cart')} aria-label={t('Inquiry Cart')}>
      <Icon name="cart" size={22} />
      <span className="cart-fab-badge">{count > 99 ? '99+' : count}</span>
    </button>
  );
}

// ============================================================
// Mobile cart sheet — one entry, three module carts on segments
// ============================================================

function H5CartSheet({ onClose }) {
  const { carts } = useApp();
  const [seg, setSeg] = useState(() => (carts.inquiry.length ? 'inquiry' : carts.inbound.length ? 'inbound' : 'outbound'));
  return (
    <div className="h5-cart-mask" onClick={onClose}>
      <div className="h5-cart-sheet" onClick={e => e.stopPropagation()}>
        <div className="h5-cart-grip" />
        <div className="h5-cart-head">
          <div className="h5-cart-title"><Icon name="cart" size={16} /><span>{t('Carts')}</span></div>
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
          {seg === 'inquiry' && <InquiryCartEditor onDone={onClose} />}
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
function InquiryCartEditor({ onDone }) {
  const { db, carts, cartApi, toast } = useApp();
  const [date, setDate] = useState('');
  const lines = carts.inquiry || [];
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const submit = () => {
    const res = cartApi.submitInquiry(date);
    if (res && res.count > 0 && onDone) onDone();
  };
  return (
    <div>
      {lines.length === 0 && <H5Empty icon="cart" message="Inquiry cart is empty" hint="Add upstream products while browsing the sourcing channel" />}
      {lines.map((l, i) => {
        const p = db.products.find(x => x.id === l.pid) || {};
        return (
          <div key={l.pid} className="h5-card" style={{ marginBottom: 8, padding: 12 }}>
            <div className="flex gap10" style={{ alignItems: 'center' }}>
              <img src={prodImg(p)} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{p.model} · {productOwnerName(db, p)}</div>
              </div>
              <span className="h5-back" title={t('Remove')} onClick={() => cartApi.removeAt('inquiry', i)} style={{ color: 'var(--danger)' }}><Icon name="trash" size={16} /></span>
            </div>
            <div className="flex mt8" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted" style={{ fontSize: 11.5 }}>{t('Channel Sales Price')} <b className="mono" style={{ color: '#D35400' }}>{money(p.price, p.currency).text}</b></span>
              <CartStepper value={l.qty} onChange={q => cartApi.setQty('inquiry', i, q)} />
            </div>
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
          </div>
          <div className="h5-act-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>{`${lines.length} items · ${totalQty} units`}</div>
            <button type="button" className="h5-btn" onClick={() => { cartApi.clear('inquiry'); toast('Inquiry cart cleared', 'info'); }}><Icon name="trash" size={14} />{t('Clear')}</button>
            <button type="button" className="h5-btn primary" onClick={submit}><Icon name="check" size={14} />{t('Submit Inquiry')}</button>
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
  const confirm = () => {
    if (!supplier) { toast('Select a supplier for the stock-in', 'error'); return; }
    if (cartApi.submitInbound(supplier, note) && onDone) onDone();
  };
  return (
    <div>
      {lines.length === 0 && <H5Empty icon="warehouse" message="Inbound cart is empty" hint="Scan or enter barcodes on the Scan to Stock In page" />}
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
              <div className="muted mono" style={{ fontSize: 11, marginTop: 4, textAlign: 'right' }}>{onHand} → {onHand + qty} {p.unit}</div>
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
          </div>
        );
      })}
      {lines.length > 0 && (
        <React.Fragment>
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
            <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>{`${lines.length} items · ${totalQty} units`}</div>
            <button type="button" className="h5-btn" onClick={() => { cartApi.clear('inbound'); toast('Inbound cart cleared', 'info'); }}><Icon name="trash" size={14} />{t('Clear')}</button>
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
  const lines = carts.outbound || [];
  const stockOf = pid => (db.stock[account.tenantId] || {})[pid] || 0;
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const confirm = () => {
    if (cartApi.submitOutbound(note) && onDone) onDone();
  };
  return (
    <div>
      {lines.length === 0 && <H5Empty icon="truck" message="Outbound cart is empty" hint="Scan items on the Scan Batch Outbound page" />}
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
            <div className="h5-form-row" style={{ marginBottom: 0 }}>
              <span className="k">{t('Outbound note (optional)')}</span>
              <input className="input" style={{ height: 32, flex: 1 }} value={note} onChange={e => setNote(e.target.value)} placeholder={t('e.g. transfer to another warehouse')} />
            </div>
          </div>
          <div className="h5-act-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>{`${lines.length} items · ${totalQty} units`}</div>
            <button type="button" className="h5-btn" onClick={() => { cartApi.clear('outbound'); toast('Outbound cart cleared', 'info'); }}><Icon name="trash" size={14} />{t('Clear')}</button>
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
    <Dialog title="Inquiry Cart" width="720px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={() => { cartApi.clear('inquiry'); toast('Inquiry cart cleared', 'info'); }}><Icon name="trash" size={13} />Clear</button>
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
          {lines.length === 0 && <div className="banner info"><Icon name="info" size={15} /><div>Inquiry cart is empty — add upstream products from the Sourcing Channel tab.</div></div>}
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
