/* Le prove del ponte, da un capo all'altro.
 *
 * Qui non si finge niente di quello che conta. C'e' una Home Assistant finta —
 * finta nel comportamento, vera nel protocollo: fa la stretta di mano che fa
 * Home Assistant, rifiuta i segni sbagliati, e risponde. E c'e' un telefono
 * finto, che e' il WebSocket cliente di Node. In mezzo, il ponte vero.
 *
 * Cosa si sta provando davvero: che il telefono non riceve mai il segno della
 * casa, e che senza abbinamento non passa niente.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { accetta } from "../src/presa.js";
import { Casa } from "../src/casa.js";
import { Dispositivi } from "../src/dispositivi.js";
import { Ponte, SEGNO_DEL_MUCCHIO } from "../src/ponte.js";

const SEGNO_DEL_SUPERVISOR = "questo-e-il-segno-che-non-deve-uscire";

/* ─── La casa finta ──────────────────────────────────────────────────────── */

async function casaFinta({ rifiutaIlSegno = false, muta = false } = {}) {
  const arrivati = [];
  const prese = [];
  const server = createServer((_richiesta, risposta) => {
    risposta.writeHead(200, { "content-type": "application/json" });
    risposta.end(JSON.stringify({ message: "API running." }));
  });

  server.on("upgrade", (richiesta, socket) => {
    const presa = accetta(richiesta, socket, {
      onMessaggio: (testo) => {
        const detto = JSON.parse(testo);
        if (detto.type === "auth") {
          if (rifiutaIlSegno || detto.access_token !== SEGNO_DEL_SUPERVISOR) {
            presa.manda(JSON.stringify({ type: "auth_invalid", message: "no" }));
            presa.chiudi();
            return;
          }
          presa.manda(JSON.stringify({ type: "auth_ok", ha_version: "2025.1.0" }));
          return;
        }
        arrivati.push(detto);
        presa.manda(JSON.stringify({ id: detto.id, type: "result", success: true }));
      },
    });
    if (!presa) return;
    prese.push(presa);
    if (!muta) presa.manda(JSON.stringify({ type: "auth_required", ha_version: "2025.1.0" }));
  });

  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    indirizzo: `http://127.0.0.1:${server.address().port}`,
    arrivati,
    prese,
    spegni: async () => {
      for (const presa of prese) presa.chiudi();
      await new Promise((ok) => server.close(ok));
    },
  };
}

/* ─── Il banco: casa finta + ponte + cartella temporanea ─────────────────── */

async function banco(opzioniDellaCasa = {}, { da = "prova", mucchio = false } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "ponte-prova-"));
  const ha = await casaFinta(opzioniDellaCasa);
  const casa = new Casa({ indirizzo: ha.indirizzo, segno: SEGNO_DEL_SUPERVISOR });
  const dispositivi = new Dispositivi({ cartella });
  const registro = { info: () => {}, attenzione: () => {}, errore: () => {} };
  const ponte = new Ponte({ casa, dispositivi, registro });

  const server = createServer((_r, risposta) => risposta.end());
  server.on("upgrade", (richiesta, socket) => {
    const presa = accetta(richiesta, socket, {});
    if (presa) ponte.accogli(presa, { da, mucchio });
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));

  return {
    ha,
    ponte,
    dispositivi,
    indirizzo: `ws://127.0.0.1:${server.address().port}`,
    spegni: async () => {
      ponte.chiudiTutto();
      await new Promise((ok) => server.close(ok));
      await ha.spegni();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

/* Un telefono: apre, raccoglie quello che gli dicono, e sa autenticarsi. */
function telefono(indirizzo) {
  const presa = new WebSocket(indirizzo);
  const detti = [];
  /* Anche il testo com'e' arrivato: un mucchio di eventi non e' JSON — e'
   * il suo segno e poi un messaggio per riga — e contarli e' l'unico modo di
   * sapere quante richieste sono passate dal centralino. */
  const grezzi = [];
  presa.addEventListener("message", (evento) => {
    const testo = String(evento.data);
    grezzi.push(testo);
    /* Un mucchio si spacchetta, come fa l'app: `detti` sono i messaggi,
     * `grezzi` le buste. La differenza fra i due conti e' esattamente quello
     * che il centralino non fa piu' pagare. */
    if (testo.startsWith(SEGNO_DEL_MUCCHIO)) {
      for (const pezzo of testo.slice(SEGNO_DEL_MUCCHIO.length).split("\n")) {
        if (pezzo) detti.push(JSON.parse(pezzo));
      }
      return;
    }
    if (!testo.startsWith("{")) return;
    detti.push(JSON.parse(testo));
  });
  const aperta = new Promise((ok, no) => {
    presa.addEventListener("open", ok);
    presa.addEventListener("error", () => no(new Error("il telefono non e' entrato")));
  });
  const chiusa = new Promise((ok) => presa.addEventListener("close", ok));
  return {
    presa,
    detti,
    grezzi,
    aperta,
    chiusa,
    manda: (oggetto) => presa.send(JSON.stringify(oggetto)),
    aspetta: (tipo) =>
      attendi(() => detti.some((uno) => uno.type === tipo)).then(() =>
        detti.find((uno) => uno.type === tipo),
      ),
    chiudi: () => presa.close(),
  };
}

/* ─── Le prove ───────────────────────────────────────────────────────────── */

test("il ponte si presenta come Home Assistant", async () => {
  const b = await banco();
  try {
    const t = telefono(b.indirizzo);
    await t.aperta;
    assert.equal((await t.aspetta("auth_required")).type, "auth_required");
    t.chiudi();
  } finally {
    await b.spegni();
  }
});

test("un telefono abbinato passa, e i messaggi vanno in tutte e due le direzioni", async () => {
  const b = await banco();
  try {
    const { segno } = b.dispositivi.abbina({ nome: "iPhone di prova", sistema: "ios" });
    const t = telefono(b.indirizzo);
    await t.aperta;
    await t.aspetta("auth_required");
    t.manda({ type: "auth", access_token: segno });
    assert.equal((await t.aspetta("auth_ok")).type, "auth_ok");

    t.manda({ id: 7, type: "get_states" });
    await attendi(() => b.ha.arrivati.length === 1);
    assert.equal(b.ha.arrivati[0].type, "get_states");

    const risposta = await attendi(() => t.detti.find((uno) => uno.id === 7)).then(() =>
      t.detti.find((uno) => uno.id === 7),
    );
    assert.equal(risposta.success, true);
    t.chiudi();
  } finally {
    await b.spegni();
  }
});

test("il segno della casa non arriva mai al telefono", async () => {
  const b = await banco();
  try {
    const { segno } = b.dispositivi.abbina({ nome: "curioso" });
    const t = telefono(b.indirizzo);
    await t.aperta;
    await t.aspetta("auth_required");
    t.manda({ type: "auth", access_token: segno });
    await t.aspetta("auth_ok");
    t.manda({ id: 1, type: "get_config" });
    await attendi(() => b.ha.arrivati.length === 1);

    const tutto = JSON.stringify(t.detti);
    assert.equal(tutto.includes(SEGNO_DEL_SUPERVISOR), false);
    t.chiudi();
  } finally {
    await b.spegni();
  }
});

test("un segno inventato viene rifiutato e il filo con la casa non si apre nemmeno", async () => {
  const b = await banco();
  try {
    const t = telefono(b.indirizzo);
    await t.aperta;
    await t.aspetta("auth_required");
    t.manda({ type: "auth", access_token: "me lo sono inventato" });
    assert.equal((await t.aspetta("auth_invalid")).type, "auth_invalid");
    await t.chiusa;
    assert.equal(b.ha.prese.length, 0, "la casa non e' stata nemmeno disturbata");
  } finally {
    await b.spegni();
  }
});

test("senza autenticarsi non passa niente", async () => {
  const b = await banco();
  try {
    const t = telefono(b.indirizzo);
    await t.aperta;
    await t.aspetta("auth_required");
    t.manda({ id: 1, type: "get_states" });
    await t.aspetta("auth_invalid");
    await t.chiusa;
    assert.deepEqual(b.ha.arrivati, []);
  } finally {
    await b.spegni();
  }
});

test("una parola che non e' JSON non fa cadere il ponte", async () => {
  const b = await banco();
  try {
    const t = telefono(b.indirizzo);
    await t.aperta;
    await t.aspetta("auth_required");
    t.presa.send("questo non e' json");
    await t.aspetta("auth_invalid");
    await t.chiusa;
    assert.equal(b.ponte.quantiCollegati(), 0);
  } finally {
    await b.spegni();
  }
});

test("se la casa rifiuta il ponte, il telefono lo viene a sapere invece di restare appeso", async () => {
  const b = await banco({ rifiutaIlSegno: true });
  try {
    const { segno } = b.dispositivi.abbina({ nome: "sfortunato" });
    const t = telefono(b.indirizzo);
    await t.aperta;
    await t.aspetta("auth_required");
    t.manda({ type: "auth", access_token: segno });
    assert.equal((await t.aspetta("auth_invalid")).type, "auth_invalid");
    await t.chiusa;
  } finally {
    await b.spegni();
  }
});

test("staccare un telefono dalla console butta giu' il suo filo", async () => {
  const b = await banco();
  try {
    const { segno, dispositivo } = b.dispositivi.abbina({ nome: "da staccare" });
    const t = telefono(b.indirizzo);
    await t.aperta;
    await t.aspetta("auth_required");
    t.manda({ type: "auth", access_token: segno });
    await t.aspetta("auth_ok");
    assert.equal(b.ponte.quantiCollegati(), 1);

    b.dispositivi.stacca(dispositivo.id);
    assert.equal(b.ponte.scollega(dispositivo.id), 1);
    await t.chiusa;
    assert.equal(b.ponte.quantiCollegati(), 0);
  } finally {
    await b.spegni();
  }
});

test("quando il telefono se ne va, il filo con la casa si chiude", async () => {
  const b = await banco();
  try {
    const { segno } = b.dispositivi.abbina({ nome: "passeggero" });
    const t = telefono(b.indirizzo);
    await t.aperta;
    await t.aspetta("auth_required");
    t.manda({ type: "auth", access_token: segno });
    await t.aspetta("auth_ok");
    assert.equal(b.ha.prese.length, 1);

    t.chiudi();
    await attendi(() => b.ponte.quantiCollegati() === 0);
    await attendi(() => b.ha.prese[0].viva === false);
  } finally {
    await b.spegni();
  }
});

test("due telefoni hanno due fili distinti", async () => {
  const b = await banco();
  try {
    const uno = b.dispositivi.abbina({ nome: "uno" });
    const due = b.dispositivi.abbina({ nome: "due" });
    const ta = telefono(b.indirizzo);
    const tb = telefono(b.indirizzo);
    await Promise.all([ta.aperta, tb.aperta]);
    await Promise.all([ta.aspetta("auth_required"), tb.aspetta("auth_required")]);
    ta.manda({ type: "auth", access_token: uno.segno });
    tb.manda({ type: "auth", access_token: due.segno });
    await Promise.all([ta.aspetta("auth_ok"), tb.aspetta("auth_ok")]);

    assert.equal(b.ponte.quantiCollegati(), 2);
    assert.equal(b.ha.prese.length, 2);
    assert.equal(b.ponte.collegatiPerDispositivo().size, 2);
    ta.chiudi();
    tb.chiudi();
  } finally {
    await b.spegni();
  }
});

test("una raffica oltre il limite chiude il collegamento invece di girarla alla casa", async () => {
  const b = await banco();
  try {
    const { segno } = b.dispositivi.abbina({ nome: "impazzito" });
    const t = telefono(b.indirizzo);
    await t.aperta;
    await t.aspetta("auth_required");
    t.manda({ type: "auth", access_token: segno });
    await t.aspetta("auth_ok");

    for (let i = 0; i < 800; i += 1) t.manda({ id: i + 1, type: "ping" });
    await t.chiusa;
    assert.ok(b.ha.arrivati.length < 800, `la casa ne ha visti ${b.ha.arrivati.length}, non tutti`);
  } finally {
    await b.spegni();
  }
});

test("il saluto alla casa dice se e' viva", async () => {
  const b = await banco();
  try {
    const casa = new Casa({ indirizzo: b.ha.indirizzo, segno: SEGNO_DEL_SUPERVISOR });
    assert.deepEqual(await casa.saluta(), { viva: true });
    const morta = new Casa({ indirizzo: "http://127.0.0.1:1", segno: "x" });
    assert.equal((await morta.saluta()).viva, false);
  } finally {
    await b.spegni();
  }
});

/* ─── Attese ─────────────────────────────────────────────────────────────── */

const nuovoGiro = (millesimi = 5) => new Promise((ok) => setTimeout(ok, millesimi));

async function attendi(condizione, entro = 5000) {
  const fine = Date.now() + entro;
  let ultimo;
  while (Date.now() < fine) {
    ultimo = condizione();
    if (ultimo) return ultimo;
    await nuovoGiro();
  }
  throw new Error("l'attesa e' scaduta");
}

/* ─── Il mucchio: gli eventi da fuori casa ───────────────────────────────── */

/* Perche' questa prova esiste, e cos'era il difetto.
 *
 * Dentro casa un evento verso il telefono e' un messaggio su un socket della
 * rete locale, e non costa niente. Da fuori si passa dal centralino, dove
 * **ogni messaggio e' una richiesta contata**: il piano gratuito ne da'
 * centomila al giorno, e una casa vera manda cinque eventi al secondo. Fanno
 * quarantamila all'ora — due ore e mezza di plancia aperta, e il centralino si
 * spegne per tutti fino a mezzanotte. E' arrivato l'avviso di Cloudflare al
 * novanta per cento.
 *
 * Quindi da fuori gli eventi partono **insieme**, e quello che si prova qui e'
 * che il raggruppamento non cambi niente di quello che conta: l'ordine in cui
 * Home Assistant ha parlato, e il fatto che una risposta non aspetti. */

/* Un evento come lo manda Home Assistant, con dentro il numero della
 * sottoscrizione. */
const unEvento = (numero, entita) =>
  JSON.stringify({
    id: numero,
    type: "event",
    event: {
      event_type: "state_changed",
      data: { entity_id: entita, new_state: { state: "on" } },
    },
  });

async function dalCentralino(b) {
  const { segno } = b.dispositivi.abbina({ nome: "telefono di fuori" });
  const t = telefono(b.indirizzo);
  await t.aperta;
  await t.aspetta("auth_required");
  t.manda({ type: "auth", access_token: segno });
  await t.aspetta("auth_ok");
  /* Il filo con Home Assistant: e' quello che la casa finta ha appena
   * accettato, e da li' si spingono gli eventi. */
  await attendi(() => b.ha.prese.length >= 1);
  return { t, ha: b.ha.prese[b.ha.prese.length - 1] };
}

test("da fuori casa gli eventi arrivano in un mucchio, non uno per uno", async () => {
  const b = await banco({}, { da: "centralino 1.2.3.4", mucchio: true });
  try {
    const { t, ha } = await dalCentralino(b);
    const prima = t.grezzi.length;

    ha.manda(unEvento(1, "light.cucina"));
    ha.manda(unEvento(1, "light.salotto"));
    ha.manda(unEvento(1, "sensor.frigo"));

    /* Una busta sola, dopo la finestra. Tre messaggi, una richiesta. */
    await attendi(() => t.grezzi.length > prima, 4000);
    await attendi(() => t.detti.filter((uno) => uno.type === "event").length === 3, 4000);
    const nuove = t.grezzi.slice(prima);
    assert.equal(nuove.length, 1, `buste: ${nuove.length}`);
    assert.ok(nuove[0].startsWith(SEGNO_DEL_MUCCHIO));
    /* E dentro, nell'ordine in cui la casa ha parlato. */
    const dentro = nuove[0]
      .slice(SEGNO_DEL_MUCCHIO.length)
      .split("\n")
      .map((uno) => JSON.parse(uno));
    assert.deepEqual(
      dentro.map((uno) => uno.event.data.entity_id),
      ["light.cucina", "light.salotto", "sensor.frigo"],
    );
    t.chiudi();
  } finally {
    await b.spegni();
  }
});

test("una risposta non aspetta il mucchio, e non scavalca gli eventi di prima", async () => {
  const b = await banco({}, { da: "centralino 1.2.3.4", mucchio: true });
  try {
    const { t, ha } = await dalCentralino(b);
    const prima = t.grezzi.length;

    /* Un evento entra nel mucchio; la risposta che arriva subito dopo lo fa
     * partire e parte anche lei. Chi accende una luce non aspetta un secondo,
     * e la tessera non si disegna col valore di prima. */
    ha.manda(unEvento(1, "light.cucina"));
    ha.manda(JSON.stringify({ id: 9, type: "result", success: true, result: null }));

    await attendi(() => t.detti.some((uno) => uno.id === 9), 2000);
    const nuove = t.grezzi.slice(prima);
    /* Due buste: l'evento da solo — uno non e' un mucchio — e la risposta. */
    assert.equal(nuove.length, 2, `buste: ${JSON.stringify(nuove)}`);
    assert.equal(JSON.parse(nuove[0]).type, "event");
    assert.equal(JSON.parse(nuove[1]).id, 9);
    t.chiudi();
  } finally {
    await b.spegni();
  }
});

test("in casa non si raggruppa niente: la finestra sarebbe un ritardo per niente", async () => {
  const b = await banco({}, { da: "192.168.1.9", mucchio: true });
  try {
    const { t, ha } = await dalCentralino(b);
    const prima = t.grezzi.length;
    ha.manda(unEvento(1, "light.cucina"));
    ha.manda(unEvento(1, "light.salotto"));
    await attendi(() => t.grezzi.length - prima === 2, 2000);
    for (const una of t.grezzi.slice(prima)) {
      assert.equal(una.startsWith(SEGNO_DEL_MUCCHIO), false);
    }
    t.chiudi();
  } finally {
    await b.spegni();
  }
});

test("un telefono che non sa spacchettare riceve un messaggio per evento", async () => {
  const b = await banco({}, { da: "centralino 1.2.3.4", mucchio: false });
  try {
    const { t, ha } = await dalCentralino(b);
    const prima = t.grezzi.length;
    ha.manda(unEvento(1, "light.cucina"));
    ha.manda(unEvento(1, "light.salotto"));
    await attendi(() => t.grezzi.length - prima === 2, 2000);
    for (const una of t.grezzi.slice(prima)) {
      assert.equal(una.startsWith(SEGNO_DEL_MUCCHIO), false);
    }
    t.chiudi();
  } finally {
    await b.spegni();
  }
});

test("quello che era nel mucchio parte prima che il filo si chiuda", async () => {
  const b = await banco({}, { da: "centralino 1.2.3.4", mucchio: true });
  try {
    const { t, ha } = await dalCentralino(b);
    const prima = t.grezzi.length;
    const collegamento = [...b.ponte.collegamenti][0];
    ha.manda(unEvento(1, "light.cucina"));
    ha.manda(unEvento(1, "light.salotto"));
    /* Si aspetta che siano **nel mucchio** — mandarli e' un giro di socket, e
     * chiudere prima proverebbe un'altra cosa — e poi si chiude dentro la
     * finestra: due eventi raccolti e mai mandati sarebbero due tessere col
     * valore di prima. */
    await attendi(() => collegamento._mucchio.length === 2);
    collegamento.chiudi(1000, "");
    await attendi(() => t.grezzi.length > prima, 2000);
    const nuove = t.grezzi.slice(prima);
    assert.ok(nuove[0].startsWith(SEGNO_DEL_MUCCHIO), `arrivato: ${nuove[0]}`);
    assert.equal(nuove[0].slice(SEGNO_DEL_MUCCHIO.length).split("\n").length, 2);
  } finally {
    await b.spegni();
  }
});
