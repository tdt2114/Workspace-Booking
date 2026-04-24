# Use Case - MVP / As-is

## Phân loại sơ đồ

Sơ đồ này thuộc nhóm:

- `As-is`
- `MVP implemented`
- `phản ánh chức năng hiện đang có thật trong hệ thống`

Không dùng sơ đồ này để mô tả full system trong tương lai nếu sau này bổ sung:

- QR động theo booking
- notification
- dashboard analytics
- meeting room booking
- waitlist

## Nguồn dựng sơ đồ

- `plan/WORK_CHECKLIST.md`
- `Report/REPORT_DRAFT.md`
- `src code/apps/web/app/...`
- `src code/apps/api/src/...`

```mermaid
flowchart LR
    employee[Employee]
    manager[Manager]
    admin[Admin]

    UC1((Đăng nhập))
    UC2((Xem dashboard))
    UC3((Xem floor map))
    UC4((Chọn bàn theo tầng và khung giờ))
    UC5((Tạo booking))
    UC6((Xem booking của tôi))
    UC7((Hủy booking của tôi))
    UC8((Check-in bằng QR tĩnh))

    UC9((Quản lý building))
    UC10((Quản lý floor))
    UC11((Upload SVG floor map))
    UC12((Quản lý workspace))
    UC13((Xem và tải QR bàn))
    UC14((Chạy lifecycle tools))
    UC15((Quản trị booking toàn hệ thống))
    UC16((Xem trạng thái booking realtime))

    employee --> UC1
    employee --> UC2
    employee --> UC3
    employee --> UC4
    employee --> UC5
    employee --> UC6
    employee --> UC7
    employee --> UC8
    employee --> UC16

    manager --> UC1
    manager --> UC2
    manager --> UC3
    manager --> UC6
    manager --> UC8
    manager --> UC13
    manager --> UC14
    manager --> UC15
    manager --> UC16

    admin --> UC1
    admin --> UC2
    admin --> UC3
    admin --> UC6
    admin --> UC8
    admin --> UC9
    admin --> UC10
    admin --> UC11
    admin --> UC12
    admin --> UC13
    admin --> UC14
    admin --> UC15
    admin --> UC16
```

## Ghi chú dùng trong báo cáo

1. Đây là use case của bản MVP đang chạy, không phải full target system.
2. Một số nghiệp vụ đang ở mức prototype kỹ thuật, đặc biệt là camera scan trên mobile.
3. Use case này nên đặt ở phần:
   - phân tích yêu cầu chức năng đã triển khai
   - hoặc phần actor và chức năng trong báo cáo chính

