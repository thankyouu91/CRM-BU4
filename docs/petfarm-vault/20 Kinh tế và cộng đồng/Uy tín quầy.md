---
tags: [petfarm, kinh-te, quay-tra-sua, uy-tin]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/business.js, petdex/server/business.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Reputation, Uy tín]
---
# Uy tín quầy

> [!summary]
> Hệ số 0,5–1,5 nhân thẳng vào lượng khách của [[Quầy trà sữa]]. Giảm khi khách đến mà không mua được (hết hàng, thiếu công suất) hoặc khi bán đắt hơn 1,3 lần giá tham chiếu; tăng chậm khi bán được hàng với giá không quá 1,1 lần tham chiếu. Uy tín cũng hiện trên tin tuyển dụng để người làm thuê chọn quầy.

## Công thức (`nextReputation`, `petdex/server/rules/business.js:69-75`)
Sau mỗi giờ có bé trực:
```
nếu (khách − đã bán) > 0,5:  uy tín −= 0,03 × min(1, (khách − đã bán) / max(1, khách))
nếu tỉ lệ giá > 1,3:          uy tín −= 0,1 × (tỉ lệ giá − 1,3)
ngược lại nếu bán > 0 và tỉ lệ giá ≤ 1,1: uy tín += 0,004
kẹp 0,5–1,5
```
`tỉ lệ giá` = trung bình `giá/tham chiếu` các món trong thực đơn (`petdex/server/business.js:90`).

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Khởi đầu | 1 (mặc định cột `reputation`) | `petdex/server/db.js:224` |
| Tăng tối đa mỗi giờ | +0,004 (từ 1 lên 1,5 cần 125 giờ trực tốt) | `petdex/server/rules/business.js:73` |
| Giảm tối đa do hết hàng | −0,03/giờ | `petdex/server/rules/business.js:71` |
| Giờ không trực | không đổi | `petdex/server/business.js:97,134` |

## Trường hợp đặc biệt
- Hết một món nhưng món khác vẫn bán được: phần khách của món hết hàng tính là "mất", vẫn trừ uy tín.
- Bé trực có Khéo tay thấp ở giờ cao điểm dễ thiếu công suất (7 ly/giờ) và làm tụt uy tín: nâng "Quầy pha rộng hơn" hoặc thuê thêm bé.

## Liên quan
- [[Quầy trà sữa]] · [[Thực đơn quầy trà sữa]] · [[Thuê bé làm việc]] · [[MOC Kinh tế và cộng đồng]]
