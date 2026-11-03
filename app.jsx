// ============================================================
// app.jsx — root state, actions, and routing (Web vs Mobile)
// ============================================================

const { useState, useCallback, useMemo, useEffect } = React;

function App() {
  const [view, setView] = useState('mobile');
  const [db, setDb] = useState(() => makeInitialDb());
  const [accountId, setAccountId] = useState('a-chidi');
  const [authed, setAuthed] = useState(false);
  // WhatsApp login-free link (MVP P2): ?doc=<docNo>&token=demo opens the doc
  // detail without signing in — parsed once on mount, cleared via "Sign In"
  const [guestDoc, setGuestDoc] = useState(null);
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const d = sp.get('doc'), tk = sp.get('token');
      if (d && tk === 'demo') setGuestDoc(d);
    } catch (e) { /* noop */ }
  }, []);
  const account = db.accounts.find(a => a.id === accountId) || db.accounts[0];
  const [toasts, setToasts] = useState([]);
  // ---------- carts (inquiry / inbound / outbound shopping-cart) ----------
  // Module-scoped line lists that survive page navigation (browse other
  // pages, switch language, hop web/mobile); submit or clear empties them.
  // State lives HERE — above the lang-remount key — so it never gets lost.
  const [carts, setCarts] = useState(() => emptyCarts());
  const [lang, setLangState] = useState(() => getLang());
  const tenant = useMemo(() => (account.tenantId ? db.tenants.find(t => t.id === account.tenantId) : null), [db.tenants, account.tenantId]);

  // language toggle: sync module-level lang, persist, and force a full tree re-render
  window.__setLang = (l) => { setLang(l); setLangState(l); };

  const now = () => new Date().toLocaleString('sv-SE').slice(0, 16).replace('T', ' ');

  const toast = useCallback((text, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);

  const switchAccount = useCallback(id => {
    const a = db.accounts.find(x => x.id === id);
    if (!a) return;
    setAccountId(id);
    setCarts(emptyCarts()); // a fresh session should never inherit another account's carts
    toast(`Switched to ${a.name}`, 'info');
  }, [db.accounts, toast]);

  // ---------- auth (frontend-simulated demo login) ----------
  const login = useCallback(id => {
    const a = db.accounts.find(x => x.id === id);
    if (!a) return;
    if (a.status === 'Suspended') { toast(`${a.name} is suspended and cannot sign in`, 'error'); return; }
    const tenant = a.tenantId ? db.tenants.find(t => t.id === a.tenantId) : null;
    if (tenant && tenant.status === 'Suspended') { toast(`Merchant ${tenant.name} is suspended — login blocked`, 'error'); return; }
    // R01 — 待审核/已驳回租户拦截：自主注册的租户须平台审核通过后才能登录
    if (tenant && tenant.registrationStatus && tenant.registrationStatus !== 'approved') {
      if (tenant.registrationStatus === 'rejected') toast(`${tenant.name} — registration rejected by the platform, sign-in unavailable`, 'error');
      else toast(`${tenant.name} is under platform review — sign-in available once approved`, 'error');
      return;
    }
    setAccountId(id);
    setAuthed(true);
    setCarts(emptyCarts());
    setView('mobile'); // default entry after login: mobile
    toast(`Signed in as ${a.name}`, 'success');
  }, [db.accounts, db.tenants, toast]);

  const logout = useCallback(() => {
    setAuthed(false);
    setCarts(emptyCarts());
    toast('Signed out', 'info');
  }, [toast]);

  // ---------- actions ----------
  const act = useMemo(() => {
    function updateDocs(fn) {
      setDb(prev => ({ ...prev, docs: fn(prev.docs) }));
    }
    function updateStock(fn) {
      setDb(prev => ({ ...prev, stock: fn(prev.stock) }));
    }
    function updateMovements(fn) {
      setDb(prev => ({ ...prev, movements: fn(prev.movements) }));
    }
    function updatePushes(fn) {
      setDb(prev => ({ ...prev, pushes: fn(prev.pushes) }));
    }
    function updateEvents(fn) {
      setDb(prev => ({ ...prev, events: fn(prev.events) }));
    }

    return {
      docVerb(verb, doc, byName, reason, form) {
        const tnow = now();
        const opName = byName || account.name;
        let newPO = null;
        let newFP = null;
        if (verb === 'Accept') {
          // R86 — quote accepted → the PO is generated directly at 待接收
          // (Pending Acceptance), awaiting the supplier's accept/reject.
          // No Draft stage: order statuses are ONLY the nine order-flow ones.
          newPO = { id: 'd-po-' + Date.now(), no: nextNo('PO', db.docs), type: 'PO', buyer: doc.buyer, seller: doc.seller, createdBy: 'AI Engine', createdAt: tnow, status: 'Pending Acceptance', currency: doc.currency, deliveryDate: '', quoteNo: doc.no, chainPath: [doc.seller, doc.buyer], items: doc.items.map(it => ({ ...it })), timeline: [{ ts: tnow, text: 'Purchase order generated from accepted quote — awaiting supplier acceptance', by: 'AI Engine' }] };
        }
        // R17 — 订单接受阶段不再自动开票（AC-17-06）：开票触发点移至 receive()
        // 买方签收之后（见下方 receive 尾部）；Create Invoice 保留为人工补开路径。
        if (verb === 'Create Invoice') {
          // works from a completed PO or an inbound record (RK) — resolve the PO
          let poNo = doc.type === 'PO' ? doc.no : null;
          let base = doc;
          if (doc.type === 'RK') {
            const ck = db.docs.find(d => d.type === 'CK' && d.no === doc.ckNo);
            if (ck) { poNo = ck.poNo; const po = db.docs.find(d => d.type === 'PO' && d.no === poNo); if (po) base = po; }
          }
          if (poNo && !db.docs.some(d => d.type === 'FP' && d.poNo === poNo)) {
            const fno = nextNo('FP', db.docs);
            newFP = { id: 'd-fp-' + Date.now(), no: fno, type: 'FP', seller: doc.seller, buyer: doc.buyer, createdBy: opName, createdAt: tnow, status: 'Issued', currency: base.currency, poNo, issueDate: tnow.slice(0, 10), items: base.items.map(it => ({ ...it })), timeline: [{ ts: tnow, text: `Invoice issued for ${poNo} — link pushed to buyer via WhatsApp`, by: opName }] };
          }
        }
        updateDocs(prev => {
          const docs = prev.map(d => {
            // confirming an AI quote draft also flips the linked inquiry to Quoted
            if (verb === 'Confirm Quote' && doc.inquiryNo && d.type === 'IQ' && d.no === doc.inquiryNo && d.id !== doc.id) {
              return { ...d, status: 'Quoted', timeline: [...d.timeline, { ts: tnow, text: `Quote ${doc.no} confirmed and pushed via WhatsApp`, by: opName }] };
            }
            if (d.id !== doc.id) return d;
            switch (verb) {
              case 'Submit': return { ...d, status: d.type === 'IQ' ? 'Submitted' : 'Pending Acceptance', timeline: [...d.timeline, { ts: tnow, text: d.type === 'IQ' ? `Submitted to ${tenantName(db, d.seller)}` : 'Submitted — awaiting supplier acceptance', by: opName }] };
              case 'Accept': return d.type === 'PO'
                // R81/R82 — supplier accepts the order → invoice auto-issued, awaiting the buyer's offline payment (待付款)
                // R94 — the acceptance form records the expected dispatch date + note
                ? { ...d, status: 'Pending Payment', expectedShipDate: (form && form.expectedShipDate) || d.expectedShipDate || '', timeline: [...d.timeline, { ts: tnow, text: `Order accepted by ${tenantName(db, d.seller)}`, by: opName },
                    ...(form && form.expectedShipDate ? [{ ts: tnow, text: `Expected dispatch date confirmed: ${form.expectedShipDate}`, by: opName }] : []),
                    ...(reason ? [{ ts: tnow, text: `Acceptance note: ${reason}`, by: opName }] : []),
                    ...(newFP ? [{ ts: tnow, text: `Invoice ${newFP.no} issued — link pushed to buyer`, by: opName }] : [])] }
                : { ...d, status: 'Accepted', timeline: [...d.timeline, { ts: tnow, text: `Quote accepted by ${tenantName(db, d.buyer)}`, by: opName }, ...(newPO ? [{ ts: tnow, text: `Purchase order ${newPO.no} generated — awaiting supplier acceptance`, by: 'AI Engine' }] : [])] };
              // R81 — rejection requires a reason (quote by buyer / order by supplier)
              // R88 — the two rejection terminals are now distinct raw statuses:
              // supplier rejects the ORDER → 'Rejected' (已拒绝); the buyer's
              // shipment rejection stays 'Receipt Rejected' (已拒收)
              case 'Reject': return { ...d, status: 'Rejected', rejectReason: reason || '', timeline: [...d.timeline, { ts: tnow, text: `${d.type === 'PO' ? 'Order' : 'Quote'} rejected by ${opName} — reason: ${reason || ''}`, by: opName }] };
              case 'Confirm Quote': return { ...d, status: 'Sent', timeline: [...d.timeline, { ts: tnow, text: `Quote confirmed (one-tap) — link pushed to ${tenantName(db, d.buyer)} via WhatsApp`, by: opName }] };
              case 'Place Order': return { ...d, status: 'Pending Acceptance', timeline: [...d.timeline, { ts: tnow, text: `Order confirmed (one-tap) — submitted to ${tenantName(db, d.seller)}`, by: opName }] };
              // R81 — the buyer pays OFFLINE; the supplier records the payment
              // R94 — the payment form captures amount / date / method / ref / note
              case 'Record Payment': {
                const pf = form || {};
                const amountTxt = (pf.amount !== '' && pf.amount != null) ? ` ${doc.currency === 'NGN' ? '₦' : '$'}${pf.amount}` : '';
                return { ...d, paid: true, paidAt: tnow, status: 'Pending Payment Confirmation', payment: { amount: pf.amount !== '' && pf.amount != null ? String(pf.amount) : '', date: pf.date || tnow.slice(0, 10), method: pf.method || 'Bank Transfer', ref: pf.ref || '', note: pf.note || '', voucher: pf.voucher || null, mismatchNote: pf.mismatchNote || '', status: 'pending' }, timeline: [...d.timeline, { ts: tnow, text: `Offline payment recorded by ${tenantName(db, d.seller)} — ${pf.method || 'Bank Transfer'}${pf.ref ? `, ref ${pf.ref}` : ''}${amountTxt} — awaiting confirmation`, by: opName }] };
              }
              // R15 — supplier confirms the recorded payment (待确认 → 待出库);
              // the timeline keeps operator + time, voucher confirmation retained
              case 'Confirm Payment': {
                const voucherTxt = (d.payment && d.payment.voucher && d.payment.voucher.fileName) ? `, voucher ${d.payment.voucher.fileName}` : '';
                return { ...d, status: 'Pending Outbound', payment: { ...d.payment, status: 'confirmed', voucher: d.payment && d.payment.voucher ? { ...d.payment.voucher, confirmedBy: opName, confirmedAt: tnow } : null }, timeline: [...d.timeline, { ts: tnow, text: `Payment confirmed by ${opName}${voucherTxt} — shipment unlocked`, by: opName }] };
              }
              case 'Approve': return { ...d, status: 'Pending Payment', timeline: [...d.timeline, { ts: tnow, text: 'Approved by ' + tenantName(db, d.seller), by: opName }] };
              case 'Cancel': return { ...d, status: 'Cancelled', timeline: [...d.timeline, { ts: tnow, text: 'Order cancelled', by: opName }] };
              case 'Close': return { ...d, status: 'Closed', timeline: [...d.timeline, { ts: tnow, text: 'Inquiry closed', by: opName }] };
              case 'Confirm Invoice': return { ...d, status: 'Archived', timeline: [...d.timeline, { ts: tnow, text: `Invoice confirmed by ${tenantName(db, d.buyer)} — archived`, by: opName }] };
              case 'Create Invoice': return newFP ? { ...d, timeline: [...d.timeline, { ts: tnow, text: `Invoice ${newFP.no} issued — link pushed to buyer`, by: opName }] } : d;
              case 'Delete': return null;
              default: return d;
            }
          }).filter(Boolean);
          if (newPO) docs.push(newPO);
          if (newFP) docs.push(newFP);
          return docs;
        });
        // WhatsApp-style push notifications along the supply flow
        const pushTo = (tenantId, text, docNo, docType) => {
          const main = db.accounts.find(a => a.tenantId === tenantId && a.main);
          if (main) updatePushes(prev => [...prev, { id: 'w-' + Date.now(), toAccount: main.id, docNo, docType, ts: tnow, text, read: false }]);
        };
        // R86 — the PO is born at 待接收: notify the SELLER to review & accept
        if (verb === 'Accept' && newPO) pushTo(doc.seller, `New order ${newPO.no} from ${tenantName(db, doc.buyer)} — please review and accept.`, newPO.no, 'PO');
        // R81 — order acceptance (supplier side) auto-issues the invoice → notify buyer
        if ((verb === 'Accept' || verb === 'Approve') && doc.type === 'PO' && newFP) pushTo(doc.buyer, `Order ${doc.no} accepted by ${tenantName(db, doc.seller)}. Invoice ${newFP.no} issued — tap to view and confirm.`, newFP.no, 'FP');
        if (verb === 'Reject') pushTo(doc.type === 'PO' ? doc.buyer : doc.seller, `${doc.type === 'PO' ? 'Order' : 'Quote'} ${doc.no} rejected by ${tenantName(db, doc.type === 'PO' ? doc.seller : doc.buyer)} — reason: ${reason || ''}`, doc.no, doc.type);
        // R14 — WhatsApp 议价成交的报价推送同样追加库存提示（AC-14-01 覆盖推送路径）
        if (verb === 'Confirm Quote') {
          const quoteHint = stockHintFor(db, doc.seller, doc.items.map(it => it.pid), (db.settings || {}).lowStockThreshold);
          pushTo(doc.buyer, `New quote from ${tenantName(db, doc.seller)} on inquiry ${doc.inquiryNo || ''}. Valid until ${doc.validUntil || 'TBC'}.` + (quoteHint ? '\n\n' + quoteHint : ''), doc.no, 'QT');
        }
        if (verb === 'Place Order') pushTo(doc.seller, `New order ${doc.no} from ${tenantName(db, doc.buyer)} — please review and approve.`, doc.no, 'PO');
        // R81 — supplier records the buyer's OFFLINE payment → notify buyer, unlock shipment
        // R94 — include the method/ref captured on the payment form
        if (verb === 'Record Payment') {
          const pf = form || {};
          pushTo(doc.buyer, `Offline payment for order ${doc.no} recorded by ${tenantName(db, doc.seller)}${pf.method ? ` (${pf.method}${pf.ref ? ', ref ' + pf.ref : ''})` : ''}. Awaiting supplier confirmation before shipment.`, doc.no, 'PO');
        }
        // R15 — payment confirmed → notify the buyer, shipment unlocked
        if (verb === 'Confirm Payment') pushTo(doc.buyer, `Payment for order ${doc.no} confirmed by ${tenantName(db, doc.seller)} — shipment will be arranged.`, doc.no, 'PO');
        if (verb === 'Create Invoice' && newFP) pushTo(doc.buyer, `Invoice ${newFP.no} issued by ${tenantName(db, doc.seller)} for order ${newFP.poNo}. Tap to view and confirm.`, newFP.no, 'FP');
        if (verb === 'Confirm Invoice') pushTo(doc.seller, `Invoice ${doc.no} confirmed and archived by ${tenantName(db, doc.buyer)}.`, doc.no, 'FP');
        toast(`${verb} completed`, 'success');
        // return the resulting doc so inline callers (e.g. WhatsApp chat cards) can use it
        if (newPO) return newPO;
        if (newFP) return newFP;
        if (verb === 'Confirm Quote') return { ...doc, status: 'Sent' };
        if (verb === 'Place Order') return { ...doc, status: 'Pending Acceptance' };
        return doc;
      },

      saveInquiry(f, submit, extraDocs) {
        // tenant boundary — inquiries apply to upstream-owned products only
        const upstream = upstreamTenantIds(db, account.tenantId);
        const badLine = f.items.filter(it => it.pid).some(it => {
          const p = db.products.find(x => x.id === it.pid);
          return !p || !upstream.has(p.ownerId);
        });
        if (badLine) { toast('Inquiries apply to upstream supplier products only', 'error'); return; }
        const items = f.items.filter(it => it.pid).map(it => {
          const p = db.products.find(x => x.id === it.pid);
          return { pid: it.pid, name: p.name, spec: p.spec, unit: p.unit, qty: Number(it.qty), price: p.price };
        });
        const currency = items[0] ? items[0].price.currency || items[0].currency || 'USD' : 'USD';
        const no = nextNo('IQ', extraDocs && extraDocs.length ? db.docs.concat(extraDocs) : db.docs);
        const timeline = [{ ts: now(), text: `Inquiry created ${submit ? 'and submitted' : '(Draft)'}`, by: account.name }];
        // 提交即把询价摘要推送到供货方 WhatsApp（演示模拟），单据时间线留痕
        if (submit) timeline.push({ ts: now(), text: `Inquiry summary sent to ${tenantName(db, f.seller)} via WhatsApp — awaiting the supplier's reply`, by: 'System' });
        const newDoc = { id: 'd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), no, type: 'IQ', buyer: account.tenantId, seller: f.seller, createdBy: account.name, createdAt: now(), status: submit ? 'Submitted' : 'Draft', currency, deliveryDate: f.deliveryDate, deliveryWarehouse: 'Default Warehouse', items, timeline };
        updateDocs(prev => [...prev, newDoc]);
        if (submit) {
          // flow: inquiry pushed to the supplier — AI parsed the requirement and
          // matched products, a quote draft is suggested for one-tap confirmation
          const sellerMain = db.accounts.find(a => a.tenantId === f.seller && a.main);
          if (sellerMain) updatePushes(prev => [...prev, { id: 'w-' + Date.now(), toAccount: sellerMain.id, docNo: no, docType: 'IQ', ts: now(), text: `New inquiry ${no} from ${tenantName(db, account.tenantId)} — AI parsed the requirement and matched products; confirm the AI quote draft with one tap.`, read: false }]);
          // R12 — quote mode: auto → the QT is generated and sent right away so
          // it lands in the buyer's quote list; any out-of-stock line turns it
          // back to manual (Q18 无库存不自动报价，转人工)
          if (((db.settings || {}).quoteMode || 'manual') === 'auto') {
            const outOfStock = items.some(it => { const st = (db.stock[f.seller] || {})[it.pid]; return st != null && Number(st) <= 0; });
            if (!outOfStock) {
              const vd2 = new Date(Date.now() + 7 * 86400000);
              const validUntil2 = `${vd2.getFullYear()}-${String(vd2.getMonth() + 1).padStart(2, '0')}-${String(vd2.getDate()).padStart(2, '0')}`;
              const qno = nextNo('QT', db.docs);
              const qt = { id: 'd-' + Date.now() + '-q' + Math.random().toString(36).slice(2, 6), no: qno, type: 'QT', seller: f.seller, buyer: account.tenantId, createdBy: 'AI Engine', createdAt: now(), status: 'Sent', currency, validUntil: validUntil2, inquiryNo: no, items: items.map(it => ({ pid: it.pid, name: it.name, spec: it.spec, unit: it.unit, qty: Number(it.qty) || 0, price: it.price })), timeline: [
                { ts: now(), text: 'Auto quote generated from the submitted inquiry (quote mode: auto)', by: 'AI Engine' },
                { ts: now(), text: `Quote link pushed to ${tenantName(db, account.tenantId)} via WhatsApp`, by: 'AI Engine' },
              ] };
              updateDocs(prev => [...prev, qt]);
              const buyerMain = db.accounts.find(a => a.tenantId === account.tenantId && a.main);
              if (buyerMain) updatePushes(prev => [...prev, { id: 'w-' + Date.now() + '-q', toAccount: buyerMain.id, docNo: qno, docType: 'QT', ts: now(), text: `Auto quote ${qno} for inquiry ${no} from ${tenantName(db, f.seller)} — valid until ${validUntil2}.`, read: false }]);
            } else {
              const sellerMain2 = db.accounts.find(a => a.tenantId === f.seller && a.main);
              if (sellerMain2) updatePushes(prev => [...prev, { id: 'w-' + Date.now() + '-m', toAccount: sellerMain2.id, docNo: no, docType: 'IQ', ts: now(), text: `Inquiry ${no} involves an out-of-stock item — auto quote skipped, please quote manually.`, read: false }]);
            }
          }
        }
        toast(`Inquiry ${no} ${submit ? 'submitted' : 'saved as draft'}`, 'success');
        return newDoc;
      },

      sendQuote(inquiry, items, validUntil, editQuote) {
        const tnow = now();
        const lines = items.map(it => ({ pid: it.pid, name: it.name, spec: it.spec, unit: it.unit, qty: Number(it.qty) || 0, price: Number(it.price) || 0 }));
        if (editQuote) {
          updateDocs(prev => prev.map(d => d.id === editQuote.id ? { ...d, validUntil, items: lines, timeline: [...d.timeline, { ts: tnow, text: 'Quote updated and re-sent', by: account.name }] } : d));
          toast(`Quote ${editQuote.no} updated`, 'success');
        } else {
          const no = nextNo('QT', db.docs);
          const newDoc = { id: 'd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), no, type: 'QT', seller: account.tenantId, buyer: inquiry.buyer, createdBy: account.name, createdAt: tnow, status: 'Sent', currency: inquiry.currency, validUntil, inquiryNo: inquiry.no, items: lines, timeline: [{ ts: tnow, text: 'Quote generated and sent', by: account.name }] };
          updateDocs(prev => [...prev, newDoc]);
          // Push notification to buyer main account
          const buyerMain = db.accounts.find(a => a.tenantId === inquiry.buyer && a.main);
          if (buyerMain) {
            // R14 — 推送文本同步追加库存提示（纯文本拼接，不改金额，AC-14-01/08）
            const hint = stockHintFor(db, account.tenantId, lines.map(l => l.pid), (db.settings || {}).lowStockThreshold);
            updatePushes(prev => [...prev, { id: 'w-' + Date.now(), toAccount: buyerMain.id, docNo: no, docType: 'QT', ts: tnow, text: `New quote from ${tenantName(db, account.tenantId)} on inquiry ${inquiry.no}. Valid until ${validUntil}.` + (hint ? '\n\n' + hint : ''), read: false }]);
          }
          toast(`Quote ${no} sent — buyer notified via WhatsApp`, 'success');
        }
      },

      // WhatsApp negotiation demo — the AI engine generates a quote DRAFT from
      // the negotiated prices (flow: AI draft → supplier one-tap confirm →
      // link pushed to the buyer, handled by docVerb('Confirm Quote')).
      waAutoQuote(inquiry, discount) {
        const tnow = now();
        const vd = new Date(Date.now() + 7 * 86400000);
        const validUntil = `${vd.getFullYear()}-${String(vd.getMonth() + 1).padStart(2, '0')}-${String(vd.getDate()).padStart(2, '0')}`;
        const lines = inquiry.items.map(it => ({ pid: it.pid, name: it.name, spec: it.spec, unit: it.unit, qty: Number(it.qty) || 0, price: Math.round(it.price * (1 - discount) * 100) / 100 }));
        const qno = nextNo('QT', db.docs);
        const newDoc = { id: 'd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), no: qno, type: 'QT', seller: inquiry.seller, buyer: inquiry.buyer, createdBy: 'AI Engine', createdAt: tnow, status: 'Draft', currency: inquiry.currency, validUntil, inquiryNo: inquiry.no, items: lines, timeline: [
          { ts: tnow, text: 'AI generated quote draft from WhatsApp negotiation', by: 'AI Engine' },
        ] };
        updateDocs(prev => [...prev, newDoc]);
        toast(`AI quote draft ${qno} generated`, 'success');
        return newDoc;
      },

      savePO(f, submit) {
        const items = f.items.filter(it => it.pid).map(it => ({
          pid: it.pid, name: (db.products.find(p => p.id === it.pid) || {}).name || it.name,
          spec: (db.products.find(p => p.id === it.pid) || {}).spec || it.spec,
          unit: (db.products.find(p => p.id === it.pid) || {}).unit || 'pcs',
          qty: Number(it.qty), price: Number(it.price),
        }));
        const currency = (db.products.find(p => p.id === (items[0] || {}).pid) || {}).currency || 'USD';
        const chainPath = [f.seller, account.tenantId];
        const no = nextNo('PO', db.docs);
        const newDoc = { id: 'd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), no, type: 'PO', buyer: account.tenantId, seller: f.seller, createdBy: account.name, createdAt: now(), status: 'Pending Acceptance', currency, deliveryDate: f.deliveryDate, quoteNo: f.quoteNo || null, chainPath, items, timeline: [{ ts: now(), text: `Purchase order created and submitted — awaiting supplier acceptance`, by: account.name }] };
        updateDocs(prev => [...prev, newDoc]);
        toast(`Order ${no} submitted for supplier review`, 'success');
      },

      ship(po) {
        const tnow = now();
        const items = po.items.map(it => ({ ...it }));
        // decrement seller stock and record movements
        const tenantStock = db.stock[po.seller] || {};
        const nextStock = { ...tenantStock };
        const newMoves = [];
        items.forEach(it => {
          const before = nextStock[it.pid] || 0;
          const after = before - it.qty;
          nextStock[it.pid] = after;
          newMoves.push({ id: 'm-' + Date.now() + Math.random().toString(36).slice(2, 5), tenantId: po.seller, productId: it.pid, type: 'OUT', qty: -it.qty, before, after, refNo: 'CK-' + Date.now(), by: account.name, ts: tnow, reason: `Shipment for ${po.no}` });
        });
        updateStock(prev => ({ ...prev, [po.seller]: nextStock }));
        updateMovements(prev => [...prev, ...newMoves]);
        // create CK doc — R16: born at 拣货中 (Picking); the seller picks,
        // then dispatches with carrier info (waybill at dispatch, AC-16-06)
        const ckNo = nextNo('CK', db.docs);
        const ck = { id: 'd-ck-' + Date.now(), no: ckNo, type: 'CK', seller: po.seller, buyer: po.buyer, createdBy: account.name, createdAt: tnow, status: 'Picking', currency: po.currency, poNo: po.no, items, waybill: null,
          picking: { startedAt: null, finishedAt: null, lines: items.map(it => ({ pid: it.pid, expectedQty: it.qty, pickedQty: 0, scanConfirmed: false, shortReason: '' })), shortPick: false, by: null },
          timeline: [{ ts: tnow, text: `Outbound order generated from ${po.no}`, by: 'System' }, { ts: tnow, text: `Shipment confirmed by ${account.name} — awaiting picking`, by: account.name }] };
        // R16 — 确认发货 generates the CK at picking; the order moves to 待拣货
        // until picking completes (→ 待发货), then dispatch (→ 待收货)
        updateDocs(prev => {
          const docs = prev.map(d => d.id === po.id ? { ...d, status: 'Pending Picking', timeline: [...d.timeline, { ts: tnow, text: `Outbound order ${ckNo} generated — picking required before dispatch`, by: account.name }] } : d);
          docs.push(ck);
          return docs;
        });
        // notify buyer that the outbound order was generated (picking in progress)
        const buyerMain = db.accounts.find(a => a.tenantId === po.buyer && a.main);
        if (buyerMain) {
          updatePushes(prev => [...prev, { id: 'w-' + Date.now(), toAccount: buyerMain.id, docNo: ckNo, docType: 'CK', ts: tnow, text: `Outbound order ${ckNo} generated for your order ${po.no}. Picking in progress — we will notify you again once dispatched.`, read: false }]);
        }
        toast(`Shipment confirmed — outbound doc ${ckNo} generated at picking status`, 'success');
      },

      // R16 — 开始拣货：写 picking.startedAt / by，PO → 拣货中
      startPicking(ck) {
        const tnow = now();
        const po = db.docs.find(d => d.type === 'PO' && d.no === ck.poNo);
        updateDocs(prev => prev.map(d => {
          if (d.id === ck.id) return { ...d, picking: { ...(d.picking || {}), startedAt: tnow, by: account.name }, timeline: [...d.timeline, { ts: tnow, text: `Picking started by ${account.name}`, by: account.name }] };
          if (po && d.id === po.id) return { ...d, status: 'Picking', timeline: [...d.timeline, { ts: tnow, text: `Picking started (${ck.no})`, by: account.name }] };
          return d;
        }));
        toast(`Picking started for ${ck.no}`, 'success');
      },

      // R16 — 完成拣货：短拣原因必填（AC-16-04）、多拣拦截；CK → 待发货、PO → 待发货。
      // 拣货数作为后续实收默认值（AC-16-12）：CK items[].qty 改写为 pickedQty。
      finishPicking(ck, pickedLines, shortReasons) {
        const tnow = now();
        const base = (ck.picking && ck.picking.lines) ? ck.picking.lines : ck.items.map(it => ({ pid: it.pid, expectedQty: it.qty, pickedQty: 0, scanConfirmed: false, shortReason: '' }));
        const merged = base.map(l => {
          const picked = Number(pickedLines && pickedLines[l.pid] != null ? pickedLines[l.pid] : ifnull(l.pickedQty, 0));
          return { ...l, pickedQty: picked, shortReason: ((shortReasons && shortReasons[l.pid]) || l.shortReason || '').trim() };
        });
        for (const l of merged) {
          if (isNaN(l.pickedQty) || l.pickedQty < 0 || l.pickedQty > l.expectedQty) { toast('Picked quantity cannot exceed the expected quantity — over-picking is not allowed', 'error'); return false; }
          if (l.pickedQty < l.expectedQty && !l.shortReason) { toast('Short-pick reason is required for every short line', 'error'); return false; }
        }
        const shortPick = merged.some(l => l.pickedQty < l.expectedQty);
        const po = db.docs.find(d => d.type === 'PO' && d.no === ck.poNo);
        // short pick → put the un-picked units back into stock (balance-level
        // correction; the original OUT movement keeps its audit trail)
        if (shortPick) {
          const tenantStock = db.stock[ck.seller] || {};
          const nextStock = { ...tenantStock };
          merged.forEach(l => { if (l.pickedQty < l.expectedQty) nextStock[l.pid] = (nextStock[l.pid] || 0) + (l.expectedQty - l.pickedQty); });
          updateStock(prev => ({ ...prev, [ck.seller]: nextStock }));
        }
        updateDocs(prev => prev.map(d => {
          if (d.id === ck.id) return {
            ...d,
            status: 'Pending Shipment',
            items: d.items.map(it => { const l = merged.find(x => x.pid === it.pid); return l ? { ...it, qty: l.pickedQty } : it; }),
            picking: { ...(d.picking || {}), lines: merged, shortPick, finishedAt: tnow, by: account.name },
            timeline: [...d.timeline, { ts: tnow, text: `Picking completed by ${account.name} — ${merged.length} lines, short pick: ${shortPick ? 'yes' : 'no'}`, by: account.name }],
          };
          if (po && d.id === po.id) return { ...d, status: 'Pending Shipment', timeline: [...d.timeline, { ts: tnow, text: `Picking completed (${ck.no})${shortPick ? ' — short pick' : ''} — ready for dispatch`, by: account.name }] };
          return d;
        }));
        toast(`Picking completed — ${ck.no} is awaiting dispatch`, 'success');
        return true;
      },

      // R82 — seller dispatches the generated outbound order: CK → Shipped,
      // the linked order moves to 待收货, waybill link pushed to the buyer
      dispatch(ck, logistics) {
        const tnow = now();
        const po = db.docs.find(d => d.type === 'PO' && d.no === ck.poNo);
        // R16 — carrier info is captured HERE (after picking, AC-16-06);
        // the waybill number is generated with the dispatch
        const waybill = { no: 'WY-' + tnow.slice(0, 10).replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 900) + 100), ...(logistics || {}) };
        updateDocs(prev => prev.map(d => {
          if (d.id === ck.id) return { ...d, status: 'Shipped', waybill, timeline: [...d.timeline, { ts: tnow, text: `Dispatched by ${account.name} — waybill ${waybill.no}, carrier ${waybill.carrier || 'TBC'}`, by: account.name }] };
          if (po && d.id === po.id) return { ...d, status: 'Pending Receipt', timeline: [...d.timeline, { ts: tnow, text: `Dispatched (${ck.no}) — in transit, awaiting buyer receipt`, by: account.name }] };
          return d;
        }));
        const buyerMain = db.accounts.find(a => a.tenantId === ck.buyer && a.main);
        if (buyerMain) {
          // R16/AC-16-07 — 发货后推送带一次性 token 的免登录录单链接
          const base = (typeof window !== 'undefined' && window.location) ? window.location.href.split('?')[0] : '';
          const guestLink = `${base}?doc=${ck.no}&token=demo`;
          updatePushes(prev => [...prev, { id: 'w-' + Date.now(), toAccount: buyerMain.id, docNo: ck.no, docType: 'CK', ts: tnow, text: `Your order ${ck.poNo} has been dispatched. Waybill ${waybill.no}. Tap to confirm receipt.` + '\n\nLogin-free confirm: ' + guestLink, read: false }]);
        }
        toast(`Dispatched — waybill ${waybill.no} link pushed to the buyer`, 'success');
      },

      receive(ck, mode, qtys, reason, byAccount, signature) {
        const tnow = now();
        // byAccount: the account the action is attributed to (defaults to the
        // signed-in account; the login-free WhatsApp flow passes the buyer's
        // main account so the audit trail stays correct)
        const opName = (byAccount && byAccount.name) || account.name;
        const numQtys = qtys ? Object.keys(qtys).reduce(function (acc, k) { acc[k] = Number(qtys[k]); return acc; }, {}) : {};
        const items = ck.items.map(it => ({ ...it, actualQty: ifnull(numQtys[it.pid], it.qty) }));
        const totalShipped = items.reduce((s, it) => s + it.qty, 0);
        const totalRecv = items.reduce((s, it) => s + ifnull(it.actualQty, it.qty), 0);
        const status = mode === 'reject' ? 'Rejected' : (totalRecv < totalShipped ? 'Partial Variance' : 'Received');
        const variance = { reason: mode === 'accept' ? '' : (reason || ''), receivedAll: status === 'Received' };
        // increment buyer stock
        const tenantStock = db.stock[ck.buyer] || {};
        const nextStock = { ...tenantStock };
        const newMoves = [];
        items.forEach(it => {
          const qty = ifnull(it.actualQty, it.qty);
          const before = nextStock[it.pid] || 0;
          const after = before + qty;
          nextStock[it.pid] = after;
          newMoves.push({ id: 'm-' + Date.now() + Math.random().toString(36).slice(2, 5), tenantId: ck.buyer, productId: it.pid, type: 'IN', qty, before, after, refNo: 'RK-' + Date.now(), by: opName, ts: tnow, reason: `Receiving from ${ck.no}` });
        });
        updateStock(prev => ({ ...prev, [ck.buyer]: nextStock }));
        updateMovements(prev => [...prev, ...newMoves]);
        // create RK doc
        const rkNo = nextNo('RK', db.docs);
        const rk = { id: 'd-rk-' + Date.now(), no: rkNo, type: 'RK', seller: ck.seller, buyer: ck.buyer, createdBy: opName, createdAt: tnow, status, currency: ck.currency, ckNo: ck.no, items, variance,
          // R16 — 签收签名随实收写入 RK（AC-16-10：ckNo 关联正确）
          signature: signature || null,
          timeline: [{ ts: tnow, text: `Inbound record generated from ${ck.no}`, by: 'System' }, { ts: tnow, text: `Receiving confirmed${status === 'Partial Variance' ? ' (partial)' : ''} by ${opName}`, by: opName }, ...(signature ? [{ ts: tnow, text: `Customer signed (${signature.mode === 'tap' ? 'tap confirmation' : 'handwritten signature'}) by ${signature.signedBy || opName}`, by: opName }] : [])] };
        // update CK status, complete PO — the system then URGES the supplier to
        // issue the invoice (flow: receiving → auto invoice reminder → the
        // supplier issues it via Create Invoice and pushes the link)
        const po = db.docs.find(d => d.type === 'PO' && d.no === ck.poNo);
        // R82 — terminal order statuses: 已收货 / 部分收货 / 已拒收
        const poStatus = mode === 'reject' ? 'Receipt Rejected' : (totalRecv < totalShipped ? 'Partially Received' : 'Received');
        updateDocs(prev => {
          // R82 — CK terminal status: full → Received / partial → Partial Variance / reject → Rejected
          const ckStatus = mode === 'reject' ? 'Rejected' : (totalRecv < totalShipped ? 'Partial Variance' : 'Received');
          let docs = prev.map(d => d.id === ck.id ? { ...d, status: ckStatus, timeline: [...d.timeline, { ts: tnow, text: `Receiving confirmed by ${tenantName(db, ck.buyer)}`, by: opName }, ...(signature ? [{ ts: tnow, text: `Customer signed by ${signature.signedBy || opName} — ${signature.mode === 'tap' ? 'tap confirmation' : 'handwritten signature'}`, by: opName }] : [])] } : d);
          docs.push(rk);
          if (po) {
            docs = docs.map(d => d.id === po.id ? { ...d, status: poStatus, timeline: [...d.timeline, { ts: tnow, text: `Receiving confirmed (${rkNo}) — order ${poStatus === 'Received' ? 'fully received' : poStatus === 'Partially Received' ? 'partially received' : 'rejected'}`, by: opName }] } : d);
          }
          return docs;
        });
        // notify the supplier that receiving is confirmed
        if (po) {
          const sellerMain = db.accounts.find(a => a.tenantId === po.seller && a.main);
          if (sellerMain) {
            updatePushes(prev => [...prev, { id: 'w-' + Date.now(), toAccount: sellerMain.id, docNo: po.no, docType: 'PO', ts: tnow, text: `Receiving completed for ${po.no} (${poStatus === 'Received' ? 'all items' : poStatus === 'Partially Received' ? 'partial' : 'rejected'}).`, read: false }]);
          }
        }
        // R17 — 买方签收后自动开票：金额按实收数量 × 成交价（AC-17-03/04）；
        // ckNo 维度判重（AC-17-07）——同一 CK 重复签收不开第二张，
        // 部分签收 + 补货再签收（不同 CK）各开一张差额票。
        if (po && mode !== 'reject' && !db.docs.some(d => d.type === 'FP' && d.ckNo === ck.no)) {
          const fpItems = items.filter(it => (ifnull(it.actualQty, it.qty)) > 0).map(it => ({ ...it, qty: ifnull(it.actualQty, it.qty) }));
          if (fpItems.length) {
            const fno = nextNo('FP', db.docs);
            const settings = db.settings || {};
            const taxRate = (settings.taxRate === undefined || settings.taxRate === null) ? null : Number(settings.taxRate);
            const linesTotal = fpItems.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
            const taxAmount = taxRate === null ? 0 : Math.round(linesTotal * taxRate) / 100;
            // Q23：全额票含运费，差额票运费为 0（可解释的简单分摊）
            const freight = mode === 'accept' ? (Number(po.freight) || 0) : 0;
            const fp = { id: 'd-fp-' + Date.now(), no: fno, type: 'FP', seller: ck.seller, buyer: ck.buyer, createdBy: 'System', createdAt: tnow, status: 'Issued', currency: ck.currency, poNo: po.no, ckNo: ck.no, issueDate: tnow.slice(0, 10), basis: 'receivedQty', taxRate, taxAmount, freight, items: fpItems, timeline: [{ ts: tnow, text: `Invoice auto-issued on receiving (${rk.no}) — amounts based on actually received quantities`, by: 'System' }] };
            updateDocs(prev => [...prev, fp]);
            // AC-17-05 — 发票生成后自动推送 WhatsApp 给买方
            const buyerMainFp = db.accounts.find(a => a.tenantId === ck.buyer && a.main);
            if (buyerMainFp) updatePushes(prev => [...prev, { id: 'w-' + Date.now() + '-fp', toAccount: buyerMainFp.id, docNo: fno, docType: 'FP', ts: tnow, text: `Invoice ${fno} issued by ${tenantName(db, ck.seller)} for order ${po.no} — based on received quantities. Tap to view and confirm.`, read: false }]);
            toast(`Invoice ${fno} auto-issued for order ${po.no}`, 'success');
          }
        }
        toast(`Receiving confirmed — inbound record ${rkNo} generated`, 'success');
      },

      // R83 — buyer re-receives the outstanding after a partial receipt
      // (qtys: optional { pid: qty } override; defaults to all outstanding)
      rereceive(po, qtys, byAccount) {
        const tnow = now();
        const opName = (byAccount && byAccount.name) || account.name;
        const cks = db.docs.filter(d => d.type === 'CK' && d.poNo === po.no);
        const rks = db.docs.filter(d => d.type === 'RK' && cks.some(c => c.no === d.ckNo));
        // outstanding per pid = sum(cks qty) - sum(rks actualQty)
        const outstanding = {};
        po.items.forEach(it => { outstanding[it.pid] = it.qty; });
        rks.forEach(rk => rk.items.forEach(it => { outstanding[it.pid] = (outstanding[it.pid] || 0) - (ifnull(it.actualQty, it.qty)); }));
        const numQtys = qtys ? Object.keys(qtys).reduce((acc, k) => { acc[k] = Number(qtys[k]); return acc; }, {}) : {};
        const items = po.items.map(it => {
          const o = outstanding[it.pid] || 0;
          const rq = numQtys[it.pid] != null ? Number(numQtys[it.pid]) : o;
          return { pid: it.pid, name: it.name, spec: it.spec, unit: it.unit, qty: o, actualQty: rq };
        });
        const allCaughtUp = items.every(it => it.actualQty >= it.qty);
        // increment buyer stock by actually re-received qty
        const tenantStock = db.stock[po.buyer] || {};
        const nextStock = { ...tenantStock };
        const newMoves = [];
        items.forEach(it => {
          if (it.actualQty > 0) {
            const before = nextStock[it.pid] || 0;
            const after = before + it.actualQty;
            nextStock[it.pid] = after;
            newMoves.push({ id: 'm-' + Date.now() + Math.random().toString(36).slice(2, 5), tenantId: po.buyer, productId: it.pid, type: 'IN', qty: it.actualQty, before, after, refNo: 'RK-' + Date.now(), by: opName, ts: tnow, reason: 'Re-receiving for ' + po.no });
          }
        });
        updateStock(prev => ({ ...prev, [po.buyer]: nextStock }));
        updateMovements(prev => [...prev, ...newMoves]);
        // create RK doc
        const rkNo = nextNo('RK', db.docs);
        const rkStatus = allCaughtUp ? 'Received' : 'Partial Variance';
        const rk = { id: 'd-rk-' + Date.now(), no: rkNo, type: 'RK', seller: po.seller, buyer: po.buyer, createdBy: opName, createdAt: tnow, status: rkStatus, currency: po.currency, ckNo: cks.length ? cks[cks.length - 1].no : '', items, variance: { reason: '', receivedAll: allCaughtUp }, timeline: [{ ts: tnow, text: 'Re-receiving confirmed (' + rkNo + ') — order ' + (allCaughtUp ? 'fully received' : 'partially received'), by: opName }] };
        // PO status: Received if all caught up, else Partially Received
        const poStatus = allCaughtUp ? 'Received' : 'Partially Received';
        updateDocs(prev => [...prev, rk].map(d => d.id === po.id ? { ...d, status: poStatus, timeline: [...d.timeline, { ts: tnow, text: 'Re-receiving confirmed (' + rkNo + ') — order ' + (allCaughtUp ? 'fully received' : 'partially received'), by: opName }] } : d));
        // notify the supplier
        const sellerMain = db.accounts.find(a => a.tenantId === po.seller && a.main);
        if (sellerMain) {
          updatePushes(prev => [...prev, { id: 'w-' + Date.now(), toAccount: sellerMain.id, docNo: po.no, docType: 'PO', ts: tnow, text: 'Re-receiving completed for ' + po.no + ' (' + (allCaughtUp ? 'all items' : 'partial') + ').', read: false }]);
        }
        toast('Re-receiving confirmed — inbound record ' + rkNo + ' generated', 'success');
      },

      // R83 — supplier issues a replenishment outbound to cover the shortfall
      // R94 — optional qtys override: the replenishment form lets the buyer
      // choose per-item quantities (capped at the outstanding)
      replenish(po, qtys) {
        const tnow = now();
        const cks = db.docs.filter(d => d.type === 'CK' && d.poNo === po.no);
        const rks = db.docs.filter(d => d.type === 'RK' && cks.some(c => c.no === d.ckNo));
        const outstanding = {};
        po.items.forEach(it => { outstanding[it.pid] = it.qty; });
        rks.forEach(rk => rk.items.forEach(it => { outstanding[it.pid] = (outstanding[it.pid] || 0) - (ifnull(it.actualQty, it.qty)); }));
        const numQtys = qtys ? Object.keys(qtys).reduce((acc, k) => { acc[k] = Number(qtys[k]); return acc; }, {}) : {};
        const items = po.items.map(it => {
          const o = outstanding[it.pid] || 0;
          if (o <= 0) return null;
          const q = numQtys[it.pid] != null ? Math.min(Math.max(0, numQtys[it.pid]), o) : o;
          return q > 0 ? { pid: it.pid, name: it.name, spec: it.spec, unit: it.unit, qty: q, price: it.price } : null;
        }).filter(Boolean);
        if (items.length === 0) { toast('No outstanding to replenish', 'info'); return; }
        // decrement seller stock by outstanding qty
        const tenantStock = db.stock[po.seller] || {};
        const nextStock = { ...tenantStock };
        const newMoves = [];
        items.forEach(it => {
          const before = nextStock[it.pid] || 0;
          const after = before - it.qty;
          nextStock[it.pid] = after;
          newMoves.push({ id: 'm-' + Date.now() + Math.random().toString(36).slice(2, 5), tenantId: po.seller, productId: it.pid, type: 'OUT', qty: -it.qty, before, after, refNo: 'CK-' + Date.now(), by: account.name, ts: tnow, reason: 'Replenishment for ' + po.no });
        });
        updateStock(prev => ({ ...prev, [po.seller]: nextStock }));
        updateMovements(prev => [...prev, ...newMoves]);
        // create CK doc — auto waybill (mirrors ship())
        const ckNo = nextNo('CK', db.docs);
        const ck = { id: 'd-ck-' + Date.now(), no: ckNo, type: 'CK', seller: po.seller, buyer: po.buyer, createdBy: account.name, createdAt: tnow, status: 'Pending Shipment', currency: po.currency, poNo: po.no, items, waybill: { no: 'WY-' + tnow.slice(0, 10).replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 900) + 100), carrier: 'Swift Cargo', plate: 'LAG-889-XB', driver: 'Uche Nwankwo', phone: '+234 809 112 3344' }, timeline: [{ ts: tnow, text: 'Replenishment outbound generated from ' + po.no, by: 'System' }, { ts: tnow, text: 'Replenishment confirmed by ' + account.name + ' — awaiting dispatch', by: account.name }] };
        // PO status: replenishment outbound in flight → Pending Shipment
        updateDocs(prev => [...prev, ck].map(d => d.id === po.id ? { ...d, status: 'Pending Shipment', timeline: [...d.timeline, { ts: tnow, text: 'Replenishment outbound ' + ckNo + ' generated for the shortfall — awaiting dispatch', by: account.name }] } : d));
        // R91 — 补货 is buyer-initiated: notify the counterparty of whoever
        // clicked (buyer click → notify the seller; seller click → buyer)
        const counter = account.tenantId === po.buyer
          ? db.accounts.find(a => a.tenantId === po.seller && a.main)
          : db.accounts.find(a => a.tenantId === po.buyer && a.main);
        if (counter) {
          updatePushes(prev => [...prev, { id: 'w-' + Date.now(), toAccount: counter.id, docNo: ckNo, docType: 'CK', ts: tnow, text: `Replenishment outbound ${ckNo} generated for order ${po.no}. Waybill ${ck.waybill.no}.`, read: false }]);
        }
        toast('Replenishment confirmed — outbound doc ' + ckNo + ' generated for the shortfall', 'success');
      },

      // R83 — buyer terminates receiving after a partial receipt (flow end)
      // R94 — a termination reason is required (captured on the form)
      terminateReceiving(po, reason) {
        const tnow = now();
        updateDocs(prev => prev.map(d => d.id === po.id ? { ...d, status: 'Receiving Closed', terminateReason: reason || '', timeline: [...d.timeline, { ts: tnow, text: 'Receiving terminated by ' + account.name + (reason ? ' — reason: ' + reason : '') + ' — order closed with partial receipt', by: account.name }] } : d));
        // notify the supplier
        const sellerMain = db.accounts.find(a => a.tenantId === po.seller && a.main);
        if (sellerMain) {
          updatePushes(prev => [...prev, { id: 'w-' + Date.now(), toAccount: sellerMain.id, docNo: po.no, docType: 'PO', ts: tnow, text: 'Receiving for order ' + po.no + ' terminated by ' + account.name + (reason ? ' — reason: ' + reason : '') + ' — order closed with partial receipt.', read: false }]);
        }
        toast('Receiving terminated — order closed with partial receipt', 'info');
      },

      adjustStock(productId, type, qty, reason) {
        const tnow = now();
        const tid = account.tenantId;
        // tenant boundary — stock adjustments apply to your own products only
        const prod = db.products.find(x => x.id === productId);
        if (!prod || prod.ownerId !== tid) { toast('Stock adjustment applies to your own products only', 'error'); return; }
        const current = (db.stock[tid] || {})[productId] || 0;
        let delta = type === 'ADJ' ? (qty - current) : (type === 'IN' ? qty : -qty);
        const after = current + delta;
        updateStock(prev => ({ ...prev, [tid]: { ...prev[tid], [productId]: after } }));
        updateMovements(prev => [...prev, { id: 'm-' + Date.now(), tenantId: tid, productId, type, qty: delta, before: current, after, refNo: 'ADJ-' + Date.now(), by: account.name, ts: tnow, reason }]);
        toast(`Stock adjusted — ${type === 'IN' ? '+' : type === 'OUT' ? '−' : ''}${Math.abs(delta)} units`, 'success');
      },

      // R100h — 扫码批量出库：一次确认多条 OUT 库存流水（仅限本商户物料，逐行校验库存充足；共享一个 OUT- 编号便于追溯）
      batchScanOut(cart, note) {
        // R11 — 一次只处理一辆出库车：行与收货方都取自 cart（收货方绑定由
        // cartApi.add 在加货时校验），全部流水共享一个 OUT- 编号（一张 CK）
        const lines = (cart && cart.lines) || [];
        const receiver = cart ? cart.receiver : null;
        const tnow = now();
        const tid = account.tenantId;
        const stockMap = db.stock[tid] || {};
        for (const ln of lines) {
          const prod = db.products.find(p => p.id === ln.pid);
          if (!prod || prod.ownerId !== tid) { toast('Outbound applies to your own products only', 'error'); return false; }
          const cur = stockMap[ln.pid] || 0;
          if (!(ln.qty > 0)) { toast(`Invalid quantity — ${prod.name}`, 'error'); return false; }
          if (ln.qty > cur) { toast(`Insufficient stock — ${prod.name}: on hand ${cur}`, 'error'); return false; }
        }
        // 收货方必填：可从下游商户选择，也可手动填写名称/手机号；流水携带收货方信息
        const recv = receiver && String(receiver.name || '').trim()
          ? { name: String(receiver.name).trim(), phone: String(receiver.phone || '').trim(), tenantId: receiver.tenantId || null }
          : null;
        if (!recv) { toast('Select or enter a receiver for the outbound', 'error'); return false; }
        const total = lines.reduce((s, l) => s + l.qty, 0);
        const refNo = 'OUT-' + tnow.slice(0, 10).replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 900) + 100);
        // R10 —— 整单折扣（车级）与金额五行口径
        const cartPct = (cart && cart.discountPct !== undefined && cart.discountPct !== null && cart.discountPct !== '')
          ? Number(cart.discountPct) : 0;
        const settings = db.settings || {};
        const taxRate = (settings.taxRate === undefined || settings.taxRate === null) ? null : Number(settings.taxRate);
        let subtotal = 0, discountTotal = 0;
        const docItems = lines.map(ln => {
          const prod = db.products.find(p => p.id === ln.pid) || {};
          const unit = Number(ln.salePrice) || 0;
          const qty = Number(ln.qty) || 0;
          const gross = unit * qty;
          const rowPct = (ln.discountPct === undefined || ln.discountPct === null) ? cartPct : (Number(ln.discountPct) || 0);
          const net = +(unit * (1 - rowPct / 100)).toFixed(2);
          subtotal += gross;
          discountTotal += gross - net * qty;
          return {
            pid: ln.pid, name: prod.name || '', qty, price: net, grossPrice: unit,
            discountPct: rowPct, currency: ln.saleCurrency || prod.currency || 'USD',
          };
        });
        subtotal = Math.round(subtotal * 100) / 100;
        discountTotal = Math.round(discountTotal * 100) / 100;
        const taxAmount = taxRate === null ? 0 : Math.round((subtotal - discountTotal) * taxRate) / 100;
        let freight = (cart && cart.freight !== undefined && cart.freight !== null && cart.freight !== '') ? Number(cart.freight) : null;
        if (freight === null) freight = settings.freightEnabled ? Number(settings.defaultFreight) || 0 : 0;
        const totalAmount = Math.round((subtotal - discountTotal + taxAmount + freight) * 100) / 100;
        const docCurrency = (docItems[0] && docItems[0].currency) || 'USD';
        const nextStock = { ...stockMap };
        const newMoves = lines.map(ln => {
          const before = nextStock[ln.pid] || 0;
          const after = before - ln.qty;
          nextStock[ln.pid] = after;
          const reasonParts = [];
          if ((note || '').trim()) reasonParts.push(note.trim());
          reasonParts.push(`Receiver: ${recv.name}${recv.phone ? ` (${recv.phone})` : ''}`);
          // 实际销售价随流水留痕：字段 + 事由里带「实际销售价 × 数量 = 金额」
          // R10 —— 折扣：行折扣优先于整体折扣；写流水与单据都用折后价
          const salePrice = Number(ln.salePrice) || 0;
          const saleCurrency = ln.saleCurrency || 'USD';
          const rowPct = (ln.discountPct === undefined || ln.discountPct === null) ? cartPct : (Number(ln.discountPct) || 0);
          const grossAmount = salePrice * ln.qty;
          const netUnit = +(salePrice * (1 - rowPct / 100)).toFixed(2);
          const saleAmount = netUnit * ln.qty;
          if (rowPct) reasonParts.push(`Discount ${rowPct}% on ${salePrice.toFixed(2)}`);
          reasonParts.push(`Sale: ${saleCurrency} ${netUnit.toFixed(2)} × ${ln.qty} = ${saleCurrency} ${saleAmount.toFixed(2)}`);
          reasonParts.push('Batch scan outbound (scan)');
          return { id: 'm-' + Date.now() + Math.random().toString(36).slice(2, 5), tenantId: tid, productId: ln.pid, type: 'OUT', qty: -ln.qty, before, after, refNo, by: account.name, ts: tnow, receiverName: recv.name, receiverPhone: recv.phone || null, receiverTenantId: recv.tenantId, salePrice, saleCurrency, saleAmount, reason: reasonParts.join(' · ') };
        });
        updateStock(prev => ({ ...prev, [tid]: nextStock }));
        updateMovements(prev => [...prev, ...newMoves]);
        // R10/AC-10-13 —— 出库暂存生成一张 CK 单据，折扣/税额/运费以快照写入，重开后数值不变
        const ckNo = nextNo('CK', db.docs);
        const ck = {
          id: 'd-ck-' + Date.now(), no: ckNo, type: 'CK', seller: tid, buyer: recv.tenantId || null,
          createdBy: account.name, createdAt: tnow, status: 'Pending Shipment', currency: docCurrency,
          poNo: null, waybill: null, fromStaging: true, note: note || '',
          items: docItems, discountPct: cartPct, subtotal, discountTotal,
          taxRate, taxAmount, freight, totalAmount, amountsFrozen: true,
          timeline: [{ ts: tnow, text: `Outbound order generated from staging cart (${refNo})`, by: 'System' }],
        };
        updateDocs(prev => [...prev, ck]);
        toast(`Batch outbound complete — ${lines.length} items, ${total} units to ${recv.name} (${refNo})`, 'success');
        return true;
      },

      // R100q — 扫码批量入库：一次确认多条 IN 库存流水。入库物料可能已在本商户仓库
      // （kind:'exist' → 直接累加库存），也可能是新物料（kind:'new' → 快速建档后入库）；
      // 全部流水共享一个 IN- 编号便于追溯。
      // 入库确认时必须选择供货方（supplierId）：流水带 supplier 字段并在事由中
      // 记录供货方名称；供货方可当场新建（createSupplier）后立即选用。
      batchScanIn(lines, note, supplier) {
        const tnow = now();
        const tid = account.tenantId;
        const stockMap = db.stock[tid] || {};
        // supplier 可为商户 id（已有供货方）或新建商户对象（手动输入路径：
        // createSupplier 的 setDb 在同一事件内尚未生效，直接传对象避免查不到）。
        // R08 — 'self' = 自产：不建租户、不查 tenants；流水 supplierId=null +
        // selfProduced=true、事由含「自产」；商品 source='self'（粘住不回退）
        const isSelf = supplier === 'self' || (supplier && supplier.self === true);
        const sup = isSelf ? null : (supplier && typeof supplier === 'object'
          ? supplier
          : (supplier ? db.tenants.find(x => x.id === supplier) : null));
        // 自产 / 外购的采购历史供应商字段（AC-08-07：自产同样记入采购历史）
        const supHistFields = isSelf
          ? { supplierId: null, supplierName: null, supplierLabel: 'Self-produced', selfProduced: true }
          : { supplierId: sup ? sup.id : null, supplierName: sup ? sup.name : null };
        // validation pass — nothing is written unless every line checks out
        for (const ln of lines) {
          if (!(Number(ln.qty) > 0)) { toast('Enter an inbound quantity > 0 for every line', 'error'); return { ok: false }; }
          if (ln.kind === 'exist') {
            const prod = db.products.find(p => p.id === ln.pid);
            if (!prod || prod.ownerId !== tid) { toast('Stock-in applies to your own products only', 'error'); return { ok: false }; }
          } else if (!String(ln.name || '').trim()) { toast('Enter a name for every new item', 'error'); return { ok: false }; }
        }
        if (!sup && !isSelf) { toast('Select a supplier for the stock-in', 'error'); return { ok: false }; }
        const total = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
        // 入库金额 = 物料单价 × 数量；单价在入库暂存单内可改（默认参考价/渠道价）。
        // 移动端每行可独立设置币种：行金额与合计按币种分别小计（演示不折算）
        const totalsByCur = {};
        lines.forEach(ln => {
          const cur = (ln.kind === 'exist'
            ? (ln.currency || ((db.products.find(p => p.id === ln.pid) || {}).currency))
            : ln.currency) || 'USD';
          const unit = Number(ln.kind === 'exist' ? ln.unitPrice : ln.price) || 0;
          totalsByCur[cur] = (totalsByCur[cur] || 0) + unit * (Number(ln.qty) || 0);
        });
        const amountsText = Object.keys(totalsByCur)
          .map(c => money(Math.round(totalsByCur[c] * 100) / 100, c).text).join(' · ');
        const refNo = 'IN-' + tnow.slice(0, 10).replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 900) + 100);
        const nextStock = { ...stockMap };
        const newProducts = [];
        const recByPid = {};
        // R06 — 本次入库涉及的商品 pid（第二步调价的行来源，由 batchScanIn 给出，
        // 不在向导里重新推导——入库前后 db 不同，重推会漏新建商品）
        const touchedPids = [];
        const newMoves = lines.map(ln => {
          let pid = ln.pid;
          if (ln.kind === 'new') {
            // R104 — quick profile 物料详情（折叠区可设）：型号默认扫码码号；
            // R107 — 类目改点选多选（ln.categories 存分类 id 数组），建档时映射既有分类
            pid = 'p-' + Date.now() + Math.random().toString(36).slice(2, 5);
            const cats = (Array.isArray(ln.categories) ? ln.categories : []).filter(id => db.categories.some(c => c.id === id));
            // R21 — 新建商品在构造时就把这条入库写进 purchaseHistory（不要事后 find 再补），
            // 并落派生快照 purchasePrice / purchaseCurrency / purchaseUpdatedAt / purchaseRefNo
            const recNew = { price: Number(ln.price) || 0, currency: ln.currency || 'USD', qty: Number(ln.qty) || 0, ts: tnow, refNo, ...supHistFields };
            // R05 — 型号与条码彻底解耦（AC-05-01）：model 只来自表单型号字段，
            // 扫码值进 barcode，不再兼作型号。快速建档的商品条码同样带前缀
            // （AC-05-08），前缀由本商户决定；扫到的完整码原样保留。
            const ownPrefix = ownBarcodePrefix(db, account);
            const rawCode = String(ln.code || '').trim();
            const scannedBarcode = String(ln.barcode || '').trim()
              || (splitBarcode(rawCode).prefix ? rawCode : composeBarcode(ownPrefix, rawCode));
            const bcBody = splitBarcode(scannedBarcode).body;
            newProducts.push({ id: pid, ownerId: tid, name: String(ln.name).trim(), spec: String(ln.spec || '').trim(), model: String(ln.model || '').trim(), brand: String(ln.brand || '').trim(), unit: ln.unit || 'pcs', price: Number(ln.price) || 0, currency: ln.currency || 'USD', image: ln.image || '', images: [], categories: cats, onSale: true, source: isSelf ? 'self' : 'external', barcode: scannedBarcode, barcodeBody: bcBody, purchaseHistory: [recNew], purchasePrice: recNew.price, purchaseCurrency: recNew.currency, purchaseUpdatedAt: recNew.ts, purchaseRefNo: recNew.refNo });
          }
          if (pid && touchedPids.indexOf(pid) < 0) touchedPids.push(pid);
          const up = Number(ln.kind === 'exist' ? ln.unitPrice : ln.price) || 0;
          const amt = Math.round(up * (Number(ln.qty) || 0) * 100) / 100;
          const lnCur = (ln.kind === 'exist'
            ? (ln.currency || ((db.products.find(p => p.id === ln.pid) || {}).currency))
            : ln.currency) || 'USD';
          // R21 — 既有商品：本次入库同样是一条采购价历史（新建商品已在构造时写入，不重复）
          if (ln.kind === 'exist' && pid) {
            recByPid[pid] = { price: up, currency: lnCur, qty: Number(ln.qty) || 0, ts: tnow, refNo, ...supHistFields };
          }
          const before = nextStock[pid] || 0;
          const after = before + (Number(ln.qty) || 0);
          nextStock[pid] = after;
          const reasonParts = [];
          if ((note || '').trim()) reasonParts.push(note.trim());
          if (isSelf) reasonParts.push('自产 / Self-produced');
          else if (sup) reasonParts.push(`Supplier: ${sup.name}`);
          reasonParts.push('Batch scan stock-in (scan)');
          return { id: 'm-' + Date.now() + Math.random().toString(36).slice(2, 5), tenantId: tid, productId: pid, type: 'IN', qty: Number(ln.qty) || 0, before, after, refNo, by: account.name, ts: tnow, supplierId: sup ? sup.id : null, ...(isSelf ? { selfProduced: true } : {}), price: up, amount: amt, currency: lnCur, reason: reasonParts.join(' · ') };
        });
        // R21 — 采购价快照必须并进这一个 setDb（不能再单独发一次，否则被 React 批处理吞掉）
        setDb(prev => ({
          ...prev,
          products: [
            // R08 — 自产入库把商品 source 置 'self'（粘住：能力属性，不因外购回退）
            ...prev.products.map(p => recByPid[p.id] ? { ...p, ...purchasePatch(p, recByPid[p.id]), ...(isSelf ? { source: 'self' } : {}) } : p),
            ...newProducts,
          ],
          stock: { ...prev.stock, [tid]: nextStock },
          movements: [...prev.movements, ...newMoves],
        }));
        toast(`Batch stock-in complete — ${lines.length} items, ${total} units, ${amountsText} in (${refNo})`, 'success');
        // R06 — 返回入库结果给两步向导：第一步（只读确认）与第二步（批量调价）
        const priceRows = touchedPids.map(pid => {
          const np = newProducts.find(x => x.id === pid);
          const p = np || db.products.find(x => x.id === pid) || {};
          return {
            pid, name: p.name || '',
            purchasePrice: purchasePriceOf(p), purchaseCurrency: purchaseCurrencyOf(p),
            marketPrice: ifnull(p.marketPrice, p.price), marketCurrency: marketCurOf(p),
            salePrice: p.price, saleCurrency: p.currency || 'USD',
          };
        });
        const rows = lines.map(ln => {
          const pid = ln.kind === 'exist' ? ln.pid : (newProducts.find(x => x.name === String(ln.name).trim()) || {}).id;
          const p = (pid && db.products.find(x => x.id === pid)) || newProducts.find(x => x.id === pid) || {};
          return {
            pid: pid || '', kind: ln.kind, name: p.name || ln.name || '', unit: p.unit || ln.unit || 'pcs',
            qty: Number(ln.qty) || 0,
            purchasePrice: Number(ln.kind === 'exist' ? ln.unitPrice : ln.price) || 0,
            currency: ln.currency || p.currency || 'USD',
          };
        });
        return {
          ok: true, productIds: touchedPids, priceRows, rows,
          refNo, supplierName: isSelf ? 'Self-produced' : (sup ? sup.name : ''),
          totalQty: total, amountsText,
        };
      },

      createProduct(f) {
        const imgs = Array.isArray(f.images) ? f.images : [];
        // R05 — 条码全平台唯一（跨租户）。冲突时中断写入并提示，不落到 db 里。
        const barcode = String(f.barcode || '').trim();
        if (barcode) {
          const conflict = findBarcodeConflict(db, barcode, null);
          if (conflict) { toast(`Barcode ${barcode} is already used by "${conflict.name}"`, 'error'); return; }
        }
        const p = { id: 'p-' + Date.now(), ownerId: account.tenantId, name: f.name, spec: f.spec, model: f.model, brand: f.brand, unit: f.unit, price: Number(f.price), currency: f.currency, image: imgs[0] || '', images: imgs, categories: f.categories, onSale: f.onSale !== false, barcode, barcodeBody: String(f.barcodeBody || '').trim(), source: f.source || 'external' };
        setDb(prev => ({ ...prev, products: [...prev.products, p] }));
        updateStock(prev => ({ ...prev, [account.tenantId]: { ...prev[account.tenantId], [p.id]: Number(f.stock) || 0 } }));
        toast(`Product "${f.name}" added`, 'success');
      },

      // R99r — 新商品入库：一次性创建商品 + 记一条 IN 库存流水（入库的商品可能是新增的）
      stockInNew(f, qty, reason) {
        const tnow = now();
        const imgs = Array.isArray(f.images) ? f.images : [];
        const n = Math.max(0, Number(qty) || 0);
        const recIn = { price: Number(f.purchasePrice != null ? f.purchasePrice : f.price) || 0, currency: f.purchaseCurrency || f.currency || 'USD', qty: n, supplierId: null, supplierName: null, ts: tnow, refNo: 'IN-' + Date.now() };
        const p = { id: 'p-' + Date.now(), ownerId: account.tenantId, name: f.name, spec: f.spec, model: f.model, brand: f.brand, unit: f.unit, price: Number(f.price), currency: f.currency, image: imgs[0] || '', images: imgs, categories: f.categories, onSale: f.onSale !== false, purchaseHistory: [recIn], purchasePrice: recIn.price, purchaseCurrency: recIn.currency, purchaseUpdatedAt: recIn.ts, purchaseRefNo: recIn.refNo };
        setDb(prev => ({
          ...prev,
          products: [...prev.products, p],
          stock: { ...prev.stock, [account.tenantId]: { ...(prev.stock[account.tenantId] || {}), [p.id]: n } },
          movements: [...prev.movements, { id: 'm-' + Date.now(), tenantId: account.tenantId, productId: p.id, type: 'IN', qty: n, before: 0, after: n, refNo: 'IN-' + Date.now(), by: account.name, ts: tnow, reason: reason || 'Stock-in (new product)' }],
        }));
        toast(`Stocked in "${f.name}" — ${n} units (new product)`, 'success');
      },

      updateProduct(id, f) {
        const imgs = f.images !== undefined ? f.images : undefined; // undefined = untouched
        // R05 — 编辑同样做唯一性校验，排除自身
        const barcode = f.barcode !== undefined ? String(f.barcode || '').trim() : undefined;
        if (barcode) {
          const conflict = findBarcodeConflict(db, barcode, id);
          if (conflict) { toast(`Barcode ${barcode} is already used by "${conflict.name}"`, 'error'); return; }
        }
        setDb(prev => ({ ...prev, products: prev.products.map(p => {
          if (p.id !== id) return p;
          const nextImages = imgs !== undefined ? imgs : (p.images || (p.image ? [p.image] : []));
          // R21 — 采购价历史与派生快照只读取自旧记录，编辑表单无法改写它们
          // （不展开 f 的任意键，只挑可编辑字段显式赋值）
          return {
            ...p,
            name: f.name, spec: f.spec, model: f.model, brand: f.brand, unit: f.unit,
            price: Number(f.price), currency: f.currency,
            images: nextImages, image: nextImages[0] || '', categories: f.categories,
            onSale: f.onSale !== false,
            // R05 — undefined = 本次未改条码，保持原值
            ...(barcode === undefined ? {} : { barcode, barcodeBody: String(f.barcodeBody || '').trim() }),
          };
        }) }));
        toast('Product updated', 'success');
      },

      // price adjustment — cost is read-only (procurement record), market & sale editable
      // R79 — market reference price and channel sales price carry INDEPENDENT
      // currency codes (market may be a global USD reference, sale a local NGN
      // price); both are persisted and logged with their own codes
      adjustPrice(productId, f) {
        const p = db.products.find(x => x.id === productId);
        if (!p) return;
        // tenant boundary — price adjustments apply to your own products only
        if (p.ownerId !== account.tenantId) { toast('Price adjustment applies to your own products only', 'error'); return; }
        const before = p.price, beforeMarket = ifnull(p.marketPrice, p.price);
        const CURS = ['USD', 'NGN', 'CNY'];
        const newCur = CURS.includes(f.currency) ? f.currency : p.currency;
        const beforeMCur = marketCurOf(p);
        const newMCur = CURS.includes(f.marketCurrency) ? f.marketCurrency : beforeMCur;
        setDb(prev => ({
          ...prev,
          products: prev.products.map(x => x.id === productId ? { ...x, price: Number(f.price), marketPrice: Number(f.marketPrice), currency: newCur, marketCurrency: newMCur } : x),
          events: [...prev.events, { id: 'e-' + Date.now() + Math.random().toString(36).slice(2, 5), ts: now(), by: account.name, action: 'Adjust Price', detail: `${p.name} · channel sale price ${p.currency} ${before} → ${newCur} ${f.price}, market reference price ${beforeMCur} ${beforeMarket} → ${newMCur} ${f.marketPrice}` }],
        }));
        toast(`Price updated — ${p.name}`, 'success');
      },

      // R06 — 批量调价（第二步的落库口）。只对「值确实变了」的行写库并记事件，
      // 全部未变则不调用 setDb、不产生任何事件日志（AC-06-09）。
      adjustPrices(patches) {
        const list = (patches || []).filter(pf => pf && pf.pid);
        const changes = [];
        list.forEach(pf => {
          const prod = db.products.find(x => x.id === pf.pid);
          if (!prod || prod.ownerId !== account.tenantId) return;
          const beforeSale = Number(prod.price) || 0;
          const beforeMarket = Number(ifnull(prod.marketPrice, prod.price)) || 0;
          const nextSale = (pf.salePrice === undefined || pf.salePrice === null || pf.salePrice === '') ? beforeSale : Number(pf.salePrice);
          const nextMarket = (pf.marketPrice === undefined || pf.marketPrice === null || pf.marketPrice === '') ? beforeMarket : Number(pf.marketPrice);
          if (nextSale === beforeSale && nextMarket === beforeMarket) return;
          changes.push({
            prod, beforeSale, beforeMarket, nextSale, nextMarket,
            nextCur: pf.saleCurrency || prod.currency || 'USD',
            nextMCur: pf.marketCurrency || marketCurOf(prod),
          });
        });
        if (!changes.length) { toast('No price changed — nothing to save', 'info'); return false; }
        setDb(prev => ({
          ...prev,
          products: prev.products.map(x => {
            const c = changes.find(k => k.prod.id === x.id);
            return c ? { ...x, price: c.nextSale, marketPrice: c.nextMarket, currency: c.nextCur, marketCurrency: c.nextMCur, pendingReprice: false, pendingRepriceAt: null } : x;
          }),
          events: [...prev.events, ...changes.map(c => ({
            id: 'e-' + Date.now() + Math.random().toString(36).slice(2, 5), ts: now(), by: account.name, action: 'Adjust Price',
            detail: `${c.prod.name} · channel sale price ${c.beforeSale} → ${c.nextSale}, market reference price ${c.beforeMarket} → ${c.nextMarket}`,
          }))],
        }));
        toast(`Prices updated — ${changes.length} product(s)`, 'success');
        return true;
      },
      // R06/AC-06-06 — 「稍后处理」给未改价的商品打「待调价」标识。
      // 这里不写事件日志（否则 AC-06-09「不调价不产生额外日志」会被破坏）。
      setPendingReprice(pids, pending) {
        const ids = (pids || []).filter(Boolean);
        if (!ids.length) return;
        setDb(prev => ({ ...prev, products: prev.products.map(p => ids.indexOf(p.id) >= 0
          ? { ...p, pendingReprice: !!pending, pendingRepriceAt: pending ? now() : null } : p) }));
      },
      // R10 — 系统设置（税率 / 运费 / 报价模式 / AI 边界 / 库存阈值 / 收款信息）
      updateSettings(patch) {
        setDb(prev => ({ ...prev, settings: { ...(prev.settings || {}), ...(patch || {}), updatedAt: now() } }));
        toast('Settings updated', 'success');
      },
      createTenant(f) {
        // R01 — 租户对象在 setDb 外构建并同步返回：注册向导提交后需要立刻
        // 展示结果（setDb 内构建的话同一次点击读不到新租户 —— createSupplier
        // 已有同样的先例与注释）。registrationStatus：自主注册（向导）传
        // 'pending' 待平台审核；平台端新建默认 'approved'（平台即审核方）。
        const code = (f.code && String(f.code).trim()) || 'T-' + String(db.tenants.length + 1).padStart(3, '0');
        const t = { id: 't-' + Date.now(), code, name: f.name, type: f.type, country: f.country, maxLevel: f.maxLevel ? Number(f.maxLevel) : null, status: f.status, registrationStatus: f.registrationStatus || 'approved', createdAt: now().slice(0, 10) };
        // one-stop provisioning: tenant + master account (+ WhatsApp binding) in a single step
        const master = f.master && f.master.name
          ? { id: 'a-' + Date.now(), name: f.master.name, tenantId: t.id, type: 'tenant', phone: f.master.phone, password: f.master.password || null, whatsapp: f.master.whatsapp || null, status: 'Active', main: true }
          : null;
        setDb(prev => ({ ...prev, tenants: [...prev.tenants, t], accounts: master ? [...prev.accounts, master] : prev.accounts }));
        if (f.master && f.master.name) toast(`Merchant ${f.name} created — master account ${f.master.name} ready${f.master.whatsapp ? ' (WhatsApp bound)' : ''}`, 'success');
        else toast(`Merchant ${f.name} created`, 'success');
        return t;
      },

      suspendTenant(id) {
        setDb(prev => ({ ...prev, tenants: prev.tenants.map(t => t.id === id ? { ...t, status: 'Suspended' } : t), accounts: prev.accounts.map(a => a.tenantId === id ? { ...a, status: 'Suspended' } : a) }));
        toast('Merchant suspended — all related accounts are now blocked', 'success');
      },

      // R03 — set a custom level label on a downstream merchant.
      // DISPLAY ONLY: this must never touch maxLevel. maxLevel is the single
      // source for permission inference (tenantRole), so renaming a level
      // cannot change what the merchant is allowed to do.
      // The label lives on the LABELLED tenant (downstream), not on the
      // upstream — so two distributors under the same upstream can carry
      // different labels without overwriting each other.
      setLevelLabel(tenantId, label) {
        const raw = String(label == null ? '' : label).trim();
        const next = raw ? raw.slice(0, 20) : null;   // AC-03-07: truncate silently
        setDb(prev => ({ ...prev, tenants: prev.tenants.map(t => t.id === tenantId
          ? { ...t, levelLabel: next, levelLabelUpdatedBy: account.id }
          : t) }));
        const t = db.tenants.find(x => x.id === tenantId);
        toast(next ? `Level label set to "${next}" for ${t ? t.name : tenantId}` : `Level label cleared for ${t ? t.name : tenantId}`, 'success');
      },

      // R01 — platform-side onboarding review. registrationStatus is a separate
      // dimension from status (Active/Suspended): a pending tenant is blocked
      // at login but its records stay intact.
      setRegistrationStatus(tenantId, status) {
        setDb(prev => ({ ...prev, tenants: prev.tenants.map(t => t.id === tenantId ? { ...t, registrationStatus: status } : t) }));
        const t = db.tenants.find(x => x.id === tenantId);
        toast(`Merchant ${t ? t.name : tenantId} — onboarding ${status === 'approved' ? 'approved' : 'rejected'}`, 'success');
      },

      createRelation(up, down) {
        const tnow = now().slice(0, 10);
        setDb(prev => ({ ...prev, relations: [...prev.relations, { upstream: up, downstream: down, createdAt: tnow }] }));
        toast('Supply relation established', 'success');
      },

      // ---- R09 tenant invitations ----
      // 创建邀请（AC-09-09 先查重复用：同一 inviter + role + invitee 在
      // pending 且未过期时复用，不叠加第二条）。
      createInvitation(f) {
        const role = (f && f.role) === 'supplier' ? 'supplier' : 'distributor';
        const inviteeName = String((f && f.inviteeName) || '').trim();
        const inviteePhone = String((f && f.inviteePhone) || '').trim();
        const today = now().slice(0, 10);
        const base = new Date(today + 'T00:00:00');
        base.setDate(base.getDate() + 15);                     // Q9 采用 15 天有效期
        const validUntil = base.toISOString().slice(0, 10);
        const dup = (db.invitations || []).find(i =>
          i.inviterTenantId === account.tenantId && i.role === role && i.status === 'pending' && i.validUntil >= today
          && ((inviteePhone && i.inviteePhone === inviteePhone) || (!inviteePhone && inviteeName && i.inviteeName === inviteeName)));
        if (dup) {
          toast(`Valid invite already exists — reused (code ${dup.code})`, 'info');
          return dup;
        }
        const inv = {
          id: 'inv-' + Date.now(),
          code: makeInviteCode((db.invitations || []).map(i => i.code)),
          role,
          inviterTenantId: account.tenantId,
          inviterAccountId: account.id,
          inviteeName, inviteePhone,
          direction: role === 'supplier' ? 'invitee(upstream)→inviter(downstream)' : 'inviter(upstream)→invitee(downstream)',
          status: 'pending',
          createdAt: now(),
          validUntil,
          acceptedAt: null,
          acceptedByTenantId: null,
        };
        setDb(prev => ({ ...prev, invitations: [...(prev.invitations || []), inv] }));
        toast(`Invite created — code ${inv.code}`, 'success');
        return inv;
      },

      // 接受邀请（AC-09-07）：置 accepted + 建 relations 边。
      // 关系方向是本条最容易错的点：供应商邀请 → 被邀方做上游
      //（edge: upstream=invitee, downstream=inviter）；
      // 分销商邀请 → 被邀方做下游（edge: upstream=inviter, downstream=invitee）。
      acceptInvitation(code, tenantId) {
        const key = String(code || '').trim().toUpperCase();
        const today = now().slice(0, 10);
        const found = (db.invitations || []).find(i => String(i.code).toUpperCase() === key);
        if (!found || found.status !== 'pending') { toast('Invite not found or no longer pending', 'error'); return false; }
        if (found.validUntil < today) { toast('Invite expired — ask for a new one', 'error'); return false; }
        const invitee = tenantId || null;
        setDb(prev => {
          // 懒过期：顺手把超期 pending 标记 expired（AC-09-06）
          const invitations = (prev.invitations || []).map(i => (i.status === 'pending' && i.validUntil < today) ? { ...i, status: 'expired' } : i);
          const edge = found.role === 'supplier'
            ? { upstream: invitee, downstream: found.inviterTenantId }
            : { upstream: found.inviterTenantId, downstream: invitee };
          const relations = (edge.upstream && edge.downstream && !prev.relations.some(r => r.upstream === edge.upstream && r.downstream === edge.downstream))
            ? [...prev.relations, { ...edge, createdAt: today }]
            : prev.relations;
          return { ...prev, invitations: invitations.map(i => i.id === found.id ? { ...i, status: 'accepted', acceptedAt: now(), acceptedByTenantId: invitee } : i), relations };
        });
        toast(`Invite ${found.code} accepted — supply relation established`, 'success');
        return true;
      },

      // 懒过期（AC-09-06）：读列表前调用，超期 pending → expired。
      expireInvitations() {
        const today = now().slice(0, 10);
        setDb(prev => ({ ...prev, invitations: (prev.invitations || []).map(i => (i.status === 'pending' && i.validUntil < today) ? { ...i, status: 'expired' } : i) }));
      },
      // 入库选供货方 — 当场新建：以往来单位（Supplier 类型商户）建档，
      // 立即返回新商户供本次选用；后续入库的供货方列表也会包含它。
      createSupplier(f) {
        const code = 'T-' + String(db.tenants.length + 1).padStart(3, '0');
        const tn = {
          id: 't-sup-' + Date.now(), code, name: String(f.name || '').trim(), type: 'Supplier',
          country: f.country || '', contact: f.contact || '', contactPhone: f.phone || '',
          maxLevel: null, status: 'Active', createdAt: now().slice(0, 10),
        };
        setDb(prev => ({ ...prev, tenants: [...prev.tenants, tn] }));
        return tn;
      },

      // MVP tenant management — dissolve a supply relation (read-only history stays intact)
      removeRelation(up, down) {
        setDb(prev => ({ ...prev, relations: prev.relations.filter(r => !(r.upstream === up && r.downstream === down)) }));
        toast('Supply relation dissolved', 'success');
      },

      // round-25 account-creation matrix:
      //   platform  → may create platform accounts (tenantId null) or accounts of any tenant (optionally master)
      //   supplier/agent → may only create sub-accounts of their own tenant (enforced by the dialogs)
      createAccount(f) {
        const isPlat = f.accountType === 'platform';
        const canSetMain = account.type === 'platform' || account.main;
        const a = {
          id: 'a-' + Date.now(), name: f.name,
          tenantId: isPlat ? null : f.tenant,
          type: isPlat ? 'platform' : 'tenant',
          phone: f.phone, whatsapp: f.whatsapp || null, password: f.password || null,
          status: 'Active', main: !isPlat && canSetMain && !!f.main,
        };
        setDb(prev => ({ ...prev, accounts: [...prev.accounts, a] }));
        toast(isPlat
          ? `Platform account ${a.name} created`
          : `Account ${a.name} created${a.main ? ' (master)' : ''}${a.whatsapp ? ' with WhatsApp binding' : ''}`, 'success');
      },

      // MVP #42 — create a sub-distributor: new agent tenant + master account (WhatsApp bound) + supply relation, in one step
      createSubAgent(f) {
        const tnow = now();
        const tid = 't-' + Date.now();
        setDb(prev => {
          const code = 'T-' + String(prev.tenants.length + 1).padStart(3, '0');
          const parent = prev.tenants.find(x => x.id === account.tenantId);
          // R03 — 新建分销商可直接带层级标签（仅展示层；maxLevel 仍是权限唯一来源，AC-03-06）
          const lvl = (f.levelLabel && String(f.levelLabel).trim()) ? String(f.levelLabel).trim().slice(0, 20) : null;
          const tenant = { id: tid, code, name: f.company, type: 'Agent', country: parent ? parent.country : 'Nigeria', maxLevel: Number(f.maxSubLevel) || 1, status: 'Active', createdAt: tnow.slice(0, 10), levelLabel: lvl, levelLabelUpdatedBy: account.id, registrationStatus: 'approved' };
          const acc = { id: 'a-' + Date.now(), name: f.contact, tenantId: tid, type: 'tenant', phone: f.phone, email: f.email || null, whatsapp: f.whatsapp || null, password: f.password || null, status: 'Active', main: true };
          return { ...prev, tenants: [...prev.tenants, tenant], accounts: [...prev.accounts, acc], relations: [...prev.relations, { upstream: account.tenantId, downstream: tid, createdAt: tnow.slice(0, 10) }] };
        });
        toast(`Sub-agent "${f.company}" created — master account ${f.contact} with WhatsApp binding`, 'success');
      },

      // MVP #43 — bind / update the WhatsApp number of an account (push channel)
      bindWhatsapp(accId, wa) {
        setDb(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === accId ? { ...a, whatsapp: wa } : a) }));
        const a = db.accounts.find(x => x.id === accId);
        toast(`WhatsApp ${wa} bound to ${a ? a.name : 'account'} — push links will be sent to this number`, 'success');
      },

      // round 43/44/48 — edit an account profile (name / phone / email / WhatsApp binding / password)
      updateAccount(accId, f) {
        setDb(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === accId ? { ...a, name: f.name, phone: f.phone, email: f.email === undefined ? a.email : f.email, whatsapp: f.whatsapp === undefined ? a.whatsapp : f.whatsapp, password: f.password === undefined ? a.password : f.password } : a) }));
        const a = db.accounts.find(x => x.id === accId);
        toast(a && a.main ? 'Master account updated' : 'Sub-account updated', 'success');
      },

      // round 54 — change own login password (Mine page)
      changePassword(accId, next) {
        setDb(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === accId ? { ...a, password: next } : a) }));
        toast('Password changed — use the new password at next sign-in', 'success');
      },

      // MVP #6 — platform-unified flat category taxonomy (shared by web + H5)
      saveCategory(name) {
        const trimmed = String(name || '').trim();
        if (!trimmed) { toast('Category name is required', 'error'); return; }
        if (db.categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) { toast('Category already exists', 'error'); return; }
        setDb(prev => ({ ...prev, categories: [...prev.categories, { id: 'cat-' + Date.now(), name: trimmed }] }));
        toast(`Category "${trimmed}" added`, 'success');
      },

      // MVP #3/#4/#5 — batch import: validated rows are actually written into the product list + stock ledger
      batchImportProducts(rows, tenantId) {
        const tnow = now();
        setDb(prev => {
          const newProducts = [];
          const newStock = { ...(prev.stock[tenantId] || {}) };
          const newMoves = [];
          rows.forEach((r, i) => {
            const pid = 'p-imp-' + Date.now() + '-' + i;
            newProducts.push({ id: pid, ownerId: tenantId, name: r.name, spec: r.spec || '', model: r.model || '', brand: r.brand || '', unit: r.unit || 'pcs', price: Number(r.price) || 0, currency: r.currency || 'USD', image: IMG.inv, categories: r.categories || [], onSale: true });
            const qty = Number(r.stock) || 0;
            newStock[pid] = qty;
            if (qty > 0) newMoves.push({ id: 'm-' + Date.now() + Math.random().toString(36).slice(2, 5), tenantId, productId: pid, type: 'IN', qty, before: 0, after: qty, refNo: 'IMP-' + tnow.slice(0, 10).replace(/-/g, ''), by: account.name, ts: tnow, reason: 'Batch import initial stock' });
          });
          return { ...prev, products: [...prev.products, ...newProducts], stock: { ...prev.stock, [tenantId]: newStock }, movements: [...prev.movements, ...newMoves] };
        });
        toast(`${rows.length} products imported from batch file`, 'success');
      },

      // MVP #34/#36 — data-outbound event log (exports, downloads, batch prints)
      logEvent(action, detail) {
        setDb(prev => ({ ...prev, events: [...prev.events, { id: 'e-' + Date.now() + Math.random().toString(36).slice(2, 5), ts: now(), by: account.name, action, detail }] }));
      },

      // MVP #26 — (re)send the waybill confirmation link to the buyer via WhatsApp
      resendWaybillLink(ck) {
        const tnow = now();
        const buyerMain = db.accounts.find(a => a.tenantId === ck.buyer && a.main);
        if (buyerMain) {
          updatePushes(prev => [...prev, { id: 'w-' + Date.now(), toAccount: buyerMain.id, docNo: ck.no, docType: 'CK', ts: tnow, text: `Waybill ${ck.waybill.no} for ${ck.no} — tap to view items & logistics and confirm receipt.`, read: false }]);
        }
        updateDocs(prev => prev.map(d => d.id === ck.id ? { ...d, timeline: [...d.timeline, { ts: tnow, text: `Waybill ${ck.waybill.no} link pushed to ${tenantName(db, ck.buyer)} via WhatsApp`, by: 'System' }] } : d));
        toast(`Waybill ${ck.waybill.no} link sent to buyer via WhatsApp`, 'success');
      },
    };
  }, [db, account, toast]);

  // ---------- cart api — shopping-cart operations for the 3 modules ----------
  // inquiry / outbound lines merge by product; inbound lines merge by
  // product for existing items, quick-profiled new items stay separate.
  // R07/R11 — cartApi 重构（先改 API 再改 UI，UI 只读）：
  //   inbound  是容器对象 { supplierId, supplierName, supplierPhone, lines }，
  //            行操作走 updateInLines（供应商字段不动）；供应商写入 setInSupplier。
  //   outbound 是车数组，行操作定位「当前车（或指定车）」；新增 newCart /
  //            switchCart / removeCart / setReceiver；submitOutbound 只提交当前车，
  //            成功后移除该车并切到下一车。
  const cartApi = useMemo(() => {
    const norm = v => (Number(v) || 0);
    const update = (module, fn) => setCarts(prev => ({ ...prev, [module]: fn(prev[module] || []) }));
    // R07 — inbound 行列表变换（保持容器层供应商字段）
    const updateInLines = fn => setCarts(prev => {
      const base = Array.isArray(prev.inbound)
        ? { supplierId: '', supplierName: '', supplierPhone: '', lines: prev.inbound }
        : (prev.inbound || { supplierId: '', supplierName: '', supplierPhone: '', lines: [] });
      return { ...prev, inbound: { ...base, lines: fn(base.lines || []) } };
    });
    // R11 — outbound 当前车（或指定车）的行列表变换
    const updateOutLines = (fn, cartId) => setCarts(prev => {
      const targetId = cartId || prev.outboundActiveId;
      return { ...prev, outbound: outCarts(prev).map(c => c.id === targetId ? { ...c, lines: fn(c.lines || []) } : c) };
    });
    function add(module, line) {
      if (module === 'inquiry') {
        update('inquiry', list => {
          const ex = list.find(l => l.pid === line.pid);
          if (ex) return list.map(l => l.pid === line.pid ? { ...l, qty: norm(l.qty) + norm(line.qty) } : l);
          return [...list, { pid: line.pid, qty: norm(line.qty) || 1 }];
        });
        return true;
      }
      if (module === 'outbound') {
        // R11/AC-11-02 — 未绑定收货方的车不可加货；无活跃车同样拦截（双端一致）
        const cur = activeCart(carts);
        if (!cur) { toast('Create a cart first', 'error'); return false; }
        if (!cur.receiver || !cur.receiver.name) { toast('Bind a receiver for this cart before adding items', 'error'); return false; }
        updateOutLines(list => {
          const ex = list.find(l => l.pid === line.pid);
          if (ex) return list.map(l => l.pid === line.pid ? { ...l, qty: norm(l.qty) + norm(line.qty) } : l);
          return [...list, { pid: line.pid, qty: norm(line.qty) || 1 }];
        });
        return true;
      }
      if (module === 'inbound') {
        // R07/AC-07-03 — 未选供应商时扫码/添加商品被拦（约束在数据结构层，双端口径一致）
        if (!inSupplier(carts).supplierId) { toast('Select a supplier first — then scan or add products', 'error'); return false; }
        updateInLines(list => {
          if (line.kind === 'exist') {
            const ex = list.find(l => l.kind === 'exist' && l.pid === line.pid);
            if (ex) return list.map(l => (l.kind === 'exist' && l.pid === line.pid) ? { ...l, qty: norm(l.qty) + norm(line.qty) } : l);
            // 物料单价默认取市场参考价（缺省回落渠道价），入库时可在暂存单内修改
            const prod = db.products.find(x => x.id === line.pid);
            const up = prod ? Number(ifnull(prod.marketPrice, prod.price)) || 0 : 0;
            return [...list, { kind: 'exist', pid: line.pid, qty: norm(line.qty) || 1, unitPrice: up }];
          }
          // R04 — 预览确认带进来的字段全部保留下来（可编辑），R05 的条码一起带
          return [...list, {
            kind: 'new', code: line.code || '', barcode: line.barcode || '', barcodeBody: line.barcodeBody || '',
            name: line.name || '', spec: line.spec || '', model: line.model || '', brand: line.brand || '',
            unit: line.unit || 'pcs', price: line.price || '', currency: line.currency || '',
            qty: norm(line.qty) || 1,
          }];
        });
        return true;
      }
      return false;
    }
    function addMany(module, pids) { (pids || []).forEach(pid => add(module, { pid, qty: 1 })); }
    function setQty(module, i, qty, cartId) {
      const fn = list => list.map((l, j) => i === j ? { ...l, qty: Math.max(1, norm(qty)) } : l);
      if (module === 'outbound') updateOutLines(fn, cartId);
      else if (module === 'inbound') updateInLines(fn);
      else update(module, fn);
    }
    function setField(module, i, key, value, cartId) {
      const fn = list => list.map((l, j) => i === j ? { ...l, [key]: value } : l);
      if (module === 'outbound') updateOutLines(fn, cartId);
      else if (module === 'inbound') updateInLines(fn);
      else update(module, fn);
    }
    function removeAt(module, i, cartId) {
      const fn = list => list.filter((_, j) => j !== i);
      if (module === 'outbound') updateOutLines(fn, cartId);
      else if (module === 'inbound') updateInLines(fn);
      else update(module, fn);
    }
    function clear(module) {
      if (module === 'outbound') updateOutLines(() => []); // R11 — 清空当前车
      else if (module === 'inbound') updateInLines(() => []);
      else update(module, () => []);
    }
    // R07 — 供应商选择写入容器层（切换保留行、仅变更归属，AC-07-05 由 UI 二次确认）
    function setInSupplier(patch) {
      setCarts(prev => {
        const base = Array.isArray(prev.inbound)
          ? { supplierId: '', supplierName: '', supplierPhone: '', lines: prev.inbound }
          : (prev.inbound || {});
        return { ...prev, inbound: { supplierId: '', supplierName: '', supplierPhone: '', lines: [], ...base, ...patch } };
      });
    }
    // R11 — 多车 API：新建（上限 10）/ 切换 / 删除（删空自动补一空车）/ 绑定收货方
    function newCart() {
      if (outCarts(carts).length >= 10) return false; // AC-11-01 建议上限 10
      let seqNext = (carts.outboundSeq || 1) + 1;
      setCarts(prev => {
        const list = outCarts(prev);
        if (list.length >= 10) return prev;
        seqNext = (prev.outboundSeq || 1) + 1;
        return { ...prev, outbound: [...list, { id: 'c-' + seqNext, receiver: null, lines: [], createdAt: now() }], outboundActiveId: 'c-' + seqNext, outboundSeq: seqNext };
      });
      return true;
    }
    function switchCart(id) { setCarts(prev => ({ ...prev, outboundActiveId: id })); }
    function removeCart(id) {
      setCarts(prev => {
        const rest = outCarts(prev).filter(c => c.id !== id);
        // 删空必须自动补一个空车，否则下次加货找不到活跃车（不回流，行数据丢弃）
        const seq = (prev.outboundSeq || 1) + 1;
        const next = rest.length ? rest : [{ id: 'c-' + seq, receiver: null, lines: [], createdAt: now() }];
        const stillActive = next.find(c => c.id === prev.outboundActiveId);
        return { ...prev, outbound: next, outboundActiveId: (stillActive || next[0]).id, outboundSeq: rest.length ? prev.outboundSeq : seq };
      });
    }
    function setReceiver(cartId, recvObj) {
      setCarts(prev => ({ ...prev, outbound: outCarts(prev).map(c => c.id === (cartId || prev.outboundActiveId) ? { ...c, receiver: recvObj } : c) }));
    }
    function submitInquiry(date) {
      const lines = (carts.inquiry || []).filter(l => l.pid && norm(l.qty) > 0);
      if (!lines.length) { toast('Inquiry staging is empty', 'error'); return { ok: false, count: 0 }; }
      if (!date) { toast('Enter a delivery date', 'error'); return { ok: false, count: 0 }; }
      // group by product owner → one inquiry per supplier (upstream-only
      // boundary still enforced inside saveInquiry)
      const groups = {};
      lines.forEach(l => {
        const p = db.products.find(x => x.id === l.pid);
        if (!p) return;
        groups[p.ownerId] = groups[p.ownerId] || [];
        groups[p.ownerId].push({ pid: l.pid, qty: norm(l.qty) });
      });
      let count = 0;
      const docs = [];
      // 同一批内连续建单时 db.docs 快照不变：把已建单据传给 saveInquiry 推进序号，
      // 避免多供货方提交时单号重复
      const seen = [];
      Object.keys(groups).forEach(seller => {
        const saved = act.saveInquiry({ seller, deliveryDate: date, items: groups[seller] }, true, seen);
        if (saved) { count++; docs.push(saved); seen.push(saved); }
      });
      if (count > 0) {
        update('inquiry', () => []);
        toast(count === 1 ? 'Inquiry staging submitted — 1 inquiry created' : `Inquiry staging submitted — ${count} inquiries created`, 'success');
      }
      // docs：按供货方生成的询价单（一张/供货方），调用方据此进入对应 WhatsApp 对话
      return { ok: count > 0, count, docs };
    }
    function submitInbound(note) {
      // R07 — 供应商从容器层读（结构层约束），不再作参数
      const sup = inSupplier(carts);
      const lines = inLines(carts);
      if (!lines.length) { toast('No items yet — scan to add', 'error'); return false; }
      if (!sup.supplierId) { toast('Select a supplier for the stock-in', 'error'); return false; }
      // 'self' = 自产（R08）：传标记，batchScanIn 内不建租户
      const r = act.batchScanIn(lines, note, sup.supplierId === 'self' ? 'self' : sup.supplierId);
      if (r && r.ok) setCarts(prev => ({ ...prev, inbound: { supplierId: '', supplierName: '', supplierPhone: '', lines: [] } }));
      return (r && r.ok) ? r : null;
    }
    function submitOutbound(note) {
      // R11 — 只提交当前车；成功后该车从列表移除并切到下一车（其余车不受影响）
      const cur = activeCart(carts);
      const lines = ((cur || {}).lines || []).map(l => {
        const p = db.products.find(x => x.id === l.pid) || null;
        const sp = (l.salePrice === undefined || l.salePrice === null || String(l.salePrice).trim() === '')
          ? (p ? p.price : 0) : Number(l.salePrice);
        return {
          pid: l.pid, qty: norm(l.qty),
          salePrice: Number(sp) || 0,
          saleCurrency: l.saleCurrency || (p ? p.currency : 'USD') || 'USD',
          discountPct: (l.discountPct === undefined || l.discountPct === null || l.discountPct === '') ? null : Number(l.discountPct),
        };
      }).filter(l => l.qty > 0);
      if (!cur || !lines.length) { toast('No items yet — scan to add', 'error'); return false; }
      const ok = act.batchScanOut({
        lines, receiver: cur.receiver,
        discountPct: (cur.discountPct === undefined || cur.discountPct === null || cur.discountPct === '') ? null : Number(cur.discountPct),
        freight: (cur.freight === undefined || cur.freight === null || cur.freight === '') ? null : Number(cur.freight),
      }, note);
      if (ok) {
        setCarts(prev => {
          const rest = outCarts(prev).filter(c => c.id !== cur.id);
          const seq = (prev.outboundSeq || 1) + 1;
          const next = rest.length ? rest : [{ id: 'c-' + seq, receiver: null, lines: [], createdAt: now() }];
          return { ...prev, outbound: next, outboundActiveId: next[0].id, outboundSeq: rest.length ? prev.outboundSeq : seq };
        });
      }
      return ok;
    }
    // R10 —— 车级字段（整体折扣 / 运费）写到当前出库车对象上
    function setCartField(cartId, key, value) {
      setCarts(prev => ({
        ...prev,
        outbound: outCarts(prev).map(c => (c.id === cartId ? { ...c, [key]: value } : c)),
      }));
    }
    return { add, addMany, setQty, setField, setCartField, removeAt, clear, setInSupplier, newCart, switchCart, removeCart, setReceiver, submitInquiry, submitInbound, submitOutbound };
  }, [carts, act, db.products, toast]);


  return (
    <AppCtx.Provider value={{ db, account, tenant, switchAccount, login, logout, authed, toast, setView, act, lang, carts, cartApi }}>
      {/* key on lang: force a full unmount/remount of the view subtree on every
          language switch, so ALL text (including strings captured in child
          useState/useMemo closures) re-renders from scratch in the new language.
          App-level state (db, account, view, toasts) lives above this key and survives. */}
      {!authed && guestDoc
        ? <GuestDocStage key={'guest-' + lang} docNo={guestDoc} onExit={() => { setGuestDoc(null); try { window.history.replaceState(null, '', window.location.pathname); } catch (e) { /* noop */ } }} />
        : !authed ? <LoginPage key={'login-' + lang} />
        : (view === 'web' ? <WebConsole key={'web-' + lang} /> : <MobileStage key={'h5-' + lang} />)}
      <div className="toast-host">
        {toasts.map(item => (
          <div key={item.id} className={`toast ${item.type}`}>
            <Icon name={item.type === 'success' ? 'success' : item.type === 'error' ? 'error' : item.type === 'warning' ? 'warn' : 'info'} size={16} />
            <span>{t(item.text)}</span>
          </div>
        ))}
      </div>
    </AppCtx.Provider>
  );
}

Object.assign(window, { App });

// ============================================================
// Error boundary — any render-time exception shows a readable
// bilingual panel with a retry button instead of a white screen
// (prototype-stage debuggability; see index.html boot guard too)
// ============================================================
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, runId: 0 };
    this.retry = this.retry.bind(this);
  }
  static getDerivedStateFromError(error) { return { error: error }; }
  componentDidCatch(error, info) {
    try { console.error('[AppErrorBoundary]', error, info); } catch (e) { /* noop */ }
  }
  retry() { this.setState({ error: null, runId: this.state.runId + 1 }); }
  render() {
    if (this.state.error) {
      const e = this.state.error;
      const detail = String((e && (e.stack || e.message)) || e);
      const cardStyle = {
        maxWidth: 560, width: '100%', background: '#fff', borderRadius: 12,
        border: '1px solid #E3E8EF', padding: '28px 30px',
        boxShadow: '0 10px 36px rgba(31,45,61,0.12)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      };
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F9', padding: 24 }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path d="M12 2L1 21h22L12 2z" fill="#FDECEC" stroke="#D93025" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M12 9v6" stroke="#D93025" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="18.2" r="1.3" fill="#D93025" />
              </svg>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1F2D3D' }}>原型渲染出错 · The prototype hit an error</div>
            </div>
            <div style={{ fontSize: 13, color: '#5A6B7E', lineHeight: 1.65, marginBottom: 16 }}>
              页面渲染时发生异常，可点击重试或刷新页面重新加载；若反复出错，请将下方错误信息反馈给开发 · Something went wrong while rendering. Retry remounts the UI; Reload restarts the page. If it keeps failing, report the details below.
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <button type="button" className="btn btn-primary" onClick={this.retry}>重试 · Retry</button>
              <button type="button" className="btn" onClick={function () { try { window.location.reload(); } catch (err) { /* noop */ } }}>刷新页面 · Reload</button>
            </div>
            <pre style={{ background: '#F6F8FA', border: '1px solid #E3E8EF', borderRadius: 8, padding: '10px 12px', fontSize: 11.5, color: '#B3261E', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 180, overflow: 'auto', margin: 0, fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>{detail}</pre>
          </div>
        </div>
      );
    }
    // key on runId: retry remounts the whole app from scratch
    return React.cloneElement(this.props.children, { key: 'run-' + this.state.runId });
  }
}

Object.assign(window, { AppErrorBoundary });
