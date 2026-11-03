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
  disegniDelleStanzeAccesi,
  disegnoAutomaticoDellaStanza,
  haIlDisegnoAutomatico,
  immagineDellaStanza,
} from "../src/core/disegno-automatico-della-stanza.js";
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

test("l'immagine scelta a mano vince sempre", () => {
  const propria = { src: "disegno:ingresso", fuoco: [40, 60], zoom: 1.2 };
  const stanza = { name: "Cucina", immagine: propria };
  assert.deepEqual(immagineDellaStanza(stanza), {
    src: "disegno:ingresso",
    fuoco: [40, 60],
    zoom: 1.2,
  });
  assert.deepEqual(immagineDellaStanza(stanza, false), immagineDellaStanza(stanza));
  assert.equal(haIlDisegnoAutomatico(stanza), false);
});

test("senza immagine: il disegno del nome, col fuoco del catalogo", () => {
  const immagine = immagineDellaStanza({ name: "Cucina" });
  assert.equal(immagine.src, "disegno:stanza-cucina");
  assert.deepEqual(immagine.fuoco, disegnoDaRiquadro("stanza-cucina").fuoco);
  assert.equal(immagine.zoom, 1);
  assert.equal(haIlDisegnoAutomatico({ name: "Cucina" }), true);
  assert.equal(immagineDellaStanza({ name: "Zona Pippo" }), null);
  assert.equal(haIlDisegnoAutomatico({ name: "Zona Pippo" }), false);
});

test("l'interruttore: acceso di serie, spento solo con false", () => {
  assert.equal(disegniDelleStanzeAccesi(undefined), true);
  assert.equal(disegniDelleStanzeAccesi({}), true);
  assert.equal(disegniDelleStanzeAccesi({ disegniDelleStanze: true }), true);
  assert.equal(disegniDelleStanzeAccesi({ disegniDelleStanze: "no" }), true);
  assert.equal(disegniDelleStanzeAccesi({ disegniDelleStanze: false }), false);
  assert.equal(immagineDellaStanza({ name: "Cucina" }, false), null);
  assert.equal(haIlDisegnoAutomatico({ name: "Cucina" }, false), false);
});

test("il muro fa lo stesso, e segue l'interruttore della Home", () => {
  const stato = {
    sections: {
      rooms: [
        { id: "cucina", name: "Cucina", temp: "sensor.t" },
        { id: "pippo", name: "Zona Pippo", temp: "sensor.t" },
        {
          id: "ingresso",
          name: "Ingresso",
          temp: "sensor.t",
          immagine: { src: "disegno:portone" },
        },
      ],
    },
  };
  const valori = (widgets) => ({
    dm_dashboard_state: JSON.stringify(stato),
    ...(widgets ? { cd_widgets: JSON.stringify(widgets) } : {}),
  });
  const acceso = Object.fromEntries(
    fonteDaiValori(valori()).stanze.map((s) => [s.id, s.immagine?.src]),
  );
  assert.deepEqual(acceso, {
    cucina: "disegno:stanza-cucina",
    pippo: undefined,
    ingresso: "disegno:portone",
  });
  const spento = Object.fromEntries(
    fonteDaiValori(valori({ disegniDelleStanze: false })).stanze.map((s) => [
      s.id,
      s.immagine?.src,
    ]),
  );
  assert.deepEqual(spento, { cucina: undefined, pippo: undefined, ingresso: "disegno:portone" });
});
