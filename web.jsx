// ============================================================
// web.jsx — Web console (Element Plus style)
// ============================================================

const { useState, useEffect, useMemo } = React;

// round 56 — icon mapping for web document action verbs (icon+text buttons)
const WEB_VERB_ICON = { Accept: 'check', Approve: 'check', Submit: 'check', Quote: 'quote', 'Confirm Quote': 'confirm', 'Place Order': 'orders', Ship: 'stockOut', Dispatch: 'stockOut', 'Confirm Receipt': 'receive', 'Create Invoice': 'invoices', 'Confirm Invoice': 'confirm', 'Record Payment': 'invoices', 'Start Picking': 'stockOut', Reject: 'close', Cancel: 'close', Close: 'close', Delete: 'trash', Print: 'print', Export: 'download', 'Re-receive': 'receive', 'Replenish': 'stockOut', 'Terminate Receiving': 'close' };

// ---------- menus ----------
const WEB_MENU = {
  tenant: [
    { id: 'products', label: 'Products', icon: 'box', children: [
      { id: 'product-list', label: 'Product List' },
      { id: 'categories', label: 'Categories' },
    ]},
    { id: 'purchase', label: 'Purchase', icon: 'cart', children: [
      { id: 'inquiry', label: 'Inquiries' },
      { id: 'quote', label: 'Quotes' },
      { id: 'po', label: 'Purchase Orders' },
    ]},
    { id: 'warehouse', label: 'Warehouse', icon: 'warehouse', children: [
      { id: 'inventory', label: 'Inventory' },
      { id: 'movements', label: 'Stock Movements' },
      { id: 'outbound', label: 'Outbound' },
      { id: 'receiving', label: 'Receiving' },
    ]},
    { id: 'documents', label: 'Documents', icon: 'file', children: [
      { id: 'doccenter', label: 'Document Center' },
    ]},
    { id: 'invoices', label: 'Invoices', icon: 'receipt', children: [
      { id: 'invoice', label: 'Invoices' },
    ]},
    { id: 'accounts', label: 'Accounts', icon: 'users', children: [
      { id: 'team-mgmt', label: 'Team' },
      { id: 'distributor-mgmt', label: 'Distributors' },
    ]},
    { id: 'settings', label: 'Settings', icon: 'file', children: [
      { id: 'settings', label: 'System Settings' },
    ]},
  ],
  platform: [
    { id: 'merchants', label: 'Merchants', icon: 'building', children: [
      { id: 'merchant-mgmt', label: 'Merchants & Relations' },
    ]},
    { id: 'accounts', label: 'Accounts', icon: 'users', children: [
      { id: 'account-mgmt', label: 'Accounts' },
    ]},
    { id: 'documents', label: 'Documents', icon: 'file', children: [
      { id: 'doccenter', label: 'Document Center' },
    ]},
  ],
};

function firstPage(type) { return WEB_MENU[type][0].children[0].id; }

// QA #13/#14 — shared role helper: 'platform' | 'supplier' | 'agent' (L1) | 'sub' (sub-distributor)
function tenantRole(db, account, tenant) {
  if (account.type === 'platform') return 'platform';
  if (!tenant || tenant.type === 'Supplier') return 'supplier';
  const upstream = db.relations.find(r => r.downstream === tenant.id);
  const upstreamTenant = upstream ? db.tenants.find(x => x.id === upstream.upstream) : null;
  if (tenant.maxLevel === 1 && upstreamTenant && upstreamTenant.type === 'Agent') return 'sub';
  return 'agent';
}

// QA P2-3 — tenant-side permissions are flattened (no role system in MVP), so
// purchase (inquiries / quotes / purchase orders) is a tenant-side generic
// capability: suppliers, L1 agents and sub-distributors all keep the full
// menu. Invoices stay for agents — they are the buyer of supplier-issued FPs
// and the seller of downstream FPs (auto-issued after fulfillment).
function webMenuFor(account, tenant, db) {
  return WEB_MENU[account.type];
}

// QA P2-4 — shared role label mapping so H5 and the Web console render the
// same account role wording (Sub-Distributor / Agent / Supplier / Platform
// Admin), instead of the raw tenant.type or the internal role key.
const ROLE_LABELS = { platform: 'Platform Admin', supplier: 'Supplier', agent: 'Agent', sub: 'Sub-Distributor' };
// R03 — a level label set by the upstream merchant wins over the built-in role
// wording; the built-in map stays as the fallback when no label was set.
// levelLabel is DISPLAY-ONLY: maxLevel stays the single source for permission
// inference (tenantRole), so renaming a level never changes any permission.
function tenantRoleLabel(db, account, tenant) {
  if (tenant && tenant.levelLabel) return tenant.levelLabel;
  return ROLE_LABELS[tenantRole(db, account, tenant)] || tenantRole(db, account, tenant);
}

// ---------- account switcher ----------
function AccountSwitcher() {
  const { db, account, switchAccount, tenant } = useApp();
  const initials = account.name.split(' ').map(w => w[0]).slice(0, 2).join('');
  const isPlatform = account.type === 'platform';
  const groups = {};
  if (isPlatform) {
    // platform admins hold a global read-only view — the switcher lists every
    // demo account grouped by tenant so they can jump into any tenant's view
    groups['Platform'] = db.accounts.filter(a => a.type === 'platform');
    db.tenants.forEach(t => {
      const accs = db.accounts.filter(a => a.type === 'tenant' && a.tenantId === t.id);
      if (accs.length) groups[t.name] = accs;
    });
  } else {
    db.accounts.forEach(a => {
      const key = a.type === 'platform' ? 'Platform' : (a.tenantId === account.tenantId ? 'Current merchant' : 'Linked merchants');
      if (a.type === 'tenant') {
        const vis = relatedTenantIds(db, account.tenantId);
        if (!vis.has(a.tenantId)) return; // demo: switcher lists reachable accounts
      }
      (groups[key] = groups[key] || []).push(a);
    });
  }
  const order = ['Platform', 'Current merchant', 'Linked merchants', ...db.tenants.map(t => t.name)];
  return (
    <Dropdown trigger={
      <span className="account-chip">
        <span className={`avatar ${account.type === 'platform' ? 'plat' : 'tenant'}`}>{initials}</span>
        <span className="account-chip-info">
          <div className="account-chip-name">{account.name}{!isPlatform && account.main && <span className="main-badge">{t('Main')}</span>}</div>
          <div className="account-chip-sub">{account.type === 'platform' ? 'Platform Admin' : (tenant ? tenant.name : '')}</div>
        </span>
        <Icon name="chevronDown" size={13} />
      </span>
    }>
      <div className="dropdown-group-label">Switch demo account <span className="switch-badge">DEMO</span></div>
      {/* P12 — the switcher filters by data scope; say so instead of letting a
          first-time user misread a shorter list as missing accounts */}
      {!isPlatform && <div className="dropdown-scope-note">Showing accounts within your data scope — own merchant, linked partners and platform</div>}
      {order.map(g => groups[g] && (
        <React.Fragment key={g}>
          <div className="dropdown-group-label">{g}</div>
          {groups[g].map(a => {
            const t = a.tenantId ? db.tenants.find(x => x.id === a.tenantId) : null;
            return (
              <div key={a.id} className={`dropdown-item${a.id === account.id ? ' active' : ''}`} onClick={() => switchAccount(a.id)}>
                <Icon name={a.type === 'platform' ? 'shield' : 'user'} size={14} />
                <span>{a.name}</span>
                <span className="sub">{t ? t.name : 'Platform'}</span>
              </div>
            );
          })}
        </React.Fragment>
      ))}
      <div className="dropdown-divider"></div>
      {isPlatform
        ? <div className="dropdown-item" style={{ fontSize: 11.5, color: 'var(--text-3)', cursor: 'default', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            title="Platform admins hold a cross-merchant read-only view and may enter any merchant demo account to inspect its workspace.">
            Platform admins can enter any merchant demo account — cross-merchant read-only
          </div>
        : <div className="dropdown-item" style={{ fontSize: 11.5, color: 'var(--text-3)', cursor: 'default', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            title="Accounts outside your business chain (e.g. Kano Wholesale Hub) are not listed — merchant data is isolated in MVP. See Permission Summary for details.">
            Only accounts in your business chain are listed — see Permission Summary
          </div>}
    </Dropdown>
  );
}

// ---------- console shell ----------
function WebConsole() {
  const { db, account, tenant, setView, toast, carts } = useApp();
  const menu = webMenuFor(account, tenant, db);
  const [group, setGroup] = useState(menu[0].id);
  const [page, setPage] = useState(menu[0].children[0].id);
  // R06 —— 入库两步向导（独立于购物车弹窗渲染）
  const [wizard, setWizard] = useState(null);
  const openPendingReprice = (ids) => { setWizard({ pids: ids || [] }); };
  const [collapsed, setCollapsed] = useState(false);
  const [openDocId, setOpenDocId] = useState(null);
  const [permOpen, setPermOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // 暂存单（Web 端）：三模块暂存（询价/入库/出库）共用一个 FAB 入口；
  // 提交询价后弹出桌面版 WhatsApp 对话窗口（与移动端同一套数据与流程）
  const [cartOpen, setCartOpen] = useState(false);
  // R19 — 暂存面板入口上下文（'all' | 'inquiry' | 'inbound' | 'outbound'）
  const [stagingContext, setStagingContext] = useState('all');
  const [waDocIds, setWaDocIds] = useState(null);
  useEffect(() => {
    // R19 — 深层组件按上下文请求打开暂存面板（与 mobile.jsx 同一事件）
    const h = e => { setStagingContext(e.detail.context || 'all'); setCartOpen(true); };
    window.addEventListener('tl-open-staging', h);
    return () => window.removeEventListener('tl-open-staging', h);
  }, []);
  const cartCount = cartTotalCount(carts);

  useEffect(() => {
    const m = webMenuFor(account, tenant, db);
    setGroup(m[0].id);
    setPage(m[0].children[0].id);
    setOpenDocId(null);
  }, [account.id]);

  const openDoc = id => setOpenDocId(id);
  const goPage = id => {
    setPage(id);
    const g = menu.find(m => m.children.some(c => c.id === id));
    if (g) setGroup(g.id);
  };

  const allowed = menu.some(m => m.children.some(c => c.id === page));
  if (!allowed) return <Forbidden403 />;

  const pageMeta = {
    'product-list': 'Product List', 'categories': 'Categories', 'inquiry': 'Inquiries', 'quote': 'Quotes',
    'po': 'Purchase Orders', 'inventory': 'Inventory', 'movements': 'Stock Movements', 'outbound': 'Outbound',
    'receiving': 'Receiving', 'doccenter': 'Document Center', 'invoice': 'Invoices', 'account-mgmt': 'Accounts',
    'team-mgmt': 'Team', 'distributor-mgmt': 'Distributors',
    'merchant-mgmt': 'Merchants & Relations',
  };

  return (
    <div className="console">
      <div className="topbar">
        <div className="brand">
          <Logo size={30} />
          <div><span className="brand-name">TierLink Warehouse</span><span className="brand-sub">Tiered Distribution WMS</span></div>
        </div>
        <nav className="top-menu">
          {menu.map(m => (
            <div key={m.id} className={`top-menu-item${group === m.id ? ' active' : ''}`}
              onClick={() => { setGroup(m.id); setPage(m.children[0].id); }}>
              {t(m.label)}
            </div>
          ))}
        </nav>
        <div className="topbar-right">
          <button className="btn sm h5-btn" title="Switch to Mobile (default entry after login)" onClick={() => setView('mobile')}><Icon name="mobile" size={14} /><span className="h5-label">Switch to Mobile</span></button>
          <button className="icon-btn" title="Permission Summary" onClick={() => setPermOpen(true)}><Icon name="shield" size={17} /></button>
          <button className="icon-btn" title="Data Risk & Confidence Notes" onClick={() => setNotesOpen(true)}><Icon name="info" size={17} /></button>
          <LangSwitch />
          <AccountSwitcher />
          <button className="icon-btn" title="Profile" onClick={() => setProfileOpen(true)}><Icon name="userCircle" size={18} /></button>
        </div>
      </div>
      <div className="console-body">
        <div className={`sidebar${collapsed ? ' collapsed' : ''}`}>
          {!collapsed && (
            <div className="side-scope" title={account.type === 'tenant'
              ? [...relatedTenantIds(db, account.tenantId)].filter(id => id !== account.tenantId).map(id => tenantName(db, id)).join(', ')
              : ''}>
              <Icon name={account.type === 'tenant' ? 'lock' : 'shield'} size={12} />
              <div>
                <div className="side-scope-k">Visible data scope</div>
                <div className="side-scope-v" title={account.type === 'tenant' && tenant ? tenant.name : undefined}>{account.type === 'tenant'
                  ? (() => { const c = [...relatedTenantIds(db, account.tenantId)].filter(id => id !== account.tenantId).length; return c === 0 ? t('No partners yet — invite your first one') : <React.Fragment>{tenant ? tenant.name : account.tenantId} + {c} {t(c === 1 ? 'linked partner' : 'linked partners')}</React.Fragment>; })()
                  : 'All merchants (read-only)'}</div>
              </div>
            </div>
          )}
          <div className="sidebar-group-label">{t((menu.find(m => m.id === group) || {}).label)}</div>
          {(menu.find(m => m.id === group) || { children: [] }).children.map(c => (
            <div key={c.id} className={`side-item${page === c.id ? ' active' : ''}`} onClick={() => setPage(c.id)}>
              <Icon name={page === c.id ? 'chevronRight' : 'chevronRight'} size={13} />
              <span>{t(c.label)}</span>
            </div>
          ))}
          <button className="side-collapse-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expand' : 'Collapse'}>
            <Icon name="chevronLeft" size={15} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
            <span>{collapsed ? t('Expand') : t('Collapse')}</span>
          </button>
        </div>
        <div className="main">
          <div className="page">
            {page === 'product-list' && <PendingRepriceBanner onOpen={openPendingReprice} />}
            {page === 'product-list' && <ProductListPage openDoc={openDoc} />}
            {page === 'categories' && <CategoriesPage />}
            {page === 'inquiry' && <InquiryPage openDoc={openDoc} />}
            {page === 'quote' && <QuotePage openDoc={openDoc} />}
            {page === 'po' && <POPage openDoc={openDoc} />}
            {page === 'inventory' && <InventoryPage openDoc={openDoc} />}
            {page === 'movements' && <MovementsPage />}
            {page === 'outbound' && <OutboundPage openDoc={openDoc} />}
            {page === 'receiving' && <ReceivingPage openDoc={openDoc} />}
            {page === 'doccenter' && <DocCenterPage openDoc={openDoc} goPage={goPage} />}
            {page === 'invoice' && <InvoicePage openDoc={openDoc} />}
            {page === 'account-mgmt' && <AccountMgmtPage />}
            {page === 'team-mgmt' && <TeamPage />}
            {page === 'distributor-mgmt' && <DistributorPage />}
            {page === 'merchant-mgmt' && <TenantMgmtPage />}
            {page === 'settings' && <SettingsPage />}
          </div>
        </div>
      </div>
      {openDocId && <DocDetailDialog docId={openDocId} onClose={() => setOpenDocId(null)} onOpenDoc={openDoc} />}
      {permOpen && <PermissionSummaryDialog onClose={() => setPermOpen(false)} />}
      {notesOpen && <DataNotesDialog onClose={() => setNotesOpen(false)} />}
      {profileOpen && <ProfileDialog onClose={() => setProfileOpen(false)} />}
      {/* 暂存单悬浮入口（仅商户账号，角标 = 三模块行数合计） */}
      {account.type === 'tenant' && <WebCartFab count={cartCount} onClick={() => { setStagingContext('all'); setCartOpen(true); }} />}
      {cartOpen && <WebStagingDialog onClose={() => setCartOpen(false)} onInquired={ids => { setCartOpen(false); setWaDocIds(ids); }} onWizard={r => setWizard({ result: r })} context={stagingContext} />}
      {wizard && <InboundWizardDialog result={wizard.result} pids={wizard.pids} onClose={() => setWizard(null)} />}
      {waDocIds && waDocIds.length > 0 && <WebWhatsAppDialog docIds={waDocIds} onOpenDoc={openDoc} onClose={() => setWaDocIds(null)} />}
    </div>
  );
}

function Forbidden403() {
  return (
    <div className="console">
      <div style={{ margin: 'auto', textAlign: 'center' }}>
        <div style={{ fontSize: 64, fontWeight: 800, color: 'var(--danger)', fontFamily: 'var(--mono)' }}>403</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>Access Denied</div>
        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>You do not have permission to access this page. Switch to an account with the required access.</div>
      </div>
    </div>
  );
}

// ---------- pagination helper ----------
function usePaged(rows, pageSize = 8) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [rows.length ? rows[0] && rows[0].id : null, pageSize]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.min(page, pages);
  return { page: cur, slice: rows.slice((cur - 1) * pageSize, cur * pageSize), total: rows.length, setPage, pages };
}

// ---------- shared doc list columns ----------
function docColumns(db, account, openDoc, opts = {}) {
  const cols = [
    { key: 'no', label: 'Doc No', width: 150, render: r => <span className="doc-no" onClick={() => openDoc(r.id)}>{r.no}</span> },
  ];
  if (opts.showType) cols.push({ key: 'type', label: 'Type', width: 80, render: r => <span className="mono small bold">{r.type}</span> });
  cols.push(
    { key: 'cp', label: opts.cpLabel || 'Counterparty', render: r => {
      // R84 — list items carry buyer/seller roles only; rows where the viewer
      // is not a party get a neutral "View only" sub-label (no observer role)
      const side = docSide(db, account, r);
      const cpId = side === 'seller' ? r.buyer : r.seller;
      const sub = side === 'seller' ? 'Sells to' : side === 'buyer' ? 'Buys from' : 'View only';
      return <React.Fragment><div>{tenantName(db, cpId)}</div><div className="cell-sub">{sub}</div></React.Fragment>;
    }},
    { key: 'items', label: 'Items', width: 60, align: 'center', render: r => r.items.length },
    { key: 'amount', label: 'Amount', width: 150, align: 'right', render: r => <Money amount={docAmount(r)} currency={r.currency} /> },
    { key: 'status', label: 'Status', width: 130, render: r => <StatusTag type={r.type} status={docStatusOf(r)} /> },
    { key: 'createdBy', label: 'Created By', width: 120, render: r => <span className="small">{r.createdBy}</span> },
    { key: 'createdAt', label: 'Created', width: 130, render: r => <span className="small muted">{r.createdAt}</span> },
  );
  return cols;
}

function ActionButtons({ doc, openDoc, size = 'sm', extraAction }) {
  const { db, account, act, toast } = useApp();
  const actions = docActions(db, account, doc);
  const [confirm, setConfirm] = useState(null); // {verb, message}
  const [dialog, setDialog] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false); // R81 — rejection requires a reason
  const [rejectReason, setRejectReason] = useState('');

  const runVerb = (verb) => {
    if (verb === 'View') return openDoc(doc.id);
    if (verb === 'Edit') return setDialog(doc.type === 'IQ' ? 'inquiry' : doc.type === 'PO' ? 'po' : 'quote');
    if (verb === 'Quote') return setDialog('quote');
    // R81 — rejection (quote by buyer / order by supplier) needs a written reason
    if (verb === 'Reject') { setRejectReason(''); return setRejectOpen(true); }
    // quote accept stays a plain confirm; PO accept opens the R94 form below
    // P1 — an expired quote cannot be accepted; block with a clear notice
    if (verb === 'Accept' && doc.type !== 'PO') {
      if (quoteExpired(doc)) return setConfirm({ verb: 'OK', title: 'Accept', message: `Quote ${doc.no} expired on ${doc.validUntil} — it can no longer be accepted. Ask the supplier to send a new quote.` });
      return setConfirm({ verb, message: `Accept ${doc.no}? A purchase order will be generated automatically and submitted to ${tenantName(db, doc.seller)} for review.` });
    }
    if (verb === 'Submit') return setConfirm({ verb, message: `Submit ${doc.no}? It will be sent to ${tenantName(db, doc.seller)} and cannot be edited afterwards.` });
    if (verb === 'Approve') return setConfirm({ verb, message: `Approve ${doc.no}? Stock availability has been validated.` });
    if (verb === 'Cancel') return setConfirm({ verb, message: `Cancel ${doc.no}? This cannot be undone.`, danger: true });
    if (verb === 'Close') return setConfirm({ verb, message: `Close inquiry ${doc.no}?`, danger: true });
    if (verb === 'Delete') return setConfirm({ verb, message: `Delete draft ${doc.no}? This cannot be undone.`, danger: true });
    if (verb === 'Ship') return setDialog('ship');
    // R16 — 拣货 / 发货（承运信息）专用表单
    if (verb === 'Start Picking') return setDialog('picking');
    if (verb === 'Dispatch') return setDialog('dispatch');
    if (verb === 'Confirm Receipt') return setDialog('receive');
    if (verb === 'Print') return setDialog('print');
    if (verb === 'Download') {
      downloadInvoiceFile(db, doc);
      act.logEvent('Download Invoice', doc.no);
      return toast(`Invoice ${doc.no} downloaded (CSV) — data export event logged`, 'success');
    }
    // R94 — dedicated FORM dialogs for the order-flow actions (list rows):
    // accept / record payment / re-receive / replenish / terminate receiving
    if (verb === 'Accept' && doc.type === 'PO') return setDialog('accept');
    if (verb === 'Record Payment') return setDialog('pay');
    if (verb === 'Re-receive') return setDialog('rereceive');
    if (verb === 'Replenish') return setDialog('replenish');
    if (verb === 'Terminate Receiving') return setDialog('terminate');
    // list-row verbs not opening dedicated dialogs get a text confirm
    const msgs = {
      'Confirm Quote': `Confirm the AI-drafted quote ${doc.no} with one tap? The quote link will be pushed to ${tenantName(db, doc.buyer)} via WhatsApp.`,
      'Place Order': `Place order ${doc.no} with one tap? It will be submitted to ${tenantName(db, doc.seller)} for review.`,
      'Create Invoice': `Issue the invoice for ${doc.no}? The invoice link will be pushed to ${tenantName(db, doc.buyer)} via WhatsApp.`,
      'Confirm Invoice': `Confirm invoice ${doc.no}? It will be archived after confirmation.`,
    };
    if (msgs[verb]) return setConfirm({ verb, message: msgs[verb] });
  };

  return (
    <React.Fragment>
      <div className="row-actions">
        {actions.map(verb => (
          <button key={verb} className={`btn sm text${['Confirm Receipt', 'Re-receive'].includes(verb) ? ' success-text' : ['Ship', 'Dispatch'].includes(verb) ? ' warning-text' : ['Delete', 'Cancel', 'Reject', 'Close', 'Terminate Receiving'].includes(verb) ? ' error-text' : ''}`} onClick={() => runVerb(verb)}><NavIcon name={WEB_VERB_ICON[verb] || 'check'} size={13} />{verb}</button>
        ))}
        {actions.length === 0 && (
          <span className="act-none" title="Read-only — platform accounts cannot operate">
            <Icon name="lock" size={12} />—
          </span>
        )}
      </div>
      {confirm && (
        <ConfirmDialog title={`${confirm.title || confirm.verb + ' ' + doc.no}`} message={confirm.message} confirmText={confirm.verb} danger={confirm.danger}
          onConfirm={() => {
            if (confirm.verb === 'OK') return setConfirm(null);
            return act.docVerb(confirm.verb, doc);
          }} onClose={() => setConfirm(null)} />
      )}
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
          <div style={{ marginBottom: 12 }}>A rejection reason is required. It is recorded on the document timeline and sent to the counterparty.</div>
          <textarea className="input" rows="3" style={{ width: '100%' }} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason (required)" />
          {!rejectReason.trim() && <div className="field-error">Rejection reason is required</div>}
        </Dialog>
      )}
      {dialog === 'inquiry' && <InquiryFormDialog editDoc={doc} onClose={() => setDialog(null)} />}
      {dialog === 'po' && <POFormDialog editDoc={doc} onClose={() => setDialog(null)} />}
      {dialog === 'quote' && <QuoteFormDialog inquiry={doc.type === 'IQ' ? doc : null} editQuote={doc.type === 'QT' ? doc : null} onClose={() => setDialog(null)} />}
      {dialog === 'ship' && <ShipDialog po={doc} onClose={() => setDialog(null)} />}
      {/* R16 — 拣货 / 发货表单（CK 行；PO 行进入时解析到它生成的出库单） */}
      {dialog === 'picking' && (() => {
        const ck = doc.type === 'PO' ? db.docs.filter(d => d.type === 'CK' && d.poNo === doc.no).pop() : doc;
        return ck ? <PickingDialog ckId={ck.id} onClose={() => setDialog(null)} /> : null;
      })()}
      {dialog === 'dispatch' && (() => {
        const ck = doc.type === 'PO' ? db.docs.filter(d => d.type === 'CK' && d.poNo === doc.no).pop() : doc;
        return ck ? <DispatchDialog ck={ck} onClose={() => setDialog(null)} /> : null;
      })()}
      {/* R93 — a PO row at 已发货 opens the receive dialog on its generated CK (incl. Pending Shipment) */}
      {dialog === 'receive' && <ReceiveDialog ck={doc.type === 'PO' ? (db.docs.filter(d => d.type === 'CK' && d.poNo === doc.no && ['Shipped', 'Pending Shipment'].includes(d.status)).pop() || doc) : doc} onClose={() => setDialog(null)} />}
      {/* R94 — dedicated FORM dialogs for the order-flow actions (list rows);
          recovery verbs from a CK/RK row resolve the parent purchase order */}
      {dialog === 'accept' && doc.type === 'PO' && <AcceptOrderDialog po={doc} onClose={() => setDialog(null)} />}
      {dialog === 'pay' && <PayDialog po={doc} onClose={() => setDialog(null)} />}
      {dialog === 'rereceive' && <ReReceiveDialog po={parentPoOf(db, doc) || doc} onClose={() => setDialog(null)} />}
      {dialog === 'replenish' && <ReplenishDialog po={parentPoOf(db, doc) || doc} onClose={() => setDialog(null)} />}
      {dialog === 'terminate' && <TerminateDialog po={parentPoOf(db, doc) || doc} onClose={() => setDialog(null)} />}
      {dialog === 'print' && <PrintPreviewDialog doc={doc} onClose={() => setDialog(null)} />}
    </React.Fragment>
  );
}

// ============================================================
// Pages
// ============================================================

function ProductListPage() {
  const { db, account, toast, cartApi } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  // two tenant-scoped tabs, mirroring the mobile products page: My Products
  // (own catalog — manage) and Sourcing Channel (upstream suppliers — inquire)
  const [tab, setTab] = useState('mine');
  const [supplier, setSupplier] = useState('ALL');
  const [dialog, setDialog] = useState(null); // 'add' | 'edit:xx' | 'stock:xx' | 'chain:xx' | 'inquire:xx' | 'import'
  const [confirmDel, setConfirmDel] = useState(null);
  const loading = useSkeleton([account.id]);
  const isTenant = account.type === 'tenant' && !!account.tenantId;
  const upstream = isTenant ? [...upstreamTenantIds(db, account.tenantId)]
    .map(id => db.tenants.find(t => t.id === id)).filter(t => t && t.status === 'Active') : [];
  const upstreamIds = new Set(upstream.map(t => t.id));
  const rows = db.products.filter(p => {
    if (isTenant && (tab === 'mine' ? p.ownerId !== account.tenantId : !upstreamIds.has(p.ownerId))) return false;
    if (isTenant && tab === 'channel' && supplier !== 'ALL' && p.ownerId !== supplier) return false;
    // R05/AC-05-09 — 条码命中要精确（整码或主体码全等即命中）；
    // 其余仍走名称/型号/品牌的包含匹配，避免改变原有搜索手感。
    if (q) {
      const ql = q.trim().toLowerCase();
      const bc = String(p.barcode || '').trim().toLowerCase();
      const bd = String(p.barcodeBody || '').trim().toLowerCase();
      const hitBarcode = !!ql && ((bc && bc === ql) || (bd && bd === ql));
      if (!hitBarcode && !(p.name + ' ' + p.model + ' ' + p.brand).toLowerCase().includes(ql)) return false;
    }
    if (cat && !p.categories.includes(cat)) return false;
    return true;
  });
  const filtered = !!(q || cat);
  // R21/AC-21-09 — list sort by LATEST purchase price (derived value, falls
  // back to initial cost for products never stocked in this session)
  const [pSort, setPSort] = useState('default');
  const sortedRows = pSort === 'priceAsc' ? [...rows].sort((a, b) => purchasePriceOf(a) - purchasePriceOf(b))
    : pSort === 'priceDesc' ? [...rows].sort((a, b) => purchasePriceOf(b) - purchasePriceOf(a))
    : rows;
  const paged = usePaged(sortedRows);
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Product List</div>
          <div className="page-desc">Flat product fields — saved products are published and sellable immediately. No SPU/SKU hierarchy in MVP. <span className="mini-chip mvp">MVP</span></div>
        </div>
        <div className="page-actions">
          {(!isTenant || tab === 'mine') && <React.Fragment>
            <button className="btn" onClick={() => { downloadProductTemplate(); toast('Excel template downloaded — fill and re-upload (demo: .csv)', 'success'); }}><Icon name="download" size={14} />Template</button>
            <button className="btn" onClick={() => setDialog('import')}><Icon name="upload" size={14} />Batch Import</button>
            <button className="btn primary" onClick={() => setDialog('add')}><Icon name="plus" size={14} />Add Product</button>
          </React.Fragment>}
        </div>
      </div>
      <div className="card">
        {isTenant && (
          <div className="flex" style={{ alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 0', flexWrap: 'wrap', gap: 12 }}>
            <div className="segments">
              <button className={`segment${tab === 'mine' ? ' active' : ''}`} onClick={() => { setTab('mine'); setSupplier('ALL'); setCat(''); }}>My Products</button>
              <button className={`segment${tab === 'channel' ? ' active' : ''}`} onClick={() => { setTab('channel'); setSupplier('ALL'); setCat(''); }}>Sourcing Channel</button>
            </div>
            <span className="muted small">{isTenant && tab === 'mine' ? 'Own catalog — price, stock and downstream visibility' : "Upstream suppliers' catalog — inquire from here"}</span>
          </div>
        )}
        <div className="filter-bar">
          {isTenant && tab === 'channel' && (
            <React.Fragment>
              <span className="label">Supplier</span>
              <Select value={supplier} onChange={setSupplier} style={{ width: 220 }}
                options={[{ value: 'ALL', label: `All Suppliers (${upstream.length})` }].concat(upstream.map(t => ({ value: t.id, label: `${t.name} (${t.code})` })))} />
            </React.Fragment>
          )}
          <span className="label">Category</span>
          <Select value={cat} onChange={setCat} placeholder="All categories" style={{ width: 180 }}
            options={db.categories.map(c => ({ value: c.id, label: t(c.name) }))} />
          <SearchBox value={q} onChange={setQ} placeholder="Search name / model / brand / barcode" width={280} />
          <span className="label">Sort By</span>
          <Select value={pSort} onChange={setPSort} style={{ width: 200 }} options={[
            { value: 'default', label: t('Default') },
            { value: 'priceAsc', label: t('Purchase Price (low → high)') },
            { value: 'priceDesc', label: t('Purchase Price (high → low)') },
          ]} />
          <span className="label" style={{ marginLeft: 'auto' }}>{rows.length} products</span>
        </div>
        <Table loading={loading} empty={filtered || (isTenant && tab === 'channel') ? (upstream.length ? 'No products match the current filters' : 'No upstream suppliers') : undefined} emptyHint={filtered ? 'Try clearing the search or filters' : 'This tab lists products from your upstream suppliers — suppliers have none.'} columns={[
          { key: 'name', label: 'Product', render: p => (
            <div className="flex gap10">
              <img src={prodImg(p)} alt="" style={{ width: 42, height: 42, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border-light)' }} />
              <div>
                <div className="bold" style={{ fontSize: 13 }}>{p.name}</div>
                <div className="cell-sub">{p.spec}</div>
              </div>
            </div>
          )},
          { key: 'model', label: 'Model', width: 130, render: p => (
            // R05 — 型号与条码分行显示（条码副行，AC-05-08 要求商品详情可见条码）
            <div>
              <span className="mono small">{p.model || '—'}</span>
              {p.barcode ? <div className="cell-sub mono">{p.barcode}</div> : <div className="cell-sub">No barcode</div>}
            </div>
          ) },
          { key: 'brand', label: 'Brand', width: 90 },
          { key: 'cats', label: 'Categories', render: p => (
            <div>
              <div className="flex gap8" style={{ flexWrap: 'wrap' }}>
                {p.categories.map(cid => { const c = db.categories.find(x => x.id === cid); return c ? <Tag key={cid} tone="info">{t(c.name)}</Tag> : null; })}
              </div>
              {/* 渠道页签：归属商户与类目分行（与移动端采购渠道列表同构） */}
              {isTenant && tab === 'channel' && (
                <div className="flex" style={{ alignItems: 'center', gap: 4, marginTop: 6 }}>
                  <Icon name="building" size={12} />
                  <span className="muted small">{tenantName(db, p.ownerId)}</span>
                </div>
              )}
            </div>
          )},
          { key: 'unit', label: 'Unit', width: 60, align: 'center' },
          // 渠道页签下归属商户已分行入 Categories 单元格，独立 Owner 列仅
          // 在其余视图（自建目录 / 平台全局列表）显示
          ...(isTenant && tab === 'channel' ? [] : [{ key: 'owner', label: 'Owner', width: 150, render: p => p.ownerId === account.tenantId
            ? <Tag tone="teal" dot>Ours</Tag>
            : <span className="muted small">{tenantName(db, p.ownerId)}</span> }]),
          { key: 'price', label: 'Prices', width: 210, align: 'right', render: p => (
            // R78 — stacked price set with currency codes: own products show
            // cost/market/sale, upstream (channel) products market/sale only
            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
              {p.ownerId === account.tenantId && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('Purchase Price')} <span className="mono">{money(purchasePriceOf(p), purchaseCurrencyOf(p)).text}</span>{p.purchaseUpdatedAt ? <span className="muted" style={{ marginLeft: 4 }}>{t('updated')} {p.purchaseUpdatedAt}</span> : null}</span>}
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('Market guide price')} <span className="mono">{money(ifnull(p.marketPrice, p.price), marketCurOf(p)).text}</span></span>
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{t('Channel sale price')} <span className="mono bold" style={{ color: '#D35400' }}>{money(p.price, p.currency).text}</span></span>
            </div>
          ) },
          { key: 'stock', label: 'My Stock', width: 100, align: 'center', render: p => <span className="mono bold">{ifnull((db.stock[account.tenantId] || {})[p.id], 0)} {t(p.unit)}</span> },
          // R08/AC-08-04 — 商品档案区分自产 / 外购
          { key: 'source', label: 'Source', width: 110, render: p => p.source === 'self'
            ? <Tag tone="teal" dot>{t('Self-produced')}</Tag>
            : <Tag tone="info">{t('Externally sourced')}</Tag> },
          { key: 'status', label: 'Status', width: 110, render: p => <Tag tone={p.onSale === false ? 'dark' : 'teal'} dot>{p.onSale === false ? 'Discontinued' : 'On Sale'}</Tag> },
          { key: 'act', label: 'Actions', width: isTenant && tab === 'channel' ? 200 : 360, render: p => isTenant && tab === 'channel' ? (
            <div className="row-actions">
              {/* 加入询价暂存：逐项累积（数量默认 1，可在暂存单内增减） */}
              <button className="btn sm text" title={t('Add to Inquiry Staging')} onClick={() => { cartApi.add('inquiry', { pid: p.id, qty: 1 }); toast(`${p.name} added to the inquiry staging`, 'success'); }}><NavIcon name="inquiry" size={13} />{t('Add to Inquiry Staging')}</button>
              <button className="btn sm text" onClick={() => setDialog('inquire:' + p.id)}><NavIcon name="inquiry" size={13} />Inquire</button>
            </div>
          ) : canManageProduct(db, account, p) ? (
            <div className="row-actions">
              {/* 加入入库/出库暂存（与移动端同一套暂存数据） */}
              <button className="btn sm text success-text" title={t('Add to Inbound Staging')} onClick={() => { const ok = cartApi.add('inbound', { kind: 'exist', pid: p.id, qty: 1 }); if (ok) toast(`${p.name} added to the inbound staging`, 'success'); }}><NavIcon name="stockIn" size={13} />{t('Stock In')}</button>
              <button className="btn sm text warning-text" title={t('Add to Outbound Staging')} onClick={() => { const ok = cartApi.add('outbound', { pid: p.id, qty: 1 }); if (ok) toast(`${p.name} added to the outbound staging`, 'success'); }}><NavIcon name="stockOut" size={13} />{t('Stock Out')}</button>
              <button className="btn sm text info" onClick={() => setDialog('edit:' + p.id)}><Icon name="edit" size={13} />Edit</button>
              <button className="btn sm text info" onClick={() => setDialog('stock:' + p.id)}><NavIcon name="myStock" size={13} />Adjust Stock</button>
              <button className="btn sm text info" onClick={() => setDialog('chain:' + p.id)}><Icon name="link" size={13} />View Stock</button>
              <button className="btn sm text" title={t('Purchase History')} onClick={() => setDialog('phistory:' + p.id)}><Icon name="receipt" size={13} />{t('Purchase History')}</button>
              <button className="btn sm text error-text" onClick={() => setConfirmDel(p)}><Icon name="trash" size={13} />Delete</button>
            </div>
          ) : (
            <span className="muted small" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Price and stock are managed by the owning merchant"><Icon name="lock" size={12} /> {`Owned by ${tenantName(db, p.ownerId)}`}</span>
          ) },
        ]} rows={paged.slice} rowKey="id" />
        <Pagination total={paged.total} page={paged.page} pageSize={8} onChange={paged.setPage} />
      </div>
      {dialog === 'add' && <ProductFormDialog onClose={() => setDialog(null)} />}
      {dialog === 'import' && <ImportDialog onClose={() => setDialog(null)} />}
      {dialog && dialog.startsWith('edit:') && <ProductFormDialog editProduct={db.products.find(p => p.id === dialog.slice(5))} onClose={() => setDialog(null)} />}
      {dialog && dialog.startsWith('stock:') && <AdjustStockDialog productId={dialog.slice(6)} onClose={() => setDialog(null)} />}
      {dialog && dialog.startsWith('chain:') && <DownstreamStockDialog productId={dialog.slice(6)} onClose={() => setDialog(null)} />}
      {dialog && dialog.startsWith('phistory:') && <PurchaseHistoryDialog productId={dialog.slice(9)} onClose={() => setDialog(null)} />}
      {dialog && dialog.startsWith('inquire:') && <InquiryFormDialog initialPid={dialog.slice(8)} onClose={() => setDialog(null)} />}
      {confirmDel && (
        <ConfirmDialog title="Delete Product" danger confirmText="Delete"
          message={`Delete product "${confirmDel.name}"? Products referenced by existing documents will be retained for audit.`}
          onConfirm={() => toast('Product deleted (demo)', 'success')} onClose={() => setConfirmDel(null)} />
      )}
    </div>
  );
}

function CategoriesPage() {
  const { db, act, toast } = useApp();
  const [dialog, setDialog] = useState(null);
  const loading = useSkeleton([db.categories.length]);
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Categories</div>
          <div className="page-desc">Platform-unified flat categories. One product may belong to multiple categories. <span className="mini-chip mvp">MVP</span></div>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setDialog({})}><Icon name="plus" size={14} />Add Category</button>
        </div>
      </div>
      <Banner tone="info" icon="box"><b>MVP boundary — single-level flat categories.</b> This page shows a flat list only; category tree and hierarchy management arrive in the evolution phase. Categories are shared platform-wide so suppliers and agents reference the same taxonomy. <span className="mini-chip mvp">MVP</span></Banner>
      <div className="card">
        <Table loading={loading} columns={[
          { key: 'name', label: 'Category Name', render: c => <span className="bold">{c.name}</span> },
          { key: 'count', label: 'Products', width: 100, align: 'center', render: c => db.products.filter(p => p.categories.includes(c.id)).length },
          { key: 'id', label: 'Code', width: 130, render: c => <span className="mono small muted">{c.id}</span> },
          { key: 'status', label: 'Status', width: 110, render: () => <Tag tone="success" dot>Enabled</Tag> },
          { key: 'act', label: 'Actions', width: 160, render: c => (
            <div className="row-actions">
              <button className="btn sm text info" onClick={() => setDialog(c)}><Icon name="edit" size={13} />Edit</button>
              <button className="btn sm text error-text" onClick={() => toast('Category deleted (demo)', 'success')}><Icon name="trash" size={13} />Delete</button>
            </div>
          )},
        ]} rows={db.categories} rowKey="id" />
      </div>
      {dialog && <CategoryDialog category={dialog.id ? dialog : null} onClose={() => setDialog(null)} />}
    </div>
  );
}

// ---- inquiry / quote / PO pages ----
function ScopeSwitch({ value, onChange }) {
  return (
    <div className="segments">
      <button className={`segment${value === 'me' ? ' active' : ''}`} onClick={() => onChange('me')}>My Records</button>
      <button className={`segment${value === 'all' ? ' active' : ''}`} onClick={() => onChange('all')}>Merchant Records</button>
    </div>
  );
}

// QA #13 — default Inquiry tab by account type, and keep manual tab choices
// for the duration of the session (keyed per account, so switching accounts
// still lands each account on its own smart default).
const inquirySegManual = {};
function inquiryDefaultSeg(db, account) {
  if (account.type !== 'tenant') return 'mine';
  const tenant = db.tenants.find(t => t.id === account.tenantId);
  if (!tenant) return 'mine';
  // Supplier's core work queue is inquiries awaiting a quote.
  if (tenant.type === 'Supplier') return 'toQuote';
  // Procurement side: default to quoted inquiries awaiting confirmation.
  return 'toConfirm';
}

function InquiryPage({ openDoc }) {
  const { db, account } = useApp();
  const C = (o) => docColumns(db, account, openDoc, o);
  const [seg, setSegState] = useState(inquirySegManual[account.id] || inquiryDefaultSeg(db, account));
  const setSeg = (s) => { inquirySegManual[account.id] = s; setSegState(s); };
  useEffect(() => {
    setSegState(inquirySegManual[account.id] || inquiryDefaultSeg(db, account));
  }, [account.id]);
  // UX #15 — hide empty-count tabs so zero-item queues don’t clutter the UI
  const [scope, setScope] = useState('me');
  const [formOpen, setFormOpen] = useState(false);
  const loading = useSkeleton([account.id, seg]);
  const isTenant = account.type === 'tenant';
  const tenant = isTenant ? db.tenants.find(t => t.id === account.tenantId) : null;
  const isSupplier = tenant && tenant.type === 'Supplier';
  const toQuoteCount = isTenant ? db.docs.filter(d => d.type === 'IQ' && d.seller === account.tenantId && d.status === 'Submitted').length : 0;
  const toConfirmCount = isTenant ? db.docs.filter(d => d.type === 'IQ' && d.buyer === account.tenantId && d.status === 'Quoted').length : 0;
  useEffect(() => {
    if (isSupplier && seg === 'toQuote' && toQuoteCount === 0) setSeg('mine');
    if (!isSupplier && seg === 'toConfirm' && toConfirmCount === 0) setSeg('mine');
  }, [isSupplier, seg, toQuoteCount, toConfirmCount]);
  let rows = [];
  if (isTenant && seg === 'mine') {
    rows = db.docs.filter(d => d.type === 'IQ' && d.buyer === account.tenantId && (scope === 'all' || d.createdBy === account.name));
  } else if (isTenant && seg === 'toQuote') {
    // QA P3-5 — the "To Quote" work queue must only contain open inquiries
    // awaiting a quote; closed / already-quoted / draft ones stay out.
    rows = db.docs.filter(d => d.type === 'IQ' && d.seller === account.tenantId && d.status === 'Submitted');
  } else if (isTenant && seg === 'toConfirm') {
    rows = db.docs.filter(d => d.type === 'IQ' && d.buyer === account.tenantId && d.status === 'Quoted' && (scope === 'all' || d.createdBy === account.name));
  } else if (isTenant) {
    rows = db.docs.filter(d => d.type === 'IQ' && d.seller === account.tenantId);
  }
  const paged = usePaged(rows);
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Inquiries</div>
          <div className="page-desc">Create inquiries with item lines, receiving warehouse and delivery date. Status: Draft → Submitted → Quoted → Closed.</div>
        </div>
        <div className="page-actions">
          {isTenant && <div className="segments">
            {isSupplier ? (
              <React.Fragment>
                {toQuoteCount > 0 && <button className={`segment${seg === 'toQuote' ? ' active' : ''}`} onClick={() => setSeg('toQuote')}>{t('To Quote')} ({toQuoteCount})</button>}
                <button className={`segment${seg === 'mine' ? ' active' : ''}`} onClick={() => setSeg('mine')}>{t('Inquiries Received')}</button>
              </React.Fragment>
            ) : (
              <React.Fragment>
                {toConfirmCount > 0 && <button className={`segment${seg === 'toConfirm' ? ' active' : ''}`} onClick={() => setSeg('toConfirm')}>{t('To Confirm')} ({toConfirmCount})</button>}
                <button className={`segment${seg === 'mine' ? ' active' : ''}`} onClick={() => setSeg('mine')}>{t('My Inquiries')}</button>
              </React.Fragment>
            )}
          </div>}
          {isTenant && seg === 'mine' && <button className="btn primary" onClick={() => setFormOpen(true)}><Icon name="plus" size={14} />New Inquiry</button>}
        </div>
      </div>
      {isTenant && seg === 'mine' && (
        <Banner tone="info" icon="lock"><b>MVP data scope — personal records only.</b> By default you only see inquiries you created. Switch to "Merchant Records" to preview what a full-merchant scope would show (available post-MVP). {account.name} · {db.docs.filter(d => d.type === 'IQ' && d.buyer === account.tenantId).length} total in merchant</Banner>
      )}
      {isTenant && seg === 'toQuote' && (
        <Banner tone="success" icon="whatsapp">Inquiries received from linked partners are visible because of an established supply relation (MerchantRelation). Submitting a quote auto-notifies the buyer via WhatsApp.</Banner>
      )}
      {isTenant && seg === 'toConfirm' && (
        <Banner tone="success" icon="whatsapp">Quoted inquiries awaiting your confirmation appear here. Accept to auto-generate a purchase order.</Banner>
      )}
      <div className="card">
        {isTenant && (seg === 'mine' || seg === 'toConfirm') && <div className="filter-bar"><span className="label">Data scope</span><ScopeSwitch value={scope} onChange={setScope} /><span className="label" style={{ marginLeft: 'auto' }}>{rows.length} records</span></div>}
        <Table loading={loading} columns={[...C(), { key: 'act', label: 'Actions', width: 210, render: r => <ActionButtons doc={r} openDoc={openDoc} /> }]} rows={paged.slice} rowKey="id" />
        <Pagination total={paged.total} page={paged.page} pageSize={8} onChange={paged.setPage} />
      </div>
      {formOpen && <InquiryFormDialog onClose={() => setFormOpen(false)} />}
    </div>
  );
}

// QA P3-6 — default Quotes tab by account type, and keep manual tab choices
// for the duration of the session (keyed per account, so switching accounts
// still lands each account on its own smart default).
const quoteSegManual = {};
function quoteDefaultSeg(db, account) {
  if (account.type !== 'tenant') return 'received';
  const tenant = db.tenants.find(t => t.id === account.tenantId);
  if (!tenant) return 'received';
  // Supplier's core work queue is inquiries awaiting a quote.
  if (tenant.type === 'Supplier') return 'toQuote';
  // Agents / distributors with an upstream supplier receive quotes from it.
  const hasUpstream = db.relations.some(r => r.downstream === tenant.id);
  return hasUpstream ? 'received' : 'sent';
}

function QuotePage({ openDoc }) {
  const { db, account } = useApp();
  const C = (o) => docColumns(db, account, openDoc, o);
  const [seg, setSegState] = useState(quoteSegManual[account.id] || quoteDefaultSeg(db, account));
  const setSeg = (s) => { quoteSegManual[account.id] = s; setSegState(s); };
  useEffect(() => {
    setSegState(quoteSegManual[account.id] || quoteDefaultSeg(db, account));
  }, [account.id]);
  const [scope, setScope] = useState('me');
  const loading = useSkeleton([account.id, seg]);
  const isTenant = account.type === 'tenant';
  const tenant = isTenant ? db.tenants.find(t => t.id === account.tenantId) : null;
  const isSupplier = tenant && tenant.type === 'Supplier';
  let rows = [];
  if (isTenant && seg === 'toQuote') rows = db.docs.filter(d => d.type === 'IQ' && d.seller === account.tenantId && d.status === 'Submitted');
  if (isTenant && seg === 'received') rows = db.docs.filter(d => d.type === 'QT' && d.buyer === account.tenantId);
  if (isTenant && seg === 'sent') rows = db.docs.filter(d => d.type === 'QT' && d.seller === account.tenantId && (scope === 'all' || d.createdBy === account.name));
  const paged = usePaged(rows);
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Quotes</div>
          <div className="page-desc">Respond to inquiries with quoted prices. AI can draft a quote from inquiry lines; accepting a quote auto-generates a purchase order.</div>
        </div>
        {isTenant && <div className="segments">
          {isSupplier ? (
            <React.Fragment>
              <button className={`segment${seg === 'toQuote' ? ' active' : ''}`} onClick={() => setSeg('toQuote')}>{t('To Quote')}</button>
              <button className={`segment${seg === 'sent' ? ' active' : ''}`} onClick={() => setSeg('sent')}>{t('Quotes Sent')}</button>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <button className={`segment${seg === 'received' ? ' active' : ''}`} onClick={() => setSeg('received')}>{t('Quotes Received')}</button>
              <button className={`segment${seg === 'sent' ? ' active' : ''}`} onClick={() => setSeg('sent')}>{t('Quotes Sent')}</button>
            </React.Fragment>
          )}
        </div>}
      </div>
      {isTenant && seg === 'sent' && (
        <Banner tone="info" icon="lock"><b>MVP data scope — personal records only.</b> Default view shows quotes you created.</Banner>
      )}
      {isTenant && seg === 'received' && (
        <Banner tone="success" icon="whatsapp">Quotes from linked suppliers appear here. Accept to auto-generate a purchase order and submit it for the supplier's review.</Banner>
      )}
      {isTenant && seg === 'toQuote' && (
        <Banner tone="success" icon="whatsapp">Inquiries received from linked partners are visible because of an established supply relation (MerchantRelation). Submitting a quote auto-notifies the buyer via WhatsApp.</Banner>
      )}
      <div className="card">
        {isTenant && seg === 'sent' && <div className="filter-bar"><span className="label">Data scope</span><ScopeSwitch value={scope} onChange={setScope} /><span className="label" style={{ marginLeft: 'auto' }}>{rows.length} records</span></div>}
        <Table loading={loading} columns={[
          ...C(),
          ...(seg !== 'toQuote' ? [{ key: 'valid', label: 'Valid Until', width: 110, render: r => <span className="small">{r.validUntil || '—'}</span> }] : []),
          { key: 'act', label: 'Actions', width: 210, render: r => <ActionButtons doc={r} openDoc={openDoc} /> },
        ]} rows={paged.slice} rowKey="id" />
        <Pagination total={paged.total} page={paged.page} pageSize={8} onChange={paged.setPage} />
      </div>
    </div>
  );
}

function POPage({ openDoc }) {
  const { db, account } = useApp();
  const C = (o) => docColumns(db, account, openDoc, o);
  const [seg, setSeg] = useState('mine');
  const [scope, setScope] = useState('me');
  const [formOpen, setFormOpen] = useState(false);
  const loading = useSkeleton([account.id, seg]);
  const isTenant = account.type === 'tenant';
  // UX #15 — hide empty-count tabs so zero-item queues don’t clutter the UI
  const fulfillCount = isTenant ? db.docs.filter(d => d.type === 'PO' && d.seller === account.tenantId && ['Pending Acceptance', 'Pending Payment', 'Pending Outbound'].includes(d.status)).length : 0;
  useEffect(() => {
    if (seg === 'fulfill' && fulfillCount === 0) setSeg('mine');
  }, [seg, fulfillCount]);
  let rows = [];
  if (isTenant && seg === 'mine') rows = db.docs.filter(d => d.type === 'PO' && d.buyer === account.tenantId && (scope === 'all' || d.createdBy === account.name));
  if (isTenant && seg === 'fulfill') rows = db.docs.filter(d => d.type === 'PO' && d.seller === account.tenantId && ['Pending Acceptance', 'Pending Payment', 'Pending Outbound'].includes(d.status));
  const paged = usePaged(rows);
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Purchase Orders</div>
          <div className="page-desc">Orders validate available stock and price compliance, and record the agency chain (ChainPath). Status: Draft → Pending Acceptance → Pending Payment → Pending Outbound → Pending Shipment → Pending Receipt → Received.</div>
        </div>
        <div className="page-actions">
          {isTenant && <div className="segments">
            <button className={`segment${seg === 'mine' ? ' active' : ''}`} onClick={() => setSeg('mine')}>My Orders</button>
            {fulfillCount > 0 && <button className={`segment${seg === 'fulfill' ? ' active' : ''}`} onClick={() => setSeg('fulfill')}>To Fulfill ({fulfillCount})</button>}
          </div>}
          {isTenant && seg === 'mine' && <button className="btn primary" onClick={() => setFormOpen(true)}><Icon name="plus" size={14} />New Order</button>}
        </div>
      </div>
      {isTenant && seg === 'mine' && (
        <Banner tone="info" icon="lock"><b>MVP data scope — personal records only.</b> {(() => {
          // P4 — the colleague example must come from THIS merchant, not a
          // counterparty (the old hardcoded name leaked a buyer-side name)
          const colleague = db.accounts.find(a => a.tenantId === account.tenantId && a.name !== account.name);
          return colleague
            ? `Drafts created by colleagues (e.g. ${colleague.name}) stay invisible until you switch scope or a record is submitted to a counterparty.`
            : 'Your drafts stay invisible to colleagues until a record is submitted to a counterparty.';
        })()}</Banner>
      )}
      {isTenant && seg === 'fulfill' && (
        <Banner tone="warning" icon="warehouse">Supply-side worklist: approve reviewed orders, then ship — shipping decrements your stock, generates an outbound doc + waybill, and pushes a WhatsApp link to the buyer.</Banner>
      )}
      <div className="card">
        {isTenant && seg === 'mine' && <div className="filter-bar"><span className="label">Data scope</span><ScopeSwitch value={scope} onChange={setScope} /><span className="label" style={{ marginLeft: 'auto' }}>{rows.length} records</span></div>}
        <Table loading={loading} columns={[
          ...C(),
          { key: 'chain', label: 'Chain Path', width: 230, render: r => (
            <div className="chain-path">
              {(r.chainPath || []).map((tid, i) => (
                <React.Fragment key={tid}>
                  {i > 0 && <span className="chain-arrow">›</span>}
                  <span className="chain-node">{tenantName(db, tid).split(' ')[0]}</span>
                </React.Fragment>
              ))}
            </div>
          )},
          { key: 'act', label: 'Actions', width: 210, render: r => <ActionButtons doc={r} openDoc={openDoc} /> },
        ]} rows={paged.slice} rowKey="id" />
        <Pagination total={paged.total} page={paged.page} pageSize={8} onChange={paged.setPage} />
      </div>
      {formOpen && <POFormDialog onClose={() => setFormOpen(false)} />}
    </div>
  );
}

function InventoryPage() {
  const { db, account, tenant } = useApp();
  const [q, setQ] = useState('');
  const [adjustId, setAdjustId] = useState(null);
  const loading = useSkeleton([account.id]);
  const stockMap = db.stock[account.tenantId] || {};
  // R14 — 告警阈值与 settings.lowStockThreshold 同源（AC-14-04，与 WhatsApp 提示同一口径）
  const lowTh = (db.settings || {}).lowStockThreshold != null ? Number((db.settings || {}).lowStockThreshold) : 30;
  const rows = db.products.filter(p => stockMap[p.id] != null && (!q || (p.name + p.model).toLowerCase().includes(q.toLowerCase())));
  const filtered = !!q;
  const paged = usePaged(rows);
  const lowStock = rows.filter(p => stockMap[p.id] < lowTh).length;
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Inventory</div>
          <div className="page-desc">Default Warehouse — auto-created by the system. Multi-warehouse and transfers are post-MVP. <span className="mini-chip mvp">MVP</span></div>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label"><Icon name="box" size={13} />SKUs in stock</div><div className="stat-value">{rows.length}</div><div className="stat-foot">Default Warehouse</div></div>
        <div className="stat-card"><div className="stat-label"><Icon name="warehouse" size={13} />Total units</div><div className="stat-value">{rows.reduce((s, p) => s + stockMap[p.id], 0).toLocaleString()}</div><div className="stat-foot">Across all SKUs</div></div>
        <div className="stat-card"><div className="stat-label"><Icon name="warn" size={13} />Low stock (&lt;30)</div><div className="stat-value" style={{ color: lowStock ? 'var(--warning)' : 'inherit' }}>{lowStock}</div><div className="stat-foot">Consider re-inquiry</div></div>
        <div className="stat-card"><div className="stat-label"><Icon name="refresh" size={13} />Movements</div><div className="stat-value">{db.movements.filter(m => m.tenantId === account.tenantId).length}</div><div className="stat-foot">Recorded transactions</div></div>
      </div>
      <div className="card">
        <div className="filter-bar">
          <SearchBox value={q} onChange={setQ} placeholder="Search product / model" width={240} />
          <span className="label">Warehouse</span>
          <Select value="w1" options={[{ value: 'w1', label: 'Default Warehouse (auto)' }]} style={{ width: 220 }} />
          <span className="label" style={{ marginLeft: 'auto' }}>{rows.length} SKUs</span>
        </div>
        <Table loading={loading} empty={filtered ? 'No SKUs match the search' : undefined} columns={[
          { key: 'name', label: 'Product', render: p => <div><div className="bold" style={{ fontSize: 13 }}>{p.name}</div><div className="cell-sub mono">{p.model} · {p.spec}</div></div> },
          { key: 'unit', label: 'Unit', width: 60, align: 'center' },
          { key: 'qty', label: 'On Hand', width: 110, align: 'center', render: p => <span className="mono bold" style={{ color: stockMap[p.id] < lowTh ? 'var(--warning)' : 'inherit' }}>{stockMap[p.id]} {t(p.unit)}</span> },
          { key: 'ref', label: 'Purchase Price', width: 150, align: 'right', render: p => <div style={{ textAlign: 'right' }}><Money amount={purchasePriceOf(p)} currency={purchaseCurrencyOf(p)} />{p.purchaseUpdatedAt ? <div className="cell-sub">{t('updated')} {p.purchaseUpdatedAt}</div> : null}</div> },
          { key: 'last', label: 'Last Movement', width: 150, render: p => {
            const m = db.movements.filter(x => x.tenantId === account.tenantId && x.productId === p.id).slice(-1)[0];
            return m ? <span className="small muted">{m.ts}<div className="cell-sub">{m.refNo}</div></span> : <span className="muted">—</span>;
          }},
          { key: 'act', label: 'Actions', width: 150, render: p => (
            <div className="row-actions">
              <button className="btn sm text info" onClick={() => setAdjustId(p.id)}><Icon name="warehouse" size={13} />Adjust</button>
            </div>
          )},
        ]} rows={paged.slice} rowKey="id" />
        <Pagination total={paged.total} page={paged.page} pageSize={8} onChange={paged.setPage} />
      </div>
      {adjustId && <AdjustStockDialog productId={adjustId} onClose={() => setAdjustId(null)} />}
    </div>
  );
}

function MovementsPage() {
  const { db, account } = useApp();
  const [pid, setPid] = useState('');
  const [wh, setWh] = useState('w1'); // single default warehouse in MVP
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // R08/AC-08-05 — 流水按来源筛选（自产 / 外购）。仅入库流水有来源语义，
  // 选定来源筛选时自动只看 IN，避免出库/调整流水混进来。
  const [src, setSrc] = useState('');
  const loading = useSkeleton([account.id, pid, type, from, to, wh, src]);
  const unitOf = pid => ((db.products.find(p => p.id === pid) || {}).unit) || '';
  const rows = db.movements.filter(m => {
    if (m.tenantId !== account.tenantId) return false;
    if (pid && m.productId !== pid) return false;
    if (type && m.type !== type) return false;
    if (from && m.ts.slice(0, 10) < from) return false;
    if (to && m.ts.slice(0, 10) > to) return false;
    if (src) {
      if (m.type !== 'IN') return false;
      const isSelf = !!m.selfProduced;
      if (src === 'self' && !isSelf) return false;
      if (src === 'external' && isSelf) return false;
    }
    return true;
  }).slice().reverse();
  const filtered = !!(pid || type || from || to || src);
  const TYPE_TONE = { IN: 'success', OUT: 'warning', ADJ: 'primary' };
  const TYPE_LABEL = { IN: 'Inbound', OUT: 'Outbound', ADJ: 'Adjustment' };
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Stock Movements</div>
          <div className="page-desc">Every stock change generates a movement record — filter by product, change type and date.</div>
        </div>
      </div>
      <div className="card">
        <div className="filter-bar">
          <span className="label">Product</span>
          <Select value={pid} onChange={setPid} placeholder="All products" style={{ width: 220 }}
            options={db.products.map(p => ({ value: p.id, label: p.name }))} />
          <span className="label">Warehouse</span>
          <Select value={wh} onChange={setWh} style={{ width: 200 }}
            options={[{ value: 'w1', label: 'Default Warehouse (auto)' }]} />
          <span className="label">Type</span>
          <Select value={type} onChange={setType} placeholder="All" style={{ width: 130 }}
            options={[{ value: 'IN', label: 'Inbound' }, { value: 'OUT', label: 'Outbound' }, { value: 'ADJ', label: 'Adjustment' }]} />
          <span className="label">Source</span>
          <Select value={src} onChange={setSrc} placeholder="All" style={{ width: 150 }}
            options={[{ value: 'self', label: 'Self-produced' }, { value: 'external', label: 'Externally sourced' }]} />
          <span className="label">From</span>
          <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 140 }} />
          <span className="label">To</span>
          <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 140 }} />
          <span className="label" style={{ marginLeft: 'auto' }}>{rows.length} records</span>
        </div>
        <Table loading={loading} empty={filtered ? 'No movements match the current filters' : undefined} emptyHint={filtered ? 'Try clearing the product, type or date filters' : undefined} columns={[
          { key: 'ts', label: 'Time', width: 140, render: m => <span className="small mono">{m.ts}</span> },
          { key: 'product', label: 'Product', render: m => <span style={{ fontSize: 13 }}>{productName(db, m.productId)}</span> },
          { key: 'type', label: 'Type', width: 100, render: m => <Tag tone={TYPE_TONE[m.type]}>{TYPE_LABEL[m.type]}</Tag> },
          { key: 'qty', label: 'Qty', width: 90, align: 'center', render: m => <span className="mono bold" style={{ color: m.qty > 0 ? 'var(--success)' : 'var(--warning)' }}>{m.qty > 0 ? '+' : ''}{m.qty}{unitOf(m.productId) && <React.Fragment> {unitOf(m.productId)}</React.Fragment>}</span> },
          { key: 'before', label: 'Before', width: 90, align: 'center', render: m => <span className="mono small muted">{m.before}{unitOf(m.productId) && <React.Fragment> {unitOf(m.productId)}</React.Fragment>}</span> },
          { key: 'after', label: 'After', width: 90, align: 'center', render: m => <span className="mono small">{m.after}{unitOf(m.productId) && <React.Fragment> {unitOf(m.productId)}</React.Fragment>}</span> },
          { key: 'amount', label: 'Amount', width: 160, align: 'right', render: m => (m.type === 'IN' && m.amount != null)
            ? <span className="small mono">{money(m.price, m.currency).text} × {Math.abs(m.qty)} = <b style={{ color: '#D35400' }}>{money(m.amount, m.currency).text}</b></span>
            : <span className="muted small">—</span> },
          { key: 'receiver', label: 'Receiver', width: 150, render: m => m.receiverName
            ? <span className="small">{m.receiverName}{m.receiverPhone ? <span className="mono muted"> · {m.receiverPhone}</span> : null}</span>
            : <span className="muted small">—</span> },
          { key: 'ref', label: 'Ref Doc', width: 150, render: m => <span className="mono small">{m.refNo}</span> },
          // R08/AC-08-03 — 自产流水没有供应商，但事由里有「自产」标记
          { key: 'supplier', label: 'Supplier', width: 140, render: m => m.supplierId
            ? <span className="small">{tenantName(db, m.supplierId)}</span>
            : (m.selfProduced ? <Tag tone="teal" dot>{t('Self-produced')}</Tag> : <span className="muted small">—</span>) },
          { key: 'by', label: 'By', width: 110, render: m => <span className="small">{m.by}</span> },
          { key: 'reason', label: 'Reason', render: m => <span className="small muted">{m.reason}</span> },
        ]} rows={rows} rowKey="id" />
      </div>
    </div>
  );
}

function OutboundPage({ openDoc }) {
  const { db, account } = useApp();
  const loading = useSkeleton([account.id]);
  const C = (o) => docColumns(db, account, openDoc, o);
  const rows = db.docs.filter(d => d.type === 'CK' && d.seller === account.tenantId);
  const paged = usePaged(rows);
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Outbound</div>
          <div className="page-desc">Shipment confirmation decrements stock, generates the outbound doc and waybill, then pushes a WhatsApp confirmation link to the buyer.</div>
        </div>
      </div>
      <Banner tone="info" icon="truck"><b>Flow:</b> approve order → ship with logistics info → waybill auto-generated → buyer confirms receipt via WhatsApp link. Outbound/inbound docs are system-generated (no manual creation).</Banner>
      <div className="card">
        <Table loading={loading} columns={[
          ...C({ cpLabel: 'Buyer' }),
          { key: 'waybill', label: 'Waybill', width: 150, render: r => r.waybill ? <span className="mono small">{r.waybill.no}<div className="cell-sub">{r.waybill.carrier}</div></span> : <span className="muted">—</span> },
          { key: 'act', label: 'Actions', width: 170, render: r => <ActionButtons doc={r} openDoc={openDoc} /> },
        ]} rows={paged.slice} rowKey="id" />
        <Pagination total={paged.total} page={paged.page} pageSize={8} onChange={paged.setPage} />
      </div>
    </div>
  );
}

function ReceivingPage({ openDoc }) {
  const { db, account } = useApp();
  const [scope, setScope] = useState('me');
  const loading = useSkeleton([account.id, scope]);
  const C = (o) => docColumns(db, account, openDoc, o);
  const pending = db.docs.filter(d => d.type === 'CK' && d.buyer === account.tenantId && d.status === 'Shipped');
  const history = db.docs.filter(d => d.type === 'RK' && d.buyer === account.tenantId && (scope === 'all' || d.createdBy === account.name));
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Receiving</div>
          <div className="page-desc">Inspect against the shipment doc. Accept / partial variance / reject — accepted quantities increase stock and generate the inbound record.</div>
        </div>
      </div>
      <Banner tone="info" icon="lock"><b>MVP data scope — personal records only.</b> Inbound records default to those generated from your own receiving confirmations. Switch to "Merchant Records" to preview a full-merchant scope (available post-MVP).</Banner>
      <div className="card">
        <div className="card-pad" style={{ paddingBottom: 4 }}>
          <div className="card-title">Awaiting Receiving <span className="mini-chip demo">{pending.length}</span></div>
        </div>
        {pending.length === 0 ? <EmptyState message="No shipments awaiting receiving" hint="Shipment docs confirmed by your supplier will appear here" /> : (
          <Table loading={loading} columns={[
            ...C({ cpLabel: 'Supplier' }),
            { key: 'act', label: 'Actions', width: 240, render: r => <ActionButtons doc={r} openDoc={openDoc} /> },
          ]} rows={pending} rowKey="id" />
        )}
      </div>
      <div className="card">
        <div className="card-pad" style={{ paddingBottom: 4 }}>
          <div className="card-title">Inbound Records <span className="hint">system-generated on receiving confirmation</span></div>
        </div>
        <div className="filter-bar"><span className="label">Data scope</span><ScopeSwitch value={scope} onChange={setScope} /><span className="label" style={{ marginLeft: 'auto' }}>{history.length} records</span></div>
        <Table loading={loading} columns={[
          ...C({ cpLabel: 'Supplier' }),
          { key: 'variance', label: 'Variance', width: 260, render: r => r.status === 'Partial Variance' ? <span className="small" style={{ color: 'var(--warning)' }}>{r.variance.reason}</span> : <Tag tone="success">All items match</Tag> },
          { key: 'act', label: 'Actions', width: 150, render: r => <ActionButtons doc={r} openDoc={openDoc} /> },
        ]} rows={history} rowKey="id" />
      </div>
    </div>
  );
}

function DocCenterPage({ openDoc, goPage }) {
  const { db, account, act, toast } = useApp();
  const isPlatform = account.type === 'platform';
  const [tab, setTab] = useState('ALL');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [cp, setCp] = useState('');
  const [sku, setSku] = useState('');
  const [fromD, setFromD] = useState('');
  const [toD, setToD] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [scope, setScope] = useState(isPlatform ? 'all' : 'me');
  const [selected, setSelected] = useState([]);
  // list polish (MVP doc-center): column sorting + custom visible columns
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [colsOpen, setColsOpen] = useState(false);
  const [hidden, setHidden] = useState([]);
  const loading = useSkeleton([account.id, tab]);
  useEffect(() => { setSelected([]); setStatus(''); }, [tab]);
  useEffect(() => { setScope(isPlatform ? 'all' : 'me'); }, [account.id]);
  // sortable headers (Created / Amount) + custom visible columns (list polish)
  const SORTABLE = { createdAt: 'Created', amount: 'Amount' };
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'createdAt' ? 'desc' : 'asc'); }
  };
  const baseCols = docColumns(db, account, openDoc, { showType: true });
  const cols = baseCols
    .filter(c => !hidden.includes(c.key))
    .map(c => SORTABLE[c.key] ? { ...c, label: (
      <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, userSelect: 'none' }} onClick={() => toggleSort(c.key)}>
        {SORTABLE[c.key]}
        <span style={{ fontSize: 10, color: sortKey === c.key ? 'var(--primary)' : 'var(--text-3)' }}>{sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </span>
    ) } : c);
  const TOGGLEABLE = baseCols.filter(c => c.key !== 'no');

  const visible = db.docs.filter(d => docVisible(db, account, d));
  const cpOptions = useMemo(() => {
    if (isPlatform) return db.tenants.map(t => ({ value: t.id, label: t.name }));
    const rel = [...relatedTenantIds(db, account.tenantId)].filter(id => id !== account.tenantId);
    return rel.map(id => ({ value: id, label: tenantName(db, id) }));
  }, [db, account]);

  const rows = visible.filter(d => {
    if (tab !== 'ALL' && d.type !== tab) return false;
    if (q && !d.no.toLowerCase().includes(q.toLowerCase())) return false;
    // R88 — PO/CK/RK filters carry display names: match the displayed status
    // too (e.g. the Shipped option catches PO rows at raw Pending Shipment /
    // Pending Receipt and CK rows at raw Shipped)
    if (status && d.status !== status && orderDisplayStatus(d) !== status) return false;
    if (cp) {
      if (d.buyer !== cp && d.seller !== cp) return false;
    }
    if (sku && !d.items.some(it => it.pid === sku)) return false;
    if (fromD && d.createdAt.slice(0, 10) < fromD) return false;
    if (toD && d.createdAt.slice(0, 10) > toD) return false;
    if (!isPlatform && scope === 'me' && d.createdBy !== account.name) return false;
    return true;
  });
  const sorted = useMemo(() => {
    const r = [...rows];
    if (sortKey === 'amount') r.sort((a, b) => (docAmount(a) - docAmount(b)) * (sortDir === 'asc' ? 1 : -1));
    else if (sortKey === 'createdAt') r.sort((a, b) => a.createdAt.localeCompare(b.createdAt) * (sortDir === 'asc' ? 1 : -1));
    else return r.reverse();
    return r;
  }, [rows, sortKey, sortDir]);
  const paged = usePaged(sorted, 10);
  // R85 — the PO (order) filter offers exactly the nine order-flow statuses
  // R87 — CK/RK option labels use the order-flow display names
  // R88 — PO/CK/RK options are the order-flow DISPLAY names (values = display
  // names, matching via orderDisplayStatus); other tabs keep raw values
  const statusOptions = tab === 'ALL' ? [] : tabStatusOptions(tab);

  const filtersActive = !!(q || status || cp || sku || fromD || toD);
  const hasUpstream = !isPlatform && db.relations.some(r => r.downstream === account.tenantId);

  const docEmpty = filtersActive ? 'No documents match the current filters'
    : (!isPlatform && scope === 'me') ? 'No documents created by you yet'
    : 'No documents yet';
  const docEmptyHint = filtersActive ? 'Try clearing the doc no, status, SKU or date filters'
    : (!isPlatform && scope === 'me') ? 'Get started by creating your first inquiry.'
    : (!isPlatform && hasUpstream) ? 'Contact your upstream supplier to send documents, or start an inquiry yourself.'
    : (!isPlatform) ? 'Get started by creating your first inquiry.'
    : 'Cross-merchant documents are visible for oversight.';
  const docEmptyAction = filtersActive ? undefined
    : !isPlatform ? (
      <button className="btn primary" onClick={() => goPage && goPage('inquiry')} style={{ marginTop: 12 }}>
        <Icon name="plus" size={14} />New Inquiry
      </button>
    ) : undefined;


  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Document Center</div>
          <div className="page-desc">Unified numbering across six document types (IQ / QT / PO / CK / RK / FP) plus auto-generated waybills (WY-): prefix-date-sequence, unique under concurrency. Sortable list with custom columns; three-part detail: header + line items + flow timeline.</div>
        </div>
        {!isPlatform && <div className="page-actions">
          <button className="btn" disabled={!selected.length} onClick={() => setExportOpen(true)}><Icon name="download" size={14} />Export ({selected.length})</button>
          <button className="btn" disabled={!selected.length} onClick={() => { act.logEvent('Batch Print', `${selected.length} documents from Document Center`); toast(`Batch print queued for ${selected.length} documents — data export event logged`, 'success'); setSelected([]); }}><Icon name="print" size={14} />Print</button>
        </div>}
      </div>
      {isPlatform ? (
        <Banner tone="warning" icon="lock"><b>Platform read-only view.</b> Cross-merchant documents are visible for oversight, but write actions (edit / submit / ship / receive / invoice) are hidden — MVP platform accounts have no write access to business data.</Banner>
      ) : (
        <Banner tone="info" icon="lock"><b>MVP data scope — personal records only by default.</b> Switch scope to "All visible" to include documents from linked business partners.</Banner>
      )}
      <div className="card">
        <div className="filter-bar">
          <div className="segments">
            {['ALL', 'IQ', 'QT', 'PO', 'CK', 'RK', 'FP'].map(t => (
              <button key={t} className={`segment${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t === 'ALL' ? 'All' : t}</button>
            ))}
          </div>
        </div>
        <div className="filter-bar" style={{ borderTop: '1px solid var(--border-light)' }}>
          <SearchBox value={q} onChange={setQ} placeholder="Doc No" width={180} />
          {statusOptions.length > 0 && <React.Fragment>
            <span className="label">Status</span>
            <Select value={status} onChange={setStatus} placeholder="All" style={{ width: 150 }} options={statusOptions} />
          </React.Fragment>}
          <span className="label">Counterparty</span>
          <Select value={cp} onChange={setCp} placeholder="All" style={{ width: 180 }} options={cpOptions} />
          <span className="label">SKU</span>
          <Select value={sku} onChange={setSku} placeholder="All SKUs" style={{ width: 190 }}
            options={db.products.map(p => ({ value: p.id, label: p.name }))} />
          <span className="label">Date</span>
          <input className="input" type="date" value={fromD} onChange={e => setFromD(e.target.value)} style={{ width: 140 }} />
          <span className="muted">→</span>
          <input className="input" type="date" value={toD} onChange={e => setToD(e.target.value)} style={{ width: 140 }} />
          {!isPlatform && <React.Fragment>
            <span className="label">Scope</span>
            <ScopeSwitch value={scope} onChange={setScope} />
          </React.Fragment>}
          <div style={{ marginLeft: 'auto', position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="label">{rows.length} documents</span>
            <div style={{ position: 'relative' }}>
              <button className="btn sm" onClick={() => setColsOpen(o => !o)}><Icon name="settings" size={13} />Columns</button>
              {colsOpen && (
                <div style={{ position: 'absolute', right: 0, top: '115%', background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(23,35,47,0.14)', padding: '10px 14px', zIndex: 60, minWidth: 160 }}>
                  {TOGGLEABLE.map(c => (
                    <label key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, padding: '4px 0', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={!hidden.includes(c.key)} onChange={() => setHidden(h => (h.includes(c.key) ? h.filter(k => k !== c.key) : [...h, c.key]))} />
                      {typeof c.label === 'string' ? c.label : SORTABLE[c.key]}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <Table loading={loading} selectable={selected.length > 0 || true} selectedKeys={selected} onSelectedChange={setSelected}
          empty={docEmpty} emptyHint={docEmptyHint} emptyAction={docEmptyAction}
          columns={[
            ...cols,
            { key: 'act', label: 'Actions', width: 210, render: r => <ActionButtons doc={r} openDoc={openDoc} /> },
          ]} rows={paged.slice} rowKey="id" />
        <Pagination total={paged.total} page={paged.page} pageSize={10} onChange={paged.setPage} />
        {exportOpen && <ExportDialog docs={db.docs.filter(d => selected.includes(d.id))} onClose={() => { setExportOpen(false); setSelected([]); }} />}
      </div>
    </div>
  );
}

function InvoicePage({ openDoc }) {
  const { db, account, toast } = useApp();
  const loading = useSkeleton([account.id]);
  const rows = db.docs.filter(d => d.type === 'FP' && docVisible(db, account, d));
  const paged = usePaged(rows);
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Invoices</div>
          <div className="page-desc">Sales invoices (FP-) are auto-issued after order fulfillment. Download available; payment is completed offline. <span className="mini-chip mvp">MVP</span></div>
        </div>
      </div>
      <Banner tone="info" icon="receipt">Red-flush, reconciliation, settlement and credit terms are post-MVP capabilities and intentionally absent. Export/download actions are logged as data-outbound events.</Banner>
      <div className="card">
        <Table loading={loading} columns={[
          { key: 'no', label: 'Invoice No', width: 150, render: r => <span className="doc-no" onClick={() => openDoc(r.id)}>{r.no}</span> },
          { key: 'seller', label: 'Seller', render: r => tenantName(db, r.seller) },
          { key: 'buyer', label: 'Buyer', render: r => tenantName(db, r.buyer) },
          { key: 'po', label: 'Order Ref', width: 150, render: r => <span className="mono small">{r.poNo}</span> },
          { key: 'ck', label: 'Outbound Ref', width: 150, render: r => <span className="mono small">{r.ckNo || '—'}</span> },
          { key: 'amount', label: 'Amount', width: 150, align: 'right', render: r => <Money amount={docAmount(r)} currency={r.currency} /> },
          { key: 'issueDate', label: 'Issue Date', width: 110, render: r => <span className="small">{r.issueDate}</span> },
          { key: 'status', label: 'Status', width: 110, render: r => <StatusTag type="FP" status={r.status} /> },
          { key: 'act', label: 'Actions', width: 180, render: r => <ActionButtons doc={r} openDoc={openDoc} /> },
        ]} rows={paged.slice} rowKey="id" />
        <Pagination total={paged.total} page={paged.page} pageSize={8} onChange={paged.setPage} />
      </div>
    </div>
  );
}

function AccountMgmtPage() {
  const { db, account, tenant, act, toast } = useApp();
  const isPlatform = account.type === 'platform';
  // round-25 account-creation matrix — every role manages its own scope:
  // platform → any tenant + platform accounts; supplier/agent/sub → own tenant members
  const isAgent = tenantRole(db, account, tenant) === 'agent';
  const ownTenant = db.tenants.find(t => t.id === account.tenantId);
  // agents with remaining depth may develop sub-agents
  // (a maxLevel-1 agent — a sub-distributor — cannot develop further downstream)
  const canCreateSubAgent = !isPlatform && ownTenant && Number(ownTenant.maxLevel) > 1;
  const [dialog, setDialog] = useState(null); // {} | {editAcc} | {subAgent:true}
  const [q, setQ] = useState('');
  const [confirmDisable, setConfirmDisable] = useState(null);
  // MVP #38-#40 — platform tenant management lives on the account page too
  const [tenantDlg, setTenantDlg] = useState(null); // 'tenant' | 'relation'
  const [deactivate, setDeactivate] = useState(null);
  // MVP #43 — bind WhatsApp channel for an account
  const [bindAcc, setBindAcc] = useState(null);
  const loading = useSkeleton([account.id]);
  const rows = db.accounts.filter(a => {
    if (isPlatform) return true;
    if (a.tenantId !== account.tenantId) return false;
    return true;
  }).filter(a => !q || (a.name + a.phone).toLowerCase().includes(q.toLowerCase()));
  const downstream = isPlatform ? [] : [...relatedTenantIds(db, account.tenantId)].filter(id => id !== account.tenantId);
  const canManage = true; // round-25 matrix: platform + supplier/agent/sub all manage accounts in their scope
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Accounts</div>
          <div className="page-desc">{isPlatform
            ? 'Platform admins can create platform accounts, accounts of any merchant (optionally master), supplier / agent merchants with their master accounts, and establish supply relations; business data remains read-only. The account list includes the platform admin account — the mobile platform overview counts merchant accounts only.'
            : isAgent
              ? 'Agent member management — create and manage sub-accounts of your own merchant; permissions are flattened in MVP, differences come from data scope and business relations.'
              : 'Create and manage accounts of your own merchant (and develop sub-agent merchants where your level allows); permissions are flattened in MVP — no roles, no resource config.'}{' '}<span className="mini-chip mvp">MVP</span></div>
        </div>
        {canManage && <div className="page-actions">
          {isPlatform && <React.Fragment>
            <button className="btn" onClick={() => setTenantDlg('relation')}><Icon name="link" size={14} />Establish Supply Relation</button>
            <button className="btn" onClick={() => setTenantDlg('tenant')}><Icon name="building" size={14} />Create Merchant</button>
          </React.Fragment>}
          {canCreateSubAgent ? (
            <button className="btn" onClick={() => setDialog({ subAgent: true })}><Icon name="whatsapp" size={14} />New Sub-Agent Master Account</button>
          ) : (!isPlatform && ownTenant && ownTenant.maxLevel != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <button className="btn" disabled style={{ opacity: 0.55, cursor: 'not-allowed' }} title={`You can develop up to ${ownTenant.maxLevel} levels of sub-agents`}>
                <Icon name="whatsapp" size={14} />New Sub-Agent Master Account
              </button>
              <span className="muted" style={{ fontSize: 12 }}>{`You can develop up to ${ownTenant.maxLevel} levels of sub-agents`}</span>
            </span>
          ))}
          <button className="btn primary" onClick={() => setDialog({})}><Icon name="plus" size={14} />New Account</button>
        </div>}
      </div>
      {isPlatform ? (
        <Banner tone="info" icon="shield"><b>Platform view.</b> Platform admins can create platform accounts and accounts for any merchant (optionally master), create supplier / agent merchants with their master accounts, and suspend violating merchants; business data remains read-only.</Banner>
      ) : isAgent ? (
        <Banner tone="info" icon="lock"><b>Agent member management.</b> You can create sub-accounts of your own merchant; permissions are flattened in MVP — every account shares the same action set, differences come from data scope and business relations.</Banner>
      ) : (
        <Banner tone="info" icon="lock">You can create and manage accounts of your own merchant (and develop sub-agent merchants where your level allows). All merchant accounts share the same flattened permissions — differences come from data scope and business relations, not roles.</Banner>
      )}
      <div className="card">
        <div className="filter-bar">
          <SearchBox value={q} onChange={setQ} placeholder="Search name / phone" width={240} />
          {!isPlatform && <span className="label">Merchant: {(db.tenants.find(t => t.id === account.tenantId) || {}).name}</span>}
          <span className="label" style={{ marginLeft: 'auto' }}>{rows.length} accounts</span>
        </div>
        <Table loading={loading} columns={[
          { key: 'name', label: 'Name', render: a => (
            <div className="flex gap10">
              <span className={`avatar ${a.type === 'platform' ? 'plat' : 'tenant'}`}>{a.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
              <div>
                <div className="bold" style={{ fontSize: 13 }}>{a.name} {a.main && <Tag tone="primary">Main</Tag>}</div>
                <div className="cell-sub mono">{a.phone}</div>
              </div>
            </div>
          )},
          { key: 'tenant', label: 'Merchant', render: a => a.tenantId ? tenantName(db, a.tenantId) : <Tag tone="purple">Platform</Tag> },
          { key: 'wa', label: 'WhatsApp', width: 150, render: a => a.whatsapp ? <span className="mono small"><Icon name="whatsapp" size={12} /> {a.whatsapp}</span> : <span className="muted">—</span> },
          { key: 'scope', label: 'Data Scope', width: 120, render: () => <Tag tone="info">Personal only</Tag> },
          { key: 'status', label: 'Status', width: 100, render: a => a.status === 'Active' ? <Tag tone="success" dot>Active</Tag> : <Tag tone="danger" dot>Disabled</Tag> },
          { key: 'act', label: 'Actions', width: 220, render: a => (
            <div className="row-actions">
              {!isPlatform && <button className="btn sm text info" onClick={() => setBindAcc(a)}><Icon name="whatsapp" size={13} />{a.whatsapp ? 'Bind WA' : 'Bind WhatsApp'}</button>}
              <button className="btn sm text info" onClick={() => setDialog({ editAcc: a })}><Icon name="edit" size={13} />Edit</button>
              {a.status === 'Active'
                ? <button className="btn sm text error-text" onClick={() => setConfirmDisable(a)}><Icon name="lock" size={13} />Disable</button>
                : <button className="btn sm text success-text" onClick={() => toast('Account enabled (demo)', 'success')}><Icon name="check" size={13} />Enable</button>}
            </div>
          )},
        ]} rows={rows} rowKey="id" />
      </div>
      {/* MVP #38-#40 — platform-only tenant list with deactivate (two-step confirm) */}
      {isPlatform && (
        <div className="card">
          <div className="card-pad" style={{ paddingBottom: 4 }}>
            <div className="card-title">Merchant Management <span className="hint">platform admin only — create, relate and deactivate merchants</span></div>
          </div>
          <Table columns={[
            { key: 'code', label: 'Code', width: 80, render: t => <span className="mono small">{t.code}</span> },
            { key: 'name', label: 'Merchant', render: t => <div><span className="bold" style={{ fontSize: 13 }}>{t.name}</span><div className="cell-sub">{t.country}</div></div> },
            { key: 'type', label: 'Type', width: 100, render: t => <TenantTag type={t.type} /> },
            { key: 'maxLevel', label: 'Max Agent Levels', width: 120, align: 'center', render: t => ifnull(t.maxLevel, '—') },
            { key: 'rel', label: 'Relations', width: 130, render: t => {
              const up = db.relations.filter(r => r.downstream === t.id).length;
              const down = db.relations.filter(r => r.upstream === t.id).length;
              return <span className="small muted">{up} up · {down} down</span>;
            }},
            { key: 'status', label: 'Status', width: 110, render: t => t.status === 'Active' ? <Tag tone="success" dot>Active</Tag> : <Tag tone="danger" dot>Suspended</Tag> },
            { key: 'act', label: 'Actions', width: 150, render: t => (
              <div className="row-actions">
                {t.status === 'Active'
                  ? <button className="btn sm text error-text" onClick={() => setDeactivate(t)}><Icon name="lock" size={13} />Deactivate</button>
                  : <button className="btn sm text success-text" onClick={() => toast(`Merchant ${t.name} reactivated`, 'success')}><Icon name="refresh" size={13} />Reactivate</button>}
              </div>
            )},
          ]} rows={db.tenants} rowKey="id" />
        </div>
      )}
      {dialog && <AccountFormDialog mode={dialog} onClose={() => setDialog(null)} />}
      {tenantDlg === 'tenant' && <TenantFormDialog onClose={() => setTenantDlg(null)} />}
      {tenantDlg === 'relation' && <RelationDialog onClose={() => setTenantDlg(null)} />}
      {bindAcc && <BindWhatsAppDialog acc={bindAcc} onClose={() => setBindAcc(null)} />}
      {confirmDisable && (
        <ConfirmDialog title={confirmDisable.main ? 'Disable Main Account' : 'Disable Account'} danger confirmText="Disable"
          message={confirmDisable.main
            ? `"${confirmDisable.name}" is the MAIN account of ${(db.tenants.find(t => t.id === confirmDisable.tenantId) || {}).name}. Disabling it blocks merchant-wide sign-in and WhatsApp push delivery for every member — double-check before confirming.`
            : `Disable account "${confirmDisable.name}"? The user will no longer be able to sign in. Related data is retained.`}
          onConfirm={() => toast(`Account ${confirmDisable.name} disabled`, 'success')} onClose={() => setConfirmDisable(null)} />
      )}
      {deactivate && (
        <ConfirmDialog title={`Deactivate ${deactivate.name}`} danger confirmText="Deactivate Merchant" requireText={deactivate.code}
          message={`Deactivate merchant "${deactivate.name}"? Are you sure? This merchant will be banned from login but data will be retained.`}
          onConfirm={() => act.suspendTenant(deactivate.id)} onClose={() => setDeactivate(null)} />
      )}
    </div>
  );
}

// ---------- R02 — Team / Distributors split ----------
// Two collections, two pages, one shared derivation (data.jsx deriveTeam /
// deriveDistributors) so the Web console and the H5 app can never drift:
//   Team        = accounts of my own merchant (master account excluded)
//   Distributors= downstream merchants in the relation graph (they are tenants,
//                 not rows in db.accounts)
// Do NOT filter by account.type — db.accounts holds no distributor rows and
// sub-accounts carry no dedicated type.
function TeamPage() {
  const { db, account, act, toast } = useApp();
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState(null);
  const [edit, setEdit] = useState(null);
  const loading = useSkeleton([account.id, 'team']);
  const members = deriveTeam(db, account);
  const rows = members.filter(a => !q || ((a.name || '') + (a.phone || '')).toLowerCase().includes(q.toLowerCase()));
  const waBound = members.filter(a => a.whatsapp).length;
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Team</div>
          <div className="page-desc">Team members are the accounts of <b>your own merchant</b> — sub-accounts that sign in with the same data scope. Distributors (downstream merchants) are managed separately on the Distributors page. <span className="mini-chip mvp">MVP</span></div>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setDialog({})}><Icon name="plus" size={14} />New Sub-Account</button>
        </div>
      </div>
      <Banner tone="info" icon="users">
        <b>Scope:</b> only accounts belonging to {(db.tenants.find(t => t.id === account.tenantId) || {}).name} are listed here ({members.length}). Distributor merchants are listed under <b>Distributors</b> — creating a sub-account never changes the distributor list, and creating a distributor never changes this list.
      </Banner>
      <div className="card">
        <div className="filter-bar">
          <SearchBox value={q} onChange={setQ} placeholder="Search name / phone" width={240} />
          <span className="label">Members: {members.length}</span>
          <span className="label">WhatsApp bound: {waBound}/{members.length}</span>
          <span className="label" style={{ marginLeft: 'auto' }}>{`${rows.length} shown`}</span>
        </div>
        <Table loading={loading} rows={rows} rowKey={r => r.id} columns={[
          { key: 'name', label: 'Name', render: a => (
            <div className="flex gap10">
              <span className="avatar tenant">{a.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
              <div>
                <div className="bold" style={{ fontSize: 13 }}>{a.name}</div>
                <div className="cell-sub mono">{a.phone}</div>
              </div>
            </div>
          )},
          { key: 'wa', label: 'WhatsApp', width: 160, render: a => a.whatsapp ? <span className="mono small"><Icon name="whatsapp" size={12} /> {a.whatsapp}</span> : <span className="muted">—</span> },
          { key: 'status', label: 'Status', width: 110, render: a => <Tag tone={a.status === 'Active' ? 'green' : 'gray'}>{a.status || 'Active'}</Tag> },
          { key: 'ops', label: '', width: 90, render: a => <button className="btn sm" onClick={() => setEdit(a)}>Edit</button> },
        ]} />
      </div>
      {dialog && <AccountFormDialog mode={{ team: true }} onClose={() => setDialog(null)} />}
      {edit && <AccountFormDialog mode={{ editAcc: edit }} onClose={() => setEdit(null)} />}
    </div>
  );
}

function DistributorPage() {
  const { db, account, act, toast } = useApp();
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState(null);
  const [levelDlg, setLevelDlg] = useState(null);
  const [inviteDlg, setInviteDlg] = useState(false);    // R09 邀请分销商弹窗
  const [accDlg, setAccDlg] = useState(false);          // AC-09-07 受理邀请弹窗
  const loading = useSkeleton([account.id, 'dist']);
  const own = db.tenants.find(t => t.id === account.tenantId);
  const list = deriveDistributors(db, account);
  const rows = list.filter(t => !q || (t.name + t.code).toLowerCase().includes(q.toLowerCase()));
  const grantMax = own && own.type === 'Agent' ? Math.max(1, Number(own.maxLevel) - 1) : 99;
  const canCreate = !!own && (own.type === 'Supplier' || Number(own.maxLevel) > 1);
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Distributors</div>
          <div className="page-desc">Distributors are <b>downstream merchants</b> in your relation graph — separate companies, not accounts of yours. Creating one registers a new merchant, its master account and the supply relation in one step. <span className="mini-chip mvp">MVP</span></div>
        </div>
        <div className="page-actions">
          {/* R09 — 邀请分销商：发邀请码建立关系（与当场新建商户分开） */}
          <button className="btn" onClick={() => setInviteDlg(true)}><Icon name="link" size={14} />Invite Distributor</button>
          {/* AC-09-07 — 被邀请方受理入口（与邀请入口并列，两端同构） */}
          <button className="btn" onClick={() => setAccDlg(true)}><Icon name="check" size={14} />{t('I have an invite code')}</button>
          {canCreate
            ? <button className="btn primary" onClick={() => setDialog({ subAgent: true })}><Icon name="plus" size={14} />New Distributor</button>
            : <span className="muted" style={{ fontSize: 12 }}>{own ? t(`You can develop up to ${own.maxLevel} levels of sub-agents`) : ''}</span>}
        </div>
      </div>
      <Banner tone="info" icon="link">
        <b>Scope:</b> only merchants linked downstream of {t((own || {}).name || 'your merchant')} ({list.length}). Sub-accounts of your own merchant are listed under <b>Team</b> and never appear here.
      </Banner>
      <div className="card">
        <div className="filter-bar">
          <SearchBox value={q} onChange={setQ} placeholder="Search merchant" width={240} />
          <span className="label">Distributors: {list.length}</span>
          <span className="label" style={{ marginLeft: 'auto' }}>{`${rows.length} shown`}</span>
        </div>
        <Table loading={loading} rows={rows} rowKey={r => r.id} columns={[
          { key: 'name', label: 'Merchant', render: t => (
            <div>
              <div className="bold" style={{ fontSize: 13 }}>{t.name}</div>
              <div className="cell-sub mono">{t.code}</div>
            </div>
          )},
          { key: 'level', label: 'Level', width: 170, render: t => (
            <div className="flex gap6" style={{ alignItems: 'center' }}>
              <span>{t.levelLabel || tenantRoleLabel(db, account, t)}</span>
              <button className="btn sm" title="Set a custom level label" onClick={() => setLevelDlg(t)}>Set Label</button>
            </div>
          )},
          { key: 'max', label: 'Max sub-level', width: 110, render: t => <span className="mono">{t.maxLevel}</span> },
          { key: 'status', label: 'Status', width: 110, render: t => <Tag tone={t.status === 'Active' ? 'green' : 'gray'}>{t.status}</Tag> },
        ]} />
      </div>
      {dialog && <AccountFormDialog mode={dialog} onClose={() => setDialog(null)} />}
      {levelDlg && <LevelLabelDialog tenant={levelDlg} onClose={() => setLevelDlg(null)} />}
      {inviteDlg && <InviteDialog role="distributor" onClose={() => setInviteDlg(false)} />}
      {accDlg && <AcceptInviteDialog onClose={() => setAccDlg(false)} />}
    </div>
  );
}

function TenantMgmtPage() {
  const { db, act, toast } = useApp();
  const [tab, setTab] = useState('merchants');
  const [q, setQ] = useState('');
  const [typeF, setTypeF] = useState('');
  const [statusF, setStatusF] = useState('');
  const [dialog, setDialog] = useState(null); // {tenant:true} | {relation:true} | {edit:t} | {detail:t}
  const [suspend, setSuspend] = useState(null);
  const [dissolve, setDissolve] = useState(null);
  const loading = useSkeleton([tab]);
  const rows = db.tenants.filter(t => {
    if (q && !(t.name + t.code).toLowerCase().includes(q.toLowerCase())) return false;
    if (typeF && t.type !== typeF) return false;
    if (statusF && t.status !== statusF) return false;
    return true;
  });
  const relOf = t => ({
    up: db.relations.filter(r => r.downstream === t.id).map(r => r.upstream),
    down: db.relations.filter(r => r.upstream === t.id).map(r => r.downstream),
  });
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Merchants & Relations</div>
          <div className="page-desc">Platform operations: create merchants (type / country / max agent levels), establish supply relations (unique per pair), suspend violating merchants (login blocked, data retained). <span className="mini-chip mvp">MVP</span></div>
        </div>
        <div className="page-actions">
          {tab === 'merchants'
            ? <button className="btn primary" onClick={() => setDialog({ tenant: true })}><Icon name="plus" size={14} />New Merchant</button>
            : <button className="btn primary" onClick={() => setDialog({ relation: true })}><Icon name="plus" size={14} />New Relation</button>}
        </div>
      </div>
      <div className="card">
        <div className="filter-bar">
          <div className="segments">
            <button className={`segment${tab === 'merchants' ? ' active' : ''}`} onClick={() => setTab('merchants')}>Merchants</button>
            <button className={`segment${tab === 'relations' ? ' active' : ''}`} onClick={() => setTab('relations')}>Supply Relations</button>
          </div>
        </div>
        {tab === 'merchants' ? (
          <React.Fragment>
            <div className="filter-bar" style={{ borderTop: '1px solid var(--border-light)' }}>
              <SearchBox value={q} onChange={setQ} placeholder="Search name / code" width={220} />
              <span className="label">Type</span>
              <Select value={typeF} onChange={setTypeF} placeholder="All" style={{ width: 130 }} options={[{ value: 'Supplier', label: 'Supplier' }, { value: 'Agent', label: 'Agent' }]} />
              <span className="label">Status</span>
              <Select value={statusF} onChange={setStatusF} placeholder="All" style={{ width: 130 }} options={[{ value: 'Active', label: 'Active' }, { value: 'Suspended', label: 'Suspended' }]} />
            </div>
            <Table loading={loading} columns={[
              { key: 'code', label: 'Code', width: 80, render: t => <span className="mono small">{t.code}</span> },
              { key: 'name', label: 'Merchant', render: t => <div><span className="bold" style={{ fontSize: 13 }}>{t.name}</span><div className="cell-sub">{t.country}</div></div> },
              { key: 'type', label: 'Type', width: 100, render: t => <TenantTag type={t.type} /> },
              { key: 'maxLevel', label: 'Max Agent Levels', width: 120, align: 'center', render: t => ifnull(t.maxLevel, '—') },
              { key: 'rel', label: 'Relations', render: t => {
                const { up, down } = relOf(t);
                return <span className="small muted">{up.length} upstream · {down.length} downstream</span>;
              }},
              { key: 'status', label: 'Status', width: 110, render: t => t.status === 'Active' ? <Tag tone="success" dot>Active</Tag> : <Tag tone="danger" dot>Suspended</Tag> },
              // R01 — 入驻状态列 + 行内通过/驳回（AC-01-05/07）；render 参数 tn 避免遮蔽 i18n 的 t()
              { key: 'reg', label: 'Onboarding', width: 170, render: tn => (
                <div className="flex gap6" style={{ alignItems: 'center' }}>
                  {tn.registrationStatus === 'pending' ? <Tag tone="warning" dot>{t('Pending Review')}</Tag>
                    : tn.registrationStatus === 'rejected' ? <Tag tone="danger">{t('Rejected')}</Tag>
                    : <Tag tone="success">{t('Approved')}</Tag>}
                  {tn.registrationStatus === 'pending' && (
                    <React.Fragment>
                      <button className="btn sm text success-text" onClick={() => act.setRegistrationStatus(tn.id, 'approved')}>{t('Approve')}</button>
                      <button className="btn sm text error-text" onClick={() => act.setRegistrationStatus(tn.id, 'rejected')}>{t('Reject')}</button>
                    </React.Fragment>
                  )}
                </div>
              )},
              { key: 'createdAt', label: 'Created', width: 100, render: t => <span className="small muted">{t.createdAt}</span> },
              { key: 'act', label: 'Actions', width: 220, render: t => (
                <div className="row-actions">
                  <button className="btn sm text info" onClick={() => setDialog({ detail: t })}><Icon name="eye" size={13} />View</button>
                  <button className="btn sm text info" onClick={() => setDialog({ edit: t })}><Icon name="edit" size={13} />Edit</button>
                  {t.status === 'Active'
                    ? <button className="btn sm text error-text" onClick={() => setSuspend(t)}><Icon name="lock" size={13} />Suspend</button>
                    : <button className="btn sm text success-text" onClick={() => toast(`Merchant ${t.name} reactivated`, 'success')}><Icon name="refresh" size={13} />Reactivate</button>}
                </div>
              )},
            ]} rows={rows} rowKey="id" />
          </React.Fragment>
        ) : (
          <Table loading={loading} columns={[
            { key: 'up', label: 'Upstream (Supplier)', render: r => <span className="bold" style={{ fontSize: 13 }}>{tenantName(db, r.upstream)}</span> },
            { key: 'down', label: 'Downstream (Agent)', render: r => <span className="bold" style={{ fontSize: 13 }}>{tenantName(db, r.downstream)}</span> },
            { key: 'since', label: 'Established', width: 130, render: r => <span className="small muted">{r.createdAt}</span> },
            { key: 'uniqueness', label: 'Uniqueness', width: 220, render: () => <span className="small muted">One relation per merchant pair (same-type unique)</span> },
            { key: 'act', label: 'Actions', width: 110, render: r => (
              <div className="row-actions">
                <button className="btn sm text error-text" onClick={() => setDissolve(r)}><Icon name="close" size={13} />Dissolve</button>
              </div>
            )},
          ]} rows={db.relations} rowKey="createdAt" />
        )}
      </div>
      {dialog && dialog.tenant && <TenantFormDialog onClose={() => setDialog(null)} />}
      {dialog && dialog.relation && <RelationDialog onClose={() => setDialog(null)} />}
      {dialog && dialog.edit && <TenantFormDialog editTenant={dialog.edit} onClose={() => setDialog(null)} />}
      {dialog && dialog.detail && <TenantDetailDialog tenant={dialog.detail} onClose={() => setDialog(null)} />}
      {suspend && (
        <ConfirmDialog title={`Suspend ${suspend.name}`} danger confirmText="Suspend Merchant" requireText={suspend.code}
          message={`Suspend merchant "${suspend.name}"? All of its users will be blocked from signing in immediately. Business data is retained for audit. This is a two-step confirmation.`}
          onConfirm={() => act.suspendTenant(suspend.id)} onClose={() => setSuspend(null)} />
      )}
      {dissolve && (
        <ConfirmDialog title="Dissolve Supply Relation" danger confirmText="Dissolve"
          message={`Dissolve the supply relation ${tenantName(db, dissolve.upstream)} → ${tenantName(db, dissolve.downstream)}? The downstream merchant immediately loses visibility of upstream products. Historical documents are retained.`}
          onConfirm={() => act.removeRelation(dissolve.upstream, dissolve.downstream)} onClose={() => setDissolve(null)} />
      )}
    </div>
  );
}

Object.assign(window, { WebConsole, ActionButtons, WEB_MENU, tenantRole, tenantRoleLabel });

// ============================================================
// R06 —— 商品列表顶部的「待调价」提醒条：待办入口，可找回并继续调价
// ============================================================
function PendingRepriceBanner({ onOpen }) {
  const { db } = useApp();
  const pend = (db.products || []).filter(p => p.pendingReprice);
  if (!pend.length) return null;
  return (
    <div className="wiz-banner">
      <Icon name="info" size={14} />
      <span>{t('Pending price adjustment')} — {tItems(pend.length)}</span>
      <button type="button" className="btn" style={{ height: 28, marginLeft: 'auto' }} onClick={() => onOpen(pend.map(p => p.id))}>{t('Continue pricing')}</button>
    </div>
  );
}

// ============================================================
// R10 / R12 / R13 / R14 / R15 —— 系统设置页（Web 版，与 H5 同源）
// ============================================================
function SettingsPage() {
  const { db, act, toast } = useApp();
  const s = db.settings || {};
  const [taxRate, setTaxRate] = useState(s.taxRate === null || s.taxRate === undefined ? '' : String(s.taxRate));
  const [freightEnabled, setFreightEnabled] = useState(!!s.freightEnabled);
  const [defaultFreight, setDefaultFreight] = useState(String(ifnull(s.defaultFreight, 0)));
  const [quoteMode, setQuoteMode] = useState(s.quoteMode || 'manual');
  const [threshold, setThreshold] = useState(String(ifnull(s.lowStockThreshold, 30)));
  const [payee, setPayee] = useState(s.payeeInfo || { bankName: '', accountName: '', accountNo: '', swift: '', methods: [] });
  // R13 — AI 折扣边界设置（AC-13-07：未配置时默认 97 折 / 每轮 1% / 最多 3 轮）
  const [ai, setAi] = useState(s.aiPolicy || { floorDiscount: 0.97, stepSize: 0.01, maxRounds: 3, escalateTo: 'main', allowOverride: false });
  const save = () => {
    const rate = taxRate === '' ? null : Number(taxRate);
    const aiNum = (v, d) => { const n = Number(v); return (v === '' || v === null || isNaN(n)) ? d : n; };
    act.updateSettings({
      taxRate: (rate === null || isNaN(rate)) ? null : rate,
      freightEnabled, defaultFreight: Number(defaultFreight) || 0,
      quoteMode, lowStockThreshold: Number(threshold) || 0,
      payeeInfo: { ...payee, configured: !!(payee.bankName && payee.accountNo) },
      aiPolicy: { enabled: true, floorDiscount: aiNum(ai.floorDiscount, 0.97), stepSize: aiNum(ai.stepSize, 0.01), maxRounds: Math.max(1, Math.round(aiNum(ai.maxRounds, 3))), escalateTo: ai.escalateTo || 'main', allowOverride: !!ai.allowOverride },
    });
    toast('Settings updated', 'success');
  };
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div className="card-title">{t('VAT & courier fee')}</div>
        <div className="flex gap10" style={{ alignItems: 'center', marginBottom: 10 }}>
          <span className="k" style={{ width: 150 }}>{t('VAT rate (%)')}</span>
          <input className="input mono" style={{ width: 120, height: 32 }} type="number" step="0.01" value={taxRate}
            placeholder={t('Not set')} onChange={e => setTaxRate(e.target.value)} />
          <span className="muted small">{t('Leave empty to turn tax off')}</span>
        </div>
        <div className="flex gap10" style={{ alignItems: 'center', marginBottom: 10 }}>
          <span className="k" style={{ width: 150 }}>{t('Enable courier fee')}</span>
          <input type="checkbox" checked={freightEnabled} onChange={e => setFreightEnabled(e.target.checked)} />
        </div>
        <div className="flex gap10" style={{ alignItems: 'center' }}>
          <span className="k" style={{ width: 150 }}>{t('Default courier fee')}</span>
          <input className="input mono" style={{ width: 120, height: 32 }} type="number" step="0.01" value={defaultFreight}
            onChange={e => setDefaultFreight(e.target.value)} />
        </div>
      </div>
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div className="card-title">{t('Quote & inventory')}</div>
        <div className="flex gap10" style={{ alignItems: 'center', marginBottom: 10 }}>
          <span className="k" style={{ width: 150 }}>{t('Quote mode')}</span>
          <Select value={quoteMode} onChange={v => setQuoteMode(v)} style={{ width: 200, height: 32 }}
            options={[{ value: 'manual', label: t('Quote mode manual') }, { value: 'auto', label: t('Quote mode auto') }]} />
        </div>
        <div className="flex gap10" style={{ alignItems: 'center' }}>
          <span className="k" style={{ width: 150 }}>{t('Low stock threshold')}</span>
          <input className="input mono" style={{ width: 120, height: 32 }} type="number" value={threshold}
            onChange={e => setThreshold(e.target.value)} />
        </div>
      </div>
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div className="card-title">{t('AI discount boundary')}</div>
        <div className="muted small" style={{ marginBottom: 10 }}>{t('Defaults when not configured: 3% floor / 1% per round / up to 3 rounds')}</div>
        <div className="flex gap10" style={{ alignItems: 'center', marginBottom: 10 }}>
          <span className="k" style={{ width: 150 }}>{t('Lowest allowed discount (0.97 = 3% off = 97% of list price)')}</span>
          <input className="input mono" style={{ width: 120, height: 32 }} type="number" step="0.01" min="0.5" max="1" value={ai.floorDiscount}
            onChange={e => setAi({ ...ai, floorDiscount: e.target.value })} />
        </div>
        <div className="flex gap10" style={{ alignItems: 'center', marginBottom: 10 }}>
          <span className="k" style={{ width: 150 }}>{t('Concession step per round')}</span>
          <input className="input mono" style={{ width: 120, height: 32 }} type="number" step="0.005" min="0.005" value={ai.stepSize}
            onChange={e => setAi({ ...ai, stepSize: e.target.value })} />
        </div>
        <div className="flex gap10" style={{ alignItems: 'center', marginBottom: 10 }}>
          <span className="k" style={{ width: 150 }}>{t('Max negotiation rounds')}</span>
          <input className="input mono" style={{ width: 120, height: 32 }} type="number" min="1" value={ai.maxRounds}
            onChange={e => setAi({ ...ai, maxRounds: e.target.value })} />
        </div>
        <div className="flex gap10" style={{ alignItems: 'center', marginBottom: 10 }}>
          <span className="k" style={{ width: 150 }}>{t('Escalate to')}</span>
          <input className="input mono" style={{ width: 200, height: 32 }} value={ai.escalateTo || ''}
            placeholder={t('main / account id')} onChange={e => setAi({ ...ai, escalateTo: e.target.value })} />
        </div>
        <div className="flex gap10" style={{ alignItems: 'center' }}>
          <span className="k" style={{ width: 150 }}>{t('Allow override beyond boundary')}</span>
          <input type="checkbox" checked={!!ai.allowOverride} onChange={e => setAi({ ...ai, allowOverride: e.target.checked })} />
          <span className="muted small">{t('When on, going below the floor requires a manual approval mark')}</span>
        </div>
      </div>
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div className="card-title">{t('Payee info')}</div>
        <div className="flex gap10" style={{ alignItems: 'center', marginBottom: 10 }}>
          <span className="k" style={{ width: 150 }}>{t('Bank name')}</span>
          <input className="input" style={{ flex: 1, height: 32 }} value={payee.bankName || ''}
            onChange={e => setPayee({ ...payee, bankName: e.target.value })} />
        </div>
        <div className="flex gap10" style={{ alignItems: 'center', marginBottom: 10 }}>
          <span className="k" style={{ width: 150 }}>{t('Account name')}</span>
          <input className="input" style={{ flex: 1, height: 32 }} value={payee.accountName || ''}
            onChange={e => setPayee({ ...payee, accountName: e.target.value })} />
        </div>
        <div className="flex gap10" style={{ alignItems: 'center', marginBottom: 10 }}>
          <span className="k" style={{ width: 150 }}>{t('Account number')}</span>
          <input className="input mono" style={{ flex: 1, height: 32 }} value={payee.accountNo || ''}
            onChange={e => setPayee({ ...payee, accountNo: e.target.value })} />
        </div>
        <div className="flex gap10" style={{ alignItems: 'center', marginBottom: 10 }}>
          <span className="k" style={{ width: 150 }}>{t('SWIFT')}</span>
          <input className="input mono" style={{ flex: 1, height: 32 }} value={payee.swift || ''}
            onChange={e => setPayee({ ...payee, swift: e.target.value })} />
        </div>
        <div className="flex gap10" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
          <span className="k" style={{ width: 150 }}>{t('Payment methods')}</span>
          <div className="flex gap10" style={{ flex: 1, flexWrap: 'wrap' }}>
            {['Bank Transfer', 'Cash', 'POS', 'Cheque'].map(m => (
              <label key={m} className="flex gap4" style={{ fontSize: 12.5, alignItems: 'center' }}>
                <input type="checkbox" checked={(payee.methods || []).includes(m)}
                  onChange={e => setPayee({ ...payee, methods: e.target.checked ? [...(payee.methods || []), m] : (payee.methods || []).filter(x => x !== m) })} />
                {t(m)}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap10" style={{ alignItems: 'center' }}>
          <span className="k" style={{ width: 150 }}>OPay</span>
          <input className="input" style={{ flex: 1, height: 32 }} disabled
            placeholder={t('OPay — under research, not available yet')} />
        </div>
      </div>
      <button type="button" className="btn primary" onClick={save}><Icon name="check" size={13} />{t('Save settings')}</button>
    </div>
  );
}

Object.assign(window, { PendingRepriceBanner, SettingsPage });
