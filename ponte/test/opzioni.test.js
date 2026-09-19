/* Le prove di come si leggono le opzioni della scheda dell'add-on.
 *
 * Qui dentro c'e' una regola che decide **chi vede cosa**, e prima non era
 * provata da niente: il cruscotto dell'installatore e la gestione del quadro
 * esistono solo se c'e' la loro chiave. Un interruttore acceso senza chiave
 * non e' una porta chiusa — non e' una porta.
 *
 * Si prova leggendo un `options.json` vero da una cartella vera, perche' e'
 * quello che fa il Supervisor: le variabili d'ambiente sono per il banco, e
 * provare solo quelle vorrebbe dire provare la strada che in casa di nessuno
 * viene percorsa.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { leggiLeOpzioni } from "../src/opzioni.js";

/* Una cartella con dentro l'`options.json` che ci si scrive, come la scrive il
 * Supervisor. */
function scheda(t, cosa) {
  const cartella = mkdtempSync(join(tmpdir(), "opzioni-"));
  t.after(() => rmSync(cartella, { recursive: true, force: true }));
  writeFileSync(join(cartella, "options.json"), JSON.stringify(cosa));
  return leggiLeOpzioni(cartella);
}

test("una scheda vuota non accende niente di tutto questo", (t) => {
  const o = scheda(t, {});
  assert.equal(o.installatore, false);
  assert.equal(o.gestore, false);
  assert.equal(o.chiaveDelCruscotto, "");
  assert.equal(o.chiaveDellaGestione, "");
});

test("l'interruttore dell'installatore, senza il codice, non apre niente", (t) => {
  /* E' il caso che ha fatto cambiare la regola: acceso per curiosita', o
   * acceso in casa di un cliente. Prima compariva comunque una sezione nella
   * console e una voce nella barra laterale — porte che non si aprivano, ma
   * che si vedevano. */
  const o = scheda(t, { installatore: true });
  assert.equal(o.installatore, false, "senza codice non e' acceso, qualunque cosa dica la casella");
});

test("il codice dell'installatore, senza l'interruttore, nemmeno", (t) => {
  /* L'altra meta': chi incolla un codice e non accende non ha chiesto niente.
   * Servono tutt'e due, e in nessun ordine una sola basta. */
  const o = scheda(t, { chiave_cruscotto: "K7M2-9XQF-3BHT-R4VN" });
  assert.equal(o.installatore, false);
  assert.equal(o.chiaveDelCruscotto, "K7M2-9XQF-3BHT-R4VN", "il codice si legge lo stesso");
});

test("interruttore e codice insieme: adesso si', e il codice arriva a chi lo usa", (t) => {
  const o = scheda(t, { installatore: true, chiave_cruscotto: "K7M2-9XQF-3BHT-R4VN" });
  assert.equal(o.installatore, true);
  assert.equal(o.chiaveDelCruscotto, "K7M2-9XQF-3BHT-R4VN");
});

test("la gestione non ha nessun interruttore: la chiave e' l'interruttore", (t) => {
  /* `gestore: true` e' quello che si ritrova scritto chi aggiorna da una
   * versione in cui la casella c'era. Non deve contare piu' niente: era un
   * interruttore su case che non c'entravano, ed e' il motivo per cui e'
   * stato tolto. */
  assert.equal(scheda(t, { gestore: true }).gestore, false, "la casella vecchia non conta piu'");
  assert.equal(scheda(t, { chiave_gestione: "GG-1234-ABCD-5678" }).gestore, true);
});

test("uno spazio incollato per sbaglio non fa fallire una chiave", (t) => {
  /* Queste si copiano da un messaggio o da una mail, e uno spazio in fondo e'
   * il modo piu' comune di ritrovarsi una chiave «scritta» che non apre
   * niente. Meglio toglierlo qui che spiegarlo al telefono. */
  const o = scheda(t, {
    installatore: true,
    chiave_cruscotto: "  K7M2-9XQF-3BHT-R4VN\n",
    chiave_gestione: " GG-1234-ABCD-5678 ",
  });
  assert.equal(o.installatore, true);
  assert.equal(o.chiaveDelCruscotto, "K7M2-9XQF-3BHT-R4VN");
  assert.equal(o.chiaveDellaGestione, "GG-1234-ABCD-5678");
  assert.equal(o.gestore, true);
});

test("una chiave fatta di soli spazi e' una chiave vuota", (t) => {
  const o = scheda(t, { installatore: true, chiave_cruscotto: "   ", chiave_gestione: "\t\n" });
  assert.equal(o.installatore, false);
  assert.equal(o.gestore, false);
});

/* ─── Le sezioni, e la scheda di prima ─────────────────────────────────────
 *
 * Dalla 1.5.8 le caselle sono annidate — `casa:`, `chi_installa:` — perche' e'
 * l'unico modo che Home Assistant abbia di disegnare un titolo. Tutto il resto
 * di `opzioni.js` continua a leggere nomi piatti: in mezzo c'e' `appiattisci`,
 * e sta in un posto solo.
 *
 * Il Supervisor, aggiornando, potrebbe tenersi le caselle vecchie o buttarle:
 * da qui non si sa. Se se le tiene, queste prove sono quello che fa si' che
 * una casa gia' accesa continui a mandare il suo rapporto senza che nessuno
 * tocchi niente.
 */

test("le caselle a sezioni si leggono come si leggevano quelle piatte", (t) => {
  const o = scheda(t, {
    casa: {
      da_fuori_casa: false,
      quadro: "K7M2-9XQF-3BHT-R4VN",
      quadro_ogni: 7,
      quadro_manutenzione: true,
      minuti_del_codice: 9,
      giorni_di_silenzio: 30,
      dispositivi_massimi: 4,
    },
    chi_installa: { acceso: true, chiave: "K7M2-9XQF-3BHT-R4VN" },
    gestione: { chiave: "una-chiave-del-gestore" },
    assistenza: { chiave: "una-chiave-della-console" },
    avanzate: { porta_app: 9000, registro: "debug" },
  });
  assert.equal(o.centralino, "", "«da fuori casa» spento non e' arrivato");
  assert.ok(o.quadro, "il codice del quadro non e' arrivato");
  assert.equal(o.quadroOgni, 7);
  assert.equal(o.manutenzione, true);
  assert.equal(o.minutiDelCodice, 9);
  assert.equal(o.giorniDiSilenzio, 30);
  assert.equal(o.dispositiviMassimi, 4);
  assert.equal(o.installatore, true);
  assert.equal(o.gestore, true);
  assert.equal(o.chiaveDellaConsole, "una-chiave-della-console");
  assert.equal(o.portaDellApp, 9000);
  assert.equal(o.registro, "debug");
});

test("una casa ferma alla scheda piatta continua a funzionare", (t) => {
  /* E' la casa di chi aggiorna: se il Supervisor si tiene le caselle di
   * prima, qui non si rompe niente e non c'e' niente da rimettere a mano. */
  const o = scheda(t, {
    quadro: "K7M2-9XQF-3BHT-R4VN",
    quadro_manutenzione: true,
    installatore: true,
    chiave_cruscotto: "K7M2-9XQF-3BHT-R4VN",
    chiave_gestione: "una-chiave-del-gestore",
    porta_app: 9000,
  });
  assert.ok(o.quadro);
  assert.equal(o.manutenzione, true);
  assert.equal(o.installatore, true);
  assert.equal(o.gestore, true);
  assert.equal(o.portaDellApp, 9000);
});

test("dove c'e' la sezione, e' la sezione che vale", (t) => {
  /* Le due forme insieme succedono una volta sola: subito dopo
   * l'aggiornamento, se il Supervisor si e' tenuto le vecchie. Quella nuova
   * e' quella che si sta guardando nella scheda, e deve essere quella che
   * conta — se no si cambia una casella e non cambia niente. */
  const o = scheda(t, {
    quadro_ogni: 60,
    casa: { quadro_ogni: 3 },
    installatore: true,
    chi_installa: { acceso: false, chiave: "K7M2-9XQF-3BHT-R4VN" },
  });
  assert.equal(o.quadroOgni, 3);
  assert.equal(o.installatore, false, "la sezione dice spento e la casella vecchia vince");
});

test("una sezione che dice «vuoto» o «spento» e' una risposta, non un silenzio", (t) => {
  /* `""` e `false` sono scelte. Se contassero come «non detto», svuotare una
   * casella non la svuoterebbe: tornerebbe quello che c'era scritto nella
   * scheda vecchia, e chi l'ha svuotata non capirebbe perche'. */
  const o = scheda(t, {
    quadro: "K7M2-9XQF-3BHT-R4VN",
    quadro_manutenzione: true,
    casa: { quadro: "", quadro_manutenzione: false },
  });
  assert.equal(o.quadro, null, "il codice svuotato e' tornato indietro da solo");
  assert.equal(o.manutenzione, false);
});

test("una sezione storta non fa cadere niente", (t) => {
  const o = scheda(t, { casa: "non un gruppo", chi_installa: null, avanzate: 7 });
  assert.equal(o.installatore, false);
  assert.equal(o.portaDellApp, 8098);
});
