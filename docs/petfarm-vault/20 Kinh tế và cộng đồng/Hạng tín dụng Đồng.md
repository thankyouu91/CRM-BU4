---
tags: [petfarm, kinh-te, tin-dung, hang, bronze]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/production.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🥉 Đồng, bronze]
---
# Hạng tín dụng Đồng

> [!summary]
> 🥉 Hạng **Đồng** (`bronze`) của [[Điểm tín dụng]]: điểm 300–549. Hạn mức vay tối đa **500 xu**, phụ phí lãi **1,5%/ngày** cộng trên lãi suất cơ bản.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Điểm tối thiểu | 0 (thực tế điểm thấp nhất là 300) | `petdex/server/rules/production.js:184` |
| Hạn mức hạng | 500 xu | `petdex/server/rules/production.js:184` |
| Phụ phí lãi | 0,015/ngày | `petdex/server/rules/production.js:184` |
| Lãi vay/ngày với lãi cơ bản 0,3% | 1,8% (chưa tính phụ phí lạm phát) | `petdex/server/rules/production.js:195` |
| Lên hạng Bạc | đạt 550 điểm | `petdex/server/rules/production.js:185` |
| Điểm khởi đầu của mọi người chơi | 500 (hạng Đồng) | `petdex/server/rules/production.js:182` |

Hạn mức thực tế = `min(500, 3 × thu nhập TB 7 ngày + 50% tiết kiệm) − dư nợ` (`petdex/server/rules/production.js:198-200`).

## Liên quan
- [[Điểm tín dụng]] · [[Tín dụng và vay]] · [[Hạng tín dụng Bạc]] · [[Hạng tín dụng Vàng]] · [[Hạng tín dụng Kim cương]] · [[MOC Kinh tế và cộng đồng]]
