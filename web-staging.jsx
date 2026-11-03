// ============================================================
// web-staging.jsx — Web console staging dialog (3 modules) and
// the desktop WhatsApp window opened after an inquiry submit.
// Mirrors the mobile staging editors in cart.jsx:
//   - inquiry : grouped by supplier → one inquiry per supplier,
//               then each supplier's WhatsApp chat opens
//   - inbound : R07 — supplier first (supplier block above the table;
//               product area disabled until a supplier is selected),
//               per-line unit price, amount = price × qty, totals
//   - outbound: R11 — multi-cart (left cart list + right content),
//               per-cart receiver binding, lines/totals isolated per
//               cart, submit sends the current cart only
// Same carts / cartApi / document numbering as the mobile side —
// one staging dataset shared by both ends.
// ============================================================

function WebStagingDialog({ onClose, onInquired, onWizard, context = 'all' }) {
  const { carts } = useApp();
  const [seg, setSeg] = useState(() => (carts.inquiry.length ? 'inquiry' : inLines(carts).length ? 'inbound' : 'outbound'));
  const allMods = [
    { id: 'inquiry', label: t('Inquiry Staging'), icon: 'inquiry', n: (carts.inquiry || []).length },
    { id: 'inbound', label: t('Inbound Staging'), icon: 'stockIn', n: inLines(carts).length },
    { id: 'outbound', label: t('Outbound Staging'), icon: 'stockOut', n: outLineCount(carts) },
  ];
  // R19 — 按入口上下文过滤（AC-19-05：不渲染，不是禁用）
  const mods = (context && context !== 'all' && allMods.some(m => m.id === context))
    ? allMods.filter(m => m.id === context)
    : allMods;
  // 默认页签不在可见集合时回落到第一个可见模块
  const activeSeg = mods.some(m => m.id === seg) ? seg : mods[0].id;
  return (
    <Dialog title={t('Staging') + (mods.length === 1 ? ' · ' + mods[0].label : '')} width="880px" onClose={onClose}>
      {mods.length === 1 && (
        <div className="muted small" style={{ marginBottom: 12 }}><Icon name="info" size={12} /> {t('Showing the staging list for this entry')}</div>
      )}
      {/* R19/AC-19-07 — 单页签时不渲染切换控件 */}
      {mods.length > 1 && (
      <div className="segments" style={{ marginBottom: 16 }}>
        {mods.map(m => (
          <button key={m.id} type="button" className={`segment${activeSeg === m.id ? ' active' : ''}`} onClick={() => setSeg(m.id)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <NavIcon name={m.icon} size={13} />{m.label}{m.n > 0 ? ` (${m.n})` : ''}
          </button>
        ))}
      </div>
      )}
      {activeSeg === 'inquiry' && <WebInquiryPanel onInquired={onInquired} />}
      {activeSeg === 'inbound' && <WebInboundPanel onDone={p => {
        if (p && p.mode === 'wizard') { onClose(); if (onWizard) onWizard(p.result); }
        else onClose();
      }} />}
      {activeSeg === 'outbound' && <WebOutboundPanel onDone={onClose} />}
    </Dialog>
  );
}

// ---------- inquiry staging (web) — grouped by supplier ----------
function WebInquiryPanel({ onInquired }) {
  const { db, carts, cartApi, toast } = useApp();
  const [date, setDate] = useState('');
  const lines = carts.inquiry || [];
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  // 按供货方（商品归属商户）分组：提交时每个供货方生成一张询价单，
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
                <thead><tr><th>Product</th><th style={{ width: 110 }}>Qty</th><th style={{ width: 40 }}></th></tr></thead>
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
        <div style={{ flex: 1 }} className="muted small">{`${tItems(lines.length)} · ${totalQty} ${t('units')} · ${groups.length} ${t('suppliers')}`}</div>
        <button className="btn error-plain" onClick={() => { cartApi.clear('inquiry'); toast('Inquiry staging cleared', 'info'); }}><Icon name="trash" size={13} />{t('Clear')}</button>
        <button className="btn primary" onClick={submit}><Icon name="whatsapp" size={13} />{t('Submit Inquiry')}</button>
      </div>
    </div>
  );
}

// ---------- inbound staging (web) — supplier first, then lines ----------
// R07 — Web 端表格布局：供应商区块置于表格上方；未选供应商时商品区禁用，
// 扫码/加货在 cartApi.add 处同样被拦（与 H5 同一约束，AC-07-08 双端一致）。
function WebInboundPanel({ onDone }) {
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
  // 行币种：exist 行默认物料币种，new 行默认 USD（行内暂存可携带）
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
    // R06 —— 入库成功后进入两步向导
    const r = cartApi.submitInbound(note);
    if (r && r.ok && onDone) onDone({ mode: 'wizard', result: r });
  };
  return (
    <div>
      {/* R07/AC-07-01、AC-07-04 — 供应商区块置于表格上方；选定后收起为固定卡片（名称+联系方式） */}
      <div className="card" style={{ marginBottom: 12, padding: '10px 14px', borderColor: supplierLocked && !picking ? 'var(--primary)' : undefined }}>
        {!supplierLocked || picking ? (
          <React.Fragment>
            <FormRow label="Supplier" required>
              <div className="flex gap8" style={{ flex: 1, minWidth: 0 }}>
                <Select value="" onChange={chooseSupplier} placeholder={t('Select supplier first')}
                  options={supOptions.map(x => ({ value: x.id, label: x.name + (x.type === 'Supplier' ? '' : ' (' + x.type + ')') }))
                    .concat([{ value: 'self', label: t('Self-produced') }])
                    .concat([{ value: 'custom', label: t('New supplier…') }])} style={{ flex: 1, minWidth: 0 }} />
                <React.Fragment>
                  {/* R09 — 邀请供应商：对未入驻的供货方发邀请码 */}
                  <button type="button" className="btn" style={{ flexShrink: 0 }} onClick={() => setInvOpen(true)}><Icon name="link" size={13} />{t('Invite Supplier')}</button>
                  <button type="button" className="btn" style={{ flexShrink: 0 }} onClick={() => setSupOpen(true)}><Icon name="plus" size={13} />{t('New Supplier')}</button>
                </React.Fragment>
              </div>
            </FormRow>
            <div className="muted small" style={{ marginTop: 8, lineHeight: 1.6 }}><Icon name="info" size={12} /> {t('Select a supplier first — then scan or add products')}</div>
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
            <button type="button" className="btn sm" onClick={() => setPicking(true)}><Icon name="edit" size={13} />{t('Switch')}</button>
          </div>
        )}
      </div>
      {/* R07/AC-07-01 — 未选供应商时商品区禁用（扫码/加货在 cartApi.add 处同样被拦，AC-07-03） */}
      {!supplierLocked && (
        <div className="banner info"><Icon name="lock" size={15} /><div>{t('Product area is disabled until a supplier is selected')}</div></div>
      )}
      {supplierLocked && lines.length === 0 && (
        <div className="banner info"><Icon name="info" size={15} /><div>{t('Inbound staging is empty')} — {t('Stock In on the My Products list adds items here')}.</div></div>
      )}
      {lines.length > 0 && (
        <React.Fragment>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Product</th><th style={{ width: 110 }}>Qty</th><th style={{ width: 140 }}>{t('Purchase Price')}</th><th style={{ width: 150, textAlign: 'right' }}>{t('Amount')}</th><th style={{ width: 40 }}></th></tr></thead>
              <tbody>
                {lines.map((l, i) => {
                  const p = l.kind === 'exist' ? (db.products.find(x => x.id === l.pid) || {}) : null;
                  const qty = Number(l.qty) || 0;
                  const unit = p ? Number(l.unitPrice) || 0 : Number(l.price) || 0;
                  const cur = lineCur(l, p);
                  return (
                    <tr key={l.kind === 'exist' ? l.pid : 'new-' + i}>
                      <td>
                        {p ? (
                          <div className="flex gap10">
                            <img src={prodImg(p)} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                            <div>
                              <div className="flex gap6" style={{ alignItems: 'center' }}><span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span><Tag tone="success">{t('Existing product')}</Tag></div>
                              <div className="cell-sub mono">{p.model} · {t('On Hand')} {stockOf(l.pid)} {t(p.unit)}</div>
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
                      <td><div className="flex gap8" style={{ justifyContent: 'flex-end' }}><span className="cur-code">{cur}</span><input className="input mono" style={{ height: 30, width: 110, textAlign: 'right' }} type="number" min="0" step="0.01" aria-label={t('Purchase Price')} value={String(ifnull(l.kind === 'exist' ? l.unitPrice : l.price, 0))} onChange={e => cartApi.setField('inbound', i, l.kind === 'exist' ? 'unitPrice' : 'price', e.target.value)} /></div></td>
                      <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontSize: 13 }}><b style={{ color: '#D35400' }}>{money(unit * qty, cur).text}</b></span></td>
                      <td><button className="btn sm text error-text" title={t('Remove')} onClick={() => cartApi.removeAt('inbound', i)}><Icon name="trash" size={13} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* 合计金额 = Σ(物料单价 × 数量)；多币种按币种分别小计，逐币种上下堆叠 */}
          <div className="flex" style={{ alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, margin: '2px 0 10px' }}>
            <span className="muted small">{`${tItems(lines.length)} · ${totalQty} ${t('units')}`}</span>
            <div style={{ textAlign: 'right' }}>
              {Object.keys(totalsByCur).map(c => (
                <div key={c} className="mono" style={{ fontSize: 13, fontWeight: 700, color: '#D35400', lineHeight: 1.6 }}>{t('Total')} {money(totalsByCur[c], c).text}</div>
              ))}
              {Object.keys(totalsByCur).length > 1 && (
                <div className="muted" style={{ fontSize: 11, lineHeight: 1.6 }}>{t('Multi-currency lines are subtotaled per currency — demo, no FX conversion')}</div>
              )}
            </div>
          </div>
        </React.Fragment>
      )}
      {supplierLocked && (
        <React.Fragment>
          <div className="form">
            <FormRow label="Stock-in note (optional)">
              <Textarea value={note} onChange={setNote} rows={3} placeholder={t('e.g. purchase arrival')} />
            </FormRow>
          </div>
          <div className="flex" style={{ alignItems: 'center', gap: 12, marginTop: 4 }}>
            <div style={{ flex: 1 }} className="muted small">{t('Unit price × qty = stock-in amount')}</div>
            <button className="btn error-plain" onClick={() => { cartApi.clear('inbound'); toast('Inbound staging cleared', 'info'); }}><Icon name="trash" size={13} />{t('Clear')}</button>
            <button className="btn success" onClick={confirm}><NavIcon name="stockIn" size={13} />{t('Confirm Batch Stock In')}</button>
          </div>
        </React.Fragment>
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

// ---------- outbound staging (web) — multi-cart, required receiver ----------
// R11 — Web 端两栏布局：左侧车列表（收货方名 + 件数，切车/新建/删车），
// 右侧当前车内容（收货方绑定 + 行表格 + 备注 + 提交）；
// 行/价/合计随车隔离，提交仅提交当前车（AC-11-04/05/07）。
function WebOutboundPanel({ onDone }) {
  const { db, account, carts, cartApi, toast } = useApp();
  const [note, setNote] = useState('');
  const [delCart, setDelCart] = useState(null);   // R11 — 待删除确认的车（AC-11-08）
  const [picking, setPicking] = useState(false);  // 收货方已绑定时点「更换」回到选择态
  const [custom, setCustom] = useState(false);    // 自由输入收货方表单
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  // R11 — outbound 是车数组；编辑器只操作当前车，各行随车隔离
  const cartsList = outCarts(carts);
  const cur = activeCart(carts) || { id: '', receiver: null, lines: [] };
  const cartId = cur.id;
  const lines = cur.lines || [];
  const recv = cur.receiver || null;
  const stockOf = pid => (db.stock[account.tenantId] || {})[pid] || 0;
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const downstream = db.relations.filter(r => r.upstream === account.tenantId)
    .map(r => db.tenants.find(x => x.id === r.downstream)).filter(x => x && x.status === 'Active');
  const recvTenantPhone = id => ((db.accounts.find(a => a.tenantId === id && a.main) || {}).phone || '');
  // R10 —— Web 出库金额计算（与 H5 OutboundCartEditor / docAmountBreakdown 同口径）
  const saleCur = (l, p) => l.saleCurrency || (p ? p.currency : 'USD') || 'USD';
  const saleNum = (l, p) => Number(ifnull(l.salePrice, p ? p.price : 0)) || 0;
  const cartPct = (cur.discountPct === undefined || cur.discountPct === null) ? 0 : (Number(cur.discountPct) || 0);
  const lineAmts = {};
  let amtSubtotal = 0, amtDiscount = 0;
  lines.forEach(l => {
    const p = db.products.find(x => x.id === l.pid) || {};
    const rowPct = (l.discountPct === undefined || l.discountPct === null) ? cartPct : (Number(l.discountPct) || 0);
    const gross = Math.round(saleNum(l, p) * (Number(l.qty) || 0) * 100) / 100;
    const net = Math.round(gross * (1 - rowPct / 100) * 100) / 100;
    lineAmts[l.pid] = { gross: gross, net: net, saving: Math.round((gross - net) * 100) / 100, pct: rowPct };
    amtSubtotal += gross; amtDiscount += gross - net;
  });
  const settings = db.settings || {};
  const taxRate = (settings.taxRate === undefined || settings.taxRate === null) ? null : Number(settings.taxRate);
  const amtTax = taxRate === null ? 0 : Math.round((amtSubtotal - amtDiscount) * taxRate) / 100;
  const amtFreight = (cur.freight === undefined || cur.freight === null) ? (settings.freightEnabled ? Number(settings.defaultFreight) || 0 : 0) : Number(cur.freight);
  const amtCurrency = (lines[0] ? saleCur(lines[0], db.products.find(x => x.id === lines[0].pid) || {}) : 'USD');
  const amtSummary = {
    subtotal: Math.round(amtSubtotal * 100) / 100,
    discountTotal: Math.round(amtDiscount * 100) / 100,
    taxAmount: amtTax, taxRate: taxRate, freight: amtFreight,
    total: Math.round((amtSubtotal - amtDiscount + amtTax + amtFreight) * 100) / 100,
    currency: amtCurrency,
  };
  // 车标签：收货方名（未绑定显示「未绑定」）；同名收货方按出现次序加 #n（AC-11-03，渲染时判定）
  const labels = cartsList.map(c => (c.receiver && c.receiver.name) || '');
  const cartTitle = (idx) => {
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
      {/* R11/AC-11-09 — 原型不持久化，刷新后恢复初始演示态（界面标注） */}
      <div className="muted small" style={{ marginBottom: 10, lineHeight: 1.6 }}><Icon name="info" size={12} /> {t('Prototype only — carts are not persisted; refresh restores the initial state')}</div>
      <div className="flex" style={{ gap: 12, alignItems: 'flex-start' }}>
        {/* 左栏 — 车列表：切车 / 新建车 / 删车（删最后一辆车时自动补一辆空车） */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div className="card" style={{ padding: 6 }}>
            {cartsList.map((c, idx) => {
              const on = c.id === cartId;
              const n = (c.lines || []).length;
              return (
                <div key={c.id} className="flex gap6" style={{ alignItems: 'center', padding: 4, borderRadius: 8, background: on ? 'var(--primary-light)' : 'transparent' }}>
                  <button type="button" style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 0, background: 'transparent', cursor: 'pointer', padding: '4px 6px', fontFamily: 'inherit' }}
                    onClick={() => cartApi.switchCart(c.id)} title={cartTitle(idx)}>
                    <div style={{ fontSize: 12.5, fontWeight: on ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cartTitle(idx)}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{n} {n === 1 ? 'item' : 'items'}</div>
                  </button>
                  <button type="button" className="btn sm text error-text" style={{ flexShrink: 0 }} title={t('Delete this cart?')} onClick={() => setDelCart(c.id)}><Icon name="trash" size={13} /></button>
                </div>
              );
            })}
            <button type="button" className="btn sm" style={{ width: '100%', marginTop: 4, borderStyle: 'dashed' }}
              onClick={() => { if (cartApi.newCart() === false) toast('Cart limit reached (10)', 'warning'); }}><Icon name="plus" size={12} />{t('New Cart')}</button>
          </div>
        </div>
        {/* 右栏 — 当前车：收货方绑定 + 行表格 + 备注 + 提交 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card" style={{ marginBottom: 10, padding: '10px 14px', borderColor: recv && !picking ? 'var(--primary)' : undefined }}>
            {!recv || picking ? (
              <React.Fragment>
                <FormRow label="Receiver" required>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Select value="" onChange={v => {
                      if (v === 'custom') { setCustom(true); return; }
                      setCustom(false);
                      const tn = downstream.find(x => x.id === v);
                      if (tn) bindReceiver({ name: tn.name, phone: recvTenantPhone(tn.id), tenantId: tn.id });
                    }} placeholder={t('Select receiver')}
                      options={downstream.map(x => ({ value: x.id, label: x.name + (x.type === 'Supplier' ? '' : ' (' + x.type + ')') }))
                        .concat([{ value: 'custom', label: t('Custom receiver…') }])} />
                  </div>
                </FormRow>
                {custom && (
                  <React.Fragment>
                    <FormRow label="Receiver name" required>
                      <Input value={custName} onChange={setCustName} placeholder={t('e.g. Sunrise Retail Store')} />
                    </FormRow>
                    <FormRow label="Receiver phone">
                      <div className="flex gap8" style={{ flex: 1, minWidth: 0 }}>
                        <Input value={custPhone} onChange={setCustPhone} placeholder="+234 …" />
                        <button type="button" className="btn primary" style={{ flexShrink: 0 }} onClick={applyCustom}><Icon name="check" size={13} />{t('Bind Receiver')}</button>
                      </div>
                    </FormRow>
                  </React.Fragment>
                )}
                <div className="muted small" style={{ marginTop: 8, lineHeight: 1.6 }}><Icon name="info" size={12} /> {t('Bind a receiver for this cart before adding items')}</div>
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
                <button type="button" className="btn sm" onClick={() => setPicking(true)}><Icon name="edit" size={13} />{t('Switch')}</button>
              </div>
            )}
          </div>
          {lines.length === 0 && (
            <div className="banner info"><Icon name="info" size={15} /><div>{t('This cart is empty')} — {t('Stock Out on the My Products list adds items here')}.</div></div>
          )}
          {lines.length > 0 && (
            <React.Fragment>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Product</th><th style={{ width: 90 }}>{t('On Hand')}</th><th style={{ width: 80 }}>Qty</th><th style={{ width: 180 }}>{t('Channel sale price')}</th><th style={{ width: 100 }}>{t('Line discount')}</th><th style={{ width: 150 }} className="right">{t('Amount')}</th><th style={{ width: 40 }}></th></tr></thead>
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
                          <td><span className="mono small">{onHand} {t(p.unit)}</span></td>
                          <td><Input value={String(l.qty)} onChange={v => cartApi.setQty('outbound', i, Math.max(0, parseInt(v, 10) || 0), cartId)} type="number" /></td>
                          <td>
                            <div className="flex gap6" style={{ alignItems: 'center' }}>
                              <Select value={saleCur(l, p)} onChange={v => cartApi.setField('outbound', i, 'saleCurrency', v, cartId)}
                                options={CURRENCIES.map(c => ({ value: c, label: c }))} style={{ width: 78 }} />
                              <Input value={String(ifnull(l.salePrice, ifnull(p.price, 0)))} onChange={v => cartApi.setField('outbound', i, 'salePrice', v, cartId)} type="number" style={{ width: 88 }} />
                            </div>
                          </td>
                          <td>
                            <div className="flex gap6" style={{ alignItems: 'center' }}>
                              <Input value={l.discountPct === undefined || l.discountPct === null ? '' : String(l.discountPct)} placeholder={cur.discountPct !== undefined && cur.discountPct !== null ? String(cur.discountPct) : '0'} onChange={v => cartApi.setField('outbound', i, 'discountPct', v === '' ? null : Number(v), cartId)} type="number" style={{ width: 64 }} />
                              <span className="muted mono small">%</span>
                            </div>
                          </td>
                          <td>
                            <div className="mono small">{t('Original')} {money(lineAmts[l.pid].gross, saleCur(l, p)).text}</div>
                            <div className="mono small" style={{ color: '#D35400' }}>{t('Discounted')} {money(lineAmts[l.pid].net, saleCur(l, p)).text}</div>
                            {saleNum(l, p) * (1 - (lineAmts[l.pid].pct || 0) / 100) < (purchasePriceOf(p) || 0) && (
                              <div className="flex gap6" style={{ alignItems: 'center', justifyContent: 'flex-end', color: 'var(--warning)', fontSize: 11 }}><Icon name="warn" size={11} />{t('Discounted price is below the purchase price — please double-check')}</div>
                            )}
                          </td>
                          <td><button className="btn sm text error-text" title={t('Remove')} onClick={() => cartApi.removeAt('outbound', i, cartId)}><Icon name="trash" size={13} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* R10 —— 整体折扣 + 运费 + 五行汇总（与 H5 出库暂存一致；税率未设定不显示税额行） */}
              <div className="card" style={{ marginTop: 10, padding: '10px 14px' }}>
                <div className="flex gap16" style={{ flexWrap: 'wrap', rowGap: 8, alignItems: 'center' }}>
                  <div className="flex gap8" style={{ alignItems: 'center' }}>
                    <span className="muted small">{t('Request discount')}</span>
                    <Input value={cur.discountPct === undefined || cur.discountPct === null ? '' : String(cur.discountPct)} placeholder="0" onChange={v => cartApi.setCartField(cartId, 'discountPct', v === '' ? null : Number(v))} type="number" style={{ width: 84 }} />
                    <span className="muted mono small">%</span>
                  </div>
                  <div className="flex gap8" style={{ alignItems: 'center' }}>
                    <span className="muted small">{t('Courier fee amount')}</span>
                    <Input value={cur.freight === undefined || cur.freight === null ? '' : String(cur.freight)} placeholder="0" onChange={v => cartApi.setCartField(cartId, 'freight', v === '' ? null : Number(v))} type="number" style={{ width: 84 }} />
                    <span className="muted mono small">{t('Freight')}</span>
                  </div>
                </div>
                <div className="mt8" style={{ maxWidth: 340, marginLeft: 'auto' }}>
                  <AmountSummary subtotal={amtSummary.subtotal} discountTotal={amtSummary.discountTotal} taxAmount={amtSummary.taxAmount} taxRate={amtSummary.taxRate} freight={amtSummary.freight} total={amtSummary.total} currency={amtSummary.currency} />
                </div>
              </div>
              <div className="form" style={{ marginTop: 10 }}>
                <FormRow label="Outbound note (optional)">
                  <Textarea value={note} onChange={setNote} rows={3} placeholder={t('e.g. transfer to another warehouse')} />
                </FormRow>
              </div>
              <div className="flex" style={{ alignItems: 'center', gap: 12, marginTop: 4 }}>
                <div style={{ flex: 1 }} className="muted small">{`${tItems(lines.length)} · ${totalQty} ${t('units')}`}</div>
                <button className="btn error-plain" onClick={() => { cartApi.clear('outbound'); toast('This cart cleared', 'info'); }}><Icon name="trash" size={13} />{t('Clear')}</button>
                <button className="btn warning" onClick={confirm}><NavIcon name="stockOut" size={13} />{t('Confirm Batch Outbound')}</button>
              </div>
            </React.Fragment>
          )}
        </div>
      </div>
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
                      <div className="wa-text">{t('Inquiry')} {d.no} · {tItems(d.items.length)} · {money(docAmount(d), d.currency).full}</div>
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

// ============================================================
// R06 —— 入库两步向导（Web 弹窗）。与 H5 共用 pricing.jsx 的 InboundWizard。
// 注意：作为 WebStagingDialog 的兄弟节点渲染，不能嵌套在另一个 .dialog 里
//       （嵌套会让 .dialog:has-text(...) 命中两个元素）。
// ============================================================
function InboundWizardDialog({ result, pids, onClose }) {
  return (
    <Dialog title={t('Bulk price adjustment')} width="74%" onClose={onClose}
      footer={<span className="muted small">{t('Step 2 of 2 — bulk price adjustment')}</span>}>
      <InboundWizard result={result} pids={pids} onClose={onClose} />
    </Dialog>
  );
}

Object.assign(window, { InboundWizardDialog });
