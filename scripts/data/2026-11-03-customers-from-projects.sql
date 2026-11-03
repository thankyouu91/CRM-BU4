-- Đồng bộ khách hàng từ các dự án đang có (chạy một lần trên production, sau migration
-- 20261103070000_project_customer). Chạy lại nhiều lần cũng không tạo trùng:
--   * khách hàng đã có (trùng tên, không phân biệt hoa thường) thì dùng lại;
--   * dự án đã gắn khách hàng thì giữ nguyên, chỉ gắn dự án còn trống.
-- Bảng ánh xạ dưới đây lập từ tên dự án và cột "đối tác" của hợp đồng ngày 03/11/2026.
-- Dự án nội bộ không gắn khách hàng: "English File 5th Edition [Học Liệu]", "TVET",
-- "Website Tuyển Dụng", "Xây dựng kế hoạch BU4". Chủ dự án bổ sung phần còn thiếu trên trang Khách hàng.

BEGIN;

CREATE TEMP TABLE sync_map (customer TEXT NOT NULL, industry TEXT, project TEXT NOT NULL) ON COMMIT DROP;
INSERT INTO sync_map (customer, industry, project) VALUES
  ('WayUp', NULL, '[WayUp] New Close Up Order'),
  ('WayUp', NULL, 'Engoo - Khách hàng lẻ'),
  ('Công ty Cổ phần Du lịch Vietravel', 'Du lịch', 'Đề án đánh giá và đào tạo Tiếng Anh cho đội ngũ lãnh đạo Vietravel'),
  ('Công ty Cổ phần Du lịch Vietravel', 'Du lịch', 'Nền tảng kiểm tra (Bổ sung) Vietravel'),
  ('Công ty Cổ phần Du lịch Vietravel', 'Du lịch', 'Nền tảng kiểm tra năng lực ngoại ngữ Vietravel'),
  ('Trường Đại học Công Thương TP.HCM (HUIT)', 'Giáo dục', 'Hợp tác kinh doanh Engoo với HUIT'),
  ('IES', NULL, 'IES Pearson – Bài thi HĐ 311/HĐMB/IES-CDIMEX'),
  ('Trường Đại học Kinh tế TP.HCM (UEH)', 'Giáo dục', 'Đại học Kinh tế TPHCM – HĐ 329/HĐKT-2026/UEH-CDIMEX'),
  ('Trường Đại học Nguyễn Tất Thành', 'Giáo dục', 'Cung cấp sản phẩm Upskill EdTech tại Trường Đại học Nguyễn Tất Thành'),
  ('Trường Đại học Nha Trang', 'Giáo dục', 'Triển khai nền tảng VoiceTube tại Đại học Nha Trang'),
  ('Trường Đại học Nha Trang', 'Giáo dục', 'VoiceTube - NTU'),
  ('Trường Đại học Tây Nguyên', 'Giáo dục', 'Chuẩn bị Workshop Tây Nguyên (T6 2/10/2026)'),
  ('Trường Đại học Tây Nguyên', 'Giáo dục', 'Workshop TNU đào tạo ứng dụng AI (Nghiên Cứu)'),
  ('Trường Đại học Giao thông Vận tải', 'Giáo dục', 'Khách lẻ – Đại học Giao thông Vận tải'),
  ('Trường Đại học Thương mại', 'Giáo dục', 'Trường Đại Học Thương Mại');

-- 1. Khách hàng còn thiếu.
INSERT INTO "Customer" ("id", "name", "industry", "note", "createdAt", "updatedAt")
SELECT 'c' || replace(gen_random_uuid()::text, '-', ''), m.customer, max(m.industry), 'Tạo tự động từ dự án ngày 03/11/2026', now(), now()
FROM sync_map m
WHERE NOT EXISTS (SELECT 1 FROM "Customer" c WHERE lower(btrim(c."name")) = lower(btrim(m.customer)))
GROUP BY m.customer;

-- 2. Gắn dự án còn trống vào khách hàng.
UPDATE "Project" p
SET "customerId" = c."id", "updatedAt" = now()
FROM sync_map m
JOIN "Customer" c ON lower(btrim(c."name")) = lower(btrim(m.customer))
WHERE btrim(p."name") = btrim(m.project) AND p."customerId" IS NULL;

-- 3. Kết quả: mỗi dòng ánh xạ, dự án có tìm thấy không và đang gắn với khách hàng nào.
SELECT m.customer, m.project, p."id" IS NOT NULL AS project_found, c."name" AS linked_to
FROM sync_map m
LEFT JOIN "Project" p ON btrim(p."name") = btrim(m.project)
LEFT JOIN "Customer" c ON c."id" = p."customerId"
ORDER BY m.customer, m.project;

COMMIT;
