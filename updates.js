import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://bmfbnydcanksjwquljzb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qa7veCIyFBL1_BYNFOCsXQ_cfHGKyh0';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: 'social-media-public' },
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
});

const NATIVE_AUTH = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeAuth);
const $ = (id) => document.getElementById(id);

const defaults = {
  changelog: [
    {
      id: 'draft-changelog-1',
      bucket: 'changelog',
      title: 'Creating a proper updates page',
      body: 'Giving the project a single place to record what is changing, what still feels rough, and what should be addressed next.',
      status: 'in_progress',
      sort_order: 100,
      published: true,
      updated_at: null,
    },
    {
      id: 'draft-changelog-2',
      bucket: 'changelog',
      title: 'Cleaning up the interface language',
      body: 'The redesign is trying to make the app look intentional instead of experimental.',
      status: 'planned',
      sort_order: 90,
      published: true,
      updated_at: null,
    },
    {
      id: 'draft-changelog-3',
      bucket: 'changelog',
      title: 'Making the app easier to understand',
      body: 'Clarifying the main interactions so the site behaves like a product instead of a collection of demos.',
      status: 'planned',
      sort_order: 80,
      published: true,
      updated_at: null,
    },
  ],
  known_issue: [
    {
      id: 'draft-issue-1',
      bucket: 'known_issue',
      title: 'Some screens still feel like the old layout',
      body: 'Parts of the project will continue to look inconsistent until the rest of the pages are brought up to the same visual standard.',
      status: 'needs_attention',
      sort_order: 100,
      published: true,
      updated_at: null,
    },
    {
      id: 'draft-issue-2',
      bucket: 'known_issue',
      title: 'Legacy copy and labels are still being cleaned up',
      body: 'The wording across the app is still being normalized, so some areas may be overly rough, repetitive, or unclear for now.',
      status: 'needs_attention',
      sort_order: 90,
      published: true,
      updated_at: null,
    },
    {
      id: 'draft-issue-3',
      bucket: 'known_issue',
      title: 'Feature states may still be incomplete',
      body: 'Some interactions are present, but the error handling, empty states, or edge-case handling around them may still be unfinished.',
      status: 'broken',
      sort_order: 80,
      published: true,
      updated_at: null,
    },
  ],
};

const state = {
  tech: false,
  loaded: false,
  changelog: defaults.changelog,
  knownIssue: defaults.known_issue,
  fallbackUsed: { changelog: true, knownIssue: true },
};

const esc = (s) => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const fmtTime = (ts) => {
  if (!ts) return 'Draft entry';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? 'Draft entry' : d.toLocaleString();
};

const label = (value) => String(value || 'note').replaceAll('_', ' ');

function renderManageLink() {
  if (state.tech) $('manageUpdatesLink').classList.remove('hidden');
}

function renderNotice() {
  const note = $('updatesNotice');
  if (state.fallbackUsed.changelog || state.fallbackUsed.knownIssue) {
    note.textContent = 'Draft entries are currently being shown because no published Supabase rows were available for one or more sections.';
    note.classList.remove('hidden');
  } else {
    note.classList.add('hidden');
  }
}

function renderTimeline(entries) {
  const host = document.querySelector('#timeline .card.full');
  if (!host) return;
  host.innerHTML = entries.length
    ? entries.map((entry) => `
      <div class="timeline-item">
        <div class="timeline-date">${esc(fmtTime(entry.updated_at || entry.created_at))}</div>
        <div>
          <span class="status-badge">${esc(label(entry.status))}</span>
          <h3>${esc(entry.title || 'Untitled')}</h3>
          <p>${esc(entry.body || '')}</p>
        </div>
      </div>
    `).join('')
    : '<p class="empty">No changelog entries yet.</p>';
}

function renderKnownIssues(entries) {
  const host = document.querySelector('#known-issues .grid');
  if (!host) return;
  host.innerHTML = entries.length
    ? entries.map((entry) => `
      <article class="card">
        <span class="issue-badge">${esc(label(entry.status || 'needs_attention'))}</span>
        <h3>${esc(entry.title || 'Untitled')}</h3>
        <p>${esc(entry.body || '')}</p>
        <div class="footer-note" style="margin-top:14px;">
          Updated: ${esc(fmtTime(entry.updated_at || entry.created_at))}
        </div>
      </article>
    `).join('')
    : '<article class="card full"><p class="empty">No known issues are tracked yet.</p></article>';
}

async function loadBucket(bucket) {
  try {
    const { data, error } = await supabase.from('SiteUpdates')
      .select('id, bucket, title, body, status, sort_order, published, created_at, updated_at')
      .eq('bucket', bucket)
      .eq('published', true)
      .order('sort_order', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) throw error;
    const rows = data || [];
    if (rows.length === 0) {
      state.fallbackUsed[bucket === 'known_issue' ? 'knownIssue' : 'changelog'] = true;
      return defaults[bucket];
    }
    state.fallbackUsed[bucket === 'known_issue' ? 'knownIssue' : 'changelog'] = false;
    return rows;
  } catch (err) {
    console.error(err);
    state.fallbackUsed[bucket === 'known_issue' ? 'knownIssue' : 'changelog'] = true;
    return defaults[bucket];
  }
}

async function checkAdminRole() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data, error } = await supabase.rpc('admin_role');
    if (error) return;
    state.tech = data === 'tech';
  } catch (err) {
    console.error(err);
  }
}

async function init() {
  await checkAdminRole();
  renderManageLink();
  state.changelog = await loadBucket('changelog');
  state.knownIssue = await loadBucket('known_issue');
  renderTimeline(state.changelog);
  renderKnownIssues(state.knownIssue);
  renderNotice();
  state.loaded = true;
}

window.onNativeAuth = async (accessToken, refreshToken) => {
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) console.error(error);
  await init();
};

if (NATIVE_AUTH) {
  window.webkit.messageHandlers.nativeAuth?.postMessage({ action: 'getSession' });
}

init();