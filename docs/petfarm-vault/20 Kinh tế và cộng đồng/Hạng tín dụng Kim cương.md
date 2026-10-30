---
tags: [petfarm, kinh-te, tin-dung, hang, diamond]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/production.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [💎 Kim cương, diamond]
---
# Hạng tín dụng Kim cương

> [!summary]
> 💎 Hạng **Kim cương** (`diamond`) của [[Điểm tín dụng]]: điểm 750–850. Hạn mức vay tối đa **25.000 xu**, phụ phí lãi **0,3%/ngày** cộng trên lãi suất cơ bản.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Điểm tối thiểu | 750 | `petdex/server/rules/production.js:187` |
| Hạn mức hạng | 25.000 xu | `petdex/server/rules/production.js:187` |
| Phụ phí lãi | 0,003/ngày | `petdex/server/rules/production.js:187` |
| Lãi vay/ngày với lãi cơ bản 0,3% | 0,6% (chưa tính phụ phí lạm phát) | `petdex/server/rules/production.js:195` |

Hạn mức thực tế = `min(25.000, 3 × thu nhập TB 7 ngày + 50% tiết kiệm) − dư nợ` (`petdex/server/rules/production.js:198-200`).

## Liên quan
- [[Điểm tín dụng]] · [[Tín dụng và vay]] · [[Hạng tín dụng Đồng]] · [[Hạng tín dụng Bạc]] · [[Hạng tín dụng Vàng]] · [[MOC Kinh tế và cộng đồng]]
