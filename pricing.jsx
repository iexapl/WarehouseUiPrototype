// ============================================================
// R06 / R10 — 入库两步向导（Web 弹窗 + H5 页面共用）与金额五行汇总
// 新文件：在 index.html 中于 ui.jsx 之后、cart.jsx 之前加载
// 依赖全局：React / t()（i18n.jsx）/ money()（data.jsx）/ applyBulk（data.jsx）
//          useApp()（app.jsx，运行期调用）
// ============================================================

// ------------------------------------------------------------
// 金额五行汇总：原价合计 / 优惠合计 / 税额 / 运费 / 应付合计
// 税额行仅在税率已设定时渲染（taxRate 为 null ⇒ 不显示税额行，AC-10-10）
// ------------------------------------------------------------
function AmountSummary(props) {
  const { subtotal, discountTotal, taxAmount, taxRate, freight, total, currency } = props || {};
  const cur = currency || 'USD';
  const showTax = taxRate !== null && taxRate !== undefined && taxRate !== '';
  return (
    <div className="amt-summary">
      <div className="amt-row"><span>{t('Original total')}</span><span className="mono">{money(subtotal || 0, cur).text}</span></div>
      <div className="amt-row"><span>{t('Discount total')}</span><span className="mono">- {money(discountTotal || 0, cur).text}</span></div>
      {showTax ? (
        <div className="amt-row"><span>{t('Tax')} ({taxRate}%)</span><span className="mono">{money(taxAmount || 0, cur).text}</span></div>
      ) : null}
      <div className="amt-row"><span>{t('Freight')}</span><span className="mono">{money(freight || 0, cur).text}</span></div>
      <div className="amt-row amt-total"><span>{t('Total payable')}</span><span className="mono">{money(total || 0, cur).text}</span></div>
    </div>
  );
}

// ------------------------------------------------------------
// 入库两步向导
//   第一步 ①入库确认（只读，可从第二步返回查看，不丢已输入价格）
//   第二步 ②批量调价（逐行改价 + 多选批量比例/统一设/加价率 + 新旧价预览）
// 行数据保存在向导容器 state 里（AC-06-08：返回第一步不丢价格）
// ------------------------------------------------------------
function InboundWizard(props) {
  const { result, pids, onClose, onFinish } = props || {};
  const { db, act, toast } = useApp();
  // AC-06-01：入库提交成功后直接进入第二步，无需手动切换页面
  const [step, setStep] = useState(2);
  const [sel, setSel] = useState([]);
  const [bulkType, setBulkType] = useState('pct');
  const [bulkTarget, setBulkTarget] = useState('both');
  const [bulkVal, setBulkVal] = useState('');
  const [preview, setPreview] = useState(null);

  const [rows, setRows] = useState(() => {
    const ids = (result && result.productIds) || pids || [];
    const src = (result && Array.isArray(result.priceRows) && result.priceRows.length)
      ? result.priceRows
      : ids.map(pid => {
        const p = db.products.find(x => x.id === pid) || {};
        return {
          pid: pid, name: p.name || '', model: p.model || '',
          purchasePrice: Number(p.purchasePrice) || 0,
          purchaseCurrency: p.purchaseCurrency || p.currency || 'USD',
          marketPrice: Number(p.marketPrice) || 0,
          marketCurrency: p.marketCurrency || p.currency || 'USD',
          salePrice: Number(p.price) || 0,
          saleCurrency: p.currency || 'USD',
        };
      });
    return src.map(r => ({
      pid: r.pid, name: r.name || '', model: r.model || '', qty: r.qty || 0,
      purchasePrice: Number(r.purchasePrice) || 0,
      purchaseCurrency: r.purchaseCurrency || 'USD',
      marketPrice: Number(r.marketPrice) || 0,
      marketCurrency: r.marketCurrency || 'USD',
      salePrice: Number(r.salePrice) || 0,
      saleCurrency: r.saleCurrency || 'USD',
      baseMarket: Number(r.marketPrice) || 0,
      baseSale: Number(r.salePrice) || 0,
    }));
  });

  const isChanged = r => r.marketPrice !== r.baseMarket || r.salePrice !== r.baseSale;
  const patchRow = (pid, key, val) => setRows(prev => prev.map(r => (r.pid === pid ? { ...r, [key]: val } : r)));
  const toggle = pid => setSel(prev => (prev.indexOf(pid) >= 0 ? prev.filter(x => x !== pid) : prev.concat([pid])));
  const toggleAll = () => setSel(prev => (rows.length && prev.length === rows.length ? [] : rows.map(r => r.pid)));

  // 新旧对比预览（AC-10-04）：只算不写，取消即丢弃（AC-10-05）
  const buildPreview = () => {
    const picked = rows.filter(r => sel.indexOf(r.pid) >= 0);
    if (!picked.length) { toast('Select at least one row', 'warning'); return; }
    const val = Number(bulkVal);
    if (bulkVal === '' || isNaN(val)) { toast('Enter a number first', 'error'); return; }
    const op = { type: bulkType, value: val, target: bulkTarget };
    const next = applyBulk(picked.map(r => ({
      purchasePrice: r.purchasePrice, salePrice: r.salePrice, marketPrice: r.marketPrice,
    })), op);
    setPreview({
      rows: picked.map((r, i) => ({
        pid: r.pid, name: r.name,
        oldMarket: r.marketPrice, newMarket: next[i].marketPrice,
        oldSale: r.salePrice, newSale: next[i].salePrice,
        currency: r.saleCurrency,
      })),
    });
  };
  const applyPreview = () => {
    const map = {};
    (preview.rows || []).forEach(p => { map[p.pid] = p; });
    setRows(prev => prev.map(r => (map[r.pid]
      ? { ...r, marketPrice: map[r.pid].newMarket, salePrice: map[r.pid].newSale }
      : r)));
    setPreview(null);
  };

  // 完成 / 稍后处理：只有真改过的行才写库并记事件（AC-06-09）
  const finish = (later) => {
    const patches = rows.filter(isChanged).map(r => ({
      pid: r.pid,
      marketPrice: r.marketPrice, marketCurrency: r.marketCurrency,
      salePrice: r.salePrice, saleCurrency: r.saleCurrency,
    }));
    if (patches.length) act.adjustPrices(patches);
    const pend = rows.filter(r => !isChanged(r)).map(r => r.pid);
    act.setPendingReprice(pend, !!later);
    if (onFinish) onFinish(); else if (onClose) onClose();
  };

  const stepper = (
    <div className="wiz-steps">
      <div className={'wiz-step' + (step === 1 ? ' on' : '') + (step > 1 ? ' done' : '')}>
        <span className="wiz-dot">1</span><span>{t('Inbound confirmation')}</span>
      </div>
      <div className="wiz-line" />
      <div className={'wiz-step' + (step === 2 ? ' on' : '')}>
        <span className="wiz-dot">2</span><span>{t('Bulk price adjustment')}</span>
      </div>
    </div>
  );

  const step1 = (
    <div>
      <div className="wiz-panel">
        <div className="wiz-kv"><span>{t('Inbound reference')}</span><span className="mono">{result && result.refNo ? result.refNo : '—'}</span></div>
        <div className="wiz-kv"><span>{t('Supplier')}</span><span>{result && result.supplierName ? result.supplierName : '—'}</span></div>
        <div className="wiz-kv"><span>{t('Total quantity')}</span><span className="mono">{result && result.totalQty ? result.totalQty : '—'}</span></div>
        <div className="wiz-kv"><span>{t('Inbound amount')}</span><span className="mono">{result && result.amountsText ? result.amountsText : '—'}</span></div>
      </div>
      <div className="muted small" style={{ margin: '10px 0 4px' }}>{t('Items in this stock-in')}</div>
      {rows.map(r => (
        <div key={r.pid} className="wiz-kv" style={{ borderTop: '1px solid var(--border-light)' }}>
          <span>{r.name}{r.model ? <span className="muted mono small"> · {r.model}</span> : null}</span>
          <span className="mono small">{r.qty ? r.qty : ''}</span>
        </div>
      ))}
    </div>
  );

  const step2 = (
    <div>
      <div className="wiz-bulk">
        <label className="wiz-field"><span>{t('Adjustment')}</span>
          <select className="input" style={{ height: 32 }} value={bulkType} onChange={e => setBulkType(e.target.value)}>
            <option value="pct">{t('Percentage')}</option>
            <option value="set">{t('Set value')}</option>
            <option value="markup">{t('Markup on purchase price')}</option>
          </select>
        </label>
        <label className="wiz-field"><span>{t('Value')}</span>
          <input className="input" style={{ height: 32, width: 92 }} type="number" step="0.01" value={bulkVal}
            onChange={e => setBulkVal(e.target.value)} placeholder="20" />
        </label>
        <label className="wiz-field"><span>{t('Apply to')}</span>
          <select className="input" style={{ height: 32 }} value={bulkTarget} onChange={e => setBulkTarget(e.target.value)}>
            <option value="both">{t('Both prices')}</option>
            <option value="market">{t('market guide price')}</option>
            <option value="sale">{t('channel sale price')}</option>
          </select>
        </label>
        <button type="button" className="btn" onClick={buildPreview}><Icon name="edit" size={13} />{t('Preview')}</button>
      </div>
      <div className="muted small" style={{ margin: '6px 0 8px' }}>
        {t('Selected')}: {sel.length} / {rows.length} {t('items')}
      </div>
      <div className="wiz-thead">
        <span style={{ width: 26 }}><input type="checkbox" checked={rows.length > 0 && sel.length === rows.length} onChange={toggleAll} /></span>
        <span style={{ flex: 1 }}>{t('Product')}</span>
        <span style={{ width: 92 }}>{t('Purchase price')}</span>
        <span style={{ width: 92 }}>{t('market guide price')}</span>
        <span style={{ width: 92 }}>{t('channel sale price')}</span>
      </div>
      {rows.map(r => {
        const belowCost = r.salePrice > 0 && r.purchasePrice > 0 && r.salePrice < r.purchasePrice;
        return (
          <div key={r.pid} className="wiz-tr">
            <span style={{ width: 26 }}><input type="checkbox" checked={sel.indexOf(r.pid) >= 0} onChange={() => toggle(r.pid)} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block' }}>{r.name}</span>
              {r.model ? <span className="muted mono small">{r.model}</span> : null}
              {belowCost ? <span className="wiz-warn">{t('Below purchase price')}</span> : null}
            </span>
            <span style={{ width: 92 }} className="mono">{money(r.purchasePrice, r.purchaseCurrency).text}</span>
            <span style={{ width: 92 }}>
              <input className="input mono" style={{ height: 28, width: 84, textAlign: 'right' }} type="number" step="0.01"
                value={r.marketPrice} onChange={e => patchRow(r.pid, 'marketPrice', e.target.value === '' ? '' : Number(e.target.value))} />
            </span>
            <span style={{ width: 92 }}>
              <input className="input mono" style={{ height: 28, width: 84, textAlign: 'right' }} type="number" step="0.01"
                value={r.salePrice} onChange={e => patchRow(r.pid, 'salePrice', e.target.value === '' ? '' : Number(e.target.value))} />
            </span>
          </div>
        );
      })}
      {preview ? (
        <div className="wiz-preview">
          <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <b className="small">{t('Price preview')}</b>
            <button type="button" className="btn" style={{ height: 26 }} onClick={() => setPreview(null)}>{t('Cancel preview')}</button>
          </div>
          <div className="wiz-thead small">
            <span style={{ flex: 1 }}>{t('Product')}</span>
            <span style={{ width: 96 }}>{t('Old price')}</span>
            <span style={{ width: 96 }}>{t('New price')}</span>
          </div>
          {preview.rows.map(p => (
            <div key={p.pid} className="wiz-tr small">
              <span style={{ flex: 1 }}>{p.name}</span>
              <span style={{ width: 96 }} className="mono">{money(p.oldSale, p.currency).text}</span>
              <span style={{ width: 96 }} className="mono" style={{ width: 96 }}>{money(p.newSale, p.currency).text}</span>
            </div>
          ))}
          <button type="button" className="btn primary" style={{ marginTop: 6 }} onClick={applyPreview}>{t('Apply changes')}</button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="wiz">
      {stepper}
      <div className="wiz-body">{step === 1 ? step1 : step2}</div>
      <div className="wiz-foot">
        {step === 2 ? (
          <button type="button" className="btn" onClick={() => setStep(1)}>{t('Back to step one')}</button>
        ) : null}
        <div className="flex gap8" style={{ marginLeft: 'auto' }}>
          <button type="button" className="btn" onClick={() => finish(true)}>{t('Handle later')}</button>
          <button type="button" className="btn primary" onClick={() => finish(false)}>{t('Save prices and finish')}</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AmountSummary, InboundWizard });
