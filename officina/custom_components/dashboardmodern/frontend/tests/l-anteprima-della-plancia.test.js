/* L'anteprima della plancia nel Config (#379): le regole e il guscio.
 *
 * «Il drag e drop non deve essere sulla plancia: ti avevo detto di creare
 * un'anteprima nel Config dove si fa questa cosa.» Qui le parti che si
 * provano senza browser: quale scheda ha l'anteprima e di quale pagina, quanto
 * si rimpicciolisce lo schermo, il documento della cornice — e il pezzo del
 * guscio che rende la cornice un'anteprima: legge il vero, scrive in memoria,
 * e un comando alla casa diventa un `ping`. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import {
  documentoDellAnteprima,
  dispositivoDiPartenza,
  guscioPerLaLingua,
  paginaDellaScheda,
  scalaPer,
  schermoDi,
  segnoDellaCornice,
} from "../../../../../ponte/plancia/src/core/anteprima-della-plancia.js";

test("le schede dell'Energia e della Sicurezza hanno l'anteprima della loro pagina", () => {
  assert.equal(paginaDellaScheda("sez1"), "energy");
  assert.equal(paginaDellaScheda("energy"), "energy");
  assert.equal(paginaDellaScheda("sez4"), "security");
  assert.equal(paginaDellaScheda("sez3"), "boiler");
  assert.equal(paginaDellaScheda("irr"), "irrigazione");
  assert.equal(paginaDellaScheda("agenda"), "calendario");
  assert.equal(paginaDellaScheda("doors"), "porte");
  /* La Home ha gia' la sua anteprima, e le Impostazioni non sono una pagina. */
  assert.equal(paginaDellaScheda("sez0"), "");
  assert.equal(paginaDellaScheda("visib"), "");
  assert.equal(paginaDellaScheda(""), "");
  assert.equal(paginaDellaScheda("toString"), "");
});

test("lo schermo si rimpicciolisce per stare nella colonna e nell'altezza, mai sotto un terzo", () => {
  assert.deepEqual(schermoDi("telefono"), { larghezza: 390, altezza: 844 });
  assert.deepEqual(schermoDi("boh"), schermoDi("computer"));
  assert.equal(scalaPer(1200, "telefono"), 1);
  assert.equal(scalaPer(195, "telefono"), 0.5);
  assert.equal(scalaPer(640, "computer"), 0.5);
  assert.equal(Math.round(scalaPer(1200, "telefono", 422) * 1000), 500);
  assert.equal(scalaPer(10, "computer"), 0.3);
  assert.equal(scalaPer(0, "computer"), 1);
  assert.equal(scalaPer(Number.NaN, "telefono"), 1);
});

test("si parte dallo schermo di chi configura", () => {
  assert.equal(dispositivoDiPartenza(390), "telefono");
  assert.equal(dispositivoDiPartenza(1440), "computer");
  assert.equal(dispositivoDiPartenza(undefined), "computer");
});

test("il guscio e il documento della cornice", () => {
  assert.equal(guscioPerLaLingua("it"), "dashboard.html");
  assert.equal(guscioPerLaLingua("it-IT"), "dashboard.html");
  assert.equal(guscioPerLaLingua("fr"), "dashboard-en.html");
  assert.equal(guscioPerLaLingua(""), "dashboard-en.html");
  const html =
    '<!doctype html><html lang="it"><head><meta charset="utf-8"></head><body></body></html>';
  const fatto = documentoDellAnteprima(html, { base: "https://casa/x/legacy/", lingua: "de" });
  assert.match(fatto, /<html lang="de">/);
  assert.match(fatto, /<head><base href="https:\/\/casa\/x\/legacy\/">/);
  /* Una base che c'e' gia' non si raddoppia. */
  assert.equal(
    (documentoDellAnteprima(fatto, { base: "https://altro/" }).match(/<base /g) || []).length,
    1,
  );
  assert.equal(segnoDellaCornice("energy", "telefono"), "energy:telefono");
  assert.equal(segnoDellaCornice("security", "tablet"), "security:computer");
});

/* ── il guscio dentro la cornice ───────────────────────────────────────── */

const GUSCIO = readFileSync(
  new URL("../../../../../ponte/plancia/legacy/storage-namespace.js", import.meta.url),
  "utf8",
);

function storage(iniziale = {}) {
  const m = new Map(Object.entries(iniziale));
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

function cornice(segno) {
  const mandati = [];
  class Ponte {
    constructor(url) {
      this.url = url;
    }
    send(d) {
      mandati.push(JSON.parse(d));
    }
  }
  Ponte.__dmHostedHandshakeAdapter = true;
  const parent = { __DASHBOARDMODERN_BRIDGE_WS__: Ponte, __DASHBOARDMODERN_INSTANCE__: "casa1" };
  const vero = storage({ cd_casa1_cd_disposizione: '{"energy":{"ordine":["a"]}}' });
  const window = {
    parent,
    frameElement:
      segno === null ? null : { getAttribute: (n) => (n === "data-dm-anteprima" ? segno : null) },
    location: { pathname: "/legacy/dashboard.html", search: "" },
  };
  Object.defineProperty(window, "localStorage", { configurable: true, get: () => vero });
  Object.defineProperty(window, "sessionStorage", { configurable: true, get: () => storage() });
  window.window = window;
  vm.runInNewContext(GUSCIO, { window, document: { documentElement: {} } });
  return { window, vero, mandati };
}

test("fuori da una cornice d'anteprima il guscio non cambia niente", () => {
  const { window } = cornice(null);
  assert.equal(window.__DASHBOARDMODERN_ANTEPRIMA__, undefined);
  assert.equal(window.WebSocket, undefined);
});

test("nell'anteprima si legge il vero, si scrive in memoria, e i comandi diventano ping", () => {
  const { window, vero, mandati } = cornice("energy:telefono");
  assert.deepEqual(
    { ...window.__DASHBOARDMODERN_ANTEPRIMA__ },
    { pagina: "energy", dispositivo: "telefono" },
  );
  assert.equal(window.__DASHBOARDMODERN_INSTANCE__, "casa1");

  /* La configurazione vera si legge, col nome della plancia. */
  assert.equal(window.localStorage.getItem("cd_disposizione"), '{"energy":{"ordine":["a"]}}');
  /* E quello che l'anteprima scrive resta li'. */
  window.localStorage.setItem("cd_disposizione", "{}");
  window.localStorage.setItem("cd_last_tab", "energy");
  assert.equal(window.localStorage.getItem("cd_disposizione"), "{}");
  assert.equal(vero.getItem("cd_casa1_cd_disposizione"), '{"energy":{"ordine":["a"]}}');
  assert.equal(vero.getItem("cd_casa1_cd_last_tab"), null);

  /* Lo stesso filo della plancia di fuori, senza comandi. */
  assert.equal(window.__DASHBOARDMODERN_BRIDGE_WS__, window.WebSocket);
  assert.equal(window.WebSocket.__dmHostedHandshakeAdapter, true);
  const presa = new window.WebSocket("ws://casa");
  presa.send(JSON.stringify({ type: "auth", access_token: "x" }));
  presa.send(JSON.stringify({ id: 1, type: "get_states" }));
  presa.send(JSON.stringify({ id: 2, type: "call_service", domain: "light", service: "turn_on" }));
  presa.send(JSON.stringify({ id: 3, type: "frontend/set_user_data", key: "k", value: 1 }));
  presa.send(JSON.stringify({ id: 4, type: "subscribe_events", event_type: "state_changed" }));
  presa.send(
    JSON.stringify({ id: 5, type: "config/entity_registry/update", entity_id: "light.a" }),
  );
  assert.deepEqual(
    mandati.map((m) => m.type),
    ["auth", "get_states", "ping", "ping", "subscribe_events", "ping"],
  );
  assert.deepEqual(mandati[2], { id: 2, type: "ping" });
});
