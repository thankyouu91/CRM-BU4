// Băm mật khẩu người chơi (scrypt, có muối). Dùng chung cho đăng ký gốc và tài khoản trên play.petfarm.online.
import * as nodeCrypto from 'node:crypto';

export function hashPassword(password, salt = nodeCrypto.randomBytes(16).toString('hex')) {
  return `${salt}:${nodeCrypto.scryptSync(password, salt, 32).toString('hex')}`;
}

/** Tài khoản chưa đặt mật khẩu (pass_hash rỗng) không bao giờ khớp. */
export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored ?? '').split(':');
  if (!salt || !hash) return false;
  return nodeCrypto.timingSafeEqual(Buffer.from(hash, 'hex'), nodeCrypto.scryptSync(password, salt, 32));
}
