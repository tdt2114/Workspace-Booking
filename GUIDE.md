# HƯỚNG DẪN CHẠY DỰ ÁN WORKSPACE BOOKING (CHO NGƯỜI MỚI / NON-TECH)

Tài liệu này hướng dẫn chi tiết từng bước để một người không chuyên về công nghệ (non-tech) có thể tự thiết lập và khởi chạy toàn bộ dự án trên máy tính cá nhân bằng cách sử dụng **Docker Desktop**.

---

## 📌 Phần 1: Chuẩn bị phần mềm (Chỉ cần làm 1 lần duy nhất)

Để chạy dự án, máy tính của bạn cần được cài đặt hai phần mềm cơ bản sau:

### 1. Tải và cài đặt Docker Desktop
Docker Desktop là công cụ giúp tự động dựng môi trường chạy dự án mà bạn không cần phải cài đặt phức tạp từng phần mềm riêng lẻ (như database, backend, frontend...).
* **Cách cài đặt**:
  1. Truy cập trang chủ: [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
  2. Bấm tải bản cài đặt tương ứng với hệ điều hành của bạn (Windows hoặc Mac).
  3. Mở file vừa tải về và tiến hành cài đặt như các ứng dụng thông thường (chỉ cần bấm **Next** và **Finish**).
  4. Sau khi cài đặt xong, hãy **mở phần mềm Docker Desktop lên** (biểu tượng chú cá voi màu xanh). Đảm bảo phần mềm đang chạy ẩn ở góc màn hình trước khi thực hiện các bước tiếp theo.

### 2. Tải và cài đặt Git (Nếu muốn tải mã nguồn nhanh)
Git là công cụ giúp bạn tải bộ code từ mạng về máy tính và cập nhật các thay đổi mới nhất.
* **Cách cài đặt**:
  1. Truy cập trang chủ: [https://git-scm.com/](https://git-scm.com/)
  2. Tải phiên bản dành cho Windows (hoặc Mac) và cài đặt mặc định.

---

## 📂 Phần 2: Các bước thiết lập và khởi chạy dự án

### ➡️ Bước 1: Tải mã nguồn dự án về máy tính
* **Cách tải nhanh nhất (Không cần lệnh)**:
  1. Truy cập vào trang GitHub chứa dự án này.
  2. Bấm vào nút **Code** màu xanh lá cây ở góc trên bên phải.
  3. Chọn **Download ZIP**.
  4. Sau khi file tải xong, click chuột phải vào file ZIP chọn **Extract Here** (Giải nén) ra một thư mục trên máy tính của bạn (ví dụ đặt ở ổ `D:\` hoặc thư mục làm việc của bạn).

---

### ➡️ Bước 2: Thiết lập cấu hình (Tạo file `.env`)
Để dự án của bạn có thể kết nối được với cơ sở dữ liệu Supabase, bạn cần điền các khóa kết nối vào file cấu hình.

> [!TIP]
> **Lưu ý quan trọng**: Nếu bạn nhận được thư mục dự án này dưới dạng file nén `.zip` từ chủ dự án và thấy trong thư mục **`src code`** đã có sẵn file **`.env`** (chứa sẵn các key kết nối hoạt động), bạn hãy **bỏ qua hoàn toàn Bước 2 này** và chuyển thẳng tới **Bước 3** để chạy dự án luôn!

1. Sử dụng File Explorer (Thư mục máy tính), truy cập vào thư mục code vừa tải về, sau đó vào thư mục con tên là **`src code`**.
2. Tìm file có tên là **`.env.example`** (đây là file mẫu):
   * Click chuột phải vào file `.env.example` -> chọn **Copy** (Sao chép).
   * Click chuột phải ra khoảng trống bất kỳ -> chọn **Paste** (Dán) để tạo ra một bản sao.
   * Đổi tên file bản sao đó thành đúng **`.env`** (xóa đuôi `.example` đi).
3. **Mở file `.env` vừa tạo bằng ứng dụng Notepad**:
   * Click chuột phải vào file `.env` -> chọn **Open with** -> chọn **Notepad**.
4. **Điền khóa bí mật (Secret Key) để chạy backend**:
   * File `.env` sau khi nhân bản đã chứa sẵn các thông tin cấu hình công khai của dự án. Bạn chỉ cần dán khóa bí mật (do chủ dự án cung cấp riêng) vào sau dấu `=` ở **Dòng 8** (`SUPABASE_SERVICE_ROLE_KEY=`).
   * *Hoặc bạn có thể copy toàn bộ nội dung mẫu dưới đây và đè vào file `.env`:*
     ```env
     # Shared / Environment
     NODE_ENV=development

     # Supabase Configurations
     NEXT_PUBLIC_SUPABASE_URL=https://tzcksukvryjhknsakbkf.supabase.co
     NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_nYuDiW9Di2wF4-LmFhSEWQ_H_JNdZnQ
     SUPABASE_URL=https://tzcksukvryjhknsakbkf.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=[DÁN_KEY_BÍ_MẬT_DO_CHỦ_DỰ_ÁN_CUNG_CẤP_VÀO_ĐÂY]
     SUPABASE_JWT_SECRET=

     # API Backend Configuration
     PORT=3001
     CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002
     BOOKINGS_LIFECYCLE_ENABLED=false
     BOOKINGS_LIFECYCLE_INTERVAL_MS=60000
     BOOKINGS_LIFECYCLE_RUN_ON_START=false

     # Web Frontend (web-final) Configuration
     NEXT_PUBLIC_API_BASE_URL=/api
     API_PROXY_TARGET=http://127.0.0.1:3001
     ```
5. Nhấn tổ hợp phím **Ctrl + S** để lưu file lại và đóng cửa sổ Notepad.

---

### ➡️ Bước 3: Khởi chạy dự án bằng lệnh
1. **Mở cửa sổ dòng lệnh (Terminal) tại thư mục `src code`**:
   * Truy cập vào thư mục **`src code`** bằng File Explorer.
   * Giữ phím **Shift** trên bàn phím và **click chuột phải** vào một khoảng trống bất kỳ trong thư mục -> Chọn **Open PowerShell window here** (hoặc *Open in Terminal* / *Open Command Prompt here*).
2. **Khởi chạy ứng dụng**:
   * Copy toàn bộ lệnh dưới đây, dán vào cửa sổ dòng lệnh vừa mở và nhấn **Enter**:
     ```bash
     docker compose up -d --build
     ```
3. **Đợi hệ thống cài đặt**:
   * Hệ thống sẽ tự động tải các tài nguyên cần thiết và cài đặt dự án. Lần đầu tiên chạy sẽ mất khoảng 2 - 5 phút tùy cấu hình máy và tốc độ mạng.
   * Khi màn hình dừng chạy lệnh và xuất hiện chữ **`Started`** (màu xanh lá cây) ở tất cả các dòng, nghĩa là ứng dụng đã chạy thành công!

---

### ➡️ Bước 4: Truy cập và sử dụng dự án
Mở trình duyệt web của bạn (Chrome, Cốc Cốc, Edge, Safari...) và truy cập các địa chỉ sau:

1. **Giao diện đặt phòng (Web Frontend)**:
   👉 [http://localhost:3002](http://localhost:3002)
   * Để trải nghiệm nhanh, bạn có thể đăng nhập bằng các tài khoản mẫu sau:
     * Tài khoản Nhân viên: `user@demo.com` / Mật khẩu: `12345678`
     * Tài khoản Quản lý: `manager@demo.com` / Mật khẩu: `12345678`
     * Tài khoản Admin hệ thống: `admin@demo.com` / Mật khẩu: `12345678`

2. **Trang tài liệu kiểm thử API (Swagger Docs)**:
   👉 [http://localhost:3001/docs](http://localhost:3001/docs)

---

### ➡️ Bước 5: Cách tắt dự án khi không sử dụng
Để giải phóng tài nguyên máy tính sau khi dùng xong:
1. Quay lại cửa sổ dòng lệnh đang mở ở Bước 3.
2. Gõ lệnh sau và nhấn **Enter**:
   ```bash
   docker compose down
   ```
3. Hệ thống sẽ tự động tắt và dọn dẹp các ứng dụng đang chạy ngầm an toàn.
