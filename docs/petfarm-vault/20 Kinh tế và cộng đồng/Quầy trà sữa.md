---
tags: [petfarm, kinh-te, quay-tra-sua, kinh-doanh]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/business.js, petdex/server/rules/business.js, petdex/server/jobs.js, petdex/server/routes-community.js, petdex/server/town.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🧋 Quầy trà sữa, Tea stall, Quầy]
---
# Quầy trà sữa

> [!summary]
> Doanh nghiệp đầu tiên của người chơi (cấp 4): thuê mặt bằng ở 1 trong 3 vị trí, đặt thực đơn và giá, nhập nguyên liệu vào [[Kho Sàn]], cho bé (nhà mình hoặc [[Thuê bé làm việc|bé thuê]]) đứng quầy. Khách là NPC, đến theo giờ cao điểm, uy tín, giá và các hiệu ứng thị trấn. Bán hàng được **tính bù theo từng giờ** mỗi khi xem màn hoặc lúc nửa đêm. Doanh thu là nguồn tạo xu, chịu thuế doanh thu 3% và thuế thu nhập trên lợi nhuận.

## Mở quầy
- Cần bé cấp 4 (`UNLOCKS.business`), mỗi người 1 quầy, tên 2–24 ký tự (`petdex/server/routes-community.js:25-28`, `petdex/server/business.js:164-170`).
- Trả giấy phép `round(license × chỉ số giá)`; thực đơn ban đầu chỉ có Trà sữa trân châu ở giá tham chiếu; báo "🎉 Khai trương … Nhập nguyên liệu vào kho và cho bé trực quầy để bắt đầu bán." (`petdex/server/business.js:171-176`).
- Đóng quầy: tính bù tới lúc đóng, giấy phép **không hoàn**, tin tuyển dụng đóng (`petdex/server/business.js:241-249`).

| Vị trí | Giấy phép | Thuê/đêm | Khách gốc | Quảng cáo 6 giờ | Ghi chú |
|---|---|---|---|---|---|
| 🏮 [[Quầy ở Hẻm nhỏ]] | 1.500 | 40 | 8 | 100 | `petdex/server/rules/business.js:6` |
| 🏙️ [[Quầy ở Mặt phố]] | 5.000 | 120 | 20 | 300 | `petdex/server/rules/business.js:7` |
| 🌆 [[Quầy ở Trung tâm]] | 15.000 | 300 | 45 | 600 | `petdex/server/rules/business.js:8` |

Mọi giá nhân [[Chỉ số giá]].

## Nâng cấp (`UPGRADES`, `petdex/server/rules/business.js:21-25`)

| Nâng cấp | Hiệu quả | Giá từng cấp (× chỉ số giá) |
|---|---|---|
| Quầy pha rộng hơn (`counter`) | +4 ly/giờ mỗi bé trực | 800, 2.000 |
| Thêm món (`menu`) | +1 món trong thực đơn (2 → 6) | 500, 1.000, 2.000, 4.000 |
| Trang trí quầy (`decor`) | +10% khách mỗi cấp | 1.000, 3.000 |

Quảng cáo: `promo × chỉ số giá`, cộng 6 giờ (nối tiếp nếu đang chạy), +50% khách (`petdex/server/business.js:217-227`).

## Công thức bán hàng (`simulate`, `petdex/server/business.js:76-154`)
Với mỗi giờ (cắt theo mốc giờ tròn) từ `sim_at` tới hiện tại:
1. Chỉ bán nếu có ca trực (bảng `shifts` có `business_id`) giao với giờ đó và thực đơn không rỗng. `covered` = phần giờ được trực dài nhất.
2. **Công suất** = Σ `(7 + Khéo tay/10 + 4 × cấp quầy pha) × phần giờ trực` của các bé (`petdex/server/rules/business.js:59`).
3. **Khách muốn mua**:
```
traffic × peak(giờ VN) × uy tín × (1 + 0,1 × decor) × (promo ? 1,5 : 1) × (1 + bonus) × 0,3 × min(1,5; độ hấp dẫn TB)
× covered × U(0,85; 1,15)
```
   `peak`: 11–13h và 17–21h ×1,5; 23–6h ×0,3; còn lại ×1 (`petdex/server/rules/business.js:49-53,62-66`). `bonus` = hiệu ứng thị trấn `traffic` ([[Tòa thị chính]], [[Kinh tế vĩ mô]]) + Biển hiệu [[Hội]] (+5%/cấp) + bé **Có duyên** đang trực (+10%) + bé hành **Thủy** đang trực (+5%) (`petdex/server/business.js:107-109`, `public/ta-tua/game/js/shared/pets.js:295`).
4. **Độ hấp dẫn** từng món = `min(3, (giá tham chiếu / giá bán)^1,5)` (`petdex/server/rules/business.js:56`). Khách chia cho các món theo tỉ lệ hấp dẫn; số ly mỗi món = `min(làm tròn ngẫu nhiên(khách × hấp dẫn/tổng), số ly đủ nguyên liệu, công suất còn lại)`.
5. Trừ nguyên liệu khỏi kho chủ (FIFO), cộng doanh thu = ly × giá bán, giá vốn = ly × `unitCost` (giá gốc × chỉ số giá, không phải giá vốn thật trong kho).
6. Cập nhật [[Uy tín quầy]] sau mỗi giờ.
7. Cuối cùng theo từng ngày: ghi `business_days`, cộng `business_income`, thu thuế doanh thu 3% (`chargeTax`), nhiệm vụ "Quầy bán được 20 ly" (`petdex/server/business.js:139-153`).

Chi tiết món và giá: [[Thực đơn quầy trà sữa]].

## Quyết toán nửa đêm (`settleBusinessDay`, `petdex/server/business.js:322-345`)
- Tính bù tới 0h, trừ tiền thuê `rent × chỉ số giá` nếu ví đủ; không đủ thì `unpaid_days + 1` (không trừ một phần).
- Nợ **3 đêm liền** → đóng cửa, −40 [[Điểm tín dụng]], tin "Quầy … đóng cửa vì nợ tiền thuê 3 ngày" (`petdex/server/rules/business.js:34`).

## Báo cáo
`businessView` trả 7 ngày `business_days` với `profit = revenue − cogs − rent − wages − tax`, ca trực sắp tới, tồn kho tính theo số ly làm được mỗi món, tin tuyển dụng (`petdex/server/business.js:272-319`). Lợi nhuận dương mỗi ngày là phần `business` của [[Thuế thu nhập]].

## Lỗi người chơi thấy
"Không có vị trí này.", "Tên quầy dài 2–24 ký tự.", "Mỗi người chỉ mở một quầy.", "Bạn chưa có quầy nào.", "Thực đơn hiện có tối đa N món.", "Có món không hợp lệ.", "Mỗi món chỉ có một lần trong thực đơn.", "Giá X phải từ 1 đến Y xu.", "Không có nâng cấp này.", "Đã nâng cấp tối đa." (`petdex/server/business.js:63-215`).

## Liên quan
- [[Thực đơn quầy trà sữa]] · [[Uy tín quầy]] · [[Thuê bé làm việc]] · [[Mặt hàng nguyên liệu]] · [[Việc làm]] · [[Tính cách]] · [[Ngũ hành]]
- [[Module business]] · [[Module rules-business]] · [[MOC Kinh tế và cộng đồng]]
