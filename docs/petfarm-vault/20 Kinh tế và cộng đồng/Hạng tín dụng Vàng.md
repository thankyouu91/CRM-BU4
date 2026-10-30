---
tags: [petfarm, kinh-te, tin-dung, hang, gold]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/production.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🥇 Vàng, gold]
---
# Hạng tín dụng Vàng

> [!summary]
> 🥇 Hạng **Vàng** (`gold`) của [[Điểm tín dụng]]: điểm 650–749. Hạn mức vay tối đa **8.000 xu**, phụ phí lãi **0,6%/ngày** cộng trên lãi suất cơ bản.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Điểm tối thiểu | 650 | `petdex/server/rules/production.js:186` |
| Hạn mức hạng | 8.000 xu | `petdex/server/rules/production.js:186` |
| Phụ phí lãi | 0,006/ngày | `petdex/server/rules/production.js:186` |
| Lãi vay/ngày với lãi cơ bản 0,3% | 0,9% (chưa tính phụ phí lạm phát) | `petdex/server/rules/production.js:195` |
| Lên hạng Kim cương | đạt 750 điểm | `petdex/server/rules/production.js:187` |

Hạn mức thực tế = `min(8.000, 3 × thu nhập TB 7 ngày + 50% tiết kiệm) − dư nợ` (`petdex/server/rules/production.js:198-200`).

## Liên quan
- [[Điểm tín dụng]] · [[Tín dụng và vay]] · [[Hạng tín dụng Đồng]] · [[Hạng tín dụng Bạc]] · [[Hạng tín dụng Kim cương]] · [[MOC Kinh tế và cộng đồng]]
