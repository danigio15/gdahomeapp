/* «Lo devi aggiungere a tutti la possibilita' di inserire immagini o
 * disegni, altrimenti e' inutile.»
 *
 * Il guardiano dei riquadri con l'immagine a muro. Per ogni tipo di posto che
 * il config sa scrivere (`TIPI_DI_COMANDO`), per ogni dominio che un posto
 * «Entita' o azione» puo' prendere, e per le voci della regia (i comandi, i
 * canali del mixer, la telecamera):
 * - l'immagine passa la pulizia e il salvataggio (`comandoPulito`,
 *   `muroPulito`) e non si perde per strada;
 * - il tablet la disegna davvero, coi comandi di quel tipo sopra — i due
 *   tasti, ▲ ■ ▼, il meno e il piu' del clima, la luminosita' — e lo stato
 *   giusto: «76 %» per una batteria, non «Acceso»;
 * - l'editor offre il blocco «Immagine» (`siVedeLImmagine`), e la sua
 *   anteprima dice quello che dira' il tablet (`facciaDelPosto`).
 * Un tipo nuovo che arriva senza immagine fa cadere questa prova. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  TIPI_DI_COMANDO,
  comandoPulito,
  muroPulito,
  tipoDellEntita,
} from "../src/core/plancia-a-muro.js";
import { normalizeDevice } from "../src/core/device-model.js";
import { migrateRooms } from "../src/core/migrations.js";
import { anteprimaDellaPagina, facciaDelPosto } from "../src/sections/plancia-a-muro-section.js";
import { siVedeLImmagine } from "../src/sections/plancia-a-muro-editor-section.js";

const IMMAGINE = Object.freeze({ src: "disegno:albero", fuoco: [50, 50], zoom: 1 });

const STATI = {
  "light.tavolo": {
    state: "on",
    attributes: { friendly_name: "Tavolo", brightness: 128, supported_color_modes: ["brightness"] },
  },
  "switch.presa": { state: "off", attributes: { friendly_name: "Presa" } },
  "sensor.casa_battery_soc": {
    state: "76",
    attributes: { friendly_name: "Batteria", unit_of_measurement: "%", device_class: "battery" },
  },
  "sensor.meteo_testo": { state: "Sereno", attributes: { friendly_name: "Cielo" } },
  "binary_sensor.porta": {
    state: "on",
    attributes: { friendly_name: "Porta", device_class: "door" },
  },
  "climate.soggiorno": {
    state: "cool",
    attributes: {
      friendly_name: "Condizionatore",
      temperature: 24,
      current_temperature: 26.5,
      hvac_modes: ["off", "cool", "heat"],
      hvac_action: "cooling",
    },
  },
  "climate.termostato": {
    state: "heat_cool",
    attributes: {
      friendly_name: "Termostato",
      target_temp_low: 20,
      target_temp_high: 26,
      current_temperature: 22,
      hvac_modes: ["off", "heat_cool"],
      supported_features: 2,
    },
  },
  "cover.soggiorno": {
    state: "open",
    attributes: {
      friendly_name: "Serranda soggiorno",
      current_position: 40,
      supported_features: 15,
    },
  },
  "cover.cancello": {
    state: "closed",
    attributes: { friendly_name: "Cancello", device_class: "gate", supported_features: 3 },
  },
  "media_player.sala": { state: "playing", attributes: { friendly_name: "Sala" } },
  "scene.cena": { state: "scening", attributes: { friendly_name: "Cena" } },
  "script.accendi_caminetto": { state: "off", attributes: { friendly_name: "Accendi caminetto" } },
  "script.spegni_caminetto": { state: "off", attributes: { friendly_name: "Spegni caminetto" } },
  "automation.notte": { state: "on", attributes: { friendly_name: "Notte" } },
  "button.campanello": { state: "unknown", attributes: { friendly_name: "Campanello" } },
  "lock.porta": { state: "locked", attributes: { friendly_name: "Porta" } },
  "fan.bagno": { state: "on", attributes: { friendly_name: "Ventola" } },
  "input_boolean.ospiti": { state: "off", attributes: { friendly_name: "Ospiti" } },
  "vacuum.robot": { state: "docked", attributes: { friendly_name: "Robot" } },
  "camera.cancello": { state: "idle", attributes: { friendly_name: "Cancello" } },
  "media_player.mixer": { state: "on", attributes: { friendly_name: "Mixer", volume_level: 0.4 } },
  "number.zoom": { state: "1", attributes: { min: 1, max: 4 } },
};
globalThis.__HASS__ = {
  states: Object.fromEntries(Object.entries(STATI).map(([id, s]) => [id, { entity_id: id, ...s }])),
};

const FONTE = Object.freeze({
  luci: [{ entity: "light.tavolo", name: "Tavolo", immagine: IMMAGINE }],
  clima: [{ entity: "climate.soggiorno", tipo: "clima", immagine: IMMAGINE }],
  tapparelle: [{ entity: "cover.soggiorno", immagine: IMMAGINE }],
  telecamere: [{ entity: "camera.cancello", name: "Cancello", immagine: IMMAGINE }],
  stanze: [],
  azioni: [{ name: "Buonanotte", entity: "script.buonanotte", type: "script" }],
});

/* Un posto «Entita' o azione» per ogni dominio che il config propone, piu'
 * i due tasti e l'azione: ognuno col suo tipo, come lo scrive il config. */
const ENTITA_DEI_POSTI = [
  "light.tavolo",
  "switch.presa",
  "sensor.casa_battery_soc",
  "sensor.meteo_testo",
  "binary_sensor.porta",
  "climate.soggiorno",
  "climate.termostato",
  "cover.soggiorno",
  "cover.cancello",
  "media_player.sala",
  "scene.cena",
  "script.accendi_caminetto",
  "automation.notte",
  "button.campanello",
  "lock.porta",
  "fan.bagno",
  "input_boolean.ospiti",
  "vacuum.robot",
];
const POSTI = [
  ...ENTITA_DEI_POSTI.map((entita) => ({ tipo: tipoDellEntita(entita), entita })),
  {
    tipo: "duetasti",
    nome: "Camino",
    entita: "script.accendi_caminetto",
    entitaOff: "script.spegni_caminetto",
  },
  { tipo: "azione", azione: "Buonanotte" },
];

const conImmagine = (posto) => ({ ...posto, immagine: IMMAGINE });
const pagina = (comandi) =>
  muroPulito({ pagine: [{ modello: "personale", scelti: true, griglia: 24, comandi }] });
/* I riquadri con l'immagine di un pezzo di pagina: il loro tag d'apertura. */
const riquadri = (html) => html.match(/<(div|button)[^>]*class="dm-rq [^"]*"[^>]*>/g) || [];

test("ogni tipo di posto e' coperto da questa prova", () => {
  const coperti = new Set([...POSTI.map((p) => comandoPulito(p)?.tipo), "vuoto"]);
  for (const tipo of TIPI_DI_COMANDO)
    assert.ok(coperti.has(tipo), `il tipo «${tipo}» non ha un posto qui: aggiungilo`);
});

test("l'immagine passa la pulizia e il salvataggio per ogni tipo di posto", () => {
  for (const posto of POSTI) {
    const pulito = comandoPulito(conImmagine(posto));
    assert.deepEqual(pulito.immagine, IMMAGINE, `${posto.tipo} ${posto.entita || posto.azione}`);
    /* Senza immagine, niente chiave. */
    assert.equal("immagine" in comandoPulito(posto), false);
  }
  const muro = pagina(POSTI.map(conImmagine));
  muro.pagine[0].comandi.forEach((c, k) =>
    assert.deepEqual(c.immagine, IMMAGINE, `posto ${k + 1}: ${c.tipo}`),
  );
  /* Nelle scene, anche il riquadro dei due tasti che diventa tessera. */
  const scene = muroPulito({
    pagine: [{ modello: "scene", scene: POSTI.map(conImmagine) }],
  });
  scene.pagine[0].scene.forEach((c) => assert.deepEqual(c.immagine, IMMAGINE, c.tipo));
  /* Un salvataggio riletto e' lo stesso salvataggio. */
  assert.deepEqual(muroPulito(JSON.parse(JSON.stringify(muro))), muro);
});

test("le voci della regia tengono la loro immagine: comandi, canali, telecamera", () => {
  const muro = muroPulito({
    pagine: [
      {
        modello: "comandi",
        pulsanti: [{ nome: "Avvio", avvio: "script.accendi_caminetto", immagine: IMMAGINE }],
      },
      {
        modello: "mixer",
        mixer: {
          gruppi: [
            { nome: "Sala", canali: [{ entita: "media_player.mixer", immagine: IMMAGINE }] },
          ],
          master: { entita: "media_player.sala", immagine: IMMAGINE },
        },
      },
      { modello: "telecamera", telecamera: { entita: "camera.cancello", immagine: IMMAGINE } },
    ],
  });
  assert.deepEqual(muro.pagine[0].pulsanti[0].immagine, IMMAGINE);
  assert.deepEqual(muro.pagine[1].mixer.gruppi[0].canali[0].immagine, IMMAGINE);
  assert.deepEqual(muro.pagine[1].mixer.master.immagine, IMMAGINE);
  assert.deepEqual(muro.pagine[2].telecamera.immagine, IMMAGINE);
});

test("le cose della plancia di origine tengono la loro immagine (luci, clima, stanze…)", () => {
  const [stanza] = migrateRooms([{ id: "s", name: "Sala", immagine: { src: "disegno:prato" } }]);
  assert.equal(stanza.immagine.src, "disegno:prato");
  assert.equal(
    "immagine" in migrateRooms([{ name: "Sala", immagine: { src: "/x.png" } }])[0],
    false,
  );
  for (const sezione of ["lights", "climate", "covers", "cameras", "appliances"]) {
    const d = normalizeDevice(
      { entity: "light.tavolo", name: "Tavolo", immagine: { src: "disegno:prato" } },
      sezione,
    );
    assert.equal(d.immagine?.src, "disegno:prato", sezione);
    const senza = normalizeDevice(
      { entity: "light.tavolo", immagine: { src: "https://x.y/a.png" } },
      sezione,
    );
    assert.equal("immagine" in senza, false, sezione);
  }
});

test("a muro ogni posto con l'immagine e' un riquadro con l'immagine, coi suoi comandi", () => {
  const muro = pagina(POSTI.map(conImmagine));
  const html = anteprimaDellaPagina(muro, 0, FONTE);
  const trovati = riquadri(html);
  assert.equal(trovati.length, POSTI.length, "un riquadro con l'immagine per ogni posto");
  /* La batteria dice il suo numero, non «Acceso». */
  assert.match(html, /data-mu-entita="sensor\.casa_battery_soc"[^>]*>[\s\S]*?<span>76 %<\/span>/);
  assert.match(
    html,
    /class="dm-rq [^"]*dm-rq-lettura[^"]*"[^>]*data-mu-entita="sensor\.casa_battery_soc"/,
  );
  /* I due tasti: ON e OFF, ognuno col suo script. */
  assert.match(
    html,
    /class="dm-rq-dt dm-rq-dt-on[^"]*" data-mu-fa="duetasti" data-mu-verso="on" data-mu-entita="script\.accendi_caminetto"/,
  );
  assert.match(
    html,
    /class="dm-rq-dt dm-rq-dt-off[^"]*" data-mu-fa="duetasti" data-mu-verso="off" data-mu-entita="script\.spegni_caminetto"/,
  );
  /* La tapparella: ▲ ■ ▼. Il cancello: il suo tasto. */
  for (const fa of ["su", "ferma", "giu"])
    assert.match(html, new RegExp(`data-mu-fa="${fa}" data-mu-entita="cover\\.soggiorno"`));
  assert.match(html, /class="dm-rq-tasto" data-mu-fa="su" data-mu-entita="cover\.cancello"/);
  /* Il clima: il meno, il piu', l'accensione, il modo, i gradi voluti. */
  for (const fa of ["meno", "piu", "clima-acceso", "modo"])
    assert.match(html, new RegExp(`data-mu-fa="${fa}"[^>]*data-mu-entita="climate\\.soggiorno"`));
  assert.match(html, /<b>24°<\/b>/);
  /* Il termostato a coppia: le due righe, ognuna col suo estremo. */
  for (const estremo of ["basso", "alto"])
    assert.match(
      html,
      new RegExp(
        `data-mu-fa="piu" data-mu-estremo="${estremo}" data-mu-entita="climate\\.termostato"`,
      ),
    );
  /* La luce: l'interruttore e la barra della luminosita'. */
  assert.match(html, /data-mu-fa="interruttore" data-mu-entita="light\.tavolo"/);
  assert.match(html, /data-mu-cursore="luce" data-mu-entita="light\.tavolo"/);
});

test("l'editor offre l'immagine a ogni posto pieno, e l'anteprima parla come il tablet", () => {
  for (const posto of POSTI) {
    const c = comandoPulito(posto);
    assert.equal(siVedeLImmagine(c), true, c.tipo);
    assert.ok(facciaDelPosto(c, { fonte: FONTE }), `${c.tipo}: nessuna faccia`);
  }
  assert.equal(siVedeLImmagine({ tipo: "vuoto" }), false);
  const batteria = facciaDelPosto(
    comandoPulito({ tipo: "entita", entita: "sensor.casa_battery_soc" }),
    {
      fonte: FONTE,
    },
  );
  assert.equal(batteria.stato, "76 %");
  assert.match(batteria.classi, /dm-rq-lettura/);
  const camino = facciaDelPosto(comandoPulito(POSTI.find((p) => p.tipo === "duetasti")), {
    fonte: FONTE,
  });
  assert.match(camino.destra, /data-mu-verso="on"[\s\S]*data-mu-verso="off"/);
  assert.doesNotMatch(camino.stato, /Acces/);
});

test("le pagine che si riempiono da sole e la regia mostrano l'immagine", () => {
  const muro = muroPulito({
    pagine: [
      { modello: "luci" },
      { modello: "tapparelle" },
      { modello: "clima", zona: "freddo" },
      { modello: "telecamere" },
      {
        modello: "comandi",
        pulsanti: [
          { nome: "Avvio", avvio: "script.accendi_caminetto", immagine: IMMAGINE },
          {
            nome: "Sala",
            avvio: "script.accendi_caminetto",
            stop: "script.spegni_caminetto",
            immagine: IMMAGINE,
          },
        ],
      },
      {
        modello: "mixer",
        mixer: {
          gruppi: [
            { nome: "Sala", canali: [{ entita: "media_player.mixer", immagine: IMMAGINE }] },
          ],
          master: { entita: "media_player.sala", immagine: IMMAGINE },
        },
      },
      { modello: "telecamera", telecamera: { entita: "camera.cancello", immagine: IMMAGINE } },
    ],
  });
  assert.equal(riquadri(anteprimaDellaPagina(muro, 0, FONTE)).length, 1, "luci");
  assert.equal(riquadri(anteprimaDellaPagina(muro, 1, FONTE)).length, 1, "tapparelle");
  assert.equal(riquadri(anteprimaDellaPagina(muro, 2, FONTE)).length, 1, "clima");
  assert.match(
    anteprimaDellaPagina(muro, 3, FONTE),
    /class="mu-video dm-rq-fondo"><img class="dm-rq-img"/,
  );
  const regia = anteprimaDellaPagina(muro, 4, FONTE);
  assert.match(
    regia,
    /<button type="button" class="dm-rq [^"]*mu-reg-tasto[^"]*"[^>]*data-mu-fa="pulsante"/,
  );
  assert.match(
    regia,
    /class="mu-carta mu-reg-coppia[^"]* dm-rq-fondo"[^>]*><img class="dm-rq-img"/,
  );
  const mixer = anteprimaDellaPagina(muro, 5, FONTE);
  assert.match(
    mixer,
    /class="mu-canale[^"]* dm-rq-fondo" data-mu-canale="media_player\.mixer"><img/,
  );
  assert.match(mixer, /mu-mix-master[^"]* dm-rq-fondo"/);
  assert.match(
    anteprimaDellaPagina(muro, 6, FONTE),
    /class="mu-video dm-rq-fondo"><img class="dm-rq-img"/,
  );
});
