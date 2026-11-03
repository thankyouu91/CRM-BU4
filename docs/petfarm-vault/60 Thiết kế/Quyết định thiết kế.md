---
tags: [petfarm, thiet-ke, quyet-dinh]
loai: thiet-ke
trang-thai: dang-chay
nguon: [petdex/docs/thiet-ke-mo-rong.md, petdex/docs/thiet-ke-pet-ngu-hanh.md, docs/pet-town-gear-balance.md, docs/production-release.md, worker.ts, middleware.ts, petdex/server/durable.js, petdex/server/internal.js, app/api/ta-tua/account/route.ts, lib/rate-limit.ts]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Quyết định thiết kế

> [!summary]
> Những quyết định đáng nhớ của Pet Town, mỗi cái kèm **lý do** và nguồn (tài liệu thiết kế, commit message, chú thích trong code). Đọc trước khi đổi một thứ "trông có vẻ lạ": phần lớn chúng có lý do về bảo mật, cân bằng kinh tế hoặc giới hạn của Cloudflare Workers. Mỗi quyết định lớn có thể tách thành ghi chú riêng theo mẫu `Mẫu quyết định`.

## Kiến trúc và hạ tầng
| Quyết định | Lý do | Nguồn |
|---|---|---|
| Toàn bộ máy chủ game là **một** Durable Object tên `park` | Một chỗ giữ trạng thái: SQLite của object là DB, alarm thay bộ lập lịch, hub và bus ở mức module là của riêng nó; bộ đếm trong RAM (mã quà, chat) là bộ đếm thật cho cả server | `petdex/server/durable.js:1-3`, `worker.ts:35`, `89e7f07` |
| Thay Express, socket.io, `node:sqlite` bằng router nhỏ, hub WebSocket, lớp SQL cắm được | Để **cùng một mã** chạy trên Node (dev) lẫn Workers (production) | `89e7f07`, README.md:177 |
| API nội bộ `/internal/*` không có đường public; chỉ gọi qua stub binding; Node dev đòi `x-petdex-internal` | SSO và quản trị không được lộ ra mạng; smoke test kiểm cả các đường lách như `%2e%2e` | `petdex/server/internal.js:1-3`, `petdex/server/index.js:96-101`, `scripts/smoke-worker.mjs:113-118` |
| Token chơi đi trong **fragment** `#token=` chứ không phải query | Fragment không bao giờ tới log máy chủ; game đọc xong xóa khỏi URL | `lib/petdex.ts:71`, `public/ta-tua/game/js/app.js:7-19` |
| Giữ `middleware.ts`, không đổi sang `proxy.ts` của Next.js 16 | Proxy luôn chạy runtime Node.js mà OpenNext trên Workers chưa hỗ trợ | `middleware.ts:5-7` |
| Worker đặt `placement` ở `aws:ap-southeast-1` | Chạy cạnh Postgres Singapore: mỗi truy vấn 1–3 ms thay vì vòng xa | `wrangler.jsonc:15-21` |
| Giới hạn tần suất bằng binding Workers Rate Limiting | Isolate không chung bộ nhớ, đếm trong RAM không phải giới hạn thật | `lib/rate-limit.ts:1-6`, `wrangler.jsonc:59-60` |
| Job bảo trì dùng `pg` trực tiếp, không Prisma | Đường cron nhỏ, không nạp cả ứng dụng Next.js | `lib/maintenance.ts:11` |
| Deploy đúng gói Linux CI đã chạy thử, không build lại | Bản vá Prisma của OpenNext phụ thuộc nền tảng; build trên Windows chết trên workerd | `docs/production-release.md:3-7` |
| Đổi tên "Tà tưa" thành "Pet Town" nhưng giữ route `/ta-tua` và mã audit `tatua.*` | Không làm gãy link, nhật ký cũ | `4dde796` |

## Tên miền và tài khoản
| Quyết định | Lý do | Nguồn |
|---|---|---|
| Game có tên miền riêng, trên đó **chỉ có game** | Khách mời không chạm được phần nào khác của WorkHub; link chia sẻ không lộ WorkHub | `444bef7`, `lib/petdex-public.ts:88-98` |
| Trang giới thiệu ở tên miền trần `petfarm.online`, `www` chuyển 308 về đó | Bố cục ba tên miền do chủ dự án chốt | `5fd3deb` |
| Ban đầu tắt đăng ký trực tiếp (`openSignup: false`) | Lúc đầu mọi người vào bằng WorkHub hoặc link mời | `petdex/server/settings.js:3-4`, `89e7f07` |
| Sau đó mở tài khoản tên + mật khẩu qua route WorkHub `/api/ta-tua/account`, không qua `/api/auth/register` của game | Để có giới hạn tần suất của Cloudflare và kiểm tra zod trước khi vào game | `5df0602`, `app/api/ta-tua/account/route.ts:31-51` |
| Tạo mật khẩu cho tài khoản cũ cần **bằng chứng**: trình duyệt còn giữ token của chính tài khoản đó | "Biết tên thôi thì không đủ" để chiếm tài khoản | `petdex/server/internal.js:205-220`, `7fee43c` |
| Link đặt mật khẩu một lần, 24 giờ, chỉ lưu băm, không ghi mã vào nhật ký | Dữ liệu lộ ra cũng không dùng được link | `petdex/server/passwords.js:8-9`, `petdex/server/internal.js:527`, `7fee43c` |
| Khóa giới hạn đăng nhập gồm IP **và** tên | Không ai khóa được người chơi khác từ nơi khác | `app/api/ta-tua/account/route.ts:39-42` |
| Đổi mật khẩu cần mật khẩu cũ và đăng xuất mọi phiên khác; đăng xuất xóa cả hai bản token | Máy dùng chung không còn phiên | `petdex/server/internal.js:183-202`, `components/tatua/play-screen.tsx:42-54` |

## Quản trị
| Quyết định | Lý do | Nguồn |
|---|---|---|
| Mỗi thao tác quản trị ghi ở cả nhật ký game và nhật ký WorkHub | Truy vết hai phía; trường nhãn chỉ để câu nhật ký dễ đọc, game không thấy | `app/api/ta-tua/admin/[...path]/route.ts:8-15` |
| Trừ xu lấy ví trước rồi tiết kiệm, không đụng tiền gửi kỳ hạn; quá thì báo tối đa trừ được và cho *Trừ hết* | Lỗi trần "Không đủ xu." khó hiểu khi tài sản ròng (gồm hàng hóa) trông lớn hơn | `444bef7`, `petdex/server/internal.js:425-462` |
| Quản trị viên tặng được mọi loài, kể cả loài chỉ nở từ trứng | Chủ dự án muốn tặng một bé Hoàng Long; vẫn dùng `createPet` và tôn trọng giới hạn ô | `87e99e1` |
| Hồ sơ khai thiếu thuế được ghi cho Sở thuế mà **không báo** gia tộc | Tạo rủi ro thật cho việc khai gian; quản trị viên quyết truy thu hay bỏ qua | `05840b3`, `app/(app)/ta-tua/quan-ly/clans.tsx:214` |

## Luật chơi và cân bằng (từ nhật ký triển khai và commit)
| Quyết định | Lý do | Nguồn |
|---|---|---|
| 1 ngày thật = 1 tuần tuổi | Bé trưởng thành sau 21 giờ là quá nhanh so với mục tiêu tính bằng tuần | `petdex/docs/thiet-ke-mo-rong.md:20`, `petdex/docs/thiet-ke-mo-rong.md:29` |
| Bỏ nút "Đi làm" bấm liên tục, thay bằng ca làm tốn thời gian thật | Lỗ hổng hơn 300 xu/ngày gần như không tốn công | `petdex/docs/thiet-ke-mo-rong.md:17` |
| Mốc lên bậc nghề 16/60/150/300 giờ, kỹ năng +0,6/giờ | Mốc ban đầu đẩy lương gấp đôi dự kiến | `petdex/docs/thiet-ke-mo-rong.md:766` |
| Đảo chính sách lãi NHTW: xu tăng nhanh thì **hạ** lãi tiết kiệm | Lãi tiết kiệm là một nguồn in tiền | `petdex/docs/thiet-ke-mo-rong.md:767`, `petdex/docs/thiet-ke-mo-rong.md:300` |
| Sàn mở cấp 2 (thay vì 4) | Bán được cá và trân châu từ mini-game ngay từ đầu | `petdex/docs/thiet-ke-mo-rong.md:768` |
| Hạ cấp mở khóa (quầy 4, Tòa thị chính và lập Hội 3, xưởng 6) | Lên cấp chậm (khoảng 100 XP/ngày) | `petdex/docs/thiet-ke-mo-rong.md:773-777`, `petdex/docs/thiet-ke-mo-rong.md:805` |
| Ngân sách thị trấn có quỹ khởi tạo 5.000 xu | Trả trợ cấp tân thủ ngay từ ngày đầu | `petdex/docs/thiet-ke-mo-rong.md:791` |
| Sức khỏe nhẹ tay hơn thiết kế (−1/+1 mỗi giờ) | Mô phỏng: luật cũ cho 713 lượt khám/40 bot/30 ngày, viện phí ăn nửa lương; luật mới 39 lượt | `petdex/docs/thiet-ke-mo-rong.md:800-804` |
| NPC thương lái mua sỉ hàng chế biến (1 lô làm giá dịch bằng 1/3 hàng thô) | Không có thì xưởng bán ra là giá sập, biên lời âm | `petdex/docs/thiet-ke-mo-rong.md:813` |
| Phí Chợ Phiên, lãi và phí vay chia đôi: nửa vào ngân sách, nửa bị hủy | Giữ ngân sách có tiền mà vẫn rút xu khỏi nền kinh tế | `petdex/docs/thiet-ke-mo-rong.md:824`, `petdex/docs/thiet-ke-mo-rong.md:831` |
| Không bán bé ở Chợ Phiên; loài của trứng bốc **lúc bắt đầu ấp** | Chặn mua bán Huyền thoại bằng tài khoản phụ; ấp xong không bốc lại được | `petdex/docs/thiet-ke-pet-ngu-hanh.md:205`, `petdex/docs/thiet-ke-pet-ngu-hanh.md:279-283` |
| Bé cuối cùng mất thì tặng trứng Thường thay vì khóa ô | Chống kẹt người chơi khỏi game | `petdex/docs/thiet-ke-pet-ngu-hanh.md:104`, `petdex/docs/thiet-ke-pet-ngu-hanh.md:320` |
| Mọi người còn bé sống đều hiện ở công viên (tối đa 50) | Công viên thường trông trống vì chỉ hiện người đang mở | `fdc824d`, `petdex/server/playground.js:37` |
| Bé sơ sinh làm nhẹ 2 giờ/ngày, lương 50% | Người mới không phải chờ 2 tuần tuổi mới có việc | `444bef7` |
| Tắm có loại bận riêng (`busy_kind`) | Trước đây tắm hiện "đang đi làm" và hao năng lượng như ca làm | `81d152d` |
| Mã quà có phần hợp mệnh và phần cho chọn | Với 5 hành, một mã cố định hiếm khi hợp người nhận | `3bc910e` |
| Đồ mua ở Siêu thị là hộp kín chỉ ra Xanh lam/Xanh lục | Cấp cao chỉ có ở nguồn khác (mini-game, mã quà, Chợ Phiên) | `5cfbd34`, `app/petfarm/page.tsx:45` |
| Cộng dồn trang phục giảm dần (25% đủ, vượt tính 50%, trần 60%); hợp mệnh cả bộ trần +30% | Bé 5 món Đỏ gần gấp đôi lương (khoảng 2,08×) so với 1,08× của người chơi đồ Siêu thị; vòng lặp May mắn; hợp mệnh không trần cho 2,63× tốc độ kỹ năng | `152cd2e`, `docs/pet-town-gear-balance.md:25-34` |
| Bộ ngũ hành tính trên cả 5 khe (3/4/5 món) | Bé dưới cấp 30 chỉ đeo 3 món nên không bao giờ đạt bộ "đủ 4 khe" cũ | `152cd2e`, `docs/pet-town-gear-balance.md:32` |
| Tiền mua đất chỉ 20% vào ngân sách, còn lại bị hủy | Đất là chỗ tiêu tiền lớn để rút xu khỏi nền kinh tế | `petdex/server/clans.js:44-45` |

## Chưa chốt (vẫn đang mở)
Theo `petdex/docs/thiet-ke-mo-rong.md:753-760`: số lô đất và tốc độ mở bán (đã thay bằng bản đồ 200 lô cố định), hộ thuê NPC, không cho bán khống trên Sàn giao ngay.

## Liên quan
- [[Lịch sử phiên bản]]
- [[Lộ trình phát triển]]
- [[Tài liệu thiết kế mở rộng]]
- [[Thiết kế pet ngũ hành]]
- [[MOC Thiết kế]]
