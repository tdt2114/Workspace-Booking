# Activity Diagram - Booking Lifecycle MVP / As-is

## Phân loại sơ đồ

Sơ đồ này thuộc nhóm:

- `As-is`
- `MVP implemented`
- `phản ánh đúng rule trạng thái booking đang có trong code`

## Nguồn dựng sơ đồ

- `src code/apps/api/src/bookings/bookings.service.ts`
- `src code/apps/api/src/check-in/check-in.service.ts`
- `src code/apps/api/src/bookings/bookings.service.spec.ts`
- `plan/WORK_CHECKLIST.md`

```mermaid
flowchart TD
    A[User chọn desk và thời gian] --> B{Booking hợp lệ?}
    B -- Không --> X[Trả lỗi]
    B -- Có --> C[Create booking]
    C --> D[Status = confirmed]

    D --> E{User hủy booking?}
    E -- Có --> F[Status = cancelled]
    E -- Không --> G{User check-in trong window hợp lệ?}

    G -- Có --> H[Status = checked_in]
    G -- Không --> I{Đã quá late window?}

    I -- Chưa --> D
    I -- Rồi --> J[Lifecycle tool run-no-show]
    J --> K[Status = no_show]

    H --> L{Đã qua end_time?}
    L -- Chưa --> H
    L -- Rồi --> M[Lifecycle tool run-completed]
    M --> N[Status = completed]
```

## Ghi chú nghiệp vụ

1. Booking mới được tạo với trạng thái `confirmed`.
2. Chỉ booking `confirmed` hoặc `checked_in` mới chiếm chỗ trong logic overlap.
3. Booking `confirmed` có thể chuyển sang:
   - `cancelled`
   - `checked_in`
   - `no_show`
4. Booking `checked_in` có thể chuyển sang `completed`.
5. `run-no-show` và `run-completed` hiện là lifecycle tools gọi thủ công, chưa phải cron production.

## Vị trí nên chèn vào báo cáo

- Chương 5: chức năng booking core
- Chương 6: đánh giá và mô tả vòng đời booking

