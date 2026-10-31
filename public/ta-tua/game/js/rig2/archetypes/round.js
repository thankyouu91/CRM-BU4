// Dáng TRÒN (round): chuột chuông, ếch, nhím, hải cẩu, cá nóc, heo, chuột chũi, heo đất (8 loài).
// Chủ sở hữu: họa sĩ dáng round. TRẠNG THÁI: CHƯA VẼ (stub).
//
// Hiện tại dùng tạm dáng biped (đứng hai chân, có tay) để loài nào cũng hiện đủ 4 hướng, không lỗi.
// Việc cần làm (đề bài ở đây; proposal.txt mục 5 bước 5 chỉ liệt kê việc này, chưa có bản mẫu): đầu và thân là một
// khối tròn, chân ngắn, tay là hai mẩu nhỏ; điểm neo đầu/mặt/cổ/lưng vẫn phải đúng để đồ đeo gắn khít. Khi vẽ xong thì
// bỏ `stub: true`. Còn là stub thì mọi sửa đổi ở biped.js cũng đổi luôn 8 loài này (không có ảnh mẫu: xem contact sheet,
// ARTIST-GUIDE mục 11).
// Hợp đồng (giống biped.js): dims, headZ(view), body { S, E, N }(ctx), head { S, E, N }(ctx), walkPose?(i, view).
import biped from './biped.js';

export default {
  ...biped,
  id: 'round',
  stub: true,
  // Thân tròn hơn, chân ngắn hơn biped một chút để bé dáng tròn không trông y như gấu.
  dims: { ...biped.dims, body: [7.6, 6.0], side: [7.2, 6.0], leg: 2.0 },
};
