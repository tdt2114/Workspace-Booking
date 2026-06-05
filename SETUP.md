# Hướng Dẫn Cài Đặt Chi Tiết

Tài liệu này dành cho người mới clone repo về và muốn tự cài đặt, chạy thử, và kiểm tra dự án ở môi trường local.

Mục tiêu của tài liệu:

- giúp người mới biết phải làm gì theo đúng thứ tự
- tránh nhầm giữa env của frontend và backend
- biết cách dựng Supabase từ đầu
- biết cách kiểm tra dự án đã chạy đúng hay chưa

## 1. Tổng quan dự án

Dự án được chia thành 4 phần chính:

```txt
src code/  Source code monorepo
plan/      Kế hoạch, checklist, implementation plan
Report/    Bản nháp báo cáo và ghi chú tiến độ
Diagram/   Sơ đồ và hình minh họa
```

Trong đó:

- `src code/apps/web-final`: frontend Next.js
- `src code/apps/api`: backend NestJS
- `src code/supabase`: file SQL để dựng database và policy

## 2. Yêu cầu trước khi cài

Máy cần có:

- Node.js 20 trở lên
- npm 10 trở lên
- tài khoản Supabase
- trình duyệt web
- PowerShell hoặc terminal tương đương

## 3. Bước 1: Clone repo và cài package

Chạy tại thư mục gốc của repo:

```powershell
cd "D:\money\1-Workspace booking"
cd "src code"
npm install
```

### Kết quả mong đợi

- không có lỗi `npm install`
- xuất hiện thư mục `node_modules`

## 4. Bước 2: Tạo project Supabase

Truy cập:

- Dashboard: `https://supabase.com/dashboard`

Tạo project mới:

1. Bấm `New project`
2. Đặt tên, ví dụ: `workspace-booking`
3. Chọn region gần nhất
4. Đặt database password
5. Tạo project

### Kết quả mong đợi

- project được tạo thành công
- vào được dashboard của project

## 5. Bước 3: Cấu hình Auth và Storage trong Supabase

### 5.1 Bật Email Auth

Vào:

- `Authentication -> Sign In / Providers`

Thiết lập:

- bật `Email provider`
- nên tắt `Confirm email` khi dev để test nhanh

### 5.2 Cấu hình URL

Vào:

- `Authentication -> URL Configuration`

Thiết lập:

- `Site URL`: `http://localhost:3002`
- `Redirect URLs`: `http://localhost:3002/**`

### 5.3 Tạo bucket

Vào:

- `Storage`

Tạo bucket:

- tên: `floor-maps`
- để private là được

### Kết quả mong đợi

- đăng nhập email/password dùng được
- có bucket `floor-maps`

## 6. Bước 4: Lấy key từ Supabase

Vào:

- `Project Settings -> API Keys`

Cần lấy 3 giá trị:

- `Project URL`
- `Publishable key`
- `Secret key` hoặc `service role key`

Map giá trị như sau:

- `NEXT_PUBLIC_SUPABASE_URL` = Project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = Publishable key
- `SUPABASE_URL` = Project URL
- `SUPABASE_SERVICE_ROLE_KEY` = Secret key

Lưu ý:

- `Publishable key` dùng cho frontend
- `Secret key` chỉ dùng cho backend
- không được đưa `Secret key` lên frontend

## 7. Bước 5: Tạo file env tổng ở gốc

Dự án đã được cấu hình để dồn tất cả các biến môi trường của cả frontend và backend vào **một file `.env` duy nhất ở thư mục gốc `src code/.env`**.

Trong thư mục `src code/`:

```powershell
Copy-Item .env.example .env
```

Mở [src code/.env.example](/d:/money/1-Workspace booking/src code/.env.example:1), điền đầy đủ các thông tin và lưu thành file `src code/.env` với nội dung như sau:

```env
# Shared / Environment
NODE_ENV=development

# Supabase Configurations
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SECRET_KEY
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

Lưu ý:
- File `.env` này chứa thông tin bảo mật nên **không được commit lên Git**.
- Khi bạn khởi chạy Web frontend thông qua lệnh `npm run dev:final`, hệ thống sẽ tự động đồng bộ (copy) file `.env` này sang `apps/web-final/.env.local` cho Next.js sử dụng. Bạn chỉ cần sửa duy nhất 1 file ở gốc.

### Kết quả mong đợi

- Thư mục gốc `src code/` có file `.env` chứa đầy đủ cấu hình.

## 8. Bước 6: Khởi tạo database

Vào:

- `Supabase -> SQL Editor`

Chạy theo đúng thứ tự:

1. [src code/supabase/01_schema.sql](/d:/money/1-Workspace booking/src code/supabase/01_schema.sql:1)
2. [src code/supabase/02_auth_and_policies.sql](/d:/money/1-Workspace booking/src code/supabase/02_auth_and_policies.sql:1)
3. [src code/supabase/03_seed.sql](/d:/money/1-Workspace booking/src code/supabase/03_seed.sql:1)
4. [src code/supabase/04_expand_workspace_types.sql](/d:/money/1-Workspace booking/src code/supabase/04_expand_workspace_types.sql:1)

Lưu ý:

- file `04_expand_workspace_types.sql` mở rộng `workspace.type` và `workspace.status`
- nếu project Supabase của bạn đã được tạo từ các file SQL cũ, vẫn cần chạy file số 4 để cập nhật constraint
- sau bước này, hệ thống hỗ trợ thêm `meeting_room`, `focus_room`, `lab`, `room`, `parking` và trạng thái `inactive`

### Reset dữ liệu demo khi bị kẹt booking test

Khi test nhiều lần, các booking cũ hoặc booking tương lai có thể làm tài khoản demo bị kẹt giới hạn `2 active bookings`. Lúc đó chạy thêm file sau trong `Supabase -> SQL Editor`:

5. [src code/supabase/05_demo_reset_bookings.sql](/d:/money/1-Workspace booking/src code/supabase/05_demo_reset_bookings.sql:1)

Lưu ý:

- chỉ chạy file này cho môi trường local/demo
- file này chỉ xóa booking của `admin@demo.com`, `space-owner@demo.com`, `user@demo.com`
- file này không xóa user, building, floor, workspace hoặc file SVG
- sau khi chạy xong, quota active booking của các tài khoản demo sẽ sạch để test lại từ đầu

### Kết quả mong đợi

Sau khi chạy xong, trong `Table Editor` phải thấy các bảng:

- `users`
- `buildings`
- `floors`
- `workspaces`
- `bookings`

Và dữ liệu mẫu:

- 1 building: `Head Office`
- 1 floor: `Floor 1`
- 10 desk demo

## 9. Bước 7: Tạo user demo

Vào:

- `Authentication -> Users`

Tạo 3 user:

- `admin@demo.com`
- `space-owner@demo.com`
- `user@demo.com`

Đặt password tùy ý cho từng user.

Sau đó chạy lại phần cuối của [03_seed.sql](/d:/money/1-Workspace booking/src code/supabase/03_seed.sql:1) để update role cho 3 user này.

### Kết quả mong đợi

Trong bảng `public.users` phải thấy:

- `admin@demo.com` có role `admin`
- `space-owner@demo.com` có role `space_owner`
- `user@demo.com` có role `user`

## 10. Bước 8: Chạy local

Mở 2 terminal trong thư mục `src code/`.

### 10.1 Chạy backend

```powershell
npm run dev:api
```

Kết quả mong đợi:

```txt
API running on http://localhost:3001
```

### 10.2 Chạy frontend

```powershell
npm run dev:final
```

Kết quả mong đợi:

```txt
Local: http://localhost:3002
```

## 11. Bước 9: Kiểm tra frontend auth

Mở:

- `http://localhost:3002/login`

Đăng nhập bằng:

- `admin@demo.com`

Sau khi đăng nhập thành công, vào:

- `http://localhost:3002/dashboard`

### Kết quả mong đợi

Dashboard hiển thị:

- email user
- user id
- access token
- nút `Test GET /me`

## 12. Bước 10: Kiểm tra API

Lấy access token từ dashboard rồi test bằng PowerShell:

```powershell
$token = "PASTE_ACCESS_TOKEN_HERE"
```

### 12.1 Health

```powershell
(Invoke-WebRequest http://localhost:3001/health -UseBasicParsing).Content
```

Kết quả mong đợi:

```json
{"status":"ok","service":"api"}
```

### 12.2 Me

```powershell
(Invoke-WebRequest http://localhost:3001/me -UseBasicParsing -Headers @{ Authorization = "Bearer $token" }).Content
```

Kết quả mong đợi:

- trả về `id`, `email`, `role`

### 12.3 Buildings

```powershell
(Invoke-WebRequest http://localhost:3001/buildings -UseBasicParsing -Headers @{ Authorization = "Bearer $token" }).Content
```

Kết quả mong đợi:

- có `Head Office`

### 12.4 Route chỉ dành cho admin

```powershell
(Invoke-WebRequest http://localhost:3001/admin/ping -UseBasicParsing -Headers @{ Authorization = "Bearer $token" }).Content
```

Kết quả mong đợi:

- user `admin` gọi được thành công

## 13. Các module backend hiện có

Hiện tại backend đã có:

- auth + token validation
- role guard
- `buildings` CRUD
- `floors` CRUD

## 14. Nếu người khác clone repo

Cần cung cấp:

- source code của repo
- file setup này
- file env mẫu
- các file SQL trong `src code/supabase/`

Không được cung cấp:

- `src code/.env`
- `src code/apps/web-final/.env.local`
- secret key thật
- access token thật

## 15. Xử lý lỗi thường gặp

### Frontend báo thiếu env

Kiểm tra xem bạn đã tạo file `.env` ở thư mục gốc `src code/.env` chưa.

Sau đó restart:

```powershell
npm run dev:final
```

### Backend chạy nhầm cổng 3000

Kiểm tra file:

- `code/.env`

Sau đó restart:

```powershell
npm run dev:api
```

### Frontend gọi `/me` không được

Kiểm tra:

- backend đang chạy
- CORS đã bật
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`

### Test admin route bị 403

Kiểm tra:

- bạn đang đăng nhập bằng `admin@demo.com`
- role đã update đúng trong bảng `public.users`
