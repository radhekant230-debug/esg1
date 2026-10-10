// ESG ClientOS — app shell (routing, sidebar, topbar)
const Portal = (() => {

  const SIDEBAR_ITEMS = [
    { route: 'dashboard', label: 'Dashboard', icon: 'home' },
  ];
  const SERVICE_ORDER = ['brand-strategy','content','gbp','whatsapp','performance','research','founder'];

  function sidebarMarkup(activeRoute) {
    const svcItems = SERVICE_ORDER.map(key => {
      const s = PORTAL_DATA.services[key];
      const route = `service/${key}`;
      return `<li class="psidebar-item ${activeRoute===route?'is-active':''}" onclick="Portal.nav('${route}')">${icon(SERVICE_ICON[key])}<span>${s.name}</span></li>`;
    }).join('');

    const pendingCount = PORTAL_DATA.approvals.filter(a => a.status === 'pending').length;

    return `
      <div class="psidebar-section">
        <ul class="psidebar-nav">
          <li class="psidebar-item ${activeRoute==='dashboard'?'is-active':''}" onclick="Portal.nav('dashboard')">${icon('home')}<span>Dashboard</span></li>
        </ul>
      </div>
      <div class="psidebar-section">
        <div class="psidebar-label">Service Workspaces</div>
        <ul class="psidebar-nav">${svcItems}</ul>
      </div>
      <div class="psidebar-section">
        <div class="psidebar-label">Engagement</div>
        <ul class="psidebar-nav">
          <li class="psidebar-item ${activeRoute==='approvals'?'is-active':''}" onclick="Portal.nav('approvals')">${icon('check')}<span>Approvals</span>${pendingCount?`<span class="count">${pendingCount}</span>`:''}</li>
          <li class="psidebar-item ${activeRoute.startsWith('vault')?'is-active':''}" onclick="Portal.nav('vault')">${icon('vault')}<span>Resource Vault</span></li>
          <li class="psidebar-item ${activeRoute==='calendar'?'is-active':''}" onclick="Portal.nav('calendar')">${icon('calendar')}<span>Calendar</span></li>
          <li class="psidebar-item ${activeRoute==='reports'?'is-active':''}" onclick="Portal.nav('reports')">${icon('reports')}<span>Reports & Insights</span></li>
        </ul>
      </div>`;
  }

  function renderRoute(route) {
    let html = '';
    if (route === 'dashboard' || route === '') html = renderDashboard();
    else if (route.startsWith('service/')) html = renderServiceWorkspace(route.split('/')[1]);
    else if (route === 'approvals') html = renderApprovals();
    else if (route === 'vault') html = renderVault();
    else if (route.startsWith('vault/')) html = renderVault(route.split('/')[1]);
    else if (route === 'calendar') html = renderCalendar();
    else if (route === 'reports') html = renderReports();
    else html = `<div class="pempty">View not found.</div>`;

    document.getElementById('view-root').innerHTML = html;
    document.getElementById('sidebar-nav').innerHTML = sidebarMarkup(route);
    document.getElementById('pmain').scrollTop = 0;
    closeAllDropdowns();
    document.getElementById('psidebar').classList.remove('is-open');
  }

  function nav(route) {
    window.location.hash = route;
  }

  function onHashChange() {
    const route = window.location.hash.replace('#/', '').replace('#', '') || 'dashboard';
    renderRoute(route);
  }

  function toggleSidebar() {
    document.getElementById('psidebar').classList.toggle('is-open');
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.pdropdown').forEach(d => d.classList.remove('is-open'));
  }

  function toggleDropdown(name) {
    const el = document.getElementById('dd-' + name);
    const wasOpen = el.classList.contains('is-open');
    closeAllDropdowns();
    if (!wasOpen) el.classList.add('is-open');
  }

  function approve(id) {
    const a = PORTAL_DATA.approvals.find(x => x.id === id);
    if (!a) return;
    a.status = 'approved';
    const now = new Date();
    a.approvedBy = PORTAL_DATA.user.name;
    a.approvedDate = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    toast(`"${a.title}" approved and locked as ${a.version}.`);
    renderRoute('approvals');
  }

  function requestChanges(id) {
    const a = PORTAL_DATA.approvals.find(x => x.id === id);
    if (!a) return;
    const parts = a.version.replace('V','').split('.');
    a.version = `V${parts[0]}.${Number(parts[1] || 0) + 1}`;
    a.status = 'pending';
    toast(`Changes requested on "${a.title}". ESG will resubmit as ${a.version}.`);
    renderRoute('approvals');
  }

  function toast(message) {
    let t = document.getElementById('portal-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'portal-toast';
      t.style.cssText = 'position:fixed; bottom:24px; left:50%; transform:translateX(-50%) translateY(20px); background:var(--ink); color:var(--paper); padding:0.85rem 1.4rem; border-radius:6px; font-family:var(--font-body); font-size:0.88rem; z-index:1000; opacity:0; transition:opacity .25s ease, transform .25s ease; max-width:420px; text-align:center; box-shadow:0 20px 40px -16px rgba(0,0,0,0.4);';
      document.body.appendChild(t);
    }
    t.textContent = message;
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(20px)'; }, 3200);
  }

  function signOut() {
    window.location.href = 'login.html';
  }

  function init() {
    // topbar
    document.getElementById('topbar-client').textContent = PORTAL_DATA.client.name;
    document.getElementById('topbar-engagement').textContent = PORTAL_DATA.client.engagement;
    document.getElementById('profile-chip').textContent = PORTAL_DATA.user.initials;

    const [label, cls] = healthStatusMeta(PORTAL_DATA.health.status);
    const badge = document.getElementById('health-badge');
    badge.classList.add('status-' + cls || '');
    badge.innerHTML = `<span class="dot"></span><span class="score">${PORTAL_DATA.health.score}%</span><span class="label">${label}</span>`;
    badge.onclick = () => nav('dashboard');

    // notifications
    const notifBtn = document.getElementById('notif-btn');
    const unread = PORTAL_DATA.notifications.length;
    notifBtn.innerHTML = `${icon('bell')}${unread ? `<span class="badge">${unread}</span>` : ''}`;
    document.getElementById('dd-notif').innerHTML = `
      <div class="pdropdown-head">Notifications</div>
      <div class="pdropdown-list">
        ${PORTAL_DATA.notifications.map(n => `<div class="pdropdown-item"><span class="dot"></span><div><p>${n.text}</p><div class="meta">${n.meta}</div></div></div>`).join('')}
      </div>
      <div class="pdropdown-foot"><button onclick="Portal.toast('That\\'s every notification for now.')">Mark all as read</button></div>`;

    // profile
    document.getElementById('dd-profile').innerHTML = `
      <div class="profile-panel-name"><strong>${PORTAL_DATA.user.name}</strong><span>${PORTAL_DATA.user.role} · ${PORTAL_DATA.client.name}</span></div>
      <div class="profile-panel-link" onclick="Portal.toast('Prototype only — settings are not wired up.')">Account Settings</div>
      <div class="profile-panel-link" onclick="Portal.toast('Prototype only — user management is not wired up.')">Manage Users</div>
      <div class="profile-panel-link" onclick="Portal.signOut()">Sign Out</div>`;

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.ptopbar-right')) closeAllDropdowns();
    });

    window.addEventListener('hashchange', onHashChange);
    onHashChange();
  }

  return { nav, approve, requestChanges, toast, toggleSidebar, toggleDropdown, signOut, init };
})();

document.addEventListener('DOMContentLoaded', Portal.init);
