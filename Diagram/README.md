# Quy ước quản lý sơ đồ

Tài liệu này dùng để tránh nhầm lẫn giữa:

- sơ đồ `As-is / MVP implemented`
- sơ đồ `To-be / Full target system`

Đồng thời giữ lại **mã Mermaid gốc** để sau này có thể tiếp tục chỉnh sửa, mở rộng và xuất lại hình mà không phải vẽ lại từ đầu.

---

## 1. Nguyên tắc hiện tại

Các file đang có trong thư mục `Diagram/` hiện được xem là:

- nguồn mã sơ đồ gốc
- phản ánh đúng trạng thái MVP đã code, đã test và đã chạy
- dùng cho các chương mô tả `As-is` trong báo cáo

Không nên sửa các file này theo hướng “full system tương lai” nếu phần đó chưa được triển khai thật, vì sẽ làm report bị lẫn giữa:

- cái đã hoàn thành
- cái mới là định hướng mở rộng

---

## 2. Quy tắc giữ mã sơ đồ

- luôn giữ sơ đồ ở dạng mã Mermaid trong file `.md`
- nếu cần xuất ảnh `.png` hoặc `.svg`, coi ảnh chỉ là bản render
- file `.md` mới là nguồn gốc chỉnh sửa chính thức
- không thay thế mã Mermaid bằng ảnh tĩnh rồi bỏ mất source

---

## 3. Quy tắc mở rộng sau này

Khi bước sang phase hoàn thiện toàn hệ thống hoặc UI final, cần tạo **file sơ đồ mới** cho hướng `To-be`, thay vì ghi đè file MVP hiện có.

Gợi ý đặt tên:

- `SYSTEM_ARCHITECTURE_TO_BE.md`
- `ERD_TO_BE.md`
- `USE_CASE_TO_BE.md`
- `SEQUENCE_TARGET_FLOWS.md`
- `ACTIVITY_BOOKING_LIFECYCLE_TO_BE.md`
- `ACTIVITY_CHECK_IN_TO_BE.md`

Quy tắc:

- file không có hậu tố `TO_BE`:
  - là sơ đồ MVP/as-is
- file có hậu tố `TO_BE`:
  - là sơ đồ mục tiêu toàn hệ thống

---

## 4. Cách dùng trong báo cáo

### Dùng cho phần kết quả triển khai

Chỉ dùng các file:

- `SYSTEM_ARCHITECTURE.md`
- `ERD_MVP.md`
- `USE_CASE_MVP.md`
- `SEQUENCE_FLOWS.md`
- `ACTIVITY_BOOKING_LIFECYCLE_MVP.md`
- `ACTIVITY_CHECK_IN_MVP.md`

### Dùng cho phần định hướng mở rộng

Khi đã tạo bộ sơ đồ `TO_BE`, chỉ dùng chúng ở các mục:

- hướng phát triển tiếp theo
- kiến trúc mục tiêu
- phạm vi mở rộng sau MVP

Không dùng sơ đồ `TO_BE` để mô tả “hệ thống hiện tại”.

---

## 5. Trạng thái đối chiếu hiện tại

Đến thời điểm hiện tại:

- `SYSTEM_ARCHITECTURE.md` khớp với kiến trúc đang chạy thật
- `ERD_MVP.md` khớp với schema và rule database hiện tại
- `USE_CASE_MVP.md` khớp với actor và chức năng đã có trong MVP
- `SEQUENCE_FLOWS.md` khớp với các luồng auth, booking, check-in, lifecycle tools
- hai activity diagram hiện tại phù hợp để mô tả luồng booking/check-in của MVP

Điểm chưa có:

- chưa có bộ sơ đồ `To-be / Full target system`
- chưa có sơ đồ riêng cho phase UI final

Điều này là bình thường ở giai đoạn hiện tại, vì dự án vẫn đang ưu tiên chốt core MVP và báo cáo `As-is`.
