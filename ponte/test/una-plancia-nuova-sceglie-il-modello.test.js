/* Una plancia nuova sceglie il suo modello, e chi la vede.
 *
 * «Quando si sceglie di aggiungere altre plance si sceglie il modello, se la
 * classica o a muro, e cosi' si puo' scegliere anche l'utente che deve
 * vederla.» Una plancia a muro nasce gia' accesa, con le pagine riempite dalla
 * plancia principale: non si deve aprirne il config per vederla sul tablet. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Configurazione } from "../src/configurazione.js";
import { Plance, PremiumRichiesto } from "../src/plance.js";
import {
  aggiungiUnaPlancia,
  conIlModello,
  eAColpoDOcchio,
  eAMuro,
  modelloPulito,
  partenzaPulita,
} from "../src/plancia-nuova.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };

/* La plancia principale di una casa vera: due stanze, una luce, le azioni,
 * la centrale. Da qui la plancia a muro prende le sue pagine. */
const PRINCIPALE = {
  dm_dashboard_state: JSON.stringify({
    schema_version: 4,
    sections: {
      rooms: [
        { id: "soggiorno", name: "Soggiorno" },
        { id: "cucina", name: "Cucina" },
      ],
      lights: [
        {
          id: "l1",
          name: "Luci",
          entity: "light.soggiorno",
          room_id: "soggiorno",
          room: "Soggiorno",
        },
      ],
      cameras: [{ id: "k1", name: "Cancello", entity: "camera.cancello" }],
    },
  }),
  cd_quick_actions: JSON.stringify([
    { name: "Buongiorno", type: "scene", entity: "scene.buongiorno" },
    { name: "Esco", type: "script", entity: "script.esco" },
  ]),
  cd_entity_overrides: JSON.stringify({
    "dm.security_centrale_allarme": "alarm_control_panel.casa",
  }),
};

function banco({ limitata = false } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "plancia-nuova-"));
  const plance = new Plance({ cartella, registro: ZITTO, limitata: () => limitata });
  const configurazione = new Configurazione({ cartella });
  configurazione.scrivi("primary", PRINCIPALE, { updated_at: 1 });
  return { cartella, plance, configurazione, via: () => rmSync(cartella, { recursive: true }) };
}

test("il modello: classica o a muro, e quello che non si conosce e' la classica", () => {
  assert.equal(modelloPulito("muro"), "muro");
  assert.equal(modelloPulito("classica"), "classica");
  assert.equal(modelloPulito(""), "classica");
  assert.equal(modelloPulito("parete"), "classica");
});

test("una plancia a muro nasce accesa, con le pagine prese dalla principale", () => {
  const b = banco();
  try {
    const quale = aggiungiUnaPlancia(b, { titolo: "Tablet ingresso", modello: "muro" });
    assert.equal(quale.profilo, "tablet-ingresso");
    assert.equal(quale.a_muro, true);
    const muro = JSON.parse(b.configurazione.leggi("tablet-ingresso").snapshot.values.cd_muro);
    assert.equal(muro.attiva, true);
    assert.equal(muro.fonte, "primary");
    /* La prima stanza della casa, le scene (c'e' un'azione che lo e'), e
     * l'ingresso (c'e' la centrale). */
    assert.deepEqual(
      muro.pagine.map((p) => p.modello),
      ["stanza", "scene", "ingresso"],
    );
    assert.equal(muro.pagine[0].stanza, "Soggiorno");
    assert.equal(muro.pagine[2].ingresso.centrale, "alarm_control_panel.casa");
    /* La busta porta la revisione delle chiavi di oggi: la pagina non la
     * tratta come una configurazione da travasare. */
    assert.ok(b.configurazione.leggi("tablet-ingresso").snapshot.keys_revision > 0);
    /* E la principale non si tocca. */
    assert.equal(eAMuro(b.configurazione, "primary"), false);
  } finally {
    b.via();
  }
});

test("una plancia classica nasce vuota, come prima", () => {
  const b = banco();
  try {
    const quale = aggiungiUnaPlancia(b, { titolo: "Casa al mare" });
    assert.equal(quale.a_muro, false);
    assert.equal(b.configurazione.leggi("casa-al-mare").snapshot, null);
  } finally {
    b.via();
  }
});

test("chi la vede si sceglie insieme al nome", () => {
  const b = banco();
  try {
    const quale = aggiungiUnaPlancia(b, {
      titolo: "Cucina",
      modello: "muro",
      utenti: ["a1b2c3d4e5f60718293a4b5c6d7e8f90"],
    });
    assert.deepEqual(quale.utenti, ["a1b2c3d4e5f60718293a4b5c6d7e8f90"]);
    assert.deepEqual(b.plance.quale("cucina").utenti, ["a1b2c3d4e5f60718293a4b5c6d7e8f90"]);
    /* Nessuno spuntato vuol dire tutti, come sempre. */
    assert.deepEqual(aggiungiUnaPlancia(b, { titolo: "Ospiti", utenti: [] }).utenti, []);
  } finally {
    b.via();
  }
});

test("una principale vuota da' comunque una pagina, la stanza", () => {
  const cartella = mkdtempSync(join(tmpdir(), "plancia-nuova-"));
  try {
    const plance = new Plance({ cartella, registro: ZITTO });
    const configurazione = new Configurazione({ cartella });
    const quale = aggiungiUnaPlancia(
      { plance, configurazione },
      { titolo: "Muro", modello: "muro" },
    );
    const muro = JSON.parse(configurazione.leggi(quale.profilo).snapshot.values.cd_muro);
    assert.equal(muro.attiva, true);
    assert.deepEqual(
      muro.pagine.map((p) => p.modello),
      ["stanza"],
    );
  } finally {
    rmSync(cartella, { recursive: true });
  }
});

test("con Base la seconda plancia non nasce, ne' classica ne' a muro", () => {
  const b = banco({ limitata: true });
  try {
    assert.throws(
      () => aggiungiUnaPlancia(b, { titolo: "Muro", modello: "muro" }),
      PremiumRichiesto,
    );
    assert.equal(b.configurazione.leggi("muro").snapshot, null);
  } finally {
    b.via();
  }
});

test("l'elenco dice quali plance partono a muro", () => {
  const b = banco();
  try {
    aggiungiUnaPlancia(b, { titolo: "Tablet", modello: "muro" });
    const elenco = conIlModello(b.plance.elenco(), b.configurazione);
    assert.deepEqual(
      elenco.map((p) => [p.profilo, p.a_muro]),
      [
        ["primary", false],
        ["tablet", true],
      ],
    );
  } finally {
    b.via();
  }
});

test("il colpo d'occhio e' un modello che si conosce", () => {
  assert.equal(modelloPulito("occhio"), "occhio");
});

test("a colpo d'occhio dalla principale: telecamere e centrale vengono da li', il resto no", () => {
  const b = banco();
  try {
    const quale = aggiungiUnaPlancia(b, { titolo: "Occhio", modello: "occhio" });
    assert.equal(quale.a_occhio, true);
    assert.equal(quale.a_muro, false);
    const valori = b.configurazione.leggi("occhio").snapshot.values;
    /* Solo la sua chiave: della principale non si copia nient'altro. */
    assert.deepEqual(Object.keys(valori), ["cd_occhio"]);
    const occhio = JSON.parse(valori.cd_occhio);
    assert.equal(occhio.attiva, true);
    assert.deepEqual(
      occhio.telecamere.map((c) => c.entity),
      ["camera.cancello"],
    );
    assert.equal(occhio.antifurto.centrale, "alarm_control_panel.casa");
    assert.deepEqual(
      occhio.riquadri.map((r) => r.tipo),
      ["telecamere", "antifurto"],
    );
    /* E la principale non si tocca. */
    assert.equal(eAColpoDOcchio(b.configurazione, "primary"), false);
  } finally {
    b.via();
  }
});

test("a colpo d'occhio da zero: i quattro riquadri da riempire, niente dalla principale", () => {
  const b = banco();
  try {
    const quale = aggiungiUnaPlancia(b, { titolo: "Vuota", modello: "occhio", partenza: "zero" });
    assert.equal(quale.a_occhio, true);
    const occhio = JSON.parse(b.configurazione.leggi("vuota").snapshot.values.cd_occhio);
    assert.deepEqual(
      occhio.riquadri.map((r) => r.tipo),
      ["energia", "telecamere", "antifurto", "apri"],
    );
    assert.deepEqual(occhio.telecamere, []);
    assert.equal(occhio.antifurto.centrale, "");
  } finally {
    b.via();
  }
});

test("una partenza che non si conosce e' la principale", () => {
  assert.equal(partenzaPulita("zero"), "zero");
  assert.equal(partenzaPulita("principale"), "principale");
  assert.equal(partenzaPulita("altro"), "principale");
  assert.equal(partenzaPulita(undefined), "principale");
});

test("l'elenco dice quali plance partono a colpo d'occhio", () => {
  const b = banco();
  try {
    aggiungiUnaPlancia(b, { titolo: "Occhio", modello: "occhio" });
    const elenco = conIlModello(b.plance.elenco(), b.configurazione);
    assert.deepEqual(
      elenco.map((p) => [p.profilo, p.a_muro, p.a_occhio]),
      [
        ["primary", false, false],
        ["occhio", false, true],
      ],
    );
  } finally {
    b.via();
  }
});

/* «Casa 3D»: la plancia con la casa in tre dimensioni. La casa e' la stessa
 * della principale: se li' c'e' gia', la plancia nuova la ritrova accesa;
 * se non c'e', nasce spenta e la si crea dal suo Config. */
import { comprimiGriglia } from "../plancia/src/core/casa-3d.js";
import { eCasa3D } from "../src/plancia-nuova.js";

test("la Casa 3D e' un modello che si conosce", () => {
  assert.equal(modelloPulito("casa3d"), "casa3d");
});

/* Sceglierla e trovarsi la classica non va: senza una casa nella
 * principale nasce accesa e vuota, e la plancia invita a crearla. */
test("con la Casa 3D senza una casa nella principale: nasce Casa 3D, da creare", () => {
  const b = banco();
  try {
    const quale = aggiungiUnaPlancia(b, { titolo: "Casa", modello: "casa3d" });
    assert.equal(quale.a_casa3d, true);
    const casa = JSON.parse(b.configurazione.leggi("casa").snapshot.values.cd_casa3d);
    assert.equal(casa.attiva, true);
    assert.deepEqual(casa.piani, []);
  } finally {
    b.via();
  }
});

test("con la Casa 3D e una casa nella principale: la ritrova, accesa", () => {
  const b = banco();
  try {
    const griglia = comprimiGriglia(new Int16Array(16).fill(1));
    const principale = b.configurazione.leggi("primary").snapshot.values;
    b.configurazione.scrivi(
      "primary",
      {
        ...principale,
        cd_casa3d: JSON.stringify({
          attiva: false,
          piani: [{ k: "terra", W: 4, H: 4, griglia, stanze: [{ id: 1, nome: "Salone" }] }],
        }),
      },
      { updated_at: 2 },
    );
    const quale = aggiungiUnaPlancia(b, { titolo: "Tre D", modello: "casa3d" });
    assert.equal(quale.a_casa3d, true);
    assert.equal(eCasa3D(b.configurazione, "primary"), false);
    const casa = JSON.parse(b.configurazione.leggi("tre-d").snapshot.values.cd_casa3d);
    assert.deepEqual(
      casa.piani[0].stanze.map((s) => s.nome),
      ["Salone"],
    );
  } finally {
    b.via();
  }
});
