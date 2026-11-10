import { router } from './router.js';

export class NotFound extends Error {}
export class Redirect extends Error { constructor(to) { super(to); this.to = to; } }

export function notFound() { throw new NotFound(); }
export function redirect(to) { throw new Redirect(to); }
export function useRouter() { return router; }
