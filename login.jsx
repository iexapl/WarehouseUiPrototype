// ============================================================
// login.jsx — bilingual demo login page (frontend-simulated)
// Lists every demo account for one-tap sign-in; after login the
// app opens the mobile app by default (Web console reachable from
// Mine → Open Web Console, or the top-bar switch).
// ============================================================

function LoginPage() {
  const { db, login, lang } = useApp();
  const [selected, setSelected] = useState(null);
  const [reg, setReg] = useState(false);   // R01 注册商户向导

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
          <li><Icon name="check" size={14} />Merchant isolation · personal data scope · platform oversight</li>
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
            <span>Demo only — no real credentials. Suspended merchants (e.g. Abuja Retail Chain) are blocked from login, matching the MVP rule “suspend → login disabled, data retained”.</span>
          </div>
          {/* R01/AC-01-01 — 注册入口与 demo 账号列表同屏可见 */}
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12.5 }}>
            {t('No account yet?')} <button type="button" className="btn text primary" style={{ padding: '0 4px', height: 'auto', fontSize: 12.5 }} onClick={() => setReg(true)}>{t('Register your merchant')}</button>
          </div>
        </div>
        <div className="login-foot">TierLink Warehouse · MVP · EN / 中文</div>
      </div>
      {reg && <MerchantRegisterWizard onClose={() => setReg(false)} />}
    </div>
  );
}

// ============================================================
// R01 — 租户自主注册三步向导：商户信息 → 联系人 → 账号密码。
// 提交走 act.createTenant（registrationStatus: 'pending'，待平台审核），
// 只写 tenants + accounts，不产生任何单据/库存/关系（AC-01-08）。
// 字段状态集中在同一个 form 对象（跨步骤保留，AC-01-02/03）；
// 校验按步收敛（AC-01-03/04）：每步只校验本步字段。
// ============================================================
function MerchantRegisterWizard({ onClose }) {
  const { act } = useApp();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(null);   // 提交成功后的租户快照（同步返回值）
  const [form, setForm] = useState({ name: '', country: '', type: 'Agent', contactName: '', phone: '', email: '', password: '', password2: '' });
  const [errs, setErrs] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = (s) => {
    const e = {};
    if (s === 1) {
      if (!form.name.trim()) e.name = 'Merchant name is required';
      if (!form.country.trim()) e.country = 'Country / region is required';
      if (!form.type) e.type = 'Business type is required';
    }
    if (s === 2) {
      if (!form.contactName.trim()) e.contactName = 'Contact name is required';
      // AC-01-04 — 用 abc 当手机号必须被拦
      if (!/^\+?[\d\s-]{7,15}$/.test(form.phone.trim())) e.phone = 'Enter a valid phone number (digits, +, spaces or -)';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email address';
    }
    if (s === 3) {
      if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
      if (form.password !== form.password2) e.password2 = 'Passwords do not match';
    }
    return e;
  };

  const submit = () => {
    // 只写 tenants + accounts（AC-01-08）；registrationStatus: 'pending'（AC-01-06）
    const t = act.createTenant({
      name: form.name.trim(), type: form.type, country: form.country.trim(), status: 'Active',
      registrationStatus: 'pending',
      master: { name: form.contactName.trim(), phone: form.phone.trim(), password: form.password, whatsapp: form.phone.trim() },
    });
    setDone(t);
  };

  const next = () => {
    const e = validate(step);
    setErrs(e);
    if (Object.keys(e).length) return;
    if (step < 3) { setStep(step + 1); setErrs({}); }
    else submit();
  };

  if (done) return (
    <Dialog title={t('Registration submitted')} width="560px" onClose={onClose}
      footer={<button className="btn primary" onClick={onClose}>{t('Close')}</button>}>
      <Banner tone="success" icon="check">{t('Registration submitted — under platform review')}</Banner>
      <div className="mt16" style={{ fontSize: 13, lineHeight: 1.9 }}>
        <div><b>{t('Merchant')}:</b> {done.name} <span className="mono small">({done.code})</span></div>
        <div className="flex gap6" style={{ alignItems: 'center' }}><b>{t('Status')}:</b> <Tag tone="warning" dot>{t('Pending Review')}</Tag></div>
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.6 }}>
        {t('You can sign in once the platform approves this merchant. No documents, stock or relations are created during registration.')}
      </div>
    </Dialog>
  );

  const STEPS = ['Business info', 'Contact', 'Account'];
  const stepHead = (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {STEPS.map((s, i) => {
        const n = i + 1;
        return (
          <div key={s} style={{ flex: 1, textAlign: 'center', fontSize: 12, padding: '6px 0', borderRadius: 6,
            background: n === step ? 'var(--primary-light, #E8F0FE)' : n < step ? 'var(--success-light, #E6F4EA)' : '#F2F4F7',
            color: n === step ? 'var(--primary, #1F5BD0)' : n < step ? 'var(--success, #2E7D32)' : 'var(--text-3, #8A94A6)',
            fontWeight: n === step ? 700 : 500 }}>
            {n < step ? '✓ ' : ''}{t(s)}
          </div>
        );
      })}
    </div>
  );

  const renderStep1 = () => (
    <div className="form">
      <FormRow label="Merchant Name" required error={errs.name}>
        <Input value={form.name} onChange={v => set('name', v)} placeholder="e.g. Kano Trade Ltd" error={errs.name} />
      </FormRow>
      <FormRow label="Country / Region" required error={errs.country}>
        <Input value={form.country} onChange={v => set('country', v)} placeholder="e.g. Nigeria" error={errs.country} />
      </FormRow>
      <FormRow label="Business Type" required error={errs.type}>
        <Select value={form.type} onChange={v => set('type', v)} options={[{ value: 'Agent', label: 'Agent (can develop sub-distributors)' }, { value: 'Supplier', label: 'Supplier' }]} />
      </FormRow>
    </div>
  );

  const renderStep2 = () => (
    <div className="form">
      <FormRow label="Contact Name" required error={errs.contactName}>
        <Input value={form.contactName} onChange={v => set('contactName', v)} placeholder="master account name" error={errs.contactName} />
      </FormRow>
      <FormRow label="Phone" required error={errs.phone}>
        <Input value={form.phone} onChange={v => set('phone', v)} placeholder="+234 ..." error={errs.phone} />
      </FormRow>
      <FormRow label="Email" required error={errs.email}>
        <Input value={form.email} onChange={v => set('email', v)} type="email" placeholder="name@company.com" error={errs.email} />
      </FormRow>
    </div>
  );

  const renderStep3 = () => (
    <div className="form">
      <FormRow label="Set Password" required error={errs.password}>
        <Input value={form.password} onChange={v => set('password', v)} type="password" placeholder="at least 6 characters" error={errs.password} />
      </FormRow>
      <FormRow label="Confirm Password" required error={errs.password2}>
        <Input value={form.password2} onChange={v => set('password2', v)} type="password" placeholder="repeat the password" error={errs.password2} />
      </FormRow>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.6 }}>
        {t('A master account is created with this contact info (WhatsApp bound to the phone number).')}
      </div>
    </div>
  );

  return (
    <Dialog title={t('Register your merchant')} width="560px" onClose={onClose}
      footer={<React.Fragment>
        {step > 1 && <button className="btn" onClick={() => { setStep(step - 1); setErrs({}); }}><Icon name="chevronLeft" size={13} />{t('Back')}</button>}
        <button className="btn primary" onClick={next}>{step < 3 ? t('Next') : t('Submit Registration')}</button>
      </React.Fragment>}>
      {/* 步骤指示器三格高亮（AC-01-02） */}
      {stepHead}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      <div className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>{t('Step')} {step} / 3 — {t('Each step is validated before continuing')}</div>
    </Dialog>
  );
}

Object.assign(window, { LoginPage, MerchantRegisterWizard });
