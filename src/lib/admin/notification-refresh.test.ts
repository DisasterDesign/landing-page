import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import test from "node:test";

import { startNotificationRefresh } from "./notification-refresh";

class Visibility extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";

  change(value: DocumentVisibilityState) {
    this.visibilityState = value;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

function browser() {
  const document = new Visibility();
  const window = new EventTarget();
  const navigator = { onLine: true };
  let clock = 0;
  let nextId = 0;
  const timers = new Map<number, { callback: () => void; at: number }>();
  return {
    document,
    window,
    navigator,
    setTimeout(callback: () => void, delay: number) {
      const id = ++nextId;
      timers.set(id, { callback, at: clock + delay });
      return id;
    },
    clearTimeout(id: number) { timers.delete(id); },
    advance(milliseconds: number) {
      clock += milliseconds;
      for (const [id, timer] of [...timers]) {
        if (timer.at > clock) continue;
        timers.delete(id);
        timer.callback();
      }
    },
    focus() { window.dispatchEvent(new Event("focus")); },
    online(value: boolean) {
      navigator.onLine = value;
      window.dispatchEvent(new Event(value ? "online" : "offline"));
    },
    get pendingTimers() { return timers.size; },
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test("visible online notifications load immediately and retain the 30-second cadence", async () => {
  const environment = browser();
  let displayed = 0;
  let serverValue = 4;
  const poller = startNotificationRefresh(async () => { displayed = serverValue; }, environment);
  await flush();
  assert.equal(displayed, 4);
  serverValue = 7;
  environment.advance(29_999);
  await flush();
  assert.equal(displayed, 4);
  environment.advance(1);
  await flush();
  assert.equal(displayed, 7);
  poller.stop();
});

test("a hidden tab makes no requests until it becomes visible", async () => {
  const environment = browser();
  environment.document.change("hidden");
  let requests = 0;
  const poller = startNotificationRefresh(async () => { requests++; }, environment);
  environment.focus();
  environment.advance(120_000);
  poller.refresh();
  await flush();
  assert.equal(requests, 0);
  assert.equal(environment.pendingTimers, 0);
  environment.document.change("visible");
  await flush();
  assert.equal(requests, 1);
  poller.stop();
});

test("an offline visible tab makes no requests and refreshes immediately when online", async () => {
  const environment = browser();
  environment.navigator.onLine = false;
  let requests = 0;
  const poller = startNotificationRefresh(async () => { requests++; }, environment);
  environment.focus();
  environment.advance(120_000);
  poller.refresh();
  await flush();
  assert.equal(requests, 0);
  assert.equal(environment.pendingTimers, 0);
  environment.online(true);
  await flush();
  assert.equal(requests, 1);
  poller.stop();
});

test("going offline cancels the next poll and staying hidden prevents online refresh", async () => {
  const environment = browser();
  let requests = 0;
  const poller = startNotificationRefresh(async () => { requests++; }, environment);
  await flush();
  environment.online(false);
  assert.equal(environment.pendingTimers, 0);
  environment.advance(90_000);
  environment.document.change("hidden");
  environment.online(true);
  environment.focus();
  await flush();
  assert.equal(requests, 1);
  environment.document.change("visible");
  await flush();
  assert.equal(requests, 2);
  poller.stop();
});

test("offline aborts a slow request and returning queues one fresh request without overlap", async () => {
  const environment = browser();
  const pending = deferred();
  let requests = 0;
  let displayed = 0;
  let signal: AbortSignal | undefined;
  const poller = startNotificationRefresh(async (requestSignal) => {
    const number = ++requests;
    if (number === 1) {
      signal = requestSignal;
      await pending.promise;
    }
    if (!requestSignal.aborted) displayed = number;
  }, environment);
  environment.online(false);
  assert.equal(signal?.aborted, true);
  environment.online(true);
  environment.focus();
  environment.advance(120_000);
  assert.equal(requests, 1);
  pending.resolve();
  await flush();
  assert.equal(requests, 2);
  assert.equal(displayed, 2);
  poller.stop();
});

test("hiding aborts a slow request and one return refresh replaces its stale response", async () => {
  const environment = browser();
  const pending = deferred();
  let requests = 0;
  let displayed = 0;
  let signal: AbortSignal | undefined;
  const poller = startNotificationRefresh(async (requestSignal) => {
    const number = ++requests;
    if (number === 1) { signal = requestSignal; await pending.promise; }
    if (!requestSignal.aborted) displayed = number;
  }, environment);
  environment.document.change("hidden");
  assert.equal(signal?.aborted, true);
  environment.document.change("visible");
  environment.focus();
  assert.equal(requests, 1);
  pending.resolve();
  await flush();
  assert.equal(requests, 2);
  assert.equal(displayed, 2);
  poller.stop();
});

test("focus and explicit refresh never overlap a slow request and coalesce requested refreshes", async () => {
  const environment = browser();
  const pending = deferred();
  let requests = 0;
  const poller = startNotificationRefresh(async () => { requests++; await pending.promise; }, environment);
  environment.focus();
  environment.focus();
  poller.refresh();
  poller.refresh();
  environment.advance(120_000);
  assert.equal(requests, 1);
  pending.resolve();
  await flush();
  assert.equal(requests, 2);
  assert.equal(environment.pendingTimers, 1);
  poller.stop();
});

test("a failed load preserves displayed data and later polling can recover", async () => {
  const environment = browser();
  let requests = 0;
  let displayed = 9;
  const poller = startNotificationRefresh(async () => {
    if (++requests === 1) throw new Error("network unavailable");
    displayed = 10;
  }, environment);
  await flush();
  assert.equal(displayed, 9);
  environment.advance(30_000);
  await flush();
  assert.equal(displayed, 10);
  poller.stop();
});

test("cleanup aborts requests and prevents timers, focus, visibility and network events from loading", async () => {
  const environment = browser();
  const pending = deferred();
  let requests = 0;
  let displayed = 0;
  let signal: AbortSignal | undefined;
  const poller = startNotificationRefresh(async (requestSignal) => {
    requests++;
    signal = requestSignal;
    await pending.promise;
    if (!requestSignal.aborted) displayed = 1;
  }, environment);
  assert.equal(getEventListeners(environment.window, "online").length, 1);
  assert.equal(getEventListeners(environment.window, "offline").length, 1);
  poller.stop();
  assert.equal(signal?.aborted, true);
  assert.equal(getEventListeners(environment.window, "online").length, 0);
  assert.equal(getEventListeners(environment.window, "offline").length, 0);
  assert.equal(getEventListeners(environment.window, "focus").length, 0);
  assert.equal(getEventListeners(environment.document, "visibilitychange").length, 0);
  pending.resolve();
  await flush();
  environment.online(false);
  environment.online(true);
  environment.document.change("hidden");
  environment.document.change("visible");
  environment.focus();
  environment.advance(120_000);
  poller.refresh();
  await flush();
  assert.equal(requests, 1);
  assert.equal(displayed, 0);
  assert.equal(environment.pendingTimers, 0);
});

test("separate visible tabs stay independent and a hidden tab stops its own polling", async () => {
  const first = browser();
  const second = browser();
  let firstRequests = 0;
  let secondRequests = 0;
  const a = startNotificationRefresh(async () => { firstRequests++; }, first);
  const b = startNotificationRefresh(async () => { secondRequests++; }, second);
  await flush();
  first.document.change("hidden");
  first.advance(30_000);
  second.advance(30_000);
  await flush();
  assert.equal(firstRequests, 1);
  assert.equal(secondRequests, 2);
  a.stop();
  b.stop();
});
