import type { Dispatch, SetStateAction } from 'react';

export type AuthMeClientState = {
  authenticated: boolean;
  user?: { email: string; firstName: string; lastName: string };
} | null;

export type SetAuthMe = Dispatch<SetStateAction<AuthMeClientState>>;
