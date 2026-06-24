// Set your backend link!
const API_BASE = 'https://bmfbnydcanksjwquljzb.supabase.co/functions/v1/proxy-api?targetUrl=https://my-social-media-indol.vercel.app/';

// ----- POSTS -----
export async function getFeed() {
  let r = await fetch(`${API_BASE}/posts`);
  return await r.json();
}

export async function createPost(title, content, user_id) {
  let r = await fetch(`${API_BASE}/posts`, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({title, content, user_id})
  });
  return await r.json();
}

export async function deletePost(post_id) {
  await fetch(`${API_BASE}/posts/${post_id}`, {method: "DELETE"});
}

// ----- COMMENTS -----
export async function getComments(post_id) {
  let r = await fetch(`${API_BASE}/posts/${post_id}/comments`);
  return await r.json();
}
export async function addComment(post_id, content, user_id) {
  let r = await fetch(`${API_BASE}/posts/${post_id}/comments`, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({content, user_id})
  });
  return await r.json();
}
export async function deleteComment(comment_id) {
  await fetch(`${API_BASE}/comments/${comment_id}`, {method: "DELETE"});
}

// ----- ANNOUNCEMENTS -----
export async function getAnnouncements() {
  let r = await fetch(`${API_BASE}/announcements`);
  return await r.json();
}
export async function createAnnouncement(title, content) {
  let r = await fetch(`${API_BASE}/announcements`, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({title, content})
  });
  return await r.json();
}
export async function clearAnnouncements() {
  await fetch(`${API_BASE}/announcements`, {method: "DELETE"});
}

// ----- USERS / PROFILE -----
export async function signin(user_id, name, avatar_url) {
  let r = await fetch(`${API_BASE}/auth/signin`, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({user_id, name, avatar_url})
  });
  return await r.json();
}
export async function getProfile(user_id) {
  let r = await fetch(`${API_BASE}/profile/${user_id}`);
  return await r.json();
}
export async function setBio(user_id, bio) {
  let r = await fetch(`${API_BASE}/users/${user_id}`, {
    method: "PATCH", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({bio})
  });
  return await r.json();
}

// ----- LIKE/DISLIKE -----
export async function likePost(post_id, user_id) {
  await fetch(`${API_BASE}/posts/${post_id}/like`, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({user_id})
  });
}
export async function unlikePost(post_id, user_id) {
  await fetch(`${API_BASE}/posts/${post_id}/like`, {
    method: "DELETE", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({user_id})
  });
}
export async function dislikePost(post_id, user_id) {
  await fetch(`${API_BASE}/posts/${post_id}/dislike`, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({user_id})
  });
}
export async function undislkePost(post_id, user_id) {
  await fetch(`${API_BASE}/posts/${post_id}/dislike`, {
    method: "DELETE", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({user_id})
  });
}

// ----- FOLLOWS -----
export async function follow(follower_id, following_id) {
  await fetch(`${API_BASE}/follows`, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({follower_id, following_id})
  });
}
export async function unfollow(follower_id, following_id) {
  await fetch(`${API_BASE}/follows`, {
    method: "DELETE", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({follower_id, following_id})
  });
}

// ----- REPORTS -----
export async function submitReport(reporter_id, post_id, comment_id, reason) {
  let r = await fetch(`${API_BASE}/reports`, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({reporter_id, post_id, comment_id, reason})
  });
  return await r.json();
}
export async function getMyReports(user_id) {
  let r = await fetch(`${API_BASE}/reports?user_id=${user_id}`);
  return await r.json();
}
