// Kênh sự kiện trong máy chủ: 'pet:changed' (userId) khi thú cưng của một người chơi đổi (chỉ số, đồ đeo,
// bé chính, bé mất...) để công viên cập nhật thẻ của họ. Tách riêng để module nào cũng phát được mà không vòng import.
import { EventEmitter } from 'node:events';

export const bus = new EventEmitter();
bus.setMaxListeners(50);
