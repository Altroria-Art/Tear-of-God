// ตั้งค่าเป็นค่าว่าง เพื่อให้ยิงไปที่เซิร์ฟเวอร์เดียวกัน
const API_URL = '';

// 📍 In-flight GET dedup — ดู docs/row-read-optimization-plan.md §4/§8: จาก trace จริงพบว่า
// URL เดียวกันถูกยิงซ้ำติดกันภายใน 2-3 วินาที 92 ครั้งจาก 855 request (เสีย 556,992 rows)
// ถ้ามี request เดียวกันค้างอยู่ (ยังไม่ resolve) ให้ใช้ promise เดิมแทนการยิง fetch ใหม่ซ้ำ —
// แก้ปัญหาได้ไม่ว่าสาเหตุต้นตอจะมาจากอะไร (context re-render, effect รีรัน, remount ฯลฯ)
const inFlightGET = new Map();

async function getJSON(url) {
  if (inFlightGET.has(url)) return inFlightGET.get(url);
  const promise = fetch(url)
    .then((response) => response.json())
    .finally(() => inFlightGET.delete(url));
  inFlightGET.set(url, promise);
  return promise;
}

// 📍 View counts we know first-hand from our own POST /api/templates (recordTemplateView).
// GET /api/templates is cacheable (docs/discover-template-view-refresh-and-tracking-plan.md) —
// right after this tab records a view, a browser-cached list response can still report the
// pre-view number, which is exactly the "Discover shows stale Views" bug. We remember the
// authoritative count the server just handed back and merge it over any list response that is
// behind. Views only ever grow, so the larger of the two numbers is always the fresher one, and
// the entry deletes itself the moment the server response catches up — it can never pin a
// permanently wrong number, and the map cannot grow unbounded. In-memory only, per tab, never
// persisted.
const freshViewCounts = new Map(); // template_id -> view_count observed from our own POST

function rememberViewCount(templateId, viewCount) {
  if (templateId == null || viewCount == null) return;
  freshViewCounts.set(templateId, viewCount);
}

function applyFreshViewCounts(result) {
  if (!result?.data || freshViewCounts.size === 0) return result;
  // Build new objects — getJSON hands the SAME parsed object to every concurrent caller of the
  // same URL, so mutating it in place here would leak across every other consumer of that
  // response (e.g. Discover's two sections both reading the one fetchTemplates() result).
  const data = result.data.map((t) => {
    const fresh = freshViewCounts.get(t.id);
    if (fresh == null) return t;
    if (fresh <= (t.view_count ?? 0)) {
      // Server has caught up (or moved past, e.g. someone else also viewed it since) — stop overriding.
      freshViewCounts.delete(t.id);
      return t;
    }
    return { ...t, view_count: fresh };
  });
  return { ...result, data };
}

// ==========================================
// ส่วนที่ 1: ระบบสมาชิก (Auth)
// ==========================================

export async function registerUser({ email, password, username }) {
  try {
    const response = await fetch(`${API_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', email, password, username })
    });
    return await response.json();
  } catch (error) {
    return { data: null, error: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' };
  }
}

export async function loginUser({ email, password }) {
  try {
    const response = await fetch(`${API_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password })
    });
    return await response.json();
  } catch (error) {
    return { data: null, error: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' };
  }
}

export async function syncGoogleUser(userData) {
  try {
    const response = await fetch(`${API_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'google_sync', ...userData })
    });
    return await response.json();
  } catch (error) {
    return { data: null, error: 'ซิงค์ข้อมูลไม่สำเร็จ' };
  }
}

// 📍 [เพิ่มใหม่]: ฟังก์ชันสำหรับอัปเดตโปรไฟล์
export async function updateProfile(userId, profileData) {
  try {
    const response = await fetch(`${API_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_profile', user_id: userId, ...profileData })
    });
    return await response.json();
  } catch (error) {
    return { data: null, error: 'อัปเดตโปรไฟล์ไม่สำเร็จ' };
  }
}

// 📍 [เพิ่มใหม่]: ฟังก์ชันสำหรับอัปโหลดไฟล์รูปภาพไป R2
export async function uploadImage(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      body: formData // ไม่ต้องตั้ง Content-Type เอง fetch จะจัดการ multipart form boundary ให้
    });
    return await response.json();
  } catch (error) {
    return { error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่ออัปโหลดรูปภาพได้' };
  }
}

// ==========================================
// ส่วนที่ 2: ระบบโพสต์จัดอันดับ (Rankings)
// ==========================================

export async function fetchRankings(categoryParam) {
  try {
    let url = `${API_URL}/api/rankings`;
    
    if (typeof categoryParam === 'object' && categoryParam !== null) {
      const { category, hashtag, userId, authorId, templateId, sort, page, limit, feedType } = categoryParam;
      const params = new URLSearchParams();

      if (category && category !== 'For You' && category !== 'Trending' && category !== 'All') {
        params.append('category', category.toLowerCase());
      }
      if (feedType) params.append('feed_type', feedType);
      if (hashtag) params.append('hashtag', hashtag.replace('#', ''));
      if (userId) params.append('user_id', userId);
      // authorId = กรองเฉพาะโพสต์ของผู้ใช้คนนี้ (ใช้ตอนดูโปรไฟล์คนอื่น)
      if (authorId) params.append('author_id', authorId);
      if (templateId) params.append('template_id', templateId);
      if (sort) params.append('sort', sort);
      if (page) params.append('page', page);
      if (limit) params.append('limit', limit);

      const queryStr = params.toString();
      if (queryStr) url += `?${queryStr}`;
    } 
    else if (typeof categoryParam === 'string' && categoryParam) {
      url += `?category=${encodeURIComponent(categoryParam.toLowerCase())}`;
    }
      
    return await getJSON(url);
  } catch (error) {
    console.error("fetchRankings error:", error);
    return { data: [], error: 'ไม่สามารถดึงข้อมูลได้' };
  }
}

export async function fetchRanking(postId, userId) {
  try {
    let url = `${API_URL}/api/rankings?id=${postId}`;
    if (userId) url += `&user_id=${userId}`;
    return await getJSON(url);
  } catch (error) {
    return { data: null, error: 'ไม่สามารถดึงข้อมูลได้' };
  }
}

// 📍 ดึงโปรไฟล์สาธารณะของผู้ใช้ (ใช้ตอนเปิดดูโปรไฟล์คนอื่นจากหน้าฟีด/โพสต์)
export async function fetchUserProfile(userId, viewerId = null) {
  try {
    const url = `${API_URL}/api/users?id=${encodeURIComponent(userId)}${viewerId ? `&viewer_id=${encodeURIComponent(viewerId)}` : ''}`;
    return await getJSON(url);
  } catch (error) {
    console.error("fetchUserProfile error:", error);
    return { data: null, error: 'ไม่สามารถดึงข้อมูลโปรไฟล์ได้' };
  }
}

export async function toggleFollow(followerId, followingId, isFollowing) {
  try {
    const response = await fetch(`${API_URL}/api/follows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: isFollowing ? 'unfollow' : 'follow', follower_id: followerId, following_id: followingId })
    });
    return await response.json();
  } catch (error) {
    return { error: 'ไม่สามารถทำรายการได้' };
  }
}

export async function fetchFollowList(userId, type) {
  try {
    const url = `${API_URL}/api/follows?user_id=${encodeURIComponent(userId)}&type=${encodeURIComponent(type)}`;
    return await getJSON(url);
  } catch (error) {
    console.error("fetchFollowList error:", error);
    return { data: [], error: 'ไม่สามารถดึงข้อมูลได้' };
  }
}

export async function createRanking(rankingData) {  try {
    const response = await fetch(`${API_URL}/api/rankings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rankingData)
    });
    
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
       return { data: null, error: 'หา API ไม่เจอ กรุณารันด้วยคำสั่ง npx wrangler pages dev dist --local' };
    }

    const result = await response.json();
    if (result.error) {
       return { data: null, error: result.error };
    }
    
    return { data: result.data, error: null };
  } catch (error) {
    console.error("createRanking error:", error);
    return { data: null, error: 'ไม่สามารถบันทึกข้อมูลได้' };
  }
}

// ==========================================
// ส่วนที่ 3: ระบบโหวต และ คอมเมนต์ (Interactive)
// ==========================================

export async function voteRanking({ rankingId, userId, voteType }) {
  try {
    const response = await fetch(`${API_URL}/api/votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rankingId, userId, voteType })
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' };
  }
}

export async function fetchComments(rankingId) {
  try {
    return await getJSON(`${API_URL}/api/comments?ranking_id=${rankingId}`);
  } catch (error) {
    return { data: [], error: 'ไม่สามารถดึงคอมเมนต์ได้' };
  }
}

export async function createComment({ ranking_id, user_id, content }) {
  try {
    const response = await fetch(`${API_URL}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ranking_id, user_id, content })
    });
    return await response.json();
  } catch (error) {
    return { data: null, error: 'ไม่สามารถสร้างคอมเมนต์ได้' };
  }
}

// ==========================================
// ส่วนที่ 4: ระบบเทมเพลต (Templates)
// ==========================================

// 📍 light=true = โหมด ?fields=meta (ข้าม community_average) ใช้เมื่อต้องการแค่
// title/description/tiers/template_items — ดู docs/row-read-optimization-plan.md §5/§8, C6
// period: { days } หรือ { from, to } — กรอง Community Average ตามช่วงเวลา popularity
export async function fetchTemplate(templateId, { light = false, period = null } = {}) {
  try {
    let url = `${API_URL}/api/templates?id=${templateId}${light ? '&fields=meta' : ''}`;
    if (period?.days != null) url += `&days=${period.days}`;
    if (period?.from) url += `&from=${encodeURIComponent(period.from)}`;
    if (period?.to) url += `&to=${encodeURIComponent(period.to)}`;
    return await getJSON(url);
  } catch (error) {
    console.error("fetchTemplate error:", error);
    return { data: null, error: 'ไม่สามารถดึงข้อมูลเทมเพลตได้' };
  }
}

export async function fetchTemplates({ hashtag, category, limit, page, sort } = {}) {
  try {
    const params = new URLSearchParams();
    if (hashtag) params.append('hashtag', hashtag.replace('#', ''));
    if (category) params.append('category', category.toLowerCase());
    if (limit) params.append('limit', limit);
    if (page) params.append('page', page);
    if (sort) params.append('sort', sort);

    const queryStr = params.toString();
    const result = await getJSON(`${API_URL}/api/templates${queryStr ? `?${queryStr}` : ''}`);
    return applyFreshViewCounts(result);
  } catch (error) {
    console.error("fetchTemplates error:", error);
    return { data: [], error: 'ไม่สามารถดึงข้อมูลเทมเพลตได้' };
  }
}

// ดึงรายการ hashtag ทั้งหมด พร้อมจำนวน template ที่ติดแท็กนั้น (แบ่งหน้า)
export async function fetchCategories({ limit } = {}) {
  const queryStr = new URLSearchParams();
  if (limit) queryStr.append('limit', limit);
  try {
    const qs = queryStr.toString();
    return await getJSON(`${API_URL}/api/categories${qs ? `?${qs}` : ''}`);
  } catch (error) {
    console.error('fetchCategories error:', error);
    return [];
  }
}

export async function fetchHashtags({ page, limit, sort, q } = {}) {
  try {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    if (sort) params.append('sort', sort);
    if (q) params.append('q', q);

    const queryStr = params.toString();
    return await getJSON(`${API_URL}/api/hashtags${queryStr ? `?${queryStr}` : ''}`);
  } catch (error) {
    console.error("fetchHashtags error:", error);
    return { data: [], error: 'ไม่สามารถดึงข้อมูลแฮชแท็กได้' };
  }
}

// นับ view ให้ template — ฝั่ง API จะนับให้แค่ครั้งแรกที่ user คนนี้เปิดดู template นี้เท่านั้น
export async function recordTemplateView(templateId, userId) {
  try {
    const response = await fetch(`${API_URL}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId, user_id: userId })
    });
    const json = await response.json();
    // จำเลข views ล่าสุดที่เพิ่งได้จาก server ไว้ ให้ fetchTemplates() หน้า Discover เอาไป
    // merge ทับ response ที่อาจโดน browser cache ค้าง (ดู
    // docs/discover-template-view-refresh-and-tracking-plan.md)
    rememberViewCount(templateId, json?.views);
    return json;
  } catch (error) {
    console.error("recordTemplateView error:", error);
    return { success: false, error: 'บันทึกการเข้าชมไม่สำเร็จ' };
  }
}

// ==========================================
// like/dislike/comment ของ Community Average (ผูกกับ template_id)
// ==========================================

// อ่านสถานะโหวตของผู้ใช้ + จำนวนรวมของ Community Average นี้ (ใช้ตอนเปิดหน้าเพื่อตั้งค่าเริ่มต้นการ์ด)
export async function fetchTemplateReaction({ templateId, userId } = {}) {
  try {
    if (!templateId) return { success: true, userVote: null, likes: 0, dislikes: 0 };
    const params = new URLSearchParams();
    params.append('template_id', templateId);
    if (userId) params.append('user_id', userId);
    return await getJSON(`${API_URL}/api/template-votes?${params.toString()}`);
  } catch (error) {
    console.error("fetchTemplateReaction error:", error);
    return { success: false, userVote: null, likes: 0, dislikes: 0 };
  }
}

// โหวต/สลับ/ยกเลิก like | dislike ให้ Community Average (voteType = 'like' | 'dislike' | null)
export async function voteTemplate({ templateId, userId, voteType }) {
  try {
    const response = await fetch(`${API_URL}/api/template-votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId, user_id: userId, voteType })
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' };
  }
}

// ดึงรายการคอมเมนต์ของ Community Average
export async function fetchTemplateComments(templateId) {
  try {
    return await getJSON(`${API_URL}/api/template-comments?template_id=${templateId}`);
  } catch (error) {
    return { data: [], error: 'ไม่สามารถดึงคอมเมนต์ได้' };
  }
}

// สร้างคอมเมนต์ใหม่ให้ Community Average — คืน object ใหม่พร้อม username/avatar_url
export async function createTemplateComment({ template_id, user_id, content }) {
  try {
    const response = await fetch(`${API_URL}/api/template-comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id, user_id, content })
    });
    return await response.json();
  } catch (error) {
    return { data: null, error: 'ไม่สามารถสร้างคอมเมนต์ได้' };
  }
}

// ==========================================
// ระบบแอดมิน (Admin)
// ==========================================

// 📍 ดึงสถิติภาพรวมของระบบ (ใช้กับหน้า Dashboard ของแอดมิน) — ส่ง user_id ของแอดมินไปด้วย
// ฝั่ง backend จะตรวจ role จาก DB ทุกครั้ง (functions/api/admin/_check.js) ถ้าไม่ใช่ admin คืน 403
export async function fetchAdminStats(userId) {
  try {
    const url = `${API_URL}/api/admin?action=stats&user_id=${encodeURIComponent(userId)}`;
    return await getJSON(url);
  } catch (error) {
    console.error("fetchAdminStats error:", error);
    return { data: null, error: 'ไม่สามารถดึงสถิติได้' };
  }
}

// 📍 ดึงรายชื่อผู้ใช้สำหรับหน้าแอดมิน (ค้นหา + แบ่งหน้า)
export async function fetchAdminUsers({ userId, q, page, limit } = {}) {
  try {
    const params = new URLSearchParams();
    params.append('user_id', userId);
    if (q) params.append('q', q);
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    return await getJSON(`${API_URL}/api/admin/users?${params.toString()}`);
  } catch (error) {
    console.error("fetchAdminUsers error:", error);
    return { data: [], error: 'ไม่สามารถดึงรายชื่อผู้ใช้ได้' };
  }
}

// 📍 ตั้งบทบาท admin/user ให้ผู้ใช้
export async function setUserRole({ userId, targetId, role }) {
  try {
    const response = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_role', user_id: userId, target_id: targetId, role })
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: 'ไม่สามารถตั้งบทบาทได้' };
  }
}

// 📍 ลบผู้ใช้
export async function deleteAdminUser({ userId, targetId }) {
  try {
    const response = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', user_id: userId, target_id: targetId })
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: 'ไม่สามารถลบผู้ใช้ได้' };
  }
}

// 📍 ดึงรายการ ranking สำหรับหน้าแอดมิน (ค้นหา + แบ่งหน้า)
export async function fetchAdminRankings({ userId, q, page, limit } = {}) {
  try {
    const params = new URLSearchParams();
    params.append('user_id', userId);
    if (q) params.append('q', q);
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    return await getJSON(`${API_URL}/api/admin/rankings?${params.toString()}`);
  } catch (error) {
    console.error("fetchAdminRankings error:", error);
    return { data: [], error: 'ไม่สามารถดึงรายการโพสต์ได้' };
  }
}

// 📍 ลบ ranking/โพสต์
export async function deleteAdminRanking({ userId, targetId }) {
  try {
    const response = await fetch(`${API_URL}/api/admin/rankings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', user_id: userId, target_id: targetId })
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: 'ไม่สามารถลบโพสต์ได้' };
  }
}

// 📍 ดึงรายการ template สำหรับหน้าแอดมิน (ค้นหา + แบ่งหน้า)
export async function fetchAdminTemplates({ userId, q, page, limit } = {}) {
  try {
    const params = new URLSearchParams();
    params.append('user_id', userId);
    if (q) params.append('q', q);
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    return await getJSON(`${API_URL}/api/admin/templates?${params.toString()}`);
  } catch (error) {
    console.error("fetchAdminTemplates error:", error);
    return { data: [], error: 'ไม่สามารถดึงรายการเทมเพลตได้' };
  }
}

// 📍 ลบ template
export async function deleteAdminTemplate({ userId, targetId }) {
  try {
    const response = await fetch(`${API_URL}/api/admin/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', user_id: userId, target_id: targetId })
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: 'ไม่สามารถลบเทมเพลตได้' };
  }
}

// ==========================================
// ระบบรายงาน template (Report)
// ==========================================

// 📍 รายงาน template (ผู้ใช้ทั่วไป) — แจ้งแอดมินว่าเทมเพลตไม่เหมาะสม
export async function reportTemplate({ templateId, reporterId, reason }) {
  try {
    const response = await fetch(`${API_URL}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId, reporter_id: reporterId, reason })
    });
    return { status: response.status, ...(await response.json()) };
  } catch (error) {
    return { success: false, error: 'ไม่สามารถรายงานได้' };
  }
}

// 📍 รายงานโพสต์ (ranking) — แจ้งแอดมินว่าโพสต์/ranking นั้นไม่เหมาะสม
export async function reportPost({ postId, reporterId, reason }) {
  try {
    const response = await fetch(`${API_URL}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ranking_id: postId, reporter_id: reporterId, reason })
    });
    return { status: response.status, ...(await response.json()) };
  } catch (error) {
    return { success: false, error: 'ไม่สามารถรายงานได้' };
  }
}

// 📍 ดึงรายการรายงานสำหรับหน้าแอดมิน (กรองตามสถานะ + แบ่งหน้า)
export async function fetchAdminReports({ userId, status, page, limit } = {}) {
  try {
    const params = new URLSearchParams();
    params.append('user_id', userId);
    if (status) params.append('status', status);
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    return await getJSON(`${API_URL}/api/admin/reports?${params.toString()}`);
  } catch (error) {
    console.error("fetchAdminReports error:", error);
    return { data: [], error: 'ไม่สามารถดึงรายการรายงานได้' };
  }
}

// 📍 ตั้งสถานะรายงาน (resolved/dismissed/pending)
export async function setReportStatus({ userId, targetId, status }) {
  try {
    const response = await fetch(`${API_URL}/api/admin/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_status', user_id: userId, target_id: targetId, status })
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: 'ไม่สามารถอัปเดตสถานะได้' };
  }
}

// 📍 ลบรายงาน
export async function deleteAdminReport({ userId, targetId }) {
  try {
    const response = await fetch(`${API_URL}/api/admin/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', user_id: userId, target_id: targetId })
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: 'ไม่สามารถลบรายงานได้' };
  }
}
