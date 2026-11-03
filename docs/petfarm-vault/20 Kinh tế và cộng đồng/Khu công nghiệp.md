---
tags: [petfarm, kinh-te, khu-cong-nghiep, xuong, san-xuat]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/factory.js, petdex/server/rules/production.js, petdex/server/routes-production.js, petdex/server/jobs.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🏭 Khu công nghiệp, Xưởng, Factory]
---
# Khu công nghiệp

> [!summary]
> Xây tối đa 2 xưởng chế biến (cấp 6) để biến hàng thô thành hàng chế biến: sấy trà, bột trân châu, đường, sữa đặc. Xưởng chỉ chạy khi có bé đứng máy (bé nhà mình hoặc [[Thuê bé làm việc|công nhân thuê]]), số mẻ/giờ theo cấp xưởng và kỹ năng bé giỏi nhất. Có thể nhận [[Gia công thuê]] cho người khác lấy phí. Thuê đất 50 xu/đêm, nợ 3 đêm thì đóng.

## 4 loại xưởng (`FACTORIES`, `petdex/server/rules/production.js:141-146`)

| Xưởng | Mỗi mẻ | Mẻ/giờ cấp 1 | Xây (× chỉ số giá) | Biên theo giá gốc |
|---|---|---|---|---|
| 🍂 [[Xưởng sấy trà]] | 2 lô [[Lá trà tươi]] → 1 lô [[Trà khô]] | 6 | 4.000 | 11 xu/mẻ |
| ⚫ [[Xưởng bột trân châu]] | 1 lô [[Củ sắn]] → 1 lô [[Trân châu (nguyên liệu)]] | 6 | 3.000 | 7 xu/mẻ |
| 🟤 [[Nhà máy đường]] | 1 lô [[Mía]] → 1 lô [[Đường nâu]] | 6 | 3.000 | 7 xu/mẻ |
| 🍼 [[Lò sữa đặc]] | 1 lô [[Sữa tươi]] → 1 lô [[Sữa đặc]] | 4 | 4.000 | 10 xu/mẻ |

## Con số (`FACTORY`, `petdex/server/rules/production.js:147`)
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Số xưởng tối đa mỗi người | 2 (`MAX_FACTORIES`, có thể 2 xưởng cùng loại) | `petdex/server/factory.js:15,150` |
| Mở khóa xây | bé cấp 6; màn Khu công nghiệp mở từ cấp 2 để gửi gia công | `petdex/server/routes-production.js:89-92,103-106`, `public/ta-tua/game/js/views/map.js:23-24` |
| Thuê đất | 50 xu/đêm × chỉ số giá | `petdex/server/factory.js:301` |
| Nâng cấp lên cấp 2, 3, 4 | 2.000, 4.000, 8.000 xu × chỉ số giá | `petdex/server/factory.js:157-168` |
| Mỗi cấp | +3 mẻ/giờ | `petdex/server/rules/production.js:147` |
| Thưởng kỹ năng | tới +30% theo trung bình (Sức mạnh + Khéo tay)/2 của bé giỏi nhất | `petdex/server/rules/production.js:150-152` |
| Bé hành Kim đứng máy (bé giỏi nhất) | +10% | `petdex/server/factory.js:87-89` |
| Phí gia công | 0–100 xu/mẻ | `petdex/server/factory.js:170-179` |

## Công thức
```
mẻ/giờ = (perHour + cấp_phụ × 3) × (1 + 0,3 × clamp((Sức mạnh + Khéo tay)/2, 0, 100) / 100)
mẻ trong giờ = làm tròn ngẫu nhiên(mẻ/giờ × covered × (bé Kim ? 1,1 : 1))
```
`cấp_phụ` = cột `level` (0 = cấp 1). `covered` = phần giờ được trực dài nhất (`petdex/server/factory.js:81-89`).

## Chạy bù (`simulateFactory`, `petdex/server/factory.js:68-138`)
1. Theo từng giờ có ca đứng máy, tính số mẻ.
2. Mẻ dành cho **đơn gia công trước** (theo thứ tự đơn), sau đó mới tới nguyên liệu trong kho chủ (giới hạn bởi số nguyên liệu có lúc bắt đầu chạy bù).
3. Thành phẩm gia công vào kho người đặt; kho người đặt đầy thì mẻ đó coi như chưa làm (nguyên liệu và phí vẫn nằm trong đơn).
4. Mẻ của chủ: trừ nguyên liệu khỏi kho (FIFO), thành phẩm mang giá vốn trung bình của nguyên liệu, nhận tới khi kho đầy.
5. Ghi `factory_days` (mẻ, mẻ gia công, thu phí gia công, thuê, lương).
- Chạy bù khi chủ mở màn, khi người gửi gia công mở màn (để đơn không đứng yên), khi đổi cấp/phí/đóng xưởng, và lúc nửa đêm (`petdex/server/factory.js:140-144,259-264,296-317`).

## Quyết toán nửa đêm (`settleFactoryDay`, `petdex/server/factory.js:296-317`)
- Thuê đất trả đủ thì `unpaid_days = 0`, không đủ thì +1.
- Nợ ≥ 3 đêm **và không còn đơn gia công chờ** → đóng xưởng, −40 [[Điểm tín dụng]], tin "… đóng cửa vì nợ tiền thuê đất".

## Lỗi người chơi thấy
"Không có loại xưởng này.", "Mỗi người có tối đa 2 xưởng.", "Xưởng đã nâng cấp tối đa.", "Phí gia công từ 0 đến 100 xu mỗi mẻ.", "Còn đơn gia công đang chờ, làm xong hoặc đợi khách hủy đã.", "Không tìm thấy xưởng của bạn." (`petdex/server/factory.js:58-237`).

> [!warning] Lệch tài liệu
> `petdex/docs/thiet-ke-mo-rong.md:57` ghi Khu công nghiệp mở ở **cấp 8**; code cho xây xưởng từ **cấp 6** và gửi gia công từ cấp 2.

## Liên quan
- [[Gia công thuê]] · [[Thuê bé làm việc]] · [[Hợp đồng cung ứng]] · [[Mặt hàng nguyên liệu]] · [[Kỹ năng]] · [[Ngũ hành]] · [[Module factory]] · [[MOC Kinh tế và cộng đồng]]
