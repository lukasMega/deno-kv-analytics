export const SITE_KEY = "da_site";
export const TOKEN_KEY = "da_token";

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;
export const esc = (value: unknown) =>
  String(value).replace(
    /[<>&]/g,
    (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char] ?? char),
  );
export const iso = (date: Date) => date.toISOString().slice(0, 10);
export const todayIso = () => iso(new Date());

function inputs(): [HTMLInputElement, HTMLInputElement] | null {
  const token = $<HTMLInputElement>("token");
  const site = $<HTMLInputElement>("site");
  return token && site ? [token, site] : null;
}

export function statsFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const controls = inputs();
  if (!controls) {
    return Promise.reject(new Error("missing token or site control"));
  }
  const [token, site] = controls;
  if (path.startsWith("/stats") && site.value.trim()) {
    path += `${path.includes("?") ? "&" : "?"}site=${
      encodeURIComponent(site.value.trim())
    }`;
  }
  return fetch(path, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token.value}` },
  });
}

export async function tokenOk(): Promise<boolean> {
  try {
    return (await statsFetch(`/stats?day=${todayIso()}`)).status !== 401;
  } catch {
    return false;
  }
}

export async function loadSites(datalistId = "siteList"): Promise<void> {
  const list = $<HTMLDataListElement>(datalistId);
  if (!list) return;
  try {
    const response = await statsFetch("/sites");
    const sites: unknown = response.ok ? await response.json() : [];
    list.replaceChildren(
      ...(Array.isArray(sites)
        ? sites.flatMap((site) => {
          if (
            !site || typeof site !== "object" ||
            typeof (site as { id?: unknown }).id !== "string"
          ) return [];
          const option = document.createElement("option");
          option.value = (site as { id: string }).id;
          option.textContent =
            typeof (site as { host?: unknown }).host === "string"
              ? (site as { host: string }).host
              : option.value;
          return [option];
        })
        : []),
    );
  } catch {
    list.replaceChildren();
  }
}

export function bindTokenAndSite(onSiteChange?: () => void): void {
  const controls = inputs();
  if (!controls) return;
  const [token, site] = controls;
  const savedToken = localStorage.getItem(TOKEN_KEY);
  if (savedToken !== null) token.value = savedToken;
  site.value = localStorage.getItem(SITE_KEY) ?? "";
  token.oninput = () => localStorage.setItem(TOKEN_KEY, token.value);
  site.oninput = () => localStorage.setItem(SITE_KEY, site.value.trim());
  if (onSiteChange) site.onchange = onSiteChange;
}
