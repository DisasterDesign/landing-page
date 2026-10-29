import assert from "node:assert/strict";
import test from "node:test";

import { createTaskRefreshGuard, startVisibleRefresh } from "./dashboard-refresh";

class Visibility extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";

  change(state: DocumentVisibilityState) {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

function browser() {
  const document = new Visibility();
  const window = new EventTarget();
  let nextId = 0;
  const timers = new Map<number, { callback: () => void; delay: number }>();
  return {
    document,
    window,
    setTimeout(callback: () => void, delay: number) {
      const id = ++nextId;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id: number) {
      timers.delete(id);
    },
    tick() {
      for (const [id, timer] of [...timers]) {
        assert.equal(timer.delay, 30_000);
        timers.delete(id);
        timer.callback();
      }
    },
    focus() {
      window.dispatchEvent(new Event("focus"));
    },
    get pendingTimers() {
      return timers.size;
    },
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test("loads visible data immediately and refreshes it after 30 seconds", async () => {
  const environment = browser();
  let displayed = 0;
  let serverValue = 27;
  const poller = startVisibleRefresh(async () => { displayed = serverValue; }, environment);
  await flush();
  assert.equal(displayed, 27);
  serverValue = 28;
  environment.tick();
  await flush();
  assert.equal(displayed, 28);
  poller.stop();
});

test("does not load in a hidden tab and loads immediately on returning", async () => {
  const environment = browser();
  environment.document.change("hidden");
  let displayed = 0;
  const poller = startVisibleRefresh(async () => { displayed = 27; }, environment);
  environment.tick();
  environment.focus();
  await flush();
  assert.equal(displayed, 0);
  assert.equal(environment.pendingTimers, 0);
  environment.document.change("visible");
  await flush();
  assert.equal(displayed, 27);
  poller.stop();
});

test("cancels a hidden request so its result cannot replace the returning tab's data", async () => {
  const environment = browser();
  const request = deferred();
  let displayed = 0;
  let loads = 0;
  const poller = startVisibleRefresh(async (signal) => {
    if (++loads === 1) {
      await request.promise;
      if (!signal.aborted) displayed = 27;
    } else {
      displayed = 28;
    }
  }, environment);
  environment.document.change("hidden");
  environment.document.change("visible");
  assert.equal(loads, 1);
  request.resolve();
  await flush();
  assert.equal(displayed, 28);
  assert.equal(loads, 2);
  poller.stop();
});

test("refreshes on focus without overlapping or repeating an in-flight request", async () => {
  const environment = browser();
  const request = deferred();
  let loads = 0;
  const poller = startVisibleRefresh(async () => {
    loads++;
    await request.promise;
  }, environment);
  environment.focus();
  environment.focus();
  environment.tick();
  assert.equal(loads, 1);
  request.resolve();
  await flush();
  assert.equal(loads, 1);
  environment.focus();
  await flush();
  assert.equal(loads, 2);
  poller.stop();
});

test("queues one explicit refresh after a mutation when a request is already running", async () => {
  const environment = browser();
  const request = deferred();
  let displayed = 0;
  let serverValue = 2;
  let loads = 0;
  const poller = startVisibleRefresh(async () => {
    loads++;
    const value = serverValue;
    await request.promise;
    displayed = value;
  }, environment);
  serverValue = 1;
  poller.refresh();
  poller.refresh();
  assert.equal(loads, 1);
  request.resolve();
  await flush();
  assert.equal(loads, 2);
  assert.equal(displayed, 1);
  poller.stop();
});

test("cleanup aborts pending data and removes timers and browser listeners", async () => {
  const environment = browser();
  const request = deferred();
  let displayed = 0;
  let loads = 0;
  let activeSignal: AbortSignal | undefined;
  const poller = startVisibleRefresh(async (signal) => {
    loads++;
    activeSignal = signal;
    await request.promise;
    if (!signal.aborted) displayed = 27;
  }, environment);
  poller.stop();
  assert.equal(activeSignal?.aborted, true);
  request.resolve();
  await flush();
  environment.document.change("hidden");
  environment.document.change("visible");
  environment.focus();
  environment.tick();
  poller.refresh();
  await flush();
  assert.equal(loads, 1);
  assert.equal(displayed, 0);
  assert.equal(environment.pendingTimers, 0);
});

test("a failed request can recover at the next refresh", async () => {
  const environment = browser();
  let loads = 0;
  let displayed = 27;
  const poller = startVisibleRefresh(async () => {
    if (++loads === 1) throw new Error("offline");
    displayed = 28;
  }, environment);
  await flush();
  assert.equal(displayed, 27);
  environment.tick();
  await flush();
  assert.equal(displayed, 28);
  poller.stop();
});

test("task snapshots from before or during completion cannot undo the optimistic update", () => {
  const guard = createTaskRefreshGuard();
  const beforeCompletion = guard.snapshot();
  assert.equal(guard.canCommit(beforeCompletion), true);
  const finishCompletion = guard.begin();
  const duringCompletion = guard.snapshot();
  assert.equal(guard.canCommit(beforeCompletion), false);
  assert.equal(guard.canCommit(duringCompletion), false);
  finishCompletion();
  assert.equal(guard.canCommit(beforeCompletion), false);
  assert.equal(guard.canCommit(duringCompletion), false);
  assert.equal(guard.canCommit(guard.snapshot()), true);
});

test("task snapshots wait until every concurrent completion has settled", () => {
  const guard = createTaskRefreshGuard();
  const finishFirst = guard.begin();
  const finishSecond = guard.begin();
  finishFirst();
  assert.equal(guard.canCommit(guard.snapshot()), false);
  finishSecond();
  assert.equal(guard.canCommit(guard.snapshot()), true);
});
