export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, detail: string) {
    super(detail || code);
    this.status = status;
    this.code = code;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) return (res.status === 204 ? null : res.json()) as Promise<T>;
  let code = res.statusText, detail = "";
  try {
    const body = await res.json();
    code = body.error ?? code;
    detail = body.detail ?? (typeof body === "string" ? body : JSON.stringify(body));
  } catch {
    /* non-JSON error body */
  }
  throw new ApiError(res.status, code, detail);
}

export const fetcher = <T = unknown>(url: string) => fetch(url).then((r) => handle<T>(r));

const send = <T>(method: string) => (url: string, body?: unknown) =>
  fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => handle<T>(r));

export const post = <T = unknown>(url: string, body?: unknown) => send<T>("POST")(url, body);
export const patch = <T = unknown>(url: string, body?: unknown) => send<T>("PATCH")(url, body);
export const put = <T = unknown>(url: string, body?: unknown) => send<T>("PUT")(url, body);
export const del = <T = unknown>(url: string) => send<T>("DELETE")(url);
export const upload = <T = unknown>(url: string, fd: FormData) => fetch(url, { method: "POST", body: fd }).then((r) => handle<T>(r));

export const fileUrl = (path: string | null | undefined) => (path ? `/api/files/${path}` : "");

export function qs(params: Record<string, string | number | boolean | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
