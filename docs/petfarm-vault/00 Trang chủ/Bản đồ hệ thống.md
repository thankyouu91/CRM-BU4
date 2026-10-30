---
tags: [petfarm, tong-quan, he-thong]
loai: moc
trang-thai: dang-chay
nguon: [petdex/server, public/ta-tua/game/js, worker.ts, middleware.ts]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Bản đồ hệ thống

> [!summary]
> Một trang nhìn toàn cảnh: các hệ thống của Pet Town nối với nhau thế nào, xu chảy qua đâu, và một yêu cầu của người chơi đi từ trình duyệt tới cơ sở dữ liệu ra sao. Mỗi ô trong sơ đồ là một ghi chú; bấm vào tên trong danh sách bên dưới để đi sâu.

## Vòng chơi chính

```mermaid
flowchart LR
  subgraph Be["Nuôi bé"]
    CS[Chỉ số của bé] --> OM[Ốm và Phòng khám]
    NH[Ngũ hành] --> KN[Kỹ năng]
    TP[Trang phục] --> KN
    GT[Giai đoạn tuổi] --> VD[Vòng đời và Đồi Sao]
  end
  subgraph Xu["Kiếm xu"]
    VL[Việc làm]
    MG[Mini-game]
    TH[Trường học]
    QN[Quà ngày và Nhiệm vụ ngày]
  end
  subgraph KT["Làm ăn"]
    VU[Vườn] --> KHO[Kho Sàn]
    MG -- rớt vật liệu --> KHO
    KHO <--> SAN[Sàn Nguyên Liệu]
    KHO --> XU[Khu công nghiệp]
    XU --> KHO
    KHO --> QTS[Quầy trà sữa]
    KHO --> BEP[Bếp]
    BEP --> CP[Chợ Phiên]
    HD[Hợp đồng cung ứng] --- KHO
  end
  subgraph TC["Tài chính và thị trấn"]
    NHG[Ngân hàng Trân Châu]
    TD[Tín dụng và vay]
    THUE[Thuế thu nhập] --> NS[Ngân sách thị trấn]
    NS --> TTC[Tòa thị chính]
    NHTW[Ngân hàng Trung ương] --> CSG[Chỉ số giá]
    VM[Kinh tế vĩ mô]
  end
  subgraph CD["Cộng đồng"]
    BB[Bạn bè]
    HOI[Hội]
    CL[Clan] --> BDD[Bản đồ đất]
    CV[Công viên]
  end
  KN --> VL
  CS --> VL
  VL --> THUE
  QTS --> THUE
  CSG --> ST[Siêu thị]
  ST --> CS
  ST --> TP
  VM --> CL
  CL -- thuế doanh nghiệp --> NS
  BB -- tưới hộ --> VU
  HOI -- Văn phòng: +lương --> VL
  HOI -- Biển hiệu: +khách --> QTS
```

| Nhóm | Ghi chú gốc |
|---|---|
| Nuôi bé | [[Chỉ số của bé]], [[Chăm sóc ở nhà]], [[Ốm và Phòng khám]], [[Ngũ hành]], [[Loài và độ hiếm]], [[Trứng ngũ hành]], [[Tính cách]], [[Giai đoạn tuổi]], [[Vòng đời và Đồi Sao]], [[Trang phục]], [[Cấp độ và XP]], [[Dáng theo cấp]] |
| Kiếm xu | [[Việc làm]], [[Kỹ năng]], [[Trường học]], [[Mini-game]], [[Quà ngày]], [[Nhiệm vụ ngày]], [[Mã quà]] |
| Làm ăn | [[Sàn Nguyên Liệu]], [[Kho Sàn]], [[Vườn]], [[Bếp]], [[Khu công nghiệp]], [[Quầy trà sữa]], [[Chợ Phiên]], [[Hợp đồng cung ứng]] |
| Tài chính và thị trấn | [[Dòng xu trong game]], [[Ngân hàng Trân Châu]], [[Ngân hàng Trung ương]], [[Chỉ số giá]], [[Kinh tế vĩ mô]], [[Thuế thu nhập]], [[Thuế doanh nghiệp]], [[Ngân sách thị trấn]], [[Tòa thị chính]], [[Tín dụng và vay]], [[Sổ cái]] |
| Cộng đồng | [[Bạn bè]], [[Công viên]], [[Hội]], [[Clan]], [[Bản đồ đất]] |

## Một yêu cầu đi qua những đâu

```mermaid
sequenceDiagram
  participant P as Trình duyệt (game trong iframe)
  participant W as Worker crm (worker.ts)
  participant M as middleware.ts
  participant D as Durable Object PetdexPark
  participant R as Router + dịch vụ
  participant S as SQLite của object
  P->>W: POST /ta-tua/api/... (token phiên chơi)
  W->>D: chuyển nguyên yêu cầu vào object "park"
  D->>R: router.js khớp đường dẫn, kiểm tra token, cấp mở khóa
  R->>S: đọc, ghi trong một giao dịch (sổ cái, bé, kho)
  R-->>P: JSON trạng thái mới + lời nhắn
  Note over D: alarm mỗi phút: giá Sàn, quyết toán nửa đêm (giờ VN)
  P->>W: GET petfarm.online / play / wiki
  W->>M: định tuyến theo tên miền
```

Chi tiết: [[Kiến trúc máy chủ]], [[Durable Object PetdexPark]], [[Router]], [[Nhịp mỗi phút]], [[Quyết toán nửa đêm]], [[Middleware định tuyến]], [[Tên miền Petfarm]], [[Kiến trúc giao diện game]].

## Một ngày của phố

```mermaid
timeline
  title Một ngày theo giờ Việt Nam
  0 giờ : Quyết toán nửa đêm (lãi, thuế, tiền thuê, bảo hiểm, vòng đời, hợp đồng, gia tộc)
        : Quà ngày, nhiệm vụ, hạn mức mini-game và Sàn làm mới
        : Hành vượng đổi
  Mỗi 10 phút : Giá Sàn Nguyên Liệu chạy
  11 giờ đến 13 giờ : Giờ cao điểm quầy trà sữa
  17 giờ đến 21 giờ : Giờ cao điểm quầy trà sữa
  Nửa đêm cuối Chủ nhật : Ngân hàng Trung ương họp, chỉ số giá và lãi đổi
                        : Tòa thị chính chốt phiếu tuần
```

## Ba tên miền

| Tên miền | Phục vụ | Ghi chú |
|---|---|---|
| `petfarm.online` (và `www.` chuyển về) | [[Trang giới thiệu petfarm.online]] | trang giới thiệu game |
| `play.petfarm.online` | [[Trang chơi server1]], [[Link mời]], [[Link đặt mật khẩu]] | game sau khi đăng nhập |
| `wiki.petfarm.online` | [[Wiki người chơi]] | hướng dẫn chơi |

Xem [[Tên miền Petfarm]] và [[Quy trình deploy]].

## Liên quan
- [[Trang chủ]]
- [[Thuật ngữ]]
