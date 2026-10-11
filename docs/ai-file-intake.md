# AI: review tài liệu và chuẩn bị nhập liệu

Trong **Trợ lý AI → Trò chuyện**, đính kèm file rồi gửi câu hỏi để review hoặc bấm **Trích xuất để nhập liệu**. AI trả bản nháp dự án/hợp đồng, giá trị có nguồn, cảnh báo và trích dẫn vị trí. Bấm **Kiểm tra và điền…** để sửa trong biểu mẫu chuẩn, rồi bấm lưu. Không có thao tác ghi hồ sơ tự động hoặc gọi công cụ ghi dữ liệu từ AI.

- Hỗ trợ PDF, PNG/JPG/WebP, XLSX, DOCX, CSV/TXT UTF-8. Tối đa 3 file, 4 MB/file, tổng 8 MB. File cùng lần đọc phải khác tên để đối chiếu nguồn.
- File chỉ nằm trong bộ nhớ trang và yêu cầu gửi Claude. Không lưu file gốc trong sessionStorage hoặc kho hồ sơ; cần chọn lại sau reload. File giữ nguyên cho các câu hỏi tiếp theo cho đến khi bỏ file hoặc tạo cuộc trò chuyện mới. Nội dung hội thoại vẫn được lưu trong sessionStorage theo cơ chế chat hiện có.
- PDF/ảnh gửi bằng document/image blocks; Word/Excel chuyển thành văn bản trên server. Word chỉ lấy phần thân và bảng, không đọc ảnh/header/footer/chú thích; gửi PDF khi cần những phần đó. Excel giữ tên sheet, tọa độ ô, chuỗi số hợp đồng và ngày. Không thực thi macro/công thức; kết quả công thức đã lưu được ghi chú để kiểm tra.
- Giới hạn 60.000 ký tự/file văn bản, 2 MB/entry XML và 16 MB tổng giải nén thực tế; quá giới hạn trả lỗi thay vì cắt âm thầm. Chặn XML entity/DOCTYPE, macro, định dạng giả và nội dung JSON quá 12 MB thực tế.
- Kết quả AI qua schema chặt: tối đa 10 đề xuất, không nhận ID hồ sơ/quyền. Trường không có evidence đúng tên file bị bỏ. Ngày sai thứ tự hoặc số tiền chưa xác nhận VND để trống. Nguồn do AI trích dẫn vẫn cần người dùng đối chiếu tài liệu gốc.
- Đề xuất dự án mở ProjectFormModal; hợp đồng mở ContractModal. API lưu hiện có tiếp tục kiểm tra quyền/validation/audit. Nhân sự chọn thủ công; dự án liên quan chỉ điền sẵn nếu tên khớp chính xác, duy nhất trong danh sách có quyền xem (kể cả dự án vừa tạo). Có cảnh báo dự án trùng tên và hướng dẫn kiểm tra số hợp đồng; không tự gộp hay sửa hồ sơ tồn tại.
- Ngày thực hiện/giá trị hợp đồng bắt buộc phải bổ sung nếu còn trống. Chi phí tùy chọn và đã thu trống lưu 0 theo biểu mẫu hiện có; giao diện nêu rõ trước khi mở form. Bản nháp đã lưu được đánh dấu trong phiên để không tạo lại từ cùng thẻ.
- Dùng cấu hình Claude và hạn mức ngày hiện có. Audit chỉ ghi số file, model và token, không lưu base64. Không đổi schema CSDL hoặc cần R2.

Kiểm thử: parser (định dạng, Excel nhiều sheet, Word, giải nén giới hạn, JSON), trích xuất có nguồn/VND/ngày, API auth/quota/đầu ra lỗi, UI đính kèm→trích xuất→form/quyền/sessionStorage. CI còn khởi động artifact Linux bằng workerd và kiểm tra trang AI/API intake; các bài kiểm thử dùng phản hồi AI giả lập, không gọi dịch vụ trả phí.
