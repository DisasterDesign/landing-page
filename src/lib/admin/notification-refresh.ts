import { startVisibleRefresh } from "./dashboard-refresh";

type NotificationRefreshEnvironment = {
  document: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  window: Pick<Window, "addEventListener" | "removeEventListener">;
  navigator: Pick<Navigator, "onLine">;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (timer: number) => void;
};

/** Keep notification polling offline-aware without changing dashboard refreshes.
 * Each mounted visible tab remains independent; no cross-tab locks are added.
 */
export function startNotificationRefresh(
  load: (signal: AbortSignal) => Promise<void>,
  environment: NotificationRefreshEnvironment = {
    document,
    window,
    navigator,
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: (timer) => window.clearTimeout(timer),
  },
) {
  // Reuse the controller's cancellation, single-flight and queued-refresh rules.
  // A disconnected tab is treated as inactive, just like a hidden tab.
  return startVisibleRefresh(load, {
    document: {
      get visibilityState() {
        return environment.navigator.onLine ? environment.document.visibilityState : "hidden";
      },
      addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
        environment.document.addEventListener(type, listener, options);
        if (type === "visibilitychange") {
          environment.window.addEventListener("offline", listener, options);
          environment.window.addEventListener("online", listener, options);
        }
      },
      removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) {
        environment.document.removeEventListener(type, listener, options);
        if (type === "visibilitychange") {
          environment.window.removeEventListener("offline", listener, options);
          environment.window.removeEventListener("online", listener, options);
        }
      },
    },
    window: environment.window,
    setTimeout: environment.setTimeout,
    clearTimeout: environment.clearTimeout,
  });
}
