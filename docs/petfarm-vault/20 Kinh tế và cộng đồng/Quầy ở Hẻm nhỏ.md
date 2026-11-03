---
tags: [petfarm, kinh-te, quay-tra-sua, vi-tri, alley]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/business.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🏮 Hẻm nhỏ, alley]
---
# Quầy ở Hẻm nhỏ

> [!summary]
> Vị trí `alley` (🏮 **Hẻm nhỏ**) để mở [[Quầy trà sữa]]: giấy phép 1.500 xu, thuê 40 xu/đêm, lượng khách gốc 8/giờ, quảng cáo 6 giờ 100 xu. Mọi số tiền nhân [[Chỉ số giá]].

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Giấy phép (một lần, không hoàn) | 1.500 × chỉ số giá | `petdex/server/rules/business.js:6`, `petdex/server/business.js:171-173` |
| Tiền thuê mỗi đêm | 40 × chỉ số giá | `petdex/server/rules/business.js:6`, `petdex/server/business.js:328` |
| Lượng khách gốc (`traffic`) | 8 | `petdex/server/rules/business.js:6` |
| Khách mua/giờ lúc bình thường (uy tín 1, giá bằng tham chiếu) | 8 × 0,3 = 2,4 | `petdex/server/rules/business.js:62-66` |
| Giờ cao điểm 11–13h, 17–21h (×1,5) | 3,6 | `petdex/server/rules/business.js:49-53` |
| Đêm 23–6h (×0,3) | 0,7 | `petdex/server/rules/business.js:51` |
| Quảng cáo 6 giờ (+50% khách) | 100 × chỉ số giá | `petdex/server/rules/business.js:6,32-33` |
| Thưởng riêng | [[Đề xuất Xây cầu Phố–Hẻm]]: +15% khách trong 14 ngày | `petdex/server/rules/town.js:22` |

> [!tip] Hòa vốn
> Một ly trà sữa trân châu giá tham chiếu 22 xu, chi phí nguyên liệu khoảng 9,5 xu (giá gốc), lời gộp khoảng 12 xu/ly trước thuế 3%. Riêng tiền thuê 40 xu/đêm cần khoảng 4 ly/ngày; giấy phép cần thêm khoảng 125 ly.

## Liên quan
- [[Quầy trà sữa]] · [[Uy tín quầy]] · [[Thực đơn quầy trà sữa]] · [[Thuê bé làm việc]] · [[MOC Kinh tế và cộng đồng]]
