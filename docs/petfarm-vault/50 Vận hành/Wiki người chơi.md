---
tags: [petfarm, van-hanh, wiki]
loai: giao-dien
trang-thai: dang-chay
nguon: [app/wiki/layout.tsx, app/wiki/page.tsx, app/wiki/[slug]/page.tsx, app/wiki/not-found.tsx, lib/wiki/index.ts, lib/wiki/articles.ts, lib/wiki/game-data.ts, lib/wiki/base.ts, lib/wiki/fold.ts, lib/wiki/types.ts, components/petfarm/wiki]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Wiki người chơi

> [!summary]
> `https://wiki.petfarm.online` ("Sổ tay Phố Trân Châu") là thư viện hướng dẫn chơi cho người chơi, phục vụ bởi `app/wiki/`. Bài viết là **dữ liệu TypeScript** trong `lib/wiki/articles.ts` (26 bài, 5 nhóm); các **bảng** đọc thẳng luật của game qua `lib/wiki/game-data.ts` nên giá và tỷ lệ luôn đúng, còn **câu chữ** viết tay nên có thể chậm hơn code. Vault này là tài liệu cho người làm game; wiki là tài liệu cho người chơi.

## Định tuyến
| Trên `wiki.petfarm.online` | Kết quả |
|---|---|
| `/` | rewrite `/wiki` |
| `/<slug>` | rewrite `/wiki/<slug>` |
| `/wiki/...` | redirect về địa chỉ ngắn |
| `/server1`, `/invitation`, `/password` | sang tên miền game |
| `/api/...` | 404 |

Nguồn: `lib/petdex-public.ts:81-86`. `wikiBase()` trả `""` khi host là tên miền wiki, `/wiki` ở chỗ khác (bản xem trước trên tên miền WorkHub), và `wikiHref(base, slug)` dựng link đúng cho từng nơi (`lib/wiki/base.ts:4-13`).

## Mô hình dữ liệu (`lib/wiki/types.ts`)
- `WikiArticle`: `slug`, `title`, `category`, `summary` (một câu cho thẻ, tìm kiếm, mô tả trang), `emoji`, `keywords?`, `sections[]`, `related?` (`lib/wiki/types.ts:56-68`).
- `WikiSection`: `id` (neo mục lục), `title`, `blocks[]`.
- `WikiBlock`: `p`, `list`, `steps`, `table {head, rows}`, `tip`, `warn`, `img {src, alt, width, height}` (`lib/wiki/types.ts:38-45`).
- Chữ trong dòng: `**đậm**` và `[chữ](slug)` để liên kết bài khác (`""` là trang chủ wiki) (`lib/wiki/types.ts:34-36`).

## Năm nhóm và 26 bài
| Nhóm (`CATEGORIES`) | Bài (slug) |
|---|---|
| 🌱 Bắt đầu (`bat-dau`) | `bat-dau`, `tai-khoan`, `moi-ngay`, `cap-do`, `hoi-dap` |
| 🐾 Nuôi bé (`nuoi-be`) | `cham-soc`, `ngu-hanh`, `cac-loai`, `tinh-cach-tuoi`, `trang-phuc`, `sieu-thi` |
| 💼 Kiếm xu (`kiem-xu`) | `viec-lam`, `truong-hoc`, `mini-game`, `vuon`, `bep` |
| 📈 Làm ăn (`kinh-te`) | `san-nguyen-lieu`, `ngan-hang`, `tin-dung`, `quay-tra-sua`, `cho-phien`, `khu-cong-nghiep`, `thue-toa-thi-chinh` |
| 🤝 Cộng đồng (`cong-dong`) | `ban-be`, `hoi`, `cong-vien` |

Nguồn: `lib/wiki/index.ts:7-13`, `lib/wiki/articles.ts:19-1152`.

## Bảng đọc từ code (`lib/wiki/game-data.ts`)
Import trực tiếp: `ITEMS` (`petdex/server/game.js`), `CAREERS`, `RANK_TITLES`, `PROMOTION`, `SKILLS` (`rules/careers.js`), `COMMODITIES` (`rules/market.js`), `LOCATIONS`, `RECIPES`, `refPrice` (`rules/business.js`), `CLASSES`, `CROPS`, `DISHES`, `FACTORIES`, `TIERS` tín dụng (`rules/production.js`), `PROPOSALS`, `QUESTS`, `GUILD_PROJECTS` (`rules/town.js`), và `pets.js`, `gear.js`, `minigames.js` dùng chung (`lib/wiki/game-data.ts:1-9`). Giá trong bảng là **giá gốc**; Ngân hàng Trung ương nhân chỉ số giá mỗi tuần (`lib/wiki/game-data.ts:11-13`). Xem [[Chỉ số giá]].

## Trang
| Trang | Có gì | Nguồn |
|---|---|---|
| Layout | phông Baloo 2 + Nunito như trang giới thiệu, logo "🧋 Petfarm Wiki", liên kết "Trang chủ game" (`SITE_ORIGIN`), nút Vào chơi (`playUrl()`) | `app/wiki/layout.tsx:1-77` |
| Trang chủ | ô tìm kiếm không cần gõ dấu, thẻ bài theo nhóm | `app/wiki/page.tsx` |
| Trang bài | `generateMetadata`, mục lục, nội dung, bài liên quan, bài trước/sau theo thứ tự `ARTICLES` | `app/wiki/[slug]/page.tsx:14-115` |
| Không có bài | `notFound()` → `app/wiki/not-found.tsx` | `app/wiki/[slug]/page.tsx:32` |

Tìm kiếm: `fold()` bỏ dấu tiếng Việt và đổi `đ` thành `d`, chữ thường; văn bản tìm gồm tiêu đề, tóm tắt, từ khóa và mọi khối của bài (`lib/wiki/fold.ts:1-2`, `lib/wiki/index.ts:18-33`).

> [!warning] Lệch tài liệu: wiki chậm hơn code
> - Wiki **chưa có bài nào** về Gia tộc, bản đồ 200 lô đất, Sở Nhà Đất, thuế doanh nghiệp hay kinh tế vĩ mô (không có chữ "gia tộc", "clan", "lô đất", "vĩ mô" trong `lib/wiki/articles.ts`), dù các hệ thống này chạy từ `05840b3` (2026-10-30). Xem [[Clan]], [[Bản đồ đất]], [[Thuế doanh nghiệp]], [[Kinh tế vĩ mô]].
> - Commit gốc `f1f04ba` ghi "23 player guide articles"; hiện có 26 bài (`grep -c 'slug: "'`).
> - Câu chữ (không phải bảng) phải sửa tay khi luật đổi; README nhắc "Khi luật chơi đổi số (giá, tỷ lệ, cấp mở khóa), sửa bài tương ứng." (README.md:171).

## Liên quan
- [[Tên miền Petfarm]]
- [[Trang giới thiệu petfarm.online]]
- [[Quy ước vault]]
- [[MOC Vận hành]]
