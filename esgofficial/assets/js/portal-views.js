// ESG ClientOS — view renderers
const ICONS = {
  home: '<path d="M4 11L12 4L20 11"/><path d="M6 10V20H18V10"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M8 5V19M16 5V19M3 9.5H8M16 9.5H21M3 14.5H8M16 14.5H21"/>',
  mappin: '<path d="M12 21S5 14.5 5 10A7 7 0 0 1 19 10C19 14.5 12 21 12 21Z"/><circle cx="12" cy="10" r="2.4"/>',
  chat: '<path d="M4 18L5.2 14.6A8 8 0 1 1 8.4 17.8L4 18Z"/><circle cx="9" cy="12" r="0.8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="0.8" fill="currentColor" stroke="none"/>',
  growth: '<path d="M4 17L10 11L14 15L20 6"/><path d="M14 6L20 6L20 12"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="M20.5 20.5L15 15"/>',
  pen: '<path d="M18 3L21 6L9 18L4 20L6 15Z"/><path d="M14 6L18 10"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5L10.5 15L16 9"/>',
  vault: '<path d="M4 7L12 3L20 7V17L12 21L4 17Z"/><path d="M8 9.5L12 11.5L16 9.5"/><path d="M12 11.5V19"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5H20.5"/><path d="M8 3V6.5M16 3V6.5"/>',
  reports: '<path d="M7 3H14L18 7V21H7Z"/><path d="M14 3V7H18"/><path d="M9.5 12H15.5M9.5 15.5H15.5"/>',
  bell: '<path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z"/><path d="M10 18.5a2 2 0 0 0 4 0"/>',
  menu: '<path d="M4 7H20M4 12H20M4 17H20"/>',
  chevronRight: '<path d="M9 5L16 12L9 19"/>',
  folder: '<path d="M4 7C4 6 5 5 6 5H10L12 7.5H18C19 7.5 20 8.5 20 9.5V17C20 18 19 19 18 19H6C5 19 4 18 4 17Z"/>',
  file: '<path d="M7 3H14L18 7V21H7Z"/><path d="M14 3V7H18"/>',
  fileVideo: '<path d="M7 3H14L18 7V21H7Z"/><path d="M14 3V7H18"/><path d="M9.5 13.5L13.5 15.5L9.5 17.5Z" fill="currentColor" stroke="none"/>',
  fileImg: '<path d="M7 3H14L18 7V21H7Z"/><path d="M14 3V7H18"/><circle cx="10.3" cy="13" r="1.1" fill="currentColor" stroke="none"/><path d="M9 18L12 14.5L14 16.5L15.5 15L17 18Z" fill="currentColor" stroke="none"/>',
  download: '<path d="M12 4V15M12 15L8 11M12 15L16 11"/><path d="M5 17V19A2 2 0 0 0 7 21H17A2 2 0 0 0 19 19V17"/>',
  message: '<path d="M4 18L5.2 14.6A8 8 0 1 1 8.4 17.8L4 18Z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15 9L13 13L9 15L11 11Z" fill="currentColor" stroke="none"/>',
  layers: '<path d="M12 3L21 8L12 13L3 8Z"/><path d="M3 12L12 17L21 12"/><path d="M3 16L12 21L21 16"/>',
};
function icon(name, cls) { return `<svg class="${cls||''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||''}</svg>`; }

const SERVICE_ICON = { 'brand-strategy':'target', content:'film', gbp:'mappin', whatsapp:'chat', performance:'growth', research:'search', founder:'pen' };

function chip(status) {
  const map = {
    not_started: ['Not Started', ''], planning: ['Planning', ''], in_progress: ['In Progress', 'chip-progress'],
    internal_review: ['Internal Review', 'chip-progress'], client_review: ['Client Review', 'chip-review'],
    changes_requested: ['Changes Requested', 'chip-changes'], approved: ['Approved', 'chip-approved'],
    scheduled: ['Scheduled', 'chip-scheduled'], published: ['Published', 'chip-published'],
    measurement: ['Measurement', 'chip-progress'], completed: ['Completed', 'chip-completed'],
    active: ['Active', 'chip-progress'], paused: ['Paused', 'chip-changes'], pending: ['Pending', 'chip-review'],
  };
  const [label, cls] = map[status] || [status, ''];
  return `<span class="chip ${cls}">${label}</span>`;
}

function healthStatusMeta(status) {
  return { excellent: ['Excellent', ''], healthy: ['Healthy', ''], attention: ['Attention', 'attention'], risk: ['At Risk', 'risk'] }[status] || ['Healthy', ''];
}

function healthRing(score) {
  const r = 38, c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 90 ? 'var(--moss)' : score >= 75 ? 'var(--brass)' : score >= 60 ? '#B8863F' : 'var(--warn)';
  return `<div class="health-ring">
    <svg viewBox="0 0 88 88"><circle cx="44" cy="44" r="${r}" fill="none" stroke="var(--line)" stroke-width="7"/>
    <circle cx="44" cy="44" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"/></svg>
    <div class="pct">${score}%</div></div>`;
}

function crumb(path) {
  return `<p class="pbreadcrumb">${path.map((p,i)=> i===path.length-1 ? `<span>${p}</span>` : p).join(' / ')}</p>`;
}

// ---------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------
function renderDashboard() {
  const d = PORTAL_DATA;
  const [statusLabel, statusCls] = healthStatusMeta(d.health.status);
  return `
  <div class="pview">
    <div class="pgreeting">
      <h1>Good morning, ${d.client.name}.</h1>
      <p>Here's where your ESG engagement stands.</p>
    </div>

    <div class="dash-grid">
      <div>
        <div class="pcard action-panel">
          <div class="pcard-head"><h3>Action Required — ${d.actionRequired.length} items need your attention</h3></div>
          ${d.actionRequired.map((a,i)=>`
            <div class="action-item" onclick="Portal.nav('${a.view}')">
              <span class="num">0${i+1}</span><p>${a.text}</p><span class="arrow">${icon('chevronRight')}</span>
            </div>`).join('')}
        </div>

        <div class="pcard">
          <div class="pcard-head"><h3>Performance Snapshot</h3><span class="see-all" onclick="Portal.nav('reports')">View Reports</span></div>
          <div class="kpi-grid">
            ${d.kpis.map(k=>`
              <div class="kpi-card">
                <div class="kpi-label">${k.label}</div>
                <div class="kpi-value">${k.value}</div>
                <div class="kpi-delta ${k.up?'up':'down'}">${k.up?'↑':'↓'} ${k.delta} vs last period</div>
              </div>`).join('')}
          </div>
        </div>

        <div class="pcard">
          <div class="pcard-head"><h3>Service Status</h3></div>
          <div class="svc-grid">
            ${d.health.byService.map(s=>`
              <div class="svc-status-card" onclick="Portal.nav('service/${s.key}')">
                <span class="swatch">${icon(SERVICE_ICON[s.key])}</span>
                <div><div class="name">${s.name}</div><div class="pct">${s.value}% engagement health</div></div>
              </div>`).join('')}
          </div>
        </div>

        <div class="pcard">
          <div class="pcard-head"><h3>Recent Deliverables</h3></div>
          <ul class="row-list">
            ${d.recentDeliverables.map(item=>`
              <li class="row-item">
                <span class="ricon">${icon('file')}</span>
                <div><p class="rtitle">${item.title}</p><div class="rmeta">${item.service} · ${item.date}</div></div>
                <div class="ractions">${chip(item.status)}</div>
              </li>`).join('')}
          </ul>
        </div>
      </div>

      <div>
        <div class="pcard">
          <div class="pcard-head"><h3>Engagement Health</h3></div>
          <div class="health-hero">
            ${healthRing(d.health.score)}
            <div><div class="health-status-label ${statusCls}">${statusLabel}</div><p style="margin:0; font-size:0.82rem; color:var(--ash);">Weighted across delivery, milestones, responsiveness, approvals, reporting, and strategic progress.</p></div>
          </div>
          ${d.health.byService.map(s=>`
            <div class="health-row">
              <span class="service-name">${s.name}</span>
              <span class="bar-track"><span class="bar-fill" style="width:${s.value}%"></span></span>
              <span class="val">${s.value}%</span>
            </div>`).join('')}
        </div>

        <div class="pcard">
          <div class="pcard-head"><h3>Upcoming</h3><span class="see-all" onclick="Portal.nav('calendar')">Calendar</span></div>
          ${d.calendarEvents.slice(0,4).map(e=>{
            const dt = new Date(e.date+'T00:00:00');
            return `<div class="cal-mini-item">
              <div class="cal-mini-date"><div class="d">${dt.getDate()}</div><div class="m">${dt.toLocaleString('en',{month:'short'})}</div></div>
              <div><p>${e.title}</p><div class="rmeta">${e.type.replace('_',' ')}</div></div>
            </div>`;
          }).join('')}
        </div>

        <div class="pcard">
          <div class="pcard-head"><h3>ESG Resource Vault</h3><span class="see-all" onclick="Portal.nav('vault')">Open Vault</span></div>
          <div class="vault-mini">
            ${d.vault.folders.slice(0,4).map(f=>`
              <div class="vault-mini-folder" onclick="Portal.nav('vault/${f.key}')">
                <span class="fic">${icon('folder')}</span><span>${f.name}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="pcard">
          <div class="pcard-head"><h3>Your Account Manager</h3></div>
          <div class="am-card">
            <span class="am-avatar">${d.accountManager.initials}</span>
            <div>
              <h4>${d.accountManager.name}</h4>
              <div class="role">${d.accountManager.role}</div>
              <p>${d.accountManager.availability}</p>
              <button class="btn btn--brass" style="width:100%; justify-content:center;" onclick="Portal.toast('Prototype only — messaging is not wired up yet.')">Message ESG Team</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------
// SERVICE WORKSPACES
// ---------------------------------------------------------------
function renderServiceWorkspace(key) {
  const s = PORTAL_DATA.services[key];
  if (!s) return `<div class="pempty">Workspace not found.</div>`;
  let body = '';

  if (key === 'brand-strategy') {
    body = `
      <h3 style="margin-bottom:1rem;">Milestones</h3>
      <div class="stepper">
        ${s.milestones.map(m=>`<div class="step ${m.status==='done'?'done':m.status==='current'?'current':''}"><span class="dot">${m.status==='done'?'✓':''}</span><span class="label">${m.label}</span></div>`).join('')}
      </div>
      <h3 style="margin:2rem 0 1rem;">Strategy Documents</h3>
      <ul class="row-list">
        ${s.documents.map(doc=>`<li class="row-item"><span class="ricon">${icon('file')}</span><div><p class="rtitle">${doc.title} <span style="color:var(--ash); font-weight:400;">${doc.version}</span></p><div class="rmeta">${doc.date}</div></div><div class="ractions">${chip(doc.status)}</div></li>`).join('')}
      </ul>`;
  }

  else if (key === 'content') {
    body = `
      <h3 style="margin-bottom:1rem;">Content Calendar</h3>
      ${s.pieces.map(p=>`
        <div class="content-piece">
          <div class="content-piece-head"><h4>${p.title}</h4><span class="chip">${p.type}</span></div>
          <div class="mini-stepper">
            ${s.stages.map((st,i)=>`<span class="mini-step ${i<p.stage?'done':i===p.stage?'current':''}">${st}</span>`).join('')}
          </div>
        </div>`).join('')}`;
  }

  else if (key === 'gbp') {
    body = `
      <h3 style="margin-bottom:1rem;">Local Search Performance</h3>
      <div class="kpi-grid">
        ${s.metrics.map(k=>`<div class="kpi-card"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div><div class="kpi-delta ${k.up?'up':'down'}">${k.up?'↑':'↓'} ${k.delta} vs last period</div></div>`).join('')}
      </div>`;
  }

  else if (key === 'whatsapp') {
    body = `
      <h3 style="margin-bottom:1rem;">Campaigns</h3>
      <table class="ptable">
        <thead><tr><th>Campaign</th><th>Status</th><th>Sent</th><th>Delivered</th><th>Read</th><th>Leads</th></tr></thead>
        <tbody>${s.campaigns.map(c=>`<tr><td>${c.name}</td><td>${chip(c.status)}</td><td>${c.sent.toLocaleString()}</td><td>${c.delivered.toLocaleString()}</td><td>${c.read.toLocaleString()}</td><td>${c.leads}</td></tr>`).join('')}</tbody>
      </table>`;
  }

  else if (key === 'performance') {
    body = `
      <h3 style="margin-bottom:1rem;">Campaigns</h3>
      <table class="ptable">
        <thead><tr><th>Campaign</th><th>Platform</th><th>Budget</th><th>Status</th><th>CPC</th><th>CTR</th><th>Leads</th><th>ROAS</th></tr></thead>
        <tbody>${s.campaigns.map(c=>`<tr><td>${c.name}</td><td>${c.platform}</td><td>${c.budget}</td><td>${chip(c.status)}</td><td>${c.cpc}</td><td>${c.ctr}</td><td>${c.leads}</td><td>${c.roas}</td></tr>`).join('')}</tbody>
      </table>`;
  }

  else if (key === 'research') {
    body = `
      <h3 style="margin-bottom:1rem;">Findings</h3>
      <ul class="row-list">
        ${s.findings.map(f=>`<li class="row-item"><span class="ricon">${icon('search')}</span><div><p class="rtitle">${f.title}</p><div class="rmeta">${f.date}</div><p style="font-size:0.85rem; color:var(--ash); margin:0.4rem 0 0;">${f.summary}</p></div></li>`).join('')}
      </ul>`;
  }

  else if (key === 'founder') {
    body = `
      <h3 style="margin-bottom:1rem;">Founder Content</h3>
      <ul class="row-list">
        ${s.pieces.map(p=>`<li class="row-item"><span class="ricon">${icon('pen')}</span><div><p class="rtitle">${p.title}</p><div class="rmeta">${p.date}</div></div><div class="ractions">${chip(p.status)}</div></li>`).join('')}
      </ul>`;
  }

  return `
  <div class="pview">
    ${crumb(['Service Workspaces', s.name])}
    <div class="pview-head">
      <h1>${s.name}</h1>
      <p>${s.description}</p>
    </div>
    <div class="module-pills">
      ${s.modules.map(m=>`<span class="module-pill">${m}</span>`).join('')}
    </div>
    <div class="pcard">${body}</div>
  </div>`;
}

// ---------------------------------------------------------------
// APPROVALS
// ---------------------------------------------------------------
function renderApprovals() {
  const list = PORTAL_DATA.approvals;
  const pending = list.filter(a => a.status === 'pending');
  const decided = list.filter(a => a.status !== 'pending');
  return `
  <div class="pview">
    ${crumb(['Approvals'])}
    <div class="pview-head"><h1>Approvals</h1><p>Review and act on work submitted by the ESG team. Approved versions are locked and recorded permanently.</p></div>

    <h3 style="margin-bottom:1rem;">Awaiting Your Decision (${pending.length})</h3>
    ${pending.map(a => `
      <div class="approval-card" id="${a.id}">
        <div class="approval-top">
          <div class="approval-preview">${icon('file')}</div>
          <div class="approval-body">
            <h4>${a.title} <span style="color:var(--ash); font-weight:400; font-size:0.85rem;">${a.version}</span></h4>
            <span class="chip">${a.service}</span>
            <div class="approval-meta">
              <span>Submitted by ${a.submittedBy}</span>
              <span>Submitted ${a.submittedDate}</span>
              <span>Review by ${a.deadline}</span>
            </div>
          </div>
        </div>
        <div class="approval-actions">
          <button class="btn btn--solid" onclick="Portal.approve('${a.id}')">Approve</button>
          <button class="btn btn--ghost-warn" onclick="Portal.requestChanges('${a.id}')">Request Changes</button>
        </div>
      </div>`).join('')}

    <h3 style="margin:2rem 0 1rem;">Decided</h3>
    ${decided.map(a => `
      <div class="approval-card">
        <div class="approval-top">
          <div class="approval-preview">${icon('file')}</div>
          <div class="approval-body">
            <h4>${a.title} <span style="color:var(--ash); font-weight:400; font-size:0.85rem;">${a.version}</span></h4>
            <span class="chip">${a.service}</span>
            <div class="approval-meta"><span>Submitted by ${a.submittedBy}</span><span>Submitted ${a.submittedDate}</span></div>
          </div>
          <div>${chip(a.status)}</div>
        </div>
        ${a.status === 'approved' ? `<div class="approval-decided">Approved by ${a.approvedBy} on ${a.approvedDate}</div>` : ''}
      </div>`).join('')}
  </div>`;
}

// ---------------------------------------------------------------
// RESOURCE VAULT
// ---------------------------------------------------------------
function renderVault(folderKey) {
  const v = PORTAL_DATA.vault;
  if (!folderKey) {
    return `
    <div class="pview">
      ${crumb(['ESG Resource Vault'])}
      <div class="pview-head"><h1>ESG Resource Vault</h1><p>Every brand asset, document, and deliverable exchanged during your engagement, organized and securely stored.</p></div>
      <div class="vault-grid">
        ${v.folders.map(f=>`
          <div class="vault-folder" onclick="Portal.nav('vault/${f.key}')">
            <span class="fic">${icon('folder')}</span>
            <h4>${f.name}</h4>
            <div class="count">${f.count} files</div>
          </div>`).join('')}
      </div>
    </div>`;
  }
  const folder = v.folders.find(f => f.key === folderKey);
  const files = v.files[folderKey] || [];
  return `
  <div class="pview">
    ${crumb(['ESG Resource Vault', folder ? folder.name : folderKey])}
    <div class="pview-head"><h1>${folder ? folder.name : folderKey}</h1><p>${files.length} file${files.length===1?'':'s'} in this folder.</p></div>
    <button class="btn" style="margin-bottom:1.4rem;" onclick="Portal.nav('vault')">← All Folders</button>
    <div class="pcard">
      <ul class="row-list">
        ${files.map(f=>`
          <li class="row-item">
            <span class="ricon">${icon(f.name.match(/mp4|mov/i) ? 'fileVideo' : f.name.match(/zip|jpg|png/i) ? 'fileImg' : 'file')}</span>
            <div><p class="rtitle">${f.name}</p><div class="rmeta">${f.size} · Updated ${f.updated}</div></div>
            <div class="ractions"><button class="icon-btn" onclick="Portal.toast('Prototype only — download is not wired up.')">${icon('download')}</button></div>
          </li>`).join('') || '<li class="pempty">No files yet.</li>'}
      </ul>
    </div>
  </div>`;
}

// ---------------------------------------------------------------
// CALENDAR
// ---------------------------------------------------------------
function renderCalendar() {
  const events = PORTAL_DATA.calendarEvents;
  const year = 2026, month = 7; // August 2026 (0-indexed)
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate = 15;
  const byDate = {};
  events.forEach(e => { (byDate[e.date] = byDate[e.date] || []).push(e); });

  let cells = '';
  for (let i = 0; i < startDow; i++) cells += `<div class="cal-cell other-month"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `2026-08-${String(d).padStart(2,'0')}`;
    const dayEvents = byDate[iso] || [];
    cells += `<div class="cal-cell ${d===todayDate?'today':''}">
      <div class="daynum">${d}</div>
      ${dayEvents.map(e=>`<div class="cal-event type-${e.type}" title="${e.title}">${e.title}</div>`).join('')}
    </div>`;
  }

  return `
  <div class="pview">
    ${crumb(['Engagement Calendar'])}
    <div class="pview-head"><h1>Engagement Calendar</h1><p>Meetings, deadlines, shoots, publishing dates, and milestones across your engagement.</p></div>
    <div class="pcard">
      <h3 style="margin-bottom:1rem;">August 2026</h3>
      <div class="cal-grid">
        ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="cal-dow">${d}</div>`).join('')}
        ${cells}
      </div>
      <div class="cal-legend">
        <span class="cal-legend-item"><span class="sw" style="background:#E4EAF0;"></span>Meetings</span>
        <span class="cal-legend-item"><span class="sw" style="background:var(--warn-tint);"></span>Deadlines</span>
        <span class="cal-legend-item"><span class="sw" style="background:var(--success-tint);"></span>Publishing</span>
      </div>
    </div>
    <div class="pcard agenda-list">
      <h3 style="margin-bottom:1rem;">Agenda</h3>
      ${events.map(e=>{
        const dt = new Date(e.date+'T00:00:00');
        return `<div class="cal-mini-item">
          <div class="cal-mini-date"><div class="d">${dt.getDate()}</div><div class="m">${dt.toLocaleString('en',{month:'short'})}</div></div>
          <div><p>${e.title}</p><div class="rmeta">${e.type.replace('_',' ')}</div></div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ---------------------------------------------------------------
// REPORTS
// ---------------------------------------------------------------
function renderReports() {
  const reports = PORTAL_DATA.reports;
  const categories = [...new Set(reports.map(r => r.category))];
  return `
  <div class="pview">
    ${crumb(['Reports & Insights'])}
    <div class="pview-head"><h1>Reports & Insights</h1><p>Every report ESG Officials has prepared for your engagement, organized by category.</p></div>
    ${categories.map(cat => `
      <h3 style="margin:1.6rem 0 1rem;">${cat}</h3>
      <div class="pcard">
        <ul class="row-list">
          ${reports.filter(r=>r.category===cat).map(r=>`
            <li class="row-item">
              <span class="ricon">${icon('reports')}</span>
              <div>
                <p class="rtitle">${r.title}</p>
                <div class="rmeta">${r.period} · Prepared by ${r.preparedBy} · ${r.date}</div>
                <p style="font-size:0.85rem; color:var(--ash); margin:0.4rem 0 0; max-width:60ch;">${r.summary}</p>
              </div>
              <div class="ractions">
                <button class="btn" onclick="Portal.toast('Prototype only — viewer is not wired up.')">View</button>
                <button class="icon-btn" onclick="Portal.toast('Prototype only — download is not wired up.')">${icon('download')}</button>
              </div>
            </li>`).join('')}
        </ul>
      </div>`).join('')}
  </div>`;
}
