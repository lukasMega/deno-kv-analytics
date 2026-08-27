// Shared by the dashboard and the help page. Both are served from this same
// collector, so they share the token/site controls and the fetch plumbing.
//
// Flat sibling of main.ts on purpose: Deno Deploy uploads files referenced by
// `new URL("./x", import.meta.url)` next to the entrypoint, but NOT ones in a
// subdirectory. No src/js/.
//
// Contract: every page importing this must have `#token` and `#site` inputs.
// They are the only DOM the shared helpers touch.

export const $ = (id) => document.getElementById(id);

export const esc = (s) =>
  String(s).replace(
    /[<>&]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]),
  );

// UTC everywhere, matching the server's day keys.
export const iso = (d) => d.toISOString().slice(0, 10);
export const todayIso = () => iso(new Date());

// Shared across /dashboard and /help so arriving at either one already knows
// which site you were looking at and which token opens it.
export const SITE_KEY = "da_site";
export const TOKEN_KEY = "da_token";

// Stats fetch with the token in an Authorization header (keeps the secret out
// of the URL / access logs; the server also accepts ?token= for curl).
export function statsFetch(path) {
  if (path.startsWith("/stats")) {
    const site = $("site").value.trim();
    if (site) {
      path += (path.includes("?") ? "&" : "?") + "site=" +
        encodeURIComponent(site);
    }
  }
  return fetch(path, {
    headers: { authorization: "Bearer " + $("token").value },
  });
}

// A single /stats probe tells us whether this token opens this site: the server
// returns 401 for a wrong token *and* for a site the token doesn't own, which is
// exactly the question every caller here is asking.
export async function tokenOk() {
  try {
    const res = await statsFetch("/stats?day=" + todayIso());
    return res.status !== 401;
  } catch {
    return false;
  }
}

// /sites requires the admin token — a per-site token gets 401 here, which is
// expected (not an error): the datalist just stays empty and the user types the
// site id by hand. One control (input + datalist) covers both cases instead of
// swapping between a <select> and a text input.
export async function loadSites(datalistId = "siteList") {
  const dl = $(datalistId);
  if (!dl) return;
  try {
    const res = await statsFetch("/sites");
    if (!res.ok) {
      dl.innerHTML = "";
      return;
    }
    const sites = await res.json();
    dl.innerHTML = sites.map((s) =>
      '<option value="' + esc(s.id) + '">' + esc(s.host || s.id) + "</option>"
    ).join("");
  } catch {
    dl.innerHTML = "";
  }
}

// Restores the remembered token/site and keeps them in sync as they're edited.
export function bindTokenAndSite(onSiteChange) {
  const token = $("token"), site = $("site");
  const savedToken = localStorage.getItem(TOKEN_KEY);
  if (savedToken !== null) token.value = savedToken;
  site.value = localStorage.getItem(SITE_KEY) || "";
  token.oninput = () => localStorage.setItem(TOKEN_KEY, token.value);
  site.oninput = () => localStorage.setItem(SITE_KEY, site.value.trim());
  if (onSiteChange) site.onchange = onSiteChange;
}
