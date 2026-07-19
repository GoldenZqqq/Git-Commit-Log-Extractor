const BLANK_DAY_TIP_DISMISSED_KEY = "gitpulse.blankDayFillTipDismissed";

export function loadBlankDayTipDismissed(): boolean {
  try {
    return localStorage.getItem(BLANK_DAY_TIP_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveBlankDayTipDismissed(dismissed: boolean) {
  try {
    if (dismissed) localStorage.setItem(BLANK_DAY_TIP_DISMISSED_KEY, "1");
    else localStorage.removeItem(BLANK_DAY_TIP_DISMISSED_KEY);
  } catch {
    // Storage can be unavailable in restricted WebViews.
  }
}
