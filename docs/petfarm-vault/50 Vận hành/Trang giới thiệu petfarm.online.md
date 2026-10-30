---
tags: [petfarm, van-hanh, website]
loai: giao-dien
trang-thai: dang-chay
nguon: [app/petfarm/page.tsx, components/tatua/meadow.tsx, components/petfarm/reveal.tsx, public/petfarm, lib/petdex-public.ts, middleware.ts]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Trang giới thiệu petfarm.online

> [!summary]
> `https://petfarm.online` là một trang duy nhất giới thiệu game (`app/petfarm/page.tsx`), dùng phông và màu trà sữa của chính game, có sáng/tối theo máy. Mọi nút *Vào chơi* mở `play.petfarm.online/server1`. Một số con số trên trang (tỷ lệ và biên độ trang phục) **đọc thẳng từ code game**, phần còn lại là chữ viết tay nên có thể lệch khi luật đổi.

## Định tuyến
- Trên `petfarm.online`, middleware rewrite `/` sang `/petfarm`; các đường khác về `/`, API trả 404, trang game chuyển sang tên miền game ([[Middleware định tuyến]]).
- `www.petfarm.online` chuyển 308 về `petfarm.online` (`middleware.ts:26`).
- Trên tên miền WorkHub, `/petfarm` là bản xem trước công khai (nằm trong `PUBLIC_PATHS`, `middleware.ts:12`).

## Metadata
| Trường | Giá trị | Nguồn |
|---|---|---|
| Tiêu đề | "Petfarm · Nuôi bé, đi làm, cùng cả phố làm giàu" | `app/petfarm/page.tsx:18` |
| Mô tả | "Game nuôi thú cưng nhiều người chơi trên trình duyệt: chăm bé, nhận ca làm, buôn bán trên Sàn và gặp bạn bè ở công viên." | `app/petfarm/page.tsx:19` |
| `metadataBase`, canonical | `SITE_ORIGIN`, `/` | `app/petfarm/page.tsx:22-26` |
| Ảnh chia sẻ | `/petfarm/og.jpg` 1200×630 | `app/petfarm/page.tsx:28-29` |
| Robots | cho index và follow | `app/petfarm/page.tsx:30` |
| Màu chủ đề | sáng `#fbf4ea`, tối `#1a1410` | `app/petfarm/page.tsx:33-38` |
| Phông | Baloo 2 (tiêu đề, 600–800), Nunito (chữ, 500–800), có bộ chữ tiếng Việt | `app/petfarm/page.tsx:15-16` |

## Các phần của trang
| Phần | Neo | Nội dung | Nguồn |
|---|---|---|---|
| Đầu trang | | logo, liên kết Cách chơi, Trang phục, Hỏi đáp, Wiki (sang `WIKI_ORIGIN`), nút Vào chơi | `app/petfarm/page.tsx:124-135` |
| Hero | | đồng cỏ động `MeadowCanvas` với các bé thật của game | `app/petfarm/page.tsx:139-161` |
| Phố Trân Châu | | ảnh bản đồ phố | `app/petfarm/page.tsx:164-172` |
| Một ngày ở phố | `#cach-choi` | Nuôi bé, Đi làm, Mini-game, Buôn bán, Gặp bạn | `app/petfarm/page.tsx:175-225` |
| Trang phục có 4 cấp | `#trang-phuc` | mỗi cấp: số dòng, biên độ "Thu nhập ca làm", tỷ lệ trong hộp cửa hàng hoặc "Từ mini-game, mã quà, Chợ Phiên"; 4 loại dòng chỉ số | `app/petfarm/page.tsx:228-268` |
| Con số | | 50 loài thú ngũ hành, 25 bậc nghề, 10 mặt hàng trên Sàn, 3 mini-game mỗi ngày | `app/petfarm/page.tsx:63-68` |
| Vào phố bằng cách nào | | Tạo tài khoản (150 xu), Có link mời, Có mã quà | `app/petfarm/page.tsx:284-308` |
| Hỏi đáp | `#hoi-dap` | 5 câu | `app/petfarm/page.tsx:55-61`, `app/petfarm/page.tsx:311-328` |
| Kêu gọi cuối | | "Bé đang chờ ở công viên." | `app/petfarm/page.tsx:331-342` |

## Con số trên trang, đối chiếu với code
| Trên trang | Code | Khớp? | Nguồn code |
|---|---|---|---|
| Tỷ lệ hộp cửa hàng: Xanh lam 68%, Xanh lục 32% | `shopShare` từ `DEFAULT_GEAR_CONFIG.odds` 60 : 28 chỉ trong `SHOP_TIERS` | tự tính | `app/petfarm/page.tsx:45-47`, `public/ta-tua/game/js/shared/gear.js:53` |
| Biên độ thu nhập theo cấp | `DEFAULT_GEAR_CONFIG.ranges[t].income` | tự tính | `app/petfarm/page.tsx:44` |
| 150 xu chào mừng | `RULES.startCoins = 150` | khớp | `petdex/server/game.js:13` |
| 50 loài thú ngũ hành | 51 loài trong danh sách, 50 có hành + linh vật Boba | khớp (Boba là linh vật, không tính) | `petdex/server/species.js` |
| 25 bậc nghề | 5 nghề × 5 bậc (`RANK_TITLES`) | khớp | `petdex/server/rules/careers.js` |
| 10 mặt hàng trên Sàn | `COMMODITIES` có 10 mã | khớp | `petdex/server/rules/market.js` |
| 3 mini-game | `GAMES`: `fishing`, `pearls`, `memory` | khớp | `public/ta-tua/game/js/shared/minigames.js` |
| Tối đa 4 bé, bé sau 200 xu | `maxPets: 4`, `adoptCost: 200` | khớp | `petdex/server/game.js:14-15` |

> [!warning] Lệch tài liệu
> Câu FAQ "Mỗi mã chỉ nhận được một lần" đúng **mỗi người** một lần; còn tổng số người nhận do "lượt mỗi mã" quyết định ([[Quản trị trang phục và mã quà]]). Trang chưa nói gì về Gia tộc, đất và thuế doanh nghiệp (ra sau, `05840b3`).

## Ảnh
Ảnh chụp thật của game trong `public/petfarm/`: `map.webp`, `room.webp`, `gear.webp`, `market.webp`, `park.webp`, `og.jpg`. README ghi chụp lại bằng Playwright khi giao diện đổi nhiều (README.md:170). Ảnh dùng `next/image` với `unoptimized` (`app/petfarm/page.tsx:88-101`).

## Liên quan
- [[Tên miền Petfarm]]
- [[Wiki người chơi]]
- [[Cấp trang phục]]
- [[Phong cách và CSS]]
- [[MOC Vận hành]]
