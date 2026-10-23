export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
const APP_BASE_PATH = process.env.NEXT_PUBLIC_APP_BASE_PATH || "";
const appPath = (path: string) => `${APP_BASE_PATH}${path}`;
let sessionToken: (() => Promise<string | null>) | null = null;
export function setSessionToken(getter: (() => Promise<string | null>) | null) {
  sessionToken = getter;
}
export async function api<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const token = await sessionToken?.();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  try {
    response = await fetch(appPath("/api" + path), {
      credentials: "same-origin",
      cache: "no-store",
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(
      "Cannot reach the server. Check that the API and web app are running.",
      503,
    );
  }
  const data = await response
    .json()
    .catch(() => ({ detail: "The server could not complete this request." }));
  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((d: { msg: string }) => d.msg).join("; ")
      : data.detail;
    throw new ApiError(detail || "Request failed.", response.status);
  }
  return data as T;
}
export const post = <T = unknown>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob(
      [typeof data === "string" ? data : JSON.stringify(data, null, 2)],
      { type: typeof data === "string" ? "text/csv" : "application/json" },
    ),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
