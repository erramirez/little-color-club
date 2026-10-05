// Updates apply only outside active play, after local saves finish.
export function manageUpdates({serviceWorker, isSafe, save, lock, unlock, status, reload, channel = () => new MessageChannel(), later = setTimeout, cancel = clearTimeout}) {
  let registration, reloadTimer, applying = false, pendingReload = false, hadController = !!serviceWorker.controller;
  async function apply() {
    if (applying || !registration?.waiting || !isSafe()) return;
    applying = true;
    lock();
    try {
      await save();
      const waiting = registration.waiting;
      if (!waiting) { applying = false; unlock(); return; }
      const ports = channel();
      const result = await new Promise((resolve, reject) => {
        const timer = later(() => reject(new Error('Update timed out')), 15000);
        ports.port1.onmessage = event => { cancel(timer); ports.port1.close(); resolve(event.data); };
        pendingReload = true;
        waiting.postMessage({type: 'APPLY_UPDATE'}, [ports.port2]);
      });
      if (result === 'UPDATING') {
        reloadTimer = later(() => {
          pendingReload = false;
          applying = false;
          unlock();
          status('Update will wait. Check again when connected.');
        }, 15000);
      } else {
        pendingReload = false;
        applying = false;
        unlock();
        status('Close other Color Club windows, then check again.');
      }
    } catch {
      pendingReload = false;
      applying = false;
      unlock();
      status('Update will wait. Your pictures stay here. Try again when connected.');
    }
  }
  function available() {
    if (!registration?.waiting) return;
    status(isSafe() ? 'An update is ready.' : 'An update is ready. Finish playing to use it.');
    void apply();
  }
  async function check(manual = false) {
    if (!registration || applying) return;
    if (manual) status('Checking for updates…');
    try {
      await registration.update();
      if (registration.waiting) available();
      else if (manual) status(registration.installing ? 'Downloading an update…' : 'Color Club is up to date.');
    } catch { if (manual) status('Connect to check for updates.'); }
  }
  serviceWorker.addEventListener('controllerchange', () => {
    if (pendingReload || (hadController && isSafe())) { cancel(reloadTimer); reload(); }
    hadController = true;
  });
  const ready = serviceWorker.register('./sw.js', {updateViaCache: 'none'}).then(reg => {
    registration = reg;
    const watch = () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') available();
        if (worker.state === 'redundant') status('Update could not download. Try again when connected.');
      });
    };
    reg.addEventListener('updatefound', watch);
    watch();
    available();
    return check();
  }).catch(() => status('Connect to check for updates.'));
  return {ready, check, available};
}
