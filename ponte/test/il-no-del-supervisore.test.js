/* Il «no» del Supervisor, detto in italiano.
 *
 * Nasce da una segnalazione arrivata in Assistenza: un utente non riusciva ad
 * aggiornare e leggeva una frase in inglese che non gli diceva cosa fare.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { comeDirlo, ilNoDelSupervisore } from "../src/il-no-del-supervisore.js";

/* Le parole vere, come le ha lette lui. */
const QUELLA_VERA =
  "Error updating gdahome: 'AddonManager.update' blocked from execution, no host internet connection";

test("la segnalazione del 26 settembre si legge e si capisce", () => {
  const detto = ilNoDelSupervisore(QUELLA_VERA);
  assert.ok(detto, "questo rifiuto lo riconosciamo");
  assert.match(detto.perche, /non ha internet/);
  assert.match(detto.cosaFare, /DNS/);
  assert.match(detto.cosaFare, /ha dns reset/);
});

test("le parole di Home Assistant restano in coda", () => {
  /* Chi cerca aiuto in rete ha bisogno della frase esatta: toglierla
   * renderebbe il guasto piu' difficile da raccontare, non piu' facile. */
  const frase = comeDirlo(QUELLA_VERA);
  assert.ok(frase.includes("'AddonManager.update' blocked from execution"));
  assert.ok(frase.startsWith("Home Assistant dice che questa casa non ha internet"));
});

test("il nome dell'add-on non c'entra: e' solo quello che si stava aggiornando", () => {
  /* Premendo aggiorna su un altro add-on la frase e' la stessa, col suo nome:
   * il difetto non e' del pacchetto, e la spiegazione non deve cambiare. */
  const nostra = ilNoDelSupervisore(QUELLA_VERA);
  const altrui = ilNoDelSupervisore(
    "Error updating mosquitto: 'AddonManager.update' blocked from execution, no host internet connection",
  );
  assert.deepEqual(altrui, nostra);
});

test("gli altri motivi del Supervisor, quelli che abbiamo letto nel suo codice", () => {
  const casi = [
    ["no supervisor internet connection", /non riesce ad arrivare fuori/],
    ["not enough free space (0.5GB) left on the device", /non c'è più spazio/],
    ["system is not healthy - unsupported_os", /non in salute/],
    ["system is not running - STARTUP", /sta ancora partendo/],
    ["supervisor needs to be updated first", /Prima va aggiornato il Supervisor/],
    ["host Network Manager not available", /gestore di rete/],
  ];
  for (const [motivo, atteso] of casi) {
    const detto = ilNoDelSupervisore(`'AddonManager.update' blocked from execution, ${motivo}`);
    assert.ok(detto, `«${motivo}» va riconosciuto`);
    assert.match(detto.perche, atteso);
  }
});

test("i pezzi che cambiano dentro la frase non fanno perdere l'aggancio", () => {
  /* Lo spazio libero e lo stato del sistema il Supervisor li scrive dentro la
   * riga, e cambiano a ogni casa: se si cercasse la frase intera non si
   * aggancerebbe mai. */
  for (const quanti of ["0.1GB", "12.5GB", "3GB"]) {
    const detto = ilNoDelSupervisore(
      `'AddonManager.update' blocked from execution, not enough free space (${quanti}) left on the device`,
    );
    assert.ok(detto, `con ${quanti} si riconosce lo stesso`);
  }
});

test("quello che non e' suo passa com'era", () => {
  /* Meglio l'inglese giusto di un italiano inventato: un no che non viene dal
   * Supervisor, o un suo motivo che non conosciamo, non si tocca. */
  assert.equal(ilNoDelSupervisore("Unauthorized"), null);
  assert.equal(ilNoDelSupervisore("Entity update.qualcosa not found"), null);
  assert.equal(ilNoDelSupervisore(""), null);
  assert.equal(ilNoDelSupervisore(null), null);
  assert.equal(comeDirlo("Unauthorized"), null);
  /* Un rifiuto suo, ma per un motivo che non abbiamo in elenco. */
  assert.equal(
    ilNoDelSupervisore("'AddonManager.update' blocked from execution, qualcosa che non conosciamo"),
    null,
  );
});

test("vale per qualunque operazione, non solo per l'aggiornamento", () => {
  /* La forma e' del Supervisor, non del comando: `'<Qualcosa.metodo>'`. */
  const detto = ilNoDelSupervisore(
    "'Backups.do_backup_full' blocked from execution, not enough free space (0.2GB) left on the device",
  );
  assert.ok(detto);
  assert.match(detto.perche, /non c'è più spazio/);
});
