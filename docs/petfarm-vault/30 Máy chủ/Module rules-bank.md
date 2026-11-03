---
tags: [petfarm, may-chu, module, luat, ngan-hang]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/bank.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module rules-bank

> [!summary]
> `petdex/server/rules/bank.js` (37 dòng): luật thuần của ngân hàng và Ngân hàng Trung ương. Không đụng DB; [[Module bank]] gọi các hàm này. Diễn giải luật: [[Ngân hàng Trân Châu]], [[Ngân hàng Trung ương]].

## Exports
| Tên | Dòng | Nội dung |
|---|---|---|
| `BANK` | `rules/bank.js:4-10` | `savingsCap` 10.000 (phần tính lãi), `defaultRate` 0,003/ngày, `termPremium` { 3: 0,001, 7: 0,002, 14: 0,003 }, `minDeposit` 100, `targetGrowth` 0,1/tuần |
| `accrue(savings, rate, from, to)` | `rules/bank.js:15-18` | `min(max(0, savings), savingsCap) × rate × số ngày` |
| `depositPayout({ amount, rate, term_days, matures_at }, now)` | `rules/bank.js:21-24` | Đủ hạn: lãi đơn `floor(amount × rate × term_days)`; sớm: 0 |
| `policy({ growth, priceIndex })` | `rules/bank.js:31-37` | `gap = growth - 0,1`; `priceIndex × (1 + 0,3 × clamp(gap, -0,05, 0,15))`; `baseRate = clamp(0,003 - gap/20, 0,0005, 0,005)` |

## Ai dùng
`bank.js`, `routes.js` (`/catalog` gửi `termPremium`, `savingsCap`, `minDeposit`), test `rules.test.js`.

## Liên quan
- [[Module bank]] · [[Chỉ số giá]] · [[Kinh tế vĩ mô]]
