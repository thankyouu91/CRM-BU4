---
tags: [petfarm, kinh-te, khu-cong-nghiep, xuong, pearl_mill]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/production.js, petdex/server/factory.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [⚫ Xưởng bột trân châu, pearl_mill]
---
# Xưởng bột trân châu

> [!summary]
> ⚫ Loại xưởng `pearl_mill` ở [[Khu công nghiệp]]: mỗi mẻ biến **1 lô [[Củ sắn]]** thành **1 lô [[Trân châu (nguyên liệu)]]**. Xây 3.000 xu (× [[Chỉ số giá]]), cấp 1 chạy 6 mẻ/giờ khi có bé đứng máy. Biên lời theo giá gốc: 15 − 8 = **7 xu/mẻ** trước phí Sàn.

## Con số
| Cấp | Giá (xu, × chỉ số giá) | Mẻ/giờ cơ bản | Tối đa với bé kỹ năng 100 (+30%) | Thêm bé hành Kim (+10%) |
|---|---|---|---|---|
| 1 | 3.000 (xây) | 6 | 7,8 | 8,6 |
| 2 | 2.000 | 9 | 11,7 | 12,9 |
| 3 | 4.000 | 12 | 15,6 | 17,2 |
| 4 | 8.000 | 15 | 19,5 | 21,5 |

Nguồn: `petdex/server/rules/production.js:143,147-152`, `public/ta-tua/game/js/shared/pets.js:293`, `petdex/server/factory.js:85-89`.

## Ghi chú
- Giá trung bình của Trân châu trên Sàn bám theo giá Củ sắn (`meanPrice`, `petdex/server/rules/market.js:66-76`), nên biên lời của xưởng tương đối ổn định khi giá đầu vào lên xuống.
- Thành phẩm của chủ xưởng mang giá vốn bằng tổng giá vốn đầu vào chia đều (`petdex/server/factory.js:127-133`), dùng để tính lãi chốt khi bán (xem [[Thuế thu nhập]]).
- Nhận [[Gia công thuê]] được, phí 0–100 xu/mẻ.

## Liên quan
- [[Khu công nghiệp]] · [[Gia công thuê]] · [[Thuê bé làm việc]] · [[Củ sắn]] · [[Trân châu (nguyên liệu)]] · [[MOC Kinh tế và cộng đồng]]
