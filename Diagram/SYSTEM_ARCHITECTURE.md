# System Architecture - MVP

## Phân loại sơ đồ

Sơ đồ này thuộc nhóm:

- `As-is`
- `MVP implemented`
- `hiện trạng đã code và đã chạy`

Không dùng sơ đồ này như sơ đồ "toàn hệ thống cuối cùng" nếu về sau dự án bổ sung:

- QR động theo từng booking
- scheduler/cron chạy thật
- notification/email
- dashboard thống kê
- meeting room / waitlist
- staging/production architecture đầy đủ

Quy tắc chèn vào báo cáo:

1. Nếu mô tả hệ thống đang triển khai và đã kiểm chứng, dùng sơ đồ này.
2. Nếu mô tả định hướng full system theo proposal, phải vẽ một sơ đồ `To-be` riêng.
3. Không trộn chi tiết chưa triển khai vào sơ đồ `As-is`.

Nguồn dựng sơ đồ:

- `README.md`
- `SETUP.md`
- `src code/apps/api/src/app.module.ts`
- `src code/apps/web/app/floor-map/page.tsx`
- `src code/apps/web/app/check-in/page.tsx`
- `src code/apps/web/app/bookings/page.tsx`
- `src code/apps/web/app/workspace-qr/page.tsx`

Mục đích:

- mô tả đúng kiến trúc đang chạy của bản MVP
- thể hiện ranh giới giữa frontend, backend và Supabase
- làm nguồn để xuất hình kiến trúc tổng thể cho báo cáo

```mermaid
flowchart LR
    U[User<br/>admin / manager / employee]

    subgraph FE[Next.js Frontend]
        LOGIN[/login]
        DASH[/dashboard]
        MAP[/floor-map]
        BOOK[/bookings]
        QR[/workspace-qr]
        CHECKIN[/check-in]
        SBC[Supabase Browser Client]
    end

    subgraph BE[NestJS API]
        AUTH[Auth Module<br/>JWT validation + RolesGuard]
        BLD[Buildings Module]
        FLR[Floors Module]
        WSP[Workspaces Module]
        BKG[Bookings Module]
        CIN[Check-in Module]
    end

    subgraph SB[Supabase Platform]
        SA[Supabase Auth]
        DB[(PostgreSQL)]
        ST[(Storage<br/>floor-maps)]
        RT[[Realtime]]
    end

    U --> LOGIN
    U --> DASH
    U --> MAP
    U --> BOOK
    U --> QR
    U --> CHECKIN

    LOGIN --> SBC
    SBC <--> SA
    SBC --> RT

    MAP --> BE
    BOOK --> BE
    QR --> BE
    CHECKIN --> BE
    DASH --> BE

    AUTH --> DB
    BLD --> DB
    FLR --> DB
    WSP --> DB
    BKG --> DB
    CIN --> DB

    FLR --> ST
    MAP --> ST

    BE --> SA
    RT --> MAP
    RT --> BOOK
```

## Diễn giải ngắn

1. Frontend dùng Supabase client cho đăng nhập và giữ session.
2. Frontend gửi bearer token sang NestJS cho toàn bộ nghiệp vụ cốt lõi.
3. Backend dùng Supabase admin client để làm việc với PostgreSQL và Storage.
4. Floor SVG hiện được lấy qua backend protected flow thay vì public URL trực tiếp.
5. Realtime hiện phục vụ cập nhật trạng thái booking trên `/floor-map` và danh sách booking liên quan.

## Vị trí nên chèn vào báo cáo

- Chương 3: Thiết kế hệ thống
- Mục 3.1: Kiến trúc tổng thể
