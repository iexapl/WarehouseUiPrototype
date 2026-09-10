// ============================================================
// mobile.jsx — Mobile app (uViewUI card style), runs inside iOS frame
// ============================================================

// round 53 — icon mapping for document action verbs (icon+text buttons)
const VERB_ICON = { Accept: 'check', Approve: 'check', Submit: 'check', Quote: 'edit', 'Confirm Quote': 'checkDouble', 'Place Order': 'cart', Ship: 'truck', Dispatch: 'truck', 'Confirm Receipt': 'checkDouble', 'Create Invoice': 'receipt', 'Confirm Invoice': 'checkDouble', 'Record Payment': 'receipt', Reject: 'close', Cancel: 'close', Close: 'close', Delete: 'trash', Print: 'print', Export: 'download', 'Re-receive': 'checkDouble', 'Replenish': 'truck', 'Terminate Receiving': 'close' };

// fix #21 — smart date-time: show year only when crossing year boundary
const fmtDateTime = (ts) => {
  if (!ts) return '';
  const year = ts.slice(0, 4);
  const currentYear = String(new Date().getFullYear());
  const short = ts.slice(5).replace('-', '/');
  return year === currentYear ? short : `${year}/${short}`;
};

// R100f — demo delay for the skeleton loading effect: every page/tab entry
// shows shimmer placeholders for this long, then renders real data.
// Overridable via window.__H5_SKELETON_MS; JSDOM regression runs are
// UA-gated to 0 so verify scripts see data immediately.
const getSkelMs = () => (window.__H5_SKELETON_MS !== undefined
  ? window.__H5_SKELETON_MS
  : (/jsdom/i.test(navigator.userAgent) ? 0 : 2000));

// R100f — which skeleton layout each entry renders while loading
const SK_VARIANT = {
  t_home: 'home', t_products: 'list', t_orders: 'list', t_mine: 'mine',
  doc: 'detail', product: 'detail', print: 'detail', guide: 'detail',
  wa: 'list', waChat: 'chat', notes: 'list', admin: 'list', categories: 'list',
  stock: 'list', movements: 'list', members: 'list', channelStock: 'list',
  inquiry: 'form', order: 'form', quote: 'form', accept: 'form', pay: 'form',
  replenish: 'form', receive: 'form', ship: 'form', rereceive: 'form',
  import: 'form', scan: 'form', scanOut: 'form', productNew: 'form',
  adjustPrice: 'form', adjustStock: 'form', bindwa: 'form',
};

// R100f — one shimmer block
function SkBlock({ w, h = 14, r = 6, mb = 10, style }) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: r, marginBottom: mb, ...style }} />;
}

// R100f — full-page skeleton, layout mimics the target page's real structure
function H5Skeleton({ variant }) {
  const card = { background: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 };
  const rows = n => Array.from({ length: n }, (_, i) => i);
  let body;
  if (variant === 'home') {
    body = (<React.Fragment>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <SkBlock w={46} h={46} r={12} mb={0} />
        <div style={{ flex: 1 }}><SkBlock w="58%" h={16} mb={8} /><SkBlock w="38%" h={12} mb={0} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {rows(4).map(i => (<div key={i} style={card}><SkBlock w="46%" h={12} mb={8} /><SkBlock w="72%" h={20} mb={0} /></div>))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {rows(8).map(i => (<div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><SkBlock w={44} h={44} r={12} mb={0} /><SkBlock w={40} h={9} mb={0} /></div>))}
      </div>
      {rows(3).map(i => (<div key={i} style={{ ...card, display: 'flex', gap: 10, alignItems: 'center' }}>
        <SkBlock w={38} h={38} r={10} mb={0} />
        <div style={{ flex: 1 }}><SkBlock w="66%" h={12} mb={6} /><SkBlock w="42%" h={10} mb={0} /></div>
      </div>))}
    </React.Fragment>);
  } else if (variant === 'list') {
    body = (<React.Fragment>
      <SkBlock w="100%" h={38} r={10} mb={12} />
      {rows(5).map(i => (<div key={i} style={{ ...card, display: 'flex', gap: 10, alignItems: 'center', padding: 12 }}>
        <SkBlock w={40} h={40} r={10} mb={0} />
        <div style={{ flex: 1 }}><SkBlock w="70%" h={13} mb={7} /><SkBlock w="44%" h={11} mb={0} /></div>
        <SkBlock w={46} h={20} r={10} mb={0} />
      </div>))}
    </React.Fragment>);
  } else if (variant === 'detail') {
    body = (<React.Fragment>
      <div style={card}>
        <SkBlock w="52%" h={16} mb={12} />
        {rows(4).map(i => (<div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: i === 3 ? 0 : 10 }}><SkBlock w={64} h={12} mb={0} /><SkBlock w={118} h={12} mb={0} /></div>))}
      </div>
      <div style={card}>
        {rows(3).map(i => (<div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: i === 2 ? 0 : 12 }}>
          <SkBlock w={36} h={36} r={8} mb={0} />
          <div style={{ flex: 1 }}><SkBlock w="58%" h={12} mb={6} /><SkBlock w="30%" h={10} mb={0} /></div>
          <SkBlock w={44} h={12} mb={0} />
        </div>))}
      </div>
      <SkBlock w="100%" h={44} r={10} mb={0} />
    </React.Fragment>);
  } else if (variant === 'form') {
    body = (<React.Fragment>
      <div style={card}>
        {rows(4).map(i => (<div key={i} style={{ marginBottom: 16 }}><SkBlock w={72} h={12} mb={8} /><SkBlock w="100%" h={38} r={8} mb={0} /></div>))}
      </div>
      <SkBlock w="100%" h={44} r={22} mb={0} />
    </React.Fragment>);
  } else if (variant === 'mine') {
    body = (<React.Fragment>
      <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'center' }}>
        <SkBlock w={52} h={52} r={26} mb={0} />
        <div style={{ flex: 1 }}><SkBlock w="40%" h={15} mb={8} /><SkBlock w="60%" h={11} mb={0} /></div>
      </div>
      <div style={card}>
        {rows(4).map(i => (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i === 3 ? 0 : 14 }}>
          <SkBlock w={30} h={30} r={8} mb={0} />
          <SkBlock w="52%" h={13} mb={0} />
        </div>))}
      </div>
    </React.Fragment>);
  } else { // chat
    body = (<React.Fragment>
      {[0, 1, 2, 3].map(i => (<div key={i} style={{ display: 'flex', justifyContent: i % 2 ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
        <SkBlock w={i % 2 ? '46%' : '62%'} h={i % 2 ? 40 : 52} r={12} mb={0} />
      </div>))}
      <SkBlock w="100%" h={44} r={22} mb={0} />
    </React.Fragment>);
  }
  return <div className="h5-pad sk-pad" role="status" aria-busy="true" aria-label={t('Loading')}>{body}</div>;
}

// ---------- stage ----------
function MobileStage() {
  const { setView } = useApp();
  return (
    <div className="mobile-stage">
      <IOSDevice width={390} height={844}>
        <MobileApp />
      </IOSDevice>
      <div className="stage-caption">
        <span>Mobile · WhatsApp-linked document tracking &amp; confirmation</span>
        <button className="btn sm" onClick={() => setView('web')}><Icon name="desktop" size={13} />Switch to Web Console</button>
      </div>
    </div>
  );
}

// ---------- app shell ----------
function MobileApp() {
  const { db, account, toast, carts } = useApp();
  // H5 home needs access to tab switching for quick actions that land on tabs
  const [tab, setTab] = useState('home');
  // R99l — page STACK: push() appends a page; the header back button pops
  // exactly ONE level, so every inner page and sub-inner page (doc detail →
  // outbound detail → receiving form, etc.) returns to the page it was
  // opened from instead of jumping straight back to the tab list.
  const [pages, setPages] = useState([]); // [{name, ...props}]
  const page = pages.length ? pages[pages.length - 1] : null;
  const [confirm, setConfirm] = useState(null);
  // 购物车：悬浮入口 + 底部面板（询价 / 入库 / 出库三车，数据在 App 层跨页保留）
  const [cartOpen, setCartOpen] = useState(false);
  const isPlatform = account.type === 'platform';
  const platform = isPlatform || null;
  const cartCount = cartTotalCount(carts);

  useEffect(() => { setTab('home'); setPages([]); productsTab = 'mine'; ordersSeg = 'IQ'; ordersStatus = 'ALL'; setCartOpen(false); }, [account.id]);

  const openDoc = docId => setPages(ps => [...ps, { name: 'doc', docId }]);
  const push = p => setPages(ps => [...ps, p]);
  const back = () => setPages(ps => ps.slice(0, -1));
  const noPerm = () => toast('You do not have permission for this operation', 'error');

  // R100f — skeleton loading on every page/tab ENTRY: navKey changes on tab
  // switch, page push AND back (pages.length included so re-entering the
  // same doc from a list re-triggers). While not ready, .h5-main renders
  // H5Skeleton instead of real data.
  const navKey = page
    ? `p:${page.name}:${page.docId || page.productId || ''}:${pages.length}`
    : `t:${tab}`;
  const [skReady, setSkReady] = useState(() => getSkelMs() <= 0);
  // R100j — 仓库 / 交易页签切换时骨架屏只加在页签内容区（h5-tabbody），
  // 固定的页签头（账户横幅 / 段选 / 筛选行）保持可见不闪骨架；
  // 首页 / 我的及所有推入的详情页仍整页骨架（R100f）
  const contentSkel = !page && (tab === 'products' || tab === 'orders');
  useEffect(() => {
    const ms = getSkelMs();
    if (ms <= 0) { setSkReady(true); return; }
    setSkReady(false);
    const id = setTimeout(() => setSkReady(true), ms);
    return () => clearTimeout(id);
  }, [navKey]);
  const skVariant = page ? (SK_VARIANT[page.name] || 'list') : (SK_VARIANT['t_' + tab] || 'list');

  const TITLES = {
    doc: 'Document Detail', inquiry: 'New Inquiry', order: 'New Order', receive: 'Confirm Receipt',
    ship: 'Ship Order', product: 'Product Detail', guide: 'Permission Guide', notes: 'Data Notes', wa: 'WhatsApp Link',
    productNew: 'New Product', scan: 'Scan to Stock In', scanOut: 'Scan Batch Outbound', import: 'Batch Import', categories: 'Categories', stock: 'My Stock',
    movements: 'Stock Movements', quote: 'Send Quote', print: 'Print Preview', admin: 'Platform Admin',
    members: 'Team Members', bindwa: 'Bind WhatsApp', adjustPrice: 'Adjust Price', adjustStock: 'Adjust Stock',
    channelStock: 'Downstream Stock', waChat: 'WhatsApp Chat', rereceive: 'Re-receive',
    accept: 'Accept Order', pay: 'Record Payment', replenish: 'Replenish',
  };
  // R96 — the doc detail title shows the DOCUMENT TYPE; R97 — 入库记录/出库单/
  // 采购订单 are unified as 订单详情 (Order Detail)
  const DOC_TYPE_TITLE = { IQ: 'Inquiry', QT: 'Quote', PO: 'Order', CK: 'Order', RK: 'Order', FP: 'Sales Invoice' };
  const pageTitle = !page ? '' : (page.name === 'doc'
    ? (() => { const d = db.docs.find(x => x.id === page.docId); return d && DOC_TYPE_TITLE[d.type] ? DOC_TYPE_TITLE[d.type] + ' Detail' : 'Document Detail'; })()
    : (TITLES[page.name] || ''));

  return (
    <div className="h5-app">
      {page ? (
        <div className="h5-page">
          <div className="h5-header">
            <div className="h5-side"><span className="h5-back" onClick={back}><Icon name="arrowLeft" size={20} /></span></div>
            <div className={`h5-title${page.name === 'doc' ? ' h5-title-tools' : ''}`}>{t(pageTitle)}</div>
            <div className="h5-side right"></div>
          </div>
          <div className="h5-main">
            {/* R100f — skeleton gate: entry shows shimmer placeholders first */}
            {!skReady ? <H5Skeleton variant={skVariant} /> : (<React.Fragment>
            {page.name === 'doc' && <H5DocPage docId={page.docId} push={push} setConfirm={setConfirm} platform={platform} noPerm={noPerm} />}
            {page.name === 'wa' && <H5WhatsAppPage docId={page.docId} push={push} setConfirm={setConfirm} platform={platform} noPerm={noPerm} />}
            {page.name === 'waChat' && <H5WhatsAppChatPage docId={page.docId} push={push} />}
            {page.name === 'inquiry' && <H5DocFormPage mode="IQ" initialItems={page.items} onDone={back} push={push} />}
            {page.name === 'order' && <H5DocFormPage mode="PO" onDone={back} />}
            {page.name === 'receive' && <H5ReceivePage ckId={page.docId} onDone={back} />}
            {page.name === 'ship' && <H5ShipPage poId={page.docId} onDone={back} />}
        {page.name === 'rereceive' && <H5ReReceivePage poId={page.docId} onDone={back} />}
            {page.name === 'accept' && <H5AcceptPage poId={page.docId} onDone={back} />}
            {page.name === 'pay' && <H5PayPage poId={page.docId} onDone={back} />}
            {page.name === 'replenish' && <H5ReplenishPage poId={page.docId} onDone={back} />}
            {page.name === 'product' && <H5ProductPage productId={page.productId} push={push} platform={platform} />}
            {page.name === 'guide' && <H5GuidePage />}
            {page.name === 'notes' && <div className="h5-pad"><DataNotesTable /></div>}
            {page.name === 'productNew' && <H5ProductFormPage onDone={back} />}
            {/* 扫码入库（合并版）：单入口支持连续识别/手动添加多条物料，
                形成待入库清单（共享入库车），一次确认提交多条 IN 流水 */}
            {page.name === 'scan' && <H5ScanInBatchPage onDone={back} />}
            {page.name === 'scanOut' && <H5ScanOutPage onDone={back} />}
            {page.name === 'import' && <H5ImportPage onDone={back} />}
            {page.name === 'categories' && <H5CategoriesPage />}
            {page.name === 'stock' && <H5StockPage push={push} />}
            {page.name === 'movements' && <H5MovementsPage />}
            {page.name === 'quote' && <H5QuoteFormPage docId={page.docId} onDone={back} />}
            {page.name === 'print' && <H5PrintPage docId={page.docId} />}
            {page.name === 'admin' && <H5AdminPage setConfirm={setConfirm} />}
            {page.name === 'members' && <H5MembersPage />}
            {page.name === 'bindwa' && <H5BindWaPage />}
            {page.name === 'adjustPrice' && <H5PriceFormPage productId={page.productId} onDone={back} />}
            {page.name === 'adjustStock' && <H5AdjustStockPage productId={page.productId} onDone={back} />}
            {page.name === 'channelStock' && <H5ChannelStockPage productId={page.productId} />}
            </React.Fragment>)}
          </div>
        </div>
      ) : (
        <React.Fragment>
          <div className="h5-header">
            <div className="h5-side"><Logo size={24} /></div>
            <div className="h5-title">TierLink</div>
            <div className="h5-side right">
              {/* R99y — 仓库页页头右上角工具顺序：分类 → 导入 → 扫码（图标按钮） */}
              {tab === 'products' && (
                <button type="button" className="h5-headtool" title={t('Categories')} aria-label={t('Categories')} onClick={() => push({ name: 'categories' })}><Icon name="tag" size={18} /></button>
              )}
              {tab === 'products' && !platform && (
                <button type="button" className="h5-headtool" title={t('Batch Import')} aria-label={t('Batch Import')} onClick={() => push({ name: 'import' })}><Icon name="upload" size={18} /></button>
              )}
              {/* 扫码入库（合并版，仅租户账号）：原「扫码入库」与「扫码批量入库」
                  合并为单入口，支持连续多次识别/添加后一次确认提交 */}
              {tab === 'products' && !platform && (
                <button type="button" className="h5-headtool" title={t('Scan to Stock In')} aria-label={t('Scan to Stock In')} onClick={() => push({ name: 'scan' })}><Icon name="scan" size={18} /></button>
              )}
              {/* R100h — 扫码批量出库入口（仅租户账号；平台账号对物料数据只读） */}
              {tab === 'products' && !platform && (
                <button type="button" className="h5-headtool" title={t('Scan Batch Outbound')} aria-label={t('Scan Batch Outbound')} onClick={() => push({ name: 'scanOut' })}><Icon name="truck" size={18} /></button>
              )}
            </div>
          </div>
          <div className="h5-main">
            {/* R100f — skeleton gate: entry shows shimmer placeholders first.
                R100j — 仓库/交易页签例外：整页不闪骨架，骨架屏下沉到
                H5Products / H5Orders 的滚动内容区（tabbody）内渲染 */}
            {!skReady && !contentSkel ? <H5Skeleton variant={skVariant} /> : (<React.Fragment>
            {tab === 'home' && <H5Home openDoc={openDoc} push={push} platform={platform} noPerm={noPerm} setTab={setTab} />}
            {tab === 'products' && <H5Products push={push} platform={platform} skReady={skReady} />}
            {tab === 'orders' && <H5Orders openDoc={openDoc} platform={platform} push={push} setConfirm={setConfirm} skReady={skReady} />}
            {tab === 'mine' && <H5Mine push={push} />}
            </React.Fragment>)}
          </div>
          <div className="h5-tabs">
            {[['home', 'home', 'Home'], ['products', 'warehouse', 'Warehouse'], ['orders', 'swap', 'Trade'], ['mine', 'userCircle', 'Mine']].map(([id, icon, label]) => (
              <div key={id} className={`h5-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
                <Icon name={icon} size={20} /><span>{label}</span>
              </div>
            ))}
          </div>
        </React.Fragment>
      )}
      {confirm && <H5Confirm confirm={confirm} onClose={() => setConfirm(null)} />}
      {/* 购物车悬浮入口（角标 = 已加物料行数）：三车任一非空即显示；
          页面态抬高避开底部操作区，页签态抬到页签栏上方 */}
      <H5CartFab count={cartCount} bottom={page ? 22 : 84} onClick={() => setCartOpen(true)} />
      {cartOpen && <H5CartSheet onClose={() => setCartOpen(false)} />}
    </div>
  );
}

// ---------- confirm overlay (ActionSheet style) ----------
function H5Confirm({ confirm, onClose }) {
  const [typed, setTyped] = useState('');
  const [step, setStep] = useState(1);
  const [reasonText, setReasonText] = useState('');
  const requireText = confirm.requireText;
  // R81 — rejection flows pass a reason flag: a written reason is required
  const needReason = !!confirm.reason;
  const reasonOk = !needReason || reasonText.trim().length > 0;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(23,35,47,0.5)', zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 16, paddingBottom: 40 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', animation: 'slideIn 0.2s ease' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid #F0F2F5' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{confirm.title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.6 }}>{confirm.message}</div>
          {requireText && step === 2 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>{t(`Type "${requireText}" to confirm`)}</div>
              <input className="input" style={{ height: 36, width: '100%' }} value={typed} onChange={e => setTyped(e.target.value)} placeholder={requireText} />
            </div>
          )}
          {needReason && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>{t('Rejection reason (required)')}</div>
              <textarea className="input" style={{ width: '100%', minHeight: 64, fontSize: 13, resize: 'vertical' }} value={reasonText} onChange={e => setReasonText(e.target.value)} placeholder={t('Rejection reason (required)')} />
              {!reasonText.trim() && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{t('Rejection reason is required')}</div>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex' }}>
          <button className="h5-btn" style={{ borderRadius: 0, border: 'none', borderRight: '1px solid #F0F2F5', height: 48 }} onClick={onClose}><Icon name="close" size={14} />Cancel</button>
          {requireText && step === 1
            ? <button className="h5-btn" style={{ borderRadius: 0, border: 'none', height: 48, color: 'var(--danger)', fontWeight: 600 }} onClick={() => setStep(2)}><Icon name="chevronRight" size={14} />Continue</button>
            : <button className="h5-btn primary" style={{ borderRadius: 0, border: 'none', height: 48, opacity: (requireText && typed !== requireText) || !reasonOk ? 0.5 : 1 }} disabled={(!!requireText && typed !== requireText) || !reasonOk} onClick={() => { confirm.onConfirm(needReason ? reasonText.trim() : undefined); onClose(); }}><Icon name="check" size={14} />{confirm.confirmText || 'Confirm'}</button>}
        </div>
      </div>
    </div>
  );
}

// ---------- home ----------
function H5Home({ openDoc, push, platform, noPerm, setTab }) {
  const { db, account, toast } = useApp();
  const isTenant = account.type === 'tenant';
  const tenant = isTenant ? db.tenants.find(t => t.id === account.tenantId) : null;
  const isSupplier = tenant && tenant.type === 'Supplier';
  const myDocs = db.docs.filter(d => isTenant && (d.buyer === account.tenantId || d.seller === account.tenantId));
  const inquiryCount = isSupplier
    ? db.docs.filter(d => d.type === 'IQ' && d.seller === account.tenantId).length
    : db.docs.filter(d => d.type === 'IQ' && d.createdBy === account.name).length;
  const pendingOrders = db.docs.filter(d => d.type === 'PO' && d.buyer === account.tenantId && ['Pending Acceptance', 'Pending Payment', 'Pending Outbound', 'Pending Shipment', 'Pending Receipt'].includes(d.status)).length;
  const tenantPushAccounts = isTenant ? db.accounts.filter(a => a.tenantId === account.tenantId).map(a => a.id) : [account.id];
  const pushes = db.pushes.filter(p => tenantPushAccounts.includes(p.toAccount)).slice().reverse();
  const unread = pushes.filter(p => !p.read).length;
  // P2-4 — role label must match the Web console (permission summary /
  // profile): use the shared tenantRoleLabel helper, not the raw tenant.type.
  const roleLabel = platform ? 'Platform Admin' : tenantRoleLabel(db, account, tenant);

  const openFirst = (fn, emptyMsg) => { const d = fn(); if (d) openDoc(d.id); else { toast(emptyMsg); } };
  // round 65/67 — role-aware Needs Attention board; each entry carries a doc
  // matcher so n / unread pushes / last update time all come from one filter
  const toReceive = db.docs.filter(d => d.type === 'CK' && d.buyer === account.tenantId && d.status === 'Shipped').length;
  const ATT = { primary: ['var(--primary-light)', 'var(--primary)'], success: ['var(--success-light)', 'var(--success)'], warning: ['var(--warning-light)', 'var(--warning)'], purple: ['var(--purple-light)', 'var(--purple)'] };
  const ATT_TID = account.tenantId;
  const hasPartners = isTenant && db.relations.some(r => r.upstream === ATT_TID || r.downstream === ATT_TID);
  const hasDocs = myDocs.length > 0;
  const isFreshTenant = isTenant && !hasPartners && !hasDocs;
  const ATT_ENTRIES = isSupplier
    ? [
        { label: 'Inquiries to Quote', icon: 'ai', tone: 'purple', goDocs: ['IQ', 'Submitted'], match: d => d.type === 'IQ' && d.seller === ATT_TID && d.status === 'Submitted' },
        { label: 'Orders to Ship', icon: 'truck', tone: 'primary', goDocs: ['PO', 'Pending Outbound'], match: d => d.type === 'PO' && d.seller === ATT_TID && d.status === 'Pending Outbound' && d.paid },
        { label: 'Orders to Invoice', icon: 'receipt', tone: 'warning', goDocs: ['PO', 'ALL'], match: d => d.type === 'PO' && d.seller === ATT_TID && ['Received', 'Partially Received'].includes(d.status) },
      ]
    : [
        { label: 'Quotes to Confirm', icon: 'checkDouble', tone: 'warning', goDocs: ['QT', 'Sent'], match: d => d.type === 'QT' && d.buyer === ATT_TID && d.status === 'Sent' },
        { label: 'Shipments to Receive', icon: 'truck', tone: 'success', goDocs: ['PO', 'Shipped'], match: d => d.type === 'CK' && d.buyer === ATT_TID && d.status === 'Shipped' },
        { label: 'Pending Orders', icon: 'cart', tone: 'primary', goDocs: ['PO', 'ALL'], match: d => d.type === 'PO' && d.buyer === ATT_TID && ['Pending Acceptance', 'Pending Payment', 'Pending Outbound', 'Pending Shipment', 'Pending Receipt'].includes(d.status) },
      ];
  const attTs = d => (d.timeline && d.timeline.length ? d.timeline[d.timeline.length - 1].ts : d.createdAt);
  const attention = ATT_ENTRIES.map(e => {
    const docs = db.docs.filter(e.match);
    return {
      ...e, n: docs.length,
      unread: pushes.filter(p => !p.read && docs.some(d => d.no === p.docNo)).length,
      updated: docs.map(attTs).sort().pop(),
    };
  }).filter(x => x.n > 0);

  const actions = isSupplier
    ? [
        ['To Quote', 'ai', 'var(--purple-light)', 'var(--purple)', () => openFirst(() => db.docs.find(d => d.type === 'IQ' && d.seller === account.tenantId && d.status === 'Submitted'), 'No inquiries awaiting your quote')],
        ['Ship', 'warehouse', 'var(--primary-light)', 'var(--primary)', () => openFirst(() => db.docs.find(d => d.type === 'PO' && d.seller === account.tenantId && d.status === 'Pending Outbound' && d.paid), 'No orders awaiting shipment')],
        ['Invoice', 'receipt', 'var(--warning-light)', 'var(--warning)', () => openFirst(() => db.docs.find(d => d.type === 'PO' && d.seller === account.tenantId && ['Received', 'Partially Received'].includes(d.status)), 'No received orders to invoice')],
        ['Stock', 'box', 'var(--success-light)', 'var(--success)', () => push({ name: 'stock' })],
      ]
    : [
        // R100e — buyer quick actions sorted by trade lifecycle
        ['Inquiry', 'edit', 'var(--primary-light)', 'var(--primary)', () => push({ name: 'inquiry' })],
        ['Quote', 'file', 'var(--purple-light)', 'var(--purple)', () => { ordersSeg = 'QT'; ordersStatus = 'ALL'; setTab('orders'); }],
        ['To Confirm', 'checkDouble', 'var(--warning-light)', 'var(--warning)', () => { const qt = db.docs.find(d => d.type === 'QT' && d.buyer === account.tenantId && d.status === 'Sent'); qt ? openDoc(qt.id) : toast('No quotes awaiting your confirmation'); }],
        ['Receive', 'check', 'var(--success-light)', 'var(--success)', () => { const ck = db.docs.find(d => d.type === 'CK' && d.buyer === account.tenantId && d.status === 'Shipped'); ck ? push({ name: 'receive', docId: ck.id }) : toast('No shipments awaiting receipt'); }],
      ];

  // round 65 — quick access grid grounded in real routes (tabs + stack pages)
  const openProductsTab = (id) => { productsTab = id; setTab('products'); };
  // R100e — Quick Access (功能导航) sorted: warehouse ops first, then trade
  // docs in lifecycle order (Orders → Invoices), team last. New: Invoices
  // deep-links to the Trade tab's FP segment.
  const grid = platform
    ? [
        ['My Warehouse', 'warehouse', 'var(--primary-light)', 'var(--primary)', () => setTab('products')],
        // R99g — home quick access: 单据 → 订单 (with a cart icon), it lands on the Trade tab
        ['Orders', 'cart', 'var(--purple-light)', 'var(--purple)', () => { ordersSeg = 'PO'; ordersStatus = 'ALL'; setTab('orders'); }],
        ['Invoices', 'receipt', 'var(--warning-light)', 'var(--warning)', () => { ordersSeg = 'FP'; ordersStatus = 'ALL'; setTab('orders'); }],
        ['Platform Admin', 'shield', 'var(--warning-light)', 'var(--warning)', () => push({ name: 'admin' })],
      ]
    : [
        ['My Warehouse', 'warehouse', 'var(--primary-light)', 'var(--primary)', () => openProductsTab('mine')],
        ['Sourcing Channel', 'link', 'var(--purple-light)', 'var(--purple)', () => openProductsTab('channel')],
        ['Stock', 'warehouse', 'var(--success-light)', 'var(--success)', () => push({ name: 'stock' })],
        ['Movements', 'clock', 'var(--warning-light)', 'var(--warning)', () => push({ name: 'movements' })],
        ['Orders', 'cart', 'var(--primary-light)', 'var(--primary)', () => { ordersSeg = 'PO'; ordersStatus = 'ALL'; setTab('orders'); }],
        ['Invoices', 'receipt', 'var(--warning-light)', 'var(--warning)', () => { ordersSeg = 'FP'; ordersStatus = 'ALL'; setTab('orders'); }],
        ['Team Members', 'users', 'var(--purple-light)', 'var(--purple)', () => push({ name: 'members' })],
      ];

  // fix #22 — platform admin home: replace tenant-scoped blocks with platform-wide stats
  const platformStats = platform ? [
    { label: 'Total Tenants', value: db.tenants.length },
    { label: 'Total Accounts', value: db.accounts.filter(a => a.type === 'tenant').length },
    { label: 'Total Products', value: db.products.length },
    { label: 'Total Documents', value: db.docs.length },
  ] : null;

  return (
    <div className="h5-tabpage">
      {/* R99e — account banner (+ platform notice) pinned; everything below scrolls */}
      <div className="h5-tabhead">
        {platform && <Banner tone="warning" icon="lock">Platform account — the H5 app is read-only for business data. Quick actions are disabled.</Banner>}
        <div className="h5-card" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: '#fff', border: 'none' }}>
          <div className="flex gap10">
            <span className="avatar" style={{ background: 'rgba(255,255,255,0.25)', width: 44, height: 44, fontSize: 15 }}>{account.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{account.name}</div>
              <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>{platform ? 'Platform Admin' : `${(tenant || {}).name} · ${roleLabel}`}</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 10.5, background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: 10 }}>MVP · 中英</span>
          </div>
        </div>
      </div>
      <div className="h5-tabbody">
      {!platform && <React.Fragment><div className="h5-section-title flex" style={{ justifyContent: 'space-between' }}>
        <span>Needs Attention</span>{attention.length > 0 && <span className="mini-chip" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>{attention.length} open</span>}
      </div>
      {attention.length === 0
        ? (isFreshTenant
          ? <div className="h5-card" style={{ textAlign: 'center', padding: 18, background: 'var(--bg)' }}><Icon name="link" size={18} color="var(--primary)" /><div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{t('No business yet')}</div><div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-2)' }}>{t('Bind a supply partner to start your first transaction')}</div></div>
          : <div className="h5-card" style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5, padding: 18 }}><Icon name="checkDouble" size={18} color="var(--success)" /><div style={{ marginTop: 6 }}>{t('All caught up — nothing needs your action')}</div></div>)
        : attention.map(x => (
          <div key={x.label} className="h5-cell" onClick={() => { if (platform) return noPerm(); ordersSeg = x.goDocs[0]; ordersStatus = x.goDocs[1]; setTab('orders'); }}>
            <span className="cell-icon" style={{ background: ATT[x.tone][0], color: ATT[x.tone][1] }}><Icon name={x.icon} size={17} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5 }}>{x.label}</div>
              {x.updated && <div className="muted" style={{ fontSize: 10.5, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="clock" size={10} /> {t('Updated')} {fmtDateTime(x.updated)}</div>}
            </div>
            {x.unread > 0 && <span className="mini-chip" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>{x.unread}{' unread'}</span>}
            <span className="mini-chip" style={{ background: ATT[x.tone][0], color: ATT[x.tone][1] }}>{x.n}</span>
            <Icon name="chevronRight" size={14} color="var(--text-3)" />
          </div>
        ))}</React.Fragment>}
      <div className="h5-section-title">{platform ? t('Platform Overview') : 'Overview'}</div>
      {platform ? (
        <div className="h5-stats">
          {platformStats.map(s => (
            <div key={s.label} className="h5-stat"><div className="l">{t(s.label)}</div><div className="v">{s.value}</div></div>
          ))}
        </div>
      ) : isFreshTenant ? (
        <div className="h5-card" style={{ textAlign: 'center', padding: 18, background: 'var(--bg)' }}>
          <Icon name="box" size={18} color="var(--primary)" />
          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{t('Not started yet')}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-2)' }}>{t('Bind a supply partner to start your first transaction')}</div>
        </div>
      ) : (
        <div className="h5-stats">
          <div className="h5-stat"><div className="l">{isSupplier ? t('Inquiries Received') : t('My Inquiries')}</div><div className="v">{inquiryCount}</div></div>
          <div className="h5-stat"><div className="l">Pending Orders</div><div className="v">{pendingOrders}</div></div>
          <div className="h5-stat"><div className="l">To Receive</div><div className="v" style={{ color: toReceive ? 'var(--warning)' : undefined }}>{toReceive}</div></div>
          <div className="h5-stat"><div className="l">Unread Pushes</div><div className="v" style={{ color: unread ? 'var(--danger)' : undefined }}>{unread}</div></div>
        </div>
      )}
      {/* R75 — Quick Actions + Quick Access merged into a single "Quick Access" (功能导航) section */}
      <div className="h5-section-title">Quick Access</div>
      {!platform && isTenant && !hasPartners && (
        <div className="h5-card" style={{ textAlign: 'center', padding: 18, background: 'var(--bg)', marginBottom: 8 }}>
          <Icon name="link" size={18} color="var(--primary)" />
          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{t('Bind a partner to unlock Quick Actions')}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-2)' }}>{t('Bind a supply partner or invite a sub-agent to unlock transactions and quick actions')}</div>
          <button className="btn sm primary" style={{ marginTop: 10 }} onClick={() => push({ name: 'guide' })}>{t('View Guide')}</button>
        </div>
      )}
      <div className="h5-actions">
        {!platform && !(isTenant && !hasPartners) && actions.map(([label, icon, bg, color, handler]) => (
          <div key={'act-' + label} className="h5-action" onClick={handler}>
            <span className="a-icon" style={{ background: bg, color }}><Icon name={icon} size={18} /></span>
            <span className="a-label">{label}</span>
          </div>
        ))}
        {grid.map(([label, icon, bg, color, handler]) => (
          <div key={label} className="h5-action" onClick={handler}>
            <span className="a-icon" style={{ background: bg, color }}><Icon name={icon} size={18} /></span>
            <span className="a-label">{label}</span>
          </div>
        ))}
      </div>
      <div className="h5-section-title flex" style={{ justifyContent: 'space-between' }}>
        <span>WhatsApp Notifications</span><span className="mini-chip wa"><Icon name="whatsapp" size={11} /> push links</span>
      </div>
      {isTenant && (
        <div className="h5-card" style={{ fontSize: 11, color: 'var(--text-3)', padding: '8px 12px', marginBottom: 8, background: 'var(--bg-2)' }}>
          {t('Pushes are sent to the tenant main account and visible to all members')}
        </div>
      )}
      {pushes.length === 0 && <div className="h5-card" style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5, padding: 22 }}>No notifications yet</div>}
      {pushes.slice(0, 4).map(p => {
        const doc = db.docs.find(d => d.no === p.docNo);
        return (
          <div key={p.id} className="h5-cell" onClick={() => { if (doc) push({ name: 'wa', docId: doc.id }); }}>
            <span className="cell-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}><Icon name="whatsapp" size={19} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t(p.text.split('.')[0])}</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{fmtDateTime(p.ts)} · {p.docNo}</div>
            </div>
            {!p.read && <span className="unread-dot"></span>}
            <Icon name="chevronRight" size={14} color="var(--text-3)" />
          </div>
        );
      })}
      <div className="h5-section-title">Recent Documents</div>
      {myDocs.slice(-3).reverse().map(d => <H5DocCard key={d.id} doc={d} onClick={() => openDoc(d.id)} />)}
      </div>
    </div>
  );
}

// ---------- empty state ----------
function H5Empty({ icon, message, hint }) {
  return (
    <div className="h5-card" style={{ textAlign: 'center', color: 'var(--text-3)', padding: '26px 18px' }}>
      <Icon name={icon || 'file'} size={26} />
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginTop: 8 }}>{message || 'No Data'}</div>
      {hint && <div style={{ fontSize: 11.5, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

// products tab preference — module-level so it survives page navigation
// (returning from an inquiry started in Sourcing Channel lands back on Sourcing Channel)
let productsTab = 'mine';
// round 66 — doc-list landing state so the home Needs Attention board can
// deep-link into a specific document segment + status filter
let ordersSeg = 'IQ';
let ordersStatus = 'ALL';

// ---------- products ----------
// two tenant-scoped tabs: My Products (own catalog — price / stock / channel
// stock) and Sourcing Channel (upstream suppliers' catalog — inquiry entries live
// here). Platform accounts get a single read-only list instead of tabs.
function H5Products({ push, platform, skReady = true }) {
  const { db, account, act, toast, cartApi } = useApp();
  const [q, setQ] = useState('');
  const [tab, setTabState] = useState(productsTab); // 'mine' = My Products, 'channel' = Sourcing Channel
  const [supplier, setSupplier] = useState('ALL');
  const [cat, setCat] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  // inquiry multi-select mode: picked = array of product ids, qty defaults to 1 in the form
  const [pickMode, setPickMode] = useState(false);
  const [picked, setPicked] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const tenant = account.tenantId ? db.tenants.find(t => t.id === account.tenantId) : null;
  const showTabs = !platform && !!account.tenantId;
  // upstream suppliers / parent agents — the only source for the channel tab
  const upstream = platform ? [] : [...upstreamTenantIds(db, account.tenantId)]
    .map(id => db.tenants.find(t => t.id === id)).filter(t => t && t.status === 'Active');
  const upstreamIds = new Set(upstream.map(t => t.id));
  // inquiry is a tenant purchase capability — platform read-only, suppliers only answer inquiries
  const canInquire = showTabs && !(tenant && tenant.type === 'Supplier') && upstream.length > 0;
  const togglePick = (id) => setPicked(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  const exitPick = () => { setPickMode(false); setPicked([]); };
  const switchTab = (id) => { productsTab = id; setTabState(id); exitPick(); setQ(''); setCat(''); setSupplier('ALL'); };
  const rows = db.products.filter(p => {
    if (showTabs && (tab === 'mine' ? p.ownerId !== account.tenantId : !upstreamIds.has(p.ownerId))) return false;
    if (showTabs && tab === 'channel' && supplier !== 'ALL' && p.ownerId !== supplier) return false;
    if (cat && !p.categories.includes(cat)) return false;
    if (q && !(p.name + p.model + p.brand).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  // round 36 — single first header row: action buttons on the left, the filter
  // toggle pinned to the far right (both used to occupy separate rows)
  const hasFilterRow = !pickMode && (showTabs && tab === 'channel' ? upstream.length > 0 : true);
  const hasActions = !!((canInquire && tab === 'channel') || (tab === 'mine' || !showTabs));
  const actionButtons = (
    <React.Fragment>
      {canInquire && tab === 'channel' && (
        <button className={`btn${pickMode ? ' primary' : ''}`} style={{ height: 30 }} title="Select products to inquire"
          onClick={() => (pickMode ? exitPick() : setPickMode(true))}><Icon name="edit" size={14} />{pickMode ? 'Done' : 'Inquire'}</button>
      )}
      {/* R99w — 「入库」「导入」均已从筛选行移除：入库走页头「扫码」入口（支持手动录入），
          导入移至页头右上角图标按钮 */}
    </React.Fragment>
  );
  return (
    <div className="h5-tabpage">
      {/* R99e — segment tabs + action/filter row pinned; the product list below scrolls */}
      <div className="h5-tabhead tight">
        {showTabs && (
          <div className="h5-segments mb12">
            <button className={`h5-segment${tab === 'mine' ? ' active' : ''}`} onClick={() => switchTab('mine')}>My Warehouse</button>
            <button className={`h5-segment${tab === 'channel' ? ' active' : ''}`} onClick={() => switchTab('channel')}>Sourcing Channel</button>
          </div>
        )}
        {hasFilterRow ? (
          <H5FilterBar open={showFilters} onToggle={() => setShowFilters(v => !v)}
            activeCount={(q ? 1 : 0) + (tab === 'channel' && supplier !== 'ALL' ? 1 : 0) + (cat ? 1 : 0)}
            onReset={() => { setQ(''); setSupplier('ALL'); setCat(''); }}
            left={hasActions ? actionButtons : null}
            values={{ q, supplier, cat }}
            onChange={(k, v) => { if (k === 'q') setQ(v); else if (k === 'supplier') setSupplier(v); else setCat(v); }}
            onSearch={() => setShowFilters(false)}
            fields={[
              ...(showTabs && tab === 'channel' ? [{ type: 'select', key: 'supplier', label: 'Supplier', icon: 'building',
                options: [{ value: 'ALL', label: `All Suppliers (${upstream.length})` }].concat(upstream.map(u => ({ value: u.id, label: `${u.name} (${u.code})` }))) }] : []),
              { type: 'select', key: 'cat', label: 'Category', icon: 'tag', labelWidth: 72, placeholder: 'All categories',
                options: db.categories.map(c => ({ value: c.id, label: t(c.name) })) },
              { type: 'search', key: 'q', placeholder: 'Search products' },
            ]} />
        ) : (hasActions ? (
          <div className="flex gap8" style={{ alignItems: 'center', flexWrap: 'wrap' }}>{actionButtons}</div>
        ) : null)}
        {/* R99v — the read-only hint banner is NOT removed from the UI: it is
            moved OUT of the scrolling body into the PINNED head so only the
            product list scrolls. Channel tab shows the upstream-catalog note;
            platform accounts (single read-only list) keep their note too. */}
        {!pickMode && (platform || (showTabs && tab === 'channel')) && (
          <div className="h5-card" style={{ padding: '6px 10px', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-3)' }}>
            <Icon name="lock" size={12} />
            <span>{platform
              ? 'Read-only — platform accounts cannot operate product data'
              : "Channel products are your upstream suppliers' catalog (read-only) — send inquiries instead of editing"}</span>
          </div>
        )}
      </div>
      {/* R100d — pick mode: tabbody loses its bottom padding so the footer
          bar's rest position touches the frame bottom (rest == pinned). */}
      <div className="h5-tabbody tight" style={{ paddingBottom: pickMode ? 0 : undefined }}>
      {/* R100j — 骨架屏只加在滚动内容区：固定的段选/筛选头（tabhead）不闪骨架 */}
      {!skReady ? <H5Skeleton variant="list" /> : (<React.Fragment>
      {pickMode && <div className="h5-card muted" style={{ fontSize: 11.5, lineHeight: 1.6, marginBottom: 10 }}><Icon name="info" size={12} /> Select the products you want to inquire about, then add them to the inquiry staging — quantities default to 1 and can be adjusted in the staging before submitting. Only upstream supplier products can be picked; own and downstream products are locked.</div>}
      {refreshing ? <div className="h5-card" style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>Refreshing…</div> :
        rows.map(p => {
          // tenant boundary holds naturally: the channel tab lists upstream-owned
          // products only (inquirable), the mine tab lists own products (manageable)
          const inq = canInquireProduct(db, account, p);
          const mine = canManageProduct(db, account, p);
          // R100m — 库存数字统一带单位
          const sv = (db.stock[account.tenantId] || {})[p.id];
          return (
          <div key={p.id} className="h5-product" style={pickMode && !inq ? { cursor: 'default' } : undefined}
            onClick={() => (pickMode ? (inq ? togglePick(p.id) : undefined) : push({ name: 'product', productId: p.id }))}>
            {/* R100p — 列表项分 body/foot：p-main=body（图片/名称/编码/规格/库存/分类/价格），p-foot=操作按钮，段间虚线 */}
            <div className="p-main">
            {pickMode && (inq
              ? <span className={`checkbox${picked.includes(p.id) ? ' on' : ''}`} style={{ flexShrink: 0, alignSelf: 'center' }}><Icon name="check" size={11} /></span>
              : <span className="checkbox" style={{ flexShrink: 0, alignSelf: 'center', opacity: 0.35 }}><Icon name="lock" size={11} /></span>)}
            <img src={prodImg(p)} alt={p.name} />
            {/* R100d — product info re-typeset: name + stock head line, spec,
                prices in a soft panel, supplier / lock hints as chips. */}
            <div className="p-body">
              <div className="p-head">
                <div className="p-name">{p.name}</div>
                <div className="p-stock">
                  <span className="ps-v">{sv == null ? '—' : <React.Fragment>{sv} {p.unit}</React.Fragment>}</span>
                  <span className="ps-l">{t('Stock')}</span>
                </div>
              </div>
              <div className="p-spec mono">{p.model} · {p.spec}</div>
              {/* R100p — 物料分类 chips（含渠道供应商/锁定提示），价格收尾 */}
              {(p.categories && p.categories.length > 0) || (pickMode && !inq) || (!pickMode && tab === 'channel' && showTabs) ? (
                <div className="p-meta">
                  {(p.categories || []).map(cid => { const c = db.categories.find(x => x.id === cid); return c ? <span key={cid} className="p-chip"><Icon name="tag" size={10} />{t(c.name)}</span> : null; })}
                  {pickMode && !inq && (
                    <span className="p-chip"><Icon name="lock" size={10} />{p.ownerId === account.tenantId ? t('Own product — not inquirable') : t('Downstream product — not inquirable')}</span>
                  )}
                  {!pickMode && tab === 'channel' && showTabs && (
                    <span className="p-chip"><Icon name="building" size={10} />{productOwnerName(db, p)}</span>
                  )}
                </div>
              ) : null}
              {/* R78 — list-item prices: own products show cost/market/sale,
                  upstream (channel) products show market/sale only (cost is the
                  owner's procurement record, hidden across the tenant boundary) */}
              <div className="p-prices">
                {p.ownerId === account.tenantId && <div className="p-price-line"><span className="pl-k">{t('Cost Price')}</span><span className="pl-v">{money(ifnull(p.cost, p.price), p.currency).text}</span></div>}
                <div className="p-price-line"><span className="pl-k">{t('Market Reference Price')}</span><span className="pl-v">{money(ifnull(p.marketPrice, p.price), marketCurOf(p)).text}</span></div>
                <div className="p-price-line"><span className="pl-k">{t('Channel Sales Price')}</span><span className="pl-v pl-sale">{money(p.price, p.currency).text}</span></div>
              </div>
            </div>
            </div>
            {!pickMode && tab === 'channel' && showTabs && inq && (
              <div className="p-foot">
                <div className="row-actions" onClick={e => e.stopPropagation()}>
                  {/* 询价 = 加入询价暂存：单项入口，数量默认 1，已在车中则 +1 */}
                  <button className="h5-item-act" title={t('Inquire')} aria-label={t('Inquire')} onClick={() => { cartApi.add('inquiry', { pid: p.id, qty: 1 }); toast(`${p.name} added to the inquiry staging`, 'success'); }}><Icon name="edit" size={12} />{t('Inquire')}</button>
                </div>
              </div>
            )}
            {!pickMode && (tab === 'mine' || !showTabs) && !platform && mine && (
              <div className="p-foot">
                <div className="row-actions" onClick={e => e.stopPropagation()}>
                  <button className="h5-item-act" title={t('Adjust Price')} aria-label={t('Adjust Price')} onClick={() => push({ name: 'adjustPrice', productId: p.id })}><Icon name="tag" size={12} />{t('Adjust Price')}</button>
                  {/* 调整库存拆分：入库/出库加入对应暂存（数量默认 1，已在车中则 +1） */}
                  <button className="h5-item-act" title={t('Stock In')} aria-label={t('Stock In')} onClick={() => { cartApi.add('inbound', { kind: 'exist', pid: p.id, qty: 1 }); toast(`${p.name} added to the inbound staging`, 'success'); }}><Icon name="download" size={12} />{t('Stock In')}</button>
                  <button className="h5-item-act" title={t('Stock Out')} aria-label={t('Stock Out')} onClick={() => { cartApi.add('outbound', { pid: p.id, qty: 1 }); toast(`${p.name} added to the outbound staging`, 'success'); }}><Icon name="truck" size={12} />{t('Stock Out')}</button>
                  <button className="h5-item-act" title={t('View Stock')} aria-label={t('View Stock')} onClick={() => push({ name: 'channelStock', productId: p.id })}><Icon name="eye" size={12} />{t('View Stock')}</button>
                </div>
              </div>
            )}
          </div>
          );
        })}
      {rows.length === 0 && (tab === 'channel' && showTabs && upstream.length === 0 && !q
        ? <H5Empty icon="building" message="No upstream suppliers" hint="This tab lists products from your upstream suppliers / parent agents. Suppliers and unlinked tenants have no channel products." />
        : (q || cat)
          ? <H5Empty icon="search" message="No products match the search" />
          : (showTabs && tab === 'channel'
            ? <H5Empty icon="search" message="No channel products" hint="Adjust the supplier filter or search keywords." />
            : <H5Empty icon="box" message="No products yet" hint="Products you create or import appear here." />))}
      {/* R100d — keyed branches: React otherwise reuses the same DOM node when
          pickMode toggles and the idle hint's inline styles leak onto the bar. */}
      {pickMode ? (
        <div key="pickbar" className="h5-actionbar">
          <button className="h5-btn" onClick={exitPick}><Icon name="close" size={14} />Cancel</button>
          {/* 多选加入询价暂存：勾选的商品逐项累积，数量默认 1，去暂存单确认生成询价单 */}
          <button className="h5-btn primary" disabled={!picked.length} onClick={() => { cartApi.addMany('inquiry', picked); toast(picked.length + (picked.length === 1 ? ' product added to the inquiry staging' : ' products added to the inquiry staging'), 'success'); exitPick(); }}>
            <Icon name="cart" size={14} />{t('Add to Inquiry Staging')}{picked.length ? ` (${picked.length})` : ''}
          </button>
        </div>
      ) : (
        <div key="idlehint" className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: 14 }}>Pull down to refresh · pull up to load more</div>
      )}

      </React.Fragment>)}
      </div>
    </div>
  );
}

// ---------- downstream stock tree page (own product → sales chain) ----------
function H5ChannelStockPage({ productId }) {
  const { db, account } = useApp();
  const p = db.products.find(x => x.id === productId);
  if (!p) return null;
  const myStock = (db.stock[account.tenantId] || {})[productId];
  // walk the downstream chain: how many resellers hold the product, and how much
  let dsTenants = 0, dsTotal = 0;
  const walk = (list) => list.forEach(n => {
    const s = (db.stock[n.id] || {})[productId];
    if (s != null) { dsTenants += 1; dsTotal += s; }
    walk(n.children);
  });
  walk(downstreamChain(db, account.tenantId));
  return (
    <div className="h5-pad">
      <div className="h5-card flex gap10">
        <img src={prodImg(p)} alt="" style={{ width: 46, height: 46, borderRadius: 8, objectFit: 'cover' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name}</div>
          <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{p.model} · {p.spec}</div>
        </div>
      </div>
      <div className="flex gap10 mt12">
        <div className="h5-card" style={{ flex: 1, textAlign: 'center', padding: '10px 6px' }}>
          <div className="muted" style={{ fontSize: 11 }}>My Stock</div>
          <div className="mono bold" style={{ fontSize: 17, marginTop: 2 }}>{myStock == null ? '—' : <React.Fragment>{myStock} {p.unit}</React.Fragment>}</div>
        </div>
        <div className="h5-card" style={{ flex: 1, textAlign: 'center', padding: '10px 6px' }}>
          <div className="muted" style={{ fontSize: 11 }}>Downstream Tenants</div>
          <div className="mono bold" style={{ fontSize: 17, marginTop: 2 }}>{dsTenants}</div>
        </div>
        <div className="h5-card" style={{ flex: 1, textAlign: 'center', padding: '10px 6px' }}>
          <div className="muted" style={{ fontSize: 11 }}>Channel Total</div>
          <div className="mono bold" style={{ fontSize: 17, marginTop: 2 }}>{dsTotal} {p.unit}</div>
        </div>
      </div>
      <div className="h5-section-title mt12">Downstream Stock Tree</div>
      <div className="h5-card" style={{ padding: '6px 12px' }}>
        <DownstreamStockTree db={db} rootTenantId={account.tenantId} productId={productId} />
      </div>
      <div className="h5-card muted mt12" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
        <Icon name="info" size={12} /> Stock visibility follows the sales chain — each level shows the current on-hand quantity of this product; receiving and outbound update the numbers in real time.
      </div>
    </div>
  );
}

// ---------- orders ----------
function H5Orders({ openDoc, platform, push, setConfirm, skReady = true }) {
  const { db, account, act, toast } = useApp();
  const [seg, setSeg] = useState(ordersSeg); // round 66 — deep-linkable segment
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(ordersStatus); // round 66 — deep-linkable status
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sku, setSku] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const visible = db.docs.filter(d => docVisible(db, account, d) && ['IQ', 'QT', 'PO', 'CK', 'RK', 'FP'].includes(d.type));
  // tab-scoped documents first, so the status chips only offer the statuses
  // that actually exist under the active document tab
  // R99k — the Order (订单) category lists ONLY purchase orders (PO); CK/RK
  // rows no longer appear here. Outbound (CK) detail stays reachable via the
  // order detail's 查看发货单 entry, which carries the receipt / re-receive /
  // replenish verbs, so no action is lost.
  const tabDocs = visible.filter(d => seg === 'IQ' ? d.type === 'IQ' : seg === 'QT' ? d.type === 'QT' : seg === 'PO' ? d.type === 'PO' : d.type === 'FP');
  // R85 — the Order tab filter offers EXACTLY the nine order-flow statuses
  // (待接收 → 待付款 → 待出库 → 待发货 → 待收货 → 已收货 / 部分收货 / 已拒收 /
  // 终止收货); other tabs keep the full status set of their doc types
  const tabTypes = seg === 'IQ' ? ['IQ'] : seg === 'QT' ? ['QT'] : seg === 'PO' ? null : ['FP'];
  const metaStatuses = [];
  (tabTypes || []).forEach(tp => Object.keys(STATUS_META[tp] || {}).forEach(s => { if (!metaStatuses.includes(s)) metaStatuses.push(s); }));
  const statuses = ['ALL', ...(seg === 'PO' ? ORDER_FLOW_STATUSES : metaStatuses)];
  const rows = tabDocs
    // R87 — chips match the DISPLAYED (order-flow) status, so the 待收货 chip
    // also catches CK rows at raw 'Shipped' (已发货→待收货 display mapping)
    .filter(d => status === 'ALL' || d.status === status || orderDisplayStatus(d) === status)
    .filter(d => !q || (d.no + tenantName(db, d.buyer) + tenantName(db, d.seller)).toLowerCase().includes(q.toLowerCase()))
    // MVP D2 — mobile-simplified date range + SKU filter on the unified document list
    .filter(d => (!from || d.createdAt.slice(0, 10) >= from) && (!to || d.createdAt.slice(0, 10) <= to))
    .filter(d => !sku || d.items.some(it => it.pid === sku))
    // R99p — sort rule: 待处理 (docs with action verbs for the CURRENT viewer)
    // first, 已处理 (no verbs) after; within each group newest first (由近到远)
    .sort((a, b) => docListCompare(db, account, a, b));
  // R99l — the visible-count label follows the active segment noun (可见询价单 /
  // 可见报价单 / 可见订单 / 可见发票) and sits on ONE row with the Filters
  // button: count left-aligned, Filters right-aligned
  const SEG_NOUN = { IQ: 'inquiries', QT: 'quotes', PO: 'orders', FP: 'invoices' };
  const countLabel = platform ? t('Cross-tenant documents (read-only)') : t('Visible ' + SEG_NOUN[seg]);
  return (
    <div className="h5-tabpage">
      {/* R99e — segment tabs + filter bar pinned; the document list below scrolls */}
      <div className="h5-tabhead tight">
        <div className="h5-segments mb12">
          {[['IQ', 'Inquiry'], ['QT', 'Quote'], ['PO', 'Order'], ['FP', 'Invoice']].map(([id, label]) => (
            <button key={id} className={`h5-segment${seg === id ? ' active' : ''}`} onClick={() => { setSeg(id); setStatus('ALL'); ordersSeg = id; ordersStatus = 'ALL'; }}>{label}</button>
          ))}
        </div>
        {/* R99l — the visible-count label sits on the SAME row as the Filters
            button (count left-aligned, Filters right-aligned), and the noun
            follows the active segment (可见询价单/可见报价单/可见订单/可见发票) */}
        <H5FilterBar open={showFilters} onToggle={() => setShowFilters(v => !v)}
          left={<span className="h5-section-title" style={{ margin: 0 }}>{countLabel} · {rows.length}</span>}
          activeCount={(q ? 1 : 0) + (status !== 'ALL' ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0) + (sku ? 1 : 0)}
          onReset={() => { setQ(''); setStatus('ALL'); setFrom(''); setTo(''); setSku(''); }}
          values={{ q, status, from, to, sku }}
          onChange={(k, v) => { if (k === 'q') setQ(v); else if (k === 'status') setStatus(v); else if (k === 'from') setFrom(v); else if (k === 'to') setTo(v); else setSku(v); }}
          onSearch={() => setShowFilters(false)}
          fields={[
            { type: 'chips', key: 'status', options: statuses.map(s => ({ value: s, label: s === 'ALL' ? 'All statuses' : s })) },
            { type: 'daterange', fromKey: 'from', toKey: 'to' },
            { type: 'select', key: 'sku', placeholder: 'All products', options: db.products.map(p => ({ value: p.id, label: p.name })) },
            { type: 'search', key: 'q', placeholder: 'Search doc no / partner' },
          ]} />
      </div>
      <div className="h5-tabbody tight">
      {/* R100j — 骨架屏只加在滚动内容区：固定的段选/筛选头（tabhead）不闪骨架 */}
      {!skReady ? <H5Skeleton variant="list" /> : (<React.Fragment>
      {/* R99l — the count row moved up into the pinned filter head (same row
          as the Filters button); the tab body now starts directly with the
          list / empty states */}
      {rows.length === 0 && (tabDocs.length === 0
        ? (platform
          ? <H5Empty message="No documents" />
          : <H5Empty icon="lock" message="No visible data for this account" hint="Cross-tenant data is isolated by design — you only see records you created, plus those of your own tenant and linked supply partners." />)
        : <H5Empty icon="search" message="No documents in this tab" hint="Try another document tab or clear the filters." />)}
      {rows.map(d => <H5DocCard key={d.id} doc={d} showRole onClick={() => openDoc(d.id)} onVerb={!platform ? (verb, doc) => h5DocVerb(verb, doc, { db, act, toast, push, setConfirm }) : null} />)}
      <div className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: 14 }}>Load more by pulling up</div>
      </React.Fragment>)}
      </div>
    </div>
  );
}

// round 41 — the shared filter panel now lives in ui.jsx as H5FilterBar with
// declarative field types (chips / select / daterange / search / text)

// Shared doc-verb runner — used by both the doc detail page action bar and
// the quick-action chips on document list cards (four doc tabs).
function h5DocVerb(verb, doc, ctx) {
  const { db, act, toast, push, setConfirm } = ctx;
  if (verb === 'Quote') return push({ name: 'quote', docId: doc.id });
  // R81 — rejection requires a written reason (quote by buyer / order by supplier)
  if (verb === 'Reject') {
    setConfirm({
      title: 'Reject',
      message: `Reject ${doc.type === 'PO' ? 'order' : 'quote'} ${doc.no}? A rejection reason is required.`,
      confirmText: 'Reject',
      reason: true,
      onConfirm: (reason) => { act.docVerb('Reject', doc, null, reason); toast(`${doc.type === 'PO' ? 'Order' : 'Quote'} rejected — reason recorded`, 'success'); },
    });
    return;
  }
  if (verb === 'Accept' || verb === 'Submit' || verb === 'Cancel' || verb === 'Close' || verb === 'Delete'
    || verb === 'Confirm Quote' || verb === 'Place Order' || verb === 'Record Payment' || verb === 'Create Invoice' || verb === 'Confirm Invoice' || verb === 'Dispatch'
    || verb === 'Re-receive' || verb === 'Replenish' || verb === 'Terminate Receiving') {
    // R92 — the partial-receipt recovery actions can be triggered from a CK/RK
    // list item; they always operate on the parent purchase order
    const po = parentPoOf(db, doc) || doc;
    // R94 — PO accept / record payment / replenish open dedicated FORM pages;
    // terminate receiving requires a written reason
    if (verb === 'Accept' && doc.type === 'PO') return push({ name: 'accept', docId: doc.id });
    if (verb === 'Record Payment') return push({ name: 'pay', docId: doc.id });
    if (verb === 'Replenish') return push({ name: 'replenish', docId: po.id });
    if (verb === 'Terminate Receiving') {
      setConfirm({
        title: 'Terminate Receiving',
        message: `Terminate receiving for order ${po.no}? The follow-up replenishment stops and this order's receiving is completed. A termination reason is required.`,
        confirmText: 'Terminate',
        reason: true,
        onConfirm: (reason) => { act.terminateReceiving(po, reason); },
      });
      return;
    }
    const msgs = {
      Accept: doc.type === 'PO'
        // R81 — supplier accepts the order → invoice auto-issued
        ? `Accept order ${doc.no}? An invoice will be issued automatically and pushed to the buyer.`
        : `Accept quote ${doc.no}? A purchase order will be auto-generated.`,
      Submit: `Submit ${doc.no} to ${tenantName(db, doc.seller)}?`,
      Cancel: `Cancel ${doc.no}? This cannot be undone.`,
      Close: `Close inquiry ${doc.no}?`,
      Delete: `Delete draft ${doc.no}? This cannot be undone.`,
      'Confirm Quote': `Confirm the AI-drafted quote ${doc.no} with one tap? The quote link will be pushed to ${tenantName(db, doc.buyer)} via WhatsApp.`,
      'Place Order': `Place order ${doc.no} with one tap? It will be submitted to ${tenantName(db, doc.seller)} for review.`,
      'Record Payment': `Record the offline payment for order ${doc.no}? The buyer pays offline — recording it notifies the buyer and unlocks shipment.`,
      'Create Invoice': `Issue the invoice for ${doc.no}? The invoice link will be pushed to ${tenantName(db, doc.buyer)} via WhatsApp.`,
      'Confirm Invoice': `Confirm invoice ${doc.no}? It will be archived after confirmation.`,
      // R82 — dispatch the generated outbound order: waybill link pushed to the buyer
      Dispatch: `Dispatch outbound order ${doc.no}? The waybill link is pushed to ${tenantName(db, doc.buyer)} and the order moves to awaiting receipt.`,
      // R83 — partial receipt recovery (R92: po.no — the doc may be a CK/RK item)
      'Re-receive': `Re-receive all outstanding quantities for order ${po.no}? An inbound record will be created and the order moves to fully received if all items are caught up.`,
      'Replenish': `Issue a replenishment shipment for the shortfall of order ${po.no}? A new outbound order with waybill will be generated.`,
      'Terminate Receiving': `Terminate receiving for order ${po.no}? The follow-up replenishment stops and this order's receiving is completed.`,
    };
    setConfirm({ title: verb, message: msgs[verb], confirmText: verb, onConfirm: () => {
      if (verb === 'Dispatch') act.dispatch(doc);
      else if (verb === 'Re-receive') push({ name: 'rereceive', docId: po.id });
      else if (verb === 'Replenish') act.replenish(po);
      else if (verb === 'Terminate Receiving') act.terminateReceiving(po);
      else act.docVerb(verb, doc);
      // submitted inquiries continue into the simulated WhatsApp conversation
      if (verb === 'Submit' && doc.type === 'IQ') push({ name: 'waChat', docId: doc.id });
    } });
    return;
  }
  if (verb === 'Ship') return push({ name: 'ship', docId: doc.id });
  // R91/R92 — the buyer can confirm receipt directly from the ORDER (or a CK
  // list item) at 已发货: resolve to the outbound (CK) and open the receiving
  // page. 已发货 covers both raw stages (waybill generated / dispatched).
  if (verb === 'Confirm Receipt') {
    const target = doc.type === 'PO'
      ? db.docs.filter(d => d.type === 'CK' && d.poNo === doc.no && ['Shipped', 'Pending Shipment'].includes(d.status)).pop()
      : doc;
    if (target) return push({ name: 'receive', docId: target.id });
    toast('Shipment not dispatched yet');
    return;
  }
  if (verb === 'Download') {
    act.logEvent('Download Invoice', `${doc.no} (H5)`);
    downloadInvoiceFile(db, doc);
    toast(`Invoice ${doc.no} downloaded — export logged`, 'success');
    return;
  }
}

function H5DocCard({ doc, onClick, showRole, onVerb }) {
  const { db, account } = useApp();
  const side = docSide(db, account, doc);
  const cp = tenantName(db, side === 'seller' ? doc.buyer : doc.seller);
  // quick actions per doc type + status + counterparty role (list context)
  const acts = onVerb ? docActions(db, account, doc).filter(v => !['View', 'Print', 'Edit'].includes(v)) : [];
  return (
    <div className="h5-doc" onClick={onClick}>
      <div className="d-head">
        <span className="d-no"><span className="mono" style={{ color: 'var(--primary)', fontWeight: 700 }}>{doc.no}</span></span>
        <StatusTag type={doc.type} status={doc.status} />
      </div>
      <div className="d-body">
        <span>{cp}</span>
        <span className="d-amount"><span className="cur-code">{doc.currency}</span>{' '}{money(docAmount(doc), doc.currency).num}</span>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{doc.items.length} items · {doc.createdAt} · by {doc.createdBy}</div>
      {/* R82 — list items show only the buyer / seller role; no observer role */}
      {showRole && (side === 'buyer' || side === 'seller') && (
        <div className="muted" style={{ fontSize: 11, marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>Your role</span><span>: </span>
          <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>{side === 'seller' ? 'Seller' : 'Buyer'}</span>
          <span>{' · '}</span>
          <span>{side === 'seller' ? 'Downstream' : 'Upstream'}</span>
          <span>: </span>
          <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>{cp}</span>
        </div>
      )}
      {acts.length > 0 && (
        <div className="d-acts" onClick={e => e.stopPropagation()}>
          {acts.map(v => (
            <button key={v} className={`d-act${['Accept', 'Approve', 'Submit', 'Quote', 'Confirm Quote', 'Place Order', 'Ship', 'Dispatch', 'Confirm Receipt', 'Create Invoice', 'Confirm Invoice', 'Record Payment'].includes(v) ? ' primary' : ['Reject', 'Cancel', 'Close', 'Delete'].includes(v) ? ' danger' : ''}`} onClick={() => onVerb(v, doc)}><Icon name={VERB_ICON[v] || 'check'} size={12} />{v === 'Quote' ? 'Quote now' : v}</button>
          ))}
        </div>
      )}
      {showRole && acts.length === 0 && (
        <div className="muted" style={{ fontSize: 11, marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="lock" size={11} />
          <span>{account.type === 'platform'
            ? 'Read-only — platform accounts cannot operate business documents'
            : side === 'buyer' || side === 'seller'
              ? 'No operations available in the current status'
              : 'View only'}</span>
        </div>
      )}
    </div>
  );
}

// ---------- mine ----------
function H5Mine({ push }) {
  const { db, account, act, switchAccount, logout, setView, toast } = useApp();
  const isTenant = account.type === 'tenant';
  // round 54 — change own password dialog state
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ cur: '', next: '', conf: '' });
  const savePw = () => {
    if (account.password && pw.cur !== account.password) { toast('Current password is incorrect', 'error'); return; }
    if (pw.next.length < 6) { toast('At least 6 characters', 'error'); return; }
    if (pw.next !== pw.conf) { toast('Passwords do not match', 'error'); return; }
    if (account.password && pw.next === account.password) { toast('New password must differ from the current one', 'error'); return; }
    act.changePassword(account.id, pw.next);
    setPwOpen(false);
    setPw({ cur: '', next: '', conf: '' });
  };
  const tenant = isTenant ? db.tenants.find(t => t.id === account.tenantId) : null;
  const vis = isTenant ? relatedTenantIds(db, account.tenantId) : new Set();
  // platform admins see every demo account (global read-only oversight);
  // tenant accounts only see their own + linked chain
  const switchable = account.type === 'platform'
    ? db.accounts
    : db.accounts.filter(a => a.type === 'platform' || (isTenant && vis.has(a.tenantId)));
  return (
    <div className="h5-tabpage">
      {/* R99f — account card pinned at the top; the account list / settings below scroll */}
      <div className="h5-tabhead">
        <div className="h5-card flex gap10">
          <span className={`avatar ${account.type === 'platform' ? 'plat' : 'tenant'}`} style={{ width: 48, height: 48, fontSize: 15 }}>{account.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{account.name}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
              {account.type === 'platform' ? 'Platform Admin' : (db.tenants.find(t => t.id === account.tenantId) || {}).name}
            </div>
            <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{account.phone}{account.whatsapp ? ' · WhatsApp bound' : ''}</div>
          </div>
          <span style={{ marginLeft: 'auto' }}><Tag tone="info">Personal data scope</Tag></span>
        </div>
      </div>
      <div className="h5-tabbody">
      <div className="h5-section-title">Switch Demo Account <span className="mini-chip demo">DEMO</span></div>
      {switchable.map(a => (
        <div key={a.id} className={`h5-cell${a.id === account.id ? '' : ''}`} onClick={() => switchAccount(a.id)} style={a.id === account.id ? { outline: '2px solid var(--primary)' } : null}>
          <span className="cell-icon" style={{ background: a.type === 'platform' ? 'var(--purple-light)' : 'var(--primary-light)', color: a.type === 'platform' ? 'var(--purple)' : 'var(--primary)' }}>
            <Icon name={a.type === 'platform' ? 'shield' : 'user'} size={17} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.name}</div>
            <div className="muted" style={{ fontSize: 11.5 }}>{a.tenantId ? (db.tenants.find(t => t.id === a.tenantId) || {}).name : 'Platform'}</div>
          </div>
          {a.id === account.id && <Tag tone="primary">Current</Tag>}
        </div>
      ))}
      <div className="h5-section-title">Language · 语言</div>
      <div className="h5-cell" style={{ justifyContent: 'space-between' }}>
        <span className="cell-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}><Icon name="info" size={17} /></span>
        <div style={{ flex: 1, fontSize: 13.5 }}>{getLang() === 'zh' ? '界面语言 Interface Language' : 'Interface Language · 界面语言'}</div>
        <LangSwitch mobile />
      </div>
      <div className="h5-section-title">Workspace</div>
      <div className="h5-cell" onClick={() => setPwOpen(true)}>
        <span className="cell-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}><Icon name="lock" size={17} /></span>
        <div style={{ flex: 1, fontSize: 13.5 }}>Change Password<span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>{account.password ? 'reset your login password' : 'set your login password'}</span></div><Icon name="chevronRight" size={14} color="var(--text-3)" />
      </div>
      {account.type === 'platform' && (
        <div className="h5-cell" onClick={() => push({ name: 'admin' })}>
          <span className="cell-icon" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}><Icon name="shield" size={17} /></span>
          <div style={{ flex: 1, fontSize: 13.5 }}>Platform Admin</div><Icon name="chevronRight" size={14} color="var(--text-3)" />
        </div>
      )}
      {isTenant && (
        <div className="h5-cell" onClick={() => push({ name: 'members' })}>
          <span className="cell-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}><Icon name="users" size={17} /></span>
          <div style={{ flex: 1, fontSize: 13.5 }}>Team Members &amp; Sub-Agents</div><Icon name="chevronRight" size={14} color="var(--text-3)" />
        </div>
      )}
      {isTenant && (
        <div className="h5-cell" onClick={() => push({ name: 'bindwa' })}>
          <span className="cell-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}><Icon name="whatsapp" size={17} /></span>
          <div style={{ flex: 1, fontSize: 13.5 }}>Bind WhatsApp<span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>{account.whatsapp ? account.whatsapp : 'not bound'}</span></div><Icon name="chevronRight" size={14} color="var(--text-3)" />
        </div>
      )}
      <div className="h5-section-title">About</div>
      <div className="h5-cell" onClick={() => push({ name: 'guide' })}>
        <span className="cell-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}><Icon name="shield" size={17} /></span>
        <div style={{ flex: 1, fontSize: 13.5 }}>Permission Guide</div><Icon name="chevronRight" size={14} color="var(--text-3)" />
      </div>
      <div className="h5-cell" onClick={() => push({ name: 'notes' })}>
        <span className="cell-icon" style={{ background: '#F0F2F5', color: 'var(--text-2)' }}><Icon name="info" size={17} /></span>
        <div style={{ flex: 1, fontSize: 13.5 }}>Data Risk &amp; Confidence Notes</div><Icon name="chevronRight" size={14} color="var(--text-3)" />
      </div>
      <div className="h5-cell" onClick={() => setView('web')}>
        <span className="cell-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}><Icon name="desktop" size={17} /></span>
        <div style={{ flex: 1, fontSize: 13.5 }}>Switch to Web Console</div><Icon name="chevronRight" size={14} color="var(--text-3)" />
      </div>
      <div className="h5-cell" onClick={() => logout()}>
        <span className="cell-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}><Icon name="arrowLeft" size={17} style={{ transform: 'rotate(180deg)' }} /></span>
        <div style={{ flex: 1, fontSize: 13.5, color: 'var(--danger)' }}>Sign Out</div><Icon name="chevronRight" size={14} color="var(--text-3)" />
      </div>
      {pwOpen && (
        <Dialog title="Change Password" width="92%" onClose={() => setPwOpen(false)}
          footer={<React.Fragment>
            <button className="btn" onClick={() => setPwOpen(false)}><Icon name="close" size={13} />Cancel</button>
            <button className="btn primary" onClick={savePw}><Icon name="check" size={13} />Confirm</button>
          </React.Fragment>}>
          {account.password && <div className="h5-form-row"><span className="k">Current Password</span><input className="input" type="password" style={{ height: 32, flex: 1 }} value={pw.cur} onChange={e => setPw(s => ({ ...s, cur: e.target.value }))} placeholder="current password" autoFocus /></div>}
          <div className="h5-form-row"><span className="k">New Password</span><input className="input" type="password" style={{ height: 32, flex: 1 }} value={pw.next} onChange={e => setPw(s => ({ ...s, next: e.target.value }))} placeholder="min. 6 characters" autoFocus={!account.password} /></div>
          <div className="h5-form-row" style={{ borderBottom: 'none' }}><span className="k">Confirm New Password</span><input className="input" type="password" style={{ height: 32, flex: 1 }} value={pw.conf} onChange={e => setPw(s => ({ ...s, conf: e.target.value }))} placeholder="repeat the new password" /></div>
          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>demo password — hashed at rest in the real system</div>
        </Dialog>
      )}
      <div className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: 20 }}>TierLink Warehouse MVP · Demo data only · v1.0.0</div>
      </div>
    </div>
  );
}

// ---------- doc detail page ----------
function H5DocPage({ docId, push, setConfirm, platform, noPerm }) {
  const { db, account, act, toast } = useApp();
  const doc = db.docs.find(d => d.id === docId);
  const [aiOpen, setAiOpen] = useState(false);
  // R99m — the export sheet / WhatsApp link sheet now carry a TARGET doc
  // (the order itself, or its invoice / outbound order opened from the
  // basic-info rows); null = closed
  const [exportOpen, setExportOpen] = useState(null);
  const [linkOpen, setLinkOpen] = useState(null);
  const [tlAll, setTlAll] = useState(false); // flow timeline: collapsed to latest 6 by default
  if (!doc) return null;
  const side = docSide(db, account, doc);
  const actions = docActions(db, account, doc).filter(v => !['View', 'Print', 'Edit'].includes(v));
  const cp = side === 'seller' ? doc.buyer : doc.seller;
  const runVerb = (verb) => h5DocVerb(verb, doc, { db, act, toast, push, setConfirm });
  // R80 — shipped order: look up the auto-generated outbound order (CK) /
  // waybill so the buyer/seller can view them straight from the PO detail
  const shipCk = doc.type === 'PO' ? db.docs.find(d => d.type === 'CK' && d.poNo === doc.no) : null;
  // R83 — invoice (FP) is auto-issued on supplier acceptance (Pending Payment or later)
  const poFp = doc.type === 'PO' ? db.docs.find(d => d.type === 'FP' && d.poNo === doc.no) : null;
  const aiSummary = `Order ${doc.no} from ${tenantName(db, doc.seller)} contains ${doc.items.length} line items totalling ${money(docAmount(doc), doc.currency).full}. Delivery expected by ${doc.deliveryDate || 'N/A'} at Default Warehouse. Chain: ${(doc.chainPath || []).map(t => tenantName(db, t)).join(' → ')}. Prices are within 10% of catalog reference — safe to confirm.`;
  // WhatsApp login-free link (MVP P2) — open in a new tab to preview.
  // R99m: the link targets the doc the sheet was opened for (order itself,
  // invoice, or outbound order from the basic-info rows).
  const waDoc = linkOpen || doc;
  const demoLink = `${window.location.origin}${window.location.pathname}?doc=${encodeURIComponent(waDoc.no)}&token=demo`;
  return (
    <div className="h5-pad">
      <div className="h5-card">
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{doc.no}</span>
          <StatusTag type={doc.type} status={doc.status} />
        </div>
        <div className="h5-desc mt12">
          <div className="h5-desc-row"><div className="k">{side === 'seller' ? 'Buyer' : 'Seller'}</div><div className="v">{tenantName(db, cp)}</div></div>
          {(side === 'buyer' || side === 'seller') && <div className="h5-desc-row"><div className="k">Your role</div><div className="v">{side === 'seller' ? 'Supplier side' : 'Buyer side'}</div></div>}
          <div className="h5-desc-row"><div className="k">Created</div><div className="v">{doc.createdAt} · by {doc.createdBy}</div></div>
          {doc.deliveryDate && <div className="h5-desc-row"><div className="k">Delivery Date</div><div className="v">{doc.deliveryDate}</div></div>}
          {doc.validUntil && <div className="h5-desc-row"><div className="k">Valid Until</div><div className="v">{doc.validUntil}</div></div>}
          {doc.poNo && <div className="h5-desc-row"><div className="k">Order Ref</div><div className="v mono">{doc.poNo}</div></div>}
          {/* R99q — linked documents live in the basic info as ONE-LINE rows:
              label + number text + icon actions (Print / Export / Link) all
              inline. Invoice row from 已接受 (accepted) onwards; outbound
              order + waybill rows from 已发货 (shipped) onwards. The waybill
              rides on its parent outbound doc (CK), so its actions operate
              on the CK. */}
          {doc.type === 'PO' && poFp && PO_ACCEPTED_OR_LATER.includes(doc.status) && (
            <div className="h5-desc-row">
              <div className="k">Invoice</div>
              <div className="v h5-docrow-v">
                <span className="mono" style={{ fontWeight: 600, flex: 1, minWidth: 0, wordBreak: 'break-all' }}>{poFp.no}</span>
                <div className="h5-docrow-tools">
                  <button title="Print" aria-label="Print" onClick={() => push({ name: 'print', docId: poFp.id })}><Icon name="print" size={13} /></button>
                  <button title="Export" aria-label="Export" onClick={() => setExportOpen(poFp)}><Icon name="download" size={13} /></button>
                  <button title="Link" aria-label="Link" onClick={() => setLinkOpen(poFp)}><Icon name="whatsapp" size={13} /></button>
                </div>
              </div>
            </div>
          )}
          {doc.type === 'PO' && shipCk && PO_SHIPPED_OR_LATER.includes(doc.status) && (
            <div className="h5-desc-row">
              <div className="k">Outbound Order</div>
              <div className="v h5-docrow-v">
                <span className="mono" style={{ fontWeight: 600, flex: 1, minWidth: 0, wordBreak: 'break-all' }}>{shipCk.no}</span>
                <div className="h5-docrow-tools">
                  <button title="Print" aria-label="Print" onClick={() => push({ name: 'print', docId: shipCk.id })}><Icon name="print" size={13} /></button>
                  <button title="Export" aria-label="Export" onClick={() => setExportOpen(shipCk)}><Icon name="download" size={13} /></button>
                  <button title="Link" aria-label="Link" onClick={() => setLinkOpen(shipCk)}><Icon name="whatsapp" size={13} /></button>
                </div>
              </div>
            </div>
          )}
          {doc.type === 'PO' && shipCk && shipCk.waybill && PO_SHIPPED_OR_LATER.includes(doc.status) && (
            <div className="h5-desc-row">
              <div className="k">Waybill</div>
              <div className="v h5-docrow-v">
                <span className="mono" style={{ fontWeight: 600, flex: 1, minWidth: 0, wordBreak: 'break-all' }}>{shipCk.waybill.no}</span>
                <div className="h5-docrow-tools">
                  <button title="Print" aria-label="Print" onClick={() => push({ name: 'print', docId: shipCk.id })}><Icon name="print" size={13} /></button>
                  <button title="Export" aria-label="Export" onClick={() => setExportOpen(shipCk)}><Icon name="download" size={13} /></button>
                  <button title="Link" aria-label="Link" onClick={() => setLinkOpen(shipCk)}><Icon name="whatsapp" size={13} /></button>
                </div>
              </div>
            </div>
          )}
          {doc.inquiryNo && <div className="h5-desc-row"><div className="k">Inquiry Ref</div><div className="v mono">{doc.inquiryNo}</div></div>}
          {doc.waybill && <React.Fragment>
            <div className="h5-desc-row"><div className="k">Waybill</div><div className="v mono">{doc.waybill.no}</div></div>
            <div className="h5-desc-row"><div className="k">Logistics</div><div className="v">{doc.waybill.carrier} · {doc.waybill.plate}<br />{doc.waybill.driver} · {doc.waybill.phone}</div></div>
          </React.Fragment>}
          {doc.type === 'RK' && doc.status === 'Partial Variance' && (
            <div className="h5-desc-row"><div className="k">Variance</div><div className="v" style={{ color: 'var(--warning)' }}>{doc.variance.reason}</div></div>
          )}
          <div className="h5-desc-row"><div className="k">Total</div><div className="v"><Money amount={docAmount(doc)} currency={doc.currency} /></div></div>
        </div>
      </div>
      {(doc.type === 'PO' || doc.type === 'QT') && side === 'buyer' && (
        <div className="mt12">
          <div onClick={() => setAiOpen(!aiOpen)} style={{ cursor: 'pointer' }}>
            <div className="ai-box"><div className="ai-head"><Icon name="ai" size={13} />AI Order Summary {aiOpen ? '▾' : '▸'}</div>
              {!aiOpen && <span style={{ fontSize: 12 }}>Tap to expand the AI-generated summary for confirmation</span>}
            </div>
          </div>
          {aiOpen && <div className="ai-box" style={{ marginTop: 8 }}><Icon name="ai" size={0} />{aiSummary}</div>}
        </div>
      )}
      <div className="h5-section-title">Items</div>
      <div className="h5-card">
        {doc.items.map((it, i) => {
          const prod = db.products.find(p => p.id === it.pid);
          const img = prod && prod.image;
          return (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '11px 0', borderBottom: i < doc.items.length - 1 ? '1px solid #F0F2F5' : 'none' }}>
            {img
              ? <img src={img} alt="" style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover', flexShrink: 0, alignSelf: 'center' }} />
              : <div style={{ width: 42, height: 42, borderRadius: 8, background: '#F5F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'center' }}><Icon name="box" size={16} color="var(--text-3)" /></div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>
              <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{it.spec}</div>
              {it.actualQty != null && it.actualQty !== it.qty && <div style={{ fontSize: 11.5, color: 'var(--warning)', marginTop: 2 }}>Received {it.actualQty} of {it.qty}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: 12.5 }}>{it.qty} × {doc.currency} {it.price.toLocaleString()}</div>
              <div className="mono bold" style={{ fontSize: 12.5, marginTop: 2 }}>{money(it.qty * it.price, doc.currency).text}</div>
            </div>
          </div>
          );
        })}
      </div>
      <div className="h5-section-title">Flow Timeline</div>
      <div className="h5-card">
        <Timeline items={tlAll ? doc.timeline : doc.timeline.slice(-6)} />
        {doc.timeline.length > 6 && (
          <button className="tl-more" onClick={() => setTlAll(v => !v)}>
            {tlAll
              ? <React.Fragment><Icon name="chevronDown" size={12} style={{ transform: 'rotate(180deg)' }} />{t('Show less')}</React.Fragment>
              : <React.Fragment><Icon name="chevronDown" size={12} />{t(`View all ${doc.timeline.length} records`)}</React.Fragment>}
          </button>
        )}
      </div>
      {(platform || !actions.length) && (
        <div className="h5-card" style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
          {platform ? 'Read-only — platform accounts have no write access to business data.' : 'No actions available for your role on this document.'}
        </div>
      )}
      {!platform && actions.length > 0 && (
        <div className="h5-actionbar ghost">
          {actions.map(verb => (
            <button key={verb} className={`h5-btn${['Accept', 'Approve', 'Submit', 'Quote', 'Confirm Quote', 'Place Order', 'Ship', 'Dispatch', 'Confirm Receipt', 'Create Invoice', 'Confirm Invoice', 'Record Payment', 'Re-receive', 'Replenish'].includes(verb) ? ' primary' : ['Reject', 'Cancel', 'Close', 'Terminate Receiving'].includes(verb) ? ' danger' : ''}`} onClick={() => runVerb(verb)}><Icon name={VERB_ICON[verb] || 'check'} size={14} />{verb}</button>
          ))}
        </div>
      )}
      {/* R99o — the document toolbar moved to the TOP-RIGHT of the page
          header as icon-only buttons in the order Print / Export / Link.
          The per-document (invoice / outbound order / waybill) actions live
          in the basic-info rows; this cluster is always for the doc itself. */}
      <div className="h5-topbar">
        <button className="h5-topbar-btn" title="Print" aria-label="Print" onClick={() => push({ name: 'print', docId: doc.id })}><Icon name="print" size={17} /></button>
        <button className="h5-topbar-btn" title="Export" aria-label="Export" onClick={() => setExportOpen(doc)}><Icon name="download" size={17} /></button>
        <button className="h5-topbar-btn" title="Link" aria-label="Link" onClick={() => setLinkOpen(doc)}><Icon name="whatsapp" size={17} /></button>
      </div>
      {exportOpen && <H5ExportSheet doc={exportOpen} onClose={() => setExportOpen(null)} />}
      {linkOpen && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(23,35,47,0.5)', zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 16, paddingBottom: 40 }} onClick={() => setLinkOpen(null)}>
          <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', animation: 'slideIn 0.2s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #F0F2F5' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>WhatsApp Document Link</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Copy the link below and open it in a new tab — no login required (demo).</div>
              <div className="mono" style={{ fontSize: 11, background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', marginTop: 10, wordBreak: 'break-all' }}>{demoLink}</div>
            </div>
            <div style={{ display: 'flex' }}>
              <button className="h5-btn" style={{ borderRadius: 0, border: 'none', borderRight: '1px solid #F0F2F5', height: 48 }} onClick={() => setLinkOpen(null)}><Icon name="close" size={14} />Close</button>
              <button className="h5-btn primary" style={{ borderRadius: 0, border: 'none', height: 48 }} onClick={() => {
                try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(demoLink).catch(function () { /* clipboard permission denied (common in embedded webviews); the URL is shown above */ }); } } catch (e) { /* clipboard API unavailable; the URL is shown above */ }
                toast('Link copied — open in a new tab to preview the login-free view', 'success');
                setLinkOpen(false);
              }}><Icon name="link" size={14} />Copy Link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- WhatsApp viewer (no-login) ----------
function H5WhatsAppPage({ docId, push, setConfirm, platform, noPerm }) {
  const { db, act, toast } = useApp();
  const doc = db.docs.find(d => d.id === docId);
  if (!doc) return null;
  const canConfirm = doc.type === 'CK' && doc.status === 'Shipped';
  return (
    <div className="h5-pad">
      <div className="h5-wa-banner">
        <Icon name="whatsapp" size={20} />
        <div><b>Opened from a WhatsApp link</b> — login-free document view. One-tap confirmation is available for shipments awaiting your receipt.</div>
      </div>
      <div className="h5-card" style={{ background: '#FFF9E8', border: '1px dashed #E4CE8E', textAlign: 'center', fontSize: 11.5, color: '#96601A' }}>Demo simulation · actual link arrives via WhatsApp message</div>
      <div className="h5-card mt12">
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{doc.no}</span>
          <StatusTag type={doc.type} status={doc.status} />
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{doc.items.length} items · {money(docAmount(doc), doc.currency).full}</div>
        {doc.waybill && <div className="muted mono" style={{ fontSize: 11.5, marginTop: 4 }}>Waybill {doc.waybill.no} · {doc.waybill.carrier} · {doc.waybill.plate}</div>}
      </div>
      <div className="h5-section-title">Items</div>
      <div className="h5-card">
        {doc.items.map((it, i) => {
          const prod = db.products.find(p => p.id === it.pid);
          const img = prod && prod.image;
          return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < doc.items.length - 1 ? '1px solid #F0F2F5' : 'none', fontSize: 13 }}>
            {img
              ? <img src={img} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 38, height: 38, borderRadius: 8, background: '#F5F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="box" size={15} color="var(--text-3)" /></div>}
            <span style={{ flex: 1, minWidth: 0 }}>{it.name}</span><span className="mono muted">{it.qty} {it.unit}</span>
          </div>
          );
        })}
      </div>
      {canConfirm ? (
        <div className="h5-actionbar">
          <button className="h5-btn" onClick={() => setConfirm({
            title: 'Confirm Receipt', message: `Confirm full receipt of ${doc.no}? Stock will increase and the inbound record will be generated.`,
            confirmText: 'Confirm', onConfirm: () => act.receive(doc, 'accept', null, ''),
          })}><Icon name="checkDouble" size={14} />Confirm Receipt</button>
          <button className="h5-btn primary" onClick={() => push({ name: 'receive', docId: doc.id })}><Icon name="eye" size={14} />Inspect Details</button>
        </div>
      ) : (
        <div className="h5-card" style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>View-only document — no confirmation required at this stage.</div>
      )}
    </div>
  );
}

// ---------- simulated WhatsApp conversation (inquiry submission) ----------
// Demo of the WhatsApp-first supply workflow: submitting an inquiry "pushes"
// it to the supplier's WhatsApp number and lands the buyer in this chat view.
// The supplier proposes prices, the buyer negotiates (quick-reply chips or
// free text), then the supplier confirms and pushes the quotation link back
// here. All replies are simulated — no real message leaves the prototype.
function H5WhatsAppChatPage({ docId, push }) {
  const { db, act } = useApp();
  const doc = db.docs.find(d => d.id === docId);
  const supplier = doc ? db.tenants.find(t => t.id === doc.seller) : null;
  const hhmm = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const totalFor = (d) => doc ? doc.items.reduce((s, it) => s + it.qty * it.price * (1 - d), 0) : 0;
  const offerLines = (d) => doc ? [
    'Here is our best offer:',
    ...doc.items.map(it => `• ${it.name} × ${it.qty} ${it.unit} — ${money(it.price * (1 - d), doc.currency).text} / ${it.unit}`),
    `Total ${money(totalFor(d), doc.currency).full} · valid for 7 days`,
  ] : [];
  const CHIPS_STD = [
    { key: 'ok', label: 'Prices work — please send the quotation' },
    { key: 'nego', label: 'Could you do better on the price?' },
  ];
  const CHIPS_FINAL = [
    { key: 'ok', label: 'Confirmed — please send the quotation.' },
    { key: 'no', label: 'Not for now, thank you.' },
  ];
  const [msgs, setMsgs] = useState(() => doc ? [{ me: true, ts: hhmm(), lines: [
    'Hello! We would like to request a quotation for the following items:',
    `Inquiry ${doc.no} — ${doc.items.length} items`,
    ...doc.items.map(it => `• ${it.name} × ${it.qty} ${it.unit}`),
    `Est. total ${money(docAmount(doc), doc.currency).full} · Delivery by ${doc.deliveryDate || 'TBC'}`,
    'Please share your best price. Thank you!',
  ] }] : []);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState('');
  const [chips, setChips] = useState(null);
  const [disc, setDisc] = useState(0);
  const [done, setDone] = useState(false);
  const pushMsg = (me, lines) => setMsgs(m => [...m, { me, ts: hhmm(), lines }]);
  const supplierSay = (lines, delay, after) => {
    setTyping(true);
    setTimeout(() => { setTyping(false); setMsgs(m => [...m, { me: false, ts: hhmm(), lines }]); if (after) after(); }, delay);
  };
  useEffect(() => {
    if (!doc) return;
    const t1 = setTimeout(() => setTyping(true), 1200);
    const t2 = setTimeout(() => { setTyping(false); pushMsg(false, [
      'Hello! Thank you — we have received your inquiry.',
      'Our team is preparing the quotation and will send it back here shortly. You can also track the status in the app.',
    ] ); }, 3400);
    const t3 = setTimeout(() => setTyping(true), 5600);
    const t4 = setTimeout(() => { setTyping(false); setMsgs(m => [...m, { me: false, ts: hhmm(), lines: offerLines(0) }]); setChips(CHIPS_STD); }, 8000);
    return () => { [t1, t2, t3, t4].forEach(clearTimeout); };
  }, []);
  // supplier counter-offer: first negotiation → 5% off, second → final 8% off
  const counter = (d) => {
    const next = d === 0 ? 0.05 : 0.08;
    setDisc(next);
    supplierSay([
      d === 0 ? 'As a valued partner, we can offer a 5% discount on this order.' : 'We can stretch to 8% off — this is our best final price.',
      ...offerLines(next),
    ], 2000, () => setChips(next >= 0.08 ? CHIPS_FINAL : CHIPS_STD));
  };
  // buyer confirms → supplier generates + confirms the quote and pushes the link
  const confirmQuote = () => {
    setChips(null);
    pushMsg(true, ['Confirmed — please send the quotation.']);
    supplierSay(['Great! Generating the official quotation now…'], 1500, () => {
      const created = act.waAutoQuote(doc, disc);
      if (created) {
        // AI creates the draft → the supplier confirms it with one tap → link is pushed
        supplierSay(['Our AI engine drafted the quotation — confirming it with one tap…'], 1400, () => {
          const sent = act.docVerb('Confirm Quote', created);
          const qt = sent || created;
          setMsgs(m => [...m,
            { me: false, ts: hhmm(), lines: ['Quotation confirmed. Here is the link:'] },
            { me: false, ts: hhmm(), quote: { no: qt.no, docId: qt.id, total: money(docAmount(qt), qt.currency).full, valid: qt.validUntil } },
          ]);
          setDone(true);
        });
      }
    });
  };
  const decline = () => {
    setChips(null);
    pushMsg(true, ['Not for now, thank you.']);
    supplierSay(['No problem — the offer stands for 7 days whenever you need it.'], 1600);
    setDone(true);
  };
  const onChip = (key) => {
    if (key === 'ok') return confirmQuote();
    if (key === 'no') return decline();
    setChips(null);
    pushMsg(true, ['Could you do better on the price?']);
    counter(disc);
  };
  const send = () => {
    const text = input.trim();
    if (!text) return;
    pushMsg(true, [text]);
    setInput('');
    if (chips) { setChips(null); counter(disc); return; } // free text during the offer counts as negotiation
    supplierSay([done ? 'Thank you — we will get back to you shortly.' : 'Let me confirm the details and get back to you with our best offer.'], 2000);
  };
  if (!doc || !supplier) return <div className="h5-pad muted">Loading conversation…</div>;
  return (
    <div className="wa-chat">
      <div className="wa-chat-head">
        <span className="wa-avatar">{supplier.name[0]}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{supplier.name}</div>
          <div style={{ color: '#B8D8D0', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
            {typing ? <span className="wa-typing-text">typing…</span> : <React.Fragment><span className="wa-online-dot" />online</React.Fragment>}
          </div>
        </div>
        <Icon name="whatsapp" size={18} color="#fff" />
      </div>
      <div className="wa-banner-mini"><Icon name="info" size={12} /> Demo simulation — inquiry pushed to the supplier's WhatsApp; replies are simulated.</div>
      <div className="wa-chat-body">
        <div className="wa-day">Today</div>
        {msgs.map((m, i) => (
          <div key={i} className={`wa-row${m.me ? ' me' : ''}`}>
            {m.quote ? (
              <div className="wa-bubble wa-quote-card" onClick={() => push({ name: 'doc', docId: m.quote.docId })}>
                <div className="wa-qc-title"><Icon name="file" size={14} /> {m.quote.no}</div>
                <div className="wa-qc-sub">Quotation · {m.quote.total} · valid until {m.quote.valid}</div>
                <div className="wa-qc-link">Tap to view the quotation <Icon name="chevronRight" size={11} /></div>
              </div>
            ) : (
              <div className="wa-bubble">
                {m.lines.map((l, j) => <div key={j} style={m.lines.length > 1 && j === 0 ? { fontWeight: 600, marginBottom: 3 } : null}>{l}</div>)}
                <div className="wa-meta">{m.ts}{m.me && <Icon name="checkDouble" size={12} color="#53BDEB" />}</div>
              </div>
            )}
          </div>
        ))}
        {typing && <div className="wa-row"><div className="wa-bubble wa-typing"><span /><span /><span /></div></div>}
      </div>
      {chips && (
        <div className="wa-chips">
          {chips.map(c => <button key={c.key} className="wa-chip" onClick={() => onChip(c.key)}>{c.label}</button>)}
        </div>
      )}
      <div className="wa-input-bar">
        <input className="wa-input" value={input} onChange={e => setInput(e.target.value)}
          placeholder="Type a message" onKeyDown={e => { if (e.key === 'Enter') send(); }} />
        <button className="wa-send" onClick={send} title="Send"><Icon name="whatsapp" size={16} color="#fff" />Send</button>
      </div>
    </div>
  );
}

// ---------- new inquiry / order form ----------
function H5DocFormPage({ mode, initialItems, onDone, push }) {
  const { db, account, act, toast } = useApp();
  const isIQ = mode === 'IQ';
  // inquiries & purchases go to upstream tenants only (supplier / parent agents) —
  // own and downstream tenants never appear as the seller
  const suppliers = [...upstreamTenantIds(db, account.tenantId)]
    .map(id => db.tenants.find(t => t.id === id)).filter(t => t && t.status === 'Active');
  // default seller follows the owner of the first pre-filled product
  const firstPid = initialItems && initialItems.length ? initialItems[0] : null;
  const firstOwner = firstPid ? (db.products.find(p => p.id === firstPid) || {}).ownerId : null;
  const defaultSeller = (suppliers.some(s => s.id === firstOwner) ? firstOwner : '') || (suppliers[0] || {}).id || '';
  const [seller, setSeller] = useState(defaultSeller);
  const [date, setDate] = useState('');
  // pre-filled from the product list / product detail — quantities default to 1
  const [items, setItems] = useState(
    initialItems && initialItems.length
      ? initialItems.map(pid => ({ pid: pid, qty: 1 }))
      : [{ pid: (db.products.find(p => suppliers.some(s => s.id === p.ownerId)) || db.products[0] || {}).id || '', qty: '' }]
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const save = (submit) => {
    const errs = {};
    if (!seller) errs.seller = 'Select a supplier';
    if (!date) errs.date = 'Required';
    if (items.some(it => !it.qty || Number(it.qty) <= 0)) errs.qty = 'Enter quantities';
    setErrors(errs);
    if (Object.keys(errs).length) { toast('Please complete the required fields', 'error'); return; }
    // MVP #19 — validate available stock before submitting an order
    if (!isIQ && submit) {
      const short = items.filter(it => { const avail = ifnull((db.stock[seller] || {})[it.pid], 0); return Number(it.qty) > avail; });
      if (short.length) { const sp0 = db.products.find(pp => pp.id === short[0].pid) || {}; toast(`Stock check failed — ${short[0].qty} requested, supplier has ${ifnull((db.stock[seller] || {})[short[0].pid], 0)}${sp0.unit ? ' ' + t(sp0.unit) : ''} of ${short[0].name}`, 'error'); return; }
    }
    if (isIQ) {
      const saved = act.saveInquiry({ seller, deliveryDate: date, items: items.map(it => ({ ...it, ...db.products.find(p => p.id === it.pid) })) }, submit);
      // submitted inquiries jump to the simulated WhatsApp conversation (demo of
      // the WhatsApp-first supply workflow) — drafts simply return to the list
      if (submit && saved) { onDone(); push({ name: 'waChat', docId: saved.id }); return; }
    }
    else act.savePO({ seller, deliveryDate: date, items: items.map(it => ({ ...it, ...db.products.find(p => p.id === it.pid) })) }, submit);
    onDone();
  };
  return (
    <div className="h5-pad">
      <div className="h5-card">
        <div className="h5-desc">
          <div className="h5-desc-row"><div className="k">Supplier</div><div className="v">
            <Select value={seller} onChange={setSeller} options={suppliers.map(t => ({ value: t.id, label: t.name }))} style={{ height: 30 }} />
          </div></div>
          <div className="h5-desc-row"><div className="k">Warehouse</div><div className="v muted">Default Warehouse</div></div>
          <div className="h5-desc-row"><div className="k">Delivery Date</div><div className="v">
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ height: 30 }} />
            {errors.date && <div className="field-error">{errors.date}</div>}
          </div></div>
        </div>
      </div>
      <div className="h5-section-title">Items {errors.qty && <span style={{ color: 'var(--danger)' }}>· {errors.qty}</span>}</div>
      {!isIQ && (
        <div className="h5-card muted" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
          <Icon name="shield" size={12} /> Availability &amp; price compliance are validated against the supplier's stock and catalog; the agency chain is recorded on the order.
        </div>
      )}
      {items.map((it, i) => {
        const prod = db.products.find(p => p.id === it.pid);
        const sellerStock = (db.stock[seller] || {})[it.pid];
        const su = (prod || {}).unit;
        const short = !isIQ && Number(it.qty) > 0 && sellerStock != null && Number(it.qty) > sellerStock;
        return (
        <div key={i} className="h5-card flex gap10">
          <img src={(prod || {}).image} alt="" style={{ width: 46, height: 46, borderRadius: 8, objectFit: 'cover' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{(prod || {}).name}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Supplier stock: <b className="mono" style={{ color: short ? 'var(--danger)' : undefined }}>{sellerStock == null ? '—' : <React.Fragment>{sellerStock} {su}</React.Fragment>}</b>{short && <span style={{ color: 'var(--danger)' }}> · exceeds availability</span>}</div>
            <div className="flex gap8 mt8" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
              <input className="input" type="number" placeholder="Qty" value={it.qty} style={{ height: 30, width: 90, flexShrink: 0 }}
                onChange={e => setItems(items.map((x, j) => i === j ? { ...x, qty: e.target.value } : x))} />
              <button className="h5-item-act danger" style={{ marginLeft: 'auto' }} onClick={() => items.length > 1 && setItems(items.filter((_, j) => j !== i))}><Icon name="trash" size={12} />Remove</button>
            </div>
          </div>
        </div>
        );
      })}
      <button className="btn block" onClick={() => setPickerOpen(true)}><Icon name="plus" size={13} />Choose Products</button>
      <div className="flex gap10 mt16">
        {/* R86 — orders have no Draft stage (born at 待接收); inquiries keep drafts */}
        {isIQ && <button className="h5-btn" style={{ flex: 1 }} onClick={() => save(false)}><Icon name="file" size={14} />Save Draft</button>}
        <button className="h5-btn primary" style={{ flex: 1 }} onClick={() => save(true)}><Icon name="check" size={14} />{isIQ ? 'Submit Inquiry' : 'Submit Order'}</button>
      </div>
      <div className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: 12 }}>Full form features (multi-line pricing, validation details) are also available in the Web console</div>
      {pickerOpen && (
        <H5ProductPicker
          products={db.products}
          existingPids={items.map(it => it.pid)}
          canPick={p => suppliers.some(s => s.id === p.ownerId)}
          lockedNote={p => (p.ownerId === account.tenantId ? 'Own product' : 'Downstream product')}
          onClose={() => setPickerOpen(false)}
          onAdd={pids => {
            setItems(prev => [...prev, ...pids.filter(pid => !prev.some(it => it.pid === pid)).map(pid => ({ pid: pid, qty: 1 }))]);
            setPickerOpen(false);
            toast(pids.length + (pids.length === 1 ? ' product added · qty defaults to 1' : ' products added · qty defaults to 1'), 'success');
          }}
        />
      )}
    </div>
  );
}

// ---------- full-screen product picker (inquiry form) ----------
// canPick(p) — tenant-boundary gate (upstream-owned products only);
// lockedNote(p) — short reason label rendered on locked rows
function H5ProductPicker({ products, existingPids, onClose, onAdd, canPick, lockedNote }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState([]);
  const rows = products.filter(p => !q || (p.name + p.model + p.brand).toLowerCase().includes(q.toLowerCase()));
  const toggle = (id) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 300, background: 'var(--bg)', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.22s ease' }}>
      <div className="h5-header">
        <div className="h5-side"><span className="h5-back" onClick={onClose}><Icon name="arrowLeft" size={20} /></span></div>
        <div className="h5-title">Select Products</div>
        <div className="h5-side right"></div>
      </div>
      <div style={{ padding: '10px 12px', background: '#fff', borderBottom: '1px solid var(--border-light)' }}>
        <div className="search-box" style={{ flex: 1 }}>
          <Icon name="search" size={14} />
          <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search products" />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {rows.map(p => {
          const added = existingPids.includes(p.id);
          const on = sel.includes(p.id);
          const locked = canPick ? !canPick(p) : false;
          return (
            <div key={p.id} className="h5-product" style={added || locked ? { opacity: 0.5, cursor: 'default' } : undefined} onClick={() => { if (!added && !locked) toggle(p.id); }}>
              <div className="p-main">
              <span className={`checkbox${on ? ' on' : ''}`} style={{ flexShrink: 0, alignSelf: 'center', opacity: locked ? 0.35 : 1 }}><Icon name={locked ? 'lock' : 'check'} size={11} /></span>
              <img src={prodImg(p)} alt={p.name} />
              <div className="p-body">
                <div className="p-name">{p.name}</div>
                <div className="p-spec mono">{p.model} · {p.spec}</div>
                <div className="flex" style={{ justifyContent: 'space-between', marginTop: 6, alignItems: 'center' }}>
                  <div className="p-price"><span className="cur">{p.currency}</span>{' '}{money(p.price, p.currency).num}</div>
                  {added && <span className="muted" style={{ fontSize: 11 }}>Already added</span>}
                  {locked && <span className="muted" style={{ fontSize: 11 }}>{lockedNote ? lockedNote(p) : 'Not available'}</span>}
                </div>
              </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <H5Empty icon="search" message="No products match the search" />}
      </div>
      {/* R100b — picker footer: floating card (12px gap to the frame bottom, same
          rhythm as the sticky detail bars), statically positioned — the overlay
          is a flex column, the bar is already the last child */}
      <div className="h5-actionbar" style={{ position: 'static' }}>
        <button className="h5-btn" onClick={onClose}><Icon name="close" size={14} />Cancel</button>
        <button className="h5-btn primary" disabled={!sel.length} onClick={() => onAdd(sel)}><Icon name="plus" size={14} />Add{sel.length ? ` (${sel.length})` : ''}</button>
      </div>
    </div>
  );
}

// ---------- receive page ----------
function H5ReceivePage({ ckId, onDone }) {
  const { db, act, toast } = useApp();
  const ck = db.docs.find(d => d.id === ckId);
  const [mode, setMode] = useState('accept');
  const [qtys, setQtys] = useState(() => Object.fromEntries(ck.items.map(it => [it.pid, String(it.qty)])));
  const [reason, setReason] = useState('');
  // R97 — result drives the qty inputs:
  //   accept  → received = ordered, read-only
  //   partial → received defaults to 0, editable within [0, ordered]
  //   reject  → received = 0, read-only
  const pickMode = (v) => {
    setMode(v);
    setQtys(Object.fromEntries(ck.items.map(it => [it.pid, v === 'accept' ? String(it.qty) : '0'])));
  };
  if (!ck) return null;
  return (
    <div className="h5-pad">
      <div className="h5-card">
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{ck.no}</span>
          <StatusTag type="CK" status={ck.status} />
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>From {tenantName(db, ck.seller)} · {ck.items.length} items</div>
      </div>
      <div className="h5-section-title mt12">Result</div>
      <div className="h5-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[['accept', 'Accept — all items match'], ['partial', 'Partial receipt'], ['reject', 'Reject shipment']].map(([v, label]) => (
          <span key={v} className={`radio-opt${mode === v ? ' on' : ''}`} onClick={() => pickMode(v)}>
            <span className="radio-dot"></span>{label}
          </span>
        ))}
      </div>
      <div className="h5-section-title mt12">Actually Received</div>
      <div className="h5-card">
        {ck.items.map((it, i) => {
          const prod = db.products.find(p => p.id === it.pid);
          return (
          <div key={it.pid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < ck.items.length - 1 ? '1px solid #F0F2F5' : 'none' }}>
            <img src={prodImg(prod)} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>Ordered: {it.qty}</div>
            </div>
            <input className="input" type="number" value={mode === 'partial' ? qtys[it.pid] : (mode === 'accept' ? String(it.qty) : '0')} disabled={mode !== 'partial'}
              onChange={e => setQtys(s => ({ ...s, [it.pid]: e.target.value }))} style={{ height: 32, width: 84 }} />
          </div>
          );
        })}
      </div>
      {mode !== 'accept' && (
        <div className="mt12">
          <div className="h5-section-title">Variance Reason</div>
          <div className="h5-card">
            <textarea className="textarea" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. damaged in transit" style={{ border: 'none', padding: 0 }}></textarea>
          </div>
        </div>
      )}
      <button className="h5-btn primary mt16" style={{ width: '100%' }} onClick={() => {
        if (mode !== 'accept' && !reason.trim()) { toast('Variance reason is required', 'error'); return; }
        if (mode === 'partial') {
          for (const it of ck.items) {
            const n = Number(qtys[it.pid]);
            if (qtys[it.pid] === '' || isNaN(n) || n < 0 || n > it.qty) { toast('Received quantity must be between 0 and the ordered quantity', 'error'); return; }
          }
        }
        act.receive(ck, mode, qtys, reason);
        onDone();
      }}><Icon name="checkDouble" size={14} />Confirm Receiving</button>
    </div>
  );
}

// ---------- ship page ----------
function H5ShipPage({ poId, onDone }) {
  const { db, act, toast } = useApp();
  const po = db.docs.find(d => d.id === poId);
  const [w, setW] = useState({ carrier: '', plate: '', driver: '', phone: '' });
  if (!po) return null;
  return (
    <div className="h5-pad">
      <div className="h5-card">
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{po.no}</span>
          <StatusTag type="PO" status={po.status} />
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>To {tenantName(db, po.buyer)} · {po.items.length} items · {money(docAmount(po), po.currency).full}</div>
      </div>
      <div className="h5-section-title">Logistics Information</div>
      <div className="h5-card">
        {[['carrier', 'Carrier', 'e.g. Swift Cargo'], ['plate', 'Vehicle Plate', 'e.g. LAG-772-XA'], ['driver', 'Driver', 'e.g. Emeka Obi'], ['phone', 'Driver Phone', '+234 ...']].map(([k, label, ph]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #F0F2F5' }}>
            <span className="muted" style={{ fontSize: 12.5, width: 96 }}>{label}</span>
            <input className="input" value={w[k]} onChange={e => setW(s => ({ ...s, [k]: e.target.value }))} placeholder={ph} style={{ height: 32 }} />
          </div>
        ))}
      </div>
      <button className="btn block mt12" onClick={() => setW({ carrier: 'Swift Cargo', plate: 'LAG-889-XB', driver: 'Uche Nwankwo', phone: '+234 809 112 3344' })}><Icon name="ai" size={13} />Fill demo logistics</button>
      <button className="h5-btn primary mt12" style={{ width: '100%' }} onClick={() => {
        if (!w.carrier || !w.driver) { toast('Carrier and driver are required', 'error'); return; }
        act.ship(po, w);
        onDone();
      }}><Icon name="truck" size={14} />Confirm Shipment</button>
      <div className="muted" style={{ fontSize: 11, marginTop: 10, textAlign: 'center' }}>Shipment decrements stock, generates CK + waybill, and pushes a WhatsApp link to the buyer</div>
    </div>
  );
}

// ---------- product page ----------
function H5ProductPage({ productId, push, platform }) {
  const { db, account, toast, cartApi } = useApp();
  const p = db.products.find(x => x.id === productId);
  const stock = ifnull((db.stock[account.tenantId] || {})[p.id], '—');
  const tenant = account.tenantId ? db.tenants.find(t => t.id === account.tenantId) : null;
  const upstream = !account.tenantId ? [] : [...upstreamTenantIds(db, account.tenantId)]
    .map(id => db.tenants.find(t => t.id === id)).filter(t => t && t.status === 'Active');
  const canInquire = !platform && !(tenant && tenant.type === 'Supplier') && upstream.length > 0;
  const canManage = !platform;
  // tenant boundary — inquire upstream-owned products; adjust price / stock on own products
  const inqOk = canInquire && canInquireProduct(db, account, p);
  const mgrOk = canManage && canManageProduct(db, account, p);
  const hasActions = inqOk || mgrOk;
  // R76 — cost price is the owner's procurement record: visible on My Products
  // (own catalog) only; Sourcing Channel / platform views see market + sale only
  const showCost = p.ownerId === account.tenantId;
  return (
    <div className="h5-pad">
      <div className="h5-card" style={{ padding: 0, overflow: 'hidden' }}>
        <img src={prodImg(p)} alt={p.name} style={{ width: '100%', height: 200, objectFit: 'cover' }} />
        <div style={{ padding: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{p.name}</div>
          <div className="flex gap8 mt8" style={{ flexWrap: 'wrap' }}>
            {p.categories.map(cid => { const c = db.categories.find(x => x.id === cid); return c ? <Tag key={cid} tone="info">{t(c.name)}</Tag> : null; })}
          </div>
        </div>
      </div>
      <div className="h5-section-title">Prices</div>
      <div className="h5-desc">
        {showCost && <div className="h5-desc-row"><div className="k">Cost Price</div><div className="v mono bold">{money(ifnull(p.cost, p.price), p.currency).text}</div></div>}
        <div className="h5-desc-row"><div className="k">Market Reference Price</div><div className="v mono bold">{money(ifnull(p.marketPrice, p.price), marketCurOf(p)).text}</div></div>
        <div className="h5-desc-row"><div className="k">Channel Sales Price</div><div className="v mono bold" style={{ color: '#D35400' }}>{money(p.price, p.currency).text}</div></div>
      </div>
      <div className="h5-desc mt12">
        <div className="h5-desc-row"><div className="k">Model</div><div className="v mono">{p.model}</div></div>
        <div className="h5-desc-row"><div className="k">Brand</div><div className="v">{p.brand}</div></div>
        <div className="h5-desc-row"><div className="k">Specification</div><div className="v">{p.spec}</div></div>
        <div className="h5-desc-row"><div className="k">Unit</div><div className="v">{p.unit}</div></div>
        <div className="h5-desc-row"><div className="k">Owner</div><div className="v">{productOwnerName(db, p)}{p.ownerId === account.tenantId && <React.Fragment> · <Tag tone="teal" dot>Ours</Tag></React.Fragment>}</div></div>
        <div className="h5-desc-row"><div className="k">My Stock</div><div className="v mono bold">{stock === '—' ? '—' : <React.Fragment>{stock} {p.unit}</React.Fragment>}</div></div>
        <div className="h5-desc-row"><div className="k">Status</div><div className="v"><Tag tone={p.onSale === false ? 'dark' : 'teal'} dot>{p.onSale === false ? 'Discontinued' : 'On Sale'}</Tag></div></div>
      </div>
      {hasActions && (
        <div className="h5-act-row">
          {/* 询价 = 加入询价暂存（数量默认 1，已在车中则 +1） */}
          {inqOk && <button className="h5-btn primary" onClick={() => { cartApi.add('inquiry', { pid: p.id, qty: 1 }); toast(`${p.name} added to the inquiry staging`, 'success'); }}><Icon name="edit" size={14} />{t('Inquire')}</button>}
          {mgrOk && <button className="h5-btn" onClick={() => push({ name: 'adjustPrice', productId: p.id })}><Icon name="tag" size={14} />{t('Adjust Price')}</button>}
          {/* 调整库存拆分：入库/出库加入对应暂存 */}
          {mgrOk && <button className="h5-btn" onClick={() => { cartApi.add('inbound', { kind: 'exist', pid: p.id, qty: 1 }); toast(`${p.name} added to the inbound staging`, 'success'); }}><Icon name="download" size={14} />{t('Stock In')}</button>}
          {mgrOk && <button className="h5-btn" onClick={() => { cartApi.add('outbound', { pid: p.id, qty: 1 }); toast(`${p.name} added to the outbound staging`, 'success'); }}><Icon name="truck" size={14} />{t('Stock Out')}</button>}
          {mgrOk && <button className="h5-btn" onClick={() => push({ name: 'channelStock', productId: p.id })}><Icon name="eye" size={14} />{t('View Stock')}</button>}
        </div>
      )}
      {(canInquire || canManage) && !inqOk && !mgrOk && (
        <div className="h5-card muted" style={{ fontSize: 11.5, lineHeight: 1.6, marginTop: 12 }}>
          <Icon name="lock" size={12} /> {`Owned by ${productOwnerName(db, p)} — you can inquire upstream products and stock in / out your own products only.`}
        </div>
      )}
    </div>
  );
}

// ---------- guide ----------
function H5GuidePage() {
  const rules = [
    ['Flattened permissions', 'No roles in MVP — every account shares the same action set.'],
    ['Personal data scope', 'You see your own records by default; business partners see shared documents.'],
    ['Tenant isolation', 'Suppliers see downstream agents; agents see themselves and sub-agents; unrelated tenants are invisible.'],
    ['Platform read-only', 'Platform accounts view business data but cannot act on it.'],
    ['Actions follow business side', 'Buyers inquire, order and receive; suppliers quote, ship and invoice.'],
    ['WhatsApp-first', 'Push links open login-free document views with one-tap confirmation.'],
  ];
  return (
    <div className="h5-pad">
      <div className="h5-card" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: '#fff', border: 'none' }}>
        <Icon name="shield" size={22} />
        <div style={{ fontWeight: 700, fontSize: 15, marginTop: 8 }}>MVP Permission Rules</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>How this prototype demonstrates permission differences across accounts</div>
      </div>
      <div className="h5-section-title">Rules</div>
      {rules.map((r, i) => (
        <div key={i} className="h5-card" style={{ marginBottom: 8 }}>
          <div className="flex gap8"><span className="n" style={{ width: 20, height: 20, borderRadius: 10, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
            <div><b style={{ fontSize: 13 }}>{r[0]}</b><div className="muted" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.55 }}>{r[1]}</div></div>
          </div>
        </div>
      ))}
      <div className="h5-section-title">Try it</div>
      <div className="h5-card" style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--text-2)' }}>
        Switch accounts in <b>Mine</b>, then compare Home quick actions, visible documents and action buttons. Replay the WhatsApp flow from the Home notifications feed.
      </div>
    </div>
  );
}

Object.assign(window, { MobileStage, MobileApp });
