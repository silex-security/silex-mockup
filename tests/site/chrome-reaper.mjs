// Owns a spawned headless Chrome and its temp profile: release() stops Chrome and deletes the profile, and
// an interrupted run (Ctrl-C, runner timeout, SIGTERM/SIGHUP) still kills Chrome and deletes the profile
// instead of leaving an orphaned browser spinning and another directory in $TMPDIR. SIGKILL cannot be caught.
import { rmSync, existsSync } from 'node:fs';

const live = new Map();
const removeProfile = profile => rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
const sleepSync = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
// Chrome must be spawned with detached: true, so that it leads a process group this can kill. On Linux its child
// processes outlive the browser process for a moment and write the profile back after it was deleted.
const killGroup = chrome => { try { process.kill(-chrome.pid, 'SIGKILL'); } catch {} };
// Synchronous on purpose: it runs from the exit hook, where no event loop is left to await Chrome's exit.
// A dying Chrome can still write into the profile for a moment, so delete, wait and look again until it stays gone.
function reapAll() {
  for (const chrome of live.keys()) { try { chrome.kill('SIGKILL'); } catch {} killGroup(chrome); }
  for (const profile of live.values()) for (let i = 0; i < 30 && existsSync(profile); i++) { try { removeProfile(profile); } catch {} sleepSync(100); }
  live.clear();
}
let hooked = false;
function hook() {
  if (hooked) return; hooked = true;
  process.once('exit', reapAll);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(sig, () => { reapAll(); process.kill(process.pid, sig); });
}

export function own(chrome, profile) {
  hook(); live.set(chrome, profile);
  const exited = new Promise(r => chrome.exitCode !== null || chrome.signalCode !== null ? r() : chrome.once('exit', r));
  // The entry stays in `live` until the profile is gone, so a release() the caller did not await is finished by the exit hook.
  let released;
  return () => released ??= (async () => {
    chrome.kill();
    await Promise.race([exited, new Promise(r => setTimeout(r, 3000).unref())]);
    if (chrome.exitCode === null && chrome.signalCode === null) { chrome.kill('SIGKILL'); await exited; }
    killGroup(chrome);
    for (let i = 0; existsSync(profile); i++) {
      try { removeProfile(profile); } catch (e) { if (i >= 30) throw e; }
      await new Promise(r => setTimeout(r, 100));
      if (i >= 30 && existsSync(profile)) throw Error('Chrome profile keeps coming back: ' + profile);
    }
    live.delete(chrome);
  })();
}
