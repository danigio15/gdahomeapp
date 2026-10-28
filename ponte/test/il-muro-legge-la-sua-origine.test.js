/* Il pannello a muro e la sua origine, per chi non vede la plancia principale.
 *
 * «Il pc e' collegato come MarcoHouse e il 4 pollici come rustico: sul 4
 * pollici non vedo la plancia come la vedo sul pc.» La principale era
 * riservata e rustico non c'era: il ponte non gliene dava la configurazione,
 * giustamente, e il pannello restava coi posti vuoti.
 *
 * Adesso a chi vede il pannello il ponte da' l'origine — e si guarda che la
 * dia solo a chi e' entrato e vede il pannello, solo per un pannello vero, e
 * solo quello che il pannello mostra: niente configurazione della principale
 * e nessun codice dell'antifurto.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Commissioni } from "../src/commissioni.js";
import { Configurazione } from "../src/configurazione.js";
import { Plance } from "../src/plance.js";

const ZITTO = { info() {}, attenzione() {}, errore() {}, debug() {} };

const MARCO = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const RUSTICO = "0f9e8d7c6b5a49382716f5e4d3c2b1a0";
const ESTRANEO = "ffffffffffffffffffffffffffffffff";

const SCATTO = { keys_revision: 1, writer_generation: 1, updated_at: 0 };

function unaCasa() {
  const cartella = mkdtempSync(join(tmpdir(), "muro-origine-"));
  const configurazione = new Configurazione({ cartella, adesso: () => 5000 });
  const plance = new Plance({ cartella, registro: ZITTO, adesso: () => 1000 });
  const muro = plance.aggiungi("Plancia a muro");
  /* La principale solo per Marco; il pannello per Marco e rustico. */
  plance.chiLaVede("primary", [MARCO]);
  plance.chiLaVede(muro.profilo, [MARCO, RUSTICO]);
  configurazione.scrivi(
    "primary",
    {
      dm_dashboard_state: JSON.stringify({
        schema_version: 4,
        sections: {
          rooms: [{ id: "salotto", name: "Salotto" }],
          lights: [{ entity: "light.salotto", name: "Luce salotto", room: "salotto" }],
          covers: [{ entity: "cover.serranda_piccola", name: "Serranda Piccola", room: "salotto" }],
        },
      }),
      cd_antifurto_su_misura: JSON.stringify([
        { id: "notte", label: "Notte", entita: "script.notte", pin: "1234" },
        { id: "via", label: "Via", entita: "script.via" },
      ]),
      cd_avvisi_custom: "[]",
      cd_segreto_della_principale: "non deve uscire",
    },
    SCATTO,
  );
  configurazione.scrivi(
    muro.profilo,
    { cd_muro: JSON.stringify({ attiva: true, fonte: "primary", pagine: [] }) },
    SCATTO,
  );
  const commissioni = new Commissioni({ registro: ZITTO, configurazione });
  commissioni.plance = plance;
  return { cartella, commissioni, plance, configurazione, muro: muro.profilo };
}

const chiedi = (casa, chi, profilo = casa.muro) =>
  casa.commissioni.rispondi(
    { id: 1, type: "ponte/muro/fonte", profile: profilo },
    { chiChiede: chi },
  );

test("rustico vede il pannello: riceve l'origine, anche se la principale non la vede", async () => {
  const casa = unaCasa();
  try {
    /* Prima, la principale per nome: no, e resta no. */
    const principale = await casa.commissioni.rispondi(
      { id: 1, type: "dashboardmodern/config/get", profile: "primary" },
      { chiChiede: RUSTICO },
    );
    assert.equal(principale.error.code, "not_found");

    const detto = await chiedi(casa, RUSTICO);
    assert.equal(detto.success, true);
    const { fonte } = detto.result;
    assert.deepEqual(
      fonte.stanze.map((s) => s.name),
      ["Salotto"],
    );
    assert.deepEqual(
      fonte.luci.map((l) => l.entity),
      ["light.salotto"],
    );
    assert.deepEqual(
      fonte.tapparelle.map((t) => t.entity),
      ["cover.serranda_piccola"],
    );
  } finally {
    rmSync(casa.cartella, { recursive: true, force: true });
  }
});

test("esce solo quello che il pannello mostra: niente configurazione e nessun codice", async () => {
  const casa = unaCasa();
  try {
    const detto = await chiedi(casa, RUSTICO);
    const scritto = JSON.stringify(detto);
    assert.equal(scritto.includes("non deve uscire"), false);
    assert.equal(scritto.includes("dm_dashboard_state"), false);
    assert.equal(scritto.includes("snapshot"), false);
    /* Il tasto col codice non c'e' proprio: senza il codice partirebbe libero. */
    assert.equal(scritto.includes("1234"), false);
    assert.deepEqual(
      detto.result.fonte.antifurto.suMisura.map((m) => m.id),
      ["via"],
    );
  } finally {
    rmSync(casa.cartella, { recursive: true, force: true });
  }
});

test("senza un utente, o per chi non vede il pannello, non esce niente", async () => {
  const casa = unaCasa();
  try {
    assert.equal((await chiedi(casa, "")).error.code, "unauthorized");
    assert.equal((await chiedi(casa, ESTRANEO)).error.code, "not_found");
  } finally {
    rmSync(casa.cartella, { recursive: true, force: true });
  }
});

test("solo un pannello vero, che legge da un'altra plancia che c'e'", async () => {
  const casa = unaCasa();
  try {
    /* La principale non e' un pannello: chiederla cosi' non apre niente. */
    assert.equal((await chiedi(casa, MARCO, "primary")).error.code, "not_found");
    /* Una plancia che non c'e'. */
    assert.equal((await chiedi(casa, RUSTICO, "nessuna")).error.code, "not_found");
    /* Un pannello spento non legge. */
    casa.configurazione.scrivi(
      casa.muro,
      { cd_muro: JSON.stringify({ attiva: false, fonte: "primary", pagine: [] }) },
      { ...SCATTO, keys_revision: 2 },
    );
    assert.equal((await chiedi(casa, RUSTICO)).error.code, "not_found");
    /* E uno che punta a una plancia che non c'e' nemmeno. */
    casa.configurazione.scrivi(
      casa.muro,
      { cd_muro: JSON.stringify({ attiva: true, fonte: "inventata", pagine: [] }) },
      { ...SCATTO, keys_revision: 3 },
    );
    assert.equal((await chiedi(casa, RUSTICO)).error.code, "not_found");
  } finally {
    rmSync(casa.cartella, { recursive: true, force: true });
  }
});
