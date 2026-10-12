/* «Utente admin (vuoto = Config visibile a tutti)»: scritto un nome, la Config
 * e' sua.
 *
 * La segnalazione: il nome scritto era quello di chi amministra, e l'utente
 * fatto apposta per la revisione dell'App Store — che in Home Assistant non
 * amministra — dall'app apriva la Config e ci metteva mano. Tre buchi in fila:
 * il nome restava sul dispositivo dove lo si era scritto (`cd_connection`),
 * nell'app nessuno sapeva chi stava guardando, e il confronto era «il nome
 * contiene quello scritto».
 *
 * Qui si prova la meta' della pagina: la regola, le porte che chiude, e il
 * guscio che la usa. Quella del ponte — il rifiuto vero dei salvataggi — sta
 * in `ponte/test/la-config-e-di-chi-la-amministra.test.js`. I nomi delle
 * persone sono segnaposto.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  amministratoriScritti,
  siApreLaConfig,
  stessaPersona,
} from "../src/core/chi-configura.js";
import { ALLOWED_MESSAGE_TYPES } from "../src/legacy/bridge-socket.js";

const sezione = await import("../src/sections/la-config-e-di-chi-la-amministra-section.js");
const stato = globalThis.__DASHBOARDMODERN_CHI_CONFIGURA__;

function memoria(iniziale = {}) {
  const dati = new Map(Object.entries(iniziale));
  return {
    getItem: (chiave) => (dati.has(chiave) ? dati.get(chiave) : null),
    setItem: (chiave, valore) => dati.set(chiave, String(valore)),
    removeItem: (chiave) => dati.delete(chiave),
  };
}

function conLaCasa(valori, prova) {
  globalThis.localStorage = memoria(valori);
  const prima = { ...stato };
  try {
    return prova();
  } finally {
    Object.assign(stato, prima);
    stato.chiSono = null;
    delete globalThis.localStorage;
    delete globalThis.getCurrentHassUser;
    delete globalThis.__DASHBOARDMODERN_UTENTE__;
  }
}

const CASELLA = JSON.stringify({ title: "Casa", admin_users: ["Persona Titolare"] });

test("il nome si confronta per intero: una lettera non apre la Config a mezza casa", () => {
  const titolare = { id: "a".repeat(32), name: "Persona Titolare" };
  assert.equal(stessaPersona(" persona titolare ", titolare), true);
  assert.equal(stessaPersona("A".repeat(32), titolare), true);
  assert.equal(stessaPersona("Persona", titolare), false);
  assert.equal(stessaPersona("a", titolare), false);
});

test("la casella sta in cd_branding, e cd_connection vale solo se la plancia non ne ha una", () => {
  assert.deepEqual(
    amministratoriScritti({
      branding: { admin_users: ["Persona Titolare"] },
      collegamento: { admin_users: ["Vecchio Nome"] },
    }),
    ["Persona Titolare"],
  );
  /* Un elenco vuoto in cd_branding non butta il nome che questo vetro ha:
   * la 1.11.10 lo scriveva anche quando nessuno aveva svuotato niente. */
  assert.deepEqual(
    amministratoriScritti({ branding: { admin_users: [] }, collegamento: { admin_users: ["x"] } }),
    ["x"],
  );
  assert.deepEqual(
    amministratoriScritti({ branding: { title: "Casa" }, collegamento: { admin_users: ["x"] } }),
    ["x"],
  );
});

test("casella vuota per tutti, piena solo per chi c'e' scritto, e chi non si sa resta fuori", () => {
  assert.equal(siApreLaConfig({ amministratori: [] }), true);
  assert.equal(siApreLaConfig({ amministratori: ["Persona Titolare"] }), false);
  assert.equal(
    siApreLaConfig({ amministratori: ["Persona Titolare"], utente: { name: "Revisione" } }),
    false,
  );
  assert.equal(
    siApreLaConfig({ amministratori: ["Persona Titolare"], utente: { name: "persona titolare" } }),
    true,
  );
  /* Quando il ponte ha risposto vale lui: sa chi c'e' in casa. */
  assert.equal(siApreLaConfig({ amministratori: [], dalPonte: false }), false);
  assert.equal(siApreLaConfig({ amministratori: ["Persona"], dalPonte: true }), true);
});

test("nell'app la pagina non sa chi guarda finche' il ponte non lo dice", () => {
  conLaCasa({ cd_branding: CASELLA }, () => {
    assert.equal(sezione.puoConfigurare(), false, "nessun nome: con la casella piena, no");
    stato.chiSono = { id: "c".repeat(32), name: "Revisione", gdahome_config: false };
    assert.equal(sezione.puoConfigurare(), false);
    stato.chiSono = { id: "a".repeat(32), name: "Persona Titolare", gdahome_config: true };
    assert.equal(sezione.puoConfigurare(), true);
  });
});

test("dove il ponte non c'e', vale il nome che Home Assistant da' alla pagina", () => {
  conLaCasa({ cd_branding: CASELLA }, () => {
    globalThis.getCurrentHassUser = () => "Persona Titolare";
    assert.equal(sezione.puoConfigurare(), true);
    globalThis.getCurrentHassUser = () => "Persona Titolare Seconda";
    assert.equal(sezione.puoConfigurare(), false, "contenere il nome non basta piu'");
  });
  /* Il nome scritto prima, rimasto nel cd_connection di questo vetro. */
  conLaCasa({ cd_connection: JSON.stringify({ admin_users: ["Persona Titolare"] }) }, () => {
    globalThis.getCurrentHassUser = () => "Revisione";
    assert.equal(sezione.puoConfigurare(), false);
  });
});

test("le porte del guscio si chiudono a chi non puo', e restano aperte a chi puo'", () => {
  conLaCasa({ cd_branding: CASELLA }, () => {
    const aperte = [];
    globalThis.apriConfigEntita = () => aperte.push("config");
    globalThis.wzResetAll = () => aperte.push("reset");
    globalThis.apriSetupWizard = () => aperte.push("wizard");
    try {
      sezione.chiudiLePorte();
      sezione.chiudiLePorte();
      stato.chiSono = { id: "c".repeat(32), name: "Revisione", gdahome_config: false };
      globalThis.apriConfigEntita();
      globalThis.wzResetAll();
      globalThis.apriSetupWizard();
      assert.deepEqual(aperte, []);
      stato.chiSono = { id: "a".repeat(32), name: "Persona Titolare", gdahome_config: true };
      globalThis.apriConfigEntita();
      globalThis.wzResetAll();
      assert.deepEqual(aperte, ["config", "reset"], "una volta sola, non due");
    } finally {
      delete globalThis.apriConfigEntita;
      delete globalThis.wzResetAll;
      delete globalThis.apriSetupWizard;
    }
  });
});

test("il tocco sulla linguetta — di un dito o dell'app — si ferma prima di arrivarci", () => {
  conLaCasa({ cd_branding: CASELLA }, () => {
    const fermato = [];
    const tocco = (quale) => ({
      target: { closest: (sel) => (sel.includes(`"${quale}"`) ? { quale } : null) },
      preventDefault: () => fermato.push("default"),
      stopImmediatePropagation: () => fermato.push("propagazione"),
    });
    stato.chiSono = { id: "c".repeat(32), name: "Revisione", gdahome_config: false };
    sezione.sulTocco(tocco("home"));
    assert.deepEqual(fermato, [], "le altre linguette non si toccano");
    sezione.sulTocco(tocco("config"));
    assert.deepEqual(fermato, ["default", "propagazione"]);
    stato.chiSono = { id: "a".repeat(32), name: "Persona Titolare", gdahome_config: true };
    fermato.length = 0;
    sezione.sulTocco(tocco("config"));
    assert.deepEqual(fermato, []);
  });
});

test("la domanda «chi sono» passa anche nel pannello dell'integrazione", () => {
  assert.ok(ALLOWED_MESSAGE_TYPES.includes("auth/current_user"));
  const sorgente = readFileSync(
    new URL("../src/sections/la-config-e-di-chi-la-amministra-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sorgente, /type: "auth\/current_user", profile: profilo\(\)/);
  const avvio = readFileSync(new URL("../src/sections/section-runtime.js", import.meta.url), "utf8");
  assert.match(avvio, /senzaCadere\(installLaConfigEDiChiLaAmministra\)/);
});

for (const guscio of ["dashboard-runtime-it.js", "dashboard-runtime-en.js"]) {
  test(`${guscio}: la casella scrive dove viaggia, e il guscio chiede alla regola`, () => {
    const testo = readFileSync(new URL(`../legacy/${guscio}`, import.meta.url), "utf8");
    const salva = /function edSaveGeneral\(\)\{[\s\S]*?\} function editorRenderVisib/.exec(testo)?.[0];
    assert.ok(salva, "edSaveGeneral c'e'");
    assert.match(salva, /if\(a\) br\.admin_users=\[a\]; else if\(prima\) br\.admin_users=\[\];/);
    assert.doesNotMatch(salva, /cn\.admin_users = a/);
    const visibile = /function updateEditButtonVisibility\(\) \{[\s\S]*?\n\}/.exec(testo)?.[0];
    assert.ok(visibile);
    assert.match(visibile, /window\.dmPuoConfigurare\(\) === true/);
    assert.doesNotMatch(visibile, /\.includes\(String\(a\)/, "niente piu' «contiene»");
    assert.match(testo, /subtitle: WIZ\.subtitle, admin_users: WIZ\.admin \? \[WIZ\.admin\] : \[\]/);
  });
}

/* ─── Il nome vuoto nell'app (1.11.10) ───────────────────────────────────── */

/* `edSaveGeneral` com'e' scritta nel guscio, fatta girare con una casella e un
 * deposito finti. */
function salvaIGenerali(guscio, { casella, branding, collegamento = null }) {
  const testo = readFileSync(new URL(`../legacy/${guscio}`, import.meta.url), "utf8");
  const corpo = /function edSaveGeneral\(\)\{[\s\S]*?\} (?=function editorRenderVisib)/.exec(testo)[0];
  const deposito = new Map();
  if (branding) deposito.set("cd_branding", JSON.stringify(branding));
  if (collegamento) deposito.set("cd_connection", JSON.stringify(collegamento));
  const campi = { "ed-gen-title": "Casa", "ed-gen-sub": "", "ed-gen-admin": casella };
  const finti = {
    document: { getElementById: (id) => ({ value: campi[id] ?? "" }) },
    localStorage: {
      getItem: (k) => deposito.get(k) ?? null,
      setItem: (k, v) => deposito.set(k, String(v)),
    },
    cdCfg: (k) => (deposito.has(k) ? JSON.parse(deposito.get(k)) : {}),
    cdMarkDirty() {},
    cdSyncPush() {},
    edToast() {},
    setTimeout() {},
    location: { reload() {} },
  };
  const esegui = new Function(...Object.keys(finti), `${corpo}; edSaveGeneral();`);
  esegui(...Object.values(finti));
  return {
    branding: JSON.parse(deposito.get("cd_branding") || "null"),
    collegamento: JSON.parse(deposito.get("cd_connection") || "null"),
  };
}

for (const guscio of ["dashboard-runtime-it.js", "dashboard-runtime-en.js"]) {
  test(`${guscio}: «Salva generali» con la casella vuota che era vuota non scrive la casella`, () => {
    /* Il vetro che il nome non lo conosce: salvare il titolo non lo cancella
     * a tutti. Senza la chiave, il ponte tiene quello salvato. */
    const ignaro = salvaIGenerali(guscio, { casella: "", branding: { title: "Vecchio" } });
    assert.equal(ignaro.branding.title, "Casa");
    assert.equal("admin_users" in ignaro.branding, false);
    /* Chi la vedeva piena e la svuota, la svuota davvero. */
    const svuotata = salvaIGenerali(guscio, {
      casella: "",
      branding: { admin_users: ["Persona Titolare"] },
    });
    assert.deepEqual(svuotata.branding.admin_users, []);
    /* E anche il nome rimasto nel cd_connection di questo vetro. */
    const dalVetro = salvaIGenerali(guscio, {
      casella: "",
      branding: {},
      collegamento: { token: "t", admin_users: ["Persona Titolare"] },
    });
    assert.deepEqual(dalVetro.branding.admin_users, []);
    assert.equal("admin_users" in dalVetro.collegamento, false);
    assert.equal(dalVetro.collegamento.token, "t");
    /* Scritto un nome, va in cd_branding. */
    const scritta = salvaIGenerali(guscio, { casella: " Persona Titolare ", branding: {} });
    assert.deepEqual(scritta.branding.admin_users, ["Persona Titolare"]);
  });

  test(`${guscio}: la casella mostra il nome anche quando cd_branding ha un elenco vuoto`, () => {
    const testo = readFileSync(new URL(`../legacy/${guscio}`, import.meta.url), "utf8");
    assert.match(
      testo,
      /var adm=\(Array\.isArray\(br\.admin_users\)&&br\.admin_users\[0\]\)\|\|\(cn2\.admin_users&&cn2\.admin_users\[0\]\)\|\|'';/,
    );
  });
}

test("il nome si travasa anche da un vetro gia' in pari con la configurazione", () => {
  const persistenza = readFileSync(
    new URL("../src/sections/config-persistence-section.js", import.meta.url),
    "utf8",
  );
  const lettura = /async function hydrateRemote[\s\S]*?\n\}/.exec(persistenza)[0];
  assert.match(lettura, /dashboardmodern:persistence-hydrated/);
  const sorgente = readFileSync(
    new URL("../src/sections/la-config-e-di-chi-la-amministra-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sorgente, /"dashboardmodern:persistence-hydrated"/);
});
