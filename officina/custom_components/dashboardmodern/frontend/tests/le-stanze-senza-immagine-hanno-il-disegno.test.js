/* «Perche' le altre stanze non esce l'immagine nei riquadri? Esce solo
 * l'ingresso.»
 *
 * Una stanza senza immagine prende il disegno che il suo nome dice
 * (`core/disegno-automatico-della-stanza.js`). Qui: la mappa dei nomi, l'icona
 * quando il nome tace, l'immagine propria che vince, l'interruttore, e il muro
 * che fa lo stesso. */
import assert from "node:assert/strict";
import test from "node:test";

import { disegnoDaRiquadro } from "../src/core/disegni-da-riquadro.js";
import {
  DISEGNI_AUTOMATICI,
  disegnoAutomaticoDellaStanza,
  immagineAccesa,
  immagineDellaStanza,
  statoDellImmagine,
} from "../src/core/disegno-automatico-della-stanza.js";
import { conLeImmaginiDiPrima } from "../src/core/dashboard-store.js";
import { normalizeSection } from "../src/core/migrations.js";
import { fonteDaiValori } from "../src/core/plancia-a-muro.js";

const disegno = (name, icon) => disegnoAutomaticoDellaStanza({ name, icon });

test("ogni disegno che le regole possono dare sta nel catalogo", () => {
  for (const chiave of DISEGNI_AUTOMATICI)
    assert.ok(disegnoDaRiquadro(chiave), `«${chiave}» non c'e' nel catalogo`);
});

test("le stanze di una casa vera: dal nome al disegno", () => {
  const attese = {
    Ingresso: "ingresso",
    Cucina: "stanza-cucina",
    Multimedia: "soggiorno",
    "Balcone cucina": "terrazzo",
    "Balcone media": "terrazzo",
    "Bagno piccolo": "bagno",
    "Camera letto": "camera-letto",
    Cameretta: "cameretta",
    Soggiorno: "soggiorno",
    Salotto: "soggiorno",
    "Sala TV": "soggiorno",
    "Sala da pranzo": "stanza-cucina",
    "Cucina soggiorno": "stanza-cucina",
    "Bagno camera": "bagno",
    "Camera ospiti": "camera-letto",
    "Camera dei bambini": "cameretta",
    "Sala giochi": "cameretta",
    Studio: "studio",
    Ufficio: "studio",
    Corridoio: "ingresso",
    Disimpegno: "ingresso",
    Terrazzo: "terrazzo",
    Veranda: "terrazzo",
    Giardino: "terrazzo",
    Garage: "garage",
    Autorimessa: "garage",
    Cantina: "cantina",
    Taverna: "cantina",
    Mansarda: "mansarda",
    Soffitta: "mansarda",
    Lavanderia: "lavatrice",
    Cinema: "cinema",
    "Home theater": "cinema",
    "Living room": "soggiorno",
    Kitchen: "stanza-cucina",
    Bathroom: "bagno",
    "Master bedroom": "camera-letto",
    "Kids room": "cameretta",
    Office: "studio",
    Hallway: "ingresso",
    Balcony: "terrazzo",
    "Camera da Letto": "camera-letto",
    CUCINA: "stanza-cucina",
    Città: "",
  };
  for (const [nome, atteso] of Object.entries(attese))
    assert.equal(disegno(nome), atteso, `«${nome}»`);
});

test("un nome che non si capisce resta senza disegno", () => {
  for (const nome of ["Zona Pippo", "Stanza 2", "", "   ", "X"]) assert.equal(disegno(nome), "");
  assert.equal(disegnoAutomaticoDellaStanza(null), "");
  assert.equal(disegnoAutomaticoDellaStanza({}), "");
});

test("quando il nome tace, parla l'icona; la casa generica no", () => {
  assert.equal(disegno("Zona Pippo", "mdi:bed"), "camera-letto");
  assert.equal(disegno("Zona Pippo", "mdi:sofa"), "soggiorno");
  assert.equal(disegno("Zona Pippo", "mdi:shower"), "bagno");
  assert.equal(disegno("Zona Pippo", "mdi:home"), "");
  /* Le parole dentro un'icona non bastano: `mdi:spotlight` non e' una pentola. */
  assert.equal(disegno("Zona Pippo", "mdi:spotlight"), "");
  /* Il nome viene prima dell'icona. */
  assert.equal(disegno("Bagno", "mdi:bed"), "bagno");
});

test("di partenza: accesa solo chi un'immagine se l'era scelta", () => {
  /* All'aggiornamento nessuno vede cambiare la sua Home. */
  assert.equal(immagineAccesa({ name: "Cucina" }), false);
  assert.equal(immagineDellaStanza({ name: "Cucina" }), null);
  assert.equal(statoDellImmagine({ name: "Cucina" }), "spenta");
  const ingresso = { name: "Ingresso", immagine: { src: "disegno:ingresso" } };
  assert.equal(immagineAccesa(ingresso), true);
  assert.equal(immagineDellaStanza(ingresso).src, "disegno:ingresso");
  assert.equal(statoDellImmagine(ingresso), "disegno");
  assert.equal(
    statoDellImmagine({ name: "Cucina", immagine: { src: "/local/cucina.jpg" } }),
    "foto",
  );
});

test("accesa senza immagine: il disegno del nome, col fuoco del catalogo", () => {
  const cucina = { name: "Cucina", mostraImmagine: true };
  const immagine = immagineDellaStanza(cucina);
  assert.equal(immagine.src, "disegno:stanza-cucina");
  assert.deepEqual(immagine.fuoco, disegnoDaRiquadro("stanza-cucina").fuoco);
  assert.equal(immagine.zoom, 1);
  assert.equal(statoDellImmagine(cucina), "automatico");
  /* Accesa, ma un nome che non si capisce: niente, e la riga lo dice. */
  const pippo = { name: "Zona Pippo", mostraImmagine: true };
  assert.equal(immagineDellaStanza(pippo), null);
  assert.equal(statoDellImmagine(pippo), "nessuna");
});

test("accesa con l'immagine a mano: vince lei; spenta: niente, ma resta salvata", () => {
  const propria = { src: "disegno:ingresso", fuoco: [40, 60], zoom: 1.2 };
  const accesa = { name: "Cucina", immagine: propria, mostraImmagine: true };
  assert.deepEqual(immagineDellaStanza(accesa), propria);
  const spenta = { ...accesa, mostraImmagine: false };
  assert.equal(immagineDellaStanza(spenta), null);
  assert.equal(statoDellImmagine(spenta), "spenta");
  assert.deepEqual(spenta.immagine, propria);
  /* Riaccesa, torna la sua — non il disegno del nome. */
  assert.deepEqual(immagineDellaStanza({ ...spenta, mostraImmagine: true }), propria);
});

test("solo un vero si' o no conta come interruttore", () => {
  assert.equal(immagineAccesa({ name: "Cucina", mostraImmagine: "si" }), false);
  assert.equal(immagineAccesa({ name: "Cucina", mostraImmagine: 1 }), false);
  assert.equal(immagineAccesa(null), false);
});

test("l'interruttore resta addosso alla stanza: normalizzazione e riscrittura", () => {
  const [accesa, spenta, mai, sporca] = normalizeSection("rooms", [
    { id: "a", name: "Cucina", mostraImmagine: true },
    { id: "b", name: "Bagno", mostraImmagine: false },
    { id: "c", name: "Camera" },
    { id: "d", name: "Studio", mostraImmagine: "si" },
  ]);
  assert.equal(accesa.mostraImmagine, true);
  assert.equal(spenta.mostraImmagine, false);
  assert.equal("mostraImmagine" in mai, false);
  assert.equal("mostraImmagine" in sporca, false);
  /* Un editor che riscrive la stanza senza conoscerlo non lo perde. */
  const riscritte = conLeImmaginiDiPrima(
    [
      { id: "a", name: "Cucina" },
      { id: "b", name: "Bagno", mostraImmagine: true },
    ],
    [accesa, spenta],
  );
  assert.equal(riscritte[0].mostraImmagine, true);
  assert.equal(riscritte[1].mostraImmagine, true);
});

test("il muro fa lo stesso: segue l'interruttore di ogni stanza", () => {
  const stato = {
    sections: {
      rooms: [
        { id: "cucina", name: "Cucina", temp: "sensor.t", mostraImmagine: true },
        { id: "bagno", name: "Bagno", temp: "sensor.t" },
        { id: "pippo", name: "Zona Pippo", temp: "sensor.t", mostraImmagine: true },
        {
          id: "ingresso",
          name: "Ingresso",
          temp: "sensor.t",
          immagine: { src: "disegno:portone" },
        },
        {
          id: "studio",
          name: "Studio",
          temp: "sensor.t",
          immagine: { src: "disegno:portone" },
          mostraImmagine: false,
        },
      ],
    },
  };
  const fonte = fonteDaiValori({ dm_dashboard_state: JSON.stringify(stato) });
  assert.deepEqual(Object.fromEntries(fonte.stanze.map((s) => [s.id, s.immagine?.src])), {
    cucina: "disegno:stanza-cucina",
    bagno: undefined,
    pippo: undefined,
    ingresso: "disegno:portone",
    studio: undefined,
  });
});
