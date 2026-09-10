// ============================================================
// web-dialogs-extra.jsx — Web console dialogs & blocks added for
// MVP feature-gap completion (AI order summary, waybill card, export)
// ============================================================

// ---------- AI order summary (MVP #10) — shared by doc detail ----------
function AISummaryBox({ doc }) {
  const { db } = useApp();
  const [open, setOpen] = useState(false);
  const chain = (doc.chainPath || []).map(tid => tenantName(db, tid)).join(' → ');
  const text = `Order ${doc.no} from ${tenantName(db, doc.seller)} contains ${doc.items.length} line items totalling ${money(docAmount(doc), doc.currency).full}. Delivery expected by ${doc.deliveryDate || 'N/A'} at Default Warehouse. Chain: ${chain}. Prices are within 10% of catalog reference — safe to confirm.`;
  return (
    <div className="mt16">
      <div className="ai-box" style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div className="ai-head"><Icon name="ai" size={14} />AI Order Summary <span className="mini-chip ai">AI GENERATED</span>
          <span style={{ marginLeft: 'auto' }}>{open ? '▾' : '▸'}</span>
        </div>
        {!open && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Tap to expand the AI-generated summary for confirmation</div>}
      </div>
      {open && (
        <div className="ai-box" style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>{text}</div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Review the AI summary before confirming — generated from inquiry / quote lines, stock levels and the agency chain (demo).</div>
        </div>
      )}
    </div>
  );
}

// ---------- waybill card (MVP #25/#26) — shown on CK doc detail ----------
function WaybillCard({ doc }) {
  const { db, act, account, toast } = useApp();
  const wb = doc.waybill;
  if (!wb) return null;
  const buyerMain = db.accounts.find(a => a.tenantId === doc.buyer && a.main);
  const pushedAt = doc.timeline.filter(x => x.text.includes('WhatsApp')).slice(-1)[0];
  const canPush = account.type !== 'platform' && docSide(db, account, doc) === 'seller';
  return (
    <React.Fragment>
      <div className="section-label mt16">Waybill &amp; Logistics <span className="mini-chip mvp">AUTO-GENERATED</span></div>
      <div className="card" style={{ padding: 14 }}>
        <div className="flex gap10" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="flex gap10">
            <span className="cell-icon" style={{ background: '#EAF1FE', color: '#2E6FE8', width: 34, height: 34, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="truck" size={17} /></span>
            <div>
              <div className="mono bold" style={{ fontSize: 13 }}>{wb.no}</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 1 }}>Generated automatically on shipment confirmation</div>
            </div>
          </div>
          <Tag tone="primary">{doc.status === 'Shipped' ? 'In transit' : 'Closed'}</Tag>
        </div>
        <Descriptions cols={4} items={[
          { label: 'Carrier', value: wb.carrier || '—' },
          { label: 'Vehicle Plate', value: <span className="mono">{wb.plate || '—'}</span> },
          { label: 'Driver', value: wb.driver || '—' },
          { label: 'Driver Phone', value: <span className="mono">{wb.phone || '—'}</span> },
        ]} />
        <div className="section-label" style={{ marginTop: 2 }}>Waybill Items</div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Product</th><th style={{ width: 110 }}>Spec</th><th style={{ width: 80 }} className="right">Qty</th></tr></thead>
            <tbody>
              {doc.items.map((it, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img src={prodImg(db.products.find(p => p.id === it.pid))} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border-light)', flexShrink: 0 }} />
                      <div className="bold" style={{ fontSize: 13 }}>{it.name}</div>
                    </div>
                  </td>
                  <td className="small muted mono">{it.spec}</td>
                  <td className="mono right">{it.qty} {it.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="banner info" style={{ marginTop: 12 }}><Icon name="whatsapp" size={15} />
          <div>
            <b>Confirmation link pushed to the buyer via WhatsApp.</b>
            {buyerMain && <span> Recipient: <b>{buyerMain.name}</b> · <span className="mono">{buyerMain.whatsapp || buyerMain.phone}</span>. </span>}
            {pushedAt && <span className="muted">Last push: {pushedAt.ts}. </span>}
            The buyer opens the H5 link to view items &amp; logistics and confirm receipt.
          </div>
        </div>
        <div className="flex gap8" style={{ marginTop: 10 }}>
          {canPush && (
            <button className="btn sm" onClick={() => act.resendWaybillLink(doc)}><Icon name="whatsapp" size={13} />Resend WhatsApp Link</button>
          )}
          <button className="btn sm" onClick={() => { act.logEvent('Print Waybill', wb.no); toast(`Waybill ${wb.no} print sent — data export event logged`, 'success'); }}><Icon name="print" size={13} />Print Waybill</button>
        </div>
      </div>
    </React.Fragment>
  );
}

// ---------- export dialog (MVP #34) — PDF/Excel + data-outbound event log ----------
function ExportDialog({ docs, onClose }) {
  const { db, act, toast } = useApp();
  const [format, setFormat] = useState('excel');
  const [done, setDone] = useState(false);
  const doExport = () => {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    if (format === 'excel') {
      const header = ['Doc No', 'Type', 'Status', 'Counterparty', 'Amount', 'Currency', 'Created By', 'Created At'];
      const rows = docs.map(d => [d.no, d.type, d.status, tenantName(db, d.seller) + ' → ' + tenantName(db, d.buyer), docAmount(d).toFixed(2), d.currency, d.createdBy, d.createdAt]);
      downloadFile(`documents_export_${stamp}.csv`, [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\n'));
      act.logEvent('Export Excel', `${docs.length} documents from Document Center`);
      toast(`${docs.length} documents exported to Excel — data export event logged`, 'success');
    } else {
      act.logEvent('Export PDF', `${docs.length} documents from Document Center`);
      toast(`${docs.length} documents queued for PDF export (print pipeline) — data export event logged`, 'success');
    }
    setDone(true);
  };
  return (
    <Dialog title="Export Documents" width="640px" onClose={onClose}
      badge={<span className="mini-chip demo">{docs.length} selected</span>}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}><Icon name="close" size={13} />Close</button>
        <button className="btn primary" disabled={done} onClick={doExport}><Icon name="download" size={14} />{done ? 'Exported' : 'Export'}</button>
      </React.Fragment>}>
      <Banner tone="warning" icon="shield"><b>Data-outbound events are logged.</b> Every export / download / batch print records the operator, time, scope and format for the audit trail.</Banner>
      <div className="form mt12" style={{ gridTemplateColumns: '1fr' }}>
        <FormRow label="Format" required>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { value: 'excel', icon: 'grid', title: 'Excel (.csv)', desc: 'Downloads the file now' },
              { value: 'pdf', icon: 'file', title: 'PDF', desc: 'Print pipeline with watermark & barcode' },
            ].map(opt => {
              const on = format === opt.value;
              return (
                <div key={opt.value} onClick={() => setFormat(opt.value)} style={{ flex: '1 1 220px', minWidth: 220, cursor: 'pointer', padding: '12px 14px', borderRadius: 10, border: `2px solid ${on ? 'var(--primary)' : 'var(--border-light)'}`, background: on ? 'var(--primary-light)' : '#FAFBFC', display: 'flex', gap: 10, alignItems: 'flex-start', boxSizing: 'border-box' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? 'var(--primary)' : '#E8EBF0', color: on ? '#fff' : '#667085', flexShrink: 0 }}>
                    <Icon name={opt.icon} size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {opt.title}
                      {on && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'var(--primary)', color: '#fff' }}><Icon name="check" size={10} /></span>}
                    </div>
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 2, lineHeight: 1.4 }}>{opt.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </FormRow>
        <FormRow label="Scope">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {docs.map(d => (
              <span key={d.id} className="mono" style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 999, background: '#F0F3F8', border: '1px solid var(--border-light)' }}>
                {d.no}<span className="muted" style={{ marginLeft: 5 }}>({d.type})</span>
              </span>
            ))}
          </div>
        </FormRow>
      </div>
      <div className="section-label mt16">Recent Data-outbound Events</div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Time</th><th>Operator</th><th>Action</th><th>Scope</th></tr></thead>
          <tbody>
            {db.events.slice(-5).reverse().map(e => (
              <tr key={e.id}>
                <td className="small mono">{e.ts}</td>
                <td className="small">{e.by}</td>
                <td><Tag tone={e.action.includes('PDF') ? 'purple' : 'primary'}>{e.action}</Tag></td>
                <td className="small muted">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}

Object.assign(window, { AISummaryBox, WaybillCard, ExportDialog });
