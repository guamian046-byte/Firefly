import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { AstroCookies } from "astro";
import { query } from "./db";

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "firefly_session";
const SESSION_DAYS = 30;

export type UserRole = "user" | "author" | "moderator" | "admin";
export type SessionUser = {
	id: string;
	email: string;
	username: string;
	role: UserRole;
	active: boolean;
};

function hashToken(token: string) {
	return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
	const salt = randomBytes(16);
	const derived = (await scrypt(password, salt, 64)) as Buffer;
	return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
	const [algorithm, saltHex, hashHex] = stored.split(":");
	if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
	const expected = Buffer.from(hashHex, "hex");
	const actual = (await scrypt(password, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createSession(userId: string, cookies: AstroCookies) {
	const token = randomBytes(32).toString("base64url");
	const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
	await query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
		hashToken(token),
		userId,
		expires,
	]);
	cookies.set(COOKIE_NAME, token, {
		httpOnly: true,
		secure: import.meta.env.PROD,
		sameSite: "lax",
		path: "/",
		expires,
	});
}

export async function destroySession(cookies: AstroCookies) {
	const token = cookies.get(COOKIE_NAME)?.value;
	if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
	cookies.delete(COOKIE_NAME, { path: "/" });
}

export async function getCurrentUser(cookies: AstroCookies): Promise<SessionUser | null> {
	const token = cookies.get(COOKIE_NAME)?.value;
	if (!token) return null;
	const result = await query<SessionUser>(
		`SELECT u.id::text, u.email, u.username, u.role, u.active
		 FROM sessions s JOIN users u ON u.id = s.user_id
		 WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.active = TRUE`,
		[hashToken(token)],
	);
	if (!result.rows[0]) cookies.delete(COOKIE_NAME, { path: "/" });
	return result.rows[0] ?? null;
}

export function canModerate(user: SessionUser | null) {
	return user?.role === "admin" || user?.role === "moderator";
}

export function isAdmin(user: SessionUser | null) {
	return user?.role === "admin";
}

export function assertSameOrigin(request: Request) {
	const origin = request.headers.get("origin");
	if (!origin) return;
	const internalOrigin = new URL(request.url).origin;
	const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
	const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
		|| request.headers.get("host")?.trim();
	const publicOrigin = forwardedProto && forwardedHost ? `${forwardedProto}://${forwardedHost}` : internalOrigin;
	if (origin !== internalOrigin && origin !== publicOrigin) throw new Error("请求来源验证失败");
}
