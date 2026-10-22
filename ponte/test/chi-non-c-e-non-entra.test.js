/* Le porte chiuse dopo la verifica di sicurezza.
 *
 * Una per prova, e ognuna e' una cosa che prima passava:
 *
 *  - la memoria di chi amministra non vale per sempre;
 *  - un utente tolto da Home Assistant non resta dentro;
 *  - la configurazione di una plancia riservata non si legge per nome;
 *  - una foto che e' un collegamento verso fuori non si serve;
 *  - una telecamera messa solo in una plancia riservata non si apre a chi
 *    quella plancia non la vede.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { UtentiDiCasa } from "../src/utenti.js";
import { Plance } from "../src/plance.js";
import { Configurazione } from "../src/configurazione.js";
import { Commissioni } from "../src/commissioni.js";
import { BASE_DI_CASA, Foto } from "../src/foto.js";
import { perche, perLaVia } from "../src/dogana.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };
const LEI = "a".repeat(32);
const LUI = "b".repeat(32);

function casaConUtenti(elenco) {
  const casa = {
    elenco,
    rotta: false,
    chieste: 0,
    async chiedi(comando) {
      if (comando?.type !== "config/auth/list") throw new Error("non so");
      casa.chieste += 1;
      if (casa.rotta) throw new Error("Home Assistant non risponde");
      return casa.elenco;
    },
  };
  return casa;
}

test("la memoria di chi amministra invecchia: oltre il limite non dice piu' di si'", async () => {
  let ora = 0;
  const casa = casaConUtenti([{ id: LEI, name: "x", group_ids: ["system-admin"] }]);
  const utenti = new UtentiDiCasa({
    casa,
    registro: ZITTO,
    adesso: () => ora,
    quantoVale: 1000,
    durataMassima: 10_000,
  });
  assert.equal(await utenti.amministratore(LEI), true);
  assert.equal(utenti.amministratoreSubito(LEI), true);

  /* Home Assistant smette di rispondere: per un po' vale l'elenco di prima. */
  casa.rotta = true;
  ora = 5000;
  assert.equal(await utenti.amministratore(LEI), true);
  assert.equal(utenti.amministratoreSubito(LEI), true);

  /* Oltre la durata massima, no: chi chiede sa che non si sa, e la memoria
   * non dice piu' di si'. */
  ora = 20_000;
  await assert.rejects(() => utenti.amministratore(LEI));
  assert.equal(utenti.amministratoreSubito(LEI), false);

  /* Torna Home Assistant, e torna tutto com'era. */
  casa.rotta = false;
  assert.equal(await utenti.amministratore(LEI), true);
  assert.equal(utenti.amministratoreSubito(LEI), true);
});

test("chi c'e' ed e' attivo e' vivo; chi e' stato tolto o spento no", async () => {
  const casa = casaConUtenti([
    { id: LEI, name: "x" },
    { id: LUI, name: "y", is_active: false },
  ]);
  const utenti = new UtentiDiCasa({ casa, registro: ZITTO });
  assert.equal(await utenti.eVivo(LEI), true);
  assert.equal(await utenti.eVivo(LUI), false);
  assert.equal(await utenti.eVivo("c".repeat(32)), false);
  assert.equal(await utenti.eVivo(""), false);
});

test("l'elenco si rinfresca da se', e chi ascolta lo viene a sapere", async () => {
  const casa = casaConUtenti([{ id: LEI, name: "x" }]);
  const utenti = new UtentiDiCasa({ casa, registro: ZITTO, quantoVale: 0 });
  const visti = [];
  const smetti = utenti.quandoCambia((elenco) => visti.push(elenco.map((uno) => uno.id)));
  utenti.tieniAggiornato({ ogni: 10 });
  try {
    await new Promise((ok) => setTimeout(ok, 60));
    assert.ok(casa.chieste >= 2, "l'ha chiesto senza che nessuno lo chiedesse");
    assert.deepEqual(visti[0], [LEI]);
  } finally {
    utenti.smetti();
    smetti();
  }
});

test("la configurazione di una plancia riservata a un altro non si legge per nome", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "riservata-"));
  try {
    const plance = new Plance({ cartella, registro: ZITTO });
    const sua = plance.aggiungi("Di lei");
    plance.chiLaVede(sua.profilo, [LEI]);
    const configurazione = new Configurazione({ cartella });
    configurazione.scrivi(sua.profilo, { cd_stanze: '[{"name":"Studio"}]' });
    const con = new Commissioni({ registro: ZITTO, plance, configurazione });

    const aLui = await con.rispondi(
      { id: 1, type: "dashboardmodern/config/get", profile: sua.profilo },
      { chiChiede: LUI, amministra: false },
    );
    assert.equal(aLui.success, false);
    assert.equal(aLui.error.code, "not_found");

    const revisioni = await con.rispondi(
      { id: 2, type: "ponte/config/revisioni", profili: [sua.profilo, "primary"] },
      { chiChiede: LUI, amministra: false },
    );
    assert.equal(revisioni.success, true);
    assert.equal(sua.profilo in revisioni.result.revisioni, false);
    assert.equal("primary" in revisioni.result.revisioni, true);

    /* A lei si', e la principale — che e' di tutti — a tutti e due. */
    const aLei = await con.rispondi(
      { id: 3, type: "dashboardmodern/config/get", profile: sua.profilo },
      { chiChiede: LEI, amministra: false },
    );
    assert.equal(aLei.success, true);
    assert.equal(aLei.result.snapshot.values.cd_stanze, '[{"name":"Studio"}]');
    const principale = await con.rispondi(
      { id: 4, type: "dashboardmodern/config/get" },
      { chiChiede: LUI, amministra: false },
    );
    assert.equal(principale.success, true);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("una foto che e' un collegamento verso fuori dalla cartella non si serve", () => {
  const dove = mkdtempSync(join(tmpdir(), "foto-fuori-"));
  try {
    const www = join(dove, "www");
    mkdirSync(www, { recursive: true });
    writeFileSync(join(dove, "secrets.yaml"), "password: segreta\n");
    writeFileSync(join(www, "vera.png"), Buffer.from("\x89PNG\r\n\x1a\n", "latin1"));
    symlinkSync(join(dove, "secrets.yaml"), join(www, "finta.png"));
    const foto = new Foto({ cartella: www, base: BASE_DI_CASA });
    assert.equal(foto.leggi(`${BASE_DI_CASA}/vera.png`).stato, 200);
    const finta = foto.leggi(`${BASE_DI_CASA}/finta.png`);
    assert.equal(finta.stato, 404);
    assert.equal(String(finta.corpo).includes("segreta"), false);
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }
});

test("una telecamera messa solo in una plancia riservata non si apre a chi non la vede", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "telecamere-"));
  try {
    const plance = new Plance({ cartella, registro: ZITTO });
    const sua = plance.aggiungi("Di lei");
    plance.chiLaVede(sua.profilo, [LEI]);
    const configurazione = new Configurazione({ cartella });
    configurazione.scrivi(sua.profilo, {
      cd_telecamere: '["camera.camera_da_letto","camera.ingresso"]',
    });
    configurazione.scrivi("primary", { cd_telecamere: '["camera.ingresso"]' });
    const scaricate = [];
    const con = new Commissioni({
      registro: ZITTO,
      plance,
      configurazione,
      casa: { indirizzo: "http://supervisor/core", segno: "s" },
      scarica: async ({ url }) => {
        scaricate.push(url);
        return { stato: 200, tipo: "image/jpeg", corpo: Buffer.from("x") };
      },
    });

    /* A lui resta chiusa solo quella che sta soltanto nella plancia di lei. */
    assert.deepEqual([...con.telecamereChiuse(LUI, false)], ["camera.camera_da_letto"]);
    assert.equal(con.telecamereChiuse(LEI, false).size, 0);
    /* Chi non si sa chi e' non vede la plancia riservata: le sue telecamere
     * gli restano chiuse come a lui (e senza utente non ne vede comunque
     * nessuna, `_vedeLeTelecamere`). */
    assert.deepEqual([...con.telecamereChiuse("", null)], ["camera.camera_da_letto"]);

    const chiuse = con.telecamereChiuse(LUI, false);
    const flusso = (entity_id) => ({ id: 1, type: "camera/stream", entity_id });
    assert.match(
      String(perche(flusso("camera.camera_da_letto"), { telecamereChiuse: chiuse })),
      /telecamera/,
    );
    assert.equal(perche(flusso("camera.ingresso"), { telecamereChiuse: chiuse }), null);
    assert.equal(
      perche(flusso("camera.camera_da_letto"), { amministra: true, telecamereChiuse: chiuse }),
      null,
      "chi amministra in Home Assistant le vede comunque",
    );
    const firma = {
      id: 2,
      type: "auth/sign_path",
      path: "/api/camera_proxy/camera.camera_da_letto",
    };
    assert.notEqual(perche(firma, { telecamereChiuse: chiuse }), null);
    /* Gli stati non si toccano: chiuderli spegnerebbe la plancia intera. */
    assert.equal(perche({ id: 3, type: "get_states" }, { telecamereChiuse: chiuse }), null);

    assert.notEqual(
      perLaVia({ percorso: "/api/camera_proxy/camera.camera_da_letto", telecamereChiuse: chiuse }),
      null,
    );
    assert.equal(
      perLaVia({ percorso: "/api/camera_proxy/camera.ingresso", telecamereChiuse: chiuse }),
      null,
    );

    /* E dalla strada REST del ponte, quella che usa la plancia nell'app. */
    const vietata = await con.rispondi(
      {
        id: 4,
        type: "ponte/http",
        metodo: "GET",
        percorso: "/api/camera_proxy/camera.camera_da_letto",
      },
      { chiChiede: LUI, amministra: false },
    );
    assert.equal(vietata.success, false);
    assert.equal(vietata.error.code, "unauthorized");
    assert.deepEqual(scaricate, [], "a Home Assistant non si e' chiesto niente");
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("se non si sa quali telecamere sono riservate, si chiudono tutte", () => {
  /* Dall'audit di sicurezza: un errore nel leggere le plance tornava «nessuna
   * chiusa», cioe' un permesso. Adesso «non lo so» chiude: l'elenco delle
   * plance che non si legge, o la configurazione di una plancia nascosta che
   * non si legge, chiudono tutte le telecamere a chi non amministra. */
  const cartella = mkdtempSync(join(tmpdir(), "telecamere-guaste-"));
  try {
    const plance = new Plance({ cartella, registro: ZITTO });
    const sua = plance.aggiungi("Di lei");
    plance.chiLaVede(sua.profilo, [LEI]);
    const configurazione = new Configurazione({ cartella });
    configurazione.scrivi(sua.profilo, { cd_telecamere: '["camera.camera_da_letto"]' });
    configurazione.scrivi("primary", { cd_telecamere: '["camera.ingresso"]' });
    const con = new Commissioni({ registro: ZITTO, plance, configurazione });
    const flusso = (entity_id) => ({ id: 1, type: "camera/stream", entity_id });

    /* L'elenco delle plance non si legge. */
    const elenco = plance.elenco.bind(plance);
    plance.elenco = () => {
      throw new Error("disco guasto");
    };
    const tutte = con.telecamereChiuse(LUI, false);
    assert.equal(tutte.has("camera.ingresso"), true);
    assert.equal(tutte.has("camera.qualunque"), true);
    assert.notEqual(perche(flusso("camera.ingresso"), { telecamereChiuse: tutte }), null);
    assert.notEqual(
      perLaVia({ percorso: "/api/camera_proxy/camera.ingresso", telecamereChiuse: tutte }),
      null,
    );
    plance.elenco = elenco;
    assert.deepEqual([...con.telecamereChiuse(LUI, false)], ["camera.camera_da_letto"]);

    /* La configurazione della plancia nascosta non si legge. */
    const leggi = configurazione.leggi.bind(configurazione);
    configurazione.leggi = (profilo) => {
      if (profilo === sua.profilo) throw new Error("file rovinato");
      return leggi(profilo);
    };
    /* Quello gia' calcolato con i dati buoni resta buono: qui si prova il
     * primo calcolo dopo il guasto. */
    con._chiuseDi = null;
    assert.equal(con.telecamereChiuse(LUI, false).has("camera.ingresso"), true);
    /* Lei la plancia la vede: per lei e' una plancia vista che non si legge,
     * e apre solo di meno. */
    con._chiuseDi = null;
    assert.equal(con.telecamereChiuse(LEI, false).has("camera.ingresso"), false);
    /* E l'errore non resta in memoria: tornata leggibile, si torna alla regola. */
    configurazione.leggi = leggi;
    assert.deepEqual([...con.telecamereChiuse(LUI, false)], ["camera.camera_da_letto"]);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});
