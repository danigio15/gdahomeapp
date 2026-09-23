/* Il centralino instrada byte che non puo' leggere.
 *
 * E' la prova per cui esiste tutta la cifratura, e si fa nel modo piu' diretto
 * che ci sia: si registra **tutto** quello che passa dal centralino, poi si
 * cerca dentro quel mucchio il segno del telefono, il codice di abbinamento e
 * i comandi. Non ci deve essere niente.
 *
 * La catena e' quella vera: ponte vero, centralino vero, e un telefono che
 * parla come parlera' l'app.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { Case } from "../../centralino/src/case.js";
import { Centralino } from "../../centralino/src/centralino.js";
import { costruisciIlServer } from "../../centralino/src/server.js";

import { Casa } from "../src/casa.js";
import { Chiamata } from "../src/chiamata.js";
import { Dispositivi } from "../src/dispositivi.js";
import { Abbinamento } from "../src/abbinamento.js";
import { Identita } from "../src/identita.js";
import { Ponte } from "../src/ponte.js";
import { Portiere } from "../src/portiere.js";
import { accetta } from "../src/presa.js";
import { attendi, telefonoCifrato } from "./telefono-cifrato.js";

const impronta = (cosa) => createHash("sha256").update(cosa).digest("hex");
const SEGNO_DELLA_CASA = "segno-finto-del-supervisor";

async function homeAssistantFinta() {
  const prese = [];
  const server = createServer((_r, risposta) => {
    risposta.writeHead(200, { "content-type": "application/json" });
    risposta.end('{"message":"API running."}');
  });
  server.on("upgrade", (richiesta, socket) => {
    const presa = accetta(richiesta, socket, {
      onMessaggio: (testo) => {
        const detto = JSON.parse(testo);
        if (detto.type === "auth") {
          presa.manda(
            JSON.stringify(
              detto.access_token === SEGNO_DELLA_CASA
                ? { type: "auth_ok" }
                : { type: "auth_invalid" },
            ),
          );
          return;
        }
        presa.manda(
          JSON.stringify({
            id: detto.id,
            type: "result",
            success: true,
            result:
              detto.type === "get_states" ? [{ entity_id: "light.cucina", state: "on" }] : null,
          }),
        );
      },
    });
    if (!presa) return;
    prese.push(presa);
    presa.manda(JSON.stringify({ type: "auth_required" }));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    indirizzo: `http://127.0.0.1:${server.address().port}`,
    prese,
    spegni: async () => {
      for (const presa of prese) presa.chiudi();
      await new Promise((ok) => server.close(ok));
    },
  };
}

/* Il centralino, con un registratore attaccato: tutto quello che gli passa
 * sotto il naso finisce in un mucchio. */
async function catena() {
  const cartelle = [];
  const nuova = (nome) => {
    const dove = mkdtempSync(join(tmpdir(), `${nome}-`));
    cartelle.push(dove);
    return dove;
  };

  const ha = await homeAssistantFinta();
  const centralino = new Centralino({ case: new Case({ cartella: nuova("case") }) });

  /* Il registratore. Si mette dentro il centralino, dove passano i byte. */
  const visto = [];
  const accogliUnaCasa = centralino.accogliUnaCasa.bind(centralino);
  centralino.accogliUnaCasa = (presa, opzioni) => {
    const casa = accogliUnaCasa(presa, opzioni);
    const primaOnMessaggio = presa.onMessaggio;
    presa.onMessaggio = (testo) => {
      visto.push(testo);
      primaOnMessaggio(testo);
    };
    const primaManda = presa.manda.bind(presa);
    presa.manda = (testo) => {
      visto.push(testo);
      return primaManda(testo);
    };
    return casa;
  };

  const server = costruisciIlServer({ centralino });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const doveIlCentralino = `ws://127.0.0.1:${server.address().port}`;

  const casa = new Casa({ indirizzo: ha.indirizzo, segno: SEGNO_DELLA_CASA });
  const dispositivi = new Dispositivi({ cartella: nuova("ponte") });
  const abbinamento = new Abbinamento({});
  const ponte = new Ponte({ casa, dispositivi, registro: null });
  const portiere = new Portiere({ ponte, dispositivi, abbinamento, registro: null });
  const identita = new Identita({ cartella: nuova("identita") });
  const chiamata = new Chiamata({
    dove: doveIlCentralino,
    identita,
    portiere,
    attesaMassima: 200,
  });
  portiere.chiamata = chiamata;
  chiamata.avvia();
  await attendi(() => chiamata.dentro);

  return {
    ha,
    centralino,
    doveIlCentralino,
    dispositivi,
    abbinamento,
    identita,
    chiamata,
    visto,
    cartellaDelPonte: cartelle[1],
    spegni: async () => {
      chiamata.spegni();
      ponte.chiudiTutto();
      centralino.chiudiTutto();
      await new Promise((ok) => server.close(ok));
      await ha.spegni();
      for (const dove of cartelle) rmSync(dove, { recursive: true, force: true });
    },
  };
}

/* ─── Le prove ───────────────────────────────────────────────────────────── */

test("dal centralino non passa niente di leggibile: ne' il segno, ne' i comandi", async () => {
  const c = await catena();
  try {
    const { segno, chiave, dispositivo } = c.dispositivi.abbina({ nome: "telefono" });

    const telefono = telefonoCifrato(`${c.doveIlCentralino}/telefono/${c.identita.casa}`, {
      chi: dispositivo.id,
      chiave,
    });
    await telefono.dentro;
    await telefono.aspetta("auth_required");
    telefono.manda({ type: "auth", access_token: segno });
    await telefono.aspetta("auth_ok");

    telefono.manda({ id: 1, type: "get_states" });
    await telefono.aspetta((uno) => uno.id === 1);

    /* Adesso si guarda dentro al mucchio di tutto quello che e' passato. */
    const tutto = c.visto.join("\n");
    assert.ok(tutto.length > 200, "qualcosa e' passato davvero");

    assert.equal(tutto.includes(segno), false, "il segno non e' passato");
    assert.equal(tutto.includes(SEGNO_DELLA_CASA), false, "ne' quello della casa");
    assert.equal(tutto.includes(chiave), false, "ne' la chiave del filo");
    assert.equal(tutto.includes("access_token"), false, "nemmeno il nome del campo");
    assert.equal(tutto.includes("get_states"), false, "ne' i comandi");
    assert.equal(tutto.includes("light.cucina"), false, "ne' cosa c'e' in casa");
    assert.equal(tutto.includes("auth_ok"), false, "ne' come e' andata");

    telefono.chiudi();
  } finally {
    await c.spegni();
  }
});

test("nemmeno l'abbinamento passa in chiaro: ne' il codice, ne' il segno consegnato", async () => {
  const c = await catena();
  try {
    const { codice } = c.abbinamento.nuovo();
    c.chiamata.apriLAbbinamento(impronta(codice));
    await attendi(() => c.centralino.abbinamenti.size === 1);

    const telefono = telefonoCifrato(`${c.doveIlCentralino}/abbinamento/${impronta(codice)}`, {
      codice,
    });
    await telefono.dentro;
    telefono.conferma({ nome: "telefono nuovo", sistema: "ios" });
    const ecco = await telefono.aspetta("ecco");

    assert.match(ecco.segno, /^[0-9a-f]{64}$/);
    assert.match(ecco.chiave, /^[0-9a-f]{64}$/);
    assert.equal(c.dispositivi.quanti(), 1);

    const tutto = c.visto.join("\n");
    assert.equal(tutto.includes(codice), false, "il codice non e' passato");
    assert.equal(tutto.includes(ecco.segno), false, "ne' il segno appena consegnato");
    assert.equal(tutto.includes(ecco.chiave), false, "ne' la chiave del filo");
    /* L'impronta si', ed e' giusto: e' cio' su cui il centralino instrada. */
    assert.equal(c.centralino.abbinamenti.size, 0, "e l'attesa si e' chiusa");
  } finally {
    await c.spegni();
  }
});

test("il segno appena consegnato apre davvero la porta", async () => {
  const c = await catena();
  try {
    const { codice } = c.abbinamento.nuovo();
    c.chiamata.apriLAbbinamento(impronta(codice));
    await attendi(() => c.centralino.abbinamenti.size === 1);

    const abbinante = telefonoCifrato(`${c.doveIlCentralino}/abbinamento/${impronta(codice)}`, {
      codice,
    });
    await abbinante.dentro;
    abbinante.conferma({ nome: "telefono nuovo", sistema: "ios" });
    const ecco = await abbinante.aspetta("ecco");
    await abbinante.chiusa;

    /* Col segno e la chiave appena avuti si rientra dalla porta normale. */
    const telefono = telefonoCifrato(`${c.doveIlCentralino}/telefono/${c.identita.casa}`, {
      chi: ecco.dispositivo.id,
      chiave: ecco.chiave,
    });
    await telefono.dentro;
    await telefono.aspetta("auth_required");
    telefono.manda({ type: "auth", access_token: ecco.segno });
    assert.equal((await telefono.aspetta("auth_ok")).type, "auth_ok");
    telefono.chiudi();
  } finally {
    await c.spegni();
  }
});

test("un codice sbagliato non consegna niente", async () => {
  const c = await catena();
  try {
    const { codice } = c.abbinamento.nuovo();
    c.chiamata.apriLAbbinamento(impronta(codice));
    await attendi(() => c.centralino.abbinamenti.size === 1);

    /* Instradato giusto — l'impronta e' quella vera — ma con un altro codice
     * in mano: e' chi sta in mezzo, che l'impronta la conosce e il codice no.
     * La stretta di mano va, perche' e' in chiaro; la conferma non si apre. */
    const telefono = telefonoCifrato(`${c.doveIlCentralino}/abbinamento/${impronta(codice)}`, {
      codice: "SBAGLIATO2345678",
    });
    await telefono.dentro;
    telefono.conferma({ nome: "furbo" });
    await telefono.chiusa;

    const no = telefono.inChiaro.find((uno) => uno.no);
    assert.match(no.no, /codice sbagliato/);
    assert.equal(no.motivo, "codice");
    assert.equal(telefono.detti.length, 0, "nessuna busta per lui");
    assert.equal(c.dispositivi.quanti(), 0);
    assert.equal(c.abbinamento.stato().tentativiSbagliati, 1, "e il tentativo si e' contato");
  } finally {
    await c.spegni();
  }
});

test("una chiave del filo sbagliata non fa entrare", async () => {
  const c = await catena();
  try {
    const { dispositivo } = c.dispositivi.abbina({ nome: "telefono" });

    const telefono = telefonoCifrato(`${c.doveIlCentralino}/telefono/${c.identita.casa}`, {
      chi: dispositivo.id,
      chiave: "f".repeat(64),
    });
    await telefono.dentro;
    /* La stretta di mano riesce — e' in chiaro — ma le due punte arrivano a
     * due chiavi diverse, e la prima busta non si apre. Da tutte e due le
     * parti: il telefono non legge quello che gli manda la casa, e la casa non
     * legge quello che gli manda il telefono. */
    await telefono.chiusa;
    assert.match(String(telefono.guasta), /non si apre/);
    assert.equal(c.ha.prese.length, 0, "Home Assistant non e' stata disturbata");
  } finally {
    await c.spegni();
  }
});

test("un telefono che non si conosce si sente dire di riabbinarsi", async () => {
  const c = await catena();
  try {
    const telefono = telefonoCifrato(`${c.doveIlCentralino}/telefono/${c.identita.casa}`, {
      chi: "dm_inventato",
      chiave: "a".repeat(64),
    });
    await assert.rejects(telefono.dentro, /riabbina/);
    await telefono.chiusa;
  } finally {
    await c.spegni();
  }
});

test("chi rigioca una busta registrata non entra", async () => {
  const c = await catena();
  try {
    const { segno, chiave, dispositivo } = c.dispositivi.abbina({ nome: "telefono" });
    const telefono = telefonoCifrato(`${c.doveIlCentralino}/telefono/${c.identita.casa}`, {
      chi: dispositivo.id,
      chiave,
    });
    await telefono.dentro;
    await telefono.aspetta("auth_required");

    /* La busta con dentro l'autenticazione, presa dal filo e rimandata. */
    const bustaAutentica = c.visto.find((uno) => {
      try {
        return JSON.parse(uno).t === "d";
      } catch (_errore) {
        return false;
      }
    });
    telefono.manda({ type: "auth", access_token: segno });
    await telefono.aspetta("auth_ok");

    if (bustaAutentica) {
      telefono.mandaGrezzo(JSON.parse(bustaAutentica).m ?? bustaAutentica);
      await telefono.chiusa;
    }
  } finally {
    await c.spegni();
  }
});

test("sul disco del ponte c'e' l'impronta del segno, mai il segno", async () => {
  const c = await catena();
  try {
    const { segno, chiave } = c.dispositivi.abbina({ nome: "telefono" });
    const scritto = readFileSync(join(c.cartellaDelPonte, "dispositivi.json"), "utf8");

    assert.equal(scritto.includes(segno), false, "il segno non si scrive");
    assert.equal(scritto.includes(impronta(segno)), true, "l'impronta si'");
    /* La chiave del filo si', e non e' una svista: per cifrare serve la
     * chiave, non la sua impronta. Chi rubasse il file potrebbe leggere del
     * traffico registrato, ma non potrebbe entrare in casa. */
    assert.equal(scritto.includes(chiave), true);
  } finally {
    await c.spegni();
  }
});
