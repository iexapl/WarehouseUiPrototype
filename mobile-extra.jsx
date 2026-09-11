// ============================================================
// mobile-extra.jsx — H5 pages completing the MVP feature list
// (product entry / batch import / categories / stock & movements /
//  quote form with AI draft / print preview / platform admin /
//  team members / WhatsApp binding). Loaded after mobile.jsx.
// ============================================================

// ---------- new product (MVP #1 商品录入) ----------
function H5ProductFormPage({ onDone }) {
  const { db, account, act, toast } = useApp();
  const [f, setF] = useState({ name: '', spec: '', model: '', brand: '', unit: 'pcs', price: '', currency: 'USD', stock: '', onSale: true, images: [] });
  const [cats, setCats] = useState([]);
  const [errs, setErrs] = useState({});
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const save = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Required';
    if (f.price === '' || isNaN(Number(f.price)) || Number(f.price) <= 0) e.price = 'Enter a price > 0';
    if (f.stock !== '' && (isNaN(Number(f.stock)) || Number(f.stock) < 0)) e.stock = 'Enter stock >= 0';
    if (f.model && db.products.some(p => p.model && p.model.toLowerCase() === f.model.trim().toLowerCase())) e.model = 'Model already exists';
    setErrs(e);
    if (Object.keys(e).length) { toast('Please fix the highlighted fields', 'error'); return; }
    act.createProduct({ ...f, name: f.name.trim(), model: f.model.trim(), categories: cats, onSale: f.onSale });
    onDone();
  };
  return (
    <div className="h5-pad">
      <Banner tone="info" icon="box">Single flat form — a product goes on sale immediately after saving (MVP: save = listed).</Banner>
      <div className="h5-card mt12">
        <div className="h5-form-row" style={{ alignItems: 'flex-start' }}><span className="k">Images</span><div style={{ flex: 1 }}><ProductImagePicker value={f.images} onChange={v => set('images', v)} /></div></div>
        <div className="h5-form-row"><span className="k">Name *</span><input className="input" style={{ height: 32, flex: 1 }} value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Solar Inverter 5kW" />{errs.name && <span className="field-error">{errs.name}</span>}</div>
        <div className="h5-form-row"><span className="k">Spec</span><input className="input" style={{ height: 32, flex: 1 }} value={f.spec} onChange={e => set('spec', e.target.value)} placeholder="e.g. 5kW / MPPT / 48V" /></div>
        <div className="h5-form-row"><span className="k">Model</span><div style={{ flex: 1 }}><input className="input" style={{ height: 32, width: '100%' }} value={f.model} onChange={e => set('model', e.target.value)} placeholder="unique, e.g. SK-INV-5K" />{errs.model && <div className="field-error">{errs.model}</div>}</div></div>
        <div className="h5-form-row"><span className="k">Brand</span><input className="input" style={{ height: 32, flex: 1 }} value={f.brand} onChange={e => set('brand', e.target.value)} placeholder="e.g. SunKing" /></div>
        <div className="h5-form-row"><span className="k">Unit</span><div style={{ flex: 1 }}><Select value={f.unit} onChange={v => set('unit', v)} options={['pcs', 'set', 'box', 'kg'].map(u => ({ value: u, label: u }))} style={{ height: 32 }} /></div></div>
        <div className="h5-form-row"><span className="k">Price *</span><div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}><Select value={f.currency} onChange={v => set('currency', v)} options={['USD', 'CNY', 'NGN'].map(c => ({ value: c, label: c }))} style={{ height: 32, width: 88 }} /><input className="input" style={{ height: 32, flex: 1 }} type="number" value={f.price} onChange={e => set('price', e.target.value)} placeholder="0.00" /></div>{errs.price && <span className="field-error">{errs.price}</span>}</div>
        <div className="h5-form-row"><span className="k">Stock</span><div style={{ flex: 1 }}><input className="input" style={{ height: 32, width: '100%' }} type="number" value={f.stock} onChange={e => set('stock', e.target.value)} placeholder="initial stock, e.g. 100" />{errs.stock && <div className="field-error">{errs.stock}</div>}</div></div>
      </div>
      <div className="h5-section-title">Categories <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>· {t('one product may belong to several')}</span></div>
      <div className="h5-card">
        <div className="flex gap8" style={{ flexWrap: 'wrap' }}>
          {db.categories.map(c => (
            <span key={c.id} className={`h5-chip${cats.includes(c.id) ? ' on' : ''}`} onClick={() => setCats(cats.includes(c.id) ? cats.filter(x => x !== c.id) : [...cats, c.id])}>{c.name}</span>
          ))}
        </div>
      </div>
      <div className="h5-card mt12 flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13.5 }}>On sale after saving</span>
        <Switch value={f.onSale} onChange={v => set('onSale', v)} />
      </div>
      <button className="h5-btn primary mt16" style={{ width: '100%' }} onClick={save}><Icon name="check" size={15} />Save &amp; List Product</button>
    </div>
  );
}

// ---------- 统一扫码入口（入库/出库模式切换） ----------
// 原「扫码入库」（H5ScanInBatchPage）与「扫码批量出库」（H5ScanOutPage）
// 两个头部工具合并为单一「扫码」入口：进入后顶部切换 入库 / 出库 模式
// （默认入库，可随时切换继续扫），扫码/手动录入的结果按当前模式加入
// 对应暂存单（入库暂存 / 出库暂存，跨页面保留），遵循既有 +1 规则与
// 表单能力（入库含单价/币种/供货方，出库含收货方）。模式反馈：
// segment 高亮 + 扫码框取景器随模式变色 + 每次扫码 toast 提示去向。
function H5ScanPage({ onDone, initialMode = 'inbound' }) {
  const { db, account, toast, cartApi, carts } = useApp();
  const [mode, setMode] = useState(initialMode === 'outbound' ? 'outbound' : 'inbound'); // 'inbound' | 'outbound'
  const [manual, setManual] = useState('');
  const own = db.products.filter(p => p.ownerId === account.tenantId);
  const stockOf = pid => (db.stock[account.tenantId] || {})[pid] || 0;

  const addExisting = (pid, label) => {
    cartApi.add('inbound', { kind: 'exist', pid, qty: 1 });
    if (label) toast(`Scanned ${label} — added to inbound staging`, 'success');
  };
  const addNew = (code) => {
    const c = String(code || '').trim();
    cartApi.add('inbound', { kind: 'new', code: c, name: '', unit: 'pcs', price: '', qty: 1 });
    toast(`Unknown code ${c || '(blank)'} — stock in as a new product`, 'info');
  };
  const addOut = (pid, label) => {
    cartApi.add('outbound', { pid, qty: 1 });
    if (label) toast(`Scanned ${label} — added to outbound staging`, 'success');
  };

  // demo scans — inbound: any own product (existing) or an unknown barcode
  // (new-product path); outbound: a random own product that still has stock
  const outPool = own.filter(p => stockOf(p.id) > 0);
  const scanDemoExist = () => {
    if (!own.length) { toast('No products in your warehouse yet', 'error'); return; }
    const p = own[Math.floor(Math.random() * own.length)];
    addExisting(p.id, p.model || p.name);
  };
  const scanDemoNew = () => addNew('SKU-NEW-' + String(1000 + Math.floor(Math.random() * 9000)));
  const scanDemoOut = () => {
    if (!outPool.length) { toast('No products in stock to outbound', 'error'); return; }
    const p = outPool[Math.floor(Math.random() * outPool.length)];
    addOut(p.id, p.model || p.name);
  };
  // manual entry (inbound): exact/substring match against own products
  // (model first, then name); unknown code joins as a new-product line
  const addManual = () => {
    const key = String(manual || '').trim().toLowerCase();
    if (!key) { toast('Enter a barcode / product code / name first', 'error'); return; }
    const hit = own.find(p => (p.model || '').toLowerCase() === key) || own.find(p => (p.model || '').toLowerCase().includes(key) || (p.name || '').toLowerCase().includes(key));
    if (hit) addExisting(hit.id, hit.model || hit.name);
    else addNew(manual.trim());
    setManual('');
  };

  return (
    <div className="h5-pad">
      {/* 模式切换：扫码结果加入当前模式的暂存单 */}
      <div className="h5-segments mb8">
        <button className={`h5-segment${mode === 'inbound' ? ' active' : ''}`} onClick={() => setMode('inbound')}><Icon name="download" size={13} />{t('Stock In')}</button>
        <button className={`h5-segment${mode === 'outbound' ? ' active' : ''}`} onClick={() => setMode('outbound')}><Icon name="truck" size={13} />{t('Stock Out')}</button>
      </div>
      <div className="muted" style={{ fontSize: 11.5, margin: '0 2px 8px' }}><Icon name="info" size={11} /> {t('Scanned items go to the staging of the current mode')}</div>
      <div className={`h5-scan-frame${mode === 'outbound' ? ' out' : ''}`}>
        <span className="h5-scan-corner tl" /><span className="h5-scan-corner tr" />
        <span className="h5-scan-corner bl" /><span className="h5-scan-corner br" />
        <span className="h5-scan-line" />
        <span className="h5-scan-mode">{mode === 'inbound' ? t('Stock-in mode') : t('Stock-out mode')}</span>
        <Icon name="scan" size={34} style={{ color: 'rgba(255,255,255,0.85)' }} />
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5, textAlign: 'center', padding: '0 40px' }}>{t('Align the product barcode with the viewfinder')}</div>
      </div>
      {mode === 'inbound' ? (
        <React.Fragment>
          <div className="flex gap10 mt12">
            <button className="h5-btn" style={{ flex: 1 }} onClick={scanDemoExist} disabled={!own.length}><Icon name="check" size={14} />{t('Demo: recognize an existing product')}</button>
            <button className="h5-btn" style={{ flex: 1 }} onClick={scanDemoNew}><Icon name="plus" size={14} />{t('Demo: scan a new barcode')}</button>
          </div>
          {/* manual entry: a known code restocks the matched product, an unknown
              one joins the list as a new-product line */}
          <div className="h5-card mt12">
            <div className="h5-form-row" style={{ marginBottom: 0 }}>
              <span className="k h5-k-fit">{t('Material Barcode')}</span>
              <div className="h5-input-affix">
                <input className="input" style={{ height: 34, paddingRight: 64 }} value={manual}
                  onChange={e => setManual(e.target.value)}
                  placeholder={t('Barcode / product code / name')}
                  onKeyDown={e => { if (e.key === 'Enter') addManual(); }} />
                <button type="button" className="h5-input-suffix" title={t('Add')} aria-label={t('Add')} onClick={addManual}><Icon name="plus" size={14} />{t('Add')}</button>
              </div>
            </div>
          </div>
          <div className="h5-card mt12 muted" style={{ fontSize: 11.5, lineHeight: 1.6 }}><Icon name="info" size={12} /> {t('An inbound item may already be in your warehouse (matched automatically — stock accumulates) or brand new (quick-profiled below, then stocked in)')}</div>
        </React.Fragment>
      ) : (
        <button className="h5-btn mt12" style={{ width: '100%' }} onClick={scanDemoOut} disabled={!outPool.length}><Icon name="scan" size={14} />{t('Demo: scan an item')}</button>
      )}

      <div className="h5-section-title mt12">{t(mode === 'inbound' ? 'Inbound Staging' : 'Outbound Staging')} · {(mode === 'inbound' ? (carts.inbound || []) : (carts.outbound || [])).length}</div>
      {mode === 'inbound' ? <InboundCartEditor onDone={onDone} /> : <OutboundCartEditor onDone={onDone} />}
    </div>
  );
}

// ---------- batch import (MVP #3/#4/#5) ----------
function H5ImportPage({ onDone }) {
  const { account, act, toast } = useApp();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState('');
  const [receiptExported, setReceiptExported] = useState(false);
  const OK = window.BATCH_OK_ROWS || [];
  const FAIL = window.BATCH_FAIL_ROWS || [];
  const CORRECTED = window.BATCH_CORRECTED_ROWS || [];
  const exportReceipt = () => {
    const header = ['Excel Row', 'Product Name', 'Spec', 'Model', 'Brand', 'Unit', 'Price', 'Currency', 'Stock', 'Categories', 'Error'];
    const rows = FAIL.map(r => [r.row, r.name, r.spec, r.model, r.brand, r.unit, r.price, r.currency, r.stock, (r.cats || []).join('; '), r.reason]);
    downloadFile('failed_rows_receipt.csv', [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\n'));
    setReceiptExported(true);
    toast('Failed-row receipt exported — fix and re-import', 'success');
  };
  const importRows = (rows) => {
    act.batchImportProducts(rows.map(r => ({ name: r.name, spec: r.spec, model: r.model, brand: r.brand, unit: r.unit, price: r.price, currency: r.currency, stock: r.stock, categories: r.cats })), account.tenantId);
    act.logEvent('Batch Import', `${rows.length} products from import file (H5)`);
    onDone();
  };
  return (
    <div className="h5-pad">
      <div className="flex gap8 mb12">
        {['1 Upload', '2 Validate', '3 Re-import'].map((s, i) => (
          <span key={s} className={`h5-chip${step === i + 1 ? ' on' : ''}`} style={{ flex: 1, textAlign: 'center' }}>{s}</span>
        ))}
      </div>
      {step === 1 && (
        <React.Fragment>
          <div className="h5-card" onClick={() => setFile('products_batch_20260904.csv')} style={{ border: '2px dashed var(--border)', textAlign: 'center', padding: '30px 16px', cursor: 'pointer', background: '#FAFBFC' }}>
            <Icon name="upload" size={28} style={{ color: 'var(--primary)' }} />
            <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 8 }}>{file || 'Tap to select an import file (.csv / .xlsx)'}</div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Name / Spec / Model / Brand / Unit / Price / Currency / Stock / Categories</div>
          </div>
          <button className="btn block mt12" onClick={() => { downloadProductTemplate(); toast('Excel template downloaded (demo: .csv)', 'success'); }}><Icon name="download" size={14} />Download Template</button>
          <button className="h5-btn primary mt12" style={{ width: '100%' }} disabled={!file} onClick={() => setStep(2)}><Icon name="upload" size={14} />Validate &amp; Import</button>
        </React.Fragment>
      )}
      {step === 2 && (
        <React.Fragment>
          <div className="flex gap8 mb12">
            <Tag tone="success">14 parsed</Tag><Tag tone="success">{OK.length} passed</Tag><Tag tone="danger">{FAIL.length} failed</Tag>
          </div>
          <div className="h5-card">
            {[...OK.slice(0, 4), ...FAIL].map(r => (
              <div key={r.row} className="h5-form-row" style={{ alignItems: 'flex-start' }}>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-3)', paddingTop: 2 }}>#{r.row}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name || <span className="muted">(empty)</span>}</div>
                  <div className="muted mono" style={{ fontSize: 11 }}>{r.model}</div>
                  {r.reason && <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 2 }}>{r.reason}</div>}
                </div>
                {r.reason ? <Tag tone="danger">Failed</Tag> : <Tag tone="success">Passed</Tag>}
              </div>
            ))}
            {OK.length > 4 && <div className="muted" style={{ fontSize: 11.5, textAlign: 'center', padding: '8px 0' }}>+ {OK.length - 4} more passed rows…</div>}
          </div>
          <button className="btn block mt12" onClick={exportReceipt} disabled={receiptExported}><Icon name="download" size={14} />{receiptExported ? 'Receipt Exported' : 'Export Failed Rows'}</button>
          {receiptExported && <button className="btn block mt8" onClick={() => { setFile('failed_rows_receipt_corrected.csv'); setStep(3); }}><Icon name="upload" size={14} />Upload Corrected File</button>}
          <button className="h5-btn primary mt12" style={{ width: '100%' }} onClick={() => importRows(OK)}><Icon name="check" size={14} />{t(`Confirm Import (${OK.length} valid rows)`)}</button>
        </React.Fragment>
      )}
      {step === 3 && (
        <React.Fragment>
          <div className="flex gap8 mb12"><Tag tone="primary">Corrected file</Tag><Tag tone="success">{CORRECTED.length} re-validated</Tag></div>
          <div className="h5-card">
            {CORRECTED.map(r => (
              <div key={r.row} className="h5-form-row">
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div><div className="muted mono" style={{ fontSize: 11 }}>{r.model}</div></div>
                <Tag tone="success">Passed</Tag>
              </div>
            ))}
          </div>
          <button className="h5-btn primary mt12" style={{ width: '100%' }} onClick={() => importRows(CORRECTED)}><Icon name="upload" size={14} />{t(`Import Corrected Rows (${CORRECTED.length})`)}</button>
        </React.Fragment>
      )}
      <div className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 12 }}>Rows are validated one by one (required / format / duplicate). Valid rows are written into your product list and stock ledger.</div>
    </div>
  );
}

// ---------- categories (MVP #6) ----------
function H5CategoriesPage() {
  const { db, act, toast } = useApp();
  const [name, setName] = useState('');
  return (
    <div className="h5-pad">
      <Banner tone="info" icon="tag">Platform-unified flat taxonomy — every merchant picks from the same top-level categories; a product may belong to several.</Banner>
      <div className="h5-card mt12 flex gap8">
        <input className="input" style={{ height: 34, flex: 1 }} value={name} onChange={e => setName(e.target.value)} placeholder="New category name" />
        <button className="btn primary" style={{ height: 34 }} title={window.t('Add')} aria-label={window.t('Add')} onClick={() => { if (!name.trim()) { toast('Category name is required', 'error'); return; } act.saveCategory(name); setName(''); }}><Icon name="plus" size={14} />{window.t('Add')}</button>
      </div>
      <div className="h5-section-title">All Categories</div>
      {db.categories.map(c => {
        const count = db.products.filter(p => p.categories.includes(c.id)).length;
        return (
          <div key={c.id} className="h5-cell">
            <span className="cell-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}><Icon name="tag" size={16} /></span>
            <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{c.name}</div>
            <span className="muted" style={{ fontSize: 12 }}>{count} products · top-level</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- stock list + adjust (MVP #20/#21/#22) ----------
function H5StockPage({ push }) {
  const { db, account, act, toast } = useApp();
  const [q, setQ] = useState('');
  const [adjust, setAdjust] = useState(null); // product being adjusted
  const [mode, setMode] = useState('IN');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const stock = db.stock[account.tenantId] || {};
  const rows = db.products.filter(p => stock[p.id] != null && (!q || (p.name + p.model).toLowerCase().includes(q.toLowerCase())));
  const doAdjust = () => {
    const n = Number(qty);
    if (qty === '' || isNaN(n) || n < 0) { toast('Enter a valid quantity', 'error'); return; }
    if (!reason.trim()) { toast('Reason is required (audit trail)', 'error'); return; }
    act.adjustStock(adjust.id, mode, n, reason.trim());
    setAdjust(null); setQty(''); setReason('');
  };
  return (
    <div className="h5-pad">
      <div className="h5-card" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: '#fff', border: 'none' }}>
        <div style={{ fontSize: 12, opacity: 0.85 }}>Default Warehouse · {account.type === 'tenant' ? (db.tenants.find(t => t.id === account.tenantId) || {}).name : 'Platform'}</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{rows.length} SKUs</div>
        <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>Every change writes a stock movement record</div>
      </div>
      <div className="flex gap8 mt12 mb12">
        <div className="search-box" style={{ flex: 1 }}>
          <Icon name="search" size={14} />
          <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search SKU / model" />
        </div>
        <button className="btn" style={{ height: 32 }} onClick={() => push({ name: 'movements' })}><Icon name="clock" size={14} />Movements</button>
      </div>
      {rows.map(p => (
        <div key={p.id} className="h5-cell">
          <img src={prodImg(p)} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
            <div className="muted mono" style={{ fontSize: 11 }}>{p.model}</div>
          </div>
          <div style={{ textAlign: 'right', marginRight: 6 }}>
            <div className="mono bold" style={{ fontSize: 15 }}>{stock[p.id]} {p.unit}</div>
            <div className="muted" style={{ fontSize: 10.5 }}>on hand</div>
          </div>
          {canManageProduct(db, account, p) ? (
            <button className="h5-item-act" onClick={() => { setAdjust(p); setMode('IN'); setQty(''); setReason(''); }}><Icon name="warehouse" size={12} />Adjust</button>
          ) : (
            <span className="muted" title={`Owned by ${productOwnerName(db, p)}`} style={{ fontSize: 10.5, maxWidth: 96, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{productOwnerName(db, p)}</span>
          )}
        </div>
      ))}
      {rows.length === 0 && <H5Empty icon="box" message="No stock records" hint="Stock appears once products are imported or received." />}
      {adjust && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(23,35,47,0.5)', zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 16, paddingBottom: 40 }} onClick={() => setAdjust(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Adjust Stock — {adjust.name}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Current: <b className="mono">{stock[adjust.id]}</b> {adjust.unit}</div>
            <div className="flex gap8 mt12">
              {[['IN', 'Inbound +'], ['OUT', 'Outbound −'], ['ADJ', 'Count To']].map(([v, label]) => (
                <span key={v} className={`h5-chip${mode === v ? ' on' : ''}`} style={{ flex: 1, textAlign: 'center' }} onClick={() => setMode(v)}>{label}</span>
              ))}
            </div>
            <div className="h5-form-row mt12" style={{ borderBottom: 'none' }}><span className="k">{mode === 'ADJ' ? 'Counted' : 'Qty'}</span><input className="input" style={{ height: 32, flex: 1 }} type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder={mode === 'ADJ' ? 'absolute quantity' : 'quantity'} /></div>
            <div className="h5-form-row" style={{ borderBottom: 'none' }}><span className="k">Reason *</span><input className="input" style={{ height: 32, flex: 1 }} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. cycle count / damaged write-off" /></div>
            <div className="flex gap10 mt8">
              <button className="h5-btn" onClick={() => setAdjust(null)}><Icon name="close" size={14} />Cancel</button>
              <button className="h5-btn warning" onClick={doAdjust}><Icon name="check" size={14} />Confirm</button>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>A movement record (before → after, operator, reason) is generated automatically.</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- movements ledger with filters (MVP #32) ----------
function H5MovementsPage() {
  const { db, account } = useApp();
  const [type, setType] = useState('ALL');
  const [pid, setPid] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const isPlatform = account.type === 'platform';
  const all = db.movements.filter(m => isPlatform || m.tenantId === account.tenantId).slice().reverse();
  const rows = all.filter(m =>
    (type === 'ALL' || m.type === type) &&
    (pid === 'ALL' || m.productId === pid) &&
    (!from || m.ts.slice(0, 10) >= from) &&
    (!to || m.ts.slice(0, 10) <= to));
  return (
    <div className="h5-pad">
      <div className="h5-card">
        <div className="h5-form-row"><span className="k">Type</span><div className="flex gap8" style={{ flex: 1, flexWrap: 'wrap' }}>{['ALL', 'IN', 'OUT', 'ADJ'].map(v => <span key={v} className={`h5-chip${type === v ? ' on' : ''}`} onClick={() => setType(v)}>{v === 'ALL' ? 'All' : v}</span>)}</div></div>
        <div className="h5-form-row"><span className="k">SKU</span><div style={{ flex: 1 }}><Select value={pid} onChange={setPid} options={[{ value: 'ALL', label: 'All products' }, ...db.products.map(p => ({ value: p.id, label: p.name }))]} style={{ height: 30 }} /></div></div>
        <div className="h5-form-row"><span className="k">From</span><input className="input" style={{ height: 30, flex: 1 }} type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div className="h5-form-row"><span className="k">To</span><input className="input" style={{ height: 30, flex: 1 }} type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
      </div>
      <div className="h5-section-title">Stock Movements · {rows.length} of {all.length}</div>
      {rows.slice(0, 60).map(m => {
        const p = db.products.find(x => x.id === m.productId);
        const tone = m.type === 'IN' ? 'success' : m.type === 'OUT' ? 'danger' : 'warning';
        return (
          <div key={m.id} className="h5-card" style={{ marginBottom: 8 }}>
            <div className="flex" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{p ? p.name : m.productId}</span>
              <Tag tone={tone}>{m.type}</Tag>
            </div>
            <div className="flex mt8 muted" style={{ fontSize: 11.5, justifyContent: 'space-between' }}>
              <span className="mono">{m.before} → {m.after} ({m.qty > 0 ? '+' : ''}{m.qty}){p && <React.Fragment> {p.unit}</React.Fragment>}</span>
              <span>{m.ts}</span>
            </div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Ref <span className="mono">{m.refNo}</span> · by {m.by}</div>
            {m.supplierId && <div style={{ fontSize: 11.5, marginTop: 2 }}><span className="muted">{t('Supplier')}: </span><span style={{ color: 'var(--text-1)' }}>{tenantName(db, m.supplierId)}</span></div>}
            {m.receiverName && <div style={{ fontSize: 11.5, marginTop: 2 }}><span className="muted">{t('Receiver')}: </span><span style={{ color: 'var(--text-1)' }}>{m.receiverName}{m.receiverPhone ? <span className="mono"> · {m.receiverPhone}</span> : null}</span></div>}
            {m.amount != null && m.type === 'IN' && <div style={{ fontSize: 11.5, marginTop: 2 }}><span className="muted">{t('Amount')}: </span><span className="mono" style={{ color: 'var(--text-1)' }}>{money(m.price, m.currency).text} × {Math.abs(m.qty)} = <b style={{ color: '#D35400' }}>{money(m.amount, m.currency).text}</b></span></div>}}
            <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{m.reason}</div>
          </div>
        );
      })}
      {rows.length === 0 && <H5Empty icon="clock" message="No movements match the filters" />}
    </div>
  );
}

// ---------- quote form with AI draft (MVP #9/#17/#18) ----------
function H5QuoteFormPage({ docId, onDone }) {
  const { db, account, act, toast } = useApp();
  const inquiry = db.docs.find(d => d.id === docId);
  const [items, setItems] = useState(() => inquiry ? inquiry.items.map(it => ({ ...it, price: ifnull(it.price, ''), suggested: false })) : []);
  const [validUntil, setValidUntil] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); });
  const [aiUsed, setAiUsed] = useState(false);
  if (!inquiry) return null;
  const currency = inquiry.currency;
  const aiDraft = () => {
    setItems(items.map(it => {
      const ref = db.products.find(p => p.id === it.pid);
      let price = it.price;
      if (ref) price = ref.currency === currency ? +(ref.price * 0.985).toFixed(2) : Math.round(ref.price * 1550 * 0.985);
      return { ...it, price, suggested: true };
    }));
    setAiUsed(true);
    toast('AI quote draft generated — review before sending', 'success');
  };
  const total = items.reduce((s, it) => s + (Number(it.price) || 0) * it.qty, 0);
  return (
    <div className="h5-pad">
      <div className="h5-card">
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{inquiry.no}</span>
          <StatusTag type="IQ" status={inquiry.status} />
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>From {tenantName(db, inquiry.buyer)} · deliver {inquiry.deliveryDate || '—'}</div>
        {aiUsed && <div className="mt8"><span className="h5-badge-ai"><Icon name="ai" size={11} />AI DRAFTED PRICES — EDITABLE</span></div>}
      </div>
      <div className="h5-section-title">Quote Lines</div>
      {items.map((it, i) => (
        <div key={i} className="h5-card" style={{ marginBottom: 8 }}>
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</span>
            <span className="mono muted" style={{ fontSize: 12 }}>× {it.qty}</span>
          </div>
          <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{it.spec}</div>
          <div className="flex gap8 mt8" style={{ alignItems: 'center' }}>
            <span className="cur-code" style={{ fontSize: 11 }}>{currency}</span>
            <input className="input" style={{ height: 32, flex: 1 }} type="number" value={it.price} onChange={e => setItems(items.map((x, j) => i === j ? { ...x, price: e.target.value, suggested: false } : x))} placeholder="unit price" />
            {it.suggested && <span className="h5-badge-ai">AI</span>}
            <span className="mono bold" style={{ fontSize: 12.5, width: 84, textAlign: 'right' }}>{money((Number(it.price) || 0) * it.qty, currency).num}</span>
          </div>
        </div>
      ))}
      <div className="h5-card flex" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>Total</span>
        <span className="mono bold" style={{ fontSize: 15 }}>{money(total, currency).full}</span>
      </div>
      <div className="h5-section-title">Valid Until</div>
      <div className="h5-card"><input className="input" style={{ height: 32, width: '100%' }} type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
      <div className="h5-card mt12 muted" style={{ fontSize: 11.5, lineHeight: 1.6 }}><Icon name="whatsapp" size={13} /> The buyer's main account is auto-notified via WhatsApp push with a link to this quote.</div>
      <div className="flex gap10 mt16">
        <button className="h5-btn" style={{ flex: 1 }} onClick={aiDraft}><Icon name="ai" size={14} />AI Draft</button>
        <button className="h5-btn primary" style={{ flex: 1.4 }} onClick={() => {
          if (items.some(it => it.price === '' || isNaN(it.price))) { toast('Enter a unit price for every line', 'error'); return; }
          act.sendQuote(inquiry, items, validUntil);
          onDone();
        }}><Icon name="check" size={14} />Send Quote</button>
      </div>
    </div>
  );
}

// ---------- print preview (MVP #35) ----------
function H5PrintPage({ docId }) {
  const { db, act, toast } = useApp();
  const doc = db.docs.find(d => d.id === docId);
  if (!doc) return null;
  const TYPE_NAME = { IQ: 'INQUIRY', QT: 'QUOTATION', PO: 'PURCHASE ORDER', CK: 'OUTBOUND / WAYBILL', RK: 'INBOUND RECORD', FP: 'SALES INVOICE' };
  return (
    <div className="h5-pad">
      <div className="print-sheet h5-print">
        <div className="watermark">SAMPLE / 样张</div>
        <div className="print-head">
          <div className="flex gap10">
            <Logo size={26} />
            <div><div style={{ fontWeight: 800, fontSize: 13 }}>TierLink Warehouse</div><div className="muted" style={{ fontSize: 9 }}>Tiered Distribution WMS · Demo Document</div></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>{TYPE_NAME[doc.type]}</div>
            <div className="mono" style={{ fontSize: 10, marginTop: 2 }}>{doc.no}</div>
          </div>
        </div>
        <div className="flex gap12 mt12" style={{ justifyContent: 'space-between', fontSize: 10 }}>
          <div><span className="muted">Seller:</span> <b>{tenantName(db, doc.seller)}</b></div>
          <div><span className="muted">Buyer:</span> <b>{tenantName(db, doc.buyer)}</b></div>
          <div><span className="muted">Date:</span> {doc.createdAt}</div>
        </div>
        <table className="table" style={{ marginTop: 12, fontSize: 10 }}>
          <thead><tr><th>Product</th><th>Spec</th><th>Qty</th><th className="right">Unit Price</th><th className="right">Amount</th></tr></thead>
          <tbody>
            {doc.items.map((it, i) => (
              <tr key={i}><td>{it.name}</td><td className="mono small">{it.spec}</td><td className="mono">{it.qty}</td>
                <td className="right mono">{doc.currency} {it.price.toLocaleString()}</td><td className="right mono">{money(it.qty * it.price, doc.currency).text}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="flex mt12" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div><div className="barcode"></div><div className="mono muted" style={{ fontSize: 8, marginTop: 2 }}>{doc.no} · {doc.createdAt}</div></div>
          <div style={{ textAlign: 'right' }}><div className="muted" style={{ fontSize: 9 }}>TOTAL</div><div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{money(docAmount(doc), doc.currency).full}</div></div>
        </div>
        <div className="muted" style={{ fontSize: 8.5, marginTop: 12, borderTop: '1px solid var(--border-light)', paddingTop: 6 }}>Anti-counterfeit watermark and barcode are rendered by the print template. Printing is logged as a data-outbound event.</div>
      </div>
      <div className="flex gap10 mt16">
        <button className="h5-btn" onClick={() => toast('Template printing is prepared offline and uploaded (no online designer in MVP)')}><Icon name="info" size={14} />Template Info</button>
        <button className="h5-btn primary" onClick={() => { act.logEvent('Print Document', `${doc.no} (H5, template with watermark & barcode)`); toast('Sent to print — data-outbound event logged', 'success'); }}><Icon name="print" size={14} />Print</button>
      </div>
    </div>
  );
}

// ---------- export sheet (MVP #36) — rendered inside H5 doc page ----------
function H5ExportSheet({ doc, onClose }) {
  const { act, toast } = useApp();
  const doExport = (fmt) => {
    act.logEvent(`Export ${fmt}`, `${doc.no} (H5)`);
    toast(`${doc.no} exported as ${fmt} — data-outbound event logged`, 'success');
    onClose();
  };
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(23,35,47,0.5)', zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 16, paddingBottom: 40 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', animation: 'slideIn 0.2s ease' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #F0F2F5' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Export {doc.no}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Exports are recorded as data-outbound events (audit trail).</div>
        </div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { fmt: 'PDF', label: 'Export as PDF', icon: 'file', desc: 'Print pipeline with watermark & barcode' },
            { fmt: 'Excel', label: 'Export as Excel', icon: 'grid', desc: 'Downloads the file now' },
          ].map(opt => (
            <div key={opt.fmt} onClick={() => doExport(opt.fmt)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-light)', background: '#FAFBFC' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-light)', color: 'var(--primary)', flexShrink: 0 }}>
                <Icon name={opt.icon} size={17} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{opt.label}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{opt.desc}</div>
              </div>
              <Icon name="chevronRight" size={16} color="var(--text-3)" />
            </div>
          ))}
        </div>
        <div style={{ padding: '0 12px 12px' }}>
          <button className="h5-btn h5-btn-lg" style={{ width: '100%', height: 44, justifyContent: 'center' }} onClick={onClose}><Icon name="close" size={14} />Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---------- login-free guest document view (WhatsApp link, MVP P2) ----------
function GuestDocStage({ docNo, onExit }) {
  return (
    <div className="mobile-stage">
      <IOSDevice width={390} height={844}>
        <H5GuestDocPage docNo={docNo} onExit={onExit} />
      </IOSDevice>
      <div className="stage-caption"><span>Login-free H5 view — opened from a WhatsApp link (demo)</span></div>
    </div>
  );
}

function H5GuestDocPage({ docNo, onExit }) {
  const { db, act, toast } = useApp();
  const doc = db.docs.find(d => d.no === docNo);
  if (!doc) {
    return (
      <div className="h5-app">
        <div className="h5-header"><div className="h5-side"><Logo size={24} /></div><div className="h5-title">TierLink</div><div className="h5-side right"><Icon name="whatsapp" size={18} color="var(--text-2)" /></div></div>
        <div className="h5-main"><div className="h5-pad">
          <H5Empty icon="file" message="Document not found or link expired" hint="Sign in to view all documents." />
        </div></div>
        <div className="h5-tabs"><div className="h5-tab" onClick={onExit}><Icon name="arrowLeft" size={20} /><span>Sign In</span></div></div>
      </div>
    );
  }
  const canConfirm = doc.type === 'CK' && doc.status === 'Shipped';
  // attribute the one-tap confirmation to the buyer's main account so the
  // stock movement / inbound record audit trail stays correct without login
  const buyerMain = db.accounts.find(a => a.tenantId === doc.buyer && a.main);
  return (
    <div className="h5-app">
      <div className="h5-header"><div className="h5-side"><Logo size={24} /></div><div className="h5-title">TierLink</div><div className="h5-side right"><Icon name="whatsapp" size={18} color="var(--text-2)" /></div></div>
      <div className="h5-main">
        <div className="h5-pad" style={{ paddingBottom: canConfirm ? undefined : 16 }}>
          <div className="h5-wa-banner">
            <Icon name="whatsapp" size={20} />
            <div><b>Opened from a WhatsApp link</b> — login-free document view. One-tap confirmation is available for shipments awaiting your receipt.</div>
          </div>
          <div className="h5-card" style={{ background: '#FFF9E8', border: '1px dashed #E4CE8E', textAlign: 'center', fontSize: 11.5, color: '#96601A' }}>Demo token link — no login required · token=demo</div>
          <div className="h5-card mt12">
            <div className="flex" style={{ justifyContent: 'space-between' }}>
              <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{doc.no}</span>
              <StatusTag type={doc.type} status={doc.status} />
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{doc.items.length} items · {money(docAmount(doc), doc.currency).full}</div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Seller {tenantName(db, doc.seller)} → Buyer {tenantName(db, doc.buyer)}</div>
            {doc.waybill && <div className="muted mono" style={{ fontSize: 11.5, marginTop: 4 }}>Waybill {doc.waybill.no} · {doc.waybill.carrier} · {doc.waybill.plate} · {doc.waybill.driver}</div>}
          </div>
          <div className="h5-section-title">Items</div>
          <div className="h5-card">
            {doc.items.map((it, i) => {
              const prod = db.products.find(p => p.id === it.pid);
              const img = prod && prod.image;
              return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < doc.items.length - 1 ? '1px solid #F0F2F5' : 'none', fontSize: 13 }}>
                {img
                  ? <img src={img} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 38, height: 38, borderRadius: 8, background: '#F5F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="box" size={15} color="var(--text-3)" /></div>}
                <span style={{ flex: 1, minWidth: 0 }}>{it.name}<div className="muted mono" style={{ fontSize: 10.5, marginTop: 2 }}>{it.spec}</div></span><span className="mono muted">{it.qty} {it.unit}</span>
              </div>
              );
            })}
          </div>
          {canConfirm ? (
            <React.Fragment>
              <div className="h5-card mt12 muted" style={{ fontSize: 11.5, lineHeight: 1.6 }}><Icon name="info" size={13} /> Confirming here increases your stock and generates the inbound record (RK-) — attributed to {buyerMain ? buyerMain.name : t('the buyer main account')} (demo).</div>
              <div className="h5-actionbar">
                <button className="h5-btn" onClick={onExit}><Icon name="user" size={14} />Sign In</button>
                <button className="h5-btn success" onClick={() => {
                  act.receive(doc, 'accept', null, '', buyerMain || null);
                }}><Icon name="checkDouble" size={14} />Confirm Receipt</button>
              </div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div className="h5-card" style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>View-only document — no confirmation required at this stage.</div>
              <button className="h5-btn mt12" style={{ width: '100%' }} onClick={onExit}><Icon name="user" size={14} />Sign in to view all documents</button>
            </React.Fragment>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- platform admin (MVP #41/#42/#43/#44) ----------
function H5AdminPage({ setConfirm }) {
  const { db, act, toast } = useApp();
  const [tab, setTab] = useState('merchants');
  const [tenantForm, setTenantForm] = useState({ name: '', code: '', type: 'Agent', country: 'Nigeria', maxLevel: '1', masterName: '', masterPhone: '', masterPassword: '', whatsapp: '' });
  const [relForm, setRelForm] = useState({ upstream: '', downstream: '' });
  const [accForm, setAccForm] = useState({ name: '', tenant: '', phone: '', whatsapp: '', accountType: 'tenant', main: false });
  const setT = (k, v) => setTenantForm(s => ({ ...s, [k]: v }));
  const active = db.tenants.filter(t => t.status === 'Active');
  return (
    <div className="h5-pad">
      <Banner tone="warning" icon="shield">Platform admin — merchant lifecycle, supply relations and account provisioning. Business documents stay read-only for platform accounts.</Banner>
      <div className="h5-segments mt12">
        {[['merchants', 'Merchants'], ['relation', 'Relations'], ['accounts', 'Accounts']].map(([id, label]) => (
          <button key={id} className={`h5-segment${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'merchants' && (
        <React.Fragment>
          <div className="h5-section-title">All Merchants</div>
          {db.tenants.map(t => (
            <div key={t.id} className="h5-cell">
              <span className="cell-icon" style={{ background: t.type === 'Supplier' ? 'var(--purple-light)' : 'var(--primary-light)', color: t.type === 'Supplier' ? 'var(--purple)' : 'var(--primary)' }}><Icon name="building" size={17} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.name}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>{t.code} · {t.type === 'Supplier' ? 'Supplier' : `Agent · max level ${ifnull(t.maxLevel, '—')}`} · {t.country}</div>
              </div>
              {t.status === 'Active'
                ? <button className="h5-item-act error" onClick={() => setConfirm({ title: 'Suspend Merchant', message: `Suspend ${t.name}? Related accounts will be blocked from login immediately; data is retained.`, confirmText: 'Suspend', requireText: t.code, tone: 'error', onConfirm: () => act.suspendTenant(t.id) })}><Icon name="lock" size={12} />Suspend</button>
                : <Tag tone="dark">Suspended</Tag>}
            </div>
          ))}
          <div className="h5-section-title">{t('Create Merchant')} · {t('Merchant Info')}</div>
          <div className="h5-card">
            <div className="h5-form-row"><span className="k">{t('Company *')}</span><input className="input" style={{ height: 32, flex: 1 }} value={tenantForm.name} onChange={e => setT('name', e.target.value)} placeholder="e.g. Port Harcourt Agent" /></div>
            <div className="h5-form-row"><span className="k">{t('Code')}</span><input className="input" style={{ height: 32, flex: 1 }} value={tenantForm.code} onChange={e => setT('code', e.target.value)} placeholder="auto T-00x if empty" /></div>
            <div className="h5-form-row"><span className="k">{t('Type')}</span><div style={{ flex: 1 }}><Select value={tenantForm.type} onChange={v => setT('type', v)} options={[{ value: 'Agent', label: 'Agent' }, { value: 'Supplier', label: 'Supplier' }]} style={{ height: 30 }} /></div></div>
            <div className="h5-form-row"><span className="k">{t('Country')}</span><input className="input" style={{ height: 32, flex: 1 }} value={tenantForm.country} onChange={e => setT('country', e.target.value)} /></div>
            <div className="h5-form-row"><span className="k">{t('Max level')}</span><input className="input" style={{ height: 32, flex: 1 }} type="number" value={tenantForm.maxLevel} onChange={e => setT('maxLevel', e.target.value)} placeholder="1 = sub-distributor" /></div>
          </div>
          <div className="h5-section-title">{t('Master Account')}</div>
          <div className="h5-card">
            <div className="h5-form-row"><span className="k">{t('Master Name')} *</span><input className="input" style={{ height: 32, flex: 1 }} value={tenantForm.masterName} onChange={e => setT('masterName', e.target.value)} placeholder="e.g. Ada Obi" /></div>
            <div className="h5-form-row"><span className="k">{t('Phone Number')} *</span><input className="input" style={{ height: 32, flex: 1 }} value={tenantForm.masterPhone} onChange={e => setT('masterPhone', e.target.value)} placeholder="+234 801 234 5678" /></div>
            <div className="h5-form-row"><span className="k">{t('Password')} *</span><input className="input" style={{ height: 32, flex: 1 }} type="password" value={tenantForm.masterPassword} onChange={e => setT('masterPassword', e.target.value)} placeholder={t('set a login password')} /></div>
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{t('demo password — hashed at rest in the real system')}</div>
          </div>
          <div className="h5-section-title">{t('WhatsApp Binding')}</div>
          <div className="h5-card">
            <div className="h5-form-row"><span className="k">{t('WhatsApp Number')}</span><input className="input" style={{ height: 32, flex: 1 }} value={tenantForm.whatsapp} onChange={e => setT('whatsapp', e.target.value)} placeholder="+234 801 234 5678" /></div>
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{t('push links (quotes / invoices) are delivered to this number')}</div>
          </div>
          <button className="h5-btn primary mt12" style={{ width: '100%' }} onClick={() => {
            if (!tenantForm.name.trim()) { toast('Company name is required', 'error'); return; }
            if (!tenantForm.masterName.trim() || !tenantForm.masterPhone.trim() || !tenantForm.masterPassword) { toast('Master name, phone and password are required', 'error'); return; }
            act.createTenant({ ...tenantForm, name: tenantForm.name.trim(), code: tenantForm.code.trim() || undefined, maxLevel: tenantForm.type === 'Supplier' ? '' : tenantForm.maxLevel, status: 'Active', master: { name: tenantForm.masterName.trim(), phone: tenantForm.masterPhone.trim(), password: tenantForm.masterPassword, whatsapp: tenantForm.whatsapp.trim() || null } });
            setTenantForm({ name: '', code: '', type: 'Agent', country: 'Nigeria', maxLevel: '1', masterName: '', masterPhone: '', masterPassword: '', whatsapp: '' });
          }}><Icon name="plus" size={14} />{t('Create Merchant & Master Account')}</button>
        </React.Fragment>
      )}
      {tab === 'relation' && (
        <React.Fragment>
          <div className="h5-section-title">Supply Relations</div>
          {db.relations.map((r, i) => (
            <div key={i} className="h5-card" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{tenantName(db, r.upstream)} <Icon name="chevronRight" size={12} /> {tenantName(db, r.downstream)}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Established {r.createdAt} · {t('same-type pair is unique')}</div>
              </div>
              <button className="h5-item-act error" onClick={() => setConfirm({ title: 'Dissolve Relation', message: `Remove the supply relation ${tenantName(db, r.upstream)} → ${tenantName(db, r.downstream)}? The downstream merchant loses visibility of upstream products. Data is retained.`, confirmText: 'Dissolve', tone: 'error', onConfirm: () => act.removeRelation(r.upstream, r.downstream) })}><Icon name="close" size={12} />Dissolve</button>
            </div>
          ))}
          <div className="h5-section-title">Establish Relation</div>
          <div className="h5-card">
            <div className="h5-form-row"><span className="k">Upstream</span><div style={{ flex: 1 }}><Select value={relForm.upstream} onChange={v => setRelForm(s => ({ ...s, upstream: v }))} options={[{ value: '', label: 'Select supplier' }, ...active.map(t => ({ value: t.id, label: t.name }))]} style={{ height: 30 }} /></div></div>
            <div className="h5-form-row"><span className="k">Downstream</span><div style={{ flex: 1 }}><Select value={relForm.downstream} onChange={v => setRelForm(s => ({ ...s, downstream: v }))} options={[{ value: '', label: 'Select agent' }, ...active.map(t => ({ value: t.id, label: t.name }))]} style={{ height: 30 }} /></div></div>
          </div>
          <button className="h5-btn primary mt12" style={{ width: '100%' }} onClick={() => {
            if (!relForm.upstream || !relForm.downstream || relForm.upstream === relForm.downstream) { toast('Select two different merchants', 'error'); return; }
            if (db.relations.some(r => (r.upstream === relForm.upstream && r.downstream === relForm.downstream))) { toast('This relation already exists (unique per pair)', 'error'); return; }
            act.createRelation(relForm.upstream, relForm.downstream);
            setRelForm({ upstream: '', downstream: '' });
          }}><Icon name="link" size={14} />Establish Relation</button>
        </React.Fragment>
      )}
      {tab === 'accounts' && (
        <React.Fragment>
          <div className="h5-section-title">All Accounts</div>
          {db.accounts.map(a => (
            <div key={a.id} className="h5-cell">
              <span className={`avatar ${a.type === 'platform' ? 'plat' : 'tenant'}`} style={{ width: 34, height: 34, fontSize: 12 }}>{a.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.name}{a.main && <span className="mini-chip" style={{ marginLeft: 6 }}>MAIN</span>}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>{a.tenantId ? tenantName(db, a.tenantId) : 'Platform'} · {a.phone}{a.whatsapp ? ' · WA' : ''}</div>
              </div>
              {a.status === 'Suspended' ? <Tag tone="dark">Suspended</Tag> : <Tag tone="teal">Active</Tag>}
            </div>
          ))}
          <div className="h5-section-title">Create Account</div>
          <div className="h5-card">
            <div className="h5-form-row"><span className="k">Account Type</span><div style={{ flex: 1 }}><Select value={accForm.accountType} onChange={v => setAccForm(s => ({ ...s, accountType: v, main: false }))} options={[{ value: 'tenant', label: 'Merchant Account' }, { value: 'platform', label: 'Platform Account' }]} style={{ height: 30 }} /></div></div>
            <div className="h5-form-row"><span className="k">Name *</span><input className="input" style={{ height: 32, flex: 1 }} value={accForm.name} onChange={e => setAccForm(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Ada Obi" /></div>
            {accForm.accountType === 'tenant' && <React.Fragment>
              <div className="h5-form-row"><span className="k">Merchant *</span><div style={{ flex: 1 }}><Select value={accForm.tenant} onChange={v => setAccForm(s => ({ ...s, tenant: v }))} options={[{ value: '', label: 'Select merchant' }, ...active.map(t => ({ value: t.id, label: t.name }))]} style={{ height: 30 }} /></div></div>
              <div className="h5-form-row"><span className="k">Master</span><div style={{ flex: 1 }}><Select value={accForm.main ? 'yes' : 'no'} onChange={v => setAccForm(s => ({ ...s, main: v === 'yes' }))} options={[{ value: 'no', label: 'No — regular sub-account' }, { value: 'yes', label: 'Yes — master of the merchant' }]} style={{ height: 30 }} /></div></div>
            </React.Fragment>}
            <div className="h5-form-row"><span className="k">Phone *</span><input className="input" style={{ height: 32, flex: 1 }} value={accForm.phone} onChange={e => setAccForm(s => ({ ...s, phone: e.target.value }))} placeholder="+234 ..." /></div>
            {accForm.accountType === 'tenant' && <div className="h5-form-row"><span className="k">WhatsApp</span><input className="input" style={{ height: 32, flex: 1 }} value={accForm.whatsapp} onChange={e => setAccForm(s => ({ ...s, whatsapp: e.target.value }))} placeholder="optional push binding" /></div>}
          </div>
          <button className="h5-btn primary mt12" style={{ width: '100%' }} onClick={() => {
            if (!accForm.name.trim() || !accForm.phone.trim()) { toast('Name and phone are required', 'error'); return; }
            if (accForm.accountType === 'tenant' && !accForm.tenant) { toast('Select a merchant', 'error'); return; }
            act.createAccount({ ...accForm, name: accForm.name.trim(), phone: accForm.phone.trim(), whatsapp: accForm.whatsapp.trim() || null });
            setAccForm({ name: '', tenant: '', phone: '', whatsapp: '', accountType: 'tenant', main: false });
          }}><Icon name="plus" size={14} />Create Account</button>
          <div className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 12 }}>MVP: permissions are flattened — creating an account grants the same action set.</div>
        </React.Fragment>
      )}
    </div>
  );
}

// ---------- team members + sub-agent + WhatsApp binding (MVP #45/#46, round 41 overhaul) ----------
function H5MembersPage() {
  const { db, account, tenant, act, toast } = useApp();
  const isTenant = account.type === 'tenant';
  const members = isTenant ? db.accounts.filter(a => a.tenantId === account.tenantId) : [];
  const subAgents = isTenant ? db.tenants.filter(t => db.relations.some(r => r.upstream === account.tenantId && r.downstream === t.id)) : [];
  const canCreateSub = isTenant && tenant && (tenant.type === 'Supplier' || tenant.maxLevel > 1);
  const [q, setQ] = useState('');
  const kw = q.trim().toLowerCase();
  const shown = kw ? members.filter(a => (a.name || '').toLowerCase().includes(kw) || (a.phone || '').includes(kw)) : members;
  const waBound = members.filter(a => a.whatsapp).length;
  const [sfOpen, setSfOpen] = useState(false);
  const [fOpen, setFOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [edit, setEdit] = useState(null);
  const [ef, setEf] = useState({ name: '', phone: '', email: '', whatsapp: '', password: '' });
  const openEdit = a => { setEf({ name: a.name || '', phone: a.phone || '', email: a.email || '', whatsapp: a.whatsapp || '', password: a.password || '' }); setEdit(a); setDetail(null); };
  const saveEdit = () => {
    if (!ef.name.trim() || !ef.phone.trim()) { toast('Name and phone are required', 'error'); return; }
    if (!/^\+?[\d\s-]{7,}$/.test(ef.phone.trim())) { toast('Enter a valid phone number', 'error'); return; }
    if (!ef.whatsapp.trim()) { toast('WhatsApp number is required', 'error'); return; }
    if (!/^\+?[\d\s-]{7,}$/.test(ef.whatsapp.trim())) { toast('Enter a valid WhatsApp number', 'error'); return; }
    if (ef.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ef.email.trim())) { toast('Enter a valid email address', 'error'); return; }
    if (!ef.password) { toast('Password is required', 'error'); return; }
    if (ef.password.length < 6) { toast('At least 6 characters', 'error'); return; }
    act.updateAccount(edit.id, { name: ef.name.trim(), phone: ef.phone.trim(), email: ef.email.trim() || null, whatsapp: ef.whatsapp.trim() || null, password: ef.password });
    setEdit(null);
  };
  const [f, setF] = useState({ company: '', contact: '', phone: '', email: '', whatsapp: '', password: '', maxSubLevel: '1' });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const [sf, setSf] = useState({ name: '', phone: '', whatsapp: '', password: '' });
  const createSubAccount = () => {
    if (!sf.name.trim() || !sf.phone.trim()) { toast('Name and phone are required', 'error'); return; }
    if (!/^\+?[\d\s-]{7,}$/.test(sf.phone.trim())) { toast('Enter a valid phone number', 'error'); return; }
    if (!sf.password) { toast('Password is required', 'error'); return; }
    if (sf.password.length < 6) { toast('At least 6 characters', 'error'); return; }
    act.createAccount({ name: sf.name.trim(), phone: sf.phone.trim(), whatsapp: sf.whatsapp.trim() || null, password: sf.password, tenant: account.tenantId, accountType: 'tenant', main: false });
    setSf({ name: '', phone: '', whatsapp: '', password: '' });
    setSfOpen(false);
  };
  const createSubAgent = () => {
    if (!f.company.trim() || !f.contact.trim() || !f.phone.trim()) { toast('Company, contact and phone are required', 'error'); return; }
    if (!/^\+?[\d\s-]{7,}$/.test(f.phone.trim())) { toast('Enter a valid phone number', 'error'); return; }
    if (!f.whatsapp.trim()) { toast('WhatsApp number is required for master accounts', 'error'); return; }
    if (!/^\+?[\d\s-]{7,}$/.test(f.whatsapp.trim())) { toast('Enter a valid WhatsApp number', 'error'); return; }
    if (f.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) { toast('Enter a valid email address', 'error'); return; }
    if (!f.password) { toast('Password is required', 'error'); return; }
    if (f.password.length < 6) { toast('At least 6 characters', 'error'); return; }
    act.createSubAgent({ ...f, company: f.company.trim(), contact: f.contact.trim(), phone: f.phone.trim(), email: f.email.trim() || null, whatsapp: f.whatsapp.trim() || null });
    setF({ company: '', contact: '', phone: '', email: '', whatsapp: '', password: '', maxSubLevel: '1' });
    setFOpen(false);
  };
  return (
    <div className="h5-pad">
      <div className="h5-section-title">{isTenant ? tenant.name : 'Platform'} · Members</div>

      <div className="h5-stats">
        <div className="h5-stat"><div className="l">Members</div><div className="v">{members.length}</div></div>
        <div className="h5-stat"><div className="l">Main account</div><div className="v">{members.filter(a => a.main).length}</div></div>
        <div className="h5-stat"><div className="l">WhatsApp bound</div><div className="v">{waBound}/{members.length}</div></div>
        <div className="h5-stat"><div className="l">Sub-agents</div><div className="v">{subAgents.length}</div></div>
      </div>

      <div className="h5-filter-head" style={{ margin: '14px 0 10px' }}>
        <div className="search-box" style={{ flex: 1 }}>
          <Icon name="search" size={14} />
          <input className="input" value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setQ(''); }} placeholder="Search members" aria-label="Search members" />
        </div>
        {isTenant && (
          <button type="button" className="btn primary" style={{ height: 30, flexShrink: 0 }} onClick={() => setSfOpen(true)}>
            <Icon name="plus" size={12} />Add Sub-Account
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="h5-card" style={{ padding: '26px 14px', textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 12.5 }}>{kw ? 'No matching members' : 'No members yet'}</div>
        </div>
      ) : shown.map(a => (
        <div key={a.id} className="h5-cell" role="button" tabIndex={0} onClick={() => setDetail(a)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setDetail(a); }}>
          <span className="avatar merchant" style={{ width: 34, height: 34, fontSize: 12, flexShrink: 0 }}>{a.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
              {a.main && <span className="mini-chip">MAIN</span>}
            </div>
            <div className="muted" style={{ fontSize: 11.5 }}>{a.phone}</div>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
            {a.whatsapp && <Tag tone="success" dot>WhatsApp</Tag>}
            {a.id === account.id ? <Tag tone="primary">Me</Tag> : (a.status === 'Suspended' ? <Tag tone="danger">Suspended</Tag> : <Tag tone="teal">Active</Tag>)}
          </div>
        </div>
      ))}

      {isTenant && (
        <React.Fragment>
          <div className="h5-section-title">My Sub-Agents{subAgents.length > 0 && <span className="mini-chip" style={{ marginLeft: 6 }}>{subAgents.length}</span>}</div>
          {subAgents.length === 0 ? (
            <div className="h5-card" style={{ padding: '20px 14px', textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: 12.5 }}>No sub-agents yet</div>
            </div>
          ) : subAgents.map(t => (
            <div key={t.id} className="h5-cell">
              <span className="cell-icon" style={{ background: 'var(--success-light)', color: 'var(--success)', flexShrink: 0 }}><Icon name="users" size={16} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.name}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>{window.t(`${t.code} · max level ${t.maxLevel} · since ${t.createdAt}`)}</div>
              </div>
              {t.status === 'Suspended' ? <Tag tone="danger">Suspended</Tag> : <Tag tone="teal">Active</Tag>}
            </div>
          ))}
          {canCreateSub ? (
            <button type="button" className="h5-btn primary mt12" style={{ width: '100%' }} onClick={() => setFOpen(true)}>
              <Icon name="plus" size={14} />Add Sub-Agent
            </button>
          ) : (tenant && tenant.maxLevel != null && (
            <React.Fragment>
              <button type="button" className="h5-btn primary mt12" style={{ width: '100%', opacity: 0.55, cursor: 'not-allowed' }} disabled>
                <Icon name="plus" size={14} />Add Sub-Agent
              </button>
              <div className="muted" style={{ fontSize: 11, padding: '4px 0 8px 4px' }}>{window.t(`You can develop up to ${tenant.maxLevel} levels of sub-agents`)}</div>
            </React.Fragment>
          ))}
        </React.Fragment>
      )}

      {detail && (
        <Dialog title="Member details" width="92%" onClose={() => setDetail(null)}
          footer={<button type="button" className="btn primary" onClick={() => openEdit(detail)}><Icon name="edit" size={13} />{detail.main ? 'Edit Master Account' : 'Edit Sub-Account'}</button>}>
          <div className="h5-form-row"><span className="k">Name</span><div style={{ flex: 1, fontSize: 13 }}>{detail.name}{detail.main && <span className="mini-chip" style={{ marginLeft: 6 }}>MAIN</span>}</div></div>
          <div className="h5-form-row"><span className="k">Phone</span><div style={{ flex: 1, fontSize: 13 }}>{detail.phone}</div></div>
          <div className="h5-form-row"><span className="k">Email</span><div style={{ flex: 1, fontSize: 13, display: 'flex', alignItems: 'center' }}>{detail.email ? detail.email : <span className="muted" style={{ fontSize: 12 }}>Not set</span>}</div></div>
          <div className="h5-form-row"><span className="k">WhatsApp</span><div style={{ flex: 1, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>{detail.whatsapp ? <React.Fragment><span>{detail.whatsapp}</span><Tag tone="success" dot>WhatsApp bound</Tag></React.Fragment> : <span className="muted" style={{ fontSize: 12 }}>Not bound</span>}</div></div>
          <div className="h5-form-row" style={{ borderBottom: 'none' }}><span className="k">Status</span><div style={{ flex: 1, fontSize: 13 }}>{detail.status === 'Suspended' ? <Tag tone="danger">Suspended</Tag> : <Tag tone="teal">Active</Tag>}</div></div>
        </Dialog>
      )}

      {edit && (
        <Dialog title={edit.main ? 'Edit Master Account' : 'Edit Sub-Account'} width="92%" onClose={() => setEdit(null)}
          footer={<React.Fragment>
            <button className="btn" onClick={() => setEdit(null)}><Icon name="close" size={13} />Cancel</button>
            <button className="btn primary" onClick={saveEdit}><Icon name="check" size={13} />Save</button>
          </React.Fragment>}>
          <div className="h5-form-row"><span className="k">Account name *</span><input className="input" style={{ height: 32, flex: 1 }} value={ef.name} onChange={e => setEf(s => ({ ...s, name: e.target.value }))} placeholder="account name" autoFocus /></div>
          <div className="h5-form-row"><span className="k">Phone *</span><input className="input" type="tel" style={{ height: 32, flex: 1 }} value={ef.phone} onChange={e => setEf(s => ({ ...s, phone: e.target.value }))} placeholder="+234 ..." /></div>
          <div className="h5-form-row"><span className="k">Email</span><input className="input" type="email" style={{ height: 32, flex: 1 }} value={ef.email} onChange={e => setEf(s => ({ ...s, email: e.target.value }))} placeholder="name@company.com" /></div>
          <div className="h5-form-row"><span className="k">WhatsApp *</span><input className="input" type="tel" style={{ height: 32, flex: 1 }} value={ef.whatsapp} onChange={e => setEf(s => ({ ...s, whatsapp: e.target.value }))} placeholder="+234 ..." /></div>
          <div className="h5-form-row" style={{ borderBottom: 'none' }}><span className="k">Password *</span><input className="input" type="password" style={{ height: 32, flex: 1 }} value={ef.password} onChange={e => setEf(s => ({ ...s, password: e.target.value }))} placeholder="set a login password" /></div>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>demo password — hashed at rest in the real system</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Accounts with a bound WhatsApp receive document push links</div>
        </Dialog>
      )}

      {sfOpen && (
        <Dialog title="Create Sub-Account" width="92%" onClose={() => setSfOpen(false)}
          footer={<React.Fragment>
            <button className="btn" onClick={() => setSfOpen(false)}><Icon name="close" size={13} />Cancel</button>
            <button className="btn primary" onClick={createSubAccount}><Icon name="plus" size={13} />Create Sub-Account</button>
          </React.Fragment>}>
          <div className="h5-form-row"><span className="k">Name *</span><input className="input" style={{ height: 32, flex: 1 }} value={sf.name} onChange={e => setSf(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Ada Obi" autoFocus /></div>
          <div className="h5-form-row"><span className="k">Phone *</span><input className="input" style={{ height: 32, flex: 1 }} value={sf.phone} onChange={e => setSf(s => ({ ...s, phone: e.target.value }))} placeholder="+234 ..." /></div>
          <div className="h5-form-row"><span className="k">WhatsApp</span><input className="input" style={{ height: 32, flex: 1 }} value={sf.whatsapp} onChange={e => setSf(s => ({ ...s, whatsapp: e.target.value }))} placeholder="optional push binding" /></div>
          <div className="h5-form-row" style={{ borderBottom: 'none' }}><span className="k">Password *</span><input className="input" type="password" style={{ height: 32, flex: 1 }} value={sf.password} onChange={e => setSf(s => ({ ...s, password: e.target.value }))} placeholder="set a login password" /></div>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>demo password — hashed at rest in the real system</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 12 }}>Sub-accounts belong to {tenant ? tenant.name : ''} and share its flattened permission set.</div>
        </Dialog>
      )}

      {fOpen && (
        <Dialog title="Create Sub-Agent" width="92%" onClose={() => setFOpen(false)}
          footer={<React.Fragment>
            <button className="btn" onClick={() => setFOpen(false)}><Icon name="close" size={13} />Cancel</button>
            <button className="btn primary" onClick={createSubAgent}><Icon name="plus" size={13} />Create Sub-Agent + Master Account</button>
          </React.Fragment>}>
          <div className="h5-form-row"><span className="k">Company *</span><input className="input" style={{ height: 32, flex: 1 }} value={f.company} onChange={e => set('company', e.target.value)} placeholder="e.g. Enugu Distributor" /></div>
          <div className="h5-form-row" style={{ borderBottom: 'none' }}><span className="k">Max level</span><div style={{ flex: 1 }}><Select value={f.maxSubLevel} onChange={v => set('maxSubLevel', v)} options={[{ value: '1', label: '1 (sub-distributor, no further downstream)' }]} style={{ height: 30 }} /></div></div>
          <div className="muted" style={{ fontSize: 11, fontWeight: 700, margin: '12px 0 2px', letterSpacing: 0.2 }}>Master Account</div>
          <div className="h5-form-row"><span className="k">Account name *</span><input className="input" style={{ height: 32, flex: 1 }} value={f.contact} onChange={e => set('contact', e.target.value)} placeholder="master account name" /></div>
          <div className="h5-form-row"><span className="k">Phone *</span><input className="input" type="tel" style={{ height: 32, flex: 1 }} value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="+234 ..." /></div>
          <div className="h5-form-row"><span className="k">Email</span><input className="input" type="email" style={{ height: 32, flex: 1 }} value={f.email} onChange={e => set('email', e.target.value)} placeholder="name@company.com" /></div>
          <div className="h5-form-row"><span className="k">WhatsApp *</span><input className="input" type="tel" style={{ height: 32, flex: 1 }} value={f.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="+234 ..." /></div>
          <div className="h5-form-row" style={{ borderBottom: 'none' }}><span className="k">Password *</span><input className="input" type="password" style={{ height: 32, flex: 1 }} value={f.password} onChange={e => set('password', e.target.value)} placeholder="set a login password" /></div>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>demo password — hashed at rest in the real system</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Master accounts receive document push links</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 12 }}>Creates the agent merchant, its master account (WhatsApp bound) and the supply relation in one step.</div>
        </Dialog>
      )}
    </div>
  );
}

// ---------- bind own WhatsApp (MVP #46) ----------
function H5BindWaPage() {
  const { db, account, act, toast } = useApp();
  const [wa, setWa] = useState(account.whatsapp || account.phone || '');
  return (
    <div className="h5-pad">
      <Banner tone="success" icon="whatsapp">Document-change push links are sent to your bound WhatsApp number — tap a link to open the H5 document without logging in.</Banner>
      <div className="h5-card mt12">
        <div className="h5-form-row" style={{ borderBottom: 'none' }}><span className="k">Number</span><input className="input" style={{ height: 34, flex: 1 }} value={wa} onChange={e => setWa(e.target.value)} placeholder="+234 ..." /></div>
      </div>
      <div className="h5-desc mt12">
        <div className="h5-desc-row"><div className="k">Account</div><div className="v">{account.name}</div></div>
        <div className="h5-desc-row"><div className="k">Current binding</div><div className="v mono">{account.whatsapp || '— none —'}</div></div>
      </div>
      <button className="h5-btn primary mt16" style={{ width: '100%' }} onClick={() => {
        if (!wa.trim()) { toast('Enter a WhatsApp number', 'error'); return; }
        act.bindWhatsapp(account.id, wa.trim());
      }}><Icon name="whatsapp" size={15} />Bind / Update WhatsApp</button>
    </div>
  );
}

// ---------- price adjustment form (cost read-only / market / sale) ----------
// R79 — market & sale price fields each carry an INDEPENDENT currency select
// (USD / NGN / CNY): market reference price may be quoted in a global currency
// (e.g. USD) while the channel sales price is in the local currency (e.g. NGN);
// the two codes do NOT sync
function H5PriceFormPage({ productId, onDone }) {
  const { db, act, toast } = useApp();
  const p = db.products.find(x => x.id === productId);
  const [market, setMarket] = useState(String(ifnull(p.marketPrice, p.price)));
  const [sale, setSale] = useState(String(p.price));
  const [mktCur, setMktCur] = useState(marketCurOf(p));
  const [saleCur, setSaleCur] = useState(p.currency || 'USD');
  const CUR_OPTS = ['USD', 'NGN', 'CNY'].map(c => ({ value: c, label: c }));
  const [errs, setErrs] = useState({});
  const save = () => {
    const e = {};
    if (market === '' || isNaN(Number(market)) || Number(market) <= 0) e.market = 'Enter a price > 0';
    if (sale === '' || isNaN(Number(sale)) || Number(sale) <= 0) e.sale = 'Enter a price > 0';
    setErrs(e);
    if (Object.keys(e).length) { toast('Please fix the highlighted fields', 'error'); return; }
    act.adjustPrice(p.id, { marketPrice: Number(market), price: Number(sale), currency: saleCur, marketCurrency: mktCur });
    onDone();
  };
  return (
    <div className="h5-pad">
      <div className="h5-card flex gap10">
        <img src={prodImg(p)} alt="" style={{ width: 46, height: 46, borderRadius: 8, objectFit: 'cover' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name}</div>
          <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{p.model} · {p.spec}</div>
        </div>
      </div>
      <div className="h5-section-title">Prices</div>
      <div className="h5-card">
        <div className="h5-form-row" style={{ background: '#FAFBFC', borderRadius: '10px 10px 0 0' }}>
          <span className="k">Cost Price</span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
            <span className="mono bold" style={{ fontSize: 14 }}>{money(ifnull(p.cost, p.price), saleCur).text}</span>
            <Tag tone="dark">Read-only</Tag>
          </div>
        </div>
        <div className="h5-form-row"><span className="k">Market Reference Price *</span><div style={{ flex: 1, display: 'flex', gap: 8 }}><Select value={mktCur} onChange={setMktCur} options={CUR_OPTS} style={{ width: 84, height: 32 }} /><input className="input" style={{ height: 32, flex: 1, minWidth: 0 }} type="number" value={market} onChange={e => setMarket(e.target.value)} placeholder="0.00" />{errs.market && <div className="field-error">{errs.market}</div>}</div></div>
        <div className="h5-form-row"><span className="k">Channel Sales Price *</span><div style={{ flex: 1, display: 'flex', gap: 8 }}><Select value={saleCur} onChange={setSaleCur} options={CUR_OPTS} style={{ width: 84, height: 32 }} /><input className="input" style={{ height: 32, flex: 1, minWidth: 0 }} type="number" value={sale} onChange={e => setSale(e.target.value)} placeholder="0.00" />{errs.sale && <div className="field-error">{errs.sale}</div>}</div></div>
      </div>
      <div className="h5-card mt12 muted" style={{ fontSize: 11.5, lineHeight: 1.6 }}><Icon name="info" size={12} /> Cost price is the procurement record and cannot be edited here. The adjustment updates the channel sales price / market reference price on your catalog and is logged in the operation events. Each price field keeps its own currency code — they are set independently.</div>
      <div className="flex gap10 mt16">
        <button className="h5-btn" style={{ flex: 1 }} onClick={onDone}><Icon name="close" size={14} />Cancel</button>
        <button className="h5-btn primary" style={{ flex: 1 }} onClick={save}><Icon name="check" size={14} />Save Prices</button>
      </div>
    </div>
  );
}

// ---------- stock adjustment form (IN / OUT / count) ----------
function H5AdjustStockPage({ productId, onDone }) {
  const { db, account, act, toast } = useApp();
  const p = db.products.find(x => x.id === productId);
  const current = ifnull((db.stock[account.tenantId] || {})[productId], 0);
  const [type, setType] = useState('IN');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const projected = type === 'IN' ? current + (Number(qty) || 0) : type === 'OUT' ? current - (Number(qty) || 0) : (Number(qty) || 0);
  const save = () => {
    const n = Number(qty);
    if (!qty || isNaN(n) || n < 0 || (type !== 'ADJ' && n <= 0) || (type === 'OUT' && n > current)) {
      setErr(type === 'OUT' && n > current ? `Only ${current} on hand` : 'Enter a valid quantity');
      return;
    }
    act.adjustStock(productId, type, n, reason.trim() || 'Manual adjustment');
    onDone();
  };
  return (
    <div className="h5-pad">
      <div className="h5-card flex gap10">
        <img src={prodImg(p)} alt="" style={{ width: 46, height: 46, borderRadius: 8, objectFit: 'cover' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name}</div>
          <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{p.model} · {p.spec}</div>
        </div>
      </div>
      <div className="h5-desc mt12">
        <div className="h5-desc-row"><div className="k">Warehouse</div><div className="v">Default Warehouse</div></div>
        <div className="h5-desc-row"><div className="k">On Hand</div><div className="v mono bold">{current} {p.unit}</div></div>
        <div className="h5-desc-row"><div className="k">After Adjust</div><div className="v mono bold" style={{ color: projected < 0 ? 'var(--danger)' : undefined }}>{projected} {p.unit}</div></div>
      </div>
      <div className="h5-section-title">Adjustment</div>
      <div className="h5-card">
        <div style={{ padding: '10px 0', borderBottom: '1px solid #F0F2F5' }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Change Type *</div>
          <RadioRow value={type} onChange={setType} options={[
            { value: 'IN', label: 'Inbound (+)' }, { value: 'OUT', label: 'Outbound (−)' }, { value: 'ADJ', label: 'Count (set to)' },
          ]} />
        </div>
        <div className="h5-form-row"><span className="k">Quantity *</span><div style={{ flex: 1 }}><input className="input" style={{ height: 32, width: '100%' }} type="number" value={qty} onChange={e => { setQty(e.target.value); setErr(''); }} placeholder={type === 'ADJ' ? 'counted quantity' : '0'} />{err && <div className="field-error">{err}</div>}</div></div>
        <div className="h5-form-row"><span className="k">Reason</span><div style={{ flex: 1 }}><input className="input" style={{ height: 32, width: '100%' }} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Cycle count correction" /></div></div>
      </div>
      <div className="h5-card mt12 muted" style={{ fontSize: 11.5, lineHeight: 1.6 }}><Icon name="info" size={12} /> The adjustment is recorded as a stock movement (ADJ) and attributed to your account.</div>
      <div className="flex gap10 mt16">
        <button className="h5-btn" style={{ flex: 1 }} onClick={onDone}><Icon name="close" size={14} />Cancel</button>
        <button className="h5-btn warning" style={{ flex: 1 }} onClick={save} disabled={projected < 0}><Icon name="check" size={14} />Confirm Adjustment</button>
      </div>
    </div>
  );
}

// ---------- re-receive page (R83 — buyer recovers partial receipt) ----------
function H5ReReceivePage({ poId, onDone }) {
  const { db, act, toast } = useApp();
  const po = db.docs.find(d => d.id === poId);
  // compute outstanding per pid = sum(cks qty) - sum(rks actualQty)
  const outstanding = {};
  if (po) {
    const cks = db.docs.filter(d => d.type === 'CK' && d.poNo === po.no);
    const rks = db.docs.filter(d => d.type === 'RK' && cks.some(c => c.no === d.ckNo));
    po.items.forEach(it => { outstanding[it.pid] = it.qty; });
    rks.forEach(rk => rk.items.forEach(it => { outstanding[it.pid] = (outstanding[it.pid] || 0) - (ifnull(it.actualQty, it.qty)); }));
  }
  const [qtys, setQtys] = useState(() => po ? Object.fromEntries(po.items.map(it => [it.pid, String(outstanding[it.pid] || 0)])) : {});
  if (!po) return null;
  return (
    <div className="h5-pad">
      <div className="h5-card">
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{po.no}</span>
          <StatusTag type="PO" status={po.status} />
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>From {tenantName(db, po.seller)} · {po.items.length} items</div>
      </div>
      <div className="h5-section-title">Actually Re-received</div>
      <div className="h5-card">
        {po.items.map((it, i) => {
          const out = outstanding[it.pid] || 0;
          return (
            <div key={it.pid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < po.items.length - 1 ? '1px solid #F0F2F5' : 'none' }}>
              <img src={prodImg(db.products.find(p => p.id === it.pid))} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>Ordered: {it.qty} · Outstanding: {out}</div>
              </div>
              <input className="input" type="number" value={qtys[it.pid]} disabled={out <= 0}
                onChange={e => setQtys(s => ({ ...s, [it.pid]: e.target.value }))} style={{ height: 32, width: 84 }} />
            </div>
          );
        })}
      </div>
      <div className="h5-card" style={{ background: '#FFF9E8', border: '1px dashed #E4CE8E', fontSize: 11.5, color: '#96601A', lineHeight: 1.6 }}>
        <Icon name="info" size={13} /> Re-change the goods received previously; goods delivered later may also be added.
      </div>
      <button className="h5-btn success mt16" style={{ width: '100%' }} onClick={() => {
        const numQtys = {};
        let any = false;
        for (const k of Object.keys(qtys)) { const v = Number(qtys[k]); if (v > 0) { numQtys[k] = v; any = true; } }
        if (!any) { toast('No quantities entered — nothing to re-receive', 'info'); return; }
        act.rereceive(po, numQtys);
        onDone();
      }}><Icon name="checkDouble" size={14} />Confirm Re-receiving</button>
    </div>
  );
}

// ---------- R94 · accept order page (supplier confirms a PO — date + note) ----------
function H5AcceptPage({ poId, onDone }) {
  const { db, act, toast } = useApp();
  const po = db.docs.find(d => d.id === poId);
  const [shipDate, setShipDate] = useState('');
  const [note, setNote] = useState('');
  if (!po) return null;
  return (
    <div className="h5-pad">
      <div className="h5-card">
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{po.no}</span>
          <StatusTag type="PO" status={po.status} />
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>From {tenantName(db, po.buyer)} · {po.items.length} items · {money(docAmount(po), po.currency).full}</div>
      </div>
      <div className="h5-card mt12" style={{ background: '#EFF6FF', border: '1px dashed #93C5FD', fontSize: 11.5, color: '#1D4ED8', lineHeight: 1.6 }}>
        <Icon name="info" size={13} /> Accepting issues the sales invoice (FP-) automatically and pushes it to the buyer via WhatsApp. The order then awaits the buyer's offline payment.
      </div>
      <div className="h5-section-title mt12">Order Summary</div>
      <div className="h5-card">
        {po.items.map((it, i) => (
          <div key={it.pid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < po.items.length - 1 ? '1px solid #F0F2F5' : 'none' }}>
            <img src={prodImg(db.products.find(p => p.id === it.pid))} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>
              <div className="muted mono" style={{ fontSize: 11 }}>{it.spec}</div>
            </div>
            <div className="mono" style={{ fontSize: 12.5 }}>×{it.qty}</div>
            <div className="mono" style={{ fontSize: 12.5, width: 84, textAlign: 'right' }}>{it.price ? (po.currency === 'NGN' ? '₦' : '$') + it.price.toLocaleString() : '—'}</div>
          </div>
        ))}
      </div>
      <div className="h5-section-title mt12">Acceptance Details</div>
      <div className="h5-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid #F0F2F5' }}>
          <span className="muted" style={{ fontSize: 12.5, width: 118 }}>Dispatch Date</span>
          <input className="input" type="date" value={shipDate} onChange={e => setShipDate(e.target.value)} style={{ height: 32 }} />
        </div>
        <textarea className="textarea" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Acceptance note (optional) — e.g. stock confirmed, dispatch within 48h of payment" style={{ border: 'none', padding: 0, marginTop: 8 }}></textarea>
      </div>
      <button className="h5-btn primary mt16" style={{ width: '100%' }} onClick={() => {
        act.docVerb('Accept', po, null, note.trim(), { expectedShipDate: shipDate });
        onDone();
        toast(`Order ${po.no} accepted — invoice auto-issued and pushed to the buyer`, 'success');
      }}><Icon name="check" size={14} />Confirm Acceptance</button>
    </div>
  );
}

// ---------- R94 · record payment page (supplier records the buyer's offline payment) ----------
function H5PayPage({ poId, onDone }) {
  const { db, act, toast } = useApp();
  const po = db.docs.find(d => d.id === poId);
  const [amount, setAmount] = useState(po ? String(docAmount(po)) : '0');
  const [date, setDate] = useState(new Date().toLocaleDateString('sv-SE'));
  const [method, setMethod] = useState('Bank Transfer');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  if (!po) return null;
  const METHODS = ['Bank Transfer', 'Cash', 'POS', 'Cheque'];
  return (
    <div className="h5-pad">
      <div className="h5-card">
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{po.no}</span>
          <StatusTag type="PO" status={po.status} />
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Buyer {tenantName(db, po.buyer)} · Total {money(docAmount(po), po.currency).full}</div>
      </div>
      <div className="h5-section-title mt12">Payment Details</div>
      <div className="h5-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid #F0F2F5' }}>
          <span className="muted" style={{ fontSize: 12.5, width: 118 }}>{t('Amount (' + (po.currency === 'NGN' ? '₦' : '$') + ')')}</span>
          <input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ height: 32 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid #F0F2F5' }}>
          <span className="muted" style={{ fontSize: 12.5, width: 118 }}>Payment Date</span>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ height: 32 }} />
        </div>
        <div style={{ padding: '9px 0', borderBottom: '1px solid #F0F2F5' }}>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>Method</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {METHODS.map(m => (
              <button key={m} className="btn" style={{
                padding: '4px 10px', fontSize: 11.5, borderRadius: 999,
                background: method === m ? '#1E5AA8' : '#F2F4F7', color: method === m ? '#fff' : '#5A6472', border: 'none',
              }} onClick={() => setMethod(m)}>{m}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid #F0F2F5' }}>
          <span className="muted" style={{ fontSize: 12.5, width: 118 }}>Transaction Ref</span>
          <input className="input" value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. TRF-99213" style={{ height: 32 }} />
        </div>
        <textarea className="textarea" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional) — e.g. branch deposit confirmed by call" style={{ border: 'none', padding: 0, marginTop: 8 }}></textarea>
      </div>
      <button className="h5-btn primary mt16" style={{ width: '100%' }} onClick={() => {
        const n = Number(amount);
        if (!n || n <= 0) { toast('Enter a valid payment amount', 'error'); return; }
        act.docVerb('Record Payment', po, null, null, { amount, date, method, ref, note });
        onDone();
        toast(`Payment recorded for ${po.no} — order moves to Pending Outbound`, 'success');
      }}><Icon name="wallet" size={14} />Record Payment</button>
      <div className="muted" style={{ fontSize: 11, marginTop: 12, textAlign: 'center' }}>Recording payment moves the order to Pending Outbound, ready for shipment</div>
    </div>
  );
}

// ---------- R94 · replenish shortfall page (buyer requests a re-shipment of shortages) ----------
function H5ReplenishPage({ poId, onDone }) {
  const { db, act, toast } = useApp();
  const po = db.docs.find(d => d.id === poId);
  // shortfall per pid = sum(CK qty) - sum(RK actualQty)
  const outstanding = {};
  if (po) {
    const cks = db.docs.filter(d => d.type === 'CK' && d.poNo === po.no);
    const rks = db.docs.filter(d => d.type === 'RK' && cks.some(c => c.no === d.ckNo));
    po.items.forEach(it => { outstanding[it.pid] = it.qty; });
    rks.forEach(rk => rk.items.forEach(it => { outstanding[it.pid] = (outstanding[it.pid] || 0) - (ifnull(it.actualQty, it.qty)); }));
  }
  const shortItems = po ? po.items.filter(it => (outstanding[it.pid] || 0) > 0) : [];
  const [qtys, setQtys] = useState(() => Object.fromEntries(shortItems.map(it => [it.pid, String(outstanding[it.pid])])));
  if (!po) return null;
  return (
    <div className="h5-pad">
      <div className="h5-card">
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{po.no}</span>
          <StatusTag type="PO" status={po.status} />
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>From {tenantName(db, po.seller)} · {po.items.length} items</div>
      </div>
      <div className="h5-card mt12" style={{ background: '#FFF9E8', border: '1px dashed #E4CE8E', fontSize: 11.5, color: '#96601A', lineHeight: 1.6 }}>
        <Icon name="info" size={13} /> Append a follow-up shipment to make up the items that were not received previously.
      </div>
      <div className="h5-section-title mt12">Shortfall Items</div>
      <div className="h5-card">
        {shortItems.length === 0 && <div className="muted" style={{ fontSize: 12.5, padding: '14px 0', textAlign: 'center' }}>No outstanding shortfall on this order</div>}
        {shortItems.map((it, i) => (
          <div key={it.pid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < shortItems.length - 1 ? '1px solid #F0F2F5' : 'none' }}>
            <img src={prodImg(db.products.find(p => p.id === it.pid))} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>Ordered: {it.qty} · <span style={{ color: '#C5483C', fontWeight: 700 }}>Shortage: {outstanding[it.pid]}</span></div>
            </div>
            <input className="input" type="number" value={qtys[it.pid]} onChange={e => setQtys(s => ({ ...s, [it.pid]: e.target.value }))} style={{ height: 32, width: 84 }} />
          </div>
        ))}
      </div>
      <button className="h5-btn primary mt16" style={{ width: '100%' }} onClick={() => {
        const numQtys = {};
        let any = false;
        Object.keys(qtys).forEach(k => { const v = Number(qtys[k]); if (v > 0) { numQtys[k] = v; any = true; } });
        if (!any) { toast('Enter at least one quantity to replenish', 'info'); return; }
        act.replenish(po, numQtys);
        onDone();
      }}><Icon name="truck" size={14} />Confirm Replenishment</button>
    </div>
  );
}

Object.assign(window, {
  H5ProductFormPage, H5ScanPage, H5ImportPage, H5CategoriesPage, H5StockPage, H5MovementsPage,
  H5QuoteFormPage, H5PrintPage, H5ExportSheet, H5AdminPage, H5MembersPage, H5BindWaPage,
  GuestDocStage, H5GuestDocPage, H5PriceFormPage, H5AdjustStockPage, H5ReReceivePage,
  H5AcceptPage, H5PayPage, H5ReplenishPage,
});
