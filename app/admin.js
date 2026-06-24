import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://bmfbnydcanksjwquljzb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qa7veCIyFBL1_BYNFOCsXQ_cfHGKyh0';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: 'social-media-public' },
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
});

const NATIVE_AUTH = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeAuth);
const $ = (id) => document.getElementById(id);

let myRole = null;
let myName = '';

const esc = (s) => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const fmt = (ts) => { if (!ts) return ''; const d = new Date(ts); return isNaN(d) ? '' : d.toLocaleString(); };

// ---- Auth ----
window.onNativeAuth = async (a, r) => { const { error } = await supabase.auth.setSession({ access_token: a, refresh_token: r }); if (error) console.error(error); };
async function signIn() {
  if (NATIVE_AUTH) { window.webkit.messageHandlers.nativeAuth.postMessage({ action: 'signIn' }); return; }
  const redirectTo = window.location.href.split('#')[0].split('?')[0];
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) console.error(error);
}
async function signOut() { await supabase.auth.signOut(); location.reload(); }

// Best-effort mirror of new audit rows to Axiom (never blocks the action).
function shipAudit() { supabase.functions.invoke('ship-audit').catch(() => {}); }

// ---- Gate ----
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    $('gateMsg').textContent = 'Admin access only. Please sign in.';
    $('gateActions').classList.remove('hidden');
    return;
  }
  myName = session.user.user_metadata?.full_name || session.user.email || 'Admin';
  const { data, error } = await supabase.rpc('admin_role');
  if (error) { $('gateMsg').textContent = 'Could not verify access.'; return; }
  myRole = data;
  if (!myRole) {
    $('gateMsg').textContent = 'This account is not an administrator.';
    $('gateActions').classList.remove('hidden'); // allow switching account
    return;
  }
  openConsole();
}

function openConsole() {
  $('gate').classList.add('hidden');
  $('console').classList.remove('hidden');
  $('meName').textContent = myName;
  $('meRole').textContent = myRole;
  if (myRole === 'tech') $('tabAdmins').classList.remove('hidden');
  showTab('reports');
  loadReports();
}

// ---- Tabs ----
function showTab(name) {
  const map = { reports: 'tabReports', areas: 'tabAreas', admins: 'tabAdmins', audit: 'tabAudit' };
  const views = { reports: 'viewReports', areas: 'viewAreas', admins: 'viewAdmins', audit: 'viewAudit' };
  Object.values(map).forEach((id) => $(id).classList.remove('active'));
  Object.values(views).forEach((id) => $(id).classList.add('hidden'));
  $(map[name]).classList.add('active');
  $(views[name]).classList.remove('hidden');
}

// ---- Reports queue ----
async function loadReports() {
  const v = $('viewReports');
  v.innerHTML = '<div class="glass"><p class="muted">Loading reports…</p></div>';
  const { data, error } = await supabase.rpc('admin_get_reports', { p_status: 'pending', p_limit: 100 });
  if (error) { v.innerHTML = `<div class="glass"><p class="muted">${esc(error.message)}</p></div>`; return; }
  if (!data || data.length === 0) { v.innerHTML = '<div class="glass"><p class="muted">No open reports. 🎉</p></div>'; return; }
  v.innerHTML = data.map((r) => `
    <div class="glass" data-report="${r.report_id}">
      <div class="row">
        <span class="pill ${r.kind}">${r.kind}</span>
        <span class="muted" style="font-size:12px;">reported by ${esc(r.reporter_name || 'someone')} · ${esc(fmt(r.created_at))}</span>
      </div>
      ${r.target_title ? `<div style="font-weight:700;margin-top:8px;">${esc(r.target_title)}</div>` : ''}
      <div class="target">${r.target_content != null ? esc(r.target_content) : '<span class="muted">[content already gone]</span>'}</div>
      <div class="muted" style="font-size:12px;">by ${esc(r.author_name || 'unknown')} · status: <span class="pill ${r.target_status}">${esc(r.target_status || '—')}</span></div>
      <div style="margin-top:8px;"><b>Reason:</b> ${esc(r.reason || '—')}</div>
      <div class="acts">
        <button class="btn-danger" data-act="remove" data-id="${r.report_id}">Remove content</button>
        <button class="btn-neutral" data-act="dismiss" data-id="${r.report_id}">Dismiss</button>
        <button class="btn-neutral" data-act="reviewed" data-id="${r.report_id}">Mark reviewed</button>
      </div>
    </div>`).join('');
}

async function resolveReport(id, decision) {
  const card = document.querySelector(`[data-report="${id}"]`);
  try {
    const { error } = await supabase.rpc('admin_resolve_report', { p_report_id: Number(id), p_decision: decision });
    if (error) throw error;
    shipAudit();
    if (card) card.remove();
    if (!document.querySelector('[data-report]')) loadReports();
  } catch (e) { alert('Action failed: ' + e.message); }
}

// ---- Admins (tech only) ----
async function loadAdmins() {
  const v = $('viewAdmins');
  v.innerHTML = '<div class="glass"><p class="muted">Loading…</p></div>';
  const { data, error } = await supabase.rpc('admin_list_admins');
  if (error) { v.innerHTML = `<div class="glass"><p class="muted">${esc(error.message)}</p></div>`; return; }
  const list = (data || []).map((a) => `
    <div class="admin-row">
      <div>
        <div><b>${esc(a.name || a.email || a.user_id)}</b> <span class="role-badge">${esc(a.role)}</span></div>
        <div class="muted" style="font-size:12px;">${esc(a.email || '')}</div>
      </div>
      ${a.user_id === undefined ? '' : `<button class="btn-danger" data-act="remove-admin" data-uid="${esc(a.user_id)}" style="animation:none;padding:6px 12px;font-size:13px;">Remove</button>`}
    </div>`).join('');
  v.innerHTML = `
    <div class="glass">
      <h3 style="margin-bottom:8px;">Admin team</h3>
      ${list || '<p class="muted">No admins.</p>'}
    </div>
    <div class="glass">
      <h3 style="margin-bottom:8px;">Add an admin</h3>
      <p class="muted" style="font-size:13px;">Find a signed-up user by email, then choose their role.</p>
      <div class="find-row">
        <input id="findEmail" type="text" placeholder="email contains…" style="flex:1;min-width:160px;" />
        <button id="findBtn" style="animation:none;">Search</button>
      </div>
      <div id="findResults"></div>
      <div class="status" id="adminStatus"></div>
    </div>`;
}

async function findUsers() {
  const q = $('findEmail').value.trim();
  const box = $('findResults');
  if (!q) return;
  box.innerHTML = '<p class="muted">Searching…</p>';
  const { data, error } = await supabase.rpc('admin_find_user', { p_query: q });
  if (error) { box.innerHTML = `<p class="muted">${esc(error.message)}</p>`; return; }
  if (!data || data.length === 0) { box.innerHTML = '<p class="muted">No matches.</p>'; return; }
  box.innerHTML = data.map((u) => `
    <div class="admin-row">
      <div><b>${esc(u.name || '—')}</b><div class="muted" style="font-size:12px;">${esc(u.email)}</div></div>
      <div class="find-row">
        <select data-uid="${esc(u.user_id)}" class="role-sel">
          <option value="teacher">teacher</option>
          <option value="wellbeing">wellbeing</option>
          <option value="tech">tech</option>
        </select>
        <button data-act="add-admin" data-uid="${esc(u.user_id)}" style="animation:none;">Add</button>
      </div>
    </div>`).join('');
}

async function addAdmin(uid) {
  const sel = document.querySelector(`select.role-sel[data-uid="${uid}"]`);
  const role = sel ? sel.value : 'teacher';
  try {
    const { error } = await supabase.rpc('admin_add', { p_user_id: uid, p_role: role });
    if (error) throw error;
    shipAudit();
    $('adminStatus').textContent = 'Admin added.';
    loadAdmins();
  } catch (e) { $('adminStatus').textContent = 'Failed: ' + e.message; }
}

async function removeAdmin(uid) {
  if (!confirm('Remove this admin?')) return;
  try {
    const { error } = await supabase.rpc('admin_remove', { p_user_id: uid });
    if (error) throw error;
    shipAudit();
    loadAdmins();
  } catch (e) { alert('Failed: ' + e.message); }
}

// ---- Audit log ----
async function loadAudit() {
  const v = $('viewAudit');
  v.innerHTML = '<div class="glass"><p class="muted">Loading…</p></div>';
  const { data, error } = await supabase.rpc('admin_get_audit', { p_limit: 200 });
  if (error) { v.innerHTML = `<div class="glass"><p class="muted">${esc(error.message)}</p></div>`; return; }
  if (!data || data.length === 0) { v.innerHTML = '<div class="glass"><p class="muted">No admin actions logged yet.</p></div>'; return; }
  v.innerHTML = `<div class="glass">${data.map((a) => `
    <div class="audit-item">
      <span class="a-act">${esc(a.action)}</span>
      <span class="muted">${a.target_kind ? esc(a.target_kind) + ' ' + esc(a.target_id || '') : ''}</span>
      ${a.details ? `<span class="muted">${esc(JSON.stringify(a.details))}</span>` : ''}
      <div class="a-meta">${esc(a.actor_name || '?')} (${esc(a.actor_role || '')}) · ${esc(fmt(a.ts))} · #${a.id}</div>
    </div>`).join('')}</div>
    <p class="muted" style="font-size:12px;text-align:center;">Append-only & hash-chained. Mirrored to Axiom.</p>`;
}

// ---- Areas ----
async function loadAreasAdmin() {
  const v = $('viewAreas');
  v.innerHTML = '<div class="glass"><p class="muted">Loading…</p></div>';
  const [areasRes, suggestionsRes] = await Promise.all([
    supabase.from('Areas').select('id, name, emoji').order('name'),
    supabase.from('AreaSuggestions').select('id, name, reason, created_at').eq('status', 'pending').order('created_at', { ascending: false }),
  ]);
  const areas = areasRes.data || [];
  const suggestions = suggestionsRes.data || [];

  const areasList = areas.length
    ? areas.map((a) => `
        <div class="admin-row">
          <div><b>${a.emoji ? esc(a.emoji) + ' ' : ''}${esc(a.name)}</b></div>
          <button class="btn-danger" data-act="delete-area" data-area-id="${a.id}" style="animation:none;padding:5px 12px;font-size:13px;">Delete</button>
        </div>`).join('')
    : '<p class="muted">No areas yet.</p>';

  const suggestionsList = suggestions.length
    ? suggestions.map((s) => `
        <div class="glass" style="margin-bottom:10px;">
          <div><b>${esc(s.name)}</b> <span class="muted" style="font-size:12px;">· ${esc(fmt(s.created_at))}</span></div>
          ${s.reason ? `<p style="color:rgba(255,255,255,0.6);font-size:13px;margin:6px 0;">${esc(s.reason)}</p>` : ''}
          <div class="acts">
            <button class="btn-neutral" data-act="approve-suggestion" data-id="${s.id}" data-name="${esc(s.name)}">✅ Create area</button>
            <button class="btn-danger" data-act="reject-suggestion" data-id="${s.id}">Reject</button>
          </div>
        </div>`).join('')
    : '<p class="muted">No pending suggestions.</p>';

  v.innerHTML = `
    <div class="glass">
      <h3 style="margin-bottom:12px;">Current Areas</h3>
      ${areasList}
      <h3 style="margin:18px 0 8px;">Add Area Directly</h3>
      <div class="find-row">
        <input id="newAreaEmoji" type="text" placeholder="Emoji" style="width:72px;" maxlength="4" />
        <input id="newAreaName" type="text" placeholder="Area name" style="flex:1;min-width:120px;" maxlength="50" />
        <button id="createAreaBtn" style="animation:none;">Add</button>
      </div>
      <div class="status" id="areaStatus"></div>
    </div>
    <div class="glass">
      <h3 style="margin-bottom:12px;">Pending Suggestions</h3>
      ${suggestionsList}
    </div>`;
}

async function createArea() {
  const name = $('newAreaName').value.trim();
  const emoji = $('newAreaEmoji').value.trim();
  if (!name) { $('areaStatus').textContent = 'Name required.'; return; }
  try {
    const { error } = await supabase.from('Areas').insert({ name, emoji: emoji || null });
    if (error) throw error;
    $('areaStatus').textContent = 'Area created!';
    loadAreasAdmin();
  } catch (e) { $('areaStatus').textContent = 'Failed: ' + e.message; }
}

async function deleteArea(areaId) {
  if (!confirm('Delete this area? Posts in it will become unassigned.')) return;
  try {
    const { error } = await supabase.from('Areas').delete().eq('id', areaId);
    if (error) throw error;
    loadAreasAdmin();
  } catch (e) { alert('Failed: ' + e.message); }
}

async function approveAreaSuggestion(id, name) {
  try {
    const [areaRes, updateRes] = await Promise.all([
      supabase.from('Areas').insert({ name }),
      supabase.from('AreaSuggestions').update({ status: 'approved' }).eq('id', id),
    ]);
    if (areaRes.error) throw areaRes.error;
    if (updateRes.error) throw updateRes.error;
    loadAreasAdmin();
  } catch (e) { alert('Failed: ' + e.message); }
}

async function rejectAreaSuggestion(id) {
  try {
    const { error } = await supabase.from('AreaSuggestions').update({ status: 'rejected' }).eq('id', id);
    if (error) throw error;
    loadAreasAdmin();
  } catch (e) { alert('Failed: ' + e.message); }
}

// ---- Wiring ----
$('signInBtn').addEventListener('click', signIn);
$('signOutBtn').addEventListener('click', signOut);
$('tabReports').addEventListener('click', () => { showTab('reports'); loadReports(); });
$('tabAreas').addEventListener('click', () => { showTab('areas'); loadAreasAdmin(); });
$('tabAdmins').addEventListener('click', () => { showTab('admins'); loadAdmins(); });
$('tabAudit').addEventListener('click', () => { showTab('audit'); loadAudit(); });

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'remove') return resolveReport(el.dataset.id, 'remove');
  if (act === 'dismiss') return resolveReport(el.dataset.id, 'dismiss');
  if (act === 'reviewed') return resolveReport(el.dataset.id, 'reviewed');
  if (act === 'add-admin') return addAdmin(el.dataset.uid);
  if (act === 'remove-admin') return removeAdmin(el.dataset.uid);
  if (act === 'delete-area') return deleteArea(el.dataset.areaId);
  if (act === 'approve-suggestion') return approveAreaSuggestion(el.dataset.id, el.dataset.name);
  if (act === 'reject-suggestion') return rejectAreaSuggestion(el.dataset.id);
});
document.addEventListener('click', (e) => {
  if (e.target.id === 'findBtn') findUsers();
  if (e.target.id === 'createAreaBtn') createArea();
});

supabase.auth.onAuthStateChange((_e, session) => { if (session && !myRole) init(); });
init();
