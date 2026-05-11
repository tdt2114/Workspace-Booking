# Rule Tạo SVG Để Upload Lên Hệ Thống

## 1. Mục đích

File này quy định cách chuẩn bị file SVG để upload lên hệ thống `Workspace Booking MVP`.

Mục tiêu:

- tránh upload thành công nhưng không click/chọn được workspace trên màn `/floor-map`
- thống nhất cách đặt `id` giữa file SVG và dữ liệu trong database
- hỗ trợ cả bàn làm việc lẫn các không gian khác như phòng họp, phòng lab, focus room, room, parking
- ghi rõ phần nào là **bookable workspace**, phần nào chỉ là **vùng minh họa**

Lưu ý quan trọng:

- MVP hiện tại bind workspace với SVG theo `svg_element_id`
- hệ thống **không tự đoán** từ tên hiển thị như `A1`, `A2`, `Bàn họp`, `Lab 1`
- phần tử muốn click được trên sơ đồ phải map đúng với record workspace trong database

---

## 2. Nguyên tắc cốt lõi

Muốn một phần tử trên sơ đồ chọn được để đặt chỗ hoặc xem chi tiết, cần đủ 2 điều kiện:

1. Trong bảng `public.workspaces` phải có một record tương ứng
2. `public.workspaces.svg_element_id` phải trùng với `id` của phần tử SVG

Ví dụ:

- database:
  - `name = Desk A-01`
  - `type = desk`
  - `svg_element_id = desk_a_01`
- trong SVG:
  - phần tử bàn phải có `id="desk_a_01"`

Nếu SVG chỉ hiển thị chữ `A1` nhưng phần tử không có `id="desk_a_01"` thì hệ thống sẽ không map được đúng workspace.

---

## 3. Các loại workspace hiện hỗ trợ

Hiện tại backend đã mở rộng để hỗ trợ các loại sau:

- `desk`
- `meeting_room`
- `focus_room`
- `lab`
- `room`
- `parking`

Trạng thái hiện hỗ trợ:

- `available`
- `maintenance`
- `inactive`

Gợi ý dùng:

- `desk`: bàn làm việc cá nhân
- `meeting_room`: phòng họp
- `focus_room`: phòng tập trung / phone booth / quiet room
- `lab`: phòng lab / phòng thực hành / studio
- `room`: phòng lớn, phòng đa năng, phòng chung
- `parking`: chỗ đậu xe nếu sau này muốn mở rộng booking sang tài nguyên khác

---

## 4. Quy tắc đặt `id` trong SVG

### 4.1 Quy tắc chung

- dùng chữ thường
- dùng dấu gạch dưới `_`
- không dùng khoảng trắng
- không dùng tiếng Việt có dấu
- mỗi `id` phải là duy nhất trong toàn bộ file SVG

### 4.2 Mẫu đặt tên khuyến nghị

#### Bàn làm việc

- `desk_a_01`
- `desk_a_02`
- `desk_b_01`

#### Phòng họp

- `meeting_room_main`
- `meeting_room_01`
- `meeting_room_small`

#### Focus room

- `focus_room_01`
- `focus_room_02`

#### Lab

- `lab_01`
- `lab_ai`
- `lab_embedded`

#### Room / phòng lớn

- `room_training`
- `room_event`
- `room_large_01`

#### Parking

- `parking_a_01`
- `parking_staff_01`

### 4.3 Tên hiển thị và `id` là hai thứ khác nhau

Bạn có thể hiển thị nhãn đẹp cho người dùng, ví dụ:

- text hiển thị: `A1`
- `id` kỹ thuật: `desk_a_01`

Khuyến nghị:

- phần tử hình học mang `id` kỹ thuật
- text label chỉ dùng để hiển thị
- không phụ thuộc vào text label để map dữ liệu

---

## 5. Phân loại phần tử trong sơ đồ

### 5.1 Phần tử bookable

Đây là các phần tử mà người dùng có thể click để đặt chỗ hoặc check-in.

Ví dụ:

- bàn làm việc
- phòng họp
- phòng lab
- phòng focus
- phòng lớn nếu muốn cho đặt

Yêu cầu:

- có `id` rõ ràng trong SVG
- có record tương ứng trong `public.workspaces`
- `svg_element_id` trong database trùng `id` trong SVG

### 5.2 Phần tử không bookable

Đây là các vùng minh họa hoặc khu phụ trợ.

Ví dụ:

- pantry
- cafe
- lối đi
- cửa ra vào
- thang máy
- nhà vệ sinh
- quầy lễ tân

Các phần tử này:

- không bắt buộc có record trong `public.workspaces`
- có thể để `id` hoặc không
- nếu có `id` thì chỉ phục vụ thiết kế/nội bộ, không cần map booking

Khuyến nghị:

- không tạo record workspace cho các vùng chỉ để trang trí hoặc định hướng
- chỉ tạo workspace nếu bạn thực sự muốn khu đó trở thành tài nguyên đặt chỗ

---

## 6. Cách chuẩn bị dữ liệu khi có sơ đồ mới

Khi có một file SVG mới cho một floor, nên làm theo trình tự này:

1. Xác định các vùng nào là bookable workspace
2. Gán `id` chuẩn cho từng phần tử bookable trong SVG
3. Upload SVG lên đúng floor trong `/admin/setup`
4. Tạo hoặc cập nhật record trong `workspaces`
5. Điền đúng:
   - `name`
   - `type`
   - `status`
   - `svgElementId`
   - `qrCodeValue`
   - `capacity`
6. Mở `/floor-map` để test click từng phần tử

Nếu click không được, kiểm tra theo thứ tự:

1. phần tử trong SVG đã có `id` chưa
2. `id` đó có đúng chính tả với `svg_element_id` trong database không
3. workspace đó có thuộc đúng floor đang mở không
4. phần tử đó có đang bị group/layer khác che lên không

---

## 7. Rule cho space owner/admin khi upload SVG

Upload SVG chỉ làm 1 việc:

- cập nhật `svg_map_url` cho floor được chọn

Upload SVG **không tự động**:

- tạo building mới
- tạo floor mới
- tạo workspace mới
- tự map các phần tử trong sơ đồ

Điều này có nghĩa:

- upload thành công không đồng nghĩa với map xong
- sau upload vẫn phải kiểm tra lại workspace data

Lưu ý rất quan trọng:

- nếu floor đã có `svg_map_url`, upload mới sẽ thay thế map đang dùng cho floor đó
- vì vậy phải kiểm tra đúng floor trước khi upload

---

## 8. Khuyến nghị cấu trúc file SVG

### 8.1 Nên có

- một lớp nền tổng thể
- các hình khối bookable riêng biệt
- text label tách biệt khỏi phần tử hình học nếu cần
- `id` rõ ràng cho các phần tử bookable

### 8.2 Nên tránh

- convert toàn bộ sơ đồ thành một ảnh/vector duy nhất không tách phần tử
- dùng `id` tự sinh khó đọc như `rect123`, `path88`
- dùng tên hiển thị làm `id` nếu tên có dấu hoặc khoảng trắng
- dùng lại cùng một `id` ở nhiều phần tử

### 8.3 Khuyến nghị kỹ thuật

- ưu tiên `rect`, `path`, `polygon`, `circle`, `ellipse`, `g`
- nếu dùng `g`, đảm bảo `id` nằm ở node đủ ổn định để click
- nếu phần tử có nhiều lớp con, nên đặt `id` ở node cha đại diện cho workspace

---

## 9. Mẫu mapping đề xuất

Ví dụ một floor có:

- 8 bàn làm việc
- 1 phòng họp
- 1 phòng lab
- 1 pantry

Mapping nên là:

- `desk_a_01` -> workspace type `desk`
- `desk_a_02` -> workspace type `desk`
- `desk_b_01` -> workspace type `desk`
- `meeting_room_main` -> workspace type `meeting_room`
- `lab_01` -> workspace type `lab`
- `pantry_zone` -> không cần record workspace nếu pantry không cho đặt

---

## 10. Rule cho QR trong MVP hiện tại

MVP hiện tại đang dùng QR tĩnh.

Điều đó có nghĩa:

- mỗi workspace có một `qr_code_value` cố định
- QR này gắn với workspace, không gắn với từng booking

Ví dụ:

- `Desk A-01` -> `qr_code_value = desk_a_01`
- `Meeting Room Main` -> `qr_code_value = meeting_room_main`

Nếu sau này chuyển sang QR động theo từng booking, file SVG vẫn có thể giữ nguyên rule `svg_element_id`; chỉ logic QR/check-in sẽ đổi ở backend và frontend.

---

## 11. Checklist nhanh trước khi upload SVG

Trước khi upload, kiểm tra:

- file đúng floor cần dùng
- các workspace bookable đều có `id`
- `id` viết đúng chuẩn
- không có `id` bị trùng
- các không gian không bookable đã được tách rõ
- đã chuẩn bị hoặc cập nhật record `workspace` tương ứng trong hệ thống

Sau khi upload, kiểm tra:

- floor hiển thị đúng file mới
- click được từng workspace cần book
- panel chi tiết hiện đúng tên workspace
- tạo booking được với workspace mới
- mở `/workspace-qr` thấy đúng QR của workspace mới

---

## 12. Kết luận

Trong MVP hiện tại, rule đúng nhất là:

- **SVG chịu trách nhiệm hiển thị và cung cấp `id`**
- **database chịu trách nhiệm định nghĩa workspace thật**
- **`svg_element_id` là cầu nối bắt buộc giữa hai bên**

Vì vậy:

- muốn mở rộng thêm phòng họp, lab, room, parking thì làm được ngay
- nhưng muốn click/book được thì phải map đúng `id`
- không nên nới lỏng logic map quá sớm, vì sẽ làm dữ liệu khó kiểm soát khi scale hệ thống
