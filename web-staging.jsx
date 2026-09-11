// ============================================================
// web-staging.jsx — Web console staging dialog (3 modules) and
// the desktop WhatsApp window opened after an inquiry submit.
// Mirrors the mobile staging editors in cart.jsx:
//   - inquiry : grouped by supplier → one inquiry per supplier,
//               then each supplier's WhatsApp chat opens
//   - inbound : per-line unit price (default = market ref price),
//               amount = price × qty, footer total, supplier required
//   - outbound: required receiver (downstream tenant with phone,
//               or custom name + phone) recorded on the OUT movements
// Same carts / cartApi / document numbering as the mobile side —
// one staging dataset shared by both ends.
// ============================================================

function WebStagingDialog({ onClose, onInquired }) {
  const { carts } = useApp();
  const [seg, setSeg] = useState(() => (carts.inquiry.length ? 'inquiry' : carts.inbound.length ? 'inbound' : 'outbound'));
  const mods = [
    { id: 'inquiry', label: t('Inquiry Staging'), n: (carts.inquiry || []).length },
    { id: 'inbound', label: t('Inbound Staging'), n: (carts.inbound || []).length },
    { id: 'outbound', label: t('Outbound Staging'), n: (carts.outbound || []).length },
  ];
  return (
    <Dialog title={t('Staging')} width="880px" onClose={onClose}>
      <div className="segments" style={{ marginBottom: 16 }}>
        {mods.map(m => (
          <button key={m.id} type="button" className={`segment${seg === m.id ? ' active' : ''}`} onClick={() => setSeg(m.id)}>
            {m.label}{m.n > 0 ? ` (${m.n})` : ''}
          </button>
        ))}
      </div>
      {seg === 'inquiry' && <WebInquiryPanel onInquired={onInquired} />}
      {seg === 'inbound' && <WebInboundPanel onDone={onClose} />}
      {seg === 'outbound' && <WebOutboundPanel onDone={onClose} />}
    </Dialog>
  );
}

// ---------- inquiry staging (web) — grouped by supplier ----------
function WebInquiryPanel({ onInquired }) {
  const { db, carts, cartApi, toast } = useApp();
  const [date, setDate] = useState('');
  const lines = carts.inquiry || [];
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  // 按供货方（商品归属租户）分组：提交时每个供货方生成一张询价单，
  // 提交后逐个进入该供货方的 WhatsApp 对话（桌面端为弹窗）
  const groups = [];
  lines.forEach((l, i) => {
    const p = db.products.find(x => x.id === l.pid) || {};
    let g = groups.find(x => x.ownerId === p.ownerId);
    if (!g) { g = { ownerId: p.ownerId, lines: [] }; groups.push(g); }
    g.lines.push({ l, i });
  });
  const submit = () => {
    const res = cartApi.submitInquiry(date);
    if (res && res.ok && onInquired) onInquired(res.docs.map(d => d.id));
  };
  if (!lines.length) {
    return <div className="banner info"><Icon name="info" size={15} /><div>{t('Inquiry staging is empty')} — {t('Add upstream products from the Sourcing Channel tab')}.</div></div>;
  }
  return (
    <div>
      <div className="form" style={{ marginBottom: 4 }}>
        <FormRow label="Delivery Date" required>
          <Input value={date} onChange={setDate} type="date" />
        </FormRow>
      </div>
      {groups.map(g => {
        const tn = db.tenants.find(x => x.id === g.ownerId);
        return (
          <div key={g.ownerId} className="card" style={{ marginBottom: 12 }}>
            <div className="flex gap8" style={{ alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border-light)' }}>
              <span className="wa-avatar" style={{ width: 28, height: 28, fontSize: 13 }}>{tn ? tn.name[0] : '?'}</span>
              <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 13.5 }}>{tn ? tn.name : g.ownerId}</div>
              <span className="mini-chip wa"><Icon name="whatsapp" size={11} />{t('1 inquiry / supplier')}</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Product</th><th style={{ width: 130 }}>Ref Price</th><th style={{ width: 110 }}>Qty</th><th style={{ width: 40 }}></th></tr></thead>
                <tbody>
                  {g.lines.map(({ l, i }) => {
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
                        <td><Money amount={p.price || 0} currency={p.currency} /></td>
                        <td><Input value={String(l.qty)} onChange={v => cartApi.setQty('inquiry', i, Math.max(0, parseInt(v, 10) || 0))} type="number" /></td>
                        <td><button className="btn sm text error-text" title={t('Remove')} onClick={() => cartApi.removeAt('inquiry', i)}><Icon name="trash" size={13} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <div className="muted small" style={{ marginBottom: 8, lineHeight: 1.6 }}>
        <Icon name="info" size={12} /> {t('Lines are grouped by supplier — one inquiry is created per supplier.')}<br />
        <Icon name="whatsapp" size={12} /> {t("After submitting, each inquiry is sent to the supplier's WhatsApp chat.")}
      </div>
      <div className="flex" style={{ alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }} className="muted small">{`${lines.length} items · ${totalQty} units · ${groups.length} suppliers`}</div>
        <button className="btn error-plain" onClick={() => { cartApi.clear('inquiry'); toast('Inquiry staging cleared', 'info'); }}><Icon name="trash" size={13} />{t('Clear')}</button>
        <button className="btn primary" onClick={submit}><Icon name="whatsapp" size={13} />{t('Submit Inquiry')}</button>
      </div>
    </div>
  );
}

// ---------- inbound staging (web) — unit price / amount / total ----------
function WebInboundPanel({ onDone }) {
  const { db, account, carts, cartApi, toast } = useApp();
  const [note, setNote] = useState('');
  const [supplier, setSupplier] = useState('');
  const [supOpen, setSupOpen] = useState(false);
  const lines = carts.inbound || [];
  const suppliers = db.tenants.filter(x => x.status === 'Active' && x.id !== account.tenantId);
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  // 合计金额：Σ(物料单价 × 数量)（exist 行用暂存单内可改的 unitPrice，new 行用快速建档价）
  const totalAmount = lines.reduce((s, l) => s + (Number(l.kind === 'exist' ? l.unitPrice : l.price) || 0) * (Number(l.qty) || 0), 0);
  const firstExist = lines.find(l => l.kind === 'exist');
  const totalCur = (firstExist ? (db.products.find(p => p.id === firstExist.pid) || {}).currency : 'USD') || 'USD';
  const stockOf = pid => (db.stock[account.tenantId] || {})[pid] || 0;
  const confirm = () => {
    if (!supplier) { toast('Select a supplier for the stock-in', 'error'); return; }
    if (cartApi.submitInbound(supplier, note) && onDone) onDone();
  };
  if (!lines.length) {
    return <div className="banner info"><Icon name="info" size={15} /><div>{t('Inbound staging is empty')} — {t('Stock In on the My Products list adds items here')}.</div></div>;
  }
  return (
    <div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th style={{ width: 110 }}>Qty</th><th style={{ width: 140 }}>{t('Unit Price')}</th><th style={{ width: 150, textAlign: 'right' }}>{t('Amount')}</th><th style={{ width: 40 }}></th></tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const p = l.kind === 'exist' ? (db.products.find(x => x.id === l.pid) || {}) : null;
              const qty = Number(l.qty) || 0;
              const unit = p ? Number(l.unitPrice) || 0 : Number(l.price) || 0;
              const cur = p ? p.currency : 'USD';
              return (
                <tr key={l.kind === 'exist' ? l.pid : 'new-' + i}>
                  <td>
                    {p ? (
                      <div className="flex gap10">
                        <img src={prodImg(p)} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                        <div>
                          <div className="flex gap6" style={{ alignItems: 'center' }}><span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span><Tag tone="success">{t('Existing product')}</Tag></div>
                          <div className="cell-sub mono">{p.model} · {t('On Hand')} {stockOf(l.pid)} {p.unit}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap10">
                        <span className="cell-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}><Icon name="plus" size={16} /></span>
                        <div style={{ minWidth: 220 }}>
                          <input className="input" style={{ height: 30, width: '100%' }} value={l.name} placeholder={t('e.g. Solar Inverter 5kW')} onChange={e => cartApi.setField('inbound', i, 'name', e.target.value)} />
                          <div className="cell-sub mono" style={{ marginTop: 4 }}>{l.code || '—'} · {t('New product — quick profile')}</div>
                        </div>
                      </div>
                    )}
                  </td>
                  <td><Input value={String(l.qty)} onChange={v => cartApi.setQty('inbound', i, Math.max(0, parseInt(v, 10) || 0))} type="number" /></td>
                  <td><div className="flex gap8" style={{ justifyContent: 'flex-end' }}><span className="cur-code">{cur}</span><input className="input mono" style={{ height: 30, width: 110, textAlign: 'right' }} type="number" min="0" step="0.01" aria-label={t('Unit Price')} value={String(ifnull(l.kind === 'exist' ? l.unitPrice : l.price, 0))} onChange={e => cartApi.setField('inbound', i, l.kind === 'exist' ? 'unitPrice' : 'price', e.target.value)} /></div></td>
                  <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontSize: 13 }}><b style={{ color: '#D35400' }}>{money(unit * qty, cur).text}</b></span></td>
                  <td><button className="btn sm text error-text" title={t('Remove')} onClick={() => cartApi.removeAt('inbound', i)}><Icon name="trash" size={13} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* 合计金额 = Σ(物料单价 × 数量) */}
      <div className="flex" style={{ alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, margin: '2px 0 10px' }}>
        <span className="muted small">{`${lines.length} items · ${totalQty} units`}</span>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{t('Total')} <span className="mono" style={{ color: '#D35400' }}>{money(totalAmount, totalCur).full}</span></span>
      </div>
      <div className="form">
        <FormRow label="Supplier" required>
          <div className="flex gap8" style={{ flex: 1, minWidth: 0 }}>
            <Select value={supplier} onChange={v => setSupplier(v)} placeholder={t('Select supplier')}
              options={suppliers.map(x => ({ value: x.id, label: x.name + (x.type === 'Supplier' ? '' : ' (' + x.type + ')') }))} style={{ flex: 1, minWidth: 0 }} />
            <button type="button" className="btn" style={{ flexShrink: 0 }} onClick={() => setSupOpen(true)}><Icon name="plus" size={13} />{t('New Supplier')}</button>
          </div>
        </FormRow>
        <FormRow label="Stock-in note (optional)">
          <Textarea value={note} onChange={setNote} rows={3} placeholder={t('e.g. purchase arrival')} />
        </FormRow>
      </div>
      <div className="flex" style={{ alignItems: 'center', gap: 12, marginTop: 4 }}>
        <div style={{ flex: 1 }} className="muted small">{t('Unit price × qty = stock-in amount')}</div>
        <button className="btn error-plain" onClick={() => { cartApi.clear('inbound'); toast('Inbound staging cleared', 'info'); }}><Icon name="trash" size={13} />{t('Clear')}</button>
        <button className="btn success" onClick={confirm}><Icon name="download" size={13} />{t('Confirm Batch Stock In')}</button>
      </div>
      {supOpen && (
        <NewSupplierDialog onClose={() => setSupOpen(false)} onCreated={tn => { setSupOpen(false); setSupplier(tn.id); }} />
      )}
    </div>
  );
}

// ---------- outbound staging (web) — required receiver ----------
function WebOutboundPanel({ onDone }) {
  const { db, account, carts, cartApi, toast } = useApp();
  const [note, setNote] = useState('');
  // 收货方：可从下游租户选择（显示联系电话），也可手动输入名称＋手机号；提交后随出库流水留痕
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
  if (!lines.length) {
    return <div className="banner info"><Icon name="info" size={15} /><div>{t('Outbound staging is empty')} — {t('Stock Out on the My Products list adds items here')}.</div></div>;
  }
  return (
    <div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th style={{ width: 110 }}>{t('On Hand')}</th><th style={{ width: 110 }}>Qty</th><th style={{ width: 40 }}></th></tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const p = db.products.find(x => x.id === l.pid) || {};
              const onHand = stockOf(l.pid);
              const over = (Number(l.qty) || 0) > onHand;
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
                  <td><span className="mono small">{onHand} {p.unit}</span></td>
                  <td><Input value={String(l.qty)} onChange={v => cartApi.setQty('outbound', i, Math.max(0, parseInt(v, 10) || 0))} type="number" /></td>
                  <td><button className="btn sm text error-text" title={t('Remove')} onClick={() => cartApi.removeAt('outbound', i)}><Icon name="trash" size={13} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="form">
        <FormRow label="Receiver" required>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Select value={recvId} onChange={v => { setRecvId(v); if (v !== 'custom') { setRecvName(''); setRecvPhone(''); } }} placeholder={t('Select receiver')}
              options={downstream.map(x => ({ value: x.id, label: x.name + (x.type === 'Supplier' ? '' : ' (' + x.type + ')') }))
                .concat([{ value: 'custom', label: t('Custom receiver…') }])} />
            {recvTenant && recvTenantPhone && (
              <div className="muted mono small" style={{ marginTop: 4 }}>{recvTenant.name} · {recvTenantPhone}</div>
            )}
          </div>
        </FormRow>
        {recvId === 'custom' && (
          <React.Fragment>
            <FormRow label="Receiver name" required>
              <Input value={recvName} onChange={setRecvName} placeholder={t('e.g. Sunrise Retail Store')} />
            </FormRow>
            <FormRow label="Receiver phone">
              <Input value={recvPhone} onChange={setRecvPhone} placeholder="+234 …" />
            </FormRow>
          </React.Fragment>
        )}
        <FormRow label="Outbound note (optional)">
          <Textarea value={note} onChange={setNote} rows={3} placeholder={t('e.g. transfer to another warehouse')} />
        </FormRow>
      </div>
      <div className="flex" style={{ alignItems: 'center', gap: 12, marginTop: 4 }}>
        <div style={{ flex: 1 }} className="muted small">{`${lines.length} items · ${totalQty} units`}</div>
        <button className="btn error-plain" onClick={() => { cartApi.clear('outbound'); toast('Outbound staging cleared', 'info'); }}><Icon name="trash" size={13} />{t('Clear')}</button>
        <button className="btn warning" onClick={confirm}><Icon name="truck" size={13} />{t('Confirm Batch Outbound')}</button>
      </div>
    </div>
  );
}

// ---------- desktop WhatsApp window (after inquiry submit) ----------
// Single supplier → chat opens directly; several suppliers → the send
// list first (one inquiry per supplier), tap a supplier to open the chat.
// Uses the same WaChatCore as the mobile conversation page, so bubbles,
// negotiation script and quote-card behave identically on both ends.
function WebWhatsAppDialog({ docIds, onOpenDoc, onClose }) {
  const { db } = useApp();
  const [activeId, setActiveId] = useState(null);
  useEffect(() => {
    const h = e => { if (e.key === 'Escape' && onClose) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);
  const docs = (docIds || []).map(id => db.docs.find(d => d.id === id)).filter(d => d);
  if (!docs.length) return null;
  const single = docs.length === 1;
  const activeDocId = activeId || (single ? docs[0].id : null);
  return (
    <div className="web-wa-mask" onMouseDown={e => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="web-wa-window">
        {activeDocId ? (
          <WaChatCore key={activeDocId} docId={activeDocId}
            back={!single ? () => setActiveId(null) : null}
            onClose={onClose}
            onOpenDoc={onOpenDoc} />
        ) : (
          <div className="wa-chat">
            <div className="wa-chat-head">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>WhatsApp</div>
                <div style={{ color: '#B8D8D0', fontSize: 11 }}>{t(docs.length === 1 ? '1 inquiry sent' : docs.length + ' inquiries sent')}</div>
              </div>
              <Icon name="whatsapp" size={18} color="#fff" />
              {onClose && (
                <button type="button" className="wa-back" aria-label="Close" title="Close" onClick={onClose}><Icon name="close" size={17} color="#fff" /></button>
              )}
            </div>
            <div className="wa-banner-mini"><Icon name="info" size={12} /> {t(docs.length + ' inquiries sent via WhatsApp — tap a supplier to open the chat')}</div>
            <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
              {docs.map(d => {
                const sup = db.tenants.find(x => x.id === d.seller);
                const mainAcc = db.accounts.find(a => a.tenantId === d.seller && a.main);
                return (
                  <div key={d.id} className="wa-item" onClick={() => setActiveId(d.id)}>
                    <span className="wa-avatar" style={{ width: 36, height: 36, fontSize: 15 }}>{sup ? sup.name[0] : '?'}</span>
                    <div className="wa-body">
                      <div className="wa-title">{sup ? sup.name : d.seller}</div>
                      <div className="wa-text">{t('Inquiry')} {d.no} · {d.items.length} items · {money(docAmount(d), d.currency).full}</div>
                      <div className="wa-meta">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="checkDouble" size={12} color="#53BDEB" />{t('Sent via WhatsApp · Delivered')}</span>
                        {mainAcc && mainAcc.whatsapp ? <span className="mono">{mainAcc.whatsapp}</span> : null}
                      </div>
                    </div>
                    <Icon name="chevronRight" size={14} color="var(--text-3)" style={{ alignSelf: 'center', flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, {
  WebStagingDialog, WebInquiryPanel, WebInboundPanel, WebOutboundPanel, WebWhatsAppDialog,
});
