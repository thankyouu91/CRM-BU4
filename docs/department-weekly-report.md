# Báo cáo công việc phòng

Trung tâm báo cáo mặc định mở báo cáo phòng. Tab “Thống kê & trình chiếu” giữ báo cáo thống kê cũ. Phạm vi mặc định là mọi dự án người xem được phép truy cập; chọn dự án luôn giao với quyền này. Không suy ra phòng ban từ chức danh, không mở thêm quyền tài chính.

Tuần ISO tính từ thứ Hai đến Chủ nhật theo giờ Việt Nam. Chọn tuần bất kỳ sẽ hiển thị tuần trước, tuần đang chọn và tuần sau:

- Kết quả: công việc có trạng thái DONE và completedAt trong tuần. Hoàn thành trễ được phân biệt với việc vẫn chưa xong. Cập nhật tiến độ giữ nguyên nội dung, tác giả và ngày trong tuần.
- Việc cần làm: deadline trong tuần, tồn quá hạn từ mọi tuần trước, việc có lịch bắt đầu hoặc đang thực hiện/chờ duyệt/bị chặn. 100% tiến độ chưa đồng nghĩa DONE.
- Tuần tới: việc chưa xong có deadline hoặc ngày bắt đầu trong tuần; việc xuyên tuần cần có khoảng ngày triển khai thực tế. Không tự giả định việc đến hạn tuần này sẽ trễ sang tuần tới.
- Việc chưa có deadline và việc DONE thiếu ngày hoàn thành được tách riêng, không tự gán ngày. Dự án hủy được loại trừ; dự án tạm dừng có nhãn rõ ràng.

Báo cáo phản ánh dữ liệu hiện tại, không phải snapshot lịch sử. Kết quả theo ngày hoàn thành; trạng thái hiện tại được ghi rõ trên màn hình và Excel. Công việc tổng có subtasks không được đếm thêm; mỗi công việc chi tiết xuất hiện tối đa một lần trong mỗi tuần, kèm dự án, hạng mục, công việc tổng, PIC, nội dung, cập nhật, tiến độ và deadline.

API tải một truy vấn join với phạm vi quyền ở database, không truy vấn từng nhân viên/công việc. Màn hình không tải thống kê/biểu đồ khi xem báo cáo phòng. Excel được tải theo nhu cầu và xuất đúng dữ liệu/phạm vi trên màn hình, gồm năm sheet cho ba tuần và hai nhóm thiếu dữ liệu. Không lưu thay đổi dữ liệu hoặc tự gửi báo cáo cho ai.
