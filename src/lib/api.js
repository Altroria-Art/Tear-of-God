// ตั้งค่าเป็นค่าว่าง เพื่อให้ยิงไปที่เซิร์ฟเวอร์เดียวกัน
const API_URL = ''; 

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

// ==========================================
// ส่วนที่ 2: ระบบโพสต์จัดอันดับ (Rankings)
// ==========================================

export async function fetchRankings(categoryParam) {
  try {
    let url = `${API_URL}/api/rankings`;
    
    if (typeof categoryParam === 'object' && categoryParam !== null) {
      const { category, hashtag, userId } = categoryParam;
      const params = new URLSearchParams();
      
      if (category && category !== 'For You' && category !== 'Trending' && category !== 'All') {
        params.append('category', category.toLowerCase());
      }
      if (hashtag) params.append('hashtag', hashtag.replace('#', ''));
      if (userId) params.append('user_id', userId);
      
      const queryStr = params.toString();
      if (queryStr) url += `?${queryStr}`;
    } 
    else if (typeof categoryParam === 'string' && categoryParam) {
      url += `?category=${encodeURIComponent(categoryParam.toLowerCase())}`;
    }
      
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error("fetchRankings error:", error);
    return { data: [], error: 'ไม่สามารถดึงข้อมูลได้' };
  }
}

export async function fetchRanking(postId) {
  try {
    const response = await fetch(`${API_URL}/api/rankings?id=${postId}`);
    return await response.json();
  } catch (error) {
    return { data: null, error: 'ไม่สามารถดึงข้อมูลได้' };
  }
}

export async function createRanking(rankingData) {
  try {
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
    const response = await fetch(`${API_URL}/api/comments?ranking_id=${rankingId}`);
    return await response.json();
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