type RefreshEnvironment = {
  document: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  window: Pick<Window, "addEventListener" | "removeEventListener">;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (timer: number) => void;
};

export function startVisibleRefresh(
  load: (signal: AbortSignal) => Promise<void>,
  environment: RefreshEnvironment = {
    document,
    window,
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: (timer) => window.clearTimeout(timer),
  },
) {
  let stopped = false;
  let controller: AbortController | null = null;
  let timer: number | undefined;
  let refreshQueued = false;

  const visible = () => environment.document.visibilityState === "visible";
  const clearTimer = () => {
    if (timer !== undefined) environment.clearTimeout(timer);
    timer = undefined;
  };

  async function run() {
    if (stopped || !visible() || controller) return;
    clearTimer();
    const request = new AbortController();
    controller = request;
    try {
      await load(request.signal);
    } catch {
      // The loader reports endpoint failures; keep refreshing after a failure.
    } finally {
      controller = null;
      if (!stopped && visible()) {
        if (refreshQueued) {
          refreshQueued = false;
          void run();
        } else {
          timer = environment.setTimeout(() => { void run(); }, 30_000);
        }
      }
    }
  }

  const onVisibilityChange = () => {
    if (!visible()) {
      clearTimer();
      refreshQueued = false;
      controller?.abort();
    } else if (controller) {
      refreshQueued = true;
    } else {
      void run();
    }
  };
  const onFocus = () => { void run(); };

  environment.document.addEventListener("visibilitychange", onVisibilityChange);
  environment.window.addEventListener("focus", onFocus);
  void run();

  return {
    refresh() {
      if (stopped || !visible()) return;
      if (controller) refreshQueued = true;
      else void run();
    },
    stop() {
      stopped = true;
      clearTimer();
      controller?.abort();
      environment.document.removeEventListener("visibilitychange", onVisibilityChange);
      environment.window.removeEventListener("focus", onFocus);
    },
  };
}

export function createTaskRefreshGuard() {
  let version = 0;
  let pending = 0;
  return {
    snapshot: () => version,
    canCommit: (snapshot: number) => pending === 0 && snapshot === version,
    begin() {
      version++;
      pending++;
      let settled = false;
      return () => {
        if (settled) return;
        settled = true;
        pending--;
        version++;
      };
    },
  };
}
