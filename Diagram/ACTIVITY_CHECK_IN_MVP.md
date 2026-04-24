# Activity Diagram - Check-in MVP / As-is

## Phân loại sơ đồ

Sơ đồ này thuộc nhóm:

- `As-is`
- `MVP implemented`
- `phản ánh đúng luồng check-in hiện tại bằng QR tĩnh`

## Nguồn dựng sơ đồ

- `src code/apps/api/src/check-in/check-in.service.ts`
- `src code/apps/api/src/check-in/check-in.service.spec.ts`
- `src code/apps/web/app/check-in/page.tsx`
- `plan/WORK_CHECKLIST.md`

```mermaid
flowchart TD
    A[User mở trang /check-in] --> B[Nhập hoặc scan qrCodeValue]
    B --> C[Chọn scan time]
    C --> D[Frontend gọi POST /check-in/scan]
    D --> E{Tìm thấy workspace theo qrCodeValue?}

    E -- Không --> X1[Trả lỗi QR không hợp lệ]
    E -- Có --> F{Có booking của đúng user tại thời điểm scan?}

    F -- Không --> X2[Trả lỗi không có booking phù hợp]
    F -- Có --> G{Nằm trong check-in window?}

    G -- Không --> X3[Trả lỗi quá sớm hoặc quá muộn]
    G -- Có --> H{Booking đã checked_in trước đó?}

    H -- Có --> I[Trả kết quả already checked in]
    H -- Không --> J[Update booking]
    J --> K[Status = checked_in]
    K --> L[Trả kết quả check-in thành công]
```

## Rule hiện tại

1. QR hiện tại là QR tĩnh theo workspace.
2. Backend không chỉ kiểm tra QR, mà còn kiểm tra:
   - user hiện tại
   - booking phù hợp theo thời gian
   - cửa sổ check-in hợp lệ
3. Check-in sớm tối đa `10 phút` trước `start_time`.
4. Check-in muộn tối đa `min(30 phút, 1/4 thời lượng booking)`.
5. Nếu booking đã check-in từ trước, hệ thống trả kết quả idempotent thay vì tạo trạng thái mới.

## Vị trí nên chèn vào báo cáo

- Chương 5: QR management và check-in
- Chương 6: đánh giá logic xác nhận nhận chỗ

