---
tags: [petfarm, kinh-te, quay-tra-sua, vi-tri, center]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/business.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🌆 Trung tâm, center]
---
# Quầy ở Trung tâm

> [!summary]
> Vị trí `center` (🌆 **Trung tâm**) để mở [[Quầy trà sữa]]: giấy phép 15.000 xu, thuê 300 xu/đêm, lượng khách gốc 45/giờ, quảng cáo 6 giờ 600 xu. Mọi số tiền nhân [[Chỉ số giá]].

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Giấy phép (một lần, không hoàn) | 15.000 × chỉ số giá | `petdex/server/rules/business.js:8`, `petdex/server/business.js:171-173` |
| Tiền thuê mỗi đêm | 300 × chỉ số giá | `petdex/server/rules/business.js:8`, `petdex/server/business.js:328` |
| Lượng khách gốc (`traffic`) | 45 | `petdex/server/rules/business.js:8` |
| Khách mua/giờ lúc bình thường (uy tín 1, giá bằng tham chiếu) | 45 × 0,3 = 13,5 | `petdex/server/rules/business.js:62-66` |
| Giờ cao điểm 11–13h, 17–21h (×1,5) | 20,3 | `petdex/server/rules/business.js:49-53` |
| Đêm 23–6h (×0,3) | 4,1 | `petdex/server/rules/business.js:51` |
| Quảng cáo 6 giờ (+50% khách) | 600 × chỉ số giá | `petdex/server/rules/business.js:8,32-33` |

> [!tip] Hòa vốn
> Một ly trà sữa trân châu giá tham chiếu 22 xu, chi phí nguyên liệu khoảng 9,5 xu (giá gốc), lời gộp khoảng 12 xu/ly trước thuế 3%. Riêng tiền thuê 300 xu/đêm cần khoảng 25 ly/ngày; giấy phép cần thêm khoảng 1.250 ly.

## Liên quan
- [[Quầy trà sữa]] · [[Uy tín quầy]] · [[Thực đơn quầy trà sữa]] · [[Thuê bé làm việc]] · [[MOC Kinh tế và cộng đồng]]
