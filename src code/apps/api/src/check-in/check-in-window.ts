export const CHECK_IN_EARLY_MINUTES = 10;
export const CHECK_IN_LATE_MAX_MINUTES = 30;

type BookingWindowRecord = {
  start_time: string;
  end_time: string;
};

export function getCheckInWindow(booking: BookingWindowRecord) {
  const bookingStart = new Date(booking.start_time);
  const bookingEnd = new Date(booking.end_time);
  const checkInOpensAt = new Date(bookingStart);
  const bookingDurationMs = bookingEnd.getTime() - bookingStart.getTime();
  const quarterDurationMs = bookingDurationMs / 4;
  const lateGraceMs = Math.min(
    quarterDurationMs,
    CHECK_IN_LATE_MAX_MINUTES * 60 * 1000,
  );
  const checkInClosesAt = new Date(bookingStart.getTime() + lateGraceMs);

  checkInOpensAt.setMinutes(
    checkInOpensAt.getMinutes() - CHECK_IN_EARLY_MINUTES,
  );

  return {
    checkInOpensAt,
    checkInClosesAt,
  };
}

export function isWithinCheckInWindow(
  booking: BookingWindowRecord,
  scannedAt: Date,
) {
  const { checkInOpensAt, checkInClosesAt } = getCheckInWindow(booking);

  return scannedAt >= checkInOpensAt && scannedAt <= checkInClosesAt;
}

export function isCheckInWindowExpired(
  booking: BookingWindowRecord,
  effectiveAt: Date,
) {
  const { checkInClosesAt } = getCheckInWindow(booking);

  return effectiveAt > checkInClosesAt;
}
