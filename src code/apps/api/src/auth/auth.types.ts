export type AuthenticatedUser = {
  id: string;
  email: string | null;
  role: string;
  fullName: string | null;
};
