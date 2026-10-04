const DB_NAME = 'little-color-club-v2';
let dbPromise;

export function openDB() {
  return dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      const art = db.objectStoreNames.contains('art')
        ? req.transaction.objectStore('art') : db.createObjectStore('art', {keyPath: 'key'});
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      const payloads = db.createObjectStore('payloads', {keyPath: 'key'});
      art.createIndex('familyProfile', ['family', 'profile']);
      art.createIndex('pendingFamily', ['family', 'pendingFlag']);
      art.openCursor().onsuccess = e => {
        const cursor = e.target.result;
        if (!cursor) return;
        const {paint, customBase, ...meta} = cursor.value;
        meta.pendingFlag = meta.pending ? 1 : 0;meta.hasBase=!!customBase;
        payloads.put({key: meta.key, paint, customBase});
        cursor.update(meta);
        cursor.continue();
      };
    };
    req.onsuccess = () => {
      req.result.onversionchange = () => {req.result.close(); dbPromise = null;};
      resolve(req.result);
    };
    req.onerror = () => {dbPromise = null; reject(req.error);};
    req.onblocked = () => {dbPromise = null; req.onsuccess=()=>req.result.close(); reject(new Error('Close other Color Club tabs, then retry.'));};
  });
}

async function transaction(stores, mode, work) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Storage unavailable'));
    work(tx, value => {result = value;});
  });
}
const setting = (mode, op) => transaction(['settings'], mode, (tx, done) => {
  const req = op(tx.objectStore('settings'));
  req.onsuccess = () => done(req.result);
});
export const getSetting = key => setting('readonly', s => s.get(key));
export const setSetting = (key, value) => setting('readwrite', s => s.put(value, key));
export const artKey = (family, profile, id) => `${family}:${profile}:${id}`;

function write(tx, record) {
  const {paint, customBase, ...meta} = record;
  tx.objectStore('art').put({...meta, hasBase:!!customBase, pendingFlag: meta.pending ? 1 : 0});
  tx.objectStore('payloads').put({key: record.key, paint, customBase});
}
function read(tx, key, done) {
  const meta = tx.objectStore('art').get(key);
  meta.onsuccess = () => {
    if (!meta.result) return done(undefined);
    const payload = tx.objectStore('payloads').get(key);
    payload.onsuccess = () => done({...meta.result, ...payload.result});
  };
}
export const getArt = key => transaction(['art', 'payloads'], 'readonly', (tx, done) => read(tx, key, done));

// Redirect stale editor snapshots after a conflict, and never revert an acknowledged ETag.
export function putArt(record) {
  return transaction(['art', 'payloads', 'settings'], 'readwrite', (tx, done) => {
    const alias = tx.objectStore('settings').get('redirect:' + record.key + ':' + (record.editorId || ''));
    alias.onsuccess = () => {
      const key = alias.result || record.key;
      read(tx, key, current => {
        if (current?.deleted && !record.deleted) return done(current);
        const next = {...record, key, id: current?.id || record.id,
          etag: current?.etag || record.etag, syncError: '', retryAt: 0, attempts: 0};
        write(tx, next);
        done(next);
      });
    };
  });
}

export function acknowledgeUpload(key, revision, etag, expectedEtag) {
  return transaction(['art'], 'readwrite', (tx, done) => {
    const store = tx.objectStore('art'), req = store.get(key);
    req.onsuccess = () => {
      const current = req.result;
      if (!current) return done(false);
      if((!current.pending&&current.revision!==revision)||(expectedEtag!==undefined&&(current.etag||null)!==expectedEtag&&current.etag!==etag))return done(!!current.pending);
      current.etag = etag;
      current.pending = current.revision !== revision;
      current.pendingFlag = current.pending ? 1 : 0;
      current.syncError = ''; current.retryAt = 0; current.attempts = 0;
      store.put(current);
      done(current.pending);
    };
  });
}
export function markSyncError(key, revision, message, permanent = false) {
  return transaction(['art'], 'readwrite', (tx, done) => {
    const s = tx.objectStore('art'), req = s.get(key);
    req.onsuccess = () => {
      const a = req.result;
      if (!a || a.revision !== revision) return;
      a.attempts = (a.attempts || 0) + 1;
      a.syncError = message;
      a.retryAt = permanent ? Number.MAX_SAFE_INTEGER : Date.now() + Math.min(300000, 2000 * 2 ** Math.min(a.attempts, 7));
      s.put(a); done(a);
    };
  });
}
export function storeRemote(record) {
  return transaction(['art', 'payloads'], 'readwrite', (tx, done) => {
    read(tx, record.key, current => {
      if (current?.pending) return done(current);
      write(tx, record); done(record);
    });
  });
}

// Fork the latest local revision and replace the original in a single transaction.
// Fetch the remote version BEFORE calling this: failed fetches create no duplicate forks.
export function preserveConflict(key, remote, proposedId) {
  return transaction(['art', 'payloads', 'settings'], 'readwrite', (tx, done) => {
    read(tx, key, current => {
      if (!current?.pending) return done(null);
      if (current.deleted || remote.deleted) {
        // A tombstone wins over an older offline drawing; retain no visible resurrection.
        const deleted = {...current, deleted: true, paint: '', customBase: null,
          pending: !remote.deleted, etag: remote.etag, revision: crypto.randomUUID()};
        write(tx, deleted); done({deleted: true, record: deleted}); return;
      }
      const fork = {...current, id: proposedId, key: artKey(current.family, current.profile, proposedId),
        title: (current.title + ' · another version').slice(0, 100), etag: null,
        pending: true, syncError: '', retryAt: 0, attempts: 0};
      write(tx, fork);
      write(tx, remote);
      tx.objectStore('settings').put(fork.key, 'redirect:' + key + ':' + (current.editorId || ''));
      done({record: fork, deleted: false});
    });
  });
}
export async function listArt(family, profile, includeDeleted = false) {
  const all = await transaction(['art'], 'readonly', (tx, done) => {
    const req = tx.objectStore('art').index('familyProfile').getAll([family, profile]);
    req.onsuccess = () => done(req.result);
  });
  return all.filter(a => includeDeleted || !a.deleted).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function pendingArt(family) {
  const all = await transaction(['art'], 'readonly', (tx, done) => {
    const req = tx.objectStore('art').index('pendingFamily').getAll([family, 1]);
    req.onsuccess = () => done(req.result);
  });
  return all;
}
export function retryPending(family) {
  return transaction(['art'], 'readwrite', (tx, done) => {
    const store = tx.objectStore('art'), req = store.index('pendingFamily').openCursor([family, 1]);
    req.onsuccess = () => {const c = req.result; if (!c) return done(true);
      c.update({...c.value, retryAt: 0}); c.continue();};
  });
}
export async function deleteArt(record) {
  const existing = await getArt(record.key);
  return putArt({...record, ...existing, deleted: true, paint: '', customBase: null,
    thumbnail: '', updatedAt: Date.now(), revision: crypto.randomUUID(), pending: true});
}
