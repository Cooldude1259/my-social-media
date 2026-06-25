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
let currentTab = new URLSearchParams(window.location.search).get('tab') || 'reports';
let updateRows = [];
let editingUpdateId = null;
let updateFilter = { bucket: 'all', published: 'all', query: '' };

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
  if (myRole === 'tech') $('tabUpdates').classList.remove('hidden');
  if (myRole === 'tech') $('tabAdmins').classList.remove('hidden');
  openTab(currentTab);
}

// ---- Tabs ----
function showTab(name) {
  const map = { reports: 'tabReports', areas: 'tabAreas', updates: 'tabUpdates', admins: 'tabAdmins', audit: 'tabAudit' };
  const views = { reports: 'viewReports', areas: 'viewAreas', updates: 'viewUpdates', admins: 'viewAdmins', audit: 'viewAudit' };
  Object.values(map).forEach((id) => $(id).classList.remove('active'));
  Object.values(views).forEach((id) => $(id).classList.add('hidden'));
  $(map[name]).classList.add('active');
  $(views[name]).classList.remove('hidden');
}

function openTab(name) {
  const nextTab = name === 'updates' && myRole !== 'tech' ? 'reports' : name;
  currentTab = nextTab;
  showTab(nextTab);
  if (nextTab === 'reports') loadReports();
  if (nextTab === 'areas') loadAreasAdmin();
  if (nextTab === 'updates') loadUpdatesAdmin();
  if (nextTab === 'admins') loadAdmins();
  if (nextTab === 'audit') loadAudit();
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

function updateBucketLabel(bucket) {
  if (bucket === 'known_issue') return 'Known issue';
  return 'Changelog';
}

function updateStatusLabel(status) {
  return String(status || 'draft').replaceAll('_', ' ');
}

function renderUpdateForm(update = null) {
  const bucket = update?.bucket || 'changelog';
  const title = update?.title || '';
  const body = update?.body || '';
  const status = update?.status || 'planned';
  const sortOrder = update?.sort_order ?? 0;
  const published = update?.published !== false;
  editingUpdateId = update?.id ?? null;

  return `
    <div class="glass">
      <h3 style="margin-bottom:8px;">${editingUpdateId ? 'Edit update entry' : 'Create update entry'}</h3>
      <p class="muted" style="font-size:13px;">These rows back the public updates page.</p>
      <div class="find-row">
        <select id="updateBucket" style="min-width:150px;">
          <option value="changelog" ${bucket === 'changelog' ? 'selected' : ''}>Changelog</option>
          <option value="known_issue" ${bucket === 'known_issue' ? 'selected' : ''}>Known issue</option>
        </select>
        <select id="updateStatus" style="min-width:160px;">
          <option value="planned" ${status === 'planned' ? 'selected' : ''}>planned</option>
          <option value="in_progress" ${status === 'in_progress' ? 'selected' : ''}>in_progress</option>
          <option value="fixed" ${status === 'fixed' ? 'selected' : ''}>fixed</option>
          <option value="broken" ${status === 'broken' ? 'selected' : ''}>broken</option>
          <option value="needs_attention" ${status === 'needs_attention' ? 'selected' : ''}>needs_attention</option>
          <option value="note" ${status === 'note' ? 'selected' : ''}>note</option>
        </select>
        <input id="updateSort" type="number" value="${esc(sortOrder)}" placeholder="Sort" style="width:110px;" />
        <label class="muted" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;">
          <input id="updatePublished" type="checkbox" ${published ? 'checked' : ''} /> Published
        </label>
      </div>
      <div style="margin-top:10px;">
        <input id="updateTitle" type="text" value="${esc(title)}" placeholder="Title" style="width:100%;margin-bottom:10px;" />
        <textarea id="updateBody" placeholder="What changed or what is broken?">${esc(body)}</textarea>
      </div>
      <div class="acts">
        <button id="saveUpdateBtn" style="animation:none;">${editingUpdateId ? 'Save changes' : 'Add update'}</button>
        <button id="clearUpdateBtn" class="btn-neutral" style="animation:none;">Clear</button>
      </div>
      <div class="status" id="updateEditorStatus"></div>
    </div>`;
}

function renderUpdateList() {
  const v = $('viewUpdates');
  if (!updateRows.length) {
    v.querySelector('#updateList').innerHTML = '<p class="muted">No update rows yet.</p>';
    return;
  }

  v.querySelector('#updateList').innerHTML = updateRows.map((row) => `
    <div class="updates-item" data-update-id="${row.id}">
      <div class="updates-item-head">
        <div>
          <span class="pill ${row.bucket}">${esc(updateBucketLabel(row.bucket))}</span>
          <span class="pill ${esc(row.status || 'note')}">${esc(updateStatusLabel(row.status))}</span>
        </div>
        <div class="muted" style="font-size:12px;">${row.published ? 'published' : 'draft'} · sort ${esc(row.sort_order ?? 0)}</div>
      </div>
      <div class="updates-item-title">${esc(row.title || 'Untitled')}</div>
      <div class="updates-item-body">${esc(row.body || '')}</div>
      <div class="updates-item-meta">${esc(fmt(row.updated_at || row.created_at))}</div>
      <div class="acts">
        <button class="btn-neutral" data-act="edit-update" data-id="${row.id}" style="animation:none;padding:6px 12px;font-size:13px;">Edit</button>
        <button class="btn-danger" data-act="delete-update" data-id="${row.id}" style="animation:none;padding:6px 12px;font-size:13px;">Delete</button>
      </div>
    </div>
  `).join('');
}

async function loadUpdatesAdmin() {
  const v = $('viewUpdates');
  v.innerHTML = `
    <div class="glass">
      <div class="row">
        <div>
          <h3 style="margin-bottom:6px;">Updates editor</h3>
          <p class="muted" style="font-size:13px;">Manage the public changelog and known issues from Supabase.</p>
        </div>
        <a href="../updates.html"><button class="btn-secondary" style="animation:none;padding:6px 14px;font-size:13px;">Open public page</button></a>
      </div>
      <div class="updates-stats" id="updatesStats"></div>
      <div class="updates-toolbar">
        <input id="updatesSearch" type="text" placeholder="Search title/body…" value="${esc(updateFilter.query)}" />
        <select id="updatesBucketFilter">
          <option value="all" ${updateFilter.bucket === 'all' ? 'selected' : ''}>All buckets</option>
          <option value="changelog" ${updateFilter.bucket === 'changelog' ? 'selected' : ''}>Changelog</option>
          <option value="known_issue" ${updateFilter.bucket === 'known_issue' ? 'selected' : ''}>Known issues</option>
        </select>
        <select id="updatesPublishedFilter">
          <option value="all" ${updateFilter.published === 'all' ? 'selected' : ''}>All states</option>
          <option value="published" ${updateFilter.published === 'published' ? 'selected' : ''}>Published</option>
          <option value="draft" ${updateFilter.published === 'draft' ? 'selected' : ''}>Drafts</option>
        </select>
        <button id="refreshUpdatesBtn" class="btn-secondary" style="animation:none;padding:6px 14px;font-size:13px;">Refresh</button>
      </div>
    </div>
    ${renderUpdateForm()}
    <div class="glass">
      <h3 style="margin-bottom:8px;">Current update rows</h3>
      <div id="updateList"><p class="muted">Loading…</p></div>
    </div>`;

  try {
    const { data, error } = await supabase.from('SiteUpdates')
      .select('id, bucket, title, body, status, sort_order, published, created_at, updated_at')
      .order('sort_order', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) throw error;
    updateRows = data || [];
  } catch (err) {
    updateRows = [];
    v.querySelector('#updateList').innerHTML = `<p class="muted">Could not load updates: ${esc(err.message)}</p>`;
  }

  renderUpdateList();

  const statsBox = v.querySelector('#updatesStats');
  const counts = updateRows.reduce((acc, row) => {
    acc.total += 1;
    acc[row.bucket] = (acc[row.bucket] || 0) + 1;
    if (row.published) acc.published += 1; else acc.draft += 1;
    return acc;
  }, { total: 0, changelog: 0, known_issue: 0, published: 0, draft: 0 });
  statsBox.innerHTML = `
    <span class="updates-stat">Total ${counts.total}</span>
    <span class="updates-stat">Changelog ${counts.changelog}</span>
    <span class="updates-stat">Known issues ${counts.known_issue}</span>
    <span class="updates-stat">Published ${counts.published}</span>
    <span class="updates-stat">Drafts ${counts.draft}</span>`;

  const editor = v.querySelector('.glass:nth-of-type(2)');
  if (editor) {
    const quickRow = document.createElement('div');
    quickRow.className = 'updates-quick-add';
    quickRow.innerHTML = `
      <button data-template="changelog">New changelog</button>
      <button data-template="issue">New known issue</button>
      <button data-template="planned">Quick planned</button>
      <button data-template="broken">Quick broken</button>`;
    editor.querySelector('.acts').before(quickRow);
    quickRow.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', () => startUpdateTemplate(btn.dataset.template)));
  }

  $('saveUpdateBtn').addEventListener('click', saveUpdate);
  $('clearUpdateBtn').addEventListener('click', () => { loadUpdatesAdmin(); });
  $('refreshUpdatesBtn').addEventListener('click', () => loadUpdatesAdmin());
  $('updatesSearch').addEventListener('input', (e) => { updateFilter.query = e.target.value.trim(); applyUpdateFilters(); });
  $('updatesBucketFilter').addEventListener('change', (e) => { updateFilter.bucket = e.target.value; applyUpdateFilters(); });
  $('updatesPublishedFilter').addEventListener('change', (e) => { updateFilter.published = e.target.value; applyUpdateFilters(); });
}

async function saveUpdate() {
  const bucket = $('updateBucket').value;
  const status = $('updateStatus').value;
  const title = $('updateTitle').value.trim();
  const body = $('updateBody').value.trim();
  const sortOrder = Number($('updateSort').value || 0);
  const published = $('updatePublished').checked;
  const statusBox = $('updateEditorStatus');
  if (!title || !body) {
    statusBox.textContent = 'Title and body are required.';
    return;
  }
  statusBox.textContent = editingUpdateId ? 'Saving…' : 'Creating…';
  try {
    const payload = { bucket, status, title, body, sort_order: sortOrder, published };
    const query = editingUpdateId
      ? supabase.from('SiteUpdates').update(payload).eq('id', editingUpdateId)
      : supabase.from('SiteUpdates').insert(payload);
    const { error } = await query;
    if (error) throw error;
    statusBox.textContent = 'Saved.';
    loadUpdatesAdmin();
  } catch (err) {
    statusBox.textContent = 'Failed: ' + err.message;
  }
}

function startUpdateTemplate(template) {
  const defaults = {
    changelog: { bucket: 'changelog', status: 'planned', title: 'New changelog item', body: 'Describe the change here.' },
    issue: { bucket: 'known_issue', status: 'needs_attention', title: 'New known issue', body: 'Describe the problem here.' },
    planned: { bucket: 'changelog', status: 'planned', title: 'Planned change', body: 'Describe what is coming next.' },
    broken: { bucket: 'known_issue', status: 'broken', title: 'Broken feature', body: 'Describe what is failing and why it matters.' },
  };
  const preset = defaults[template] || defaults.changelog;
  editingUpdateId = null;
  $('updateBucket').value = preset.bucket;
  $('updateStatus').value = preset.status;
  $('updateTitle').value = preset.title;
  $('updateBody').value = preset.body;
  $('updateSort').value = String((updateRows[0]?.sort_order ?? 0) + 10);
  $('updatePublished').checked = true;
  $('updateEditorStatus').textContent = 'Template loaded.';
}

async function deleteUpdate(id) {
  if (!confirm('Delete this update row?')) return;
  try {
    const { error } = await supabase.from('SiteUpdates').delete().eq('id', id);
    if (error) throw error;
    loadUpdatesAdmin();
  } catch (err) {
    alert('Failed: ' + err.message);
  }
}

async function duplicateUpdate(id) {
  const row = updateRows.find((item) => String(item.id) === String(id));
  if (!row) return;
  const payload = {
    bucket: row.bucket,
    status: row.status,
    title: `${row.title || 'Untitled'} (copy)`,
    body: row.body,
    sort_order: (row.sort_order ?? 0) + 1,
    published: false,
  };
  try {
    const { error } = await supabase.from('SiteUpdates').insert(payload);
    if (error) throw error;
    loadUpdatesAdmin();
  } catch (err) {
    alert('Failed: ' + err.message);
  }
}

async function toggleUpdatePublished(id, nextPublished) {
  try {
    const { error } = await supabase.from('SiteUpdates').update({ published: nextPublished }).eq('id', id);
    if (error) throw error;
    loadUpdatesAdmin();
  } catch (err) {
    alert('Failed: ' + err.message);
  }
}

async function nudgeUpdateSort(id, delta) {
  const row = updateRows.find((item) => String(item.id) === String(id));
  if (!row) return;
  try {
    const { error } = await supabase.from('SiteUpdates')
      .update({ sort_order: (row.sort_order ?? 0) + delta })
      .eq('id', id);
    if (error) throw error;
    loadUpdatesAdmin();
  } catch (err) {
    alert('Failed: ' + err.message);
  }
}

function applyUpdateFilters() {
  const v = $('viewUpdates');
  const list = v.querySelector('#updateList');
  if (!list) return;
  const query = updateFilter.query.toLowerCase();
  const rows = updateRows.filter((row) => {
    const matchesBucket = updateFilter.bucket === 'all' || row.bucket === updateFilter.bucket;
    const matchesPublished = updateFilter.published === 'all'
      || (updateFilter.published === 'published' && row.published)
      || (updateFilter.published === 'draft' && !row.published);
    const text = `${row.title || ''} ${row.body || ''} ${row.status || ''}`.toLowerCase();
    const matchesQuery = !query || text.includes(query);
    return matchesBucket && matchesPublished && matchesQuery;
  });
  list.innerHTML = rows.length ? rows.map((row) => `
    <div class="updates-item" data-update-id="${row.id}">
      <div class="updates-item-head">
        <div>
          <span class="pill ${row.bucket}">${esc(updateBucketLabel(row.bucket))}</span>
          <span class="pill ${esc(row.status || 'note')}">${esc(updateStatusLabel(row.status))}</span>
        </div>
        <div class="muted" style="font-size:12px;">${row.published ? 'published' : 'draft'} · sort ${esc(row.sort_order ?? 0)}</div>
      </div>
      <div class="updates-item-title">${esc(row.title || 'Untitled')}</div>
      <div class="updates-item-body">${esc(row.body || '')}</div>
      <div class="updates-item-meta">${esc(fmt(row.updated_at || row.created_at))}</div>
      <div class="updates-item-actions">
        <button class="btn-neutral" data-act="edit-update" data-id="${row.id}" style="animation:none;padding:6px 12px;font-size:13px;">Edit</button>
        <button class="btn-neutral" data-act="duplicate-update" data-id="${row.id}" style="animation:none;padding:6px 12px;font-size:13px;">Duplicate</button>
        <button class="btn-neutral" data-act="toggle-update" data-id="${row.id}" data-published="${row.published ? '0' : '1'}" style="animation:none;padding:6px 12px;font-size:13px;">${row.published ? 'Unpublish' : 'Publish'}</button>
        <button class="btn-neutral" data-act="sort-update" data-id="${row.id}" data-delta="10" style="animation:none;padding:6px 12px;font-size:13px;">▲</button>
        <button class="btn-neutral" data-act="sort-update" data-id="${row.id}" data-delta="-10" style="animation:none;padding:6px 12px;font-size:13px;">▼</button>
        <button class="btn-danger" data-act="delete-update" data-id="${row.id}" style="animation:none;padding:6px 12px;font-size:13px;">Delete</button>
      </div>
    </div>
  `).join('') : '<p class="muted">No rows match the current filters.</p>';
}

function editUpdate(id) {
  const row = updateRows.find((item) => String(item.id) === String(id));
  if (!row) return;
  const formHost = $('updateEditorStatus')?.closest('.glass');
  if (!formHost) return;
  formHost.outerHTML = renderUpdateForm(row);
  $('saveUpdateBtn').addEventListener('click', saveUpdate);
  $('clearUpdateBtn').addEventListener('click', () => { loadUpdatesAdmin(); });
  $('updatesSearch').addEventListener('input', (e) => { updateFilter.query = e.target.value.trim(); applyUpdateFilters(); });
  $('updatesBucketFilter').addEventListener('change', (e) => { updateFilter.bucket = e.target.value; applyUpdateFilters(); });
  $('updatesPublishedFilter').addEventListener('change', (e) => { updateFilter.published = e.target.value; applyUpdateFilters(); });
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
$('tabReports').addEventListener('click', () => openTab('reports'));
$('tabAreas').addEventListener('click', () => openTab('areas'));
$('tabUpdates').addEventListener('click', () => openTab('updates'));
$('tabAdmins').addEventListener('click', () => openTab('admins'));
$('tabAudit').addEventListener('click', () => openTab('audit'));

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
  if (act === 'edit-update') return editUpdate(el.dataset.id);
  if (act === 'duplicate-update') return duplicateUpdate(el.dataset.id);
  if (act === 'toggle-update') return toggleUpdatePublished(el.dataset.id, el.dataset.published === '1');
  if (act === 'sort-update') return nudgeUpdateSort(el.dataset.id, Number(el.dataset.delta || 0));
  if (act === 'delete-update') return deleteUpdate(el.dataset.id);
});
document.addEventListener('click', (e) => {
  if (e.target.id === 'findBtn') findUsers();
  if (e.target.id === 'createAreaBtn') createArea();
});

supabase.auth.onAuthStateChange((_e, session) => { if (session && !myRole) init(); });
init();
