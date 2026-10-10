import {
  BUILD_INFO,
  DashboardStore,
  IMPIANTO_SCELTO_KEY,
  SCHEMA_VERSION,
  apri,
  attributoSeCambia,
  canonicalReportDevices,
  capacitaDellaTelecamera,
  classeSeCambia,
  createApplianceViewModel,
  createEnergyReportRows,
  createEntityPickerField,
  createRenderCoordinator,
  daProvare,
  diagnosi,
  energyWriteInFlight,
  flushEnergyWrites,
  getDeviceDisplayName,
  getDeviceVisual,
  getLocale,
  go2rtcRaggiungibile,
  loadPopupMetrics,
  normalizeDevice,
  persistEnergyField,
  persistIlFotovoltaico,
  persistSignedSource,
  pick,
  plantAt,
  plantModel,
  renderDeviceCard,
  renderEnergyEditor,
  renderPreseEditor,
  reportEntityForDevice,
  reportIconForDevice,
  runSteps,
  siSveglia,
  stepReporter,
  stradaAppenaCaduta,
  strategieDellaTelecamera
} from "../chunk-7GNKSDKJ.js";

// src/legacy/dashboard-data.js
function stableRoomId(room, index = 0) {
  if (room?.id || room?.room_id) return String(room.id || room.room_id);
  const slug = String(room?.name || `room-${index + 1}`).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `room-${slug || index + 1}`;
}
function normalizeRooms(input = []) {
  const used = /* @__PURE__ */ new Set();
  return (Array.isArray(input) ? input : []).filter(Boolean).map((room, index) => {
    let id = stableRoomId(room, index);
    while (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    return { ...room, id };
  });
}
function isConfiguredRoom(room) {
  const name = String(room?.name || "").trim();
  if (!name || /^(other|altro|generic|generico|undefined)$/i.test(name)) return false;
  return !/^room[_-][a-z0-9]{5,}$/i.test(name);
}
function applianceRoomId(appliance, rooms) {
  const explicit = appliance?.room_id || appliance?.roomId;
  if (explicit && rooms.some((room) => room.id === String(explicit))) return String(explicit);
  const legacy = String(appliance?.room || "");
  return rooms.find((room) => room.name === legacy)?.id || "";
}
function applianceGroups(appliances = [], roomInput = []) {
  const rooms = normalizeRooms(roomInput);
  const groups = rooms.map((room) => ({
    room,
    appliances: appliances.filter((item) => applianceRoomId(item, rooms) === room.id)
  })).filter((group) => group.appliances.length);
  const unassigned = appliances.filter((item) => !applianceRoomId(item, rooms));
  return { rooms, all: appliances.slice(), groups, unassigned };
}
function applianceName(appliance = {}, states = {}, fallback = "Appliance") {
  const name = getDeviceDisplayName(
    appliance,
    states,
    fallback === "Elettrodomestico" ? "it" : "en"
  );
  return /^(Device|Dispositivo)$/.test(name) ? fallback : name;
}
function applianceMedia(appliance = {}) {
  if (appliance.visual_type && appliance.visual_key)
    return { kind: appliance.visual_type, value: appliance.visual_key };
  return getDeviceVisual({ section: "appliances", ...appliance });
}
function applianceEnergyReport(appliances = [], states = {}, rooms = []) {
  const normalizedRooms = normalizeRooms(rooms);
  return appliances.map((appliance) => {
    const view = createApplianceViewModel(appliance, states, normalizedRooms);
    const entries = [
      appliance.power,
      appliance.power_entity,
      appliance.energy,
      appliance.energy_today
    ].concat(appliance.entities || []).map((entry) => typeof entry === "string" ? entry : entry?.entity).filter(Boolean);
    let power = null;
    let energy = null;
    for (const entity of entries) {
      const state = states[entity];
      const value = Number(state?.state);
      const unit = String(state?.attributes?.unit_of_measurement || "").toLowerCase();
      if (!Number.isFinite(value)) continue;
      if (unit === "w" || unit === "kw")
        power = { entity, value: unit === "kw" ? value * 1e3 : value, unit: "W" };
      if (unit === "wh" || unit === "kwh")
        energy = { entity, value: unit === "wh" ? value / 1e3 : value, unit: "kWh" };
    }
    const roomId = applianceRoomId(appliance, normalizedRooms);
    return {
      appliance,
      name: view.name,
      room: view.room || normalizedRooms.find((room) => room.id === roomId) || null,
      power,
      energy,
      state: { state: view.mode, watts: view.watts, label: view.label },
      badge: view.badge,
      action: view.action,
      historyEntity: view.historyEntity
    };
  });
}
function applianceEntities(appliance, keys = []) {
  return [
    ...keys.map((key) => appliance?.[key]),
    ...Array.isArray(appliance?.entities) ? appliance.entities : []
  ].map((entry) => typeof entry === "string" ? entry : entry?.entity).filter(Boolean);
}
function controllableEntity(appliance) {
  const candidates = applianceEntities(appliance, [
    "control_entity",
    "switch_entity",
    "switch",
    "light",
    "fan"
  ]);
  return candidates.find((entity) => /^(switch|light|input_boolean|fan)\.[a-z0-9_]+$/i.test(entity)) || "";
}
function applianceState(appliance, states = {}) {
  const model = createApplianceViewModel(appliance, states);
  return { state: model.mode, watts: model.watts };
}
function normalizeCamera(camera = {}, index = 0) {
  const entity = String(camera.entity || camera.camera_entity || camera.cam || "").trim();
  const stream = String(camera.stream || camera.stream_url || camera.url || "").trim();
  return {
    ...camera,
    id: String(camera.id || `camera-${index + 1}`),
    name: String(camera.name || entity || `camera-${index + 1}`),
    entity,
    stream,
    room_id: String(camera.room_id || camera.roomId || "")
  };
}
function normalizeCameras(input = []) {
  return (Array.isArray(input) ? input : []).map(normalizeCamera);
}
function saveCamera(input, camera, editIndex = null) {
  const cameras = normalizeCameras(input);
  const normalized = normalizeCamera(camera, editIndex ?? cameras.length);
  if (editIndex == null) cameras.push(normalized);
  else if (editIndex >= 0 && editIndex < cameras.length)
    cameras[editIndex] = { ...normalized, id: camera.id || cameras[editIndex].id };
  return cameras;
}
function removeCamera(input, index) {
  return normalizeCameras(input).filter((_camera, cameraIndex) => cameraIndex !== index);
}

// src/core/le-modalita-di-evcc.js
var pulito = (valore) => String(valore ?? "").trim();
var RAPIDA = Object.freeze({
  /* «Fast» e non «Subito»: e' la parola che l'integrazione scrive nella tendina
   * di Home Assistant, e chiamarla in due modi vuol dire due modalita' per chi
   * legge. Il nome nell'API e' `now`, quello mostrato e' `fast`: sono la stessa,
   * e stanno qui tutte e due perche' quale delle due arrivi lo decide
   * l'integrazione, non noi. */
  it: "Fast",
  en: "Fast",
  icona: "🚀",
  colore: "#0284c7",
  sfondo: "#f0f9ff"
});
var SOLE = Object.freeze({ icona: "☀️", colore: "#059669", sfondo: "#f0fdf4" });
var MODI = Object.freeze({
  off: { it: "Spento", en: "Off", icona: "🛑", colore: "#e11d48", sfondo: "#fff1f2" },
  pv: { it: "Solar", en: "Solar", ...SOLE },
  smart: { it: "Intelligente", en: "Smart", ...SOLE },
  minpv: { it: "Min+Sol", en: "Min+Sol", icona: "⛅", colore: "#d97706", sfondo: "#fffbeb" },
  now: RAPIDA,
  fast: RAPIDA
});
var MODI_STORICI = Object.freeze(["off", "pv", "minpv", "now"]);
var LO_STESSO = Object.freeze({ pv: "smart", smart: "pv" });
var sonoLoStesso = (uno, altro) => uno === altro || LO_STESSO[uno] === altro;
function iModiDiEvcc(stato) {
  const dichiarate = stato?.attributes?.options;
  const elenco = (Array.isArray(dichiarate) ? dichiarate : []).map(pulito).filter(Boolean).filter((voce, indice, tutte) => tutte.indexOf(voce) === indice);
  const quali = elenco.length ? elenco : MODI_STORICI;
  return quali.map((id) => {
    const noto = MODI[id.toLowerCase()];
    return {
      id,
      it: noto?.it || id,
      en: noto?.en || id,
      icona: noto?.icona || "⚡",
      colore: noto?.colore || "#64748b",
      sfondo: noto?.sfondo || "#f1f5f9",
      /* Vero quando il nome non lo conosciamo: chi disegna puo' decidere di
       * scriverlo com'e' invece di fingere di saperlo tradurre. */
      ignoto: !noto
    };
  });
}
function ilModoAcceso(stato, disegnati = iModiDiEvcc(stato)) {
  const adesso = pulito(stato?.state).toLowerCase();
  if (!adesso || adesso === "unavailable" || adesso === "unknown" || adesso === "—") return "";
  const esatto = disegnati.find((modo) => modo.id.toLowerCase() === adesso);
  if (esatto) return esatto.id;
  const equivalente = disegnati.find((modo) => sonoLoStesso(modo.id.toLowerCase(), adesso));
  return equivalente?.id || "";
}
function eIlModoIntelligente(id) {
  const quale = pulito(id).toLowerCase();
  return quale === "smart" || quale === "pv";
}
var IL_SEMPRE = Object.freeze({
  off: { it: "Mai", en: "Never" },
  on: { it: "Sempre", en: "Always" },
  once: { it: "Solo stavolta", en: "Just this time" }
});
function iValoriDelSempre(stato) {
  const dichiarate = stato?.attributes?.options;
  const elenco = (Array.isArray(dichiarate) ? dichiarate : []).map(pulito).filter(Boolean).filter((voce, indice, tutte) => tutte.indexOf(voce) === indice);
  return elenco.map((id) => {
    const noto = IL_SEMPRE[id.toLowerCase()];
    return { id, it: noto?.it || id, en: noto?.en || id, ignoto: !noto };
  });
}
function ilValoreDelSempreAcceso(stato, disegnati = iValoriDelSempre(stato)) {
  const adesso = pulito(stato?.state).toLowerCase();
  if (!adesso || adesso === "unavailable" || adesso === "unknown" || adesso === "—") return "";
  return disegnati.find((voce) => voce.id.toLowerCase() === adesso)?.id || "";
}
function laFilaDelSempreServe(statoDelSempre) {
  return iValoriDelSempre(statoDelSempre).length > 0;
}
function ilSempreEInVigore(modoAcceso) {
  return eIlModoIntelligente(modoAcceso);
}

// legacy/modules-entry.js
var MODULES_VERSION = 14;
var COPY_SOURCE = Object.freeze({
  optional: ["Facoltativo", "Optional"],
  select: ["Seleziona", "Select"],
  saveReport: ["Salva Report", "Save Report"],
  saved: ["Report salvato", "Report saved"],
  energySaved: ["Energia salvata", "Energy saved"],
  dirty: ["Modifiche non salvate", "Unsaved changes"],
  saving: ["Salvataggio…", "Saving…"],
  addManual: ["Aggiungi voce manuale", "Add manual entry"],
  empty: ["Nessun elemento configurato.", "No configured items."],
  reportIntro: ["Seleziona e ordina il Report senza modificare l'ordine della dashboard.", "Select and order Report entries without changing dashboard order."],
  reportLabel: ["Etichetta", "Label"],
  reportEntity: ["Entità Report", "Report entity"],
  history: ["Storico", "History"],
  name: ["Nome", "Name"],
  entity: ["Entità", "Entity"],
  add: ["Aggiungi", "Add"],
  required: ["Nome ed entità sono obbligatori", "Name and entity are required"],
  moveUp: ["Sposta su", "Move up"],
  moveDown: ["Sposta giù", "Move down"],
  remove: ["Elimina", "Delete"],
  energyCost: ["Costo energia", "Energy cost"],
  energyRates: ["Tariffe usate dal Report Energia.", "Rates used by the Energy Report."],
  saveCosts: ["Salva costi", "Save costs"],
  rateNumber: ["Numero", "Number"],
  rateEntity: ["Entità", "Entity"],
  rateAutoNote: ["si aggiorna da solo", "updates by itself"],
  ratePickHint: ["Scegli l'entità del prezzo: il valore si aggiornerà da solo.", "Pick the price entity: the value will update by itself."],
  loadsIntro: ["Carichi e Report condividono il modello canonico senza duplicati.", "Loads and Report share the canonical model without duplicates."],
  appliances: ["Elettrodomestici / dispositivi", "Appliances / devices"],
  secondaryLoads: ["Carichi secondari", "Secondary loads"],
  noLoads: ["Nessun carico configurato", "No configured loads"],
  editLoad: ["Modifica carico", "Edit load"],
  newLoad: ["Nuovo carico", "New load"],
  visibleReport: ["Visibile nel report", "Visible in Report"],
  visibleDashboard: ["Visibile nella dashboard", "Visible on dashboard"],
  addLoad: ["Aggiungi carico", "Add load"],
  saveChanges: ["Salva modifiche", "Save changes"],
  powerEntity: ["Entità potenza", "Power entity"],
  dailyEnergy: ["Energia giornaliera", "Daily energy"],
  monthlyEnergy: ["Energia mensile", "Monthly energy"],
  totalEnergy: ["Energia totale", "Total energy"],
  state: ["Stato", "State"],
  control: ["Comando ON/OFF", "On/off control"],
  diagnostics: ["Diagnostica runtime", "Runtime diagnostics"],
  languageVariant: ["Lingua / variante", "Language / variant"],
  activeRenderer: ["Renderer attivo", "Active renderer"],
  loadNameRequired: ["Inserisci il nome del carico", "Enter a load name"],
  energySaveFailed: ["Salvataggio Energia fallito", "Energy save failed"],
  coolingTitle: ["Temperature e raffreddamento", "Temperatures & cooling"],
  coolingHint: ["Sensori della scheda Temperature di Energia: inverter, batteria e ventola. Ogni campo si salva appena lo cambi.", "Sensors for the Energy Temperatures tab: inverter, battery and fan. Every field saves as soon as you change it."],
  coolingAcTemp: ["Temperatura inverter AC", "Inverter AC temperature"],
  coolingDcTemp: ["Temperatura inverter DC", "Inverter DC temperature"],
  coolingBatTemp: ["Temperatura batteria", "Battery temperature"],
  coolingFanPower: ["Potenza ventola", "Fan power"],
  coolingFanSwitch: ["Interruttore ventola", "Fan switch"]
});
var t = (key) => {
  const entry = COPY_SOURCE[key];
  return entry ? pick(entry[0], entry[1]) : key;
};
var store = new DashboardStore({
  sync: async () => {
    globalThis.cdMarkDirty?.();
    return globalThis.cdSyncPush?.();
  },
  onStatus: (status) => globalThis.dispatchEvent?.(new CustomEvent("dashboardmodern:status", { detail: status }))
});
try {
  store.migrate();
} catch (error) {
  globalThis.console?.error?.("[DashboardModern] migrazione dello stato non riuscita", error);
}
store.installLegacyWriteBridge();
var applyRuntimeProjection = () => globalThis.cdApplyCanonicalOverrides?.(store.getSection("entityOverrides"));
applyRuntimeProjection();
store.subscribe((change) => {
  if (change.status === "optimistic" || change.status === "rollback") applyRuntimeProjection();
});
createRenderCoordinator(store, {
  renderSection(section) {
    if (section === "appliances") {
      globalThis.renderAppliances?.();
      globalThis.renderApplianceSection?.(true);
    } else if (section === "cameras") {
      const grid = globalThis.document?.getElementById?.("cam-grid");
      if (grid) grid._sig = "";
      globalThis.buildCamCards?.();
      globalThis.refreshCameras?.();
    } else if (section === "rooms") {
      globalThis.buildTempCards?.();
      globalThis.renderTemperature?.();
    }
  },
  renderEnergyReport() {
    globalThis.cdRebuildReportDevices?.();
    globalThis.buildReportSelect?.();
  },
  renderNavbar() {
    globalThis.cdApplyNavVis?.();
  },
  renderRoomSelectors() {
    globalThis.cdFillRoomSelects?.();
  },
  renderCurrentEditor(section) {
    const tab = globalThis.document?.querySelector?.(".ed-tab.active")?.dataset?.tab;
    const sectionTabs = {
      appliances: "appliances",
      loads: "sez1",
      report: "sez1",
      energy: "sez1",
      cameras: "sezioni",
      rooms: "stanze",
      ev: "sezioni",
      lights: "luci",
      climate: "sezioni",
      covers: "tapp",
      pool: "pool",
      irrigation: "irr"
    };
    const expected = section === "rooms" && tab === "sez7" ? "sez7" : sectionTabs[section];
    const matches = expected === tab || expected === "sezioni" && tab?.startsWith("sez");
    if (!globalThis.document?.getElementById?.("ed-body") || !matches) return;
    const body = globalThis.document.getElementById("ed-body");
    if (tab === "sez7" && section === "rooms") {
      renderEditorTab("sez7", body);
      return;
    }
    if (tab === "sez1" && section === "energy") {
      if (!energyWriteInFlight()) renderEditorTab("sez1", body);
      return;
    }
    if (tab === "sez1" && section === "loads") {
      const panel = body.querySelector('[data-energy-panel="loads"]');
      if (panel) {
        mountLoadsEditor(panel);
        mountCurrentEditor("loads", panel);
        panel.hidden = false;
      }
      return;
    }
    if (tab === "sez1" && section === "report") {
      const panel = body.querySelector('[data-energy-panel="report"]');
      if (panel) {
        renderReportEditor(panel);
        mountReportEditor("report", panel);
        panel.hidden = false;
      }
      return;
    }
    if (tab === "appliances") {
      body.innerHTML = globalThis.cdSecToggleHtml("appliances") + globalThis.editorRenderAppliances() + '<button class="ed-btn-add" style="width:100%; margin-top:10px;" onclick="edSecSave()">💾 Salva sezione</button>';
      globalThis.edApplRenderEnts?.();
    } else if (tab === "load") mountLoadsEditor(body);
    else if (tab === "stanze") body.innerHTML = globalThis.editorRenderStanze();
    else if (tab === "luci") body.innerHTML = globalThis.editorRenderLuci();
    else if (tab === "tapp") body.innerHTML = globalThis.cdSecToggleHtml("tapparelle") + globalThis.editorRenderTapparelle();
    else if (tab === "pool") body.innerHTML = globalThis.cdSecToggleHtml("piscina") + globalThis.editorRenderPiscina();
    else if (tab === "irr") body.innerHTML = globalThis.cdSecToggleHtml("irrigazione") + globalThis.editorRenderIrrigazione();
    else if (tab?.startsWith("sez") && tab !== "sezioni" && tab !== "sez1") {
      body.innerHTML = globalThis.editorRenderSezioni();
      globalThis.edFilterSez?.(body, Number(tab.slice(3)));
    }
    mountCurrentEditor(tab, body);
  },
  renderDropdowns() {
    globalThis.cdFillRoomSelects?.();
  },
  renderDashboard() {
    globalThis.render?.();
  }
});
var activeEnergyPanel = "flows";
var impiantoAperto = () => String(globalThis.localStorage?.getItem(IMPIANTO_SCELTO_KEY) ?? "").trim();
var reportDelPiano = (appliances, loads, states) => canonicalReportDevices(
  appliances,
  loads,
  states,
  plantAt(store.getSection("energy") || {}, impiantoAperto())
);
function renderEnergyEditorTab(target) {
  const model = plantModel(store.getSection("energy"), impiantoAperto());
  renderEnergyEditor(
    globalThis.document,
    target,
    model,
    store.getSection("appliances"),
    globalThis.STATES || {},
    getLocale(),
    {
      onPick: (input) => globalThis.wzPickEntity?.(input),
      renderLoads: (loads) => {
        if (renderLoadsPanel(loads)) return;
        mountLoadsEditor(loads);
        mountCurrentEditor("loads", loads);
      },
      renderReport: (report) => {
        renderReportEditor(report);
        mountReportEditor("report", report);
      },
      renderSettings: (settings) => {
        const entitaPrezzo = String(store.getSection("energy")?.rates?.import_entity ?? "").trim();
        settings.innerHTML = `${globalThis.cdEnViewsHtml?.() || ""}
          <div class="ed-form dm-energy-cost-card" data-dm-import-rate-mode="${entitaPrezzo ? "entity" : "number"}"><div class="ed-sec-title">💶 ${t("energyCost")}</div>
          <div class="ed-hint">${t("energyRates")}</div>
          <div class="dm-rate-mode" role="group"><button type="button" class="dm-rate-mode-btn" data-dm-rate-mode="number">${t("rateNumber")}</button><button type="button" class="dm-rate-mode-btn" data-dm-rate-mode="entity">${t("rateEntity")}</button></div>
          <div class="ed-form-row"><input id="ed-costo-kwh" class="ed-input" type="number" step="0.001" min="0" placeholder="€/kWh prelevato" value="${esc(globalThis.cdCfg?.("cd_costo_kwh") || "")}"><input id="ed-prezzo-imm" class="ed-input" type="number" step="0.001" min="0" placeholder="€/kWh immesso" value="${esc(globalThis.cdCfg?.("cd_prezzo_immissione") || "")}"></div>
          <span data-dm-rate-entity-slot hidden></span><small class="dm-rate-entity-note" data-dm-rate-entity-note hidden></small>
          <button class="ed-save-btn" onclick="edSaveCosti()">💾 ${t("saveCosts")}</button></div>`;
        const card = settings.querySelector(".dm-energy-cost-card");
        const slot = card.querySelector("[data-dm-rate-entity-slot]");
        const nota = card.querySelector("[data-dm-rate-entity-note]");
        const aggiornaNota = () => {
          if (card.dataset.dmImportRateMode !== "entity") return;
          const id = String(card.querySelector("#ed-costo-kwh-entita")?.value ?? "").trim();
          if (!id) {
            nota.textContent = t("ratePickHint");
            return;
          }
          const valore = Number((globalThis._RAW_STATES || globalThis.STATES || {})[id]?.state);
          const prezzo = Number.isFinite(valore) ? valore.toLocaleString(getLocale(), { maximumFractionDigits: 4 }) : "—";
          nota.textContent = `${prezzo} €/kWh · ${t("rateAutoNote")}`;
        };
        const { field } = createEntityPickerField(globalThis.document, {
          id: "ed-costo-kwh-entita",
          value: entitaPrezzo,
          placeholder: "sensor.prezzo_kwh",
          label: t("entity"),
          locale: getLocale(),
          onPick: (input) => globalThis.wzPickEntity?.(input),
          onChange: aggiornaNota
        });
        slot.append(field);
        const applicaModalita = (modalita) => {
          card.dataset.dmImportRateMode = modalita;
          const numero = card.querySelector("#ed-costo-kwh");
          if (numero) numero.hidden = modalita === "entity";
          slot.hidden = modalita !== "entity";
          nota.hidden = modalita !== "entity";
          card.querySelectorAll("[data-dm-rate-mode]").forEach((bottone) => {
            bottone.dataset.active = bottone.dataset.dmRateMode === modalita ? "true" : "false";
          });
          aggiornaNota();
        };
        card.querySelectorAll("[data-dm-rate-mode]").forEach(
          (bottone) => bottone.addEventListener("click", () => applicaModalita(bottone.dataset.dmRateMode))
        );
        applicaModalita(card.dataset.dmImportRateMode);
        const raffreddamento = globalThis.document.createElement("div");
        raffreddamento.className = "ed-form dm-energy-cooling-card";
        raffreddamento.dataset.energyCooling = "";
        raffreddamento.innerHTML = `<div class="ed-sec-title">🌡️ ${t("coolingTitle")}</div><div class="ed-hint">${t("coolingHint")}</div>`;
        const campiRaffreddamento = [
          ["inverter_ac_temperature", t("coolingAcTemp"), "°C", "sensor.inverter_temp_ac"],
          ["inverter_dc_temperature", t("coolingDcTemp"), "°C", "sensor.inverter_temp_dc"],
          ["battery_temperature", t("coolingBatTemp"), "°C", "sensor.batteria_temp"],
          ["fan_power", t("coolingFanPower"), "W", "sensor.ventola_potenza"],
          ["fan_switch", t("coolingFanSwitch"), "", "switch.ventola_inverter"]
        ];
        const statiRaffreddamento = globalThis.STATES || {};
        const modelloRaffreddamento = store.getSection("energy")?.cooling || {};
        for (const [campo, etichetta, unita, esempio] of campiRaffreddamento) {
          const slotCampo = globalThis.document.createElement("label");
          slotCampo.className = "ed-slot";
          slotCampo.innerHTML = `<span class="ed-slot-lbl">${etichetta}${unita ? ` <span class="ed-acc-n">${unita}</span>` : ""} <span class="ed-acc-n">${t("optional")}</span></span><span class="ed-hint">${t("entity")}: ${esempio}</span>`;
          const valore = String(modelloRaffreddamento[campo] || "").trim();
          const { field: field2 } = createEntityPickerField(globalThis.document, {
            id: `dm-energy-cooling-${campo}`,
            value: valore,
            placeholder: esempio,
            label: etichetta,
            locale: getLocale(),
            state: statiRaffreddamento[valore]?.state,
            unit: unita,
            onPick: (input) => globalThis.wzPickEntity?.(input),
            /* Fuori dagli impianti: qualunque linguetta sia aperta, il
             * campo scrive al primo livello del modello Energia. */
            onChange: (nuovo) => persistEnergyField(store, "cooling", campo, nuovo, "")
          });
          slotCampo.append(field2);
          raffreddamento.append(slotCampo);
        }
        settings.append(raffreddamento);
      },
      /* Ogni campo scrive dove scrivono gli altri.
       * La bozza presa all'apertura rimetteva a posto i valori che i campi
       * aggiunti dopo (contatori totali, SOC) avevano gia' salvato, e le
       * modifiche non ancora salvate sparivano cambiando sezione. */
      onChange: (group, key, value) => persistEnergyField(store, group, key, value, impiantoAperto()),
      /* La spunta del fotovoltaico (#82). La pagina Energia si rifa' da sola
       * al prossimo pacchetto di stati; la maschera si ridisegna qui, perche'
       * quello che la spunta cambia — le caselle spente sotto di lei — sta in
       * questa maschera e non altrove. */
      onFotovoltaico: async (acceso) => {
        await persistIlFotovoltaico(store, acceso);
        await flushEnergyWrites();
        renderEnergyEditorTab(target);
        mountCurrentEditor("energy", target);
      },
      onSignedChange: (group, signed) => persistSignedSource(store, group, signed, impiantoAperto()),
      /* Dichiarare la sorgente unica spegne le caselle dei due versi: la
       * maschera va ridisegnata dal modello appena salvato, non indovinata. */
      onSignedRerender: async () => {
        await flushEnergyWrites();
        renderEnergyEditorTab(target);
        mountCurrentEditor("energy", target);
        globalThis.dispatchEvent?.(new CustomEvent("dashboardmodern:energy-editor-rendered"));
      },
      initialTab: activeEnergyPanel,
      onTabChange: (tab) => {
        activeEnergyPanel = tab;
      },
      onSave: async ({ actions, save, status }) => {
        actions.dataset.state = "loading";
        save.disabled = true;
        status.textContent = t("saving");
        const barraViva = () => document.querySelector('[data-editor="energy"] [data-energy-actions]') || target.querySelector("[data-energy-actions]") || actions;
        try {
          await flushEnergyWrites();
          const current = barraViva();
          if (current) {
            current.dataset.state = "success";
            current.querySelector("[data-energy-status]").textContent = t("energySaved");
          }
        } catch (error) {
          const current = barraViva();
          if (current) {
            current.dataset.state = "error";
            current.querySelector("[data-energy-status]").textContent = `${t("energySaveFailed")}: ${error.message}`;
          }
        }
      }
    }
  );
}
globalThis.addEventListener?.("dashboardmodern:energy-plant-changed", async () => {
  const trovaMaschera = () => {
    const body2 = globalThis.document?.getElementById?.("ed-body");
    return body2 && body2.dataset.editor === "energy" ? body2 : null;
  };
  if (!trovaMaschera()) return;
  if (energyWriteInFlight()) {
    try {
      await flushEnergyWrites();
    } catch (_error) {
    }
  }
  const body = trovaMaschera();
  if (!body) return;
  renderEnergyEditorTab(body);
  mountCurrentEditor("energy", body);
});
var esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
function createEntityField({ id, label, value = "", placeholder = "sensor.entity", domain = "", optional = true } = {}) {
  const domainAttr = domain ? ` data-domain="${esc(domain)}"` : "";
  const opt = optional ? ` <span class="ed-acc-n">${t("optional")}</span>` : "";
  return `<label class="ed-slot dm-entity-field" data-entity-field><span class="ed-slot-lbl">${esc(label)}${opt}</span><span class="ed-form-row"><input id="${esc(id)}" class="ed-input ed-slot-in mono" value="${esc(value)}" placeholder="${esc(placeholder)}"${domainAttr}><button type="button" class="dm-entity-picker" data-entity-target="${esc(id)}" aria-label="${t("select")} ${esc(label)}">🔍</button></span></label>`;
}
function createIconField(id, value = "", category = "") {
  const categoryAttr = category ? ` data-icon-category="${esc(category)}"` : "";
  return `<span class="ed-form-row dm-icon-field" data-icon-field><input id="${esc(id)}" class="ed-input ed-icon-input" value="${esc(value)}"${categoryAttr}><button type="button" class="dm-icon-picker" data-icon-target="${esc(id)}"${categoryAttr} aria-label="${t("select")} icon">🎨</button></span>`;
}
var entityField = (id, label, value, placeholder) => createEntityField({ id, label, value, placeholder });
function renderTemperatureEditor(target) {
  const allRooms = store.getSection("rooms");
  const configured = allRooms.filter((room) => room.temp || room.hum);
  const rows = configured.map((room) => {
    const label = String(room.name || "").trim() || String(room.id || "").trim() || pick("Stanza", "Room");
    return `<article class="ed-row dm-temperature-card" data-temperature-room data-room-id="${esc(room.id)}" data-room-name="${esc(label)}">
    <div class="dm-temperature-card-icon">${globalThis.cdIconMarkup?.(room.icon || "🌡️", 28) || esc(room.icon || "🌡️")}</div>
    <div class="ed-row-main"><div class="ed-row-new">${esc(label)}</div><div class="ed-row-old">${room.floor ? `🏢 ${esc(room.floor)} · ` : ""}<span class="mono">${esc(room.temp)}</span>${room.hum ? ` · <span class="mono">${esc(room.hum)}</span>` : ""}</div></div>
    <button type="button" class="ed-del dm-temperature-edit" data-temperature-edit aria-label="${pick("Modifica", "Edit")}">✏️</button>
    <button type="button" class="ed-del" data-temperature-delete aria-label="${t("remove")}">🗑️</button>
  </article>`;
  }).join("");
  const options = allRooms.map((room) => `<option value="${esc(room.id)}" ${room.temp || room.hum ? "disabled" : ""}>${esc(room.name)}${room.temp || room.hum ? pick(" — configurata", " — configured") : ""}</option>`).join("");
  const empty = pick("Configura prima almeno una stanza nella sezione Stanze.", "Configure at least one room first in the Rooms section.");
  target.innerHTML = `<div class="ed-intro" data-temperature-editor>${pick("Temperatura usa le stanze canoniche: aggiunge i sensori senza creare stanze duplicate.", "Temperature uses canonical rooms: it adds sensors without creating duplicate rooms.")}</div><div class="ed-list" data-temperature-list>${rows || `<div class="ed-empty">${t("empty")}</div>`}</div>
    ${allRooms.length ? `<form class="ed-form dm-temperature-form" data-temperature-form><div class="ed-sec-title" data-temperature-form-title>＋ ${pick("Aggiungi temperatura", "Add temperature")}</div><label class="ed-slot"><span class="ed-slot-lbl">${pick("Stanza", "Room")}</span><select id="dm-temperature-room" class="ed-input" required><option value="">— ${pick("Seleziona stanza", "Select room")} —</option>${options}</select></label><label class="ed-slot"><span class="ed-slot-lbl">${pick("Simbolo", "Icon")}</span>${createIconField("dm-temperature-icon", "mdi:home", "rooms")}</label><output class="ed-row-old dm-temperature-floor" data-temperature-floor></output>${createEntityField({ id: "ed-pl-temp", label: pick("Entità temperatura", "Temperature entity"), optional: false })}${createEntityField({ id: "dm-humidity-new", label: pick("Entità umidità", "Humidity entity") })}<div class="dm-temperature-actions"><button type="submit" class="ed-btn-add" data-temperature-submit>${t("add")}</button><button type="button" class="ed-btn-secondary" data-temperature-cancel hidden>${pick("Annulla", "Cancel")}</button></div></form>` : `<div class="ed-empty dm-temperature-no-rooms">${empty}<button type="button" class="ed-btn-add" data-temperature-go-rooms>${pick("Configura stanze", "Configure rooms")}</button></div>`}`;
}
function mountTemperatureEditor(_section, target) {
  globalThis.dispatchEvent?.(new CustomEvent("dashboardmodern:temperature-editor-rendered"));
  mountEntityPickers(target);
  const select = target.querySelector("#dm-temperature-room");
  const form = target.querySelector("[data-temperature-form]");
  let editingId = "";
  let selectedRoomId = "";
  const refreshOptions = () => {
    const configuredIds = new Set(
      store.getSection("rooms").filter((room) => room.temp || room.hum).map((room) => room.id)
    );
    [...select?.options || []].forEach((option) => {
      option.disabled = configuredIds.has(option.value) && option.value !== editingId;
    });
  };
  const selectRoomForAdd = (room) => {
    editingId = "";
    selectedRoomId = room?.id || "";
    if (!select) return;
    refreshOptions();
    select.disabled = false;
    select.value = selectedRoomId;
    const iconInput = target.querySelector("#dm-temperature-icon");
    if (!iconInput.value || iconInput.value === "🌡️") iconInput.value = room?.icon || "🌡️";
    target.querySelector("[data-temperature-floor]").textContent = room?.floor ? `🏢 ${room.floor}` : "";
    target.querySelector("[data-temperature-form-title]").textContent = `＋ ${pick("Aggiungi temperatura", "Add temperature")}`;
    target.querySelector("[data-temperature-submit]").textContent = t("add");
    target.querySelector("[data-temperature-cancel]").hidden = true;
  };
  const populateEdit = (room) => {
    editingId = room?.id || "";
    selectedRoomId = "";
    if (!select) return;
    refreshOptions();
    select.value = editingId;
    select.disabled = true;
    target.querySelector("#dm-temperature-icon").value = room?.icon || "🌡️";
    target.querySelector("#ed-pl-temp").value = room?.temp || "";
    target.querySelector("#dm-humidity-new").value = room?.hum || "";
    target.querySelector("[data-temperature-floor]").textContent = room?.floor ? `🏢 ${room.floor}` : "";
    target.querySelector("[data-temperature-form-title]").textContent = `${pick("Modifica", "Edit")} ${room.name}`;
    target.querySelector("[data-temperature-submit]").textContent = pick("Salva modifiche", "Save changes");
    target.querySelector("[data-temperature-cancel]").hidden = false;
  };
  refreshOptions();
  select?.addEventListener(
    "change",
    () => selectRoomForAdd(store.getSection("rooms").find((room) => room.id === select.value))
  );
  target.querySelectorAll("[data-temperature-edit]").forEach(
    (button) => button.addEventListener(
      "click",
      () => populateEdit(
        store.getSection("rooms").find((room) => room.id === button.closest("[data-room-id]").dataset.roomId)
      )
    )
  );
  target.querySelector("[data-temperature-cancel]")?.addEventListener("click", () => selectRoomForAdd(null));
  target.querySelectorAll("[data-temperature-delete]").forEach((button) => button.addEventListener("click", async () => {
    const id = button.closest("[data-room-id]").dataset.roomId;
    await store.updateItem("rooms", id, { temp: "", hum: "" });
  }));
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = editingId || selectedRoomId;
    const temp = target.querySelector("#ed-pl-temp").value.trim();
    if (!id || !temp.includes(".")) return globalThis.alert?.(t("required"));
    await store.updateItem("rooms", id, { icon: target.querySelector("#dm-temperature-icon").value.trim() || "🌡️", temp, hum: target.querySelector("#dm-humidity-new").value.trim() });
  });
  target.querySelector("[data-temperature-go-rooms]")?.addEventListener("click", () => globalThis.editorSwitch?.("stanze"));
}
function mountEntityPickers(target) {
  if (!target?.querySelectorAll) return;
  const lightAddEntityIds = /^(?:luce|light)-add-ent$/;
  const explicitLegacyIds = /^(?:ed-(?:pl-(?:temp|ph|cl|pump|heat|light)|irr-(?:ent|rain|weather)|tp-ent|luce-ent|cam-ent)|(?:luce|light)-add-ent|appl-ent-new|ed-avv-ent)$/;
  const inputs = new Set(target.querySelectorAll(
    "[data-entity-input], [data-entity-field] input, input.ed-slot-in[data-ref], input[data-domain]"
  ));
  target.querySelectorAll("input").forEach((input) => {
    const next = input.nextElementSibling;
    if (explicitLegacyIds.test(input.id) || next?.matches?.(".dm-entity-picker, button[onclick*='wzPickEntity']")) {
      inputs.add(input);
    }
  });
  inputs.forEach((input) => {
    attributoSeCambia(input, "data-entity-input", "true");
    if (!input.id) input.id = `dm-entity-${[...target.querySelectorAll("input")].indexOf(input)}`;
    if (lightAddEntityIds.test(input.id)) {
      attributoSeCambia(input, "data-light-add-entity", "");
    }
    let button = input.parentElement?.querySelector?.(`.dm-entity-picker[data-entity-target="${CSS.escape(input.id)}"]`);
    const adjacent = input.nextElementSibling;
    if (!button && adjacent?.matches?.(".dm-entity-picker, button[onclick*='wzPickEntity']")) {
      button = adjacent;
      classeSeCambia(button, "dm-entity-picker", true);
    }
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "dm-entity-picker";
      button.textContent = "🔍";
      input.insertAdjacentElement("afterend", button);
    }
    attributoSeCambia(button, "data-entity-target", input.id);
    if (!button.classList.contains("dm-slot-chip"))
      attributoSeCambia(button, "aria-label", `${t("select")} entity_id`);
    button.onclick = null;
    if (button.dataset.pickerMounted !== "true") {
      button.dataset.pickerMounted = "true";
      button.addEventListener("click", () => globalThis.wzPickEntity?.(input));
    }
  });
  target.querySelectorAll(".dm-icon-picker[data-icon-target]").forEach((button) => {
    if (button.dataset.pickerMounted === "true") return;
    button.dataset.pickerMounted = "true";
    button.addEventListener("click", () => globalThis.dmIconPicker?.(`#${button.dataset.iconTarget}`, button.dataset.iconCategory || void 0));
  });
}
function renderReportRow(item, index) {
  const fieldToken = String(item.id || index).replace(/[^a-zA-Z0-9_-]/g, "-");
  return `<div class="ed-row dm-report-row" data-report-id="${esc(item.id)}" data-section="${esc(item.section || "loads")}">
    <label><input type="checkbox" data-report-toggle ${item.show_in_report !== false ? "checked" : ""}> Report</label>
    <input class="ed-input" data-report-label placeholder="${t("reportLabel")}" value="${esc(item.report_label || item.name)}">
    ${createIconField(`dm-report-icon-${fieldToken}`, item.report_icon || reportIconForDevice(item))}
    ${createEntityField({ id: `dm-report-entity-${fieldToken}`, label: t("reportEntity"), value: reportEntityForDevice(item, globalThis.STATES || {}), optional: false })}
    ${item.category === "manual-report" ? createEntityField({ id: `dm-report-history-${fieldToken}`, label: t("history"), value: item.history_entity }) : ""}
    <span><button type="button" data-report-up aria-label="${t("moveUp")}">▲</button><button type="button" data-report-down aria-label="${t("moveDown")}">▼</button>${item.category === "manual-report" ? `<button type="button" data-report-delete aria-label="${t("remove")}">🗑️</button>` : ""}</span>
    <input type="hidden" data-report-name value="${esc(item.name)}"><input type="hidden" data-report-category value="${esc(item.category)}">
  </div>`;
}
function renderReportEditor(target) {
  const items = [...store.getSection("appliances"), ...store.getSection("loads")].filter((item) => item.category !== "manual-report" || item.show_in_dashboard === false).sort((a, b) => (a.report_order ?? a.order ?? 0) - (b.report_order ?? b.order ?? 0));
  target.innerHTML = `<div class="ed-intro">${t("reportIntro")}</div><div class="ed-list" data-report-list>${items.map(renderReportRow).join("") || `<div class="ed-empty">${t("empty")}</div>`}</div>
    <button type="button" class="ed-btn-add" data-report-add>＋ ${t("addManual")}</button>
    <div class="ed-form" data-report-manual hidden><input class="ed-input" data-manual-name placeholder="${t("name")}">${createIconField("dm-manual-report-icon")}${createEntityField({ id: "dm-manual-report-entity", label: t("entity"), optional: false })}${createEntityField({ id: "dm-manual-report-history", label: t("history") })}<button type="button" class="ed-btn-add" data-manual-confirm>${t("add")}</button></div>
    <div class="ed-action-bar" data-report-actions data-state="clean"><button type="button" class="ed-save-btn" data-report-save disabled>💾 ${t("saveReport")}</button><output data-report-status>${t("saved")}</output></div>`;
}
function mountReportRowControls(row, list, dirty) {
  mountEntityPickers(row);
  row.querySelector("[data-report-up]")?.addEventListener("click", () => {
    const sibling = row.previousElementSibling;
    if (sibling?.matches?.("[data-report-id]")) list.insertBefore(row, sibling);
    dirty();
  });
  row.querySelector("[data-report-down]")?.addEventListener("click", () => {
    const sibling = row.nextElementSibling;
    if (sibling?.matches?.("[data-report-id]")) list.insertBefore(sibling, row);
    dirty();
  });
  row.querySelector("[data-report-delete]")?.addEventListener("click", () => {
    row.remove();
    dirty();
  });
}
function mountReportEditor(_tab, target) {
  const list = target.querySelector("[data-report-list]");
  const save = target.querySelector("[data-report-save]");
  const status = target.querySelector("[data-report-status]");
  const actions = target.querySelector("[data-report-actions]");
  const dirty = () => {
    actions.dataset.state = "dirty";
    save.disabled = false;
    status.textContent = t("dirty");
  };
  target.oninput = dirty;
  target.onchange = dirty;
  target.querySelectorAll("[data-report-id]").forEach(
    (row) => mountReportRowControls(row, list, dirty)
  );
  target.querySelector("[data-report-add]")?.addEventListener("click", () => {
    target.querySelector("[data-report-manual]").hidden = false;
  });
  target.querySelector("[data-manual-confirm]")?.addEventListener("click", () => {
    const name = target.querySelector("[data-manual-name]").value.trim();
    const entity = target.querySelector("#dm-manual-report-entity").value.trim();
    if (!name || !entity.includes(".")) return globalThis.alert?.(t("required"));
    const id = `load-manual-${Date.now().toString(36)}`;
    const wrapper = globalThis.document.createElement("div");
    wrapper.innerHTML = renderReportRow({ id, section: "loads", category: "manual-report", name, report_entity: entity, history_entity: target.querySelector("#dm-manual-report-history").value.trim(), report_icon: target.querySelector("#dm-manual-report-icon").value.trim(), show_in_dashboard: false }, list.querySelectorAll("[data-report-id]").length);
    const added = wrapper.firstElementChild;
    list.querySelector(".ed-empty")?.remove();
    list.append(added);
    mountReportRowControls(added, list, dirty);
    dirty();
  });
  save?.addEventListener("click", async () => {
    const before = store.getState();
    actions.dataset.state = "loading";
    save.disabled = true;
    status.textContent = t("saving");
    const draft = [...list.querySelectorAll("[data-report-id]")].map((rowElement, report_order) => ({
      id: rowElement.dataset.reportId,
      section: rowElement.dataset.section,
      category: rowElement.querySelector("[data-report-category]").value,
      name: rowElement.querySelector("[data-report-name]").value,
      show_in_report: rowElement.querySelector("[data-report-toggle]").checked,
      report_label: rowElement.querySelector("[data-report-label]").value.trim(),
      report_icon: rowElement.querySelector("[data-icon-field] input").value.trim(),
      report_entity: rowElement.querySelectorAll("[data-entity-field] input")[0]?.value || "",
      history_entity: rowElement.querySelectorAll("[data-entity-field] input")[1]?.value || "",
      report_order
    }));
    try {
      await store.saveReport(draft);
      const currentActions = target.querySelector("[data-report-actions]");
      currentActions.dataset.state = "success";
      target.querySelector("[data-report-status]").textContent = t("saved");
    } catch (error) {
      globalThis.console?.error?.("[Report] rollback", error, before);
      renderReportEditor(target);
      mountReportEditor("report", target);
      const rolled = target.querySelector("[data-report-actions]");
      rolled.dataset.state = "error";
      target.querySelector("[data-report-status]").textContent = `Error: ${error.message}`;
    }
  });
  mountEntityPickers(target);
  const entityInputs = target.querySelectorAll("[data-entity-field] input").length;
  const pickers = target.querySelectorAll("[data-entity-field] .dm-entity-picker").length;
  if (entityInputs !== pickers) throw new Error(`Entity picker invariant failed: ${entityInputs} inputs / ${pickers} pickers`);
}
function tempoDiAvvio() {
  try {
    const veloVia = globalThis.__DASHBOARDMODERN_VELO_VIA__;
    const casa = `${import.meta.url.split("/legacy/")[0]}/`;
    const finiteEntro = (fine) => veloVia ? fine <= veloVia : true;
    const fini = performance.getEntriesByType("resource").filter((risorsa) => risorsa.name.startsWith(casa)).map((risorsa) => risorsa.responseEnd || 0).filter(finiteEntro);
    const documento = performance.getEntriesByType("navigation")[0]?.responseEnd || 0;
    if (documento && finiteEntro(documento)) fini.push(documento);
    const s = (v) => `${(v / 1e3).toFixed(1)} s`;
    const ultimo = fini.length ? Math.max(...fini) : 0;
    if (!veloVia) return ultimo ? `ultimo file a ${s(ultimo)} — velo non misurato` : "?";
    return `velo via a ${s(veloVia)} · ultimo file a ${s(ultimo)} · ${s(Math.max(0, veloVia - ultimo))} dopo la rete`;
  } catch (_) {
    return "?";
  }
}
function pesoScaricato() {
  try {
    const casa = `${import.meta.url.split("/legacy/")[0]}/`;
    const nostre = performance.getEntriesByType("resource").filter((risorsa) => risorsa.name.startsWith(casa));
    if (!nostre.length) return "?";
    const somma = (campo) => nostre.reduce((tot, r) => tot + (r[campo] || 0), 0);
    const dalFilo = somma("transferSize");
    const codificato = somma("encodedBodySize");
    const disteso = somma("decodedBodySize");
    if (!disteso) return "?";
    const mb = (v) => `${(v / 1048576).toFixed(1)} MB`;
    const come = !codificato ? "peso codificato non disponibile" : codificato / disteso < 0.9 ? "compressi" : "non compressi";
    return dalFilo ? `${mb(dalFilo)} di ${mb(disteso)} — ${come}` : `${mb(disteso)} dalla cache — ${come}`;
  } catch (_) {
    return "?";
  }
}
async function chiediComeArrivano(target) {
  const nodo = target.querySelector('[data-dm-voce="Transfer"]');
  if (!nodo) return;
  try {
    const casa = `${import.meta.url.split("/legacy/")[0]}/`;
    const risposta = await fetch(`${casa}panel.js`, { cache: "reload" });
    if (!risposta.ok) return;
    const come = risposta.headers.get("content-encoding");
    nodo.textContent = `${nodo.textContent.replace(/ — (compressi|non compressi|peso codificato non disponibile)$/, "")} · servito ${come || "in chiaro"}`;
  } catch (_) {
  }
}
function renderDiagnostics(target) {
  const rows = {
    "Integration version": BUILD_INFO.integrationVersion,
    "Dashboard version": globalThis.DASHBOARD_VERSION || BUILD_INFO.dashboardVersion,
    "Module version": MODULES_VERSION,
    "Schema version": store.getState().schema_version,
    "HTML URL": globalThis.location?.href || "",
    "modules-entry.js URL": import.meta.url,
    "Static asset hash": location.pathname.match(/dashboardmodern_static\/([^/]+)/)?.[1] || BUILD_INFO.assetHash,
    [t("languageVariant")]: `${document.documentElement.lang || "?"} / ${location.pathname.split("/").pop()}`,
    [t("activeRenderer")]: document.querySelector(".ed-tab.active")?.dataset?.tab || "diagnostics",
    "Git commit": BUILD_INFO.commit,
    "Build date": BUILD_INFO.date,
    /* Da dove sono arrivate le parti della plancia.
     *
     * Impacchettata sono tre file; sciolta sono centosettantanove, ed e' la
     * differenza che si sente al primo avvio. Il pacchetto ha un ripiego: se
     * manca, la plancia parte lo stesso dai sorgenti — e allora e' bene poterlo
     * vedere a colpo d'occhio invece di indovinarlo dal cronometro. */
    Modules: globalThis.__DASHBOARDMODERN_IMPACCHETTATA__ ? "impacchettati (3 file)" : "sciolti (179 file)",
    Transfer: pesoScaricato(),
    Boot: tempoDiAvvio()
  };
  target.innerHTML = `<div class="ed-sec-title">🩺 ${t("diagnostics")}</div><div class="ed-list">${Object.entries(rows).map(([key, value]) => `<div class="ed-row"><div class="ed-row-main"><div class="ed-row-new">${esc(key)}</div><div class="ed-row-old mono" data-dm-voce="${esc(key)}">${esc(value)}</div></div></div>`).join("")}</div>`;
  target.dataset.runtimeDiagnostics = "true";
  chiediComeArrivano(target);
}
function strategieDellaTelecameraDiCasa(cam = {}, stato = {}, opzioni = {}) {
  const entity = String(cam?.entity ?? "").trim();
  return strategieDellaTelecamera(cam, stato, {
    capacita: capacitaDellaTelecamera(entity),
    go2rtcRaggiungibile: go2rtcRaggiungibile(),
    appenaCaduta: stradaAppenaCaduta(entity),
    ...opzioni
  });
}
var EDITOR_TAB_ALIASES = Object.freeze({
  sez0: "home",
  sez1: "energy",
  sez2: "ev",
  sez3: "solar",
  sez4: "security",
  sez6: "server",
  sez7: "temperature",
  sez8: "actions",
  sez9: "climate",
  load: "loads",
  runtime: "diagnostics"
});
var resolveEditorTab = (tab) => EDITOR_TAB_ALIASES[tab] || tab;
var EDITOR_REGISTRY = Object.freeze({
  energy: { render: renderEnergyEditorTab, mount: mountCurrentEditor, visibilityKey: "energy" },
  loads: { render: mountLoadsEditor, mount: mountCurrentEditor, visibilityKey: "energy" },
  report: { render: renderReportEditor, mount: mountReportEditor, visibilityKey: "energy" },
  temperature: { render: renderTemperatureEditor, mount: mountTemperatureEditor, visibilityKey: "temp" },
  diagnostics: { render: renderDiagnostics, mount: mountCurrentEditor, visibilityKey: null },
  /* Le prese. La scheda la disegna il modulo che tiene l'elenco: e' lui che sa
   * cosa c'e' dentro, e un secondo posto che lo disegna sarebbe un secondo
   * padrone del formato. */
  prese: { render: renderPreseEditor, mount: mountCurrentEditor, visibilityKey: "prese" }
});
function dispatchEditorTab(tab, target, registry = EDITOR_REGISTRY) {
  const resolved = resolveEditorTab(tab);
  const descriptor = registry[resolved];
  if (!descriptor || !target) return false;
  globalThis.document?.querySelectorAll?.(".ed-tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  descriptor.render(target);
  descriptor.mount?.(resolved, target);
  target.dataset.renderer = resolved;
  return true;
}
function renderEditorTab(tab, target = globalThis.document?.getElementById?.("ed-body")) {
  return dispatchEditorTab(tab, target);
}
function registerEditorTabs(root = globalThis.document) {
  const tabs = root?.querySelector?.(".ed-tabs");
  if (!tabs) return;
  if (!tabs.querySelector('[data-tab="prese"]')) {
    const prese = root.createElement("button");
    prese.type = "button";
    prese.className = "ed-tab";
    prese.dataset.tab = "prese";
    prese.textContent = "🔌 Prese";
    prese.addEventListener("click", () => globalThis.editorSwitch?.("prese"));
    const luci = tabs.querySelector('[data-tab="luci"]');
    if (luci) luci.after(prese);
    else tabs.append(prese);
  }
  if (tabs.querySelector('[data-tab="runtime"]')) return;
  const button = root.createElement("button");
  button.type = "button";
  button.className = "ed-tab";
  button.dataset.tab = "runtime";
  button.textContent = "🩺 Runtime";
  button.addEventListener("click", () => renderEditorTab("runtime"));
  tabs.append(button);
}
function mountCurrentEditor(section, target = globalThis.document?.getElementById?.("ed-body")) {
  if (!target) return;
  mountEntityPickers(target);
  globalThis.cdFillRoomSelects?.();
  target.querySelectorAll?.("details.ed-acc").forEach((details) => details.dataset.editorMounted = "true");
  target.dataset.mountedSection = section || "";
  globalThis.dispatchEvent?.(new CustomEvent("dashboardmodern:editor-rendered", { detail: { section } }));
}
function renderLoadsPanel(target) {
  if (globalThis.__DM_20260817B__ !== true) return false;
  if (typeof globalThis.dmRenderEnergyLoadsEditor !== "function") return false;
  return globalThis.dmRenderEnergyLoadsEditor(target) === true;
}
function mountLoadsEditor(target, editId = "") {
  const loads = store.getSection("loads");
  const appliances = store.getSection("appliances");
  const current = loads.find((item) => item.id === editId) || {};
  const cards = (items, readOnly = false) => items.map((item) => `<div class="ed-row" data-load-id="${esc(item.id)}"><div class="ed-row-main"><div class="ed-row-new">${esc(item.emoji_icon || item.icon || "🔌")} ${esc(item.name || t("newLoad"))}</div><div class="ed-row-old">${esc(item.category || "secondary")}</div></div>${readOnly ? "" : `<button class="ed-del" data-edit-load="${esc(item.id)}" title="${t("editLoad")}">✏️</button><button class="ed-del" data-delete-load="${esc(item.id)}" title="${t("remove")}">🗑️</button>`}</div>`).join("") || `<div class="ed-empty">${t("noLoads")}</div>`;
  target.innerHTML = `<div class="ed-intro">${t("loadsIntro")}</div><details class="ed-acc" open><summary class="ed-acc-head">A. ${t("appliances")} <span class="ed-acc-n">${appliances.length}</span></summary><div class="ed-acc-body">${cards(appliances, true)}</div></details>
    <details class="ed-acc" open><summary class="ed-acc-head">B. ${t("secondaryLoads")} <span class="ed-acc-n">${loads.filter((x) => x.category !== "manual-report").length}</span></summary><div class="ed-acc-body">${cards(loads.filter((x) => x.category !== "manual-report"))}</div></details>
    <div class="ed-form" data-load-form><div class="ed-sec-title">${editId ? t("editLoad") : t("newLoad")}</div><div class="ed-form-row"><input id="dm-load-name" class="ed-input" placeholder="${t("name")}" value="${esc(current.name)}"><input id="dm-load-icon" class="ed-input ed-icon-input" placeholder="🔌 / mdi:power-plug" value="${esc(current.emoji_icon || current.icon)}"></div><div class="ed-form-row"><select id="dm-load-room" class="ed-input">${globalThis.cdRoomOptions?.(current.room_id) || ""}</select></div>${entityField("dm-load-power", t("powerEntity"), current.power_entity, "sensor.load_power")}${entityField("dm-load-day", t("dailyEnergy"), current.daily_energy_entity)}${entityField("dm-load-month", t("monthlyEnergy"), current.monthly_energy_entity)}${entityField("dm-load-total", t("totalEnergy"), current.total_energy_entity)}${entityField("dm-load-history", t("history"), current.history_entity)}${entityField("dm-load-state", t("state"), current.state_entity)}${entityField("dm-load-control", t("control"), current.control_entity, "switch.load")}<label class="ed-intro"><input id="dm-load-report" type="checkbox" ${current.show_in_report !== false ? "checked" : ""}> ${t("visibleReport")}</label><label class="ed-intro"><input id="dm-load-dashboard" type="checkbox" ${current.show_in_dashboard !== false ? "checked" : ""}> ${t("visibleDashboard")}</label><button class="ed-btn-add" data-save-load>💾 ${editId ? t("saveChanges") : t("addLoad")}</button></div>`;
  target.querySelectorAll?.("[data-edit-load]").forEach((button) => button.addEventListener("click", () => mountLoadsEditor(target, button.dataset.editLoad)));
  target.querySelectorAll?.("[data-delete-load]").forEach((button) => button.addEventListener("click", async () => {
    try {
      await store.removeItem("loads", button.dataset.deleteLoad);
    } catch (error) {
      globalThis.alert?.(error.message);
    }
  }));
  target.querySelector?.("[data-save-load]")?.addEventListener("click", async () => {
    const value = (id) => target.querySelector(`#${id}`)?.value?.trim() || "";
    const item = { name: value("dm-load-name"), icon: value("dm-load-icon"), category: current.category && current.category !== "manual-report" ? current.category : "secondary", room_id: value("dm-load-room"), power_entity: value("dm-load-power"), daily_energy_entity: value("dm-load-day"), monthly_energy_entity: value("dm-load-month"), total_energy_entity: value("dm-load-total"), history_entity: value("dm-load-history"), state_entity: value("dm-load-state"), control_entity: value("dm-load-control"), show_in_report: !!target.querySelector("#dm-load-report")?.checked, show_in_dashboard: !!target.querySelector("#dm-load-dashboard")?.checked, order: current.order ?? loads.length };
    if (!item.name) return globalThis.alert?.(t("loadNameRequired"));
    try {
      await (editId ? store.updateItem("loads", editId, item) : store.addItem("loads", item));
    } catch (error) {
      globalThis.alert?.(error.message);
    }
  });
}
var DashboardModernModules = Object.freeze({
  version: MODULES_VERSION,
  /* La porta della chat di assistenza, per chi la vuole aprire da fuori — il
   * widget in Home, una scorciatoia, le fotografie della galleria. Il modulo
   * si installa da se': questa e' la maniglia, non l'interruttore. */
  apriAssistenza: apri,
  data: Object.freeze({
    canonicalReportDevices: reportDelPiano,
    getDeviceDisplayName,
    getDeviceVisual,
    normalizeDevice,
    stableRoomId,
    normalizeRooms,
    isConfiguredRoom,
    applianceRoomId,
    applianceGroups,
    applianceEnergyReport,
    applianceMedia,
    applianceName,
    applianceState,
    controllableEntity,
    normalizeCamera,
    normalizeCameras,
    saveCamera,
    removeCamera
  }),
  /* Come si apre una telecamera: la scelta delle strade e delle attese sta in
   * un modulo puro, e il runtime la chiede a lui invece di averla scritta
   * dentro. E' l'unico modo perche' quella scelta si possa provare senza una
   * Ring in casa. */
  telecamere: Object.freeze({
    strategieDellaTelecamera: strategieDellaTelecameraDiCasa,
    daProvare,
    diagnosi,
    siSveglia
  }),
  /* Le modalita' di ricarica: quali tasti disegnare e quale accendere. evcc le
   * ha rinominate una volta (`pv` → `smart`) e i tasti sono rimasti spenti per
   * giorni; adesso i nomi non stanno piu' nel guscio, stanno nell'entita', e il
   * guscio li chiede qui. */
  evcc: Object.freeze({
    iModiDiEvcc,
    ilModoAcceso,
    eIlModoIntelligente,
    iValoriDelSempre,
    ilSempreEInVigore,
    ilValoreDelSempreAcceso,
    laFilaDelSempreServe
  }),
  store,
  EDITOR_REGISTRY,
  renderEditorTab,
  dispatchEditorTab,
  resolveEditorTab,
  registerEditorTabs,
  hydrateCanonicalRuntime,
  diagnostics: Object.freeze({ BUILD_INFO, MODULES_VERSION, SCHEMA_VERSION, htmlUrl: globalThis.location?.href, modulesUrl: import.meta.url }),
  render: Object.freeze({ createEnergyReportRows, createRenderCoordinator, createEntityField, loadPopupMetrics, mountCurrentEditor, mountEntityPickers, mountLoadsEditor, mountReportEditor, renderEnergyEditorTab, renderReportEditor, renderDeviceCard, renderEnergyEditor })
});
globalThis.DashboardModernModules = DashboardModernModules;
var canonicalRuntimeHydrated = false;
function hydrateCanonicalRuntime() {
  if (canonicalRuntimeHydrated) return false;
  if (!globalThis.__DASHBOARDMODERN_LEGACY_READY__ || globalThis.document?.readyState === "loading") {
    globalThis.addEventListener?.("dashboardmodern:legacy-ready", hydrateCanonicalRuntime, {
      once: true
    });
    return false;
  }
  canonicalRuntimeHydrated = true;
  runSteps(
    [
      ["applyRuntimeProjection", () => applyRuntimeProjection()],
      ["cdRebuildReportDevices", () => globalThis.cdRebuildReportDevices?.()],
      ["buildReportSelect", () => globalThis.buildReportSelect?.()],
      ["cdApplyNavVis", () => globalThis.cdApplyNavVis?.()],
      ["renderAppliances", () => globalThis.renderAppliances?.()],
      ["renderApplianceSection", () => globalThis.renderApplianceSection?.(true)],
      ["buildDeviceCards", () => globalThis.buildDeviceCards?.()],
      ["render", () => globalThis.render?.()]
    ],
    { onError: stepReporter(globalThis.console, "avvio") }
  );
  return true;
}
hydrateCanonicalRuntime();
var modules_entry_default = DashboardModernModules;
export {
  EDITOR_REGISTRY,
  EDITOR_TAB_ALIASES,
  MODULES_VERSION,
  chiediComeArrivano,
  createEntityField,
  modules_entry_default as default,
  dispatchEditorTab,
  hydrateCanonicalRuntime,
  mountCurrentEditor,
  mountEntityPickers,
  mountTemperatureEditor,
  pesoScaricato,
  registerEditorTabs,
  renderEditorTab,
  renderReportRow,
  renderTemperatureEditor,
  resolveEditorTab,
  tempoDiAvvio
};
