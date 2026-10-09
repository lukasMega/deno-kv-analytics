// src/ui/da-common.ts
var SITE_KEY = "da_site";
var TOKEN_KEY = "da_token";
var $ = (id) => document.getElementById(id);
var esc = (value) => String(value).replace(/[<>&]/g, (char) => ({
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;"
})[char] ?? char);
var iso = (date) => date.toISOString().slice(0, 10);
var todayIso = () => iso(/* @__PURE__ */ new Date());
function inputs() {
  const token = $("token");
  const site = $("site");
  return token && site ? [
    token,
    site
  ] : null;
}
function statsFetch(path, init = {}) {
  const controls = inputs();
  if (!controls) {
    return Promise.reject(new Error("missing token or site control"));
  }
  const [token, site] = controls;
  if (path.startsWith("/stats") && site.value.trim()) {
    path += `${path.includes("?") ? "&" : "?"}site=${encodeURIComponent(site.value.trim())}`;
  }
  return fetch(path, {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${token.value}`
    }
  });
}
async function tokenOk() {
  try {
    return (await statsFetch(`/stats?day=${todayIso()}`)).status !== 401;
  } catch {
    return false;
  }
}
async function loadSites(datalistId = "siteList") {
  const list = $(datalistId);
  if (!list) return;
  try {
    const response = await statsFetch("/sites");
    const sites = response.ok ? await response.json() : [];
    list.replaceChildren(...Array.isArray(sites) ? sites.flatMap((site) => {
      if (!site || typeof site !== "object" || typeof site.id !== "string") return [];
      const option = document.createElement("option");
      option.value = site.id;
      option.textContent = typeof site.host === "string" ? site.host : option.value;
      return [
        option
      ];
    }) : []);
  } catch {
    list.replaceChildren();
  }
}
function bindTokenAndSite(onSiteChange) {
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
export {
  $,
  SITE_KEY,
  TOKEN_KEY,
  bindTokenAndSite,
  esc,
  iso,
  loadSites,
  statsFetch,
  todayIso,
  tokenOk
};
