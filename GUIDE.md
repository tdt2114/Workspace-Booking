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

1. Sử dụng File Explorer (Thư mục máy tính), truy cập vào thư mục code vừa tải về, sau đó vào thư mục con tên là **`src code`**.
2. Tìm file có tên là **`.env.example`** (đây là file mẫu):
   * Click chuột phải vào file `.env.example` -> chọn **Copy** (Sao chép).
   * Click chuột phải ra khoảng trống bất kỳ -> chọn **Paste** (Dán) để tạo ra một bản sao.
   * Đổi tên file bản sao đó thành đúng **`.env`** (xóa đuôi `.example` đi).
3. **Mở file `.env` vừa tạo bằng ứng dụng Notepad**:
   * Click chuột phải vào file `.env` -> chọn **Open with** -> chọn **Notepad**.
4. **Điền thông tin kết nối Supabase của bạn**:
   * Vào trang quản trị Supabase dự án của bạn -> chọn mục **Project Settings** (icon bánh răng) -> chọn tiếp **API** ở cột bên trái.
   * Tiến hành copy và điền các giá trị vào file `.env` theo hướng dẫn:
     * **Dòng 5** (`NEXT_PUBLIC_SUPABASE_URL`): Copy **Project URL** trên Supabase và dán vào sau dấu `=`.
     * **Dòng 6** (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`): Copy **anon/public key** trên Supabase và dán vào sau dấu `=`.
     * **Dòng 7** (`SUPABASE_URL`): Dán lại **Project URL** của bạn giống dòng 5.
     * **Dòng 8** (`SUPABASE_SERVICE_ROLE_KEY`): Trên trang Supabase, tại mục *Secret keys*, bấm nút **+ New secret key** ở góc phải -> Đặt tên bất kỳ và bấm tạo -> Copy key dạng `sb_secret_...` vừa tạo được và dán vào sau dấu `=`. *(Lưu ý: Key này chỉ hiện một lần duy nhất lúc tạo, bạn hãy copy ngay)*.
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
