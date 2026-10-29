// Cài đặt do máy chủ chứa game đặt lúc khởi động (thay cho biến môi trường, vì trên Workers không có process.env).
export const settings = {
  /** Cho đăng ký/đăng nhập trực tiếp bằng mật khẩu. WorkHub tắt: người chơi vào bằng tài khoản WorkHub hoặc link khách. */
  openSignup: false,
  /** Chế độ Tài chính nâng cao (vay trả góp). */
  advancedFinance: true,
  /** Loài khách mời cài thêm: [{ id, displayName, description, spritesheet }]. */
  guestPets: [],
};

export function configure(overrides = {}) {
  Object.assign(settings, overrides);
}
