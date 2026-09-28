export type {AuthUser, AuthSession} from './authTypes';
export type {
  BootstrapAuthenticatedBody,
  BootstrapTicketBody,
  CreateUserBody,
  RefreshBody,
  LogoutBody,
  MeBody,
  ApiErrorBody,
} from './authTypes';
export {createAuthClient, isAuthApiError} from './authClient';
export type {
  AuthApiError,
  AuthClientError,
  AuthHttpClient,
  AuthTransportError,
  AuthClientDeps,
} from './authClient';
export {
  ACCESS_TOKEN_SKEW_MARGIN_MS,
  activateStoredSession,
  ensureValidSession,
  isAccessTokenExpired,
  persistNewSession,
  resetRefreshStateForTests,
  saveCandidateSession,
  signOut,
  terminalReset,
} from './authSession';
export type {EnsureSessionResult} from './authSession';
export {
  AUTH_ACTIVE_SESSION_SERVICE,
  AUTH_SESSION_SERVICE_PREFIX,
  clearAllSessions,
  deleteSession,
  getActiveSession,
  getActiveSessionId,
  getSession,
  listSessionIds,
  saveSession,
  setActiveSessionId,
} from './sessionStore';
export type {StoredSession, SessionStoreResult} from './sessionStore';
export {
  FALLBACK_DEVICE_ID_KEY,
  SIGNUP_IDEMPOTENCY_KEY,
  bootAccount,
  cancelAccountSwitch,
  confirmAccountSwitch,
  resetBootStateForTests,
  retryAccountSwitch,
  submitOnboardingName,
} from '../../features/account/logic/accountBootstrap';
export type {
  AccountSwitchActionResult,
  AccountSwitchConfirmation,
  BootDeps,
  BootResult,
  SubmitNameResult,
} from '../../features/account/logic/accountBootstrap';
