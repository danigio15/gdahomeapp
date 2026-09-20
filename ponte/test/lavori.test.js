/* Il lavoro che il quadro chiede, e chi dice di no.
 *
 * E' il pezzo con cui una macchina di fuori fa succedere qualcosa dentro casa
 * di qualcuno, quindi le prove che contano sono quelle dei **no**: la
 * manutenzione chiusa, un verbo che non e' quello, un salto di versione che
 * non torna piu'. Il si' e' una riga; i no sono il prodotto.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Lavori, TROPPO_TEMPO, UN_RIAVVIO_CI_METTE } from "../src/lavori.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };

const UNO = {
  nome: "Shelly Plus",
  da: "1.2.0",
  a: "1.3.0",
  entita: "update.shelly",
  stacca: false,
};

/* Chi sa installare, finto: si ricorda cosa gli e' stato chiesto. */
function aggiornamentiFinti({ fila = [UNO], quandoInstalla = null, quandoRiavvia = null } = {}) {
  const installati = [];
  let riavvii = 0;
  return {
    installati,
    get riavvii() {
      return riavvii;
    },
    async elenco() {
      return fila;
    },
    async installa(entita) {
      installati.push(entita);
      if (quandoInstalla) return quandoInstalla(entita);
      return { avviato: true, gia: false, stacca: false };
    },
    async riavvia() {
      riavvii += 1;
      if (quandoRiavvia) return quandoRiavvia();
      return { avviato: true };
    },
  };
}

const comando = (piu = {}) => ({
  id: "abc-123",
  cosa: "installa",
  nome: "Shelly Plus",
  da: "1.2.0",
  a: "1.3.0",
  ...piu,
});

test("con la manutenzione aperta, quello che il quadro chiede parte", async () => {
  const quali = aggiornamentiFinti();
  const lavori = new Lavori({ aggiornamenti: quali, registro: ZITTO, aperta: () => true });
  await lavori.fai(comando());
  assert.deepEqual(quali.installati, ["update.shelly"]);
  const stato = lavori.stato([UNO]);
  assert.equal(stato.stato, "in corso");
  assert.equal(stato.cosa, "Shelly Plus 1.2.0 → 1.3.0");
});

test("con la manutenzione chiusa non parte niente, e si scrive perche'", async () => {
  /* Il no che conta e' questo: il quadro quel comando non dovrebbe nemmeno
   * mandarlo, ma se lo mandasse lo stesso — un quadro rifatto, uno sbaglio, un
   * giorno storto — la risposta viene da qui, da dentro casa. */
  const quali = aggiornamentiFinti();
  const lavori = new Lavori({ aggiornamenti: quali, registro: ZITTO, aperta: () => false });
  await lavori.fai(comando());
  assert.deepEqual(quali.installati, []);
  const stato = lavori.stato([UNO]);
  assert.equal(stato.stato, "non riuscito");
  assert.match(stato.perche, /manutenzione/);
});

test("un verbo che non e' «installa» ne' «riavvia» non si esegue", async () => {
  /* Non e' un canale per comandi: sono quei due comandi li'. */
  const quali = aggiornamentiFinti();
  const lavori = new Lavori({ aggiornamenti: quali, registro: ZITTO, aperta: () => true });
  for (const cosa of ["spegni", "call_service", "", "installa_tutto", "riavvia_tutto"]) {
    await lavori.fai(comando({ cosa, id: `id-${cosa}` }));
  }
  assert.deepEqual(quali.installati, []);
  assert.equal(quali.riavvii, 0);
  assert.equal(lavori.stato([UNO]), null);
});

test("«riavvia» riavvia Home Assistant, e dice che il filo cade", async () => {
  const quali = aggiornamentiFinti();
  const lavori = new Lavori({ aggiornamenti: quali, registro: ZITTO, aperta: () => true });
  await lavori.fai({ id: "r-1", cosa: "riavvia" });
  assert.equal(quali.riavvii, 1);
  assert.deepEqual(quali.installati, [], "un riavvio non installa niente");
  const stato = lavori.stato([UNO]);
  assert.equal(stato.stato, "in corso");
  assert.equal(stato.stacca, true, "il filo cade: va detto prima, o la casa sembra morta");
  assert.equal(stato.cosa, "riavvio di Home Assistant");
  assert.equal(stato.riavvio, true);
});

test("un riavvio e' fatto quando la casa risponde di nuovo, passato il tempo di spegnersi", async () => {
  /* Home Assistant non dice «sono tornato»: risponde di nuovo, e basta. Un
   * elenco letto subito potrebbe essere l'ultimo di uno che sta chiudendo;
   * letto dopo il tempo che ci mette a spegnersi, e' uno che e' tornato. */
  let ora = 1_000_000;
  const quali = aggiornamentiFinti();
  const lavori = new Lavori({
    aggiornamenti: quali,
    registro: ZITTO,
    aperta: () => true,
    adesso: () => ora,
  });
  await lavori.fai({ id: "r-2", cosa: "riavvia" });
  assert.equal(lavori.stato([UNO]).stato, "in corso", "subito dopo non e' ancora tornato");
  ora += UN_RIAVVIO_CI_METTE / 2;
  assert.equal(lavori.stato(null).stato, "in corso", "senza elenco non si giudica");
  ora += UN_RIAVVIO_CI_METTE;
  assert.equal(
    lavori.stato(null).stato,
    "in corso",
    "il tempo da solo non basta: serve una risposta",
  );
  assert.equal(lavori.stato([UNO]).stato, "fatto");
});

test("con la manutenzione chiusa nemmeno il riavvio parte", async () => {
  const quali = aggiornamentiFinti();
  const lavori = new Lavori({ aggiornamenti: quali, registro: ZITTO, aperta: () => false });
  await lavori.fai({ id: "r-3", cosa: "riavvia" });
  assert.equal(quali.riavvii, 0);
  const stato = lavori.stato([UNO]);
  assert.equal(stato.stato, "non riuscito");
  assert.match(stato.perche, /manutenzione/);
});

test("un riavvio che Home Assistant rifiuta si scrive com'e' andato", async () => {
  const quali = aggiornamentiFinti({
    quandoRiavvia: () => {
      throw new Error("permesso negato");
    },
  });
  const lavori = new Lavori({ aggiornamenti: quali, registro: ZITTO, aperta: () => true });
  await lavori.fai({ id: "r-4", cosa: "riavvia" });
  const stato = lavori.stato([UNO]);
  assert.equal(stato.stato, "non riuscito");
  assert.match(stato.perche, /permesso negato/);
});

test("lo stesso riavvio chiesto due volte parte una volta sola", async () => {
  const quali = aggiornamentiFinti();
  const lavori = new Lavori({ aggiornamenti: quali, registro: ZITTO, aperta: () => true });
  await lavori.fai({ id: "r-5", cosa: "riavvia" });
  await lavori.fai({ id: "r-5", cosa: "riavvia" });
  assert.equal(quali.riavvii, 1);
});

test("un salto di versione che qui non c'e' piu' non installa una cosa diversa", async () => {
  /* E' il caso vero: il tasto e' stato premuto quando mancava la 1.3.0, e nel
   * frattempo quella e' stata messa e ne e' uscita un'altra. Nominare per nome
   * e salto di versione — e non per entita' — fa cadere il comando invece di
   * installare qualcos'altro. */
  const quali = aggiornamentiFinti({
    fila: [{ ...UNO, da: "1.3.0", a: "1.4.0" }],
  });
  const lavori = new Lavori({ aggiornamenti: quali, registro: ZITTO, aperta: () => true });
  await lavori.fai(comando());
  assert.deepEqual(quali.installati, []);
  assert.match(lavori.stato([]).perche, /non c'e' piu'/);
});

test("lo stesso comando due volte installa una volta sola", async () => {
  /* La risposta a un rapporto puo' ripetersi: la casa riprova, il quadro non
   * ha fatto in tempo a segnarselo. Un tasto premuto una volta non deve
   * installare due volte. */
  const quali = aggiornamentiFinti();
  const lavori = new Lavori({ aggiornamenti: quali, registro: ZITTO, aperta: () => true });
  await lavori.fai(comando());
  await lavori.fai(comando());
  assert.deepEqual(quali.installati, ["update.shelly"]);
});

test("sparito dall'elenco vuol dire fatto, ed e' la cosa piu' vera che si sappia", async () => {
  /* Home Assistant non dice «ho finito»: dice, al giro dopo, che quella
   * versione non manca piu'. */
  const lavori = new Lavori({
    aggiornamenti: aggiornamentiFinti(),
    registro: ZITTO,
    aperta: () => true,
  });
  await lavori.fai(comando());
  assert.equal(lavori.stato([UNO]).stato, "in corso");
  assert.equal(lavori.stato([]).stato, "fatto");
  /* E da li' non si muove piu': un'entita' che ricompare con un'altra versione
   * non riapre un lavoro chiuso. */
  assert.equal(lavori.stato([UNO]).stato, "fatto");
});

test("senza elenco non si giudica: una casa giu' non ha finito niente", async () => {
  const lavori = new Lavori({
    aggiornamenti: aggiornamentiFinti(),
    registro: ZITTO,
    aperta: () => true,
  });
  await lavori.fai(comando());
  /* `null` e' «Home Assistant non ha risposto», e dire «fatto» sarebbe la
   * bugia piu' comoda che ci sia. */
  assert.equal(lavori.stato(null).stato, "in corso");
});

test("un lavoro che non arriva in fondo smette di dirsi «in corso»", async () => {
  let ora = Date.parse("2026-09-18T09:00:00Z");
  const lavori = new Lavori({
    aggiornamenti: aggiornamentiFinti(),
    registro: ZITTO,
    aperta: () => true,
    adesso: () => ora,
  });
  await lavori.fai(comando());
  ora += TROPPO_TEMPO - 1000;
  assert.equal(lavori.stato([UNO]).stato, "in corso");
  ora += 2000;
  const stato = lavori.stato([UNO]);
  assert.equal(stato.stato, "non riuscito");
  assert.match(stato.perche, /troppo/);
});

test("quello che va storto nell'installare non solleva: diventa una risposta", async () => {
  const quali = aggiornamentiFinti({
    quandoInstalla: () => {
      throw new Error("quell'aggiornamento non si installa da qui");
    },
  });
  const lavori = new Lavori({ aggiornamenti: quali, registro: ZITTO, aperta: () => true });
  await lavori.fai(comando());
  const stato = lavori.stato([UNO]);
  assert.equal(stato.stato, "non riuscito");
  assert.match(stato.perche, /non si installa/);
});

test("senza nessun lavoro chiesto lo stato e' niente, non un lavoro vuoto", () => {
  const lavori = new Lavori({ aggiornamenti: aggiornamentiFinti(), registro: ZITTO });
  assert.equal(lavori.stato([UNO]), null);
});

test("quello che arriva dal quadro si taglia prima di guardarlo", async () => {
  /* Arriva da fuori, e finisce nel rapporto e nella console dell'add-on: un
   * nome di diecimila caratteri e' un rapporto grosso per niente. */
  const quali = aggiornamentiFinti({ fila: [] });
  const lavori = new Lavori({ aggiornamenti: quali, registro: ZITTO, aperta: () => true });
  await lavori.fai(comando({ nome: "x".repeat(5000) }));
  assert.ok(lavori.stato([]).nome.length <= 120);
});
