// ============================================================
// web-dialogs.jsx — Web console dialogs
// ============================================================

// round 56 — icon mapping for dialog document action verbs (icon+text buttons)
const DLG_VERB_ICON = { Accept: 'check', Approve: 'check', Submit: 'check', Quote: 'edit', 'Confirm Quote': 'checkDouble', 'Place Order': 'cart', Ship: 'truck', Dispatch: 'truck', 'Confirm Receipt': 'checkDouble', 'Create Invoice': 'receipt', 'Confirm Invoice': 'checkDouble', 'Record Payment': 'receipt', 'Confirm Payment': 'checkDouble', 'Start Picking': 'truck', Reject: 'close', Cancel: 'close', Close: 'close', Delete: 'trash', Print: 'print', Export: 'download', 'Re-receive': 'checkDouble', 'Replenish': 'truck', 'Terminate Receiving': 'close' };

// ---------- product form ----------
function ProductFormDialog({ editProduct, onClose }) {
  const { db, account, act, toast } = useApp();
  const p = editProduct || {};
  const [f, setF] = useState({
    name: p.name || '', spec: p.spec || '', model: p.model || '', brand: p.brand || '',
    unit: p.unit || 'pcs', price: ifnull(p.price, ''), currency: p.currency || 'USD',
    stock: editProduct ? ifnull((db.stock[account.tenantId] || {})[p.id], 0) : 100,
    categories: p.categories ? [...p.categories] : [],
    onSale: p.onSale !== false,
    images: p.images ? [...p.images] : (p.image ? [p.image] : []),
    // R05 — 条码与型号彻底解耦（AC-05-01）：表里只存「主体码」，
    // 完整条码由「本商户前缀 + 主体码」在提交时拼出。
    barcodeBody: p.barcodeBody || '',
  });
  const [errors, setErrors] = useState({});
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  // R05 — 前缀是商户属性，表单里只读；主体码才可编辑（AC-05-02/03）
  const prefix = ownBarcodePrefix(db, account);
  const save = (publish) => {
    const errs = {};
    if (!f.name) errs.name = 'Product name is required';
    if (f.price === '' || isNaN(f.price) || Number(f.price) <= 0) errs.price = 'Enter a valid price';
    if (!f.categories.length) errs.categories = 'Select at least one category';
    // AC-05-04 — 与既有条码完全相同则拦截（空条码放行，AC-05-07）
    const barcode = composeBarcode(prefix, f.barcodeBody);
    if (barcode) {
      const conflict = findBarcodeConflict(db, barcode, editProduct ? p.id : null);
      if (conflict) errs.barcode = `Barcode ${barcode} is already used by "${conflict.name}"`;
    }
    setErrors(errs);
    if (Object.keys(errs).length) { toast('Please fix the highlighted fields', 'error'); return; }
    const payload = { ...f, barcode, barcodeBody: String(f.barcodeBody || '').trim() };
    if (editProduct) { act.updateProduct(p.id, payload); toast(`Product "${f.name}" updated`, 'success'); }
    else { act.createProduct(payload); toast(f.onSale !== false ? `Product "${f.name}" saved and published (On Sale)` : `Product "${f.name}" saved (Discontinued)`, 'success'); }
    onClose();
  };
  return (
    <Dialog title={editProduct ? 'Edit Product' : 'Add Product'} width="680px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn primary" onClick={() => save(true)}><Icon name="check" size={13} />{editProduct ? 'Save' : 'Save & Publish'}</button>
      </React.Fragment>}>
      <Banner tone="info" icon="box">Flat fields only — saving publishes the product immediately as sellable. SPU/SKU hierarchy arrives post-MVP. <span className="mini-chip mvp">MVP</span></Banner>
      <div className="form">
        <FormRow label="Product Images" hint="Upload up to 10 images (multiple allowed) or click preset icons; drag the ⣿ handle to reorder — the first image is the main one, ★ promotes any thumbnail to main.">
          <ProductImagePicker value={f.images} onChange={v => set('images', v)} />
        </FormRow>
        <FormRow label="Product Name" required error={errors.name}>
          <Input value={f.name} onChange={v => set('name', v)} placeholder="e.g. Solar Inverter 5kW" error={errors.name} />
        </FormRow>
        <FormRow label="Brand">
          <Input value={f.brand} onChange={v => set('brand', v)} placeholder="e.g. SunKing" />
        </FormRow>
        <FormRow label="Specification">
          <Input value={f.spec} onChange={v => set('spec', v)} placeholder="e.g. 5kW / MPPT / 48V" />
        </FormRow>
        <FormRow label="Model">
          <Input value={f.model} onChange={v => set('model', v)} placeholder="e.g. SK-INV-5K" />
        </FormRow>
        {/* R05 — 条码独立字段，与型号互不替代（AC-05-01）。前缀区只读、主体码可编辑，
            视觉上合成一个输入整体（AC-05-02）。留空表示「尚未编码」，允许保存（AC-05-07）。 */}
        <FormRow label="Barcode" error={errors.barcode}
          hint={prefix ? `Merchant prefix ${prefix} is fixed — only the body is editable. Leave it empty to save without a barcode.` : 'This account has no merchant prefix — the body is stored as the full barcode.'}>
          <div className="flex gap8">
            {prefix ? <span className="prefix-chip">{prefix}</span> : null}
            <Input value={f.barcodeBody} onChange={v => set('barcodeBody', v)} placeholder="e.g. INV5K01" error={errors.barcode} />
          </div>
        </FormRow>
        <FormRow label="Unit">
          <Select value={f.unit} onChange={v => set('unit', v)} options={['pcs', 'box', 'set', 'kg'].map(u => ({ value: u, label: u }))} />
        </FormRow>
        <FormRow label="Channel Sales Price" required error={errors.price}>
          {/* R108 — 价格表单项统一币种在前、金额在后 */}
          <div className="flex gap8">
            <Select value={f.currency} onChange={v => set('currency', v)} style={{ width: 100 }} options={['USD', 'NGN', 'CNY'].map(c => ({ value: c, label: c }))} />
            <Input value={f.price} onChange={v => set('price', v)} placeholder="0.00" error={errors.price} />
          </div>
        </FormRow>
        <FormRow label="Initial Stock" hint="Stocked into your Default Warehouse">
          <Input value={f.stock} onChange={v => set('stock', v)} type="number" />
        </FormRow>
        <FormRow label="On Sale">
          <Switch value={f.onSale} onChange={v => set('onSale', v)} activeText="Active" inactiveText="Inactive" />
        </FormRow>
        <FormRow label="Categories" required span2 error={errors.categories} hint="Platform-unified flat categories; a product may belong to multiple categories">
          <div className="flex gap8" style={{ flexWrap: 'wrap' }}>
            {db.categories.map(c => {
              const on = f.categories.includes(c.id);
              return (
                <span key={c.id} className={`tag ${on ? 'primary' : 'info'}`} style={{ cursor: 'pointer', opacity: on ? 1 : 0.65 }}
                  onClick={() => set('categories', on ? f.categories.filter(x => x !== c.id) : [...f.categories, c.id])}>{on ? <React.Fragment><Icon name="check" size={10} /> </React.Fragment> : ''}{c.name}</span>
              );
            })}
          </div>
        </FormRow>
      </div>
    </Dialog>
  );
}

// ---------- batch import ----------
// MVP #3/#4/#5 — real template download, row-by-row validation demo,
// failed-row receipt export + corrected re-import, and actual product writes.
const BATCH_OK_ROWS = [
  { row: 2, name: 'Solar Inverter 3kW', spec: '3kW / MPPT / 48V', model: 'SK-INV-3K', brand: 'SunKing', unit: 'pcs', price: 199, currency: 'USD', stock: 60, cats: ['cat-1', 'cat-6'] },
  { row: 3, name: 'Solar Inverter 8kW', spec: '8kW / MPPT / 48V', model: 'SK-INV-8K', brand: 'SunKing', unit: 'pcs', price: 465, currency: 'USD', stock: 25, cats: ['cat-1'] },
  { row: 4, name: 'LiFePO4 Battery 50Ah', spec: '50Ah / 12.8V / BMS', model: 'VC-LFP-50', brand: 'VoltCore', unit: 'pcs', price: 105, currency: 'USD', stock: 120, cats: ['cat-2'] },
  { row: 5, name: 'LiFePO4 Battery 200Ah', spec: '200Ah / 51.2V / BMS', model: 'VC-LFP-200', brand: 'VoltCore', unit: 'pcs', price: 389, currency: 'USD', stock: 40, cats: ['cat-2'] },
  { row: 6, name: 'LED Solar Street Light 30W', spec: '30W / PIR / IP66', model: 'LX-SL-30', brand: 'LumenX', unit: 'pcs', price: 29.5, currency: 'USD', stock: 300, cats: ['cat-4'] },
  { row: 7, name: 'LED Flood Light 100W', spec: '100W / IP66', model: 'LX-FL-100', brand: 'LumenX', unit: 'pcs', price: 54, currency: 'USD', stock: 150, cats: ['cat-4'] },
  { row: 8, name: 'Solar Panel Poly 300W', spec: '300W / poly', model: 'HM-PV-300P', brand: 'HelioMax', unit: 'pcs', price: 61, currency: 'USD', stock: 200, cats: ['cat-3'] },
  { row: 9, name: 'MC4 Connector Pair', spec: 'IP68 / 1000V', model: 'AC-MC4-P', brand: 'AmeConnect', unit: 'set', price: 1.8, currency: 'USD', stock: 1000, cats: ['cat-6'] },
  { row: 10, name: 'DC Circuit Breaker 63A', spec: '63A / 2P / 500VDC', model: 'SA-CB-63', brand: 'SafeAmp', unit: 'pcs', price: 9.9, currency: 'USD', stock: 260, cats: ['cat-5', 'cat-6'] },
  { row: 11, name: 'Solar Cable 6mm (100m)', spec: '6mm² / PV1-F', model: 'PW-SC-6', brand: 'PowerWire', unit: 'box', price: 78, currency: 'USD', stock: 80, cats: ['cat-6'] },
  { row: 12, name: 'Mounting Rail Set', spec: 'Aluminum / 2.4m', model: 'MT-RS-24', brand: 'MountTek', unit: 'set', price: 22, currency: 'USD', stock: 160, cats: ['cat-6'] },
];
const BATCH_FAIL_ROWS = [
  { row: 13, name: '', spec: '2kW / off-grid', model: 'SK-OG-2K', brand: 'SunKing', unit: 'pcs', price: 149, currency: 'USD', stock: 40, cats: ['cat-1'], reason: 'Required field "Product Name" is empty' },
  { row: 14, name: 'Hybrid Inverter 10kW', spec: '10kW / hybrid', model: 'SK-HYB-10', brand: 'SunKing', unit: 'pcs', price: '12.5O', currency: 'USD', stock: 15, cats: ['cat-1'], reason: 'Price "12.5O" is not a valid number' },
  { row: 15, name: 'Solar Inverter 5kW (re-list)', spec: '5kW / MPPT / 48V', model: 'SK-INV-5K', brand: 'SunKing', unit: 'pcs', price: 285, currency: 'USD', stock: 30, cats: ['cat-1'], reason: 'Duplicate model SK-INV-5K already exists' },
];
const BATCH_CORRECTED_ROWS = [
  { row: 2, name: 'Off-Grid Inverter 2kW', spec: '2kW / off-grid', model: 'SK-OG-2K', brand: 'SunKing', unit: 'pcs', price: 149, currency: 'USD', stock: 40, cats: ['cat-1'] },
  { row: 3, name: 'Hybrid Inverter 10kW', spec: '10kW / hybrid', model: 'SK-HYB-10', brand: 'SunKing', unit: 'pcs', price: 1250, currency: 'USD', stock: 15, cats: ['cat-1'] },
  { row: 4, name: 'Solar Inverter 5kW Export', spec: '5kW / MPPT / 48V', model: 'SK-INV-5K-X', brand: 'SunKing', unit: 'pcs', price: 285, currency: 'USD', stock: 30, cats: ['cat-1', 'cat-6'] },
];

// ---------- downstream stock (sales chain of one product) ----------
function DownstreamStockDialog({ productId, onClose }) {
  const { db, account } = useApp();
  const p = db.products.find(x => x.id === productId);
  if (!p) return null;
  let dsTenants = 0, dsTotal = 0;
  const myStockV = (db.stock[account.tenantId] || {})[productId];
  const walk = (list) => list.forEach(n => {
    const s = (db.stock[n.id] || {})[productId];
    if (s != null) { dsTenants += 1; dsTotal += s; }
    walk(n.children);
  });
  walk(downstreamChain(db, account.tenantId));
  return (
    <Dialog title={`Downstream Stock — ${p.name}`} width="560px" onClose={onClose}
      footer={<button className="btn" onClick={onClose}><Icon name="close" size={13} />Close</button>}>
      <div className="flex gap10 mb12">
        <div style={{ flex: 1, textAlign: 'center', padding: '8px 6px', background: '#F7F9FB', borderRadius: 8 }}><div className="muted small">My Stock</div><div className="mono bold" style={{ fontSize: 16 }}>{myStockV == null ? '—' : <React.Fragment>{myStockV} {p.unit}</React.Fragment>}</div></div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px 6px', background: '#F7F9FB', borderRadius: 8 }}><div className="muted small">Downstream Merchants</div><div className="mono bold" style={{ fontSize: 16 }}>{dsTenants}</div></div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px 6px', background: '#F7F9FB', borderRadius: 8 }}><div className="muted small">Channel Total</div><div className="mono bold" style={{ fontSize: 16 }}>{dsTotal} {p.unit}</div></div>
      </div>
      <DownstreamStockTree db={db} rootTenantId={account.tenantId} productId={productId} />
      <div className="muted small mt12">Stock visibility follows the sales chain — each level shows the current on-hand quantity of this product; receiving and outbound update the numbers in real time.</div>
    </Dialog>
  );
}

function ImportDialog({ onClose }) {
  const { account, act, toast } = useApp();
  const [step, setStep] = useState(1); // 1 upload, 2 validation, 3 corrected re-import
  const [file, setFile] = useState('');
  const [receiptExported, setReceiptExported] = useState(false);
  const failed = BATCH_FAIL_ROWS;
  const exportReceipt = () => {
    const header = ['Excel Row', 'Product Name', 'Spec', 'Model', 'Brand', 'Unit', 'Price', 'Currency', 'Stock', 'Categories', 'Error'];
    const rows = failed.map(r => [r.row, r.name, r.spec, r.model, r.brand, r.unit, r.price, r.currency, r.stock, r.cats.map(c => c).join('; '), r.reason]);
    downloadFile('failed_rows_receipt.csv', [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\n'));
    setReceiptExported(true);
    toast('Failed-row receipt exported — fix the errors and re-import the file', 'success');
  };
  const importRows = (rows) => {
    act.batchImportProducts(rows.map(r => ({ name: r.name, spec: r.spec, model: r.model, brand: r.brand, unit: r.unit, price: r.price, currency: r.currency, stock: r.stock, categories: r.cats })), account.tenantId);
    act.logEvent('Batch Import', `${rows.length} products from import file`);
    onClose();
  };
  return (
    <Dialog title="Batch Import Products" width="760px" onClose={onClose}
      footer={<React.Fragment>
        {step === 1 && <button className="btn" onClick={() => { downloadProductTemplate(); toast('Excel template downloaded — fill and re-upload (demo: .csv)', 'success'); }}><Icon name="download" size={14} />Download Template</button>}
        {step === 2 && <button className="btn" onClick={exportReceipt} disabled={receiptExported}><Icon name="download" size={14} />{receiptExported ? 'Receipt Exported' : 'Export Failed Rows'}</button>}
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Close</button>
        {step === 1 && <button className="btn primary" disabled={!file} onClick={() => setStep(2)}><Icon name="upload" size={13} />Validate &amp; Import</button>}
        {step === 2 && <button className="btn primary" onClick={() => importRows(BATCH_OK_ROWS)}><Icon name="check" size={13} />Confirm Import (11 valid rows)</button>}
        {step === 2 && receiptExported && <button className="btn" onClick={() => { setFile('failed_rows_receipt_corrected.csv'); setStep(3); }}><Icon name="upload" size={14} />Upload Corrected File</button>}
        {step === 3 && <button className="btn primary" onClick={() => importRows(BATCH_CORRECTED_ROWS)}><Icon name="upload" size={13} />Import Corrected Rows (3)</button>}}
      </React.Fragment>}>
      <Banner tone="info" icon="upload">Rows are validated one by one (required fields / formats / duplicates). Failed rows can be exported as a receipt, corrected, and re-imported. Validated rows are imported into your product list and stock ledger.</Banner>
      {step === 1 && (
        <div onClick={() => { setFile('products_batch_20260904.csv'); }} style={{
          border: '2px dashed var(--border)', borderRadius: 8, padding: '34px 20px', textAlign: 'center', cursor: 'pointer', background: '#FAFBFC',
        }}>
          <Icon name="upload" size={30} style={{ color: 'var(--primary)', marginBottom: 8 }} />
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{file || 'Click to select an import file (.csv / .xlsx)'}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Fields: Name / Spec / Model / Brand / Unit / Price / Currency / Stock / Categories</div>
        </div>
      )}
      {step === 2 && (
        <React.Fragment>
          <div className="flex gap12 mb12">
            <Tag tone="success">14 rows parsed</Tag>
            <Tag tone="success">11 passed</Tag>
            <Tag tone="danger">3 failed</Tag>
            {receiptExported && <Tag tone="primary">Receipt exported — ready for correction</Tag>}
          </div>
          <Table columns={[
            { key: 'row', label: 'File Row', width: 90, render: r => <span className="mono small">#{r.row}</span> },
            { key: 'name', label: 'Product Name', render: r => r.name || <span className="muted">(empty)</span> },
            { key: 'model', label: 'Model', width: 130, render: r => <span className="mono small">{r.model}</span> },
            { key: 'status', label: 'Validation', width: 110, render: r => r.reason ? <Tag tone="danger">Failed</Tag> : <Tag tone="success">Passed</Tag> },
            { key: 'reason', label: 'Reason', render: r => r.reason ? <span className="small" style={{ color: 'var(--danger)' }}>{r.reason}</span> : <span className="muted small">—</span> },
          ]} rows={[...BATCH_OK_ROWS, ...failed]} rowKey="row" />
        </React.Fragment>
      )}
      {step === 3 && (
        <React.Fragment>
          <div className="flex gap12 mb12">
            <Tag tone="primary">Corrected file: failed_rows_receipt_corrected.csv</Tag>
            <Tag tone="success">3 rows re-validated</Tag>
            <Tag tone="success">3 passed</Tag>
          </div>
          <Table columns={[
            { key: 'row', label: 'File Row', width: 90, render: r => <span className="mono small">#{r.row}</span> },
            { key: 'name', label: 'Product Name', render: r => r.name },
            { key: 'model', label: 'Model', width: 130, render: r => <span className="mono small">{r.model}</span> },
            { key: 'fix', label: 'Fix Applied', render: r => <span className="small" style={{ color: 'var(--success)' }}>{r.fix}</span> },
          ]} rows={[
            { ...BATCH_CORRECTED_ROWS[0], fix: 'Product name filled in' },
            { ...BATCH_CORRECTED_ROWS[1], fix: 'Price corrected to 1250.00' },
            { ...BATCH_CORRECTED_ROWS[2], fix: 'Model changed to unique SK-INV-5K-X' },
          ]} rowKey="row" />
        </React.Fragment>
      )}
    </Dialog>
  );
}

// ---------- category ----------
function CategoryDialog({ category, onClose }) {
  const { act, toast } = useApp();
  const [name, setName] = useState(category ? category.name : '');
  const [err, setErr] = useState('');
  return (
    <Dialog title={category ? 'Edit Category' : 'Add Category'} width="440px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn primary" onClick={() => {
          if (!name.trim()) { setErr('Category name is required'); return; }
          if (!category) act.saveCategory(name);
          else toast('Category updated', 'success');
          onClose();
        }}><Icon name="check" size={13} />Save</button>
      </React.Fragment>}>
      <FormRow label="Category Name" required error={err}>
        <Input value={name} onChange={v => { setName(v); setErr(''); }} placeholder="e.g. Solar Inverters" error={err} />
      </FormRow>
      <FormRow label="Level" hint="Flat taxonomy — no parent categories in MVP">
        <Input value="Top-level (platform-unified)" readonly />
      </FormRow>
    </Dialog>
  );
}

// ---------- inquiry form ----------
function InquiryFormDialog({ editDoc, initialPid, onClose }) {
  const { db, account, act, toast } = useApp();
  // inquiries go to upstream tenants only (supplier / parent agents);
  // inquiry lines are limited to products owned by an upstream tenant
  const suppliers = account.type === 'tenant'
    ? [...upstreamTenantIds(db, account.tenantId)]
        .map(id => db.tenants.find(t => t.id === id)).filter(t => t && t.status === 'Active')
    : [];
  const upstreamIds = new Set(suppliers.map(t => t.id));
  const inqProducts = db.products.filter(p => upstreamIds.has(p.ownerId));
  // default seller follows the owner of the pre-filled product (channel-tab Inquire)
  const initOwner = initialPid ? (db.products.find(p => p.id === initialPid) || {}).ownerId : null;
  const initSeller = (suppliers.some(s => s.id === initOwner) ? initOwner : '') || (suppliers[0] || {}).id || '';
  const [f, setF] = useState(() => {
    if (editDoc) return { seller: editDoc.seller, deliveryDate: editDoc.deliveryDate || '', items: editDoc.items.map(it => ({ ...it })) };
    return { seller: initSeller, deliveryDate: '', items: [{ pid: initialPid || '', qty: '' }] };
  });
  const [errors, setErrors] = useState({});
  const stockAvail = pid => {
    const p = db.products.find(x => x.id === pid);
    const v = p ? (db.stock[f.seller] || {})[pid] : null;
    return v == null ? '—' : <React.Fragment>{v} {p.unit}</React.Fragment>;
  };
  const save = (submit) => {
    const errs = {};
    if (!f.seller) errs.seller = 'Select a supplier';
    if (!f.deliveryDate) errs.deliveryDate = 'Delivery date is required';
    const items = f.items.filter(it => it.pid);
    if (!items.length) errs.items = 'Add at least one product line';
    if (items.some(it => !it.qty || Number(it.qty) <= 0)) errs.items = 'All quantities must be positive numbers';
    setErrors(errs);
    if (Object.keys(errs).length) { toast('Please fix the highlighted fields', 'error'); return; }
    act.saveInquiry({ ...f, items, editId: editDoc ? editDoc.id : null }, submit);
    onClose();
  };
  const updItem = (i, k, v) => setF(s => ({ ...s, items: s.items.map((it, j) => i === j ? { ...it, [k]: v } : it) }));
  return (
    <Dialog title={editDoc ? `Edit Inquiry ${editDoc.no}` : 'New Inquiry'} width="760px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        {!editDoc && <button className="btn" onClick={() => save(false)}><Icon name="file" size={13} />Save as Draft</button>}
        <button className="btn primary" onClick={() => save(true)}><Icon name="check" size={13} />Submit Inquiry</button>
      </React.Fragment>}>
      <div className="form">
        <FormRow label="Supplier" required error={errors.seller}>
          <Select value={f.seller} onChange={v => setF(s => ({ ...s, seller: v }))} error={errors.seller}
            options={suppliers.map(t => ({ value: t.id, label: `${t.name} (${t.type})` }))} />
        </FormRow>
        <FormRow label="Receiving Warehouse" hint="Single default warehouse in MVP">
          <Input value={t('Default Warehouse (auto-created)')} readonly />
        </FormRow>
        <FormRow label="Delivery Date" required error={errors.deliveryDate}>
          <Input value={f.deliveryDate} onChange={v => setF(s => ({ ...s, deliveryDate: v }))} type="date" error={errors.deliveryDate} />
        </FormRow>
        <FormRow label="Inquiry No" hint="Auto-numbered on submit">
          <Input value={editDoc ? editDoc.no : nextNo('IQ', db.docs).split('-').slice(0, 2).join('-') + '-•••'} readonly />
        </FormRow>
        <div className="form-grid-hr"></div>
        <div className="form-row span2">
          <label className="form-label">Item Lines <span className="req">*</span></label>
          {errors.items && <div className="field-error"><Icon name="error" size={12} />{errors.items}</div>}
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Product</th><th style={{ width: 110 }}>Qty</th><th style={{ width: 36 }}></th></tr></thead>
              <tbody>
                {f.items.map((it, i) => (
                  <tr key={i}>
                    <td><Select value={it.pid} onChange={v => {
                      const p = db.products.find(x => x.id === v);
                      updItem(i, 'pid', v);
                      if (p) updItem(i, 'price', p.price);
                    }} placeholder="Select product" options={inqProducts.map(p => ({ value: p.id, label: `${p.name} (${p.model})${suppliers.length > 1 ? ' · ' + tenantName(db, p.ownerId) : ''}` }))} /></td>
                    <td><Input value={it.qty} onChange={v => updItem(i, 'qty', v)} type="number" placeholder="0" /></td>
                    <td>{f.items.length > 1 && <button className="btn sm text error-text" onClick={() => setF(s => ({ ...s, items: s.items.filter((_, j) => j !== i) }))}><Icon name="trash" size={13} /></button>}</td>
                  </tr>
                ))}
                <tr><td colSpan={3}>
                  <button className="btn sm" onClick={() => setF(s => ({ ...s, items: [...s.items, { pid: '', qty: '' }] }))}><Icon name="plus" size={12} />Add Line</button>
                </td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

// ---------- quote form (with AI draft) ----------
function QuoteFormDialog({ inquiry, editQuote, onClose }) {
  const { db, account, act, toast } = useApp();
  const [items, setItems] = useState(() => {
    const src = inquiry ? inquiry.items : editQuote.items;
    return src.map(it => ({ ...it, price: ifnull(it.price, '') , suggested: false }));
  });
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return editQuote ? editQuote.validUntil : d.toISOString().slice(0, 10);
  });
  const [aiUsed, setAiUsed] = useState(false);
  const currency = inquiry ? inquiry.currency : editQuote.currency;
  const aiDraft = () => {
    setItems(items.map(it => {
      const ref = db.products.find(p => p.id === it.pid);
      let price = it.price;
      if (ref) {
        // R13 — AI 草稿取阶梯首轮让价，同样受 settings.aiPolicy 边界约束（AC-13-05）
        const step = 1 - nextAiDiscount(db.settings.aiPolicy, 0).discount;
        price = ref.currency === currency ? +(ref.price * step).toFixed(2) : Math.round(ref.price * 1550 * step);
      }
      return { ...it, price, suggested: true };
    }));
    setAiUsed(true);
    toast('AI quote draft generated from inquiry lines — review before sending', 'success');
  };
  return (
    <Dialog title={inquiry ? `Quote for ${inquiry.no}` : `Edit Quote ${editQuote.no}`} width="720px" onClose={onClose}
      badge={aiUsed ? <span className="mini-chip ai">AI DRAFT</span> : null}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn" onClick={aiDraft}><Icon name="ai" size={14} />AI Draft Quote</button>
        <button className="btn primary" onClick={() => {
          if (items.some(it => it.price === '' || isNaN(it.price))) { toast('Enter a unit price for every line', 'error'); return; }
          act.sendQuote(inquiry, items, validUntil, editQuote);
          onClose();
        }}><Icon name="check" size={13} />Send Quote</button>
      </React.Fragment>}>
      {inquiry && (
        <Descriptions cols={3} items={[
          { label: 'Inquiry', value: <span className="mono">{inquiry.no}</span> },
          { label: 'Buyer', value: tenantName(db, inquiry.buyer) },
          { label: 'Delivery Date', value: inquiry.deliveryDate },
        ]} />
      )}
      <div className="section-label mt16">Quote Lines <span className="mini-chip ai" hidden={!aiUsed}>AI suggested prices — editable</span></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th style={{ width: 90 }}>Qty</th><th style={{ width: 150 }}>Channel Sales Price ({currency})</th><th style={{ width: 130 }} className="right">Amount</th></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td><div style={{ fontSize: 13 }} className="bold">{it.name}</div><div className="cell-sub mono">{it.spec}</div></td>
                <td className="mono">{it.qty}</td>
                <td><div className="flex gap8">
                  {/* R108 — 币种在前、金额在后 */}
                  <Input value={it.price} onChange={v => setItems(items.map((x, j) => i === j ? { ...x, price: v, suggested: false } : x))} placeholder="0.00" prefix={currency} />
                  {it.suggested && <span className="mini-chip ai">AI</span>}
                </div></td>
                <td className="right"><Money amount={(Number(it.price) || 0) * it.qty} currency={currency} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form mt16">
        <FormRow label="Valid Until" required>
          <Input value={validUntil} onChange={setValidUntil} type="date" />
        </FormRow>
        <FormRow label="Notify Buyer" hint="WhatsApp push with quote link">
          <Input value="Auto: buyer main account" readonly />
        </FormRow>
      </div>
      {/* R15 — payee info shown on the quote (readonly, same data as settings) */}
      <PayeeInfoBlock />
    </Dialog>
  );
}

// ---------- PO form ----------
function POFormDialog({ editDoc, onClose }) {
  const { db, account, act, toast } = useApp();
  const sellers = account.type === 'tenant'
    ? [...relatedTenantIds(db, account.tenantId)].filter(id => id !== account.tenantId)
        .map(id => db.tenants.find(t => t.id === id)).filter(t => t && t.status === 'Active')
    : [];
  const [f, setF] = useState(() => {
    if (editDoc) return { seller: editDoc.seller, deliveryDate: editDoc.deliveryDate || '', items: editDoc.items.map(it => ({ ...it })) };
    return { seller: sellers[0] ? sellers[0].id : '', deliveryDate: '', items: [{ pid: '', qty: '', price: '' }] };
  });
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState([]);
  const updItem = (i, k, v) => setF(s => ({ ...s, items: s.items.map((it, j) => i === j ? { ...it, [k]: v } : it) }));
  const save = (submit) => {
    const errs = {};
    if (!f.seller) errs.seller = 'Select a supplier';
    if (!f.deliveryDate) errs.deliveryDate = 'Delivery date is required';
    const items = f.items.filter(it => it.pid);
    if (!items.length) errs.items = 'Add at least one product line';
    if (items.some(it => !it.qty || Number(it.qty) <= 0 || it.price === '' || isNaN(it.price))) errs.items = 'Complete qty and price for every line';
    setErrors(errs);
    if (Object.keys(errs).length) { toast('Please fix the highlighted fields', 'error'); return; }
    // stock & price compliance validation
    const warns = [];
    items.forEach(it => {
      const avail = ifnull((db.stock[f.seller] || {})[it.pid], 0);
      if (Number(it.qty) > avail) { const up = db.products.find(pp => pp.id === it.pid) || {}; warns.push(`${it.name}: requested ${it.qty}, supplier stock ${avail}${up.unit ? ' ' + t(up.unit) : ''}`); }
      const ref = db.products.find(p => p.id === it.pid);
      if (ref && ref.currency === (editDoc ? editDoc.currency : 'USD')) {
        const diff = Math.abs(Number(it.price) - ref.price) / ref.price;
        if (diff > 0.1) warns.push(`${it.name}: price deviates ${(diff * 100).toFixed(0)}% from reference`);
      }
    });
    setWarnings(warns);
    if (submit && warns.length) { toast('Validation warnings — review before submitting', 'warning'); return; }
    act.savePO({ ...f, items, editId: editDoc ? editDoc.id : null }, submit && !warns.length);
    if (!submit || !warns.length) onClose();
  };
  const chainPreview = f.seller ? [f.seller, account.tenantId] : [];
  return (
    <Dialog title={editDoc ? `Edit Order ${editDoc.no}` : 'New Purchase Order'} width="780px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        {/* R86 — orders have no Draft stage: a PO is born at 待接收 on submit */}
        <button className="btn primary" onClick={() => save(true)}><Icon name="check" size={13} />Submit Order</button>
      </React.Fragment>}>
      {warnings.length > 0 && <Banner tone="warning" icon="warn"><b>Validation warnings:</b><ul style={{ margin: '4px 0 0 16px' }}>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></Banner>}
      <div className="form">
        <FormRow label="Supplier" required error={errors.seller}>
          <Select value={f.seller} onChange={v => setF(s => ({ ...s, seller: v }))} error={errors.seller}
            options={sellers.map(t => ({ value: t.id, label: `${t.name} (${t.type})` }))} />
        </FormRow>
        <FormRow label="Delivery Date" required error={errors.deliveryDate}>
          <Input value={f.deliveryDate} onChange={v => setF(s => ({ ...s, deliveryDate: v }))} type="date" error={errors.deliveryDate} />
        </FormRow>
        <FormRow label="Agency Chain (ChainPath)" span2 hint="Recorded on the order for traceability across the tiered chain">
          <div className="chain-path">
            {chainPreview.map((tid, i) => (
              <React.Fragment key={tid}>
                {i > 0 && <span className="chain-arrow">›</span>}
                <span className="chain-node">{tenantName(db, tid)}</span>
              </React.Fragment>
            ))}
            {!f.seller && <span className="muted small">Select a supplier to preview the chain</span>}
          </div>
        </FormRow>
        <div className="form-grid-hr"></div>
        <div className="form-row span2">
          <label className="form-label">Item Lines <span className="req">*</span></label>
          {errors.items && <div className="field-error"><Icon name="error" size={12} />{errors.items}</div>}
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Product</th><th style={{ width: 90 }}>Qty</th><th style={{ width: 130 }}>Channel Sales Price</th><th style={{ width: 100 }}>Supplier Stock</th><th style={{ width: 36 }}></th></tr></thead>
              <tbody>
                {f.items.map((it, i) => (
                  <tr key={i}>
                    <td><Select value={it.pid} onChange={v => {
                      const p = db.products.find(x => x.id === v);
                      updItem(i, 'pid', v);
                      if (p) { updItem(i, 'price', p.price); updItem(i, 'name', p.name); updItem(i, 'spec', p.spec); }
                    }} placeholder="Select product" options={db.products.map(p => ({ value: p.id, label: `${p.name} (${p.model})` }))} /></td>
                    <td><Input value={it.qty} onChange={v => updItem(i, 'qty', v)} type="number" placeholder="0" /></td>
                    <td><Input value={it.price} onChange={v => updItem(i, 'price', v)} placeholder="0.00" prefix={(db.products.find(x => x.id === it.pid) || {}).currency || ''} /></td>
                    <td className="mono small">{it.pid ? stockAvail(it.pid) : '—'}</td>
                    <td>{f.items.length > 1 && <button className="btn sm text error-text" onClick={() => setF(s => ({ ...s, items: s.items.filter((_, j) => j !== i) }))}><Icon name="trash" size={13} /></button>}</td>
                  </tr>
                ))}
                <tr><td colSpan={5}>
                  <button className="btn sm" onClick={() => setF(s => ({ ...s, items: [...s.items, { pid: '', qty: '', price: '' }] }))}><Icon name="plus" size={12} />Add Line</button>
                </td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

// ---------- adjust stock ----------
function AdjustStockDialog({ productId, onClose }) {
  const { db, account, act } = useApp();
  const p = db.products.find(x => x.id === productId);
  const current = ifnull((db.stock[account.tenantId] || {})[productId], 0);
  const [type, setType] = useState('IN');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  return (
    <Dialog title="Adjust Stock" width="480px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn warning" onClick={() => {
          const n = Number(qty);
          if (!qty || isNaN(n) || n <= 0 || (type === 'OUT' && n > current)) { setErr(type === 'OUT' && n > current ? `Only ${current} ${t(p.unit)} on hand` : 'Enter a valid quantity'); return; }
          act.adjustStock(productId, type, n, reason || 'Manual adjustment');
          onClose();
        }}><Icon name="check" size={13} />Confirm Adjustment</button>
      </React.Fragment>}>
      <Descriptions items={[
        { label: 'Product', value: <span className="bold">{p.name}</span> },
        { label: 'Warehouse', value: 'Default Warehouse' },
        { label: 'Current On Hand', value: <span className="mono bold">{current} {p.unit}</span> },
      ]} />
      <div className="form mt16" style={{ gridTemplateColumns: '1fr' }}>
        <FormRow label="Change Type" required>
          <RadioRow value={type} onChange={setType} options={[
            { value: 'IN', label: 'Inbound (+)' }, { value: 'OUT', label: 'Outbound (−)' }, { value: 'ADJ', label: 'Count adjustment (set to)' },
          ]} />
        </FormRow>
        <FormRow label="Quantity" required error={err}>
          <Input value={qty} onChange={v => { setQty(v); setErr(''); }} type="number" placeholder="0" error={err} />
        </FormRow>
        <FormRow label="Reason" hint="Recorded on the stock movement">
          <Textarea value={reason} onChange={setReason} placeholder="e.g. Cycle count correction, damaged goods write-off" rows={2} />
        </FormRow>
      </div>
    </Dialog>
  );
}

// ---------- ship dialog（R16：只确认发货 → 生成 CK 进入拣货，物流信息后置到发货 dispatch） ----------
function ShipDialog({ po, onClose }) {
  const { act } = useApp();
  return (
    <Dialog title={`Ship ${po.no}`} width="560px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn warning" onClick={() => {
          act.ship(po);
          onClose();
        }}><NavIcon name="stockOut" size={13} />Confirm Shipment</button>
      </React.Fragment>}>
      <Banner tone="warning" icon="warehouse">Confirming shipment will: decrement your stock and generate outbound doc <b>CK-</b> at <b>Picking</b>. Pick the goods first, then dispatch with the carrier info — the waybill and the buyer's WhatsApp link are generated at dispatch.</Banner>
    </Dialog>
  );
}

// ---------- R16 · dispatch dialog（拣货完成后录入承运信息并发货，AC-16-06） ----------
function DispatchDialog({ ck, onClose }) {
  const { act } = useApp();
  const [w, setW] = useState({ carrier: '', plate: '', driver: '', phone: '' });
  const [errors, setErrors] = useState({});
  return (
    <Dialog title={`Dispatch · ${ck.no}`} width="560px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn warning" onClick={() => {
          const errs = {};
          ['carrier', 'driver'].forEach(k => { if (!w[k]) errs[k] = 'Required'; });
          setErrors(errs);
          if (Object.keys(errs).length) return;
          act.dispatch(ck, w);
          onClose();
        }}><NavIcon name="stockOut" size={13} />Dispatch</button>
      </React.Fragment>}>
      <Banner tone="info" icon="truck">Dispatching generates the waybill and pushes a login-free confirmation link to the buyer via WhatsApp. The order moves to awaiting receipt.</Banner>
      <div className="form mt16">
        <FormRow label="Carrier" required error={errors.carrier}>
          <Input value={w.carrier} onChange={v => setW(s => ({ ...s, carrier: v }))} placeholder="e.g. Swift Cargo" error={errors.carrier} />
        </FormRow>
        <FormRow label="Vehicle Plate">
          <Input value={w.plate} onChange={v => setW(s => ({ ...s, plate: v }))} placeholder="e.g. LAG-772-XA" />
        </FormRow>
        <FormRow label="Driver" required error={errors.driver}>
          <Input value={w.driver} onChange={v => setW(s => ({ ...s, driver: v }))} placeholder="e.g. Emeka Obi" error={errors.driver} />
        </FormRow>
        <FormRow label="Driver Phone">
          <Input value={w.phone} onChange={v => setW(s => ({ ...s, phone: v }))} placeholder="+234 ..." />
        </FormRow>
      </div>
    </Dialog>
  );
}

// ---------- R16 · picking dialog（CK 拣货：扫码/手动勾选双确认、进度、短拣原因） ----------
function PickingDialog({ ckId, onClose }) {
  const { db, act, toast } = useApp();
  const ck = db.docs.find(d => d.id === ckId);
  const lines = (ck && ck.picking && ck.picking.lines) || [];
  const [picked, setPicked] = useState(() => Object.fromEntries(lines.map(l => [l.pid, String(l.pickedQty || 0)])));
  const [confirmed, setConfirmed] = useState(() => Object.fromEntries(lines.map(l => [l.pid, !!l.scanConfirmed])));
  const [manual, setManual] = useState(() => Object.fromEntries(lines.map(l => [l.pid, false])));
  const [shortReasons, setShortReasons] = useState(() => Object.fromEntries(lines.map(l => [l.pid, l.shortReason || ''])));
  // 打开即开始拣货（一次性；act 内部幂等：startedAt 已存在不重写）
  useEffect(() => { if (ck && ck.status === 'Picking' && !(ck.picking && ck.picking.startedAt)) act.startPicking(ck); }, []);
  if (!ck) return null;
  const doneCount = lines.filter(l => confirmed[l.pid] || manual[l.pid]).length;
  return (
    <Dialog title={`Picking · ${ck.no}`} width="720px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Pause</button>
        <button className="btn success" disabled={doneCount < lines.length} title={doneCount < lines.length ? 'Confirm every line (scan or manual) before completing the pick' : ''} onClick={() => {
          const ok = act.finishPicking(ck, picked, shortReasons);
          if (ok) onClose();
        }}><Icon name="checkDouble" size={13} />Complete Picking</button>
      </React.Fragment>}>
      <Banner tone="info" icon="warehouse">Pick each line by scanning the product barcode or confirming manually. Short picks are allowed but need a reason; over-picking is blocked.</Banner>
      <div className="section-label mt16" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Pick List</span>
        <span style={{ fontWeight: 600 }}>{doneCount < lines.length ? <span style={{ color: '#C0392B' }}><Icon name="alertCircle" size={12} /> </span> : <span style={{ color: '#1E8449' }}><Icon name="check" size={12} /> </span>}{t('Picked')} {doneCount} / {lines.length}</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th style={{ width: 80 }}>Expected</th><th style={{ width: 110 }}>Picked Qty</th><th style={{ width: 210 }}>Confirm</th><th>Short-pick Reason</th></tr></thead>
          <tbody>
            {lines.map(l => {
              const prod = db.products.find(p => p.id === l.pid) || {};
              const done = confirmed[l.pid] || manual[l.pid];
              const short = Number(picked[l.pid] || 0) < l.expectedQty;
              return (
                <tr key={l.pid} style={done ? { background: '#F0FAF4' } : undefined}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {done && <Icon name="check" size={13} color="#1E8449" />}
                      <div>
                        <div style={{ fontSize: 13 }} className="bold">{prod.name || l.pid}</div>
                        <div className="cell-sub mono">{prod.spec}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono">{l.expectedQty}</td>
                  <td><Input value={picked[l.pid] != null ? String(picked[l.pid]) : ''} type="number" onChange={v => { setPicked(s => ({ ...s, [l.pid]: v })); setConfirmed(s => ({ ...s, [l.pid]: false })); }} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button className="btn sm" onClick={() => { setPicked(s => ({ ...s, [l.pid]: String(l.expectedQty) })); setConfirmed(s => ({ ...s, [l.pid]: true })); setManual(s => ({ ...s, [l.pid]: false })); }}><Icon name="scan" size={12} />{confirmed[l.pid] ? t('Scanned') : t('Scan')}</button>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!manual[l.pid]} onChange={e => { setManual(s => ({ ...s, [l.pid]: e.target.checked })); if (e.target.checked) setConfirmed(s => ({ ...s, [l.pid]: false })); }} />
                        {t('Manually confirmed')}
                      </label>
                    </div>
                  </td>
                  <td>{short ? <Input value={shortReasons[l.pid] || ''} onChange={v => setShortReasons(s => ({ ...s, [l.pid]: v }))} placeholder="Reason (required)" /> : <span className="muted" style={{ fontSize: 12 }}>—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}

// ---------- receive dialog ----------
function ReceiveDialog({ ck, onClose }) {
  const { db, act } = useApp();
  const [mode, setMode] = useState('accept');
  const [qtys, setQtys] = useState(() => Object.fromEntries(ck.items.map(it => [it.pid, String(it.qty)])));
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  // R16 — 签收签名（手写 / 点选，选填；随实收写入 RK）
  const [signature, setSignature] = useState(null);
  // R97 — result drives the qty inputs:
  //   accept  → received = ordered, read-only
  //   partial → received defaults to 0, editable within [0, ordered]
  //   reject  → received = 0, read-only
  const pickMode = (v) => {
    setMode(v);
    setQtys(Object.fromEntries(ck.items.map(it => [it.pid, v === 'accept' ? String(it.qty) : '0'])));
  };
  return (
    <Dialog title={`Confirm Receipt · ${ck.no}`} width="640px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn success" onClick={() => {
          if (mode !== 'accept' && !reason.trim()) { setErr('Variance reason is required for partial / rejected receiving'); return; }
          if (mode === 'partial') {
            for (const it of ck.items) {
              const n = Number(qtys[it.pid]);
              if (qtys[it.pid] === '' || isNaN(n) || n < 0 || n > it.qty) { setErr('Received quantity must be between 0 and the ordered quantity'); return; }
            }
          }
          setErr('');
          act.receive(ck, mode, qtys, reason, null, signature);
          onClose();
        }}><Icon name="checkDouble" size={13} />Confirm</button>
      </React.Fragment>}>
      <Banner tone="info" icon="check">Accepted quantities increase your stock and generate the inbound record (RK-). Order completion auto-issues the sales invoice (FP-) on the seller side.</Banner>
      <div className="form mt16" style={{ gridTemplateColumns: '1fr' }}>
        <FormRow label="Result" required>
          <RadioRow value={mode} onChange={pickMode} options={[
            { value: 'accept', label: 'Accept — all items match' }, { value: 'partial', label: 'Partial receipt' }, { value: 'reject', label: 'Reject shipment' },
          ]} />
        </FormRow>
      </div>
      <div className="section-label mt16">Actually Received</div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th style={{ width: 90 }}>Ordered</th><th style={{ width: 130 }}>Actually Received</th></tr></thead>
          <tbody>
            {ck.items.map(it => (
              <tr key={it.pid}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={prodImg(db.products.find(p => p.id === it.pid))} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border-light)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13 }} className="bold">{it.name}</div>
                      <div className="cell-sub mono">{it.spec}</div>
                    </div>
                  </div>
                </td>
                <td className="mono">{it.qty}</td>
                <td><Input value={mode === 'partial' ? qtys[it.pid] : (mode === 'accept' ? String(it.qty) : '0')} onChange={v => { setQtys(s => ({ ...s, [it.pid]: v })); setErr(''); }} type="number" readonly={mode !== 'partial'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mode !== 'accept' && (
        <div className="form mt16" style={{ gridTemplateColumns: '1fr' }}>
          <FormRow label="Variance Reason" required error={err}>
            <Textarea value={reason} onChange={v => { setReason(v); setErr(''); }} rows={2} placeholder="e.g. 2 cartons damaged in transit (packaging failure)" error={err} />
          </FormRow>
        </div>
      )}
      {err && <div className="field-error mt8">{err}</div>}
      <div className="section-label mt16">{t('Signature (optional)')}</div>
      <SignatureBox value={signature} onChange={setSignature} />
    </Dialog>
  );
}

// ---------- R94 · accept order dialog (supplier accepts a PO) ----------
function AcceptOrderDialog({ po, onClose }) {
  const { db, act, toast } = useApp();
  const [shipDate, setShipDate] = useState('');
  const [note, setNote] = useState('');
  return (
    <Dialog title={`Accept Order · ${po.no}`} width="560px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn primary" onClick={() => {
          act.docVerb('Accept', po, null, note.trim(), { expectedShipDate: shipDate });
          onClose();
          toast(`Order ${po.no} accepted — invoice auto-issued and pushed to the buyer`, 'success');
        }}><Icon name="check" size={13} />Confirm Acceptance</button>
      </React.Fragment>}>
      <Banner tone="info" icon="check">Accepting the order issues the sales invoice (FP-) automatically and pushes it to the buyer via WhatsApp. The order then awaits the buyer's offline payment.</Banner>
      <div className="section-label mt16">Order Summary</div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th style={{ width: 70 }}>Qty</th><th style={{ width: 110 }}>Channel Sales Price</th></tr></thead>
          <tbody>
            {po.items.map(it => (
              <tr key={it.pid}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={prodImg(db.products.find(p => p.id === it.pid))} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border-light)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13 }} className="bold">{it.name}</div>
                      <div className="cell-sub mono">{it.spec}</div>
                    </div>
                  </div>
                </td>
                <td className="mono">{it.qty}</td>
                <td className="mono">{it.price ? (po.currency === 'NGN' ? '₦' : '$') + it.price.toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form mt16">
        <FormRow label="Expected Dispatch Date" hint="Shared with the buyer on the order timeline">
          <Input value={shipDate} onChange={setShipDate} type="date" />
        </FormRow>
        <FormRow label="Acceptance Note" hint="Optional — e.g. stock confirmed, packing arrangement">
          <Textarea value={note} onChange={setNote} rows={2} placeholder="e.g. Stock confirmed at Lagos warehouse — dispatch within 48h of payment" />
        </FormRow>
      </div>
    </Dialog>
  );
}

// ---------- R94 · record payment dialog (supplier records the buyer's offline payment) ----------
// ---------- R15 · readonly payee info block (quotes / order details) ----------
function PayeeInfoBlock() {
  const { db } = useApp();
  const s = (db.settings && db.settings.payeeInfo) || {};
  if (!s.configured) return (
    <React.Fragment>
      <div className="section-label mt16">{t('Payee info')}</div>
      <Banner tone="info" icon="info">{t('Payee info not configured — please contact the supplier.')}</Banner>
    </React.Fragment>
  );
  const rows = [
    { label: t('Bank name'), value: s.bankName || '—' },
    { label: t('Account name'), value: s.accountName || '—' },
    { label: t('Account number'), value: <span className="mono">{s.accountNo || '—'}</span> },
    { label: 'SWIFT', value: <span className="mono">{s.swift || '—'}</span> },
  ];
  if (s.methods && s.methods.length) rows.push({ label: t('Payment methods'), value: s.methods.join(' · ') });
  return (
    <React.Fragment>
      <div className="section-label mt16">{t('Payee info')}</div>
      <Descriptions cols={3} items={rows} />
    </React.Fragment>
  );
}

function PayDialog({ po, onClose }) {
  const { act, toast } = useApp();
  const [amount, setAmount] = useState(String(docAmount(po)));
  const [date, setDate] = useState(new Date().toLocaleDateString('sv-SE'));
  const [method, setMethod] = useState('Bank Transfer');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  // R15 — structured voucher (demo parse from the file name, Q35 演示态)
  const [voucher, setVoucher] = useState(null);
  const [mismatchNote, setMismatchNote] = useState('');
  const parsedAmt = voucher && voucher.parsed && voucher.parsed.amount !== '' && voucher.parsed.amount != null ? Number(voucher.parsed.amount) : null;
  const mismatch = parsedAmt !== null && !isNaN(parsedAmt) && parsedAmt !== docAmount(po);
  const onVoucher = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const parsed = parseVoucherDemo(f.name);
    setVoucher({ fileName: f.name, fileType: /\.pdf$/i.test(f.name) ? 'pdf' : 'image', dataUrl: '', parsed, parseConfidence: 'demo', confirmedBy: null, confirmedAt: null });
    if (parsed.ref) setRef(parsed.ref);
    if (parsed.date) setDate(parsed.date);
    if (parsed.amount !== '') setAmount(parsed.amount);
    if (parsed.method) setMethod(parsed.method);
    if (/^image\//.test(f.type)) {
      const reader = new FileReader();
      reader.onload = () => setVoucher(prev => prev ? { ...prev, dataUrl: String(reader.result || '') } : prev);
      reader.readAsDataURL(f);
    }
  };
  const mismatchErr = mismatch ? t('Voucher amount differs from the order total') : '';
  return (
    <Dialog title={`Record Payment · ${po.no}`} width="560px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn primary" disabled={mismatch && !mismatchNote.trim()} onClick={() => {
          const n = Number(amount);
          if (!amount || isNaN(n) || n <= 0) { setErr('Enter a valid payment amount'); return; }
          act.docVerb('Record Payment', po, null, null, { amount, date, method, ref: ref.trim(), note: note.trim(), voucher, mismatchNote: mismatchNote.trim() });
          onClose();
          toast(`Payment recorded for ${po.no} — awaiting confirmation`, 'success');
        }}><NavIcon name="invoices" size={13} />Record Payment</button>
      </React.Fragment>}>
      <Banner tone="warning" icon="receipt">The buyer pays offline (bank transfer / cash). Recording the payment moves the order to payment review — shipment unlocks only after you confirm it.</Banner>
      <div className="form mt16">
        <FormRow label="Amount Received" required error={mismatchErr || err}>
          <Input value={amount} onChange={v => { setAmount(v); setErr(''); }} type="number" error={mismatchErr || err} prefix={po.currency} />
        </FormRow>
        <FormRow label="Payment Date" required>
          <Input value={date} onChange={setDate} type="date" />
        </FormRow>
        <FormRow label="Payment Method" required>
          <RadioRow value={method} onChange={setMethod} options={[
            { value: 'Bank Transfer', label: 'Bank Transfer' }, { value: 'Cash', label: 'Cash' }, { value: 'POS', label: 'POS' }, { value: 'Cheque', label: 'Cheque' },
          ]} />
        </FormRow>
        <FormRow label="Transaction Ref" hint="Bank slip / transfer reference for reconciliation">
          <Input value={ref} onChange={setRef} placeholder="e.g. TRF-88213-NGB" />
        </FormRow>
        <FormRow label={t('Payment Voucher')} hint={t('Demo parse — fields filled from the file name')}>
          <div>
            <input type="file" accept="image/*,.pdf" onChange={onVoucher} style={{ fontSize: 12 }} />
            {voucher && (
              <div className="flex gap8 mt8" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="mini-chip">{voucher.fileType === 'pdf' ? 'PDF' : 'IMAGE'}</span>
                <span className="mono" style={{ fontSize: 12 }}>{voucher.fileName}</span>
                <span className="mini-chip ai">DEMO PARSE</span>
                {voucher.parsed.ref && <span className="muted" style={{ fontSize: 11 }}>Parsed from voucher: ref {voucher.parsed.ref}</span>}
                <button className="btn" style={{ padding: '2px 8px' }} onClick={() => setVoucher(null)}><Icon name="close" size={12} />Remove</button>
              </div>
            )}
          </div>
        </FormRow>
        {mismatch && (
          <Banner tone="warning" icon="warn">
            {t('Voucher amount differs from the order total')}: {po.currency === 'NGN' ? '₦' : '$'}{voucher.parsed.amount} ≠ {po.currency === 'NGN' ? '₦' : '$'}{docAmount(po)} — {t('Mismatch note is required')}
          </Banner>
        )}
        {mismatch && (
          <FormRow label={t('Mismatch note')} required error={!mismatchNote.trim() ? t('Mismatch note is required') : ''}>
            <Textarea value={mismatchNote} onChange={setMismatchNote} rows={2} placeholder="e.g. Balance to be paid on delivery" />
          </FormRow>
        )}
        <FormRow label="Note">
          <Textarea value={note} onChange={setNote} rows={2} placeholder="e.g. Full payment received at Ibadan branch" />
        </FormRow>
      </div>
    </Dialog>
  );
}

// ---------- R94 · re-receive dialog (buyer re-receives the outstanding after a partial receipt) ----------
function ReReceiveDialog({ po, onClose }) {
  const { act, db } = useApp();
  // outstanding per pid = sum(CK qty) - sum(RK actualQty)
  const outstanding = {};
  const cks = db.docs.filter(d => d.type === 'CK' && d.poNo === po.no);
  const rks = db.docs.filter(d => d.type === 'RK' && cks.some(c => c.no === d.ckNo));
  po.items.forEach(it => { outstanding[it.pid] = it.qty; });
  rks.forEach(rk => rk.items.forEach(it => { outstanding[it.pid] = (outstanding[it.pid] || 0) - (ifnull(it.actualQty, it.qty)); }));
  const [qtys, setQtys] = useState(() => Object.fromEntries(po.items.map(it => [it.pid, String(Math.max(0, outstanding[it.pid] || 0))])));
  const [err, setErr] = useState('');
  return (
    <Dialog title={`Re-receive · ${po.no}`} width="640px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn primary" onClick={() => {
          const numQtys = {};
          let any = false;
          Object.keys(qtys).forEach(k => { const v = Number(qtys[k]); if (v > 0) { numQtys[k] = v; any = true; } });
          if (!any) { setErr('Enter at least one quantity to re-receive'); return; }
          act.rereceive(po, numQtys);
          onClose();
        }}><Icon name="checkDouble" size={13} />Confirm Re-receiving</button>
      </React.Fragment>}>
      <Banner tone="info" icon="check">Re-change the goods received previously; goods delivered later may also be added.</Banner>
      <div className="section-label mt16">Outstanding Items</div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th style={{ width: 90 }}>Ordered</th><th style={{ width: 90 }}>Outstanding</th><th style={{ width: 130 }}>Re-receive Now</th></tr></thead>
          <tbody>
            {po.items.map(it => {
              const out = Math.max(0, outstanding[it.pid] || 0);
              return (
                <tr key={it.pid}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img src={prodImg(db.products.find(p => p.id === it.pid))} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border-light)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13 }} className="bold">{it.name}</div>
                        <div className="cell-sub mono">{it.spec}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono">{it.qty}</td>
                  <td className="mono">{out}</td>
                  <td><Input value={qtys[it.pid]} onChange={v => { setQtys(s => ({ ...s, [it.pid]: v })); setErr(''); }} type="number" disabled={out <= 0} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {err && <div className="field-error mt8">{err}</div>}
    </Dialog>
  );
}

// ---------- R94 · replenish dialog (buyer requests a replenishment of the shortfall) ----------
function ReplenishDialog({ po, onClose }) {
  const { act, db } = useApp();
  // shortfall per pid = sum(CK qty) - sum(RK actualQty)
  const outstanding = {};
  const cks = db.docs.filter(d => d.type === 'CK' && d.poNo === po.no);
  const rks = db.docs.filter(d => d.type === 'RK' && cks.some(c => c.no === d.ckNo));
  po.items.forEach(it => { outstanding[it.pid] = it.qty; });
  rks.forEach(rk => rk.items.forEach(it => { outstanding[it.pid] = (outstanding[it.pid] || 0) - (ifnull(it.actualQty, it.qty)); }));
  const shortItems = po.items.filter(it => (outstanding[it.pid] || 0) > 0);
  const [qtys, setQtys] = useState(() => Object.fromEntries(shortItems.map(it => [it.pid, String(outstanding[it.pid])])));
  const [err, setErr] = useState('');
  return (
    <Dialog title={`Replenish Shortfall · ${po.no}`} width="640px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn primary" onClick={() => {
          const numQtys = {};
          let any = false;
          Object.keys(qtys).forEach(k => { const v = Number(qtys[k]); if (v > 0) { numQtys[k] = v; any = true; } });
          if (!any) { setErr('Enter at least one quantity to replenish'); return; }
          act.replenish(po, numQtys);
          onClose();
        }}><NavIcon name="stockOut" size={13} />Confirm Replenishment</button>
      </React.Fragment>}>
      <Banner tone="info" icon="truck">Append a follow-up shipment to make up the items that were not received previously.</Banner>
      <div className="section-label mt16">Shortfall Items</div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th style={{ width: 90 }}>Ordered</th><th style={{ width: 90 }}>Shortage</th><th style={{ width: 130 }}>Replenish Qty</th></tr></thead>
          <tbody>
            {shortItems.length === 0 && <tr><td colSpan="4" className="muted" style={{ textAlign: 'center', padding: 18 }}>No outstanding shortfall on this order</td></tr>}
            {shortItems.map(it => (
              <tr key={it.pid}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={prodImg(db.products.find(p => p.id === it.pid))} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border-light)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13 }} className="bold">{it.name}</div>
                      <div className="cell-sub mono">{it.spec}</div>
                    </div>
                  </div>
                </td>
                <td className="mono">{it.qty}</td>
                <td className="mono" style={{ color: '#C5483C', fontWeight: 700 }}>{outstanding[it.pid]}</td>
                <td><Input value={qtys[it.pid]} onChange={v => { setQtys(s => ({ ...s, [it.pid]: v })); setErr(''); }} type="number" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {err && <div className="field-error mt8">{err}</div>}
    </Dialog>
  );
}

// ---------- R94 · terminate receiving dialog (buyer ends the flow after a partial receipt) ----------
function TerminateDialog({ po, onClose }) {
  const { act, toast } = useApp();
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  return (
    <Dialog title={`Terminate Receiving · ${po.no}`} width="520px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn error-plain" disabled={!reason.trim()} onClick={() => {
          act.terminateReceiving(po, reason.trim());
          onClose();
          toast(`Receiving for ${po.no} terminated — order closed with partial receipt`, 'info');
        }}><Icon name="close" size={13} />Terminate Receiving</button>
      </React.Fragment>}>
      <Banner tone="warning" icon="alert">Stop the follow-up replenishment and complete this order's receiving. This cannot be undone.</Banner>
      <div className="form mt16" style={{ gridTemplateColumns: '1fr' }}>
        <FormRow label="Termination Reason" required error={err}>
          <Textarea value={reason} onChange={v => { setReason(v); setErr(''); }} rows={3} placeholder="e.g. Supplier confirmed the missing units are out of stock — settle by credit note" error={err} />
        </FormRow>
      </div>
      {!reason.trim() && <div className="field-error">A termination reason is required</div>}
    </Dialog>
  );
}

// ---------- doc detail ----------
function DocDetailDialog({ docId, onClose, onOpenDoc }) {
  const { db, account, act, toast } = useApp();
  const doc = db.docs.find(d => d.id === docId);
  const [dialog, setDialog] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false); // R81 — rejection requires a reason
  const [rejectReason, setRejectReason] = useState('');
  if (!doc) return null;
  // R80 — shipped order: look up the auto-generated outbound order (CK) so
  // both parties can jump to it (and its waybill) from the PO detail
  const shipCk = doc.type === 'PO' ? db.docs.find(d => d.type === 'CK' && d.poNo === doc.no) : null;
  // R83 — once the supplier accepts the order, the invoice (FP) is auto-issued
  // and pushed to the buyer. "待付款或以后的状态" maps to FP existing.
  const poFp = doc.type === 'PO' ? db.docs.find(d => d.type === 'FP' && d.poNo === doc.no) : null;
  const isPlatform = account.type === 'platform';
  const side = docSide(db, account, doc);
  const actions = docActions(db, account, doc);
  const cpName = side === 'seller' ? tenantName(db, doc.buyer) : tenantName(db, doc.seller);
  const runVerb = (verb) => {
    if (verb === 'Print') return setDialog('print');
    // R81 — rejection (quote by buyer / order by supplier) needs a reason first
    if (verb === 'Reject') { setRejectReason(''); return setRejectOpen(true); }
    if (verb === 'Download') {
      downloadInvoiceFile(db, doc);
      act.logEvent('Download Invoice', doc.no);
      return toast(`Invoice ${doc.no} downloaded (CSV) — data export event logged`, 'success');
    }
    if (verb === 'Edit') return setDialog(doc.type === 'IQ' ? 'inquiry' : doc.type === 'PO' ? 'po' : 'quote');
    if (verb === 'Quote') return setDialog('quote');
    if (verb === 'Ship') return setDialog('ship');
    // R16 — 拣货 / 发货（承运信息）专用表单
    if (verb === 'Start Picking') return setDialog('picking');
    if (verb === 'Dispatch') return setDialog('dispatch');
    if (verb === 'Confirm Receipt') return setDialog('receive');
    // R94 — dedicated forms for the order-flow actions
    if (verb === 'Accept' && doc.type === 'PO') return setDialog('accept');
    if (verb === 'Record Payment') return setDialog('pay');
    if (verb === 'Re-receive') return setDialog('rereceive');
    if (verb === 'Replenish') return setDialog('replenish');
    if (verb === 'Terminate Receiving') return setDialog('terminate');
    const msgs = {
      Accept: `Accept quote ${doc.no}? A purchase order will be auto-generated.`,
      Submit: `Submit ${doc.no}? It will be sent to ${tenantName(db, doc.seller)} and becomes non-editable.`,
      Cancel: `Cancel ${doc.no}? This cannot be undone.`,
      Close: `Close inquiry ${doc.no}?`,
      Delete: `Delete draft ${doc.no}? This cannot be undone.`,
      'Confirm Quote': `Confirm the AI-drafted quote ${doc.no} with one tap? The quote link will be pushed to ${tenantName(db, doc.buyer)} via WhatsApp.`,
      'Place Order': `Place order ${doc.no} with one tap? It will be submitted to ${tenantName(db, doc.seller)} for review.`,
      'Create Invoice': `Issue the invoice for ${doc.no}? The invoice link will be pushed to ${tenantName(db, doc.buyer)} via WhatsApp.`,
      'Confirm Invoice': `Confirm invoice ${doc.no}? It will be archived after confirmation.`,
      'Confirm Payment': `Confirm the recorded payment for ${doc.no}? The order moves to awaiting outbound and shipment is unlocked.`,
    };
    // R94 — order Accept / Record Payment / Re-receive / Replenish / Terminate
    // Receiving all open dedicated FORM dialogs above (quote Accept stays here)
    const dangerVerbs = ['Delete', 'Cancel', 'Reject', 'Close'];
    setConfirm({ verb, message: msgs[verb], danger: dangerVerbs.includes(verb) });
  };
  const TYPE_NAME = { IQ: 'Inquiry', QT: 'Quote', PO: 'Purchase Order', CK: 'Outbound Order', RK: 'Inbound Record', FP: 'Sales Invoice' };
  // R97 — 入库记录/出库单/采购订单 detail pages are unified as 订单详情 (Order Detail)
  const DETAIL_TITLE = { IQ: 'Inquiry', QT: 'Quote', PO: 'Order', CK: 'Order', RK: 'Order', FP: 'Sales Invoice' };
  const headerItems = [
    { label: 'Document No', value: <span className="mono bold">{doc.no}</span> },
    { label: 'Status', value: <StatusTag type={doc.type} status={doc.status} /> },
    { label: side === 'seller' ? 'Buyer' : 'Seller', value: tenantName(db, side === 'seller' ? doc.buyer : doc.seller) },
    // R82 — role display keeps buyer / seller only; observers get no role line
    ...(side === 'buyer' || side === 'seller' ? [{ label: 'Counterparty Role', value: side === 'seller' ? 'You are the supplier' : 'You are the buyer' }] : []),
    { label: 'Currency', value: <span className="mono">{doc.currency}</span> },
    { label: 'Created By', value: doc.createdBy },
    { label: 'Created At', value: doc.createdAt },
    { label: 'Total Amount', value: <Money amount={docAmount(doc)} currency={doc.currency} /> },
  ];
  if (doc.deliveryDate) headerItems.push({ label: 'Delivery Date', value: doc.deliveryDate });
  // R94 — form-captured details surface on the header
  if (doc.expectedShipDate) headerItems.push({ label: 'Expected Dispatch', value: <span className="mono">{doc.expectedShipDate}</span> });
  if (doc.payment) headerItems.push({ label: 'Payment', value: <span className="mono">{doc.payment.method}{doc.payment.ref ? ` · ${doc.payment.ref}` : ''} · {doc.payment.date}{doc.payment.status === 'pending' ? ' · ' + t('Pending confirmation') : ''}{doc.payment.status === 'confirmed' ? ' · ' + t('Confirmed') : ''}</span> });
  if (doc.validUntil) headerItems.push({ label: 'Valid Until', value: doc.validUntil });
  if (doc.inquiryNo) headerItems.push({ label: 'Inquiry Ref', value: <span className="mono">{doc.inquiryNo}</span> });
  if (doc.quoteNo) headerItems.push({ label: 'Quote Ref', value: <span className="mono">{doc.quoteNo}</span> });
  if (doc.poNo) headerItems.push({ label: 'Order Ref', value: <span className="mono">{doc.poNo}</span> });
  if (doc.ckNo) headerItems.push({ label: 'Shipment Ref', value: <span className="mono">{doc.ckNo}</span> });
  // R99f — linked invoice entry in the header (已接受+): discoverable without
  // scanning the dialog footer buttons
  if (poFp) headerItems.push({ label: 'Invoice', value: <span className="mono" style={{ color: 'var(--primary)', fontWeight: 600, cursor: onOpenDoc ? 'pointer' : 'default' }} onClick={() => onOpenDoc && onOpenDoc(poFp.id)}>{onOpenDoc ? <React.Fragment>{t('View')}: {poFp.no} ›</React.Fragment> : poFp.no}</span> });
  // R80 — shipped order: outbound order + waybill, clickable to open the CK
  if (shipCk) headerItems.push({ label: 'Outbound Order', value: <span className="mono" style={{ color: 'var(--primary)', fontWeight: 600, cursor: onOpenDoc ? 'pointer' : 'default' }} onClick={() => onOpenDoc && onOpenDoc(shipCk.id)}>{onOpenDoc ? <React.Fragment>{t('View')}: {shipCk.no} ›</React.Fragment> : shipCk.no}</span> });
  if (shipCk && shipCk.waybill) headerItems.push({ label: 'Waybill', value: <span className="mono">{shipCk.waybill.no}</span> });
  if (doc.issueDate) headerItems.push({ label: 'Issue Date', value: doc.issueDate });
  return (
    <Dialog title={`${DETAIL_TITLE[doc.type] || 'Document'} Detail`} width="72%" onClose={onClose}
      badge={<React.Fragment><StatusTag type={doc.type} status={doc.status} />{isPlatform && <Tag tone="warning">Read-only</Tag>}</React.Fragment>}
      footer={<React.Fragment>
        {isPlatform ? (
          <span className="muted small" style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="lock" size={13} /> Platform account — no write access to business data (MVP permission rule)
          </span>
        ) : side === 'observer' ? (
          <span className="muted small" style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="eye" size={13} /> Visible via business relation — you are not a party to this document
          </span>
        ) : null}
        {/* R97/R99j — explicit view entry points for BOTH roles: invoice from
            已接受 (accepted) onwards per the explicit status list; outbound
            order + waybill from 已发货 (dispatched) onwards */}
        {doc.type === 'PO' && poFp && PO_ACCEPTED_OR_LATER.includes(doc.status) && (
          <button className="btn" onClick={() => onOpenDoc && onOpenDoc(poFp.id)}><Icon name="eye" size={13} />View Invoice</button>
        )}
        {doc.type === 'PO' && shipCk && PO_SHIPPED_OR_LATER.includes(doc.status) && (
          <button className="btn" onClick={() => onOpenDoc && onOpenDoc(shipCk.id)}><NavIcon name="stockOut" size={13} />View Outbound &amp; Waybill</button>
        )}
        {/* R97 — outbound order detail supports print / export directly.
            R99j — when the doc ITSELF is the CK (opened directly from the
            document center), print the CK itself (printCk falls back to doc
            when no linked shipCk exists) — previously only Download showed. */}
        {doc.type === 'CK' && (
          <React.Fragment>
            <button className="btn" onClick={() => setDialog('printCk')}><Icon name="print" size={13} />Print Outbound</button>
            <button className="btn" onClick={() => { downloadOutboundFile(db, doc); act.logEvent('Download Outbound Order', doc.no); toast(`Outbound order ${doc.no} downloaded (CSV) — data export event logged`, 'success'); }}><Icon name="download" size={13} />Download</button>
          </React.Fragment>
        )}
        {/* R85 — PO print/export: outbound order/waybill from 待收货 (shipped) onwards;
            invoice from 待付款 (pending payment) onwards */}
        {doc.type === 'PO' && shipCk && PO_SHIPPED_OR_LATER.includes(doc.status) && (
          <React.Fragment>
            <button className="btn" onClick={() => setDialog('printCk')}><Icon name="print" size={13} />Print Outbound</button>
            <button className="btn" onClick={() => { downloadOutboundFile(db, shipCk); act.logEvent('Download Outbound Order', shipCk.no); toast(`Outbound order ${shipCk.no} downloaded (CSV) — data export event logged`, 'success'); }}><Icon name="download" size={13} />Export Outbound</button>
          </React.Fragment>
        )}
        {doc.type === 'PO' && poFp && (
          <React.Fragment>
            <button className="btn" onClick={() => setDialog('printFp')}><Icon name="print" size={13} />Print Invoice</button>
            <button className="btn" onClick={() => { downloadInvoiceFile(db, poFp); act.logEvent('Download Invoice', poFp.no); toast(`Invoice ${poFp.no} downloaded (CSV) — data export event logged`, 'success'); }}><Icon name="download" size={13} />Export Invoice</button>
          </React.Fragment>
        )}
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Close</button>
        {!isPlatform && side !== 'observer' && actions.filter(v => v !== 'View').map(verb => (
          <button key={verb} className={`btn${['Confirm Receipt', 'Re-receive'].includes(verb) ? ' success' : ['Ship', 'Dispatch'].includes(verb) ? ' warning' : ['Accept', 'Approve', 'Submit', 'Quote', 'Confirm Quote', 'Place Order', 'Create Invoice', 'Confirm Invoice', 'Record Payment', 'Confirm Payment', 'Replenish'].includes(verb) ? ' primary' : ['Delete', 'Cancel', 'Reject', 'Close', 'Terminate Receiving'].includes(verb) ? ' error-plain' : ''}`} onClick={() => runVerb(verb)}><Icon name={DLG_VERB_ICON[verb] || 'check'} size={13} />{verb}</button>
        ))}
      </React.Fragment>}>
      <Descriptions cols={3} items={headerItems} />
      {/* MVP #10 — AI order summary for buyer-side PO/QT confirmation */}
      {!isPlatform && side === 'buyer' && ['PO', 'QT'].includes(doc.type) && <AISummaryBox doc={doc} />}
      {doc.chainPath && (
        <React.Fragment>
          <div className="section-label mt16">Agency Chain (ChainPath)</div>
          <div className="chain-path" style={{ fontSize: 13 }}>
            {doc.chainPath.map((tid, i) => (
              <React.Fragment key={tid}>
                {i > 0 && <span className="chain-arrow">›</span>}
                <span className="chain-node">{tenantName(db, tid)} <span className="muted small">· {(db.tenants.find(t => t.id === tid) || {}).type}</span></span>
              </React.Fragment>
            ))}
          </div>
        </React.Fragment>
      )}
      {/* MVP #25/#26 — auto-generated waybill with items & logistics + confirmation link */}
      {doc.waybill && <WaybillCard doc={doc} />}
      {doc.type === 'RK' && doc.variance && (
        <React.Fragment>
          <div className="section-label mt16">Inspection Result</div>
          {doc.status === 'Partial Variance'
            ? <Banner tone="warning" icon="warn"><b>Partial variance:</b> {doc.variance.reason}</Banner>
            : doc.status === 'Rejected'
              ? <Banner tone="danger" icon="error"><b>Rejected:</b> {doc.variance.reason}</Banner>
              : <Banner tone="success" icon="success">All items match — stock increased automatically.</Banner>}
        </React.Fragment>
      )}
      <div className="section-label mt16">Line Items</div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>#</th><th>Product</th><th>Spec</th><th style={{ width: 70 }}>Qty</th><th style={{ width: 130 }} className="right">{doc.type === 'RK' ? 'Purchase Price' : 'Channel Sales Price'}</th><th style={{ width: 130 }} className="right">Amount</th>{doc.type === 'RK' && <th style={{ width: 110 }}>Received</th>}</tr></thead>
          <tbody>
            {doc.items.map((it, i) => (
              <tr key={i}>
                <td className="mono small muted">{i + 1}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={prodImg(db.products.find(p => p.id === it.pid))} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border-light)', flexShrink: 0 }} />
                    <div className="bold" style={{ fontSize: 13 }}>{it.name}</div>
                  </div>
                </td>
                <td className="small muted mono">{it.spec}</td>
                <td className="mono">{it.qty} {it.unit}</td>
                <td className="right"><Money amount={it.price} currency={doc.currency} /></td>
                <td className="right"><Money amount={it.qty * it.price} currency={doc.currency} /></td>
                {doc.type === 'RK' && <td className="mono">{it.actualQty != null ? it.actualQty : it.qty}</td>}
              </tr>
            ))}
            <tr><td colSpan={doc.type === 'RK' ? 6 : 5} className="right bold">Total</td><td className="right"><Money amount={docAmount(doc)} currency={doc.currency} /></td>{doc.type === 'RK' && <td></td>}</tr>
          </tbody>
        </table>
      </div>
      {/* R10 — 单据金额五行明细（AC-10-09/13）：优先读单据冻结快照，改税率不改历史单据 */}
      {(() => { const bd = docAmountBreakdown(doc); return (
        <div className="mt12" style={{ maxWidth: 340, marginLeft: 'auto' }}>
          <AmountSummary subtotal={bd.subtotal} discountTotal={bd.discountTotal} taxAmount={bd.taxAmount} taxRate={bd.taxRate === undefined ? null : bd.taxRate} freight={bd.freight} total={bd.total} currency={doc.currency} />
        </div>
      ); })()}
      {/* R15 — payment voucher: structured parse + original side by side (AC-15-08) */}
      {doc.payment && doc.payment.voucher && doc.payment.voucher.fileName && (
        <React.Fragment>
          <div className="section-label mt16">{t('Payment Voucher')}</div>
          <div className="flex gap16" style={{ alignItems: 'flex-start' }}>
            <div style={{ width: 260, border: '1px solid var(--border-light)', borderRadius: 8, padding: 8, textAlign: 'center', flexShrink: 0 }}>
              {doc.payment.voucher.dataUrl && doc.payment.voucher.fileType === 'image'
                ? <img src={doc.payment.voucher.dataUrl} alt="voucher" style={{ maxWidth: '100%', borderRadius: 4 }} />
                : <div className="muted" style={{ padding: '28px 0', fontSize: 12 }}><Icon name="file" size={22} /><div className="mt8 mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{doc.payment.voucher.fileName}</div></div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Descriptions cols={2} items={[
                { label: 'Method', value: doc.payment.voucher.parsed.method || '—' },
                { label: 'Transaction Ref', value: <span className="mono">{doc.payment.voucher.parsed.ref || '—'}</span> },
                { label: 'Amount', value: doc.payment.voucher.parsed.amount !== '' && doc.payment.voucher.parsed.amount != null ? <Money amount={Number(doc.payment.voucher.parsed.amount)} currency={doc.currency} /> : '—' },
                { label: 'Date', value: <span className="mono">{doc.payment.voucher.parsed.date || '—'}</span> },
                { label: 'Parse', value: <span className="mini-chip ai">DEMO</span> },
                { label: 'Confirmed By', value: doc.payment.voucher.confirmedBy ? `${doc.payment.voucher.confirmedBy} · ${doc.payment.voucher.confirmedAt}` : '—' },
              ]} />
              {doc.payment.mismatchNote && <Banner tone="warning" icon="warn">{t('Mismatch note')}: {doc.payment.mismatchNote}</Banner>}
            </div>
          </div>
        </React.Fragment>
      )}
      {/* R15 — payee info on QT/PO details (readonly, same data as settings; AC-15-02/03/04) */}
      {(doc.type === 'QT' || doc.type === 'PO') && <PayeeInfoBlock />}
      <div className="section-label mt16">Flow Timeline</div>
      <Timeline items={doc.timeline} />
      {confirm && <ConfirmDialog title={`${confirm.verb} ${doc.no}`} message={confirm.message} confirmText={confirm.verb}
        danger={['Delete', 'Cancel', 'Reject', 'Close'].includes(confirm.verb)}
        onConfirm={() => {
          if (confirm.verb === 'Dispatch') return act.dispatch(doc);
          return act.docVerb(confirm.verb, doc);
        }} onClose={() => setConfirm(null)} />}
      {/* R81 — rejection requires a written reason (quote by buyer / order by supplier) */}
      {rejectOpen && (
        <Dialog title={`Reject ${doc.type === 'PO' ? 'Order' : 'Quote'} ${doc.no}`} width="480px" onClose={() => setRejectOpen(false)}
          footer={<React.Fragment>
            <button className="btn" onClick={() => setRejectOpen(false)}><Icon name="close" size={13} />Cancel</button>
            <button className="btn error-plain" disabled={!rejectReason.trim()} onClick={() => {
              act.docVerb('Reject', doc, null, rejectReason.trim());
              setRejectOpen(false);
              toast(`${doc.type === 'PO' ? 'Order' : 'Quote'} rejected — reason recorded`, 'success');
            }}><Icon name="close" size={13} />Reject</button>
          </React.Fragment>}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
            A rejection reason is required. It is recorded on the document timeline and sent to the counterparty.
          </div>
          <textarea className="input" style={{ width: '100%', minHeight: 90, padding: '8px 10px' }} value={rejectReason}
            onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason (required)" />
          {!rejectReason.trim() && <div className="field-error" style={{ marginTop: 8 }}>Rejection reason is required</div>}
        </Dialog>
      )}
      {dialog === 'print' && <PrintPreviewDialog doc={doc} onClose={() => setDialog(null)} />}
      {dialog === 'printCk' && (shipCk || doc.type === 'CK') && <PrintPreviewDialog doc={doc.type === 'CK' ? doc : shipCk} onClose={() => setDialog(null)} />}
      {dialog === 'printFp' && poFp && <PrintPreviewDialog doc={poFp} onClose={() => setDialog(null)} />}
      {dialog === 'inquiry' && <InquiryFormDialog editDoc={doc} onClose={() => setDialog(null)} />}
      {dialog === 'po' && <POFormDialog editDoc={doc} onClose={() => setDialog(null)} />}
      {dialog === 'quote' && <QuoteFormDialog inquiry={doc.type === 'IQ' ? doc : null} editQuote={doc.type === 'QT' ? doc : null} onClose={() => setDialog(null)} />}
      {dialog === 'ship' && <ShipDialog po={doc} onClose={() => setDialog(null)} />}
      {/* R16 — 拣货 / 发货表单（CK 详情） */}
      {dialog === 'picking' && <PickingDialog ckId={doc.id} onClose={() => setDialog(null)} />}
      {dialog === 'dispatch' && <DispatchDialog ck={doc} onClose={() => setDialog(null)} />}
      {dialog === 'receive' && <ReceiveDialog ck={doc.type === 'PO' ? (db.docs.filter(d => d.type === 'CK' && d.poNo === doc.no && ['Shipped', 'Pending Shipment'].includes(d.status)).pop() || doc) : doc} onClose={() => setDialog(null)} />}
      {/* R94 — dedicated forms for the order-flow actions; recovery verbs from
          a CK/RK detail resolve the parent purchase order */}
      {dialog === 'accept' && doc.type === 'PO' && <AcceptOrderDialog po={doc} onClose={() => setDialog(null)} />}
      {dialog === 'pay' && <PayDialog po={doc} onClose={() => setDialog(null)} />}
      {dialog === 'rereceive' && <ReReceiveDialog po={parentPoOf(db, doc) || doc} onClose={() => setDialog(null)} />}
      {dialog === 'replenish' && <ReplenishDialog po={parentPoOf(db, doc) || doc} onClose={() => setDialog(null)} />}
      {dialog === 'terminate' && <TerminateDialog po={parentPoOf(db, doc) || doc} onClose={() => setDialog(null)} />}
    </Dialog>
  );
}

// ---------- print preview ----------
function PrintPreviewDialog({ doc, onClose }) {
  const { db, act, toast } = useApp();
  const TYPE_NAME = { IQ: 'INQUIRY', QT: 'QUOTATION', PO: 'PURCHASE ORDER', CK: 'OUTBOUND / WAYBILL', RK: 'INBOUND RECORD', FP: 'SALES INVOICE' };
  return (
    <Dialog title="Print Preview" width="760px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Close</button>
        <button className="btn" onClick={() => toast('Template printing is prepared offline and uploaded (no online designer in MVP)')}><Icon name="info" size={14} />Template Info</button>
        <button className="btn primary" onClick={() => { act.logEvent('Print Document', `${doc.no} (template with anti-fraud watermark & barcode)`); toast('Sent to browser print — data export event logged', 'success'); }}><Icon name="print" size={14} />Print</button>
      </React.Fragment>}>
      <div className="print-sheet">
        <div className="watermark">SAMPLE / 样张</div>
        <div className="print-head">
          <div className="flex gap10">
            <Logo size={34} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>TierLink Warehouse</div>
              <div className="muted" style={{ fontSize: 11 }}>Tiered Distribution WMS · Demo Document</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 1 }}>{TYPE_NAME[doc.type]}</div>
            <div className="mono" style={{ fontSize: 12, marginTop: 4 }}>{doc.no}</div>
          </div>
        </div>
        <div className="flex gap12 mt12" style={{ justifyContent: 'space-between', fontSize: 12 }}>
          <div><span className="muted">Seller:</span> <b>{tenantName(db, doc.seller)}</b></div>
          <div><span className="muted">Buyer:</span> <b>{tenantName(db, doc.buyer)}</b></div>
          <div><span className="muted">Date:</span> {doc.createdAt}</div>
        </div>
        <table className="table" style={{ marginTop: 12, fontSize: 12 }}>
          <thead><tr><th>Product</th><th>Spec</th><th>Qty</th><th className="right">{doc.type === 'RK' ? 'Purchase Price' : 'Channel Sales Price'}</th><th className="right">Amount</th></tr></thead>
          <tbody>
            {doc.items.map((it, i) => (
              <tr key={i}><td>{it.name}</td><td className="mono small">{it.spec}</td><td className="mono">{it.qty}</td>
                <td className="right mono">{doc.currency} {it.price.toLocaleString()}</td><td className="right mono">{money(it.qty * it.price, doc.currency).text}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="flex mt12" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="barcode"></div>
            <div className="mono muted" style={{ fontSize: 10, marginTop: 4 }}>{doc.no} · {doc.createdAt}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="muted" style={{ fontSize: 11 }}>TOTAL</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{money(docAmount(doc), doc.currency).full}</div>
          </div>
        </div>
        <div className="muted" style={{ fontSize: 10, marginTop: 16, borderTop: '1px solid var(--border-light)', paddingTop: 8 }}>
          Anti-counterfeit watermark and barcode are rendered by the uploaded print template. Printing / export is logged as a data-outbound event.
        </div>
      </div>
    </Dialog>
  );
}

// ---------- tenant dialogs ----------
function TenantFormDialog({ editTenant, onClose }) {
  const { act, toast } = useApp();
  const et = editTenant || {};
  const [f, setF] = useState({ code: et.code || '', name: et.name || '', type: et.type || 'Agent', country: et.country || 'Nigeria', maxLevel: ifnull(et.maxLevel, ''), status: et.status || 'Active', master: { name: '', phone: '', password: '' }, whatsapp: '' });
  const [errors, setErrors] = useState({});
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const setM = (k, v) => setF(s => ({ ...s, master: { ...s.master, [k]: v } }));
  // grid section divider (visually groups the one-stop create form)
  const Section = ({ children, first }) => (
    <div style={{ gridColumn: '1 / -1', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.4px', paddingTop: first ? 0 : 10, marginTop: first ? -2 : -4, borderTop: first ? 'none' : '1px solid var(--border-light)' }}>{children}</div>
  );
  const phoneOk = v => /^[+\d][\d\s\-()]{6,}$/.test(v.trim());
  return (
    <Dialog title={editTenant ? t(`Edit Merchant ${editTenant.code}`) : t('New Merchant')} width="560px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn primary" onClick={() => {
          const errs = {};
          if (!f.code) errs.code = 'Merchant code is required';
          if (!f.name) errs.name = 'Merchant name is required';
          if (!editTenant) {
            if (!f.master.name.trim()) errs.mname = 'Master name is required';
            if (!f.master.phone.trim()) errs.mphone = 'Phone number is required';
            else if (!phoneOk(f.master.phone)) errs.mphone = 'Enter a valid phone number';
            if (!f.master.password) errs.mpass = 'Password is required';
            else if (f.whatsapp && !phoneOk(f.whatsapp)) errs.wa = 'Enter a valid WhatsApp number';
          }
          setErrors(errs);
          if (Object.keys(errs).length) return;
          if (editTenant) { toast(`Merchant ${f.name} updated`, 'success'); }
          else { act.createTenant({ ...f, master: { ...f.master, name: f.master.name.trim(), phone: f.master.phone.trim(), whatsapp: f.whatsapp.trim() || null } }); }
          onClose();
        }}><Icon name="check" size={13} />{editTenant ? 'Save' : t('Create Merchant & Master Account')}</button>
      </React.Fragment>}>
      <div className="form">
        <Section first>{t('Merchant Info')}</Section>
        <FormRow label="Merchant Code" required error={errors.code}>
          <Input value={f.code} onChange={v => set('code', v)} placeholder="e.g. T-006" error={errors.code} />
        </FormRow>
        <FormRow label="Merchant Name" required error={errors.name}>
          <Input value={f.name} onChange={v => set('name', v)} placeholder="e.g. Enugu Solar Traders" error={errors.name} />
        </FormRow>
        <FormRow label="Merchant Type" required>
          <RadioRow value={f.type} onChange={v => set('type', v)} options={[{ value: 'Supplier', label: 'Supplier' }, { value: 'Agent', label: 'Agent' }]} />
        </FormRow>
        <FormRow label="Country / Region">
          <Select value={f.country} onChange={v => set('country', v)} options={['Nigeria', 'Ghana', 'Kenya', 'China', 'Vietnam'].map(c => ({ value: c, label: c }))} />
        </FormRow>
        <FormRow label="Max Agent Levels" hint="Depth of sub-agents this merchant may develop">
          <Input value={f.maxLevel} onChange={v => set('maxLevel', v)} type="number" placeholder="e.g. 2" />
        </FormRow>
        <FormRow label="Status">
          <Switch value={f.status === 'Active'} onChange={v => set('status', v ? 'Active' : 'Suspended')} activeText="Active" inactiveText="Suspended" />
        </FormRow>
        {!editTenant && <Section>{t('Master Account')}</Section>}
        {!editTenant && <FormRow label="Master Name" required error={errors.mname}>
          <Input value={f.master.name} onChange={v => setM('name', v)} placeholder="e.g. Ada Obi" error={errors.mname} />
        </FormRow>}
        {!editTenant && <FormRow label="Phone Number" required error={errors.mphone}>
          <Input value={f.master.phone} onChange={v => setM('phone', v)} placeholder="+234 801 234 5678" error={errors.mphone} />
        </FormRow>}
        {!editTenant && <FormRow label="Password" required error={errors.mpass} hint="demo password — hashed at rest in the real system">
          <Input value={f.master.password} onChange={v => setM('password', v)} type="password" placeholder="set a login password" error={errors.mpass} />
        </FormRow>}
        {!editTenant && <Section>{t('WhatsApp Binding')}</Section>}
        {!editTenant && <FormRow label="WhatsApp Number" error={errors.wa} hint="push links (quotes / invoices) are delivered to this number">
          <Input value={f.whatsapp} onChange={v => set('whatsapp', v)} placeholder="+234 801 234 5678" error={errors.wa} />
        </FormRow>}
        {!editTenant && <FormRow label="Access Model" span2>
          <div className="field-hint" style={{ marginTop: 2 }}>Creating a merchant provisions its master account (flattened permissions, MVP) and binds the WhatsApp push channel.</div>
        </FormRow>}
      </div>
    </Dialog>
  );
}

function RelationDialog({ onClose }) {
  const { db, act, toast } = useApp();
  const [up, setUp] = useState('');
  const [down, setDown] = useState('');
  const exists = db.relations.some(r => (r.upstream === up && r.downstream === down) || (r.upstream === down && r.downstream === up));
  const selfPair = up && up === down;
  return (
    <Dialog title="New Supply Relation" width="520px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn primary" disabled={!up || !down || exists || selfPair} onClick={() => { act.createRelation(up, down); onClose(); }}><Icon name="link" size={13} />Establish Relation</button>
      </React.Fragment>}>
      <Banner tone="info" icon="building">A supply relation (MerchantRelation) is unique per merchant pair — duplicates are rejected. Data visibility flows along established relations only.</Banner>
      <div className="form mt16" style={{ gridTemplateColumns: '1fr' }}>
        <FormRow label="Upstream (Supplier)" required>
          <Select value={up} onChange={setUp} placeholder="Select supplier merchant"
            options={db.tenants.filter(t => t.status === 'Active').map(t => ({ value: t.id, label: `${t.name} (${t.type})` }))} />
        </FormRow>
        <FormRow label="Downstream (Agent)" required>
          <Select value={down} onChange={setDown} placeholder="Select agent merchant"
            options={db.tenants.filter(t => t.status === 'Active').map(t => ({ value: t.id, label: `${t.name} (${t.type})` }))} />
        </FormRow>
        {exists && <Banner tone="danger" icon="error">These two merchants already have a relation — same-type relations must be unique.</Banner>}
        {selfPair && <Banner tone="danger" icon="error">A merchant cannot be related to itself.</Banner>}
      </div>
    </Dialog>
  );
}

function TenantDetailDialog({ tenant, onClose }) {
  const { db } = useApp();
  const up = db.relations.filter(r => r.downstream === tenant.id);
  const down = db.relations.filter(r => r.upstream === tenant.id);
  const accounts = db.accounts.filter(a => a.tenantId === tenant.id);
  return (
    <Dialog title={`Merchant ${tenant.code}`} width="640px" onClose={onClose}
      footer={<button className="btn" onClick={onClose}><Icon name="close" size={13} />Close</button>}>
      <Descriptions cols={2} items={[
        { label: 'Merchant Name', value: <span className="bold">{tenant.name}</span> },
        { label: 'Type', value: <TenantTag type={tenant.type} /> },
        { label: 'Country', value: tenant.country },
        { label: 'Max Agent Levels', value: ifnull(tenant.maxLevel, '—') },
        { label: 'Status', value: tenant.status === 'Active' ? <Tag tone="success" dot>Active</Tag> : <Tag tone="danger" dot>Suspended</Tag> },
        { label: 'Created', value: tenant.createdAt },
        { label: 'Accounts', value: `${accounts.length} (${accounts.filter(a => a.main).length} master)` },
      ]} />
      <div className="section-label mt16">Business Relations</div>
      {up.length + down.length === 0 && <EmptyState message="No relations established" hint="This merchant's data is fully isolated from other merchants" />}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Direction</th><th>Counterparty</th><th>Since</th></tr></thead>
          <tbody>
            {up.map((r, i) => <tr key={'u' + i}><td><Tag tone="primary">Upstream</Tag></td><td>{tenantName(db, r.upstream)}</td><td className="small muted">{r.createdAt}</td></tr>)}
            {down.map((r, i) => <tr key={'d' + i}><td><Tag tone="success">Downstream</Tag></td><td>{tenantName(db, r.downstream)}</td><td className="small muted">{r.createdAt}</td></tr>)}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}

function AccountFormDialog({ mode, onClose }) {
  const { db, account, act, toast } = useApp();
  const isPlatform = account.type === 'platform';
  const editing = mode.editAcc;
  const subAgent = mode.subAgent;
  // R02 — team mode = "new sub-account of my own merchant". The master-account
  // switch is hidden here: the Team page lists non-main accounts only, so a
  // master account created from here would never show up in the list.
  const team = !!mode.team;
  const ownTenant = db.tenants.find(t => t.id === account.tenantId);
  // a sub-agent's max level cannot exceed what the parent tenant may grant:
  // suppliers grant any level; agents grant at most maxLevel - 1
  const grantMax = ownTenant && ownTenant.type === 'Agent' ? Math.max(1, Number(ownTenant.maxLevel) - 1) : 99;
  const [f, setF] = useState(() => ({
    name: editing ? editing.name : '', phone: editing ? editing.phone : '', password: editing ? (editing.password || '') : '',
    accountType: editing ? (editing.type === 'platform' ? 'platform' : 'tenant') : 'tenant',
    tenant: editing ? editing.tenantId : (isPlatform ? db.tenants[0].id : account.tenantId),
    main: editing ? !!editing.main : false,
    whatsapp: editing ? editing.whatsapp || '' : '',
    company: '', contact: '', email: '', maxSubLevel: 1, levelLabel: '',
    status: 'Active',
  }));
  const [errors, setErrors] = useState({});
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const tenantOptions = isPlatform ? db.tenants.map(t => ({ value: t.id, label: `${t.name} (${t.type})` }))
    : [{ value: account.tenantId, label: (db.tenants.find(t => t.id === account.tenantId) || {}).name }];
  const validPhone = v => /^\+?[\d\s-]{7,}$/.test(v || '');
  const save = () => {
    const errs = {};
    if (subAgent) {
      if (!f.company) errs.company = 'Company name is required';
      if (!f.contact) errs.contact = 'Contact name is required';
      if (!validPhone(f.phone)) errs.phone = 'Enter a valid phone number';
      if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) errs.email = 'Enter a valid email address';
      if (!validPhone(f.whatsapp)) errs.whatsapp = 'WhatsApp number is required for master accounts';
      if (!f.password) errs.password = 'Password is required';
      else if (f.password.length < 6) errs.password = 'At least 6 characters';
      if (!f.maxSubLevel || Number(f.maxSubLevel) < 1) errs.maxSubLevel = 'At least 1 level';
      else if (Number(f.maxSubLevel) > grantMax) errs.maxSubLevel = `Your merchant can grant at most ${grantMax} level${grantMax > 1 ? 's' : ''}`;
      setErrors(errs);
      if (Object.keys(errs).length) { toast('Please fix the highlighted fields', 'error'); return; }
      act.createSubAgent(f);
      onClose();
      return;
    }
    if (!f.name) errs.name = 'Name is required';
    if (!validPhone(f.phone)) errs.phone = 'Enter a valid phone number';
    if (f.password.length < 6) errs.password = 'At least 6 characters';
    if (f.accountType !== 'platform' && !f.tenant) errs.tenant = 'Select a merchant';
    setErrors(errs);
    if (Object.keys(errs).length) { toast('Please fix the highlighted fields', 'error'); return; }
    if (editing) toast(`Account ${f.name} updated`, 'success');
    else act.createAccount(team ? { ...f, main: false } : f);
    onClose();
  };
  const platAcc = f.accountType === 'platform';
  return (
    <Dialog title={editing ? `Edit Account ${editing.name}` : subAgent ? 'New Sub-Agent Master Account' : 'New Account'} width="560px" onClose={onClose}
      badge={subAgent ? <span className="mini-chip wa">WhatsApp binding</span> : null}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn primary" onClick={save}><Icon name="check" size={13} />{editing ? 'Save' : subAgent ? 'Create Sub-Agent' : 'Create Account'}</button>
      </React.Fragment>}>
      {subAgent ? (<React.Fragment>
        <Banner tone="info" icon="building">Creates a new agent merchant, its master account and the supply relation in one step.</Banner>
        <div className="form mt16">
          <FormRow label="Company Name" required error={errors.company}>
            <Input value={f.company} onChange={v => set('company', v)} placeholder="e.g. Enugu Solar Traders" error={errors.company} />
          </FormRow>
          <FormRow label="Contact Name" required error={errors.contact}>
            <Input value={f.contact} onChange={v => set('contact', v)} placeholder="e.g. Amara Nwosu" error={errors.contact} />
          </FormRow>
          <FormRow label="Phone" required error={errors.phone}>
            <Input value={f.phone} onChange={v => set('phone', v)} placeholder="+234 ..." error={errors.phone} />
          </FormRow>
          <FormRow label="Email" error={errors.email}>
            <Input value={f.email} onChange={v => set('email', v)} placeholder="name@company.com" error={errors.email} />
          </FormRow>
          <FormRow label="WhatsApp Number" required error={errors.whatsapp} hint="Master accounts receive document push links">
            <Input value={f.whatsapp} onChange={v => set('whatsapp', v)} placeholder="+234 ..." error={errors.whatsapp} />
          </FormRow>
          <FormRow label="Password" required error={errors.password} hint="Hashed at rest (demo)">
            <Input value={f.password} onChange={v => set('password', v)} type="password" placeholder="Min. 6 characters" error={errors.password} />
          </FormRow>
          <FormRow label="Max Sub-level" required error={errors.maxSubLevel} hint={`Depth of sub-agents this sub-agent may develop (your merchant grants at most ${grantMax})`}>
            <Input value={f.maxSubLevel} onChange={v => set('maxSubLevel', v)} type="number" error={errors.maxSubLevel} />
          </FormRow>
          <FormRow label="Level Label" hint="Optional custom level wording shown to this distributor (max 20 chars)">
            <Input value={f.levelLabel} onChange={v => set('levelLabel', String(v || '').slice(0, 20))} placeholder="optional custom label" />
          </FormRow>
        </div>
      </React.Fragment>) : (<React.Fragment>
        <Banner tone="info" icon="user">{isPlatform
          ? 'Platform admins may create platform accounts or accounts for any merchant; suppliers / agents create sub-accounts of their own merchant. Permissions are flattened in MVP — visibility is governed by merchant type, business relations and personal data scope.'
          : 'Creates a sub-account of your own merchant. Permissions are flattened in MVP — every account gets the same action set; visibility is governed by merchant type, business relations and personal data scope.'}</Banner>
        <div className="form mt16">
          {isPlatform && !editing && <FormRow label="Account Type" required>
            <Select value={f.accountType} onChange={v => set('accountType', v)} options={[
              { value: 'tenant', label: 'Merchant Account' },
              { value: 'platform', label: 'Platform Account' },
            ]} />
          </FormRow>}
          <FormRow label="Full Name" required error={errors.name}>
            <Input value={f.name} onChange={v => set('name', v)} placeholder="e.g. Amara Nwosu" error={errors.name} />
          </FormRow>
          <FormRow label="Phone" required error={errors.phone}>
            <Input value={f.phone} onChange={v => set('phone', v)} placeholder="+234 ..." error={errors.phone} />
          </FormRow>
          <FormRow label="Password" required error={errors.password} hint="Hashed at rest (demo)">
            <Input value={f.password} onChange={v => set('password', v)} type="password" placeholder="Min. 6 characters" error={errors.password} />
          </FormRow>
          {!platAcc && <FormRow label="Merchant" required error={errors.tenant}>
            <Select value={f.tenant} onChange={v => set('tenant', v)} options={tenantOptions} disabled={!isPlatform} />
          </FormRow>}
          {!platAcc && !team && (isPlatform || account.main) && <FormRow label="Master Account" hint={editing && !isPlatform ? t('Only platform admins can change the master status of an existing account') : 'Master accounts receive document push links'}>
            <Select value={f.main ? 'yes' : 'no'} onChange={v => set('main', v === 'yes')} options={[
              { value: 'no', label: 'No — regular sub-account' },
              { value: 'yes', label: 'Yes — master of the merchant' },
            ]} disabled={editing && !isPlatform} />
          </FormRow>}
          {!platAcc && <FormRow label="WhatsApp (for pushes)" error={errors.whatsapp} hint="Optional — master accounts receive document push links">
            <Input value={f.whatsapp} onChange={v => set('whatsapp', v)} placeholder="+234 ..." error={errors.whatsapp} />
          </FormRow>}
        </div>
      </React.Fragment>)}
    </Dialog>
  );
}

// ---------- bind WhatsApp (MVP #43) ----------
function BindWhatsAppDialog({ acc, onClose }) {
  const { act } = useApp();
  const [wa, setWa] = useState(acc.whatsapp || '');
  const [err, setErr] = useState('');
  const save = () => {
    if (!/^\+?[\d\s-]{7,}$/.test(wa)) { setErr('Enter a valid WhatsApp number'); return; }
    act.bindWhatsapp(acc.id, wa);
    onClose();
  };
  return (
    <Dialog title={`Bind WhatsApp · ${acc.name}`} width="460px" onClose={onClose}
      badge={<span className="mini-chip wa"><Icon name="whatsapp" size={11} /> push channel</span>}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn primary" onClick={save}><Icon name="whatsapp" size={13} />Bind WhatsApp</button>
      </React.Fragment>}>
      <Banner tone="info" icon="whatsapp">Document change links (quotes, waybills, invoices) are pushed to the bound WhatsApp number. One number per account.</Banner>
      <div className="form mt16" style={{ gridTemplateColumns: '1fr' }}>
        <FormRow label="WhatsApp Number" required error={err}>
          <Input value={wa} onChange={v => { setWa(v); setErr(''); }} placeholder="+234 ..." error={err} />
        </FormRow>
        <FormRow label="Current Binding">
          {acc.whatsapp ? <span className="mono small"><Icon name="whatsapp" size={12} /> {acc.whatsapp}</span> : <span className="muted small">Not bound — no push links can be delivered</span>}
        </FormRow>
      </div>
    </Dialog>
  );
}

// ---------- personalized permission summary (QA #9) ----------
function PermissionSummaryDialog({ onClose }) {
  const { db, account, tenant } = useApp();
  const r = tenantRole(db, account, tenant);
  const isPlatform = r === 'platform';
  const isSupplier = r === 'supplier';
  const isSub = r === 'sub';
  const isAgent = r === 'agent';
  const role = isPlatform ? 'Platform Admin' : isSupplier ? 'Supplier' : isSub ? 'Sub-Distributor' : 'Agent';
  const partners = isPlatform ? [] : [...relatedTenantIds(db, account.tenantId)].filter(id => id !== account.tenantId);
  const partnerNames = partners.map(id => tenantName(db, id)).join(', ');
  const menu = webMenuFor(account, tenant, db);
  const initials = account.name.split(' ').map(w => w[0]).slice(0, 2).join('');

  let scopeTag, scopeDetail;
  if (isPlatform) {
    scopeTag = 'Platform-wide';
    scopeDetail = 'Cross-merchant read-only — all merchants, relations and documents';
  } else if (isSupplier) {
    scopeTag = 'Merchant-level';
    scopeDetail = <span>Supply-side worklists are merchant-wide; other lists default to your own records · linked partners: <b>{partnerNames}</b></span>;
  } else if (isAgent && account.main && partnerNames) {
    scopeTag = 'Personal + downstream';
    scopeDetail = <span>Lists default to records you created · linked partners: <b>{partnerNames}</b></span>;
  } else if (isAgent) {
    scopeTag = 'Personal';
    scopeDetail = 'Only records you created are visible by default — drafts stay invisible to colleagues';
  } else {
    scopeTag = 'Personal';
    scopeDetail = <span>Only records you created are visible by default · linked partners: <b>{partnerNames}</b></span>;
  }

  const actions = isPlatform ? [
    { page: 'Merchants & Relations', acts: ['New Merchant', 'New Relation', 'Suspend Merchant'], note: 'create supplier / agent merchants together with their master accounts' },
    { page: 'Accounts', acts: ['New Platform Account', 'New Account', 'Edit', 'Disable', 'Enable'], note: 'accounts of any merchant, optionally master, or platform-side accounts' },
    { page: 'Products / Purchase / Warehouse / Invoices', ro: true },
  ] : isSupplier ? [
    { page: 'Products', acts: ['Add Product', 'Batch Import', 'Template', 'Edit', 'Adjust Stock', 'Delete'] },
    { page: 'Inquiries (received)', acts: ['Quote (AI draft)'] },
    { page: 'Quotes', acts: ['Edit'] },
    { page: 'Orders (to fulfill)', acts: ['Approve', 'Ship'] },
    { page: 'Invoices', acts: ['Download'], note: 'auto-issued (FP) after order fulfillment' },
    { page: 'Accounts', acts: ['New Account', 'Edit', 'Disable', 'Enable'] },
  ] : isAgent ? [
    { page: 'Purchase (Inquiries / Quotes / Purchase Orders)', acts: ['New Inquiry', 'Submit', 'New Order', 'Accept', 'Reject', 'Close'], note: 'merchant-side generic capability — inquire and purchase from your upstream supplier' },
    { page: 'Receiving', acts: ['Confirm Receipt'], note: 'full / partial / reject' },
    { page: 'Document Center (downstream orders)', acts: ['Approve', 'Ship'], note: 'received from sub-distributors; waybill auto-generated on ship' },
    { page: 'Invoices', acts: ['Download'], note: 'received from supplier and auto-issued (FP) to downstream after fulfillment' },
    { page: 'Products', acts: ['Add Product', 'Batch Import', 'Template', 'Edit', 'Adjust Stock', 'Delete'] },
    { page: 'Accounts', acts: ['New Account', 'Edit', 'Disable', 'Enable'], note: 'sub-accounts of your own merchant; sub-agent development where your level allows' },
  ] : [
    { page: 'Inquiries', acts: ['New Inquiry', 'Edit', 'Submit', 'Delete', 'Close'] },
    { page: 'Quotes (received)', acts: ['Accept', 'Reject'] },
    { page: 'Purchase Orders', acts: ['New Order', 'Edit', 'Submit', 'Cancel'] },
    { page: 'Receiving', acts: ['Confirm Receipt'], note: isSub ? 'partial receiving with variance supported' : 'full / partial / reject' },
    { page: 'Products', acts: ['Add Product', 'Batch Import', 'Template', 'Edit', 'Adjust Stock', 'Delete'] },
    { page: 'Accounts', acts: ['New Account', 'Edit', 'Disable', 'Enable'] },
  ];

  const boundary = isPlatform
    ? 'Cross-merchant read-only oversight: manage merchants, relations and accounts; no write access to business data.'
    : isSupplier
    ? 'Supply side: quote inquiries (AI draft), approve and ship orders; invoices (FP) are auto-issued after fulfillment.'
    : (isAgent && account.main)
    ? 'Distribution side with downstream: purchase is a merchant-side generic capability — inquire, order and receive from your upstream supplier. Fulfill and ship downstream orders; invoices (FP) are auto-issued after fulfillment. Account management covers your own merchant — create sub-accounts and (where your level allows) sub-agent master accounts.'
    : isAgent
    ? 'Same flattened permissions as merchant colleagues: manage sub-accounts of your own merchant; purchase is a merchant-side generic capability — the other boundary is data scope: you see just your own records.'
    : 'Agent L2 buy side: inquire, order and receive from your upstream agent, including partial receiving with variance.';

  const renderGroup = (g, i) => (
    <div key={i} className="perm-group">
      <span className="perm-group-name">{g.page}</span>
      {g.ro
        ? <span className="perm-ro"><Icon name="lock" size={13} /> Read-only — write actions hidden</span>
        : <span className="perm-group-chips">
            {g.acts.map(a => <span key={a} className="mini-chip act">{a}</span>)}
            {g.note && <span className="small muted">{g.note}</span>}
          </span>}
    </div>
  );

  return (
    <Dialog title="Permission Summary" width="720px" onClose={onClose}
      badge={<span className="mini-chip mvp">MVP</span>}
      footer={<button className="btn" onClick={onClose}><Icon name="close" size={13} />Close</button>}>
      <div className="profile-head">
        <span className={`avatar ${isPlatform ? 'plat' : 'tenant'}`} style={{ width: 44, height: 44, fontSize: 15 }}>{initials}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{account.name}</div>
          <div className="small muted" style={{ marginTop: 2 }}>{isPlatform ? 'Platform account — all merchants' : (tenant ? `${tenant.name} · ${tenant.code}` : '')}</div>
        </div>
        <span style={{ marginLeft: 'auto' }}><Tag tone={isPlatform || isSupplier ? 'purple' : 'primary'}>{role}</Tag></span>
      </div>
      <div className="mt16">
        <Descriptions items={[
          { label: 'Account Type', value: role },
          { label: 'Data Scope', full: true, value: <span><span className="mini-chip scope">{scopeTag}</span> <span className="small" style={{ marginLeft: 6 }}>{scopeDetail}</span></span> },
          { label: 'Cross-Merchant Isolation', full: true, value: <span className="small">{isPlatform
            ? 'All merchants and accounts are visible to platform admins for oversight; business data stays mutually isolated between merchants.'
            : 'Cross-merchant data is isolated by design — you see your own records, your merchant and linked supply partners. Accounts outside your business chain (e.g. Kano Wholesale Hub) are not listed in the account switcher.'}</span> },
        ]} />
      </div>
      <div className="section-label">Visible Menus</div>
      <div className="perm-groups">
        {menu.map(g => (
          <div key={g.id} className="perm-group">
            <span className="perm-group-name">{g.label}</span>
            <span className="perm-group-chips">
              {g.children.map(c => <span key={c.id} className="mini-chip">{c.label}</span>)}
            </span>
          </div>
        ))}
      </div>
      <div className="section-label">Available Actions</div>
      <div className="perm-groups">{actions.map(renderGroup)}</div>
      <div className="section-label">MVP Permission Boundary</div>
      <Banner tone="info" icon="shield">{boundary}</Banner>
    </Dialog>
  );
}

// ---------- permission guide ----------
function PermissionGuideDialog({ onClose }) {
  const { db, account } = useApp();
  const rules = [
    ['No role system in MVP', 'All accounts have flattened, identical permissions. Role management, permission resources and data-scope configuration do not exist in this phase.'],
    ['Two account types', 'Platform accounts manage merchants, relations and accounts. Merchant accounts (Supplier / Agent) run the business: products, purchase, warehouse, documents, invoices.'],
    ['Personal data scope', 'Lists default to records created by the current account ("My Records"). Merchant-wide scope arrives with RBAC post-MVP.'],
    ['Merchant isolation & business visibility', 'A supplier sees downstream agents; an agent sees itself and its sub-agents. Merchants without a relation (e.g. Kano Wholesale Hub) are fully isolated.'],
    ['Platform read-only', 'Platform accounts see cross-merchant documents for oversight, but write actions (edit / submit / ship / receive / invoice) are hidden, not merely disabled.'],
    ['Actions follow business side', 'Who can act depends on which side of the document your merchant is: buyers inquire, order and receive; suppliers quote, ship and invoice.'],
    ['Purchase is a merchant-side capability', 'Purchase (Inquiries / Quotes / Purchase Orders) is a merchant-side generic capability — L1 agents inquire and purchase from their upstream supplier, with the same menu as suppliers and sub-distributors. Downstream orders are reviewed and fulfilled from the Document Center.'],
    ['Agent accounts are read-only', 'Agent accounts see a read-only member list of their own merchant — invite, edit, disable and permission actions are hidden. Account administration is performed by suppliers and the platform.'],
    ['WhatsApp-first notifications', 'Document changes push WhatsApp links to the buyer; the H5 link opens a login-free document view with one-tap confirmation.'],
  ];
  return (
    <Dialog title="Permission Guide" width="680px" onClose={onClose}
      badge={<span className="mini-chip mvp">MVP RULES</span>}
      footer={<button className="btn" onClick={onClose}><Icon name="check" size={13} />Got it</button>}>
      <div className="permission-note-list">
        {rules.map((r, i) => (
          <div key={i} className="perm-item">
            <span className="n">{i + 1}</span>
            <div><b>{r[0]}.</b> {r[1]}</div>
          </div>
        ))}
      </div>
      <div className="section-label mt16">Demo accounts</div>
      <Table columns={[
        { key: 'name', label: 'Account', render: a => <span className="bold" style={{ fontSize: 13 }}>{a.name}</span> },
        { key: 'type', label: 'Type', width: 120, render: a => a.type === 'platform' ? <Tag tone="purple">Platform Admin</Tag> : <TenantTag type={(db.tenants.find(t => t.id === a.tenantId) || {}).type} /> },
        { key: 'tenant', label: 'Merchant', render: a => a.tenantId ? tenantName(db, a.tenantId) : '—' },
        { key: 'note', label: 'Demonstrates', render: a => <span className="small muted">{{
          'a-alex': 'Cross-merchant read-only; merchant/relation management',
          'a-sarah': 'Supply side: quote (AI draft), ship, invoice',
          'a-david': 'Personal data scope within the same merchant',
          'a-chidi': 'Agent L1: buy from upstream supplier, receive & fulfill downstream orders',
          'a-ngozi': 'Personal data scope — own records only',
          'a-tunde': 'Agent L2: partial receiving with variance',
        }[a.id] || ''}</span> },
      ]} rows={db.accounts.filter(a => a.id !== 'a-kano')} rowKey="id" />
      <div className="banner info mt16"><Icon name="ai" size={15} /><div><b>Try it:</b> switch accounts from the top-right switcher, then compare menus, visible documents and action buttons. Open <b>Mobile</b> from the profile menu to replay the WhatsApp push → login-free confirm flow.</div></div>
    </Dialog>
  );
}

// ---------- profile ----------
function ProfileDialog({ onClose }) {
  const { db, account, tenant, logout } = useApp();
  const isPlatform = account.type === 'platform';
  const upstream = tenant ? db.relations.find(r => r.downstream === tenant.id) : null;
  const upstreamTenant = upstream ? db.tenants.find(x => x.id === upstream.upstream) : null;
  const role = isPlatform ? 'Platform Admin'
    : tenant && tenant.type === 'Supplier' ? 'Supplier'
    : (tenant && tenant.maxLevel === 1 && upstreamTenant && upstreamTenant.type === 'Agent' ? 'Sub-Distributor' : 'Agent');
  const partners = isPlatform ? [] : [...relatedTenantIds(db, account.tenantId)].filter(id => id !== account.tenantId);
  const partnerNames = partners.map(id => tenantName(db, id)).join(', ');
  const initials = account.name.split(' ').map(w => w[0]).slice(0, 2).join('');
  return (
    <Dialog title="Profile" width="580px" onClose={onClose}
      footer={<React.Fragment>
        <span className="small muted" style={{ marginRight: 'auto' }}>Sign out returns to the bilingual login page</span>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Close</button>
        <button className="btn" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => { onClose(); logout(); }}><Icon name="arrowLeft" size={14} style={{ transform: 'rotate(180deg)' }} />Sign Out</button>
      </React.Fragment>}>
      <div className="profile-head">
        <span className={`avatar ${isPlatform ? 'plat' : 'tenant'}`} style={{ width: 52, height: 52, fontSize: 17 }}>{initials}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{account.name}</div>
          <div className="small muted" style={{ marginTop: 4 }}>{isPlatform ? 'Platform account — all merchants' : (tenant ? `${tenant.name} · ${tenant.code}` : '')}</div>
        </div>
        <span style={{ marginLeft: 'auto' }}><Tag tone={isPlatform || role === 'Supplier' ? 'purple' : 'primary'}>{role}</Tag></span>
      </div>
      <div className="mt16">
        <Descriptions items={[
          { label: 'Account Type', value: role },
          { label: 'Merchant', value: isPlatform ? null : (tenant ? `${tenant.name} (${tenant.code})` : null) },
          { label: 'Phone', value: account.phone },
          { label: 'WhatsApp', value: account.whatsapp },
          { label: 'Status', value: <StatusTag status={account.status} /> },
          { label: 'Language Preference', value: <span>{getLang() === 'zh' ? '中文' : 'English'} · <span className="muted small">switch via the top bar EN/中 button</span></span> },
          { label: 'Data Scope', full: true, value: isPlatform
            ? 'Cross-merchant read-only oversight — all merchants, relations and documents'
            : (partnerNames
              ? <span>Personal records only (created by me) · business visibility: <b>{partnerNames}</b></span>
              : 'Personal records only (created by me) · no linked partners — fully isolated merchant') },
        ]} />
      </div>
      <div className="mt16">
        <Banner tone="info" icon="info">Demo account — profile data is frontend display only (no backend in this prototype).</Banner>
      </div>
    </Dialog>
  );
}

// ---------- data risk & confidence notes ----------
// QA fix: 核验方式列内容折行可见 + 悬停 title 显示完整内容；固定列宽比例避免末列被挤压截断
const NOTES_ROWS = [
  ['MVP scope (flat product fields, single warehouse, WhatsApp-first, six document types, account creation only, etc.)', 'Verified fact', 'MVP and evolution capabilities coexist in the prompt; this prototype strictly follows the xlsx MVP sheet as its functional boundary — dashboards / role systems and other evolution capabilities are not included', 'High', 'conf-high', 'User source materials (xlsx + prompt.md)'],
  ['MVP permission model: no role system, flat account permissions, data scope = own data only, two account types (platform / merchant)', 'Verified fact', 'Differs from the evolved RBAC (6 roles × 15 permission codes); the prototype must not show role-management / permission-resource / data-scope configuration pages', 'High', 'conf-high', 'User source materials (prompt.md §13)'],
  ['Data visibility rules: suppliers see downstream; distributors see themselves and their sub-levels; only nodes with a business relationship; full isolation otherwise', 'Verified fact', 'The prototype demonstrates this rule on the front end; real enforcement requires backend data filtering', 'High', 'conf-high', 'User source materials (prompt.md)'],
  ['Form-factor specs: Web console (Element Plus style, dialogs), mobile (uViewUI card style, full-screen pages), UI copy in English (later changed to bilingual per user request, see next row), interaction-state specs', 'Verified fact', 'Styles are design references only; navigation must not mention tech-stack names; MVP excludes data dashboards (evolution capability)', 'High', 'conf-high', 'User source materials (prompt.md §17)'],
  ['Six document numbering rules (IQ-/QT-/PO-/CK-/RK-/FP- + date + sequence), status transitions, three-section detail pages', 'Verified fact', 'Document templates are used via offline upload; the prototype does not provide an online template designer', 'High', 'conf-high', 'User source materials (prompt.md §9)'],
  ['UI language: bilingual Chinese/English switch (built-in switch in the top bar / "Mine" page)', 'Verified fact', 'prompt.md originally suggested "MVP English only"; the bilingual switch was a later explicit user request (from user comments) — the user\'s latest request prevails', 'High', 'conf-high', 'User source materials + user comments (this round)'],
  ['All business data in the prototype (products, documents, inventory, merchants, accounts, WhatsApp push records, etc.)', 'Virtual sample', 'Does not represent real business data; must not be used for business decisions or metric commitments', 'Low (demo data)', 'conf-low', 'Explicitly labeled as demo data in the prototype'],
  ['Permission control is pure front-end JS injection, no backend', 'Concept (prototype implementation)', 'A real system must authenticate on the backend; front-end control is presentation-layer adaptation only', 'High (for the prototype)', 'conf-concept', 'Directly verifiable in the prototype code'],
];
function DataNotesTable() {
  return (
    <div className="table-wrap">
      <table className="notes-table">
        <colgroup>
          <col style={{ width: '25%' }} /><col style={{ width: '12%' }} /><col style={{ width: '27%' }} /><col style={{ width: '10%' }} /><col style={{ width: '26%' }} />
        </colgroup>
        <thead><tr><th>Scenario / Claim</th><th>Fact Status</th><th>Data Risk &amp; Limits</th><th>Confidence</th><th>Verification</th></tr></thead>
        <tbody>
          {NOTES_ROWS.map((r, i) => (
            <tr key={i}>
              <td title={r[0]}>{r[0]}</td>
              <td title={r[1]}>{r[1]}</td>
              <td title={r[2]}>{r[2]}</td>
              <td className={r[4]} title={r[3]}>{r[3]}</td>
              <td title={r[5]}>{r[5]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function DataNotesDialog({ onClose }) {
  return (
    <Dialog title="Data Risk & Confidence Notes" width="880px" onClose={onClose}
      footer={<button className="btn" onClick={onClose}><Icon name="close" size={13} />Close</button>}>
      <Banner tone="info" icon="info">Fixed trailing section of this prototype; content is taken from the fact ledger. Demo data is for UI & permission-behavior illustration only and does not represent real business.</Banner>
      <div className="mt12"><DataNotesTable /></div>
    </Dialog>
  );
}

// ---------- R21 purchase price history ----------
// Read-only procurement record trail: every successful stock-in appends one
// row (price / currency / qty / supplier / time / source doc no), newest first.
// Records are GROUPED BY CURRENCY — amounts are never converted, compared or
// summed across currencies (Q27: no FX in the prototype). Purchase history is
// the owner's procurement record (AC-21-10 boundary mirrors AC-20-10).
function PurchaseHistoryDialog({ productId, onClose }) {
  const { db, account } = useApp();
  const p = db.products.find(x => x.id === productId);
  if (!p) return null;
  const hist = p.purchaseHistory || [];
  const own = p.ownerId === account.tenantId;
  const byCur = {};
  hist.forEach(r => { const c = r.currency || 'USD'; (byCur[c] = byCur[c] || []).push(r); });
  const isSelf = r => r.selfProduced || r.supplierId === 'self' || r.supplierLabel === 'Self-produced';
  const supName = r => isSelf(r)
    ? t('Self-produced')
    : (r.supplierName || r.supplierLabel || (r.supplierId ? tenantName(db, r.supplierId) : '—'));
  return (
    <Dialog title={`Purchase Price History — ${p.name}`} width="760px" onClose={onClose}
      footer={<button className="btn" onClick={onClose}><Icon name="close" size={13} />Close</button>}>
      <Descriptions items={[
        { label: 'Product', value: <span className="bold">{p.name}</span> },
        { label: 'Latest Purchase Price', value: <span className="mono bold">{money(purchasePriceOf(p), purchaseCurrencyOf(p)).text}</span> },
        { label: 'Updated', value: p.purchaseUpdatedAt ? <span className="mono small">{p.purchaseUpdatedAt}{p.purchaseRefNo ? ` · ${p.purchaseRefNo}` : ''}</span> : '—' },
        { label: 'Records', value: `${hist.length}` },
      ]} />
      {!own ? (
        <div className="section-label mt16">Purchase History</div>
      ) : null}
      {!own ? (
        <div className="card" style={{ padding: '24px 16px', textAlign: 'center' }}>
          <Icon name="lock" size={18} />
          <div className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>Purchase history is the owner&rsquo;s procurement record and is not visible to other merchants.</div>
        </div>
      ) : !hist.length ? (
        <div className="card" style={{ padding: '24px 16px', textAlign: 'center' }}>
          <Icon name="receipt" size={18} />
          <div className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>No purchase history yet — it appears after your first stock-in.</div>
        </div>
      ) : Object.keys(byCur).map(cur => (
        <React.Fragment key={cur}>
          <div className="section-label mt16">{t('Purchase Price History')} ({cur})</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Time</th><th>Source Doc</th><th>Supplier</th><th className="right">Qty</th><th className="right">Purchase Price</th><th className="right">Amount</th></tr></thead>
              <tbody>
                {byCur[cur].map((r, i) => (
                  <tr key={i}>
                    <td className="mono small muted">{i + 1}</td>
                    <td className="mono small">{r.ts}</td>
                    <td className="mono small">{r.refNo || '—'}</td>
                    <td>{isSelf(r) ? <Tag tone="teal" dot>{t('Self-produced')}</Tag> : supName(r)}</td>
                    <td className="right mono">{r.qty} {p.unit}</td>
                    <td className="right mono bold">{money(r.price, cur).text}</td>
                    <td className="right mono">{money(Math.round(r.price * r.qty * 100) / 100, cur).text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </React.Fragment>
      ))}
      {own && hist.length ? <div className="muted" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.6 }}><Icon name="info" size={12} /> Records are grouped by currency — amounts are never converted or compared across currencies. History is read-only and written automatically by stock-ins.</div> : null}
    </Dialog>
  );
}

// ---------- R03 — custom level label for a downstream merchant ----------
// The label is stored on the LABELLED tenant, so two distributors under the
// same upstream can carry different labels without overwriting each other.
// maxLength 20 on the input and slice(0,20) in act.setLevelLabel — over-long
// values are truncated silently rather than rejected (AC-03-07).
function LevelLabelDialog({ tenant, onClose }) {
  const { db, account, act } = useApp();
  const [v, setV] = useState(tenant.levelLabel || '');
  // quick-pick chips: labels already used by this merchant's downstream
  const used = [];
  db.relations.filter(r => r.upstream === account.tenantId).forEach(r => {
    const t = db.tenants.find(x => x.id === r.downstream);
    if (t && t.levelLabel && used.indexOf(t.levelLabel) < 0) used.push(t.levelLabel);
  });
  const save = () => { act.setLevelLabel(tenant.id, v); onClose(); };
  return (
    <Dialog title={`Level Label — ${tenant.name}`} width="520px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Cancel</button>
        <button className="btn primary" onClick={save}><Icon name="check" size={13} />Save Label</button>
      </React.Fragment>}>
      <Banner tone="info" icon="info">
        A custom label is <b>display only</b>. The numeric sub-agent depth (max level) is unchanged, so permissions and the relation graph stay exactly as they are.
      </Banner>
      <div className="form mt16">
        <FormRow label="Level Label" hint={`${(v || '').length}/20 — longer input is truncated`}>
          <Input value={v} onChange={setV} placeholder="e.g. North Region Wholesale" />
        </FormRow>
      </div>
      {used.length ? (
        <React.Fragment>
          <div className="section-label mt16">Labels already in use</div>
          <div className="flex gap6" style={{ flexWrap: 'wrap' }}>
            {used.map(u => <button type="button" key={u} className="btn sm" onClick={() => setV(u)}>{u}</button>)}
          </div>
        </React.Fragment>
      ) : null}
      {tenant.levelLabel ? (
        <div className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>
          Set by {(() => { const a = db.accounts.find(x => x.id === tenant.levelLabelUpdatedBy); return a ? a.name : (tenant.levelLabelUpdatedBy || '—'); })()}. Clearing the field restores the default role wording.
        </div>
      ) : null}
    </Dialog>
  );
}

// ============================================================
// R09/AC-09-07 — 被邀请方「受理邀请」弹窗。
// 邀请方发出邀请码后，被邀请方必须有界面入口把邀请码带进来：本弹窗
// 输入码 → 调用 act.acceptInvitation(code, account.tenantId) → 建立
// upstream/downstream 关系边（方向由邀请角色决定，逻辑在 app.jsx）。
// 入口：H5「我的」页 + Web「分销商」页（两端同一组件，避免两套实现）。
// ============================================================
function AcceptInviteDialog({ onClose, compact }) {
  const { db, account, act, toast } = useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);      // 受理成功后的回执（关系方向 + 对方商户）
  const isTenant = account.type === 'tenant' && !!account.tenantId;
  const norm = String(code || '').trim().toUpperCase();
  // 预览：输入到一半就把「这条码是谁发的、我要做上游还是下游」显示出来，
  // 避免用户盲输（仅匹配仍在 pending 的邀请）。
  const preview = isTenant
    ? (db.invitations || []).find(i => String(i.code).toUpperCase() === norm)
    : null;
  const submit = () => {
    if (!isTenant) { setError('Platform accounts cannot accept merchant invitations'); return; }
    if (!norm) { setError('Enter the invite code'); return; }
    const r = act.acceptInvitation(norm, account.tenantId);
    if (!r) {
      // acceptInvitation 内部已 toast 具体原因（不存在 / 已受理 / 已过期），
      // 这里同步一份内联错误，弹窗不关、输入可改。
      const found = (db.invitations || []).find(i => String(i.code).toUpperCase() === norm);
      setError(!found ? 'Invite not found or no longer pending'
        : (found.status === 'accepted' || found.status === 'rejected'
          ? 'This invite has already been used'
          : 'Invite expired — ask for a new one'));
      return;
    }
    const found = (db.invitations || []).find(i => String(i.code).toUpperCase() === norm);
    setError('');
    setDone({
      code: norm,
      role: found ? found.role : null,
      counterparty: found ? tenantName(db, found.inviterTenantId) : '—',
      direction: found && found.role === 'supplier' ? 'Upstream' : 'Downstream',
    });
    // 成功提示由 act.acceptInvitation 内部统一发出（避免同一个动作弹两次 toast）
  };
  return (
    <Dialog title={t('Accept an Invitation')} width="min(520px, 92%)" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />{t('Close')}</button>
        {!done && <button className="btn primary" onClick={submit}><Icon name="check" size={13} />{t('Accept Invitation')}</button>}
      </React.Fragment>}>
      {!done ? (
        <React.Fragment>
          <Banner tone="info" icon="link">
            {t('Got an invite code from a supplier or an upstream distributor? Enter it here to link the two merchants — a supply relation is created the moment you accept.')}
          </Banner>
          {!isTenant && (
            <Banner tone="warning" icon="warn">
              {t('Switch to a merchant account to accept invitations — platform accounts are not part of any supply relation.')}
            </Banner>
          )}
          <div className="form mt16">
            <FormRow label={t('Invite code')} required error={error || undefined}>
              <Input value={code} onChange={v => { setCode(v); setError(''); }}
                placeholder="INV-XXXXXX" autoFocus />
            </FormRow>
          </div>
          {preview && preview.status === 'pending' && (
            <div className="card" style={{ padding: '10px 12px', marginTop: 4 }}>
              <div className="muted" style={{ fontSize: 11 }}>{t('Invited by')}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{tenantName(db, preview.inviterTenantId)}</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                {preview.role === 'supplier'
                  ? t('Accepting makes them your upstream supplier')
                  : t('Accepting makes you their downstream distributor')}
                {' · '}{t('Valid until')} {preview.validUntil}
              </div>
            </div>
          )}
          <div className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>
            {t('A supply relation is recorded against your current merchant, then the invite is marked accepted.')}
          </div>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <Banner tone="success" icon="check">
            {t('Invitation accepted — supply relation established.')}
          </Banner>
          {/* 回执信息：Web 端用两列 Descriptions（与现有弹窗一致）；
              H5 窄框（约 380px）里 .desc-label 固定 150px 会把右列裁掉，
              故 compact 走单列「标签 / 值」上下排列 */}
          {compact ? (
            <div className="card" style={{ padding: '12px 14px' }}>
              {[
                { k: t('Invite code'), v: <span className="mono bold">{done.code}</span> },
                { k: t('Invited by'), v: done.counterparty },
                { k: t('Your role'), v: done.direction === 'Upstream'
                  ? <Tag tone="primary">{t('Upstream / Supplier')}</Tag>
                  : <Tag tone="success">{t('Downstream / Distributor')}</Tag> },
                { k: t('Relation'), v: done.direction === 'Upstream'
                  ? `${t('You supply')} ${done.counterparty}`
                  : `${done.counterparty} ${t('supplies you')}` },
              ].map((row, i) => (
                <div key={i} style={{ padding: '7px 0', borderTop: i ? '1px solid var(--border-light)' : 'none' }}>
                  <div className="muted" style={{ fontSize: 11 }}>{row.k}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 6 }}>{row.v}</div>
                </div>
              ))}
            </div>
          ) : (
          <Descriptions cols={2} items={[
            { label: 'Invite code', value: <span className="mono bold">{done.code}</span> },
            { label: 'Invited by', value: done.counterparty },
            { label: 'Your role', value: done.direction === 'Upstream'
              ? <Tag tone="primary">Upstream / Supplier</Tag>
              : <Tag tone="success">Downstream / Distributor</Tag> },
            { label: 'Relation', value: done.direction === 'Upstream'
              ? `${t('You supply')} ${done.counterparty}`
              : `${done.counterparty} ${t('supplies you')}` },
          ]} />)}
          <div className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>
            {t('The pairing now appears in both merchants’ Distributors list — open it to verify.')}
          </div>
        </React.Fragment>
      )}
    </Dialog>
  );
}

// ============================================================
// R09 — 供应商/分销商邀请弹窗：两套话术（INVITE_COPY）+ 三种分享
// 方式（WhatsApp / 复制邀请码 / 扫码占位）+ 邀请记录（状态标识）
// ============================================================
function InviteDialog({ role, onClose }) {
  const { db, account, act, toast } = useApp();
  const copy = INVITE_COPY[role] || INVITE_COPY.distributor;
  const [inv, setInv] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const generate = () => {
    const r = act.createInvitation({ role, inviteeName: name, inviteePhone: phone });
    if (r) setInv(r);
  };
  const shareWa = () => {
    if (!inv) return;
    const text = `${copy.waText} ${inv.code} (valid until ${inv.validUntil})`;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  };
  const copyCode = async () => {
    if (!inv) return;
    try { await navigator.clipboard.writeText(inv.code); toast(`Invite code ${inv.code} copied`, 'success'); }
    catch (e) { toast(`Copy failed — please copy manually: ${inv.code}`, 'error'); }
  };
  const statusTag = i => {
    if (i.status === 'accepted') return <Tag tone="success">Accepted</Tag>;
    if (i.status === 'rejected') return <Tag tone="danger">Rejected</Tag>;
    if (i.status === 'expired' || (i.status === 'pending' && i.validUntil < today)) return <Tag tone="gray">Expired</Tag>;
    return <Tag tone="warning" dot>Pending</Tag>;
  };
  const mine = (db.invitations || []).filter(i => i.inviterTenantId === account.tenantId && i.role === role);
  return (
    <Dialog title={t(copy.title)} width="600px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />{t('Close')}</button>
        <button className="btn primary" onClick={generate}><Icon name="link" size={13} />{inv ? t('Regenerate') : t('Generate Invite Code')}</button>
      </React.Fragment>}>
      {/* 双向收益话术（AC-09-02/03）：两套独立文案来自 data.jsx INVITE_COPY */}
      <Banner tone="info" icon="users">
        <b>{t('What they get')}:</b> {t(copy.toThem)}
      </Banner>
      <Banner tone="success" icon="check">
        <b>{t('What you get')}:</b> {t(copy.toYou)}
      </Banner>
      <div className="form mt16">
        <FormRow label={t('Invitee name (optional)')}>
          <Input value={name} onChange={setName} placeholder={role === 'supplier' ? 'e.g. Shenzhen Cell Co.' : 'e.g. Enugu Distributor'} />
        </FormRow>
        <FormRow label={t('Invitee WhatsApp (optional)')}>
          <Input value={phone} onChange={setPhone} placeholder="+234 ..." />
        </FormRow>
      </div>
      {inv && (
        <div className="card" style={{ padding: '12px 14px', marginTop: 12, borderColor: 'var(--primary)' }}>
          <div className="flex gap10" style={{ alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="muted" style={{ fontSize: 11 }}>{t('Invite code')}</div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>{inv.code}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>{t('Valid until')} {inv.validUntil}</div>
            </div>
            {/* 三种分享方式（AC-09-04），各自有可见的操作反馈 */}
            <button className="btn success" onClick={shareWa}><Icon name="whatsapp" size={13} />{t('Share via WhatsApp')}</button>
            <button className="btn" onClick={copyCode}><Icon name="link" size={13} />{t('Copy Invite Code')}</button>
          </div>
          <div className="flex gap10 mt8" style={{ alignItems: 'center' }}>
            <div style={{ width: 72, height: 72, border: '1px dashed var(--border-light)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="scan" size={26} /></div>
            <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.6 }}>{t('Scan QR Code')} — {t('Demo placeholder — no real QR code in this prototype')}</div>
          </div>
        </div>
      )}
      {/* 邀请记录（AC-19-08）：拒绝/过期有状态标识 */}
      {mine.length > 0 && (
        <React.Fragment>
          <div className="section-label mt16">{t('My invitations')}</div>
          {mine.slice(-5).reverse().map(i => (
            <div key={i.id} className="flex gap10" style={{ alignItems: 'center', padding: '6px 10px', background: 'var(--bg-2, #f6f7f9)', borderRadius: 6, marginBottom: 6 }}>
              <span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{i.code}</span>
              <span className="muted small" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(i.inviteeName || i.inviteePhone || t('No invitee specified'))} · {t('Valid until')} {i.validUntil}
              </span>
              {statusTag(i)}
            </div>
          ))}
        </React.Fragment>
      )}
    </Dialog>
  );
}

Object.assign(window, {
  ProductFormDialog, ImportDialog, CategoryDialog, InquiryFormDialog, QuoteFormDialog, POFormDialog, DownstreamStockDialog,
  PurchaseHistoryDialog, LevelLabelDialog,
  AdjustStockDialog, ShipDialog, ReceiveDialog, DocDetailDialog, PrintPreviewDialog, TenantFormDialog, BindWhatsAppDialog,
  RelationDialog, TenantDetailDialog, AccountFormDialog, PermissionGuideDialog, DataNotesDialog, DataNotesTable, ProfileDialog, PermissionSummaryDialog,
  AcceptOrderDialog, PayDialog, ReReceiveDialog, ReplenishDialog, TerminateDialog, DispatchDialog, PickingDialog, InviteDialog, AcceptInviteDialog,
  BATCH_OK_ROWS, BATCH_FAIL_ROWS, BATCH_CORRECTED_ROWS,
});
