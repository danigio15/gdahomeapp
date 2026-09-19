/* Il quadro dice quando non riesce piu' ad aggiornarsi.
 *
 * E' il guasto che somiglia di piu' allo stare bene: il quadro risponde, le
 * case depositano, le pagine si aprono — e le correzioni hanno smesso di
 * arrivare settimane fa. Prima il giro degli aggiornamenti, quando non sapeva
 * che versione ci fosse, **usciva zitto**.
 *
 * Le due meta' di questa prova sono altrettanto importanti:
 *
 *  - che lo **dica** quando e' il caso;
 *  - che **taccia** quando non lo e'. Un avviso che si accende da solo una
 *    volta a settimana e' un avviso che dopo un mese nessuno guarda, ed e' lo
 *    stesso motivo per cui gli avvisi delle case tacciono quattro volte su
 *    cinque.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  comeVaLAggiornamento,
  DOPO_QUANTO,
  FOGLIETTO,
  laVersioneCheGira,
} from "../src/mi-aggiorno.js";

const ORA = 60 * 60 * 1000;

function banco() {
  const cartella = mkdtempSync(join(tmpdir(), "quadro-aggiorno-"));
  return {
    cartella,
    /** Come lo scrive `aggiorna.sh`: epoch in secondi, poi il perche'. */
    foglietto: (quando, perche = "GitHub non risponde") =>
      writeFileSync(join(cartella, FOGLIETTO), `${Math.floor(quando / 1000)}\n${perche}\n`),
    chiudi: () => rmSync(cartella, { recursive: true, force: true }),
  };
}

test("senza foglietto non si dice niente: e' il caso normale", () => {
  const b = banco();
  try {
    assert.equal(comeVaLAggiornamento({ cartella: b.cartella }), null);
  } finally {
    b.chiudi();
  }
});

test("un giro andato storto da poco non si dice", () => {
  /* Dieci minuti: un solo tentativo. GitHub ha i suoi minuti storti. */
  const b = banco();
  const adesso = Date.parse("2026-09-19T12:00:00Z");
  try {
    b.foglietto(adesso - 10 * 60 * 1000);
    assert.equal(comeVaLAggiornamento({ cartella: b.cartella, adesso: () => adesso }), null);
  } finally {
    b.chiudi();
  }
});

test("dopo un'ora — sei giri di fila — si dice, e si dice da quando", () => {
  const b = banco();
  const adesso = Date.parse("2026-09-19T12:00:00Z");
  const primo = adesso - 5 * ORA;
  try {
    b.foglietto(primo, "il segno non c'e' piu'");
    const detto = comeVaLAggiornamento({ cartella: b.cartella, adesso: () => adesso });
    assert.ok(detto, "ha taciuto dopo cinque ore");
    assert.equal(detto.ore, 5);
    assert.equal(detto.perche, "il segno non c'e' piu'");
    assert.equal(Date.parse(detto.da), primo, "la data non e' quella del primo fallimento");
  } finally {
    b.chiudi();
  }
});

test("il limite e' quello dichiarato, non uno a caso", () => {
  const b = banco();
  const adesso = Date.parse("2026-09-19T12:00:00Z");
  try {
    b.foglietto(adesso - DOPO_QUANTO + 1000);
    assert.equal(
      comeVaLAggiornamento({ cartella: b.cartella, adesso: () => adesso }),
      null,
      "un secondo prima",
    );
    b.foglietto(adesso - DOPO_QUANTO - 1000);
    assert.ok(
      comeVaLAggiornamento({ cartella: b.cartella, adesso: () => adesso }),
      "un secondo dopo",
    );
  } finally {
    b.chiudi();
  }
});

test("un foglietto illeggibile non fa dire bugie, e non fa cadere niente", () => {
  /* Meglio tacere che dire «non mi aggiorno da 57 anni» perche' dentro c'era
   * una riga vuota. */
  const b = banco();
  try {
    for (const dentro of ["", "\n\n", "ciao\nGitHub", "-1\nboh", "0\n"]) {
      writeFileSync(join(b.cartella, FOGLIETTO), dentro);
      assert.equal(comeVaLAggiornamento({ cartella: b.cartella }), null, `con «${dentro}»`);
    }
  } finally {
    b.chiudi();
  }
});

test("senza un perche' scritto, si dice lo stesso che non si aggiorna", () => {
  const b = banco();
  const adesso = Date.parse("2026-09-19T12:00:00Z");
  try {
    writeFileSync(join(b.cartella, FOGLIETTO), `${Math.floor((adesso - 3 * ORA) / 1000)}\n`);
    const detto = comeVaLAggiornamento({ cartella: b.cartella, adesso: () => adesso });
    assert.ok(detto);
    assert.equal(detto.perche, "non si sa");
  } finally {
    b.chiudi();
  }
});

/* ─── Quale versione gira ─────────────────────────────────────────────────
 *
 * «Verifica che il quadro si sia aggiornato.»
 *
 * Non si poteva. Da nessuna parte: `/salute` diceva solo di essere vivo, la
 * soglia e' un testo fisso, e le pagine mostrano la versione **delle case**,
 * non la sua. Restava entrare nella macchina a leggere un registro — cioe' la
 * cosa che questo quadro esiste apposta per non dover fare.
 *
 * Il numero c'era gia': `accendi.sh` lo scrive quando scambia il codice, e lo
 * scrive **dopo** che le prove di quella versione sono passate. Mancava solo
 * qualcuno che lo leggesse.
 */

test("il quadro dice quale versione sta girando", () => {
  const cartella = mkdtempSync(join(tmpdir(), "versione-"));
  try {
    const dove = join(cartella, "versione");
    writeFileSync(dove, `${"a".repeat(40)}\n`, "utf8");
    /* Sette cifre e non quaranta: e' un numero che qualcuno legge e confronta
     * a occhio con quello dell'ultimo rilascio. */
    assert.equal(laVersioneCheGira({ dove }), "aaaaaaa");
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("un quadro fatto partire a mano non dice una versione inventata", () => {
  const cartella = mkdtempSync(join(tmpdir(), "versione-"));
  try {
    /* Il file non c'e': e' il caso di chi lo sta scrivendo sul banco, e non e'
     * un guasto. Meglio non dire niente che dire un numero finto — questo
     * numero serve proprio a fidarsi. */
    assert.equal(laVersioneCheGira({ dove: join(cartella, "versione") }), "");
    /* E quello che c'e' dentro deve essere un commit, non una riga qualunque:
     * un file mezzo scritto, o scritto da qualcun altro, non diventa una
     * versione. */
    const dove = join(cartella, "versione");
    for (const roba of ["", "  ", "non-un-commit", "aaa", `${"a".repeat(41)}`, "ZZZ"]) {
      writeFileSync(dove, roba, "utf8");
      assert.equal(laVersioneCheGira({ dove }), "", `«${roba}» e' passata per una versione`);
    }
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("una risposta si legge in un terminale senza incollarsi al prompt", async () => {
  /* `/salute` si guarda col curl da un terminale — lo dice il README, ed e' la
   * prima cosa che si fa dopo aver acceso la macchina. Senza l'a capo in fondo
   * la risposta finisce attaccata al prompt della riga dopo, e su un telefono
   * sembra che non abbia risposto niente. */
  const { alzaIlQuadro } = await import("../src/index.js");
  const cartella = mkdtempSync(join(tmpdir(), "salute-"));
  const acceso = await alzaIlQuadro({ porta: 0, cartella, livello: "errore" });
  try {
    const presa = await fetch(`http://127.0.0.1:${acceso.porta}/salute`);
    const testo = await presa.text();
    assert.ok(testo.endsWith("\n"), "la risposta si incolla al prompt della riga dopo");
    /* E resta JSON valido: l'a capo lo ignorano tutti. */
    assert.equal(JSON.parse(testo).vivo, true);
    /* La lunghezza dichiarata conta i byte veri, a capo compreso: se no il
     * browser aspetta un byte che non arriva mai, o ne taglia uno. */
    assert.equal(
      Number(presa.headers.get("content-length")),
      Buffer.byteLength(testo),
      "content-length non conta l'a capo",
    );
  } finally {
    await acceso.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});
