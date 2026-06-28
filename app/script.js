  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

  const SUPABASE_URL = 'https://bmfbnydcanksjwquljzb.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qa7veCIyFBL1_BYNFOCsXQ_cfHGKyh0';

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    db: { schema: 'social-media-public' },
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
  });

  const NATIVE_AUTH = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeAuth);
  const $ = (id) => document.getElementById(id);

  // Area color map (design tokens)
  const AREA_COLORS = {
    'school news': '#2f6bff', 'news': '#2f6bff',
    'sports': '#18a957',
    'clubs': '#7c5cfc',
    'events': '#ff6b57',
    'help & homework': '#f5a524', 'help': '#f5a524', 'homework': '#f5a524',
    'random': '#11b5b0',
  };
  const AREA_BLURBS = {
    'school news': 'Never miss what\'s happening', 'news': 'Never miss what\'s happening',
    'sports': 'Cheer the teams on',
    'clubs': 'Find your people',
    'events': 'See what\'s coming up',
    'help & homework': 'Ask anything — we\'ve got you', 'help': 'Ask anything — we\'ve got you',
    'random': 'Hang out and be yourself',
  };
  const AREA_EMOJIS = {
    'school news': '📰', 'news': '📰',
    'sports': '🏀', 'clubs': '🎭', 'events': '🎉',
    'help & homework': '📚', 'help': '📚', 'random': '💬',
  };
  // ---- Theming ----
  // applyTheme/setActiveStyle/clearTheme/resetActiveStyle are defined inline in
  // index.html (no deps, always console-callable). Here we only fetch the saved
  // style: a locally-chosen one, else the is_default row from the styles table.
  const STYLE_KEY = 'ce_active_style';
  async function loadActiveStyle() {
    try {
      const cached = localStorage.getItem(STYLE_KEY);
      if (cached) { window.applyTheme(JSON.parse(cached)); return; }
    } catch {}
    const { data, error } = await supabase.from('styles').select('*').eq('is_default', true).limit(1).single();
    if (!error && data) window.applyTheme(data);
  }
  window.loadActiveStyle = loadActiveStyle;

  function areaColor(name) { return AREA_COLORS[(name || '').toLowerCase()] || '#0ea98f'; }
  function areaBlurb(name) { return AREA_BLURBS[(name || '').toLowerCase()] || 'Explore this area'; }
  function areaEmoji(a) { return a.emoji || AREA_EMOJIS[(a.name || '').toLowerCase()] || '📌'; }

  const els = {
    posts: $('posts'), status: $('status'), form: $('composer'),
    title: $('title'), content: $('content'), postBtn: $('postBtn'),
    signinPrompt: $('signinPrompt'), signInBtn: $('signInBtn'), signOutBtn: $('signOutBtn'),
    authUser: $('authUser'), userName: $('userName'),
    homeView: $('homeView'), profileView: $('profileView'), profileBody: $('profileBody'),
    backBtn: $('backBtn'),
    tabForYou: $('tabForYou'), tabLatest: $('tabLatest'), announcements: $('announcements'),
    feedToggle: $('feedToggle'), areaStrip: $('areaStrip'),
    searchView: $('searchView'), searchInput: $('searchInput'), searchClear: $('searchClear'),
    searchResults: $('searchResults'), searchBar: $('searchBar'),
    areaPicks: $('areaPicks'),
    postPrompt: $('postPrompt'), postPromptBtn: $('postPromptBtn'),
    composerAvatar: $('composerAvatar'), promptAvatar: $('promptAvatar'),
    sidebarMe: $('sidebarMe'), sidebarAvatar: $('sidebarAvatar'), sidebarName: $('sidebarName'),
    mobileAvatar: $('mobileAvatar'),
    myReportsBtn: $('myReportsBtn'),
    areasView: $('areasView'), areasGrid: $('areasGrid'),
    railAnnouncement: $('railAnnouncement'), railAreas: $('railAreas'),
  };

  // ---- Screen navigation ----
  const SCREENS = ['home', 'search', 'areas', 'profile', 'myReports'];
  const screenViews = {
    home: $('homeView'), search: $('searchView'), areas: $('areasView'),
    profile: $('profileView'), myReports: $('myReportsView'),
  };
  const navIds = { home: 'navHome', search: 'navSearch', areas: 'navAreas', profile: 'navProfile' };
  let currentScreen = 'home';

  function showScreen(name) {
    currentScreen = name;
    SCREENS.forEach((s) => screenViews[s]?.classList.add('hidden'));
    screenViews[name]?.classList.remove('hidden');
    // Update sidebar nav active
    Object.entries(navIds).forEach(([s, id]) => {
      $(`${id}`)?.classList.toggle('active', s === name);
    });
    // Update mobile tab bar active
    document.querySelectorAll('.tab-item[data-screen]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.screen === name);
    });
    if (name === 'home') { loadFeed(); }
    if (name === 'search') { setTimeout(() => els.searchInput?.focus(), 50); }
    if (name === 'areas') { renderAreasGrid(); }
    if (name === 'profile') { openSelfProfile(); }
  }

  // Nav click delegation (sidebar + mobile tabbar)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-screen]');
    if (btn && !btn.closest('.card') && !btn.closest('.announcement')) {
      showScreen(btn.dataset.screen);
    }
  });

  $('sidebarNewPost')?.addEventListener('click', openComposer);
  $('fabNewPost')?.addEventListener('click', openComposer);
  $('sidebarMe')?.addEventListener('click', () => { if (authUserId) showScreen('profile'); });
  $('mobileAvatar')?.addEventListener('click', () => { if (authUserId) showScreen('profile'); });

  function openComposer() {
    showScreen('home');
    els.postPrompt?.classList.add('hidden');
    els.form?.classList.remove('hidden');
    els.content?.focus();
  }

  // ---- Report system ----
  let reportingPostId = null, reportingCommentId = null, reportingType = null;
  const reportEls = {
    modal: $('reportModal'), close: $('reportModalClose'), what: $('reportWhat'),
    reason: $('reportReason'), status: $('reportStatus'), submit: $('reportSubmit'),
    cancel: $('reportCancel'), myReportsList: $('reportsList'),
  };

  function openReportModal(postId, commentId = null) {
    reportingPostId = postId; reportingCommentId = commentId;
    reportingType = commentId ? 'comment' : 'post';
    reportEls.what.textContent = reportingType;
    reportEls.reason.value = ''; reportEls.status.textContent = '';
    reportEls.modal.classList.add('open');
  }
  function closeReportModal() {
    reportEls.modal.classList.remove('open');
    reportingPostId = null; reportingCommentId = null; reportingType = null;
  }
  reportEls.close.addEventListener('click', closeReportModal);
  reportEls.cancel.addEventListener('click', closeReportModal);
  reportEls.modal.addEventListener('click', (e) => { if (e.target === reportEls.modal) closeReportModal(); });

  reportEls.submit.addEventListener('click', async () => {
    if (!authUserId) return alert('Sign in to submit a report.');
    const reason = reportEls.reason.value.trim();
    if (!reason) return (reportEls.status.textContent = 'Please provide a reason.');
    reportEls.submit.disabled = true; reportEls.status.textContent = 'Submitting…';
    try {
      const { error } = await supabase.from('Reports').insert({
        reporter_id: authUserId, post_id: reportingPostId || null,
        comment_id: reportingCommentId || null, reason, status: 'pending',
      });
      if (error) throw error;
      reportEls.status.textContent = '✅ Report submitted. Thank you.';
      setTimeout(() => closeReportModal(), 2000);
    } catch (err) { console.error(err); reportEls.status.textContent = 'Error submitting report.'; }
    finally { reportEls.submit.disabled = false; }
  });

  async function openMyReports() {
    if (!authUserId) return alert('Sign in to view your reports.');
    showScreen('myReports');
    reportEls.myReportsList.innerHTML = '<p class="empty">Loading…</p>';
    try {
      const { data, error } = await supabase.from('Reports')
        .select('id, post_id, comment_id, reason, status, created_at')
        .eq('reporter_id', authUserId).order('created_at', { ascending: false });
      if (error) throw error;
      if (!data || !data.length) { reportEls.myReportsList.innerHTML = '<p class="empty">No reports yet.</p>'; return; }
      reportEls.myReportsList.innerHTML = data.map((r) => `
        <div class="report-item">
          <div class="report-meta"><span>Report #${r.id}</span><span>•</span><span>${esc(fmtTime(r.created_at))}</span></div>
          <div class="report-reason"><strong>Reason:</strong> ${esc(r.reason)}</div>
          <span class="report-status ${r.status}">${r.status}</span>
        </div>`).join('');
    } catch (err) { console.error(err); reportEls.myReportsList.innerHTML = '<p class="empty">Could not load reports.</p>'; }
  }
  $('backToFeedBtn')?.addEventListener('click', () => showScreen('home'));

  let authUser = null, authUserId = null, currentProfile = null;
  let feedMode = 'foryou';
  let selectedAreaId = null;
  let areas = [];
  let _searchTimer = null;

  // ---- Utils ----
  const esc = (s) => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

  let _toastTimer = null;
  function showToast(msg, type = 'error', duration = 5000) {
    const t = $('toast');
    t.textContent = msg; t.className = `show ${type}`;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { t.className = type; }, duration);
  }
  const fmtTime = (ts) => { if (!ts) return ''; const d = new Date(ts); return isNaN(d) ? '' : d.toLocaleString(); };
  const initial = (name) => (name && name.trim() ? name.trim()[0].toUpperCase() : '?');
  const avatarHtml = (url, name, size = 34, extra = '') =>
    url
      ? `<img class="av" src="${esc(url)}" alt="" style="width:${size}px;height:${size}px;${extra}" />`
      : `<span class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.4)}px;background:#0ea98f;${extra}">${esc(initial(name))}</span>`;
  const cnt = (rel) => (Array.isArray(rel) && rel[0] ? rel[0].count : 0);
  const setCount = (el, delta) => { el.textContent = Math.max(0, (parseInt(el.textContent, 10) || 0) + delta); };

  // ---- Auth ----
  window.onNativeAuth = async (a, r) => { const { error } = await supabase.auth.setSession({ access_token: a, refresh_token: r }); if (error) console.error(error); };
  async function signIn() {
    if (NATIVE_AUTH) { window.webkit.messageHandlers.nativeAuth.postMessage({ action: 'signIn' }); return; }
    const redirectTo = window.location.href.split('#')[0].split('?')[0];
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) console.error(error);
  }
  async function signOut() { await supabase.auth.signOut(); if (NATIVE_AUTH) window.webkit.messageHandlers.nativeAuth.postMessage({ action: 'signOut' }); }

  async function ensureProfile(user) {
    const { data, error } = await supabase.from('Users').select('"creator-id", Name, account_status').eq('user_id', user.id).limit(1);
    if (error) throw error;
    if (data && data.length) return data[0];
    const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Member';
    const ins = await supabase.from('Users').insert({ Name: name, user_id: user.id, avatar_url: user.user_metadata?.avatar_url || null })
      .select('"creator-id", Name, account_status').single();
    if (ins.error) throw ins.error;
    return ins.data;
  }

  async function applyAuthState(session) {
    authUser = session?.user || null;
    authUserId = authUser?.id || null;
    if (authUser) {
      try {
        currentProfile = await ensureProfile(authUser);
        if (currentProfile?.account_status === 'locked') {
          await supabase.auth.signOut();
          showToast('Your account has been locked. Please contact support.');
          return;
        }
      } catch (e) { console.error(e); currentProfile = null; }
      const name = currentProfile?.Name || authUser.user_metadata?.full_name || authUser.email || 'Member';
      const avatarUrl = authUser.user_metadata?.avatar_url;
      // Sidebar
      if (els.sidebarName) els.sidebarName.textContent = name;
      if (els.sidebarAvatar) {
        if (avatarUrl) { els.sidebarAvatar.outerHTML = `<img class="av" id="sidebarAvatar" src="${esc(avatarUrl)}" alt="" style="width:38px;height:38px" />`; }
        else { els.sidebarAvatar.textContent = initial(name); }
      }
      els.sidebarMe?.classList.remove('hidden');
      els.signOutBtn?.classList.remove('hidden');
      // Mobile avatar
      if (els.mobileAvatar) {
        if (avatarUrl) { els.mobileAvatar.outerHTML = `<img class="av hidden" id="mobileAvatar" src="${esc(avatarUrl)}" alt="" style="width:32px;height:32px;cursor:pointer" />`; }
        else { els.mobileAvatar.textContent = initial(name); }
        $('mobileAvatar')?.classList.remove('hidden');
        $('mobileAvatar')?.addEventListener('click', () => { if (authUserId) showScreen('profile'); });
      }
      // Composer + prompt avatars
      if (els.composerAvatar) {
        if (avatarUrl) { els.composerAvatar.outerHTML = `<img class="av" id="composerAvatar" src="${esc(avatarUrl)}" alt="" style="width:40px;height:40px" />`; }
        else { els.composerAvatar.textContent = initial(name); }
      }
      if (els.promptAvatar) {
        if (avatarUrl) { els.promptAvatar.outerHTML = `<img class="av" id="promptAvatar" src="${esc(avatarUrl)}" alt="" style="width:40px;height:40px" />`; }
        else { els.promptAvatar.textContent = initial(name); }
      }
      els.signinPrompt?.classList.add('hidden');
      els.postPrompt?.classList.remove('hidden');
    } else {
      currentProfile = null;
      els.sidebarMe?.classList.add('hidden');
      els.signOutBtn?.classList.add('hidden');
      $('mobileAvatar')?.classList.add('hidden');
      els.signinPrompt?.classList.remove('hidden');
      els.postPrompt?.classList.add('hidden');
      els.form?.classList.add('hidden');
    }
  }
  supabase.auth.onAuthStateChange((_e, session) => { applyAuthState(session).then(() => loadFeed()); });

  // ---- Normalization ----
  function fromRpc(r) {
    return {
      id: r.post_id, title: r.title, content: r.content, created_at: r.created_at,
      authorName: r.author_name || 'Unknown', authorAvatar: r.author_avatar, authorUserId: r.author_user_id || '',
      likeCount: r.like_count || 0, commentCount: r.comment_count || 0,
      liked: !!r.viewer_liked, disliked: !!r.viewer_disliked, tags: r.tags || [], area: null,
    };
  }
  function fromRest(r, likedSet, dislikedSet) {
    const u = r.Users || {};
    const tags = (r.PostTags || []).map((pt) => pt.Tags?.name).filter(Boolean);
    const area = r.Areas ? { id: r.area_id, name: r.Areas.name, emoji: r.Areas.emoji } : null;
    return {
      id: r['post-id'], title: r.title, content: r.content, created_at: r.created_at,
      authorName: u.Name || 'Unknown', authorAvatar: u.avatar_url, authorUserId: u.user_id || '',
      likeCount: cnt(r.Likes), commentCount: cnt(r.Comments),
      liked: likedSet.has(r['post-id']), disliked: dislikedSet.has(r['post-id']), tags, area,
    };
  }

  function relTime(ts) {
    if (!ts) return '';
    const diff = (Date.now() - new Date(ts)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  function postCardHtml(p) {
    const clickable = !!p.authorUserId;
    const own = authUserId && p.authorUserId === authUserId;
    const color = areaColor(p.area?.name);
    const areaHtml = p.area
      ? `<span class="abadge" style="background:${color}1a;color:${color}">${p.area.emoji ? esc(p.area.emoji) + ' ' : ''}${esc(p.area.name)}</span>`
      : '';
    const titleHtml = p.title ? `<div class="ptitle">${esc(p.title)}</div>` : '';
    const tagsHtml = p.tags.length ? `<div class="ptags">${p.tags.map((t) => `<span class="ptag">#${esc(t)}</span>`).join('')}</div>` : '';
    return `
      <div class="card" data-post-id="${p.id}">
        <div class="phead">
          ${avatarHtml(p.authorAvatar, p.authorName, 40)}
          <div class="pinfo">
            <div class="pauthor ${clickable ? '' : 'nolink'}" ${clickable ? `data-user-id="${esc(p.authorUserId)}"` : ''}>${esc(p.authorName)}</div>
            <div class="pmeta">${esc(relTime(p.created_at))}</div>
          </div>
          ${areaHtml}
          <div class="post-menu">
            <button class="post-menu-btn" data-act="menu-toggle" data-post-id="${p.id}">⋯</button>
            <div class="post-menu-dropdown" data-menu-for="${p.id}">
              <button data-act="share">Share</button>
              <button data-act="bookmark">Bookmark</button>
              <button data-act="report" data-post-id="${p.id}">Report</button>
            </div>
          </div>
        </div>
        ${titleHtml}
        <p class="pbody">${esc(p.content)}</p>
        ${tagsHtml}
        <div class="pacts">
          <button class="pact like ${p.liked ? 'liked' : ''}" data-act="like" data-post-id="${p.id}">
            <svg viewBox="0 0 24 24" fill="${p.liked ? '#ff4d6d' : 'none'}" stroke="${p.liked ? '#ff4d6d' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7.5-4.7-10-9C.4 8.8 2 5 5.5 5 7.7 5 9 6.4 12 9c3-2.6 4.3-4 6.5-4C22 5 23.6 8.8 22 12c-2.5 4.3-10 9-10 9z"/></svg>
            <span class="like-count">${p.likeCount}</span>
          </button>
          <button class="pact" data-act="toggle-comments" data-post-id="${p.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5A8 8 0 1 1 21 12z"/></svg>
            <span class="comment-count">${p.commentCount}</span>
          </button>
          <button class="pact dislike ${p.disliked ? 'disliked' : ''}" data-act="dislike" data-post-id="${p.id}" title="Not for me" style="color:${p.disliked ? '#727a8c' : '#9aa1b2'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.7a2 2 0 0 0-2 1.7L2 11a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.3A2 2 0 0 1 21 4v7a2 2 0 0 1-2 2H17"/></svg>
          </button>
          ${own ? `<button class="pact del-act" data-act="del-post" data-post-id="${p.id}">🗑️Delete</button>` : ''}
        </div>
        <div class="comments hidden" data-comments-for="${p.id}"></div>
      </div>`;
  }

  function renderInto(container, items) {
    container.innerHTML = items.length ? items.map(postCardHtml).join('') : '<p class="empty">No posts yet — be the first to share!</p>';
  }

  async function getReactionSet(table, col, postIds) {
    if (!authUserId || postIds.length === 0) return new Set();
    const { data, error } = await supabase.from(table).select(col).eq('user_id', authUserId).in(col, postIds);
    if (error) { console.error(error); return new Set(); }
    return new Set(data.map((r) => r[col]));
  }

  const REST_SELECT = '"post-id", title, content, created_at, area_id, Areas(name, emoji), Users(Name, avatar_url, user_id), Likes(count), Comments(count), PostTags(Tags(name))';

  async function loadForYou() {
    const { data, error } = await supabase.rpc('get_feed', { lim: 100 });
    if (error) { els.posts.innerHTML = '<p class="empty">Could not load the feed.</p>'; console.error(error); return; }
    renderInto(els.posts, (data || []).map(fromRpc));
  }
  async function loadLatest() {
    const { data, error } = await supabase.from('Posts').select(REST_SELECT).neq('status', 'removed').order('created_at', { ascending: false }).limit(100);
    if (error) { els.posts.innerHTML = '<p class="empty">Could not load the feed.</p>'; console.error(error); return; }
    const ids = data.map((p) => p['post-id']);
    const [likedSet, dislikedSet] = await Promise.all([getReactionSet('Likes', 'post_id', ids), getReactionSet('Dislikes', 'post_id', ids)]);
    renderInto(els.posts, data.map((r) => fromRest(r, likedSet, dislikedSet)));
  }
  function loadFeed() {
    loadAnnouncements();
    if (selectedAreaId !== null) return loadAreaFeed();
    return feedMode === 'foryou' ? loadForYou() : loadLatest();
  }

  async function loadAreaFeed() {
    els.posts.innerHTML = '<p class="empty">Loading…</p>';
    const { data, error } = await supabase.from('Posts').select(REST_SELECT)
      .eq('area_id', selectedAreaId).neq('status', 'removed')
      .order('created_at', { ascending: false }).limit(100);
    if (error) { els.posts.innerHTML = '<p class="empty">Could not load this area.</p>'; console.error(error); return; }
    const ids = (data || []).map((p) => p['post-id']);
    const [likedSet, dislikedSet] = await Promise.all([getReactionSet('Likes', 'post_id', ids), getReactionSet('Dislikes', 'post_id', ids)]);
    const mapped = (data || []).map((r) => fromRest(r, likedSet, dislikedSet));
    if (!mapped.length) {
      els.posts.innerHTML = '<p class="empty">No posts in this area yet — be the first!</p>';
    } else {
      renderInto(els.posts, mapped);
    }
  }

  // ---- Announcements ----
  const DISMISS_KEY = 'ce_dismissed_announcements';
  const dismissed = () => { try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')); } catch { return new Set(); } };
  const dismiss = (id) => { try { const s = dismissed(); s.add(id); localStorage.setItem(DISMISS_KEY, JSON.stringify([...s])); } catch {} };

  async function loadAnnouncements() {
    const { data, error } = await supabase.from('Announcements')
      .select('id, title, content, created_at').eq('active', true).order('created_at', { ascending: false }).limit(5);
    if (error) { console.error(error); return; }
    const hidden = dismissed();
    const items = (data || []).filter((a) => !hidden.has(a.id));
    // Feed banners
    els.announcements.innerHTML = items.map((a) => `
      <div class="announcement" data-ann-id="${a.id}">
        <button class="ann-dismiss" data-act="dismiss-ann" data-ann-id="${a.id}" title="Dismiss">×</button>
        <div class="ann-label">📢 Announcement</div>
        ${a.title ? `<div class="ann-title">${esc(a.title)}</div>` : ''}
        <div class="ann-body">${esc(a.content)}</div>
        <div class="ann-time">${esc(fmtTime(a.created_at))}</div>
      </div>`).join('');
    // Rail card: show latest (including dismissed)
    const rail = (data || [])[0];
    if (rail && els.railAnnouncement) {
      els.railAnnouncement.innerHTML = `
        <div class="ann-card">
          <p class="ann-label">📣 Announcement</p>
          ${rail.title ? `<p class="ann-title-text">${esc(rail.title)}</p>` : ''}
          <p class="ann-body-text">${esc(rail.content)}</p>
        </div>`;
    }
  }

  els.tabForYou.addEventListener('click', () => { feedMode = 'foryou'; els.tabForYou.classList.add('active'); els.tabLatest.classList.remove('active'); loadFeed(); });
  els.tabLatest.addEventListener('click', () => { feedMode = 'latest'; els.tabLatest.classList.add('active'); els.tabForYou.classList.remove('active'); loadFeed(); });

  // ---- Post prompt ↔ composer toggle ----
  els.postPromptBtn?.addEventListener('click', openComposer);
  els.postPrompt?.addEventListener('click', openComposer);

  // ---- Areas ----
  let _areaPostCounts = {};

  async function loadAreas() {
    const { data, error } = await supabase.from('Areas').select('id, name, emoji').order('name');
    if (error) { console.error('Areas load failed', error); return; }
    areas = data || [];
    renderAreaStrip();
    renderAreaPicks();
    if (areas.length) els.areaStrip.classList.remove('hidden');
    // Load post counts for rail
    try {
      const { data: counts } = await supabase.from('Posts').select('area_id').neq('status', 'removed').not('area_id', 'is', null);
      _areaPostCounts = {};
      (counts || []).forEach((r) => { _areaPostCounts[r.area_id] = (_areaPostCounts[r.area_id] || 0) + 1; });
      renderRailAreas();
    } catch (e) { console.error(e); }
  }

  function renderAreaStrip() {
    els.areaStrip.innerHTML =
      `<button class="chip ${selectedAreaId === null ? 'active' : ''}" data-area-id="" style="${selectedAreaId === null ? 'background:#1b1d28' : ''}">All</button>` +
      areas.map((a) => {
        const color = areaColor(a.name);
        const active = selectedAreaId === a.id;
        return `<button class="chip ${active ? 'active' : ''}" data-area-id="${a.id}" style="${active ? `background:${color}` : ''}"><span class="chip-dot" style="background:${color}"></span>${a.emoji ? esc(a.emoji) + ' ' : ''}${esc(a.name)}</button>`;
      }).join('') +
      `<button class="suggest-chip">+ Suggest area</button>`;
  }

  let selectedPickId = null;
  function paintAreaPicks() {
    document.querySelectorAll('[data-area-pick]').forEach((b) => {
      const bid = parseInt(b.dataset.areaPick, 10);
      const active = bid === selectedPickId;
      const color = areaColor(areas.find((a) => a.id === bid)?.name);
      b.classList.toggle('active', active);
      b.style.background = active ? color : '';
      b.style.color = active ? '#fff' : '';
      b.style.borderColor = active ? 'transparent' : '';
    });
  }
  function resetAreaPicks() { selectedPickId = null; paintAreaPicks(); }
  els.areaPicks?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-area-pick]');
    if (!btn) return;
    const id = parseInt(btn.dataset.areaPick, 10);
    selectedPickId = selectedPickId === id ? null : id;
    paintAreaPicks();
  });
  function renderAreaPicks() {
    if (!els.areaPicks) return;
    els.areaPicks.innerHTML = areas.map((a) => {
      const color = areaColor(a.name);
      return `<button type="button" class="area-pick" data-area-pick="${a.id}" style=""><span class="chip-dot" style="background:${color}"></span>${esc(a.name)}</button>`;
    }).join('');
    paintAreaPicks();
  }

  function renderAreasGrid() {
    if (!els.areasGrid) return;
    if (!areas.length) { els.areasGrid.innerHTML = '<p class="empty">Loading areas…</p>'; return; }
    els.areasGrid.innerHTML = areas.map((a) => {
      const color = areaColor(a.name);
      const count = _areaPostCounts[a.id] || 0;
      const emoji = areaEmoji(a);
      const blurb = areaBlurb(a.name);
      return `<div class="area-card" data-area-nav="${a.id}" style="background:linear-gradient(135deg,${color},${color}cc)">
        <span class="area-icon">${emoji}</span>
        <p class="area-name">${esc(a.name)}</p>
        <p class="area-blurb">${esc(blurb)}</p>
        <p class="area-count">${count} ${count === 1 ? 'post' : 'posts'}</p>
      </div>`;
    }).join('');
  }

  function renderRailAreas() {
    if (!els.railAreas) return;
    const sorted = [...areas].sort((a, b) => (_areaPostCounts[b.id] || 0) - (_areaPostCounts[a.id] || 0)).slice(0, 4);
    els.railAreas.innerHTML = sorted.map((a) => {
      const color = areaColor(a.name);
      const count = _areaPostCounts[a.id] || 0;
      return `<div class="rail-row" data-area-nav="${a.id}">
        <span class="chip-dot" style="background:${color};width:10px;height:10px"></span>
        <div><div class="rail-row-name">${esc(a.name)}</div></div>
        <div class="rail-count">${count}</div>
      </div>`;
    }).join('');
  }

  els.areaStrip.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-area-id]');
    if (tab) {
      selectedAreaId = tab.dataset.areaId ? parseInt(tab.dataset.areaId, 10) : null;
      renderAreaStrip();
      loadFeed();
      return;
    }
    if (e.target.closest('.suggest-chip')) openSuggestAreaModal();
  });

  // Area card navigation (areas screen + rail)
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-area-nav]');
    if (card) {
      selectedAreaId = parseInt(card.dataset.areaNav, 10) || null;
      renderAreaStrip();
      showScreen('home');
    }
  });

  // ---- Search ----
  function handleSearchInput() {
    clearTimeout(_searchTimer);
    const q = els.searchInput.value.trim();
    els.searchClear?.classList.toggle('hidden', !q);
    if (!q) { els.searchResults.innerHTML = '<p class="empty">Start typing to search…</p>'; return; }
    _searchTimer = setTimeout(() => runSearch(q), 350);
  }

  async function runSearch(q) {
    els.searchResults.innerHTML = '<p class="empty">Searching…</p>';
    const [postsRes, usersRes] = await Promise.all([
      supabase.from('Posts').select(REST_SELECT).or(`title.ilike.%${q}%,content.ilike.%${q}%`).neq('status', 'removed').order('created_at', { ascending: false }).limit(30),
      supabase.from('Users').select('"creator-id", Name, avatar_url, user_id').ilike('Name', `%${q}%`).limit(8),
    ]);
    const posts = postsRes.data || [], users = usersRes.data || [];
    const ids = posts.map((p) => p['post-id']);
    const [likedSet, dislikedSet] = await Promise.all([getReactionSet('Likes', 'post_id', ids), getReactionSet('Dislikes', 'post_id', ids)]);
    let html = '';
    if (users.length) {
      html += `<div class="search-heading">People</div>` +
        users.map((u) => `<div class="user-result" data-user-id="${esc(u.user_id)}">${avatarHtml(u.avatar_url, u.Name, 40)}<span class="user-result-name">${esc(u.Name || 'Member')}</span></div>`).join('');
    }
    if (posts.length) {
      html += `<div class="search-heading">Posts</div>` + posts.map((r) => postCardHtml(fromRest(r, likedSet, dislikedSet))).join('');
    }
    if (!users.length && !posts.length) html = `<p class="empty">No results for "${esc(q)}"</p>`;
    els.searchResults.innerHTML = html;
  }

  els.searchInput?.addEventListener('input', handleSearchInput);
  els.searchInput?.addEventListener('keydown', (e) => { if (e.key === 'Escape') { els.searchInput.value = ''; handleSearchInput(); } });
  els.searchClear?.addEventListener('click', () => { els.searchInput.value = ''; handleSearchInput(); els.searchInput.focus(); });

  // ---- Suggest area ----
  function openSuggestAreaModal() {
    $('suggestAreaName').value = ''; $('suggestAreaReason').value = '';
    $('suggestAreaStatus').textContent = '';
    $('suggestAreaModal').classList.add('open');
  }
  function closeSuggestAreaModal() { $('suggestAreaModal').classList.remove('open'); }
  $('suggestAreaClose').addEventListener('click', closeSuggestAreaModal);
  $('suggestAreaCancel').addEventListener('click', closeSuggestAreaModal);
  $('suggestAreaModal').addEventListener('click', (e) => { if (e.target === $('suggestAreaModal')) closeSuggestAreaModal(); });
  $('suggestAreaTrigger')?.addEventListener('click', openSuggestAreaModal);

  $('suggestAreaSubmit').addEventListener('click', async () => {
    const name = $('suggestAreaName').value.trim();
    if (!name) { $('suggestAreaStatus').textContent = 'Please enter an area name.'; return; }
    $('suggestAreaSubmit').disabled = true; $('suggestAreaStatus').textContent = 'Submitting…';
    try {
      const { error } = await supabase.from('AreaSuggestions').insert({ name, reason: $('suggestAreaReason').value.trim() || null, suggested_by: authUserId || null });
      if (error) throw error;
      $('suggestAreaStatus').textContent = '✅ Suggestion submitted! Thanks.';
      setTimeout(() => closeSuggestAreaModal(), 2000);
    } catch (err) { console.error(err); $('suggestAreaStatus').textContent = 'Error submitting suggestion.'; }
    finally { $('suggestAreaSubmit').disabled = false; }
  });

  // ---- Admin command ----
  async function handleAdminCommand(content, title) {
    const lines = content.split('\n');
    const parts = lines[0].trim().split(/\s+/);
    const cmd = parts[0], code = parts[1] || '';
    if (!code) { els.status.textContent = 'Missing admin code.'; return; }
    els.postBtn.disabled = true;
    try {
      if (cmd === '/clear') {
        els.status.textContent = 'Clearing…';
        const { data, error } = await supabase.rpc('clear_announcements', { p_code: code });
        if (error) throw error;
        if (!data) { els.status.textContent = '❌ Invalid admin code.'; return; }
        els.content.value = ''; els.title.value = '';
        await loadAnnouncements();
        els.status.innerHTML = '✅ Banner cleared. Your NEW code: <b>' + esc(data) + '</b> (save it!)';
      } else {
        const body = lines.slice(1).join('\n').trim();
        if (!body) { els.status.textContent = 'Put the announcement text on the line(s) below "/announce <code>".'; return; }
        els.status.textContent = 'Publishing…';
        const { data, error } = await supabase.rpc('create_announcement', { p_code: code, p_title: title, p_content: body });
        if (error) throw error;
        if (!data) { els.status.textContent = '❌ Invalid admin code.'; return; }
        els.content.value = ''; els.title.value = '';
        await loadAnnouncements();
        els.status.innerHTML = '📢 Announcement posted! Your NEW code: <b>' + esc(data) + '</b> (save it!)';
      }
    } catch (err) { console.error(err); els.status.textContent = 'Something went wrong.'; }
    finally { els.postBtn.disabled = false; }
  }

  // ---- Compose ----
  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = els.title.value.trim(), content = els.content.value.trim();
    if (!content) return;
    if (!currentProfile) { els.status.textContent = 'Please sign in first.'; return; }
    if (content.startsWith('/announce') || content.startsWith('/clear')) {
      await handleAdminCommand(content, title); return;
    }
    els.postBtn.disabled = true; els.status.textContent = 'Posting…';
    try {
      const areaId = selectedPickId || null;
      const { data, error } = await supabase.from('Posts')
        .insert({ title: title || null, content, 'creator-id': currentProfile['creator-id'], area_id: areaId })
        .select('"post-id"').single();
      if (error) throw error;
      els.content.value = ''; els.title.value = '';
      resetAreaPicks();
      els.status.textContent = 'Posted! Tagging…';
      try { await supabase.functions.invoke('tag-post', { body: { post_id: data['post-id'] } }); } catch (tagErr) { console.warn('tagging failed', tagErr); }
      els.status.textContent = 'Posted!';
      setTimeout(() => { els.status.textContent = ''; els.form.classList.add('hidden'); els.postPrompt?.classList.remove('hidden'); }, 2000);
      loadFeed();
    } catch (err) { els.status.textContent = 'Something went wrong.'; console.error(err); }
    finally { els.postBtn.disabled = false; }
  });

  // ---- Likes / Dislikes ----
  async function toggleLike(postId, card) {
    if (!authUserId) return alert('Sign in to react.');
    const likeBtn = card.querySelector('[data-act="like"]');
    const disBtn = card.querySelector('[data-act="dislike"]');
    const countEl = likeBtn.querySelector('.like-count');
    const svg = likeBtn.querySelector('svg');
    try {
      if (likeBtn.classList.contains('liked')) {
        const { error } = await supabase.from('Likes').delete().eq('post_id', postId).eq('user_id', authUserId);
        if (error) throw error;
        likeBtn.classList.remove('liked'); setCount(countEl, -1);
        svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
      } else {
        const { error } = await supabase.from('Likes').insert({ post_id: postId, user_id: authUserId });
        if (error) throw error;
        likeBtn.classList.add('liked'); setCount(countEl, +1);
        svg.setAttribute('fill', '#ff4d6d'); svg.setAttribute('stroke', '#ff4d6d');
        if (disBtn && disBtn.classList.contains('disliked')) {
          disBtn.classList.remove('disliked'); disBtn.style.color = '#9aa1b2';
          await supabase.from('Dislikes').delete().eq('post_id', postId).eq('user_id', authUserId);
        }
      }
    } catch (err) { console.error('like failed', err); }
  }

  async function toggleDislike(postId, card) {
    if (!authUserId) return alert('Sign in to react.');
    const likeBtn = card.querySelector('[data-act="like"]');
    const disBtn = card.querySelector('[data-act="dislike"]');
    const countEl = likeBtn.querySelector('.like-count');
    const svg = likeBtn.querySelector('svg');
    try {
      if (disBtn.classList.contains('disliked')) {
        const { error } = await supabase.from('Dislikes').delete().eq('post_id', postId).eq('user_id', authUserId);
        if (error) throw error;
        disBtn.classList.remove('disliked'); disBtn.style.color = '#9aa1b2';
      } else {
        const { error } = await supabase.from('Dislikes').insert({ post_id: postId, user_id: authUserId });
        if (error) throw error;
        disBtn.classList.add('disliked'); disBtn.style.color = '#727a8c';
        if (likeBtn.classList.contains('liked')) {
          await supabase.from('Likes').delete().eq('post_id', postId).eq('user_id', authUserId);
          likeBtn.classList.remove('liked'); setCount(countEl, -1);
          svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
        }
      }
    } catch (err) { console.error('dislike failed', err); }
  }

  // ---- Comments ----
  function commentHtml(c) {
    const u = c.Users || {}; const name = u.Name || 'Unknown'; const uid = u.user_id || '';
    const own = authUserId && uid === authUserId;
    return `
      <div class="comment" data-comment-id="${c['comment-id']}">
        ${avatarHtml(u.avatar_url, name, 32)}
        <div class="c-body">
          <span class="c-author ${uid ? '' : 'nolink'}" ${uid ? `data-user-id="${esc(uid)}"` : ''}>${esc(name)}</span>
          <span class="c-time">${esc(relTime(c.created_at))}</span>
          <div class="c-text">${esc(c.content)}</div>
        </div>
        ${own ? `<button class="c-del" data-act="del-comment" data-comment-id="${c['comment-id']}" title="Delete">×</button>` : ''}
      </div>`;
  }
  async function loadComments(postId, box) {
    box.innerHTML = '<p class="empty">Loading…</p>';
    const { data, error } = await supabase.from('Comments')
      .select('"comment-id", content, created_at, Users(Name, avatar_url, user_id)')
      .eq('post-id', postId).neq('status', 'removed').order('created_at', { ascending: true });
    if (error) { box.innerHTML = '<p class="empty">Could not load comments.</p>'; console.error(error); return; }
    const list = data.map(commentHtml).join('');
    const formHtml = authUserId
      ? `<form class="comment-form" data-comment-form="${postId}"><input type="text" maxlength="2000" placeholder="Write a comment…" required /><button type="submit">Reply</button></form>`
      : `<p class="empty">Sign in to comment.</p>`;
    box.innerHTML = (list || '<p class="empty">No comments yet.</p>') + formHtml;
  }
  async function addComment(postId, input, box) {
    const content = input.value.trim();
    if (!content || !currentProfile) return;
    input.disabled = true;
    try {
      const { error } = await supabase.from('Comments').insert({ content, creator_id: currentProfile['creator-id'], 'post-id': postId });
      if (error) throw error;
      await loadComments(postId, box); bumpCommentCount(postId, +1);
    } catch (err) { console.error(err); input.disabled = false; }
  }
  async function deleteComment(commentId, postId, box) {
    try {
      const { error } = await supabase.from('Comments').delete().eq('comment-id', commentId);
      if (error) throw error;
      await loadComments(postId, box); bumpCommentCount(postId, -1);
    } catch (err) { console.error(err); }
  }
  function bumpCommentCount(postId, delta) {
    document.querySelectorAll(`.card[data-post-id="${postId}"]`).forEach((card) => {
      const span = card.querySelector('.comment-count'); if (span) setCount(span, delta);
    });
  }

  // ---- Delete post ----
  async function deletePost(postId) {
    if (!confirm('Delete this post? This also removes its likes and comments.')) return;
    try {
      const { error } = await supabase.from('Posts').delete().eq('post-id', postId);
      if (error) throw error;
      document.querySelector(`.card[data-post-id="${postId}"]`)?.remove();
    } catch (err) { console.error(err); }
  }

  // ---- Follows / Profiles ----
  async function toggleFollow(userId, btn) {
    if (!authUserId) return alert('Sign in to follow people.');
    const following = btn.dataset.following === '1'; btn.disabled = true;
    try {
      if (following) {
        const { error } = await supabase.from('Follows').delete().eq('follower_id', authUserId).eq('following_id', userId);
        if (error) throw error; btn.dataset.following = '0'; btn.textContent = 'Follow';
      } else {
        const { error } = await supabase.from('Follows').insert({ follower_id: authUserId, following_id: userId });
        if (error) throw error; btn.dataset.following = '1'; btn.textContent = 'Following';
      }
    } catch (err) { console.error(err); } finally { btn.disabled = false; }
  }

  async function openSelfProfile() {
    if (!authUserId) {
      els.profileBody.innerHTML = '<div class="signin-card"><p>Sign in to view your profile.</p></div>';
      return;
    }
    openProfile(authUserId);
  }

  async function openProfile(userId) {
    showScreen('profile');
    els.profileBody.innerHTML = '<p class="empty">Loading profile…</p>';
    const { data: prof, error } = await supabase.from('Users').select('"creator-id", Name, avatar_url, bio, user_id').eq('user_id', userId).single();
    if (error || !prof) { els.profileBody.innerHTML = '<p class="empty">Profile not found.</p>'; return; }

    const isSelf = authUserId && authUserId === userId;
    const [{ count: followers }, { count: following }, mine, audiencesRes, { count: postCount }] = await Promise.all([
      supabase.from('Follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('Follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
      authUserId ? supabase.from('Follows').select('follower_id').eq('follower_id', authUserId).eq('following_id', userId).limit(1) : Promise.resolve({ data: [] }),
      isSelf ? supabase.rpc('get_my_audiences', { lim: 8 }) : Promise.resolve({ data: [] }),
      supabase.from('Posts').select('*', { count: 'exact', head: true }).eq('creator-id', prof['creator-id']).neq('status', 'removed'),
    ]);
    const isFollowing = !!(mine.data && mine.data.length);
    const audiences = (audiencesRes.data || []).map((a) => a.tag);

    let actionHtml = '';
    if (isSelf) {
      actionHtml = `<div class="profile-edit" style="margin-top:12px"><textarea id="bioInput" rows="2" maxlength="300" placeholder="Add a bio…">${esc(prof.bio || '')}</textarea><button class="ghost-btn" data-act="save-bio" data-user-id="${esc(userId)}" style="margin-top:0">Save bio</button></div>`;
    } else if (authUserId) {
      actionHtml = `<button class="ghost-btn" style="margin-top:0" data-act="follow" data-user-id="${esc(userId)}" data-following="${isFollowing ? 1 : 0}">${isFollowing ? 'Following' : 'Follow'}</button>`;
    }
    const audiencesHtml = (isSelf && audiences.length)
      ? `<div class="profile-audiences" style="margin-top:12px"><div class="label">Your audiences (from what you engage with)</div><div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:6px">${audiences.map((t) => `<span class="ptag">#${esc(t)}</span>`).join('')}</div></div>`
      : '';
    const reportsHtml = isSelf ? `<button class="ghost-btn" data-act="my-reports" style="margin-top:8px;font-size:13px">My Reports</button>` : '';

    const handle = '@' + (prof.Name || 'member').toLowerCase().replace(/\s+/g, '');
    els.profileBody.innerHTML = `
      <div class="profile-card">
        <div class="profile-banner"></div>
        <div class="profile-inner">
          ${avatarHtml(prof.avatar_url, prof.Name, 88, 'border:5px solid #fff;margin-top:-44px;display:flex;')}
          <div class="profile-name">${esc(prof.Name || 'Member')}</div>
          <div class="profile-handle">${esc(handle)}</div>
          ${prof.bio && !isSelf ? `<div class="profile-bio">${esc(prof.bio)}</div>` : ''}
          <div class="profile-stats">
            <div class="profile-stat"><b>${postCount || 0}</b><span>Posts</span></div>
            <div class="profile-stat"><b>${followers || 0}</b><span>Followers</span></div>
            <div class="profile-stat"><b>${following || 0}</b><span>Following</span></div>
          </div>
          ${audiencesHtml}
          ${actionHtml}
          ${reportsHtml}
        </div>
      </div>
      <div class="section-label">Your posts</div>
      <div id="profilePosts"><p class="empty">Loading…</p></div>`;

    const { data: posts } = await supabase.from('Posts').select(REST_SELECT).eq('creator-id', prof['creator-id']).neq('status', 'removed').order('created_at', { ascending: false }).limit(100);
    const ids = (posts || []).map((p) => p['post-id']);
    const [likedSet, dislikedSet] = await Promise.all([getReactionSet('Likes', 'post_id', ids), getReactionSet('Dislikes', 'post_id', ids)]);
    renderInto($('profilePosts'), (posts || []).map((r) => fromRest(r, likedSet, dislikedSet)));
  }

  async function saveBio(userId, btn) {
    const input = $('bioInput'); if (!input) return;
    btn.disabled = true; btn.textContent = 'Saving…';
    try { const { error } = await supabase.from('Users').update({ bio: input.value.trim() || null }).eq('user_id', userId); if (error) throw error; btn.textContent = 'Saved!'; setTimeout(() => (btn.textContent = 'Save bio'), 2000); }
    catch (err) { console.error(err); btn.textContent = 'Save bio'; } finally { btn.disabled = false; }
  }

  // ---- Event delegation ----
  els.signInBtn.addEventListener('click', signIn);
  els.signOutBtn.addEventListener('click', signOut);

  // Email/password sign-in
  document.getElementById('emailAuthToggle')?.addEventListener('click', () => {
    const form = document.getElementById('emailAuthForm');
    form?.classList.toggle('open');
  });
  document.getElementById('emailAuthSubmit')?.addEventListener('click', async () => {
    const email = document.getElementById('emailAuthEmail')?.value.trim();
    const password = document.getElementById('emailAuthPassword')?.value;
    const errEl = document.getElementById('emailAuthErr');
    if (!email || !password) { if (errEl) { errEl.textContent = 'Enter your email and password.'; errEl.style.display = 'block'; } return; }
    const btn = document.getElementById('emailAuthSubmit');
    btn.disabled = true; btn.textContent = 'Signing in…';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    btn.disabled = false; btn.textContent = 'Sign in';
    if (error) { if (errEl) { errEl.textContent = error.message; errEl.style.display = 'block'; } }
    else { if (errEl) errEl.style.display = 'none'; }
  });
  els.myReportsBtn?.addEventListener('click', openMyReports);

  document.addEventListener('click', (e) => {
    const actEl = e.target.closest('[data-act]');
    if (actEl) {
      const act = actEl.dataset.act;
      const card = actEl.closest('.card');
      if (act === 'like') return toggleLike(parseInt(actEl.dataset.postId, 10), card);
      if (act === 'dislike') return toggleDislike(parseInt(actEl.dataset.postId, 10), card);
      if (act === 'toggle-comments') {
        const postId = parseInt(actEl.dataset.postId, 10);
        const box = card.querySelector(`.comments[data-comments-for="${postId}"]`);
        if (!box) return;
        if (box.classList.contains('hidden')) { box.classList.remove('hidden'); loadComments(postId, box); }
        else { box.classList.add('hidden'); box.innerHTML = ''; }
        return;
      }
      if (act === 'del-post') return deletePost(parseInt(actEl.dataset.postId, 10));
      if (act === 'del-comment') {
        const box = actEl.closest('.comments');
        return deleteComment(parseInt(actEl.dataset.commentId, 10), parseInt(box.dataset.commentsFor, 10), box);
      }
      if (act === 'menu-toggle') {
        const postId = actEl.dataset.postId;
        const dropdown = document.querySelector(`.post-menu-dropdown[data-menu-for="${postId}"]`);
        document.querySelectorAll('.post-menu-dropdown.open').forEach((d) => { if (d !== dropdown) d.classList.remove('open'); });
        dropdown?.classList.toggle('open');
        return;
      }
      if (act === 'report') { openReportModal(parseInt(actEl.dataset.postId, 10)); return; }
      if (act === 'share') { alert('Share feature coming soon!'); return; }
      if (act === 'bookmark') { alert('Bookmark feature coming soon!'); return; }
      if (act === 'follow') return toggleFollow(actEl.dataset.userId, actEl);
      if (act === 'save-bio') return saveBio(actEl.dataset.userId, actEl);
      if (act === 'dismiss-ann') { dismiss(parseInt(actEl.dataset.annId, 10)); loadAnnouncements(); return; }
      if (act === 'my-reports') { openMyReports(); return; }
      return;
    }
    // Close open menus when clicking outside
    const menu = e.target.closest('.post-menu');
    if (!menu) document.querySelectorAll('.post-menu-dropdown.open').forEach((d) => d.classList.remove('open'));

    const authorEl = e.target.closest('[data-user-id]');
    if (authorEl && authorEl.dataset.userId) openProfile(authorEl.dataset.userId);
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-comment-form]');
    if (!form) return;
    e.preventDefault();
    addComment(parseInt(form.dataset.commentForm, 10), form.querySelector('input'), form.closest('.comments'));
  });

  // ---- Init ----
  (async () => {
    loadActiveStyle();
    const { data } = await supabase.auth.getSession();
    await applyAuthState(data.session);
    await loadAreas();
    loadFeed();
  })();
