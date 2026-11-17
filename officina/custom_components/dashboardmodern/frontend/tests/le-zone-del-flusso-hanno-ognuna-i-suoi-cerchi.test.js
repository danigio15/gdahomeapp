/* Ogni zona del flusso Energia ha la sua disposizione.
 *
 * «Ho cercato di spostare i flussi ma metto a posto una zona, la salvo e si
 * incasina l'altra e viceversa.» Con due impianti (le linguette «Zona notte» ed
 * «Esterno» in cima all'Energia) la disposizione era una sola, «energia»: Rete,
 * Casa, «Altro» e «Non monitorati» ci sono in tutte e due le zone con lo stesso
 * nome, e sistemarli in una li spostava nell'altra. Adesso ogni impianto ha la
 * sua casella (`energia-<id>`), ogni cerchio si chiama col suo id, e la
 * vecchia disposizione comune si divide fra le zone al primo Salva senza
 * perdere niente.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DISEGNO_DELL_ENERGIA,
  conLePosizioni,
  disegnoDellImpianto,
  flowStageLayout,
  flowStageModel,
  impiantoDelDisegno,
  nodoDelCarico,
  posizioniDellImpianto,
  separaLeZone,
} from "../src/core/energy-flow-topology.js";
import {
  conLePosizioni as conLaScelta,
  disegniPuliti,
  posizioniDi,
} from "../src/core/posizioni-nei-disegni.js";

const ZONE = ["impianto", "impianto-2"];
const NOTTE = "impianto";
const ESTERNO = "impianto-2";

/* Quello che fa il Salva della modifica: la casella rimessa in ordine, poi la
 * bozza della zona scritta nella sua casella. E poi «ricarico»: si rilegge da
 * JSON, come dal localStorage. */
function salva(tutta, zone, scelta, variante, bozza) {
  let uscita = separaLeZone(disegniPuliti(tutta), zone);
  uscita = conLaScelta(uscita, disegnoDellImpianto(zone, scelta), variante, bozza);
  return JSON.parse(JSON.stringify(uscita));
}

/* La bozza che si costruisce spostando un cerchio: si parte da quello che la
 * zona vede adesso. */
const bozzaDa = (tutta, zone, scelta, variante, mosse) => ({
  ...posizioniDellImpianto(tutta, zone, scelta, variante),
  ...mosse,
});

test("con un impianto solo la casella resta «energia», con due ognuno ha la sua", () => {
  assert.equal(disegnoDellImpianto([NOTTE], NOTTE), DISEGNO_DELL_ENERGIA);
  assert.equal(disegnoDellImpianto([], ""), DISEGNO_DELL_ENERGIA);
  assert.equal(disegnoDellImpianto(ZONE, NOTTE), "energia-impianto");
  assert.equal(disegnoDellImpianto(ZONE, ESTERNO), "energia-impianto-2");
  /* Un impianto che non c'e' (la linguetta di un impianto cancellato) e'
   * il primo, come per tutto il resto dell'Energia. */
  assert.equal(disegnoDellImpianto(ZONE, "impianto-9"), "energia-impianto");
  /* Accetta anche gli impianti interi, come li da' `plantList`. */
  assert.equal(
    disegnoDellImpianto([{ id: NOTTE }, { id: ESTERNO }], ESTERNO),
    "energia-impianto-2",
  );
  /* Un id strano diventa un nome buono per `cd_disegni`, e la casella resta. */
  const strano = disegnoDellImpianto(["a", "Zona Notte!"], "Zona Notte!");
  assert.match(strano, /^energia-[a-z0-9_-]+$/);
  const tutta = conLaScelta({}, strano, "computer", { casa: { x: 40, y: 40 } });
  assert.deepEqual(posizioniDi(tutta, strano, "computer"), { casa: { x: 40, y: 40 } });
  assert.equal(impiantoDelDisegno(strano, ["a", "Zona Notte!"]), "Zona Notte!");
  assert.equal(impiantoDelDisegno("energia-impianto-2", ZONE), ESTERNO);
  assert.equal(impiantoDelDisegno("energia", ZONE), null);
  assert.equal(impiantoDelDisegno("solare", ZONE), null);
});

test("sposto e salvo una zona, poi l'altra, ricarico: tutte e due come le avevo lasciate", () => {
  const v = "telefono";
  let tutta = {};
  /* Zona notte: Altro, Non monitorati e Casa. */
  const notte = {
    "carico:stanza-altro": { x: 50, y: 80 },
    "carico:carichi-non-monitorati": { x: 77.5, y: 72.5 },
    casa: { x: 37.5, y: 45 },
  };
  tutta = salva(tutta, ZONE, NOTTE, v, bozzaDa(tutta, ZONE, NOTTE, v, notte));
  /* Esterno non ne sa niente: e' ancora di serie. */
  assert.deepEqual(posizioniDellImpianto(tutta, ZONE, ESTERNO, v), {});
  /* Esterno: gli stessi nomi, altri posti. */
  const esterno = {
    "carico:stanza-altro": { x: 37.5, y: 85 },
    "carico:stanza-cucina": { x: 17.5, y: 70 },
  };
  tutta = salva(tutta, ZONE, ESTERNO, v, bozzaDa(tutta, ZONE, ESTERNO, v, esterno));
  assert.deepEqual(posizioniDellImpianto(tutta, ZONE, NOTTE, v), notte);
  assert.deepEqual(posizioniDellImpianto(tutta, ZONE, ESTERNO, v), esterno);
  /* Di nuovo la zona notte: Esterno resta com'e'. */
  const ancora = { ...notte, "carico:stanza-altro": { x: 60, y: 85 } };
  tutta = salva(tutta, ZONE, NOTTE, v, bozzaDa(tutta, ZONE, NOTTE, v, ancora));
  assert.deepEqual(posizioniDellImpianto(tutta, ZONE, NOTTE, v), ancora);
  assert.deepEqual(posizioniDellImpianto(tutta, ZONE, ESTERNO, v), esterno);
  /* Il computer non e' stato toccato da nessuna delle due. */
  for (const zona of ZONE)
    assert.deepEqual(posizioniDellImpianto(tutta, ZONE, zona, "computer"), {});
  assert.deepEqual(Object.keys(tutta).sort(), [
    "energia-impianto-2:telefono",
    "energia-impianto:telefono",
  ]);
});

test("la disposizione comune di prima si divide fra le zone, senza perdere il lavoro", () => {
  const v = "computer";
  /* Com'era salvato fino alla 1.19.8: una casella sola, con i cerchi di tutte
   * e due le zone e quelli in comune. */
  const vecchia = {
    "carico:stanza-bagno": { x: 15, y: 80 },
    "carico:stanza-cucina": { x: 20, y: 85 },
    "carico:stanza-altro": { x: 70, y: 85 },
    rete: { x: 20, y: 30 },
  };
  let tutta = { "energia:computer": vecchia, "solare:computer": { pompa: { x: 10, y: 10 } } };
  /* Prima del Salva ogni zona vede quello che vedeva. */
  for (const zona of ZONE) assert.deepEqual(posizioniDellImpianto(tutta, ZONE, zona, v), vecchia);
  /* Si salva l'Esterno: la zona notte si tiene la sua copia. */
  const esterno = bozzaDa(tutta, ZONE, ESTERNO, v, { "carico:stanza-altro": { x: 30, y: 90 } });
  tutta = salva(tutta, ZONE, ESTERNO, v, esterno);
  assert.equal(tutta["energia:computer"], undefined);
  assert.deepEqual(posizioniDellImpianto(tutta, ZONE, NOTTE, v), vecchia);
  assert.deepEqual(posizioniDellImpianto(tutta, ZONE, ESTERNO, v), esterno);
  /* Gli altri disegni non si toccano. */
  assert.deepEqual(tutta["solare:computer"], { pompa: { x: 10, y: 10 } });
  /* «Ripristina» nell'Esterno lo rimette di serie: non rilegge la zona notte. */
  tutta = salva(tutta, ZONE, ESTERNO, v, {});
  assert.deepEqual(posizioniDellImpianto(tutta, ZONE, ESTERNO, v), {});
  assert.deepEqual(posizioniDellImpianto(tutta, ZONE, NOTTE, v), vecchia);
  /* E nemmeno quando anche la zona notte torna di serie. */
  tutta = salva(tutta, ZONE, NOTTE, v, {});
  for (const zona of ZONE) assert.deepEqual(posizioniDellImpianto(tutta, ZONE, zona, v), {});
});

test("con un impianto solo non migra niente, e chi torna a uno solo ritrova la sua", () => {
  const v = "computer";
  const mia = { "carico:frigo": { x: 30, y: 60 } };
  const tutta = { "energia:computer": mia };
  assert.deepEqual(posizioniDellImpianto(tutta, [NOTTE], NOTTE, v), mia);
  assert.deepEqual(separaLeZone(tutta, [NOTTE]), tutta);
  /* Due zone separate, poi l'Esterno cancellato: la zona rimasta si legge
   * dalla sua casella di allora, e al primo Salva torna «energia». */
  const separate = { "energia-impianto:computer": mia, "energia-impianto-2:computer": {} };
  assert.deepEqual(posizioniDellImpianto(separate, [NOTTE], NOTTE, v), mia);
  const dopo = separaLeZone(disegniPuliti(separate), [NOTTE]);
  assert.deepEqual(dopo, { "energia:computer": mia });
});

/* ── i cerchi della scena ───────────────────────────────────────────────── */

const stato = (w) => ({ state: String(w), attributes: { unit_of_measurement: "W" } });

function scena({ conResiduo = true, conCucina = true } = {}) {
  const loads = [
    { id: "stanza-cucina", name: "Cucina", power_entity: "sensor.cucina_w", order: 0 },
    { id: "stanza-altro", name: "Altro", power_entity: "sensor.altro_w", order: 1 },
    { id: "stanza-sala", name: "Sala cinema", power_entity: "sensor.sala_w", order: 2 },
    { id: "stanza-lavanderia", name: "Lavanderia", power_entity: "sensor.lava_w", order: 3 },
  ].filter((l) => conCucina || l.id !== "stanza-cucina");
  return flowStageModel({
    loads,
    appliances: [],
    states: {
      "sensor.cucina_w": stato(96),
      "sensor.altro_w": stato(15),
      "sensor.sala_w": stato(0),
      "sensor.lava_w": stato(0),
    },
    casa: conResiduo ? 300 : null,
  });
}

const MISURE = {
  mobile: { larghezza: 360, altezza: 720, casa: { x: 50, y: 46, r: 51 }, raggio: 37 },
  desktop: { larghezza: 1236, altezza: 550, casa: { x: 50, y: 50, r: 72 }, raggio: 57 },
};
const centroDi = (model, id, variante = "mobile") => {
  const n = model.nodes.find((x) => x.id === id);
  return { x: n[variante].left, y: n[variante].top };
};

test("un cerchio che arriva dopo non sposta quelli fissati, e uno che va via non fa scorrere gli altri", () => {
  /* La zona sistemata senza «Non monitorati»: al Salva ogni cerchio si ferma
   * dove si vede, col suo id (`fissaICarichi`). */
  const senza = scena({ conResiduo: false });
  assert.ok(!senza.nodes.some((n) => n.residuo));
  const fissate = {};
  for (const n of senza.nodes) fissate[nodoDelCarico(n.id)] = { x: n.mobile.left, y: n.mobile.top };
  fissate["carico:stanza-altro"] = { x: 50, y: 88 };
  const P = { telefono: fissate };
  const prima = conLePosizioni(senza, P, MISURE);
  /* Arriva «Non monitorati»: la fila di serie diventa di cinque, ma i quattro
   * restano dove li aveva lasciati l'utente. */
  const con = scena({ conResiduo: true });
  assert.ok(con.nodes.some((n) => n.residuo));
  const dopo = conLePosizioni(con, P, MISURE);
  for (const n of senza.nodes) assert.deepEqual(centroDi(dopo, n.id), centroDi(prima, n.id));
  /* Il nuovo sta al posto libero: dentro il palco e sopra nessuno. */
  const nuovo = dopo.nodes.find((n) => n.residuo);
  assert.equal(nuovo.nuovo, true);
  const r = { x: (37 / 360) * 100, y: (37 / 720) * 100 };
  const c = centroDi(dopo, nuovo.id);
  assert.ok(c.x >= r.x - 0.01 && c.x <= 100 - r.x + 0.01, `x ${c.x}`);
  assert.ok(c.y >= r.y - 0.01 && c.y <= 100 - r.y + 0.01, `y ${c.y}`);
  for (const altro of dopo.nodes.filter((n) => n !== nuovo)) {
    const a = centroDi(dopo, altro.id);
    const separati = Math.abs(a.x - c.x) >= 2 * r.x - 0.01 || Math.abs(a.y - c.y) >= 2 * r.y - 0.01;
    assert.ok(separati, `${altro.id} sotto «Non monitorati»`);
  }
  /* Va via la Cucina: gli altri non scorrono nel suo posto. */
  const senzaCucina = conLePosizioni(scena({ conResiduo: false, conCucina: false }), P, MISURE);
  for (const n of senzaCucina.nodes)
    assert.deepEqual(centroDi(senzaCucina, n.id), centroDi(prima, n.id));
});

test("una posizione scelta con un cerchio piu' piccolo resta dentro il palco", () => {
  const m = scena();
  /* Al 99% col cerchio da 37 punti su 360 il bordo uscirebbe di 33 punti. */
  const P = { telefono: { "carico:carichi-non-monitorati": { x: 99, y: 99 } } };
  const dentro = centroDi(conLePosizioni(m, P, MISURE), "carichi-non-monitorati");
  assert.ok(dentro.x <= 100 - (37 / 360) * 100 + 0.01, `x ${dentro.x}`);
  assert.ok(dentro.y <= 100 - (37 / 720) * 100 + 0.01, `y ${dentro.y}`);
  /* Dentro il palco una scelta resta esattamente quella. */
  const giusta = { telefono: { "carico:carichi-non-monitorati": { x: 60, y: 80 } } };
  assert.deepEqual(centroDi(conLePosizioni(m, giusta, MISURE), "carichi-non-monitorati"), {
    x: 60,
    y: 80,
  });
  /* Due scelte una sopra l'altra le ha volute l'utente: restano. */
  const sovrapposte = {
    telefono: {
      "carico:stanza-altro": { x: 50, y: 80 },
      "carico:stanza-sala": { x: 50, y: 80 },
    },
  };
  const due = conLePosizioni(m, sovrapposte, MISURE);
  assert.deepEqual(centroDi(due, "stanza-altro"), centroDi(due, "stanza-sala"));
});

test("la disposizione di serie sta dentro il palco e non sovrappone i cerchi, anche con «Non monitorati»", () => {
  for (const variante of ["desktop", "mobile"]) {
    for (let n = 1; n <= 8; n += 1) {
      const posti = flowStageLayout(n, variante);
      assert.equal(posti.length, n);
      for (const p of posti) {
        assert.ok(p.left > 0 && p.left < 100, `${variante} ${n}: left ${p.left}`);
        assert.ok(p.top > 0 && p.top < 100, `${variante} ${n}: top ${p.top}`);
      }
      /* Nella stessa fila i centri sono distinti e in ordine: il passo e'
       * quello su cui la scena misura quanto stringere i cerchi. */
      const file = new Map();
      for (const p of posti) file.set(p.top, [...(file.get(p.top) || []), p.left]);
      for (const fila of file.values()) {
        const ordinata = [...fila].sort((a, b) => a - b);
        for (let i = 1; i < ordinata.length; i += 1)
          assert.ok(ordinata[i] - ordinata[i - 1] >= 100 / 9 - 0.01, `${variante} ${n}: passo`);
        /* E il margine al bordo e' almeno mezzo passo: un cerchio largo quanto
         * il passo meno l'aria non esce. */
        const passo = ordinata.length > 1 ? ordinata[1] - ordinata[0] : 100;
        assert.ok(ordinata[0] >= passo / 2 - 0.01, `${variante} ${n}: bordo sinistro`);
        assert.ok(100 - ordinata.at(-1) >= passo / 2 - 0.01, `${variante} ${n}: bordo destro`);
      }
    }
  }
  /* Senza scelte il modello e' lo stesso oggetto anche con il residuo. */
  const m = scena();
  assert.equal(conLePosizioni(m, {}, MISURE), m);
});
