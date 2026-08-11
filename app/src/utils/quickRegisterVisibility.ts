export const QUICK_REGISTER_VISIBILITY_EVENT = "cca:quick-register-visibility";

export function setQuickRegisterVisibility(open: boolean) {
  if (typeof document === "undefined") return;
  if (open) document.documentElement.dataset.quickRegisterOpen = "true";
  else delete document.documentElement.dataset.quickRegisterOpen;
  window.dispatchEvent(new CustomEvent<boolean>(QUICK_REGISTER_VISIBILITY_EVENT, { detail: open }));
}

export function isQuickRegisterVisible() {
  return typeof document !== "undefined" && document.documentElement.dataset.quickRegisterOpen === "true";
}
