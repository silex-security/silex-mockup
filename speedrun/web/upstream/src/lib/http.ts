import { NextResponse } from "next/server";

export const ok = <T,>(data: T, init?: ResponseInit) => NextResponse.json({ data }, init);
export const notFound = (what: string) => NextResponse.json({ error: `${what} not found` }, { status: 404 });
export const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });
