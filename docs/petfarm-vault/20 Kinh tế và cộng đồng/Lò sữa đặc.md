---
tags: [petfarm, kinh-te, khu-cong-nghiep, xuong, dairy]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/production.js, petdex/server/factory.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🍼 Lò sữa đặc, dairy]
---
# Lò sữa đặc

> [!summary]
> 🍼 Loại xưởng `dairy` ở [[Khu công nghiệp]]: mỗi mẻ biến **1 lô [[Sữa tươi]]** thành **1 lô [[Sữa đặc]]**. Xây 4.000 xu (× [[Chỉ số giá]]), cấp 1 chạy 4 mẻ/giờ khi có bé đứng máy. Biên lời theo giá gốc: 40 − 30 = **10 xu/mẻ** trước phí Sàn.

## Con số
| Cấp | Giá (xu, × chỉ số giá) | Mẻ/giờ cơ bản | Tối đa với bé kỹ năng 100 (+30%) | Thêm bé hành Kim (+10%) |
|---|---|---|---|---|
| 1 | 4.000 (xây) | 4 | 5,2 | 5,7 |
| 2 | 2.000 | 7 | 9,1 | 10 |
| 3 | 4.000 | 10 | 13 | 14,3 |
| 4 | 8.000 | 13 | 16,9 | 18,6 |

Nguồn: `petdex/server/rules/production.js:145,147-152`, `public/ta-tua/game/js/shared/pets.js:293`, `petdex/server/factory.js:85-89`.

## Ghi chú
- Giá trung bình của Sữa đặc trên Sàn bám theo giá Sữa tươi (`meanPrice`, `petdex/server/rules/market.js:66-76`), nên biên lời của xưởng tương đối ổn định khi giá đầu vào lên xuống.
- Thành phẩm của chủ xưởng mang giá vốn bằng tổng giá vốn đầu vào chia đều (`petdex/server/factory.js:127-133`), dùng để tính lãi chốt khi bán (xem [[Thuế thu nhập]]).
- Nhận [[Gia công thuê]] được, phí 0–100 xu/mẻ.

## Liên quan
- [[Khu công nghiệp]] · [[Gia công thuê]] · [[Thuê bé làm việc]] · [[Sữa tươi]] · [[Sữa đặc]] · [[MOC Kinh tế và cộng đồng]]
