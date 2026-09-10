const { useState, useCallback, useMemo } = React;
function App() {
  const [view, setView] = useState("web");
  const [db, setDb] = useState(() => makeInitialDb());
  const [accountId, setAccountId] = useState("a-chidi");
  const account = db.accounts.find((a) => a.id === accountId) || db.accounts[0];
  const [toasts, setToasts] = useState([]);
  const [lang, setLangState] = useState(() => getLang());
  const tenant = useMemo(() => account.tenantId ? db.tenants.find((t) => t.id === account.tenantId) : null, [db.tenants, account.tenantId]);
  window.__setLang = (l) => {
    setLang(l);
    setLangState(l);
  };
  const now = () => (/* @__PURE__ */ new Date()).toLocaleString("sv-SE").slice(0, 16).replace("T", " ");
  const toast = useCallback((text, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);
  const switchAccount = useCallback((id) => {
    const a = db.accounts.find((x) => x.id === id);
    if (!a) return;
    setAccountId(id);
    toast(`Switched to ${a.name}`, "info");
  }, [db.accounts, toast]);
  const act = useMemo(() => {
    function updateDocs(fn) {
      setDb((prev) => ({ ...prev, docs: fn(prev.docs) }));
    }
    function updateStock(fn) {
      setDb((prev) => ({ ...prev, stock: fn(prev.stock) }));
    }
    function updateMovements(fn) {
      setDb((prev) => ({ ...prev, movements: fn(prev.movements) }));
    }
    function updatePushes(fn) {
      setDb((prev) => ({ ...prev, pushes: fn(prev.pushes) }));
    }
    return {
      docVerb(verb, doc) {
        const tnow = now();
        let newPO = null;
        if (verb === "Accept") {
          newPO = { id: "d-po-" + Date.now(), no: nextNo("PO", db.docs), type: "PO", buyer: doc.buyer, seller: doc.seller, createdBy: account.name, createdAt: tnow, status: "Pending Review", currency: doc.currency, deliveryDate: "", quoteNo: doc.no, chainPath: [doc.seller, doc.buyer], items: doc.items.map((it) => ({ ...it })), timeline: [{ ts: tnow, text: "Purchase order auto-generated from accepted quote", by: "System" }] };
        }
        updateDocs((prev) => {
          const docs = prev.map((d) => {
            if (d.id !== doc.id) return d;
            switch (verb) {
              case "Submit":
                return { ...d, status: d.type === "IQ" ? "Submitted" : "Pending Review", timeline: [...d.timeline, { ts: tnow, text: d.type === "IQ" ? `Submitted to ${tenantName(db, d.seller)}` : "Submitted for supplier review", by: account.name }] };
              case "Accept":
                return { ...d, status: "Accepted", timeline: [...d.timeline, { ts: tnow, text: `Quote accepted by ${tenantName(db, d.buyer)}`, by: account.name }, { ts: tnow, text: `Purchase order ${newPO.no} auto-generated`, by: "System" }] };
              case "Reject":
                return { ...d, status: "Rejected", timeline: [...d.timeline, { ts: tnow, text: `Quote rejected by ${tenantName(db, d.buyer)}`, by: account.name }] };
              case "Approve":
                return { ...d, status: "Pending Outbound", timeline: [...d.timeline, { ts: tnow, text: "Approved by " + tenantName(db, d.seller), by: account.name }] };
              case "Cancel":
                return { ...d, status: "Cancelled", timeline: [...d.timeline, { ts: tnow, text: "Order cancelled", by: account.name }] };
              case "Close":
                return { ...d, status: "Closed", timeline: [...d.timeline, { ts: tnow, text: "Inquiry closed", by: account.name }] };
              case "Delete":
                return null;
              default:
                return d;
            }
          }).filter(Boolean);
          if (newPO) docs.push(newPO);
          return docs;
        });
        toast(`${verb} completed`, "success");
      },
      saveInquiry(f, submit) {
        const items = f.items.filter((it) => it.pid).map((it) => {
          const p = db.products.find((x) => x.id === it.pid);
          return { pid: it.pid, name: p.name, spec: p.spec, unit: p.unit, qty: Number(it.qty), price: p.price };
        });
        const currency = items[0] ? items[0].price.currency || items[0].currency || "USD" : "USD";
        const no = nextNo("IQ", db.docs);
        const newDoc = { id: "d-" + Date.now(), no, type: "IQ", buyer: account.tenantId, seller: f.seller, createdBy: account.name, createdAt: now(), status: submit ? "Submitted" : "Draft", currency, deliveryDate: f.deliveryDate, deliveryWarehouse: "Default Warehouse", items, timeline: [{ ts: now(), text: `Inquiry created ${submit ? "and submitted" : "(Draft)"}`, by: account.name }] };
        updateDocs((prev) => [...prev, newDoc]);
        toast(`Inquiry ${no} ${submit ? "submitted" : "saved as draft"}`, "success");
      },
      sendQuote(inquiry, items, validUntil, editQuote) {
        const tnow = now();
        const lines = items.map((it) => ({ pid: it.pid, name: it.name, spec: it.spec, unit: it.unit, qty: Number(it.qty) || 0, price: Number(it.price) || 0 }));
        if (editQuote) {
          updateDocs((prev) => prev.map((d) => d.id === editQuote.id ? { ...d, validUntil, items: lines, timeline: [...d.timeline, { ts: tnow, text: "Quote updated and re-sent", by: account.name }] } : d));
          toast(`Quote ${editQuote.no} updated`, "success");
        } else {
          const no = nextNo("QT", db.docs);
          const newDoc = { id: "d-" + Date.now(), no, type: "QT", seller: account.tenantId, buyer: inquiry.buyer, createdBy: account.name, createdAt: tnow, status: "Sent", currency: inquiry.currency, validUntil, inquiryNo: inquiry.no, items: lines, timeline: [{ ts: tnow, text: "Quote generated and sent", by: account.name }] };
          updateDocs((prev) => [...prev, newDoc]);
          const buyerMain = db.accounts.find((a) => a.tenantId === inquiry.buyer && a.main);
          if (buyerMain) {
            updatePushes((prev) => [...prev, { id: "w-" + Date.now(), toAccount: buyerMain.id, docNo: no, docType: "QT", ts: tnow, text: `New quote from ${tenantName(db, account.tenantId)} on inquiry ${inquiry.no}. Valid until ${validUntil}.`, read: false }]);
          }
          toast(`Quote ${no} sent \u2014 buyer notified via WhatsApp`, "success");
        }
      },
      savePO(f, submit) {
        const items = f.items.filter((it) => it.pid).map((it) => ({
          pid: it.pid,
          name: db.products.find((p) => p.id === it.pid)?.name || it.name,
          spec: db.products.find((p) => p.id === it.pid)?.spec || it.spec,
          unit: db.products.find((p) => p.id === it.pid)?.unit || "pcs",
          qty: Number(it.qty),
          price: Number(it.price)
        }));
        const currency = db.products.find((p) => p.id === items[0]?.pid)?.currency || "USD";
        const chainPath = [f.seller, account.tenantId];
        const no = nextNo("PO", db.docs);
        const newDoc = { id: "d-" + Date.now(), no, type: "PO", buyer: account.tenantId, seller: f.seller, createdBy: account.name, createdAt: now(), status: submit ? "Pending Review" : "Draft", currency, deliveryDate: f.deliveryDate, quoteNo: f.quoteNo || null, chainPath, items, timeline: [{ ts: now(), text: `Purchase order created ${submit ? "and submitted" : "(Draft)"}`, by: account.name }] };
        updateDocs((prev) => [...prev, newDoc]);
        toast(`Order ${no} ${submit ? "submitted for supplier review" : "saved as draft"}`, "success");
      },
      ship(po, logistics) {
        const tnow = now();
        const items = po.items.map((it) => ({ ...it }));
        const tenantStock = db.stock[po.seller] || {};
        const nextStock = { ...tenantStock };
        const newMoves = [];
        items.forEach((it) => {
          const before = nextStock[it.pid] || 0;
          const after = before - it.qty;
          nextStock[it.pid] = after;
          newMoves.push({ id: "m-" + Date.now() + Math.random().toString(36).slice(2, 5), tenantId: po.seller, productId: it.pid, type: "OUT", qty: -it.qty, before, after, refNo: "CK-" + Date.now(), by: account.name, ts: tnow, reason: `Shipment for ${po.no}` });
        });
        updateStock((prev) => ({ ...prev, [po.seller]: nextStock }));
        updateMovements((prev) => [...prev, ...newMoves]);
        const ckNo = nextNo("CK", db.docs);
        const ck = { id: "d-ck-" + Date.now(), no: ckNo, type: "CK", seller: po.seller, buyer: po.buyer, createdBy: account.name, createdAt: tnow, status: "Shipped", currency: po.currency, poNo: po.no, items, waybill: { no: "WB-" + tnow.slice(0, 10).replace(/-/g, "") + "-" + String(Math.floor(Math.random() * 900) + 100), ...logistics }, timeline: [{ ts: tnow, text: `Outbound order generated from ${po.no}`, by: "System" }, { ts: tnow, text: `Shipment confirmed by ${account.name}`, by: account.name }] };
        updateDocs((prev) => {
          const docs = prev.map((d) => d.id === po.id ? { ...d, status: "Completed", timeline: [...d.timeline, { ts: tnow, text: `Shipped (${ckNo})`, by: account.name }] } : d);
          docs.push(ck);
          return docs;
        });
        const buyerMain = db.accounts.find((a) => a.tenantId === po.buyer && a.main);
        if (buyerMain) {
          updatePushes((prev) => [...prev, { id: "w-" + Date.now(), toAccount: buyerMain.id, docNo: ckNo, docType: "CK", ts: tnow, text: `Your order ${po.no} has been shipped. Waybill ${ck.waybill.no}. Tap to confirm receipt.`, read: false }]);
        }
        toast(`Shipped \u2014 outbound doc ${ckNo} generated and buyer notified`, "success");
      },
      receive(ck, mode, qtys, reason) {
        const tnow = now();
        const numQtys = qtys ? Object.fromEntries(Object.entries(qtys).map(([k, v]) => [k, Number(v)])) : {};
        const items = ck.items.map((it) => ({ ...it, actualQty: numQtys[it.pid] ?? it.qty }));
        const totalShipped = items.reduce((s, it) => s + it.qty, 0);
        const totalRecv = items.reduce((s, it) => s + (it.actualQty ?? it.qty), 0);
        const status = mode === "reject" ? "Rejected" : totalRecv < totalShipped ? "Partial Variance" : "Received";
        const variance = { reason: mode === "accept" ? "" : reason || "", receivedAll: status === "Received" };
        const tenantStock = db.stock[ck.buyer] || {};
        const nextStock = { ...tenantStock };
        const newMoves = [];
        items.forEach((it) => {
          const qty = it.actualQty ?? it.qty;
          const before = nextStock[it.pid] || 0;
          const after = before + qty;
          nextStock[it.pid] = after;
          newMoves.push({ id: "m-" + Date.now() + Math.random().toString(36).slice(2, 5), tenantId: ck.buyer, productId: it.pid, type: "IN", qty, before, after, refNo: "RK-" + Date.now(), by: account.name, ts: tnow, reason: `Receiving from ${ck.no}` });
        });
        updateStock((prev) => ({ ...prev, [ck.buyer]: nextStock }));
        updateMovements((prev) => [...prev, ...newMoves]);
        const rkNo = nextNo("RK", db.docs);
        const rk = { id: "d-rk-" + Date.now(), no: rkNo, type: "RK", seller: ck.seller, buyer: ck.buyer, createdBy: account.name, createdAt: tnow, status, currency: ck.currency, ckNo: ck.no, items, variance, timeline: [{ ts: tnow, text: `Inbound record generated from ${ck.no}`, by: "System" }, { ts: tnow, text: `Receiving confirmed${status === "Partial Variance" ? " (partial)" : ""} by ${account.name}`, by: account.name }] };
        const po = db.docs.find((d) => d.type === "PO" && d.no === ck.poNo);
        const fpNo = po ? nextNo("FP", db.docs) : null;
        updateDocs((prev) => {
          const docs = prev.map((d) => d.id === ck.id ? { ...d, status: "Received", timeline: [...d.timeline, { ts: tnow, text: `Receiving confirmed by ${tenantName(db, ck.buyer)}`, by: account.name }] } : d);
          docs.push(rk);
          if (po) {
            const fp = { id: "d-fp-" + Date.now(), no: fpNo, type: "FP", seller: po.seller, buyer: po.buyer, createdBy: "System", createdAt: tnow, status: "Issued", currency: po.currency, poNo: po.no, issueDate: tnow.slice(0, 10), items: po.items.map((it) => ({ ...it })), timeline: [{ ts: tnow, text: "Sales invoice auto-issued after order completion", by: "System" }] };
            docs.push(fp);
          }
          return docs;
        });
        if (po) {
          const buyerMain = db.accounts.find((a) => a.tenantId === po.buyer && a.main);
          if (buyerMain) {
            updatePushes((prev) => [...prev, { id: "w-" + Date.now(), toAccount: buyerMain.id, docNo: fpNo, docType: "FP", ts: tnow, text: `Invoice ${fpNo} issued by ${tenantName(db, po.seller)} for ${po.no}. Download available.`, read: false }]);
          }
        }
        toast(`Receiving confirmed \u2014 inbound record ${rkNo} generated`, "success");
      },
      adjustStock(productId, type, qty, reason) {
        const tnow = now();
        const tid = account.tenantId;
        const current = (db.stock[tid] || {})[productId] || 0;
        let delta = type === "ADJ" ? qty - current : type === "IN" ? qty : -qty;
        const after = current + delta;
        updateStock((prev) => ({ ...prev, [tid]: { ...prev[tid], [productId]: after } }));
        updateMovements((prev) => [...prev, { id: "m-" + Date.now(), tenantId: tid, productId, type, qty: delta, before: current, after, refNo: "ADJ-" + Date.now(), by: account.name, ts: tnow, reason }]);
        toast(`Stock adjusted \u2014 ${type === "IN" ? "+" : type === "OUT" ? "\u2212" : ""}${Math.abs(delta)} units`, "success");
      },
      createProduct(f) {
        const p = { id: "p-" + Date.now(), name: f.name, spec: f.spec, model: f.model, brand: f.brand, unit: f.unit, price: Number(f.price), currency: f.currency, image: "", categories: f.categories };
        setDb((prev) => ({ ...prev, products: [...prev.products, p] }));
        updateStock((prev) => ({ ...prev, [account.tenantId]: { ...prev[account.tenantId], [p.id]: Number(f.stock) || 0 } }));
        toast(`Product "${f.name}" added`, "success");
      },
      updateProduct(id, f) {
        setDb((prev) => ({ ...prev, products: prev.products.map((p) => p.id === id ? { ...p, name: f.name, spec: f.spec, model: f.model, brand: f.brand, unit: f.unit, price: Number(f.price), currency: f.currency, categories: f.categories } : p) }));
        toast("Product updated", "success");
      },
      createTenant(f) {
        const t = { id: "t-" + Date.now(), code: f.code, name: f.name, type: f.type, country: f.country, maxLevel: f.maxLevel ? Number(f.maxLevel) : null, status: f.status, createdAt: now().slice(0, 10) };
        setDb((prev) => ({ ...prev, tenants: [...prev.tenants, t] }));
        toast(`Tenant ${t.name} created`, "success");
      },
      suspendTenant(id) {
        setDb((prev) => ({ ...prev, tenants: prev.tenants.map((t) => t.id === id ? { ...t, status: "Suspended" } : t), accounts: prev.accounts.map((a) => a.tenantId === id ? { ...a, status: "Suspended" } : a) }));
        toast("Tenant suspended \u2014 all related accounts are now blocked", "success");
      },
      createRelation(up, down) {
        const tnow = now().slice(0, 10);
        setDb((prev) => ({ ...prev, relations: [...prev.relations, { upstream: up, downstream: down, createdAt: tnow }] }));
        toast("Supply relation established", "success");
      },
      createAccount(f, subAgent) {
        const a = { id: "a-" + Date.now(), name: f.name, tenantId: f.tenant, type: "tenant", phone: f.phone, whatsapp: f.whatsapp || null, status: "Active", main: subAgent || false };
        setDb((prev) => ({ ...prev, accounts: [...prev.accounts, a] }));
        toast(`Account ${a.name} created${a.whatsapp ? " with WhatsApp binding" : ""}`, "success");
      }
    };
  }, [db, account, toast]);
  return /* @__PURE__ */ React.createElement(AppCtx.Provider, { value: { db, account, tenant, switchAccount, toast, setView, act, lang } }, view === "web" ? /* @__PURE__ */ React.createElement(WebConsole, null) : /* @__PURE__ */ React.createElement(MobileStage, null), /* @__PURE__ */ React.createElement("div", { className: "toast-host" }, toasts.map((t) => /* @__PURE__ */ React.createElement("div", { key: t.id, className: `toast ${t.type}` }, /* @__PURE__ */ React.createElement(Icon, { name: t.type === "success" ? "success" : t.type === "error" ? "error" : t.type === "warning" ? "warn" : "info", size: 16 }), /* @__PURE__ */ React.createElement("span", null, t.text)))));
}
Object.assign(window, { App });
