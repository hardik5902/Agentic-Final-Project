const PORTAL_TOKEN_KEY = "supplierPortalToken";

export function rememberPortalToken(token: string) {
  try {
    window.localStorage.setItem(PORTAL_TOKEN_KEY, token);
  } catch {
    // Ignore storage failures and keep the session URL-driven.
  }
}

export function getRememberedPortalToken() {
  try {
    return window.localStorage.getItem(PORTAL_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearRememberedPortalToken() {
  try {
    window.localStorage.removeItem(PORTAL_TOKEN_KEY);
  } catch {
    // Ignore storage failures.
  }
}
