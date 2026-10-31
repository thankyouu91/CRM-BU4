// Dáng RỒNG / BÒ SÁT (serpent): Thanh Long, Cá Chép Rồng, Kỳ Nhông Lửa, Rồng Lửa Nhí, Hoàng Long (5 loài).
// Chủ sở hữu: họa sĩ dáng serpent. TRẠNG THÁI: CHƯA VẼ (stub).
//
// Hiện tại dùng tạm dáng biped (như rig.js cũ: rồng đứng hai chân, có tay) để loài nào cũng hiện đủ 4 hướng.
// Việc cần làm (proposal.txt mục 5): thân dài uốn lượn khi nhìn ngang, cổ dài, vảy dọc lưng;
// đây là dáng rủi ro nhất (5 bé huyền thoại/quý), nên làm thử trước. Khi vẽ xong thì bỏ `stub: true`.
// Hợp đồng (giống biped.js): dims, headZ(view), body { S, E, N }(ctx), head { S, E, N }(ctx), walkPose?(i, view).
import biped from './biped.js';

export default {
  ...biped,
  id: 'serpent',
  stub: true,
};
