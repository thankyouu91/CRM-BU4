---
tags: [petfarm, thiet-ke, tai-lieu, api]
loai: thiet-ke
trang-thai: dang-chay
nguon: [petdex/docs/api-giai-doan-2.md]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Tài liệu API giai đoạn 2

> [!summary]
> `petdex/docs/api-giai-doan-2.md` (240 dòng) là bản mô tả cho người làm giao diện các endpoint mới của **giai đoạn 2 (Sản xuất)**: chăm sóc và phòng khám, trường học, vườn, bếp, khu công nghiệp, hợp đồng cung ứng, Chợ Phiên, tín dụng, và phần đứng máy ở việc làm. Nó là tài liệu lịch sử của một giai đoạn; danh sách API đầy đủ và hiện hành nằm ở [[API người chơi]].

## Quy ước chung (dòng 5-12)
- Mọi endpoint dưới `/api`, cần `Authorization: Bearer …` (trong WorkHub là `/ta-tua/api`, xem [[Phiên chơi và token]]).
- **GET** trả dữ liệu màn; **POST** trả toàn bộ trạng thái người chơi kèm `result`, client vẽ lại một lần.
- Lỗi luật chơi: HTTP 400 `{ error: 'thông báo tiếng Việt' }`. Xem [[Lỗi và thông báo lỗi]].
- Tiền là số nguyên xu; hàng hóa tính bằng **phần**, 1 lô = 10 phần.
- Giá trong GET đã nhân chỉ số giá; giá gốc trong catalog nhân `economy.priceIndex`.
- Cấp mở khóa ví dụ: `school: 2, garden: 2, kitchen: 3, bazaar: 4, factory: 6, contracts: 6, advanced: 8`. Phòng khám không khóa. Xem [[Mở khóa theo cấp]].

## Các nhóm endpoint
| Nhóm | Endpoint tiêu biểu | Dòng | Ghi chú vault |
|---|---|---|---|
| Chăm sóc & Phòng khám | `POST /pets/:id/bath`, `GET /clinic`, `POST /clinic/visit`, `POST /clinic/insurance` | 43-59 | [[Ốm và Phòng khám]], [[Bảo hiểm sức khỏe]] |
| Trường học | `GET /school`, `POST /school/class` (30 phút, 15 năng lượng, mỗi môn tối đa 3 buổi/ngày) | 61-75 | [[Trường học]] |
| Vườn | `plant`, `water` (tưới hộ bạn +20% vụ, +2 xu, +5 XP), `pests`, `harvest`, `expand` | 77-101 | [[Vườn]] |
| Bếp | `cook` (công thức ẩn), `dishes/:id/eat`, `dishes/:id/sell` | 103-121 | [[Bếp]] |
| Khu công nghiệp | `build` (tối đa 2 xưởng), `upgrade` (+3 mẻ/giờ mỗi cấp), `toll` (phí 0–100 xu/mẻ), `jobs` (lương 8–80 xu/giờ, 1–3 người), `order` (1–100 mẻ) | 123-154 | [[Khu công nghiệp]] |
| Hợp đồng cung ứng | `POST /contracts`, `accept`, `decline`, `break` (bồi thường 10% phần còn lại) | 156-179 | [[Hợp đồng cung ứng]] |
| Chợ Phiên | `list` (giá 50–300% tham chiếu), `buy` (phí bán 5%), `cancel` | 181-204 | [[Chợ Phiên]] |
| Tín dụng & vay | `GET /credit`, `borrow` (kỳ 3, 7, 14 ngày, phí giải ngân 2%), `repay` | 206-229 | [[Tín dụng và vay]], [[Điểm tín dụng]] |
| Việc làm | `POST /jobs/start { petId, hours, factoryId }` cho đứng máy | 231-240 | [[Việc làm]] |

> [!warning] Lệch tài liệu
> - Tài liệu nói `api()` nằm ở `public/js/api.js` (repo gốc); ở đây là `public/ta-tua/game/js/api.js`.
> - Các con số trong bảng trên là **theo tài liệu**; con số hiện hành phải xem trong ghi chú luật tương ứng (đã đối chiếu code). Tài liệu không được cập nhật sau giai đoạn 2.

## Liên quan
- [[Tài liệu thiết kế mở rộng]]
- [[API người chơi]]
- [[Lộ trình phát triển]]
- [[MOC Thiết kế]]
