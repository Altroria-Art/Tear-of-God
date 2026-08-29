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
      const { category, hashtag, userId, authorId, templateId, sort, page, limit } = categoryParam;
      const params = new URLSearchParams();

      if (category && category !== 'For You' && category !== 'Trending' && category !== 'All') {
        params.append('category', category.toLowerCase());
      }
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
export async function fetchTemplate(templateId, { light = false } = {}) {
  try {
    const url = `${API_URL}/api/templates?id=${templateId}${light ? '&fields=meta' : ''}`;
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
    return await getJSON(`${API_URL}/api/templates${queryStr ? `?${queryStr}` : ''}`);
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
    return await getJSON(`/api/categories?`);
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
    return await response.json();
  } catch (error) {
    console.error("recordTemplateView error:", error);
    return { success: false, error: 'บันทึกการเข้าชมไม่สำเร็จ' };
  }
}
