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
    if (tenant && tenant.status === 'Suspended') { toast(`Tenant ${tenant.name} is suspended — login blocked`, 'error'); return; }
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
        // R81 — supplier accepting the order auto-issues the invoice
        if ((verb === 'Accept' || verb === 'Approve') && doc.type === 'PO' && !db.docs.some(d => d.type === 'FP' && d.poNo === doc.no)) {
          const fno = nextNo('FP', db.docs);
          newFP = { id: 'd-fp-' + Date.now(), no: fno, type: 'FP', seller: doc.seller, buyer: doc.buyer, createdBy: opName, createdAt: tnow, status: 'Issued', currency: doc.currency, poNo: doc.no, issueDate: tnow.slice(0, 10), items: doc.items.map(it => ({ ...it })), timeline: [{ ts: tnow, text: `Invoice issued for ${doc.no} — link pushed to buyer via WhatsApp`, by: opName }] };
        }
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
                return { ...d, paid: true, paidAt: tnow, status: 'Pending Outbound', payment: { amount: pf.amount !== '' && pf.amount != null ? String(pf.amount) : '', date: pf.date || tnow.slice(0, 10), method: pf.method || 'Bank Transfer', ref: pf.ref || '', note: pf.note || '' }, timeline: [...d.timeline, { ts: tnow, text: `Offline payment recorded by ${tenantName(db, d.seller)} — ${pf.method || 'Bank Transfer'}${pf.ref ? `, ref ${pf.ref}` : ''}${amountTxt}`, by: opName }] };
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
        if (verb === 'Confirm Quote') pushTo(doc.buyer, `New quote from ${tenantName(db, doc.seller)} on inquiry ${doc.inquiryNo || ''}. Valid until ${doc.validUntil || 'TBC'}.`, doc.no, 'QT');
        if (verb === 'Place Order') pushTo(doc.seller, `New order ${doc.no} from ${tenantName(db, doc.buyer)} — please review and approve.`, doc.no, 'PO');
        // R81 — supplier records the buyer's OFFLINE payment → notify buyer, unlock shipment
        // R94 — include the method/ref captured on the payment form
        if (verb === 'Record Payment') {
          const pf = form || {};
          pushTo(doc.buyer, `Offline payment for order ${doc.no} recorded by ${tenantName(db, doc.seller)}${pf.method ? ` (${pf.method}${pf.ref ? ', ref ' + pf.ref : ''})` : ''}. Shipment will be arranged.`, doc.no, 'PO');
        }
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

      saveInquiry(f, submit) {
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
        const no = nextNo('IQ', db.docs);
        const newDoc = { id: 'd-' + Date.now(), no, type: 'IQ', buyer: account.tenantId, seller: f.seller, createdBy: account.name, createdAt: now(), status: submit ? 'Submitted' : 'Draft', currency, deliveryDate: f.deliveryDate, deliveryWarehouse: 'Default Warehouse', items, timeline: [{ ts: now(), text: `Inquiry created ${submit ? 'and submitted' : '(Draft)'}`, by: account.name }] };
        updateDocs(prev => [...prev, newDoc]);
        if (submit) {
          // flow: inquiry pushed to the supplier — AI parsed the requirement and
          // matched products, a quote draft is suggested for one-tap confirmation
          const sellerMain = db.accounts.find(a => a.tenantId === f.seller && a.main);
          if (sellerMain) updatePushes(prev => [...prev, { id: 'w-' + Date.now(), toAccount: sellerMain.id, docNo: no, docType: 'IQ', ts: now(), text: `New inquiry ${no} from ${tenantName(db, account.tenantId)} — AI parsed the requirement and matched products; confirm the AI quote draft with one tap.`, read: false }]);
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
          const newDoc = { id: 'd-' + Date.now(), no, type: 'QT', seller: account.tenantId, buyer: inquiry.buyer, createdBy: account.name, createdAt: tnow, status: 'Sent', currency: inquiry.currency, validUntil, inquiryNo: inquiry.no, items: lines, timeline: [{ ts: tnow, text: 'Quote generated and sent', by: account.name }] };
          updateDocs(prev => [...prev, newDoc]);
          // Push notification to buyer main account
          const buyerMain = db.accounts.find(a => a.tenantId === inquiry.buyer && a.main);
          if (buyerMain) {
            updatePushes(prev => [...prev, { id: 'w-' + Date.now(), toAccount: buyerMain.id, docNo: no, docType: 'QT', ts: tnow, text: `New quote from ${tenantName(db, account.tenantId)} on inquiry ${inquiry.no}. Valid until ${validUntil}.`, read: false }]);
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
        const newDoc = { id: 'd-' + Date.now(), no: qno, type: 'QT', seller: inquiry.seller, buyer: inquiry.buyer, createdBy: 'AI Engine', createdAt: tnow, status: 'Draft', currency: inquiry.currency, validUntil, inquiryNo: inquiry.no, items: lines, timeline: [
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
        const newDoc = { id: 'd-' + Date.now(), no, type: 'PO', buyer: account.tenantId, seller: f.seller, createdBy: account.name, createdAt: now(), status: 'Pending Acceptance', currency, deliveryDate: f.deliveryDate, quoteNo: f.quoteNo || null, chainPath, items, timeline: [{ ts: now(), text: `Purchase order created and submitted — awaiting supplier acceptance`, by: account.name }] };
        updateDocs(prev => [...prev, newDoc]);
        toast(`Order ${no} submitted for supplier review`, 'success');
      },

      ship(po, logistics) {
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
        // create CK doc
        const ckNo = nextNo('CK', db.docs);
        const ck = { id: 'd-ck-' + Date.now(), no: ckNo, type: 'CK', seller: po.seller, buyer: po.buyer, createdBy: account.name, createdAt: tnow, status: 'Pending Shipment', currency: po.currency, poNo: po.no, items, waybill: { no: 'WY-' + tnow.slice(0, 10).replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 900) + 100), ...logistics }, timeline: [{ ts: tnow, text: `Outbound order generated from ${po.no}`, by: 'System' }, { ts: tnow, text: `Shipment confirmed by ${account.name} — awaiting dispatch`, by: account.name }] };
        // R82 — 确认发货 generates the CK + waybill; the order moves to 待出货
        // until the seller dispatches the outbound order (→ 待收货)
        updateDocs(prev => {
          const docs = prev.map(d => d.id === po.id ? { ...d, status: 'Pending Shipment', timeline: [...d.timeline, { ts: tnow, text: `Outbound order ${ckNo} generated — awaiting dispatch`, by: account.name }] } : d);
          docs.push(ck);
          return docs;
        });
        // notify buyer that the outbound order + waybill were generated
        const buyerMain = db.accounts.find(a => a.tenantId === po.buyer && a.main);
        if (buyerMain) {
          updatePushes(prev => [...prev, { id: 'w-' + Date.now(), toAccount: buyerMain.id, docNo: ckNo, docType: 'CK', ts: tnow, text: `Outbound order ${ckNo} generated for your order ${po.no}. Waybill ${ck.waybill.no}.`, read: false }]);
        }
        toast(`Shipment confirmed — outbound doc ${ckNo} and waybill ${ck.waybill.no} generated`, 'success');
      },

      // R82 — seller dispatches the generated outbound order: CK → Shipped,
      // the linked order moves to 待收货, waybill link pushed to the buyer
      dispatch(ck) {
        const tnow = now();
        const po = db.docs.find(d => d.type === 'PO' && d.no === ck.poNo);
        updateDocs(prev => prev.map(d => {
          if (d.id === ck.id) return { ...d, status: 'Shipped', timeline: [...d.timeline, { ts: tnow, text: `Dispatched by ${account.name} — waybill link pushed to buyer`, by: account.name }] };
          if (po && d.id === po.id) return { ...d, status: 'Pending Receipt', timeline: [...d.timeline, { ts: tnow, text: `Dispatched (${ck.no}) — in transit, awaiting buyer receipt`, by: account.name }] };
          return d;
        }));
        const buyerMain = db.accounts.find(a => a.tenantId === ck.buyer && a.main);
        if (buyerMain) {
          updatePushes(prev => [...prev, { id: 'w-' + Date.now(), toAccount: buyerMain.id, docNo: ck.no, docType: 'CK', ts: tnow, text: `Your order ${ck.poNo} has been dispatched. Waybill ${ck.waybill.no}. Tap to confirm receipt.`, read: false }]);
        }
        toast(`Dispatched — waybill ${ck.waybill.no} link pushed to the buyer`, 'success');
      },

      receive(ck, mode, qtys, reason, byAccount) {
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
        const rk = { id: 'd-rk-' + Date.now(), no: rkNo, type: 'RK', seller: ck.seller, buyer: ck.buyer, createdBy: opName, createdAt: tnow, status, currency: ck.currency, ckNo: ck.no, items, variance, timeline: [{ ts: tnow, text: `Inbound record generated from ${ck.no}`, by: 'System' }, { ts: tnow, text: `Receiving confirmed${status === 'Partial Variance' ? ' (partial)' : ''} by ${opName}`, by: opName }] };
        // update CK status, complete PO — the system then URGES the supplier to
        // issue the invoice (flow: receiving → auto invoice reminder → the
        // supplier issues it via Create Invoice and pushes the link)
        const po = db.docs.find(d => d.type === 'PO' && d.no === ck.poNo);
        // R82 — terminal order statuses: 已收货 / 部分收货 / 已拒收
        const poStatus = mode === 'reject' ? 'Receipt Rejected' : (totalRecv < totalShipped ? 'Partially Received' : 'Received');
        updateDocs(prev => {
          // R82 — CK terminal status: full → Received / partial → Partial Variance / reject → Rejected
          const ckStatus = mode === 'reject' ? 'Rejected' : (totalRecv < totalShipped ? 'Partial Variance' : 'Received');
          let docs = prev.map(d => d.id === ck.id ? { ...d, status: ckStatus, timeline: [...d.timeline, { ts: tnow, text: `Receiving confirmed by ${tenantName(db, ck.buyer)}`, by: opName }] } : d);
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

      // R100h — 扫码批量出库：一次确认多条 OUT 库存流水（仅限本租户物料，逐行校验库存充足；共享一个 OUT- 编号便于追溯）
      batchScanOut(lines, note) {
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
        const total = lines.reduce((s, l) => s + l.qty, 0);
        const refNo = 'OUT-' + tnow.slice(0, 10).replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 900) + 100);
        const nextStock = { ...stockMap };
        const newMoves = lines.map(ln => {
          const before = nextStock[ln.pid] || 0;
          const after = before - ln.qty;
          nextStock[ln.pid] = after;
          return { id: 'm-' + Date.now() + Math.random().toString(36).slice(2, 5), tenantId: tid, productId: ln.pid, type: 'OUT', qty: -ln.qty, before, after, refNo, by: account.name, ts: tnow, reason: (note || '').trim() ? note.trim() + ' (scan)' : 'Batch scan outbound (scan)' };
        });
        updateStock(prev => ({ ...prev, [tid]: nextStock }));
        updateMovements(prev => [...prev, ...newMoves]);
        toast(`Batch outbound complete — ${lines.length} items, ${total} units out (${refNo})`, 'success');
        return true;
      },

      // R100q — 扫码批量入库：一次确认多条 IN 库存流水。入库物料可能已在本租户仓库
      // （kind:'exist' → 直接累加库存），也可能是新物料（kind:'new' → 快速建档后入库）；
      // 全部流水共享一个 IN- 编号便于追溯。
      // 入库确认时必须选择供货方（supplierId）：流水带 supplier 字段并在事由中
      // 记录供货方名称；供货方可当场新建（createSupplier）后立即选用。
      batchScanIn(lines, note, supplierId) {
        const tnow = now();
        const tid = account.tenantId;
        const stockMap = db.stock[tid] || {};
        const sup = supplierId ? db.tenants.find(x => x.id === supplierId) : null;
        // validation pass — nothing is written unless every line checks out
        for (const ln of lines) {
          if (!(Number(ln.qty) > 0)) { toast('Enter an inbound quantity > 0 for every line', 'error'); return false; }
          if (ln.kind === 'exist') {
            const prod = db.products.find(p => p.id === ln.pid);
            if (!prod || prod.ownerId !== tid) { toast('Stock-in applies to your own products only', 'error'); return false; }
          } else if (!String(ln.name || '').trim()) { toast('Enter a name for every new item', 'error'); return false; }
        }
        if (!sup) { toast('Select a supplier for the stock-in', 'error'); return false; }
        const total = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
        const refNo = 'IN-' + tnow.slice(0, 10).replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 900) + 100);
        const nextStock = { ...stockMap };
        const newProducts = [];
        const newMoves = lines.map(ln => {
          let pid = ln.pid;
          if (ln.kind === 'new') {
            // quick profile: model = scanned code; details (spec/brand/price…) editable later
            pid = 'p-' + Date.now() + Math.random().toString(36).slice(2, 5);
            newProducts.push({ id: pid, ownerId: tid, name: String(ln.name).trim(), spec: '', model: String(ln.code || '').trim(), brand: '', unit: ln.unit || 'pcs', price: Number(ln.price) || 0, currency: 'USD', image: '', images: [], categories: [], onSale: true });
          }
          const before = nextStock[pid] || 0;
          const after = before + (Number(ln.qty) || 0);
          nextStock[pid] = after;
          const reasonParts = [];
          if ((note || '').trim()) reasonParts.push(note.trim());
          if (sup) reasonParts.push(`Supplier: ${sup.name}`);
          reasonParts.push('Batch scan stock-in (scan)');
          return { id: 'm-' + Date.now() + Math.random().toString(36).slice(2, 5), tenantId: tid, productId: pid, type: 'IN', qty: Number(ln.qty) || 0, before, after, refNo, by: account.name, ts: tnow, supplierId: sup ? sup.id : null, reason: reasonParts.join(' · ') };
        });
        setDb(prev => ({
          ...prev,
          products: [...prev.products, ...newProducts],
          stock: { ...prev.stock, [tid]: nextStock },
          movements: [...prev.movements, ...newMoves],
        }));
        toast(`Batch stock-in complete — ${lines.length} items, ${total} units in (${refNo})`, 'success');
        return true;
      },

      createProduct(f) {
        const imgs = Array.isArray(f.images) ? f.images : [];
        const p = { id: 'p-' + Date.now(), ownerId: account.tenantId, name: f.name, spec: f.spec, model: f.model, brand: f.brand, unit: f.unit, price: Number(f.price), currency: f.currency, image: imgs[0] || '', images: imgs, categories: f.categories, onSale: f.onSale !== false };
        setDb(prev => ({ ...prev, products: [...prev.products, p] }));
        updateStock(prev => ({ ...prev, [account.tenantId]: { ...prev[account.tenantId], [p.id]: Number(f.stock) || 0 } }));
        toast(`Product "${f.name}" added`, 'success');
      },

      // R99r — 新商品入库：一次性创建商品 + 记一条 IN 库存流水（入库的商品可能是新增的）
      stockInNew(f, qty, reason) {
        const tnow = now();
        const imgs = Array.isArray(f.images) ? f.images : [];
        const n = Math.max(0, Number(qty) || 0);
        const p = { id: 'p-' + Date.now(), ownerId: account.tenantId, name: f.name, spec: f.spec, model: f.model, brand: f.brand, unit: f.unit, price: Number(f.price), currency: f.currency, image: imgs[0] || '', images: imgs, categories: f.categories, onSale: f.onSale !== false };
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
        setDb(prev => ({ ...prev, products: prev.products.map(p => {
          if (p.id !== id) return p;
          const nextImages = imgs !== undefined ? imgs : (p.images || (p.image ? [p.image] : []));
          return { ...p, name: f.name, spec: f.spec, model: f.model, brand: f.brand, unit: f.unit, price: Number(f.price), currency: f.currency, images: nextImages, image: nextImages[0] || '', categories: f.categories, onSale: f.onSale !== false };
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

      createTenant(f) {
        setDb(prev => {
          // code left blank (H5 form) auto-generates the next T-00x code
          const code = (f.code && String(f.code).trim()) || 'T-' + String(prev.tenants.length + 1).padStart(3, '0');
          const t = { id: 't-' + Date.now(), code, name: f.name, type: f.type, country: f.country, maxLevel: f.maxLevel ? Number(f.maxLevel) : null, status: f.status, createdAt: now().slice(0, 10) };
          // one-stop provisioning: tenant + master account (+ WhatsApp binding) in a single step
          const master = f.master && f.master.name
            ? { id: 'a-' + Date.now(), name: f.master.name, tenantId: t.id, type: 'tenant', phone: f.master.phone, password: f.master.password || null, whatsapp: f.master.whatsapp || null, status: 'Active', main: true }
            : null;
          return { ...prev, tenants: [...prev.tenants, t], accounts: master ? [...prev.accounts, master] : prev.accounts };
        });
        if (f.master && f.master.name) toast(`Tenant ${f.name} created — master account ${f.master.name} ready${f.master.whatsapp ? ' (WhatsApp bound)' : ''}`, 'success');
        else toast(`Tenant ${f.name} created`, 'success');
      },

      suspendTenant(id) {
        setDb(prev => ({ ...prev, tenants: prev.tenants.map(t => t.id === id ? { ...t, status: 'Suspended' } : t), accounts: prev.accounts.map(a => a.tenantId === id ? { ...a, status: 'Suspended' } : a) }));
        toast('Tenant suspended — all related accounts are now blocked', 'success');
      },

      createRelation(up, down) {
        const tnow = now().slice(0, 10);
        setDb(prev => ({ ...prev, relations: [...prev.relations, { upstream: up, downstream: down, createdAt: tnow }] }));
        toast('Supply relation established', 'success');
      },
      // 入库选供货方 — 当场新建：以往来单位（Supplier 类型租户）建档，
      // 立即返回新租户供本次选用；后续入库的供货方列表也会包含它。
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
          const tenant = { id: tid, code, name: f.company, type: 'Agent', country: parent ? parent.country : 'Nigeria', maxLevel: Number(f.maxSubLevel) || 1, status: 'Active', createdAt: tnow.slice(0, 10) };
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
  const cartApi = useMemo(() => {
    const update = (module, fn) => setCarts(prev => ({ ...prev, [module]: fn(prev[module] || []) }));
    const norm = v => (Number(v) || 0);
    function add(module, line) {
      if (module === 'inquiry' || module === 'outbound') {
        update(module, list => {
          const ex = list.find(l => l.pid === line.pid);
          if (ex) return list.map(l => l.pid === line.pid ? { ...l, qty: norm(l.qty) + norm(line.qty) } : l);
          return [...list, { pid: line.pid, qty: norm(line.qty) || 1 }];
        });
      } else if (module === 'inbound') {
        update('inbound', list => {
          if (line.kind === 'exist') {
            const ex = list.find(l => l.kind === 'exist' && l.pid === line.pid);
            if (ex) return list.map(l => (l.kind === 'exist' && l.pid === line.pid) ? { ...l, qty: norm(l.qty) + norm(line.qty) } : l);
            return [...list, { kind: 'exist', pid: line.pid, qty: norm(line.qty) || 1 }];
          }
          return [...list, { kind: 'new', code: line.code || '', name: line.name || '', unit: line.unit || 'pcs', price: line.price || '', qty: norm(line.qty) || 1 }];
        });
      }
    }
    function addMany(module, pids) { (pids || []).forEach(pid => add(module, { pid, qty: 1 })); }
    function setQty(module, i, qty) {
      update(module, list => list.map((l, j) => i === j ? { ...l, qty: Math.max(1, norm(qty)) } : l));
    }
    function setField(module, i, key, value) {
      update(module, list => list.map((l, j) => i === j ? { ...l, [key]: value } : l));
    }
    function removeAt(module, i) { update(module, list => list.filter((_, j) => j !== i)); }
    function clear(module) { update(module, () => []); }
    function submitInquiry(date) {
      const lines = (carts.inquiry || []).filter(l => l.pid && norm(l.qty) > 0);
      if (!lines.length) { toast('Inquiry cart is empty', 'error'); return { ok: false, count: 0 }; }
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
      Object.keys(groups).forEach(seller => {
        const saved = act.saveInquiry({ seller, deliveryDate: date, items: groups[seller] }, true);
        if (saved) count++;
      });
      if (count > 0) {
        update('inquiry', () => []);
        toast(count === 1 ? 'Inquiry cart submitted — 1 inquiry created' : `Inquiry cart submitted — ${count} inquiries created`, 'success');
      }
      return { ok: count > 0, count };
    }
    function submitInbound(supplierId, note) {
      const lines = carts.inbound || [];
      if (!lines.length) { toast('No items yet — scan to add', 'error'); return false; }
      const ok = act.batchScanIn(lines, note, supplierId);
      if (ok) update('inbound', () => []);
      return ok;
    }
    function submitOutbound(note) {
      const lines = (carts.outbound || []).map(l => ({ pid: l.pid, qty: norm(l.qty) })).filter(l => l.qty > 0);
      if (!lines.length) { toast('No items yet — scan to add', 'error'); return false; }
      const ok = act.batchScanOut(lines, note);
      if (ok) update('outbound', () => []);
      return ok;
    }
    return { add, addMany, setQty, setField, removeAt, clear, submitInquiry, submitInbound, submitOutbound };
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
