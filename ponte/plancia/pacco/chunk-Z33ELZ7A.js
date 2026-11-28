// src/core/i18n.js
var LOCALE_REGISTRY = Object.freeze({
  en: Object.freeze({
    code: "en",
    name: "English",
    nativeName: "English",
    dir: "ltr",
    intl: "en-US",
    legacy: "dashboard-en.html"
  }),
  it: Object.freeze({
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    dir: "ltr",
    intl: "it-IT",
    legacy: "dashboard.html"
  }),
  es: Object.freeze({
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    dir: "ltr",
    intl: "es-ES",
    legacy: "dashboard-en.html"
  }),
  fr: Object.freeze({
    code: "fr",
    name: "French",
    nativeName: "Français",
    dir: "ltr",
    intl: "fr-FR",
    legacy: "dashboard-en.html"
  }),
  de: Object.freeze({
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    dir: "ltr",
    intl: "de-DE",
    legacy: "dashboard-en.html"
  }),
  pt: Object.freeze({
    code: "pt",
    name: "Portuguese",
    nativeName: "Português",
    dir: "ltr",
    intl: "pt-PT",
    legacy: "dashboard-en.html"
  }),
  nl: Object.freeze({
    code: "nl",
    name: "Dutch",
    nativeName: "Nederlands",
    dir: "ltr",
    intl: "nl-NL",
    legacy: "dashboard-en.html"
  }),
  pl: Object.freeze({
    code: "pl",
    name: "Polish",
    nativeName: "Polski",
    dir: "ltr",
    intl: "pl-PL",
    legacy: "dashboard-en.html"
  }),
  ru: Object.freeze({
    code: "ru",
    name: "Russian",
    nativeName: "Русский",
    dir: "ltr",
    intl: "ru-RU",
    legacy: "dashboard-en.html"
  }),
  tr: Object.freeze({
    code: "tr",
    name: "Turkish",
    nativeName: "Türkçe",
    dir: "ltr",
    intl: "tr-TR",
    legacy: "dashboard-en.html"
  }),
  ar: Object.freeze({
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    dir: "rtl",
    intl: "ar",
    legacy: "dashboard-en.html"
  }),
  hi: Object.freeze({
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    dir: "ltr",
    intl: "hi-IN",
    legacy: "dashboard-en.html"
  }),
  ja: Object.freeze({
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
    dir: "ltr",
    intl: "ja-JP",
    legacy: "dashboard-en.html"
  }),
  ko: Object.freeze({
    code: "ko",
    name: "Korean",
    nativeName: "한국어",
    dir: "ltr",
    intl: "ko-KR",
    legacy: "dashboard-en.html"
  }),
  "zh-Hans": Object.freeze({
    code: "zh-Hans",
    name: "Chinese (Simplified)",
    nativeName: "简体中文",
    dir: "ltr",
    intl: "zh-Hans",
    legacy: "dashboard-en.html"
  }),
  "zh-Hant": Object.freeze({
    code: "zh-Hant",
    name: "Chinese (Traditional)",
    nativeName: "繁體中文",
    dir: "ltr",
    intl: "zh-Hant",
    legacy: "dashboard-en.html"
  })
});
var DEFAULT_LOCALE = "en";
var SOURCE_LOCALE = "it";
var BUILT_IN_LOCALES = Object.freeze([DEFAULT_LOCALE, SOURCE_LOCALE]);
var LOCALE_ALIASES = Object.freeze({
  zh: "zh-Hans",
  "zh-cn": "zh-Hans",
  "zh-sg": "zh-Hans",
  "zh-my": "zh-Hans",
  "zh-hans": "zh-Hans",
  "zh-tw": "zh-Hant",
  "zh-hk": "zh-Hant",
  "zh-mo": "zh-Hant",
  "zh-hant": "zh-Hant",
  cmn: "zh-Hans",
  yue: "zh-Hant",
  in: "id",
  iw: "he",
  ji: "yi",
  no: "nb",
  mo: "ro",
  tl: "fil",
  "pt-br": "pt",
  "es-419": "es"
});
var LOCALE_FALLBACKS = Object.freeze({ "zh-Hant": "zh-Hans" });
var LOWER_TO_CODE = new Map(
  Object.keys(LOCALE_REGISTRY).map((code) => [code.toLowerCase(), code])
);
function supportedLocales() {
  return Object.keys(LOCALE_REGISTRY);
}
function localeInfo(code) {
  return LOCALE_REGISTRY[resolveLocale(code)];
}
function normalizeLocaleTag(tag) {
  if (typeof tag !== "string") return "";
  const raw = tag.trim().replace(/_/g, "-");
  if (!raw) return "";
  const parts = raw.split("-").filter(Boolean);
  if (!parts.length || !/^[A-Za-z]{2,8}$/.test(parts[0])) return "";
  const out = [parts[0].toLowerCase()];
  for (const part of parts.slice(1)) {
    if (part.length === 4 && /^[A-Za-z]+$/.test(part))
      out.push(part[0].toUpperCase() + part.slice(1).toLowerCase());
    else if (part.length === 2 && /^[A-Za-z]+$/.test(part)) out.push(part.toUpperCase());
    else out.push(part.toLowerCase());
  }
  return out.join("-");
}
function resolveLocale(tag) {
  const normalized = normalizeLocaleTag(tag);
  if (!normalized) return DEFAULT_LOCALE;
  let candidate = normalized;
  const seen = /* @__PURE__ */ new Set();
  while (candidate && !seen.has(candidate)) {
    seen.add(candidate);
    const lower = candidate.toLowerCase();
    if (LOWER_TO_CODE.has(lower)) return LOWER_TO_CODE.get(lower);
    if (LOCALE_ALIASES[lower]) {
      candidate = LOCALE_ALIASES[lower];
      continue;
    }
    const cut = candidate.lastIndexOf("-");
    if (cut <= 0) break;
    candidate = candidate.slice(0, cut);
  }
  return DEFAULT_LOCALE;
}
function isSupportedLocale(tag) {
  const normalized = normalizeLocaleTag(tag);
  if (!normalized) return false;
  return resolveLocale(normalized) !== DEFAULT_LOCALE || normalized.toLowerCase().split("-")[0] === "en";
}
function localeChain(code) {
  const resolved = resolveLocale(code);
  const chain = [resolved];
  let bridge = LOCALE_FALLBACKS[resolved];
  while (bridge && !chain.includes(bridge)) {
    chain.push(bridge);
    bridge = LOCALE_FALLBACKS[bridge];
  }
  if (!chain.includes(DEFAULT_LOCALE)) chain.push(DEFAULT_LOCALE);
  return chain;
}
var catalogs = /* @__PURE__ */ new Map();
var pendingLoads = /* @__PURE__ */ new Map();
function compilePattern(key, value) {
  const placeholders = [];
  let source = "^";
  const re = /\$\{[^}]*\}/g;
  let last = 0;
  let match;
  while (match = re.exec(key)) {
    source += escapeRegex(key.slice(last, match.index));
    source += "([\\s\\S]+?)";
    placeholders.push(match[0]);
    last = match.index + match[0].length;
  }
  source += `${escapeRegex(key.slice(last))}$`;
  return {
    re: new RegExp(source),
    template: value,
    placeholders,
    literal: key.replace(re, "").length
  };
}
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function registerCatalog(code, entries) {
  const resolved = normalizeLocaleTag(code);
  const target = LOWER_TO_CODE.get(resolved.toLowerCase()) || resolved;
  if (!target || !entries || typeof entries !== "object") return;
  let catalog = catalogs.get(target);
  if (!catalog) {
    catalog = { exact: /* @__PURE__ */ new Map(), patterns: [] };
    catalogs.set(target, catalog);
  }
  for (const [key, value] of Object.entries(entries)) {
    if (typeof value !== "string" || !value) continue;
    if (key.includes("${")) catalog.patterns.push(compilePattern(key, value));
    else catalog.exact.set(key, value);
  }
  catalog.patterns.sort((a, b) => b.literal - a.literal);
  notify();
}
var reverseIndex = /* @__PURE__ */ new Map();
function reverseLookup(text, locale2 = getLocale()) {
  const source = typeof text === "string" ? text.trim() : "";
  if (!source) return null;
  for (const code of localeChain(locale2)) {
    if (code === DEFAULT_LOCALE) break;
    const catalog = catalogs.get(code);
    if (!catalog) continue;
    let index = reverseIndex.get(code);
    if (!index || index.size !== catalog.exact.size) {
      const map = /* @__PURE__ */ new Map();
      for (const [key, value] of catalog.exact) if (!map.has(value)) map.set(value, key);
      index = { size: catalog.exact.size, map };
      reverseIndex.set(code, index);
    }
    const hit = index.map.get(source);
    if (hit) return hit;
  }
  return null;
}
function lookup(code, text) {
  const catalog = catalogs.get(code);
  if (!catalog) return null;
  const exact = catalog.exact.get(text);
  if (exact) return exact;
  for (const pattern of catalog.patterns) {
    const match = pattern.re.exec(text);
    if (!match) continue;
    let index = 0;
    return pattern.template.replace(/\$\{[^}]*\}/g, () => match[++index] ?? "");
  }
  return null;
}
function translate(text, locale2 = getLocale()) {
  const source = typeof text === "string" ? text : String(text ?? "");
  if (!source) return source;
  for (const code of localeChain(locale2)) {
    if (code === DEFAULT_LOCALE) break;
    const hit = lookup(code, source);
    if (hit) return hit;
  }
  return source;
}
function pick(it, en, locale2 = getLocale()) {
  const code = resolveLocale(locale2);
  if (code === SOURCE_LOCALE) return it;
  if (typeof en !== "string" || !en) return it;
  return translate(en, code);
}
function cartellaDeiCataloghi() {
  const dichiarata = String(root.__DASHBOARDMODERN_CATALOGHI__ || "");
  return dichiarata || "../i18n/";
}
function loadCatalog(code) {
  const target = resolveLocale(code);
  if (BUILT_IN_LOCALES.includes(target) || catalogs.has(target)) return Promise.resolve(target);
  const pending = pendingLoads.get(target);
  if (pending) return pending;
  const promise = import(`${cartellaDeiCataloghi()}${target}.js`).then((module) => {
    registerCatalog(target, module.default || module.catalog || {});
    return target;
  }).catch((error) => {
    pendingLoads.delete(target);
    console.warn(`[dashboardmodern] no i18n catalog for "${target}"`, error);
    return DEFAULT_LOCALE;
  });
  pendingLoads.set(target, promise);
  return promise;
}
var root = globalThis;
var LOCALE_STORAGE_KEY = "cd_lingua";
var LOCALE_LEGACY_KEY = "dashboardmodern_locale";
var LOCALE_EVENT = "dashboardmodern:locale-changed";
var LOCALE_OVERRIDE_GLOBAL = "__DASHBOARDMODERN_LOCALE__";
var explicit = null;
var detected = null;
var detectedSignature = null;
var listeners = /* @__PURE__ */ new Set();
function localeSignature() {
  return `${root[LOCALE_OVERRIDE_GLOBAL] ?? ""}|${root.document?.documentElement?.lang ?? ""}`;
}
function readStoredLocale() {
  try {
    const scritta = root.localStorage?.getItem?.(LOCALE_STORAGE_KEY) || "";
    if (scritta) return scritta;
    const vecchia = root.localStorage?.getItem?.(LOCALE_LEGACY_KEY) || "";
    if (!vecchia) return "";
    try {
      root.localStorage?.setItem?.(LOCALE_STORAGE_KEY, vecchia);
      root.localStorage?.removeItem?.(LOCALE_LEGACY_KEY);
    } catch (_errore) {
    }
    return vecchia;
  } catch (_error) {
    return "";
  }
}
function readQueryLocale() {
  try {
    const search = root.location?.search;
    if (!search) return "";
    return new URLSearchParams(search).get("lang") || new URLSearchParams(search).get("locale") || "";
  } catch (_error) {
    return "";
  }
}
var LINGUA_DI_PARTENZA = (() => {
  try {
    return normalizeLocaleTag(root.document?.documentElement?.lang);
  } catch (_error) {
    return "";
  }
})();
function hostLocale() {
  for (const candidato of [root[LOCALE_OVERRIDE_GLOBAL], LINGUA_DI_PARTENZA]) {
    const normalizzata = normalizeLocaleTag(candidato);
    if (normalizzata && isSupportedLocale(normalizzata)) return resolveLocale(normalizzata);
  }
  return "";
}
function detectLocale() {
  const candidates = [
    readStoredLocale(),
    root[LOCALE_OVERRIDE_GLOBAL],
    readQueryLocale(),
    root.document?.documentElement?.lang,
    /dashboard-en\.html$/i.test(String(root.location?.pathname || "")) ? "en" : "",
    /dashboard\.html$/i.test(String(root.location?.pathname || "")) ? "it" : ""
  ];
  for (const candidate of candidates) {
    const normalized = normalizeLocaleTag(candidate);
    if (normalized && isSupportedLocale(normalized)) return resolveLocale(normalized);
  }
  return SOURCE_LOCALE;
}
function getLocale() {
  if (explicit !== null) return explicit;
  const signature = localeSignature();
  if (detected === null || signature !== detectedSignature) {
    detected = detectLocale();
    detectedSignature = signature;
  }
  return detected;
}
function intlLocale(code = getLocale()) {
  return LOCALE_REGISTRY[resolveLocale(code)].intl;
}
function textDirection(code = getLocale()) {
  return LOCALE_REGISTRY[resolveLocale(code)].dir;
}
function isRtl(code = getLocale()) {
  return textDirection(code) === "rtl";
}
function notify() {
  const code = getLocale();
  for (const listener of [...listeners]) {
    try {
      listener(code);
    } catch (_error) {
    }
  }
  try {
    root.dispatchEvent?.(new CustomEvent(LOCALE_EVENT, { detail: { locale: code } }));
  } catch (_error) {
  }
}
function applyDocumentLocale(code = getLocale(), document = root.document) {
  const info = LOCALE_REGISTRY[resolveLocale(code)];
  const element = document?.documentElement;
  if (!element) return;
  if (element.lang !== info.code) element.lang = info.code;
  if (element.dir !== info.dir) element.dir = info.dir;
  element.setAttribute?.("data-dm-locale", info.code);
}
function setLocale(code, { persist = true, apply = true } = {}) {
  const target = resolveLocale(code);
  const changed = target !== getLocale();
  explicit = target;
  if (persist) {
    try {
      root.localStorage?.setItem?.(LOCALE_STORAGE_KEY, target);
      root.localStorage?.removeItem?.(LOCALE_LEGACY_KEY);
    } catch (_error) {
    }
  }
  if (apply) applyDocumentLocale(target);
  if (changed) notify();
  return loadCatalog(target).then(() => {
    notify();
    return target;
  });
}
function initLocale(preferred) {
  const target = preferred ? resolveLocale(preferred) : detectLocale();
  explicit = target;
  applyDocumentLocale(target);
  return loadCatalog(target).then(() => {
    notify();
    return target;
  });
}
function onLocaleChange(listener) {
  if (typeof listener !== "function") return () => {
  };
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function resetLocale() {
  explicit = null;
  detected = null;
  detectedSignature = null;
}

// src/core/segno-progressivo.js
var testo = (valore) => String(valore ?? "").trim();
var oggetto = (valore) => valore && typeof valore === "object" && !Array.isArray(valore) ? valore : {};
function segnoPiuAlto({
  elenco = [],
  metadata = {},
  prefisso = "",
  identificativo = (voce) => voce?.id,
  campoSegno = "seq",
  minimo = 0
} = {}) {
  const numeroDi = (valore) => {
    const trovato = new RegExp(`^${prefisso}-(\\d+)$`).exec(testo(valore));
    return trovato ? Number(trovato[1]) : minimo;
  };
  const daiVivi = (Array.isArray(elenco) ? elenco.filter(Boolean) : []).reduce(
    (massimo, voce) => Math.max(massimo, numeroDi(identificativo(voce))),
    minimo
  );
  const scritto = Number(oggetto(metadata)[campoSegno]);
  return Math.max(daiVivi, Number.isFinite(scritto) ? scritto : minimo, minimo);
}
function prossimoIdentificativo(richiesta = {}) {
  return `${richiesta.prefisso}-${segnoPiuAlto(richiesta) + 1}`;
}

// src/core/energy-plants.js
var clean = (value) => String(value ?? "").trim();
var PRIMO_IMPIANTO = "impianto";
var PLANT_GROUPS = Object.freeze(["house", "grid", "solar", "battery"]);
var PLANT_IDENTITY_FIELDS = Object.freeze(["id", "name", "metadata"]);
var oggetto2 = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
function normalizzato(source = {}, index = 0) {
  const base = oggetto2(source);
  const impianto = {
    /* L'id non si inventa qui a partire dal nome: se manca, il primo prende
     * quello di sempre e gli altri il loro numero d'ordine — ma un impianto
     * nato da `nuovoImpiantoId` un id ce l'ha gia', e quello resta. */
    id: clean(base.id) || (index === 0 ? PRIMO_IMPIANTO : `${PRIMO_IMPIANTO}-${index + 1}`),
    name: clean(base.name),
    metadata: { ...oggetto2(base.metadata) }
  };
  for (const gruppo of PLANT_GROUPS) impianto[gruppo] = { ...oggetto2(base[gruppo]) };
  return impianto;
}
function plantIsConfigured(plant = {}) {
  return PLANT_GROUPS.some(
    (gruppo) => Object.values(oggetto2(plant[gruppo])).some((valore) => clean(valore))
  );
}
function plantList(stored = {}) {
  if (Array.isArray(stored)) return stored.map((item, index) => normalizzato(item, index));
  const source = oggetto2(stored);
  const extra = Array.isArray(source.plants) ? source.plants : [];
  return [normalizzato(source, 0), ...extra.map((item, index) => normalizzato(item, index + 1))];
}
function storedPlants(list = [], previous = {}) {
  const impianti = (Array.isArray(list) ? list : []).map(
    (item, index) => normalizzato(item, index)
  );
  const base = oggetto2(previous);
  const risultato = { ...base };
  delete risultato.plants;
  for (const gruppo of PLANT_GROUPS) delete risultato[gruppo];
  const [primo, ...altri] = impianti;
  if (primo) {
    for (const campo of PLANT_IDENTITY_FIELDS) risultato[campo] = primo[campo];
    for (const gruppo of PLANT_GROUPS) risultato[gruppo] = primo[gruppo];
  }
  if (altri.length) risultato.plants = altri;
  risultato.metadata = {
    ...oggetto2(risultato.metadata),
    [SEQ_FIELD]: altoSegnoImpianti(impianti, {
      ...oggetto2(base.metadata),
      ...oggetto2(primo?.metadata)
    })
  };
  return risultato;
}
var SEQ_FIELD = "plant_seq";
var richiestaDelSegno = (list, metadata) => ({
  elenco: list,
  metadata,
  prefisso: PRIMO_IMPIANTO,
  identificativo: (plant) => plant?.id,
  campoSegno: SEQ_FIELD,
  minimo: 1
});
function altoSegnoImpianti(list = [], metadata = {}) {
  return segnoPiuAlto(richiestaDelSegno(list, metadata));
}
function nuovoImpiantoId(list = [], metadata = {}) {
  return prossimoIdentificativo(richiestaDelSegno(list, metadata));
}
function nuovoImpianto(list = [], nome = "", metadata = {}) {
  return normalizzato({ id: nuovoImpiantoId(list, metadata), name: clean(nome) }, 1);
}
function plantLabel(plant = {}, index = 0, fallback = "Impianto") {
  return clean(plant.name) || (index === 0 ? fallback : `${fallback} ${index + 1}`);
}
function plantKey(base, plant = {}, index = 0) {
  const id = clean(plant?.id);
  if (index === 0 || !id || id === PRIMO_IMPIANTO) return base;
  return `${base}_${id}`;
}
function pickPlant(list = [], scelto = "") {
  const id = clean(scelto);
  return list.find((plant) => plant.id === id) || list[0] || null;
}
var IMPIANTO_SCELTO_KEY = "cd_energy_plant";
function plantAt(stored = {}, scelto = "") {
  const lista = plantList(stored);
  const impianto = pickPlant(lista, scelto);
  if (!impianto) return { list: lista, plant: null, index: 0 };
  const posto = lista.findIndex((voce) => clean(voce?.id) === clean(impianto.id));
  return { list: lista, plant: impianto, index: posto < 0 ? 0 : posto };
}
function plantModel(stored = {}, scelto = "") {
  const impianto = pickPlant(plantList(stored), scelto);
  if (!impianto) return stored;
  return {
    ...stored,
    ...Object.fromEntries(PLANT_GROUPS.map((gruppo) => [gruppo, impianto[gruppo]]))
  };
}
var LOAD_PLANT_FIELD = "plant";
function loadBelongsToPlant(load = {}, plant = {}, index = 0) {
  const scritto = clean(load?.[LOAD_PLANT_FIELD]);
  if (!scritto) return index === 0 || clean(plant?.id) === PRIMO_IMPIANTO;
  return scritto === clean(plant?.id);
}
function plantLoads(loads = [], plant = {}, index = 0) {
  return (Array.isArray(loads) ? loads : []).filter(
    (load) => loadBelongsToPlant(load, plant, index)
  );
}
function dropPlantLoads(loads = [], plantId) {
  const id = clean(plantId);
  if (!id || id === PRIMO_IMPIANTO) return Array.isArray(loads) ? [...loads] : [];
  return (Array.isArray(loads) ? loads : []).filter(
    (load) => clean(load?.[LOAD_PLANT_FIELD]) !== id
  );
}
var PIANI_FIELD = "piani";
var CERCHI_DALLE_STANZE_FIELD = "cerchi_dalle_stanze";
var PIANI_NEL_FLUSSO_FIELD = "piani_nel_flusso";
var DA_SCRITTO = "scritto";
var DA_CARICO = "carico";
var DA_PIANO = "piano";
var DA_UNICO = "unico";
function pianiDellImpianto(plant = {}) {
  const scritti = oggetto2(plant?.metadata)[PIANI_FIELD];
  return [...new Set((Array.isArray(scritti) ? scritti : []).map(clean).filter(Boolean))];
}
function cerchiDalleStanzeAccesi(plant = {}) {
  return oggetto2(plant?.metadata)[CERCHI_DALLE_STANZE_FIELD] !== false;
}
function pianiNelFlusso(plant = {}) {
  return oggetto2(plant?.metadata)[PIANI_NEL_FLUSSO_FIELD] === true;
}
var potenzaDellaVoce = (voce) => clean(voce?.power_entity) || clean(voce?.power);
function stanzaDellaVoce(voce, stanze = []) {
  const scritte = [voce?.room_id, voce?.roomId, voce?.room].map(clean).filter(Boolean);
  for (const scritta of scritte) {
    const minuscola = scritta.toLowerCase();
    const trovata = (Array.isArray(stanze) ? stanze : []).find(
      (stanza2) => clean(stanza2?.id) === scritta || clean(stanza2?.name).toLowerCase() === minuscola
    );
    if (trovata) return trovata;
  }
  return null;
}
function impiantoDellElettrodomestico(apparecchio = {}, { impianti = [], carichi = [], stanze = [] } = {}) {
  const lista = Array.isArray(impianti) ? impianti : [];
  if (lista.length <= 1) return { id: clean(lista[0]?.id) || PRIMO_IMPIANTO, da: DA_UNICO };
  const esiste = (id) => lista.some((impianto) => clean(impianto?.id) === id);
  const scritto = clean(apparecchio?.[LOAD_PLANT_FIELD]);
  if (scritto && esiste(scritto)) return { id: scritto, da: DA_SCRITTO };
  const potenza = potenzaDellaVoce(apparecchio);
  if (potenza) {
    const carico = (Array.isArray(carichi) ? carichi : []).find(
      (voce) => potenzaDellaVoce(voce) === potenza
    );
    if (carico) {
      const suo = clean(carico?.[LOAD_PLANT_FIELD]) || PRIMO_IMPIANTO;
      if (esiste(suo)) return { id: suo, da: DA_CARICO };
    }
  }
  const piano2 = clean(stanzaDellaVoce(apparecchio, stanze)?.floor).toLowerCase();
  if (piano2) {
    const coperto = lista.find(
      (impianto) => pianiDellImpianto(impianto).some((voce) => voce.toLowerCase() === piano2)
    );
    if (coperto) return { id: clean(coperto.id), da: DA_PIANO };
  }
  return { id: "", da: "" };
}
function elettrodomesticiDellImpianto(apparecchi = [], plant = {}, contesto = {}) {
  const id = clean(plant?.id);
  return (Array.isArray(apparecchi) ? apparecchi : []).filter(
    (voce) => voce && impiantoDellElettrodomestico(voce, contesto).id === id
  );
}
function elettrodomesticiDaAssegnare(apparecchi = [], contesto = {}) {
  if ((contesto.impianti || []).length <= 1) return [];
  return (Array.isArray(apparecchi) ? apparecchi : []).map((device, index) => ({ device, index, ...impiantoDellElettrodomestico(device, contesto) })).filter(({ device, da }) => device && clean(device.name) && da !== DA_SCRITTO);
}
function assegnaElettrodomestico(apparecchi = [], index, plantId) {
  return (Array.isArray(apparecchi) ? apparecchi : []).map(
    (voce, at) => at === index ? { ...voce, [LOAD_PLANT_FIELD]: clean(plantId) } : voce
  );
}
var TESSERE_IMPIANTI_KEY = "cd_energia_tessere";
var TESSERA_SOMMA = "somma";
var TESSERA_PER_IMPIANTO = "una-per-impianto";
function comeSiVedeLEnergia(stored) {
  return clean(stored) === TESSERA_PER_IMPIANTO ? TESSERA_PER_IMPIANTO : TESSERA_SOMMA;
}
function sommaLetture(letture = []) {
  const per = /* @__PURE__ */ new Map();
  for (const riga of letture.flat()) {
    if (!riga || !riga.group) continue;
    const voce = per.get(riga.group) || { group: riga.group, watts: null, soc: null, quante: 0 };
    if (typeof riga.watts === "number" && Number.isFinite(riga.watts))
      voce.watts = (voce.watts ?? 0) + riga.watts;
    if (typeof riga.soc === "number" && Number.isFinite(riga.soc)) {
      voce.soc = (voce.soc ?? 0) + riga.soc;
      voce.quante += 1;
    }
    per.set(riga.group, voce);
  }
  return [...per.values()].map(({ group, watts, soc, quante }) => {
    const riga = { group, watts };
    if (quante > 0) riga.soc = soc / quante;
    return riga;
  }).filter((riga) => riga.watts != null || riga.soc != null);
}
function sommaOggi(mappe = []) {
  const totale = {};
  for (const mappa of mappe) {
    if (!mappa || typeof mappa !== "object") continue;
    for (const [chiave, valore] of Object.entries(mappa)) {
      if (typeof valore !== "number" || !Number.isFinite(valore)) continue;
      totale[chiave] = (totale[chiave] ?? 0) + valore;
    }
  }
  return totale;
}
function sommaNumeri(valori = []) {
  const veri = valori.filter((valore) => typeof valore === "number" && Number.isFinite(valore));
  return veri.length ? veri.reduce((totale, valore) => totale + valore, 0) : null;
}

// src/core/verso-aperture.js
var clean2 = (value) => String(value ?? "").trim();
var CHIAVE_VERSI = "cd_stati_invertiti";
function insiemeInvertiti(raw) {
  return new Set((Array.isArray(raw) ? raw : []).map(clean2).filter(Boolean));
}
function apertaSecondoVerso(aperta, invertita) {
  if (aperta == null) return aperta;
  return invertita ? !aperta : Boolean(aperta);
}
function posizioneSecondoVerso(posizione, invertita) {
  const numero = Number(posizione);
  if (posizione == null || !Number.isFinite(numero)) return null;
  const dentro = Math.max(0, Math.min(100, numero));
  return invertita ? 100 - dentro : dentro;
}
var GIRATI = Object.freeze({
  open: "closed",
  closed: "open",
  opening: "closing",
  closing: "opening"
});
function statoSecondoVerso(stato, invertita) {
  const testo2 = clean2(stato).toLowerCase();
  if (!invertita) return testo2;
  return GIRATI[testo2] || testo2;
}
function versoInvertito(item) {
  return item?.invertita === true || item?.invertita === "on" || item?.inverted === true;
}

// src/core/cover-kind.js
var clean3 = (value) => String(value ?? "").trim().toLowerCase();
var COVER_KINDS = Object.freeze(["tapparella", "tenda", "tenda_sole"]);
var COVER_KIND_LABELS = Object.freeze({
  tapparella: ["Tapparella", "Roller shutter"],
  tenda: ["Tenda", "Curtain"],
  tenda_sole: ["Tenda da sole", "Awning"]
});
var DA_DEVICE_CLASS = Object.freeze({
  shutter: "tapparella",
  blind: "tapparella",
  shade: "tapparella",
  curtain: "tenda",
  awning: "tenda_sole"
});
function declaredCoverKind(item = {}) {
  const declared = clean3(item.kind || item.cover_kind || item.type);
  return COVER_KINDS.includes(declared) ? declared : "";
}
function coverKind(item = {}, state = null) {
  const declared = declaredCoverKind(item);
  if (declared) return declared;
  const deviceClass = clean3(state?.attributes?.device_class);
  return DA_DEVICE_CLASS[deviceClass] || "tapparella";
}
function coverKindLabel(kind, locale2 = getLocale()) {
  const labels = COVER_KIND_LABELS[kind] || COVER_KIND_LABELS.tapparella;
  const code = locale2 === true ? "en" : locale2 === false ? SOURCE_LOCALE : locale2;
  return pick(labels[0], labels[1], code);
}
function paroleDelloStato(quale, code) {
  if (quale === "tenda_sole")
    return {
      open: pick("Tenda dispiegata", "Awning out", code),
      closed: pick("Tenda ritratta", "Awning in", code),
      opening: pick("Tenda che si dispiega", "Awning going out", code),
      closing: pick("Tenda che si ritrae", "Awning going in", code)
    };
  if (quale === "tenda")
    return {
      open: pick("Tenda aperta", "Curtain open", code),
      closed: pick("Tenda chiusa", "Curtain closed", code),
      opening: pick("Tenda in apertura", "Curtain opening", code),
      closing: pick("Tenda in chiusura", "Curtain closing", code)
    };
  if (quale === "finestra")
    return {
      open: pick("Finestra aperta", "Window open", code),
      closed: pick("Finestra chiusa", "Window closed", code)
    };
  return {
    open: pick("Tapparella aperta", "Shutter open", code),
    closed: pick("Tapparella chiusa", "Shutter closed", code),
    opening: pick("Tapparella in apertura", "Shutter opening", code),
    closing: pick("Tapparella in chiusura", "Shutter closing", code)
  };
}
var INFISSO = "finestra";
function coverStateLabel(kind, stato, locale2 = getLocale()) {
  const code = locale2 === true ? "en" : locale2 === false ? SOURCE_LOCALE : locale2;
  const chiesto = clean3(kind);
  const quale = chiesto === INFISSO || COVER_KINDS.includes(chiesto) ? chiesto : COVER_KINDS[0];
  return paroleDelloStato(quale, code)[clean3(stato)] || "";
}
var coverIsSideways = (kind) => kind === "tenda";
var coverIsAwning = (kind) => kind === "tenda_sole";
var COVER_SLOTS = Object.freeze([
  { campo: "entity", kind: "", giu: "down" },
  { campo: "tenda", kind: "tenda", giu: "tendaDown" },
  { campo: "tendaSole", kind: "tenda_sole", giu: "tendaSoleDown" }
]);
function coverEntries(item = {}) {
  const uscite = [];
  const viste = /* @__PURE__ */ new Set();
  for (const { campo, kind, giu } of COVER_SLOTS) {
    const entity = clean3(item?.[campo]);
    if (!entity || viste.has(entity)) continue;
    if (entity.toLowerCase().startsWith("binary_sensor.")) continue;
    viste.add(entity);
    uscite.push({
      entity,
      kind: kind || declaredCoverKind(item),
      down: coverDownRelay({ entity, down: item?.[giu] })
    });
  }
  return uscite;
}
function contoDelleAperture(righe2 = []) {
  const elenco = Array.isArray(righe2) ? righe2 : [];
  const coperture = elenco.filter((riga) => riga && !riga.soloSensore);
  const contatti = elenco.filter((riga) => riga && riga.soloSensore);
  const alzate = coperture.filter((riga) => riga.open);
  const aperte = contatti.filter((riga) => riga.open);
  const soloMotori = coperture.length > 0 && contatti.length === 0;
  const miste = coperture.length > 0 && contatti.length > 0;
  const insieme = soloMotori ? coperture : contatti;
  return {
    coperture,
    contatti,
    alzate,
    aperte,
    soloMotori,
    miste,
    insieme,
    /* Quello che la tessera conta ed elenca: tutto cio' che e' aperto o su. */
    tutte: soloMotori ? alzate : miste ? [...aperte, ...alzate] : aperte,
    /* Quello che fa notizia: le ante aperte, o i motori se contatti non ce ne
     * sono. E' il conto che legge la pastiglia sotto il meteo. */
    contate: soloMotori ? alzate : aperte
  };
}
var SWITCH_RE = /^switch\.[a-z0-9_]+$/i;
var isRelayEntity = (entity) => SWITCH_RE.test(clean3(entity));
function coverDownRelay(item = {}) {
  const primo = clean3(item?.entity || item?.entities?.[0]);
  if (!isRelayEntity(primo)) return "";
  const giu = clean3(item?.down ?? item?.down_entity ?? item?.rele_giu);
  return isRelayEntity(giu) && giu !== primo ? giu : "";
}
var CHIAVE_SOGLIA_CHIUSA = "cd_tapparelle_soglia";
var SOGLIA_CHIUSA_MASSIMA = 50;
function coverClosedThreshold(raw) {
  if (raw === null || raw === void 0 || String(raw).trim() === "") return 0;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(SOGLIA_CHIUSA_MASSIMA, value)));
}
function sogliaDellaCopertura(item, globale = 0) {
  const propria = item?.soglia;
  if (propria !== null && propria !== void 0 && String(propria).trim() !== "") {
    const valore = Number(propria);
    if (Number.isFinite(valore)) return coverClosedThreshold(valore);
  }
  return coverClosedThreshold(globale);
}
function coperturaAlzata(item, stato, sogliaDiCasa = 0) {
  const girata = versoInvertito(item);
  const parola = statoSecondoVerso(stato?.state, girata);
  if (parola === "opening") return true;
  const posizione = posizioneSecondoVerso(Number(stato?.attributes?.current_position), girata);
  return Number.isFinite(posizione) ? posizione > sogliaDellaCopertura(item, sogliaDiCasa) : parola === "open";
}
function coverClosedPercent(position) {
  const value = Number(position);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, 100 - value));
}
function coverPresetPosition(item = {}) {
  const raw = item?.preset ?? item?.preset_position;
  if (raw === null || raw === void 0 || String(raw).trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.round(Math.max(0, Math.min(100, value)));
}
var COVER_POSITION_STEP = 5;
function coverPositionChoices(preferred = null) {
  const values = [];
  for (let value = 100; value >= 0; value -= COVER_POSITION_STEP) values.push(value);
  if (preferred == null || values.includes(preferred)) return values;
  values.push(preferred);
  return values.sort((a, b) => b - a);
}
function relayCoverCommands(service, up, down = "") {
  const salita = clean3(up);
  if (!isRelayEntity(salita)) return [];
  const discesa = isRelayEntity(down) && clean3(down) !== salita ? clean3(down) : "";
  if (!discesa) {
    if (service === "stop_cover") return [];
    return [{ entity: salita, service: service === "open_cover" ? "turn_on" : "turn_off" }];
  }
  if (service === "stop_cover")
    return [
      { entity: salita, service: "turn_off" },
      { entity: discesa, service: "turn_off" }
    ];
  const sale = service === "open_cover";
  return [
    { entity: sale ? discesa : salita, service: "turn_off" },
    { entity: sale ? salita : discesa, service: "turn_on" }
  ];
}

// src/core/shutter-window.js
var clean4 = (value) => String(value ?? "").trim();
var CONTACT_KEYS = Object.freeze([
  "contact",
  "contact_entity",
  "window_entity",
  "opening_entity"
]);
function contactEntity(cover = {}) {
  for (const key of CONTACT_KEYS) {
    const value = clean4(cover[key]);
    if (value) return value;
  }
  const nellaTapparella = clean4(cover.entity);
  if (nellaTapparella.toLowerCase().startsWith("binary_sensor.")) return nellaTapparella;
  return "";
}
var INFERRIATA_KEYS = Object.freeze([
  "inferriata",
  "inferriata_entity",
  "grate_entity",
  "outer_contact"
]);
function inferriataEntity(cover = {}) {
  for (const key of INFERRIATA_KEYS) {
    const value = clean4(cover[key]);
    if (value) return value;
  }
  return "";
}
var APERTO = /^(on|open|opening|aperto|aperta|true|detected)$/i;
var CHIUSO = /^(off|closed|closing|chiuso|chiusa|false|clear)$/i;
function windowOpenFromState(state) {
  const value = clean4(state);
  if (APERTO.test(value)) return true;
  if (CHIUSO.test(value)) return false;
  return null;
}
function letturaContatto(reference, states, resolve) {
  if (!reference) return { entity: "", open: null, configured: false };
  let entity = reference;
  try {
    entity = clean4(resolve(reference)) || reference;
  } catch (_error) {
    entity = reference;
  }
  const snapshot = states?.[entity] || states?.[reference] || null;
  return { entity, open: windowOpenFromState(snapshot?.state), configured: true };
}
var STATI_SERRAMENTO = Object.freeze(["chiuso", "grata", "infisso", "aperto", "ignoto"]);
function statoDelSerramento(inferriata, infisso) {
  if (inferriata == null && infisso == null) return "ignoto";
  if (inferriata == null) return infisso ? "infisso" : "chiuso";
  if (infisso == null) return inferriata ? "grata" : "chiuso";
  if (inferriata && infisso) return "aperto";
  if (inferriata) return "grata";
  if (infisso) return "infisso";
  return "chiuso";
}
function serramentoModel(cover = {}, states = {}, resolve = (value) => value, invertiti) {
  const giraSe = (entity, aperta) => {
    if (!invertiti || aperta == null) return aperta;
    return invertiti.has(clean4(entity)) ? !aperta : aperta;
  };
  const infisso = letturaContatto(contactEntity(cover), states, resolve);
  const inferriata = letturaContatto(inferriataEntity(cover), states, resolve);
  infisso.open = giraSe(infisso.entity, infisso.open);
  inferriata.open = giraSe(inferriata.entity, inferriata.open);
  return {
    infisso,
    inferriata,
    /* Con la sola grata configurata lo stato lo dice lei; con la sola finestra
     * lo dice la finestra. Chiedere entrambe sarebbe pretendere una casella
     * che meta' delle case non ha. */
    stato: statoDelSerramento(
      inferriata.configured ? inferriata.open : null,
      infisso.configured ? infisso.open : null
    )
  };
}
function isWindowOnly(cover = {}) {
  return Boolean(contactEntity(cover) || inferriataEntity(cover)) && coverEntries(cover).length === 0;
}

// src/core/tavolozza-disegni.js
var PANNELLO = '<rect class="dm-art-panel" x="3" y="3" width="90" height="90" rx="20" fill="#e0f2fe"/><path class="dm-art-highlight" fill="#ffffff" opacity=".75" d="M15 13h66a10 10 0 0 1 10 10v8C70 18 42 17 5 39V23A10 10 0 0 1 15 13Z"/>';
var SCOCCA = 'fill="#0f2942"';
var FRONTALE = 'fill="#f8fafc"';
var VETRO = 'fill="#8be2ff"';
var ACCENTO = 'fill="#0ea5e9"';
var SPENTO = 'fill="#94a3b8"';
var TRATTO = 'fill="none" stroke="#0f2942" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
var TRATTO_CHIARO = 'fill="none" stroke="#f8fafc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
var TRATTO_ACCENTO = 'fill="none" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
var CALDO = 'fill="#fbbf24"';
var VERDE = 'fill="#22c55e"';
function guscio(chiave, corpo, misura = 96) {
  if (!corpo) return "";
  return `<span class="dm-appliance-art dm-catalogo-art" data-dm-art="${chiave}" data-dm-art-style="panel"><svg width="${misura}" height="${misura}" viewBox="0 0 96 96" role="img" aria-hidden="true" focusable="false">${corpo}</svg></span>`;
}

// src/core/disegni-da-riquadro.js
var tinta = (attributo) => attributo.match(/#[0-9a-f]{6}/i)[0];
var SC = tinta(SCOCCA);
var FR = tinta(FRONTALE);
var VT = tinta(VETRO);
var AC = tinta(ACCENTO);
var CA = tinta(CALDO);
var VE = tinta(VERDE);
var RO = "#f43f5e";
var AR = "#f97316";
var DIREZIONI = {
  v: 'x1="0" y1="0" x2="0" y2="1"',
  h: 'x1="0" y1="0" x2="1" y2="0"',
  d: 'x1="0" y1="0" x2="1" y2="1"'
};
function scalini(tinte) {
  return tinte.map((t2, i) => {
    const [c, o] = t2.split("/");
    const off = tinte.length === 1 ? 0 : +(i / (tinte.length - 1)).toFixed(3);
    return `<stop offset="${off}" stop-color="${c}"${o ? ` stop-opacity="${o}"` : ""}/>`;
  }).join("");
}
var lin = (id, dir, ...tinte) => `<linearGradient id="@${id}" ${DIREZIONI[dir]}>${scalini(tinte)}</linearGradient>`;
var rad = (id, cx, cy, r, ...tinte) => `<radialGradient id="@${id}" cx="${cx}" cy="${cy}" r="${r}">${scalini(tinte)}</radialGradient>`;
var sfoca = (id, sd) => `<filter id="@${id}" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="${sd}"/></filter>`;
var STD = {
  bianco: lin("bianco", "v", "#ffffff", "#e2e8f0", "#94a3b8"),
  biancoO: lin("biancoO", "h", "#ffffff", "#e2e8f0", "#94a3b8"),
  blu: lin("blu", "v", "#2b4c75", SC),
  bluO: lin("bluO", "h", "#2b4c75", SC, "#07182a"),
  nero: lin("nero", "v", "#334155", "#0b1220"),
  acciaio: lin("acciaio", "v", "#f1f5f9", "#94a3b8", "#475569"),
  acciaioO: lin("acciaioO", "h", "#f1f5f9", "#94a3b8", "#475569"),
  lente: rad("lente", 0.38, 0.35, 0.7, VT, AC, SC),
  schermo: lin("schermo", "d", "#38bdf8", "#6366f1", "#1e1b4b"),
  fiamma: lin("fiamma", "v", "#ef4444", AR, CA, "#fef9c3"),
  legno: lin("legno", "v", "#b45309", "#78350f", "#422006"),
  legnoC: lin("legnoC", "v", "#e7b77a", "#b7793c"),
  erba: lin("erba", "v", "#4ade80", "#15803d"),
  foglia: rad("foglia", 0.35, 0.3, 0.75, "#86efac", VE, "#15803d"),
  acqua: lin("acqua", "v", "#7dd3fc", AC, "#0369a1"),
  vetro: lin("vetro", "d", "#e0f2fe", `${VT}/.85`, "#38bdf8/.7"),
  accesa: rad("accesa", 0.5, 0.55, 0.6, "#fffbeb", "#fde68a", "#f59e0b/.6"),
  oro: lin("oro", "v", "#fde68a", "#f59e0b", "#b45309"),
  rosso: lin("rosso", "v", "#fb7185", "#e11d48", "#881337"),
  terra: lin("terra", "v", "#92400e", "#451a03"),
  pannello: lin("pannello", "d", "#1e40af", "#1e3a8a", "#172554"),
  b1: sfoca("b1", 1.2),
  b2: sfoca("b2", 2),
  b3: sfoca("b3", 3),
  b5: sfoca("b5", 5),
  b8: sfoca("b8", 8),
  b12: sfoca("b12", 12)
};
var dinamiche = null;
function def(markup) {
  const id = markup.match(/id="@([\w-]+)"/)[1];
  if (dinamiche && !dinamiche.has(id)) dinamiche.set(id, markup);
  return `url(#@${id})`;
}
var sigla = (c) => c.replace(/[^0-9a-z]/gi, "");
var n = (v) => +(+v).toFixed(1);
var R = (x, y, w, h, rx, fill, altro = "") => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rx ? ` rx="${rx}"` : ""} fill="${fill}"${altro ? ` ${altro}` : ""}/>`;
var C = (cx, cy, r, fill, altro = "") => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"${altro ? ` ${altro}` : ""}/>`;
var E = (cx, cy, rx, ry, fill, altro = "") => `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}"${altro ? ` ${altro}` : ""}/>`;
var P = (d, fill, altro = "") => `<path d="${d}" fill="${fill}"${altro ? ` ${altro}` : ""}/>`;
var L = (d, colore, larg = 3, altro = "") => `<path d="${d}" fill="none" stroke="${colore}" stroke-width="${larg}" stroke-linecap="round" stroke-linejoin="round"${altro ? ` ${altro}` : ""}/>`;
function fondo(...tinte) {
  return R(0, 0, 240, 240, 0, def(lin(`f${sigla(tinte.join(""))}`, "v", ...tinte)));
}
function alone(cx, cy, r, colore, op = 0.5) {
  const g = def(
    rad(
      `a${sigla(colore)}${Math.round(op * 100)}`,
      0.5,
      0.5,
      0.5,
      `${colore}/${op}`,
      `${colore}/${op * 0.35}`,
      `${colore}/0`
    )
  );
  return C(cx, cy, r, g);
}
function stanza(m1, m2, p1, p2, y = 156) {
  return `${fondo(m1, m2)}${R(0, y, 240, 240 - y, 0, def(lin(`p${sigla(p1 + p2)}`, "v", p1, p2)))}${R(0, y, 240, 2, 0, "#fff", 'opacity=".18"')}`;
}
function piano(y, tinta2 = "legno", sp = 10) {
  return `${R(0, y, 240, 240 - y, 0, `url(#@${tinta2})`)}${R(0, y, 240, 2.5, 0, "#fde68a", 'opacity=".35"')}${R(0, y + sp, 240, 2, 0, "#000", 'opacity=".18"')}`;
}
var ombra = (cx, cy, rx, ry = 6, op = 0.5) => E(cx, cy, rx, ry, "#020617", `opacity="${op}" filter="url(#@b3)"`);
var led = (cx, cy, colore = VE, r = 3) => `${C(cx, cy, r * 2.2, colore, 'opacity=".55" filter="url(#@b2)"')}${C(cx, cy, r, colore)}`;
var punti = (x, y, nc, nr, dx, dy, r, fill, op = 1) => {
  let s = "";
  for (let i = 0; i < nr; i++)
    for (let j = 0; j < nc; j++)
      s += `M${n(x + j * dx - r)} ${n(y + i * dy)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  return P(s, fill, op < 1 ? `opacity="${op}"` : "");
};
var righe = (x1, y, x2, nr, dy, colore, larg = 2, op = 1) => {
  let d = "";
  for (let i = 0; i < nr; i++) d += `M${n(x1)} ${n(y + i * dy)}H${n(x2)}`;
  return L(d, colore, larg, op < 1 ? `opacity="${op}"` : "");
};
var colonne = (x, y1, y2, nc, dx, colore, larg = 2, op = 1) => {
  let d = "";
  for (let i = 0; i < nc; i++) d += `M${n(x + i * dx)} ${n(y1)}V${n(y2)}`;
  return L(d, colore, larg, op < 1 ? `opacity="${op}"` : "");
};
function schermo(x, y, w, h, r = 4) {
  return `${R(x, y, w, h, r, "url(#@schermo)")}${P(`M${x} ${y + h * 0.72}c${w * 0.2} ${-h * 0.2} ${w * 0.38} ${-h * 0.08} ${w * 0.56} ${-h * 0.22}s${w * 0.3} ${-h * 0.1} ${w * 0.44} ${-h * 0.03}V${y + h - r}q0 ${r} ${-r} ${r}H${x + r}q${-r} 0 ${-r} ${-r}Z`, SC, 'opacity=".45"')}${C(x + w * 0.76, y + h * 0.3, Math.min(w, h) * 0.12, CA, 'opacity=".9"')}${P(`M${x + 3} ${y + 3}h${w * 0.45}L${x + 3} ${y + h * 0.55}Z`, "#fff", 'opacity=".13"')}`;
}
var manopola = (cx, cy, r, c = "url(#@acciaio)") => `${C(cx, cy, r + 1.5, SC)}${C(cx, cy, r, c)}${L(`M${cx} ${cy - r + 2}V${cy - r * 0.35}`, SC, 2)}`;
var nuvola = (x, y, s = 1, op = 0.9) => P(
  `M${x} ${y}h${44 * s}a${10 * s} ${10 * s} 0 0 0-${8 * s}-${15 * s}a${14 * s} ${14 * s} 0 0 0-${24 * s}-${4 * s}a${10 * s} ${10 * s} 0 0 0-${12 * s} ${19 * s}Z`,
  "#fff",
  `opacity="${op}"`
);
var sole = (cx, cy, r = 14) => `${alone(cx, cy, r * 3, "#fde68a", 0.6)}${C(cx, cy, r, "#fef9c3")}`;
var luna = (cx, cy, r = 12) => `${alone(cx, cy, r * 3, "#e0f2fe", 0.3)}${P(`M${cx} ${cy - r}a${r} ${r} 0 1 0 ${r * 0.9} ${r * 1.4}a${r * 0.85} ${r * 0.85} 0 0 1-${r * 0.9}-${r * 1.4}Z`, "#fef9c3")}`;
function rng(seme) {
  let s = seme;
  return () => ((s = s * 16807 % 2147483647) - 1) / 2147483646;
}
var stelle = (seme, quante = 30, maxY = 140) => {
  const r = rng(seme);
  let d = "";
  for (let i = 0; i < quante; i++) {
    const rr = n(0.6 + r() * 1.2);
    d += `M${n(r() * 240 - rr)} ${n(r() * maxY)}a${rr} ${rr} 0 1 0 ${2 * rr} 0a${rr} ${rr} 0 1 0 ${-2 * rr} 0Z`;
  }
  return P(d, "#fff", 'opacity=".55"');
};
function giorno(y = 140, conSole = true) {
  return `${fondo("#38bdf8", "#bae6fd", "#e0f2fe")}${conSole ? sole(196, 36) : ""}${nuvola(30, 44, 0.9)}${P(`M0 ${y - 16}c40-18 80-22 120-12s80 6 120-6v40H0Z`, "#86efac", 'opacity=".8"')}${R(0, y, 240, 240 - y, 0, "url(#@erba)")}`;
}
var notte = (seme = 3) => `${fondo("#0f2942", "#020617")}${stelle(seme)}`;
var fiamma = (cx, base, w, h) => `${P(`M${cx} ${base - h}c${w * 0.2} ${h * 0.3} ${w * 0.5} ${h * 0.45} ${w * 0.5} ${h * 0.72}a${w * 0.5} ${h * 0.28} 0 0 1-${w} 0c0-${h * 0.2} ${w * 0.15}-${h * 0.3} ${w * 0.25}-${h * 0.42}c${w * 0.05} ${h * 0.15} ${w * 0.1} ${h * 0.2} ${w * 0.2} ${h * 0.24}c0-${h * 0.3}-${w * 0.05}-${h * 0.5} ${w * 0.05}-${h * 0.78}Z`, "url(#@fiamma)")}`;
var pianta = (x, base, s = 1) => `${P(`M${x} ${base - 26 * s}c-${14 * s}-${10 * s}-${18 * s}-${26 * s}-${12 * s}-${40 * s}c${8 * s} ${8 * s} ${12 * s} ${20 * s} ${12 * s} ${30 * s}c${2 * s}-${14 * s} ${8 * s}-${26 * s} ${18 * s}-${32 * s}c${2 * s} ${16 * s}-${4 * s} ${30 * s}-${18 * s} ${42 * s}Z`, "url(#@foglia)")}${P(`M${x - 11 * s} ${base - 26 * s}h${22 * s}l-${3 * s} ${26 * s}h-${16 * s}Z`, "#c2410c")}${R(x - 12 * s, base - 28 * s, 24 * s, 5 * s, 2, "#ea580c")}`;
var goccia = (cx, cy, s, fill = VT, altro = "") => P(
  `M${cx} ${cy - s}c${s * 0.4} ${s * 0.6} ${s * 0.75} ${s * 1.05} ${s * 0.75} ${s * 1.45}a${s * 0.75} ${s * 0.75} 0 0 1-${s * 1.5} 0c0-${s * 0.4} ${s * 0.35}-${s * 0.85} ${s * 0.75}-${s * 1.45}Z`,
  fill,
  altro
);
var fulmine = (cx, cy, s = 1, fill = CA) => P(
  `M${cx + 4 * s} ${cy - 16 * s}l-${12 * s} ${18 * s}h${8 * s}l-${4 * s} ${14 * s}l${12 * s}-${18 * s}h-${8 * s}Z`,
  fill
);
function finestra(x, y, w, h, cielo = "giorno") {
  const g = cielo === "notte" ? def(lin("fnotte", "v", "#1e1b4b", "#0f2942")) : cielo === "alba" ? def(lin("falba", "v", "#fb923c", "#fde68a", "#bae6fd")) : def(lin("fgiorno", "v", "#38bdf8", "#bae6fd"));
  return `${R(x - 4, y - 4, w + 8, h + 8, 4, "#e2e8f0")}${R(x, y, w, h, 2, g)}${cielo === "notte" ? C(x + w * 0.7, y + h * 0.3, 5, "#fef9c3") : ""}${L(`M${x + w / 2} ${y}V${y + h}M${x} ${y + h / 2}H${x + w}`, "#e2e8f0", 3)}${P(`M${x + 2} ${y + 2}h${w * 0.3}L${x + 2} ${y + h * 0.4}Z`, "#fff", 'opacity=".25"')}`;
}
var divano = (x, y, w, colore = "#475569", scuro = "#334155") => `${R(x, y, w, 30, 10, scuro)}${R(x + 4, y + 18, w - 8, 22, 6, colore)}${R(x - 6, y + 12, 16, 34, 7, colore)}${R(x + w - 10, y + 12, 16, 34, 7, colore)}${R(x + 6, y + 3, w / 2 - 9, 20, 7, colore, 'opacity=".9"')}${R(x + w / 2 + 3, y + 3, w / 2 - 9, 20, 7, colore, 'opacity=".9"')}${R(x + 6, y + 3, w - 12, 3, 2, "#fff", 'opacity=".15"')}`;
var letto = (x, y, w, coperta = AC) => `${R(x, y - 34, w, 40, 8, "url(#@legno)")}${R(x + 4, y, w - 8, 26, 6, "#e2e8f0")}${R(x + 12, y - 8, w / 2 - 18, 16, 7, FR)}${R(x + w / 2 + 6, y - 8, w / 2 - 18, 16, 7, FR)}${P(`M${x - 4} ${y + 12}h${w + 8}v24a6 6 0 0 1-6 6H${x + 2}a6 6 0 0 1-6-6Z`, coperta)}${R(x - 4, y + 12, w + 8, 4, 2, "#fff", 'opacity=".3"')}`;
var GRUPPI_DISEGNI = Object.freeze(
  [
    { chiave: "luci", nome: { it: "Luci", en: "Lights" } },
    { chiave: "intrattenimento", nome: { it: "Intrattenimento", en: "Entertainment" } },
    { chiave: "cucina", nome: { it: "Cucina", en: "Kitchen" } },
    { chiave: "lavanderia", nome: { it: "Lavanderia e pulizia", en: "Laundry & cleaning" } },
    { chiave: "clima", nome: { it: "Clima", en: "Climate" } },
    { chiave: "energia", nome: { it: "Energia", en: "Energy" } },
    { chiave: "esterno", nome: { it: "Esterno e giardino", en: "Outdoor & garden" } },
    { chiave: "accessi", nome: { it: "Accessi e sicurezza", en: "Access & security" } },
    { chiave: "stanze", nome: { it: "Stanze e scene", en: "Rooms & scenes" } },
    { chiave: "varie", nome: { it: "Animali e varie", en: "Pets & more" } }
  ].map((g) => Object.freeze({ ...g, nome: Object.freeze(g.nome) }))
);
var VOCI = [];
function disegno(chiave, gruppo, it, en, parole, corpo, fuoco = [50, 30]) {
  VOCI.push({ chiave, gruppo, it, en, parole, corpo, fuoco });
}
function costruisci(chiave, corpo) {
  const proprie = /* @__PURE__ */ new Map();
  dinamiche = proprie;
  let testo2;
  try {
    testo2 = corpo();
  } finally {
    dinamiche = null;
  }
  const usate = new Set([...testo2.matchAll(/url\(#@([\w-]+)\)/g)].map((m) => m[1]));
  let defs = "";
  for (const id of usate) {
    if (testo2.includes(`id="@${id}"`)) continue;
    if (proprie.has(id)) defs += proprie.get(id);
    else if (STD[id]) defs += STD[id];
  }
  const tutto = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" preserveAspectRatio="xMidYMid slice">${defs ? `<defs>${defs}</defs>` : ""}${testo2}</svg>`;
  return tutto.replaceAll("@", `${chiave}-`);
}
var tieni = (s) => s.replace(/id="(\w+)"/g, 'id="@$1"').replace(/url\(#(\w+)\)/g, "url(#@$1)");
disegno(
  "proiettore",
  "intrattenimento",
  "Proiettore",
  "Projector",
  ["videoproiettore", "beamer", "cinema", "film", "video projector"],
  () => tieni(`<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#312e81"/><stop offset="1" stop-color="#0b1023"/></linearGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e0f2fe" stop-opacity=".75"/><stop offset="1" stop-color="#8be2ff" stop-opacity="0"/></linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e2e8f0"/><stop offset="1" stop-color="#94a3b8"/></linearGradient>
    <radialGradient id="lens" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="${VT}"/><stop offset=".45" stop-color="${AC}"/><stop offset="1" stop-color="${SC}"/></radialGradient>
    <radialGradient id="glow" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#6366f1" stop-opacity=".55"/><stop offset="1" stop-color="#6366f1" stop-opacity="0"/></radialGradient>
    <filter id="b4"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>
  <rect width="240" height="240" fill="url(#bg)"/>
  <circle cx="110" cy="105" r="120" fill="url(#glow)"/>
  <polygon points="160,108 250,40 250,190" fill="url(#beam)" filter="url(#b4)"/>
  <ellipse cx="110" cy="152" rx="80" ry="7" fill="#020617" opacity=".55"/>
  <rect x="30" y="74" width="148" height="70" rx="20" fill="url(#body)"/>
  <path d="M44 78h120a12 12 0 0 1 10 6H34a12 12 0 0 1 10-6Z" fill="#fff" opacity=".9"/>
  <rect x="30" y="128" width="148" height="16" rx="8" fill="#64748b" opacity=".35"/>
  ${punti(48.5, 98, 6, 4, 9, 8, 2.3, SC, 0.85)}
  <circle cx="58" cy="86" r="2.6" fill="${AC}"/>
  <circle cx="140" cy="109" r="30" fill="#cbd5e1"/>
  <circle cx="140" cy="109" r="25" fill="${SC}"/>
  <circle cx="140" cy="109" r="17" fill="url(#lens)"/>
  <ellipse cx="133" cy="101" rx="6" ry="4" fill="#fff" opacity=".85" transform="rotate(-30 133 101)"/>
  <rect x="46" y="144" width="16" height="7" rx="3" fill="${SC}"/><rect x="148" y="144" width="16" height="7" rx="3" fill="${SC}"/>`)
);
disegno(
  "decoder",
  "intrattenimento",
  "Decoder",
  "Set-top box",
  ["decoder tv", "ricevitore", "satellite", "tv box", "receiver", "box"],
  () => tieni(`<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#0b1220"/></linearGradient>
    <radialGradient id="warm" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#f59e0b" stop-opacity=".45"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></radialGradient>
    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#475569"/><stop offset="1" stop-color="#1e293b"/></linearGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a16207"/><stop offset="1" stop-color="#422006"/></linearGradient>
    <filter id="b6"><feGaussianBlur stdDeviation="6"/></filter><filter id="bb2"><feGaussianBlur stdDeviation="2"/></filter>
  </defs>
  <rect width="240" height="240" fill="url(#bg)"/>
  <circle cx="120" cy="100" r="130" fill="url(#warm)"/>
  <rect x="40" y="16" width="160" height="80" rx="8" fill="#38bdf8" opacity=".35" filter="url(#b6)"/>
  <rect x="44" y="18" width="152" height="74" rx="7" fill="${SC}"/>
  ${schermo(49, 23, 142, 64)}
  <ellipse cx="120" cy="158" rx="88" ry="8" fill="${AC}" opacity=".55" filter="url(#b6)"/>
  <path d="M52 118h136l18 14H34Z" fill="url(#top)"/>
  <path d="M60 120h120" stroke="#fff" stroke-opacity=".25" stroke-width="1.5"/>
  <rect x="34" y="132" width="172" height="22" rx="6" fill="${SC}"/>
  <circle cx="54" cy="143" r="6" fill="${VE}" opacity=".6" filter="url(#bb2)"/><circle cx="54" cy="143" r="3" fill="${VE}"/>
  <rect x="150" y="138" width="40" height="10" rx="3" fill="${VT}" opacity=".9"/>
  <path d="M156 143h4M164 143h4M174 143h10" stroke="${SC}" stroke-width="2" stroke-linecap="round"/>
  <rect x="0" y="156" width="240" height="84" fill="url(#wood)"/>
  <rect x="0" y="156" width="240" height="3" fill="#fde68a" opacity=".35"/>`)
);
disegno(
  "cancello",
  "accessi",
  "Cancello",
  "Gate",
  ["cancello a battente", "cancello ingresso", "swing gate", "driveway gate", "entrata"],
  () => {
    const yArc = (x) => {
      const t2 = (x - 56) / 128;
      return (1 - t2) ** 2 * 64 + 2 * (1 - t2) * t2 * 40 + t2 ** 2 * 64;
    };
    let sbarre = "";
    for (let x = 63; x < 182; x += 10.5) {
      if (Math.abs(x - 120) < 3) continue;
      const y = yArc(x);
      sbarre += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}V136" stroke="${SC}" stroke-width="3.6" stroke-linecap="round"/><circle cx="${x.toFixed(1)}" cy="${(y - 3).toFixed(1)}" r="2.4" fill="${CA}"/>`;
    }
    return tieni(`<defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset=".6" stop-color="#bae6fd"/><stop offset="1" stop-color="#e0f2fe"/></linearGradient>
      <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4ade80"/><stop offset="1" stop-color="#15803d"/></linearGradient>
      <linearGradient id="pil" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".65" stop-color="#e2e8f0"/><stop offset="1" stop-color="#94a3b8"/></linearGradient>
    </defs>
    <rect width="240" height="240" fill="url(#sky)"/>
    <circle cx="196" cy="34" r="16" fill="#fef9c3" opacity=".9"/>
    <path d="M0 112c40-18 80-22 120-12s80 6 120-6v40H0Z" fill="#86efac" opacity=".8"/>
    <rect y="128" width="240" height="112" fill="url(#grass)"/>
    <path d="M104 136h32l40 104H64Z" fill="#e7e5e4"/><path d="M104 136h32l4 10h-40Z" fill="#d6d3d1"/>
    <path d="M0 132c6-18 22-24 34-20v24H0Z M206 112c14-4 30 4 34 22H206Z" fill="#166534"/>
    <path d="M56 ${yArc(56)}Q120 16 184 ${yArc(184)}" fill="none" stroke="${SC}" stroke-width="5" stroke-linecap="round"/>
    ${sbarre}
    <path d="M56 104H184M56 134H184" stroke="${SC}" stroke-width="5" stroke-linecap="round"/>
    <path d="M120 44V136" stroke="${SC}" stroke-width="5"/>
    <circle cx="114" cy="112" r="3" fill="${AC}"/><circle cx="126" cy="112" r="3" fill="${AC}"/>
    <rect x="30" y="44" width="26" height="100" rx="5" fill="url(#pil)"/>
    <rect x="184" y="44" width="26" height="100" rx="5" fill="url(#pil)"/>
    <rect x="26" y="36" width="34" height="10" rx="4" fill="${SC}"/><rect x="180" y="36" width="34" height="10" rx="4" fill="${SC}"/>
    <circle cx="43" cy="28" r="8" fill="${CA}"/><circle cx="197" cy="28" r="8" fill="${CA}"/>
    <circle cx="40" cy="25" r="2.5" fill="#fff" opacity=".8"/><circle cx="194" cy="25" r="2.5" fill="#fff" opacity=".8"/>`);
  }
);
disegno(
  "albero",
  "luci",
  "Albero di Natale",
  "Christmas tree",
  ["natale", "albero", "addobbi", "festa", "christmas", "xmas", "lucine"],
  () => {
    const r = rng(7);
    let neve = "";
    for (let i = 0; i < 46; i++)
      neve += `<circle cx="${(r() * 240).toFixed(1)}" cy="${(r() * 200).toFixed(1)}" r="${(0.8 + r() * 1.6).toFixed(1)}" fill="#fff" opacity="${(0.25 + r() * 0.5).toFixed(2)}"/>`;
    const colori = [CA, RO, VT, "#fde68a", AR];
    let luci = "";
    const fili = [
      [86, 70, 154, 62],
      [72, 104, 168, 96],
      [58, 140, 182, 130]
    ];
    fili.forEach(([x1, y1, x2, y2], k) => {
      luci += `<path d="M${x1} ${y1}Q120 ${y1 + 16} ${x2} ${y2}" fill="none" stroke="#fef3c7" stroke-opacity=".5" stroke-width="1.2"/>`;
      for (let i = 1; i < 8; i++) {
        const t2 = i / 8;
        const x = (1 - t2) ** 2 * x1 + 2 * (1 - t2) * t2 * 120 + t2 ** 2 * x2;
        const y = (1 - t2) ** 2 * y1 + 2 * (1 - t2) * t2 * (y1 + 16) + t2 ** 2 * y2;
        const c = colori[(i + k) % colori.length];
        luci += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${c}" opacity=".55" filter="url(#b3)"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${c}"/>`;
      }
    });
    return tieni(`<defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SC}"/><stop offset="1" stop-color="#020617"/></linearGradient>
      <radialGradient id="warm" cx=".5" cy=".45" r=".5"><stop offset="0" stop-color="${CA}" stop-opacity=".35"/><stop offset="1" stop-color="${CA}" stop-opacity="0"/></radialGradient>
      <linearGradient id="t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4ade80"/><stop offset=".55" stop-color="${VE}"/><stop offset="1" stop-color="#14532d"/></linearGradient>
      <filter id="b3" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="3"/></filter><filter id="b8" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="8"/></filter>
    </defs>
    <rect width="240" height="240" fill="url(#bg)"/>
    <circle cx="120" cy="100" r="120" fill="url(#warm)"/>
    ${neve}
    <rect y="170" width="240" height="70" fill="#e2e8f0" opacity=".16"/>
    <rect x="110" y="146" width="20" height="18" rx="3" fill="#78350f"/>
    <path d="M120 38 52 150h136Z" fill="url(#t)"/>
    <path d="M120 30 66 116h108Z" fill="url(#t)"/>
    <path d="M120 22 80 82h80Z" fill="url(#t)"/>
    <path d="M120 22 80 82h12l28-44Z M120 30 66 116h12l42-70Z M120 38 52 150h12l56-96Z" fill="#fff" opacity=".12"/>
    ${luci}
    <circle cx="120" cy="20" r="14" fill="${CA}" opacity=".6" filter="url(#b8)"/>
    <path d="M120 8l3.5 7.5 8 .9-6 5.4 1.7 8-7.2-4.1-7.2 4.1 1.7-8-6-5.4 8-.9Z" fill="${CA}"/>
    <rect x="70" y="150" width="30" height="24" rx="3" fill="${AC}"/><path d="M85 150v24M70 160h30" stroke="${FR}" stroke-width="3"/>
    <rect x="140" y="156" width="26" height="18" rx="3" fill="#e11d48"/><path d="M153 156v18" stroke="${CA}" stroke-width="3"/>`);
  }
);
disegno(
  "lampione",
  "luci",
  "Luce esterna",
  "Outdoor light",
  [
    "lanterna",
    "lampione",
    "applique esterna",
    "luce giardino",
    "porch light",
    "lantern",
    "wall lantern"
  ],
  () => {
    let mattoni = "";
    for (let r = 0; r < 12; r++) {
      const off = r % 2 ? 0 : -22;
      for (let c = 0; c < 7; c++)
        mattoni += `<rect x="${off + c * 44 + 1}" y="${r * 20 + 1}" width="42" height="18" rx="2" fill="#fff" opacity="${(0.025 + (r * 7 + c) % 5 * 0.012).toFixed(3)}"/>`;
    }
    return tieni(`<defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#475569"/><stop offset="1" stop-color="#111827"/></linearGradient>
      <radialGradient id="halo" cx=".5" cy=".38" r=".5"><stop offset="0" stop-color="${CA}" stop-opacity=".55"/><stop offset=".5" stop-color="#f59e0b" stop-opacity=".18"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></radialGradient>
      <radialGradient id="lv" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#fffbeb"/><stop offset=".35" stop-color="#fde68a"/><stop offset="1" stop-color="#f59e0b" stop-opacity=".55"/></radialGradient>
      <filter id="b3" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <rect width="240" height="240" fill="url(#bg)"/>
    ${mattoni}
    <circle cx="120" cy="92" r="130" fill="url(#halo)"/>
    <rect x="160" y="34" width="22" height="58" rx="5" fill="${SC}"/>
    <path d="M160 52h-14v14" fill="none" stroke="${SC}" stroke-width="7" stroke-linecap="round"/>
    <path d="M94 44h52l-8-12h-36Z" fill="${SC}"/>
    <rect x="114" y="22" width="12" height="10" rx="3" fill="${SC}"/>
    <rect x="96" y="46" width="48" height="82" rx="4" fill="url(#lv)"/>
    <ellipse cx="120" cy="92" rx="12" ry="18" fill="#fff" opacity=".85" filter="url(#b3)"/>
    <path d="M114 84q6 10 12 0M116 96q4 6 8 0" fill="none" stroke="#b45309" stroke-width="1.6"/>
    <rect x="114" y="68" width="12" height="8" rx="2" fill="#94a3b8"/>
    <path d="M96 46v82M144 46v82M110 46v82M130 46v82" stroke="${SC}" stroke-width="3.5"/>
    <rect x="92" y="42" width="56" height="7" rx="2" fill="${SC}"/>
    <path d="M90 128h60l-8 12h-44Z" fill="${SC}"/>
    <circle cx="120" cy="146" r="4" fill="${SC}"/>
    <path d="M100 52l6 0-4 60h-4Z" fill="#fff" opacity=".35"/>`);
  }
);
disegno(
  "prato",
  "esterno",
  "Prato",
  "Lawn",
  ["giardino", "irrigazione", "erba", "prato inglese", "garden", "grass", "sprinkler"],
  () => {
    let strisce = "";
    for (let i = -6; i < 8; i++) {
      const x1 = 120 + i * 9;
      const x2 = 120 + i * 60;
      const x3 = 120 + (i + 1) * 60;
      const x0 = 120 + (i + 1) * 9;
      strisce += `<path d="M${x1} 96L${x2} 240H${x3}L${x0} 96Z" fill="${i % 2 ? "#4ade80" : VE}"/>`;
    }
    let gocce = "";
    for (let a = -70; a <= 70; a += 14) {
      const rad_ = a * Math.PI / 180;
      const dx = Math.sin(rad_);
      gocce += `<path d="M156 126Q${(156 + dx * 34).toFixed(1)} ${(80 - Math.cos(rad_) * 8).toFixed(1)} ${(156 + dx * 58).toFixed(1)} ${(128 - Math.cos(rad_) * 4).toFixed(1)}" fill="none" stroke="${VT}" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 6" opacity=".95"/>`;
    }
    return tieni(`<defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#f0f9ff"/></linearGradient>
      <radialGradient id="can" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#86efac"/><stop offset=".6" stop-color="${VE}"/><stop offset="1" stop-color="#15803d"/></radialGradient>
    </defs>
    <rect width="240" height="240" fill="url(#sky)"/>
    <circle cx="200" cy="30" r="14" fill="#fef9c3"/>
    <path d="M0 98c18-22 44-22 60-12 14-14 40-12 54 0 16-12 42-10 56 2 18-14 52-10 70 4v10H0Z" fill="#166534"/>
    ${strisce}
    <rect x="44" y="70" width="8" height="46" rx="3" fill="#78350f"/>
    <circle cx="48" cy="56" r="28" fill="url(#can)"/><circle cx="30" cy="70" r="16" fill="url(#can)"/><circle cx="66" cy="70" r="17" fill="url(#can)"/>
    <ellipse cx="48" cy="118" rx="20" ry="4" fill="#14532d" opacity=".35"/>
    ${gocce}
    <rect x="151" y="120" width="10" height="12" rx="3" fill="${SC}"/><circle cx="156" cy="119" r="4" fill="${AC}"/>
    <ellipse cx="196" cy="150" rx="14" ry="5" fill="${FR}" opacity=".9"/><ellipse cx="212" cy="172" rx="16" ry="6" fill="${FR}" opacity=".9"/><ellipse cx="228" cy="198" rx="18" ry="7" fill="${FR}" opacity=".9"/>`);
  }
);
disegno(
  "lampadario",
  "luci",
  "Lampadario",
  "Chandelier",
  ["luce soffitto", "sospensione", "salotto", "ceiling light", "pendant"],
  () => {
    let bracci = "";
    let fiamme = "";
    for (const i of [-2, -1, 0, 1, 2]) {
      const x = 120 + i * 30;
      const y = 86 - Math.abs(i) * 6;
      bracci += L(`M120 96Q${120 + i * 24} 122 ${x} ${y + 10}`, "url(#@oro)", 4);
      fiamme += `${alone(x, y - 6, 26, CA, 0.55)}${R(x - 7, y + 6, 14, 6, 2, "url(#@oro)")}${R(x - 3.5, y - 6, 7, 13, 2, FR)}${E(x, y - 12, 4, 7, "#fde68a")}${E(x, y - 11, 2, 4, "#fff")}`;
    }
    const cristalli = [-48, -24, 0, 24, 48].map((dx) => goccia(120 + dx, 126 - Math.abs(dx) * 0.25, 5, VT, 'opacity=".85"')).join("");
    return `${fondo("#44302a", "#1c1412")}${alone(120, 90, 130, CA, 0.35)}${L("M120 0V60", "url(#@oro)", 3)}${punti(120, 10, 1, 6, 0, 9, 2.6, "#b45309")}${bracci}${E(120, 90, 13, 20, "url(#@oro)")}${E(115, 82, 4, 8, "#fff", 'opacity=".55"')}${C(120, 112, 6, "url(#@oro)")}${cristalli}${fiamme}`;
  }
);
disegno(
  "piantana",
  "luci",
  "Piantana",
  "Floor lamp",
  ["lampada a stelo", "lampada ad arco", "lampada da terra", "arc lamp", "standing lamp"],
  () => `${stanza("#334155", "#1e293b", "#78350f", "#422006", 152)}${P("M150 58 112 152h80Z", def(lin("cono", "v", "#fde68a/.55", "#fde68a/0")), 'filter="url(#@b3)"')}${E(150, 152, 42, 6, "#fde68a", 'opacity=".25" filter="url(#@b3)"')}${divano(140, 108, 76, "#64748b", "#475569")}${L("M72 150V64Q72 30 112 30Q146 30 150 50", SC, 6)}${ombra(72, 152, 26, 4)}${E(72, 148, 22, 6, "url(#@blu)")}${alone(150, 62, 34, CA, 0.6)}${P("M130 62a20 18 0 0 1 40 0Z", "url(#@bianco)")}${E(150, 62, 20, 4, "#fde68a")}${R(147, 46, 6, 6, 2, SC)}`
);
disegno(
  "abatjour",
  "luci",
  "Abat-jour",
  "Table lamp",
  ["lampada comodino", "lumetto", "lampada da tavolo", "bedside lamp", "nightstand"],
  () => `${stanza("#1e3a5f", "#0f2942", "#3f2a1d", "#1c1412", 160)}${alone(120, 70, 120, CA, 0.45)}${R(52, 136, 136, 30, 6, "url(#@legno)")}${R(52, 136, 136, 4, 2, "#fde68a", 'opacity=".35"')}${R(108, 148, 24, 3, 1.5, "#fde68a", 'opacity=".6"')}${ombra(120, 136, 34, 4)}${P("M106 136c-8-6-10-22-2-34h32c8 12 6 28-2 34Z", "url(#@bianco)")}${P("M110 104c-4 10-4 22 0 30", "none", `stroke="#fff" stroke-width="3" opacity=".7"`)}${R(117, 84, 6, 18, 2, "url(#@oro)")}${P("M84 88 98 36h44l14 52Z", "url(#@accesa)")}${P("M98 36h44l3 10H95Z", "#fff", 'opacity=".5"')}${P("M84 88h72l-2 4H86Z", "#f59e0b", 'opacity=".6"')}${P("M100 40 92 84h8l6-44Z", "#fff", 'opacity=".35"')}`
);
disegno(
  "faretti",
  "luci",
  "Faretti",
  "Spotlights",
  ["faretto", "binario", "spot", "incasso", "track lights", "downlight"],
  () => {
    let s = "";
    for (const [x, a] of [
      [64, 18],
      [120, 0],
      [176, -18]
    ]) {
      s += `<g transform="rotate(${a} ${x} 30)">${P(`M${x - 10} 62L${x - 36} 170H${x + 36}L${x + 10} 62Z`, def(lin("raggio", "v", "#fef3c7/.6", "#fef3c7/0")), 'filter="url(#@b3)"')}${R(x - 3, 26, 6, 10, 2, SC)}${R(x - 12, 34, 24, 30, 8, "url(#@biancoO)")}${E(x, 63, 10, 3.5, "#fef9c3")}</g>`;
    }
    return `${stanza("#475569", "#1e293b", "#57534e", "#292524", 158)}${E(64, 150, 34, 8, "#fde68a", 'opacity=".22" filter="url(#@b5)"')}${E(176, 150, 34, 8, "#fde68a", 'opacity=".22" filter="url(#@b5)"')}${E(120, 156, 36, 8, "#fde68a", 'opacity=".3" filter="url(#@b5)"')}${R(30, 20, 180, 10, 4, SC)}${R(34, 21, 172, 2, 1, "#fff", 'opacity=".25"')}${s}`;
  }
);
disegno(
  "striscia-led",
  "luci",
  "Striscia LED",
  "LED strip",
  ["led", "strip", "luci colorate", "rgb", "mensola", "ambient light", "light strip"],
  () => {
    const arc = def(lin("arc", "h", AC, "#8b5cf6", "#ec4899"));
    return `${fondo("#1e1b4b", "#0b1023")}${E(120, 84, 110, 30, arc, 'opacity=".55" filter="url(#@b12)"')}${E(120, 142, 110, 26, arc, 'opacity=".45" filter="url(#@b12)"')}${R(40, 58, 22, 18, 3, "#e2e8f0")}${R(66, 50, 8, 26, 2, AC)}${R(76, 46, 8, 30, 2, "#f59e0b")}${R(86, 52, 7, 24, 2, RO)}${pianta(170, 76, 0.7)}${R(32, 76, 176, 10, 3, "url(#@legnoC)")}${R(32, 86, 176, 3, 1.5, arc)}${R(32, 87, 176, 5, 2, arc, 'filter="url(#@b2)"')}${C(84, 124, 10, "url(#@bianco)")}${R(120, 112, 40, 20, 4, SC)}${R(124, 116, 32, 12, 2, "url(#@schermo)")}${R(32, 132, 176, 10, 3, "url(#@legnoC)")}${R(32, 142, 176, 3, 1.5, arc)}${R(32, 143, 176, 5, 2, arc, 'filter="url(#@b2)"')}`;
  }
);
disegno(
  "applique",
  "luci",
  "Applique",
  "Wall light",
  ["lampada a muro", "luce a parete", "sconce", "wall lamp"],
  () => {
    const su = def(lin("su", "v", "#fef3c7/0", "#fef3c7/.7"));
    const giu = def(lin("giu", "v", "#fef3c7/.7", "#fef3c7/0"));
    return `${fondo("#7c6a58", "#3b2f27")}${R(0, 0, 240, 240, 0, "url(#@legnoC)", 'opacity=".12"')}${P("M96 52 64 0h112l-32 52Z", su, 'filter="url(#@b3)"')}${P("M96 128 56 210h128l-40-82Z", giu, 'filter="url(#@b3)"')}${alone(120, 90, 90, CA, 0.45)}${R(88, 48, 64, 84, 14, "url(#@blu)")}${R(88, 48, 64, 6, 3, "#fde68a")}${R(88, 126, 64, 6, 3, "#fde68a")}${R(93, 56, 6, 66, 3, "#fff", 'opacity=".2"')}${C(120, 90, 9, "url(#@oro)")}${C(117, 87, 3, "#fff", 'opacity=".7"')}`;
  }
);
disegno(
  "luci-natale",
  "luci",
  "Luci di Natale",
  "Christmas lights",
  ["festoni", "lucine", "luminarie", "natale", "string lights", "fairy lights", "holiday"],
  () => {
    const colori = [RO, CA, VE, AC, AR, "#a855f7"];
    let s = "";
    [
      [30, 0, 130, 40],
      [52, 20, 152, 50]
    ].forEach(([y, x0, y2, dip], k) => {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const t2 = i / 8;
        pts.push([
          x0 - 10 + t2 * 250 * (k ? 0.92 : 1),
          y + Math.sin(t2 * Math.PI * 2) * 0 + 4 * dip * t2 * (1 - t2) + (y2 - y) * 0
        ]);
      }
      s += L(`M${pts.map((p) => `${n(p[0])} ${n(p[1])}`).join("L")}`, "#1e293b", 2);
      pts.forEach(([x, yy], i) => {
        const c = colori[(i + k * 3) % colori.length];
        s += `${C(x, yy + 12, 13, c, 'opacity=".45" filter="url(#@b3)"')}${R(x - 3, yy, 6, 6, 1, "#334155")}${P(`M${n(x - 5)} ${n(yy + 6)}h10c2 6 1 12-5 16c-6-4-7-10-5-16Z`, c)}${E(x - 2, yy + 11, 1.5, 3, "#fff", 'opacity=".6"')}`;
      });
    });
    return `${notte(11)}${P("M0 0h240v18H0Z", "#e2e8f0", 'opacity=".9"')}${P("M0 18h240v4H0Z", "#94a3b8")}${R(56, 110, 128, 50, 4, "#fde68a", 'opacity=".25"')}${finestra(70, 112, 100, 48, "notte")}${alone(120, 136, 60, CA, 0.3)}${s}`;
  }
);
disegno(
  "insegna",
  "luci",
  "Insegna luminosa",
  "Neon sign",
  ["neon", "scritta luminosa", "insegna", "decorazione", "light sign"],
  () => {
    let m = "";
    for (let r = 0; r < 12; r++)
      for (let c = 0; c < 7; c++)
        m += `M${(r % 2 ? 0 : -22) + c * 44 + 1} ${r * 20 + 1}h42v18h-42Z`;
    const casa = "M66 100 120 54l54 46M78 90v52h84V90";
    return `${fondo("#3f1d38", "#140a14")}${P(m, "#fff", 'opacity=".04"')}${alone(120, 98, 110, "#ec4899", 0.35)}${L(casa, "#f472b6", 12, 'opacity=".55" filter="url(#@b5)"')}${L(casa, "#fbcfe8", 5)}${L("M120 134c-14-9-20-16-20-23a9 9 0 0 1 20-4 9 9 0 0 1 20 4c0 7-6 14-20 23Z", "#22d3ee", 10, 'opacity=".6" filter="url(#@b3)"')}${L("M120 134c-14-9-20-16-20-23a9 9 0 0 1 20-4 9 9 0 0 1 20 4c0 7-6 14-20 23Z", "#cffafe", 4)}${L("M120 0V40M96 0v18M144 0v18", "#64748b", 1.5)}`;
  }
);
disegno(
  "candela",
  "luci",
  "Candele",
  "Candles",
  ["candela", "lume", "atmosfera", "romantico", "candle", "tealight"],
  () => `${fondo("#2a1a10", "#0c0705")}${alone(120, 80, 130, CA, 0.45)}${E(120, 146, 82, 12, "url(#@acciaio)")}${E(120, 143, 76, 8, "#e2e8f0")}${[
    [86, 76, 14],
    [120, 52, 18],
    [154, 90, 13]
  ].map(
    ([x, top, w]) => `${R(x - w, top, w * 2, 144 - top, 6, def(lin("cera", "h", "#fffbeb", "#fde68a", "#d6a86a")))}${E(x, top, w, 4, "#fef3c7")}${L(`M${x} ${top}v-6`, "#292524", 2)}${alone(x, top - 16, 22, "#fde68a", 0.7)}${fiamma(x, top - 4, 12, 26)}${E(x, top - 10, 2.5, 5, "#fff")}`
  ).join("")}`
);
disegno(
  "lampadina",
  "luci",
  "Lampadina smart",
  "Smart bulb",
  ["lampadina", "luce", "bulb", "smart light", "led bulb", "punto luce"],
  () => `${fondo("#1e293b", "#020617")}${alone(120, 72, 120, CA, 0.55)}${L("M70 40a64 64 0 0 1 100 0M80 52a48 48 0 0 1 80 0", VT, 4, 'opacity=".6"')}${C(120, 82, 40, "url(#@accesa)")}${P("M96 106h48l-6 18h-36Z", "#fde68a", 'opacity=".8"')}${L("M110 112V92l5-8 5 8 5-8 5 8v20", "#b45309", 2.5)}${E(106, 70, 8, 14, "#fff", 'opacity=".7" transform="rotate(30 106 70)"')}${R(102, 124, 36, 26, 4, "url(#@acciaioO)")}${righe(102, 131, 138, 3, 6, "#475569", 2)}${P("M108 150h24l-6 8h-12Z", SC)}`
);
disegno(
  "lampada-scrivania",
  "luci",
  "Lampada da scrivania",
  "Desk lamp",
  ["lampada studio", "lampada snodabile", "scrivania", "reading lamp", "task light"],
  () => `${fondo("#334155", "#111827")}${P("M150 74 112 142h92Z", def(lin("cono", "v", "#fef3c7/.75", "#fef3c7/.05")), 'filter="url(#@b3)"')}${piano(140, "legnoC", 8)}${E(158, 140, 46, 5, "#fef3c7", 'opacity=".5" filter="url(#@b3)"')}${P("M126 140l6-12h48l6 12Z", FR)}${L("M156 128v12", "#cbd5e1", 1.5)}${righe(134, 132, 152, 2, 3, "#94a3b8", 1.2)}${righe(160, 132, 178, 2, 3, "#94a3b8", 1.2)}${ombra(70, 140, 30, 4)}${E(70, 136, 28, 7, "url(#@blu)")}${L("M70 134 56 82 132 40", SC, 8)}${C(56, 82, 7, AC)}${C(70, 132, 6, SC)}${alone(150, 70, 44, CA, 0.6)}<g transform="rotate(-24 140 52)">${P("M116 64a24 26 0 0 1 48 0Z", "url(#@blu)")}${E(140, 64, 24, 5, "#fde68a")}${R(124, 44, 14, 3, 1.5, "#fff", 'opacity=".3"')}${R(134, 32, 12, 8, 3, SC)}</g>`
);
disegno(
  "paletti",
  "luci",
  "Luci del vialetto",
  "Path lights",
  ["paletti", "segnapasso", "vialetto", "luci giardino", "bollard", "garden lights"],
  () => {
    const palo = (x, y, s) => `${alone(x, y + 8 * s, 34 * s, CA, 0.5)}${E(x, y + 60 * s, 30 * s, 7 * s, "#fde68a", 'opacity=".25" filter="url(#@b3)"')}${R(x - 7 * s, y, 14 * s, 60 * s, 3, "url(#@bluO)")}${R(x - 6 * s, y + 6 * s, 12 * s, 12 * s, 2, "#fef3c7")}${R(x - 9 * s, y - 4 * s, 18 * s, 8 * s, 3, SC)}`;
    return `${fondo("#312e81", "#1e1b4b", "#0f172a")}${stelle(5, 24, 70)}${luna(190, 34, 10)}${P("M0 96c40-10 80-14 120-10s80 4 120-4v158H0Z", "#14532d")}${P("M104 96h32l70 144H34Z", "#57534e")}${P("M104 96h32l8 16h-48Z", "#78716c")}${palo(76, 92, 0.6)}${palo(164, 92, 0.6)}${palo(56, 112, 0.85)}${palo(184, 112, 0.85)}`;
  }
);
disegno(
  "luce-scale",
  "luci",
  "Luci delle scale",
  "Stair lights",
  ["scale", "segnapasso", "gradini", "scalinata", "stairs", "step lights"],
  () => {
    let g = "";
    for (let i = 0; i < 6; i++) {
      const x = 40 + i * 26;
      const y = 146 - i * 20;
      g += `${R(x, y, 240 - x, 20, 0, i % 2 ? "#e7e5e4" : "#d6d3d1")}${R(x, y, 240 - x, 3, 0, "#fff", 'opacity=".7"')}${alone(x + 18, y + 12, 18, CA, 0.6)}${R(x + 10, y + 9, 16, 4, 2, "#fef3c7")}`;
    }
    return `${fondo("#475569", "#1e293b")}${R(0, 166, 240, 74, 0, "#1c1917")}${g}${L("M44 96 186 0", "#94a3b8", 4)}${L("M54 126 54 92M106 90 106 56M158 54 158 20", "#94a3b8", 3)}`;
  }
);
var salotto = () => stanza("#1e3a5f", "#0f2942", "#78350f", "#2a1608", 150);
disegno(
  "tv",
  "intrattenimento",
  "Televisore",
  "TV",
  ["tv", "televisione", "smart tv", "schermo", "television", "telly"],
  () => `${salotto()}${alone(120, 76, 130, "#6366f1", 0.4)}${R(26, 22, 188, 112, 8, "#38bdf8", 'opacity=".3" filter="url(#@b8)"')}${R(28, 24, 184, 108, 7, SC)}${schermo(33, 29, 174, 98)}${R(28, 24, 184, 3, 2, "#fff", 'opacity=".25"')}${P("M104 132h32l6 12h-44Z", "url(#@nero)")}${R(84, 142, 72, 5, 2.5, SC)}${led(198, 128, AC, 1.4)}`
);
disegno(
  "soundbar",
  "intrattenimento",
  "Soundbar",
  "Soundbar",
  ["barra audio", "audio tv", "altoparlante", "sound bar", "speaker"],
  () => {
    const onde = L(
      "M24 74a36 36 0 0 0 0 52M12 62a54 54 0 0 0 0 76M216 74a36 36 0 0 1 0 52M228 62a54 54 0 0 1 0 76",
      VT,
      4,
      'opacity=".7"'
    );
    return `${salotto()}${R(40, 0, 160, 62, 6, SC)}${schermo(45, 0, 150, 57, 3)}${alone(120, 104, 110, AC, 0.35)}${onde}${ombra(120, 128, 92, 5)}${R(30, 82, 180, 42, 21, "url(#@nero)")}${punti(52, 94, 22, 3, 6.4, 8, 1.6, "#64748b")}${R(44, 85, 152, 3, 1.5, "#fff", 'opacity=".2"')}${led(120, 117, AC, 1.6)}${piano(140, "legno", 8)}`;
  }
);
disegno(
  "casse",
  "intrattenimento",
  "Casse",
  "Speakers",
  ["altoparlanti", "diffusori", "stereo", "hi-fi", "speakers", "loudspeakers"],
  () => {
    const cassa = (x) => `${ombra(x, 150, 34, 4)}${R(x - 30, 22, 60, 128, 8, "url(#@legno)")}${R(x - 26, 26, 52, 120, 6, "url(#@nero)")}${C(x, 54, 16, "#1e293b")}${C(x, 54, 12, "url(#@lente)")}${C(x, 54, 4, SC)}${C(x, 108, 24, "#1e293b")}${C(x, 108, 19, def(rad("cono", 0.4, 0.35, 0.7, "#64748b", "#1e293b", "#020617")))}${C(x, 108, 7, "#334155")}${C(x - 3, 105, 2.5, "#fff", 'opacity=".4"')}${R(x - 26, 26, 52, 3, 1.5, "#fff", 'opacity=".2"')}`;
    return `${stanza("#475569", "#1e293b", "#57534e", "#1c1917", 150)}${alone(120, 90, 120, AC, 0.25)}${cassa(72)}${cassa(168)}${L("M112 78q8 12 0 24M128 78q-8 12 0 24", VT, 3, 'opacity=".6"')}`;
  }
);
disegno(
  "console",
  "intrattenimento",
  "Console giochi",
  "Game console",
  ["videogiochi", "gaming", "joypad", "controller", "videogame", "gamepad"],
  () => `${fondo("#4c1d95", "#1e1b4b", "#0b1023")}${alone(120, 90, 120, "#a855f7", 0.45)}${stelle(9, 16, 120)}${ombra(120, 148, 70, 6)}${P("M72 60h96c22 0 32 24 36 54 3 22-4 34-16 34-10 0-16-8-24-20H76c-8 12-14 20-24 20-12 0-19-12-16-34 4-30 14-54 36-54Z", "url(#@bianco)")}${P("M72 64h96c12 0 20 6 26 16H46c6-10 14-16 26-16Z", "#fff", 'opacity=".7"')}${R(66, 84, 10, 30, 3, SC)}${R(56, 94, 30, 10, 3, SC)}${C(170, 86, 6, AC)}${C(184, 99, 6, RO)}${C(156, 99, 6, VE)}${C(170, 112, 6, CA)}${C(98, 118, 11, SC)}${C(142, 118, 11, SC)}${C(98, 118, 6, "#475569")}${C(142, 118, 6, "#475569")}${R(110, 84, 20, 6, 3, AC)}`
);
disegno(
  "giradischi",
  "intrattenimento",
  "Giradischi",
  "Record player",
  ["vinile", "dischi", "piatto", "turntable", "vinyl", "musica"],
  () => {
    const solchi = [44, 38, 32, 26].map(
      (r) => E(108, 92, r * 1.5, r * 0.62, "none", `stroke="#475569" stroke-width="1" opacity=".7"`)
    ).join("");
    return `${fondo("#7c2d12", "#2a1006")}${alone(110, 80, 120, CA, 0.3)}${ombra(120, 142, 96, 6)}${P("M30 82 60 52h150l-6 64-30 30H24Z", "url(#@legno)")}${P("M30 82 60 52h150l-30 30Z", "#d6a86a", 'opacity=".55"')}${P("M24 146V116h150v30Z", "#422006")}${E(108, 92, 72, 30, "#0b1220")}${solchi}${E(108, 92, 20, 8, "#e11d48")}${E(108, 92, 3, 1.4, "#e2e8f0")}${P("M60 80c16-10 40-14 64-12", "none", 'stroke="#fff" stroke-width="3" opacity=".25"')}${C(186, 70, 9, "url(#@acciaio)")}${L("M186 70 176 108 140 112", "#e2e8f0", 4)}${R(132, 108, 12, 8, 2, "url(#@acciaio)")}${led(46, 132, CA, 2)}`;
  }
);
disegno(
  "amplificatore",
  "intrattenimento",
  "Amplificatore",
  "AV receiver",
  ["home theater", "sintoamplificatore", "receiver", "amplifier", "hi-fi"],
  () => `${fondo("#1e293b", "#0b1220")}${alone(120, 90, 120, AC, 0.3)}${ombra(120, 146, 100, 6)}${R(18, 62, 204, 82, 10, "url(#@nero)")}${R(18, 62, 204, 4, 2, "#fff", 'opacity=".25"')}${R(30, 76, 92, 26, 4, "#020617")}${R(34, 80, 84, 18, 3, def(lin("dsp", "h", AC, "#38bdf8/.8")), 'opacity=".9"')}${righe(40, 86, 74, 2, 6, SC, 2.5)}${L("M82 84v10M88 88v6M94 82v12M100 86v8M106 84v10", SC, 2.5)}${punti(36, 118, 6, 1, 12, 0, 3.4, "#475569")}${C(172, 102, 28, "#020617")}${C(172, 102, 24, "url(#@acciaio)")}${C(172, 102, 16, "#cbd5e1")}${C(165, 95, 4, "#fff", 'opacity=".8"')}${C(172, 82, 2.5, AC)}${led(118, 124, AC, 2)}${R(26, 144, 16, 6, 2, SC)}${R(198, 144, 16, 6, 2, SC)}`
);
disegno(
  "radio",
  "intrattenimento",
  "Radio",
  "Radio",
  ["radiolina", "stereo", "fm", "dab", "transistor", "musica"],
  () => `${fondo("#0e7490", "#083344")}${alone(120, 90, 120, CA, 0.25)}${ombra(120, 148, 86, 6)}${L("M150 64 196 18", "url(#@acciaio)", 3)}${C(196, 18, 3, "#cbd5e1")}${R(34, 60, 172, 88, 18, def(lin("crema", "v", "#fef3c7", "#e7c98a")))}${R(42, 70, 92, 70, 10, "#7c2d12")}${punti(52, 80, 8, 6, 10.6, 11, 2.6, "#451a03")}${R(144, 72, 52, 26, 6, "#fef9c3")}${righe(150, 80, 190, 1, 0, "#b45309", 1.5)}${colonne(152, 80, 90, 7, 6, "#b45309", 1.5)}${L("M170 76v20", RO, 2)}${manopola(156, 118, 10, "url(#@oro)")}${manopola(184, 118, 10, "url(#@oro)")}${R(40, 62, 160, 4, 2, "#fff", 'opacity=".5"')}${R(50, 148, 18, 6, 2, SC)}${R(172, 148, 18, 6, 2, SC)}`
);
disegno(
  "cuffie",
  "intrattenimento",
  "Cuffie",
  "Headphones",
  ["auricolari", "headset", "musica", "ascolto", "headphones"],
  () => `${fondo("#0f766e", "#042f2e")}${alone(120, 90, 110, "#2dd4bf", 0.35)}${L("M66 112V84a54 54 0 0 1 108 0v28", "#e2e8f0", 13)}${L("M66 112V84a54 54 0 0 1 108 0v28", SC, 5)}${L("M74 60a50 50 0 0 1 30-28", "#fff", 3, 'opacity=".8"')}${R(72, 100, 18, 46, 8, "#334155")}${R(150, 100, 18, 46, 8, "#334155")}${R(46, 94, 36, 58, 15, "url(#@bianco)")}${R(158, 94, 36, 58, 15, "url(#@bianco)")}${C(64, 123, 9, AC)}${C(176, 123, 9, AC)}${R(52, 100, 4, 40, 2, "#fff", 'opacity=".25"')}${R(162, 100, 4, 40, 2, "#fff", 'opacity=".25"')}${led(186, 140, AC, 1.6)}`
);
disegno(
  "telo-proiezione",
  "intrattenimento",
  "Telo motorizzato",
  "Projector screen",
  ["telo", "schermo", "proiezione", "tenda proiettore", "projection screen", "motorized screen"],
  () => `${stanza("#1e1b4b", "#0b1023", "#3f2a1d", "#1c1412", 156)}${alone(120, 80, 120, "#6366f1", 0.3)}${R(22, 18, 196, 14, 7, "url(#@bianco)")}${R(28, 32, 184, 102, 0, "#f8fafc")}${R(36, 38, 168, 88, 2, "url(#@schermo)", 'opacity=".9"')}${P("M36 108c34-14 58-8 84-20s50-8 84-2v40H36Z", SC, 'opacity=".45"')}${C(170, 60, 10, CA, 'opacity=".9"')}${R(28, 132, 184, 6, 3, "url(#@nero)")}${L("M120 138v8", "#94a3b8", 2)}${C(120, 148, 3, SC)}${L("M60 32v-4M180 32v-4", "#64748b", 2)}`
);
disegno(
  "altoparlante-smart",
  "intrattenimento",
  "Altoparlante smart",
  "Smart speaker",
  ["assistente vocale", "speaker", "cassa smart", "smart speaker", "voice assistant"],
  () => `${fondo("#164e63", "#082f49")}${alone(120, 54, 80, "#22d3ee", 0.55)}${ombra(120, 150, 48, 6)}${P("M76 54h88v86a10 10 0 0 1-10 10H86a10 10 0 0 1-10-10Z", "url(#@biancoO)")}${punti(84, 72, 9, 9, 9, 8.6, 1.6, "#94a3b8")}${E(120, 54, 44, 12, "#e2e8f0")}${E(120, 54, 40, 10, "none", 'stroke="#22d3ee" stroke-width="4"')}${E(120, 54, 40, 10, "none", 'stroke="#67e8f9" stroke-width="8" opacity=".5" filter="url(#@b3)"')}${E(120, 54, 30, 6, "#cbd5e1")}${C(112, 54, 2.5, SC)}${C(128, 54, 2.5, SC)}${R(80, 60, 5, 80, 2.5, "#fff", 'opacity=".5"')}`
);
disegno(
  "pianoforte",
  "intrattenimento",
  "Pianoforte digitale",
  "Digital piano",
  ["piano", "tastiera", "pianola", "keyboard", "piano digitale", "musica"],
  () => {
    let neri = "";
    for (let i = 0; i < 13; i++)
      if (![2, 6, 9, 13].includes(i)) neri += R(36 + i * 14 - 4, 96, 8, 26, 1.5, "#0b1220");
    return `${stanza("#422006", "#1c0a05", "#292524", "#0c0a09", 156)}${alone(110, 70, 110, CA, 0.25)}${R(20, 50, 200, 46, 8, "url(#@nero)")}${R(20, 50, 200, 4, 2, "#fff", 'opacity=".2"')}${R(130, 62, 40, 14, 3, "#020617")}${R(134, 66, 32, 6, 2, AC, 'opacity=".8"')}${punti(42, 70, 6, 1, 12, 0, 3, "#475569")}${R(24, 94, 192, 46, 3, "#f8fafc")}${colonne(36, 96, 140, 13, 14, "#cbd5e1", 1.5)}${neri}${R(24, 136, 192, 6, 2, "#94a3b8")}${R(20, 140, 200, 10, 4, "url(#@nero)")}${R(30, 150, 10, 30, 2, SC)}${R(200, 150, 10, 30, 2, SC)}`;
  }
);
disegno(
  "visore-vr",
  "intrattenimento",
  "Visore VR",
  "VR headset",
  ["realta virtuale", "visore", "vr", "virtual reality", "headset", "gaming"],
  () => `${fondo("#312e81", "#0b1023")}${alone(120, 90, 120, "#22d3ee", 0.3)}${L("M56 92c-20 0-26-30 0-40h128c26 10 20 40 0 40", "#334155", 10)}${ombra(120, 136, 76, 6)}${R(40, 56, 160, 76, 26, "url(#@bianco)")}${R(40, 56, 160, 6, 3, "#fff", 'opacity=".8"')}${R(50, 68, 140, 52, 18, "url(#@nero)")}${R(58, 74, 124, 40, 14, def(lin("vr", "h", "#22d3ee/.9", "#6366f1/.9", "#a855f7/.9")), 'opacity=".55"')}${P("M60 78h40l-30 30Z", "#fff", 'opacity=".2"')}${C(76, 128, 4, SC)}${C(164, 128, 4, SC)}${led(184, 64, AC, 1.6)}`
);
function cucina(y = 142, m1 = "#5b7a8c", m2 = "#24384a", top = "acciaio") {
  const trama = def(
    `<pattern id="@piastre" width="24" height="12" patternUnits="userSpaceOnUse"><path d="M0 .5H24M.5 0V6M12.5 6V12M0 6.5H24" stroke="#fff" stroke-opacity=".12" fill="none"/></pattern>`
  );
  return `${fondo(m1, m2)}${R(0, 0, 240, y, 0, trama)}${piano(y, top, 6)}`;
}
var vapore = (x, y, s = 1, op = 0.6) => L(
  `M${x} ${y}c${-8 * s} ${-10 * s} ${8 * s} ${-16 * s} 0 ${-28 * s}M${x + 12 * s} ${y + 2 * s}c${-8 * s} ${-10 * s} ${8 * s} ${-16 * s} 0 ${-26 * s}`,
  "#fff",
  3,
  `opacity="${op}" filter="url(#@b1)"`
);
disegno(
  "forno",
  "cucina",
  "Forno",
  "Oven",
  ["forno elettrico", "forno ventilato", "cottura", "oven", "bake", "arrosto"],
  () => `${cucina(152, "#57534e", "#292524", "legnoC")}${alone(120, 104, 100, AR, 0.35)}${R(36, 20, 168, 132, 10, "url(#@nero)")}${R(36, 20, 168, 4, 2, "#fff", 'opacity=".2"')}${R(44, 28, 152, 22, 5, "#020617")}${R(104, 33, 32, 12, 3, "#0b1220")}${L("M108 39h6M117 39h6M126 39h6", AR, 2.5)}${manopola(62, 39, 7)}${manopola(178, 39, 7)}${R(48, 58, 144, 6, 3, "url(#@acciaio)")}${R(44, 68, 152, 76, 8, "#111827")}${R(52, 76, 136, 60, 6, def(rad("dentro", 0.5, 0.6, 0.7, "#fdba74", "#ea580c", "#431407")))}${righe(56, 88, 184, 1, 0, "#fde68a", 2, 0.6)}${E(120, 112, 30, 8, "#94a3b8")}${E(120, 106, 22, 12, def(lin("pollo", "v", "#fbbf24", "#b45309")))}${E(114, 101, 6, 3, "#fef3c7", 'opacity=".7"')}${righe(56, 120, 184, 1, 0, "#fde68a", 2, 0.6)}${P("M54 78h50L56 118Z", "#fff", 'opacity=".12"')}`
);
disegno(
  "piano-cottura",
  "cucina",
  "Piano cottura",
  "Cooktop",
  ["induzione", "fornelli", "piastra", "hob", "stove", "cucinare", "fuochi"],
  () => `${cucina(96, "#64748b", "#334155", "acciaio")}${ombra(120, 140, 100, 6)}${P("M42 98h156l26 44H16Z", "#0b1220")}${P("M42 98h156l3 5H39Z", "#fff", 'opacity=".25"')}${E(70, 128, 30, 8, "none", `stroke="#475569" stroke-width="2"`)}${E(170, 128, 30, 8, "none", `stroke="#ef4444" stroke-width="3"`)}${E(170, 128, 30, 8, "none", `stroke="#f97316" stroke-width="6" opacity=".6" filter="url(#@b2)"`)}${E(84, 106, 20, 5, "none", `stroke="#475569" stroke-width="2"`)}${E(156, 106, 20, 5, "none", `stroke="#475569" stroke-width="2"`)}${P("M58 120V84c0-6 52-6 52 0v36c0 7-52 7-52 0Z", "url(#@acciaioO)")}${E(84, 84, 26, 6, "#cbd5e1")}${E(84, 84, 22, 4.5, "#64748b")}${L("M110 92h22", SC, 5)}${vapore(78, 72, 1)}${L("M60 140h8M74 140h8", VT, 2)}${led(196, 136, RO, 1.6)}`
);
disegno(
  "cappa",
  "cucina",
  "Cappa",
  "Cooker hood",
  ["aspiratore", "cappa aspirante", "fumi", "range hood", "extractor", "ventilazione"],
  () => `${cucina(140, "#94a3b8", "#475569", "acciaio")}${R(98, 0, 44, 46, 0, "url(#@acciaioO)")}${P("M98 46h44l52 40H46Z", "url(#@acciaio)")}${R(46, 86, 148, 12, 3, "url(#@acciaioO)")}${P("M60 98h40l-16 42H40Z", "#fef3c7", 'opacity=".25" filter="url(#@b3)"')}${P("M140 98h40l20 42h-44Z", "#fef3c7", 'opacity=".25" filter="url(#@b3)"')}${R(70, 97, 20, 3, 1.5, "#fef9c3")}${R(150, 97, 20, 3, 1.5, "#fef9c3")}${R(110, 89, 20, 6, 2, SC)}${led(124, 92, AC, 1.2)}${P("M100 2h8v42h-8Z", "#fff", 'opacity=".3"')}${L("M96 136c-10-12 10-18 0-30M120 136c-10-12 10-18 0-30M144 136c-10-12 10-18 0-30", "#fff", 3, 'opacity=".45" filter="url(#@b1)"')}${R(84, 132, 72, 10, 3, SC)}`
);
disegno(
  "frigorifero",
  "cucina",
  "Frigorifero",
  "Fridge",
  ["frigo", "refrigeratore", "side by side", "refrigerator", "fridge", "freezer"],
  () => `${cucina(156, "#7e9aa8", "#334155", "legnoC")}${ombra(120, 156, 66, 5)}${R(58, 12, 124, 144, 10, "url(#@biancoO)")}${L("M120 14v140", "#64748b", 2)}${L("M60 96h120", "#94a3b8", 1.5)}${R(104, 28, 5, 50, 2.5, "url(#@acciaio)")}${R(131, 28, 5, 50, 2.5, "url(#@acciaio)")}${R(104, 104, 5, 32, 2.5, "url(#@acciaio)")}${R(131, 104, 5, 32, 2.5, "url(#@acciaio)")}${R(72, 30, 24, 34, 4, SC)}${R(76, 34, 16, 8, 2, AC)}${L("M78 50h12M78 56h8", VT, 2)}${R(62, 14, 5, 138, 2.5, "#fff", 'opacity=".8"')}${goccia(84, 74, 4, VT)}`,
  [50, 12]
);
disegno(
  "lavastoviglie",
  "cucina",
  "Lavastoviglie",
  "Dishwasher",
  ["lavapiatti", "stoviglie", "piatti", "dishwasher", "dishes"],
  () => {
    let piatti = "";
    for (let i = 0; i < 9; i++)
      piatti += E(
        64 + i * 14,
        102,
        5,
        15,
        i % 3 === 1 ? VT : FR,
        `stroke="#94a3b8" stroke-width="1"`
      );
    let bicchieri = "";
    for (let i = 0; i < 5; i++)
      bicchieri += P(`M${70 + i * 24} 54h12l-2 18h-8Z`, VT, 'opacity=".75"');
    return `${cucina(146, "#64748b", "#334155", "legnoC")}${R(44, 18, 152, 108, 6, "url(#@acciaio)")}${R(52, 24, 136, 100, 4, "#334155")}${R(52, 24, 136, 100, 4, def(lin("vasca", "v", "#94a3b8/.5", "#0f172a/.2")))}${bicchieri}${righe(58, 74, 182, 1, 0, "#cbd5e1", 3)}${piatti}${righe(58, 118, 182, 1, 0, "#cbd5e1", 3)}${P("M44 126h152l24 26H20Z", "url(#@bianco)")}${P("M44 126h152l3 4H41Z", "#fff")}${R(46, 18, 148, 3, 1.5, "#fff", 'opacity=".5"')}${led(184, 136, VE, 1.8)}`;
  }
);
disegno(
  "microonde",
  "cucina",
  "Microonde",
  "Microwave",
  ["forno a microonde", "scaldare", "microwave", "riscaldare"],
  () => `${cucina(140)}${alone(100, 96, 70, CA, 0.3)}${ombra(120, 140, 92, 5)}${R(30, 52, 180, 88, 10, "url(#@bianco)")}${R(30, 52, 180, 4, 2, "#fff")}${R(40, 62, 120, 68, 6, "#0b1220")}${R(46, 68, 108, 56, 4, def(rad("mw", 0.5, 0.6, 0.6, "#fde68a/.85", "#f59e0b/.5", "#0b1220/0")))}${E(100, 114, 34, 6, "#e2e8f0", 'opacity=".7"')}${R(86, 98, 28, 14, 7, "#ea580c")}${P("M48 70h40L48 108Z", "#fff", 'opacity=".12"')}${R(168, 62, 32, 68, 5, SC)}${R(172, 66, 24, 12, 2, "#020617")}${L("M176 72h6M184 72h8", VE, 2.5)}${punti(177, 88, 3, 3, 7, 9, 2.2, "#475569")}${R(172, 116, 24, 8, 3, AC)}`
);
disegno(
  "macchina-caffe",
  "cucina",
  "Macchina del caffè",
  "Coffee machine",
  ["caffe", "espresso", "caffettiera", "moka", "coffee", "barista"],
  () => `${cucina(144, "#7c5c4a", "#2a1b12", "legnoC")}${alone(120, 96, 100, CA, 0.2)}${ombra(120, 144, 64, 5)}${R(62, 22, 116, 40, 10, "url(#@nero)")}${R(68, 30, 40, 16, 3, "#020617")}${R(72, 34, 32, 8, 2, AC, 'opacity=".8"')}${manopola(152, 42, 8)}${R(62, 56, 26, 86, 0, "url(#@nero)")}${R(152, 56, 26, 86, 0, "url(#@nero)")}${R(62, 134, 116, 10, 4, "url(#@acciaio)")}${R(88, 56, 64, 6, 0, "#020617")}${R(104, 62, 32, 10, 3, "url(#@acciaio)")}${L("M136 67h22", SC, 6)}${L("M114 74v20M126 74v20", "#78350f", 2.5)}${P("M100 104h40v18a10 10 0 0 1-10 10h-20a10 10 0 0 1-10-10Z", FR)}${L("M140 110a8 8 0 0 1 0 14", FR, 4)}${E(120, 105, 18, 3.5, "#92400e")}${vapore(114, 96, 0.8, 0.5)}${R(64, 26, 112, 3, 1.5, "#fff", 'opacity=".2"')}`
);
disegno(
  "bollitore",
  "cucina",
  "Bollitore",
  "Kettle",
  ["teiera", "acqua calda", "te", "tisana", "kettle", "tea"],
  () => `${cucina(144, "#3f6e6e", "#173030", "legnoC")}${ombra(118, 144, 52, 5)}${vapore(146, 42, 1.1)}${E(118, 140, 46, 6, SC)}${P("M80 56h76l10 78H70Z", "url(#@biancoO)")}${P("M84 56c0-12 68-12 68 0Z", "#e2e8f0")}${R(110, 40, 16, 8, 4, SC)}${P("M80 62 54 52l-4 10 30 14Z", "url(#@bianco)")}${L("M166 70c18 0 22 40 4 50", SC, 8)}${R(90, 76, 10, 48, 5, "#0b1220")}${R(92, 96, 6, 26, 3, VT)}${R(92, 96, 6, 26, 3, AC, 'opacity=".5" filter="url(#@b2)"')}${R(84, 60, 5, 70, 2.5, "#fff", 'opacity=".8"')}${led(134, 130, AC, 1.6)}`
);
disegno(
  "friggitrice-aria",
  "cucina",
  "Friggitrice ad aria",
  "Air fryer",
  ["friggitrice", "frittura", "patatine", "air fryer", "fryer"],
  () => `${cucina(146, "#5b6b4a", "#24301a", "legnoC")}${ombra(120, 146, 60, 5)}${P("M72 40c0-14 96-14 96 0l8 100H64Z", "url(#@nero)")}${E(120, 40, 48, 8, "#334155")}${R(100, 48, 40, 18, 5, "#020617")}${L("M108 57h8M120 57h12", AR, 3)}${R(68, 82, 104, 58, 8, "#1e293b")}${R(94, 98, 52, 12, 6, "url(#@acciaio)")}${R(78, 120, 84, 12, 4, "#0b1220")}${L("M100 116l-4-14M110 116l2-16M120 116l-3-12M130 116l4-15M140 116l1-11", "#fbbf24", 4)}${R(70, 46, 5, 90, 2.5, "#fff", 'opacity=".2"')}${vapore(110, 30, 0.8, 0.35)}`
);
disegno(
  "robot-cucina",
  "cucina",
  "Robot da cucina",
  "Food processor",
  ["robot", "impastatrice", "planetaria", "mixer", "food processor", "kitchen robot"],
  () => `${cucina(146, "#7c6a8c", "#2e2440", "legnoC")}${ombra(120, 146, 64, 5)}${P("M78 24h84l-6 60H84Z", "url(#@vetro)")}${R(80, 18, 80, 10, 4, SC)}${C(120, 14, 6, SC)}${P("M160 34c18 0 18 34 0 34", "none", `stroke="${SC}" stroke-width="7"`)}${P("M86 54h68l-3 28H89Z", "#fb923c", 'opacity=".7"')}${P("M84 30h10l-4 52h-6Z", "#fff", 'opacity=".5"')}${P("M70 84h100l6 60H64Z", "url(#@bianco)")}${R(100, 96, 40, 18, 4, SC)}${R(104, 100, 32, 10, 2, AC, 'opacity=".9"')}${manopola(120, 128, 9)}${R(70, 84, 100, 3, 1.5, "#fff")}`
);
disegno(
  "cantinetta",
  "cucina",
  "Cantinetta vini",
  "Wine cooler",
  ["vino", "bottiglie", "frigo vini", "enoteca", "wine fridge", "wine"],
  () => {
    let b = "";
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        b += `${C(86 + c * 23, 38 + r * 26, 9, r % 2 ? "#7f1d1d" : "#14532d")}${C(86 + c * 23, 38 + r * 26, 4, "#0b1220")}${C(83 + c * 23, 35 + r * 26, 2, "#fff", 'opacity=".4"')}`;
    return `${stanza("#3b2a3a", "#1a1018", "#292524", "#0c0a09", 156)}${ombra(120, 156, 56, 5)}${R(66, 14, 108, 142, 8, "url(#@nero)")}${R(74, 22, 92, 120, 4, "#0b1220")}${R(74, 22, 92, 120, 4, def(lin("frio", "v", "#38bdf8/.35", "#6366f1/.15")))}${righe(76, 50, 164, 4, 26, "#64748b", 2)}${b}${P("M76 24h30L76 90Z", "#fff", 'opacity=".1"')}${R(160, 40, 4, 80, 2, "url(#@acciaio)")}${R(108, 146, 24, 5, 2, "#020617")}${L("M112 148.5h6", VT, 2)}`;
  },
  [50, 12]
);
disegno(
  "tostapane",
  "cucina",
  "Tostapane",
  "Toaster",
  ["toast", "pane", "colazione", "toaster", "breakfast"],
  () => `${cucina(144, "#a16207", "#422006", "legnoC")}${alone(120, 100, 90, CA, 0.25)}${ombra(120, 144, 68, 5)}${R(76, 30, 38, 46, 10, def(lin("pane", "v", "#fcd34d", "#d97706")))}${R(80, 34, 30, 40, 8, "#fef3c7")}${R(126, 40, 38, 40, 10, "url(#@pane)")}${R(130, 44, 30, 36, 8, "#fef3c7")}${P("M56 74c0-10 8-14 16-14h96c8 0 16 4 16 14v58c0 6-4 10-10 10H66c-6 0-10-4-10-10Z", "url(#@acciaio)")}${R(78, 60, 38, 6, 3, "#0b1220")}${R(124, 60, 38, 6, 3, "#0b1220")}${R(176, 92, 10, 18, 3, SC)}${manopola(120, 110, 8, "#1e293b")}${R(62, 68, 4, 60, 2, "#fff", 'opacity=".6"')}`
);
disegno(
  "congelatore",
  "cucina",
  "Congelatore",
  "Freezer",
  ["freezer", "surgelati", "ghiaccio", "cassetti", "chest freezer"],
  () => {
    const fiocco2 = (x, y, s) => L(
      `M${x} ${y - s}V${y + s}M${x - s * 0.87} ${y - s / 2}L${x + s * 0.87} ${y + s / 2}M${x - s * 0.87} ${y + s / 2}L${x + s * 0.87} ${y - s / 2}`,
      "#e0f2fe",
      2.5
    );
    return `${stanza("#5a7c94", "#1e3a52", "#334155", "#0f172a", 156)}${ombra(120, 156, 60, 5)}${R(62, 14, 116, 142, 10, "url(#@biancoO)")}${[
      22,
      66,
      110
    ].map(
      (y) => `${R(70, y, 100, 38, 5, def(lin("ghiaccio", "v", "#e0f2fe", "#7dd3fc")))}${R(70, y, 100, 6, 3, "#fff", 'opacity=".7"')}${R(104, y + 30, 32, 4, 2, "#64748b")}`
    ).join(
      ""
    )}${fiocco2(94, 44, 8)}${fiocco2(146, 86, 8)}${fiocco2(98, 130, 7)}${R(66, 16, 4, 136, 2, "#fff")}`;
  },
  [50, 12]
);
disegno(
  "frullatore",
  "cucina",
  "Frullatore",
  "Blender",
  ["frullati", "smoothie", "centrifuga", "blender", "estrattore"],
  () => `${cucina(144, "#be185d", "#4a0a26", "legnoC")}${ombra(120, 144, 46, 5)}${P("M86 28h68l-8 82H94Z", "url(#@vetro)")}${P("M90 60h60l-4 50H94Z", "#ec4899", 'opacity=".8"')}${C(108, 78, 4, "#fff", 'opacity=".5"')}${C(130, 92, 3, "#fff", 'opacity=".5"')}${R(84, 20, 72, 10, 4, SC)}${L("M152 40h8v44h-10", SC, 6)}${P("M92 30h8l-4 76h-4Z", "#fff", 'opacity=".6"')}${P("M86 110h68l8 34H78Z", "url(#@nero)")}${manopola(120, 126, 8)}${R(80, 110, 80, 3, 1.5, "#fff", 'opacity=".2"')}${C(66, 128, 12, "#facc15")}${C(178, 124, 14, "#ef4444")}${P("M178 110c2-6 8-8 12-6-4 2-6 4-12 6Z", VE)}`
);
var lavanderia = (m1 = "#4f7fa8", m2 = "#1e3a5f") => cucina(152, m1, m2, "legnoC");
function parquet(y = 96, t1 = "#b7793c", t2 = "#5c3410") {
  let d = "";
  for (let i = -8; i <= 8; i++) d += `M${120 + i * 16} ${y}L${120 + i * 70} 240`;
  return `${R(0, y, 240, 240 - y, 0, def(lin(`pq${sigla(t1)}`, "v", t1, t2)))}${L(d, "#000", 1.5, 'opacity=".18"')}`;
}
var oblo = (cx, cy, r, dentro) => `${C(cx, cy, r + 8, "url(#@acciaio)")}${C(cx, cy, r + 3, "#334155")}${C(cx, cy, r, "#0b1220")}${dentro}${P(`M${cx - r * 0.7} ${cy - r * 0.4}a${r * 0.8} ${r * 0.8} 0 0 1 ${r * 0.6}-${r * 0.45}`, "none", `stroke="#fff" stroke-width="4" opacity=".55" stroke-linecap="round"`)}`;
disegno(
  "lavatrice",
  "lavanderia",
  "Lavatrice",
  "Washing machine",
  ["bucato", "lavaggio", "panni", "washer", "laundry", "washing"],
  () => `${lavanderia()}${ombra(120, 152, 70, 5)}${R(54, 20, 132, 132, 12, "url(#@biancoO)")}${R(54, 46, 132, 2, 0, "#94a3b8")}${R(64, 28, 30, 12, 3, "#cbd5e1")}${R(108, 28, 34, 12, 3, SC)}${L("M113 34h8M124 34h12", VT, 2.5)}${manopola(164, 34, 7)}${oblo(120, 98, 34, `${C(120, 98, 34, "url(#@acqua)", 'opacity=".85"')}${P("M88 104c10-8 22 6 32 0s22-8 32 0v10c-10 10-22 18-32 18s-26-6-32-18Z", "#1d4ed8", 'opacity=".55"')}${C(108, 110, 7, RO, 'opacity=".8"')}${C(132, 112, 6, CA, 'opacity=".8"')}${C(104, 86, 3, "#fff", 'opacity=".7"')}${C(136, 90, 2, "#fff", 'opacity=".7"')}`)}${R(58, 24, 4, 124, 2, "#fff")}`
);
disegno(
  "asciugatrice",
  "lavanderia",
  "Asciugatrice",
  "Dryer",
  ["asciugatura", "bucato", "panni", "tumble dryer", "dryer"],
  () => `${lavanderia("#7c6a58", "#3b2f27")}${alone(120, 98, 70, AR, 0.25)}${ombra(120, 152, 70, 5)}${R(54, 20, 132, 132, 12, "url(#@nero)")}${R(54, 46, 132, 2, 0, "#020617")}${R(64, 28, 46, 12, 3, "#020617")}${L("M70 34h10M84 34h20", AR, 2.5)}${manopola(164, 34, 7)}${oblo(120, 98, 34, `${C(120, 98, 34, def(rad("tamb", 0.5, 0.5, 0.6, "#fed7aa", "#ea580c", "#431407")), 'opacity=".9"')}${P("M96 96c8-14 20-12 24-4s14 10 22 0c4 16-8 28-24 26s-28-8-22-22Z", "#f472b6", 'opacity=".85"')}${P("M110 78c10-6 20-4 26 4-10 4-18 6-26-4Z", VT)}${P("M100 108c6 8 14 12 22 10", "none", `stroke="${CA}" stroke-width="5" stroke-linecap="round"`)}`)}${L("M150 126c-4-4 4-8 0-12M160 126c-4-4 4-8 0-12", AR, 2, 'opacity=".7"')}${R(58, 24, 4, 124, 2, "#fff", 'opacity=".25"')}`
);
disegno(
  "ferro-stiro",
  "lavanderia",
  "Ferro da stiro",
  "Iron",
  ["stiro", "stiratura", "vapore", "asse da stiro", "iron", "ironing", "steam"],
  () => `${fondo("#a78bfa", "#4c1d95", "#1e1b4b")}${alone(120, 90, 110, "#fff", 0.2)}${L("M70 138 50 180M170 138l20 42", "#cbd5e1", 4)}${P("M18 118h168c24 0 36 6 36 12s-12 12-36 12H18Z", def(lin("asse", "v", "#e0f2fe", "#93c5fd")))}${R(18, 118, 196, 4, 2, "#fff", 'opacity=".7"')}${ombra(124, 120, 54, 5, 0.4)}${L("M108 64c-6-10 6-14 0-24M124 60c-6-10 6-14 0-24", "#fff", 4, 'opacity=".7" filter="url(#@b1)"')}${P("M70 118c4-26 28-42 74-42h22c8 0 10 6 10 12v30Z", "url(#@bianco)")}${P("M68 118h110v6H66Z", "url(#@acciaio)")}${L("M100 74c0-18 10-24 26-24h30c8 0 10 8 10 14v12", AC, 8)}${C(150, 98, 6, AC)}${R(84, 100, 70, 3, 1.5, "#fff", 'opacity=".6"')}${L("M166 64c14 0 26-8 36-22", "#475569", 2.5)}`
);
disegno(
  "robot-aspirapolvere",
  "lavanderia",
  "Robot aspirapolvere",
  "Robot vacuum",
  ["robot", "aspirapolvere", "pulizia", "robot vacuum", "vacuum"],
  () => `${fondo("#cbd5e1", "#64748b")}${parquet(92)}${L("M8 140c30-30 50 10 80-20M10 120c40-30 60 4 90-20", "#fff", 3, 'opacity=".25" stroke-dasharray="2 8"')}${ombra(130, 128, 76, 12, 0.55)}${E(130, 116, 76, 30, "url(#@nero)")}${E(130, 108, 76, 30, "url(#@bianco)")}${E(130, 108, 68, 25, "none", `stroke="#94a3b8" stroke-width="1.5"`)}${E(130, 104, 18, 8, SC)}${E(130, 100, 18, 7, "url(#@blu)")}${led(130, 98, AC, 1.4)}${C(110, 110, 3, VE)}${E(98, 96, 22, 6, "#fff", 'opacity=".8"')}${L("M62 128l-12 6M56 122l-14-2M62 132l-6 12", "#475569", 2)}${C(62, 128, 4, SC)}`
);
disegno(
  "robot-lavapavimenti",
  "lavanderia",
  "Robot lavapavimenti",
  "Robot mop",
  ["lavapavimenti", "mocio", "lavaggio pavimenti", "robot mop", "mopping", "base"],
  () => `${fondo("#a5b4fc", "#3730a3")}${R(0, 102, 240, 138, 0, def(lin("pav", "v", "#e2e8f0", "#94a3b8")))}${L("M0 130H240M0 170H240M60 102 30 240M120 102V240M180 102l30 138", "#64748b", 1.5, 'opacity=".4"')}${R(20, 112, 200, 16, 8, "#fff", 'opacity=".35" filter="url(#@b3)"')}${R(128, 18, 74, 104, 12, "url(#@biancoO)")}${R(136, 28, 26, 44, 5, def(lin("pulita", "v", "#bae6fd", "#38bdf8")))}${R(168, 28, 26, 44, 5, def(lin("sporca", "v", "#d6d3d1", "#78716c")))}${R(136, 28, 26, 8, 3, "#fff", 'opacity=".5"')}${led(165, 84, AC, 2)}${P("M128 104h74l14 22h-102Z", "#94a3b8")}${ombra(84, 132, 58, 9)}${E(84, 124, 56, 20, "url(#@nero)")}${E(84, 117, 56, 20, "url(#@bianco)")}${E(84, 114, 16, 6, "url(#@blu)")}${led(84, 112, AC, 1.4)}${goccia(36, 140, 5, AC)}${goccia(50, 150, 4, AC)}${goccia(24, 152, 3.5, AC)}`
);
disegno(
  "scopa-elettrica",
  "lavanderia",
  "Scopa elettrica",
  "Stick vacuum",
  ["aspirapolvere", "scopa", "senza fili", "cordless", "stick vacuum", "vacuum cleaner"],
  () => `${stanza("#5eead4", "#115e59", "#b7793c", "#5c3410", 148)}${ombra(132, 150, 44, 5)}${L("M150 40 128 140", "url(#@acciaio)", 8)}${P("M96 140h66l6 10H90Z", SC)}${R(96, 132, 66, 12, 6, "url(#@nero)")}${L("M100 144h56", AC, 2)}<g transform="rotate(12 150 52)">${R(136, 24, 28, 58, 8, "url(#@vetro)")}${R(140, 50, 20, 28, 4, "#94a3b8", 'opacity=".6"')}${R(132, 16, 36, 14, 6, SC)}${R(160, 22, 14, 60, 6, SC)}${C(150, 23, 3, AC)}${R(138, 28, 4, 46, 2, "#fff", 'opacity=".6"')}</g>${led(126, 138, VE, 1.4)}`
);
disegno(
  "stendino",
  "lavanderia",
  "Stendino",
  "Drying rack",
  ["stendibiancheria", "panni stesi", "bucato", "clothes horse", "drying rack"],
  () => `${fondo("#7dd3fc", "#e0f2fe")}${sole(200, 30, 12)}${R(0, 140, 240, 100, 0, "#d6d3d1")}${L("M40 150 60 64M200 150 180 64M60 150 40 64M180 150 200 64", "#94a3b8", 4)}${righe(40, 70, 200, 3, 22, "#cbd5e1", 3)}${P("M62 70h28l10 10-6 6-4-4v30H64V82l-4 4-6-6Z", AC)}${P("M110 70h30v40c-4 4-8-2-10-6-2 4-4 4-5 0-2 4-6 10-10 6Z", RO)}${P("M150 70h30v28h-30Z", CA)}${L("M150 82h30", "#fff", 2, 'opacity=".5"')}${P("M78 92h12v14h-8v-8h-4Z", VE)}${P("M168 114h10v12h-8v-6h-2Z", "#a855f7")}${P("M140 114h14v18h-14Z", "#fff")}`
);
disegno(
  "cesto-bucato",
  "lavanderia",
  "Cesto del bucato",
  "Laundry basket",
  ["cesta", "biancheria", "panni sporchi", "laundry basket", "hamper"],
  () => {
    let trama = "";
    for (let i = 0; i < 6; i++) trama += `M${62 + i * 4} ${82 + i * 12}H${178 - i * 4}`;
    return `${lavanderia("#94a3b8", "#475569")}${ombra(120, 152, 60, 5)}${P("M62 62c18-16 34-4 44-10s34-18 50 0 26 10 20 22H60c-6-4-4-8 2-12Z", "#f8fafc")}${P("M76 54c8-14 30-10 36 2Z", RO)}${P("M112 50c10-12 36-10 44 6Z", AC)}${P("M140 64c10-6 30-2 36 10H136Z", CA)}${P("M56 74h128l-14 78H70Z", def(lin("vimini", "v", "#e7b77a", "#92400e")))}${L(trama, "#78350f", 2.5, 'opacity=".55"')}${R(52, 70, 136, 10, 5, "#b7793c")}${R(96, 90, 48, 10, 5, "#78350f")}${R(56, 72, 128, 3, 1.5, "#fef3c7", 'opacity=".6"')}`;
  }
);
var fiocco = (x, y, s, c = "#e0f2fe", w = 2.5) => L(
  `M${x} ${y - s}V${y + s}M${n(x - s * 0.87)} ${y - s / 2}L${n(x + s * 0.87)} ${y + s / 2}M${n(x - s * 0.87)} ${y + s / 2}L${n(x + s * 0.87)} ${y - s / 2}`,
  c,
  w
);
var caldo = (x, y, s = 1, c = AR, op = 0.7) => L(
  `M${x} ${y}c${-6 * s} ${-8 * s} ${6 * s} ${-12 * s} 0 ${-22 * s}M${x + 16 * s} ${y}c${-6 * s} ${-8 * s} ${6 * s} ${-12 * s} 0 ${-22 * s}M${x + 32 * s} ${y}c${-6 * s} ${-8 * s} ${6 * s} ${-12 * s} 0 ${-22 * s}`,
  c,
  3.5,
  `opacity="${op}"`
);
disegno(
  "condizionatore",
  "clima",
  "Condizionatore",
  "Air conditioner",
  ["aria condizionata", "climatizzatore", "split", "fresco", "ac", "air conditioning", "cooling"],
  () => `${stanza("#7dd3fc", "#0c4a6e", "#e2e8f0", "#94a3b8", 164)}${ombra(120, 92, 92, 5, 0.35)}${R(24, 40, 192, 52, 14, "url(#@bianco)")}${R(24, 40, 192, 5, 3, "#fff")}${P("M30 76h180v6a10 10 0 0 1-10 10H40a10 10 0 0 1-10-10Z", "#cbd5e1")}${L("M40 84h160", "#64748b", 2.5)}${R(160, 52, 32, 14, 4, "#0b1220")}${L("M166 59h8M178 59h8", VT, 2.5)}${led(42, 56, AC, 1.6)}${L("M56 102q-10 18 0 36M92 102q-10 18 0 36M128 102q-10 18 0 36M164 102q-10 18 0 36", VT, 4, 'opacity=".75"')}${fiocco(200, 126, 9, FR, 3)}`
);
disegno(
  "pompa-calore",
  "clima",
  "Pompa di calore",
  "Heat pump",
  [
    "unita esterna",
    "motore condizionatore",
    "ventola",
    "heat pump",
    "outdoor unit",
    "riscaldamento"
  ],
  () => {
    let pale = "";
    for (let i = 0; i < 5; i++)
      pale += `<path d="M92 92c-4-14 2-26 14-30-2 10 0 20-14 30Z" fill="#475569" transform="rotate(${i * 72} 92 92)"/>`;
    return `${fondo("#cbd5e1", "#64748b")}${R(0, 0, 240, 240, 0, "url(#@legnoC)", 'opacity=".15"')}${R(0, 148, 240, 92, 0, "#78716c")}${ombra(120, 150, 96, 6)}${R(24, 40, 192, 108, 8, "url(#@biancoO)")}${R(24, 40, 192, 4, 2, "#fff")}${C(92, 92, 44, "#1e293b")}${C(92, 92, 40, "#334155")}${pale}${C(92, 92, 8, "url(#@acciaio)")}${[16, 26, 36].map((r) => C(92, 92, r, "none", `stroke="#94a3b8" stroke-width="1.5" opacity=".6"`)).join("")}${L("M52 92h80M92 52v80", "#94a3b8", 1.5, 'opacity=".6"')}${righe(150, 54, 204, 9, 9, "#94a3b8", 2)}${R(36, 148, 24, 8, 2, SC)}${R(180, 148, 24, 8, 2, SC)}${L("M216 70h10v40h-10", "#b45309", 4)}${L("M216 84h16v40h-16", AC, 4)}`;
  }
);
disegno(
  "termosifone",
  "clima",
  "Termosifone",
  "Radiator",
  ["radiatore", "calorifero", "riscaldamento", "caldo", "radiator", "heating"],
  () => {
    let el = "";
    for (let i = 0; i < 9; i++) el += `${R(40 + i * 18, 60, 15, 84, 7, "url(#@biancoO)")}`;
    return `${stanza("#fed7aa", "#9a3412", "#78350f", "#2a1608", 156)}${alone(120, 100, 110, AR, 0.3)}${ombra(120, 150, 88, 5)}${R(40, 66, 160, 8, 3, "#94a3b8")}${R(40, 132, 160, 8, 3, "#94a3b8")}${el}${righe(44, 64, 192, 1, 0, "#fff", 2, 0.8)}${R(200, 120, 12, 14, 3, "url(#@acciaio)")}${C(206, 116, 7, "#f8fafc", `stroke="${SC}" stroke-width="2"`)}${L("M40 144v8M196 144v8", "#94a3b8", 4)}${caldo(70, 50, 1.1)}${caldo(132, 50, 1.1)}`;
  }
);
disegno(
  "stufa-pellet",
  "clima",
  "Stufa a pellet",
  "Pellet stove",
  ["stufa", "pellet", "legna", "riscaldamento", "stove", "wood stove"],
  () => `${stanza("#57534e", "#1c1917", "#44403c", "#0c0a09", 156)}${alone(120, 96, 110, AR, 0.45)}${ombra(120, 156, 60, 5)}${R(64, 14, 112, 142, 10, "url(#@nero)")}${R(64, 14, 112, 18, 8, "#0b1220")}${R(76, 19, 30, 8, 2, "#020617")}${L("M80 23h8M92 23h10", AR, 2.5)}${led(160, 23, RO, 1.6)}${R(76, 44, 88, 80, 8, "#020617")}${R(82, 50, 76, 68, 5, def(rad("brace", 0.5, 0.8, 0.8, "#fdba74", "#c2410c", "#1c0a05")))}${fiamma(108, 112, 26, 50)}${fiamma(130, 112, 24, 40)}${E(120, 112, 30, 4, "#7c2d12")}${P("M84 52h26L84 96Z", "#fff", 'opacity=".12"')}${R(76, 132, 88, 14, 4, "#1e293b")}${R(110, 137, 20, 4, 2, "#64748b")}${R(66, 16, 4, 136, 2, "#fff", 'opacity=".15"')}`,
  [50, 15]
);
disegno(
  "camino",
  "clima",
  "Camino",
  "Fireplace",
  ["focolare", "fuoco", "legna", "caminetto", "fireplace", "fire"],
  () => {
    let pietre = "";
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++)
        pietre += `M${20 + c * 34 + r % 2 * 17} ${36 + r * 20}h30v16h-30Z`;
    return `${stanza("#334155", "#0f172a", "#57534e", "#1c1917", 158)}${alone(120, 110, 120, AR, 0.5)}${R(20, 30, 200, 128, 4, "#78716c")}${P(pietre, "#a8a29e", 'opacity=".5"')}${R(10, 22, 220, 14, 4, "url(#@legno)")}${R(10, 22, 220, 3, 1.5, "#fde68a", 'opacity=".4"')}${P("M60 158V96a60 40 0 0 1 120 0v62Z", "#0c0a09")}${P("M66 158V98a54 34 0 0 1 108 0v60Z", def(rad("focolare", 0.5, 0.9, 0.8, "#f97316", "#7c2d12", "#0c0a09")))}${fiamma(104, 146, 30, 60)}${fiamma(134, 146, 28, 50)}${fiamma(120, 146, 24, 70)}${L("M86 150 154 140M90 140l64 10", "#451a03", 8)}${pianta(212, 158, 0.5)}`;
  }
);
disegno(
  "ventilatore",
  "clima",
  "Ventilatore",
  "Fan",
  ["pala", "fresco", "aria", "piantana ventilatore", "fan", "cooling"],
  () => {
    let pale = "";
    for (let i = 0; i < 3; i++)
      pale += `<path d="M120 70c-6-22 6-38 22-40 4 18-6 30-22 40Z" fill="${VT}" opacity=".85" transform="rotate(${i * 120} 120 70)"/>`;
    const raggi = Array.from(
      { length: 12 },
      (_, i) => `M120 70L${n(120 + Math.cos(i * Math.PI / 6) * 50)} ${n(70 + Math.sin(i * Math.PI / 6) * 50)}`
    ).join("");
    return `${stanza("#a5f3fc", "#155e75", "#e2e8f0", "#94a3b8", 160)}${ombra(120, 156, 40, 5)}${L("M120 112V150", "url(#@acciaioO)", 8)}${E(120, 152, 34, 8, "url(#@bianco)")}${C(120, 70, 50, "#0f2942", 'opacity=".15"')}${pale}${L(raggi, "#e2e8f0", 1.5, 'opacity=".9"')}${C(120, 70, 50, "none", `stroke="#f8fafc" stroke-width="4"`)}${C(120, 70, 36, "none", `stroke="#f8fafc" stroke-width="1.5" opacity=".7"`)}${C(120, 70, 10, "url(#@bianco)")}${C(120, 70, 4, AC)}${L("M182 56q14 14 0 28M196 48q20 22 0 44", "#fff", 3, 'opacity=".7"')}`;
  }
);
disegno(
  "ventilatore-soffitto",
  "clima",
  "Ventilatore a soffitto",
  "Ceiling fan",
  ["pale soffitto", "ventilatore", "plafoniera", "ceiling fan"],
  () => `${stanza("#fde68a", "#a16207", "#78350f", "#2a1608", 160)}${alone(120, 76, 90, CA, 0.45)}${R(0, 0, 240, 14, 0, "#fef3c7", 'opacity=".8"')}${R(114, 12, 12, 26, 3, "url(#@legno)")}${P("M120 52 26 40c-8 0-10 8-4 10l98 10Z", "url(#@legno)")}${P("M120 52 214 40c8 0 10 8 4 10l-98 10Z", "url(#@legno)")}${P("M110 56 86 92c-4 6 4 10 8 6l30-38Z", "url(#@legno)")}${P("M130 56l24 36c4 6-4 10-8 6l-30-38Z", "url(#@legno)")}${E(120, 50, 26, 12, "url(#@bianco)")}${P("M100 60h40a20 20 0 0 1-40 0Z", "url(#@accesa)")}${L("M32 50l40 4", "#fde68a", 2, 'opacity=".5"')}`
);
disegno(
  "deumidificatore",
  "clima",
  "Deumidificatore",
  "Dehumidifier",
  ["umidita", "secco", "muffa", "tanica", "dehumidifier", "humidity"],
  () => `${stanza("#99f6e4", "#134e4a", "#e2e8f0", "#94a3b8", 156)}${ombra(120, 156, 52, 5)}${R(72, 18, 96, 138, 14, "url(#@biancoO)")}${R(80, 24, 80, 14, 7, "#cbd5e1")}${righe(86, 31, 154, 1, 0, "#94a3b8", 6)}${R(88, 48, 64, 18, 5, SC)}${L("M96 57h10M110 57h8", VT, 2.5)}${goccia(140, 58, 5, AC)}${R(84, 90, 72, 54, 8, "#e2e8f0")}${R(96, 100, 48, 36, 5, def(lin("tanica", "v", "#e0f2fe/.6", "#7dd3fc")))}${R(96, 116, 48, 20, 5, AC, 'opacity=".55"')}${R(110, 84, 20, 6, 3, "#94a3b8")}${goccia(46, 90, 7, VT, 'opacity=".8"')}${goccia(194, 110, 6, VT, 'opacity=".8"')}${goccia(56, 126, 5, VT, 'opacity=".7"')}${R(76, 22, 4, 128, 2, "#fff")}`,
  [50, 15]
);
disegno(
  "purificatore",
  "clima",
  "Purificatore d'aria",
  "Air purifier",
  ["purificatore", "aria pulita", "filtro", "allergie", "air purifier", "hepa"],
  () => `${stanza("#bbf7d0", "#166534", "#e2e8f0", "#94a3b8", 156)}${L("M90 28q-8-14 4-24M120 26q-8-14 4-24M150 28q-8-14 4-24", "#fff", 3, 'opacity=".7"')}${ombra(120, 156, 48, 5)}${P("M80 40h80v106a10 10 0 0 1-10 10H90a10 10 0 0 1-10-10Z", "url(#@biancoO)")}${E(120, 40, 40, 10, "#e2e8f0")}${E(120, 40, 32, 7, "#334155")}${punti(88, 70, 9, 8, 8, 9, 1.8, "#94a3b8")}${C(120, 106, 10, "none", `stroke="${VE}" stroke-width="3"`)}${P("M116 110c0-6 4-10 10-10 0 6-4 10-10 10Z", VE)}${R(84, 46, 4, 104, 2, "#fff")}${led(120, 54, VE, 2)}`,
  [50, 20]
);
disegno(
  "termostato",
  "clima",
  "Termostato",
  "Thermostat",
  ["cronotermostato", "temperatura", "riscaldamento", "caldaia", "thermostat", "temperature"],
  () => {
    const tacche = Array.from({ length: 25 }, (_, i) => {
      const a = (-225 + i * 11.25) * Math.PI / 180;
      return `M${n(120 + Math.cos(a) * 52)} ${n(84 + Math.sin(a) * 52)}L${n(120 + Math.cos(a) * 58)} ${n(84 + Math.sin(a) * 58)}`;
    }).join("");
    const arco = def(lin("arco", "h", AC, CA, AR));
    return `${fondo("#e2e8f0", "#94a3b8")}${alone(120, 84, 100, AR, 0.25)}${ombra(124, 90, 70, 70, 0.35)}${C(120, 84, 66, "url(#@bianco)")}${C(120, 84, 60, "#0b1220")}${L(tacche, "#475569", 2)}${P("M78.9 125.1A58 58 0 1 1 161.1 125.1", "none", `stroke="${arco}" stroke-width="5" stroke-linecap="round" opacity=".9"`)}${C(120, 84, 42, "#111827")}${fiamma(120, 100, 26, 40)}${C(161, 43, 6, "#fff")}${P("M64 50a66 66 0 0 1 40-28", "none", 'stroke="#fff" stroke-width="5" opacity=".8" stroke-linecap="round"')}`;
  }
);
disegno(
  "boiler",
  "clima",
  "Scaldabagno",
  "Water heater",
  ["boiler", "acqua calda", "scaldacqua", "caldaia", "water heater", "hot water", "caldaia a gas"],
  () => `${cucina(240, "#93c5fd", "#1e3a8a")}${ombra(124, 130, 60, 60, 0.3)}${R(72, 16, 96, 120, 46, "url(#@biancoO)")}${R(78, 22, 6, 104, 3, "#fff")}${C(120, 66, 18, "#e2e8f0")}${C(120, 66, 14, "#fff", `stroke="${SC}" stroke-width="2"`)}${L("M120 66l8-8", RO, 2.5)}${C(120, 66, 2.5, SC)}${R(104, 100, 32, 10, 3, SC)}${led(112, 105, VE, 1.4)}${L("M100 136v30M140 136v30", "#94a3b8", 6)}${L("M100 146v20", RO, 6)}${L("M140 146v20", AC, 6)}${caldo(84, 14, 0.8, AR, 0.5)}`,
  [50, 20]
);
disegno(
  "solare-termico",
  "clima",
  "Solare termico",
  "Solar water heater",
  ["pannello solare termico", "collettore", "acqua calda", "solar thermal", "boiler solare"],
  () => `${giorno(170)}${P("M0 120 120 70l120 50v60H0Z", "#9a3412")}${P("M0 120 120 70l120 50", "none", `stroke="#7c2d12" stroke-width="6"`)}${P("M40 112 120 78l80 34-10 30H50Z", "#0f2942", 'opacity=".3"')}${R(54, 56, 132, 20, 10, "url(#@biancoO)")}${R(62, 58, 116, 3, 1.5, "#fff")}${P("M58 76h124l12 54H46Z", SC)}${colonne(62, 80, 126, 13, 9.6, def(lin("tubi", "h", "#1e293b", "#64748b")), 6)}${colonne(62, 80, 126, 13, 9.6, VT, 1.5, 0.5)}${L("M50 128h140", "url(#@acciaio)", 4)}${L("M150 40l8-10M168 44l10-6M134 38l2-12", CA, 3)}`
);
disegno(
  "scaldasalviette",
  "clima",
  "Scaldasalviette",
  "Towel warmer",
  ["termoarredo", "bagno", "asciugamani", "towel rail", "towel warmer"],
  () => `${cucina(240, "#e0f2fe", "#64748b")}${alone(120, 90, 90, AR, 0.2)}${ombra(124, 94, 60, 70, 0.3)}${L("M76 22V158M164 22V158", "url(#@acciaioO)", 8)}${righe(76, 30, 164, 12, 11, "#e2e8f0", 5)}${righe(76, 29, 164, 12, 11, "#fff", 1.5, 0.8)}${P("M92 50h56v70c0 6-6 6-10 4l-4 6-6-6-6 6-6-6-6 6-6-6c-6 4-12 2-12-4Z", def(lin("telo", "v", "#fda4af", "#e11d48")))}${righe(92, 104, 148, 2, 6, "#fff", 2, 0.6)}${P("M92 50h56v8H92Z", "#fff", 'opacity=".3"')}${caldo(98, 20, 0.8, AR, 0.5)}`,
  [50, 20]
);
disegno(
  "umidificatore",
  "clima",
  "Umidificatore",
  "Humidifier",
  ["vapore", "aria secca", "diffusore", "nebulizzatore", "humidifier", "aroma"],
  () => `${fondo("#c4b5fd", "#6d28d9", "#2e1065")}${piano(144, "legnoC", 8)}${P("M120 54c-24-6-30-30-12-40 4-14 30-16 36-2 18-2 24 18 12 28 0 12-20 18-36 14Z", "#fff", 'opacity=".5" filter="url(#@b5)"')}${L("M114 62c-8-10 6-18-2-30M126 60c8-10-6-18 2-30", "#fff", 6, 'opacity=".6" filter="url(#@b2)"')}${ombra(120, 144, 46, 5)}${alone(120, 132, 56, "#a78bfa", 0.6)}${P("M104 62h32c18 22 30 48 26 70H78c-4-22 8-48 26-70Z", "url(#@bianco)")}${E(120, 62, 16, 4, "#cbd5e1")}${E(120, 62, 8, 2, "#475569")}${P("M100 70c-10 14-16 30-16 48", "none", 'stroke="#fff" stroke-width="6" opacity=".9" stroke-linecap="round"')}${P("M76 126h88v6a12 12 0 0 1-12 12H88a12 12 0 0 1-12-12Z", "url(#@legno)")}${R(78, 124, 84, 4, 2, "#c4b5fd")}${R(78, 124, 84, 4, 2, "#a78bfa", 'filter="url(#@b3)"')}${led(120, 112, VE, 1.4)}`
);
var auto = (x, y, s = 1, colore = "url(#@blu)") => `<g transform="translate(${x} ${y}) scale(${s})">${E(85, 64, 84, 6, "#020617", 'opacity=".45" filter="url(#@b3)"')}${P("M4 44c0-10 6-15 16-17l30-5c10-12 26-20 48-20h22c16 0 28 8 40 21l12 3c10 2 16 8 16 18v8c0 4-3 6-7 6H10c-4 0-6-2-6-6Z", colore)}${P("M56 24c8-10 20-16 38-16h8v18H54Z", "url(#@vetro)")}${P("M108 8h6c12 0 22 6 30 18h-36Z", "url(#@vetro)")}${R(20, 30, 140, 3, 1.5, "#fff", 'opacity=".25"')}${R(158, 34, 10, 5, 2, "#fef9c3")}${R(4, 34, 8, 5, 2, RO)}${C(40, 56, 15, "#0b1220")}${C(40, 56, 8, "url(#@acciaio)")}${C(134, 56, 15, "#0b1220")}${C(134, 56, 8, "url(#@acciaio)")}</g>`;
var garage = () => stanza("#a8a29e", "#57534e", "#78716c", "#292524", 156);
function celle(a, b, c, d, nc, nr) {
  const lerp = (p, q, t2) => [p[0] + (q[0] - p[0]) * t2, p[1] + (q[1] - p[1]) * t2];
  let s = `<path d="M${a}L${b}L${c}L${d}Z" fill="url(#@pannello)"/>`;
  let linee = "";
  for (let i = 1; i < nc; i++) {
    const p = lerp(a, b, i / nc);
    const q = lerp(d, c, i / nc);
    linee += `M${n(p[0])} ${n(p[1])}L${n(q[0])} ${n(q[1])}`;
  }
  for (let j = 1; j < nr; j++) {
    const p = lerp(a, d, j / nr);
    const q = lerp(b, c, j / nr);
    linee += `M${n(p[0])} ${n(p[1])}L${n(q[0])} ${n(q[1])}`;
  }
  s += L(linee, "#93c5fd", 1.2, 'opacity=".7"');
  s += `<path d="M${a}L${b}L${c}L${d}Z" fill="none" stroke="#e2e8f0" stroke-width="2.5"/>`;
  return s;
}
disegno(
  "pannelli-solari",
  "energia",
  "Pannelli solari",
  "Solar panels",
  ["fotovoltaico", "solare", "impianto", "produzione", "solar", "pv", "photovoltaic"],
  () => `${giorno(150)}${sole(52, 30, 15)}<g transform="translate(0 -30)">${P("M0 132 240 72v168H0Z", "#9a3412")}${P("M0 132 240 72", "none", 'stroke="#7c2d12" stroke-width="6"')}${celle([24, 116], [124, 92], [148, 140], [40, 166], 6, 3)}${celle([132, 90], [228, 66], [240, 112], [156, 136], 6, 3)}${P("M28 118l40-10 6 16-38 10Z", "#fff", 'opacity=".2"')}</g>`
);
disegno(
  "batteria-casa",
  "energia",
  "Batteria di casa",
  "Home battery",
  ["accumulo", "batteria", "storage", "home battery", "accumulatore"],
  () => `${garage()}${ombra(120, 156, 52, 5)}${R(72, 18, 96, 138, 12, "url(#@biancoO)")}${R(76, 22, 6, 128, 3, "#fff")}${R(98, 40, 44, 92, 8, "#e2e8f0")}${[0, 1, 2, 3].map((i) => R(104, 112 - i * 22, 32, 16, 4, i < 3 ? VE : "#cbd5e1", i < 3 ? "" : 'opacity=".9"')).join("")}${R(104, 112, 32, 16, 4, VE, 'filter="url(#@b3)" opacity=".5"')}${fulmine(120, 58, 0.6, CA)}${led(120, 144, VE, 1.6)}${L("M168 120h22v36", "#334155", 4)}`,
  [50, 15]
);
disegno(
  "inverter",
  "energia",
  "Inverter",
  "Inverter",
  ["inverter", "convertitore", "fotovoltaico", "solare", "solar inverter"],
  () => `${garage()}${ombra(124, 84, 72, 60, 0.3)}${R(54, 28, 132, 104, 10, "url(#@biancoO)")}${R(54, 28, 132, 4, 2, "#fff")}${righe(62, 40, 178, 3, 5, "#cbd5e1", 2)}${R(78, 60, 84, 44, 6, "#0b1220")}${P("M84 92c10 0 10-24 20-24s10 24 20 24 10-24 20-24 10 24 12 24", "none", `stroke="${VE}" stroke-width="3" stroke-linecap="round"`)}${C(150, 70, 5, CA)}${led(70, 118, VE, 1.6)}${led(84, 118, AC, 1.6)}${L("M80 132v24M100 132v24", "#1e293b", 5)}${L("M140 132v24M160 132v24", "#b91c1c", 5)}`
);
disegno(
  "wallbox",
  "energia",
  "Wallbox",
  "EV charger",
  ["colonnina", "ricarica auto", "caricatore", "wall box", "ev charger", "charging"],
  () => `${garage()}${ombra(110, 88, 50, 60, 0.3)}${R(78, 26, 64, 92, 14, "url(#@nero)")}${R(82, 30, 4, 80, 2, "#fff", 'opacity=".25"')}${C(110, 62, 18, "none", `stroke="${VE}" stroke-width="4"`)}${C(110, 62, 18, "none", `stroke="${VE}" stroke-width="8" opacity=".4" filter="url(#@b3)"`)}${fulmine(110, 62, 0.6, VE)}${R(98, 92, 24, 8, 3, "#334155")}${L("M110 118c0 22-34 22-34 0s52-12 72 6 0 30 0 30", "#1e293b", 7)}${R(134, 140, 26, 16, 5, SC)}${R(160, 144, 8, 8, 2, "#64748b")}`
);
disegno(
  "auto-elettrica",
  "energia",
  "Auto elettrica",
  "Electric car",
  ["auto", "macchina", "ev", "ricarica", "electric car", "electric vehicle", "veicolo"],
  () => `${garage()}${R(14, 46, 26, 54, 8, "url(#@nero)")}${C(27, 64, 8, "none", `stroke="${VE}" stroke-width="3"`)}${L("M27 100c0 24 20 30 34 24", "#1e293b", 5)}${auto(40, 66, 1.12)}${alone(186, 50, 26, VE, 0.5)}${C(186, 50, 13, VE)}${fulmine(186, 50, 0.5, "#fff")}`
);
disegno(
  "contatore",
  "energia",
  "Contatore",
  "Energy meter",
  ["contatore luce", "consumi", "misuratore", "smart meter", "electricity meter"],
  () => `${fondo("#cbd5e1", "#475569")}${ombra(124, 92, 64, 66, 0.3)}${R(62, 20, 116, 136, 12, "url(#@bianco)")}${R(62, 20, 116, 4, 2, "#fff")}${R(76, 36, 88, 34, 6, "#0b1220")}${R(80, 40, 80, 26, 4, def(lin("lcd", "v", "#a3e635", "#65a30d")))}${[0, 1, 2, 3, 4].map((i) => `${L(`M${88 + i * 14} 46v14M${84 + i * 14} 53h8`, "#1a2e05", 2.5, 'opacity=".75"')}`).join("")}${led(88, 84, RO, 2)}${R(100, 80, 60, 8, 3, "#cbd5e1")}${R(108, 98, 24, 10, 3, AC)}${fulmine(148, 108, 0.5, CA)}${R(80, 122, 80, 22, 4, "#94a3b8")}${punti(92, 133, 5, 1, 14, 0, 3, "#475569")}`
);
disegno(
  "presa-smart",
  "energia",
  "Presa smart",
  "Smart plug",
  ["presa", "spina", "smart plug", "socket", "outlet", "presa wifi"],
  () => `${fondo("#e0e7ff", "#6366f1")}${L("M150 42a30 30 0 0 1 30 30M150 26a46 46 0 0 1 46 46", "#fff", 5, 'opacity=".8"')}${ombra(124, 98, 70, 64, 0.35)}${R(46, 30, 148, 140, 22, "url(#@bianco)")}${R(70, 54, 100, 92, 46, "#e2e8f0")}${C(120, 100, 40, "url(#@biancoO)")}${C(120, 100, 40, "none", `stroke="${AC}" stroke-width="4"`)}${C(120, 100, 40, "none", `stroke="${AC}" stroke-width="8" opacity=".4" filter="url(#@b3)"`)}${C(104, 100, 6, SC)}${C(136, 100, 6, SC)}${C(120, 100, 3.5, SC)}${led(120, 72, VE, 1.6)}`
);
disegno(
  "ciabatta",
  "energia",
  "Ciabatta",
  "Power strip",
  ["multipresa", "prese", "presa multipla", "power strip", "extension"],
  () => {
    let prese = "";
    for (let i = 0; i < 4; i++)
      prese += `${C(70 + i * 36, 104, 13, "#e2e8f0")}${C(65 + i * 36, 104, 3, SC)}${C(75 + i * 36, 104, 3, SC)}`;
    return `${fondo("#fef3c7", "#d97706")}${ombra(124, 124, 104, 8)}${R(26, 82, 188, 44, 14, "url(#@bianco)")}${R(30, 86, 180, 4, 2, "#fff")}${prese}${R(30, 96, 18, 18, 4, RO)}${led(39, 100, "#fecaca", 1.2)}${R(166, 46, 26, 40, 6, SC)}${L("M179 46V20q0-12 12-12h40", SC, 6)}${R(170, 86, 4, 8, 1, "#94a3b8")}${R(184, 86, 4, 8, 1, "#94a3b8")}${L("M26 104H8q-8 0-8 8v40", "#475569", 7)}`;
  }
);
disegno(
  "interruttore",
  "energia",
  "Interruttore smart",
  "Smart switch",
  ["interruttore", "pulsante", "deviatore", "luce", "light switch", "switch", "touch"],
  () => `${fondo("#d6d3d1", "#78716c")}${alone(120, 90, 90, CA, 0.25)}${ombra(124, 94, 66, 66, 0.35)}${R(52, 26, 136, 136, 20, "url(#@bianco)")}${R(56, 30, 128, 4, 2, "#fff")}${R(66, 42, 50, 104, 10, "#f8fafc", `stroke="#cbd5e1" stroke-width="1.5"`)}${R(124, 42, 50, 104, 10, "#f8fafc", `stroke="#cbd5e1" stroke-width="1.5"`)}${R(80, 60, 22, 4, 2, CA)}${R(80, 60, 22, 4, 2, CA, 'filter="url(#@b2)"')}${R(138, 60, 22, 4, 2, "#cbd5e1")}${C(91, 120, 8, "none", `stroke="${CA}" stroke-width="3"`)}${C(149, 120, 8, "none", `stroke="#94a3b8" stroke-width="3"`)}`
);
disegno(
  "quadro-elettrico",
  "energia",
  "Quadro elettrico",
  "Breaker panel",
  [
    "salvavita",
    "interruttori",
    "differenziale",
    "fusibili",
    "breaker",
    "fuse box",
    "electrical panel"
  ],
  () => {
    let m = "";
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 6; c++) {
        const x = 62 + c * 20;
        const y = 44 + r * 38;
        const rosso = r === 0 && c === 0;
        m += `${R(x, y, 16, 30, 3, rosso ? "url(#@rosso)" : "url(#@bianco)")}${R(x + 4, y + (r === 1 && c === 3 ? 16 : 6), 8, 8, 2, rosso ? "#fff" : SC)}`;
      }
    return `${fondo("#cbd5e1", "#475569")}${ombra(122, 94, 82, 70, 0.3)}${R(46, 22, 148, 134, 10, "url(#@bianco)")}${R(54, 30, 132, 118, 6, "#475569")}${righe(56, 40, 184, 3, 38, "#94a3b8", 3)}${m}${P("M194 22l30 10v128l-30-4Z", "url(#@vetro)", 'opacity=".7"')}${fulmine(210, 92, 0.6, CA)}`;
  }
);
disegno(
  "eolico",
  "energia",
  "Mini eolico",
  "Wind turbine",
  ["pala eolica", "vento", "turbina", "wind turbine", "wind power"],
  () => {
    let pale = "";
    for (let i = 0; i < 3; i++)
      pale += `<path d="M150 56c3-2 6-40 0-48-6 8-3 46 0 48Z" fill="url(#@bianco)" transform="rotate(${20 + i * 120} 150 56)"/>`;
    return `${giorno(150)}${L("M10 70q20-6 40 0M20 90q20-6 40 0", "#fff", 3, 'opacity=".7"')}${P("M146 60h8l4 96h-16Z", "url(#@biancoO)")}${pale}${R(142, 50, 24, 12, 6, "url(#@bianco)")}${C(150, 56, 5, "url(#@acciaio)")}${P("M74 94h4l2 60h-8Z", "#f1f5f9", 'opacity=".8"')}${[0, 1, 2].map((i) => `<path d="M76 92c2-1 4-24 0-28-4 4-2 27 0 28Z" fill="#f8fafc" opacity=".85" transform="rotate(${70 + i * 120} 76 92)"/>`).join("")}${C(76, 92, 3, "#cbd5e1")}`;
  }
);
disegno(
  "bici-elettrica",
  "energia",
  "Bici elettrica",
  "E-bike",
  ["bicicletta", "e-bike", "ricarica bici", "monopattino", "bike", "ebike"],
  () => {
    const ruota = (x) => `${C(x, 112, 34, "none", `stroke="#0b1220" stroke-width="7"`)}${C(x, 112, 28, "none", `stroke="#94a3b8" stroke-width="1" opacity=".7"`)}${C(x, 112, 5, "url(#@acciaio)")}`;
    return `${garage()}${ombra(120, 148, 92, 5)}${ruota(64)}${ruota(176)}${L("M64 112 104 70h58l14 42M104 70l18 42h-58M122 112l40-42M100 56l4 14M156 50l6 20", SC, 7)}${L("M90 54h22M150 48l14-4", "#334155", 6)}${R(110, 76, 40, 16, 6, "url(#@nero)")}${R(114, 80, 24, 6, 3, VE)}${led(144, 83, VE, 1.4)}${fulmine(198, 40, 0.6, VE)}`;
  }
);
var cespuglio = (x, y, s = 1) => `${C(x, y, 14 * s, "url(#@foglia)")}${C(x - 12 * s, y + 6 * s, 10 * s, "url(#@foglia)")}${C(x + 12 * s, y + 6 * s, 10 * s, "url(#@foglia)")}`;
var sasso = (x, y, rx, ry) => `${E(x, y, rx, ry, "#a8a29e")}${E(x - rx * 0.3, y - ry * 0.35, rx * 0.4, ry * 0.3, "#fff", 'opacity=".35"')}`;
var sdraio = (x, y) => `${L(`M${x} ${y}l10-14h46l14 14M${x + 10} ${y - 14}l-6-16`, "#e2e8f0", 4)}${P(`M${x + 4} ${y - 34}l8 22h46l-2-6H${x + 18}l-6-18Z`, "#f8fafc")}`;
disegno(
  "irrigatore",
  "esterno",
  "Irrigatore",
  "Sprinkler",
  [
    "irrigazione",
    "annaffiatoio",
    "zona irrigua",
    "acqua giardino",
    "sprinkler",
    "watering",
    "irrigation"
  ],
  () => {
    let getti = "";
    for (let a = -64; a <= 64; a += 16) {
      const r_ = a * Math.PI / 180;
      getti += L(
        `M120 96Q${n(120 + Math.sin(r_) * 60)} ${n(24 + Math.abs(Math.sin(r_)) * 30)} ${n(120 + Math.sin(r_) * 108)} ${n(120 - Math.cos(r_) * 4)}`,
        "#0369a1",
        4,
        'stroke-dasharray="2 7" opacity=".7"'
      ) + L(
        `M120 96Q${n(120 + Math.sin(r_) * 60)} ${n(14 + Math.abs(Math.sin(r_)) * 30)} ${n(120 + Math.sin(r_) * 108)} ${n(120 - Math.cos(r_) * 4)}`,
        "#fff",
        2.5,
        'stroke-dasharray="1.5 7"'
      );
    }
    return `${giorno(120)}${getti}${E(120, 132, 40, 10, "#14532d", 'opacity=".45"')}${ombra(120, 132, 34, 6)}${R(100, 104, 40, 30, 8, "url(#@nero)")}${E(120, 104, 20, 6, "#334155")}${R(110, 88, 20, 18, 5, "url(#@acciaio)")}${R(112, 90, 4, 14, 2, "#fff", 'opacity=".6"')}${C(120, 90, 8, AC)}${led(120, 120, VE, 1.6)}${goccia(80, 132, 4, VT)}${goccia(164, 138, 4, VT)}`;
  }
);
disegno(
  "piscina",
  "esterno",
  "Piscina",
  "Pool",
  ["vasca", "nuoto", "pompa piscina", "cloro", "swimming pool", "pool"],
  () => {
    const caus = "M40 112c10-6 20 6 30 0s20-6 30 0M110 124c10-6 20 6 30 0s20-6 30 0M60 140c10-6 20 6 30 0s20-6 30 0M140 104c8-4 16 4 24 0";
    return `${giorno(80)}${R(0, 80, 240, 160, 0, "#e7e5e4")}${P("M30 92h180l26 70H4Z", "#f1f5f9")}${P("M40 98h160l20 58H20Z", def(lin("vasca", "v", "#67e8f9", "#0891b2", "#155e75")))}${L(caus, "#fff", 2, 'opacity=".55"')}${L("M182 92v34M196 92v34M182 100h14M182 112h14", "url(#@acciaio)", 3.5)}${C(110, 150, 6, "#fef9c3", 'opacity=".7" filter="url(#@b2)"')}${sdraio(30, 80)}${cespuglio(220, 70, 0.9)}`;
  }
);
disegno(
  "idromassaggio",
  "esterno",
  "Idromassaggio",
  "Hot tub",
  ["vasca idromassaggio", "spa", "minipiscina", "hot tub", "whirlpool"],
  () => {
    const r = rng(13);
    let bolle = "";
    for (let i = 0; i < 26; i++)
      bolle += C(70 + r() * 100, 92 + r() * 30, 1.5 + r() * 2.5, "#fff", 'opacity=".75"');
    return `${fondo("#4c1d95", "#1e1b4b", "#0b1023")}${stelle(17, 18, 70)}${R(0, 128, 240, 112, 0, "url(#@legno)")}${righe(0, 140, 240, 5, 14, "#000", 1.5, 0.2)}${L("M80 70c-8-10 8-16 0-26M118 64c-8-10 8-16 0-26M156 70c-8-10 8-16 0-26", "#fff", 4, 'opacity=".4" filter="url(#@b2)"')}${R(40, 84, 160, 62, 14, "url(#@legnoC)")}${R(40, 84, 160, 4, 2, "#fef3c7", 'opacity=".6"')}${R(52, 88, 136, 40, 10, def(lin("hot", "v", "#5eead4", "#0e7490")))}${alone(120, 108, 40, "#5eead4", 0.5)}${bolle}${righe(44, 136, 196, 1, 0, "#92400e", 2, 0.5)}${colonne(56, 128, 146, 8, 18, "#92400e", 1.5, 0.5)}`;
  }
);
disegno(
  "barbecue",
  "esterno",
  "Barbecue",
  "Barbecue",
  ["griglia", "bbq", "grigliata", "brace", "grill"],
  () => `${fondo("#fdba74", "#ea580c", "#7c2d12")}${sole(186, 40, 14)}${R(0, 150, 240, 90, 0, "#57534e")}${L("M96 58c-10-12 10-18 0-32M126 54c-10-12 10-18 0-32", "#fff", 5, 'opacity=".5" filter="url(#@b3)"')}${L("M80 120 64 152M160 120l16 32M120 120v32", SC, 5)}${C(64, 152, 6, "#1e293b")}${P("M60 94h120a60 32 0 0 1-120 0Z", "url(#@nero)")}${P("M70 98h100a50 22 0 0 1-50 18 50 22 0 0 1-50-18Z", "#fff", 'opacity=".08"')}${alone(120, 90, 50, AR, 0.6)}${E(120, 92, 60, 9, "#7c2d12")}${E(120, 92, 56, 7, "#ea580c", 'opacity=".7" filter="url(#@b2)"')}${righe(66, 88, 174, 1, 0, "#94a3b8", 3)}${[84, 108, 132, 156].map((x, i) => R(x - 10, 80 + i % 2 * 3, 22, 9, 4.5, i % 2 ? "#b45309" : "#9a3412")).join("")}`
);
disegno(
  "pergola",
  "esterno",
  "Pergola",
  "Pergola",
  ["pergola bioclimatica", "lamelle", "gazebo", "tettoia", "pergola", "louvered roof"],
  () => {
    let lamelle = "";
    for (let i = 0; i < 9; i++) lamelle += P(`M${44 + i * 18} 46l14-6v6l-14 6Z`, "url(#@bianco)");
    return `${giorno(132)}${P("M20 140h200l20 30H0Z", "#d6d3d1")}${R(28, 44, 12, 104, 3, "url(#@biancoO)")}${R(200, 44, 12, 104, 3, "url(#@biancoO)")}${R(18, 34, 204, 16, 3, "url(#@bianco)")}${lamelle}${R(18, 34, 204, 3, 1.5, "#fff")}${P("M40 50h160v6H40Z", "#000", 'opacity=".15"')}${divano(70, 104, 100, "#e2e8f0", "#94a3b8")}${R(102, 136, 36, 8, 3, "url(#@legno)")}${pianta(200, 146, 0.6)}`;
  }
);
disegno(
  "tenda-sole",
  "esterno",
  "Tenda da sole",
  "Awning",
  ["tenda", "tendone", "parasole", "veranda", "awning", "sun shade"],
  () => {
    let strisce = "";
    for (let i = 0; i < 8; i++)
      strisce += P(`M${28 + i * 23} 40h23l${6 + i * 0} 52h-23Z`, i % 2 ? FR : AC);
    return `${fondo("#bae6fd", "#e0f2fe")}${sole(210, 22, 12)}${R(0, 0, 240, 150, 0, "#fde68a", 'opacity=".35"')}${R(0, 150, 240, 90, 0, "#d6d3d1")}${finestra(66, 88, 108, 62)}${P("M28 92h184v8H28Z", "#000", 'opacity=".2" filter="url(#@b3)"')}${R(22, 32, 196, 10, 5, "url(#@acciaio)")}${strisce}${P("M28 92h190l0 10c-8 6-16-4-24 2s-16-4-24 2-16-4-24 2-16-4-24 2-16-4-24 2-16-4-24 2-16-4-24 2-16-4-22 0Z", AC)}${L("M30 40l-6 56M210 40l8 56", "#94a3b8", 3)}${P("M20 100h200l-6 50H26Z", "#0f172a", 'opacity=".22"')}${pianta(30, 150, 0.6)}`;
  }
);
disegno(
  "fontana",
  "esterno",
  "Fontana",
  "Fountain",
  ["fontanella", "getto", "acqua", "vasca", "fountain", "water feature"],
  () => `${giorno(130)}${E(120, 140, 90, 18, "#a8a29e")}${E(120, 136, 80, 13, "url(#@acqua)")}${E(120, 136, 60, 8, "#fff", 'opacity=".25"')}${R(110, 84, 20, 52, 4, "url(#@biancoO)")}${E(120, 84, 46, 10, "url(#@biancoO)")}${E(120, 82, 40, 6, "url(#@acqua)")}${R(116, 54, 8, 28, 3, "url(#@biancoO)")}${E(120, 54, 18, 5, "url(#@bianco)")}${L("M120 50V24", VT, 4)}${L("M120 26c-14 0-22 14-26 28M120 26c14 0 22 14 26 28M80 86c-8 6-12 26-14 46M160 86c8 6 12 26 14 46", VT, 3, 'opacity=".85"')}${C(120, 22, 4, "#e0f2fe")}${cespuglio(30, 128, 1)}${cespuglio(210, 128, 1)}`
);
disegno(
  "serra",
  "esterno",
  "Serra",
  "Greenhouse",
  ["serretta", "piante", "coltivazione", "orto", "greenhouse"],
  () => {
    const vetro_ = def(lin("serra", "d", "#e0f2fe/.75", "#bae6fd/.4", "#7dd3fc/.6"));
    return `${giorno(140)}${pianta(84, 146, 0.75)}${pianta(150, 146, 0.65)}${cespuglio(116, 132, 0.8)}${P("M40 146V86l80-48 80 48v60Z", vetro_)}${L("M40 146V86l80-48 80 48v60M80 146V62M160 146V62M120 146V38M40 112h160M40 86h160", "#f8fafc", 4)}${P("M44 86 120 42v12L44 98Z", "#fff", 'opacity=".4"')}${R(108, 112, 24, 34, 2, "#fff", 'opacity=".3"')}`;
  }
);
disegno(
  "orto",
  "esterno",
  "Orto",
  "Vegetable garden",
  ["verdure", "ortaggi", "pomodori", "insalata", "vegetables", "veggie garden", "raised bed"],
  () => {
    const insalata = (x, y) => `${C(x, y, 10, "#86efac")}${C(x - 6, y + 3, 7, "#4ade80")}${C(x + 6, y + 3, 7, "#22c55e")}`;
    const pomodori = (x) => `${L(`M${x} 52V112`, "#a16207", 3)}${P(`M${x} 64c-12 4-16 14-14 22 8-2 14-10 14-22Zm0 14c12 4 16 14 14 22-8-2-14-10-14-22Z`, "url(#@foglia)")}${C(x - 7, 78, 6, RO)}${C(x + 8, 92, 6, "#ef4444")}${C(x - 5, 100, 5, AR)}`;
    return `${giorno(100)}${P("M10 110h220l10 40H0Z", "url(#@legno)")}${P("M18 112h204l6 26H12Z", "url(#@terra)")}${insalata(40, 116)}${insalata(74, 120)}${pomodori(120)}${pomodori(152)}${insalata(196, 118)}${R(10, 110, 220, 4, 2, "#fde68a", 'opacity=".4"')}${P("M182 60h26l-4 30h-18Z", VE)}${L("M208 66l18-10", VE, 5)}${L("M186 60c0-14 18-14 18 0", VE, 4)}`;
  }
);
disegno(
  "albero-giardino",
  "esterno",
  "Albero",
  "Tree",
  ["albero da frutto", "pianta", "ombra", "giardino", "tree", "garden tree"],
  () => `${giorno(132)}${E(120, 146, 70, 10, "#14532d", 'opacity=".35"')}${P("M112 146c4-20 4-50 0-74h16c-4 24-4 54 0 74Z", "#78350f")}${L("M120 96l-22-20M122 88l20-18", "#78350f", 6)}${C(120, 56, 46, "url(#@foglia)")}${C(82, 78, 30, "url(#@foglia)")}${C(158, 78, 32, "url(#@foglia)")}${C(120, 88, 30, "url(#@foglia)")}${[
    [96, 50],
    [140, 40],
    [80, 84],
    [160, 86],
    [126, 76],
    [108, 98]
  ].map(([x, y]) => `${C(x, y, 5, RO)}${C(x - 1.5, y - 1.5, 1.5, "#fff", 'opacity=".7"')}`).join("")}`
);
disegno(
  "siepe",
  "esterno",
  "Siepe",
  "Hedge",
  ["recinzione verde", "bosso", "potatura", "cespugli", "hedge", "shrubs"],
  () => {
    const r = rng(21);
    let foglie = "";
    for (let i = 0; i < 70; i++)
      foglie += C(
        24 + r() * 192,
        62 + r() * 80,
        2 + r() * 2.5,
        r() > 0.5 ? "#86efac" : "#15803d",
        'opacity=".55"'
      );
    return `${giorno(142)}${P("M104 142h32l40 98H64Z", "#e7e5e4")}${R(20, 56, 200, 92, 14, def(lin("siepe", "v", "#4ade80", "#16a34a", "#14532d")))}${foglie}${R(20, 56, 200, 8, 6, "#bbf7d0", 'opacity=".5"')}${C(52, 44, 16, "url(#@foglia)")}${C(120, 40, 20, "url(#@foglia)")}${C(188, 44, 16, "url(#@foglia)")}${R(104, 140, 32, 6, 2, "#000", 'opacity=".15"')}${C(46, 156, 14, "url(#@foglia)")}${C(194, 156, 14, "url(#@foglia)")}`;
  }
);
disegno(
  "robot-tagliaerba",
  "esterno",
  "Robot tagliaerba",
  "Robot mower",
  ["tagliaerba", "rasaerba", "falciatrice", "robot", "robot mower", "lawn mower"],
  () => {
    let strisce = "";
    for (let i = -5; i < 6; i++)
      strisce += P(
        `M${120 + i * 14} 84L${120 + i * 70} 240H${120 + (i + 1) * 70}L${120 + (i + 1) * 14} 84Z`,
        i % 2 ? "#4ade80" : VE
      );
    return `${fondo("#7dd3fc", "#e0f2fe")}${sole(196, 30, 12)}${P("M0 86c30-16 70-16 100-6 30-12 90-14 140 2v8H0Z", "#166534")}${strisce}${ombra(124, 140, 74, 9)}${C(70, 124, 16, "#0b1220")}${C(70, 124, 7, "#475569")}${C(178, 124, 16, "#0b1220")}${C(178, 124, 7, "#475569")}${P("M54 124c0-24 22-44 66-46 46 0 70 20 70 42v8H54Z", "url(#@bianco)")}${P("M70 98c14-12 34-18 56-18 20 0 38 6 50 16", "none", 'stroke="#fff" stroke-width="5" opacity=".8" stroke-linecap="round"')}${R(54, 120, 136, 10, 5, "url(#@nero)")}${E(124, 94, 20, 7, VE)}${R(118, 90, 14, 4, 2, "#14532d")}${led(160, 104, VE, 1.4)}`;
  }
);
disegno(
  "ombrellone",
  "esterno",
  "Ombrellone",
  "Patio umbrella",
  ["ombrellone", "tavolo esterno", "terrazza", "patio", "parasol", "umbrella"],
  () => `${giorno(130)}${R(0, 136, 240, 104, 0, "#e7e5e4")}${E(120, 146, 64, 8, "#57534e", 'opacity=".35"')}${L("M120 44V140", "url(#@acciaioO)", 5)}${P("M30 74Q120 4 210 74Q195 66 180 74Q165 66 150 74Q135 66 120 74Q105 66 90 74Q75 66 60 74Q45 66 30 74Z", AC)}${P("M30 74Q60 30 120 22Q90 40 90 74Q75 66 60 74Q45 66 30 74Z", "#fff", 'opacity=".25"')}${P("M120 22Q150 40 150 74Q135 66 120 74Z", "#fff", 'opacity=".15"')}${E(120, 112, 42, 9, "url(#@bianco)")}${L("M92 116v26M148 116v26", "#94a3b8", 3)}${L("M58 104v38M50 104h22v18H50M182 104v38M190 104h-22v18h22", "#cbd5e1", 4)}${P("M110 102h20l-2 8h-16Z", RO)}`
);
disegno(
  "casetta-attrezzi",
  "esterno",
  "Casetta attrezzi",
  "Garden shed",
  ["capanno", "ripostiglio", "attrezzi", "deposito", "shed", "tool shed"],
  () => `${giorno(140)}${P("M40 76 120 34l80 42v72H40Z", "url(#@legnoC)")}${righe(40, 86, 200, 7, 9, "#78350f", 1.5, 0.35)}${P("M30 80 120 28l90 52-6 8-84-48-84 48Z", "#7c2d12")}${R(96, 90, 48, 58, 3, "url(#@legno)")}${L("M120 90v58", "#422006", 2)}${C(114, 120, 2.5, CA)}${C(126, 120, 2.5, CA)}${R(56, 92, 26, 22, 3, "url(#@vetro)")}${L("M69 92v22M56 103h26", "#f8fafc", 2.5)}${R(158, 92, 26, 22, 3, "url(#@vetro)")}${L("M171 92v22M158 103h26", "#f8fafc", 2.5)}${cespuglio(30, 140, 0.9)}${L("M206 148l12-44", "#a16207", 3)}${P("M212 100l12 6-4 6-12-6Z", "#94a3b8")}`
);
disegno(
  "laghetto",
  "esterno",
  "Laghetto",
  "Pond",
  ["stagno", "pesci", "ninfee", "pompa laghetto", "pond", "koi"],
  () => `${giorno(90)}${E(120, 128, 104, 40, "#78716c")}${E(120, 126, 96, 34, def(lin("lago", "v", "#0e7490", "#164e63")))}${E(100, 112, 50, 10, "#fff", 'opacity=".12"')}${E(78, 120, 14, 6, "#4ade80")}${P("M78 120l12-4-2 6Z", "#155e75")}${E(150, 138, 16, 6, "#22c55e")}${C(146, 134, 5, "#f9a8d4")}${C(146, 134, 2, CA)}${P("M110 136c10-8 22-6 28 0-6 6-18 8-28 0Zm28 0 8-5v10Z", AR)}${P("M96 122c8-6 16-4 20 0-4 4-12 6-20 0Zm20 0 6-4v8Z", "#fff")}${C(102, 121, 3, AR)}${sasso(26, 128, 16, 10)}${sasso(208, 122, 18, 11)}${sasso(190, 150, 14, 8)}${L("M40 108V72M46 110V80M34 110V84", "#15803d", 3)}${E(40, 72, 3, 8, "#78350f")}`
);
disegno(
  "altalena",
  "esterno",
  "Altalena",
  "Swing set",
  ["giochi", "bambini", "parco giochi", "scivolo", "swing", "playground"],
  () => `${giorno(132)}${L("M40 146 64 36 88 146M152 146l24-110 24 110", "url(#@legno)", 8)}${L("M56 36h128", "url(#@legno)", 10)}${L("M96 40v72M124 40v72", "#64748b", 2.5)}${R(90, 110, 40, 8, 3, RO)}${L("M146 40l16 64M168 40l-2 66", "#64748b", 2.5)}<g transform="rotate(-14 160 106)">${R(146, 102, 34, 8, 3, AC)}</g>${E(110, 146, 30, 5, "#14532d", 'opacity=".35"')}`
);
disegno(
  "amaca",
  "esterno",
  "Amaca",
  "Hammock",
  ["relax", "riposo", "giardino", "estate", "hammock"],
  () => `${fondo("#fdba74", "#fde68a", "#bae6fd")}${sole(120, 44, 16)}${R(0, 140, 240, 100, 0, "url(#@erba)")}${P("M30 150c2-40 0-80-4-110h14c-4 30-4 70-2 110Z", "#78350f")}${P("M200 150c-2-40 0-80 4-110h-14c4 30 4 70 2 110Z", "#78350f")}${C(32, 34, 30, "url(#@foglia)")}${C(200, 34, 30, "url(#@foglia)")}${C(12, 52, 18, "url(#@foglia)")}${C(224, 52, 18, "url(#@foglia)")}${L("M38 72 64 92M198 72l-26 20", "#e7e5e4", 2.5)}${P("M60 88q60 56 116 0l2 8q-60 52-120 0Z", def(lin("telo", "h", RO, "#fb923c", CA, "#4ade80", AC)))}${righe(80, 104, 158, 1, 0, "#fff", 2, 0.4)}`
);
var facciata = (m1 = "#e7d7c1", m2 = "#a18a6f", y = 152) => stanza(m1, m2, "#a8a29e", "#57534e", y);
var segnale = (x, y, s = 1, c = AC, op = 0.85) => L(
  `M${x - 10 * s} ${y - 8 * s}a14 14 0 0 1 ${20 * s} 0M${x - 18 * s} ${y - 16 * s}a26 26 0 0 1 ${36 * s} 0`,
  c,
  3.5,
  `opacity="${op}"`
);
var scudo = (x, y, s = 1, fill = VE) => P(
  `M${x} ${y - 18 * s}l${16 * s} ${6 * s}v${10 * s}c0 ${10 * s}-${7 * s} ${17 * s}-${16 * s} ${22 * s}c-${9 * s}-${5 * s}-${16 * s}-${12 * s}-${16 * s}-${22 * s}v-${10 * s}Z`,
  fill
);
var porta = (x, y, w, h, legno = "url(#@legno)") => `${R(x - 8, y - 8, w + 16, h + 8, 4, "#f8fafc")}${R(x, y, w, h, 2, legno)}${R(x + 8, y + 10, w - 16, h * 0.36, 3, "#000", 'opacity=".15"')}${R(x + 8, y + h * 0.52, w - 16, h * 0.4, 3, "#000", 'opacity=".15"')}${R(x + w - 14, y + h * 0.5, 10, 4, 2, "url(#@oro)")}${R(x + 2, y + 2, 4, h - 4, 2, "#fff", 'opacity=".2"')}`;
disegno(
  "cancello-scorrevole",
  "accessi",
  "Cancello scorrevole",
  "Sliding gate",
  ["cancello", "cancello automatico", "motore cancello", "sliding gate", "automatic gate"],
  () => `${fondo("#fca5a5", "#fdba74", "#fde68a")}${R(0, 0, 240, 132, 0, "#bae6fd", 'opacity=".25"')}${R(0, 132, 240, 108, 0, "#a8a29e")}${P("M0 132h240v6H0Z", "#78716c")}${R(16, 40, 20, 100, 3, "url(#@biancoO)")}${R(204, 40, 20, 100, 3, "url(#@biancoO)")}${R(36, 52, 168, 84, 2, SC, 'opacity=".9"')}${righe(40, 58, 200, 9, 9.5, "#475569", 5)}${righe(40, 56, 200, 9, 9.5, "#64748b", 1.5)}${R(36, 52, 168, 4, 2, "#94a3b8")}${R(40, 120, 30, 20, 4, "url(#@nero)")}${led(48, 126, CA, 1.6)}${L("M100 34h70M160 26l12 8-12 8", CA, 5)}${C(26, 34, 7, CA)}${C(26, 34, 14, CA, 'opacity=".35" filter="url(#@b3)"')}`
);
disegno(
  "porta-garage",
  "accessi",
  "Porta del garage",
  "Garage door",
  ["garage", "basculante", "sezionale", "box auto", "garage door", "overhead door"],
  () => `${facciata("#e2e8f0", "#94a3b8", 154)}${P("M0 30 120 0l120 30v4H0Z", "#7c2d12")}${R(26, 40, 188, 114, 4, "#cbd5e1")}${R(34, 48, 172, 106, 2, "#0b1220")}${auto(36, 104, 1, "url(#@rosso)")}${R(34, 48, 172, 58, 2, "url(#@bianco)")}${righe(34, 62, 206, 3, 14.5, "#94a3b8", 2)}${R(34, 104, 172, 4, 1, "#64748b")}${R(110, 96, 20, 4, 2, "#64748b")}${R(36, 50, 4, 52, 2, "#fff")}${led(220, 70, CA, 2)}`
);
disegno(
  "portone",
  "accessi",
  "Portone d'ingresso",
  "Front door",
  ["porta", "ingresso", "porta d'ingresso", "porta blindata", "front door", "entrance"],
  () => `${facciata()}${alone(120, 80, 100, CA, 0.25)}${porta(88, 40, 64, 112)}${R(70, 40, 10, 112, 2, "url(#@vetro)")}${R(160, 40, 10, 112, 2, "url(#@vetro)")}${R(60, 150, 120, 8, 2, "#d6d3d1")}${R(186, 54, 12, 20, 4, SC)}${alone(192, 66, 18, CA, 0.7)}${R(188, 60, 8, 10, 2, "#fef3c7")}${pianta(48, 152, 0.8)}${pianta(196, 152, 0.8)}`
);
disegno(
  "tapparella",
  "accessi",
  "Tapparella",
  "Roller shutter",
  ["avvolgibile", "serranda", "persiana", "tapparelle", "roller shutter", "shutter", "blind"],
  () => `${stanza("#f5f5f4", "#a8a29e", "#d6a86a", "#92400e", 160)}${R(40, 22, 160, 128, 4, "#f8fafc")}${R(48, 30, 144, 112, 2, def(lin("fuori", "v", "#38bdf8", "#bae6fd", "#bbf7d0")))}${C(170, 110, 10, "#fef9c3")}${R(48, 30, 144, 66, 0, def(lin("doghe", "v", "#e2e8f0", "#94a3b8")))}${righe(48, 37, 192, 9, 7.3, "#64748b", 1.5, 0.7)}${R(48, 92, 144, 6, 2, "#475569")}${L("M120 96v46M48 120h144", "#f8fafc", 4)}${R(36, 12, 168, 12, 3, "url(#@bianco)")}${R(204, 60, 8, 40, 3, "url(#@bianco)")}${L("M208 70v8M208 82v8", "#64748b", 3)}${R(36, 142, 168, 8, 2, "#e7e5e4")}`
);
disegno(
  "tenda",
  "accessi",
  "Tenda",
  "Curtains",
  ["tende", "tenda motorizzata", "drappeggio", "oscurante", "curtains", "drapes"],
  () => {
    const telo = (x, dir) => P(
      `M${x} 26h${dir * 52}c${dir * -6} 40 ${dir * -10} 80 ${dir * -18} 130H${x}Z`,
      def(lin("drappo", "h", "#c4b5fd", "#7c3aed", "#5b21b6"))
    );
    return `${stanza("#ede9fe", "#a78bfa", "#d6a86a", "#92400e", 160)}${R(52, 30, 136, 110, 3, def(lin("notte", "v", "#1e1b4b", "#4338ca", "#a5b4fc")))}${stelle(4, 10, 50)}${C(150, 56, 10, "#fef9c3")}${L("M120 30v110M52 84h136", "#f1f5f9", 4)}${telo(24, 1)}${telo(216, -1)}${colonne(36, 30, 150, 3, 12, "#4c1d95", 2, 0.4)}${colonne(180, 30, 150, 3, 12, "#4c1d95", 2, 0.4)}${R(14, 20, 212, 8, 4, "url(#@acciaio)")}${C(14, 24, 6, SC)}${C(226, 24, 6, SC)}`;
  }
);
disegno(
  "veneziana",
  "accessi",
  "Veneziana",
  "Venetian blind",
  ["veneziane", "lamelle", "frangisole", "venetian blinds", "slats"],
  () => {
    let lamelle = "";
    for (let i = 0; i < 12; i++)
      lamelle += `${P(`M44 ${32 + i * 10}h152l-2 6H46Z`, "url(#@bianco)")}`;
    let luce = "";
    for (let i = 0; i < 6; i++)
      luce += P(`M60 ${170 + i * 10}h150l20 5H80Z`, "#fef9c3", 'opacity=".35"');
    return `${stanza("#fef3c7", "#d6a86a", "#b7793c", "#5c3410", 160)}${R(40, 24, 160, 128, 3, "#f8fafc")}${R(44, 28, 152, 120, 2, def(lin("sole", "v", "#fde68a", "#fbbf24")))}${lamelle}${L("M80 26v124M160 26v124", "#cbd5e1", 1.2)}${R(36, 18, 168, 10, 3, "url(#@acciaio)")}${L("M190 28v70", "#94a3b8", 1.5)}${C(190, 100, 3, "#94a3b8")}${luce}`;
  }
);
disegno(
  "finestra",
  "accessi",
  "Finestra",
  "Window",
  ["finestre", "infisso", "anta", "apertura", "window", "sensore finestra"],
  () => `${stanza("#dbeafe", "#93c5fd", "#d6a86a", "#92400e", 160)}${R(44, 20, 152, 132, 4, "#f8fafc")}${R(52, 28, 136, 116, 2, def(lin("paesaggio", "v", "#38bdf8", "#bae6fd")))}${P("M52 110c30-18 60-18 90-8s30 4 46-4v46H52Z", "#4ade80")}${C(78, 100, 16, "url(#@foglia)")}${nuvola(130, 54, 0.7)}${P("M120 28 176 40v92l-56 12Z", "url(#@vetro)")}${L("M120 28 176 40v92l-56 12Z", "#f8fafc", 5)}${R(160, 82, 10, 4, 2, "url(#@acciaio)")}${L("M52 28h68v116H52Z", "#f8fafc", 5)}${R(36, 150, 168, 8, 2, "#e7e5e4")}${pianta(68, 150, 0.5)}`
);
disegno(
  "lucernario",
  "accessi",
  "Lucernario",
  "Skylight",
  ["finestra da tetto", "mansarda", "abbaino", "skylight", "roof window"],
  () => `${fondo("#e7e5e4", "#a8a29e")}${P("M0 0h240v60L0 150Z", "#d6d3d1")}${P("M62 30 178 8l18 92-108 34Z", "#f8fafc")}${P("M74 38 172 20l14 74-92 28Z", def(lin("cielo", "d", "#1e1b4b", "#3730a3", "#6366f1")))}<g clip-path="${def('<clipPath id="@vano"><path d="M74 38 172 20l14 74-92 28Z"/></clipPath>')}">${stelle(23, 40, 130)}</g>${C(150, 42, 7, "#fef9c3")}${P("M76 40 120 32 88 104Z", "#fff", 'opacity=".1"')}${R(108, 112, 30, 8, 3, "url(#@acciaio)", 'transform="rotate(-17 123 116)"')}${led(178, 120, AC, 1.6)}`
);
disegno(
  "serratura",
  "accessi",
  "Serratura smart",
  "Smart lock",
  ["serratura", "chiave", "lucchetto", "porta", "smart lock", "lock", "door lock"],
  () => `${fondo("#92400e", "#451a03")}${R(0, 0, 240, 240, 0, "url(#@legno)", 'opacity=".6"')}${colonne(30, 0, 240, 5, 48, "#000", 1.5, 0.15)}${ombra(124, 92, 46, 70, 0.4)}${R(84, 22, 72, 138, 18, "url(#@nero)")}${R(88, 26, 4, 126, 2, "#fff", 'opacity=".2"')}${C(120, 62, 22, "#020617")}${C(120, 62, 22, "none", `stroke="${VE}" stroke-width="3"`)}${C(120, 62, 22, "none", `stroke="${VE}" stroke-width="7" opacity=".35" filter="url(#@b3)"`)}${P("M110 64v-6a10 10 0 0 1 20 0v6", "none", `stroke="${FR}" stroke-width="4"`)}${R(106, 62, 28, 18, 4, FR)}${C(120, 70, 3, SC)}${punti(102, 104, 3, 3, 18, 14, 4, "#475569")}${R(30, 98, 50, 10, 5, "url(#@acciaio)")}`
);
disegno(
  "citofono",
  "accessi",
  "Citofono",
  "Intercom",
  ["campanelli", "pulsantiera", "portiere", "intercom", "door entry", "buzzer"],
  () => `${fondo("#a8a29e", "#57534e")}${R(0, 0, 240, 240, 0, "url(#@legnoC)", 'opacity=".1"')}${ombra(124, 92, 56, 72, 0.35)}${R(74, 16, 92, 144, 10, "url(#@acciaio)")}${R(78, 20, 4, 132, 2, "#fff", 'opacity=".6"')}${punti(100, 36, 6, 3, 8, 7, 2, "#334155")}${[0, 1, 2, 3].map((i) => `${R(88, 64 + i * 20, 46, 14, 3, "#f8fafc")}${R(92, 69 + i * 20, 30, 4, 2, "#cbd5e1")}${C(146, 71 + i * 20, 6, i === 1 ? AC : "#475569")}`).join("")}${led(146, 91, AC, 2.6)}${R(96, 146, 48, 6, 3, "#334155")}`,
  [50, 20]
);
disegno(
  "videocitofono",
  "accessi",
  "Videocitofono",
  "Video intercom",
  ["monitor citofono", "video", "chi e alla porta", "video intercom", "door phone"],
  () => `${stanza("#e2e8f0", "#94a3b8", "#d6a86a", "#92400e", 164)}${ombra(124, 92, 80, 54, 0.3)}${R(30, 40, 180, 106, 12, "url(#@nero)")}${R(30, 40, 180, 4, 2, "#fff", 'opacity=".25"')}${R(40, 50, 128, 86, 5, def(lin("vc", "v", "#94a3b8", "#475569")))}${R(80, 62, 48, 74, 2, "#7c2d12")}${R(84, 66, 40, 70, 2, "url(#@legno)")}${C(118, 102, 2.5, CA)}${R(40, 126, 128, 10, 0, "#57534e")}${C(60, 72, 6, "#fef3c7")}${alone(60, 72, 16, CA, 0.6)}${P("M42 52h50L42 100Z", "#fff", 'opacity=".12"')}${C(190, 64, 9, VE)}${C(190, 92, 9, "#475569")}${C(190, 120, 9, RO)}${L("M186 120h8", "#fff", 2.5)}`
);
disegno(
  "telecamera",
  "accessi",
  "Telecamera",
  "Camera",
  ["videocamera", "videosorveglianza", "cctv", "ip cam", "security camera", "camera"],
  () => `${facciata("#cbd5e1", "#64748b", 170)}${P("M150 92 236 150V60Z", def(lin("vista", "h", "#8be2ff/.4", "#8be2ff/0")))}${R(30, 34, 22, 40, 4, "url(#@biancoO)")}${L("M50 54 80 72", "url(#@acciaio)", 8)}<g transform="rotate(18 120 80)">${R(70, 56, 100, 46, 18, "url(#@bianco)")}${R(64, 50, 112, 14, 6, "url(#@biancoO)")}${C(166, 79, 20, "#0b1220")}${C(166, 79, 13, "url(#@lente)")}${C(161, 74, 4, "#fff", 'opacity=".8"')}${R(76, 66, 50, 4, 2, "#fff")}</g>${led(96, 104, RO, 2)}`
);
disegno(
  "sirena",
  "accessi",
  "Sirena",
  "Siren",
  ["sirena allarme", "lampeggiante", "allarme esterno", "siren", "alarm siren", "strobe"],
  () => `${facciata("#e7d7c1", "#a18a6f", 170)}${alone(120, 70, 110, RO, 0.45)}${L("M50 40l-16-10M44 70H24M50 100l-16 10M190 40l16-10M196 70h20M190 100l16 10", RO, 5, 'opacity=".8"')}${ombra(124, 84, 60, 66, 0.35)}${P("M76 24h88l10 104a10 10 0 0 1-10 10H76a10 10 0 0 1-10-10Z", "url(#@bianco)")}${P("M84 32h72l4 30H80Z", "url(#@rosso)")}${P("M84 32h72l4 30H80Z", RO, 'filter="url(#@b5)" opacity=".6"')}${P("M88 36h26l-6 22H86Z", "#fff", 'opacity=".35"')}${punti(92, 84, 6, 4, 11, 10, 2.2, "#94a3b8")}${R(72, 28, 4, 104, 2, "#fff")}`
);
disegno(
  "sensore-porta",
  "accessi",
  "Sensore porta",
  "Door sensor",
  [
    "contatto magnetico",
    "sensore apertura",
    "sensore finestra",
    "contact sensor",
    "door sensor",
    "open close"
  ],
  () => `${stanza("#e2e8f0", "#94a3b8", "#57534e", "#292524", 164)}${R(0, 0, 112, 164, 0, "#f1f5f9")}${R(104, 0, 16, 164, 0, "url(#@biancoO)")}${R(120, 0, 120, 164, 0, "#1c1917")}${alone(150, 90, 70, CA, 0.35)}${P("M136 0h104v164H148Z", "url(#@legnoC)")}${P("M136 0h8l4 164h-8Z", "#78350f")}${R(184, 84, 20, 8, 4, "url(#@oro)")}${ombra(100, 92, 16, 40, 0.3)}${R(84, 52, 22, 78, 8, "url(#@bianco)")}${R(87, 56, 4, 68, 2, "#fff")}${led(95, 66, RO, 2)}${ombra(156, 92, 12, 34, 0.3)}${R(148, 62, 16, 58, 6, "url(#@bianco)")}${L("M112 82l12 9-12 9M140 82l-12 9 12 9", AC, 3)}${segnale(60, 52, 1.3, AC)}${C(60, 52, 5, AC)}`
);
disegno(
  "allarme",
  "accessi",
  "Allarme",
  "Alarm",
  ["antifurto", "centrale allarme", "tastiera", "inserito", "alarm", "security system", "keypad"],
  () => {
    let tasti = "";
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 3; c++) tasti += R(84 + c * 26, 74 + r * 18, 20, 13, 4, "#334155");
    return `${fondo("#cbd5e1", "#64748b")}${ombra(124, 94, 66, 70, 0.35)}${R(62, 18, 116, 142, 14, "url(#@nero)")}${R(66, 22, 4, 130, 2, "#fff", 'opacity=".2"')}${R(76, 30, 88, 34, 6, "#020617")}${scudo(102, 50, 0.8, VE)}${P("M95 48l5 5 9-10", "none", `stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`)}${R(120, 40, 36, 6, 3, VE, 'opacity=".8"')}${R(120, 50, 24, 4, 2, "#475569")}${tasti}${led(88, 150, VE, 1.6)}${led(100, 150, CA, 1.6)}`;
  }
);
disegno(
  "sensore-movimento",
  "accessi",
  "Sensore di movimento",
  "Motion sensor",
  ["pir", "rilevatore", "presenza", "movimento", "motion sensor", "occupancy"],
  () => {
    let raggi = "";
    for (let a = 20; a <= 80; a += 12)
      raggi += `M180 30L${n(180 - Math.cos(a * Math.PI / 180) * 220)} ${n(30 + Math.sin(a * Math.PI / 180) * 220)}`;
    return `${stanza("#e0e7ff", "#818cf8", "#cbd5e1", "#64748b", 160)}${P("M180 30 0 54V200L120 240Z", def(lin("zona", "h", "#fef9c3/.0", "#fef9c3/.45")))}${L(raggi, "#fff", 1.5, 'opacity=".55" stroke-dasharray="3 6"')}${R(200, 0, 40, 240, 0, "#000", 'opacity=".08"')}${ombra(184, 38, 26, 24, 0.35)}${P("M164 14h40v24a20 20 0 0 1-40 0Z", "url(#@bianco)")}${C(184, 38, 14, def(rad("pir", 0.4, 0.35, 0.7, "#f8fafc", "#cbd5e1", "#94a3b8")))}${L("M174 36a10 10 0 0 1 20 0", "#94a3b8", 1.5)}${led(184, 22, RO, 1.4)}${C(70, 120, 10, "none", `stroke="${AC}" stroke-width="3"`)}${C(70, 120, 20, "none", `stroke="${AC}" stroke-width="3" opacity=".5"`)}${C(70, 120, 4, AC)}`;
  }
);
disegno(
  "campanello",
  "accessi",
  "Campanello",
  "Doorbell",
  ["videocampanello", "suonare", "dlin dlon", "doorbell", "video doorbell"],
  () => `${facciata()}${R(0, 0, 70, 240, 0, "url(#@legno)")}${R(64, 0, 10, 240, 0, "#f8fafc")}${ombra(130, 90, 34, 66, 0.35)}${R(104, 24, 52, 128, 26, "url(#@nero)")}${R(108, 30, 4, 112, 2, "#fff", 'opacity=".2"')}${C(130, 54, 13, "#020617")}${C(130, 54, 8, "url(#@lente)")}${C(127, 51, 2.5, "#fff", 'opacity=".8"')}${C(130, 114, 18, "#1e293b")}${C(130, 114, 18, "none", `stroke="${AC}" stroke-width="4"`)}${C(130, 114, 18, "none", `stroke="${AC}" stroke-width="9" opacity=".4" filter="url(#@b3)"`)}${C(130, 114, 11, "#334155")}${L("M176 92q10 22 0 44M190 82q16 32 0 64", AC, 4, 'opacity=".7"')}`
);
disegno(
  "cassetta-posta",
  "accessi",
  "Cassetta della posta",
  "Mailbox",
  ["posta", "lettere", "pacchi", "buca delle lettere", "mailbox", "letterbox", "mail"],
  () => `${giorno(140)}${R(112, 92, 16, 64, 3, "url(#@legno)")}${ombra(120, 150, 40, 5)}${P("M66 62a26 26 0 0 1 26-26h70v58H66Z", "url(#@rosso)")}${P("M92 36a26 26 0 0 1 26 26v32H66V62a26 26 0 0 1 26-26Z", "#be123c")}${P("M92 40a22 22 0 0 1 22 22", "none", 'stroke="#fff" stroke-width="3" opacity=".35"')}${P("M88 40h52l-8 32H86Z", "#f8fafc", 'transform="rotate(-8 112 56)"')}${L("M96 50l18 10 22-12", "#cbd5e1", 2.5)}${L("M162 50V18", "#334155", 4)}${P("M162 18h22v14h-22Z", CA)}${C(140, 78, 3, "url(#@oro)")}`
);
disegno(
  "rilevatore-fumo",
  "accessi",
  "Rilevatore di fumo",
  "Smoke detector",
  ["fumo", "incendio", "antincendio", "allarme fumo", "smoke alarm", "smoke detector", "fire"],
  () => `${fondo("#f1f5f9", "#94a3b8")}${R(0, 0, 240, 22, 0, "#fff")}${P("M40 140c-10-20 10-30 0-50s10-30 0-50M200 140c-10-20 10-30 0-50", "none", 'stroke="#64748b" stroke-width="10" opacity=".25" filter="url(#@b5)" stroke-linecap="round"')}${P("M70 150c20-14 40-4 60-14s40 0 60-10", "none", 'stroke="#475569" stroke-width="14" opacity=".2" filter="url(#@b8)" stroke-linecap="round"')}${ombra(120, 70, 78, 18, 0.3)}${P("M44 22h152v24a76 34 0 0 1-152 0Z", "url(#@biancoO)")}${E(120, 46, 70, 26, "url(#@bianco)")}${E(120, 46, 40, 14, "#e2e8f0")}${punti(94, 46, 7, 1, 8.6, 0, 1.8, "#94a3b8")}${led(120, 66, RO, 2.4)}${alone(120, 66, 24, RO, 0.4)}`,
  [50, 20]
);
disegno(
  "sensore-allagamento",
  "accessi",
  "Sensore allagamento",
  "Leak sensor",
  ["perdita acqua", "allagamento", "acqua", "infiltrazione", "leak sensor", "water leak", "flood"],
  () => `${cucina(240, "#bae6fd", "#64748b")}${R(0, 100, 240, 140, 0, def(lin("pav", "v", "#e2e8f0", "#94a3b8")))}${L("M0 130H240M60 100 30 240M120 100V240M180 100l30 140", "#64748b", 1.5, 'opacity=".4"')}${E(120, 132, 96, 22, def(lin("pozza", "h", "#7dd3fc/.75", "#38bdf8/.9", "#7dd3fc/.75")))}${E(100, 126, 40, 6, "#fff", 'opacity=".35"')}${ombra(120, 128, 40, 7)}${E(120, 120, 36, 12, "url(#@bianco)")}${P("M84 120v-12a36 12 0 0 1 72 0v12a36 12 0 0 1-72 0Z", "url(#@biancoO)")}${E(120, 108, 36, 12, "#f8fafc")}${C(120, 108, 6, AC)}${goccia(120, 34, 10, AC)}${goccia(84, 54, 6, AC, 'opacity=".8"')}${goccia(156, 50, 7, AC, 'opacity=".8"')}${L("M70 80q-8 14 0 28M170 80q8 14 0 28", RO, 4, 'opacity=".8"')}`
);
disegno(
  "cassaforte",
  "accessi",
  "Cassaforte",
  "Safe",
  ["forziere", "valori", "blindata", "safe", "vault", "strongbox"],
  () => `${stanza("#334155", "#0f172a", "#57534e", "#1c1917", 156)}${ombra(120, 156, 66, 5)}${R(50, 26, 140, 130, 10, "url(#@acciaio)")}${R(60, 36, 120, 110, 6, "url(#@acciaioO)")}${R(60, 36, 120, 4, 2, "#fff", 'opacity=".7"')}${C(108, 90, 26, "#334155")}${C(108, 90, 22, "url(#@bianco)")}${Array.from(
    { length: 12 },
    (_, i) => {
      const a = i * Math.PI / 6;
      return `M${n(108 + Math.cos(a) * 16)} ${n(90 + Math.sin(a) * 16)}L${n(108 + Math.cos(a) * 20)} ${n(90 + Math.sin(a) * 20)}`;
    }
  ).join("").replace(/^/, '<path d="').concat(
    `" stroke="${SC}" stroke-width="2"/>`
  )}${C(108, 90, 8, SC)}${L("M156 74v32", SC, 7)}${C(156, 74, 6, SC)}${C(156, 106, 6, SC)}${R(184, 52, 6, 16, 2, "#475569")}${R(184, 112, 6, 16, 2, "#475569")}${led(168, 46, VE, 1.4)}`
);
var quadro = (x, y, w, h, c1 = "#fb923c", c2 = "#6366f1") => `${R(x - 4, y - 4, w + 8, h + 8, 2, "url(#@legno)")}${R(x, y, w, h, 1, def(lin(`q${sigla(c1 + c2)}`, "d", c1, c2)))}${P(`M${x} ${y + h}l${w * 0.35}-${h * 0.45} ${w * 0.25} ${h * 0.25} ${w * 0.2}-${h * 0.15} ${w * 0.2} ${h * 0.35}Z`, "#0f2942", 'opacity=".4"')}`;
var tappeto = (cx, cy, rx, ry, c = "#e2e8f0") => E(cx, cy, rx, ry, c, 'opacity=".55"');
var libri = (x, y, quanti = 6) => {
  const col = [AC, RO, CA, VE, "#a855f7", AR, FR];
  let s = "";
  for (let i = 0; i < quanti; i++)
    s += R(x + i * 9, y - 22 - i % 3 * 3, 7, 22 + i % 3 * 3, 1.5, col[i % col.length]);
  return s;
};
var tavolino = (x, y, w) => `${R(x, y, w, 7, 3, "url(#@legno)")}${L(`M${x + 6} ${y + 7}v16M${x + w - 6} ${y + 7}v16`, "#422006", 4)}`;
disegno(
  "camera-letto",
  "stanze",
  "Camera da letto",
  "Bedroom",
  ["camera", "letto", "matrimoniale", "notte", "bedroom", "bed"],
  () => `${stanza("#c4b5fd", "#6d28d9", "#d6a86a", "#7c4a1e", 150)}${quadro(96, 22, 48, 30)}${R(20, 92, 30, 44, 4, "url(#@legno)")}${R(190, 92, 30, 44, 4, "url(#@legno)")}${alone(35, 72, 28, CA, 0.6)}${P("M26 82h18l-4-16H30Z", "url(#@accesa)")}${L("M35 82v10", "#422006", 3)}${alone(205, 72, 28, CA, 0.6)}${P("M196 82h18l-4-16h-10Z", "url(#@accesa)")}${L("M205 82v10", "#422006", 3)}${letto(56, 104, 128, "#7c3aed")}${tappeto(120, 168, 90, 10)}`
);
disegno(
  "soggiorno",
  "stanze",
  "Soggiorno",
  "Living room",
  ["salotto", "sala", "divano", "living", "lounge"],
  () => `${stanza("#fde68a", "#b45309", "#b7793c", "#5c3410", 150)}${quadro(74, 24, 92, 46, "#38bdf8", "#22c55e")}${divano(54, 90, 132, AC, "#0369a1")}${pianta(30, 150, 1)}${alone(212, 56, 34, CA, 0.5)}${L("M212 150V64", SC, 4)}${P("M200 64h24l-4-18h-16Z", "url(#@accesa)")}${tappeto(120, 160, 96, 10, "#fff")}${tavolino(92, 142, 56)}`
);
disegno(
  "bagno",
  "stanze",
  "Bagno",
  "Bathroom",
  ["vasca", "doccia", "lavandino", "servizi", "bathroom", "bath"],
  () => `${cucina(240, "#a5f3fc", "#0e7490")}${R(0, 150, 240, 90, 0, "#e2e8f0")}${R(56, 18, 64, 52, 26, "#e0f2fe", `stroke="#cbd5e1" stroke-width="4"`)}${P("M64 30h20L64 56Z", "#fff", 'opacity=".6"')}${R(62, 78, 52, 10, 4, "url(#@bianco)")}${R(82, 70, 4, 10, 2, "url(#@acciaio)")}${L("M86 72h8", "url(#@acciaio)", 3)}${R(70, 88, 36, 56, 4, "url(#@legnoC)")}${L("M174 30V60q0 6 6 6h12", "url(#@acciaio)", 4)}${C(174, 28, 9, "url(#@acciaio)")}${punti(170, 42, 3, 4, 4, 5, 0.9, VT)}${P("M126 106h104v14c0 18-14 30-32 30h-40c-18 0-32-12-32-30Z", "url(#@bianco)")}${R(122, 100, 112, 10, 5, "#f8fafc")}${C(150, 98, 6, "#fff")}${C(162, 96, 4, "#fff")}${C(140, 96, 3.5, "#fff")}${R(26, 40, 14, 60, 4, def(lin("telo", "v", "#fda4af", "#e11d48")))}`
);
disegno(
  "studio",
  "stanze",
  "Studio",
  "Study",
  ["ufficio", "scrivania", "lavoro", "home office", "office", "study"],
  () => `${stanza("#99f6e4", "#0f766e", "#b7793c", "#5c3410", 152)}${R(170, 20, 60, 130, 4, "url(#@legno)")}${righe(170, 50, 230, 3, 32, "#422006", 4)}${libri(176, 48, 6)}${libri(176, 80, 5)}${libri(178, 112, 5)}${R(40, 30, 104, 64, 6, SC)}${schermo(45, 35, 94, 52)}${R(86, 94, 12, 14, 2, "url(#@acciaio)")}${R(72, 106, 40, 4, 2, "url(#@acciaio)")}${R(20, 110, 148, 8, 3, "url(#@legnoC)")}${L("M28 118v34M160 118v34", "#422006", 4)}${R(60, 112, 50, 4, 2, "#334155")}${C(130, 106, 6, FR)}${R(126, 104, 8, 6, 2, "#78350f", 'opacity=".5"')}`
);
disegno(
  "cameretta",
  "stanze",
  "Cameretta",
  "Kids' room",
  ["camera bambini", "bimbi", "giochi", "nursery", "kids room", "children"],
  () => {
    const col = [RO, CA, AC, VE, "#a855f7", AR, "#f472b6"];
    let bandierine = "";
    for (let i = 0; i < 9; i++)
      bandierine += P(
        `M${30 + i * 22} ${22 + 6 * Math.sin(i / 8 * Math.PI)}h16l-8 14Z`,
        col[i % col.length]
      );
    return `${stanza("#bae6fd", "#38bdf8", "#fde68a", "#d97706", 150)}${L("M20 20q100 24 200 0", "#64748b", 1.5)}${bandierine}${R(30, 60, 54, 48, 4, "url(#@vetro)", `stroke="#fff" stroke-width="4"`)}${C(68, 74, 6, "#fef9c3")}${letto(100, 108, 110, "#f472b6")}${C(132, 92, 10, "#b45309")}${C(124, 84, 4.5, "#b45309")}${C(140, 84, 4.5, "#b45309")}${C(132, 94, 5, "#fde68a")}${R(30, 128, 18, 18, 3, RO)}${R(50, 128, 18, 18, 3, AC)}${R(40, 110, 18, 18, 3, CA)}`;
  }
);
disegno(
  "cantina",
  "stanze",
  "Cantina",
  "Cellar",
  ["taverna", "vini", "botti", "seminterrato", "cellar", "basement", "wine cellar"],
  () => {
    let pietre = "";
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 7; c++)
        pietre += `M${c * 36 + r % 2 * 18 - 10} ${r * 20 + 2}h32v16h-32Z`;
    const botte = (x, y, s) => `${E(x, y, 30 * s, 34 * s, "url(#@legno)")}${E(x, y, 20 * s, 24 * s, "#a16207")}${E(x, y, 20 * s, 24 * s, "none", `stroke="#422006" stroke-width="2"`)}${L(`M${x - 28 * s} ${y - 12 * s}v24M${x + 28 * s} ${y - 12 * s}v24`, "#334155", 4)}${C(x, y + 14 * s, 3 * s, "#422006")}`;
    return `${fondo("#57534e", "#1c1917")}${P(pietre, "#a8a29e", 'opacity=".18"')}${alone(120, 40, 100, CA, 0.4)}${L("M120 0v24", "#292524", 2)}${C(120, 30, 7, "#fef3c7")}${P("M40 150V80a80 70 0 0 1 160 0v70", "none", 'stroke="#78716c" stroke-width="10"')}${botte(80, 118, 1)}${botte(160, 118, 1)}${botte(120, 76, 0.8)}${R(0, 150, 240, 90, 0, "#292524")}`;
  }
);
disegno(
  "mansarda",
  "stanze",
  "Mansarda",
  "Attic",
  ["sottotetto", "soffitta", "tetto", "travi", "attic", "loft"],
  () => `${fondo("#fef3c7", "#d6a86a")}${P("M0 0h96L0 96Z", "#78350f", 'opacity=".9"')}${P("M240 0h-96l96 96Z", "#78350f", 'opacity=".9"')}${L("M0 30 30 0M0 66 66 0M240 30 210 0M240 66 174 0", "#422006", 6)}${P("M0 96 96 0h48l96 96v60H0Z", "#fffbeb", 'opacity=".5"')}${P("M100 12h40l4 34h-48Z", def(lin("cielo", "v", "#38bdf8", "#bae6fd")))}${L("M100 12h40l4 34h-48ZM120 12v34", "#f8fafc", 3)}${P("M100 46h44l30 110H70Z", "#fef9c3", 'opacity=".35" filter="url(#@b3)"')}${R(0, 150, 240, 90, 0, "url(#@legnoC)")}${letto(58, 118, 124, VE)}${pianta(212, 150, 0.6)}`
);
disegno(
  "stanza-cucina",
  "stanze",
  "Cucina",
  "Kitchen",
  ["cucina abitabile", "angolo cottura", "pensili", "kitchen", "cook"],
  () => `${cucina(118, "#fef3c7", "#d6a86a", "legnoC")}${R(20, 10, 200, 40, 3, "url(#@bianco)")}${L("M86 10v40M154 10v40", "#94a3b8", 1.5)}${R(46, 40, 16, 3, 1.5, "#64748b")}${R(112, 40, 16, 3, 1.5, "#64748b")}${R(178, 40, 16, 3, 1.5, "#64748b")}${R(20, 50, 200, 4, 0, "#fef3c7", 'filter="url(#@b2)"')}${R(20, 126, 200, 114, 0, "url(#@bianco)")}${L("M86 126v40M154 126v40", "#94a3b8", 1.5)}${R(46, 132, 16, 3, 1.5, "#64748b")}${R(178, 132, 16, 3, 1.5, "#64748b")}${E(60, 116, 18, 3, "#0b1220")}${P("M48 114V96h28v18Z", "url(#@acciaioO)")}${vapore(56, 88, 0.7, 0.5)}${L("M156 116V88q0-10 10-10h10", "url(#@acciaio)", 4)}${R(140, 114, 50, 4, 2, "#94a3b8")}${pianta(206, 118, 0.55)}${R(98, 92, 26, 22, 3, "#e11d48")}${L("M111 92v-6", "#e11d48", 3)}`
);
disegno(
  "ingresso",
  "stanze",
  "Ingresso",
  "Entryway",
  ["corridoio", "entrata", "atrio", "hall", "entryway", "hallway"],
  () => `${stanza("#e7e5e4", "#a8a29e", "#57534e", "#292524", 152)}${porta(146, 36, 58, 116)}${R(30, 26, 52, 64, 26, "#e0f2fe", `stroke="url(#@oro)" stroke-width="5"`)}${P("M38 44h20L38 70Z", "#fff", 'opacity=".6"')}${R(20, 100, 72, 8, 3, "url(#@legno)")}${L("M28 108v42M84 108v42", "#422006", 4)}${E(56, 96, 14, 4, "#0ea5e9")}${L("M116 30v120", "url(#@acciaioO)", 4)}${L("M108 40h16M106 46h20", "url(#@acciaio)", 3)}${P("M104 48h12l4 40h-18Z", RO)}${P("M118 48h8l2 30h-12Z", CA)}${tappeto(150, 162, 60, 8, "#94a3b8")}`
);
disegno(
  "garage",
  "stanze",
  "Garage",
  "Garage",
  ["box", "autorimessa", "rimessa", "parcheggio", "garage", "carport"],
  () => `${garage()}${R(10, 14, 60, 120, 2, "url(#@legno)", 'opacity=".5"')}${righe(10, 50, 70, 2, 40, "#422006", 4)}${R(16, 32, 14, 18, 2, RO)}${R(34, 36, 22, 14, 2, AC)}${R(18, 72, 30, 18, 2, "#64748b")}${L("M200 20v40M210 20v30M220 20v36", "#475569", 3)}${L("M196 20h30", "#334155", 4)}${auto(40, 82, 1.1, "url(#@blu)")}${alone(120, 20, 70, "#fff", 0.3)}${R(80, 8, 80, 6, 3, "#f8fafc")}`
);
disegno(
  "terrazzo",
  "stanze",
  "Terrazzo",
  "Terrace",
  ["balcone", "terrazza", "veranda", "loggia", "terrace", "balcony"],
  () => `${fondo("#fb923c", "#fde68a", "#bae6fd")}${sole(120, 92, 18)}${P("M0 104h20V80h16v24h14V66h22v38h18V88h14v16h22V74h18v30h20V84h14v20h22V92h20v12h20v20H0Z", "#7c2d12", 'opacity=".55"')}${R(0, 124, 240, 116, 0, "#d6d3d1")}${L("M0 92H240", "url(#@acciaio)", 5)}${colonne(8, 92, 132, 16, 15.5, "#cbd5e1", 2.5)}${pianta(30, 140, 0.9)}${pianta(210, 140, 0.9)}${L("M96 138v-30h28v30M96 116h28", "#f8fafc", 4)}${L("M150 138l6-24h22l6 24", "#f8fafc", 4)}${R(150, 110, 34, 6, 3, "#f8fafc")}`
);
disegno(
  "buonanotte",
  "stanze",
  "Buonanotte",
  "Good night",
  ["notte", "dormire", "nanna", "spegni tutto", "good night", "sleep", "bedtime"],
  () => `${fondo("#1e1b4b", "#0b1023")}${stelle(31, 50, 160)}${alone(152, 66, 110, "#a5b4fc", 0.3)}${P("M162 24a46 46 0 1 0 22 78 40 40 0 0 1-22-78Z", "url(#@oro)")}${P("M162 24a46 46 0 1 0 22 78 40 40 0 0 1-22-78Z", "#fef9c3", 'opacity=".5"')}${L("M70 50h14l-14 16h14M48 74h10l-10 12h10M86 84h8l-8 10h8", "#c7d2fe", 3.5)}${P("M20 160c0-28 30-44 60-44h80c30 0 60 16 60 44Z", "#312e81")}${R(48, 116, 44, 20, 9, "#e0e7ff", 'opacity=".9"')}${P("M20 160c30-20 70-26 120-26s70 6 80 26Z", "#4338ca")}`
);
disegno(
  "cinema",
  "stanze",
  "Serata cinema",
  "Movie night",
  ["film", "cinema", "home cinema", "popcorn", "movie", "movie night"],
  () => `${fondo("#0b1023", "#020617")}${R(26, 18, 188, 96, 4, "#38bdf8", 'opacity=".3" filter="url(#@b8)"')}${R(28, 20, 184, 92, 3, "url(#@schermo)")}${P("M28 92c34-14 58-8 84-20s50-8 100-2v42H28Z", SC, 'opacity=".45"')}${C(170, 46, 10, CA)}${P("M28 120h184l28 120H0Z", "#6366f1", 'opacity=".15" filter="url(#@b8)"')}${P("M24 150c0-14 10-24 24-24h144c14 0 24 10 24 24v20H24Z", "#1e1b4b")}${C(86, 120, 16, "#0b1023")}${C(150, 118, 16, "#0b1023")}${R(70, 130, 32, 30, 12, "#0b1023")}${R(134, 128, 32, 30, 12, "#0b1023")}${P("M180 116h26l-4 34h-18Z", "#e11d48")}${L("M186 116v34M194 116v34", "#fff", 3)}${C(184, 112, 6, "#fef3c7")}${C(194, 110, 6, "#fef3c7")}${C(202, 114, 5, "#fef3c7")}`
);
disegno(
  "cena",
  "stanze",
  "Cena",
  "Dinner",
  ["pranzo", "tavola", "sala da pranzo", "ospiti", "dinner", "dining"],
  () => `${stanza("#7c2d12", "#2a1006", "#3f2a1d", "#1c1412", 156)}${alone(120, 70, 120, CA, 0.45)}${L("M120 0v34", "#1c1917", 2)}${P("M96 50a24 18 0 0 1 48 0Z", "url(#@oro)")}${E(120, 50, 24, 4, "#fef3c7")}${P("M110 54h20l30 64H80Z", "#fef3c7", 'opacity=".15" filter="url(#@b3)"')}${E(120, 126, 108, 22, "#f8fafc")}${E(120, 122, 104, 18, "#fff")}${E(76, 122, 18, 6, "#e2e8f0")}${E(76, 121, 11, 3.5, AR)}${E(164, 122, 18, 6, "#e2e8f0")}${E(164, 121, 11, 3.5, VE)}${[100, 140].map((x) => `${R(x - 4, 96, 8, 22, 2, "#fef3c7")}${alone(x, 88, 14, CA, 0.8)}${fiamma(x, 96, 6, 12)}`).join("")}${P("M114 104h12l-1 10a5 5 0 0 1-10 0Z", "#7f1d1d", 'opacity=".9"')}${L("M120 118v-4", "#e2e8f0", 2)}${R(16, 134, 18, 30, 4, "url(#@legno)")}${R(206, 134, 18, 30, 4, "url(#@legno)")}`
);
disegno(
  "festa",
  "stanze",
  "Festa",
  "Party",
  ["party", "compleanno", "musica", "palloncini", "celebrazione", "birthday", "celebration"],
  () => {
    const r = rng(77);
    const col = [RO, CA, AC, VE, "#a855f7", AR, "#f472b6"];
    let coriandoli = "";
    for (let i = 0; i < 40; i++)
      coriandoli += R(
        r() * 240,
        r() * 150,
        4,
        7,
        1,
        col[i % col.length],
        `transform="rotate(${Math.round(r() * 180)} ${n(r() * 240)} ${n(r() * 150)})" opacity=".85"`
      );
    const pallone = (x, y, c) => `${L(`M${x} ${y + 26}q-6 20 4 40`, "#e2e8f0", 1.5)}${E(x, y, 20, 25, c)}${E(x - 7, y - 9, 5, 8, "#fff", 'opacity=".45"')}${P(`M${x - 3} ${y + 25}h6l-3 4Z`, c)}`;
    return `${fondo("#581c87", "#1e1b4b", "#0b1023")}${alone(120, 50, 100, "#f472b6", 0.35)}${L("M80 70 20 150M120 70v90M160 70l60 80", "#fff", 10, 'opacity=".12" filter="url(#@b3)"')}${coriandoli}${L("M120 0v20", "#94a3b8", 2)}${C(120, 44, 24, def(rad("disco", 0.35, 0.3, 0.8, "#f8fafc", "#94a3b8", "#334155")))}${L("M98 36h44M97 46h46M100 56h40M112 22v44M128 22v44", "#475569", 1.5, 'opacity=".6"')}${C(112, 36, 4, "#fff")}${pallone(52, 70, RO)}${pallone(188, 66, AC)}${pallone(206, 98, CA)}${pallone(34, 104, "#a855f7")}`;
  }
);
disegno(
  "vacanza",
  "stanze",
  "Vacanza",
  "Holiday",
  ["viaggio", "via da casa", "ferie", "valigia", "holiday", "vacation", "away", "travel"],
  () => `${fondo("#22d3ee", "#a5f3fc", "#fef3c7")}${sole(186, 40, 16)}${P("M0 132c40-6 80-6 120 0s80 6 120 0v108H0Z", "#fde68a")}${P("M0 126c40-6 80-6 120 0s80 6 120 0v8c-40 6-80 6-120 0S40 128 0 134Z", "#fff", 'opacity=".7"')}${P("M30 140c6-30 14-60 10-90", "none", 'stroke="#92400e" stroke-width="7" stroke-linecap="round"')}${P("M40 50c-20-10-34-4-40 6 14-4 24-2 40-6Zm0 0c-4-18-18-26-30-24 12 6 20 12 30 24Zm0 0c10-16 26-18 36-12-12 0-24 4-36 12Zm0 0c18-4 32 4 36 14-12-6-24-10-36-14Z", "url(#@foglia)")}${ombra(140, 150, 50, 5)}${R(108, 66, 64, 84, 10, "url(#@rosso)")}${L("M128 66V54q0-6 6-6h12q6 0 6 6v12", SC, 5)}${righe(108, 86, 172, 3, 20, "#881337", 2)}${R(116, 74, 48, 6, 3, "#fff", 'opacity=".25"')}${C(124, 104, 6, CA)}${C(150, 120, 5, AC)}${L("M60 26h30l12-8M84 26l-8 10", "#fff", 3)}`
);
disegno(
  "risveglio",
  "stanze",
  "Risveglio",
  "Wake up",
  ["buongiorno", "sveglia", "mattina", "alba", "good morning", "wake up", "morning"],
  () => `${fondo("#fdba74", "#fde68a", "#fef9c3")}${alone(120, 120, 140, "#fb923c", 0.4)}${R(40, 14, 160, 120, 4, "#f8fafc")}${R(48, 22, 144, 104, 2, def(lin("alba", "v", "#7dd3fc", "#fdba74", "#fb923c")))}${C(120, 120, 28, "#fef3c7")}${L("M120 70v-14M84 86l-10-10M156 86l10-10", "#fef3c7", 3)}${P("M48 116c40-6 100-6 144 0v10H48Z", "#9a3412", 'opacity=".6"')}${L("M120 22v104M48 74h144", "#f8fafc", 4)}${R(0, 134, 240, 106, 0, "url(#@legnoC)")}${ombra(70, 140, 26, 4)}${C(70, 118, 20, "url(#@rosso)")}${C(70, 118, 15, "#fff")}${L("M70 108v10l6 4", SC, 2.5)}${C(56, 100, 6, "url(#@oro)")}${C(84, 100, 6, "url(#@oro)")}${P("M150 116h30v14a8 8 0 0 1-8 8h-14a8 8 0 0 1-8-8Z", FR)}${L("M180 120a6 6 0 0 1 0 12", FR, 3)}${vapore(158, 110, 0.6, 0.6)}`
);
disegno(
  "fuori-casa",
  "stanze",
  "Fuori casa",
  "Away",
  ["esco", "uscita", "via", "nessuno in casa", "away", "leaving home", "lock"],
  () => `${fondo("#a5b4fc", "#e0e7ff")}${R(0, 140, 240, 100, 0, "url(#@erba)")}${P("M44 84 120 30l76 54v62H44Z", "url(#@bianco)")}${P("M34 90 120 26l86 64-6 8-80-60-80 60Z", "#7c2d12")}${R(64, 96, 30, 26, 2, "#94a3b8")}${righe(64, 100, 94, 4, 6, "#64748b", 1.5)}${R(146, 96, 30, 26, 2, "#94a3b8")}${righe(146, 100, 176, 4, 6, "#64748b", 1.5)}${R(106, 106, 28, 40, 2, "url(#@legno)")}${C(176, 44, 26, SC)}${P("M168 44v-6a8 8 0 0 1 16 0v6", "none", `stroke="#fff" stroke-width="3.5"`)}${R(164, 44, 24, 18, 4, VE)}${C(176, 52, 2.5, SC)}`
);
disegno(
  "relax",
  "stanze",
  "Relax",
  "Relax",
  ["spa", "benessere", "meditazione", "candele", "zen", "wellness"],
  () => `${fondo("#ccfbf1", "#5eead4", "#0f766e")}${alone(120, 90, 110, "#fff", 0.3)}${L("M30 150V20M44 150V40M196 150V24M210 150V44", "#15803d", 6)}${L("M24 60h12M38 90h12M190 70h12M204 100h12", "#15803d", 3)}${P("M30 60c-14-4-20-10-22-18 10 2 18 8 22 18ZM196 70c14-4 20-10 22-18-10 2-18 8-22 18Z", "url(#@foglia)")}${R(0, 140, 240, 100, 0, "#e7e5e4")}${E(120, 136, 54, 12, "#57534e")}${E(120, 112, 40, 12, "#78716c")}${E(120, 92, 28, 10, "#a8a29e")}${E(120, 76, 18, 8, "#d6d3d1")}${E(112, 72, 6, 2.5, "#fff", 'opacity=".5"')}${R(160, 118, 14, 20, 3, "#fef3c7")}${fiamma(167, 118, 8, 16)}${alone(167, 110, 14, CA, 0.7)}${R(56, 120, 12, 18, 3, "#fef3c7")}${fiamma(62, 120, 7, 14)}${alone(62, 112, 12, CA, 0.7)}`
);
var gatto = (x, y, s = 1, c = "#334155") => `${L(`M${x + 14 * s} ${y + 18 * s}c${18 * s} 0 ${22 * s}-${16 * s} ${12 * s}-${30 * s}`, c, 6 * s)}${E(x, y, 18 * s, 24 * s, c)}${C(x - 6 * s, y - 28 * s, 12 * s, c)}${P(`M${x - 17 * s} ${y - 34 * s}l${2 * s}-${14 * s} ${8 * s} ${9 * s}ZM${x + 5 * s} ${y - 34 * s}l-${2 * s}-${14 * s}-${8 * s} ${9 * s}Z`, c)}${C(x - 10 * s, y - 29 * s, 1.8 * s, CA)}`;
var zampa = (x, y, s = 1, c = "#fff", op = 0.5) => `<g opacity="${op}">${E(x, y, 7 * s, 6 * s, c)}${C(x - 8 * s, y - 8 * s, 3 * s, c)}${C(x - 3 * s, y - 12 * s, 3 * s, c)}${C(x + 3 * s, y - 12 * s, 3 * s, c)}${C(x + 8 * s, y - 8 * s, 3 * s, c)}</g>`;
var pesce = (x, y, s, c) => `${E(x, y, 10 * s, 6 * s, c)}${P(`M${x + 8 * s} ${y}l${8 * s}-${6 * s}v${12 * s}Z`, c)}${C(x - 5 * s, y - 1.5 * s, 1.4 * s, "#0b1220")}`;
disegno(
  "acquario",
  "varie",
  "Acquario",
  "Aquarium",
  ["pesci", "vasca", "acqua", "filtro", "aquarium", "fish tank", "fish"],
  () => {
    const r = rng(5);
    let bolle = "";
    for (let i = 0; i < 12; i++)
      bolle += C(176 + r() * 10, 40 + i * 8, 1.5 + r() * 1.5, "#fff", 'opacity=".6"');
    return `${stanza("#1e3a5f", "#0b1220", "#3f2a1d", "#1c1412", 156)}${alone(120, 80, 110, AC, 0.4)}${R(26, 22, 188, 112, 6, def(lin("vasca", "v", "#67e8f9", "#0891b2", "#164e63")))}${R(26, 18, 188, 8, 3, SC)}${R(30, 26, 180, 6, 0, "#fff", 'opacity=".35"')}${P("M26 134v-14c20-8 40 2 60-4s50-6 70 2 40 4 58 0v16Z", "#d6a86a")}${L("M56 130c-6-20 6-34 0-56M66 130c4-16-4-30 4-46M190 130c-6-16 6-28 0-40", VE, 5)}${E(120, 124, 18, 8, "#78716c")}${pesce(96, 66, 1.5, AR)}${pesce(140, 90, 1.2, CA)}${pesce(80, 100, 1, "#f472b6")}${pesce(150, 54, 1, VT)}${bolle}${P("M30 30h40L30 90Z", "#fff", 'opacity=".12"')}${R(20, 134, 200, 22, 3, "url(#@legno)")}`;
  }
);
disegno(
  "cuccia",
  "varie",
  "Cuccia",
  "Dog house",
  ["cane", "cuccia cane", "animali", "dog", "kennel", "doghouse"],
  () => `${giorno(130)}${ombra(110, 148, 74, 6)}${P("M50 82 110 40l60 42v66H50Z", "url(#@rosso)")}${righe(50, 92, 170, 6, 10, "#881337", 1.5, 0.4)}${P("M40 88 110 34l70 54-6 8-64-48-64 48Z", "url(#@legno)")}${P("M90 148v-30a20 20 0 0 1 40 0v30Z", "#1c1917")}${R(96, 62, 28, 12, 6, FR)}${C(98, 62, 5, FR)}${C(98, 74, 5, FR)}${C(122, 62, 5, FR)}${C(122, 74, 5, FR)}${E(190, 144, 20, 6, "#1e3a8a")}${P("M170 136h40l-4 10h-32Z", AC)}${E(190, 136, 20, 4, "#78350f")}${zampa(30, 160, 0.7, "#14532d", 0.4)}`
);
disegno(
  "ciotola",
  "varie",
  "Distributore di cibo",
  "Pet feeder",
  ["ciotola", "crocchette", "pappa", "mangiatoia", "pet feeder", "food bowl", "gatto", "cane"],
  () => `${stanza("#fed7aa", "#ea580c", "#e7e5e4", "#a8a29e", 150)}${zampa(40, 50, 1.4, "#fff", 0.35)}${zampa(200, 36, 1.1, "#fff", 0.3)}${ombra(120, 150, 64, 6)}${R(80, 22, 80, 80, 14, "url(#@biancoO)")}${R(88, 30, 64, 52, 8, "url(#@vetro)")}${punti(96, 64, 7, 2, 8, 8, 3.4, "#b45309")}${punti(100, 56, 6, 1, 8, 0, 3.4, "#92400e")}${R(102, 88, 36, 8, 3, SC)}${led(132, 92, VE, 1.4)}${P("M64 100h112l-8 48H72Z", "url(#@bianco)")}${E(120, 112, 40, 8, "#e2e8f0")}${E(120, 112, 34, 6, "#64748b")}${punti(104, 112, 5, 1, 8, 0, 3, "#b45309")}`
);
disegno(
  "lettiera",
  "varie",
  "Lettiera",
  "Litter box",
  ["gatto", "sabbia", "lettiera automatica", "litter box", "cat", "litter"],
  () => `${stanza("#ddd6fe", "#7c3aed", "#e7e5e4", "#a8a29e", 150)}${ombra(110, 150, 70, 6)}${P("M40 150v-50a70 50 0 0 1 140 0v50Z", "url(#@biancoO)")}${P("M50 104a60 40 0 0 1 120 0", "none", 'stroke="#fff" stroke-width="5" opacity=".7"')}${P("M88 150v-26a22 22 0 0 1 44 0v26Z", "#334155")}${R(36, 140, 148, 12, 5, "#7c3aed")}${led(150, 92, VE, 1.6)}${gatto(196, 120, 0.9, "#1e293b")}`
);
disegno(
  "gattaiola",
  "varie",
  "Gattaiola",
  "Cat flap",
  ["porta gatto", "sportello", "gatto", "cat flap", "pet door", "cat door"],
  () => `${fondo("#92400e", "#451a03")}${R(0, 0, 240, 240, 0, "url(#@legno)", 'opacity=".5"')}${colonne(40, 0, 240, 4, 54, "#000", 1.5, 0.15)}${ombra(120, 104, 54, 50, 0.35)}${R(70, 50, 100, 100, 18, "url(#@bianco)")}${R(82, 62, 76, 72, 10, "#334155")}${R(84, 70, 72, 64, 8, "url(#@vetro)", 'opacity=".7"')}${R(84, 70, 72, 4, 2, "#fff", 'opacity=".6"')}${led(150, 56, VE, 1.6)}${zampa(54, 172, 0.9, "#fff", 0.35)}${zampa(36, 140, 0.8, "#fff", 0.3)}${gatto(196, 118, 0.85, "#1c1917")}`
);
disegno(
  "terrario",
  "varie",
  "Terrario",
  "Terrarium",
  ["rettili", "geco", "tartaruga", "lampada calda", "terrarium", "reptile", "vivarium"],
  () => `${stanza("#14532d", "#052e16", "#3f2a1d", "#1c1412", 156)}${alone(120, 34, 70, AR, 0.45)}${R(30, 30, 180, 110, 6, def(lin("aria", "v", "#bbf7d0/.4", "#86efac/.25")))}${P("M30 140v-24c30-12 60 0 90-8s60-6 90 4v28Z", "#b45309")}${E(150, 120, 26, 12, "#78716c")}${pianta(64, 132, 0.8)}${P("M120 112c10-2 20-6 30-4 8 2 12 6 18 4", "none", `stroke="${VE}" stroke-width="7" stroke-linecap="round"`)}${C(170, 110, 6, VE)}${C(172, 108, 1.5, "#0b1220")}${L("M128 112l-4 8M140 108l2 8M152 108l-2 8M162 110l4 6", VE, 3)}${R(26, 24, 188, 10, 3, SC)}${R(104, 16, 32, 12, 4, "#1e293b")}${E(120, 30, 12, 4, "#fde68a")}${L("M30 30v110M210 30v110", "#e2e8f0", 4)}${P("M34 36h30L34 100Z", "#fff", 'opacity=".12"')}${R(24, 140, 192, 16, 3, "url(#@legno)")}`
);
disegno(
  "voliera",
  "varie",
  "Gabbia uccellini",
  "Birdcage",
  ["uccelli", "canarino", "pappagallo", "voliera", "bird cage", "bird", "aviary"],
  () => {
    let sbarre = "";
    for (let i = 0; i <= 10; i++) {
      const x = 64 + i * 11.2;
      const t2 = Math.abs(x - 120) / 56;
      sbarre += `M${n(x)} 140V${n(70 - Math.sqrt(1 - t2 * t2) * 40 + 0)}`;
    }
    return `${fondo("#fef3c7", "#fbbf24", "#b45309")}${alone(120, 90, 100, "#fff", 0.35)}${L("M120 0v24", "#78350f", 2)}${C(120, 28, 6, "none", `stroke="url(#@oro)" stroke-width="3"`)}${L(sbarre, "url(#@oro)", 2.5)}${L("M64 140V70a56 40 0 0 1 112 0v70", "url(#@oro)", 4)}${L("M80 104h80", "#78350f", 4)}${E(116, 92, 14, 11, AC)}${C(128, 84, 8, AC)}${P("M135 84l8 2-8 3Z", AR)}${C(130, 82, 1.8, "#0b1220")}${P("M104 92l-16 8 12-1Z", "#0369a1")}${P("M108 88c4 6 12 8 18 4", "none", 'stroke="#0369a1" stroke-width="3"')}${R(56, 136, 128, 12, 5, "url(#@oro)")}`;
  }
);
disegno(
  "stampante-3d",
  "varie",
  "Stampante 3D",
  "3D printer",
  ["stampa 3d", "filamento", "maker", "3d printer", "printing"],
  () => `${stanza("#334155", "#0f172a", "#57534e", "#1c1917", 156)}${ombra(120, 156, 80, 5)}${R(44, 18, 152, 138, 8, "url(#@nero)")}${R(54, 28, 132, 108, 4, "#1e293b")}${L("M60 50H180", "url(#@acciaio)", 4)}${R(104, 44, 30, 22, 4, "url(#@acciaio)")}${P("M115 66h8l-4 8Z", AR)}${alone(119, 76, 10, AR, 0.7)}${P("M96 122h46l-6-40h-34Z", def(lin("filo", "v", "#f472b6", "#a855f7")))}${righe(98, 86, 140, 9, 4, "#fff", 1, 0.25)}${R(70, 122, 100, 8, 2, "#475569")}${R(54, 138, 132, 12, 4, "#0b1220")}${R(66, 141, 26, 6, 2, AC, 'opacity=".8"')}${C(206, 70, 20, "#a855f7")}${C(206, 70, 7, "#334155")}${L("M206 90 140 52", "#a855f7", 1.5)}`
);
disegno(
  "computer",
  "varie",
  "Computer",
  "Computer",
  ["pc", "portatile", "laptop", "notebook", "computer"],
  () => `${stanza("#c7d2fe", "#4338ca", "#b7793c", "#5c3410", 152)}${alone(120, 70, 100, "#6366f1", 0.3)}${piano(140, "legnoC", 8)}${ombra(120, 140, 92, 5)}${P("M50 40a8 8 0 0 1 8-8h124a8 8 0 0 1 8 8v86H50Z", "url(#@nero)")}${schermo(58, 40, 124, 80)}${P("M26 126h188l-10 14H36Z", "url(#@acciaio)")}${R(26, 124, 188, 4, 2, "#e2e8f0")}${R(102, 128, 36, 4, 2, "#64748b")}${C(190, 128, 8, FR)}${R(186, 120, 8, 8, 2, "#78350f", 'opacity=".4"')}`
);
disegno(
  "router",
  "varie",
  "Router Wi-Fi",
  "Wi-Fi router",
  ["wifi", "internet", "rete", "modem", "router", "network", "fibra"],
  () => `${fondo("#0e7490", "#083344")}${L("M90 40a42 42 0 0 1 60 0M76 26a62 62 0 0 1 88 0M104 54a20 20 0 0 1 32 0", "#a5f3fc", 5, 'opacity=".85"')}${C(120, 66, 4, "#a5f3fc")}${L("M54 112 44 54M186 112l10-58", "#1e293b", 7)}${C(44, 54, 4, "#334155")}${C(196, 54, 4, "#334155")}${ombra(120, 140, 92, 6)}${P("M40 108h160l16 26H24Z", "url(#@nero)")}${P("M40 108h160l3 5H37Z", "#fff", 'opacity=".25"')}${R(24, 134, 192, 10, 4, "#0b1220")}${[0, 1, 2, 3, 4].map((i) => led(70 + i * 24, 139, i === 4 ? CA : VE, 1.6)).join("")}`
);
disegno(
  "nas",
  "varie",
  "Server NAS",
  "NAS",
  ["server", "archivio", "dischi", "backup", "nas", "storage", "home server"],
  () => `${stanza("#334155", "#0f172a", "#334155", "#0b1220", 156)}${alone(120, 90, 100, AC, 0.25)}${ombra(120, 156, 66, 5)}${R(60, 22, 120, 134, 12, "url(#@nero)")}${R(64, 26, 4, 124, 2, "#fff", 'opacity=".2"')}${[0, 1, 2, 3].map((i) => `${R(74, 36 + i * 24, 76, 18, 3, "#1e293b")}${righe(80, 42 + i * 24, 120, 2, 6, "#475569", 2)}${led(140, 45 + i * 24, i === 2 ? AC : VE, 1.4)}`).join("")}${C(166, 44, 7, "#0b1220", `stroke="${AC}" stroke-width="2"`)}${punti(166, 64, 1, 8, 0, 9, 2, "#475569")}`,
  [50, 20]
);
disegno(
  "stampante",
  "varie",
  "Stampante",
  "Printer",
  ["stampa", "fotocopiatrice", "scanner", "multifunzione", "printer", "print"],
  () => `${stanza("#e0f2fe", "#64748b", "#b7793c", "#5c3410", 152)}${piano(140, "legnoC", 8)}${R(80, 22, 80, 44, 3, "#fff")}${righe(90, 34, 150, 4, 7, "#cbd5e1", 2)}${ombra(120, 140, 88, 5)}${P("M40 64h160l10 70H30Z", "url(#@bianco)")}${R(40, 62, 160, 6, 3, "#fff")}${R(56, 106, 128, 8, 3, "#334155")}${R(66, 112, 108, 30, 2, "#f8fafc")}${R(76, 120, 60, 3, 1.5, "#cbd5e1")}${R(76, 128, 80, 3, 1.5, "#cbd5e1")}${R(150, 76, 36, 16, 3, SC)}${R(154, 80, 18, 8, 2, AC, 'opacity=".8"')}${led(180, 84, VE, 1.4)}`
);
disegno(
  "ascensore",
  "varie",
  "Ascensore",
  "Elevator",
  ["lift", "piano", "condominio", "elevator", "elevatore"],
  () => `${stanza("#e7e5e4", "#a8a29e", "#57534e", "#292524", 156)}${R(48, 20, 124, 136, 4, "#cbd5e1")}${R(56, 28, 108, 128, 2, "#0b1220")}${R(58, 40, 52, 116, 0, "url(#@acciaioO)")}${R(110, 40, 52, 116, 0, "url(#@acciaioO)")}${L("M110 40v116", "#475569", 2)}${R(60, 42, 4, 110, 2, "#fff", 'opacity=".6"')}${R(80, 28, 60, 10, 2, "#020617")}${P("M104 36l6-6 6 6ZM122 30l6 6 6-6Z", CA)}${R(184, 72, 22, 50, 6, "url(#@acciaio)")}${C(195, 86, 6, "#0b1220", `stroke="${CA}" stroke-width="2"`)}${P("M192 88l3-4 3 4Z", CA)}${C(195, 106, 6, "#0b1220", `stroke="#64748b" stroke-width="2"`)}${P("M192 104l3 4 3-4Z", "#94a3b8")}`
);
disegno(
  "montascale",
  "varie",
  "Montascale",
  "Stairlift",
  ["servoscala", "scale", "sedia", "accessibilita", "stairlift", "stair lift"],
  () => {
    let g = "";
    for (let i = 0; i < 6; i++)
      g += `${R(30 + i * 30, 150 - i * 22, 240, 22, 0, i % 2 ? "#d6d3d1" : "#e7e5e4")}${R(30 + i * 30, 150 - i * 22, 240, 3, 0, "#fff", 'opacity=".7"')}`;
    return `${fondo("#bfdbfe", "#3b82f6")}${R(0, 172, 240, 68, 0, "#57534e")}${g}${L("M20 150 210 18", "url(#@acciaio)", 7)}${L("M20 158 210 26", "#64748b", 2)}${ombra(100, 116, 30, 4)}${R(80, 62, 40, 52, 8, "url(#@blu)")}${R(80, 98, 50, 14, 6, "url(#@blu)")}${R(76, 86, 10, 6, 3, "#334155")}${R(118, 86, 10, 6, 3, "#334155")}${R(84, 66, 4, 30, 2, "#fff", 'opacity=".3"')}${R(108, 112, 24, 6, 3, "#334155")}${R(68, 92, 18, 26, 5, "url(#@acciaio)")}${led(77, 100, VE, 1.4)}`;
  }
);
disegno(
  "tablet-parete",
  "varie",
  "Pannello a muro",
  "Wall panel",
  [
    "tablet",
    "pannello di controllo",
    "display",
    "domotica",
    "wall tablet",
    "dashboard",
    "control panel"
  ],
  () => {
    const col = [CA, AC, VE, "#a855f7", RO, VT];
    let tasselli = "";
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 3; c++)
        tasselli += `${R(56 + c * 44, 62 + r * 36, 38, 30, 6, "#1e293b")}${C(68 + c * 44, 74 + r * 36, 5, col[r * 3 + c])}${R(64 + c * 44, 84 + r * 36, 22, 3, 1.5, "#475569")}`;
    return `${stanza("#e7e5e4", "#a8a29e", "#d6a86a", "#92400e", 160)}${ombra(124, 92, 90, 58, 0.3)}${R(40, 30, 160, 112, 12, "url(#@nero)")}${R(48, 38, 144, 96, 6, "#0b1220")}${R(56, 44, 60, 10, 3, "#334155")}${R(150, 44, 34, 10, 3, CA, 'opacity=".8"')}${tasselli}${P("M50 40h56L50 96Z", "#fff", 'opacity=".07"')}${C(120, 138, 2, "#475569")}`;
  }
);
var SENZA_ACCENTI = /[̀-ͯ]/g;
var piatto = (testo2) => String(testo2 ?? "").normalize("NFD").replace(SENZA_ACCENTI, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
var NOMI_GRUPPI = new Map(GRUPPI_DISEGNI.map((g) => [g.chiave, g.nome]));
var DISEGNI_DA_RIQUADRO = Object.freeze(
  VOCI.map(({ chiave, gruppo, it, en, parole, corpo, fuoco }) => {
    let pronto = null;
    return Object.freeze({
      chiave,
      gruppo,
      nome: Object.freeze({ it, en }),
      parole: Object.freeze([...parole]),
      fuoco: Object.freeze([...fuoco]),
      svg: () => pronto ??= costruisci(chiave, corpo)
    });
  })
);
var PER_CHIAVE = new Map(DISEGNI_DA_RIQUADRO.map((d) => [d.chiave, d]));
var PAGLIAIO = new Map(
  DISEGNI_DA_RIQUADRO.map((d) => {
    const g = NOMI_GRUPPI.get(d.gruppo);
    return [
      d.chiave,
      ` ${piatto([d.nome.it, d.nome.en, ...d.parole, d.chiave, g.it, g.en].join(" "))} `
    ];
  })
);
function disegnoDaRiquadro(chiave) {
  return PER_CHIAVE.get(String(chiave ?? "")) ?? null;
}
function cercaDisegni(testo2, lingua = "it") {
  const cercato = piatto(testo2);
  if (!cercato) return [...DISEGNI_DA_RIQUADRO];
  const parole = cercato.split(" ");
  const lang = lingua === "en" ? "en" : "it";
  const punteggio = (d) => {
    const nome = piatto(d.nome[lang]);
    if (nome.startsWith(cercato)) return 0;
    if (` ${nome}`.includes(` ${parole[0]}`)) return 1;
    if (nome.includes(cercato)) return 2;
    return 3;
  };
  return DISEGNI_DA_RIQUADRO.filter((d) => {
    const pagliaio = PAGLIAIO.get(d.chiave);
    return parole.every((p) => pagliaio.includes(p));
  }).map((d, i) => [punteggio(d), i, d]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
}

// src/core/immagine-del-riquadro.js
var CARTELLE_DELLE_FOTO = Object.freeze(["/dashboardmodern_static/www/", "/local/"]);
var PREFISSO_DEL_DISEGNO = "disegno:";
var ZOOM_MINIMO = 1;
var ZOOM_MASSIMO = 3;
var LUNGHEZZA_MASSIMA = 300;
var PEZZO = /^[A-Za-z0-9_\-.@+~]+$/;
var SUFFISSI = /\.(png|jpe?g|webp|gif|avif|bmp)$/i;
function srcPulito(valore) {
  const src = String(valore ?? "").trim();
  if (!src || src.length > LUNGHEZZA_MASSIMA) return "";
  if (src.startsWith(PREFISSO_DEL_DISEGNO)) {
    const chiave = src.slice(PREFISSO_DEL_DISEGNO.length);
    return disegnoDaRiquadro(chiave) ? `${PREFISSO_DEL_DISEGNO}${chiave}` : "";
  }
  const cartella = CARTELLE_DELLE_FOTO.find((c) => src.startsWith(c));
  if (!cartella) return "";
  const pezzi = src.slice(cartella.length).split("/");
  if (!pezzi.length || !pezzi.every((p) => p && p !== "." && p !== ".." && PEZZO.test(p)))
    return "";
  return SUFFISSI.test(pezzi[pezzi.length - 1]) ? src : "";
}
function chiaveDelDisegno(immagine) {
  const src = String(immagine?.src ?? "");
  return src.startsWith(PREFISSO_DEL_DISEGNO) ? src.slice(PREFISSO_DEL_DISEGNO.length) : "";
}
var tra = (numero, minimo, massimo) => Math.min(massimo, Math.max(minimo, numero));
var numeroOppure = (valore, ripiego) => {
  if (valore === null || valore === void 0 || valore === "") return ripiego;
  const n2 = Number(valore);
  return Number.isFinite(n2) ? n2 : ripiego;
};
var decimo = (n2) => Math.round(n2 * 10) / 10;
var centesimo = (n2) => Math.round(n2 * 100) / 100;
function immaginePulita(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const src = srcPulito(input.src);
  if (!src) return null;
  const disegno2 = disegnoDaRiquadro(chiaveDelDisegno({ src }));
  const [x0, y0] = disegno2?.fuoco || [50, 50];
  const fuoco = Array.isArray(input.fuoco) ? input.fuoco : [];
  return {
    src,
    fuoco: [
      decimo(tra(numeroOppure(fuoco[0], x0), 0, 100)),
      decimo(tra(numeroOppure(fuoco[1], y0), 0, 100))
    ],
    zoom: centesimo(tra(numeroOppure(input.zoom, 1), ZOOM_MINIMO, ZOOM_MASSIMO))
  };
}
function conLaBaseDellaPlancia(src) {
  if (!src.startsWith("/dashboardmodern_static/")) return src;
  const qui = import.meta.url;
  const taglio = qui.indexOf("/dashboardmodern_static/");
  return taglio < 0 ? src : `${qui.slice(0, taglio)}${src}`;
}
var datiDelDisegno = /* @__PURE__ */ new Map();
function srcDaMostrare(immagine) {
  const chiave = chiaveDelDisegno(immagine);
  if (!chiave) return conLaBaseDellaPlancia(String(immagine?.src ?? ""));
  if (datiDelDisegno.has(chiave)) return datiDelDisegno.get(chiave);
  const disegno2 = disegnoDaRiquadro(chiave);
  const dati = disegno2 ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(disegno2.svg().replace(/>\s+</g, "><"))}` : "";
  datiDelDisegno.set(chiave, dati);
  return dati;
}
function stileDellImmagine(immagine) {
  const pulita = immaginePulita(immagine);
  if (!pulita) return { objectPosition: "50% 50%", transformOrigin: "50% 50%", transform: "" };
  const [x, y] = pulita.fuoco;
  const punto = `${x}% ${y}%`;
  return {
    objectPosition: punto,
    transformOrigin: punto,
    transform: pulita.zoom === 1 ? "" : `scale(${pulita.zoom})`
  };
}
function stileInLinea(immagine) {
  const s = stileDellImmagine(immagine);
  return `object-position:${s.objectPosition};transform-origin:${s.transformOrigin}${s.transform ? `;transform:${s.transform}` : ""}`;
}
function finestraVisibile(misure, forma, immagine) {
  const larghezza = Number(misure?.larghezza) || 1;
  const altezza = Number(misure?.altezza) || 1;
  const rapporto = larghezza / altezza;
  const voluta = Number(forma) > 0 ? Number(forma) : 1;
  const pulita = immaginePulita(immagine) || { fuoco: [50, 50], zoom: 1 };
  const z = pulita.zoom;
  const wf = rapporto > voluta ? voluta / rapporto : 1;
  const hf = rapporto > voluta ? 1 : rapporto / voluta;
  const w = wf / z;
  const h = hf / z;
  const fx = pulita.fuoco[0] / 100;
  const fy = pulita.fuoco[1] / 100;
  return { x: fx * (1 - w), y: fy * (1 - h), w, h };
}
function fuocoDallaFinestra(misure, forma, immagine, sinistra, alto) {
  const pulita = immaginePulita(immagine);
  if (!pulita) return null;
  const { w, h } = finestraVisibile(misure, forma, pulita);
  const asse = (posizione, lato, prima) => lato >= 0.999 ? prima : decimo(tra(tra(posizione, 0, 1 - lato) / (1 - lato) * 100, 0, 100));
  return [
    asse(Number(sinistra) || 0, w, pulita.fuoco[0]),
    asse(Number(alto) || 0, h, pulita.fuoco[1])
  ];
}
var scappa = (valore) => String(valore ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function immagineMarkup(immagine, classe = "dm-rq-img") {
  const pulita = immaginePulita(immagine);
  if (!pulita) return "";
  return `<img class="${scappa(classe)}" src="${scappa(srcDaMostrare(pulita))}" alt="" draggable="false" decoding="async" style="${scappa(stileInLinea(pulita))}">`;
}
function fondoMarkup(immagine) {
  const img = immagineMarkup(immagine);
  return img ? `${img}<span class="dm-rq-velo" aria-hidden="true"></span>` : "";
}
var classeDelFondo = (immagine) => immaginePulita(immagine) ? " dm-rq-fondo" : "";
var SEGNO_DELLA_FOTO = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 5l1.5-2h5L16 5"/></svg>`;
function segnoDellaFoto(immagine) {
  const pulita = immaginePulita(immagine);
  return pulita && !chiaveDelDisegno(pulita) ? `<span class="dm-rq-foto">${SEGNO_DELLA_FOTO}</span>` : "";
}
function riquadroConImmagineMarkup({
  immagine,
  nome = "",
  stato = "",
  acceso = false,
  accento = "#0ea5e9",
  destra = "",
  attributi = "",
  classi = "",
  tag = "div",
  extraStato = "",
  stile = "",
  attributiStato = "",
  comandi = ""
} = {}) {
  const fondo2 = immagineMarkup(immagine);
  if (!fondo2) return "";
  const etichetta = tag === "button" ? ' type="button"' : "";
  return `<${tag}${etichetta} class="dm-rq ${acceso ? "on" : ""} ${scappa(classi)}" style="--acc:${scappa(accento)}${stile ? `;${scappa(stile)}` : ""}" ${attributi}>${fondo2}
    <div class="dm-rq-alto">${segnoDellaFoto(immagine)}${destra}</div>
    <div class="dm-rq-basso"><div class="dm-rq-nome">${scappa(nome)}</div><div class="dm-rq-stato"><i aria-hidden="true"></i><span${attributiStato ? ` ${attributiStato}` : ""}>${scappa(stato)}</span>${extraStato}</div>${comandi ? `<div class="dm-rq-comandi">${comandi}</div>` : ""}</div></${tag}>`;
}

// src/core/device-model.js
var SCHEMA_VERSION = 4;
var CLIMATE_HEAT_TOKENS = Object.freeze([
  "termo",
  "termostato",
  "thermostat",
  "heat",
  "heating",
  "caldo"
]);
var CLIMATE_PUMP_TOKENS = Object.freeze([
  "pompa",
  "pompa_di_calore",
  "heat_pump",
  "heatpump",
  "heat_cool",
  "both",
  "entrambi",
  "dual"
]);
function climaScalda({ stato = "", azione = "", tipo = "clima", zona = "" } = {}) {
  const fa = String(azione || "").toLowerCase();
  if (fa === "heating" || fa === "preheating") return true;
  if (fa === "cooling" || fa === "drying" || fa === "fan") return false;
  const modo = String(stato || "").toLowerCase();
  if (modo === "heat") return true;
  if (modo === "cool" || modo === "dry" || modo === "fan_only") return false;
  if (zona === "caldo") return true;
  if (zona === "freddo") return false;
  return canonicalClimateType(tipo) === "termo";
}
function canonicalClimateType(value) {
  const token = String(value ?? "").trim().toLowerCase();
  if (CLIMATE_HEAT_TOKENS.includes(token)) return "termo";
  if (CLIMATE_PUMP_TOKENS.includes(token)) return "pompa";
  return "clima";
}
var APPLIANCE_CATALOG = Object.freeze([
  { key: "lavatrice", it: "Lavatrice", en: "Washing machine" },
  { key: "lavastoviglie", it: "Lavastoviglie", en: "Dishwasher" },
  { key: "asciugatrice", it: "Asciugatrice", en: "Dryer" },
  { key: "forno", it: "Forno", en: "Oven" },
  { key: "microonde", it: "Microonde", en: "Microwave" },
  { key: "frigo", it: "Frigorifero", en: "Refrigerator" },
  { key: "congelatore", it: "Congelatore", en: "Freezer" },
  { key: "piano_cottura", it: "Piano cottura", en: "Cooktop" },
  { key: "cappa", it: "Cappa", en: "Hood" },
  { key: "ferro", it: "Ferro da stiro", en: "Iron" },
  { key: "aspirapolvere", it: "Aspirapolvere", en: "Vacuum cleaner" },
  { key: "robot", it: "Robot aspirapolvere", en: "Robot vacuum" },
  { key: "condizionatore", it: "Condizionatore", en: "Air conditioner" },
  { key: "ventilatore", it: "Ventilatore", en: "Fan" },
  { key: "scaldabagno", it: "Scaldabagno", en: "Water heater" },
  /* Il boiler d'accumulo NON e' lo scaldabagno a muro: e' il cilindrone a
   * pavimento del solare termico, e mancava proprio come voce. La chiave e'
   * «accumulo» perche' «boiler» da sola e' da sempre l'alias dello
   * scaldabagno; l'etichetta dice Boiler, come lo chiama chi ce l'ha. */
  { key: "accumulo", it: "Boiler", en: "Storage boiler" },
  { key: "tv", it: "TV", en: "TV" },
  { key: "caffe", it: "Caffettiera", en: "Coffee maker" },
  { key: "tostapane", it: "Tostapane", en: "Toaster" },
  { key: "bollitore", it: "Bollitore", en: "Kettle" },
  { key: "friggitrice", it: "Friggitrice ad aria", en: "Air fryer" },
  { key: "generico", it: "Altro", en: "Other" }
]);
var APPLIANCE_VISUAL_KEYS = Object.freeze(APPLIANCE_CATALOG.map((item) => item.key));
function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(value);
  if (value === void 0) return void 0;
  return JSON.parse(JSON.stringify(value));
}
var TYPE_ICONS = Object.freeze({
  appliance: "mdi:power-plug",
  forno: "mdi:stove",
  microwave: "mdi:microwave",
  microonde: "mdi:microwave",
  washer: "mdi:washing-machine",
  lavatrice: "mdi:washing-machine",
  washing_machine: "mdi:washing-machine",
  dryer: "mdi:tumble-dryer",
  asciugatrice: "mdi:tumble-dryer",
  dishwasher: "mdi:dishwasher",
  lavastoviglie: "mdi:dishwasher",
  oven: "mdi:stove",
  fridge: "mdi:fridge-outline",
  refrigerator: "mdi:fridge-outline",
  frigorifero: "mdi:fridge-outline",
  frigo: "mdi:fridge-outline",
  freezer: "mdi:snowflake",
  congelatore: "mdi:snowflake",
  cooktop: "mdi:stove",
  piano_cottura: "mdi:stove",
  hood: "mdi:air-filter",
  cappa: "mdi:air-filter",
  iron: "mdi:iron",
  ferro: "mdi:iron",
  vacuum: "mdi:vacuum",
  aspirapolvere: "mdi:vacuum",
  robot_vacuum: "mdi:robot-vacuum",
  robot: "mdi:robot-vacuum",
  boiler: "mdi:water-boiler",
  water_heater: "mdi:water-boiler",
  scaldabagno: "mdi:water-boiler",
  toaster: "mdi:toaster",
  tostapane: "mdi:toaster",
  /* I fornelli da banco (#71). I nomi in due lingue perche' questa tabella
   * legge il nome che l'apparecchio ha in Home Assistant, e quello lo scrive
   * chi abita la casa: «Friggitrice cucina» e «Air fryer» sono la stessa
   * macchina. */
  air_fryer: "mdi:air-fryer",
  airfryer: "mdi:air-fryer",
  friggitrice: "mdi:air-fryer",
  coffee_machine: "mdi:coffee-maker",
  coffee_maker: "mdi:coffee-maker",
  caffe: "mdi:coffee-maker",
  kettle: "mdi:kettle",
  bollitore: "mdi:kettle",
  television: "mdi:television",
  televisore: "mdi:television",
  tv: "mdi:television",
  air_conditioner: "mdi:air-conditioner",
  climatizzatore: "mdi:air-conditioner",
  condizionatore: "mdi:air-conditioner",
  fan: "mdi:fan",
  ventilatore: "mdi:fan",
  camera: "mdi:cctv",
  light: "mdi:lightbulb",
  climate: "mdi:thermostat",
  cover: "mdi:window-shutter",
  ev: "mdi:car-electric"
});
var LEGACY_NAMES = /^(generico|generic|other|altro|appliance)$/i;
var VISUAL_ALIASES = Object.freeze({
  oven: "forno",
  stove: "forno",
  washer: "lavatrice",
  washing_machine: "lavatrice",
  dishwasher: "lavastoviglie",
  dryer: "asciugatrice",
  fridge: "frigo",
  refrigerator: "frigo",
  frigorifero: "frigo",
  microwave: "microonde",
  freezer: "congelatore",
  cooktop: "piano_cottura",
  hob: "piano_cottura",
  hood: "cappa",
  iron: "ferro",
  vacuum: "aspirapolvere",
  vacuum_cleaner: "aspirapolvere",
  robot_vacuum: "robot",
  robot_aspirapolvere: "robot",
  air_conditioner: "condizionatore",
  climatizzatore: "condizionatore",
  fan: "ventilatore",
  boiler: "scaldabagno",
  water_heater: "scaldabagno",
  television: "tv",
  televisore: "tv",
  coffee: "caffe",
  coffee_machine: "caffe",
  coffee_maker: "caffe",
  caffettiera: "caffe",
  toaster: "tostapane",
  kettle: "bollitore",
  generic: "generico",
  other: "generico",
  altro: "generico",
  appliance: "generico"
});
function normalizedToken(value = "") {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function tokenContains(token, candidate) {
  return token === candidate || token.startsWith(`${candidate}_`) || token.endsWith(`_${candidate}`) || token.includes(`_${candidate}_`);
}
function applianceVisualKey(device = {}) {
  const dichiarati = [device?.visual_key, device?.device_type, device?.icon, device?.type].map((value) => canonicalApplianceVisualKey(value) || "").filter(Boolean);
  const preciso = dichiarati.find((key) => key !== "generico");
  if (preciso) return preciso;
  const dalNome = canonicalApplianceVisualKey(device?.name) || "";
  return dalNome || dichiarati[0] || "generico";
}
function canonicalApplianceVisualKey(value = "") {
  const token = normalizedToken(value);
  if (!token) return "";
  const direct = VISUAL_ALIASES[token] || token;
  if (APPLIANCE_VISUAL_KEYS.includes(direct)) return direct;
  const candidates = [
    ...Object.entries(VISUAL_ALIASES),
    ...APPLIANCE_VISUAL_KEYS.map((key) => [key, key])
  ].sort((a, b) => b[0].length - a[0].length);
  for (const [alias, key] of candidates) {
    if (key !== "generico" && tokenContains(token, alias)) return key;
  }
  return "";
}
function applianceCatalogLabel(value = "", locale2 = "it") {
  const key = canonicalApplianceVisualKey(value) || "generico";
  const item = APPLIANCE_CATALOG.find((entry) => entry.key === key);
  return pick(item?.it, item?.en, locale2) || item?.it || key;
}
function legacyVisualKey(input = {}, rawIcon = "", type = "") {
  const candidates = [input.visual_key, rawIcon, type, input.device_type, input.type, input.name].map(normalizedToken).filter(Boolean);
  let generic = "";
  for (const candidate of candidates) {
    const key = canonicalApplianceVisualKey(candidate);
    if (!key) continue;
    if (key !== "generico") return key;
    generic ||= key;
  }
  return generic;
}
function entityLabel(entityId = "") {
  return String(entityId).split(".").pop().replace(/[_-]+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}
var APPLIANCE_BINDING_FIELDS = Object.freeze([
  "device_id",
  "integration",
  "integration_name",
  "device_name",
  "device_manufacturer",
  "device_model"
]);
var CAMPI_DECISI = new Map([
  /* Le coperture: le decide il ramo `covers`, slot per slot. */
  ["contact", ["covers"]],
  ["contact_entity", ["covers"]],
  ["inferriata", ["covers"]],
  ["kind", ["covers"]],
  ["preset", ["covers"]],
  ["soglia", ["covers"]],
  ...COVER_SLOTS.flatMap(
    ({ campo, giu }) => [campo, giu].filter(Boolean).map((nome) => [nome, ["covers"]])
  ),
  /* Le telecamere. */
  ["rtsp", ["cameras"]],
  /* Il flusso lo legge il ramo comune, per ogni sezione. */
  ["stream", true],
  ["stream_url", true],
  ["url", true],
  /* Il clima. */
  ["valvola", ["climate"]],
  /* E i nomi vecchi delle caselle di sempre.
   *
   * Il modello li legge e li versa nel nome canonico: `power` diventa
   * `power_entity`, `switch` diventa `control_entity`. Se li tenessimo anche
   * com'erano, una casella svuotata apposta risorgerebbe dal suo alias al giro
   * dopo — e' quello che era gia' successo alle foto delle auto, «si mescolano
   * da sole», per giorni. Il nome canonico c'e' sempre: questi hanno finito il
   * loro lavoro nel momento in cui sono stati letti. Valgono dove il ramo che
   * li versa gira davvero: gli apparecchi e i carichi. */
  ...[
    "power",
    "energy",
    "daily_energy",
    "energy_today",
    "monthly_energy",
    "total_energy",
    "history",
    "switch",
    "switch_entity",
    "light",
    "state",
    "temp_entity",
    "temp_entity_2",
    "remaining_time_entity",
    "problem_entity",
    "start_time_entity"
  ].map((nome) => [nome, ["appliances", "loads"]]),
  /* La foto dell'auto: il ramo `ev` la versa in `image` e `image_url`. */
  ["img", ["ev"]],
  /* E i nomi vecchi delle caselle del robot, per la stessa ragione delle altre.
   *
   * `normalizeRobot` li legge e li versa nei suoi: `map_entity` diventa
   * `mapEntity`, `commands` diventa `comandi`. Tenendoli anche com'erano, una
   * casella svuotata apposta risorgeva dal suo alias al giro dopo — la mappa
   * tolta tornava, e non c'era modo di levarla. Hanno finito il loro lavoro
   * nel momento in cui sono stati letti. */
  ...["map_entity", "battery_entity", "batteryEntity", "room_id", "commands", "entities"].map(
    (nome) => [nome, ["robots"]]
  )
]);
function ilModelloDecide(campo, sezione) {
  const dove = CAMPI_DECISI.get(campo);
  if (!dove) return false;
  return dove === true || dove.includes(sezione);
}
function valoreDaTenere(valore) {
  if (typeof valore === "string") return valore.trim() ? valore.trim() : void 0;
  if (typeof valore === "number") return Number.isFinite(valore) ? valore : void 0;
  if (typeof valore === "boolean") return valore;
  if (Array.isArray(valore)) return valore.length ? cloneValue(valore) : void 0;
  if (valore && typeof valore === "object" && Object.keys(valore).length) return cloneValue(valore);
  return void 0;
}
function conservaIlConfigurato(uscita = {}, ingresso = {}, sezione = "") {
  if (!ingresso || typeof ingresso !== "object" || Array.isArray(ingresso)) return uscita;
  for (const [campo, valore] of Object.entries(ingresso)) {
    if (campo in uscita || ilModelloDecide(campo, sezione)) continue;
    const tenuto = valoreDaTenere(valore);
    if (tenuto !== void 0) uscita[campo] = tenuto;
  }
  return uscita;
}
function deviceEntities(device = {}) {
  const explicit2 = [
    device.control_entity,
    device.power_entity,
    device.energy_entity,
    device.daily_energy_entity,
    device.monthly_energy_entity,
    device.total_energy_entity,
    device.history_entity,
    device.entity
  ];
  return [
    ...new Set(
      explicit2.concat(device.entities || []).map((value) => typeof value === "string" ? value : value?.entity).filter(Boolean)
    )
  ];
}
function getDeviceDisplayName(device = {}, states = {}, locale2 = "it") {
  const configured = String(device.name || "").trim();
  if (configured && !LEGACY_NAMES.test(configured)) return configured;
  for (const entity of deviceEntities(device)) {
    const friendly = String(states[entity]?.attributes?.friendly_name || "").trim();
    if (friendly) return friendly;
  }
  const derived = entityLabel(deviceEntities(device)[0]);
  return derived || pick("Dispositivo", "Device", locale2);
}
function getDeviceVisual(device = {}) {
  const image = String(device.image || device.image_url || "").trim();
  if (image) return { kind: "image", value: image };
  if (device.visual_type && device.visual_key)
    return { kind: device.visual_type, value: device.visual_key };
  const icon = String(device.icon || "").trim();
  if (/^mdi:[a-z0-9-]+$/i.test(icon)) return { kind: "icon", value: icon };
  const type = String(device.device_type || device.type || "").toLowerCase().trim();
  return { kind: "icon", value: TYPE_ICONS[type] || TYPE_ICONS[device.section] || "mdi:devices" };
}
function createId(section2 = "device", random = globalThis.crypto?.randomUUID?.()) {
  return `${section2}-${random || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}
function assignFiniteNumber(target, key, ...values) {
  for (const value of values) {
    if (value === "" || value == null) continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      target[key] = numeric;
      return;
    }
  }
}
function normalizeDevice(input = {}, section2, context = {}) {
  const entities = deviceEntities(input);
  const explicitRoomId = input.room_id || input.roomId || "";
  const legacyRoomRef = input.room || "";
  const matchedRoom = context.rooms?.find(
    (room) => room.id === legacyRoomRef || room.name === legacyRoomRef
  );
  const roomId = explicitRoomId || matchedRoom?.id || "";
  const stanzaDellId = context.rooms?.find((room) => room.id === roomId || room.name === roomId);
  const riferimentoLegacy = roomId && stanzaDellId && stanzaDellId.name !== legacyRoomRef && stanzaDellId.id !== legacyRoomRef ? stanzaDellId.name : roomId && !stanzaDellId && explicitRoomId && explicitRoomId !== legacyRoomRef ? "" : legacyRoomRef;
  const rawIcon = String(input.icon || "");
  const emoji = !rawIcon.startsWith("mdi:") && /[^\x00-\x7f]/.test(rawIcon) ? rawIcon : String(input.emoji_icon || "");
  const type = input.device_type || input.type || (!rawIcon.startsWith("mdi:") && !emoji ? rawIcon : "");
  const visualKey = legacyVisualKey(input, rawIcon, type);
  const name = LEGACY_NAMES.test(String(input.name || "").trim()) ? "" : String(input.name || "").trim();
  const image = String(input.image || input.image_url || "");
  const base = {
    id: String(input.id || createId(section2)),
    section: section2,
    name,
    icon: /^mdi:/i.test(rawIcon) ? rawIcon : "",
    image,
    image_url: image,
    visual_type: String(input.visual_type || (visualKey ? "asset" : "")),
    visual_key: String(visualKey || input.visual_key || ""),
    emoji_icon: emoji,
    room_id: String(roomId),
    /* Quello che l'utente ha scritto, non quello a cui siamo riusciti a
     * risolverlo.
     *
     * `room_id` viene dall'id della stanza trovata, e una stanza senza id — una
     * configurazione scritta a mano, o un salvataggio piu' vecchio dell'id —
     * lasciava `room_id` vuoto: l'assegnazione spariva senza che nessuno lo
     * dicesse, e il dispositivo finiva senza stanza pur avendone una scritta
     * accanto. Mezza dozzina di sezioni infatti leggono gia' `item.room ||
     * item.room_id`, aspettandosi che il riferimento originale ci sia ancora.
     * Adesso c'e'. Non sostituisce l'id: gli sta accanto, e serve solo a chi
     * l'id non lo trova. */
    room: String(riferimentoLegacy || ""),
    entities,
    enabled: input.enabled !== false,
    order: Number.isFinite(+input.order) ? +input.order : context.index || 0,
    metadata: { ...input.metadata || {} }
  };
  if (input.entity || entities[0]) base.entity = String(input.entity || entities[0]);
  const immagine = immaginePulita(input.immagine);
  if (immagine) base.immagine = immagine;
  if (section2 === "climate") {
    base.type = canonicalClimateType(input.type);
    if (input.valvola) base.valvola = String(input.valvola);
  }
  if (input.stream || input.stream_url || input.url)
    base.stream = String(input.stream || input.stream_url || input.url);
  if (section2 === "cameras") {
    const rtsp = String(input.rtsp || "").trim();
    if (rtsp) base.rtsp = rtsp;
    if (input.vivo !== void 0 && input.vivo !== null && input.vivo !== "")
      base.vivo = input.vivo === true || input.vivo === "true" || input.vivo === 1 || input.vivo === "1";
  }
  if (section2 === "covers") {
    const contact = contactEntity(input);
    if (contact) base.contact = contact;
    const inferriata = inferriataEntity(input);
    if (inferriata) base.inferriata = inferriata;
    const kind = declaredCoverKind(input);
    if (kind) base.kind = kind;
    for (const { campo, giu } of COVER_SLOTS) {
      if (campo !== "entity") {
        const entity = String(input?.[campo] ?? "").trim();
        if (entity) base[campo] = entity;
      }
      if (!giu || giu === "down") continue;
      const discesa = String(input?.[giu] ?? "").trim();
      if (discesa) base[giu] = discesa;
    }
    const preset = coverPresetPosition(input);
    if (preset != null) base.preset = preset;
    const down = coverDownRelay(input);
    if (down) base.down = down;
    const sogliaScritta = input?.soglia;
    if (sogliaScritta !== null && sogliaScritta !== void 0 && String(sogliaScritta).trim()) {
      const quota = Number(sogliaScritta);
      if (Number.isFinite(quota)) base.soglia = coverClosedThreshold(quota);
    }
  }
  if (input.threshold_run != null) base.metadata.threshold_run = +input.threshold_run;
  if (input.threshold_standby != null) base.metadata.threshold_standby = +input.threshold_standby;
  if (section2 === "ev") {
    const legacy = cloneValue(input) || {};
    const overrideSource = input.ov && typeof input.ov === "object" && !Array.isArray(input.ov) ? input.ov : input.overrides && typeof input.overrides === "object" && !Array.isArray(input.overrides) ? input.overrides : {};
    const evImage = input.img !== void 0 && input.img !== null ? String(input.img) : String(input.image || input.image_url || "");
    return {
      ...legacy,
      ...base,
      name: base.name || String(input.name || "").trim(),
      icon: base.icon || String(input.icon || ""),
      image: evImage,
      image_url: evImage,
      img: evImage,
      brand: String(input.brand || ""),
      ov: cloneValue(overrideSource),
      overrides: cloneValue(overrideSource)
    };
  }
  if (section2 === "appliances" || section2 === "loads") {
    Object.assign(base, {
      power_entity: input.power_entity || input.power || "",
      energy_entity: input.energy_entity || input.energy || "",
      daily_energy_entity: input.daily_energy_entity || input.daily_energy || input.energy_today || "",
      monthly_energy_entity: input.monthly_energy_entity || input.monthly_energy || "",
      total_energy_entity: input.total_energy_entity || input.total_energy || "",
      history_entity: input.history_entity || input.history || "",
      control_entity: input.control_entity || input.switch_entity || input.switch || input.light || "",
      state_entity: input.state_entity || input.state || "",
      show_in_report: input.show_in_report !== false,
      show_in_dashboard: input.show_in_dashboard !== false,
      /* Il tasto acceso/spento della card si puo' togliere per apparecchio:
       * «aggiungere la possibilita' di disabilitare lo switch on/off» — c'e'
       * chi mappa l'interruttore per leggere lo stato ma non vuole che il
       * frigo si spenga da una card. Il campo passa di qui o sparisce alla
       * prima normalizzazione, come e' gia' successo tre volte. */
      switch_disabled: input.switch_disabled === true,
      report_label: String(input.report_label || ""),
      report_icon: String(input.report_icon || emoji),
      report_entity: String(input.report_entity || ""),
      report_order: Number.isFinite(+input.report_order) ? +input.report_order : context.index || 0,
      category: String(input.category || type || (section2 === "loads" ? "secondary" : "appliance")),
      device_type: String(type || (section2 === "loads" ? "secondary" : "appliance")).toLowerCase(),
      // Appliance card (showcase) contract: countdown, temperature, alarm and
      // last-cycle sources are first-class persisted fields, so the section
      // renderer and the config editor share one canonical schema.
      remaining_entity: input.remaining_entity || input.remaining_time_entity || "",
      cycle_duration_entity: input.cycle_duration_entity || "",
      temperature_entity: input.temperature_entity || input.temp_entity || "",
      /* Un frigorifero smart ne pubblica cinque, di temperature: ambiente,
       * obiettivo e attuale del frigo, obiettivo e attuale del congelatore.
       * Due sono quelle che si guardano, e con una casella sola se ne poteva
       * dire una. */
      temperature_entity_2: input.temperature_entity_2 || input.temp_entity_2 || "",
      alert_entity: input.alert_entity || input.problem_entity || "",
      last_start_entity: input.last_start_entity || input.start_time_entity || "",
      last_duration_entity: input.last_duration_entity || "",
      last_energy_entity: input.last_energy_entity || "",
      last_cost_entity: input.last_cost_entity || ""
    });
    const impianto = String(input[LOAD_PLANT_FIELD] ?? "").trim();
    if (impianto) base[LOAD_PLANT_FIELD] = impianto;
    assignFiniteNumber(base, "threshold_run", input.threshold_run, input.metadata?.threshold_run);
    assignFiniteNumber(
      base,
      "threshold_standby",
      input.threshold_standby,
      input.metadata?.threshold_standby
    );
    assignFiniteNumber(base, "cycle_minutes", input.cycle_minutes);
    assignFiniteNumber(base, "off_delay_minutes", input.off_delay_minutes);
    assignFiniteNumber(base, "temp_min", input.temp_min);
    assignFiniteNumber(base, "temp_max", input.temp_max);
    assignFiniteNumber(base, "max_power", input.max_power);
    assignFiniteNumber(base, "price_kwh", input.price_kwh);
    for (const key of APPLIANCE_BINDING_FIELDS) {
      const value = String(input[key] ?? "").trim();
      if (value) base[key] = value;
    }
    const deviceEntityIds = [
      ...new Set(
        (Array.isArray(input.device_entities) ? input.device_entities : []).map((value) => String(typeof value === "string" ? value : value?.entity_id || "").trim()).filter((value) => value.includes("."))
      )
    ];
    if (deviceEntityIds.length) base.device_entities = deviceEntityIds;
  }
  const { immagine: _grezza, ...resto } = input;
  return conservaIlConfigurato(base, resto, section2);
}

// src/core/scrivere-se-cambia.js
function attributoSeCambia(nodo, nome, valore) {
  if (!nodo?.getAttribute) return false;
  const testo2 = String(valore ?? "");
  if (nodo.getAttribute(nome) === testo2) return false;
  nodo.setAttribute(nome, testo2);
  return true;
}
function classeSeCambia(nodo, classe, acceso) {
  const lista = nodo?.classList;
  if (!lista) return false;
  if (lista.contains(classe) === Boolean(acceso)) return false;
  if (acceso) lista.add(classe);
  else lista.remove(classe);
  return true;
}

// src/core/catalogo-disegni.js
var CORPI = Object.freeze({
  home: `${PANNELLO}<path ${SCOCCA} d="M48 12 14 41v39a6 6 0 0 0 6 6h56a6 6 0 0 0 6-6V41z"/><path ${FRONTALE} d="M40 56h16v30H40z"/><rect ${VETRO} x="24" y="48" width="12" height="12" rx="3"/><rect ${VETRO} x="60" y="48" width="12" height="12" rx="3"/><circle ${ACCENTO} cx="52" cy="71" r="2.6"/>`,
  lights: `${PANNELLO}<path ${CALDO} d="M48 12c14 0 23 10 23 22 0 9-5 13-8 19H33c-3-6-8-10-8-19 0-12 9-22 23-22Z"/><path ${SCOCCA} d="M33 58h30v8H33z" rx="3"/><rect ${SCOCCA} x="35" y="68" width="26" height="7" rx="3"/><rect ${SCOCCA} x="38" y="77" width="20" height="7" rx="3"/><path ${TRATTO_CHIARO} d="M41 30c3-4 8-6 13-5"/>`,
  "lights-group": `${PANNELLO}<path ${CALDO} d="M31 15c10 0 16 7 16 15 0 6-3 9-5 13H20c-2-4-5-7-5-13 0-8 6-15 16-15Z"/><rect ${SCOCCA} x="21" y="45" width="20" height="6" rx="3"/><rect ${SCOCCA} x="24" y="53" width="14" height="5" rx="2.5"/><path ${CALDO} d="M67 34c10 0 16 7 16 15 0 6-3 9-5 13H56c-2-4-5-7-5-13 0-8 6-15 16-15Z"/><rect ${SCOCCA} x="57" y="64" width="20" height="6" rx="3"/><rect ${SCOCCA} x="60" y="72" width="14" height="5" rx="2.5"/>`,
  radiator: `${PANNELLO}<rect ${SCOCCA} x="14" y="22" width="68" height="52" rx="10"/><rect ${FRONTALE} x="22" y="29" width="7" height="38" rx="3.5"/><rect ${FRONTALE} x="34" y="29" width="7" height="38" rx="3.5"/><rect ${FRONTALE} x="46" y="29" width="7" height="38" rx="3.5"/><rect ${FRONTALE} x="58" y="29" width="7" height="38" rx="3.5"/><rect ${ACCENTO} x="70" y="29" width="7" height="38" rx="3.5"/><path ${TRATTO} d="M26 80h44"/>`,
  security: `${PANNELLO}<path ${SCOCCA} d="M48 10 18 22v24c0 18 12 32 30 40 18-8 30-22 30-40V22z"/><path ${TRATTO_CHIARO} d="M34 47l10 11 19-21"/>`,
  /* La porta, che non c'era.
   *
   * C'era solo il cancello, e teneva per se' anche l'emoji della porta: chi
   * configurava una porta si ritrovava le stecche del cancello. */
  door: `${PANNELLO}<rect ${SCOCCA} x="24" y="12" width="48" height="72" rx="8"/><rect ${FRONTALE} x="31" y="19" width="34" height="58" rx="5"/><circle ${ACCENTO} cx="58" cy="50" r="3.6"/><path ${TRATTO_CHIARO} d="M38 26h20M38 34h20"/>`,
  gate: `${PANNELLO}<rect ${SCOCCA} x="12" y="24" width="8" height="56" rx="4"/><rect ${SCOCCA} x="76" y="24" width="8" height="56" rx="4"/><rect ${FRONTALE} x="24" y="34" width="48" height="38" rx="6"/><path ${TRATTO} d="M32 34v38M42 34v38M52 34v38M62 34v38M24 53h48"/>`,
  shutters: `${PANNELLO}<rect ${SCOCCA} x="14" y="14" width="68" height="66" rx="10"/><rect ${FRONTALE} x="21" y="21" width="54" height="52" rx="6"/><path ${TRATTO} d="M25 31h46M25 41h46M25 51h46M25 61h46"/><rect ${ACCENTO} x="38" y="76" width="20" height="6" rx="3"/>`,
  scene: `${PANNELLO}<rect ${SCOCCA} x="12" y="30" width="72" height="50" rx="9"/><path ${FRONTALE} d="M12 30l14-14h12L24 30zM40 30l14-14h12L52 30zM68 30l14-14h2v14z"/><path ${ACCENTO} d="M42 46l20 11-20 11z"/>`,
  script: `${PANNELLO}<rect ${SCOCCA} x="18" y="12" width="52" height="72" rx="10"/><rect ${FRONTALE} x="25" y="19" width="38" height="58" rx="6"/><path ${TRATTO} d="M32 30h24M32 40h24M32 50h14"/><circle ${ACCENTO} cx="66" cy="66" r="15"/><path ${TRATTO_CHIARO} d="M62 60l10 6-10 6z"/>`,
  toggle: `${PANNELLO}<rect ${SCOCCA} x="12" y="32" width="72" height="34" rx="17"/><circle ${FRONTALE} cx="66" cy="49" r="12"/><circle ${ACCENTO} cx="66" cy="49" r="5"/><path ${TRATTO_CHIARO} d="M26 43v12"/>`,
  power: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="50" r="32"/><path ${TRATTO_CHIARO} stroke-width="7" d="M48 28v20"/><path ${TRATTO_ACCENTO} stroke-width="7" d="M33 39a19 19 0 1 0 30 0"/>`,
  ev: `${PANNELLO}<path ${SCOCCA} d="M20 56l6-16a8 8 0 0 1 7-5h26a8 8 0 0 1 7 5l6 16v14a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5v-3H34v3a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z"/><path ${FRONTALE} d="M30 42h36l4 11H26z"/><circle ${VETRO} cx="32" cy="62" r="4"/><circle ${VETRO} cx="64" cy="62" r="4"/><path ${CALDO} d="M50 14l-9 14h7l-3 11 11-15h-7z"/>`,
  /* La moto (#75): di profilo, perche' una moto vista di fronte non la
   * riconosce nessuno. Tutto a masse piene e niente tratti sottili — a
   * trentaquattro pixel, che e' la misura vera nella riga della scheda, un
   * tratto da tre si perde e resta una bicicletta. */
  moto: `${PANNELLO}<circle ${SCOCCA} cx="30" cy="68" r="16"/><circle ${SPENTO} cx="30" cy="68" r="6.5"/><circle ${SCOCCA} cx="68" cy="68" r="16"/><circle ${SPENTO} cx="68" cy="68" r="6.5"/><path ${SCOCCA} d="M30 68 46 44h14l10 24H56l-7-10H40z"/><path ${SCOCCA} d="M36 41h26a5 5 0 0 1 5 5v8H36a5 5 0 0 1-5-5v-3a5 5 0 0 1 5-5z"/><rect ${ACCENTO} x="28" y="32" width="22" height="9" rx="4.5"/><path ${SCOCCA} d="M64 30h18a3.5 3.5 0 0 1 0 7h-7l-4 29h-7l5-33a3.5 3.5 0 0 1 3.5-3z"/>`,
  water: `${PANNELLO}<path ${VETRO} d="M48 12c14 18 22 29 22 38a22 22 0 0 1-44 0c0-9 8-20 22-38Z"/><path ${TRATTO_CHIARO} d="M37 52c0 8 5 13 11 14"/>`,
  camera: `${PANNELLO}<rect ${SCOCCA} x="12" y="28" width="56" height="40" rx="9"/><path ${SCOCCA} d="M68 42l16-9v30l-16-9z"/><circle ${FRONTALE} cx="34" cy="48" r="12"/><circle ${VETRO} cx="34" cy="48" r="6"/><circle ${ACCENTO} cx="57" cy="37" r="3.2"/>`,
  bell: `${PANNELLO}<path ${SCOCCA} d="M48 14a20 20 0 0 1 20 20v18l6 10H22l6-10V34a20 20 0 0 1 20-20Z"/><rect ${FRONTALE} x="34" y="36" width="28" height="10" rx="5"/><path ${ACCENTO} d="M40 68h16a8 8 0 0 1-16 0Z"/><circle ${ACCENTO} cx="48" cy="12" r="4"/>`,
  star: `${PANNELLO}<path ${CALDO} d="M48 14l10 21 23 3-17 16 4 23-20-11-20 11 4-23-17-16 23-3z"/><path ${TRATTO_CHIARO} d="M42 34l6-12 6 12"/>`,
  "heat-pump": `${PANNELLO}<rect ${SCOCCA} x="12" y="22" width="72" height="52" rx="10"/><circle ${FRONTALE} cx="48" cy="48" r="19"/><path ${ACCENTO} d="M48 34c8-2 12 4 10 9-2 4-7 3-10-1zM60 52c2 8-4 12-9 10-4-2-3-7 1-10zM36 52c-4 6-1 12 4 12 4 0 6-4 5-9z"/><circle ${SCOCCA} cx="48" cy="48" r="4"/><path ${TRATTO} d="M22 80h52"/>`,
  "floor-heating": `${PANNELLO}<rect ${SCOCCA} x="12" y="46" width="72" height="34" rx="8"/><path ${TRATTO_CHIARO} d="M22 72c0-8 8-8 8-16s8-8 8 0 8 8 8 16"/><path ${TRATTO_ACCENTO} d="M54 72c0-8 8-8 8-16s8-8 8 0"/><path ${CALDO} d="M40 14c6 6 8 11 5 16 5-1 8-5 8-10 6 6 8 13 4 19H33c-4-8-1-19 7-25Z"/>`,
  grill: `${PANNELLO}<path ${SCOCCA} d="M16 42h64a32 32 0 0 1-64 0Z"/><path ${TRATTO} d="M28 68l6-14M68 68l-6-14M48 72V56"/><path ${CALDO} d="M48 10c5 5 6 10 4 14 4-1 6-4 6-8 5 5 6 11 3 16H37c-3-7-1-16 11-22Z"/><path ${TRATTO_CHIARO} d="M26 42h44"/>`,
  dehumidifier: `${PANNELLO}<rect ${SCOCCA} x="20" y="12" width="56" height="72" rx="12"/><rect ${FRONTALE} x="27" y="19" width="42" height="28" rx="7"/><path ${VETRO} d="M48 24c7 9 11 14 11 19a11 11 0 0 1-22 0c0-5 4-10 11-19Z"/><path ${TRATTO_CHIARO} d="M31 58h34M31 68h34"/><circle ${ACCENTO} cx="65" cy="76" r="3.2"/>`,
  computer: `${PANNELLO}<rect ${SCOCCA} x="10" y="18" width="76" height="50" rx="9"/><rect ${VETRO} x="17" y="25" width="62" height="36" rx="5"/><path ${SCOCCA} d="M40 68h16v8H40z"/><rect ${SCOCCA} x="28" y="76" width="40" height="7" rx="3.5"/><path ${TRATTO_ACCENTO} d="M27 35h20M27 44h30"/>`,
  server: `${PANNELLO}<rect ${SCOCCA} x="14" y="14" width="68" height="22" rx="7"/><rect ${SCOCCA} x="14" y="42" width="68" height="22" rx="7"/><rect ${SCOCCA} x="14" y="70" width="68" height="16" rx="7"/><circle ${VERDE} cx="26" cy="25" r="3.4"/><circle ${VERDE} cx="26" cy="53" r="3.4"/><circle ${ACCENTO} cx="26" cy="78" r="3.4"/><path ${TRATTO_CHIARO} d="M40 25h30M40 53h30M40 78h22"/>`,
  router: `${PANNELLO}<rect ${SCOCCA} x="14" y="52" width="68" height="26" rx="9"/><circle ${VERDE} cx="27" cy="65" r="3.4"/><circle ${ACCENTO} cx="39" cy="65" r="3.4"/><path ${TRATTO} d="M62 52V34M74 52V38"/><path ${TRATTO_ACCENTO} d="M30 40c5-6 12-10 20-10M24 30c8-9 18-14 30-14"/>`,
  printer: `${PANNELLO}<rect ${FRONTALE} x="28" y="12" width="40" height="20" rx="4"/><rect ${SCOCCA} x="14" y="30" width="68" height="34" rx="9"/><circle ${ACCENTO} cx="26" cy="42" r="3.4"/><path ${TRATTO_CHIARO} d="M40 42h30"/><rect ${FRONTALE} x="28" y="60" width="40" height="24" rx="4"/><path ${TRATTO} d="M36 68h24M36 76h16"/>`,
  solar: `${PANNELLO}<circle ${CALDO} cx="70" cy="24" r="11"/><path ${SCOCCA} d="M22 76l14-38h38l-8 38z"/><path ${TRATTO_CHIARO} d="M34 57h40M45 38l-8 38M60 38l-6 38"/><path ${TRATTO} d="M30 84h44"/>`,
  battery: `${PANNELLO}<rect ${SCOCCA} x="18" y="20" width="60" height="60" rx="11"/><rect ${SCOCCA} x="38" y="12" width="20" height="9" rx="4"/><rect ${VERDE} x="25" y="45" width="46" height="28" rx="6"/><path ${CALDO} d="M52 28l-13 20h9l-3 14 14-20h-9z"/>`,
  /* L'addolcitore (#570): il bidone del sale, con la sua finestrella.
   *
   * «Ho un sensore che mi controlla lo stato in % e in cm del livello del sale
   * addolcitore. Sarebbe possibile integrarlo da qualche parte?» Una tessera
   * ce l'ha gia' — «In evidenza» — ma un disegno suo no, e senza disegno
   * l'unica scelta era un'emoji di sistema in mezzo alle scocche. La finestra
   * con dentro il livello e' esattamente la cosa che quel sensore misura. */
  softener: `${PANNELLO}<rect ${SCOCCA} x="26" y="20" width="44" height="64" rx="12"/><rect ${SCOCCA} x="32" y="12" width="32" height="12" rx="6"/><rect ${FRONTALE} x="35" y="32" width="26" height="44" rx="7"/><rect ${VETRO} x="35" y="54" width="26" height="22" rx="7"/><circle ${ACCENTO} cx="42" cy="50" r="3"/><circle ${ACCENTO} cx="50" cy="45" r="2.4"/><circle ${ACCENTO} cx="56" cy="51" r="2.6"/><path ${TRATTO_CHIARO} d="M40 66h16"/>`,
  pump: `${PANNELLO}<circle ${SCOCCA} cx="44" cy="50" r="27"/><circle ${FRONTALE} cx="44" cy="50" r="16"/><path ${ACCENTO} d="M44 38c7 0 11 5 10 10l-10 2zM56 56c-3 6-9 8-13 5l6-9zM32 56c-4-5-3-11 2-13l4 9z"/><circle ${SCOCCA} cx="44" cy="50" r="4"/><rect ${SCOCCA} x="66" y="34" width="14" height="14" rx="4"/><path ${TRATTO} d="M20 82h56"/>`,
  /* I contatori di casa (#115, #135, #137): il contatore con la sua finestra
   * delle cifre, il manometro della pressione, la fiamma del gas. Il gas aveva
   * solo il rilevatore di fughe — «gas» porta al fumo, ed è giusto lì — e un
   * contatore da cui si legge la bolletta non è un allarme. */
  meter: `${PANNELLO}<rect ${SCOCCA} x="8" y="42" width="14" height="14" rx="4"/><rect ${SCOCCA} x="74" y="42" width="14" height="14" rx="4"/><circle ${SCOCCA} cx="48" cy="49" r="30"/><circle ${FRONTALE} cx="48" cy="49" r="22"/><rect ${SCOCCA} x="33.5" y="34" width="29" height="11" rx="3"/><rect ${FRONTALE} x="35.5" y="36" width="5.5" height="7" rx="1.5"/><rect ${FRONTALE} x="42.5" y="36" width="5.5" height="7" rx="1.5"/><rect ${FRONTALE} x="49.5" y="36" width="5.5" height="7" rx="1.5"/><rect ${ACCENTO} x="56.5" y="36" width="4.5" height="7" rx="1.5"/><path ${ACCENTO} d="M48 51c4 5 6.5 8 6.5 11a6.5 6.5 0 0 1-13 0c0-3 2.5-6 6.5-11Z"/>`,
  gauge: `${PANNELLO}<rect ${SCOCCA} x="42" y="70" width="12" height="14" rx="3"/><rect ${SCOCCA} x="34" y="80" width="28" height="7" rx="3.5"/><circle ${SCOCCA} cx="48" cy="44" r="30"/><circle ${FRONTALE} cx="48" cy="44" r="23"/><path ${TRATTO} d="M35 57a18 18 0 1 1 26 0"/><path ${TRATTO_ACCENTO} d="M48 44 60 32"/><circle ${SCOCCA} cx="48" cy="44" r="4.5"/>`,
  /* Il boiler dell'acqua calda: il serbatoio alto e tondo, il termometro a
   * quadrante in cima, la goccia calda sul frontale, i due tubi e i piedini.
   *
   * «Icona boiler: che c'entra con il bidone?» La finestra del solare termico
   * metteva il boiler come 🛢️, il fusto del petrolio — l'unica cosa che un
   * accumulo d'acqua calda non e'. Qui c'e' il serbatoio vero, nella scocca
   * blu notte come il termosifone e il manometro accanto. */
  boiler: `${PANNELLO}<path ${TRATTO} d="M66 34h14M66 64h14"/><rect ${SCOCCA} x="26" y="9" width="44" height="74" rx="21"/><circle ${FRONTALE} cx="48" cy="25" r="8.5"/><path ${TRATTO_ACCENTO} d="M48 25l4.5-4.5"/><circle ${SCOCCA} cx="48" cy="25" r="2"/><rect ${FRONTALE} x="33" y="39" width="30" height="36" rx="13"/><path ${CALDO} d="M48 44c6.5 7.5 9.5 12 9.5 16.5a9.5 9.5 0 0 1-19 0c0-4.5 3-9 9.5-16.5Z"/><path ${TRATTO_CHIARO} stroke-width="2.4" d="M44.5 61.5a4 4 0 0 0 3 3.6"/><path ${TRATTO} d="M35 83v6M61 83v6"/>`,
  flame: `${PANNELLO}<rect ${SCOCCA} x="22" y="70" width="52" height="10" rx="5"/><rect ${SCOCCA} x="30" y="80" width="36" height="6" rx="3"/><path ${ACCENTO} d="M48 12c10 12 18 22 18 34 0 11-8 20-18 20s-18-9-18-20c0-8 5-14 9-19 1 6 4 9 7 10-2-9 0-17 2-25Z"/><path ${VETRO} d="M48 36c5 6 8 11 8 16a8 8 0 0 1-16 0c0-5 3-10 8-16Z"/>`,
  /* La pianta in vaso (#159): tre foglie e il vaso. Il catalogo aveva il fiore
   * e il giardino, ma un ficus in salotto non è né l'uno né l'altro. */
  plant: `${PANNELLO}<path fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" d="M48 56V34"/><path ${VERDE} d="M47 52C44 40 36 34 24 34c2 11 10 18 23 18Z"/><path ${VERDE} d="M49 46c2-13 11-21 24-22-1 13-10 21-24 22Z"/><path ${VERDE} d="M48 36c-6-8-6-18 0-24 6 6 6 16 0 24Z"/><rect ${SCOCCA} x="28" y="56" width="40" height="9" rx="4"/><path ${SCOCCA} d="M32 63h32l-4 21H36Z"/><path ${TRATTO_CHIARO} d="M39 69l1.6 10"/>`,
  /* L'acquario (#127): la vasca con l'acqua, la sabbia, due foglie e il pesce.
   * Non è l'acqua di casa — quella è la goccia — ma la vasca che si guarda. */
  aquarium: `${PANNELLO}<rect ${SCOCCA} x="12" y="20" width="72" height="56" rx="9"/><rect ${VETRO} x="18" y="30" width="60" height="40" rx="4"/><path ${TRATTO_CHIARO} d="M23 35h50"/><path ${SPENTO} d="M18 64h60v2a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4Z"/><path ${VERDE} d="M27 65c-1-9 1-17 6-23-1 8-1 15 0 23Z"/><path ${VERDE} d="M33 65c1-7 4-12 9-15-3 5-4 10-4 15Z"/><path ${CALDO} d="M44 50c5-6 14-6 19 0-5 6-14 6-19 0Z"/><path ${CALDO} d="M63 50l7-5v10Z"/><circle ${SCOCCA} cx="49" cy="49" r="1.7"/><circle ${FRONTALE} cx="70" cy="43" r="2.2"/><circle ${FRONTALE} cx="66" cy="38.5" r="1.5"/><rect ${SCOCCA} x="20" y="76" width="56" height="8" rx="4"/>`,
  irrigation: `${PANNELLO}<rect ${SCOCCA} x="42" y="44" width="12" height="38" rx="5"/><rect ${SCOCCA} x="28" y="76" width="40" height="8" rx="4"/><path ${TRATTO_ACCENTO} d="M30 42c4-10 12-16 18-16s14 6 18 16"/><path ${VETRO} d="M24 30c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8Z"/><path ${VETRO} d="M72 30c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8Z"/><path ${VETRO} d="M48 14c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8Z"/>`,
  sauna: `${PANNELLO}<rect ${SCOCCA} x="20" y="44" width="56" height="40" rx="10"/><circle ${SPENTO} cx="36" cy="56" r="6"/><circle ${SPENTO} cx="50" cy="53" r="7"/><circle ${SPENTO} cx="63" cy="57" r="6"/><rect ${ACCENTO} x="28" y="68" width="40" height="8" rx="4"/><path ${CALDO} d="M38 34c5-5 6-10 4-14 6 3 9 9 8 14 3-2 4-5 4-8 4 4 6 9 4 14H36z"/>`,
  lift: `${PANNELLO}<rect ${SCOCCA} x="16" y="12" width="64" height="72" rx="10"/><rect ${FRONTALE} x="24" y="20" width="22" height="56" rx="5"/><rect ${FRONTALE} x="50" y="20" width="22" height="56" rx="5"/><path ${TRATTO_ACCENTO} d="M35 44l-6 8h12zM61 52l6-8H55z"/>`,
  /* ── le stanze ──────────────────────────────────────────────────────── */
  "room-living": `${PANNELLO}<path ${SCOCCA} d="M16 46c0-7 5-12 12-12h40c7 0 12 5 12 12v6H16z"/><rect ${SCOCCA} x="10" y="50" width="76" height="24" rx="8"/><rect ${FRONTALE} x="24" y="38" width="20" height="12" rx="4"/><rect ${FRONTALE} x="52" y="38" width="20" height="12" rx="4"/><path ${TRATTO} d="M22 74v8M74 74v8"/>`,
  "room-bedroom": `${PANNELLO}<path ${SCOCCA} d="M12 74V32a4 4 0 0 1 8 0v10h48c9 0 16 7 16 16v16z"/><rect ${FRONTALE} x="24" y="30" width="26" height="14" rx="6"/><rect ${VETRO} x="20" y="48" width="56" height="12" rx="5"/><path ${TRATTO} d="M16 74v8M80 74v8"/>`,
  "room-kids": `${PANNELLO}<circle ${SCOCCA} cx="48" cy="38" r="18"/><circle ${SCOCCA} cx="30" cy="24" r="8"/><circle ${SCOCCA} cx="66" cy="24" r="8"/><circle ${FRONTALE} cx="41" cy="36" r="3.4"/><circle ${FRONTALE} cx="55" cy="36" r="3.4"/><path ${TRATTO_CHIARO} d="M42 46c4 3 8 3 12 0"/><path ${SCOCCA} d="M30 60h36a10 10 0 0 1 10 10v14H20V70a10 10 0 0 1 10-10Z"/>`,
  "room-nursery": `${PANNELLO}<circle ${SCOCCA} cx="48" cy="44" r="26"/><circle ${FRONTALE} cx="39" cy="42" r="3.6"/><circle ${FRONTALE} cx="57" cy="42" r="3.6"/><path ${TRATTO_CHIARO} d="M39 54c5 4 13 4 18 0"/><path ${CALDO} d="M48 12c4 0 7 3 7 6h-14c0-3 3-6 7-6Z"/><path ${TRATTO} d="M26 78h44"/>`,
  "room-bathroom": `${PANNELLO}<path ${TRATTO} d="M48 14v18"/><path ${SCOCCA} d="M30 30h36a6 6 0 0 1 0 12H30a6 6 0 0 1 0-12Z"/><circle ${VETRO} cx="34" cy="54" r="3.4"/><circle ${VETRO} cx="48" cy="60" r="3.4"/><circle ${VETRO} cx="62" cy="54" r="3.4"/><circle ${VETRO} cx="41" cy="70" r="3.4"/><circle ${VETRO} cx="55" cy="70" r="3.4"/><path ${TRATTO_ACCENTO} d="M26 82h44"/>`,
  "room-wc": `${PANNELLO}<rect ${SCOCCA} x="26" y="14" width="44" height="20" rx="6"/><circle ${ACCENTO} cx="60" cy="24" r="4"/><path ${SCOCCA} d="M24 38h48v10a24 24 0 0 1-24 24 24 24 0 0 1-24-24z"/><path ${FRONTALE} d="M31 44h34v4a17 17 0 0 1-34 0z"/><rect ${SCOCCA} x="34" y="74" width="28" height="9" rx="4"/>`,
  "room-dining": `${PANNELLO}<rect ${SCOCCA} x="12" y="42" width="72" height="10" rx="5"/><path ${TRATTO} d="M22 52v26M74 52v26"/><path ${SCOCCA} d="M28 14h8v28h-8z"/><path ${SCOCCA} d="M60 14h8v28h-8z"/><circle ${FRONTALE} cx="48" cy="30" r="10"/><path ${TRATTO_ACCENTO} d="M30 62h36"/>`,
  "room-office": `${PANNELLO}<rect ${SCOCCA} x="10" y="46" width="76" height="10" rx="5"/><path ${TRATTO} d="M20 56v24M76 56v24"/><rect ${SCOCCA} x="30" y="20" width="38" height="26" rx="6"/><rect ${VETRO} x="35" y="25" width="28" height="16" rx="3"/><rect ${ACCENTO} x="24" y="62" width="26" height="14" rx="4"/>`,
  "room-guest": `${PANNELLO}<circle ${SCOCCA} cx="36" cy="34" r="13"/><circle ${SCOCCA} cx="63" cy="38" r="10"/><path ${SCOCCA} d="M14 82c0-13 10-22 22-22s22 9 22 22z"/><path ${ACCENTO} d="M56 82c0-10 5-17 13-17s13 7 13 17z"/>`,
  "room-entrance": `${PANNELLO}<path ${SCOCCA} d="M20 14h34a6 6 0 0 1 6 6v62a6 6 0 0 1-6 6H20z"/><path ${FRONTALE} d="M26 22h26v52H26z"/><circle ${ACCENTO} cx="46" cy="48" r="3.6"/><path ${TRATTO_ACCENTO} d="M70 48H84M78 40l8 8-8 8"/>`,
  "room-hallway": `${PANNELLO}<rect ${SCOCCA} x="26" y="12" width="44" height="72" rx="8"/><rect ${FRONTALE} x="33" y="19" width="30" height="58" rx="5"/><circle ${ACCENTO} cx="56" cy="48" r="3.6"/><path ${TRATTO} d="M20 84h56"/>`,
  "room-pantry": `${PANNELLO}<rect ${SCOCCA} x="16" y="14" width="64" height="70" rx="10"/><rect ${FRONTALE} x="23" y="22" width="50" height="18" rx="5"/><rect ${FRONTALE} x="23" y="46" width="50" height="18" rx="5"/><rect ${ACCENTO} x="29" y="26" width="10" height="10" rx="3"/><rect ${VETRO} x="45" y="26" width="10" height="10" rx="3"/><rect ${VETRO} x="29" y="50" width="10" height="10" rx="3"/><rect ${ACCENTO} x="45" y="50" width="10" height="10" rx="3"/><path ${TRATTO_CHIARO} d="M30 74h36"/>`,
  "room-wardrobe": `${PANNELLO}<path ${TRATTO} stroke-width="4" d="M20 40h56"/><path ${SCOCCA} d="M48 20a7 7 0 0 1 7 7c0 4-3 5-5 7l-2 6-2-6c-2-2-5-3-5-7a7 7 0 0 1 7-7Z"/><path ${SCOCCA} d="M48 40 24 68c-3 4-1 10 5 10h38c6 0 8-6 5-10z"/><path ${TRATTO_CHIARO} d="M36 66h24"/>`,
  "room-storage": `${PANNELLO}<rect ${SCOCCA} x="14" y="24" width="68" height="16" rx="6"/><rect ${SCOCCA} x="18" y="44" width="60" height="38" rx="8"/><rect ${FRONTALE} x="38" y="52" width="20" height="8" rx="4"/><path ${TRATTO_CHIARO} d="M28 70h40"/><rect ${ACCENTO} x="38" y="28" width="20" height="8" rx="4"/>`,
  "room-balcony": `${PANNELLO}<path ${SCOCCA} d="M14 44h68v8H14z"/><path ${TRATTO} d="M22 52v26M38 52v26M54 52v26M70 52v26"/><rect ${SCOCCA} x="14" y="76" width="68" height="8" rx="4"/><path ${VETRO} d="M26 20h44v20H26z"/><path ${TRATTO_ACCENTO} d="M48 12v8"/>`,
  "room-terrace": `${PANNELLO}<path ${SCOCCA} d="M48 12c16 0 28 11 30 24H18c2-13 14-24 30-24Z"/><path ${TRATTO} stroke-width="4" d="M48 36v42"/><rect ${SCOCCA} x="34" y="78" width="28" height="8" rx="4"/><path ${TRATTO_CHIARO} d="M32 30c4-8 10-12 16-12s12 4 16 12"/>`,
  "room-garage": `${PANNELLO}<path ${SCOCCA} d="M48 12 12 34v50h72V34z"/><rect ${FRONTALE} x="26" y="46" width="44" height="38" rx="5"/><path ${TRATTO} d="M30 56h36M30 65h36M30 74h36"/>`,
  "room-cellar": `${PANNELLO}<path ${SCOCCA} d="M34 14h28v20a14 14 0 0 1-28 0z"/><path ${ACCENTO} d="M36 22h24v11a12 12 0 0 1-24 0z"/><path ${TRATTO} stroke-width="4" d="M48 48v24"/><rect ${SCOCCA} x="32" y="72" width="32" height="8" rx="4"/>`,
  "room-attic": `${PANNELLO}<path ${SCOCCA} d="M48 12 10 44l6 8 32-27 32 27 6-8z"/><path ${SCOCCA} d="M24 52h48v32H24z"/><rect ${VETRO} x="38" y="60" width="20" height="16" rx="4"/><path ${TRATTO_CHIARO} d="M48 60v16M38 68h20"/>`,
  "room-utility": `${PANNELLO}<path ${SCOCCA} d="M63 16a18 18 0 0 0-17 24L20 66a8 8 0 0 0 11 11l26-26a18 18 0 0 0 21-24l-11 11-9-2-2-9z"/><path ${TRATTO_ACCENTO} d="M28 68h1"/><circle ${ACCENTO} cx="28" cy="69" r="3.4"/>`,
  "room-gym": `${PANNELLO}<rect ${SCOCCA} x="14" y="36" width="12" height="26" rx="5"/><rect ${SCOCCA} x="70" y="36" width="12" height="26" rx="5"/><rect ${ACCENTO} x="28" y="42" width="10" height="14" rx="4"/><rect ${ACCENTO} x="58" y="42" width="10" height="14" rx="4"/><rect ${SCOCCA} x="38" y="45" width="20" height="8" rx="4"/>`,
  "room-media": `${PANNELLO}<rect ${SCOCCA} x="12" y="24" width="72" height="48" rx="10"/><rect ${VETRO} x="19" y="31" width="58" height="34" rx="5"/><path ${ACCENTO} d="M41 40l16 8-16 8z"/><path ${TRATTO} d="M36 80h24"/>`,
  "room-garden": `${PANNELLO}<circle ${CALDO} cx="48" cy="34" r="9"/><path ${ACCENTO} d="M48 16c6 0 9 5 9 9s-4 9-9 9-9-4-9-9 3-9 9-9ZM66 34c4 5 2 11-2 14s-9 1-11-4 1-9 5-11 6-1 8 1ZM30 34c-4 5-2 11 2 14s9 1 11-4-1-9-5-11-6-1-8 1Z"/><path ${TRATTO} stroke-width="4" d="M48 46v30"/><path ${TRATTO_ACCENTO} d="M48 60c-6-2-10-6-11-11M48 68c6-2 10-6 11-11"/>`,
  "room-pool": `${PANNELLO}<path ${TRATTO} stroke-width="4" d="M32 58V32a10 10 0 0 1 20 0v26M32 40h20M32 50h20"/><path ${VETRO} d="M10 54c8 0 8 6 16 6s8-6 16-6 8 6 16 6 8-6 16-6 8 6 8 6v18a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6z"/><path ${TRATTO_CHIARO} d="M18 70c8 0 8 5 16 5s8-5 16-5 8 5 16 5 8-5 12-5"/>`,
  /* ── e le due che restavano fuori ───────────────────────────────────── */
  socket: `${PANNELLO}<rect ${SCOCCA} x="18" y="18" width="60" height="60" rx="16"/><circle ${FRONTALE} cx="48" cy="48" r="21"/><circle ${SCOCCA} cx="39" cy="44" r="4"/><circle ${SCOCCA} cx="57" cy="44" r="4"/><rect ${SCOCCA} x="44" y="56" width="8" height="6" rx="3"/>`,
  fireplace: `${PANNELLO}<rect ${SCOCCA} x="16" y="16" width="64" height="68" rx="10"/><rect ${FRONTALE} x="24" y="24" width="48" height="40" rx="7"/><path ${CALDO} d="M48 32c5 6 6 11 4 15 4-1 6-5 6-9 5 6 6 13 2 19H38c-4-9-2-19 10-25Z"/><path ${TRATTO_CHIARO} d="M30 74h36"/>`,
  /* ── Le forme che mancavano al catalogo unico ─────────────────────────
   *
   * «Rivedi completamente il catalogo nostro delle icone, fallo piu' ampio e
   * a qualsiasi parte viene richiesta una icona deve puntare sempre ed
   * esclusivamente al nostro catalogo»: le voci nuove non potevano restare
   * emoji di sistema accanto alle scocche blu notte. Stessa famiglia: il
   * riquadro, la scocca, il frontale, un accento. */
  info: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="48" r="32"/><circle ${FRONTALE} cx="48" cy="33" r="4.6"/><rect ${FRONTALE} x="43.4" y="42" width="9.2" height="24" rx="4.6"/>`,
  check: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="48" r="32"/><path ${TRATTO_CHIARO} d="M33 49l11 12 21-25"/>`,
  error: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="48" r="32"/><path ${TRATTO_CHIARO} d="M36 36l24 24M60 36 36 60"/>`,
  lock: `${PANNELLO}<path ${TRATTO} d="M34 44V34a14 14 0 0 1 28 0v10"/><rect ${SCOCCA} x="24" y="44" width="48" height="38" rx="10"/><circle ${VETRO} cx="48" cy="59" r="6"/><rect ${VETRO} x="45" y="59" width="6" height="12" rx="3"/>`,
  motion: `${PANNELLO}<circle ${SCOCCA} cx="52" cy="22" r="8"/><path ${SCOCCA} d="M44 34h10l9 18-8 4-5-9-3 15 11 12v13h-9V78l-13-13 5-24-9 6-6-8z"/><path ${TRATTO_ACCENTO} d="M74 30c5 6 5 14 0 20M20 30c-5 6-5 14 0 20"/>`,
  smoke: `${PANNELLO}<rect ${SCOCCA} x="18" y="56" width="60" height="26" rx="10"/><rect ${ACCENTO} x="27" y="65" width="10" height="8" rx="4"/><path ${TRATTO} d="M36 46c0-8 10-8 10-16s-8-8-8-14M56 46c0-6 8-7 8-14"/>`,
  /* Il terrario (le vasche dentro gli Animali): la teca di vetro con la
   * lampada sopra, la sabbia, il ramo, il sasso e il geco. È la vasca
   * dell'acquario vista da chi ci tiene un rettile: stessa scocca, dentro la
   * terra calda invece dell'acqua. */
  terrarium: `${PANNELLO}<rect ${SCOCCA} x="32" y="12" width="32" height="10" rx="5"/><path ${CALDO} d="M36 22h24l-4 7H40Z"/><rect ${SCOCCA} x="12" y="26" width="72" height="50" rx="9"/><rect ${FRONTALE} x="18" y="33" width="60" height="36" rx="4"/><path ${CALDO} d="M18 60h60v5a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4Z"/><ellipse ${SPENTO} cx="66" cy="60" rx="8" ry="4.6"/><path ${TRATTO} d="M22 58c9-6 17-9 28-18"/><path ${VERDE} d="M28 52c5-5 12-6 18-4 3 1 3 3 0 4-6 3-12 3-18 0Z"/><path fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" d="M45 50c5 0 9 3 11 7"/><circle ${SCOCCA} cx="31.5" cy="51" r="1.4"/><rect ${SCOCCA} x="20" y="76" width="56" height="8" rx="4"/>`,
  /* La lampada calda del terrario: la cupola, il bulbo acceso e il caldo che
   * scende. Non è la fiamma — quella è il gas — né la lampadina delle luci. */
  "heat-lamp": `${PANNELLO}<rect ${SCOCCA} x="44" y="10" width="8" height="14" rx="3"/><path ${SCOCCA} d="M22 46a26 26 0 0 1 52 0Z"/><path ${FRONTALE} d="M30 46a18 18 0 0 1 36 0Z" opacity=".35"/><circle ${CALDO} cx="48" cy="48" r="10"/><path fill="none" stroke="#fbbf24" stroke-width="3.4" stroke-linecap="round" d="M34 64c3 4 0 8 3 12M48 64c3 4 0 8 3 12M62 64c3 4 0 8 3 12"/>`,
  /* L'UVB: il tubo con la luce viola e i raggi. */
  uvb: `${PANNELLO}<rect ${SCOCCA} x="10" y="22" width="76" height="18" rx="9"/><rect ${FRONTALE} x="17" y="26.5" width="62" height="9" rx="4.5"/><rect ${SCOCCA} x="20" y="16" width="8" height="8" rx="2"/><rect ${SCOCCA} x="68" y="16" width="8" height="8" rx="2"/><path fill="none" stroke="#0ea5e9" stroke-width="3.4" stroke-linecap="round" d="M28 50l-5 14M48 50v18M68 50l5 14M38 50l-2 16M58 50l2 16"/>`,
  /* Il nebulizzatore: l'ugello e la nuvola di goccioline. */
  mist: `${PANNELLO}<rect ${SCOCCA} x="40" y="10" width="16" height="22" rx="5"/><path ${SCOCCA} d="M34 32h28l-5 9H39Z"/><path fill="none" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round" d="M42 46l-12 16M48 46v20M54 46l12 16"/><circle ${VETRO} cx="26" cy="70" r="4"/><circle ${VETRO} cx="38" cy="76" r="3.4"/><circle ${VETRO} cx="48" cy="80" r="4"/><circle ${VETRO} cx="58" cy="76" r="3.4"/><circle ${VETRO} cx="70" cy="70" r="4"/><circle ${VETRO} cx="33" cy="60" r="2.6"/><circle ${VETRO} cx="63" cy="60" r="2.6"/>`,
  /* L'umidità: la goccia col segno del percento. */
  humidity: `${PANNELLO}<path ${VETRO} d="M48 10c15 19 24 31 24 41a24 24 0 0 1-48 0c0-10 9-22 24-41Z"/><circle ${SCOCCA} cx="40" cy="50" r="4.6"/><circle ${SCOCCA} cx="57" cy="67" r="4.6"/><path ${TRATTO} stroke-width="4" d="M59 46 38 71"/>`,
  thermometer: `${PANNELLO}<rect ${SCOCCA} x="40" y="12" width="16" height="46" rx="8"/><circle ${SCOCCA} cx="48" cy="68" r="16"/><circle ${ACCENTO} cx="48" cy="68" r="9"/><rect ${ACCENTO} x="45" y="32" width="6" height="30" rx="3"/><path ${TRATTO} d="M62 26h8M62 36h8M62 46h8"/>`,
  sun: `${PANNELLO}<circle ${CALDO} cx="48" cy="48" r="19"/><path ${TRATTO} d="M48 12v9M48 75v9M12 48h9M75 48h9M23 23l6 6M67 67l6 6M73 23l-6 6M29 67l-6 6"/>`,
  moon: `${PANNELLO}<path ${SCOCCA} d="M60 14a34 34 0 1 0 22 44 27 27 0 0 1-22-44Z"/><circle ${CALDO} cx="70" cy="30" r="4"/><circle ${VETRO} cx="42" cy="60" r="5"/>`,
  speaker: `${PANNELLO}<rect ${SCOCCA} x="26" y="10" width="44" height="76" rx="12"/><circle ${VETRO} cx="48" cy="58" r="14"/><circle ${ACCENTO} cx="48" cy="58" r="6"/><circle ${FRONTALE} cx="48" cy="28" r="7"/>`,
  person: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="32" r="15"/><path ${SCOCCA} d="M18 84c0-17 13-27 30-27s30 10 30 27z"/><path ${TRATTO_CHIARO} d="M40 30c2-3 6-4 9-3"/>`,
  pet: `${PANNELLO}<ellipse ${SCOCCA} cx="48" cy="62" rx="17" ry="14"/><ellipse ${SCOCCA} cx="27" cy="42" rx="8" ry="11"/><ellipse ${SCOCCA} cx="69" cy="42" rx="8" ry="11"/><ellipse ${SCOCCA} cx="38" cy="26" rx="8" ry="11"/><ellipse ${SCOCCA} cx="58" cy="26" rx="8" ry="11"/><circle ${ACCENTO} cx="48" cy="60" r="5"/>`,
  package: `${PANNELLO}<path ${SCOCCA} d="M48 10 82 28v40L48 86 14 68V28z"/><path ${FRONTALE} d="M48 30 68 41v22L48 74 28 63V41z"/><path ${TRATTO} d="M28 41 48 52l20-11M48 52v22"/>`,
  mail: `${PANNELLO}<rect ${SCOCCA} x="12" y="26" width="72" height="46" rx="10"/><path ${TRATTO_CHIARO} d="m16 32 32 22 32-22"/><rect ${ACCENTO} x="62" y="16" width="16" height="16" rx="8"/>`,
  phone: `${PANNELLO}<rect ${SCOCCA} x="27" y="8" width="42" height="80" rx="12"/><rect ${VETRO} x="33" y="20" width="30" height="50" rx="6"/><rect ${FRONTALE} x="42" y="76" width="12" height="4" rx="2"/>`,
  /* Il calendario da parete: gli anelli, la testata e i giorni. Prima
   * `calendar` rispondeva col cronometro, che e' un'altra cosa: chi chiedeva
   * un calendario si vedeva un orologio, e nei rifiuti restava l'emoji. */
  calendar: `${PANNELLO}<rect ${SCOCCA} x="30" y="10" width="6" height="16" rx="3"/><rect ${SCOCCA} x="60" y="10" width="6" height="16" rx="3"/><rect ${SCOCCA} x="14" y="18" width="68" height="64" rx="11"/><rect ${ACCENTO} x="14" y="18" width="68" height="14" rx="7"/><rect ${FRONTALE} x="21" y="38" width="54" height="37" rx="6"/><rect ${SCOCCA} x="27" y="45" width="9" height="8" rx="2.5" opacity=".55"/><rect ${SCOCCA} x="43" y="45" width="9" height="8" rx="2.5" opacity=".55"/><rect ${ACCENTO} x="59" y="45" width="9" height="8" rx="2.5"/><rect ${SCOCCA} x="27" y="59" width="9" height="8" rx="2.5" opacity=".55"/><rect ${SCOCCA} x="43" y="59" width="9" height="8" rx="2.5" opacity=".55"/><rect ${SCOCCA} x="59" y="59" width="9" height="8" rx="2.5" opacity=".55"/>`,
  timer: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="54" r="30"/><circle ${FRONTALE} cx="48" cy="54" r="22"/><path ${TRATTO} d="M48 40v14l10 7"/><rect ${SCOCCA} x="38" y="10" width="20" height="9" rx="4.5"/>`,
  cart: `${PANNELLO}<path ${TRATTO} d="M14 20h10l10 38h34l9-26H30"/><circle ${SCOCCA} cx="38" cy="76" r="8"/><circle ${SCOCCA} cx="66" cy="76" r="8"/><rect ${ACCENTO} x="44" y="36" width="26" height="6" rx="3"/>`,
  list: `${PANNELLO}<rect ${SCOCCA} x="18" y="12" width="60" height="72" rx="12"/><rect ${FRONTALE} x="26" y="22" width="44" height="52" rx="8"/><path ${TRATTO_ACCENTO} d="m33 38 5 5 9-10M33 58l5 5 9-10"/><path ${TRATTO} d="M53 40h12M53 60h12"/>`,
  key: `${PANNELLO}<circle ${SCOCCA} cx="34" cy="38" r="18"/><circle ${VETRO} cx="34" cy="38" r="7"/><path ${SCOCCA} d="M45 48 78 81l-9 9-8-8-6 6-7-7 6-6-9-9z"/>`,
  tools: `${PANNELLO}<path ${SCOCCA} d="M22 68 52 38l-6-6a16 16 0 0 1 20-20l-9 9 8 8 9-9a16 16 0 0 1-20 20l-6-6-30 30z"/><circle ${ACCENTO} cx="26" cy="72" r="6"/>`,
  heart: `${PANNELLO}<path ${ACCENTO} d="M48 82 20 55a17 17 0 0 1 24-24l4 4 4-4a17 17 0 0 1 24 24z"/><path ${TRATTO_CHIARO} d="M28 50h12l4-8 6 16 5-8h13"/>`,
  wind: `${PANNELLO}<path ${TRATTO} d="M14 34h34a10 10 0 1 0-10-10"/><path ${TRATTO} d="M14 50h46a10 10 0 1 1-10 10"/><path ${TRATTO_ACCENTO} d="M14 66h26a8 8 0 1 1-8 8"/>`,
  broom: `${PANNELLO}<path ${TRATTO} d="M62 14 40 44"/><path ${SCOCCA} d="M30 44h26l10 26a6 6 0 0 1-6 8H26a6 6 0 0 1-6-8z"/><path ${TRATTO_CHIARO} d="M30 58v18M40 58v18M50 58v18"/>`,
  refresh: `${PANNELLO}<path ${TRATTO} d="M76 48a28 28 0 1 1-9-20"/><path ${SCOCCA} d="M72 6h8v22H58z"/>`,
  /* ── i programmi della lavatrice ───────────────────────────────────────
   *
   * «Crea anche nel nostro catalogo delle icone che possono essere utilizzate
   * per i programmi della lavatrice»: i tasti del popup si battezzano uno per
   * uno, e finora l'unico disegno pertinente era il cesto. Questi sono i
   * programmi che una lavatrice ha davvero, nella stessa famiglia di tutto il
   * resto: stesso riquadro, stessa scocca, stesso accento. */
  /* Cotone: la maglietta, che e' il capo che tutti riconoscono. */
  "wash-cotton": `${PANNELLO}<path ${SCOCCA} d="M38 20h20l18 10-8 14-8-4v34a4 4 0 0 1-4 4H40a4 4 0 0 1-4-4V40l-8 4-8-14z"/><path ${TRATTO_CHIARO} d="M40 21c2 6 14 6 16 0"/><circle ${ACCENTO} cx="48" cy="62" r="4"/>`,
  /* Sintetici: la camicia col collo aperto e i bottoni. */
  "wash-synthetic": `${PANNELLO}<path ${SCOCCA} d="M36 18h24l16 12-9 12-5-3v37a4 4 0 0 1-4 4H38a4 4 0 0 1-4-4V39l-5 3-9-12z"/><path ${TRATTO_CHIARO} d="M40 19l8 12 8-12M48 40v34"/><circle ${ACCENTO} cx="48" cy="50" r="2.6"/><circle ${ACCENTO} cx="48" cy="64" r="2.6"/>`,
  /* Lana: il gomitolo con il filo che scappa. */
  "wash-wool": `${PANNELLO}<circle ${SCOCCA} cx="46" cy="52" r="26"/><path ${TRATTO_CHIARO} d="M28 36c14 4 26 16 30 30M36 28c12 6 24 20 26 34M24 50c10 2 20 10 24 22"/><path ${TRATTO_ACCENTO} d="M70 40c8-4 12-10 10-18"/>`,
  /* Rapido: l'oblo' con la lancetta corta, e la scia. */
  "wash-quick": `${PANNELLO}<circle ${SCOCCA} cx="48" cy="50" r="28"/><circle ${FRONTALE} cx="48" cy="50" r="20"/><path ${TRATTO} d="M48 36v14l10 6"/><path ${TRATTO_ACCENTO} d="M14 32h16M10 46h12"/>`,
  /* Eco: la foglia dentro l'oblo'. */
  "wash-eco": `${PANNELLO}<circle ${SCOCCA} cx="48" cy="50" r="28"/><circle ${FRONTALE} cx="48" cy="50" r="20"/><path ${VERDE} d="M60 36c2 16-6 26-20 26 0-16 8-24 20-26z"/><path ${TRATTO} d="M38 64c6-8 12-14 20-18"/>`,
  /* Centrifuga: il cestello e le frecce che girano forte. */
  "wash-spin": `${PANNELLO}<circle ${SCOCCA} cx="48" cy="50" r="28"/><circle ${FRONTALE} cx="48" cy="50" r="19"/><path ${TRATTO_ACCENTO} d="M48 36a14 14 0 0 1 13 9"/><path ${ACCENTO} d="M64 40l-2 10-8-6z"/><path ${TRATTO_ACCENTO} d="M48 64a14 14 0 0 1-13-9"/><path ${ACCENTO} d="M32 60l2-10 8 6z"/>`,
  /* Risciacquo: l'acqua che scende dentro il cestello. */
  "wash-rinse": `${PANNELLO}<circle ${SCOCCA} cx="48" cy="54" r="26"/><circle ${FRONTALE} cx="48" cy="54" r="18"/><path ${VETRO} d="M48 12c7 9 11 14 11 19a11 11 0 0 1-22 0c0-5 4-10 11-19z"/><path ${TRATTO_CHIARO} d="M40 58c5 5 11 5 16 0"/>`,
  /* Igienizzante: il caldo alto, col termometro e il vapore. */
  "wash-hot": `${PANNELLO}<circle ${SCOCCA} cx="52" cy="56" r="24"/><circle ${FRONTALE} cx="52" cy="56" r="16"/><path ${CALDO} d="M30 20a6 6 0 0 1 12 0v28a10 10 0 1 1-12 0z"/><circle ${CALDO} cx="36" cy="60" r="9"/><path ${TRATTO_CHIARO} d="M46 50c4-4 4-8 0-12"/>`,
  /* Delicati: la piuma, che dice «piano» senza scriverlo. */
  "wash-delicate": `${PANNELLO}<path ${SCOCCA} d="M74 18c4 22-6 40-24 46l-10 4 4-10c8-18 18-30 30-40z"/><path ${TRATTO_CHIARO} d="M62 30 40 60M56 32l2 12M48 42l2 12"/><path ${TRATTO_ACCENTO} d="M24 78c6-6 12-10 18-12"/>`,
  /* Piumoni: il capo grande, con le sue cuciture. */
  "wash-duvet": `${PANNELLO}<rect ${SCOCCA} x="16" y="26" width="64" height="46" rx="10"/><path ${TRATTO_CHIARO} d="M16 42h64M16 58h64M38 26v46M60 26v46"/><circle ${ACCENTO} cx="27" cy="34" r="3"/>`,
  /* ── quello che restava a emoji ────────────────────────────────────────
   *
   * «Non voglio vedere icone che non sono nostre.» Dopo i bidoni erano questi
   * gli ultimi posti dove si vedeva davvero una faccina di sistema: le
   * categorie delle allerte, le specie degli animali, i modi dell'antifurto,
   * i tasti del robot, gli stati di una segnalazione. Il disegno che c'era
   * gia' si riusa — la campanella, la casa, la luna, la chiave inglese, la
   * spunta, la stella — e qui ci sono solo le cose che il catalogo non sapeva
   * ancora disegnare. */
  /* L'avviso: il triangolo, che e' l'unica forma che dice «attenzione» senza
   * bisogno di parole. `error` non lo copriva: quello e' una croce, e dice
   * un'altra cosa. */
  warning: `${PANNELLO}<path fill="#fbbf24" stroke="#fbbf24" stroke-width="9" stroke-linejoin="round" d="M48 22 79 74H17Z"/><rect ${SCOCCA} x="43.5" y="40" width="9" height="20" rx="4.5"/><circle ${SCOCCA} cx="48" cy="67" r="4.6"/>`,
  /* Il mondo: le allerte che arrivano da fuori casa — la protezione civile, il
   * terremoto, la cosa che riguarda un posto e non una stanza. */
  globe: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="48" r="32"/><ellipse fill="none" stroke="#8be2ff" stroke-width="3" cx="48" cy="48" rx="14" ry="32"/><path fill="none" stroke="#8be2ff" stroke-width="3" stroke-linecap="round" d="M17 40h62M17 56h62M48 16v64"/>`,
  /* Il temporale: la nuvola e il fulmine. */
  storm: `${PANNELLO}<circle ${SCOCCA} cx="35" cy="40" r="14"/><circle ${SCOCCA} cx="57" cy="35" r="17"/><rect ${SCOCCA} x="21" y="40" width="52" height="18" rx="9"/><path ${CALDO} d="M50 54 34 82h11l-3 8 18-24H49l5-12Z"/>`,
  /* Il fiore: i pollini, che sono l'allerta di chi ha il naso che cola a
   * marzo. */
  flower: `${PANNELLO}<path fill="none" stroke="#22c55e" stroke-width="5" stroke-linecap="round" d="M48 54v28"/><path fill="#22c55e" d="M48 72c-10-2-15-9-15-9s10-5 15 4Z"/><ellipse ${SCOCCA} cx="48" cy="24" rx="9" ry="13"/><ellipse ${SCOCCA} cx="48" cy="52" rx="9" ry="13"/><ellipse ${SCOCCA} cx="34" cy="38" rx="13" ry="9"/><ellipse ${SCOCCA} cx="62" cy="38" rx="13" ry="9"/><ellipse ${SCOCCA} cx="38" cy="28" rx="11" ry="9" transform="rotate(-45 38 28)"/><ellipse ${SCOCCA} cx="58" cy="48" rx="11" ry="9" transform="rotate(-45 58 48)"/><circle ${CALDO} cx="48" cy="38" r="11"/>`,
  /* L'aereo: i voli in ritardo, e la vacanza dell'antifurto. */
  plane: `${PANNELLO}<path ${SCOCCA} d="M48 10c4.4 0 8 6.7 8 15v7l26 15v9l-26-7.5V64l9 7.5V78l-17-4.6L31 78v-6.5l9-7.5V48.5L14 56v-9l26-15v-7c0-8.3 3.6-15 8-15Z"/><circle ${ACCENTO} cx="48" cy="30" r="4"/>`,
  /* Il treno: gli scioperi e i ritardi di chi viaggia in ferrovia. */
  train: `${PANNELLO}<rect ${SCOCCA} x="22" y="12" width="52" height="58" rx="14"/><rect ${VETRO} x="30" y="22" width="36" height="20" rx="6"/><rect ${FRONTALE} x="30" y="50" width="13" height="9" rx="4"/><rect ${FRONTALE} x="53" y="50" width="13" height="9" rx="4"/><rect ${SCOCCA} x="34" y="68" width="28" height="7" rx="3.5"/><path ${TRATTO} d="M30 76 20 88M66 76l10 12"/>`,
  /* Il cartello: lo sciopero. Un cartello alzato lo si riconosce anche a
   * ventidue pixel, una folla no. */
  strike: `${PANNELLO}<rect ${SCOCCA} x="44" y="44" width="8" height="40" rx="4"/><rect ${SCOCCA} x="16" y="14" width="64" height="38" rx="8"/><path ${TRATTO_CHIARO} d="M26 27h44M26 39h26"/><circle ${ACCENTO} cx="64" cy="39" r="5"/>`,
  /* Il gatto: orecchie a punta, baffi, e gli occhi che restano aperti. */
  cat: `${PANNELLO}<path ${SCOCCA} d="M24 44 20 16l20 10a34 34 0 0 1 16 0l20-10-4 28Z"/><circle ${SCOCCA} cx="48" cy="54" r="26"/><ellipse ${VETRO} cx="38" cy="50" rx="4.5" ry="6"/><ellipse ${VETRO} cx="58" cy="50" rx="4.5" ry="6"/><path ${ACCENTO} d="M48 60c3 0 5 2 5 4s-2 4-5 4-5-2-5-4 2-4 5-4Z"/><path ${TRATTO_CHIARO} d="M28 62h-9M28 69h-8M68 62h9M68 69h8"/>`,
  /* Il cane: orecchie che cadono e il tartufo. */
  dog: `${PANNELLO}<ellipse ${SCOCCA} cx="23" cy="48" rx="9" ry="16"/><ellipse ${SCOCCA} cx="73" cy="48" rx="9" ry="16"/><circle ${SCOCCA} cx="48" cy="44" r="24"/><ellipse ${FRONTALE} cx="48" cy="60" rx="15" ry="12"/><circle ${VETRO} cx="39" cy="38" r="4.5"/><circle ${VETRO} cx="57" cy="38" r="4.5"/><ellipse ${SCOCCA} cx="48" cy="54" rx="6.5" ry="5"/><path fill="none" stroke="#0f2942" stroke-width="3" stroke-linecap="round" d="M48 59v4M48 63c-2.5 3-6 3-8 1M48 63c2.5 3 6 3 8 1"/>`,
  /* La spirale: la pulizia di un punto solo, che il robot chiama «spot». */
  spiral: `${PANNELLO}<path fill="none" stroke="#0f2942" stroke-width="6.5" stroke-linecap="round" d="M76 48A28 28 0 0 1 20 48 22 22 0 0 1 64 48 16 16 0 0 1 32 48 10 10 0 0 1 52 48"/><circle ${ACCENTO} cx="52" cy="48" r="4.5"/>`,
  /* La coccinella: una segnalazione aperta. */
  bug: `${PANNELLO}<path ${TRATTO} d="M22 34 32 42M74 34 64 42M18 58h12M78 58H66M24 80l10-10M72 80 62 70"/><ellipse ${SCOCCA} cx="48" cy="54" rx="22" ry="26"/><circle ${SCOCCA} cx="48" cy="26" r="11"/><path ${TRATTO_CHIARO} d="M48 32v48"/><circle ${FRONTALE} cx="37" cy="46" r="4"/><circle ${FRONTALE} cx="59" cy="46" r="4"/><circle ${FRONTALE} cx="37" cy="64" r="4"/><circle ${FRONTALE} cx="59" cy="64" r="4"/>`,
  /* La nuvoletta: qualcuno ha risposto. */
  chat: `${PANNELLO}<path ${SCOCCA} d="M20 16h56a10 10 0 0 1 10 10v30a10 10 0 0 1-10 10H46L26 84V66h-6a10 10 0 0 1-10-10V26a10 10 0 0 1 10-10Z"/><circle ${FRONTALE} cx="33" cy="41" r="4.5"/><circle ${FRONTALE} cx="48" cy="41" r="4.5"/><circle ${ACCENTO} cx="63" cy="41" r="4.5"/>`,
  /* La cassetta della posta in arrivo: quello che e' appena entrato. */
  inbox: `${PANNELLO}<path ${TRATTO_ACCENTO} d="M48 10v28m-10-10 10 10 10-10"/><path ${SCOCCA} d="M14 48h20l7 11h14l7-11h20v24a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10Z"/>`,
  /* Il lucchetto aperto: disarmato. E' il compagno di `lock`, con l'arco
   * scostato — la differenza si vede anche piccola, che e' il punto. */
  unlock: `${PANNELLO}<path ${TRATTO} d="M62 44V34a14 14 0 0 0-28 0"/><rect ${SCOCCA} x="24" y="44" width="48" height="38" rx="10"/><circle ${VETRO} cx="48" cy="59" r="6"/><rect ${VETRO} x="45" y="59" width="6" height="12" rx="3"/>`,
  /* I tasti del robot: avvia, pausa, ferma. Erano tre segni da tastiera in
   * mezzo a tre emoji — sei tasti e tre stili. Nella famiglia del cerchio,
   * come `check` e `error`, sono sei tasti soli. */
  play: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="48" r="32"/><path ${FRONTALE} d="M41 33.5 66 48 41 62.5Z"/>`,
  pause: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="48" r="32"/><rect ${FRONTALE} x="36" y="33" width="9" height="30" rx="4.5"/><rect ${FRONTALE} x="51" y="33" width="9" height="30" rx="4.5"/>`,
  stop: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="48" r="32"/><rect ${FRONTALE} x="36" y="36" width="24" height="24" rx="5"/>`,
  /* L'aspirapolvere visto dall'alto: il paraurti chiaro davanti e la torretta
   * che gira. */
  robot: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="50" r="31"/><path ${FRONTALE} d="M18.7 40a31 31 0 0 1 58.6 0Z"/><circle ${VETRO} cx="48" cy="54" r="13"/><circle ${ACCENTO} cx="48" cy="54" r="6"/><rect ${SCOCCA} x="22" y="72" width="13" height="7" rx="3.5"/><rect ${SCOCCA} x="61" y="72" width="13" height="7" rx="3.5"/>`,
  /* Il tagliaerba: la scocca, la lama e l'erba che taglia. */
  mower: `${PANNELLO}<path fill="#22c55e" d="M12 76h72v8H12ZM20 76c0-8 4-12 4-12s4 4 4 12ZM68 76c0-8 4-12 4-12s4 4 4 12Z"/><path ${SCOCCA} d="M22 44h30a16 16 0 0 1 16 16v10H22a6 6 0 0 1-6-6V50a6 6 0 0 1 6-6Z"/><path ${TRATTO} d="M52 44 70 26h10"/><circle ${SCOCCA} cx="30" cy="72" r="8"/><circle ${SCOCCA} cx="62" cy="72" r="8"/><circle ${ACCENTO} cx="34" cy="56" r="6"/>`,
  /* I cursori: l'antifurto su misura, quello che uno si e' scritto da se'. */
  sliders: `${PANNELLO}<path ${TRATTO} d="M18 28h60M18 48h60M18 68h60"/><circle ${SCOCCA} cx="34" cy="28" r="9"/><circle ${SCOCCA} cx="62" cy="48" r="9"/><circle ${ACCENTO} cx="42" cy="68" r="9"/>`,
  /* ── I VARCHI (#74) ──────────────────────────────────────────────────────
   *
   * «Icone sempre quelle del catalogo nostro, se non presenti queste creale.»
   *
   * La scheda dei varchi metteva addosso a ogni contatto un'emoji di sistema —
   * porta, finestra, casa diroccata, cartello di lavori — scelta dalla classe
   * che Home Assistant aveva dato al sensore. Erano quattro segni per tutte le
   * aperture di una casa, cambiavano faccia da un telefono all'altro, e la
   * casa diroccata come portone del garage non la riconosceva nessuno.
   *
   * Qui ce ne sono dieci, fatti con la stessa tavolozza di tutti gli altri, e
   * chi configura un varco se li sceglie invece di subirli. */
  /* La finestra: due ante vetrate, la maniglia in mezzo e il davanzale. */
  window: `${PANNELLO}<rect ${SCOCCA} x="14" y="12" width="68" height="62" rx="9"/><rect ${VETRO} x="22" y="20" width="24" height="46" rx="4"/><rect ${VETRO} x="50" y="20" width="24" height="46" rx="4"/><path ${TRATTO_CHIARO} d="M27 31h14M55 31h14"/><rect ${ACCENTO} x="44" y="38" width="8" height="12" rx="3"/><rect ${SCOCCA} x="12" y="78" width="72" height="7" rx="3.5"/>`,
  /* La porta-finestra: come la finestra, ma arriva a terra. */
  "french-window": `${PANNELLO}<rect ${SCOCCA} x="19" y="8" width="58" height="80" rx="8"/><rect ${VETRO} x="26" y="15" width="20" height="66" rx="4"/><rect ${VETRO} x="50" y="15" width="20" height="66" rx="4"/><path ${TRATTO_CHIARO} d="M30 30h12M54 30h12M30 50h12M54 50h12"/><rect ${ACCENTO} x="44" y="42" width="8" height="13" rx="3"/>`,
  /* Il portone: due ante a pannelli, il sopraluce e i due pomoli. */
  "front-door": `${PANNELLO}<rect ${SCOCCA} x="15" y="8" width="66" height="80" rx="9"/><rect ${VETRO} x="22" y="15" width="52" height="11" rx="4"/><rect ${FRONTALE} x="22" y="30" width="25" height="51" rx="5"/><rect ${FRONTALE} x="49" y="30" width="25" height="51" rx="5"/><path ${TRATTO} d="M28 39h13M55 39h13M28 51h13M55 51h13"/><circle ${ACCENTO} cx="43" cy="62" r="3.2"/><circle ${ACCENTO} cx="53" cy="62" r="3.2"/>`,
  /* Il basculante del garage: il tetto a spiovente e le sezioni. */
  "garage-door": `${PANNELLO}<path ${SCOCCA} d="M8 42 48 15l40 27v40a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z"/><rect ${FRONTALE} x="19" y="48" width="58" height="34" rx="4"/><path ${TRATTO} d="M19 57h58M19 65h58M19 73h58"/><rect ${ACCENTO} x="41" y="36" width="14" height="6" rx="3"/>`,
  /* Il lucernario: la finestra inclinata sulla falda, con la luce che entra.
   * Il vetro segue la pendenza del tetto — e' quello che lo distingue da una
   * finestra qualunque, e a trenta pixel e' l'unica cosa che si legge. */
  skylight: `${PANNELLO}<path ${SCOCCA} d="M48 28 86 84H10z"/><path ${FRONTALE} d="M59 45 75 68 61 78 45 54z"/><path ${VETRO} d="M61 50 71 65 61 72 50 56z"/><path ${TRATTO} d="M67 56 53 66"/><path ${TRATTO_ACCENTO} d="M48 17v-7M30 26l-5-6M66 26l5-6"/>`,
  /* La botola: il coperchio alzato sopra il vano, con l'anello per tirarlo. */
  hatch: `${PANNELLO}<path ${SCOCCA} d="M9 46h78v32a7 7 0 0 1-7 7H16a7 7 0 0 1-7-7z"/><rect ${SPENTO} x="18" y="54" width="60" height="23" rx="4"/><path ${TRATTO_CHIARO} d="M28 62h40"/><path ${FRONTALE} d="M22 41 55 11l24 9-33 21z"/><path ${TRATTO} d="M22 41 55 11l24 9-33 21z"/><circle ${ACCENTO} cx="64" cy="27" r="4.5"/>`,
  /* La porta scorrevole: l'anta che scorre sul binario, e da che parte va. */
  "sliding-door": `${PANNELLO}<rect ${SCOCCA} x="9" y="12" width="78" height="9" rx="4.5"/><rect ${SCOCCA} x="11" y="26" width="38" height="58" rx="6"/><rect ${FRONTALE} x="17" y="32" width="26" height="46" rx="4"/><rect ${SCOCCA} x="45" y="26" width="38" height="58" rx="6"/><rect ${VETRO} x="51" y="32" width="26" height="46" rx="4"/><path ${TRATTO_ACCENTO} d="M23 55h14m0 0-5-5m5 5-5 5"/>`,
  /* La sbarra del passo carraio: il palo e l'asta a bande, alzata. */
  barrier: `${PANNELLO}<rect ${SCOCCA} x="14" y="42" width="19" height="42" rx="5"/><rect ${ACCENTO} x="18" y="49" width="11" height="9" rx="3"/><g transform="rotate(-24 23.5 44)"><rect ${SCOCCA} x="30" y="37" width="52" height="13" rx="6.5"/><rect ${FRONTALE} x="37" y="40" width="10" height="7" rx="2.5"/><rect ${FRONTALE} x="53" y="40" width="10" height="7" rx="2.5"/><rect ${FRONTALE} x="69" y="40" width="9" height="7" rx="2.5"/></g>`,
  /* Il varco e basta: l'arco vuoto, per quello che un nome preciso non ce l'ha.
   * E' il ripiego della classe `opening`, che in Home Assistant vuol dire
   * «un'apertura, e non ti dico quale». */
  doorway: `${PANNELLO}<path ${SCOCCA} d="M15 86V46a33 33 0 0 1 66 0v40H66V46a18 18 0 0 0-36 0v40z"/><path ${VETRO} d="M30 46a18 18 0 0 1 36 0v40H30z"/><path ${TRATTO} d="M40 64h15m0 0-6-6m6 6-6 6"/>`,
  /* Il radar di presenza: il sensore a muro e le onde che manda.
   * Non e' un varco, ma arriva con loro: la scheda Presenza aveva lo stesso
   * problema, e un mmWave disegnato come un occhio non lo riconosce nessuno. */
  radar: `${PANNELLO}<rect ${SCOCCA} x="26" y="12" width="44" height="26" rx="8"/><circle ${VETRO} cx="48" cy="25" r="7"/><path ${TRATTO_ACCENTO} d="M30 52a26 26 0 0 1 36 0"/><path ${TRATTO_ACCENTO} d="M24 66a38 38 0 0 1 48 0"/><path ${TRATTO_ACCENTO} d="M18 80a50 50 0 0 1 60 0"/>`
});
var ALIAS = Object.freeze({
  /* La moto, chiamata come la chiama chi la cerca. */
  motorcycle: "moto",
  motorbike: "moto",
  motorino: "moto",
  scooter: "moto",
  auto: "ev",
  car: "ev",
  /* I programmi della lavatrice, chiamati come li chiama chi li usa. */
  cotone: "wash-cotton",
  cotton: "wash-cotton",
  sintetici: "wash-synthetic",
  synthetic: "wash-synthetic",
  lana: "wash-wool",
  wool: "wash-wool",
  rapido: "wash-quick",
  quick: "wash-quick",
  eco: "wash-eco",
  centrifuga: "wash-spin",
  spin: "wash-spin",
  risciacquo: "wash-rinse",
  rinse: "wash-rinse",
  igienizzante: "wash-hot",
  sanitize: "wash-hot",
  delicati: "wash-delicate",
  delicate: "wash-delicate",
  piumoni: "wash-duvet",
  duvet: "wash-duvet",
  light: "lights",
  luce: "lights",
  luci: "lights",
  "gruppo-luci": "lights-group",
  heat: "radiator",
  riscaldamento: "radiator",
  termosifone: "radiator",
  "pompa-di-calore": "heat-pump",
  sicurezza: "security",
  cancello: "gate",
  porta: "door",
  "door-closed": "door",
  "door-open": "door",
  portoncino: "door",
  ingresso: "door",
  tapparelle: "shutters",
  scena: "scene",
  interruttore: "toggle",
  potenza: "power",
  presa: "power",
  auto: "ev",
  acqua: "water",
  telecamera: "camera",
  campanello: "bell",
  stella: "star",
  "riscaldamento-a-pavimento": "floor-heating",
  barbecue: "grill",
  deumidificatore: "dehumidifier",
  pc: "computer",
  computer: "computer",
  stampante: "printer",
  fotovoltaico: "solar",
  solare: "solar",
  batteria: "battery",
  pompa: "pump",
  /* I contatori di casa: il contatore, il manometro, la fiamma del gas. */
  contatore: "meter",
  manometro: "gauge",
  pressione: "gauge",
  /* Il boiler dell'acqua calda, come lo chiama chi ce l'ha. */
  accumulo: "boiler",
  "acqua-calda": "boiler",
  fiamma: "flame",
  metano: "flame",
  /* La pianta in vaso, come la chiama chi la cerca. */
  pianta: "plant",
  piante: "plant",
  vaso: "plant",
  /* Il terrario e le sue lampade, come li chiama chi li cerca. */
  terrario: "terrarium",
  terrari: "terrarium",
  rettile: "terrarium",
  rettili: "terrarium",
  geco: "terrarium",
  "lampada-calda": "heat-lamp",
  nebulizzatore: "mist",
  /* L'acquario, come lo chiama chi lo cerca. */
  acquario: "aquarium",
  pesci: "aquarium",
  pesce: "aquarium",
  irrigazione: "irrigation",
  ascensore: "lift",
  casa: "home",
  /* Le voci nuove del catalogo unico: ognuna al suo disegno di famiglia. */
  alarm: "security",
  allarme: "security",
  warning: "bell",
  attenzione: "bell",
  informazione: "info",
  risolto: "check",
  errore: "error",
  bloccato: "lock",
  unlock: "lock",
  sbloccato: "lock",
  serratura: "lock",
  window: "shutters",
  finestra: "shutters",
  garage: "room-garage",
  movimento: "motion",
  presence: "motion",
  presenza: "motion",
  fire: "fireplace",
  incendio: "fireplace",
  fumo: "smoke",
  gas: "smoke",
  leak: "water",
  perdita: "water",
  flood: "water",
  allagamento: "water",
  temperatura: "thermometer",
  umidita: "humidity",
  sole: "sun",
  notte: "moon",
  vento: "wind",
  rain: "water",
  pioggia: "water",
  "battery-low": "battery",
  plug: "socket",
  vacuum: "robot-vacuum",
  aspirapolvere: "robot-vacuum",
  pool: "room-pool",
  piscina: "room-pool",
  tv: "television",
  casse: "speaker",
  musica: "speaker",
  music: "speaker",
  wifi: "router",
  rete: "router",
  persona: "person",
  animale: "pet",
  pacco: "package",
  posta: "mail",
  telefono: "phone",
  scadenza: "timer",
  shopping: "cart",
  spesa: "cart",
  todo: "list",
  chiave: "key",
  bed: "room-bedroom",
  letto: "room-bedroom",
  away: "door",
  party: "scene",
  festa: "scene",
  movie: "scene",
  film: "scene",
  clean: "broom",
  pulizie: "broom",
  manutenzione: "tools",
  salute: "heart",
  aggiorna: "refresh",
  restart: "refresh",
  riavvia: "refresh",
  /* I varchi (#74). Le quattro classi con cui Home Assistant dichiara
   * un'apertura entrano da qui: sono i nomi che arrivano dal rilevamento,
   * e senza di loro una casa appena importata resterebbe senza disegni. */
  garage_door: "garage-door",
  garage: "garage-door",
  opening: "doorway",
  varco: "doorway",
  finestra: "window",
  porta: "door",
  portone: "front-door",
  "porta-finestra": "french-window",
  portafinestra: "french-window",
  scorrevole: "sliding-door",
  basculante: "garage-door",
  sezionale: "garage-door",
  lucernario: "skylight",
  velux: "skylight",
  botola: "hatch",
  sbarra: "barrier",
  cancello: "gate",
  tapparella: "shutters",
  presenza: "radar",
  mmwave: "radar"
});
var pulito = (valore) => String(valore ?? "").trim().toLowerCase().replace(/^mdi:/, "").replace(/[\s_]+/g, "-");
function chiaveDelDisegno2(valore) {
  const token = pulito(valore);
  if (!token) return "";
  if (CORPI[token]) return token;
  const alias = ALIAS[token];
  return alias && CORPI[alias] ? alias : "";
}
function disegnoDelCatalogo(valore, misura = 96) {
  const chiave = chiaveDelDisegno2(valore);
  return chiave ? guscio(chiave, CORPI[chiave], misura) : "";
}
function chiaviDaProvare(kind, token, voce = null) {
  const nomi = [];
  const aggiungi = (valore) => {
    const nome = pulito(valore);
    if (nome && !nomi.includes(nome)) nomi.push(nome);
  };
  if (kind === "room" && voce?.id) aggiungi(`room-${voce.id}`);
  aggiungi(token);
  if (voce?.id) {
    aggiungi(voce.id);
    aggiungi(voce.mdi);
  }
  return nomi;
}

// src/core/consumo-del-clima.js
var clean5 = (valore) => String(valore ?? "").trim();
var MILLE = Object.freeze({ kw: 1e3, kilowatt: 1e3 });
var ENERGIA = /^(m|k|g)?wh$/i;
function entitaDelConsumo(unita) {
  return clean5(unita?.consumo);
}
function sogliaDelConsumo(unita) {
  const scritto = unita?.soglia_consumo;
  if (scritto === null || scritto === void 0 || clean5(scritto) === "") return null;
  const valore = Number(String(scritto).replace(",", "."));
  return Number.isFinite(valore) && valore >= 0 ? valore : null;
}
function wattDellUnita(unita, states = {}) {
  const entity = entitaDelConsumo(unita);
  if (!entity) return null;
  const stato = states?.[entity];
  if (!stato) return null;
  const grezzo = clean5(stato.state).toLowerCase();
  if (["unavailable", "unknown", "none", ""].includes(grezzo)) return null;
  const valore = Number(grezzo.replace(",", "."));
  if (!Number.isFinite(valore)) return null;
  const unitaDiMisura = clean5(stato.attributes?.unit_of_measurement).toLowerCase();
  if (ENERGIA.test(unitaDiMisura) || clean5(stato.attributes?.device_class) === "energy")
    return null;
  return valore * (MILLE[unitaDiMisura] || 1);
}
function accesoPerIlConsumo(unita, states = {}) {
  const soglia = sogliaDelConsumo(unita);
  if (soglia === null) return null;
  const watt = wattDellUnita(unita, states);
  if (watt === null) return null;
  return watt >= soglia;
}

// src/core/runtime-metrics.js
function createRuntimeMetrics() {
  const values = { recorderRequests: 0, energyRefreshes: 0, applianceRenders: 0, globalRenders: 0 };
  return Object.freeze({
    increment(key) {
      if (Object.hasOwn(values, key)) values[key] += 1;
    },
    snapshot() {
      return Object.freeze({ ...values });
    },
    reset() {
      Object.keys(values).forEach((key) => {
        values[key] = 0;
      });
    }
  });
}
var runtimeMetrics = createRuntimeMetrics();

// src/core/statistiche-tenute.js
var DURATA_DELLE_STATISTICHE_TENUTE_MS = 14 * 864e5;
var SPAZIO_DELLE_STATISTICHE_TENUTE = 15e5;
var RICORDO_DEL_RECORDER_LENTO_MS = 7 * 864e5;
var CHIAVE_DELLE_RIGHE = "dm_statistiche_tenute_v1";
var CHIAVE_DEL_RECORDER_LENTO = "dm_recorder_a_spicchi_v1";
function spicchiDellArco(start, end) {
  const da = new Date(start);
  const a = new Date(end);
  if (!(da < a)) return [];
  const spicchi = [];
  let inizio = da;
  while (inizio < a) {
    const prossimo = new Date(inizio.getFullYear(), inizio.getMonth() + 1, 1);
    const fine = prossimo < a ? prossimo : a;
    spicchi.push({ start: inizio, end: fine });
    inizio = fine;
  }
  return spicchi;
}
function unisciLeRighe(risposte = []) {
  const perEntita = /* @__PURE__ */ new Map();
  for (const risposta of risposte) {
    for (const [id, righe2] of Object.entries(risposta || {})) {
      if (!Array.isArray(righe2)) continue;
      const viste = perEntita.get(id) || /* @__PURE__ */ new Map();
      for (const riga of righe2) {
        const quando = Date.parse(riga?.start) || Number(riga?.start) || 0;
        if (!viste.has(quando)) viste.set(quando, riga);
      }
      perEntita.set(id, viste);
    }
  }
  return Object.fromEntries(
    [...perEntita].map(([id, viste]) => [
      id,
      [...viste.entries()].sort((x, y) => x[0] - y[0]).map(([, riga]) => riga)
    ])
  );
}
function improntaDellaCasa(root3 = globalThis) {
  try {
    const casa = root3.STATES?.["zone.home"]?.attributes || root3._RAW_STATES?.["zone.home"]?.attributes;
    const lat = Number(casa?.latitude);
    const lon = Number(casa?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
    const testo2 = [
      lat.toFixed(4),
      lon.toFixed(4),
      root3.location?.host || "",
      root3.__DASHBOARDMODERN_INSTANCE__ || ""
    ].join("|");
    let h = 2166136261;
    for (let i = 0; i < testo2.length; i += 1) {
      h ^= testo2.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(36);
  } catch (_errore) {
    return "";
  }
}
function leggi(storage, chiave) {
  try {
    const testo2 = storage?.getItem?.(chiave);
    if (!testo2) return null;
    const valore = JSON.parse(testo2);
    return valore && typeof valore === "object" ? valore : null;
  } catch (_errore) {
    return null;
  }
}
function scrivi(storage, chiave, valore) {
  try {
    storage?.setItem?.(chiave, JSON.stringify(valore));
    return true;
  } catch (_errore) {
    return false;
  }
}
var StatisticheTenute = class {
  constructor({
    storage = globalThis.localStorage,
    impronta = () => improntaDellaCasa(),
    adesso: adesso3 = () => Date.now(),
    durata = DURATA_DELLE_STATISTICHE_TENUTE_MS,
    spazio = SPAZIO_DELLE_STATISTICHE_TENUTE
  } = {}) {
    this.storage = storage;
    this.impronta = impronta;
    this.adesso = adesso3;
    this.durata = durata;
    this.spazio = spazio;
  }
  chiaveDi(chiave) {
    const casa = this.impronta();
    return casa ? `${casa}|${chiave}` : "";
  }
  prendi(chiave) {
    const completa = this.chiaveDi(chiave);
    if (!completa) return null;
    const voce = leggi(this.storage, CHIAVE_DELLE_RIGHE)?.[completa];
    if (!voce || !(Number(voce.fino) > this.adesso())) return null;
    return voce.righe ?? null;
  }
  metti(chiave, righe2) {
    const completa = this.chiaveDi(chiave);
    if (!completa || righe2 == null) return false;
    const tutte = leggi(this.storage, CHIAVE_DELLE_RIGHE) || {};
    const ora = this.adesso();
    const tenute2 = Object.entries(tutte).filter(
      ([nome, voce]) => nome !== completa && Number(voce?.fino) > ora
    );
    tenute2.push([completa, { fino: ora + this.durata, righe: righe2 }]);
    while (tenute2.length) {
      const testo2 = JSON.stringify(Object.fromEntries(tenute2));
      if (testo2.length <= this.spazio && scrivi(this.storage, CHIAVE_DELLE_RIGHE, Object.fromEntries(tenute2)))
        return true;
      if (tenute2.length === 1) break;
      tenute2.shift();
    }
    return false;
  }
  /* Se di recente un arco lungo e' scaduto: allora si va a spicchi subito. */
  recorderLento() {
    const casa = this.impronta();
    const da = Number(leggi(this.storage, CHIAVE_DEL_RECORDER_LENTO)?.[casa || "_"]);
    return Number.isFinite(da) && this.adesso() - da < RICORDO_DEL_RECORDER_LENTO_MS;
  }
  segnaIlRecorderLento() {
    const casa = this.impronta() || "_";
    const tutte = leggi(this.storage, CHIAVE_DEL_RECORDER_LENTO) || {};
    tutte[casa] = this.adesso();
    scrivi(this.storage, CHIAVE_DEL_RECORDER_LENTO, tutte);
  }
};

// src/core/period-service.js
var PERIOD_SOURCES = Object.freeze([
  {
    key: "house",
    group: "house",
    totalKey: "total_energy",
    periodKeys: { day: "daily_energy", month: "monthly_energy", year: "annual_energy" },
    slots: {
      day: "dm.energy_consumo_casa_oggi",
      month: "dm.energy_consumo_casa_mese",
      year: "dm.energy_consumo_casa_anno"
    }
  },
  {
    key: "gridImport",
    group: "grid",
    totalKey: "total_import_energy",
    periodKeys: {
      day: "daily_import_energy",
      month: "monthly_import_energy",
      year: "annual_import_energy"
    },
    slots: {
      day: "dm.energy_energia_prelevata_oggi",
      month: "dm.energy_rete_acquistata_mese",
      year: "dm.energy_rete_acquistata_anno"
    }
  },
  {
    key: "gridExport",
    group: "grid",
    totalKey: "total_export_energy",
    periodKeys: {
      day: "daily_export_energy",
      month: "monthly_export_energy",
      year: "annual_export_energy"
    },
    slots: {
      day: "dm.energy_energia_immessa_oggi",
      month: "dm.energy_rete_venduta_mese",
      year: "dm.energy_rete_venduta_anno"
    }
  },
  {
    key: "solar",
    group: "solar",
    totalKey: "total_energy",
    periodKeys: { day: "daily_energy", month: "monthly_energy", year: "annual_energy" },
    slots: {
      day: "dm.energy_produzione_solare_oggi",
      month: "dm.energy_produzione_solare_mese",
      year: "dm.energy_produzione_solare_anno"
    }
  },
  {
    key: "batteryCharged",
    group: "battery",
    totalKey: "total_charged_energy",
    periodKeys: {
      day: "daily_charged_energy",
      month: "monthly_charged_energy",
      year: "annual_charged_energy"
    },
    slots: {
      day: "dm.energy_batteria_caricata_oggi",
      month: "dm.energy_batteria_caricata_mese",
      year: "dm.energy_batteria_caricata_anno"
    }
  },
  {
    key: "batteryDischarged",
    group: "battery",
    totalKey: "total_discharged_energy",
    periodKeys: {
      day: "daily_discharged_energy",
      month: "monthly_discharged_energy",
      year: "annual_discharged_energy"
    },
    slots: {
      day: "dm.energy_batteria_scaricata_oggi",
      month: "dm.energy_batteria_usata_mese",
      year: "dm.energy_batteria_usata_anno"
    }
  }
]);
var finite = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
function rowTimestamp(row) {
  const raw = row?.start ?? row?.end ?? row?.last_updated ?? row?.timestamp ?? 0;
  const value = typeof raw === "number" ? raw : Date.parse(raw);
  return Number.isFinite(value) ? value : 0;
}
function cumulativeValue(row) {
  return finite(row?.sum);
}
function letturaDelContatore(row) {
  return finite(row?.state);
}
function righeInKilowattora(righe2, unita) {
  const elenco = Array.isArray(righe2) ? righe2 : [];
  if (inKilowattora(1, unita) === 1) return elenco;
  return elenco.map((riga) => {
    const somma = inKilowattora(riga?.sum, unita);
    const lettura = inKilowattora(riga?.state, unita);
    if (somma == null && lettura == null) return riga;
    const copia = { ...riga };
    if (somma != null) copia.sum = somma;
    if (lettura != null) copia.state = lettura;
    return copia;
  });
}
function periodConsumption(rows = [], baseline = null) {
  const ordered = (Array.isArray(rows) ? rows : []).filter(Boolean).slice().sort((left, right) => rowTimestamp(left) - rowTimestamp(right));
  const values = ordered.map(cumulativeValue).filter((value) => value != null);
  const first = cumulativeValue(baseline);
  if (first != null && values.length) values.unshift(first);
  if (values.length < 2) return null;
  return Math.max(0, values.at(-1) - values[0]);
}
var LIMATURA_DEL_RECORDER = 0.02;
function recorderBucketConsumptions(rows = [], baseline = null) {
  const partenza = baseline && cumulativeValue(baseline) != null ? baseline : null;
  const ordered = [partenza, ...Array.isArray(rows) ? rows : []].filter((row) => row && cumulativeValue(row) != null).sort((left, right) => rowTimestamp(left) - rowTimestamp(right));
  const intervalli = partenza ? ordered.slice(1) : ordered;
  let riferimento = partenza ? cumulativeValue(partenza) : null;
  return intervalli.map((row) => {
    const adesso3 = cumulativeValue(row);
    if (riferimento === null) {
      riferimento = adesso3;
      return Object.freeze({ ...row, change: Math.max(0, adesso3) });
    }
    const cresciuto = adesso3 - riferimento;
    if (cresciuto >= 0) {
      riferimento = adesso3;
      return Object.freeze({ ...row, change: cresciuto });
    }
    if (riferimento - adesso3 > riferimento * LIMATURA_DEL_RECORDER) {
      riferimento = adesso3;
      return Object.freeze({ ...row, change: Math.max(0, adesso3) });
    }
    return Object.freeze({ ...row, change: 0 });
  });
}
function mesiDaiGiorni(righe2 = []) {
  const perMese = /* @__PURE__ */ new Map();
  for (const riga of Array.isArray(righe2) ? righe2 : []) {
    const istante = rowTimestamp(riga);
    if (!istante) continue;
    const quando = new Date(istante);
    const chiave = `${quando.getFullYear()}-${quando.getMonth()}`;
    const crescita = finite(riga?.change) || 0;
    const gia = perMese.get(chiave);
    if (!gia) {
      perMese.set(chiave, {
        start: new Date(quando.getFullYear(), quando.getMonth(), 1).toISOString(),
        change: Math.max(0, crescita),
        sum: cumulativeValue(riga),
        ultimo: istante
      });
      continue;
    }
    gia.change += Math.max(0, crescita);
    if (istante >= gia.ultimo) {
      gia.ultimo = istante;
      const contatore = cumulativeValue(riga);
      if (contatore != null) gia.sum = contatore;
    }
  }
  return [...perMese.values()].sort((sinistra, destra) => Date.parse(sinistra.start) - Date.parse(destra.start)).map(({ ultimo: _ultimo, ...mese }) => Object.freeze(mese));
}
function endOfClosedRange(nextBoundary, now) {
  if (nextBoundary > now) return new Date(now);
  return new Date(nextBoundary);
}
function ilGiornoDelPicco(giorni = []) {
  let picco = null;
  for (const giorno2 of Array.isArray(giorni) ? giorni : []) {
    const quanto = Number(giorno2?.change);
    if (!Number.isFinite(quanto) || quanto <= 0) continue;
    if (picco && quanto <= picco.quanto) continue;
    const quando = new Date(rowTimestamp(giorno2));
    picco = { quanto, quando: Number.isFinite(quando.getTime()) ? quando : null };
  }
  return picco;
}
function giorniPerLaMedia(anno, mese, adesso3 = /* @__PURE__ */ new Date()) {
  const anni = Number(anno);
  const mesi = Number(mese);
  if (!Number.isFinite(anni) || !Number.isFinite(mesi)) return 0;
  const oggi = new Date(adesso3);
  const nelMeseInCorso = anni === oggi.getFullYear() && mesi === oggi.getMonth() + 1;
  if (nelMeseInCorso) return oggi.getDate();
  const ultimo = new Date(anni, mesi, 0);
  if (ultimo.getTime() > oggi.getTime()) return 0;
  return ultimo.getDate();
}
function periodRange(kind, selected = /* @__PURE__ */ new Date(), now = /* @__PURE__ */ new Date()) {
  const date = new Date(selected);
  const current = new Date(now);
  let start;
  let next;
  let period;
  if (kind === "day") {
    start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next = new Date(start);
    next.setDate(next.getDate() + 1);
    period = "hour";
  } else if (kind === "year") {
    start = new Date(date.getFullYear(), 0, 1);
    next = new Date(date.getFullYear() + 1, 0, 1);
    period = "day";
  } else {
    start = new Date(date.getFullYear(), date.getMonth(), 1);
    next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    period = "day";
  }
  return {
    start,
    end: endOfClosedRange(next, current),
    next,
    period,
    kind
  };
}
function archiDelPeriodo(kind, selected = /* @__PURE__ */ new Date(), now = /* @__PURE__ */ new Date()) {
  const range = periodRange(kind, selected, now);
  if (kind !== "day" || range.end <= range.start) return [range];
  const oraAperta = new Date(range.end);
  oraAperta.setMinutes(0, 0, 0);
  if (oraAperta <= range.start) return [{ ...range, period: "5minute" }];
  if (oraAperta >= range.end) return [range];
  return [
    { ...range, end: oraAperta, next: oraAperta },
    { ...range, start: oraAperta, period: "5minute" }
  ];
}
function baselineRange(kind, start) {
  const baselineStart = new Date(start);
  if (kind === "day") baselineStart.setHours(baselineStart.getHours() - 2);
  else if (kind === "year") baselineStart.setMonth(baselineStart.getMonth() - 1);
  else baselineStart.setDate(baselineStart.getDate() - 2);
  return { start: baselineStart, end: new Date(start) };
}
function resolveEntity(reference, resolver = globalThis.resolveEntity) {
  const original = String(reference || "").trim();
  if (!original) return "";
  try {
    return String(resolver?.(original) || original).trim();
  } catch (_error) {
    return original;
  }
}
function inKilowattora(valore, unita) {
  const numero = Number(valore);
  if (!Number.isFinite(numero)) return null;
  const nome = String(unita || "").trim().toLowerCase();
  if (nome === "wh") return numero / 1e3;
  if (nome === "mwh") return numero * 1e3;
  return numero;
}
function sorgenteDichiarata(entity, states = {}) {
  const id = String(entity ?? "").trim();
  if (!id) return "";
  const dichiarata = states?.[id]?.attributes?.entity_id;
  const nome = typeof dichiarata === "string" ? dichiarata.trim() : Array.isArray(dichiarata) && dichiarata.length === 1 ? String(dichiarata[0] ?? "").trim() : "";
  if (!nome || !nome.includes(".") || nome === id) return "";
  return nome;
}
function unitaDellEntita(entity, states = {}) {
  return String(states?.[entity]?.attributes?.unit_of_measurement || "").trim().toLowerCase();
}
var UNITA_DI_POTENZA = /^(w|kw|mw)$/;
var UNITA_DI_ENERGIA = /^(wh|kwh|mwh)$/;
var PAROLE_DA_CONTATORE = /(^|[\s._-])(total|totale|lifetime|counter|contatore|meter)([\s._-]|$)/;
function isCumulativeEnergyEntity(entityId, states = {}, resolver = (value) => value) {
  const original = String(entityId || "").trim();
  if (!original) return false;
  const resolved = resolveEntity(original, resolver);
  const state = states?.[resolved] || states?.[original] || null;
  const attributes = state?.attributes || {};
  const unita = String(attributes.unit_of_measurement || "").trim().toLowerCase();
  if (UNITA_DI_POTENZA.test(unita)) return false;
  const classe = String(attributes.device_class || "").trim().toLowerCase();
  if (Object.keys(attributes).length && !UNITA_DI_ENERGIA.test(unita) && classe !== "energy")
    return false;
  const stateClass = String(attributes.state_class || "").toLowerCase();
  if (stateClass === "total" || stateClass === "total_increasing") return true;
  const testo2 = `${original} ${resolved} ${attributes.friendly_name || ""}`.toLowerCase();
  return PAROLE_DA_CONTATORE.test(testo2);
}
var STATI_SENZA_LETTURA = /* @__PURE__ */ new Set(["unavailable", "unknown", ""]);
function contatoreCheNonSiLegge(entityId, states = {}, resolver = (value) => value) {
  const original = String(entityId || "").trim();
  if (!original) return false;
  const resolved = resolveEntity(original, resolver);
  const state = states?.[resolved] || states?.[original] || null;
  if (!state) return true;
  const lettura = String(state.state ?? "").trim().toLowerCase();
  if (!STATI_SENZA_LETTURA.has(lettura)) return false;
  const attributes = state.attributes || {};
  const unita = String(attributes.unit_of_measurement || "").trim().toLowerCase();
  if (unita && !UNITA_DI_ENERGIA.test(unita)) return false;
  const stateClass = String(attributes.state_class || "").trim().toLowerCase();
  if (stateClass && stateClass !== "total" && stateClass !== "total_increasing") return false;
  return true;
}
function sourcePlans(energy = {}, kind = "month", states = {}, overrides = {}, resolver = (value) => value) {
  return PERIOD_SOURCES.flatMap((definition) => {
    const group = energy?.[definition.group] || {};
    const explicitKey = definition.periodKeys[kind];
    const explicit2 = String(group?.[explicitKey] || "").trim();
    const total = String(group?.[definition.totalKey] || "").trim();
    const legacy = String(overrides?.[definition.slots[kind]] || "").trim();
    const resolvedExplicit = resolveEntity(explicit2, resolver);
    const resolvedTotal = resolveEntity(total, resolver);
    const explicitAliasesTotal = Boolean(
      explicit2 && total && resolvedExplicit && resolvedExplicit === resolvedTotal
    );
    if (explicit2 && !explicitAliasesTotal) {
      const plans = [
        {
          ...definition,
          kind,
          slot: definition.slots[kind],
          entity: resolvedExplicit,
          source: explicit2,
          direct: true,
          reason: "explicit-period"
        }
      ];
      const historicalSource = total || (isCumulativeEnergyEntity(explicit2, states, resolver) ? explicit2 : "");
      if (historicalSource) {
        plans.push({
          ...definition,
          kind,
          slot: definition.slots[kind],
          entity: resolveEntity(historicalSource, resolver),
          source: historicalSource,
          direct: false,
          fallback: true,
          reason: total ? "canonical-total-fallback" : "explicit-cumulative-fallback"
        });
      }
      return plans;
    }
    const source = total || explicit2 || legacy;
    if (!source) return [];
    if (!total && !explicit2 && !isCumulativeEnergyEntity(legacy, states, resolver)) return [];
    return [
      {
        ...definition,
        kind,
        slot: definition.slots[kind],
        entity: resolveEntity(source, resolver),
        source,
        direct: false,
        reason: explicitAliasesTotal ? "period-aliases-total" : total ? "canonical-total" : "legacy-cumulative"
      }
    ];
  }).map((plan) => ({
    ...plan,
    unita: unitaDellEntita(plan.entity, states),
    sorgente: sorgenteDichiarata(plan.entity, states)
  }));
}
function smistaIPiani(plans = [], selected, states = {}) {
  const valori = /* @__PURE__ */ new Map();
  const direct = plans.filter((plan) => plan.direct);
  const selectedDate = new Date(selected);
  const today = /* @__PURE__ */ new Date();
  const directIsCurrent = (kind) => kind === "day" ? selectedDate.toDateString() === today.toDateString() : kind === "year" ? selectedDate.getFullYear() === today.getFullYear() : selectedDate.getFullYear() === today.getFullYear() && selectedDate.getMonth() === today.getMonth();
  direct.filter((plan) => directIsCurrent(plan.kind)).forEach((plan) => {
    const value = readDirectState(plan.entity, states);
    if (value != null) valori.set(plan.key, value);
  });
  const currentDirectKeys = new Set(
    direct.filter((plan) => directIsCurrent(plan.kind)).map((plan) => plan.key)
  );
  const daRicavare = plans.filter(
    (plan) => !plan.direct && !(plan.fallback && currentDirectKeys.has(plan.key))
  );
  return { valori, daRicavare };
}
function chiaveDellArco(range) {
  return `${range.kind}|${range.period}|${range.start.getTime()}|${range.end.getTime()}`;
}
function crescitaNellArco(righe2 = [], range, { continuazione = false } = {}) {
  const inizio = range.start.getTime();
  const fine = range.end.getTime();
  const ordinate = (Array.isArray(righe2) ? righe2 : []).slice().sort((sinistra, destra) => rowTimestamp(sinistra) - rowTimestamp(destra));
  const prima = ordinate.filter((riga) => rowTimestamp(riga) < inizio);
  const dentro = ordinate.filter(
    (riga) => rowTimestamp(riga) >= inizio && rowTimestamp(riga) < fine
  );
  const partenza = prima.at(-1) || (continuazione ? null : contatoreNatoDentro(prima, dentro, inizio));
  if (!dentro.length) return null;
  if (!partenza && dentro.length < 2) return null;
  const base = partenza || dentro[0];
  const secchielli = partenza ? dentro : dentro.slice(1);
  return recorderBucketConsumptions(secchielli, base).reduce(
    (totale, riga) => totale + Math.max(0, Number(riga.change) || 0),
    0
  );
}
function energiaPrimaDelleStatistiche(righe2 = [], range) {
  if (!range?.start || !range?.end) return 0;
  const inizio = range.start.getTime();
  const fine = range.end.getTime();
  const ordinate = (Array.isArray(righe2) ? righe2 : []).slice().sort((sinistra, destra) => rowTimestamp(sinistra) - rowTimestamp(destra));
  if (ordinate.some((riga) => rowTimestamp(riga) < inizio)) return 0;
  const prima = ordinate.find((riga) => rowTimestamp(riga) >= inizio && rowTimestamp(riga) < fine);
  if (!prima) return 0;
  const lettura = letturaDelContatore(prima);
  const somma = cumulativeValue(prima);
  if (lettura == null || somma == null) return 0;
  return Math.max(0, lettura - somma);
}
var GIORNO_MS = 864e5;
var QUANTO_SI_ALLUNGA = 4;
var QUANTO_PUO_SFORARE = 3;
function testaDellArco(righe2 = [], range, cresciuta = null) {
  const quanta = energiaPrimaDelleStatistiche(righe2, range);
  if (!(quanta > 0)) return { quanta: 0, contata: false };
  const corta = { quanta, contata: false };
  const inizio = range.start.getTime();
  const fine = range.end.getTime();
  const dentro = (Array.isArray(righe2) ? righe2 : []).map(rowTimestamp).filter((quando) => Number.isFinite(quando) && quando >= inizio && quando < fine).sort((sinistra, destra) => sinistra - destra);
  if (!dentro.length) return corta;
  if (dentro[0] <= inizio) return corta;
  const misurato = Number(cresciuta);
  if (!Number.isFinite(misurato) || misurato <= 0) return corta;
  const giorniMisurati = (fine - dentro[0]) / GIORNO_MS;
  const giorniDiVuoto = (dentro[0] - inizio) / GIORNO_MS;
  if (giorniMisurati <= 0 || giorniDiVuoto <= 0) return corta;
  if (giorniDiVuoto > giorniMisurati * QUANTO_SI_ALLUNGA) return corta;
  const passo = misurato / giorniMisurati;
  return { quanta, contata: quanta <= passo * giorniDiVuoto * QUANTO_PUO_SFORARE };
}
function contatoreNatoDentro(prima, dentro, inizio) {
  if (prima.length || !dentro.length) return null;
  if (rowTimestamp(dentro[0]) <= inizio) return null;
  return { start: new Date(inizio).toISOString(), sum: 0 };
}
function readDirectState(entity, states = {}) {
  const state = states?.[entity];
  const value = finite(state?.state);
  if (value == null) return null;
  const inKwh = inKilowattora(value, state?.attributes?.unit_of_measurement);
  return inKwh == null ? null : Math.max(0, inKwh);
}
var TEMPO_MASSIMO_STATISTICHE = 6e4;
var CORSIE_DEL_RECORDER = 2;
var PESANTI_PER_IL_RECORDER = Object.freeze(
  /* @__PURE__ */ new Set(["recorder/statistics_during_period", "history/history_during_period"])
);
var PASSO_DELLE_STATISTICHE_MS = 5 * 6e4;
var AFFANNO_DEL_RECORDER_MS = PASSO_DELLE_STATISTICHE_MS;
var VERIFICA_DELLA_PRESA_MS = 5e3;
var VOCI_TENUTE_IN_CACHE = 64;
function arcoChiuso(fine, adesso3 = Date.now()) {
  const a = momentoDi(fine);
  return a != null && a <= adesso3 - PASSO_DELLE_STATISTICHE_MS;
}
function momentoDi(valore) {
  if (valore instanceof Date) return valore.getTime();
  const numero = typeof valore === "number" ? valore : Date.parse(valore);
  return Number.isFinite(numero) ? numero : null;
}
function fineDaChiave(fine, adesso3 = Date.now()) {
  const a = momentoDi(fine);
  if (a == null) return String(fine);
  if (arcoChiuso(a, adesso3)) return new Date(a).toISOString();
  return new Date(
    Math.floor(a / PASSO_DELLE_STATISTICHE_MS) * PASSO_DELLE_STATISTICHE_MS
  ).toISOString();
}
var TEMPO_PER_L_ISTANTANEA = 6e4;
var RIPRESA_DEL_FLUSSO_MS = 1e3;
var RIPRESA_DEL_FLUSSO_MASSIMA_MS = 3e4;
function tempoPerLeStatistiche(start, end, base = 12e3) {
  const da = Date.parse(start);
  const a = Date.parse(end);
  if (!Number.isFinite(da) || !Number.isFinite(a) || a <= da) return base;
  const giorni = (a - da) / 864e5;
  const cresciuto = giorni <= 2 ? base : base + Math.round((giorni - 2) * 500);
  return Math.min(TEMPO_MASSIMO_STATISTICHE, Math.max(base, cresciuto));
}
function eUnErroreDiCompatibilita(errore) {
  const testo2 = String(errore?.message || errore || "").toLowerCase();
  if (!testo2) return false;
  if (/timeout|socket|connection|closed|network|abort/.test(testo2)) return false;
  return /unit|unknown|invalid|unsupported|not a valid|extra keys|required key/.test(testo2);
}
var HomeAssistantBroker = class {
  /* La risposta del periodo corrente vale quanto dura il dato: cinque minuti.
   *
   * Era un minuto, ed era gia' un compromesso; ma il minuto non lo vedeva
   * nessuno, perche' la chiave della cache portava la fine dell'arco al
   * millisecondo — cioe' «adesso» — e ogni giro nasceva una chiave nuova:
   * nessuna risposta e' mai stata riusata, e ogni aggiornamento tornava sul
   * Recorder (dal campo: la CPU del mini PC). Adesso la chiave e' arrotondata
   * al passo con cui le statistiche si compilano, e il tempo che si tiene e'
   * lo stesso passo: prima di allora la stessa domanda porta le stesse righe. */
  constructor({
    timeout = 12e3,
    cacheCurrentMs = PASSO_DELLE_STATISTICHE_MS,
    cacheHistoricalMs = 6e5,
    ripresaDelFlussoMs = RIPRESA_DEL_FLUSSO_MS,
    tenute: tenute2 = new StatisticheTenute()
  } = {}) {
    this.timeout = timeout;
    this.tenute = tenute2;
    this.cacheCurrentMs = cacheCurrentMs;
    this.cacheHistoricalMs = cacheHistoricalMs;
    this.ripresaDelFlussoMs = ripresaDelFlussoMs;
    this.flussoVoluto = null;
    this.ripresaDelFlusso = 0;
    this.tentativiDelFlusso = 0;
    this.inFilaAlRecorder = [];
    this.inCorsoAlRecorder = 0;
    this.recorderLentoDa = 0;
    this.ultimoSegno = 0;
    this.verificaInCorso = null;
    this.socket = null;
    this.connection = null;
    this.authenticated = false;
    this.nextId = 15e4;
    this.pending = /* @__PURE__ */ new Map();
    this.inflight = /* @__PURE__ */ new Map();
    this.cache = /* @__PURE__ */ new Map();
    this.subscription = 0;
    this.statesStarted = false;
  }
  /* Il flusso degli stati si tiene vivo da solo.
   *
   * Prima si partiva una volta, all'avvio, e se quell'unico tentativo andava
   * male — l'istantanea scaduta, la presa non ancora aperta — nessuno
   * riprovava: niente sottoscrizione, niente eventi, la Home ferma sui numeri
   * dell'avvio finche' non si ricaricava la pagina. Qui si riprova finche'
   * non riesce, con una pausa che si allarga, e si riparte da capo ogni volta
   * che la presa cade (`reset`): e' quello che fa una presa vera. */
  keepStateFeedAlive({ snapshot = true, onReady = () => {
  }, onError = () => {
  } } = {}) {
    this.flussoVoluto = { snapshot, onReady, onError };
    this.tentativiDelFlusso = 0;
    this.ascoltaIlRisveglio();
    return this.riprendiIlFlusso();
  }
  /* La presa dopo che il telefono ha dormito.
   *
   * Dal campo: «Il Recorder di Home Assistant ci ha messo troppo a
   * rispondere… poi non si aggiorna, devo chiudere e riaprire l'app». Con
   * l'app in tasca il sistema congela la pagina, e la rete cambia (5G,
   * Wi-Fi): la presa resta «aperta» per il browser, ma dall'altra parte non
   * c'e' piu' nessuno. Ogni domanda scadeva, la colpa andava al Recorder, e
   * gli eventi che muovono le tessere non arrivavano piu'. Tornando davanti
   * si chiede un «ping» con poco tempo: se non torna, la presa si butta e se
   * ne apre una nuova, col flusso degli stati. */
  ascoltaIlRisveglio() {
    if (this.risveglioInAscolto) return;
    this.risveglioInAscolto = true;
    const doc2 = globalThis.document;
    const sveglia = () => {
      if (doc2?.visibilityState === "hidden") return;
      void this.verificaLaPresa();
    };
    doc2?.addEventListener?.("visibilitychange", sveglia);
    globalThis.addEventListener?.("pageshow", sveglia);
    globalThis.addEventListener?.("online", sveglia);
  }
  /** Se la presa aperta risponde ancora; se no si rifa'. */
  verificaLaPresa(attesa = VERIFICA_DELLA_PRESA_MS) {
    if (this.verificaInCorso) return this.verificaInCorso;
    if (!this.socket || !this.authenticated) {
      if (this.flussoVoluto) void this.riprendiIlFlusso();
      return Promise.resolve(false);
    }
    this.verificaInCorso = this.spedisci({ type: "ping" }, attesa).then(() => true).catch(() => false).finally(() => {
      this.verificaInCorso = null;
    });
    return this.verificaInCorso;
  }
  async riprendiIlFlusso() {
    const voluto = this.flussoVoluto;
    if (!voluto || this.ripresaDelFlusso) return false;
    if (this.statesStarted && this.subscription) return true;
    try {
      await this.startStateFeed({ snapshot: voluto.snapshot });
      this.tentativiDelFlusso = 0;
      voluto.onReady();
      return true;
    } catch (error) {
      voluto.onError(error);
      this.tentativiDelFlusso += 1;
      const attesa = Math.min(
        RIPRESA_DEL_FLUSSO_MASSIMA_MS,
        this.ripresaDelFlussoMs * 2 ** Math.min(10, this.tentativiDelFlusso - 1)
      );
      this.programmaLaRipresa(attesa);
      return false;
    }
  }
  programmaLaRipresa(attesa) {
    if (!this.flussoVoluto || this.ripresaDelFlusso) return;
    this.ripresaDelFlusso = globalThis.setTimeout?.(() => {
      this.ripresaDelFlusso = 0;
      this.riprendiIlFlusso();
    }, attesa) || 0;
  }
  token() {
    if (globalThis.__DASHBOARDMODERN_HOSTED__ === true) return "";
    const values = [
      globalThis.DASHBOARDMODERN_AUTH_TOKEN,
      globalThis.__DASHBOARDMODERN_REAL_TOKEN__,
      globalThis.LONG_LIVED_TOKEN,
      globalThis.HA_TOKEN
    ];
    try {
      const config = JSON.parse(globalThis.localStorage?.getItem("cd_connection") || "{}");
      values.push(config.token, config.access_token);
    } catch (_error) {
    }
    return values.map((value) => String(value || "").trim()).find(Boolean) || "";
  }
  url() {
    const protocol = globalThis.location?.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${globalThis.location?.host || "dashboardmodern-bridge"}/api/websocket`;
  }
  reset(error = null) {
    const socket = this.socket;
    this.socket = null;
    this.connection = null;
    this.authenticated = false;
    this.subscription = 0;
    this.statesStarted = false;
    if (this.flussoVoluto) this.programmaLaRipresa(this.ripresaDelFlussoMs);
    if (error) {
      this.pending.forEach(({ reject, timer }) => {
        globalThis.clearTimeout?.(timer);
        reject(error);
      });
      this.pending.clear();
      this.inflight.clear();
    }
    try {
      if (socket?.readyState === 1) socket.close();
    } catch (_error) {
    }
  }
  ingestState(state, { emitEvent = true } = {}) {
    const id = String(state?.entity_id || "").trim();
    if (!id) return false;
    const copy = { ...state, attributes: { ...state.attributes || {} } };
    const registries = [];
    try {
      if (typeof _RAW_STATES !== "undefined" && _RAW_STATES) registries.push(_RAW_STATES);
    } catch (_error) {
    }
    try {
      if (typeof STATES !== "undefined" && STATES) registries.push(STATES);
    } catch (_error) {
    }
    globalThis._RAW_STATES ||= {};
    globalThis.STATES ||= {};
    registries.push(globalThis._RAW_STATES, globalThis.STATES);
    [...new Set(registries)].forEach((registry) => {
      registry[id] = copy;
    });
    if (emitEvent && !copy.attributes?.dashboardmodern_derived && typeof globalThis.CustomEvent === "function") {
      globalThis.dispatchEvent?.(
        new globalThis.CustomEvent("dashboardmodern:state-changed", {
          detail: { entity_id: id, state: copy }
        })
      );
    }
    return true;
  }
  handleMessage(event, resolveConnection, rejectConnection) {
    let message;
    try {
      message = JSON.parse(event?.data || event);
    } catch (_error) {
      return;
    }
    this.ultimoSegno = Date.now();
    if (message.type === "auth_required") {
      const token = this.token();
      if (!token) {
        rejectConnection(new Error("Home Assistant token missing"));
        return;
      }
      this.socket?.send(JSON.stringify({ type: "auth", access_token: token }));
      return;
    }
    if (message.type === "auth_ok") {
      this.authenticated = true;
      resolveConnection(this.socket);
      return;
    }
    if (message.type === "auth_invalid") {
      rejectConnection(new Error(message.message || "Invalid Home Assistant authentication"));
      return;
    }
    if (message.type === "event" && message.id === this.subscription) {
      this.ingestState(message.event?.data?.new_state);
      return;
    }
    if (message.type !== "result" && message.type !== "pong" || message.id == null) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    globalThis.clearTimeout?.(pending.timer);
    if (message.success === false)
      pending.reject(new Error(message.error?.message || "HA request failed"));
    else pending.resolve(message.result ?? null);
  }
  connect() {
    if (this.authenticated && this.socket?.readyState === 1) return Promise.resolve(this.socket);
    if (this.connection) return this.connection;
    if (typeof globalThis.WebSocket !== "function") {
      return Promise.reject(new Error("WebSocket unavailable"));
    }
    this.connection = new Promise((resolve, reject) => {
      let settled = false;
      let timer = 0;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout?.(timer);
        callback(value);
      };
      timer = globalThis.setTimeout?.(() => {
        try {
          if (this.socket) this.socket.close();
        } catch (_error) {
        }
        finish(reject, new Error("Home Assistant connection timeout"));
      }, this.timeout);
      try {
        const socket = new globalThis.WebSocket(this.url());
        this.socket = socket;
        socket.onmessage = (event) => this.handleMessage(
          event,
          (value) => finish(resolve, value),
          (error) => finish(reject, error)
        );
        socket.onerror = () => finish(reject, new Error("Home Assistant connection unavailable"));
        socket.onclose = () => {
          if (this.socket === socket) this.reset();
        };
      } catch (error) {
        finish(reject, error);
      }
    }).catch((error) => {
      this.reset(error);
      throw error;
    }).finally(() => {
      this.connection = null;
    });
    return this.connection;
  }
  /* `timeout` e' per le domande che si sa che pesano — un mese di storico da
   * un Recorder lento, attraverso Nabu Casa — e non deve cambiare il tempo di
   * tutte le altre. Senza, e' quello del broker. */
  /* Al Recorder si chiedono al massimo due cose per volta.
   *
   * Un aggiornamento dell'Energia lancia sette domande insieme — giorno,
   * mese, anno, i dispositivi per ognuno, i carichi — e ognuna e' una lettura
   * delle statistiche sul database. Su un server piccolo si contendono il
   * disco a vicenda: tutte rallentano, qualcuna scade, e la pagina resta sul
   * velo o su «0 kWh · timeout» (dal campo: il mini PC). In fila nessuna
   * domanda aspetta le altre mentre il suo cronometro corre: il tempo concesso
   * parte quando la domanda parte davvero, non quando si mette in fila.
   *
   * Una per volta (1.4.11) era troppo poco: sette domande in fila su un
   * Recorder da due secondi sono quattordici secondi prima del primo numero,
   * «devi velocizzare il caricamento dei dati energia». Due corsie dimezzano
   * l'attesa e restano lontane dalle sette di prima. */
  async request(payload, timeout = this.timeout) {
    if (!PESANTI_PER_IL_RECORDER.has(payload?.type)) return this.spedisci(payload, timeout);
    return new Promise((resolve, reject) => {
      this.inFilaAlRecorder.push(
        () => this.spedisci(payload, timeout).then(resolve, reject).finally(() => {
          this.inCorsoAlRecorder -= 1;
          this.avanzaLaFila();
        })
      );
      this.avanzaLaFila();
    });
  }
  /* La fila va avanti anche quando una domanda cade: chi viene dopo non
   * eredita il fallimento di chi lo precedeva. */
  avanzaLaFila() {
    while (this.inCorsoAlRecorder < CORSIE_DEL_RECORDER && this.inFilaAlRecorder.length) {
      this.inCorsoAlRecorder += 1;
      this.inFilaAlRecorder.shift()();
    }
  }
  /** Se il Recorder ha appena fatto scadere una domanda: chi aggiorna rallenta. */
  recorderInAffanno(adesso3 = Date.now()) {
    return this.recorderLentoDa > 0 && adesso3 - this.recorderLentoDa < AFFANNO_DEL_RECORDER_MS;
  }
  async spedisci(payload, timeout = this.timeout) {
    const socket = await this.connect();
    const id = ++this.nextId;
    const perIlRecorder = payload?.type === "recorder/statistics_during_period";
    if (perIlRecorder) runtimeMetrics.increment("recorderRequests");
    const attesa = Number.isFinite(Number(timeout)) && Number(timeout) > 0 ? Number(timeout) : this.timeout;
    const partita = Date.now();
    return new Promise((resolve, reject) => {
      const timer = globalThis.setTimeout?.(() => {
        this.pending.delete(id);
        const zitta = socket === this.socket && this.ultimoSegno < partita;
        if (zitta && payload?.type === "ping") {
          const persa = new Error("Home Assistant connection lost");
          reject(persa);
          this.reset(persa);
          return;
        }
        if (zitta) void this.verificaLaPresa(Math.min(VERIFICA_DELLA_PRESA_MS, this.timeout));
        else if (perIlRecorder) this.recorderLentoDa = Date.now();
        reject(new Error("Home Assistant response timeout"));
      }, attesa);
      this.pending.set(id, { resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ id, ...payload }));
      } catch (error) {
        globalThis.clearTimeout?.(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  async cachedRequest(payload, cacheKey, maxAge = 0, timeout = 0) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.at < maxAge) {
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached.value;
    }
    if (this.inflight.has(cacheKey)) return this.inflight.get(cacheKey);
    const promise = this.request(payload, timeout).then((value) => {
      if (maxAge > 0) {
        this.cache.set(cacheKey, { at: Date.now(), fino: Date.now() + maxAge, value });
        this.potaLaCache();
      }
      return value;
    }).finally(() => this.inflight.delete(cacheKey));
    this.inflight.set(cacheKey, promise);
    return promise;
  }
  /* La cache non cresce per sempre.
   *
   * Prima nessuna voce ne usciva mai: su una plancia accesa giorno e notte —
   * il tablet appeso al muro — la memoria del browser saliva e basta. Escono
   * le scadute, che non risponderebbero piu' a nessuno, e poi le piu' vecchie
   * finche' non si sta dentro il numero di voci che si tengono. */
  potaLaCache(adesso3 = Date.now(), tenute2 = VOCI_TENUTE_IN_CACHE) {
    for (const [chiave, voce] of this.cache) {
      if (Number(voce?.fino) > adesso3) continue;
      this.cache.delete(chiave);
    }
    for (const chiave of this.cache.keys()) {
      if (this.cache.size <= tenute2) break;
      this.cache.delete(chiave);
    }
    return this.cache.size;
  }
  async statistics(ids, start, end, period = "day", unita = {}) {
    const originals = [...new Set((ids || []).map(String).filter(Boolean))];
    if (!originals.length) return {};
    const mapped = new Map(originals.map((id) => [id, resolveEntity(id)]));
    const statisticIds = [...new Set([...mapped.values()].filter(Boolean))];
    const startIso = new Date(start).toISOString();
    const endIso = new Date(end).toISOString();
    const key = `statistics|${period}|${startIso}|${fineDaChiave(endIso)}|${statisticIds.join(",")}`;
    const payload = {
      type: "recorder/statistics_during_period",
      start_time: startIso,
      end_time: endIso,
      statistic_ids: statisticIds,
      period,
      /* Anche `state`, che costa una colonna in piu' sulle stesse righe.
       *
       * E' la lettura del contatore, e serve quando la `sum` del Recorder e'
       * piu' corta della vita dell'apparecchio (vedi `crescitaNellArco`). */
      types: ["sum", "state"],
      units: { energy: "kWh" }
    };
    const { result, grezze } = await this.righeDelRecorder(payload, key, startIso, endIso);
    return Object.fromEntries(
      originals.map((id) => {
        const righe2 = result?.[mapped.get(id)] || result?.[id] || [];
        if (!grezze) return [id, righe2];
        return [id, righeInKilowattora(righe2, unita?.[id] || unita?.[mapped.get(id)] || "")];
      })
    );
  }
  /* Le righe di un arco: intero, o un mese alla volta se intero non ci sta.
   *
   * Vedi `statistiche-tenute.js`: l'anno in una domanda sola, su una casa con
   * lo storico grande, scadeva sempre, e scadendo non si teneva mai. Un arco
   * piu' lungo di un mese che scade si rifa' a spicchi — le stesse righe — e
   * per una settimana quella casa si chiede direttamente a spicchi, senza
   * buttare ogni volta il minuto della domanda intera. */
  async righeDelRecorder(payload, key, startIso, endIso) {
    const spicchi = spicchiDellArco(startIso, endIso);
    if (spicchi.length > 1 && this.tenute.recorderLento())
      return this.righeASpicchi(payload, key, spicchi);
    try {
      return await this.righeDiUnArco(payload, key, startIso, endIso);
    } catch (errore) {
      if (spicchi.length < 2 || !/timeout/i.test(String(errore?.message || errore))) throw errore;
      this.tenute.segnaIlRecorderLento();
      return this.righeASpicchi(payload, key, spicchi);
    }
  }
  async righeASpicchi(payload, key, spicchi) {
    const risposte = await Promise.all(
      spicchi.map(({ start, end }) => {
        const da = start.toISOString();
        const a = end.toISOString();
        return this.righeDiUnArco(
          { ...payload, start_time: da, end_time: a },
          `${key}|spicchio|${da}|${fineDaChiave(a)}`,
          da,
          a
        );
      })
    );
    return {
      result: unisciLeRighe(risposte.map((risposta) => risposta.result)),
      grezze: risposte.some((risposta) => risposta.grezze)
    };
  }
  /* Una domanda sola al Recorder. Se l'arco e' chiuso, la risposta si tiene
   * anche sul dispositivo (`StatisticheTenute`), e da li' si riprende. */
  async righeDiUnArco(payload, key, startIso, endIso) {
    const historical = arcoChiuso(endIso);
    if (historical) {
      const tenuta2 = this.tenute.prendi(key);
      if (tenuta2?.result) return tenuta2;
    }
    const eta = this.cacheHistoricalMs;
    const attesa = tempoPerLeStatistiche(startIso, endIso, this.timeout);
    let result;
    let grezze = false;
    try {
      result = await this.cachedRequest(
        payload,
        key,
        historical ? eta : this.cacheCurrentMs,
        attesa
      );
    } catch (error) {
      if (!eUnErroreDiCompatibilita(error)) throw error;
      const compatiblePayload = { ...payload };
      delete compatiblePayload.units;
      const compatibleKey = `${key}|compat`;
      result = await this.cachedRequest(
        compatiblePayload,
        compatibleKey,
        historical ? eta : this.cacheCurrentMs,
        attesa
      );
      grezze = true;
    }
    if (historical && result && Object.values(result).some((righe2) => righe2?.length))
      this.tenute.metti(key, { result, grezze });
    return { result, grezze };
  }
  /* Chi si legge dallo stato e chi lo deve ricavare il Recorder.
   *
   * La scelta e' la stessa per chiunque chieda dei valori — l'Energia, gli
   * elettrodomestici, i carichi — e per questo sta scritta una volta sola. */
  async valuesForPlans(plans, selected, states = globalThis.STATES || {}) {
    const { valori, daRicavare } = smistaIPiani(plans, selected, states);
    if (!daRicavare.length) return valori;
    const kind = daRicavare[0].kind;
    const { caduti } = await this.valoriPerArchi(
      archiDelPeriodo(kind, selected).map((range) => ({ plans: daRicavare, range })),
      valori
    );
    if (caduti.length && !valori.size) throw caduti[0].errore;
    return valori;
  }
  /* Piu' archi in una volta: UNA domanda al Recorder per arco.
   *
   * Un aggiornamento dell'Energia erano sette letture delle statistiche —
   * giorno, mese, anno, i dispositivi per ognuno, i carichi — e due di quelle
   * coprivano tredici mesi. Le fonti, i dispositivi e i carichi dello stesso
   * arco chiedono le stesse righe allo stesso pezzo di database: messi
   * insieme sono una domanda sola con piu' entita' dentro, che per il
   * Recorder e' quasi lo stesso lavoro di una (dal campo, la #333: aprendo
   * il Report «il Recorder e' lento» e tutti i valori a zero).
   *
   * E un piano che compare in DUE archi vale la somma delle sue crescite: e'
   * cosi' che l'anno costa poco — i mesi chiusi non cambiano piu', la loro
   * risposta si tiene, e del mese aperto si rilegge solo quello, che e'
   * l'arco che si stava gia' chiedendo per la Mensile.
   *
   * Un arco che cade non porta giu' gli altri: quello che e' arrivato si
   * tiene, e chi ha chiesto decide (vedi il pacchetto parziale dell'Energia). */
  /* I giorni, per chi li chiede.
   *
   * La domanda al Recorder torna GIA' a giorni — `period` di un arco mensile
   * e' `day` — e qui si riducevano a un totale, buttando la serie. Il picco
   * del mese e' il massimo di quella serie: senza tenerla si doveva chiedere
   * di nuovo, e una seconda domanda per un dato che era gia' arrivato e' un
   * giro di Recorder regalato.
   *
   * Si tiene solo per chi mette `conIGiorni` nella richiesta: tenerla per
   * tutte vorrebbe dire portarsi dietro trecento righe per ogni misura di
   * ogni periodo, e a novantanove di quelle non serve nessuno.
   */
  async valoriPerArchi(richieste = [], valori = /* @__PURE__ */ new Map(), alPasso = () => {
  }, giorni = /* @__PURE__ */ new Map(), ammanchi = /* @__PURE__ */ new Map()) {
    const perArco = /* @__PURE__ */ new Map();
    const primoArco = /* @__PURE__ */ new Map();
    for (const { plans = [], range, conIGiorni = false } of richieste) {
      if (!range || !plans.length || range.end <= range.start) continue;
      const chiave = chiaveDellArco(range);
      const gruppo = perArco.get(chiave) || { range, chiave, plans: [], conIGiorni: false };
      gruppo.plans.push(...plans);
      if (conIGiorni) gruppo.conIGiorni = true;
      perArco.set(chiave, gruppo);
      const quando = range.start.getTime();
      for (const plan of plans) {
        if (!plan?.key) continue;
        const visto = primoArco.get(plan.key);
        if (visto == null || quando < visto) primoArco.set(plan.key, quando);
      }
    }
    const caduti = [];
    const gruppi = [...perArco.values()];
    let fatte = 0;
    alPasso(fatte, gruppi.length);
    await Promise.all(
      gruppi.map(async ({ range, chiave, plans, conIGiorni }) => {
        try {
          const ids = [...new Set(plans.map((plan) => plan.entity).filter(Boolean))];
          if (!ids.length) return;
          const baseline = baselineRange(range.kind, range.start);
          const unita = Object.fromEntries(
            plans.filter((plan) => plan.entity).map((plan) => [plan.entity, plan.unita || ""])
          );
          const righe2 = await this.statistics(ids, baseline.start, range.end, range.period, unita);
          const conLaTestaCorta = plans.filter((plan) => {
            const sorgente = String(plan?.sorgente ?? "").trim();
            if (!sorgente || sorgente === plan.entity) return false;
            const continuazione = (primoArco.get(plan.key) ?? range.start.getTime()) < range.start.getTime();
            if (continuazione) return false;
            return energiaPrimaDelleStatistiche(righe2[plan.entity], range) > 0;
          });
          const dalleSorgenti = conLaTestaCorta.length ? await this.statistics(
            [...new Set(conLaTestaCorta.map((plan) => plan.sorgente))],
            baseline.start,
            range.end,
            range.period,
            Object.fromEntries(
              conLaTestaCorta.map((plan) => [plan.sorgente, plan.unita || ""])
            )
          ) : {};
          const piuLunga = new Map(
            conLaTestaCorta.flatMap((plan) => {
              const sue = righe2[plan.entity] || [];
              const della = dalleSorgenti[plan.sorgente] || [];
              const primaSua = sue.map(rowTimestamp).filter(Boolean).sort()[0] ?? Infinity;
              const primaDella = della.map(rowTimestamp).filter(Boolean).sort()[0] ?? Infinity;
              if (!della.length || primaDella >= primaSua) return [];
              return [[plan.key, della]];
            })
          );
          for (const plan of plans) {
            const continuazione = (primoArco.get(plan.key) ?? range.start.getTime()) < range.start.getTime();
            const prestate = piuLunga.get(plan.key);
            const mie = prestate || righe2[plan.entity];
            const crescita = crescitaNellArco(mie, range, { continuazione });
            const testa = continuazione ? { quanta: 0, contata: false } : testaDellArco(mie, range, crescita);
            if (testa.quanta > 0) ammanchi.set(plan.key, testa);
            if (crescita == null) continue;
            const totale = crescita + (testa.contata ? testa.quanta : 0);
            const arrotondata = Math.round(totale * 1e3) / 1e3;
            valori.set(plan.key, (valori.get(plan.key) ?? 0) + arrotondata);
            if (conIGiorni) {
              const dentro = (mie || []).filter((riga) => {
                const quando = rowTimestamp(riga);
                return quando >= range.start.getTime() && quando < range.end.getTime();
              });
              const prima = (mie || []).filter(
                (riga) => rowTimestamp(riga) < range.start.getTime()
              );
              giorni.set(plan.key, recorderBucketConsumptions(dentro, prima.at(-1) || null));
            }
          }
        } catch (errore) {
          caduti.push({ chiave, errore });
        } finally {
          fatte += 1;
          alPasso(fatte, gruppi.length);
        }
      })
    );
    return { valori, caduti, giorni, ammanchi };
  }
  async valuesForEntities(ids, kind, selected) {
    const plans = [...new Set((ids || []).map(String).filter(Boolean))].map((entity) => ({
      key: entity,
      entity: resolveEntity(entity),
      source: entity,
      kind,
      direct: false
    }));
    return this.valuesForPlans(plans, selected);
  }
  /* Il flusso degli stati: prima la sottoscrizione, poi l'istantanea.
   *
   * Prima era il contrario, e l'istantanea era anche una domanda in piu':
   * il guscio della plancia chiede gia' `get_states` sulla sua presa e
   * riempie i registri che leggono tutti (`STATES`, `_RAW_STATES`), e qui se
   * ne chiedeva un'altra uguale — due volte tutta la casa a ogni avvio,
   * sulla stessa connessione — con dodici secondi di tempo. Sul telefono
   * scadeva, e con lei moriva la sottoscrizione che veniva dopo. Adesso la
   * sottoscrizione parte subito, che e' leggera e non dipende da niente, e
   * l'istantanea si chiede solo a chi non ha un guscio che la porta
   * (`snapshot: false` quando c'e'). */
  async startStateFeed({ snapshot = true } = {}) {
    if (this.statesStarted && this.subscription) return true;
    this.statesStarted = true;
    try {
      await this.subscribeToStates();
      if (snapshot) await this.snapshotStates();
      return true;
    } catch (error) {
      this.statesStarted = false;
      throw error;
    }
  }
  async subscribeToStates() {
    const socket = await this.connect();
    if (this.subscription && this.socket === socket) return this.subscription;
    const id = ++this.nextId;
    await new Promise((resolve, reject) => {
      const timer = globalThis.setTimeout?.(() => {
        this.pending.delete(id);
        reject(new Error("State subscription timeout"));
      }, this.timeout);
      this.pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, type: "subscribe_events", event_type: "state_changed" }));
    });
    this.subscription = id;
    return id;
  }
  /* Tutti gli stati in una volta, nei registri, senza un evento per ognuno. */
  async snapshotStates() {
    const states = await this.cachedRequest(
      { type: "get_states" },
      "get_states",
      5e3,
      TEMPO_PER_L_ISTANTANEA
    );
    (Array.isArray(states) ? states : []).forEach(
      (state) => this.ingestState(state, { emitEvent: false })
    );
    return Array.isArray(states) ? states.length : 0;
  }
};

// src/core/i-dispositivi-di-home-assistant.js
var CHIAVE_DEI_DISPOSITIVI = "dm_dispositivi_di_home_assistant";
var FRESCHEZZA = 1500;
var pulito2 = (valore) => typeof valore === "string" ? valore.trim() : "";
function nonSiSaNiente(mappe) {
  return !mappe || !mappe.di || !Object.keys(mappe.di).length;
}
function dispositiviDalGuscio(wiz) {
  const registro = wiz?.entReg;
  if (!registro || typeof registro !== "object") return { di: {}, nomi: {} };
  const di = {};
  for (const [entita, riga] of Object.entries(registro)) {
    const id = pulito2(entita);
    const suo = pulito2(riga?.d);
    if (id && suo) di[id] = suo;
  }
  const nomi = {};
  const scritti = wiz?.devNames;
  if (scritti && typeof scritti === "object")
    for (const [suo, nome] of Object.entries(scritti)) {
      const id = pulito2(suo);
      const scritto = pulito2(nome);
      if (id && scritto) nomi[id] = scritto;
    }
  return { di, nomi };
}
var tenute = null;
var letteA = 0;
function adesso() {
  return Date.now();
}
function ricordaIDispositivi(mappe, storage = globalThis.localStorage) {
  if (nonSiSaNiente(mappe)) return false;
  let modelli = mappe.modelli && typeof mappe.modelli === "object" ? mappe.modelli : {};
  if (!Object.keys(modelli).length) modelli = iDispositiviRicordati(storage).modelli || {};
  let scritta = "";
  try {
    scritta = JSON.stringify({ di: mappe.di, nomi: mappe.nomi || {}, modelli });
  } catch (_errore) {
    return false;
  }
  try {
    if (storage?.getItem?.(CHIAVE_DEI_DISPOSITIVI) === scritta) return false;
    storage?.setItem?.(CHIAVE_DEI_DISPOSITIVI, scritta);
  } catch (_errore) {
    return false;
  }
  tenute = { di: mappe.di, nomi: mappe.nomi || {}, modelli };
  letteA = adesso();
  return true;
}
function iDispositiviRicordati(storage = globalThis.localStorage) {
  if (tenute && adesso() - letteA < FRESCHEZZA) return tenute;
  let lette = { di: {}, nomi: {}, modelli: {} };
  try {
    const scritta = storage?.getItem?.(CHIAVE_DEI_DISPOSITIVI);
    const uscita = scritta ? JSON.parse(scritta) : null;
    if (uscita && typeof uscita === "object" && !Array.isArray(uscita))
      lette = {
        di: uscita.di && typeof uscita.di === "object" ? uscita.di : {},
        nomi: uscita.nomi && typeof uscita.nomi === "object" ? uscita.nomi : {},
        modelli: uscita.modelli && typeof uscita.modelli === "object" ? uscita.modelli : {}
      };
  } catch (_errore) {
    lette = { di: {}, nomi: {}, modelli: {} };
  }
  tenute = lette;
  letteA = adesso();
  return lette;
}

// src/core/le-stanze-di-home-assistant.js
var CHIAVE_DELLE_STANZE = "dm_stanze_di_home_assistant";
var FRESCHEZZA2 = 1500;
var pulito3 = (valore) => typeof valore === "string" ? valore.trim() : "";
function stanzeDalGuscio(wiz) {
  const registro = wiz?.entReg;
  if (!registro || typeof registro !== "object") return {};
  const mappa = {};
  for (const [entita, riga] of Object.entries(registro)) {
    const id = pulito3(entita);
    if (!id) continue;
    const area = pulito3(riga?.a) || pulito3(wiz?.devArea?.[pulito3(riga?.d)]) || "";
    const nome = area ? pulito3(wiz?.areaNames?.[area]) : "";
    if (nome) mappa[id] = nome;
  }
  return mappa;
}
var tenuta = null;
var letteA2 = 0;
function adesso2() {
  return Date.now();
}
function ricordaLeStanze(mappa, storage = globalThis.localStorage) {
  if (!mappa || typeof mappa !== "object" || !Object.keys(mappa).length) return false;
  let scritta = "";
  try {
    scritta = JSON.stringify(mappa);
  } catch (_errore) {
    return false;
  }
  try {
    if (storage?.getItem?.(CHIAVE_DELLE_STANZE) === scritta) return false;
    storage?.setItem?.(CHIAVE_DELLE_STANZE, scritta);
  } catch (_errore) {
    return false;
  }
  tenuta = mappa;
  letteA2 = adesso2();
  return true;
}
function leStanzeRicordate(storage = globalThis.localStorage) {
  if (tenuta && adesso2() - letteA2 < FRESCHEZZA2) return tenuta;
  let letta = {};
  try {
    const scritta = storage?.getItem?.(CHIAVE_DELLE_STANZE);
    const uscita = scritta ? JSON.parse(scritta) : null;
    if (uscita && typeof uscita === "object" && !Array.isArray(uscita)) letta = uscita;
  } catch (_errore) {
    letta = {};
  }
  tenuta = letta;
  letteA2 = adesso2();
  return letta;
}
function stanzaRicordata(entita, storage = globalThis.localStorage) {
  const id = pulito3(entita);
  if (!id) return "";
  return pulito3(leStanzeRicordate(storage)[id]);
}

// src/sections/shared.js
var root2 = globalThis;
var doc = root2.document;
function segnaLaCaduta(nome, errore) {
  const cadute = globalThis.__DASHBOARDMODERN_PEZZI_CADUTI__ ||= [];
  cadute.push({ pezzo: String(nome || "?"), errore: String(errore?.message || errore) });
  globalThis.console?.error?.(`[DashboardModern] ${nome || "un pezzo"} non e' partito`, errore);
}
function senzaCadere(installa, nome = installa?.name) {
  try {
    return installa();
  } catch (errore) {
    segnaLaCaduta(nome, errore);
    return void 0;
  }
}
var clean6 = (value) => String(value ?? "").trim();
var finite2 = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
var finiteOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
var activeLocale = () => getLocale();
var english = () => getLocale() === "en";
var locale = () => intlLocale();
var t = (it, en) => {
  const code = getLocale();
  if (code === SOURCE_LOCALE) return it;
  if (code === DEFAULT_LOCALE) return en;
  return translate(en, code);
};
var tr = (en) => translate(en, getLocale());
var esc = (value) => clean6(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
var jsArg = (value) => esc(JSON.stringify(String(value ?? "")));
function readClimateUnits() {
  let values;
  try {
    const raw = root2.localStorage?.getItem?.("cd_clima_units");
    if (raw !== null && raw !== void 0) values = JSON.parse(raw);
  } catch (_error) {
    values = [];
  }
  if (!Array.isArray(values)) values = root2.getClimaUnits?.().slice?.() || [];
  return values.map((item) => ({ ...item, type: canonicalClimateType(item?.type) }));
}
function climaAccesoDaiWatt(entity, states = allStates()) {
  const cercata = clean6(entity);
  if (!cercata) return null;
  const risolta = clean6(root2.resolveEntity?.(cercata) || cercata);
  let unita = null;
  try {
    unita = readClimateUnits().find((voce) => {
      const sua = clean6(voce?.entity || voce?.entity_id || voce?.entities?.[0]);
      return Boolean(sua) && (sua === cercata || sua === risolta);
    }) || null;
  } catch (_errore) {
    return null;
  }
  return accesoPerIlConsumo(unita, states);
}
var ENERGY_RUNTIME_SOURCES = Object.freeze([
  {
    group: "house",
    totalKey: "total_energy",
    periodKeys: ["annual_energy", "monthly_energy", "daily_energy"],
    fallbackKeys: ["annual_energy", "daily_energy"]
  },
  {
    group: "solar",
    totalKey: "total_energy",
    periodKeys: ["annual_energy", "monthly_energy", "daily_energy"],
    fallbackKeys: ["annual_energy", "daily_energy"]
  },
  {
    group: "grid",
    totalKey: "total_import_energy",
    periodKeys: ["annual_import_energy", "monthly_import_energy", "daily_import_energy"],
    fallbackKeys: ["annual_import_energy", "daily_import_energy"]
  },
  {
    group: "grid",
    totalKey: "total_export_energy",
    periodKeys: ["annual_export_energy", "monthly_export_energy", "daily_export_energy"],
    fallbackKeys: ["annual_export_energy", "daily_export_energy"]
  },
  {
    group: "battery",
    totalKey: "total_charged_energy",
    periodKeys: ["annual_charged_energy", "monthly_charged_energy", "daily_charged_energy"],
    fallbackKeys: ["annual_charged_energy", "daily_charged_energy"]
  },
  {
    group: "battery",
    totalKey: "total_discharged_energy",
    periodKeys: [
      "annual_discharged_energy",
      "monthly_discharged_energy",
      "daily_discharged_energy"
    ],
    fallbackKeys: ["annual_discharged_energy", "daily_discharged_energy"]
  }
]);
var ENERGY_RUNTIME_FIELDS = Object.freeze(
  Object.fromEntries(
    ["house", "solar", "grid", "battery"].map((group) => [
      group,
      [
        ...new Set(
          ENERGY_RUNTIME_SOURCES.filter((source) => source.group === group).flatMap((source) => [
            source.totalKey,
            ...source.periodKeys
          ])
        )
      ]
    ])
  )
);
function resolveConfiguredEntity(reference, resolver = root2.resolveEntity) {
  const original = clean6(reference);
  if (!original) return "";
  try {
    return clean6(resolver?.(original) || original);
  } catch (_error) {
    return original;
  }
}
function entityExists(reference, states = {}, resolver = root2.resolveEntity) {
  const original = clean6(reference);
  if (!original) return false;
  if (original.startsWith("dm.")) return true;
  const resolved = resolveConfiguredEntity(original, resolver);
  return Boolean(states?.[original] || states?.[resolved]);
}
function cumulativeEntity(reference, states = {}, resolver = root2.resolveEntity) {
  const original = clean6(reference);
  if (!original) return false;
  const resolved = resolveConfiguredEntity(original, resolver);
  const current = states?.[resolved] || states?.[original];
  const stateClass = clean6(current?.attributes?.state_class).toLowerCase();
  return stateClass === "total" || stateClass === "total_increasing";
}
function sanitizeEnergyModel(value = {}, states = allStates(), resolver = root2.resolveEntity) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const snapshot = states && typeof states === "object" ? states : {};
  if (!Object.keys(snapshot).length) return value;
  let result = value;
  let changed = false;
  const ensureGroup = (group) => {
    if (!changed) {
      result = { ...value };
      changed = true;
    }
    if (result[group] === value[group]) result[group] = { ...value[group] || {} };
    else if (!result[group]) result[group] = {};
    return result[group];
  };
  for (const [group, keys] of Object.entries(ENERGY_RUNTIME_FIELDS)) {
    for (const key of keys) {
      const reference = clean6(value[group]?.[key]);
      if (!reference || entityExists(reference, snapshot, resolver)) continue;
      ensureGroup(group)[key] = "";
    }
  }
  for (const source of ENERGY_RUNTIME_SOURCES) {
    const group = result[source.group] || value[source.group] || {};
    const total = clean6(group[source.totalKey]);
    if (!total || !entityExists(total, snapshot, resolver)) continue;
    for (const key of source.periodKeys) {
      if (!clean6(group[key])) continue;
      ensureGroup(source.group)[key] = "";
    }
  }
  for (const source of ENERGY_RUNTIME_SOURCES) {
    const group = result[source.group] || value[source.group] || {};
    const total = clean6(group[source.totalKey]);
    if (total && entityExists(total, snapshot, resolver)) continue;
    const fallback = source.fallbackKeys.map((key) => clean6(group[key])).find(
      (reference) => entityExists(reference, snapshot, resolver) && cumulativeEntity(reference, snapshot, resolver)
    );
    if (fallback) ensureGroup(source.group)[source.totalKey] = fallback;
  }
  return result;
}
function energyPeriodConflicts(value = {}, states = allStates(), resolver = root2.resolveEntity) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const snapshot = states && typeof states === "object" ? states : {};
  const conflicts = [];
  for (const source of ENERGY_RUNTIME_SOURCES) {
    const group = value[source.group] || {};
    const total = clean6(group[source.totalKey]);
    if (!total || !entityExists(total, snapshot, resolver)) continue;
    const resolvedTotal = resolveConfiguredEntity(total, resolver);
    const ignored = source.periodKeys.map((key) => ({ key, entity: clean6(group[key]) })).filter(
      ({ entity }) => entity && entity !== total && resolveConfiguredEntity(entity, resolver) !== resolvedTotal && entityExists(entity, snapshot, resolver)
    );
    if (ignored.length)
      conflicts.push({ group: source.group, totalKey: source.totalKey, total, ignored });
  }
  return conflicts;
}
function dashboardStore() {
  return root2.DashboardModernModules?.store || null;
}
function section(name, fallback) {
  try {
    const store = dashboardStore();
    const value = (store?.peekSection ? store.peekSection(name) : store?.getSection?.(name)) ?? fallback;
    return name === "energy" ? sanitizeEnergyModel(value, allStates(), root2.resolveEntity) : value;
  } catch (_error) {
    return fallback;
  }
}
function roomLabel(reference) {
  const cercato = String(reference ?? "").trim();
  if (!cercato) return "";
  try {
    const stanze = section("rooms", readJson("cd_stanze", [])) || [];
    for (const room of Array.isArray(stanze) ? stanze : []) {
      const id = String(room?.id ?? "").trim();
      const nome = String(room?.name ?? "").trim();
      if (id && id === cercato || nome && nome === cercato) return nome || cercato;
    }
  } catch (_error) {
  }
  return cercato;
}
function roomOptionsMarkup(selected = "", vuoto = "") {
  const stanze = section("rooms", readJson("cd_stanze", [])) || [];
  const scelto = String(selected ?? "").trim();
  const righe2 = (Array.isArray(stanze) ? stanze : []).map((room) => {
    const valore = String(room?.id || room?.name || "").trim();
    if (!valore) return "";
    const attiva = [room?.id, room?.name].map((voce) => String(voce ?? "").trim()).includes(scelto);
    const simbolo = String(room?.icon || "").trim();
    const glifo = simbolo && !simbolo.startsWith("mdi:") ? `${esc(simbolo)} ` : "";
    return `<option value="${esc(valore)}"${attiva ? " selected" : ""}>${glifo}${esc(room?.name || valore)}</option>`;
  });
  return [`<option value="">— ${esc(vuoto)} —</option>`, ...righe2.filter(Boolean)].join("");
}
function gettoneDiAccesso() {
  if (root2.__DASHBOARDMODERN_HOSTED__ === true) return "";
  const valori = [
    root2.DASHBOARDMODERN_AUTH_TOKEN,
    root2.__DASHBOARDMODERN_REAL_TOKEN__,
    root2.LONG_LIVED_TOKEN,
    root2.HA_TOKEN
  ];
  try {
    const collegamento = readJson("cd_connection", {});
    valori.push(collegamento.token, collegamento.access_token);
  } catch (_error) {
  }
  return valori.map(clean6).find((valore) => valore && valore !== "__dashboardmodern_hosted__") || "";
}
function chiediAHomeAssistant(payload, timeout = 8e3) {
  return new Promise((resolve, reject) => {
    const socket = lexicalGlobal("ws");
    const pending = lexicalGlobal("pendingWsCallbacks");
    if (!socket || socket.readyState !== 1 || !pending) {
      reject(new Error("socket"));
      return;
    }
    let id = 0;
    try {
      id = root2.eval("msgId++");
    } catch (_error) {
      reject(new Error("msgId"));
      return;
    }
    const timer = root2.setTimeout?.(() => {
      delete pending[id];
      reject(new Error("timeout"));
    }, timeout);
    pending[id] = (message) => {
      root2.clearTimeout?.(timer);
      if (message?.success === false) {
        const errore = new Error(clean6(message?.error?.message) || "home assistant");
        const codice = clean6(message?.error?.code);
        if (codice) errore.code = codice;
        const motivo = clean6(message?.error?.motivo);
        if (motivo) errore.motivo = motivo;
        reject(errore);
      } else resolve(message?.result);
    };
    try {
      socket.send(JSON.stringify({ ...payload, id }));
    } catch (error) {
      root2.clearTimeout?.(timer);
      delete pending[id];
      reject(error);
    }
  });
}
var LENTE_SELECTOR = ".dm-entity-picker,.dm-animale-pick,.dm-robot-pick:not(.dm-robot-aggiungi),button[onclick*='wzPickEntity']";
function lexicalGlobal(name) {
  try {
    const value = root2.eval?.(`typeof ${name} !== "undefined" && ${name} ? ${name} : null`);
    if (value) return value;
  } catch (_error) {
  }
  return root2[name] ?? null;
}
var stanzeGiaRicordate = false;
var dispositiviGiaRicordati = false;
function stanzaDiHomeAssistant(entity) {
  const id = clean6(entity);
  if (!id) return "";
  const wiz = lexicalGlobal("WIZ");
  const riga = wiz?.entReg?.[id];
  if (riga) {
    if (!stanzeGiaRicordate) {
      stanzeGiaRicordate = true;
      ricordaLeStanze(stanzeDalGuscio(wiz));
    }
    if (!dispositiviGiaRicordati) {
      dispositiviGiaRicordati = true;
      ricordaIDispositivi(dispositiviDalGuscio(wiz));
    }
    const area = riga.a || (riga.d ? wiz?.devArea?.[riga.d] : "");
    const nome = area ? clean6(wiz?.areaNames?.[area]) : "";
    if (nome) return nome;
  }
  return stanzaRicordata(id);
}
function setLexicalGlobal(name, value) {
  if (!/^[A-Za-z_$][\w$]*$/.test(String(name || ""))) return false;
  try {
    root2.eval?.(`typeof ${name} !== "undefined" && (${name} = ${JSON.stringify(value)})`);
    return true;
  } catch (_error) {
    return false;
  }
}
function nomeDellEntita(entity, scelto, states) {
  const suo = clean6(scelto);
  if (suo) return suo;
  const id = clean6(entity);
  if (!id) return "";
  const mappa = states && typeof states === "object" ? states : allStates();
  const amichevole = clean6(mappa?.[id]?.attributes?.friendly_name);
  if (amichevole) return amichevole;
  const coda = id.split(".").slice(1).join(".").replaceAll("_", " ").trim();
  if (!coda) return id;
  return coda.charAt(0).toUpperCase() + coda.slice(1);
}
function allStates() {
  const raw = lexicalGlobal("_RAW_STATES");
  const registry = raw && typeof raw === "object" ? raw : lexicalGlobal("STATES");
  const hosted = [root2.__HASS__?.states, root2.hass?.states].filter(
    (value) => value && typeof value === "object"
  );
  if (!hosted.length && !globalThis.__DM_SLOW_STATES__)
    return registry && typeof registry === "object" ? registry : {};
  const values = hosted.length ? Object.assign({}, ...hosted) : {};
  for (const name of ["_RAW_STATES", "STATES"]) {
    const lexical = lexicalGlobal(name);
    if (!lexical || typeof lexical !== "object") continue;
    Object.defineProperties(values, Object.getOwnPropertyDescriptors(lexical));
  }
  return values;
}
function isLifetimeMeter(entity) {
  return isCumulativeEnergyEntity(entity, allStates());
}
var SEZIONI_PIENE = "__DASHBOARDMODERN_SEZIONI_PIENE__";
function segnaContenuto(chiave, piena) {
  const mappa = root2[SEZIONI_PIENE] ||= {};
  mappa[String(chiave)] = Boolean(piena);
  return Boolean(piena);
}
function contenutoNoto(chiave) {
  return root2[SEZIONI_PIENE]?.[String(chiave)];
}
function readJson(key, fallback) {
  try {
    return JSON.parse(root2.localStorage?.getItem(key) || "") ?? fallback;
  } catch (_error) {
    return fallback;
  }
}
function quandoSiCambiaPagina(callback) {
  doc?.addEventListener?.(
    "click",
    (event) => {
      if (event.target?.closest?.("[data-tab],[data-page],.bottom-nav-btn,.back-home-btn"))
        root2.setTimeout?.(callback, 0);
    },
    true
  );
  root2.addEventListener?.("pageshow", callback);
  return true;
}
var SEGNO_DEL_PARCHEGGIO = "__DASHBOARDMODERN_PARCHEGGIATA__";
var MURO_ACCESO = "dm-muro-acceso";
function sulPannelloAMuro() {
  return root2.__GDAHOME_MURO__ === true;
}
function planciaVisibile(documento = doc) {
  if (root2[SEGNO_DEL_PARCHEGGIO] === true) return false;
  if (documento?.documentElement?.classList?.contains?.(MURO_ACCESO)) return false;
  return documento?.visibilityState !== "hidden";
}
function paginaVisibile(pageId, documento = doc) {
  if (!planciaVisibile(documento)) return false;
  const pagina = documento?.getElementById?.(pageId);
  return !pagina || pagina.classList.contains("active");
}
function ilCambioTocca(event, ids) {
  const elenco = ids instanceof Set ? ids : new Set((Array.isArray(ids) ? ids : [ids]).map(clean6).filter(Boolean));
  if (!elenco.size) return true;
  const detail = event?.detail;
  const cambiate = detail?.entity_ids || (detail?.entity_id ? [detail.entity_id] : null);
  if (!Array.isArray(cambiate) && !cambiate) return true;
  for (const id of Array.isArray(cambiate) ? cambiate : [cambiate]) {
    if (elenco.has(clean6(id))) return true;
  }
  return false;
}
var CHIAVE_SOLO_LETTURA = "cd_solo_lettura";
function entitaSoloLettura() {
  const mappa = readJson(CHIAVE_SOLO_LETTURA, {});
  return mappa && typeof mappa === "object" ? mappa : {};
}
function siComanda(entity, bloccate = entitaSoloLettura()) {
  const id = String(entity ?? "").trim();
  if (!id) return true;
  return bloccate[id] !== true;
}
function segnaSoloLettura(entity, bloccata) {
  const id = String(entity ?? "").trim();
  if (!id) return false;
  const mappa = entitaSoloLettura();
  if (bloccata) {
    if (mappa[id] === true) return false;
    mappa[id] = true;
  } else {
    if (!(id in mappa)) return false;
    delete mappa[id];
  }
  return writeJsonIfChanged(CHIAVE_SOLO_LETTURA, mappa, { sync: false });
}
function righeDelDocumento(body, attributo, lista, leggi2, tieni2) {
  const next = Array.isArray(lista) ? lista.slice() : [];
  for (const riga of body?.querySelectorAll?.(`[${attributo}]`) || []) {
    const posizione = Number(riga.getAttribute(attributo));
    if (!Number.isFinite(posizione) || !next[posizione]) continue;
    const bozza = leggi2(riga, next[posizione], posizione);
    if (!tieni2 || tieni2(bozza, next[posizione], posizione)) next[posizione] = bozza;
  }
  return next;
}
var NOTA_DI_SCHEDA = "font-size:11.5px;line-height:1.45;color:var(--text-dim,#64748b)";
var ORDINE_IMPOSTAZIONI = Object.freeze({
  lingua: 10,
  chiosco: 15,
  testaFissa: 17,
  assist: 20,
  sezioni: 30
});
var dopoIGenerali = (corpo) => corpo?.querySelector?.('[onclick*="edSaveGeneral"]') || null;
var ATTRIBUTO_ORDINE = "data-dm-ordine";
function inserisciInOrdine(dentro, riga, ordine, ancora) {
  if (!dentro || !riga) return null;
  const posto = finite2(ordine, 0);
  riga.setAttribute(ATTRIBUTO_ORDINE, String(posto));
  const sorelle = [...dentro.querySelectorAll?.(`[${ATTRIBUTO_ORDINE}]`) || []].filter(
    (nodo) => nodo !== riga && nodo.parentElement === dentro
  );
  const dopo = sorelle.find((nodo) => finite2(nodo.getAttribute(ATTRIBUTO_ORDINE), 0) > posto);
  if (dopo) dentro.insertBefore(riga, dopo);
  else if (sorelle.length) sorelle[sorelle.length - 1].after(riga);
  else {
    const partenza = ancora?.(dentro);
    if (partenza) partenza.after(riga);
    else dentro.prepend(riga);
  }
  return riga;
}
var SCRITTE_DALL_ANTEPRIMA = Object.freeze(["cd_disposizione", "cd_disegni", "cd_navbar_order"]);
function writeJsonIfChanged(key, value, { sync = true } = {}) {
  const serialized = JSON.stringify(value);
  if (root2.__DASHBOARDMODERN_ANTEPRIMA__ && SCRITTE_DALL_ANTEPRIMA.includes(key)) {
    try {
      root2.parent?.dmScriviDallAnteprima?.(key, value);
    } catch (_error) {
    }
  }
  if (root2.localStorage?.getItem(key) === serialized) return false;
  root2.localStorage?.setItem(key, serialized);
  if (sync) {
    root2.cdMarkDirty?.();
    root2.cdSyncPush?.();
  }
  return true;
}
function reloadDashboard() {
  try {
    if (root2.__DASHBOARDMODERN_RELOAD__?.()) return true;
  } catch (_error) {
  }
  try {
    root2.location?.reload?.();
    return true;
  } catch (_error) {
    return false;
  }
}
function installStyle(id, css) {
  if (!doc?.head || doc.getElementById(id)) return false;
  const style = doc.createElement("style");
  style.id = id;
  style.textContent = css;
  doc.head.append(style);
  return true;
}
function restyleOnLocaleChange(id, build) {
  return onLocaleChange(() => {
    const style = doc?.getElementById(id);
    if (!style) return;
    const css = build();
    if (style.textContent !== css) style.textContent = css;
  });
}
function applyTemperatureReading(card, temperature, humidity) {
  if (!card?.style) return false;
  const hasReading = Number.isFinite(temperature);
  if (hasReading) {
    const position = Math.min(100, Math.max(0, (temperature - 10) / 22 * 100));
    card.style.setProperty("--dm-temp-pos", position.toFixed(1));
  } else {
    card.style.removeProperty("--dm-temp-pos");
  }
  if (Number.isFinite(humidity))
    card.style.setProperty("--dm-hum", Math.min(100, Math.max(0, humidity)).toFixed(0));
  else card.style.removeProperty("--dm-hum");
  card.dataset.dmReading = hasReading ? "on" : "off";
  card.dataset.dmHumidity = Number.isFinite(humidity) ? "on" : "off";
  return true;
}
function temperatureCardLabels(room = {}, entry = {}) {
  const id = clean6(entry.id);
  const primary = !id || id === "primary";
  const temperature = primary ? clean6(room.temp_name || room.temperature_name) : clean6(entry.name);
  const humidity = primary ? clean6(room.hum_name || room.humidity_name) : "";
  return {
    temperature: temperature || t("Temperatura", "Temperature"),
    humidity: humidity || t("Umidità", "Humidity")
  };
}
function comfortBadgeText(label) {
  const value = clean6(label);
  if (/^(non disponibile|unavailable)$/i.test(value)) return t("N/D", "N/A");
  return value;
}
function writeIconGlyph(target, icon, { size = 26, fallback = "🔌", kind = "action" } = {}) {
  if (!target) return false;
  const token = clean6(icon) || fallback;
  if (!/^mdi:/i.test(token)) {
    if (target.textContent !== token) target.textContent = token;
    return true;
  }
  try {
    if (root2.DashboardModernIconEngine?.render?.(target, kind, token, { size })) return true;
  } catch (_error) {
  }
  target.innerHTML = iconGlyphHtml(token, { size, fallback, kind });
  return true;
}
function iconGlyphHtml(icon, { size = 26, fallback = "🔌", kind = "action" } = {}) {
  const token = clean6(icon) || fallback;
  if (!/^mdi:/i.test(token)) return esc(token);
  try {
    const markup = root2.DashboardModernIconEngine?.markup?.(kind, token, { size });
    if (markup) return markup;
  } catch (_error) {
  }
  try {
    const legacy = root2.cdIconMarkup?.(token, size);
    if (legacy && legacy !== token) return legacy;
  } catch (_error) {
  }
  return esc(fallback);
}
function disegnoDiCasa(token, { misura = 26, ripiego = "" } = {}) {
  const nostro = disegnoDelCatalogo(token, misura);
  if (nostro) return nostro;
  const scorta = ripiego ? disegnoDelCatalogo(ripiego, misura) : "";
  if (!clean6(token)) return scorta;
  return iconGlyphHtml(token, { size: misura, fallback: "" }) || scorta;
}
function afterResult(result, callback) {
  if (result && typeof result.finally === "function") return result.finally(callback);
  callback();
  return result;
}
function wrapFunction(name, marker, callback) {
  const current = root2[name];
  if (typeof current !== "function" || current[marker]) return false;
  function wrapped(...args) {
    return afterResult(current.apply(this, args), () => root2.queueMicrotask?.(callback));
  }
  Object.assign(wrapped, current);
  wrapped[marker] = true;
  wrapped.__dmPrevious = current;
  root2[name] = wrapped;
  return true;
}
function onEditorRedraw(marker, callback) {
  const avvolto = wrapFunction("editorSwitch", marker, callback);
  const gia = root2.__dmEditorRedrawMarkers ||= /* @__PURE__ */ new Set();
  if (!gia.has(marker)) {
    gia.add(marker);
    root2.addEventListener?.("dashboardmodern:editor-rendered", () => {
      try {
        callback();
      } catch (_error) {
      }
    });
  }
  return avvolto;
}
function riquadroDelleTelecamere() {
  const campo = doc?.querySelector?.("#ed-body #ed-cam-ent");
  return campo?.closest?.("details.ed-acc") || null;
}
function tieniIlBloccoNellaScheda(marker, disegna) {
  const registro = root2.__dmBlocchiDellaScheda ||= /* @__PURE__ */ new Map();
  const richiama = () => {
    try {
      disegna();
    } catch (_errore) {
    }
  };
  const aggancia = () => {
    onEditorRedraw(marker, richiama);
    const corpo = doc?.getElementById?.("ed-body");
    const suo = registro.get(marker);
    if (!corpo || suo?.corpo === corpo) return;
    suo?.osservatore?.disconnect?.();
    if (typeof root2.MutationObserver !== "function") {
      registro.set(marker, { corpo, osservatore: null });
      return;
    }
    const osservatore = new root2.MutationObserver(() => root2.queueMicrotask?.(richiama));
    osservatore.observe(corpo, { childList: true });
    registro.set(marker, { corpo, osservatore });
  };
  if (!registro.has(marker)) {
    registro.set(marker, { corpo: null, osservatore: null });
    doc?.addEventListener?.(
      "click",
      () => root2.queueMicrotask?.(() => {
        aggancia();
        richiama();
      }),
      true
    );
  }
  aggancia();
  richiama();
  return aggancia;
}
function selectedPeriod() {
  const now = /* @__PURE__ */ new Date();
  const month = Number(doc?.getElementById("ed-sel-month")?.value);
  const year = Number(doc?.getElementById("ed-sel-year")?.value);
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: Number.isInteger(year) && year >= 2e3 ? year : now.getFullYear()
  };
}
function formatNumber(value, digits = 1) {
  return finite2(value).toLocaleString(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}
function scriviSeCambia(nodo, markup) {
  if (!nodo) return false;
  const testo2 = String(markup ?? "");
  rivendica(nodo);
  if (nodo.dataset?.dmScritto === testo2 && nodo.textContent === nodo.dataset.dmTesto) return false;
  nodo.innerHTML = testo2;
  if (nodo.dataset) {
    nodo.dataset.dmScritto = testo2;
    nodo.dataset.dmTesto = nodo.textContent;
  }
  return true;
}
function rattoppaSeCambia(nodo, markup, { tieni: tieni2 } = {}) {
  if (!nodo) return false;
  const testo2 = String(markup ?? "");
  rivendica(nodo);
  if (nodo.dataset?.dmScritto === testo2 && nodo.textContent === nodo.dataset.dmTesto) return false;
  const stampo = nodo.ownerDocument?.createElement?.("template");
  if (!stampo?.content || nodo.dataset?.dmScritto === void 0) {
    nodo.innerHTML = testo2;
  } else {
    stampo.innerHTML = testo2;
    rattoppaIFigli(nodo, stampo.content, tieni2);
  }
  if (nodo.dataset) {
    nodo.dataset.dmScritto = testo2;
    nodo.dataset.dmTesto = nodo.textContent;
  }
  return true;
}
function stessoPezzo(a, b) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== 1) return true;
  if (a.nodeName !== b.nodeName) return false;
  return a.nodeName !== "INPUT" || a.getAttribute("type") === b.getAttribute("type");
}
function rattoppaIFigli(vecchio, nuovo, tieni2) {
  let a = vecchio.firstChild;
  let b = nuovo.firstChild;
  while (b) {
    const prossimo = b.nextSibling;
    if (!a) {
      vecchio.appendChild(b);
    } else {
      const dopo = a.nextSibling;
      if (stessoPezzo(a, b)) rattoppaIlPezzo(a, b, tieni2);
      else vecchio.replaceChild(b, a);
      a = dopo;
    }
    b = prossimo;
  }
  while (a) {
    const dopo = a.nextSibling;
    a.remove();
    a = dopo;
  }
}
function rattoppaIlPezzo(a, b, tieni2) {
  if (a.nodeType !== 1) {
    if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
    return;
  }
  if (tieni2?.(a, b)) return;
  for (const { name } of [...a.attributes]) if (!b.hasAttribute(name)) a.removeAttribute(name);
  for (const { name, value, namespaceURI } of b.attributes) {
    if (a.getAttribute(name) === value) continue;
    if (namespaceURI) a.setAttributeNS(namespaceURI, name, value);
    else a.setAttribute(name, value);
  }
  rattoppaIFigli(a, b, tieni2);
  if (a.nodeName === "INPUT") {
    if (a.value !== b.value) a.value = b.value;
    if (a.checked !== b.checked) a.checked = b.checked;
  } else if (a.nodeName === "TEXTAREA") {
    if (a.value !== b.value) a.value = b.value;
  } else if (a.nodeName === "SELECT") {
    if (a.selectedIndex !== b.selectedIndex) a.selectedIndex = b.selectedIndex;
  }
}
var IL_CONTO = "__dmContoDelleFasce";
function registraIlContoDelleFasce(lettore) {
  root2[IL_CONTO] = typeof lettore === "function" ? lettore : null;
  return true;
}
function ilContoEsattoDelleFasce(periodo) {
  try {
    const lettore = root2[IL_CONTO];
    if (typeof lettore !== "function") return null;
    const conto = periodo === void 0 ? lettore() : lettore(periodo);
    return conto && Number.isFinite(Number(conto.euro)) ? conto : null;
  } catch (_error) {
    return null;
  }
}
function scriviTestoSeCambia(nodo, testo2) {
  if (!nodo) return false;
  const valore = String(testo2 ?? "");
  rivendica(nodo);
  if (nodo.textContent === valore) return false;
  nodo.textContent = valore;
  return true;
}
function rivendica(nodo) {
  if (nodo.dataset && nodo.dataset.dmPadrone !== "moduli") nodo.dataset.dmPadrone = "moduli";
}
function chiamaServizio(comando) {
  if (!comando) return false;
  const nomi = ["cdCallServiceJson", "dmCallHaService", "callService"];
  for (const nome of nomi) {
    if (typeof root2[nome] !== "function") continue;
    try {
      root2[nome](comando.domain, comando.service, comando.data)?.catch?.(() => {
      });
    } catch (_errore) {
      return false;
    }
    return true;
  }
  return false;
}

export {
  DEFAULT_LOCALE,
  SOURCE_LOCALE,
  supportedLocales,
  localeInfo,
  resolveLocale,
  reverseLookup,
  translate,
  pick,
  LOCALE_STORAGE_KEY,
  LOCALE_LEGACY_KEY,
  LOCALE_EVENT,
  readStoredLocale,
  hostLocale,
  detectLocale,
  getLocale,
  intlLocale,
  isRtl,
  applyDocumentLocale,
  setLocale,
  initLocale,
  onLocaleChange,
  resetLocale,
  segnoPiuAlto,
  prossimoIdentificativo,
  PRIMO_IMPIANTO,
  PLANT_GROUPS,
  plantIsConfigured,
  plantList,
  storedPlants,
  nuovoImpianto,
  plantLabel,
  plantKey,
  pickPlant,
  IMPIANTO_SCELTO_KEY,
  plantAt,
  plantModel,
  LOAD_PLANT_FIELD,
  loadBelongsToPlant,
  plantLoads,
  dropPlantLoads,
  PIANI_FIELD,
  CERCHI_DALLE_STANZE_FIELD,
  PIANI_NEL_FLUSSO_FIELD,
  DA_CARICO,
  DA_PIANO,
  pianiDellImpianto,
  cerchiDalleStanzeAccesi,
  pianiNelFlusso,
  impiantoDellElettrodomestico,
  elettrodomesticiDellImpianto,
  elettrodomesticiDaAssegnare,
  assegnaElettrodomestico,
  TESSERE_IMPIANTI_KEY,
  TESSERA_SOMMA,
  TESSERA_PER_IMPIANTO,
  comeSiVedeLEnergia,
  sommaLetture,
  sommaOggi,
  sommaNumeri,
  CHIAVE_VERSI,
  insiemeInvertiti,
  apertaSecondoVerso,
  posizioneSecondoVerso,
  statoSecondoVerso,
  versoInvertito,
  coverKind,
  coverKindLabel,
  INFISSO,
  coverStateLabel,
  coverIsSideways,
  coverIsAwning,
  coverEntries,
  contoDelleAperture,
  isRelayEntity,
  coverDownRelay,
  CHIAVE_SOGLIA_CHIUSA,
  SOGLIA_CHIUSA_MASSIMA,
  coverClosedThreshold,
  sogliaDellaCopertura,
  coperturaAlzata,
  coverClosedPercent,
  coverPresetPosition,
  coverPositionChoices,
  relayCoverCommands,
  contactEntity,
  inferriataEntity,
  windowOpenFromState,
  serramentoModel,
  isWindowOnly,
  PANNELLO,
  SCOCCA,
  FRONTALE,
  ACCENTO,
  SPENTO,
  guscio,
  GRUPPI_DISEGNI,
  DISEGNI_DA_RIQUADRO,
  disegnoDaRiquadro,
  cercaDisegni,
  ZOOM_MINIMO,
  ZOOM_MASSIMO,
  chiaveDelDisegno,
  immaginePulita,
  srcDaMostrare,
  stileInLinea,
  finestraVisibile,
  fuocoDallaFinestra,
  fondoMarkup,
  classeDelFondo,
  riquadroConImmagineMarkup,
  SCHEMA_VERSION,
  climaScalda,
  canonicalClimateType,
  APPLIANCE_CATALOG,
  cloneValue,
  applianceVisualKey,
  canonicalApplianceVisualKey,
  applianceCatalogLabel,
  APPLIANCE_BINDING_FIELDS,
  conservaIlConfigurato,
  getDeviceDisplayName,
  getDeviceVisual,
  normalizeDevice,
  attributoSeCambia,
  classeSeCambia,
  runtimeMetrics,
  PERIOD_SOURCES,
  rowTimestamp,
  periodConsumption,
  recorderBucketConsumptions,
  mesiDaiGiorni,
  ilGiornoDelPicco,
  giorniPerLaMedia,
  periodRange,
  archiDelPeriodo,
  baselineRange,
  resolveEntity,
  inKilowattora,
  sorgenteDichiarata,
  isCumulativeEnergyEntity,
  contatoreCheNonSiLegge,
  sourcePlans,
  smistaIPiani,
  chiaveDellArco,
  HomeAssistantBroker,
  disegnoDelCatalogo,
  chiaviDaProvare,
  wattDellUnita,
  accesoPerIlConsumo,
  nonSiSaNiente,
  ricordaIDispositivi,
  iDispositiviRicordati,
  ricordaLeStanze,
  leStanzeRicordate,
  root2 as root,
  doc,
  senzaCadere,
  clean6 as clean,
  finite2 as finite,
  finiteOrNull,
  activeLocale,
  english,
  locale,
  t,
  tr,
  esc,
  jsArg,
  readClimateUnits,
  climaAccesoDaiWatt,
  energyPeriodConflicts,
  dashboardStore,
  section,
  roomLabel,
  roomOptionsMarkup,
  gettoneDiAccesso,
  chiediAHomeAssistant,
  LENTE_SELECTOR,
  lexicalGlobal,
  stanzaDiHomeAssistant,
  setLexicalGlobal,
  nomeDellEntita,
  allStates,
  isLifetimeMeter,
  segnaContenuto,
  contenutoNoto,
  readJson,
  quandoSiCambiaPagina,
  sulPannelloAMuro,
  planciaVisibile,
  paginaVisibile,
  ilCambioTocca,
  entitaSoloLettura,
  siComanda,
  segnaSoloLettura,
  righeDelDocumento,
  NOTA_DI_SCHEDA,
  ORDINE_IMPOSTAZIONI,
  dopoIGenerali,
  inserisciInOrdine,
  SCRITTE_DALL_ANTEPRIMA,
  writeJsonIfChanged,
  reloadDashboard,
  installStyle,
  restyleOnLocaleChange,
  applyTemperatureReading,
  temperatureCardLabels,
  comfortBadgeText,
  writeIconGlyph,
  iconGlyphHtml,
  disegnoDiCasa,
  wrapFunction,
  onEditorRedraw,
  riquadroDelleTelecamere,
  tieniIlBloccoNellaScheda,
  selectedPeriod,
  formatNumber,
  scriviSeCambia,
  rattoppaSeCambia,
  registraIlContoDelleFasce,
  ilContoEsattoDelleFasce,
  scriviTestoSeCambia,
  chiamaServizio
};
