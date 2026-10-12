/* La Config di una plancia e' di chi la casella «Utente admin» nomina.
 *
 * La segnalazione: il nome scritto in «Generali» era quello di chi
 * amministra, e l'utente fatto apposta per la revisione dell'App Store — un
 * utente che in Home Assistant non amministra, entrato col codice della casa
 * di prova — apriva lo stesso la Config e ci metteva mano.
 *
 * Qui si prova la meta' che conta, quella del ponte: chi non e' nominato non
 * salva, non ripristina e non azzera, qualunque cosa la pagina abbia
 * nascosto o mostrato; chi e' nominato salva da Home Assistant e dall'app; e
 * alla domanda «chi sono?» la pagina si sente rispondere l'utente vero del
 * telefono, non l'add-on. I nomi delle persone qui sono segnaposto.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  amministratoriDellaPlancia,
  nomiPuliti,
  puoConfigurare,
  stessaPersona,
} from "../src/chi-configura.js";
import { Commissioni, eUnaCommissione } from "../src/commissioni.js";
import { Configurazione } from "../src/configurazione.js";
import { Cucitura } from "../src/cucitura.js";
import { Dispositivi } from "../src/dispositivi.js";
import { passaLaDogana } from "../src/dogana.js";
import { Ponte } from "../src/ponte.js";
import { accetta } from "../src/presa.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };

/* Tre persone: chi amministra la casa ed e' scritto nella casella, un altro
 * amministratore di Home Assistant che nella casella non c'e', e l'utente
 * della revisione, che non amministra. */
const TITOLARE = "a".repeat(32);
const ALTRO_ADMIN = "b".repeat(32);
const REVISIONE = "c".repeat(32);
const ELENCO = [
  { id: TITOLARE, nome: "Persona Titolare", amministratore: true, attivo: true },
  { id: ALTRO_ADMIN, nome: "Altra Persona", amministratore: true, attivo: true },
  { id: REVISIONE, nome: "Revisione", amministratore: false, attivo: true },
];

function utentiDiCasa(elenco = ELENCO) {
  return {
    async elenco() {
      if (elenco instanceof Error) throw elenco;
      return elenco;
    },
    async amministratore(chi) {
      return elenco.some((uno) => uno.id === chi && uno.amministratore);
    },
    amministratoreSubito(chi) {
      if (elenco instanceof Error) return null;
      return elenco.some((uno) => uno.id === chi && uno.amministratore);
    },
    async eVivo(chi) {
      return elenco.some((uno) => uno.id === chi);
    },
  };
}

/* Una plancia gia' configurata, con la casella piena o vuota. */
function unaCasa({ admin = null, utenti = utentiDiCasa() } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "ponte-config-admin-"));
  const configurazione = new Configurazione({ cartella });
  const branding = { title: "Casa" };
  if (admin !== null) branding.admin_users = admin;
  /* Lo scatto e' intero: chi salva rimanda anche la casella, com'e'. */
  const conLaCasella = (valori) => ({ cd_branding: JSON.stringify(branding), ...valori });
  configurazione.scrivi("primary", conLaCasella({ cd_stanze: '[{"name":"Sala"}]' }));
  const commissioni = new Commissioni({ registro: ZITTO, configurazione, utenti });
  const salva = (valori = { cd_stanze: '[{"name":"Cucina"}]' }) => ({
    id: 7,
    type: "dashboardmodern/config/set",
    snapshot: { values: conLaCasella(valori), keys_revision: 1 },
  });
  return {
    commissioni,
    configurazione,
    salva,
    via: () => rmSync(cartella, { recursive: true, force: true }),
  };
}

/* ─── La regola ──────────────────────────────────────────────────────────── */

test("il nome si confronta per intero, senza maiuscole e senza spazi ai lati", () => {
  const titolare = ELENCO[0];
  assert.equal(stessaPersona("Persona Titolare", titolare), true);
  assert.equal(stessaPersona("  persona TITOLARE ", titolare), true);
  assert.equal(stessaPersona(TITOLARE.toUpperCase(), titolare), true, "l'identificativo vale");
  /* Prima bastava che il nome contenesse quello scritto: una lettera apriva
   * la Config a mezza casa. */
  assert.equal(stessaPersona("Persona", titolare), false);
  assert.equal(stessaPersona("a", titolare), false);
  assert.equal(stessaPersona("", titolare), false);
});

test("gli amministratori si leggono da cd_branding, che viaggia con la configurazione", () => {
  assert.deepEqual(
    amministratoriDellaPlancia({ cd_branding: '{"title":"x","admin_users":[" Revisione ",""]}' }),
    ["Revisione"],
  );
  assert.deepEqual(amministratoriDellaPlancia({ cd_branding: '{"title":"x"}' }), []);
  assert.deepEqual(amministratoriDellaPlancia({ cd_branding: "non e' json" }), []);
  assert.deepEqual(amministratoriDellaPlancia({}), []);
  /* `cd_connection` resta del dispositivo: non e' qui che si guarda. */
  assert.deepEqual(amministratoriDellaPlancia({ cd_connection: '{"admin_users":["x"]}' }), []);
  assert.deepEqual(nomiPuliti(["a", "a", 3, null, " b "]), ["a", "b"]);
});

test("casella vuota: come prima; casella piena: solo chi c'e' scritto, e chi non si sa resta fuori", () => {
  const base = { utenti: ELENCO };
  assert.equal(puoConfigurare({ ...base, amministratori: [], chiChiede: REVISIONE }), true);
  const nominato = { ...base, amministratori: ["Persona Titolare"] };
  assert.equal(puoConfigurare({ ...nominato, chiChiede: TITOLARE }), true);
  assert.equal(
    puoConfigurare({ ...nominato, chiChiede: ALTRO_ADMIN, puoAmministrare: true }),
    false,
    "amministrare Home Assistant non basta",
  );
  assert.equal(puoConfigurare({ ...nominato, chiChiede: REVISIONE }), false);
  assert.equal(
    puoConfigurare({ ...nominato, chiChiede: "", puoAmministrare: true }),
    false,
    "chi non si sa chi sia non entra",
  );
  assert.equal(
    puoConfigurare({ ...nominato, chiChiede: TITOLARE, utenti: null }),
    false,
    "senza l'elenco di casa non si sa niente",
  );
  /* Un nome che non e' di nessuno non chiude fuori tutti: resta a chi
   * amministra, come con la casella vuota. */
  const diNessuno = { ...base, amministratori: ["Persona"] };
  assert.equal(puoConfigurare({ ...diNessuno, chiChiede: TITOLARE, puoAmministrare: true }), true);
  assert.equal(puoConfigurare({ ...diNessuno, chiChiede: REVISIONE }), false);
  /* Un utente spento non e' nessuno. */
  const spento = ELENCO.map((uno) => (uno.id === TITOLARE ? { ...uno, attivo: false } : uno));
  assert.equal(
    puoConfigurare({ ...nominato, utenti: spento, chiChiede: TITOLARE, puoAmministrare: true }),
    false,
  );
});

/* ─── Il ponte rifiuta ───────────────────────────────────────────────────── */

test("con la casella piena salva solo chi c'e' scritto", async () => {
  const casa = unaCasa({ admin: ["persona titolare"] });
  try {
    const titolare = await casa.commissioni.rispondi(casa.salva(), {
      chiChiede: TITOLARE,
      puoAmministrare: true,
    });
    assert.equal(titolare.success, true, JSON.stringify(titolare));
    assert.equal(titolare.result.status, "saved");

    for (const [chi, puoAmministrare] of [
      [ALTRO_ADMIN, true],
      [REVISIONE, false],
      [REVISIONE, true],
      ["", true],
    ]) {
      const prima = casa.configurazione.revisione("primary");
      const risposta = await casa.commissioni.rispondi(
        casa.salva({ cd_stanze: '[{"name":"Rubata"}]' }),
        { chiChiede: chi, puoAmministrare },
      );
      assert.equal(risposta.success, false, `${chi || "nessuno"} ${puoAmministrare}`);
      assert.equal(risposta.error.code, "unauthorized");
      assert.equal(casa.configurazione.revisione("primary"), prima, "non si e' scritto niente");
    }
  } finally {
    casa.via();
  }
});

test("ripristinare e azzerare sono scritture come le altre", async () => {
  const casa = unaCasa({ admin: ["Persona Titolare"] });
  try {
    const vecchia = casa.configurazione.revisione("primary");
    await casa.commissioni.rispondi(casa.salva(), { chiChiede: TITOLARE, puoAmministrare: true });
    const ripristino = { id: 8, type: "dashboardmodern/config/restore", revision: vecchia };
    const azzera = { ...casa.salva({}), id: 9, reset: true };
    for (const detto of [ripristino, azzera]) {
      const risposta = await casa.commissioni.rispondi(detto, {
        chiChiede: ALTRO_ADMIN,
        puoAmministrare: true,
      });
      assert.equal(risposta.error?.code, "unauthorized", detto.type);
    }
    const suo = await casa.commissioni.rispondi(ripristino, {
      chiChiede: TITOLARE,
      puoAmministrare: true,
    });
    assert.equal(suo.success, true);
  } finally {
    casa.via();
  }
});

test("chi non e' nominato non si toglie la restrizione scrivendola vuota", async () => {
  const casa = unaCasa({ admin: ["Persona Titolare"] });
  try {
    const risposta = await casa.commissioni.rispondi(
      casa.salva({ cd_branding: '{"title":"Casa","admin_users":[]}' }),
      { chiChiede: ALTRO_ADMIN, puoAmministrare: true },
    );
    assert.equal(risposta.error?.code, "unauthorized");
    /* Il titolare invece la puo' togliere, e da li' torna tutto come prima. */
    const tolta = await casa.commissioni.rispondi(
      casa.salva({ cd_branding: '{"title":"Casa","admin_users":[]}', cd_stanze: "[1]" }),
      { chiChiede: TITOLARE, puoAmministrare: true },
    );
    assert.equal(tolta.success, true);
    const dopo = await casa.commissioni.rispondi(casa.salva({ cd_stanze: "[2]" }), {
      chiChiede: ALTRO_ADMIN,
      puoAmministrare: true,
    });
    assert.equal(dopo.success, true);
  } finally {
    casa.via();
  }
});

test("con la casella vuota non cambia niente, e Home Assistant non si interroga", async () => {
  let domande = 0;
  const utenti = {
    async elenco() {
      domande += 1;
      return ELENCO;
    },
  };
  const casa = unaCasa({ admin: null, utenti });
  try {
    const admin = await casa.commissioni.rispondi(casa.salva(), {
      chiChiede: ALTRO_ADMIN,
      puoAmministrare: true,
    });
    assert.equal(admin.success, true);
    /* Chi non amministra Home Assistant resta fuori come sempre. */
    const ospite = await casa.commissioni.rispondi(casa.salva({ cd_stanze: "[3]" }), {
      chiChiede: REVISIONE,
      puoAmministrare: false,
    });
    assert.equal(ospite.error?.code, "unauthorized");
    assert.equal(domande, 0);
  } finally {
    casa.via();
  }
});

test("se Home Assistant non dice chi sono i suoi utenti, con la casella piena non si scrive", async () => {
  const casa = unaCasa({
    admin: ["Persona Titolare"],
    utenti: utentiDiCasa(new Error("Home Assistant non risponde")),
  });
  try {
    const risposta = await casa.commissioni.rispondi(casa.salva(), {
      chiChiede: TITOLARE,
      puoAmministrare: true,
    });
    assert.equal(risposta.error?.code, "unauthorized");
  } finally {
    casa.via();
  }
});

/* ─── Chi sono ───────────────────────────────────────────────────────────── */

test("auth/current_user lo risponde il ponte, con l'utente vero e la sua Config", async () => {
  const casa = unaCasa({ admin: ["Persona Titolare"] });
  try {
    const domanda = { id: 3, type: "auth/current_user" };
    assert.equal(eUnaCommissione(JSON.stringify(domanda)), true);
    assert.equal(casa.commissioni.riconosce(domanda), true);

    const suo = await casa.commissioni.rispondi(domanda, {
      chiChiede: TITOLARE,
      puoAmministrare: true,
    });
    assert.deepEqual(suo.result, {
      id: TITOLARE,
      name: "Persona Titolare",
      is_admin: true,
      gdahome_config: true,
    });
    const revisione = await casa.commissioni.rispondi(domanda, { chiChiede: REVISIONE });
    assert.deepEqual(revisione.result, {
      id: REVISIONE,
      name: "Revisione",
      is_admin: false,
      gdahome_config: false,
    });
    const nessuno = await casa.commissioni.rispondi(domanda, { puoAmministrare: true });
    assert.equal(nessuno.result.id, "");
    assert.equal(nessuno.result.gdahome_config, false);
  } finally {
    casa.via();
  }
});

test("dalla pagina in Home Assistant la domanda non arriva alla casa", async () => {
  const casa = unaCasa({ admin: ["Persona Titolare"] });
  try {
    const allaPagina = [];
    const allaCasa = [];
    const presa = { manda: (testo) => allaPagina.push(JSON.parse(testo)), chiudi() {} };
    const filo = {
      apriIlFilo: async () => ({
        manda: (testo) => allaCasa.push(JSON.parse(testo)) > 0,
        chiudi() {},
      }),
    };
    const cucitura = new Cucitura({
      presa,
      casa: filo,
      commissioni: casa.commissioni,
      registro: ZITTO,
      chiGuarda: ALTRO_ADMIN,
      utenti: utentiDiCasa(),
    });
    await cucitura.avvia();
    presa.onMessaggio(JSON.stringify({ id: 4, type: "auth/current_user" }));
    presa.onMessaggio(JSON.stringify(casa.salva()));
    await attendi(() => allaPagina.filter((uno) => uno.type === "result").length === 2);
    assert.deepEqual(allaCasa, []);
    const chi = allaPagina.find((uno) => uno.id === 4);
    assert.equal(chi.result.id, ALTRO_ADMIN);
    assert.equal(chi.result.is_admin, true);
    assert.equal(chi.result.gdahome_config, false);
    assert.equal(allaPagina.find((uno) => uno.id === 7).error.code, "unauthorized");
    cucitura.chiudi?.(1000, "fine");
  } finally {
    casa.via();
  }
});

test("dal telefono della revisione: l'utente e' il suo, e la Config non si salva", async () => {
  const casa = unaCasa({ admin: ["Persona Titolare"] });
  const cartella = mkdtempSync(join(tmpdir(), "ponte-config-admin-telefoni-"));
  const utenti = utentiDiCasa();
  const dispositivi = new Dispositivi({ cartella });
  const allaCasa = [];
  const filo = {
    apriIlFilo: async () => ({
      manda: (testo) => allaCasa.push(JSON.parse(testo)) > 0,
      chiudi() {},
    }),
  };
  const ponte = new Ponte({
    casa: filo,
    dispositivi,
    registro: ZITTO,
    commissioni: casa.commissioni,
    utenti,
  });
  const server = createServer((_r, risposta) => risposta.end());
  server.on("upgrade", (richiesta, socket) => {
    const presa = accetta(richiesta, socket, {});
    if (presa) ponte.accogli(presa, { da: "prova" });
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  try {
    for (const [utente, puo] of [
      [REVISIONE, false],
      [TITOLARE, true],
    ]) {
      const { segno } = dispositivi.abbina({ nome: "Telefono", utente });
      const telefono = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
      const detti = [];
      telefono.addEventListener("message", (evento) => detti.push(JSON.parse(evento.data)));
      await new Promise((ok) => telefono.addEventListener("open", ok));
      await attendi(() => detti.some((uno) => uno.type === "auth_required"));
      telefono.send(JSON.stringify({ type: "auth", access_token: segno }));
      await attendi(() => detti.some((uno) => uno.type === "auth_ok"));
      telefono.send(JSON.stringify({ id: 1, type: "auth/current_user" }));
      telefono.send(JSON.stringify(casa.salva({ cd_stanze: `["${utente}"]` })));
      await attendi(() => detti.some((uno) => uno.id === 1) && detti.some((uno) => uno.id === 7));
      const chi = detti.find((uno) => uno.id === 1).result;
      assert.equal(chi.id, utente, "non l'add-on: l'utente del telefono");
      assert.equal(chi.gdahome_config, puo);
      assert.equal(detti.find((uno) => uno.id === 7).success, puo);
      telefono.close();
    }
    assert.deepEqual(allaCasa, [], "a Home Assistant non e' arrivato niente");
  } finally {
    ponte.chiudiTutto();
    await new Promise((ok) => server.close(ok));
    rmSync(cartella, { recursive: true, force: true });
    casa.via();
  }
});

test("la dogana continua a fermare auth/current_user diretto a Home Assistant", () => {
  const { passa, rifiuti } = passaLaDogana(JSON.stringify({ id: 1, type: "auth/current_user" }), {
    amministra: true,
  });
  assert.deepEqual(passa, []);
  assert.equal(rifiuti[0].error.code, "unauthorized");
});

async function attendi(condizione, { entro = 3000 } = {}) {
  const fine = Date.now() + entro;
  while (!condizione()) {
    if (Date.now() > fine) throw new Error("non e' successo in tempo");
    await new Promise((ok) => setTimeout(ok, 10));
  }
}
