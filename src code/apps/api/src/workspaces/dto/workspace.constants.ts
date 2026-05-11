export const WORKSPACE_TYPES = [
  'desk',
  'meeting_room',
  'focus_room',
  'lab',
  'room',
  'parking',
] as const;

export const WORKSPACE_STATUSES = [
  'available',
  'maintenance',
  'inactive',
] as const;

export const WORKSPACE_APPROVAL_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'hidden',
] as const;
