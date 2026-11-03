/* Il programma del clima: ogni fascia con la sua temperatura.
 *
 * Dal campo: «quando apri qui ti scegli gli orari delle fasce e le
 * temperature». Il cronotermostato aveva due temperature sole; il programma
 * da' a ogni fascia la sua, feriali e festivi, e i cronotermostati salvati
 * prima restano identici. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  cronoDecide,
  cronoProssimo,
  cronoPulito,
  cronoVoluto,
  giornataDelProgramma,
  gradiAlle,
  programmaPulito,
} from "../src/core/automazioni.js";
import { dallaHomeAssistant, inHomeAssistant } from "../src/core/automazioni-ha.js";
import {
  bozzaDaTenere,
  bozzaDalCrono,
  fasciaNuova,
  firmaDelProgramma,
  programmaDelTermostato,
  programmiDelTermostato,
} from "../src/sections/programma-del-clima-section.js";

/* Lunedi' 2 novembre 2026 e sabato 7, ore locali. */
const lun = (h, m = 0) => new Date(2026, 10, 2, h, m).getTime();
const sab = (h, m = 0) => new Date(2026, 10, 7, h, m).getTime();

const PROGRAMMA = {
  feriali: [
    { da: 390, a: 510, gradi: 21 },
    { da: 510, a: 1020, gradi: 18 },
    { da: 1020, a: 1350, gradi: 20.5 },
  ],
  festivi: [{ da: 480, a: 1380, gradi: 20 }],
};
const crono = () => cronoPulito({ termostati: ["climate.sala"], programma: PROGRAMMA, fuori: 17 });

test("ogni fascia vale i suoi gradi, fuori dalle fasce vale fuori", () => {
  const c = crono();
  assert.equal(gradiAlle(c, lun(7)), 21);
  assert.equal(gradiAlle(c, lun(12)), 18);
  assert.equal(gradiAlle(c, lun(19)), 20.5);
  assert.equal(gradiAlle(c, lun(23)), 17);
  assert.equal(gradiAlle(c, lun(3)), 17);
  /* Il sabato si legge la giornata festiva. */
  assert.equal(gradiAlle(c, sab(7)), 17);
  assert.equal(gradiAlle(c, sab(10)), 20);
  /* Le fasce in fila dicono anche quando si e' «in fascia». */
  assert.deepEqual(c.feriali, [[390, 1350]]);
});

test("la finestra aperta spegne anche col programma", () => {
  const c = cronoPulito({ ...crono(), finestre: ["binary_sensor.finestra_sala"] });
  const stati = { "binary_sensor.finestra_sala": { state: "on" } };
  assert.equal(cronoVoluto(c, { adesso: lun(7), stati }), "spento");
  assert.equal(cronoVoluto(c, { adesso: lun(7), stati: {} }), 21);
  /* E si comanda al passaggio, non a ogni giro. */
  const { comandi } = cronoDecide(c, {
    adesso: lun(12),
    traccia: { voluto: { "climate.sala": 18 } },
  });
  assert.deepEqual(comandi, []);
});

test("il prossimo cambio salta i confini che non cambiano i gradi", () => {
  const c = crono();
  assert.deepEqual(cronoProssimo(c, lun(7)), { alle: lun(8, 30), voluto: 18 });
  assert.deepEqual(cronoProssimo(c, lun(12)), { alle: lun(17), voluto: 20.5 });
  assert.deepEqual(cronoProssimo(c, lun(22)), { alle: lun(22, 30), voluto: 17 });
  /* Il venerdi' sera il prossimo e' il sabato alle 8, coi gradi festivi. */
  const ven = new Date(2026, 10, 6, 23).getTime();
  assert.deepEqual(cronoProssimo(c, ven), { alle: sab(8), voluto: 20 });
  /* Una fascia a 17° con fuori a 17°: la sua fine non e' un cambio. */
  const piatto = cronoPulito({
    termostati: ["climate.sala"],
    fuori: 17,
    programma: {
      feriali: [
        { da: 0, a: 360, gradi: 17 },
        { da: 360, a: 480, gradi: 21 },
      ],
      festivi: [],
    },
  });
  assert.deepEqual(cronoProssimo(piatto, lun(1)), { alle: lun(6), voluto: 21 });
});

test("le fasce si ripuliscono: mezz'ore, in ordine, niente sovrapposizioni", () => {
  assert.deepEqual(
    giornataDelProgramma([
      { da: 1020, a: 1350, gradi: 20.4 },
      { da: 400, a: 500, gradi: 21 },
      /* Entra nella precedente: comincia dove quella finisce. */
      { da: 480, a: 600, gradi: 19 },
      /* Vuota o rovescia: via. */
      { da: 700, a: 700, gradi: 20 },
      { da: 900, a: 800, gradi: 20 },
      /* Attaccata alla precedente coi gradi uguali: una fascia sola. */
      { da: 1350, a: 1440, gradi: 20.5 },
      { da: 0, a: 60, gradi: 99 },
    ]),
    [
      { da: 0, a: 60, gradi: 30 },
      { da: 390, a: 510, gradi: 21 },
      { da: 510, a: 600, gradi: 19 },
      { da: 1020, a: 1440, gradi: 20.5 },
    ],
  );
  assert.equal(programmaPulito(null), null);
  assert.equal(programmaPulito([]), null);
  assert.deepEqual(programmaPulito({}), { feriali: [], festivi: [] });
});

test("i cronotermostati di prima restano identici, campo per campo", () => {
  const vecchio = {
    termostati: ["climate.sala"],
    inCasa: 21,
    fuori: 18,
    feriali: [[360, 480]],
    festivi: [[480, 1320]],
    finestre: [],
    finestraSpegne: true,
  };
  const c = cronoPulito(vecchio);
  assert.deepEqual(c, vecchio);
  assert.equal("programma" in c, false);
  assert.equal(cronoVoluto(c, { adesso: lun(7) }), 21);
  assert.equal(cronoVoluto(c, { adesso: lun(12) }), 18);
  /* In Home Assistant lo stesso template di sempre. */
  const ha = inHomeAssistant({ id: "c1", nome: "Crono", attiva: true, tipo: "crono", crono: c });
  const azione = JSON.stringify(ha.actions);
  assert.match(azione, /c\.inCasa if ns\.si else c\.fuori/);
  assert.doesNotMatch(azione, /programma/);
});

test("in Home Assistant il programma porta i suoi orari e torna indietro uguale", () => {
  const c = crono();
  const ha = inHomeAssistant({
    id: "p1",
    nome: "Programma Sala",
    attiva: true,
    tipo: "crono",
    crono: c,
  });
  const orari = ha.triggers.find((x) => x.trigger === "time").at;
  assert.deepEqual(orari, ["06:30:00", "08:00:00", "08:30:00", "17:00:00", "22:30:00", "23:00:00"]);
  assert.match(JSON.stringify(ha.actions), /c\.programma\.festivi if now\(\)\.weekday\(\) >= 5/);
  const indietro = dallaHomeAssistant({ ...ha, id: "p1", alias: "Programma Sala" });
  assert.deepEqual(indietro.crono.programma, c.programma);
  assert.equal(indietro.crono.fuori, 17);
});

test("la finestra del clima trova il programma del suo termostato", () => {
  const elenco = [
    { id: "a", modello: { tipo: "crono", crono: cronoPulito({ termostati: ["climate.sala"] }) } },
    { id: "b", modello: { tipo: "crono", crono: crono() } },
    { id: "c", modello: { tipo: "crono", crono: cronoPulito({ termostati: ["climate.camera"] }) } },
  ];
  /* Prima quello a fasce, anche se non e' il primo. */
  assert.equal(programmaDelTermostato(elenco, "climate.sala").id, "b");
  /* Senza, il cronotermostato di prima. */
  assert.equal(programmaDelTermostato(elenco, "climate.camera").id, "c");
  assert.equal(programmaDelTermostato(elenco, "climate.bagno"), null);
});

test("un cronotermostato di prima diventa programma senza cambiare niente", () => {
  const vecchio = cronoPulito({
    termostati: ["climate.sala"],
    inCasa: 21,
    fuori: 18,
    feriali: [
      [360, 480],
      [1020, 1320],
    ],
    festivi: [[480, 1320]],
  });
  const b = bozzaDalCrono(vecchio, "climate.sala");
  assert.deepEqual(b.programma.feriali, [
    { da: 360, a: 480, gradi: 21 },
    { da: 1020, a: 1320, gradi: 21 },
  ]);
  for (const ora of [3, 7, 12, 19, 23])
    assert.equal(gradiAlle(cronoPulito(b), lun(ora)), gradiAlle(vecchio, lun(ora)), `alle ${ora}`);
  /* Senza niente, un programma di serie per quel termostato. */
  const nuova = bozzaDalCrono(null, "climate.camera");
  assert.deepEqual(nuova.termostati, ["climate.camera"]);
  assert.ok(nuova.programma.feriali.length > 0);
});

test("una fascia nuova va dopo l'ultima, o nel primo buco", () => {
  assert.deepEqual(fasciaNuova([]), { da: 390, a: 510, gradi: 20 });
  assert.deepEqual(fasciaNuova([{ da: 390, a: 510, gradi: 21 }]), { da: 510, a: 630, gradi: 20 });
  assert.deepEqual(fasciaNuova([{ da: 1320, a: 1440, gradi: 21 }]), { da: 0, a: 120, gradi: 20 });
  assert.equal(fasciaNuova([{ da: 0, a: 1440, gradi: 21 }]), null);
});

test("la bozza segue il programma di Home Assistant finche' non la si tocca", () => {
  /* «Se ricarichi la pagina ti cambia l'orario»: la finestra apriva prima
   * della risposta della casa, la bozza nasceva dal programma di serie e
   * restava quella. Adesso una bozza non toccata si rifa' quando cambia
   * quello che Home Assistant dice. */
  const salvato = {
    id: "p1",
    modello: { tipo: "crono", crono: crono() },
  };
  const diSerie = firmaDelProgramma(null);
  const vera = firmaDelProgramma(salvato);
  assert.notEqual(diSerie, vera);
  assert.equal(bozzaDaTenere({ bozzaDa: diSerie, toccata: false, firma: vera }), "rifai");
  assert.equal(bozzaDaTenere({ bozzaDa: vera, toccata: false, firma: vera }), "tieni");
  /* Chi la sta scrivendo non se la vede cambiare sotto le mani. */
  assert.equal(bozzaDaTenere({ bozzaDa: diSerie, toccata: true, firma: vera }), "tieni");
  /* Quella appena salvata vale finche' l'elenco non la conferma (un
   * minuto al massimo): niente «torna quello di prima» per un attimo. */
  const appena = { firma: "nuova", il: 1000 };
  assert.equal(
    bozzaDaTenere({
      bozzaDa: "nuova",
      toccata: false,
      appenaSalvato: appena,
      firma: vera,
      adesso: 2000,
    }),
    "tieni",
  );
  assert.equal(
    bozzaDaTenere({
      bozzaDa: "nuova",
      toccata: false,
      appenaSalvato: appena,
      firma: vera,
      adesso: 70000,
    }),
    "rifai",
  );
});

test("piu' programmi per lo stesso termostato si contano, e vince quello a fasce", () => {
  const due = (programma) => ({
    id: programma ? "a" : "b",
    modello: {
      tipo: "crono",
      crono: cronoPulito({
        termostati: ["climate.sala"],
        ...(programma ? { programma: PROGRAMMA } : {}),
      }),
    },
  });
  const elenco = [due(false), due(true)];
  assert.equal(programmiDelTermostato(elenco, "climate.sala").length, 2);
  assert.equal(programmaDelTermostato(elenco, "climate.sala").id, "a");
});
