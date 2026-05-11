# Sequence Flows - MVP

## Phân loại sơ đồ

Các sequence trong file này thuộc nhóm:

- `As-is`
- `MVP implemented`
- `luồng đã có thật trong code`

Điều này có nghĩa:

1. Chỉ mô tả các route, module và hành vi đang tồn tại ở thời điểm hiện tại.
2. Không dùng file này để đại diện cho full workflow tương lai nếu sau này thay đổi nghiệp vụ.
3. Khi bổ sung flow mới như QR động, notification, scheduler tự động, phải tạo thêm sequence mới hoặc tách file `Target flows`.

Quy tắc chèn vào báo cáo:

- dùng cho phần mô tả cài đặt và kiểm chứng hệ thống hiện tại
- không dùng thay cho luồng mục tiêu cuối cùng nếu proposal có scope rộng hơn

Nguồn dựng sơ đồ:

- `src code/apps/api/src/auth/...`
- `src code/apps/api/src/bookings/...`
- `src code/apps/api/src/check-in/...`
- `src code/apps/web/app/login/page.tsx`
- `src code/apps/web/app/floor-map/page.tsx`
- `src code/apps/web/app/check-in/page.tsx`
- `src code/apps/web/app/bookings/page.tsx`

## 1. Auth flow

```mermaid
sequenceDiagram
    actor User
    participant Web as Next.js Frontend
    participant SAuth as Supabase Auth
    participant API as NestJS API
    participant DB as Supabase DB

    User->>Web: nhập email + password
    Web->>SAuth: signInWithPassword()
    SAuth-->>Web: session + access token
    Web->>API: GET /me + Bearer token
    API->>SAuth: verify JWT context
    API->>DB: đọc public.users theo user id
    DB-->>API: profile user
    API-->>Web: id + email + role + fullName
```

## 2. Booking flow

```mermaid
sequenceDiagram
    actor User
    participant Web as Next.js Frontend
    participant API as NestJS API
    participant DB as Supabase DB
    participant RT as Supabase Realtime

    User->>Web: chọn desk + startTime + endTime
    Web->>API: POST /bookings
    API->>DB: kiểm tra workspace
    API->>DB: kiểm tra conflict / overlap
    API->>DB: insert booking status=confirmed
    DB-->>API: booking created
    API-->>Web: booking response
    DB-->>RT: booking changed event
    RT-->>Web: refresh my bookings + floor-state
```

## 3. Check-in flow

```mermaid
sequenceDiagram
    actor User
    participant Web as Next.js Frontend
    participant API as NestJS API
    participant DB as Supabase DB

    User->>Web: nhập hoặc scan qrCodeValue
    User->>Web: chọn scan time
    Web->>API: POST /check-in/scan
    API->>DB: tìm workspace theo qr_code_value
    API->>DB: tìm booking của user theo workspace + time
    API->>API: kiểm tra window check-in
    alt hợp lệ và chưa check-in
        API->>DB: update booking -> checked_in
        DB-->>API: updated booking
        API-->>Web: check-in success
    else đã check-in trước đó
        API-->>Web: already checked in
    else không hợp lệ
        API-->>Web: error / forbidden / bad request
    end
```

## 4. Lifecycle tools flow

```mermaid
sequenceDiagram
    actor SystemAdmin as System Admin
    participant Web as Next.js Frontend
    participant API as NestJS API
    participant DB as Supabase DB
    participant RT as Supabase Realtime

    SystemAdmin->>Web: chạy run-no-show hoặc run-completed
    Web->>API: POST /bookings/run-no-show or /run-completed
    API->>DB: tìm booking quá hạn theo rule
    API->>DB: update status tương ứng
    DB-->>API: danh sách booking đã đổi trạng thái
    API-->>Web: count + items
    DB-->>RT: booking changed event
    RT-->>Web: refresh booking list + floor-state
```

## Gợi ý chèn vào báo cáo

- Auth flow:
  - Chương 5, mục xác thực và phân quyền
- Booking flow:
  - Chương 5, mục booking core
- Check-in flow:
  - Chương 5, mục QR management và check-in
- Lifecycle tools flow:
  - Chương 5 hoặc Chương 6, mục vòng đời booking
