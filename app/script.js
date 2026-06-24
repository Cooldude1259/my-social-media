  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

  const SUPABASE_URL = 'https://bmfbnydcanksjwquljzb.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qa7veCIyFBL1_BYNFOCsXQ_cfHGKyh0';

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    db: { schema: 'social-media-public' },
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
  });

  const NATIVE_AUTH = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeAuth);
  const $ = (id) => document.getElementById(id);
  const els = {
    posts: $('posts'), status: $('status'), form: $('composer'),
    title: $('title'), content: $('content'), postBtn: $('postBtn'),
    signinPrompt: $('signinPrompt'), signInBtn: $('signInBtn'), signOutBtn: $('signOutBtn'),
    authUser: $('authUser'), userName: $('userName'), myReportsBtn: $('myReportsBtn'),
    homeView: $('homeView'), profileView: $('profileView'), profileBody: $('profileBody'), backBtn: $('backBtn'),
    tabForYou: $('tabForYou'), tabLatest: $('tabLatest'), announcements: $('announcements'),
    feedToggle: $('feedToggle'), areaStrip: $('areaStrip'), areaStripWrap: $('areaStripWrap'), areaSelect: $('areaSelect'),
    searchToggle: $('searchToggle'), searchBar: $('searchBar'), searchInput: $('searchInput'), searchClear: $('searchClear'),
  };

  // Report system
  let reportingPostId = null, reportingCommentId = null, reportingType = null;
  const reportEls = {
    modal: $('reportModal'), close: $('reportModalClose'), what: $('reportWhat'),
    reason: $('reportReason'), status: $('reportStatus'), submit: $('reportSubmit'),
    cancel: $('reportCancel'), myReportsView: $('myReportsView'), 
    myReportsList: $('reportsList'), backToFeedBtn: $('backToFeedBtn')
  };

  function openReportModal(postId, commentId = null) {
    reportingPostId = postId;
    reportingCommentId = commentId;
    reportingType = commentId ? 'comment' : 'post';
    reportEls.what.textContent = reportingType === 'comment' ? 'comment' : 'post';
    reportEls.reason.value = '';
    reportEls.status.textContent = '';
    reportEls.modal.classList.add('open');
  }
  function closeReportModal() {
    reportEls.modal.classList.remove('open');
    reportingPostId = null;
    reportingCommentId = null;
    reportingType = null;
  }
  reportEls.close.addEventListener('click', closeReportModal);
  reportEls.cancel.addEventListener('click', closeReportModal);
  reportEls.modal.addEventListener('click', (e) => {
    if (e.target === reportEls.modal) closeReportModal();
  });

  reportEls.submit.addEventListener('click', async () => {
    if (!authUserId) return alert('Sign in to submit a report.');
    const reason = reportEls.reason.value.trim();
    if (!reason) return (reportEls.status.textContent = 'Please provide a reason.');
    reportEls.submit.disabled = true;
    reportEls.status.textContent = 'Submitting…';
    try {
      const { error } = await supabase.from('Reports').insert({
        reporter_id: authUserId,
        post_id: reportingPostId || null,
        comment_id: reportingCommentId || null,
        reason: reason,
        status: 'pending',
      });
      if (error) throw error;
      reportEls.status.textContent = '✅ Report submitted. Thank you.';
      setTimeout(() => closeReportModal(), 2000);
    } catch (err) {
      console.error(err);
      reportEls.status.textContent = 'Error submitting report.';
    } finally {
      reportEls.submit.disabled = false;
    }
  });

  // My Reports page
  async function openMyReports() {
    if (!authUserId) return alert('Sign in to view your reports.');
    els.homeView.classList.add('hidden');
    reportEls.myReportsView.classList.remove('hidden');
    reportEls.myReportsList.innerHTML = '<p class="empty">Loading…</p>';
    try {
      const { data, error } = await supabase.from('Reports')
        .select('id, post_id, comment_id, reason, status, created_at')
        .eq('reporter_id', authUserId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) {
        reportEls.myReportsList.innerHTML = '<p class="empty">You haven\'t submitted any reports yet.</p>';
        return;
      }
      reportEls.myReportsList.innerHTML = data.map((r) => `
        <div class="report-item">
          <div class="report-meta">
            <span>Report #${r.id}</span>
            <span>•</span>
            <span>${esc(fmtTime(r.created_at))}</span>
          </div>
          <div class="report-reason"><strong>Reason:</strong> ${esc(r.reason)}</div>
          <span class="report-status ${r.status}">${r.status}</span>
        </div>
      `).join('');
    } catch (err) {
      console.error(err);
      reportEls.myReportsList.innerHTML = '<p class="empty">Could not load reports.</p>';
    }
  }
  reportEls.backToFeedBtn.addEventListener('click', () => {
    reportEls.myReportsView.classList.add('hidden');
    els.homeView.classList.remove('hidden');
  });

  let authUser = null, authUserId = null, currentProfile = null;
  let feedMode = 'foryou'; // 'foryou' | 'latest'
  let selectedAreaId = null;
  let areas = [];
  let searchActive = false;
  let _searchTimer = null;

  // ---- Utils ----
  const esc = (s) => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

  let _toastTimer = null;
  function showToast(msg, type = 'error', duration = 5000) {
    const t = $('toast');
    t.textContent = msg;
    t.className = `show ${type}`;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { t.className = type; }, duration);
  }
  const fmtTime = (ts) => { if (!ts) return ''; const d = new Date(ts); return isNaN(d) ? '' : d.toLocaleString(); };
  const initial = (name) => (name && name.trim() ? name.trim()[0].toUpperCase() : '?');
  const avatarHtml = (url, name, cls='') => url ? `<img class="avatar ${cls}" src="${esc(url)}" alt="" />` : `<span class="avatar ${cls}">${esc(initial(name))}</span>`;
  const cnt = (rel) => (Array.isArray(rel) && rel[0] ? rel[0].count : 0);
  const setCount = (el, delta) => { el.textContent = Math.max(0, (parseInt(el.textContent, 10) || 0) + delta); };

  // ---- Auth ----
  window.onNativeAuth = async (a, r) => { const { error } = await supabase.auth.setSession({ access_token: a, refresh_token: r }); if (error) console.error(error); };
  async function signIn() {
    if (NATIVE_AUTH) {
      window.webkit.messageHandlers.nativeAuth.postMessage({ action: 'signIn' });
      return;
    }
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
      els.userName.textContent = name;
      els.authUser.querySelector('.avatar')?.remove();
      els.authUser.insertAdjacentHTML('afterbegin', avatarHtml(authUser.user_metadata?.avatar_url, name, 'sm'));
      els.authUser.classList.remove('hidden');
      els.myReportsBtn.classList.remove('hidden');
      els.signOutBtn.classList.remove('hidden');
      els.signinPrompt.classList.add('hidden');
      els.form.classList.remove('hidden');
    } else {
      currentProfile = null;
      els.authUser.classList.add('hidden');
      els.myReportsBtn.classList.add('hidden');
      els.signOutBtn.classList.add('hidden');
      els.signinPrompt.classList.remove('hidden');
      els.form.classList.add('hidden');
    }
  }
  supabase.auth.onAuthStateChange((_e, session) => { applyAuthState(session).then(() => loadFeed()); });

  // ---- Normalization (both feed sources -> one shape) ----
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

  function postCardHtml(p) {
    const clickable = !!p.authorUserId;
    const own = authUserId && p.authorUserId === authUserId;
    const areaHtml = p.area ? `<div><span class="area-badge">${p.area.emoji ? esc(p.area.emoji) + ' ' : ''}${esc(p.area.name)}</span></div>` : '';
    const titleHtml = p.title ? `<div class="post-title">${esc(p.title)}</div>` : '';
    const tagsHtml = p.tags.length ? `<div class="tags">${p.tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : '';
    return `
      <div class="post" data-post-id="${p.id}">
        <div class="post-head">
          <span class="post-author ${clickable ? '' : 'nolink'}" ${clickable ? `data-user-id="${esc(p.authorUserId)}"` : ''}>
            ${avatarHtml(p.authorAvatar, p.authorName, 'sm')}${esc(p.authorName)}
          </span>
          <span class="post-time">${esc(fmtTime(p.created_at))}</span>
          <div class="post-menu">
            <button class="post-menu-btn" data-act="menu-toggle" data-post-id="${p.id}">⋯</button>
            <div class="post-menu-dropdown" data-menu-for="${p.id}">
              <button data-act="share">💬Share</button>
              <button data-act="bookmark">📑Bookmark</button>
              <button data-act="report" data-post-id="${p.id}">📣Report</button>
            </div>
          </div>
        </div>
        ${areaHtml}${titleHtml}
        <div class="post-content">${esc(p.content)}</div>
        ${tagsHtml}
        <div class="post-actions">
          <button class="act like ${p.liked ? 'on' : ''}" data-act="like" data-post-id="${p.id}">♥ <span class="like-count">${p.likeCount}</span></button>
          <button class="act dislike ${p.disliked ? 'on' : ''}" data-act="dislike" data-post-id="${p.id}" title="Not for me">👎</button>
          <button class="act" data-act="toggle-comments" data-post-id="${p.id}">💬 <span class="comment-count">${p.commentCount}</span></button>
          ${own ? `<button class="act del" data-act="del-post" data-post-id="${p.id}">🗑 Delete</button>` : ''}
        </div>
        <div class="comments hidden" data-comments-for="${p.id}"></div>
      </div>`;
  }

  function renderInto(container, items) {
    container.innerHTML = items.length ? items.map(postCardHtml).join('') : '<p class="empty">No posts yet — be the first to share!</p>';
  }

  // Reaction sets (own rows only) for the Latest feed.
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
    if (searchActive) return;
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
    renderInto(els.posts, (data || []).map((r) => fromRest(r, likedSet, dislikedSet)));
  }

  // ---- Announcements (pinned at the very top of everyone's feed) ----
  const DISMISS_KEY = 'ce_dismissed_announcements';
  const dismissed = () => { try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')); } catch { return new Set(); } };
  const dismiss = (id) => { try { const s = dismissed(); s.add(id); localStorage.setItem(DISMISS_KEY, JSON.stringify([...s])); } catch {} };

  async function loadAnnouncements() {
    const { data, error } = await supabase.from('Announcements')
      .select('id, title, content, created_at').eq('active', true).order('created_at', { ascending: false }).limit(5);
    if (error) { console.error(error); return; }
    const hidden = dismissed();
    const items = (data || []).filter((a) => !hidden.has(a.id));
    els.announcements.innerHTML = items.map((a) => `
      <div class="announcement" data-ann-id="${a.id}">
        <button class="ann-dismiss" data-act="dismiss-ann" data-ann-id="${a.id}" title="Dismiss">×</button>
        <div class="ann-label">📢 ANNOUNCEMENT</div>
        ${a.title ? `<div class="ann-title">${esc(a.title)}</div>` : ''}
        <div class="ann-body">${esc(a.content)}</div>
        <div class="ann-time">${esc(fmtTime(a.created_at))}</div>
      </div>`).join('');
  }

  els.tabForYou.addEventListener('click', () => { feedMode = 'foryou'; els.tabForYou.classList.add('active'); els.tabLatest.classList.remove('active'); loadFeed(); });
  els.tabLatest.addEventListener('click', () => { feedMode = 'latest'; els.tabLatest.classList.add('active'); els.tabForYou.classList.remove('active'); loadFeed(); });

  // ---- Areas ----
  async function loadAreas() {
    const { data, error } = await supabase.from('Areas').select('id, name, emoji').order('name');
    if (error) { console.error('Areas load failed', error); return; }
    areas = data || [];
    renderAreaStrip();
    populateAreaSelect();
    if (areas.length) {
      els.areaStripWrap?.classList.remove('hidden');
      els.areaStrip.classList.remove('hidden');
    }
  }

  function renderAreaStrip() {
    els.areaStrip.innerHTML =
      `<button class="area-tab ${selectedAreaId === null ? 'active' : ''}" data-area-id="">All</button>` +
      areas.map((a) => `<button class="area-tab ${selectedAreaId === a.id ? 'active' : ''}" data-area-id="${a.id}">${a.emoji ? esc(a.emoji) + ' ' : ''}${esc(a.name)}</button>`).join('') +
      `<button class="suggest-area-btn">+ Suggest area</button>`;
  }

  function populateAreaSelect() {
    if (!els.areaSelect) return;
    els.areaSelect.innerHTML = `<option value="">📌 No area</option>` +
      areas.map((a) => `<option value="${a.id}">${a.emoji ? a.emoji + ' ' : ''}${esc(a.name)}</option>`).join('');
  }

  els.areaStrip.addEventListener('click', (e) => {
    const tab = e.target.closest('.area-tab');
    if (tab) {
      selectedAreaId = tab.dataset.areaId ? parseInt(tab.dataset.areaId, 10) : null;
      renderAreaStrip();
      loadFeed();
      return;
    }
    if (e.target.closest('.suggest-area-btn')) openSuggestAreaModal();
  });

  // ---- Search ----
  function toggleSearch() {
    if (els.searchBar.classList.contains('hidden')) {
      els.searchBar.classList.remove('hidden');
      els.searchInput.focus();
    } else {
      clearSearch();
    }
  }

  function clearSearch() {
    els.searchInput.value = '';
    els.searchBar.classList.add('hidden');
    if (searchActive) {
      searchActive = false;
      els.feedToggle.classList.remove('hidden');
      if (areas.length) {
        els.areaStripWrap?.classList.remove('hidden');
        els.areaStrip.classList.remove('hidden');
      }
      loadFeed();
    }
  }

  function handleSearchInput() {
    clearTimeout(_searchTimer);
    const q = els.searchInput.value.trim();
    if (!q) {
      if (searchActive) {
        searchActive = false;
        els.feedToggle.classList.remove('hidden');
        if (areas.length) {
          els.areaStripWrap?.classList.remove('hidden');
          els.areaStrip.classList.remove('hidden');
        }
        loadFeed();
      }
      return;
    }
    _searchTimer = setTimeout(() => runSearch(q), 350);
  }

  async function runSearch(q) {
    searchActive = true;
    els.feedToggle.classList.add('hidden');
    els.areaStripWrap?.classList.add('hidden');
    els.areaStrip.classList.add('hidden');
    els.posts.innerHTML = '<p class="empty">Searching…</p>';
    const [postsRes, usersRes] = await Promise.all([
      supabase.from('Posts').select(REST_SELECT)
        .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
        .neq('status', 'removed').order('created_at', { ascending: false }).limit(30),
      supabase.from('Users').select('"creator-id", Name, avatar_url, user_id')
        .ilike('Name', `%${q}%`).limit(8),
    ]);
    const posts = postsRes.data || [];
    const users = usersRes.data || [];
    const ids = posts.map((p) => p['post-id']);
    const [likedSet, dislikedSet] = await Promise.all([
      getReactionSet('Likes', 'post_id', ids),
      getReactionSet('Dislikes', 'post_id', ids),
    ]);
    let html = '';
    if (users.length) {
      html += `<div class="search-heading">People</div>` +
        users.map((u) => `<div class="user-result" data-user-id="${esc(u.user_id)}">${avatarHtml(u.avatar_url, u.Name, 'sm')}<span class="user-result-name">${esc(u.Name || 'Member')}</span></div>`).join('');
    }
    if (posts.length) {
      html += `<div class="search-heading">Posts</div>` +
        posts.map((r) => postCardHtml(fromRest(r, likedSet, dislikedSet))).join('');
    }
    if (!users.length && !posts.length) html = `<p class="empty">No results for "${esc(q)}"</p>`;
    els.posts.innerHTML = html;
  }

  els.searchToggle.addEventListener('click', toggleSearch);
  els.searchClear.addEventListener('click', clearSearch);
  els.searchInput.addEventListener('input', handleSearchInput);
  els.searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') clearSearch(); });

  // ---- Suggest area ----
  const suggestAreaModal = $('suggestAreaModal');

  function openSuggestAreaModal() {
    $('suggestAreaName').value = '';
    $('suggestAreaReason').value = '';
    $('suggestAreaStatus').textContent = '';
    suggestAreaModal.classList.add('open');
  }
  function closeSuggestAreaModal() { suggestAreaModal.classList.remove('open'); }

  $('suggestAreaClose').addEventListener('click', closeSuggestAreaModal);
  $('suggestAreaCancel').addEventListener('click', closeSuggestAreaModal);
  suggestAreaModal.addEventListener('click', (e) => { if (e.target === suggestAreaModal) closeSuggestAreaModal(); });

  $('suggestAreaSubmit').addEventListener('click', async () => {
    const name = $('suggestAreaName').value.trim();
    if (!name) { $('suggestAreaStatus').textContent = 'Please enter an area name.'; return; }
    $('suggestAreaSubmit').disabled = true;
    $('suggestAreaStatus').textContent = 'Submitting…';
    try {
      const { error } = await supabase.from('AreaSuggestions').insert({
        name, reason: $('suggestAreaReason').value.trim() || null, suggested_by: authUserId || null,
      });
      if (error) throw error;
      $('suggestAreaStatus').textContent = '✅ Suggestion submitted! Thanks.';
      setTimeout(() => closeSuggestAreaModal(), 2000);
    } catch (err) {
      console.error(err);
      $('suggestAreaStatus').textContent = 'Error submitting suggestion.';
    } finally {
      $('suggestAreaSubmit').disabled = false;
    }
  });

  // ---- Secret admin announcement command ----
  async function handleAdminCommand(content, title) {
    const lines = content.split('\n');
    const parts = lines[0].trim().split(/\s+/);
    const cmd = parts[0];
    const code = parts[1] || '';
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

  // ---- Compose (auto-tag after posting) ----
  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = els.title.value.trim(), content = els.content.value.trim();
    if (!content) return;
    if (!currentProfile) { els.status.textContent = 'Please sign in first.'; return; }

    // Secret admin command: /announce <code>  (announcement text on the next lines,
    // title from the Title box). /clear <code> removes the current banner.
    // The code rotates on every successful use.
    if (content.startsWith('/announce') || content.startsWith('/clear')) {
      await handleAdminCommand(content, title);
      return;
    }

    els.postBtn.disabled = true; els.status.textContent = 'Posting…';
    try {
      const areaId = els.areaSelect ? (parseInt(els.areaSelect.value, 10) || null) : null;
      const { data, error } = await supabase.from('Posts')
        .insert({ title: title || null, content, 'creator-id': currentProfile['creator-id'], area_id: areaId })
        .select('"post-id"').single();
      if (error) throw error;
      els.content.value = ''; els.title.value = '';
      els.status.textContent = 'Posted! Tagging…';
      // Auto-tag (non-blocking); refresh once tags are in.
      try { await supabase.functions.invoke('tag-post', { body: { post_id: data['post-id'] } }); }
      catch (tagErr) { console.warn('tagging failed', tagErr); }
      els.status.textContent = 'Posted!'; setTimeout(() => (els.status.textContent = ''), 2000);
      loadFeed();
    } catch (err) { els.status.textContent = 'Something went wrong.'; console.error(err); }
    finally { els.postBtn.disabled = false; }
  });

  // ---- Likes / Dislikes (dislike count is never shown) ----
  async function toggleLike(postId, card) {
    if (!authUserId) return alert('Sign in to react.');
    const likeBtn = card.querySelector('[data-act="like"]');
    const disBtn = card.querySelector('[data-act="dislike"]');
    const countEl = likeBtn.querySelector('.like-count');
    try {
      if (likeBtn.classList.contains('on')) {
        const { error } = await supabase.from('Likes').delete().eq('post_id', postId).eq('user_id', authUserId);
        if (error) throw error;
        likeBtn.classList.remove('on'); setCount(countEl, -1);
      } else {
        const { error } = await supabase.from('Likes').insert({ post_id: postId, user_id: authUserId });
        if (error) throw error;
        likeBtn.classList.add('on'); setCount(countEl, +1);
        if (disBtn.classList.contains('on')) {
          await supabase.from('Dislikes').delete().eq('post_id', postId).eq('user_id', authUserId);
          disBtn.classList.remove('on');
        }
      }
    } catch (err) { console.error('like failed', err); }
  }

  async function toggleDislike(postId, card) {
    if (!authUserId) return alert('Sign in to react.');
    const likeBtn = card.querySelector('[data-act="like"]');
    const disBtn = card.querySelector('[data-act="dislike"]');
    const countEl = likeBtn.querySelector('.like-count');
    try {
      if (disBtn.classList.contains('on')) {
        const { error } = await supabase.from('Dislikes').delete().eq('post_id', postId).eq('user_id', authUserId);
        if (error) throw error;
        disBtn.classList.remove('on');
      } else {
        const { error } = await supabase.from('Dislikes').insert({ post_id: postId, user_id: authUserId });
        if (error) throw error;
        disBtn.classList.add('on');
        if (likeBtn.classList.contains('on')) {
          await supabase.from('Likes').delete().eq('post_id', postId).eq('user_id', authUserId);
          likeBtn.classList.remove('on'); setCount(countEl, -1);
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
        ${avatarHtml(u.avatar_url, name, 'sm')}
        <div class="c-body">
          <span class="c-author ${uid ? '' : 'nolink'}" ${uid ? `data-user-id="${esc(uid)}"` : ''}>${esc(name)}</span>
          <span class="c-time">${esc(fmtTime(c.created_at))}</span>
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
    document.querySelectorAll(`[data-post-id="${postId}"]`).forEach((card) => {
      const span = card.querySelector('.comment-count'); if (span) setCount(span, delta);
    });
  }

  // ---- Delete post ----
  async function deletePost(postId) {
    if (!confirm('Delete this post? This also removes its likes and comments.')) return;
    try {
      const { error } = await supabase.from('Posts').delete().eq('post-id', postId);
      if (error) throw error;
      document.querySelector(`.post[data-post-id="${postId}"]`)?.remove();
    } catch (err) { console.error(err); }
  }

  // ---- Follows / Profiles / Audiences ----
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

  async function openProfile(userId) {
    els.homeView.classList.add('hidden'); els.profileView.classList.remove('hidden');
    els.profileBody.innerHTML = '<p class="empty">Loading profile…</p>';
    const { data: prof, error } = await supabase.from('Users').select('"creator-id", Name, avatar_url, bio, user_id').eq('user_id', userId).single();
    if (error || !prof) { els.profileBody.innerHTML = '<p class="empty">Profile not found.</p>'; return; }

    const isSelf = authUserId && authUserId === userId;
    const [{ count: followers }, { count: following }, mine, audiencesRes] = await Promise.all([
      supabase.from('Follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('Follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
      authUserId ? supabase.from('Follows').select('follower_id').eq('follower_id', authUserId).eq('following_id', userId).limit(1) : Promise.resolve({ data: [] }),
      isSelf ? supabase.rpc('get_my_audiences', { lim: 8 }) : Promise.resolve({ data: [] }),
    ]);
    const isFollowing = !!(mine.data && mine.data.length);
    const audiences = (audiencesRes.data || []).map((a) => a.tag);

    let actionHtml = '';
    if (isSelf) {
      actionHtml = `<div class="profile-edit"><textarea id="bioInput" rows="2" maxlength="300" placeholder="Add a bio…">${esc(prof.bio || '')}</textarea><button class="btn-secondary" data-act="save-bio" data-user-id="${esc(userId)}">Save bio</button></div>`;
    } else if (authUserId) {
      actionHtml = `<button class="${isFollowing ? 'btn-secondary' : ''}" data-act="follow" data-user-id="${esc(userId)}" data-following="${isFollowing ? 1 : 0}">${isFollowing ? 'Following' : 'Follow'}</button>`;
    }
    const audiencesHtml = (isSelf && audiences.length)
      ? `<div class="profile-audiences"><div class="label">Your audiences (from what you engage with)</div><div class="tags" style="justify-content:center;">${audiences.map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}</div></div>`
      : '';

    els.profileBody.innerHTML = `
      <div class="profile-card">
        ${avatarHtml(prof.avatar_url, prof.Name)}
        <div class="profile-name">${esc(prof.Name || 'Member')}</div>
        ${prof.bio && !isSelf ? `<div class="profile-bio">${esc(prof.bio)}</div>` : ''}
        <div class="profile-stats"><span><b>${followers || 0}</b> followers</span><span><b>${following || 0}</b> following</span></div>
        ${audiencesHtml}
        ${actionHtml}
      </div>
      <h1 style="text-align:center; font-size:18px;">Posts</h1>
      <div id="profilePosts"><p class="empty">Loading…</p></div>`;

    const { data: posts } = await supabase.from('Posts').select(REST_SELECT).eq('creator-id', prof['creator-id']).neq('status', 'removed').order('created_at', { ascending: false }).limit(100);
    const ids = (posts || []).map((p) => p['post-id']);
    const [likedSet, dislikedSet] = await Promise.all([getReactionSet('Likes', 'post_id', ids), getReactionSet('Dislikes', 'post_id', ids)]);
    renderInto($('profilePosts'), (posts || []).map((r) => fromRest(r, likedSet, dislikedSet)));
  }
  function closeProfile() { els.profileView.classList.add('hidden'); els.homeView.classList.remove('hidden'); }
  async function saveBio(userId, btn) {
    const input = $('bioInput'); if (!input) return;
    btn.disabled = true; btn.textContent = 'Saving…';
    try { const { error } = await supabase.from('Users').update({ bio: input.value.trim() || null }).eq('user_id', userId); if (error) throw error; btn.textContent = 'Saved!'; setTimeout(() => (btn.textContent = 'Save bio'), 2000); }
    catch (err) { console.error(err); btn.textContent = 'Save bio'; } finally { btn.disabled = false; }
  }

  // ---- Event delegation ----
  els.signInBtn.addEventListener('click', signIn);
  els.signOutBtn.addEventListener('click', signOut);
  els.myReportsBtn.addEventListener('click', openMyReports);
  els.backBtn.addEventListener('click', closeProfile);
  els.authUser.addEventListener('click', () => { if (authUserId) openProfile(authUserId); });
  document.addEventListener('click', (e) => {
    const actEl = e.target.closest('[data-act]');
    if (actEl) {
      const act = actEl.dataset.act;
      const card = actEl.closest('.post');
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
        document.querySelectorAll('.post-menu-dropdown.open').forEach((d) => {
          if (d !== dropdown) d.classList.remove('open');
        });
        dropdown.classList.toggle('open');
        return;
      }
      if (act === 'report') {
        openReportModal(parseInt(actEl.dataset.postId, 10));
        return;
      }
      if (act === 'share') {
        alert('Share feature coming soon!');
        return;
      }
      if (act === 'bookmark') {
        alert('Bookmark feature coming soon!');
        return;
      }
      if (act === 'follow') return toggleFollow(actEl.dataset.userId, actEl);
      if (act === 'save-bio') return saveBio(actEl.dataset.userId, actEl);
      if (act === 'dismiss-ann') { dismiss(parseInt(actEl.dataset.annId, 10)); loadAnnouncements(); return; }
      return;
    }
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
  (async () => { const { data } = await supabase.auth.getSession(); await applyAuthState(data.session); await loadAreas(); loadFeed(); })();