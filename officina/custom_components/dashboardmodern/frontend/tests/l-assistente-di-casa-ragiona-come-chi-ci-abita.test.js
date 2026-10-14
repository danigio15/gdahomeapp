/* L'assistente di casa ragiona come chi ci abita (#175).
 *
 * «Lo voglio molto molto intelligente.» Il motore delle regole sta tutto in
 * `core/assistente-di-casa.js`, ed e' puro: qui si tiene fermo quello che
 * dice e quando lo dice — i rilevatori uno per uno, l'ordine, una cosa un
 * suggerimento, e quello che impara dagli ✕, dai «Più tardi» e dai «Fatto».
 *
 * Le situazioni sono quelle che la casa vive davvero: la casa vuota con le
 * luci accese, la notte con la porta aperta, la pioggia con la finestra
 * aperta, il sole che avanza con la lavatrice pronta.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  CATEGORIE,
  CHIAVE_ASSISTENTE,
  TIPI_DI_SUGGERIMENTO,
  chiEInCasa,
  conIFiniti,
  conLaRisposta,
  finoA,
  memoriaDopo,
  memoriaPulita,
  opzioniDellAssistente,
  pesoDelTipo,
  pioggiaFra,
  soleCheAvanza,
  suggerimentiDellaCasa,
} from "../src/core/assistente-di-casa.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";

const MINUTO = 60_000;
const ORA = 60 * MINUTO;
const GIORNO = 24 * ORA;

/* Un giorno qualunque, all'ora che serve: l'ora del contesto e l'istante
 * stanno insieme come li mette insieme chi chiama. */
function alle(ora, minuti = 0) {
  return new Date(2026, 9, 14, ora, minuti, 0).getTime();
}

function casa(ora, resto = {}) {
  const adesso = alle(ora);
  return {
    adesso,
    ora,
    persone: { totale: 2, inCasa: 2, ultimaUscita: 0 },
    luci: [],
    clima: [],
    media: [],
    finestre: [],
    porte: [],
    serrature: [],
    garage: [],
    tende: [],
    meteo: { pioggiaFra: null, soleNelleProssimeOre: false },
    elettrodomestici: [],
    finiti: [],
    energia: {},
    auto: [],
    antifurto: null,
    batterie: [],
    nonRispondono: [],
    aggiornamenti: [],
    rifiuti: [],
    eventi: [],
    allagamenti: [],
    valvole: [],
    fumo: [],
    stanze: [],
    frigo: [],
    stanzeOccupate: [],
    ciSonoPresenze: false,
    ...resto,
  };
}

const vuota = (da = 2 * ORA, adesso = alle(14)) => ({
  totale: 2,
  inCasa: 0,
  ultimaUscita: adesso - da,
});

const tipi = (elenco) => elenco.map((s) => s.tipo);

test("le scelte: di serie tutto acceso, la notte alle 23, normale", () => {
  assert.deepEqual(opzioniDellAssistente(undefined), {
    categorie: Object.fromEntries(CATEGORIE.map((c) => [c, true])),
    notteDalle: 23,
    sensibilita: "normale",
  });
  const scelte = opzioniDellAssistente({
    categorie: { comfort: false, inventata: false },
    notteDalle: 21,
    sensibilita: "poco",
  });
  assert.equal(scelte.categorie.comfort, false);
  assert.equal(scelte.categorie.sicurezza, true);
  assert.equal("inventata" in scelte.categorie, false);
  assert.equal(scelte.notteDalle, 21);
  assert.equal(scelte.sensibilita, "poco");
  /* Fuori dalla forchetta si torna di serie. */
  assert.equal(opzioniDellAssistente({ notteDalle: 3 }).notteDalle, 23);
  assert.equal(opzioniDellAssistente({ sensibilita: "urla" }).sensibilita, "normale");
  /* Le scelte e quello che ha imparato sono della casa. */
  assert.ok(CONFIG_KEYS.includes(CHIAVE_ASSISTENTE));
  assert.ok(TIPI_DI_SUGGERIMENTO.length >= 20, "almeno venti cose da guardare");
});

test("casa vuota con le luci accese: le spegne, e dice da quando", () => {
  const adesso = alle(14);
  const [primo] = suggerimentiDellaCasa(
    casa(14, {
      persone: vuota(2 * ORA, adesso),
      luci: [
        { entity: "light.cucina", name: "Cucina", stanza: "Cucina", on: true },
        { entity: "light.sala", name: "Sala", stanza: "Sala", on: true },
        { entity: "light.bagno", name: "Bagno", on: false },
      ],
    }),
    {},
    {},
    "it",
  );
  assert.equal(primo.tipo, "vuota-luci");
  assert.equal(primo.urgenza, "oggi");
  assert.equal(primo.titolo, "Non c'è nessuno in casa, ma 2 luci sono accese");
  assert.equal(primo.motivo, "Casa vuota da 2 h: le spengo?");
  assert.deepEqual(primo.azioni[0].servizio, {
    dominio: "light",
    servizio: "turn_off",
    dati: { entity_id: ["light.cucina", "light.sala"] },
  });
  assert.equal(primo.id, "vuota-luci:light.cucina,light.sala");
  /* In inglese, la stessa frase dal catalogo di partenza. */
  const [inglese] = suggerimentiDellaCasa(
    casa(14, {
      persone: vuota(2 * ORA, adesso),
      luci: [{ entity: "light.cucina", name: "Cucina", on: true }],
    }),
    {},
    {},
    "en",
  );
  assert.equal(inglese.titolo, "Nobody is home, but Cucina is on");
});

test("una casa senza persone configurate non e' una casa vuota", () => {
  const fuori = suggerimentiDellaCasa(
    casa(14, {
      persone: { totale: 0, inCasa: 0 },
      luci: [{ entity: "light.cucina", name: "Cucina", on: true }],
    }),
  );
  assert.equal(fuori.length, 0);
});

test("chi e' in una zona «Casa», o sulla rete di casa, e' in casa; con qualcuno sconosciuto la casa non e' vuota", () => {
  /* Una zona fatta per la casa, accanto a quella di serie, e una persona di
   * cui non si sa niente ma collegata alla stessa rete Wi-Fi. */
  assert.deepEqual(
    chiEInCasa([
      { presence: "zone", zone: "Casa", known: true, wifi: "retedicasa" },
      { presence: "away", known: false, wifi: "retedicasa" },
    ]),
    { totale: 2, inCasa: 2, incerte: 0, fuori: [] },
  );
  /* Una zona che si chiama «Ufficio» resta fuori; chi non si sa dov'e' e'
   * incerto, e allora la casa non e' vuota. */
  const { inCasa, incerte } = chiEInCasa([
    { presence: "zone", zone: "Ufficio", known: true },
    { presence: "away", known: false },
  ]);
  assert.deepEqual([inCasa, incerte], [0, 1]);
  const niente = suggerimentiDellaCasa(
    casa(14, {
      persone: { totale: 2, inCasa: 0, incerte: 1, ultimaUscita: 0 },
      luci: [{ entity: "light.cucina", name: "Cucina", on: true }],
    }),
  );
  assert.equal(
    niente.filter((s) => s.tipo.startsWith("vuota")).length,
    0,
    "con qualcuno che non si sa dov'e' non si dice «non c'e' nessuno»",
  );
});

test("la casa vuota: clima, musica, antifurto, finestre", () => {
  const adesso = alle(15);
  const fuori = suggerimentiDellaCasa(
    casa(15, {
      persone: vuota(ORA, adesso),
      clima: [{ entity: "climate.sala", name: "Sala", on: true, mode: "heat" }],
      media: [{ entity: "media_player.tv", name: "TV" }],
      antifurto: { entity: "alarm_control_panel.casa", inserito: false, serveIlCodice: false },
      finestre: [{ entity: "binary_sensor.finestra_bagno", name: "Finestra bagno" }],
    }),
    {},
    {},
    "it",
  );
  assert.deepEqual(tipi(fuori).sort(), [
    "vuota-antifurto",
    "vuota-aperture",
    "vuota-clima",
    "vuota-media",
  ]);
  const antifurto = fuori.find((s) => s.tipo === "vuota-antifurto");
  assert.deepEqual(antifurto.azioni[0].servizio, {
    dominio: "alarm_control_panel",
    servizio: "alarm_arm_away",
    dati: { entity_id: "alarm_control_panel.casa" },
  });
  /* Con il codice non si inserisce alla cieca: si va alla pagina. */
  const conCodice = suggerimentiDellaCasa(
    casa(15, {
      persone: vuota(ORA, adesso),
      antifurto: { entity: "alarm_control_panel.casa", inserito: false, serveIlCodice: true },
    }),
  );
  assert.deepEqual(conCodice[0].azioni[0].vai, { pagina: "security", tessera: "sicurezza" });
});

test("di notte la porta non chiusa a chiave; con la casa vuota e' urgente", () => {
  const serrature = [{ entity: "lock.ingresso", name: "Porta d'ingresso", aperta: true }];
  /* Alle 23 e mezza, con la famiglia a casa. */
  const [notte] = suggerimentiDellaCasa(casa(23, { serrature }), {}, {}, "it");
  assert.equal(notte.tipo, "serrature");
  assert.equal(notte.urgenza, "oggi");
  assert.equal(notte.titolo, "È notte e Porta d'ingresso non è chiusa a chiave");
  assert.deepEqual(notte.azioni[0].servizio, {
    dominio: "lock",
    servizio: "lock",
    dati: { entity_id: "lock.ingresso" },
  });
  /* Di giorno, con qualcuno in casa, una porta aperta non e' un problema. */
  assert.equal(suggerimentiDellaCasa(casa(11, { serrature })).length, 0);
  /* La notte comincia quando la si e' detta. */
  assert.equal(suggerimentiDellaCasa(casa(21, { serrature }), {}, { notteDalle: 21 }).length, 1);
  /* Con la casa vuota, a qualunque ora, e' la prima cosa. */
  const adesso = alle(11);
  const [vuotaFuori] = suggerimentiDellaCasa(casa(11, { serrature, persone: vuota(ORA, adesso) }));
  assert.equal(vuotaFuori.urgenza, "urgente");
  /* Una serratura che non e' un `lock` non si chiude da qui: si va a vedere. */
  const [portone] = suggerimentiDellaCasa(
    casa(23, { serrature: [{ entity: "binary_sensor.portone", name: "Portone", aperta: true }] }),
  );
  assert.deepEqual(portone.azioni[0].vai, { pagina: "", tessera: "porte" });
});

test("il garage aperto di notte si chiude", () => {
  const [g] = suggerimentiDellaCasa(
    casa(23, { garage: [{ entity: "cover.garage", name: "Garage", aperto: true }] }),
  );
  assert.equal(g.tipo, "garage");
  assert.deepEqual(g.azioni[0].servizio, {
    dominio: "cover",
    servizio: "close_cover",
    dati: { entity_id: "cover.garage" },
  });
});

test("la finestra aperta col riscaldamento acceso nella stessa stanza", () => {
  const [s] = suggerimentiDellaCasa(
    casa(10, {
      clima: [
        { entity: "climate.studio", name: "Termosifone", stanza: "Studio", on: true, mode: "heat" },
      ],
      finestre: [{ entity: "binary_sensor.f_studio", name: "Finestra studio", stanza: "studio" }],
    }),
    {},
    {},
    "it",
  );
  assert.equal(s.tipo, "finestra-clima");
  assert.equal(s.titolo, "Studio: finestra aperta e riscaldamento acceso");
  assert.deepEqual(s.azioni[0].servizio, {
    dominio: "climate",
    servizio: "turn_off",
    dati: { entity_id: "climate.studio" },
  });
  /* In un'altra stanza non c'entra. */
  assert.equal(
    suggerimentiDellaCasa(
      casa(10, {
        clima: [{ entity: "climate.studio", name: "T", stanza: "Studio", on: true, mode: "heat" }],
        finestre: [{ entity: "binary_sensor.f", name: "F", stanza: "Cucina" }],
      }),
    ).length,
    0,
  );
});

test("la pioggia in arrivo: dalle previsioni ora per ora", () => {
  const adesso = alle(16);
  const previsioni = [
    {
      datetime: new Date(adesso + ORA).toISOString(),
      condition: "cloudy",
      precipitation_probability: 20,
    },
    {
      datetime: new Date(adesso + 2 * ORA).toISOString(),
      condition: "rainy",
      precipitation_probability: 80,
    },
  ];
  assert.equal(pioggiaFra(previsioni, adesso, "cloudy"), 120);
  assert.equal(pioggiaFra(previsioni, adesso, "rainy"), 0, "piove adesso");
  assert.equal(
    pioggiaFra(
      [
        {
          datetime: new Date(adesso + 30 * MINUTO).toISOString(),
          condition: "cloudy",
          precipitation_probability: 70,
        },
      ],
      adesso,
    ),
    30,
    "la probabilita' alta vale quanto la condizione",
  );
  assert.equal(
    pioggiaFra(
      [{ datetime: new Date(adesso + 5 * ORA).toISOString(), condition: "rainy" }],
      adesso,
    ),
    null,
    "oltre tre ore non si dice",
  );
  assert.equal(pioggiaFra(null, adesso), null);
});

test("pioggia fra mezz'ora con la finestra aperta e la tenda fuori", () => {
  const fuori = suggerimentiDellaCasa(
    casa(16, {
      meteo: { pioggiaFra: 25 },
      finestre: [{ entity: "binary_sensor.f_camera", name: "Finestra camera" }],
      tende: [{ entity: "cover.tenda", name: "Tenda terrazzo", aperta: true }],
    }),
    {},
    {},
    "it",
  );
  const finestra = fuori.find((s) => s.entita.includes("binary_sensor.f_camera"));
  assert.equal(finestra.urgenza, "urgente");
  assert.equal(finestra.titolo, "Pioggia fra 25 min e Finestra camera è aperta");
  const tenda = fuori.find((s) => s.entita.includes("cover.tenda"));
  assert.deepEqual(tenda.azioni[0].servizio, {
    dominio: "cover",
    servizio: "close_cover",
    dati: { entity_id: "cover.tenda" },
  });
  /* Fra un'ora e mezza e' una cosa di oggi, non urgente. */
  const [poi] = suggerimentiDellaCasa(
    casa(16, { meteo: { pioggiaFra: 90 }, finestre: [{ entity: "binary_sensor.f", name: "F" }] }),
  );
  assert.equal(poi.urgenza, "oggi");
});

test("di notte le luci dove non c'e' nessuno", () => {
  const luci = [
    { entity: "light.sala", name: "Sala", stanza: "Sala", on: true, daMs: 3 * ORA },
    { entity: "light.camera", name: "Camera", stanza: "Camera", on: true, daMs: 10 * MINUTO },
  ];
  /* Con i sensori di presenza: la camera e' occupata, la sala no. */
  const [conPresenze] = suggerimentiDellaCasa(
    casa(23, { luci, ciSonoPresenze: true, stanzeOccupate: ["Camera"] }),
  );
  assert.equal(conPresenze.tipo, "notte-luci");
  assert.deepEqual(conPresenze.entita, ["light.sala"]);
  /* Senza, solo quelle accese da piu' di un'ora. */
  const [senza] = suggerimentiDellaCasa(casa(23, { luci }));
  assert.deepEqual(senza.entita, ["light.sala"]);
  /* Di pomeriggio non si dice. */
  assert.equal(suggerimentiDellaCasa(casa(15, { luci })).length, 0);
});

test("il bucato finito: si ricorda chi lavorava, e chi smette ha finito", () => {
  const adesso = alle(11);
  let memoria = conIFiniti({}, [{ id: "lavatrice", mode: "running" }], adesso - 2 * ORA);
  assert.deepEqual(memoria.lavatrice, { lavora: true, finitoIl: 0 });
  memoria = conIFiniti(memoria, [{ id: "lavatrice", mode: "standby" }], adesso - ORA);
  assert.deepEqual(memoria.lavatrice, { lavora: false, finitoIl: adesso - ORA });
  /* Il giro dopo, ancora ferma: ha finito sempre a quell'ora. */
  memoria = conIFiniti(memoria, [{ id: "lavatrice", mode: "off" }], adesso);
  assert.equal(memoria.lavatrice.finitoIl, adesso - ORA);
  /* Riparte: non ha piu' finito. */
  assert.equal(
    conIFiniti(memoria, [{ id: "lavatrice", mode: "running" }], adesso).lavatrice.finitoIl,
    0,
  );
  /* Una macchina vista per la prima volta ferma non ha finito niente. */
  assert.equal(
    conIFiniti({}, [{ id: "lavastoviglie", mode: "off" }], adesso).lavastoviglie.finitoIl,
    0,
  );

  const [bucato] = suggerimentiDellaCasa(
    casa(11, {
      finiti: [
        {
          id: "lavatrice",
          entity: "sensor.lavatrice",
          name: "Lavatrice",
          tipo: "lavatrice",
          finitoIl: adesso - ORA,
        },
      ],
    }),
    {},
    {},
    "it",
  );
  assert.equal(bucato.titolo, "Stendi il bucato");
  assert.equal(bucato.motivo, "Lavatrice ha finito 1 h fa.");
  assert.equal(bucato.urgenza, "oggi");
  assert.equal(bucato.azioni[0].fatto, true);
});

test("il sole che avanza: la lavatrice da avviare e l'auto da caricare", () => {
  assert.equal(soleCheAvanza({ solare: 4200, casa: 900 }), 3300);
  assert.equal(soleCheAvanza({ rete: -2500 }), 2500);
  assert.equal(soleCheAvanza({ solare: 500, casa: 900 }), 0);
  const avvia = {
    dominio: "button",
    servizio: "press",
    dati: { entity_id: "button.lavatrice_avvia" },
  };
  const fuori = suggerimentiDellaCasa(
    casa(10, {
      energia: { solare: 4200, casa: 900, rete: -3300 },
      meteo: { soleNelleProssimeOre: true },
      elettrodomestici: [
        {
          id: "lav",
          entity: "sensor.lav",
          name: "Lavatrice",
          mode: "off",
          tipo: "lavatrice",
          avvia,
        },
        { id: "forno", entity: "sensor.forno", name: "Forno", mode: "off", tipo: "forno", avvia },
        {
          id: "lsv",
          entity: "sensor.lsv",
          name: "Lavastoviglie",
          mode: "off",
          tipo: "lavastoviglie",
          avvia: null,
        },
      ],
      auto: [{ nome: "Auto", attaccata: true, kw: 0, percentuale: 40, target: 80 }],
    }),
    {},
    {},
    "it",
  );
  const lavatrice = fuori.find((s) => s.tipo === "sole-elettrodomestico");
  assert.equal(lavatrice.titolo, "Avvia Lavatrice col sole");
  assert.match(lavatrice.motivo, /^Avanzano 3,3 kW e il sole tiene anche nelle prossime ore\.$/);
  assert.deepEqual(lavatrice.azioni[0].servizio, avvia);
  /* Il forno non si avvia col sole, la lavastoviglie senza comando nemmeno. */
  assert.equal(fuori.filter((s) => s.tipo === "sole-elettrodomestico").length, 1);
  const auto = fuori.find((s) => s.tipo === "sole-auto");
  assert.equal(auto.titolo, "Carica Auto col sole");
  /* La sera il sole non avanza piu'. */
  assert.equal(
    suggerimentiDellaCasa(
      casa(20, {
        energia: { solare: 4200, casa: 900 },
        elettrodomestici: [{ id: "l", name: "L", mode: "off", tipo: "lavatrice", avvia }],
      }),
    ).length,
    0,
  );
});

test("la rete che tira troppo, i rifiuti, l'appuntamento", () => {
  const [rete] = suggerimentiDellaCasa(
    casa(19, {
      energia: { rete: 3100, soglia: 3000 },
      elettrodomestici: [{ id: "f", name: "Forno", mode: "running" }],
    }),
    {},
    {},
    "it",
  );
  assert.equal(rete.tipo, "rete-alta");
  assert.equal(rete.urgenza, "urgente");
  assert.equal(rete.motivo, "Sei vicino alla soglia: Forno si può rimandare?");

  const rifiuti = { rifiuti: [{ name: "Plastica", quando: "domani" }] };
  assert.equal(suggerimentiDellaCasa(casa(15, rifiuti)).length, 0, "il pomeriggio e' presto");
  const [sera] = suggerimentiDellaCasa(casa(20, rifiuti), {}, {}, "it");
  assert.equal(sera.titolo, "Porta fuori: Plastica");

  const adesso = alle(9);
  const [evento] = suggerimentiDellaCasa(
    casa(9, { eventi: [{ summary: "Dentista", inizio: adesso + 25 * MINUTO }] }),
    {},
    {},
    "it",
  );
  assert.equal(evento.titolo, "Dentista fra 25 min");
  assert.equal(evento.urgenza, "oggi");
  /* Un evento passato e' scaduto e non si dice. */
  assert.equal(
    suggerimentiDellaCasa(casa(9, { eventi: [{ summary: "Ieri", inizio: adesso - ORA }] })).length,
    0,
  );
});

test("l'acqua, il fumo e l'antifurto che suona vengono prima di tutto", () => {
  const fuori = suggerimentiDellaCasa(
    casa(23, {
      serrature: [{ entity: "lock.ingresso", name: "Ingresso", aperta: true }],
      batterie: [{ entity: "sensor.b", name: "Sensore", level: 8 }],
      allagamenti: [{ entity: "binary_sensor.acqua_bagno", name: "Bagno", on: true }],
      valvole: [
        {
          entity: "valve.acqua",
          name: "Acqua",
          aperta: true,
          chiudi: { dominio: "valve", servizio: "close_valve", dati: { entity_id: "valve.acqua" } },
        },
      ],
    }),
    {},
    {},
    "it",
  );
  assert.deepEqual(tipi(fuori), ["acqua", "serrature", "batterie"]);
  assert.equal(fuori[0].azioni[0].etichetta, "Chiudi l'acqua");
  assert.equal(fuori[0].azioni[0].servizio.servizio, "close_valve");
});

test("comfort, aria, manutenzione", () => {
  const fuori = suggerimentiDellaCasa(
    casa(10, {
      stanze: [
        { name: "Camera", entity: "sensor.t_camera", temperatura: 15.5 },
        { name: "Studio", co2: 1450, entityCo2: "sensor.co2_studio" },
        { name: "Bagno", umidita: 78 },
      ],
      nonRispondono: [
        { name: "Sensore cantina", entity: "sensor.cantina", da: alle(10) - 3 * ORA },
      ],
      aggiornamenti: [{ entity: "update.a" }, { entity: "update.b" }],
    }),
    {},
    { sensibilita: "tutto" },
    "it",
  );
  const per = (tipo) => fuori.filter((s) => s.tipo === tipo).map((s) => s.titolo);
  assert.deepEqual(per("comfort"), ["Camera è fredda: 15,5°"]);
  assert.deepEqual(per("aria").sort(), ["Bagno: umidità al 78%", "Studio: aria pesante"]);
  assert.deepEqual(per("non-rispondono"), ["Sensore cantina non risponde"]);
  assert.deepEqual(per("aggiornamenti"), ["Ci sono 2 aggiornamenti da installare"]);
});

test("l'ordine: prima l'urgente, poi l'oggi, poi le idee", () => {
  const adesso = alle(16);
  const fuori = suggerimentiDellaCasa(
    casa(16, {
      persone: vuota(ORA, adesso),
      luci: [{ entity: "light.sala", name: "Sala", on: true }],
      aggiornamenti: [{ entity: "update.a" }],
      fumo: [{ entity: "binary_sensor.fumo", name: "Cucina", on: true }],
    }),
  );
  assert.deepEqual(
    fuori.map((s) => s.urgenza),
    ["urgente", "oggi", "idea"],
  );
  assert.ok(fuori.every((s, i) => i === 0 || fuori[i - 1].punti >= s.punti));
});

test("una cosa, un suggerimento: vince il piu' importante", () => {
  const adesso = alle(23);
  /* La finestra aperta con la casa vuota e con la pioggia in arrivo: si dice
   * una volta sola, ed e' la pioggia, che e' urgente. */
  const fuori = suggerimentiDellaCasa(
    casa(23, {
      persone: vuota(ORA, adesso),
      meteo: { pioggiaFra: 10 },
      finestre: [{ entity: "binary_sensor.f", name: "Finestra" }],
    }),
  );
  assert.deepEqual(tipi(fuori), ["pioggia"]);
});

test("le categorie spente tacciono, e «poco» toglie le idee", () => {
  const situazione = casa(8, {
    aggiornamenti: [{ entity: "update.a" }],
    rifiuti: [{ name: "Carta", quando: "oggi" }],
  });
  assert.deepEqual(tipi(suggerimentiDellaCasa(situazione)).sort(), ["aggiornamenti", "rifiuti"]);
  assert.deepEqual(
    tipi(suggerimentiDellaCasa(situazione, {}, { categorie: { promemoria: false } })),
    ["aggiornamenti"],
  );
  assert.deepEqual(tipi(suggerimentiDellaCasa(situazione, {}, { sensibilita: "poco" })), [
    "rifiuti",
  ]);
});

test("✕ nasconde per un po' e pesa sul tipo; tante ✕ e il tipo tace", () => {
  const adesso = alle(10);
  const situazione = casa(10, { aggiornamenti: [{ entity: "update.a" }] });
  const [s] = suggerimentiDellaCasa(situazione);
  let memoria = conLaRisposta({}, s, "no", adesso);
  assert.equal(memoria.tipi.aggiornamenti.no, 1);
  assert.equal(memoria.istanze[s.id].fino, adesso + 4 * ORA);
  assert.equal(suggerimentiDellaCasa(situazione, memoria).length, 0, "nascosto per quattro ore");
  /* Dopo quattro ore torna, ma pesa meno. */
  const dopo = { ...situazione, adesso: adesso + 5 * ORA };
  const [ancora] = suggerimentiDellaCasa(dopo, memoria);
  assert.ok(ancora.peso < 1);
  /* Scartato tre volte di fila: il tipo smette di farsi vedere. */
  memoria = conLaRisposta(memoria, s, "no", adesso + 5 * ORA);
  memoria = conLaRisposta(memoria, s, "no", adesso + 10 * ORA);
  const tardi = { ...situazione, adesso: adesso + 15 * ORA };
  assert.ok(pesoDelTipo(memoria, "aggiornamenti", tardi.adesso) < 0.3);
  assert.equal(suggerimentiDellaCasa(tardi, memoria).length, 0);
  /* «Proprio tutto» lo fa vedere lo stesso. */
  assert.equal(suggerimentiDellaCasa(tardi, memoria, { sensibilita: "tutto" }).length, 1);
  /* E col tempo la casa dimentica: dopo due mesi pesa di nuovo quasi pieno. */
  assert.ok(pesoDelTipo(memoria, "aggiornamenti", adesso + 60 * GIORNO) > 0.85);
  /* Usarlo lo rialza. */
  const usato = conLaRisposta(memoria, s, "si", tardi.adesso);
  assert.ok(
    pesoDelTipo(usato, "aggiornamenti", tardi.adesso) >
      pesoDelTipo(memoria, "aggiornamenti", tardi.adesso),
  );
});

test("l'urgente non si impara a tacerlo: ✕ lo toglie solo per un quarto d'ora", () => {
  const adesso = alle(10);
  const situazione = casa(10, {
    fumo: [{ entity: "binary_sensor.fumo", name: "Cucina", on: true }],
  });
  const [s] = suggerimentiDellaCasa(situazione);
  const memoria = conLaRisposta({}, s, "no", adesso);
  assert.equal(memoria.tipi.fumo, undefined, "nessun peso sul tipo");
  assert.equal(suggerimentiDellaCasa(situazione, memoria).length, 0);
  assert.equal(
    suggerimentiDellaCasa({ ...situazione, adesso: adesso + 16 * MINUTO }, memoria).length,
    1,
  );
  /* E «Più tardi» non lo rimanda a domani. */
  const rimandato = conLaRisposta({}, s, "tardi", adesso, finoA("domani", adesso));
  assert.equal(rimandato.istanze[s.id].fino, adesso + 15 * MINUTO);
});

test("«Più tardi»: fra un'ora, stasera, domani", () => {
  const mattina = alle(10);
  assert.equal(finoA("ora", mattina), mattina + ORA);
  assert.equal(finoA("stasera", mattina), alle(19));
  /* Alle sette meno un quarto «stasera» e' gia' adesso: fra un'ora. */
  assert.equal(finoA("stasera", alle(18, 45)), alle(18, 45) + ORA);
  assert.equal(finoA("domani", mattina), new Date(2026, 9, 15, 8, 0, 0).getTime());

  const situazione = casa(10, { aggiornamenti: [{ entity: "update.a" }] });
  const [s] = suggerimentiDellaCasa(situazione);
  const memoria = conLaRisposta({}, s, "tardi", mattina, finoA("stasera", mattina));
  assert.equal(memoria.tipi.aggiornamenti, undefined, "rimandare non e' scartare");
  assert.equal(suggerimentiDellaCasa(situazione, memoria).length, 0);
  assert.equal(suggerimentiDellaCasa({ ...situazione, adesso: alle(19, 1) }, memoria).length, 1);
});

test("«Fatto» lo toglie finche' la cosa non si ripresenta", () => {
  const adesso = alle(11);
  const finiti = [
    {
      id: "lav",
      entity: "sensor.lav",
      name: "Lavatrice",
      tipo: "lavatrice",
      finitoIl: adesso - ORA,
    },
  ];
  const situazione = casa(11, { finiti });
  const [s] = suggerimentiDellaCasa(situazione);
  let memoria = conLaRisposta({}, s, "fatto", adesso);
  assert.equal(memoria.tipi.finito.si, 1);
  assert.equal(suggerimentiDellaCasa(situazione, memoria).length, 0);
  /* Finche' c'e', la memoria lo tiene. */
  memoria = memoriaDopo(memoria, [s.id], adesso + MINUTO);
  assert.equal(memoria.istanze[s.id].fatto, true);
  /* La lavatrice riparte: il suggerimento sparisce, e la memoria lo lascia. */
  memoria = memoriaDopo(memoria, [], adesso + ORA);
  assert.equal(memoria.istanze[s.id], undefined);
  /* Il prossimo bucato si dice di nuovo. */
  assert.equal(suggerimentiDellaCasa(situazione, memoria).length, 1);
});

test("la memoria si tiene pulita e non cresce per sempre", () => {
  const adesso = alle(10);
  assert.deepEqual(memoriaPulita(null), { tipi: {}, istanze: {} });
  assert.deepEqual(
    memoriaPulita({ tipi: { inventato: { no: 3 } }, istanze: { x: { fino: 0, fatto: false } } }),
    { tipi: {}, istanze: {} },
  );
  const tante = { istanze: {} };
  for (let i = 0; i < 100; i += 1) tante.istanze[`aggiornamenti:${i}`] = { fino: adesso + ORA };
  assert.equal(Object.keys(memoriaPulita(tante).istanze).length, 60);
  /* Un rinvio scaduto se ne va. */
  const scaduto = memoriaDopo({ istanze: { a: { fino: adesso - 1 } } }, ["a"], adesso);
  assert.deepEqual(scaduto.istanze, {});
  /* Un id senza nome non si ricorda. */
  assert.deepEqual(conLaRisposta({}, { tipo: "aggiornamenti" }, "no", adesso), {
    tipi: {},
    istanze: {},
  });
});

test("un rilevatore che cade non porta giu' gli altri", () => {
  const fuori = suggerimentiDellaCasa(
    casa(10, {
      luci: "non un elenco",
      clima: [null, { entity: "climate.x", on: true, stanza: "Sala" }],
      finestre: [{ entity: "binary_sensor.f", name: "F", stanza: "Sala" }],
      aggiornamenti: [{ entity: "update.a" }],
    }),
  );
  assert.ok(tipi(fuori).includes("aggiornamenti"));
  assert.ok(tipi(fuori).includes("finestra-clima"));
});
