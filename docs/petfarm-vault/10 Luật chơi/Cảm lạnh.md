---
tags: [petfarm, luat-choi, suc-khoe, benh]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/production.js, petdex/server/care.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Cảm lạnh

> [!summary]
> 🤧 **Cảm lạnh** (mã `cold`) là một trong hai bệnh của bé. Bé đổ bệnh khi Sức khỏe dưới 40 (bốc 50/50 giữa hai bệnh), và chỉ khỏi khi được chữa ở [[Ốm và Phòng khám|Phòng khám]].

## Con số
| Mục | Giá trị | Nguồn |
|---|---|---|
| Phí chữa gốc | 120 xu (× [[Chỉ số giá]]) | `petdex/server/rules/production.js:20` |
| Sau [[Bảo hiểm sức khỏe]] Cơ bản (50%) | 60 xu | `petdex/server/care.js:32-36` |
| Sau Bảo hiểm Toàn diện (90%) | 12 xu (làm tròn) | `petdex/server/care.js:35` |
| Khi khỏi | +30 Sức khỏe, +2 XP, hết bệnh | `petdex/server/rules/production.js:24`, `petdex/server/care.js:57-60` |
| Xác suất mắc | 50% trong số các lần đổ bệnh | `petdex/server/game.js:192`, `petdex/server/care.js:98` |

## Ảnh hưởng
- Không đi làm, đi học, chơi mini-game, vào bếp được.
- Không tự hồi Sức khỏe; Vui vẻ tụt thêm một lần mỗi giờ (`petdex/server/game.js:173,178`).
- Tâm trạng hiện tên bệnh, biểu tượng 🤒 ([[Tâm trạng của bé]]).

## Liên quan
- [[Ốm và Phòng khám]] · [[Bảo hiểm sức khỏe]] · [[Chỉ số của bé]]
