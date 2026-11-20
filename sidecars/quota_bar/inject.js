(() => {
  const VER = 8;
  const SIDEBAR_HOST_ID = 'agy-quota-sidebar-host';
  const MODAL_HOST_ID = 'agy-quota-modal-host';
  if (window.__AGY_QUOTA_BAR && window.__AGY_QUOTA_BAR.ver === VER) return;

  try {
    if (window.__AGY_QUOTA_BAR && typeof window.__AGY_QUOTA_BAR.unmount === 'function') {
      window.__AGY_QUOTA_BAR.unmount();
    }
  } catch {}

  const SIDEBAR_CSS = `
    :host { all: initial; display: block; width: 100%; margin-bottom: 4px; }
    * { box-sizing: border-box; }
    .card {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 7px 10px;
      border-radius: var(--q-card-radius, 8px);
      background: var(--q-idle-bg, transparent);
      border: none;
      box-shadow: none;
      color: var(--q-text, #EAEBF1);
      font-family: "Google Sans Flex", "Google Sans", system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
      cursor: pointer;
      user-select: none;
      transition: background-color 150ms ease, box-shadow 150ms ease, transform 120ms ease;
    }
    .card:hover {
      background: var(--q-hover-bg, rgba(255, 255, 255, 0.045));
    }
    .card:active {
      transform: scale(0.988);
    }
    .card.open {
      background: var(--q-selected-bg, #1F1F24);
      box-shadow: var(--q-selected-shadow, inset 0 1px 0 rgba(255, 255, 255, 0.067), inset 0 0 0 1px rgba(255, 255, 255, 0.06));
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      min-width: 0;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
      font-size: 12.5px;
      font-weight: 500;
      color: var(--q-text, #EAEBF1);
    }
    .brand svg {
      width: 14px;
      height: 14px;
      flex: 0 0 14px;
      color: var(--q-icon, #8E909A);
      transition: color 150ms ease;
    }
    .card:hover .brand svg, .card.open .brand svg {
      color: var(--q-accent, #2F71E3);
    }
    .brand span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pct-pill {
      font-size: 11px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: var(--q-muted, #8E909A);
      background: transparent;
      padding: 1px 4px;
      border-radius: 5px;
      flex: 0 0 auto;
      transition: background-color 150ms ease, color 150ms ease;
    }
    .card.open .pct-pill, .card:hover .pct-pill {
      color: var(--q-accent-text, #70A4FF);
      background: var(--q-accent-bg, rgba(47, 113, 227, 0.14));
      padding: 1px 6px;
    }
    .pct-pill.warn {
      color: #EAB308;
      background: rgba(234, 179, 8, 0.14);
      padding: 1px 6px;
    }
    .track {
      width: 100%;
      height: 3px;
      border-radius: 9999px;
      background: var(--q-track, rgba(255, 255, 255, 0.08));
      overflow: hidden;
    }
    .fill {
      height: 100%;
      width: 0%;
      border-radius: 9999px;
      background: var(--q-accent, #2F71E3);
      opacity: 0.85;
      transition: width 260ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms ease, opacity 150ms ease;
    }
    .card.open .fill, .card:hover .fill {
      opacity: 1;
    }
    .fill.warn {
      background: #EAB308;
    }
    .sub {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: 10.5px;
      color: var(--q-muted, #8E909A);
      font-variant-numeric: tabular-nums;
    }
    .sub-left {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sub-hint {
      flex: 0 0 auto;
      opacity: 0.78;
    }
  `;

  const MODAL_CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .backdrop {
      position: fixed;
      inset: 0;
      display: none;
      pointer-events: auto;
      z-index: 47;
      background: transparent;
    }
    .backdrop.open {
      display: block;
    }
    .pop {
      position: fixed;
      width: min(528px, calc(100vw - 280px));
      min-width: 390px;
      z-index: 48;
      pointer-events: none;
      opacity: 0;
      transform: translate3d(-8px, 12px, 0) scale(0.92);
      transform-origin: bottom left;
      transition:
        opacity 150ms ease,
        transform 180ms cubic-bezier(0.4, 0, 1, 1);
      font-family: "Google Sans Flex", "Google Sans", system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
      color: var(--m-text, #EAEBF1);
      user-select: none;
      display: none;
    }
    .pop.mounted {
      display: block;
    }
    .pop.open {
      pointer-events: auto;
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
      animation: agy-quota-pop-in 260ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes agy-quota-pop-in {
      0%   { opacity: 0; transform: translate3d(-10px, 14px, 0) scale(0.90); }
      65%  { opacity: 1; transform: translate3d(0, -2px, 0) scale(1.012); }
      100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
    }
    .panel {
      background: var(--m-bg, #121216);
      border: none;
      border-radius: 12px;
      box-shadow:
        inset 0 1px 0 var(--m-highlight, rgba(255, 255, 255, 0.06)),
        0 0 0 1px var(--m-border, rgba(255, 255, 255, 0.085)),
        var(--m-shadow, 0 24px 56px -12px rgba(0, 0, 0, 0.72), 0 4px 16px -2px rgba(0, 0, 0, 0.48));
      padding: 14px 16px;
      position: relative;
      overflow: visible;
    }
    .hdr {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .seg {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .pill-btn {
      background: transparent;
      border: none;
      color: var(--m-muted, #8E909A);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: background-color 140ms ease, color 140ms ease, box-shadow 140ms ease;
    }
    .pill-btn:hover {
      color: var(--m-text, #EAEBF1);
      background: var(--m-hover, rgba(255, 255, 255, 0.045));
    }
    .pill-btn.active {
      color: var(--m-text, #EAEBF1);
      background: var(--m-pill-active, #1F1F24);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    }
    .icon-btn {
      background: transparent;
      border: none;
      color: var(--m-muted, #8E909A);
      width: 24px;
      height: 24px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      margin-left: 2px;
      transition: background-color 140ms ease, color 140ms ease;
    }
    .icon-btn:hover, .icon-btn.active {
      color: var(--m-text, #EAEBF1);
      background: var(--m-pill-active, #1F1F24);
    }
    .icon-btn.spin svg {
      animation: agy-quota-spin 900ms linear infinite;
    }
    @keyframes agy-quota-spin {
      to { transform: rotate(360deg); }
    }
    .q-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 10px;
    }
    .q-card {
      padding: 9px 11px;
      border-radius: var(--m-radius, 8px);
      background: var(--m-well, rgba(255, 255, 255, 0.03));
      border: 1px solid var(--m-inner-border, rgba(255, 255, 255, 0.06));
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: background-color 140ms ease, border-color 140ms ease;
    }
    .q-card:hover {
      background: var(--m-well-hover, rgba(255, 255, 255, 0.048));
      border-color: var(--m-border, rgba(255, 255, 255, 0.095));
    }
    .q-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: 11.5px;
    }
    .q-title {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 600;
      color: var(--m-text, #EAEBF1);
      white-space: nowrap;
    }
    .q-tag {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 4px;
      background: var(--m-accent-bg, rgba(47, 113, 227, 0.14));
      color: var(--m-accent-text, #70A4FF);
      font-weight: 600;
    }
    .q-pct {
      font-size: 12px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--m-text, #EAEBF1);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .q-pct.warn {
      color: #EAB308;
    }
    .q-track {
      width: 100%;
      height: 4px;
      border-radius: 9999px;
      background: var(--m-track, rgba(255, 255, 255, 0.08));
      overflow: hidden;
    }
    .q-fill {
      height: 100%;
      border-radius: 9999px;
      background: var(--m-accent, #2F71E3);
      transition: width 260ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms ease;
    }
    .q-fill.warn {
      background: #EAB308;
    }
    .q-sub {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: 10.5px;
      color: var(--m-muted, #8E909A);
      font-variant-numeric: tabular-nums;
    }
    .cfg-box {
      margin-top: 8px;
      padding: 10px 11px;
      border-radius: var(--m-radius, 8px);
      background: var(--m-well, rgba(255, 255, 255, 0.03));
      border: 1px solid var(--m-inner-border, rgba(255, 255, 255, 0.075));
      display: none;
      flex-direction: column;
      gap: 7px;
      font-size: 11.5px;
    }
    .cfg-box.open {
      display: flex;
    }
    .cfg-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .cfg-ctrl {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .cfg-select, .cfg-input {
      background: var(--m-bg, #121216);
      color: var(--m-text, #EAEBF1);
      border: 1px solid var(--m-border, rgba(255, 255, 255, 0.12));
      border-radius: 6px;
      padding: 3px 7px;
      font-size: 11px;
      font-family: inherit;
      outline: none;
    }
    .cfg-input { width: 68px; }
    .cfg-btn {
      background: var(--m-accent, #2F71E3);
      color: #FFFFFF;
      border: none;
      border-radius: 6px;
      padding: 3px 9px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }
    .cfg-btn.ghost {
      background: transparent;
      color: var(--m-muted, #8E909A);
      border: 1px solid var(--m-border, rgba(255, 255, 255, 0.12));
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin-top: 8px;
    }
    .kpi {
      background: var(--m-well, rgba(255, 255, 255, 0.03));
      border: 1px solid var(--m-inner-border, rgba(255, 255, 255, 0.06));
      border-radius: var(--m-radius, 8px);
      padding: 8px 11px;
      transition: background-color 140ms ease, border-color 140ms ease;
    }
    .kpi:hover {
      background: var(--m-well-hover, rgba(255, 255, 255, 0.048));
      border-color: var(--m-border, rgba(255, 255, 255, 0.095));
    }
    .kpi-lbl {
      font-size: 11px;
      color: var(--m-muted, #8E909A);
    }
    .kpi-val {
      font-size: 17px;
      font-weight: 700;
      margin-top: 2px;
      color: var(--m-text, #EAEBF1);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .kpi-val.small {
      font-size: 12px;
      line-height: 23px;
      letter-spacing: -0.01em;
    }
    .heatmap-wrap {
      margin-top: 10px;
      padding: 8px 10px;
      border-radius: var(--m-radius, 8px);
      background: var(--m-well, rgba(255, 255, 255, 0.025));
      border: 1px solid var(--m-inner-border, rgba(255, 255, 255, 0.055));
    }
    .heatmap {
      display: grid;
      grid-template-rows: repeat(7, 1fr);
      grid-auto-flow: column;
      gap: 3.5px;
    }
    .cell {
      aspect-ratio: 1;
      width: 100%;
      border-radius: 3px;
      background: var(--m-cell-0, rgba(255, 255, 255, 0.05));
      transition: transform 90ms ease, outline-color 90ms ease;
      cursor: default;
    }
    .cell:hover:not(.future) {
      transform: scale(1.16);
      outline: 1.5px solid var(--m-cell-hover, rgba(255, 255, 255, 0.55));
      position: relative;
      z-index: 2;
    }
    .cell.future {
      opacity: 0.25;
    }
    .cell.l1 { background: var(--m-cell-1, rgba(47, 113, 227, 0.28)); }
    .cell.l2 { background: var(--m-cell-2, rgba(47, 113, 227, 0.50)); }
    .cell.l3 { background: var(--m-cell-3, rgba(47, 113, 227, 0.74)); }
    .cell.l4 { background: var(--m-cell-4, #2F71E3); }
    .foot {
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      color: var(--m-muted, #8E909A);
    }
    .mode-chip {
      font-size: 10.5px;
      color: var(--m-muted, #8E909A);
      background: var(--m-well, rgba(255, 255, 255, 0.03));
      border: 1px solid var(--m-inner-border, rgba(255, 255, 255, 0.07));
      border-radius: 6px;
      padding: 2px 7px;
      cursor: pointer;
      flex: 0 0 auto;
    }
    .mode-chip:hover {
      color: var(--m-text, #EAEBF1);
      background: var(--m-well-hover, rgba(255, 255, 255, 0.06));
    }
    .models-list {
      margin-top: 8px;
      max-height: 270px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-right: 2px;
    }
    .models-list::-webkit-scrollbar { width: 4px; }
    .models-list::-webkit-scrollbar-thumb { background: var(--m-border); border-radius: 99px; }
    .m-item {
      background: var(--m-well, rgba(255, 255, 255, 0.03));
      border: 1px solid var(--m-inner-border, rgba(255, 255, 255, 0.06));
      border-radius: var(--m-radius, 8px);
      padding: 8px 10px;
    }
    .m-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
    }
    .m-name { font-weight: 600; color: var(--m-text, #EAEBF1); }
    .m-meta { font-size: 11px; color: var(--m-muted, #8E909A); font-variant-numeric: tabular-nums; }
    .m-bar {
      height: 4px;
      border-radius: 9999px;
      background: var(--m-track, rgba(255, 255, 255, 0.07));
      overflow: hidden;
      margin-top: 6px;
    }
    .m-fill {
      height: 100%;
      border-radius: 9999px;
      background: var(--m-accent, #2F71E3);
      transition: width 260ms ease;
    }
    .tip {
      position: fixed;
      display: none;
      pointer-events: none;
      z-index: 60;
      background: var(--m-tip-bg, #18181E);
      color: var(--m-text, #EAEBF1);
      border: 1px solid var(--m-border, rgba(255, 255, 255, 0.12));
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.52);
    }
  `;

  function fmtNum(n) {
    const v = Number(n || 0);
    if (v >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(v));
  }

  function parseColorRgb(colorStr) {
    if (!colorStr) return null;
    const s = colorStr.trim();
    const hex = /^#([0-9a-f]{6})$/i.exec(s);
    if (hex) {
      const n = parseInt(hex[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
    if (rgb) return [Math.round(+rgb[1]), Math.round(+rgb[2]), Math.round(+rgb[3])];
    return null;
  }

  function isDarkTheme() {
    if (document.body?.classList?.contains('dark') || document.body?.classList?.contains('theme-dark')) return true;
    try {
      const bg = getComputedStyle(document.body).backgroundColor || '';
      const rgb = parseColorRgb(bg);
      if (rgb) return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 < 0.5;
    } catch {}
    return true;
  }

  const NS = 'http://www.w3.org/2000/svg';
  function mkIcon(viewBox, pathD) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', viewBox);
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', pathD);
    p.setAttribute('fill', 'currentColor');
    svg.appendChild(p);
    return svg;
  }

  // Create Sidebar Card Shadow DOM Host
  const sidebarHost = document.createElement('div');
  sidebarHost.id = SIDEBAR_HOST_ID;
  sidebarHost.setAttribute('translate', 'no');
  sidebarHost.classList.add('notranslate');

  const sRoot = sidebarHost.attachShadow({ mode: 'open' });
  const sStyle = document.createElement('style');
  sStyle.textContent = SIDEBAR_CSS;
  sRoot.appendChild(sStyle);

  const sCard = document.createElement('div');
  sCard.className = 'card';

  const sTop = document.createElement('div');
  sTop.className = 'top';
  const sBrand = document.createElement('div');
  sBrand.className = 'brand';
  const sGaugeIcon = mkIcon('0 -960 960 960', 'M418-340q24 24 62 23.5t56-27.5l224-336-336 224q-27 18-28.5 55t22.5 61Zm62-460q81 0 153 31t126 85q54 54 85 126t31 153q0 69-21 131t-59 114H165q-38-52-59-114T85-405q0-81 31-153t85-126q54-54 126-85t153-31Z');
  const sTitle = document.createElement('span');
  sTitle.textContent = 'Google AI Pro';
  sBrand.appendChild(sGaugeIcon);
  sBrand.appendChild(sTitle);

  const sPct = document.createElement('span');
  sPct.className = 'pct-pill';
  sPct.textContent = '—';
  sTop.appendChild(sBrand);
  sTop.appendChild(sPct);

  const sTrack = document.createElement('div');
  sTrack.className = 'track';
  const sFill = document.createElement('div');
  sFill.className = 'fill';
  sTrack.appendChild(sFill);

  const sSub = document.createElement('div');
  sSub.className = 'sub';
  const sSubLeft = document.createElement('span');
  sSubLeft.className = 'sub-left';
  sSubLeft.textContent = '加载中...';
  const sSubHint = document.createElement('span');
  sSubHint.className = 'sub-hint';
  sSubHint.textContent = '详情';
  sSub.appendChild(sSubLeft);
  sSub.appendChild(sSubHint);

  sCard.appendChild(sTop);
  sCard.appendChild(sTrack);
  sCard.appendChild(sSub);
  sRoot.appendChild(sCard);

  // Create Popover Modal Shadow DOM Host
  const modalHost = document.createElement('div');
  modalHost.id = MODAL_HOST_ID;
  modalHost.setAttribute('translate', 'no');
  modalHost.classList.add('notranslate');
  modalHost.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:48;';

  const mRoot = modalHost.attachShadow({ mode: 'open' });
  const mStyle = document.createElement('style');
  mStyle.textContent = MODAL_CSS;
  mRoot.appendChild(mStyle);

  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  const pop = document.createElement('div');
  pop.className = 'pop';
  const panel = document.createElement('div');
  panel.className = 'panel';

  // Header controls
  const hdr = document.createElement('div');
  hdr.className = 'hdr';
  const tabSeg = document.createElement('div');
  tabSeg.className = 'seg';
  const tabOverview = document.createElement('button');
  tabOverview.className = 'pill-btn active';
  tabOverview.textContent = '概述';
  const tabModels = document.createElement('button');
  tabModels.className = 'pill-btn';
  tabModels.textContent = '模型';
  tabSeg.appendChild(tabOverview);
  tabSeg.appendChild(tabModels);

  const rightSeg = document.createElement('div');
  rightSeg.className = 'seg';
  const rangeBtns = {};
  for (const [k, label] of [['all', '全部'], ['30d', '30天'], ['7d', '7天']]) {
    const b = document.createElement('button');
    b.className = 'pill-btn' + (k === 'all' ? ' active' : '');
    b.textContent = label;
    b.onclick = () => {
      tipEl.style.display = 'none';
      activeRange = k;
      syncHeaderStates();
      renderModal();
    };
    rangeBtns[k] = b;
    rightSeg.appendChild(b);
  }
  const gearBtn = document.createElement('button');
  gearBtn.className = 'icon-btn';
  gearBtn.title = '套餐与额度校准设置';
  const gearIcon = mkIcon('0 -960 960 960', 'm370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm112-260q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Z');
  gearIcon.setAttribute('width', '14');
  gearIcon.setAttribute('height', '14');
  gearBtn.appendChild(gearIcon);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'icon-btn';
  closeBtn.title = '关闭';
  const closeIcon = mkIcon('0 -960 960 960', 'm256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z');
  closeIcon.setAttribute('width', '14');
  closeIcon.setAttribute('height', '14');
  closeBtn.appendChild(closeIcon);

  const syncBtn = document.createElement('button');
  syncBtn.className = 'icon-btn';
  syncBtn.title = '同步官方用量（会短暂打开一次“查看用量”，约 2 秒后自动关闭）';
  const syncIcon = mkIcon('0 -960 960 960', 'M160-160v-80h110l-16-14q-52-46-73-105t-21-119q0-111 66.5-197.5T400-790v84q-72 26-116 88.5T240-478q0 45 17 87.5t53 78.5l10 10v-98h80v240H160Zm400-10v-84q72-26 116-88.5T720-482q0-45-17-87.5T650-648l-10-10v98h-80v-240h240v80H690l16 14q49 49 71.5 106.5T800-482q0 111-66.5 197.5T560-170Z');
  syncIcon.setAttribute('width', '14');
  syncIcon.setAttribute('height', '14');
  syncBtn.appendChild(syncIcon);
  let syncRequested = false;
  syncBtn.onclick = () => {
    syncRequested = true;
    triggerContextRefresh(true);
    syncBtn.classList.add('spin');
    setTimeout(() => syncBtn.classList.remove('spin'), 4500);
  };

  rightSeg.appendChild(syncBtn);
  rightSeg.appendChild(gearBtn);
  rightSeg.appendChild(closeBtn);
  hdr.appendChild(tabSeg);
  hdr.appendChild(rightSeg);

  // Dual Quota Cards (5小时额度 & 当前周额度)
  function createQuotaCard(titleText) {
    const card = document.createElement('div');
    card.className = 'q-card';
    const row = document.createElement('div');
    row.className = 'q-row';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'q-title';
    const titleSpan = document.createElement('span');
    titleSpan.textContent = titleText;
    const tagSpan = document.createElement('span');
    tagSpan.className = 'q-tag';
    titleWrap.appendChild(titleSpan);
    titleWrap.appendChild(tagSpan);
    const pctSpan = document.createElement('span');
    pctSpan.className = 'q-pct';
    row.appendChild(titleWrap);
    row.appendChild(pctSpan);

    const track = document.createElement('div');
    track.className = 'q-track';
    const fill = document.createElement('div');
    fill.className = 'q-fill';
    track.appendChild(fill);

    const sub = document.createElement('div');
    sub.className = 'q-sub';
    const subL = document.createElement('span');
    const subR = document.createElement('span');
    sub.appendChild(subL);
    sub.appendChild(subR);

    card.appendChild(row);
    card.appendChild(track);
    card.appendChild(sub);
    return { card, tagSpan, pctSpan, fill, subL, subR };
  }

  const qGrid = document.createElement('div');
  qGrid.className = 'q-grid';
  const q5Card = createQuotaCard('5小时额度');
  const q7Card = createQuotaCard('当前周额度');
  qGrid.appendChild(q5Card.card);
  qGrid.appendChild(q7Card.card);

  const poolGrid = document.createElement('div');
  poolGrid.className = 'q-grid';
  poolGrid.style.marginTop = '8px';
  const poolClaudeCard = createQuotaCard('Claude 与 GPT');
  const poolArgonCard = createQuotaCard('Gemini 4 Argon');
  poolGrid.appendChild(poolClaudeCard.card);
  poolGrid.appendChild(poolArgonCard.card);

  // Inline Config Box
  const cfgBox = document.createElement('div');
  cfgBox.className = 'cfg-box';

  const cfgRow1 = document.createElement('div');
  cfgRow1.className = 'cfg-row';
  const tierLbl = document.createElement('span');
  tierLbl.textContent = '订阅套餐基准';
  const tierSelect = document.createElement('select');
  tierSelect.className = 'cfg-select';
  for (const [id, label] of [
    ['pro', 'Google AI Pro (5h 12M / 周 120M)'],
    ['ultra', 'Google AI Ultra (5h 60M / 周 600M)'],
    ['free', 'Free Tier (5h 3M / 周 25M)'],
    ['local', '仅展示本地统计'],
  ]) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = label;
    tierSelect.appendChild(opt);
  }
  cfgRow1.appendChild(tierLbl);
  cfgRow1.appendChild(tierSelect);

  function parseResetTimeInput(raw) {
    const s = String(raw || '').trim();
    if (!s) return null;
    const now = Date.now();
    const hm = /^(\d{1,2}):(\d{1,2})$/.exec(s);
    if (hm) {
      const hh = Number(hm[1]);
      const mm = Number(hm[2]);
      if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
        const d = new Date(now);
        d.setHours(hh, mm, 0, 0);
        let t = d.getTime();
        while (t <= now) t += 5 * 3_600_000;
        return t;
      }
    }
    const dur = /^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|时|小时)?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?|分|分钟)?)?$/i.exec(s);
    if (dur && (dur[1] || dur[2])) {
      const h = Number(dur[1] || 0);
      const m = Number(dur[2] || 0);
      const addMs = Math.round((h * 3600 + m * 60) * 1000);
      if (addMs > 0) return now + addMs;
    }
    if (/^\d+$/.test(s)) {
      const mins = Number(s);
      if (mins > 0) return now + mins * 60_000;
    }
    return null;
  }

  const mkCalibrationRow = (labelText, onApply, onReset, opts = {}) => {
    const row = document.createElement('div');
    row.className = 'cfg-row';
    const lbl = document.createElement('span');
    lbl.textContent = labelText;
    const ctrl = document.createElement('div');
    ctrl.className = 'cfg-ctrl';
    const input = document.createElement('input');
    input.className = 'cfg-input';
    input.type = opts.type || 'number';
    if (!opts.type || opts.type === 'number') {
      input.min = '0';
      input.max = '100';
    }
    if (opts.width) input.style.width = opts.width;
    input.placeholder = opts.placeholder || '剩余 %';
    const btnReset = document.createElement('button');
    btnReset.className = 'cfg-btn ghost';
    btnReset.textContent = '重置';
    const btnSave = document.createElement('button');
    btnSave.className = 'cfg-btn';
    btnSave.textContent = '应用';
    btnSave.onclick = () => onApply(input.value.trim());
    btnReset.onclick = () => { input.value = ''; onReset(); };
    ctrl.appendChild(input);
    ctrl.appendChild(btnReset);
    ctrl.appendChild(btnSave);
    row.appendChild(lbl);
    row.appendChild(ctrl);
    return { row, input };
  };

  const cal5h = mkCalibrationRow(
    '校准 5h 剩余 %（留空按基准估算）',
    (raw) => {
      if (raw === '') queueConfigPatch({ calibratedRemainingPct: null });
      else {
        const n = Math.max(0, Math.min(100, Math.round(Number(raw))));
        if (!Number.isNaN(n)) queueConfigPatch({ calibratedRemainingPct: n });
      }
    },
    () => queueConfigPatch({ calibratedRemainingPct: null })
  );

  const calReset5h = mkCalibrationRow(
    '校准 5h 重置时间（如 19:30 或 2h15m）',
    (raw) => {
      if (raw === '') queueConfigPatch({ calibratedReset5hAtMs: null });
      else {
        const ts = parseResetTimeInput(raw);
        if (ts) queueConfigPatch({ calibratedReset5hAtMs: ts });
      }
    },
    () => queueConfigPatch({ calibratedReset5hAtMs: null }),
    { type: 'text', placeholder: '19:30 / 90m', width: '86px' }
  );

  const cal7d = mkCalibrationRow(
    '校准周剩余 %（留空按基准估算）',
    (raw) => {
      if (raw === '') queueConfigPatch({ calibratedWeeklyRemainingPct: null });
      else {
        const n = Math.max(0, Math.min(100, Math.round(Number(raw))));
        if (!Number.isNaN(n)) queueConfigPatch({ calibratedWeeklyRemainingPct: n });
      }
    },
    () => queueConfigPatch({ calibratedWeeklyRemainingPct: null })
  );

  cfgBox.appendChild(cfgRow1);
  cfgBox.appendChild(cal5h.row);
  cfgBox.appendChild(calReset5h.row);
  cfgBox.appendChild(cal7d.row);

  // Overview body
  const overviewWrap = document.createElement('div');
  const kpisEl = document.createElement('div');
  kpisEl.className = 'kpis';
  const heatmapWrap = document.createElement('div');
  heatmapWrap.className = 'heatmap-wrap';
  const heatmapEl = document.createElement('div');
  heatmapEl.className = 'heatmap';
  heatmapEl.addEventListener('mouseleave', () => {
    tipEl.style.display = 'none';
  });
  heatmapWrap.appendChild(heatmapEl);

  const footEl = document.createElement('div');
  footEl.className = 'foot';
  const funText = document.createElement('span');
  const modeChip = document.createElement('button');
  modeChip.className = 'mode-chip';
  modeChip.textContent = '含缓存总 Token';
  footEl.appendChild(funText);
  footEl.appendChild(modeChip);

  overviewWrap.appendChild(kpisEl);
  overviewWrap.appendChild(heatmapWrap);
  overviewWrap.appendChild(footEl);

  // Models body
  const modelsWrap = document.createElement('div');
  modelsWrap.className = 'models-list';
  modelsWrap.style.display = 'none';

  const tipEl = document.createElement('div');
  tipEl.className = 'tip';

  panel.appendChild(hdr);
  panel.appendChild(qGrid);
  panel.appendChild(poolGrid);
  panel.appendChild(cfgBox);
  panel.appendChild(overviewWrap);
  panel.appendChild(modelsWrap);
  pop.appendChild(panel);
  mRoot.appendChild(backdrop);
  mRoot.appendChild(pop);
  mRoot.appendChild(tipEl);

  let latestPayload = null;
  let activeTab = 'overview';
  let activeRange = 'all';
  let cfgOpen = false;
  let modalOpen = false;
  let closeTimer = null;
  let pendingConfigPatch = null;
  let themeSig = '';
  let cachedSettingsBtn = null;

  function findSidebarElements() {
    const btns = document.querySelectorAll('button, [role="button"], a');
    let settingsBtn = null;
    let newChatBtn = null;
    for (const b of btns) {
      const t = (b.innerText || '').trim();
      if (!settingsBtn && t === '设置' && b.getBoundingClientRect().left < 160) settingsBtn = b;
      if (!newChatBtn && t === '新建会话' && b.getBoundingClientRect().left < 160) newChatBtn = b;
      if (settingsBtn && newChatBtn) break;
    }
    if (!settingsBtn) return null;
    const sr = settingsBtn.getBoundingClientRect();
    if (!sr || sr.width < 80 || sr.height < 16) return null;
    const container = settingsBtn.parentElement;
    if (!container) return null;
    const selRow = document.querySelector('.agy-sidebar-row[data-selected="true"]');
    return { settingsBtn, newChatBtn, container, selRow };
  }

  function syncThemeTokens(found) {
    const dark = isDarkTheme();
    const bodyCs = getComputedStyle(document.body);
    const primaryRaw = bodyCs.getPropertyValue('--primary').trim() || '#2F71E3';
    const rgb = parseColorRgb(primaryRaw) || [47, 113, 227];
    const accentCss = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    const accentBg = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.14)`;
    const accentText = dark
      ? `rgb(${Math.min(255, rgb[0] + 65)}, ${Math.min(255, rgb[1] + 55)}, ${Math.min(255, rgb[2] + 28)})`
      : accentCss;

    const selCs = found?.selRow ? getComputedStyle(found.selRow) : null;
    const rowCs = found?.selRow || found?.newChatBtn ? getComputedStyle(found.selRow || found.newChatBtn) : null;
    const sidebarPane = found?.container?.parentElement;
    const paneBg = sidebarPane ? getComputedStyle(sidebarPane).backgroundColor : '';
    const cardRadius = (rowCs && rowCs.borderRadius && rowCs.borderRadius !== '0px') ? rowCs.borderRadius : '8px';

    const selectedBg = (selCs && selCs.backgroundColor && selCs.backgroundColor !== 'rgba(0, 0, 0, 0)')
      ? selCs.backgroundColor
      : (dark ? '#1F1F24' : 'rgba(15, 23, 42, 0.08)');
    const selectedShadow = (selCs && selCs.boxShadow && selCs.boxShadow !== 'none')
      ? selCs.boxShadow
      : (dark
          ? 'inset 0 1px 0 rgba(255, 255, 255, 0.067), inset 0 0 0 1px rgba(255, 255, 255, 0.06)'
          : 'inset 0 0 0 1px rgba(10, 10, 12, 0.06)');

    const sig = `${dark}|${accentCss}|${selectedBg}|${selectedShadow}|${cardRadius}|${paneBg}`;
    if (themeSig === sig) return;
    themeSig = sig;

    sidebarHost.style.setProperty('--q-card-radius', cardRadius);
    sidebarHost.style.setProperty('--q-idle-bg', 'transparent');
    sidebarHost.style.setProperty('--q-hover-bg', dark ? 'rgba(255, 255, 255, 0.045)' : 'rgba(15, 23, 42, 0.045)');
    sidebarHost.style.setProperty('--q-selected-bg', selectedBg);
    sidebarHost.style.setProperty('--q-selected-shadow', selectedShadow);
    sidebarHost.style.setProperty('--q-text', dark ? '#EAEBF1' : '#1F2328');
    sidebarHost.style.setProperty('--q-icon', dark ? '#8E909A' : '#656D76');
    sidebarHost.style.setProperty('--q-muted', dark ? '#8E909A' : '#656D76');
    sidebarHost.style.setProperty('--q-track', dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.09)');
    sidebarHost.style.setProperty('--q-accent', accentCss);
    sidebarHost.style.setProperty('--q-accent-bg', accentBg);
    sidebarHost.style.setProperty('--q-accent-text', accentText);

    // Deeper sidebar-synced palette for popover (eliminates bright gray cast)
    const popBg = (paneBg && paneBg !== 'rgba(0, 0, 0, 0)' && paneBg !== 'transparent') ? paneBg : (dark ? '#121216' : '#FFFFFF');
    modalHost.style.setProperty('--m-bg', popBg);
    modalHost.style.setProperty('--m-radius', cardRadius);
    modalHost.style.setProperty('--m-highlight', dark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF');
    modalHost.style.setProperty('--m-border', dark ? 'rgba(255, 255, 255, 0.085)' : 'rgba(15, 23, 42, 0.11)');
    modalHost.style.setProperty('--m-inner-border', dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.075)');
    modalHost.style.setProperty('--m-well', dark ? 'rgba(255, 255, 255, 0.028)' : 'rgba(15, 23, 42, 0.035)');
    modalHost.style.setProperty('--m-well-hover', dark ? 'rgba(255, 255, 255, 0.048)' : 'rgba(15, 23, 42, 0.06)');
    modalHost.style.setProperty('--m-hover', dark ? 'rgba(255, 255, 255, 0.045)' : 'rgba(15, 23, 42, 0.045)');
    modalHost.style.setProperty('--m-pill-active', selectedBg);
    modalHost.style.setProperty('--m-text', dark ? '#EAEBF1' : '#1F2328');
    modalHost.style.setProperty('--m-muted', dark ? '#8E909A' : '#656D76');
    modalHost.style.setProperty('--m-track', dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.09)');
    modalHost.style.setProperty('--m-accent', accentCss);
    modalHost.style.setProperty('--m-accent-bg', accentBg);
    modalHost.style.setProperty('--m-accent-text', accentText);
    modalHost.style.setProperty('--m-cell-0', dark ? 'rgba(255, 255, 255, 0.05)' : '#E6E8EE');
    modalHost.style.setProperty('--m-cell-1', `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.28)`);
    modalHost.style.setProperty('--m-cell-2', `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.50)`);
    modalHost.style.setProperty('--m-cell-3', `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.74)`);
    modalHost.style.setProperty('--m-cell-4', accentCss);
    modalHost.style.setProperty('--m-cell-hover', dark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(15, 23, 42, 0.55)');
    modalHost.style.setProperty('--m-tip-bg', dark ? '#18181E' : '#1F2328');
    modalHost.style.setProperty(
      '--m-shadow',
      dark
        ? '0 24px 56px -12px rgba(0, 0, 0, 0.75), 0 4px 16px -2px rgba(0, 0, 0, 0.5)'
        : '0 18px 44px -10px rgba(15, 23, 42, 0.16), 0 4px 12px -2px rgba(15, 23, 42, 0.08)'
    );
  }

  function ensureMounted() {
    const found = findSidebarElements();
    if (!found) {
      cachedSettingsBtn = null;
      return false;
    }
    cachedSettingsBtn = found.settingsBtn;
    syncThemeTokens(found);

    const { settingsBtn, container } = found;
    if (sidebarHost.parentElement !== container || sidebarHost.nextElementSibling !== settingsBtn) {
      try {
        container.insertBefore(sidebarHost, settingsBtn);
      } catch {}
    }

    if (!modalHost.isConnected && document.body) {
      const rootApp = document.getElementById('root');
      if (rootApp && rootApp.parentElement) {
        rootApp.parentElement.insertBefore(modalHost, rootApp.nextSibling);
      } else {
        document.body.appendChild(modalHost);
      }
    }
    return true;
  }

  function positionModal() {
    const anchorRect = sCard.getBoundingClientRect();
    const hasAnchor = anchorRect && anchorRect.width > 50 && anchorRect.height > 10;
    const leftPx = hasAnchor ? Math.round(anchorRect.right + 12) : 268;
    const clampedLeft = Math.max(12, Math.min(window.innerWidth - 400, leftPx));
    const bottomPx = hasAnchor ? Math.max(14, Math.round(window.innerHeight - anchorRect.bottom)) : 20;
    pop.style.left = clampedLeft + 'px';
    pop.style.bottom = bottomPx + 'px';
  }

  function openModal() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    modalOpen = true;
    sCard.classList.add('open');
    positionModal();
    pop.classList.add('mounted');
    backdrop.classList.add('open');
    requestAnimationFrame(() => {
      pop.classList.add('open');
    });
    triggerContextRefresh(true);
    renderModal();
  }

  function closeModal() {
    modalOpen = false;
    sCard.classList.remove('open');
    pop.classList.remove('open');
    backdrop.classList.remove('open');
    tipEl.style.display = 'none';
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!modalOpen) pop.classList.remove('mounted');
    }, 190);
  }

  function syncHeaderStates() {
    tabOverview.classList.toggle('active', activeTab === 'overview');
    tabModels.classList.toggle('active', activeTab === 'models');
    overviewWrap.style.display = activeTab === 'overview' ? 'block' : 'none';
    modelsWrap.style.display = activeTab === 'models' ? 'block' : 'none';
    for (const [k, btn] of Object.entries(rangeBtns)) {
      btn.classList.toggle('active', activeRange === k);
    }
    gearBtn.classList.toggle('active', cfgOpen);
    cfgBox.classList.toggle('open', cfgOpen);
  }

  let liveCache = null;
  let lastObservedSteps5h = null;
  let lastObservedTokens5h = null;
  let lastRefreshTriggerAt = 0;

  function findModelContext() {
    try {
      const btn = document.querySelector('[data-testid="model-selector-trigger"]');
      if (!btn) return null;
      const fk = Object.keys(btn).find((k) => k.startsWith('__reactFiber$'));
      if (!fk) return null;
      let cur = btn[fk];
      for (let i = 0; i < 40 && cur; i++) {
        const v = cur.memoizedProps && cur.memoizedProps.value;
        if (v && Array.isArray(v.modelOptions)) return v;
        cur = cur.return;
      }
    } catch {}
    return null;
  }

  function triggerContextRefresh(force = false) {
    const now = Date.now();
    const minInterval = force ? 3_000 : 5_000;
    if (now - lastRefreshTriggerAt < minInterval) return;
    const ctx = findModelContext();
    if (!ctx || typeof ctx.refreshModels !== 'function') return;
    lastRefreshTriggerAt = now;
    try {
      Promise.resolve(ctx.refreshModels()).finally(() => {
        setTimeout(() => {
          if (!latestPayload) return;
          applyLiveQuota(latestPayload);
          renderSidebar();
          if (modalOpen) renderModal();
        }, 450);
      });
    } catch {}
  }

  function readLiveQuota() {
    try {
      const ctx = findModelContext();
      if (!ctx) return liveCache;
      const now = Date.now();
      const pools = {};
      for (const opt of ctx.modelOptions) {
        const qi = opt && opt.quotaInfo;
        const resetMs = qi && qi.resetTime ? Number(qi.resetTime.seconds) * 1000 : NaN;
        if (!Number.isFinite(resetMs) || resetMs <= 0) continue;
        // Proto3 JSON omits remainingFraction when it equals 0; an active future resetTime with omitted fraction means 0% remaining.
        const frac = typeof qi.remainingFraction === 'number'
          ? qi.remainingFraction
          : (resetMs > now ? 0 : 1);
        const id = String(opt.modelId || opt.label || '').toLowerCase();
        let key = 'gemini';
        if (id.includes('argon') || id.includes('g1-pro')) key = 'argon';
        else if (id.includes('claude') || id.includes('gpt')) key = 'claude';
        if (pools[key]) continue;
        pools[key] = {
          pct: Math.max(0, Math.min(100, Math.round(frac * 100))),
          resetMs,
          kind: resetMs - now > 5.5 * 3_600_000 ? 'weekly' : 'fiveHour',
        };
      }
      const tier = ctx.userStatus && ctx.userStatus.userTier && ctx.userStatus.userTier.name;
      liveCache = { at: now, tier: tier || null, pools };
      return liveCache;
    } catch {
      return liveCache;
    }
  }

  function bucketView(b) {
    if (!b || !Number.isFinite(b.resetMs)) return null;
    const expired = b.resetMs <= Date.now();
    return { pct: expired ? 100 : b.pct, resetMs: b.resetMs, expired };
  }

  function pickFresherBucket(liveB, sumB) {
    const lv = bucketView(liveB);
    const sv = bucketView(sumB);
    if (!lv) return sv;
    if (!sv) return lv;
    if (lv.expired && !sv.expired) return sv;
    if (sv.expired && !lv.expired) return lv;
    if (sv.resetMs - lv.resetMs > 120_000) return sv;
    if (lv.resetMs - sv.resetMs > 120_000) return lv;
    // Within the same active reset window, quota decreases monotonically on consumption, so lower pct is fresher.
    return sv.pct <= lv.pct ? sv : lv;
  }

  function applyLiveQuota(payload) {
    const q = payload && payload.snapshot && payload.snapshot.quota;
    if (!q) return;
    const live = readLiveQuota();
    const sum = payload.summary || null;
    q.live = live || null;
    q.summary = sum;
    if (q.tierId === 'local') return;
    if (live && live.tier) q.tierLabel = live.tier;

    const sp = (sum && sum.pools) || {};
    const lp = (live && live.pools) || {};
    const sumAgeMs = sum && sum.capturedAt ? Date.now() - sum.capturedAt : Infinity;

    // Gemini main quota: take the freshest reading across React modelOptions and usage summary within the active window
    const g5 = pickFresherBucket(lp.gemini && lp.gemini.kind === 'fiveHour' ? lp.gemini : null, sp.gemini && sp.gemini.fiveHour);
    if (g5) {
      q.remainingPct = g5.pct;
      q.pctSource = 'live';
      if (g5.expired) {
        q.reset5hAtMs = null;
        q.reset5hSource = 'live-expired';
      } else {
        q.reset5hAtMs = g5.resetMs;
        q.reset5hSource = 'live';
      }
    }
    const gw = pickFresherBucket(lp.gemini && lp.gemini.kind === 'weekly' ? lp.gemini : null, sp.gemini && sp.gemini.weekly);
    if (gw) {
      q.weeklyRemainingPct = gw.pct;
      q.weeklyPctSource = lp.gemini && lp.gemini.kind === 'weekly' ? 'live' : (sumAgeMs <= 15 * 60_000 ? 'live' : 'snapshot');
      q.weeklyResetAtMs = gw.resetMs;
      q.weeklyExpired = gw.expired;
    }
    q.summaryAt = sum && sum.capturedAt ? sum.capturedAt : null;

    // Independent pools (never counted against Gemini quota)
    q.poolView = {
      claude: {
        fiveHour: pickFresherBucket(lp.claude && lp.claude.kind === 'fiveHour' ? lp.claude : null, sp.claude && sp.claude.fiveHour),
        weekly: pickFresherBucket(lp.claude && lp.claude.kind === 'weekly' ? lp.claude : null, sp.claude && sp.claude.weekly),
      },
      argon: {
        weekly: pickFresherBucket(lp.argon && lp.argon.kind === 'weekly' ? lp.argon : null, sp.argon && sp.argon.weekly),
      },
    };
  }

  function fmtResetLong(ms) {
    if (!ms) return '—';
    const diff = Math.max(0, ms - Date.now());
    const totalMins = Math.max(1, Math.ceil(diff / 60_000));
    const d = Math.floor(totalMins / 1440);
    const h = Math.floor((totalMins % 1440) / 60);
    const m = totalMins % 60;
    if (d > 0) return `${d}天${h}小时后重置`;
    const dt = new Date(ms);
    const hhmm = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    return `${hhmm} 重置 (${h > 0 ? h + 'h' + String(m).padStart(2, '0') + 'm' : m + 'm'})`;
  }

  function resolveWeeklyFields(snap, presets) {
    const q = snap.quota || {};
    const tierId = q.tierId || 'pro';
    const fallbackBudget7d = { pro: 120_000_000, ultra: 600_000_000, free: 25_000_000, local: 0 }[tierId] || 120_000_000;
    const budget7dNet = q.budget7dNet !== undefined ? q.budget7dNet : (presets?.[tierId]?.budget7dNet ?? fallbackBudget7d);
    const tokens7dNet = q.tokens7dNet !== undefined ? q.tokens7dNet : (snap.ranges?.['7d']?.tokensNet || 0);
    const tokens7dTotal = q.tokens7dTotal !== undefined ? q.tokens7dTotal : (snap.ranges?.['7d']?.tokensTotal || 0);

    let weeklyPct = q.weeklyRemainingPct;
    let weeklySource = q.weeklyPctSource;
    if (weeklyPct === undefined) {
      if (tierId === 'local' || budget7dNet <= 0) {
        weeklyPct = null;
        weeklySource = 'local';
      } else {
        weeklyPct = Math.max(0, Math.min(100, Math.round(100 - (tokens7dNet / budget7dNet) * 100)));
        weeklySource = 'window';
      }
    }
    return { budget7dNet, tokens7dNet, tokens7dTotal, weeklyPct, weeklySource };
  }

  function resolveReset5hInfo(snap) {
    const q = snap?.quota || {};
    const now = Date.now();
    const FIVE_H = 5 * 3_600_000;
    let targetMs = null;
    let source = q.reset5hSource || 'window';

    if (q.reset5hSource === 'live-expired') {
      return { resetAtMs: null, source: 'live', shortText: '5h 已重置', detailText: '5h 已重置' };
    }
    if (q.reset5hSource === 'live' && q.reset5hAtMs) {
      targetMs = Number(q.reset5hAtMs);
      source = 'live';
    } else if (q.config?.calibratedReset5hAtMs) {
      targetMs = Number(q.config.calibratedReset5hAtMs);
      source = 'calibrated';
    } else if (q.reset5hAtMs) {
      targetMs = Number(q.reset5hAtMs);
    } else if (q.oldest5hTsMs) {
      targetMs = Number(q.oldest5hTsMs) + FIVE_H;
    } else if ((q.tokens5hNet || 0) > 0) {
      // Fallback if running sidecar hasn't reloaded stats.mjs yet: align to current 5h rolling block
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      let slot = d.getTime();
      while (slot <= now) slot += FIVE_H;
      targetMs = slot;
      source = 'window';
    }

    if (!targetMs) {
      return { resetAtMs: null, source: 'idle', shortText: '5h 空闲', detailText: '5h 窗口空闲' };
    }
    while (targetMs <= now) targetMs += FIVE_H;

    const diffMs = Math.max(0, targetMs - now);
    const totalMins = Math.max(1, Math.ceil(diffMs / 60_000));
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const dt = new Date(targetMs);
    const hhmm = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    const cd = hrs > 0 ? `${hrs}h${String(mins).padStart(2, '0')}m` : `${mins}m`;
    return {
      resetAtMs: targetMs,
      source,
      hhmm,
      countdown: cd,
      shortText: `${hhmm} 重置`,
      detailText: `${hhmm} 重置 (${cd})`,
    };
  }

  function queueConfigPatch(patch) {
    pendingConfigPatch = { ...(pendingConfigPatch || {}), ...patch };
    if (latestPayload?.snapshot?.quota) {
      const snap = latestPayload.snapshot;
      const q = snap.quota;
      q.config = { ...(q.config || {}), ...patch };
      if (patch.planTier && latestPayload.presets?.[patch.planTier]) {
        const pr = latestPayload.presets[patch.planTier];
        q.tierId = patch.planTier;
        q.tierLabel = pr.label;
        q.tierShort = pr.short;
        q.budget5hNet = pr.budget5hNet;
        q.budget7dNet = pr.budget7dNet;
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'calibratedRemainingPct')) {
        if (patch.calibratedRemainingPct === null) {
          q.pctSource = q.tierId === 'local' ? 'local' : 'window';
          q.remainingPct = q.budget5hNet > 0 ? Math.max(0, Math.min(100, Math.round(100 - (q.tokens5hNet / q.budget5hNet) * 100))) : null;
        } else {
          q.pctSource = 'calibrated';
          q.remainingPct = Number(patch.calibratedRemainingPct);
        }
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'calibratedReset5hAtMs')) {
        if (patch.calibratedReset5hAtMs === null) {
          q.reset5hAtMs = q.oldest5hTsMs ? q.oldest5hTsMs + 5 * 3_600_000 : null;
          q.reset5hSource = q.reset5hAtMs ? 'window' : 'idle';
        } else {
          q.reset5hAtMs = Number(patch.calibratedReset5hAtMs);
          q.reset5hSource = 'calibrated';
        }
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'calibratedWeeklyRemainingPct')) {
        const wf = resolveWeeklyFields(snap, latestPayload.presets);
        if (patch.calibratedWeeklyRemainingPct === null) {
          q.weeklyPctSource = q.tierId === 'local' ? 'local' : 'window';
          q.weeklyRemainingPct = wf.budget7dNet > 0 ? Math.max(0, Math.min(100, Math.round(100 - (wf.tokens7dNet / wf.budget7dNet) * 100))) : null;
        } else {
          q.weeklyPctSource = 'calibrated';
          q.weeklyRemainingPct = Number(patch.calibratedWeeklyRemainingPct);
        }
      }
      renderSidebar();
      renderModal();
    }
  }

  function renderSidebar() {
    const snap = latestPayload?.snapshot;
    if (!snap) return;
    const q = snap.quota;
    const wk = resolveWeeklyFields(snap, latestPayload.presets);
    const rst = resolveReset5hInfo(snap);

    sTitle.textContent = q.tierLabel || '订阅与额度';
    const p5 = q.remainingPct;
    const p7 = wk.weeklyPct;
    const minWarn = (p5 !== null && p5 !== undefined && p5 <= 20) || (p7 !== null && p7 !== undefined && p7 <= 20);

    if (p5 !== null && p5 !== undefined) {
      sPct.textContent = `5h ${p5}%` + (p7 !== null && p7 !== undefined ? ` · 周 ${p7}%` : '');
      sPct.classList.toggle('warn', minWarn);
      sFill.style.width = p5 + '%';
      sFill.classList.toggle('warn', minWarn);
    } else {
      sPct.textContent = `5h ${fmtNum(q.tokens5hNet)}`;
      sPct.classList.remove('warn');
      sFill.style.width = '100%';
      sFill.classList.remove('warn');
    }
    sSubLeft.textContent = `5h ${fmtNum(q.tokens5hNet)} 净 · 周 ${fmtNum(wk.tokens7dNet)} 净`;
    sSubHint.textContent = rst.shortText;
  }

  function renderModal() {
    tipEl.style.display = 'none';
    if (!modalOpen || !latestPayload?.snapshot) return;
    const snap = latestPayload.snapshot;
    const q = snap.quota;
    const wk = resolveWeeklyFields(snap, latestPayload.presets);
    const rst = resolveReset5hInfo(snap);
    const r = snap.ranges?.[activeRange] || snap.ranges?.all;
    if (!r) return;

    const useNet = q.config?.tokenMode === 'net';
    modeChip.textContent = useNet ? '净 Token (输入+输出)' : '含缓存总 Token';

    // Render 5h quota card (Gemini main pool)
    const sourceBadge = (src) => (src === 'live' ? '实时' : src === 'snapshot' ? '快照' : src === 'calibrated' ? '已校准' : src === 'window' ? '基准估算' : '本地');
    q5Card.tagSpan.textContent = q.tierId === 'local' ? '本地' : `Gemini · ${sourceBadge(q.pctSource)}`;
    const w5 = q.remainingPct;
    q5Card.pctSpan.textContent = w5 !== null && w5 !== undefined ? `余 ${w5}%` : fmtNum(q.tokens5hNet);
    q5Card.pctSpan.classList.toggle('warn', w5 !== null && w5 <= 20);
    q5Card.fill.style.width = (w5 !== null && w5 !== undefined ? w5 : 100) + '%';
    q5Card.fill.classList.toggle('warn', w5 !== null && w5 <= 20);
    q5Card.subL.textContent = `净用 ${fmtNum(q.tokens5hNet)}` + (q.budget5hNet ? ` / ${fmtNum(q.budget5hNet)}` : '');
    q5Card.subR.textContent = rst.detailText;
    q5Card.card.title = `Gemini 5h 含缓存总计 ${fmtNum(q.tokens5hTotal)} · ${rst.source === 'live' ? '实时官方重置时间' : rst.source === 'calibrated' ? '手动校准重置时间' : '按 5h 窗口最早记录推算回落时间'}`;

    // Render Weekly quota card (Gemini main pool)
    q7Card.tagSpan.textContent = q.tierId === 'local' ? '本地' : `Gemini · ${sourceBadge(wk.weeklySource)}`;
    const w7 = wk.weeklyPct;
    q7Card.pctSpan.textContent = w7 !== null && w7 !== undefined ? `余 ${w7}%` : fmtNum(wk.tokens7dNet);
    q7Card.pctSpan.classList.toggle('warn', w7 !== null && w7 <= 20);
    q7Card.fill.style.width = (w7 !== null && w7 !== undefined ? w7 : 100) + '%';
    q7Card.fill.classList.toggle('warn', w7 !== null && w7 <= 20);
    q7Card.subL.textContent = `净用 ${fmtNum(wk.tokens7dNet)}` + (wk.budget7dNet ? ` / ${fmtNum(wk.budget7dNet)}` : '');
    q7Card.subR.textContent = q.weeklyResetAtMs
      ? (q.weeklyExpired ? '周额度已重置' : fmtResetLong(q.weeklyResetAtMs))
      : `今日 ${fmtNum(q.tokensTodayTotal)}`;
    if (q.summaryAt) {
      const sd = new Date(q.summaryAt);
      q7Card.card.title = `Gemini 周额度来自官方用量汇总，同步于 ${String(sd.getHours()).padStart(2, '0')}:${String(sd.getMinutes()).padStart(2, '0')}（点右上角同步按钮可刷新）`;
    }

    // Independent quota pools (Claude & GPT / Gemini 4 Argon) - do not count against Gemini main quota
    const pv = q.poolView || {};
    const localPools = q.pools || {};
    const resetText = (v) => (v ? (v.expired ? '已重置' : fmtResetLong(v.resetMs)) : '无实时额度');
    const setPool = (card, main, tagText, pctText, subLText, subRText, tip) => {
      if (main) {
        card.tagSpan.textContent = tagText;
        card.pctSpan.textContent = pctText;
        card.pctSpan.classList.toggle('warn', main.pct <= 20);
        card.fill.style.width = main.pct + '%';
        card.fill.classList.toggle('warn', main.pct <= 20);
      } else {
        card.tagSpan.textContent = '本地统计';
        card.pctSpan.textContent = '—';
        card.pctSpan.classList.remove('warn');
        card.fill.style.width = '100%';
        card.fill.classList.remove('warn');
      }
      card.subL.textContent = subLText;
      card.subR.textContent = subRText;
      card.card.title = tip || '';
    };
    const cl = pv.claude || {};
    const lc = localPools.claude || {};
    const clMain = cl.fiveHour || cl.weekly || null;
    setPool(
      poolClaudeCard,
      clMain,
      cl.fiveHour ? '5h · 实时' : '周 · 实时',
      clMain ? `余 ${clMain.pct}%` : '—',
      cl.weekly && cl.fiveHour
        ? `周余 ${cl.weekly.pct}% · 周 ${fmtNum(lc.tokens7dNet || 0)}`
        : `5h ${fmtNum(lc.tokens5hNet || 0)} · 周 ${fmtNum(lc.tokens7dNet || 0)}`,
      resetText(clMain),
      cl.weekly ? `Claude & GPT 周额度余 ${cl.weekly.pct}% (${resetText(cl.weekly)}) · 本地 5h ${fmtNum(lc.tokens5hNet || 0)} 净 / 周 ${fmtNum(lc.tokens7dNet || 0)} 净` : ''
    );
    const ar = pv.argon || {};
    const la = localPools.argon || {};
    setPool(
      poolArgonCard,
      ar.weekly || null,
      '周 · 实时',
      ar.weekly ? `余 ${ar.weekly.pct}%` : '—',
      `周 ${fmtNum(la.tokens7dNet || 0)} 净`,
      resetText(ar.weekly),
      `Gemini 4 Argon 与 Orchestrator (Argon) 共享独立周配额 · 本地 5h ${fmtNum(la.tokens5hNet || 0)} 净 / 周 ${fmtNum(la.tokens7dNet || 0)} 净`
    );

    if (tierSelect.value !== q.tierId && document.activeElement !== tierSelect) {
      tierSelect.value = q.tierId;
    }

    // 6 KPI Cards
    const tokDisplay = useNet ? r.tokensNet : r.tokensTotal;
    const cards = [
      { lbl: '会话', val: String(r.sessions), title: `活跃会话 ${r.sessions} 个` },
      { lbl: '消息', val: r.messages.toLocaleString(), title: `提问 ${r.userMessages} · 回复步骤 ${r.modelSteps}` },
      { lbl: useNet ? '净 Token' : 'Token 总数', val: fmtNum(tokDisplay), title: `输入 ${fmtNum(r.tokensInput)} / 缓存读 ${fmtNum(r.tokensCacheRead)} / 输出 ${fmtNum(r.tokensOutput)}` },
      { lbl: '活跃天数', val: String(r.activeDays), title: `周期内有记录天数` },
      { lbl: '高峰时段', val: r.peakHour !== null ? `${r.peakHour}时` : '—', title: `消息交互最集中的小时` },
      { lbl: '常用模型', val: r.topModel || '—', title: r.topModel || '—', small: true },
    ];

    kpisEl.innerHTML = '';
    for (const c of cards) {
      const box = document.createElement('div');
      box.className = 'kpi';
      box.title = c.title;
      const lbl = document.createElement('div');
      lbl.className = 'kpi-lbl';
      lbl.textContent = c.lbl;
      const val = document.createElement('div');
      val.className = 'kpi-val' + (c.small ? ' small' : '');
      val.textContent = c.val;
      box.appendChild(lbl);
      box.appendChild(val);
      kpisEl.appendChild(box);
    }

    // Heatmap 7 x 24
    const hm = snap.ranges?.all?.heatmap || r.heatmap;
    heatmapEl.innerHTML = '';
    for (const cell of hm.cells) {
      const el = document.createElement('div');
      const lv = useNet ? (cell.levelNet ?? cell.level) : cell.level;
      el.className = 'cell' + (cell.isFuture ? ' future' : lv ? ' l' + lv : '');
      if (!cell.isFuture) {
        el.addEventListener('mouseenter', () => {
          const val = useNet ? cell.net : cell.total;
          tipEl.textContent =
            cell.total > 0
              ? `${cell.month}月${cell.day}日 — ${fmtNum(val)} tokens · ${cell.messages} 消息`
              : `${cell.month}月${cell.day}日 — 无使用`;
          tipEl.style.display = 'block';
          const cr = el.getBoundingClientRect();
          const pr = panel.getBoundingClientRect();
          const tw = tipEl.offsetWidth || 120;
          const th = tipEl.offsetHeight || 24;
          const minL = Math.max(8, pr.left + 8);
          const maxL = Math.min(window.innerWidth - tw - 8, pr.right - tw - 8);
          const left = Math.max(minL, Math.min(maxL, cr.left + cr.width / 2 - tw / 2));
          const top = Math.max(8, cr.top - th - 6);
          tipEl.style.left = Math.round(left) + 'px';
          tipEl.style.top = Math.round(top) + 'px';
        });
        el.addEventListener('mouseleave', () => {
          tipEl.style.display = 'none';
        });
      }
      heatmapEl.appendChild(el);
    }

    // Fun footer
    const books = Math.max(1, Math.round(tokDisplay / 22000));
    funText.textContent = `你使用的 token 大约是《小王子》的 ${books.toLocaleString()} 倍。`;

    // Models Breakdown
    modelsWrap.innerHTML = '';
    if (!r.models || r.models.length === 0) {
      const empty = document.createElement('div');
      empty.style.color = 'var(--m-muted)';
      empty.style.fontSize = '12px';
      empty.textContent = '当前筛选范围内暂无模型调用记录';
      modelsWrap.appendChild(empty);
    } else {
      for (const m of r.models) {
        const val = useNet ? m.net : m.total;
        const pct = useNet ? m.shareNetPct : m.shareTotalPct;
        const item = document.createElement('div');
        item.className = 'm-item';

        const top = document.createElement('div');
        top.className = 'm-top';
        const nm = document.createElement('span');
        nm.className = 'm-name';
        const poolLbl = m.pool === 'argon' ? 'Argon' : m.pool === 'claude' ? 'Claude·GPT' : 'Gemini';
        nm.textContent = `${m.name} [${poolLbl}]`;
        const meta = document.createElement('span');
        meta.className = 'm-meta';
        meta.textContent = `${fmtNum(val)} · ${m.steps}步 (${pct}%)`;
        top.appendChild(nm);
        top.appendChild(meta);

        const bar = document.createElement('div');
        bar.className = 'm-bar';
        const fill = document.createElement('div');
        fill.className = 'm-fill';
        fill.style.width = Math.max(pct > 0 ? 2 : 0, pct) + '%';
        bar.appendChild(fill);

        item.appendChild(top);
        item.appendChild(bar);
        modelsWrap.appendChild(item);
      }
    }
  }

  // Event bindings
  sCard.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (modalOpen) closeModal();
    else openModal();
  });

  backdrop.addEventListener('click', () => closeModal());
  closeBtn.onclick = () => closeModal();
  panel.addEventListener('click', (ev) => ev.stopPropagation());

  const onKeyDown = (ev) => {
    if (ev.key === 'Escape' && modalOpen) closeModal();
  };
  const onResize = () => {
    if (modalOpen) positionModal();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);

  tabOverview.onclick = () => {
    tipEl.style.display = 'none';
    activeTab = 'overview';
    syncHeaderStates();
    renderModal();
  };
  tabModels.onclick = () => {
    tipEl.style.display = 'none';
    activeTab = 'models';
    syncHeaderStates();
    renderModal();
  };
  gearBtn.onclick = () => {
    cfgOpen = !cfgOpen;
    syncHeaderStates();
  };
  tierSelect.onchange = () => {
    queueConfigPatch({ planTier: tierSelect.value });
  };
  modeChip.onclick = () => {
    const cur = latestPayload?.snapshot?.quota?.config?.tokenMode === 'net' ? 'net' : 'total';
    queueConfigPatch({ tokenMode: cur === 'net' ? 'total' : 'net' });
  };

  function update(payload) {
    const q = payload && payload.snapshot && payload.snapshot.quota;
    if (q) {
      const steps5h = Number(q.steps5h || 0);
      const tok5h = Number(q.tokens5hTotal || 0);
      if (
        lastObservedSteps5h !== null &&
        (steps5h > lastObservedSteps5h || tok5h > lastObservedTokens5h)
      ) {
        triggerContextRefresh(false);
      }
      lastObservedSteps5h = steps5h;
      lastObservedTokens5h = tok5h;
    }
    latestPayload = payload;
    applyLiveQuota(payload);
    const mounted = ensureMounted();
    if (mounted) {
      renderSidebar();
      if (modalOpen) {
        positionModal();
        renderModal();
      }
    }
    return {
      ok: true,
      mounted: sidebarHost.isConnected && modalHost.isConnected,
      visible: sidebarHost.isConnected && !!cachedSettingsBtn,
      modalOpen,
    };
  }

  window.__AGY_QUOTA_BAR = {
    ver: VER,
    update,
    openModal,
    closeModal,
    readLiveQuota,
    getSummary() {
      return latestPayload?.summary || null;
    },
    consumePendingConfig() {
      const out = pendingConfigPatch;
      pendingConfigPatch = null;
      return out;
    },
    consumeSyncRequest() {
      const out = syncRequested;
      syncRequested = false;
      return out;
    },
    unmount() {
      if (closeTimer) clearTimeout(closeTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      try { sidebarHost.remove(); } catch {}
      try { modalHost.remove(); } catch {}
    },
  };

  if (document.body) ensureMounted();
  else document.addEventListener('DOMContentLoaded', ensureMounted, { once: true });
})();
