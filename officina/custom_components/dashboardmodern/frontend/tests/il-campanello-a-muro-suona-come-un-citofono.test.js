/* Il campanello del tablet a muro, come un videocitofono.
 *
 * «Col Ring il tablet a muro deve fare come un videocitofono: si accende,
 * suona, e mi fa vedere chi c'e' a tutto schermo come una chiamata.»
 *
 * Qui si tengono ferme le regole del nucleo: le scelte di una pagina Ingresso
 * (il suono, il volume, lo schermo, «Parla»), le due fasi dello squillo — suona
 * finche' qualcuno non lo silenzia o finche' non passano trenta secondi — e la
 * memoria degli ultimi squilli con la loro istantanea.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  NOTE_DEI_SUONI,
  SQUILLO_MS,
  SUONI_DEL_CAMPANELLO,
  conLaFoto,
  conLoSquillo,
  durataScritta,
  faseDelloSquillo,
  noteDelSuono,
  opzioniDelCampanello,
  quantoFa,
  schermoSempreAcceso,
  storiaPulita,
} from "../src/core/il-campanello-a-muro.js";
import { muroPulito } from "../src/core/plancia-a-muro.js";

const ORA = Date.parse("2026-10-14T10:25:00Z");

test("di serie: din don al 70%, lo schermo si accende e resta acceso, niente «Parla»", () => {
  assert.deepEqual(opzioniDelCampanello({}), {
    suono: "dindon",
    volume: 70,
    accendiSchermo: true,
    tieniAcceso: true,
    parla: false,
  });
  assert.deepEqual(opzioniDelCampanello(undefined), opzioniDelCampanello({}));
  /* Quello che non si conosce torna di serie; il volume sta fra 0 e 100. */
  assert.equal(opzioniDelCampanello({ suono: "sirena" }).suono, "dindon");
  assert.equal(opzioniDelCampanello({ volume: 140 }).volume, 100);
  assert.equal(opzioniDelCampanello({ volume: -3 }).volume, 0);
  assert.equal(opzioniDelCampanello({ volume: "35" }).volume, 35);
  assert.equal(opzioniDelCampanello({ volume: "forte" }).volume, 70);
  /* Una scelta scritta resta quella, anche quando e' «no». */
  const scelte = opzioniDelCampanello({
    suono: "nessuno",
    accendiSchermo: false,
    tieniAcceso: false,
    parla: true,
  });
  assert.deepEqual(
    [scelte.suono, scelte.accendiSchermo, scelte.tieniAcceso, scelte.parla],
    ["nessuno", false, false, true],
  );
});

test("le scelte arrivano al salvataggio della pagina Ingresso", () => {
  const muro = muroPulito({
    attiva: true,
    pagine: [
      {
        id: "p1",
        modello: "ingresso",
        ingresso: {
          campanello: "binary_sensor.campanello",
          suono: "classico",
          volume: "40",
          parla: true,
          accendiSchermo: false,
        },
      },
    ],
  });
  const ing = muro.pagine[0].ingresso;
  assert.deepEqual(
    [ing.suono, ing.volume, ing.parla, ing.accendiSchermo, ing.tieniAcceso],
    ["classico", 40, true, false, true],
  );
});

test("lo schermo resta acceso solo se c'e' un campanello che lo chiede", () => {
  const pagina = (ingresso) => ({ modello: "ingresso", ingresso });
  assert.equal(schermoSempreAcceso({ pagine: [pagina({ campanello: "event.campanello" })] }), true);
  assert.equal(schermoSempreAcceso({ pagine: [pagina({ campanello: "" })] }), false);
  assert.equal(
    schermoSempreAcceso({ pagine: [pagina({ campanello: "event.x", tieniAcceso: false })] }),
    false,
  );
  assert.equal(
    schermoSempreAcceso({ pagine: [{ modello: "stanza" }, pagina({ campanello: "event.x" })] }),
    true,
  );
  assert.equal(schermoSempreAcceso(null), false);
});

test("ogni suono ha le sue note; «Nessuno» non ne ha", () => {
  assert.deepEqual(SUONI_DEL_CAMPANELLO, ["dindon", "classico", "ding", "nessuno"]);
  for (const nome of ["dindon", "classico", "ding"]) {
    const { giro, note } = noteDelSuono(nome);
    assert.ok(note.length > 0, `${nome} deve suonare`);
    assert.ok(giro > 0);
    /* Un giro finisce prima di ricominciare: le note non si accavallano col
     * giro dopo. */
    for (const nota of note) {
      assert.ok(nota.frequenza > 200 && nota.frequenza < 2000);
      assert.ok(nota.inizio + nota.durata <= giro, `${nome} sfora il suo giro`);
    }
  }
  /* Il din don scende: la seconda nota e' piu' bassa della prima. */
  const [din, don] = NOTE_DEI_SUONI.dindon.note;
  assert.ok(don.frequenza < din.frequenza && don.inizio > din.inizio);
  assert.deepEqual(noteDelSuono("nessuno").note, []);
  assert.equal(noteDelSuono("chissa"), NOTE_DEI_SUONI.dindon);
});

test("lo squillo suona trenta secondi, o finche' qualcuno lo silenzia", () => {
  assert.deepEqual(faseDelloSquillo(null, ORA), { fase: "", trascorsi: 0 });
  assert.deepEqual(faseDelloSquillo({ quando: ORA }, ORA + 8_000), {
    fase: "squilla",
    trascorsi: 8_000,
  });
  assert.equal(faseDelloSquillo({ quando: ORA }, ORA + SQUILLO_MS - 1).fase, "squilla");
  assert.equal(faseDelloSquillo({ quando: ORA }, ORA + SQUILLO_MS).fase, "dopo");
  assert.equal(SQUILLO_MS, 30_000);
  /* «Silenzia» lo fa finire subito. */
  assert.equal(faseDelloSquillo({ quando: ORA, silenziato: true }, ORA + 2_000).fase, "dopo");
  /* Un orologio che torna indietro non fa un tempo negativo. */
  assert.equal(faseDelloSquillo({ quando: ORA }, ORA - 5_000).trascorsi, 0);
});

test("i tempi si scrivono come in una chiamata, e «quanto fa» nell'unita' giusta", () => {
  assert.equal(durataScritta(8_000), "0:08");
  assert.equal(durataScritta(84_500), "1:24");
  assert.equal(durataScritta(-1), "0:00");
  assert.deepEqual(quantoFa(30_000), { numero: 30, unita: "s" });
  assert.deepEqual(quantoFa(5 * 60_000), { numero: 5, unita: "min" });
  assert.deepEqual(quantoFa(3 * 3_600_000), { numero: 3, unita: "h" });
  assert.deepEqual(quantoFa(50 * 3_600_000), { numero: 2, unita: "giorni" });
});

test("gli ultimi squilli: il piu' recente in cima, lo stesso dito che insiste conta una volta", () => {
  let storia = [];
  storia = conLoSquillo(storia, { quando: ORA - 86_400_000, entita: "event.campanello" });
  storia = conLoSquillo(storia, { quando: ORA, entita: "event.campanello", immagine: "/a.jpg" });
  /* Un Ring manda anche due eventi per pressione: uno solo. */
  storia = conLoSquillo(storia, { quando: ORA + 1_500, entita: "event.campanello" });
  assert.deepEqual(
    storia.map((voce) => voce.quando),
    [ORA, ORA - 86_400_000],
  );
  assert.equal(storia[0].immagine, "/a.jpg");
  /* Un altro campanello nello stesso attimo e' un altro squillo. */
  storia = conLoSquillo(storia, { quando: ORA + 1_000, entita: "binary_sensor.cancello" });
  assert.equal(storia.length, 3);
  /* Se ne tengono cinque. */
  for (let i = 1; i <= 6; i += 1)
    storia = conLoSquillo(storia, { quando: ORA + i * 60_000, entita: "event.campanello" });
  assert.equal(storia.length, 5);
  assert.equal(storia[0].quando, ORA + 6 * 60_000);
});

test("l'istantanea arriva dopo, e una troppo grande non si tiene", () => {
  const storia = conLoSquillo([], { quando: ORA, entita: "event.campanello", immagine: "/proxy" });
  const conFoto = conLaFoto(storia, ORA, "data:image/jpeg;base64,AAAA");
  assert.equal(conFoto[0].immagine, "data:image/jpeg;base64,AAAA");
  const enorme = `data:image/jpeg;base64,${"A".repeat(250_000)}`;
  assert.equal(storiaPulita([{ quando: ORA, immagine: enorme }])[0].immagine, "");
  /* Quello che non e' uno squillo non entra. */
  assert.deepEqual(storiaPulita([{ quando: "ieri" }, null, { quando: 0 }]), []);
  assert.deepEqual(storiaPulita("rotto"), []);
});

test("il tablet chiede all'app di tenere acceso lo schermo e di svegliarlo", async () => {
  const sezione = await readFile(
    new URL("../src/sections/plancia-a-muro-section.js", import.meta.url),
    "utf8",
  );
  /* I due messaggi nuovi del canale dello schermo (`app/lib/casa/lo_schermo.dart`). */
  assert.match(sezione, /diciAlloSchermo\("acceso", schermoSempreAcceso\(muro\)\)/);
  assert.match(sezione, /postMessage\?\.\("sveglia"\)/);
  /* Spento il pannello, lo schermo torna del sistema. */
  assert.match(sezione, /diciAlloSchermo\("acceso", false\)/);
});
