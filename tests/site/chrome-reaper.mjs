// Owns a spawned headless Chrome and its temp profile: release() stops Chrome and deletes the profile, and
// an interrupted run (Ctrl-C, runner timeout, SIGTERM/SIGHUP) still kills Chrome and deletes the profile
// instead of leaving an orphaned browser spinning and another directory in $TMPDIR. SIGKILL cannot be caught.
import { rmSync, existsSync, appendFileSync } from 'node:fs';
const T = (...a) => { if (process.env.REAPER_TRACE) try { appendFileSync(process.env.REAPER_TRACE, [new Date().toISOString().slice(11, 23), process.pid, process.argv[1]?.split('/').pop(), ...a].join(' ') + '\n'); } catch {} };

const live = new Map();
const removeProfile = profile => rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
const sleepSync = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
// Synchronous on purpose: it runs from the exit hook, where no event loop is left to await Chrome's exit.
// A dying Chrome can still write into the profile for a moment, so retry until the directory is gone.
function reapAll() {
  T('reapAll', live.size, [...live.values()].join(','));
  for (const chrome of live.keys()) try { chrome.kill('SIGKILL'); } catch {}
  for (const profile of live.values()) for (let i = 0; i < 20 && existsSync(profile); i++) { try { removeProfile(profile); } catch (e) { T('reap-fail', i, profile, e.code, e.message.slice(0, 120)); } if (existsSync(profile)) sleepSync(100); }
  for (const profile of live.values()) T('reap-end', profile, existsSync(profile));
  live.clear();
}
let hooked = false;
function hook() {
  if (hooked) return; hooked = true;
  process.once('exit', reapAll);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(sig, () => { reapAll(); process.kill(process.pid, sig); });
}

export function own(chrome, profile) {
  hook(); live.set(chrome, profile); T('own', chrome.pid, profile);
  const exited = new Promise(r => chrome.exitCode !== null || chrome.signalCode !== null ? r() : chrome.once('exit', r));
  // The entry stays in `live` until the profile is gone, so a release() the caller did not await is finished by the exit hook.
  let released;
  return () => released ??= (async () => {
    T('release', profile); chrome.kill();
    await Promise.race([exited, new Promise(r => setTimeout(r, 3000).unref())]);
    if (chrome.exitCode === null && chrome.signalCode === null) { chrome.kill('SIGKILL'); await exited; }
    T('exited', profile, chrome.exitCode, chrome.signalCode);
    try { removeProfile(profile); } catch (e) { T('rm-fail', profile, e.code, e.message.slice(0, 120)); throw e; }
    T('removed', profile, existsSync(profile));
    live.delete(chrome);
  })();
}
