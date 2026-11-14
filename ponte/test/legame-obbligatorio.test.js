/* Il legame obbligatorio: un telefono che ha legato una volta lega sempre.
 *
 * Il legame (`lega: 1`, vedi `cifra.js`) mette le due righe in chiaro della
 * stretta di mano dentro la chiave. Chi sta in mezzo poteva toglierlo dalla
 * prima riga del telefono: la casa rispondeva come una casa di prima, e la
 * chiave tornava quella che non guarda le righe. Il telefono se ne accorge
 * se si ricorda che quella casa lega; la casa, fino a qui, non si ricordava
 * niente.
 *
 * Adesso se lo ricorda la casa, telefono per telefono, nel suo archivio:
 * appena una busta del telefono si apre con una chiave legata — prova che il
 * `lega` l'ha scritto lui e non chi sta in mezzo — da li' in poi una stretta
 * senza `lega` di quel telefono non passa. Chi si abbina col legame lo
 * ricorda subito. E nell'«ecco» dell'abbinamento, che e' cifrato con il
 * codice e chi sta in mezzo non lo puo' scrivere, la casa dice che sa
 * legare: il telefono se lo scrive prima ancora del primo collegamento.
 *
 * Un'app di prima, che il legame non lo chiede mai, non viene segnata e
 * continua a entrare.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Abbinamento } from "../src/abbinamento.js";
import {
  aperturaNuova,
  Busta,
  chiaveDiSessione,
  coppiaEffimera,
  improntaDellaStretta,
  VERSIONE,
  VERSIONE_DEL_LEGAME,
  VERSIONE_DELL_ABBINAMENTO,
} from "../src/cifra.js";
import { Dispositivi } from "../src/dispositivi.js";
import { Portiere } from "../src/portiere.js";

const giro = () => new Promise((ok) => setImmediate(ok));

function presaFinta() {
  const presa = {
    mandati: [],
    chiusa: null,
    onMessaggio() {},
    onChiusa() {},
    manda(testo) {
      presa.mandati.push(testo);
      return true;
    },
    chiudi(codice, motivo) {
      if (presa.chiusa) return;
      presa.chiusa = { codice, motivo };
      presa.onChiusa();
    },
    arriva(testo) {
      presa.onMessaggio(testo);
    },
    get inChiaro() {
      return presa.mandati.filter((uno) => uno.startsWith("{")).map((uno) => JSON.parse(uno));
    },
  };
  return presa;
}

/* Una casa con un archivio vero dei telefoni, su una cartella sua. */
function unaCasa(t, cartella = null) {
  const dove = cartella ?? mkdtempSync(join(tmpdir(), "ponte-legame-"));
  if (!cartella) t.after(() => rmSync(dove, { recursive: true, force: true }));
  const dispositivi = new Dispositivi({ cartella: dove });
  const abbinamento = new Abbinamento({});
  const accolti = [];
  const portiere = new Portiere({
    ponte: { accogli: (presa, come) => accolti.push({ presa, come }) },
    dispositivi,
    abbinamento,
    registro: null,
  });
  return { dove, dispositivi, abbinamento, portiere, accolti };
}

/* Un telefono fatto a mano, come in `portiere.test.js`: `perStrada.ciao` e'
 * chi sta in mezzo e riscrive la prima riga. */
function unTelefono(
  presa,
  { codice = null, chiaveDelFilo = null, chi = null, lega, perStrada = {} },
) {
  const mia = coppiaEffimera();
  const apertura = aperturaNuova();
  const ciao = JSON.stringify({
    v: VERSIONE,
    ...(codice != null ? { abbina: VERSIONE_DELL_ABBINAMENTO } : { chi }),
    apertura: apertura.toString("base64"),
    mia: mia.pubblica.toString("base64"),
    ...(lega ? { lega: VERSIONE_DEL_LEGAME } : {}),
  });
  presa.arriva(perStrada.ciao ? perStrada.ciao(ciao) : ciao);
  const riga = presa.mandati.find((uno) => uno.startsWith("{") && JSON.parse(uno).pronto);
  if (!riga) return { pronto: null, no: presa.inChiaro.find((uno) => uno.no) ?? null };
  const pronto = JSON.parse(riga);
  /* Il telefono lega se l'ha chiesto lui e la casa l'ha ripetuto. */
  const legata = Boolean(lega) && pronto.lega === VERSIONE_DEL_LEGAME;
  const chiave = chiaveDiSessione({
    miaPrivata: mia.privata,
    suaPubblica: pronto.mia,
    delTelefono: mia.pubblica,
    dellaCasa: Buffer.from(pronto.mia, "base64"),
    apertura,
    ...(codice != null ? { codice } : { chiaveDelFilo }),
    stretta: legata ? improntaDellaStretta(ciao, riga) : null,
  });
  const busta = new Busta(chiave, { io: "telefono" });
  return {
    pronto,
    legata,
    mia: mia.pubblica.toString("base64"),
    sua: pronto.mia,
    manda: (cosa) => presa.arriva(busta.chiudi(JSON.stringify(cosa))),
    lette: () =>
      presa.mandati.filter((uno) => !uno.startsWith("{")).map((uno) => JSON.parse(busta.apri(uno))),
  };
}

const togliIlLegame = (riga) => riga.replace(`,"lega":${VERSIONE_DEL_LEGAME}`, "");

/* Un telefono gia' abbinato, che si collega: torna il telefono e se la casa
 * l'ha fatto entrare. Con `parla` manda una busta, come fa l'app con `auth`. */
function siCollega(casa, { chi, chiave, lega = true, perStrada = {}, parla = true }) {
  const presa = presaFinta();
  const prima = casa.accolti.length;
  casa.portiere.accogli(presa, { da: "192.168.1.20" });
  const telefono = unTelefono(presa, { chi, chiaveDelFilo: chiave, lega, perStrada });
  if (telefono.pronto && parla) telefono.manda({ type: "auth", access_token: "x" });
  return { presa, telefono, entrato: casa.accolti.length > prima };
}

function unTelefonoAbbinatoAMano(casa) {
  const { dispositivo, chiave } = casa.dispositivi.abbina({ nome: "Pixel", sistema: "android" });
  return { chi: dispositivo.id, chiave };
}

test("un telefono che ha legato una volta: chi toglie il legame non entra piu'", (t) => {
  const casa = unaCasa(t);
  const { chi, chiave } = unTelefonoAbbinatoAMano(casa);

  const prima = siCollega(casa, { chi, chiave });
  assert.equal(prima.entrato, true);
  assert.equal(prima.telefono.legata, true);

  /* Chi sta in mezzo toglie il `lega` dalla prima riga. */
  const dopo = siCollega(casa, { chi, chiave, perStrada: { ciao: togliIlLegame } });
  assert.equal(dopo.entrato, false, "la stretta senza legame non deve passare");
  assert.equal(dopo.telefono.pronto, null);
  assert.equal(dopo.telefono.no?.motivo, "legame");
  assert.equal(dopo.presa.chiusa?.codice, 1008);
});

test("e se lo ricorda anche dopo un riavvio del ponte", (t) => {
  const casa = unaCasa(t);
  const { chi, chiave } = unTelefonoAbbinatoAMano(casa);
  assert.equal(siCollega(casa, { chi, chiave }).entrato, true);

  const riavviata = unaCasa(t, casa.dove);
  const dopo = siCollega(riavviata, { chi, chiave, perStrada: { ciao: togliIlLegame } });
  assert.equal(dopo.entrato, false);
});

test("una stretta legata che non arriva a una busta aperta non segna niente", (t) => {
  /* Il `lega` lo puo' aggiungere per strada anche chi sta in mezzo, alla riga
   * di un'app di prima: la casa lega, l'app no, e la prima busta non si apre.
   * Quel telefono non va chiuso fuori per sempre. */
  const casa = unaCasa(t);
  const { chi, chiave } = unTelefonoAbbinatoAMano(casa);
  const aggiunto = siCollega(casa, {
    chi,
    chiave,
    lega: false,
    perStrada: { ciao: (riga) => riga.replace(/}$/, `,"lega":${VERSIONE_DEL_LEGAME}}`) },
  });
  assert.equal(aggiunto.entrato, true, "la stretta in chiaro e' andata");
  assert.equal(aggiunto.presa.chiusa?.codice, 1008, "ma la prima busta non si e' aperta");

  const dopo = siCollega(casa, { chi, chiave, lega: false });
  assert.equal(dopo.entrato, true, "l'app di prima rientra come sempre");
  assert.equal(dopo.presa.chiusa, null);
});

test("un'app di prima, che non lega mai, entra sempre", (t) => {
  const casa = unaCasa(t);
  const { chi, chiave } = unTelefonoAbbinatoAMano(casa);
  for (let volta = 0; volta < 3; volta += 1) {
    const giro = siCollega(casa, { chi, chiave, lega: false });
    assert.equal(giro.entrato, true);
    assert.equal(giro.presa.chiusa, null);
  }
});

test("una stretta legata senza nemmeno una busta non segna niente", (t) => {
  const casa = unaCasa(t);
  const { chi, chiave } = unTelefonoAbbinatoAMano(casa);
  assert.equal(siCollega(casa, { chi, chiave, parla: false }).entrato, true);
  assert.equal(siCollega(casa, { chi, chiave, lega: false }).entrato, true);
});

async function siAbbina(casa, { lega, perStrada = {} }) {
  const { codice } = casa.abbinamento.nuovo();
  const presa = presaFinta();
  casa.portiere.accogli(presa, { da: "192.168.1.20" });
  const telefono = unTelefono(presa, { codice, lega, perStrada });
  telefono.manda({ t: "conferma", telefono: telefono.mia, casa: telefono.sua, nome: "Pixel" });
  await giro();
  await giro();
  const ecco = telefono.lette().find((uno) => uno.t === "ecco");
  return { ecco, telefono };
}

test("abbinandosi col legame, la casa lo ricorda da subito", async (t) => {
  const casa = unaCasa(t);
  const { ecco, telefono } = await siAbbina(casa, { lega: true });
  assert.equal(telefono.legata, true);
  assert.equal(ecco.lega, VERSIONE_DEL_LEGAME, "nell'ecco cifrato la casa dice che lega");

  /* Il primo collegamento dopo l'abbinamento e' proprio quello che chi sta in
   * mezzo proverebbe a scoprire. */
  const primo = siCollega(casa, {
    chi: ecco.dispositivo.id,
    chiave: ecco.chiave,
    perStrada: { ciao: togliIlLegame },
  });
  assert.equal(primo.entrato, false);
});

test("abbinandosi senza legame — un'app di prima — l'ecco lo dice lo stesso e non chiude fuori nessuno", async (t) => {
  const casa = unaCasa(t);
  const { ecco } = await siAbbina(casa, { lega: false });
  /* Un'app di prima il campo in piu' non lo guarda; un'app di adesso a cui
   * avessero tolto il `lega` per strada se lo scrive. */
  assert.equal(ecco.lega, VERSIONE_DEL_LEGAME);
  const dopo = siCollega(casa, { chi: ecco.dispositivo.id, chiave: ecco.chiave, lega: false });
  assert.equal(dopo.entrato, true);
});

test("il legame non esce dall'elenco dei telefoni e non cambia il resto", (t) => {
  const casa = unaCasa(t);
  const { chi, chiave } = unTelefonoAbbinatoAMano(casa);
  siCollega(casa, { chi, chiave });
  const [uno] = casa.dispositivi.elenco();
  assert.equal(uno.id, chi);
  assert.equal(casa.dispositivi.chiaveDi(chi), chiave);
});
