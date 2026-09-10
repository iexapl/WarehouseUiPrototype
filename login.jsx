// ============================================================
// login.jsx — bilingual demo login page (frontend-simulated)
// Lists every demo account for one-tap sign-in; after login the
// app opens the mobile app by default (Web console reachable from
// Mine → Open Web Console, or the top-bar switch).
// ============================================================

function LoginPage() {
  const { db, login, lang } = useApp();
  const [selected, setSelected] = useState(null);

  const tenantsWithAccounts = db.tenants
    .map(t => ({ tenant: t, accounts: db.accounts.filter(a => a.tenantId === t.id) }))
    .filter(g => g.accounts.length > 0);
  const platformAccounts = db.accounts.filter(a => a.type === 'platform');

  const accountState = (a) => {
    const t = a.tenantId ? db.tenants.find(x => x.id === a.tenantId) : null;
    if (a.status === 'Suspended' || (t && t.status === 'Suspended')) return 'blocked';
    return 'ok';
  };

  const roleOf = (a) => {
    if (a.type === 'platform') return 'Platform Admin';
    const t = db.tenants.find(x => x.id === a.tenantId);
    return tenantRoleLabel(db, a, t);
  };

  const pick = (a) => {
    if (accountState(a) === 'blocked') return;
    setSelected(a.id);
    login(a.id);
  };

  const Row = ({ a, groupLabel }) => {
    const st = accountState(a);
    const initials = a.name.split(' ').map(w => w[0]).slice(0, 2).join('');
    const tenant = a.tenantId ? db.tenants.find(x => x.id === a.tenantId) : null;
    return (
      <div className={`login-account${selected === a.id ? ' selected' : ''}${st === 'blocked' ? ' blocked' : ''}`}
        onClick={() => pick(a)} title={st === 'blocked' ? 'Suspended — login blocked' : undefined}>
        <span className={`avatar ${a.type === 'platform' ? 'plat' : 'tenant'}`} style={{ flexShrink: 0 }}>{initials}</span>
        <div className="la-body">
          <div className="la-name">{a.name}{a.main && <span className="la-main">MAIN</span>}</div>
          <div className="la-sub">{tenant ? `${tenant.name} · ${groupLabel || roleOf(a)}` : 'Platform'}</div>
        </div>
        {st === 'blocked'
          ? <Tag tone="dark">Disabled</Tag>
          : <Icon name="chevronRight" size={15} color="var(--text-3)" />}
      </div>
    );
  };

  return (
    <div className="login-wrap">
      <div className="login-left">
        <div className="ll-top"><Logo size={38} dark /><span className="ll-brand">TierLink Warehouse</span></div>
        <div className="ll-hero">
          <h1>Tiered agent warehouse,<br />one MVP.</h1>
          <p>Inquiry → Quote → Order → Outbound / Waybill → Receiving → Invoice. Seven numbering series (IQ / QT / PO / CK / RK / FP / WY), three currencies, WhatsApp push links and an AI assistant — across a Web console and a mobile app.</p>
        </div>
        <ul className="ll-points">
          <li><Icon name="check" size={14} />Inquiry &amp; quote with AI-drafted prices</li>
          <li><Icon name="check" size={14} />Order → outbound → waybill → receiving, stock auto-updated</li>
          <li><Icon name="check" size={14} />Auto-issued invoices &amp; WhatsApp push links</li>
          <li><Icon name="check" size={14} />Tenant isolation · personal data scope · platform oversight</li>
        </ul>
        <div className="ll-foot">MVP-stage prototype · demo data only · frontend-simulated auth</div>
      </div>
      <div className="login-right">
        <div className="login-card">
          <div className="lc-head">
            <div>
              <div className="lc-title">Sign in</div>
              <div className="lc-sub">Pick a demo account — passwords are simulated in this prototype. Mobile opens after sign-in.</div>
            </div>
            <LangSwitch />
          </div>

          <div className="lc-group-label">Platform</div>
          <div className="lc-accounts">
          {platformAccounts.map(a => <Row key={a.id} a={a} />)}

          {tenantsWithAccounts.map(({ tenant, accounts }) => (
            <React.Fragment key={tenant.id}>
              <div className="lc-group-label">
                {tenant.name}
                <span className="lc-group-meta">{tenant.type === 'Supplier' ? 'Supplier' : (tenant.maxLevel === 1 ? 'Sub-Distributor' : 'Agent')} · {tenant.code}{tenant.status === 'Suspended' ? ' · Suspended' : ''}</span>
              </div>
              {accounts.map(a => <Row key={a.id} a={a} />)}
            </React.Fragment>
          ))}
          </div>

          <button className="btn primary block mt16" disabled={!selected} onClick={() => selected && login(selected)}>
            <Icon name="lock" size={14} />{selected ? t(`Sign in as ${db.accounts.find(a => a.id === selected).name}`) : 'Select an account above'}
          </button>
          <div className="lc-note">
            <Icon name="info" size={13} />
            <span>Demo only — no real credentials. Suspended tenants (e.g. Ibadan Sub-Distributor) are blocked from login, matching the MVP rule “suspend → login disabled, data retained”.</span>
          </div>
        </div>
        <div className="login-foot">TierLink Warehouse · MVP · EN / 中文</div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginPage });
