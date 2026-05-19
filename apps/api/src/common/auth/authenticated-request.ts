export type AuthenticatedUser = {
  email: string;
  sessionId: string;
  userId: string;
};

export type AuthenticatedRequest = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  user: AuthenticatedUser;
};
