const TOKEN_KEY = 'petdex.token';

// Game được phục vụ ở <gốc>/game/ (WorkHub: /ta-tua/game/); API ở <gốc>/api và công viên ở <gốc>/ws.
export const BASE = location.pathname.replace(/\/game\/.*$/, '');
const params = new URLSearchParams(location.hash.slice(1));
/** Máy chủ dev của Next không chuyển tiếp WebSocket: WorkHub đưa địa chỉ ws thật vào #ws= khi chạy local. */
const WS_OVERRIDE = (() => {
  // Giữ qua các lần tải lại khung game (hash bị xóa sau khi đọc token).
  try {
    if (params.get('ws')) sessionStorage.setItem('petdex.ws', params.get('ws'));
    return sessionStorage.getItem('petdex.ws');
  } catch {
    return params.get('ws');
  }
})();
export const wsUrl = () => WS_OVERRIDE || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${BASE}/ws`;
/** Mở từ WorkHub (có token trong #token=) hay chạy độc lập. */
export const embedded = params.has('token') || Boolean(WS_OVERRIDE) || BASE !== '';

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let token = readToken();

export const session = {
  get token() {
    return token;
  },
  set token(value) {
    token = value;
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Trình duyệt chặn lưu trữ: vẫn chạy được, chỉ là phải đăng nhập lại khi tải lại trang.
    }
  },
};

/** Gọi API; có body thì gửi POST. Lỗi trả về Error mang thông báo tiếng Việt từ server. */
export async function api(path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Không kết nối được máy chủ.'), { status: res.status });
  return data;
}
