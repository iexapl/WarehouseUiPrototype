// ============================================================
// ui.jsx — shared primitives (Element-Plus-flavored)
// ============================================================

// ---------- icons (inline SVG, 24 viewBox, stroke style) ----------
const ICON_PATHS = {
  box: 'M21 8l-9-5-9 5v8l9 5 9-5V8z M3 8l9 5 9-5 M12 13v8',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z M7 7h.01',
  cart: 'M2 3h3l2.6 12.4a2 2 0 002 1.6h8.8a2 2 0 002-1.6L22 7H6 M9 21a1 1 0 100-2 1 1 0 000 2z M18 21a1 1 0 100-2 1 1 0 000 2z',
  warehouse: 'M3 21V9l9-6 9 6v12 M7 21v-8h10v8 M7 17h10',
  truck: 'M1 3h15v13H1z M16 8h4l3 3v5h-7V8z M5.5 19a2 2 0 100-4 2 2 0 000 4z M18.5 19a2 2 0 100-4 2 2 0 000 4z',
  file: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M9 13h6 M9 17h6',
  receipt: 'M6 2h12v20l-3-2-3 2-3-2-3 2V2z M9 7h6 M9 11h6 M9 15h4',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  building: 'M3 21h18 M5 21V5a2 2 0 012-2h6a2 2 0 012 2v16 M15 9h4a2 2 0 012 2v10 M9 7h2 M9 11h2 M9 15h2',
  link: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.35-4.35',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  close: 'M18 6L6 18 M6 6l12 12',
  check: 'M20 6L9 17l-5-5',
  checkDouble: 'M22 11.1V12a10 10 0 11-5.9-9.1 M22 4L12 14l-3-3 M16 4l-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  chevronLeft: 'M15 18l-6-6 6-6',
  print: 'M6 9V2h12v7 M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2 M6 14h12v8H6z',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  upload: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  whatsapp: 'M12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2z M8.5 8.5c0 4 3 7 7 7 1 0 1.5-.5 1.5-1l-2-1-1 1c-1.5-.5-2.5-1.5-3-3l1-1-1-2c-.5 0-2.5 0-2.5 0z',
  ai: 'M12 2l1.9 5.8L20 9.5l-5 3.6.9 6.4L12 16l-3.9 3.5.9-6.4-5-3.6 6.1-1.7z',
  bell: 'M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 01-3.4 0',
  home: 'M3 10.5L12 3l9 7.5 M5 9.5V21h5v-6h4v6h5V9.5',
  grid: 'M3 3h8v8H3z M13 3h8v8h-8z M3 13h8v8H3z M13 13h8v8h-8z',
  userCircle: 'M12 22a10 10 0 100-20 10 10 0 000 20z M12 12a4 4 0 100-8 4 4 0 000 8z M5.5 19a7.5 7.5 0 0113 0',
  info: 'M12 22a10 10 0 100-20 10 10 0 000 20z M12 16v-5 M12 8h.01',
  warn: 'M12 3l10 18H2z M12 10v5 M12 18h.01',
  success: 'M22 11.1V12a10 10 0 11-5.9-9.1 M22 4L12 14l-3-3',
  error: 'M12 22a10 10 0 100-20 10 10 0 000 20z M15 9l-6 6 M9 9l6 6',
  lock: 'M5 11h14v10H5z M8 11V7a4 4 0 018 0v4',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 100-6 3 3 0 000 6z',
  clock: 'M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2',
  filter: 'M22 3H2l8 9.5V19l4 2v-8.5z',
  edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z',
  trash: 'M3 6h18 M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6 M10 11v6 M14 11v6',
  arrowLeft: 'M19 12H5 M12 19l-7-7 7-7',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9',
  mobile: 'M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2z M12 18h.01',
  desktop: 'M3 4h18v12H3z M8 20h8 M12 16v4',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  refresh: 'M23 4v6h-6 M1 20v-6h6 M20.5 9A9 9 0 005.6 5.6L1 10 M3.5 15a9 9 0 0014.9 3.4L23 14',
  rotateL: 'M1 4v6h6 M20.5 9A9 9 0 005.6 5.6L1 10 M3.5 15a9 9 0 0014.9 3.4L23 14',
  rotateR: 'M23 4v6h-6 M1 20v-6h6 M3.5 9A9 9 0 0118.4 5.6L23 10 M20.5 15a9 9 0 01-14.9 3.4L1 14',
  flipH: 'M12 3v18 M7 8l-5 4 5 4 M17 8l5 4-5 4',
  flipV: 'M3 12h18 M8 7l4-5 4 5 M8 17l4 5 4-5',
  swap: 'M17 1l4 4-4 4 M3 11V9a4 4 0 014-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 01-4 4H3',
  scan: 'M3 7V5a2 2 0 012-2h2 M17 3h2a2 2 0 012 2v2 M21 17v2a2 2 0 01-2 2h-2 M7 21H5a2 2 0 01-2-2v-2 M7 12h10',
};
function Icon({ name, size = 16, color, className, style }) {
  return (
    <svg className={className || 'icon-svg'} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name] || ICON_PATHS.info} />
    </svg>
  );
}

// ---------- logo ----------
function Logo({ size = 30, dark }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <rect x="1" y="1" width="34" height="34" rx="9" fill="#2E6FE8" />
      <path d="M13 17.5l6-6 6 6" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 24.5l6-6" stroke="#8FB7F5" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="25.5" cy="23" r="1.8" fill="#FFD666" />
    </svg>
  );
}

// ---------- context ----------
const AppCtx = createContext(null);
function useApp() { return useContext(AppCtx); }

// ---------- tag ----------
function Tag({ tone, children, dot }) {
  return <span className={`tag ${tone || 'info'}${dot ? ' dot' : ''}`}>{children}</span>;
}
function StatusTag({ type, status }) {
  return <Tag tone={statusTagClass(type, status)} dot>{statusLabel(type, status)}</Tag>;
}
function TenantTag({ type }) {
  return type === 'Supplier' ? <Tag tone="purple">Supplier</Tag> : <Tag tone="primary">Agent</Tag>;
}

// ---------- money ----------
function Money({ amount, currency, className }) {
  const m = money(amount, currency);
  return <span className={`amount ${className || ''}`}><span className="cur-code">{m.code}</span>{' '}{m.num}</span>;
}

// ---------- inputs ----------
function Input({ value, onChange, placeholder, type = 'text', readonly, error, suffix, style, onFocus, inputRef }) {
  return (
    <div className="input-group" style={style}>
      <input ref={inputRef} className={`input${error ? ' error' : ''}${readonly ? ' readonly' : ''}`} type={type} value={value == null ? '' : value}
        placeholder={placeholder} onChange={e => onChange && onChange(e.target.value)} readOnly={readonly} onFocus={onFocus} />
      {suffix && <span className="input-suffix">{suffix}</span>}
    </div>
  );
}
function Textarea({ value, onChange, placeholder, rows = 3, readonly, error }) {
  return <textarea className={`textarea${error ? ' error' : ''}`} rows={rows} value={value || ''} placeholder={placeholder} onChange={e => onChange && onChange(e.target.value)} readOnly={readonly} />;
}
function Select({ value, onChange, options, placeholder, style, error, disabled }) {
  return (
    <select className={`select${error ? ' error' : ''}`} value={value == null ? '' : value} style={style}
      onChange={e => onChange && onChange(e.target.value)} disabled={disabled}>
      {placeholder != null && <option value="">{placeholder}</option>}
      {(options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function SearchBox({ value, onChange, placeholder, width }) {
  return (
    <div className="search-box" style={width ? { width } : null}>
      <Icon name="search" size={14} />
      <input className="input" value={value || ''} placeholder={placeholder || 'Search'} onChange={e => onChange && onChange(e.target.value)} />
    </div>
  );
}
function Switch({ value, onChange, activeText, inactiveText }) {
  return (
    <span className="switch">
      <span className={`switch-track${value ? ' on' : ''}`} onClick={() => onChange && onChange(!value)}>
        <span className="knob"></span>
      </span>
      {(activeText || inactiveText) && <span className="switch-label">{value ? activeText : inactiveText}</span>}
    </span>
  );
}
function RadioRow({ value, onChange, options }) {
  return (
    <div className="radio-row">
      {options.map(o => (
        <span key={o.value} className={`radio-opt${value === o.value ? ' on' : ''}`} onClick={() => onChange && onChange(o.value)}>
          <span className="radio-dot"></span>{o.label}
        </span>
      ))}
    </div>
  );
}
function Checkbox({ checked, onChange, indeterminate }) {
  return (
    <span className={`checkbox${checked || indeterminate ? ' on' : ''}`} onClick={() => onChange && onChange(!checked)}>
      {indeterminate && !checked ? <span style={{ width: 8, height: 2, background: '#fff', borderRadius: 1 }}></span> : <Icon name="check" size={10} color="#fff" />}
    </span>
  );
}

// ---------- form ----------
function FormRow({ label, required, children, error, hint, span2 }) {
  return (
    <div className={`form-row${span2 ? ' span2' : ''}`}>
      <label className="form-label">{required && <span className="req">*</span>}{t(label)}</label>
      {children}
      {error && <div className="field-error"><Icon name="error" size={12} />{t(error)}</div>}
      {!error && hint && <div className="field-hint">{t(hint)}</div>}
    </div>
  );
}

// ---------- product image (shared: list/detail fallback + form picker) ----------
function prodImg(p) { return ((p && p.images && p.images.length) ? p.images[0] : (p && p.image)) || IMG.placeholder; }

// ---------- main-image crop editor with aspect-ratio lock (round 24) ----------
const CROP_RATIOS = [
  { key: 'free', label: 'Free', r: 0 },
  { key: '1:1', label: '1:1', r: 1 },
  { key: '4:3', label: '4:3', r: 4 / 3 },
  { key: '3:4', label: '3:4', r: 3 / 4 },
  { key: '16:9', label: '16:9', r: 16 / 9 },
];
function CropModal({ src, onApply, onClose }) {
  const [ratioKey, setRatioKey] = React.useState('free');
  const [box, setBox] = React.useState(null);        // {x,y,w,h} px in display space
  const [imgSize, setImgSize] = React.useState(null); // {w,h} displayed image size
  const [drag, setDrag] = React.useState(null);       // {mode, sx, sy, orig}
  // round 26 — rotate / flip: transforms are baked into a working image (drawn
  // from the untouched original each time, so repeated rotations never degrade
  // quality), then the crop box geometry works on the baked image as-is
  const [work, setWork] = React.useState(src);
  const [rot, setRot] = React.useState(0);            // 0 | 90 | 180 | 270 (clockwise)
  const [fx, setFx] = React.useState(false);          // flip horizontal
  const [fy, setFy] = React.useState(false);          // flip vertical
  const imgRef = React.useRef(null);
  const baseRef = React.useRef(null);
  React.useEffect(() => {
    const im = new Image();
    im.src = src;
    baseRef.current = im;
  }, [src]);
  const lockR = (CROP_RATIOS.find(r => r.key === ratioKey) || {}).r || 0;
  const MIN = 32;

  // bake the full transform (from the pristine original) into a new data URL
  const bake = (nrot, nfx, nfy) => {
    const base = baseRef.current;
    if (!base || !base.naturalWidth) return null;
    const nw = base.naturalWidth, nh = base.naturalHeight;
    const swap = nrot === 90 || nrot === 270;
    const c = document.createElement('canvas');
    c.width = swap ? nh : nw; c.height = swap ? nw : nh;
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(nrot * Math.PI / 180);
    ctx.scale(nfx ? -1 : 1, nfy ? -1 : 1);
    ctx.drawImage(base, -nw / 2, -nh / 2, nw, nh);
    return c.toDataURL('image/png');
  };
  const doTransform = (nrot, nfx, nfy) => {
    const url = bake(nrot, nfx, nfy);
    if (!url) return;
    setRot(nrot); setFx(nfx); setFy(nfy);
    setWork(url);
    setBox(null); // crop box is rebuilt with fresh geometry on image load
  };
  const resetTransform = () => {
    setRot(0); setFx(false); setFy(false);
    setWork(src);
    setBox(null);
  };

  const onImgLoad = () => {
    const el = imgRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setImgSize({ w: r.width, h: r.height });
    let w = r.width * 0.82, h = r.height * 0.82;
    if (lockR) { h = w / lockR; if (h > r.height * 0.92) { h = r.height * 0.92; w = h * lockR; } }
    setBox({ x: (r.width - w) / 2, y: (r.height - h) / 2, w, h });
  };
  const pickRatio = (k) => {
    setRatioKey(k);
    const r = (CROP_RATIOS.find(x => x.key === k) || {}).r || 0;
    if (!r || !box || !imgSize) return;
    let w = box.w, h = w / r;
    if (h > imgSize.h * 0.92) { h = imgSize.h * 0.92; w = h * r; }
    if (w > imgSize.w * 0.92) { w = imgSize.w * 0.92; h = w / r; }
    setBox({
      x: Math.max(0, Math.min(imgSize.w - w, box.x + (box.w - w) / 2)),
      y: Math.max(0, Math.min(imgSize.h - h, box.y + (box.h - h) / 2)),
      w, h,
    });
  };
  const down = (e, mode) => {
    e.preventDefault(); e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    setDrag({ mode, sx: e.clientX, sy: e.clientY, orig: { x: box.x, y: box.y, w: box.w, h: box.h } });
  };
  const move = (e) => {
    if (!drag || !box || !imgSize) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    const o = drag.orig, IW = imgSize.w, IH = imgSize.h;
    if (drag.mode === 'move') {
      setBox({ x: Math.max(0, Math.min(IW - o.w, o.x + dx)), y: Math.max(0, Math.min(IH - o.h, o.y + dy)), w: o.w, h: o.h });
      return;
    }
    // corner resize — opposite corner anchored
    let w2 = o.w, h2 = o.h;
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    if (lockR) {
      if (drag.mode === 'se') { w2 = o.w + dx; }
      if (drag.mode === 'nw') { w2 = o.w - dx; }
      if (drag.mode === 'ne') { w2 = o.w + dx; }
      if (drag.mode === 'sw') { w2 = o.w - dx; }
      w2 = Math.abs(w2); // width drives, height derives
      h2 = w2 / lockR;
      const lim = drag.mode === 'se' ? Math.min(IW - o.x, (IH - o.y) * lockR)
        : drag.mode === 'nw' ? Math.min(o.x + o.w, (o.y + o.h) * lockR)
        : drag.mode === 'ne' ? Math.min(IW - o.x, (o.y + o.h) * lockR)
        : Math.min(o.x + o.w, (IH - o.y) * lockR);
      w2 = clampN(w2, MIN, Math.max(MIN, lim)); h2 = w2 / lockR;
    } else {
      // free mode: clamp each dim to the space available from the anchored corner
      if (drag.mode === 'se') { w2 = clampN(o.w + dx, MIN, IW - o.x); h2 = clampN(o.h + dy, MIN, IH - o.y); }
      if (drag.mode === 'nw') { w2 = clampN(o.w - dx, MIN, o.x + o.w); h2 = clampN(o.h - dy, MIN, o.y + o.h); }
      if (drag.mode === 'ne') { w2 = clampN(o.w + dx, MIN, IW - o.x); h2 = clampN(o.h - dy, MIN, o.y + o.h); }
      if (drag.mode === 'sw') { w2 = clampN(o.w - dx, MIN, o.x + o.w); h2 = clampN(o.h + dy, MIN, IH - o.y); }
    }
    let x2 = o.x, y2 = o.y;
    if (drag.mode === 'nw') { x2 = o.x + o.w - w2; y2 = o.y + o.h - h2; }
    if (drag.mode === 'ne') { x2 = o.x; y2 = o.y + o.h - h2; }
    if (drag.mode === 'sw') { x2 = o.x + o.w - w2; y2 = o.y; }
    // clamp into image bounds
    x2 = Math.max(0, Math.min(IW - w2, x2));
    y2 = Math.max(0, Math.min(IH - h2, y2));
    setBox({ x: x2, y: y2, w: w2, h: h2 });
  };
  const up = () => setDrag(null);
  const apply = () => {
    const el = imgRef.current; if (!el || !box || !imgSize) return;
    const nw = el.naturalWidth || imgSize.w, nh = el.naturalHeight || imgSize.h;
    const sx = box.x / imgSize.w * nw, sy = box.y / imgSize.h * nh;
    const sw = box.w / imgSize.w * nw, sh = box.h / imgSize.h * nh;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sw)); c.height = Math.max(1, Math.round(sh));
    c.getContext('2d').drawImage(el, sx, sy, sw, sh, 0, 0, c.width, c.height);
    onApply(c.toDataURL('image/png'));
  };
  return (
    <div className="crop-mask" onMouseDown={e => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div className="crop-card">
        <div className="crop-body">
          <div className="crop-title">{t('Crop Main Image')}</div>
          <div className="crop-stage">
          <div className="crop-frame">
            <img ref={imgRef} src={work} alt="" draggable={false} onLoad={onImgLoad} />
            {box && (
              <div className="crop-box" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
                onPointerDown={e => down(e, 'move')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
                <span className="crop-h nw" onPointerDown={e => down(e, 'nw')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}></span>
                <span className="crop-h ne" onPointerDown={e => down(e, 'ne')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}></span>
                <span className="crop-h sw" onPointerDown={e => down(e, 'sw')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}></span>
                <span className="crop-h se" onPointerDown={e => down(e, 'se')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}></span>
              </div>
            )}
          </div>
        </div>
        <div className="crop-ratios">
          <span className="crop-rlabel">{t('Ratio')}</span>
          {CROP_RATIOS.map(r => (
            <span key={r.key} className={`crop-chip${ratioKey === r.key ? ' on' : ''}`} onClick={() => pickRatio(r.key)}>
              {r.key === 'free' ? t('Free') : r.key}
            </span>
          ))}
        </div>
        <div className="crop-ratios" style={{ marginTop: 2 }}>
          <span className="crop-rlabel">{t('Rotate / Flip')}</span>
          <span className="crop-chip" title={t('Rotate left')} onClick={() => doTransform((rot + 270) % 360, fx, fy)}><Icon name="rotateL" size={13} /></span>
          <span className="crop-chip" title={t('Rotate right')} onClick={() => doTransform((rot + 90) % 360, fx, fy)}><Icon name="rotateR" size={13} /></span>
          <span className="crop-chip" title={t('Flip horizontal')} onClick={() => doTransform(rot, !fx, fy)}><Icon name="flipH" size={13} /></span>
          <span className="crop-chip" title={t('Flip vertical')} onClick={() => doTransform(rot, fx, !fy)}><Icon name="flipV" size={13} /></span>
          {(rot !== 0 || fx || fy) && (
            <span className="crop-chip" title={t('Reset rotation and flip')} onClick={resetTransform}>{t('Reset')}</span>
          )}
          <span className="muted" style={{ fontSize: 11 }}>{rot}°{fx ? ' · H' : ''}{fy ? ' · V' : ''}</span>
        </div>
        </div>
        <div className="crop-foot">
          <span className="muted crop-foot-hint" style={{ fontSize: 11.5 }}>{t(lockR ? 'Ratio locked — frame keeps the selected ratio' : 'Free — drag frame or corners to crop')}</span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button type="button" className="btn" onClick={onClose}>{t('Cancel')}</button>
            <button type="button" className="btn primary" onClick={apply} disabled={!box}>{t('Apply')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// uView u-upload style file-list picker: thumbnails grid + "+" tile, multiple
// local files, maxCount cap, tap to preview full image, corner badge to delete,
// pointer-based drag reorder (⣿ handle, works for both mouse and touch) and
// main-image marking (first image = main; ★ promotes a thumbnail to main).
function ProductImagePicker({ value, onChange, maxCount = 10 }) {
  const fileRef = React.useRef(null);
  const [preview, setPreview] = React.useState(-1);
  const [hint, setHint] = React.useState('');
  const [drag, setDrag] = React.useState(null); // { idx, x, y, rx, ry, src }
  const [cropOpen, setCropOpen] = React.useState(false);
  const itemRefs = React.useRef([]);
  const rootRef = React.useRef(null);
  const files = Array.isArray(value) ? value : [];
  const room = Math.max(0, maxCount - files.length);
  const move = (from, to) => {
    if (from === to || from < 0 || to < 0 || from >= files.length || to >= files.length) return;
    const next = files.slice();
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };
  const onHandleDown = (e, i) => {
    e.preventDefault(); e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    // rx/ry: root rect origin at drag start — ghost renders inside the picker
    // (absolute positioning), so pointer coords must be converted to local ones
    const r = rootRef.current ? rootRef.current.getBoundingClientRect() : { left: 0, top: 0 };
    setDrag({ idx: i, x: e.clientX, y: e.clientY, rx: r.left, ry: r.top, src: files[i] });
  };
  const onHandleMove = (e) => {
    if (!drag) return;
    const x = e.clientX, y = e.clientY;
    setDrag(d => (d ? { ...d, x, y } : d));
    let hit = -1;
    for (let j = 0; j < files.length; j++) {
      const el = itemRefs.current[j];
      if (!el || !el.getBoundingClientRect) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { hit = j; break; }
    }
    if (hit > -1 && hit !== drag.idx) { move(drag.idx, hit); setDrag(d => (d ? { ...d, idx: hit } : d)); }
  };
  const onHandleUp = () => setDrag(null);
  const onFile = (e) => {
    const list = Array.prototype.slice.call(e.target.files || []).filter(f => /^image\//.test(f.type));
    e.target.value = '';
    if (!list.length) return;
    const take = list.slice(0, room);
    if (!take.length) { setHint(`Up to ${maxCount} images`); return; }
    if (list.length > room) setHint(`Up to ${maxCount} images — added the first ${room}`);
    else setHint('');
    Promise.all(take.map(f => new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); })))
      .then(uris => onChange(files.concat(uris)));
  };
  const remove = (i) => { onChange(files.filter((_, j) => j !== i)); setPreview(-1); setHint(''); };
  const addPreset = (src) => {
    if (files.indexOf(src) > -1 || files.length >= maxCount) return;
    setHint('');
    onChange(files.concat([src]));
  };
  return (
    <div className="uupload" ref={rootRef}>
      <div className="uupload-grid">
        {files.map((src, i) => (
          <div key={i} ref={el => (itemRefs.current[i] = el)}
            className={`uupload-item${drag && drag.idx === i ? ' dragging' : ''}`}>
            <img src={src} alt="" onClick={() => setPreview(i)} draggable={false} />
            <span className="uupload-del" onClick={() => remove(i)}><Icon name="close" size={9} /></span>
            {i === 0
              ? <span className="uupload-main-badge">{t('Main Image')}</span>
              : <span className="uupload-star" title={t('Set as main image')} onClick={() => move(i, 0)}>★</span>}
            <span className="uupload-handle" title={t('Drag to reorder')}
              onPointerDown={e => onHandleDown(e, i)}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={onHandleUp}>⣿</span>
            {i === 0 && <span className="uupload-crop" title={t('Crop main image')} onClick={() => setCropOpen(true)}>✂</span>}
          </div>
        ))}
        {files.length < maxCount && (
          <div className="uupload-add" onClick={() => fileRef.current.click()}>
            <Icon name="upload" size={18} />
            <span>{t('Upload Image')}</span>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onFile} />
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{hint ? <span style={{ color: 'var(--warning)' }}>{t(hint)}</span> : t('Up to N images · drag ⣿ to reorder, ★ sets the main image, tap to preview').replace('N', maxCount)}</div>
      {drag && (
        <div className="uupload-ghost" style={{ left: drag.x - drag.rx - 32, top: drag.y - drag.ry - 32 }}>
          <img src={drag.src} alt="" draggable={false} />
        </div>
      )}
      {cropOpen && files[0] && (
        <CropModal
          src={files[0]}
          onApply={du => { onChange([du].concat(files.slice(1))); setCropOpen(false); }}
          onClose={() => setCropOpen(false)} />
      )}
      <div className="pimg-presets">
        {['inv', 'bat', 'led', 'pan', 'ctl', 'kit', 'pole', 'fan'].map(k => (
          <img key={k} className={`pimg-opt${files.indexOf(IMG[k]) > -1 ? ' on' : ''}`} src={IMG[k]} alt={k} title={t('Preset icon — click to add')} onClick={() => addPreset(IMG[k])} />
        ))}
      </div>
      {preview > -1 && (
        <div className="uupload-mask" onClick={() => setPreview(-1)}>
          <img className="uupload-full" src={files[preview]} alt="" onClick={e => e.stopPropagation()} />
          <span className="uupload-mask-close" onClick={() => setPreview(-1)}><Icon name="close" size={16} /></span>
          <div className="uupload-mask-nav">
            <span className="uupload-nav-btn" onClick={e => { e.stopPropagation(); setPreview((preview - 1 + files.length) % files.length); }}><Icon name="chevronLeft" size={16} /></span>
            <span className="mono" style={{ color: '#fff', fontSize: 12 }}>{preview + 1} / {files.length}</span>
            <span className="uupload-nav-btn" onClick={e => { e.stopPropagation(); setPreview((preview + 1) % files.length); }}><Icon name="chevronRight" size={16} /></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- dialog ----------
function Dialog({ title, width = '62%', onClose, footer, children, badge }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose && onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);
  return (
    <div className="dialog-mask" onMouseDown={e => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div className="dialog" style={{ width }}>
        <div className="dialog-header">
          <div className="dialog-title">{title}{badge}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>
  );
}
function ConfirmDialog({ title, message, confirmText = 'Confirm', danger, onConfirm, onClose, requireText }) {
  const [typed, setTyped] = useState('');
  const [step, setStep] = useState(1);
  return (
    <Dialog title={title} width="460px" onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}>Cancel</button>
        {requireText && step === 1
          ? <button className="btn danger" onClick={() => setStep(2)}>Continue</button>
          : <button className="btn danger" disabled={requireText && typed !== requireText} onClick={() => { onConfirm(); onClose(); }}>{confirmText}</button>}
      </React.Fragment>}>
      {step === 1 && <div className="banner danger"><Icon name="warn" size={15} /><div>{message}</div></div>}
      {step === 2 && (
        <React.Fragment>
          <div className="banner danger"><Icon name="warn" size={15} /><div>{message}</div></div>
          <FormRow label={`Type "${requireText}" to confirm`} required span2>
            <Input value={typed} onChange={setTyped} placeholder={requireText} />
          </FormRow>
        </React.Fragment>
      )}
    </Dialog>
  );
}

// ---------- table ----------
function Table({ columns, rows, rowKey, onRowClick, selectable, selectedKeys, onSelectedChange, loading, empty, emptyHint, emptyIcon, emptyAction }) {
  const app = useApp();
  const account = app && app.account;
  const isTenant = account && account.type === 'tenant';
  // tenant accounts: empty lists fall back to an isolation-aware message so
  // cross-tenant data isolation is never mistaken for a bug
  const fallbackEmpty = isTenant ? 'No visible data for this account' : 'No Data';
  const fallbackHint = isTenant ? 'Cross-tenant data is isolated by design — you only see records you created, plus those of your own tenant and linked supply partners.' : undefined;
  const fallbackIcon = isTenant ? 'lock' : 'file';
  const allSelected = rows.length > 0 && selectedKeys && rows.every(r => selectedKeys.includes(r[rowKey]));
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {selectable && <th style={{ width: 36 }}><Checkbox checked={allSelected} onChange={v => onSelectedChange && onSelectedChange(v ? rows.map(r => r[rowKey]) : [])} /></th>}
            {columns.map(c => <th key={c.key} style={{ width: c.width, textAlign: c.align || 'left' }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns.length + (selectable ? 1 : 0)}>
              <div className="skeleton-rows">
                {[0, 1, 2, 3].map(i => <div key={i} className="sk skeleton" style={{ width: `${88 - i * 12}%` }}></div>)}
              </div>
            </td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="empty-cell">
              <EmptyState message={empty || fallbackEmpty} hint={emptyHint || fallbackHint} icon={emptyIcon || fallbackIcon} action={emptyAction} />
            </td></tr>
          ) : rows.map(r => (
            <tr key={r[rowKey]} className={onRowClick ? 'clickable' : ''} onClick={e => onRowClick && onRowClick(r, e)}>
              {selectable && <td onClick={e => e.stopPropagation()}>
                <Checkbox checked={selectedKeys.includes(r[rowKey])}
                  onChange={v => onSelectedChange && onSelectedChange(v ? [...selectedKeys, r[rowKey]] : selectedKeys.filter(k => k !== r[rowKey]))} />
              </td>}
              {columns.map(c => <td key={c.key} style={{ textAlign: c.align || 'left' }}>{c.render ? c.render(r) : ifnull(r[c.key], '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Pagination({ total, page, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const btns = [];
  for (let i = 1; i <= pages; i++) btns.push(i);
  return (
    <div className="pagination">
      <span className="page-size">Total {total} items</span>
      <button className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</button>
      {btns.map(i => <button key={i} className={`page-btn${i === page ? ' active' : ''}`} onClick={() => onChange(i)}>{i}</button>)}
      <button className="page-btn" disabled={page >= pages} onClick={() => onChange(page + 1)}>›</button>
    </div>
  );
}

// ---------- misc ----------
function EmptyState({ message, hint, action, icon }) {
  return (
    <div className="empty-state">
      <Icon name={icon || 'file'} size={40} />
      <div className="t">{message || 'No Data'}</div>
      {hint && <div className="s">{hint}</div>}
      {action}
    </div>
  );
}
function Descriptions({ items, cols }) {
  return (
    <div className={`descriptions${cols === 3 ? ' cols3' : ''}`}>
      {items.map((it, i) => (
        <div key={i} className={`desc-item${it.full ? ' full' : ''}`}>
          <div className="desc-label">{it.label}</div>
          <div className="desc-value">{it.value == null || it.value === '' ? <span className="muted">—</span> : it.value}</div>
        </div>
      ))}
    </div>
  );
}
function Banner({ tone = 'info', icon = 'info', title, children }) {
  return <div className={`banner ${tone}`}><Icon name={icon} size={15} /><div>{title && <b>{title} </b>}{children}</div></div>;
}
function Timeline({ items }) {
  return (
    <div className="timeline">
      {items.map((e, i) => (
        <div key={i} className={`timeline-item${i === items.length - 1 ? ' done' : ''}`}>
          <div className="t-text">{t(e.text)}</div>
          <div className="t-meta">
            <span className="t-ts">{e.ts}</span>
            {e.by && <span className={`t-by${e.by === 'AI Engine' ? ' ai' : e.by === 'System' ? ' sys' : ''}`}>{t(e.by)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
function useSkeleton(deps, delay = 380) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), delay);
    return () => clearTimeout(t);
  }, deps || []);
  return loading;
}
// The panel is portaled to <body> with position:fixed so it can never be
// clipped or covered by ancestor contexts (e.g. .console overflow:hidden,
// .topbar's z-index stacking trap, or the hosting preview shell frame).
const useDropdownLayout = typeof document !== 'undefined' ? React.useLayoutEffect : React.useEffect;
function Dropdown({ trigger, children, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const panelRef = useRef(null);
  useEffect(() => {
    const h = e => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (panelRef.current && panelRef.current.contains(e.target)) return; // panel lives outside ref (portaled)
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  useDropdownLayout(() => {
    if (!open) { setPos(p => (p === null ? p : null)); return; }
    const place = () => {
      if (!ref.current || !panelRef.current) return;
      const r = ref.current.getBoundingClientRect();
      const pw = panelRef.current.offsetWidth || 240;
      const ph = panelRef.current.offsetHeight || 200;
      let left = align === 'left' ? r.left : r.right - pw;
      left = Math.max(8, Math.min(left, window.innerWidth - pw - 8)); // clamp into viewport
      let top = r.bottom + 8;
      if (window.innerHeight - top - ph < 8) top = Math.max(8, r.top - ph - 8); // flip up if no room below
      setPos(p => (p && p.top === top && p.left === left ? p : { top, left }));
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true); // capture: catch inner scroll containers
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, align]);
  return (
    <div className="dropdown" ref={ref}>
      <span onMouseDown={() => setOpen(!open)}>{trigger}</span>
      {open && ReactDOM.createPortal(
        <div
          ref={panelRef}
          className="dropdown-panel"
          style={{ top: pos ? pos.top : undefined, left: pos ? pos.left : undefined, visibility: pos ? 'visible' : 'hidden' }}
          onMouseDown={e => e.stopPropagation()}
        >
          {children}
        </div>,
        document.body
      )}
    </div>
  );
}

// ---------- downstream stock tree (sales chain of one product) ----------
// renders the root tenant ("You") plus every downstream reseller along the
// supply relations, each with its current on-hand qty of the product.
function DownstreamStockTree({ db, rootTenantId, productId }) {
  const stockOf = (tid) => (db.stock[tid] || {})[productId];
  // R100m — 库存数字统一带单位：树里每一级的手数都追加该物料的单位
  const unit = ((db.products.find(x => x.id === productId) || {}).unit) || '';
  const chain = downstreamChain(db, rootTenantId);
  const root = db.tenants.find(x => x.id === rootTenantId) || {};
  const renderNode = (n, level) => {
    const t = db.tenants.find(x => x.id === n.id) || {};
    const s = stockOf(n.id);
    return (
      <div key={n.id} style={{ marginLeft: 18, borderLeft: '1.5px dashed #D4DAE3', paddingLeft: 14, marginTop: 4 }}>
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F0F2F5' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
              {t.status === 'Suspended' && <Tag tone="dark">Suspended</Tag>}
            </div>
            <div className="muted mono" style={{ fontSize: 10.5, marginTop: 1 }}>{`${t.code || ''} · ${t.type || ''}`}</div>
          </div>
          <div className="mono bold" style={{ fontSize: 14, flexShrink: 0, marginLeft: 10 }}>{s == null ? '—' : <React.Fragment>{s} {unit}</React.Fragment>}</div>
        </div>
        {n.children.map(c => renderNode(c, level + 1))}
      </div>
    );
  };
  return (
    <div>
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--success-light)', borderRadius: 8, border: '1px solid #DCE9DE' }}>
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="cell-icon" style={{ background: 'var(--success-light)', color: 'var(--success)', width: 28, height: 28 }}><Icon name="warehouse" size={15} /></span>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              {root.name}<Tag tone="teal" dot>You</Tag>
            </div>
            <div className="muted mono" style={{ fontSize: 10.5, marginTop: 1 }}>{`${root.code || ''} · ${root.type || ''}`}</div>
          </div>
        </div>
        <div className="mono bold" style={{ fontSize: 15 }}>{stockOf(rootTenantId) == null ? '—' : <React.Fragment>{stockOf(rootTenantId)} {unit}</React.Fragment>}</div>
      </div>
      {chain.length
        ? chain.map(n => renderNode(n, 0))
        : <div className="muted" style={{ padding: '12px 18px', fontSize: 12 }}>No downstream tenants yet — stock of this product held by your sub-agents will appear here.</div>}
    </div>
  );
}

// ============================================================
// H5FilterBar — reusable mobile filter panel (round 41)
// Declarative fields instead of bespoke children. Field types:
//   { type:'chips',     key, options:[{value,label}] }   single-select chip row
//   { type:'select',    key, label?, icon?, labelWidth?, placeholder?, options }
//   { type:'daterange', fromKey, toKey }                 two date inputs with -> separator
//   { type:'search',    key, placeholder? }              keyword input + Search button (+ Enter)
//   { type:'text',      key, label?, placeholder? }      plain labeled input
// values: flat object keyed by field key (daterange uses fromKey/toKey).
// onChange(key, value); onSearch() fires on the button or Enter.
// ============================================================
function H5FilterBar({ open, onToggle, activeCount, onReset, left, tools, fields, values, onChange, onSearch }) {
  const renderField = f => {
    if (f.type === 'chips') return (
      <div key={f.key} className="h5-filter-row" style={{ marginBottom: 0 }}>
        {f.options.map(o => (
          <span key={o.value} className={`h5-chip${values[f.key] === o.value ? ' on' : ''}`}
            onClick={() => onChange(f.key, o.value)}>{o.label}</span>
        ))}
      </div>
    );
    if (f.type === 'select') return (
      <div key={f.key} className="h5-filter-field">
        {(f.label || f.icon) && (
          <span className="h5-filter-label" style={f.labelWidth ? { width: f.labelWidth } : undefined}>
            {f.icon && <Icon name={f.icon} size={12} />}{f.label}
          </span>
        )}
        <Select value={values[f.key]} onChange={v => onChange(f.key, v)} placeholder={f.placeholder}
          style={{ height: 30, flex: 1, minWidth: 140 }} options={f.options} />
      </div>
    );
    if (f.type === 'daterange') return (
      <div key={f.fromKey} className="h5-filter-field">
        <input className="input" type="date" value={values[f.fromKey] || ''} aria-label={f.fromLabel || 'From'}
          onChange={e => onChange(f.fromKey, e.target.value)} style={{ height: 30, flex: 1 }} />
        <span className="muted" style={{ fontSize: 11.5, flexShrink: 0 }}>→</span>
        <input className="input" type="date" value={values[f.toKey] || ''} aria-label={f.toLabel || 'To'}
          onChange={e => onChange(f.toKey, e.target.value)} style={{ height: 30, flex: 1 }} />
      </div>
    );
    if (f.type === 'search') return (
      <div key={f.key} className="h5-filter-field">
        {/* R100c — keyword input with a TRAILING (suffix) search slot, unified
            with the scan page: the Search button (icon + text) lives INSIDE
            the input as a suffix chip; no separate button beside the input
            and no leading magnifier icon anymore. */}
        <div className="h5-input-affix">
          <input className="input" style={{ paddingRight: 84 }} value={values[f.key] || ''} onChange={e => onChange(f.key, e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && onSearch) onSearch(); }} placeholder={f.placeholder} />
          <button type="button" className="h5-input-suffix" title="Search" aria-label="Search"
            onClick={onSearch}><Icon name="search" size={14} />Search</button>
        </div>
      </div>
    );
    // 'text' — plain labeled input
    return (
      <div key={f.key} className="h5-filter-field">
        {f.label && <span className="h5-filter-label" style={f.labelWidth ? { width: f.labelWidth } : undefined}>{f.label}</span>}
        <input className="input" value={values[f.key] || ''} onChange={e => onChange(f.key, e.target.value)}
          placeholder={f.placeholder} style={{ height: 30, flex: 1 }} />
      </div>
    );
  };
  return (
    <React.Fragment>
      <div className="h5-filter-head">
        {left}
        <div className="h5-filter-tools">
          {tools}
          {activeCount > 0 && (
            <button type="button" className="btn sm text" style={{ height: 30 }} onClick={onReset}>Reset</button>
          )}
          <button type="button" className={`h5-filter-toggle${open ? ' on' : ''}`} onClick={onToggle} aria-expanded={open}>
            <Icon name="filter" size={13} />Filters{activeCount > 0 && <span className="h5-filter-badge">{activeCount}</span>}
          </button>
        </div>
      </div>
      {open && <div className="h5-filter-panel">{fields.map(renderField)}</div>}
    </React.Fragment>
  );
}

Object.assign(window, {
  Icon, Logo, AppCtx, useApp, Tag, StatusTag, TenantTag, Money, Input, Textarea, Select, SearchBox, Switch,
  RadioRow, Checkbox, FormRow, Dialog, ConfirmDialog, Table, Pagination, EmptyState, Descriptions, Banner,
  Timeline, useSkeleton, Dropdown, DownstreamStockTree, H5FilterBar,
});
