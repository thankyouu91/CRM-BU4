---
tags: [petfarm, kinh-te, clan, gia-toc, cong-dong]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/clans.js, petdex/server/routes-clans.js, public/ta-tua/game/js/shared/clan.js, public/ta-tua/game/js/views/clans.js, app/(app)/ta-tua/quan-ly/clans.tsx]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Gia tộc, 🏯 Gia tộc, Gia tộc & Sở Nhà Đất, Clans]
---
# Clan

> [!summary]
> **Gia tộc** (trong game gọi là "Gia tộc", màn "🏯 Gia tộc & Sở Nhà Đất") là tầng kinh tế lớn nhất: người chơi (bé cấp 4) lập hoặc vào gia tộc, góp quỹ theo định mức tuần, gia tộc lên cấp 1–10, **thâu tóm tối đa 3 trong 11 ngành** (trả bồi thường thị trường 20.000–500.000 xu), mua lô trên [[Bản đồ đất]] 200 lô, tự lắp ghép công trình, và mỗi đêm nhận doanh thu theo đất, ngành và [[Kinh tế vĩ mô]], đóng [[Thuế doanh nghiệp]] 35–45% (tự khai, có [[Sở thuế và trốn thuế]]). Quỹ chia cổ tức đều cho thành viên.

## Vòng chơi

```mermaid
flowchart TD
  A[Bé cấp 4] --> B{Lập 3.000 xu<br/>hoặc gia nhập}
  B --> C[Góp quỹ: +1 XP/10 xu<br/>định mức 300 × cấp/tuần/người]
  C --> D[Cấp gia tộc 1-10<br/>thêm người, thêm lô, +2% sản lượng/cấp]
  D --> E[Thâu tóm ngành<br/>ngành 1 ở cấp 1, ngành 2 ở cấp 3, ngành 3 ở cấp 5]
  E --> F[Mua lô đất bằng quỹ<br/>giá theo khan hiếm × chỉ số đất]
  F --> G[Chọn ngành cho lô + lắp công trình<br/>≥3 mảnh có móng nền]
  G --> H[Nửa đêm: doanh thu vào quỹ<br/>− thuế DN − phí duy trì]
  H --> I[XP + (doanh thu − thuế)/100]
  I --> D
  H --> J[Cổ tức chia đều cho thành viên]
  H --> K[Cuối tháng: hoàn 15% thuế]
```

## Lập, gia nhập, rời

| Việc | Luật | Nguồn |
|---|---|---|
| Mở khóa | bé cấp 4 (`unlockLevel`, chỉnh 1–30) cho lập và gia nhập | `petdex/server/clans.js:20`, `petdex/server/routes-clans.js:18-28` |
| Lập | 3.000 xu (`createCost`), 50% vào ngân sách; tên 3–24 ký tự không trùng; 1 trong 12 huy hiệu 🏯 🐉 🦅 🐯 🌸 ⚓ 🔱 🏮 🌾 💎 🦚 🐋 (sai thì lấy 🏯); màu `#rrggbb` (mặc định `#c0392b`); tin "🏯 Gia tộc … ra mắt" | `petdex/server/clans.js:19,273-294`, `public/ta-tua/game/js/shared/clan.js:188` |
| Mỗi người | chỉ 1 gia tộc; "Bạn đã ở một gia tộc rồi, rời gia tộc cũ trước đã." | `petdex/server/clans.js:281,298` |
| Gia nhập | tự do tới khi đủ người: "Gia tộc đã đủ người, chờ gia tộc lên cấp nhé." | `petdex/server/clans.js:296-305` |
| Rời | tộc trưởng rời thì trưởng lão (rồi người góp nhiều nhất, rồi vào sớm nhất) lên thay; người cuối cùng rời thì **giải tán**: đất trả Sở Nhà Đất, bỏ ngành, quỹ còn lại **100% vào ngân sách**, tên đổi thành "tên #id" | `petdex/server/clans.js:133-135,307-333` |

## Vai trò

| Quyền | 👑 Tộc trưởng (`leader`) | 🎖️ Trưởng lão (`elder`) | Thành viên |
|---|---|---|---|
| Góp quỹ, rời | ✔ | ✔ | ✔ |
| Mua đất, chọn ngành cho lô, lưu công trình | ✔ | ✔ | |
| Thâu tóm ngành, khai thuế, chia cổ tức, bán đất, mời ra, phân vai | ✔ | | |

Nhường chức tộc trưởng: người cũ thành trưởng lão (`petdex/server/clans.js:346-361`). Lỗi chung: "Chỉ tộc trưởng mới được …" / "Chỉ tộc trưởng hoặc trưởng lão mới được …" (`petdex/server/clans.js:267-271`).

## Quỹ gia tộc
- Tài khoản `clan:<id>`. Góp tối thiểu 10 xu (`clan_donation`), **+1 XP mỗi 10 xu**, ghi tổng góp và góp theo tuần (`petdex/server/clans.js:363-374`).
- Chi quỹ kiểm số dư: "Quỹ gia tộc không đủ: cần X xu, quỹ còn Y xu." (`petdex/server/clans.js:189-193`).
- **Cổ tức**: tộc trưởng nhập số tiền ≥ số thành viên, mỗi người nhận `floor(số tiền / số người)` (`clan_dividend`, tính là thu nhập nhưng không chịu thuế thu nhập) (`petdex/server/clans.js:409-419`).

## Cấp và XP
Xem [[Cấp gia tộc]]. Tóm tắt: XP 0 / 2.000 / 6.000 / 15.000 / 35.000 / 70.000 / 130.000 / 230.000 / 400.000 / 700.000 cho cấp 1–10; tối đa `8 + 4 × cấp` người, `1 + 2 × cấp` lô, +2% sản lượng mỗi cấp trên 1 (`public/ta-tua/game/js/shared/clan.js:179-187`).

## Ngành
- 11 ngành: [[Ngành Trà (lá trà, trà khô)]], [[Ngành Bò sữa & sữa đặc]], [[Ngành Mía đường]], [[Ngành Sắn & trân châu]], [[Ngành Dâu tây & trái cây]], [[Ngành Thủy hải sản]], [[Ngành Chuỗi trà sữa]], [[Ngành Ẩm thực & nhà hàng]], [[Ngành Giao vận & bốc xếp]], [[Ngành Giáo dục & gia sư]], [[Ngành Giải trí & ca nhạc]].
- Thâu tóm (`enterIndustry`, `petdex/server/clans.js:376-395`): tối đa 3 ngành; ngành thứ 1/2/3 cần gia tộc cấp 1/3/5 (`industryLevels`); phí = bồi thường gốc của ngành (20.000–50.000), **×10** từ ngành thứ 2 (`expandMultiplier`); 50% vào ngân sách; tin "… thâu tóm ngành …, bồi thường thị trường X xu".
- Nhiều gia tộc cùng ngành thì ai cũng giảm sản lượng: `1 / (1 + 0,15 × (số gia tộc − 1))` (`public/ta-tua/game/js/shared/clan.js:572`).
- Không có cách bỏ ngành (trừ khi giải tán).
- Thêm ngành làm [[Thuế doanh nghiệp]] tăng 5 điểm.

## Phí duy trì mỗi đêm
`80 × cấp + 200 × số lô` (`upkeepPerLevel`, `upkeepPerPlot`); quỹ đủ thì trừ (50% vào ngân sách), **không đủ thì không trừ mà mất `ceil(phí/10)` XP** (`petdex/server/clans.js:28-30,663-671`).

## Định mức góp quỹ tuần
Đêm Chủ nhật: mỗi thành viên phải góp trong tuần `300 × cấp` xu; tổng phần thiếu của mọi thành viên làm gia tộc mất `ceil(thiếu / 10)` XP (`petdex/server/clans.js:28,674-678`).

## Cấu hình quản trị (`DEFAULT_CLAN_CONFIG`, `petdex/server/clans.js:18-49`)
Mọi số trên chỉnh được ở [[Quản trị Clan]] (`normalizeClanConfig` kẹp giá trị, `petdex/server/clans.js:54-87`; lưu `meta.clan_config`): phí lập, cấp mở, cấp cho từng ngành (không giảm dần), hệ số phí ngành 2–3, thuế, hoàn thuế, định mức, phí duy trì, bồi thường từng ngành, luật giá đất (xem [[Bản đồ đất]]), ép vĩ mô.

## API (`petdex/server/routes-clans.js`)
`GET /clans`, `POST /clans/create|/clans/:id/join|leave|donate|kick|role|industries|declare|dividend`, `GET /land`, `GET /land/:id/preview?industry=`, `POST /land/:id/buy|sell|industry|design`, `GET /macro`.

> [!warning] Lệch tài liệu
> `petdex/docs/thiet-ke-mo-rong.md:58` mô tả "Sở Nhà Đất: mua bán, cho thuê, đấu giá nhà và mặt bằng, cấp 8"; code mở ở **cấp 4**, chỉ mua/bán lại lô cho Sở, không cho thuê hay đấu giá, và người mua là **gia tộc** chứ không phải cá nhân. [[Wiki người chơi]] (`lib/wiki/articles.ts`) chưa có bài nào về gia tộc. README (`petdex/README.md:74`) khớp code.

## Liên quan
- [[Cấp gia tộc]] · [[Bản đồ đất]] · [[Mẫu công trình]] · [[Trình lắp ghép công trình]] · [[Thuế doanh nghiệp]] · [[Sở thuế và trốn thuế]] · [[Kinh tế vĩ mô]] · [[Hội]]
- [[Màn Clan]] · [[Vẽ bản đồ đất]] · [[Quản trị Clan]] · [[Module clans]] · [[Module routes-clans]] · [[MOC Kinh tế và cộng đồng]]
