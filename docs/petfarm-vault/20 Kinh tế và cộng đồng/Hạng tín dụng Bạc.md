---
tags: [petfarm, kinh-te, tin-dung, hang, silver]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/production.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🥈 Bạc, silver]
---
# Hạng tín dụng Bạc

> [!summary]
> 🥈 Hạng **Bạc** (`silver`) của [[Điểm tín dụng]]: điểm 550–649. Hạn mức vay tối đa **2.000 xu**, phụ phí lãi **1%/ngày** cộng trên lãi suất cơ bản.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Điểm tối thiểu | 550 | `petdex/server/rules/production.js:185` |
| Hạn mức hạng | 2.000 xu | `petdex/server/rules/production.js:185` |
| Phụ phí lãi | 0,01/ngày | `petdex/server/rules/production.js:185` |
| Lãi vay/ngày với lãi cơ bản 0,3% | 1,3% (chưa tính phụ phí lạm phát) | `petdex/server/rules/production.js:195` |
| Lên hạng Vàng | đạt 650 điểm | `petdex/server/rules/production.js:186` |

Hạn mức thực tế = `min(2.000, 3 × thu nhập TB 7 ngày + 50% tiết kiệm) − dư nợ` (`petdex/server/rules/production.js:198-200`).

## Liên quan
- [[Điểm tín dụng]] · [[Tín dụng và vay]] · [[Hạng tín dụng Đồng]] · [[Hạng tín dụng Vàng]] · [[Hạng tín dụng Kim cương]] · [[MOC Kinh tế và cộng đồng]]
