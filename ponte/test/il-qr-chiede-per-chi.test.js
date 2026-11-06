/* «Per poter generare il QR code di abbinamento deve essere obbligatoria la
 * scelta dell'utente associato.»
 *
 * Il telefono eredita l'utente del codice, e da li' vede le plance che vede
 * lui. Prima la scelta stava gia' su «chi sta usando questa pagina» — cioe'
 * quasi sempre chi amministra — e il telefono di un altro vedeva tutto. Adesso
 * la pagina non sceglie per nessuno, il tasto resta spento finche' non si e'
 * scelto, e cambiare persona col QR a schermo lo annulla. Il ponte, dal canto
 * suo, rifiuta un codice senza utente (`server.test.js`, «senza dire per chi,
 * il codice non nasce»). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const pagina = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");
const programma = readFileSync(join(QUI, "..", "console", "console.js"), "utf8");

/* Una funzione vera della console, ritagliata dal file e compilata col
 * `due()` della pagina: e' un copione del browser e non si importa. */
function dallaConsole(nome) {
  const inizio = programma.indexOf(`function ${nome}(`);
  assert.ok(inizio > 0, `la console non ha piu' ${nome}`);
  let profondo = 0;
  let fine = inizio;
  for (let i = programma.indexOf("{", inizio); i < programma.length; i += 1) {
    if (programma[i] === "{") profondo += 1;
    else if (programma[i] === "}") {
      profondo -= 1;
      if (!profondo) {
        fine = i + 1;
        break;
      }
    }
  }
  return new Function("due", `${programma.slice(inizio, fine)}; return ${nome};`)((it) => it);
}

/* Un pezzo del programma: da un punto di partenza al primo `});` che chiude. */
function ilPezzo(daDove) {
  const inizio = programma.indexOf(daDove);
  assert.ok(inizio >= 0, `nel programma non c'e' piu' ${daDove}`);
  return programma.slice(inizio, programma.indexOf("\n  });", inizio));
}

test("la scelta di per chi e' obbligatoria, e nessuno e' scelto di serie", () => {
  const scelta = /<select[^>]*\bid="per-chi"[^>]*>([\s\S]*?)<\/select>/.exec(pagina);
  assert.ok(scelta, "la scelta di per chi non c'e' piu'");
  assert.match(scelta[0], /\srequired\b/);
  /* L'unica voce di serie e' il segnaposto: vuoto, non sceglibile, scelto. */
  const voci = scelta[1].match(/<option\b[^>]*>/g) || [];
  assert.equal(voci.length, 1);
  assert.match(voci[0], /value=""/);
  assert.match(voci[0], /\sdisabled\b/);
  assert.match(scelta[1], /Scegli una persona…/);
  /* La voce di prima, che sceglieva chi stava guardando, non torna. */
  assert.doesNotMatch(programma, /chi sta usando questa pagina/);
  /* Il segnaposto lo rimette anche il programma quando riempie gli utenti. */
  assert.match(ilPezzo("function riempiIlPerChi("), /nessuno\.disabled = true;/);
});

test("il tasto del QR nasce spento, e si accende solo con qualcuno scelto", () => {
  const tasto = /<button[^>]*\bid="fabbrica"[^>]*>/.exec(pagina);
  assert.ok(tasto);
  assert.match(tasto[0], /\sdisabled\b/);

  const leTappe = dallaConsole("leTappe");
  /* Nessuno scelto: si comincia dalla tappa 1, e il tasto resta spento. */
  assert.deepEqual(
    (({ chi, genera, qr, siPuoGenerare }) => ({ chi, genera, qr, siPuoGenerare }))(
      leTappe("", false, false),
    ),
    { chi: "adesso", genera: "dopo", qr: "dopo", siPuoGenerare: false },
  );
  assert.equal(leTappe("", false, false).spiega, "Prima scegli per chi è.");
  /* Scelto: tocca al tasto. */
  const scelto = leTappe("u-giulia", false, false);
  assert.equal(scelto.chi, "fatto");
  assert.equal(scelto.genera, "adesso");
  assert.equal(scelto.siPuoGenerare, true);
  /* Col QR a schermo: le prime due sono fatte, la terza e' quella di adesso. */
  const vivo = leTappe("u-giulia", true, false);
  assert.deepEqual([vivo.chi, vivo.genera, vivo.qr], ["fatto", "fatto", "adesso"]);
  /* Al tetto dei telefoni il tasto resta spento anche con qualcuno scelto. */
  assert.equal(leTappe("u-giulia", false, true).siPuoGenerare, false);

  /* E la pagina obbedisce a quella risposta. */
  assert.match(programma, /trova\("fabbrica"\)\.disabled = !tappe\.siPuoGenerare;/);
});

test("il codice si chiede sempre per qualcuno", () => {
  const tasto = ilPezzo('trova("fabbrica").addEventListener("click"');
  assert.match(tasto, /var voluto = trova\("per-chi"\)\.value;/);
  assert.match(tasto, /if \(!voluto\) \{/);
  assert.match(tasto, /body: JSON\.stringify\(\{ utente: voluto \}\)/);
  /* Mai un corpo vuoto, che il ponte intestava a chi premeva. */
  assert.doesNotMatch(tasto, /JSON\.stringify\(\{\}\)|voluto \? \{ utente/);
});

test("cambiare persona col QR a schermo lo annulla, e chiede di rigenerarlo", () => {
  const cambio = ilPezzo('trova("per-chi").addEventListener("change"');
  assert.match(cambio, /trova\("per-chi"\)\.value !== codicePer/);
  assert.match(cambio, /chiedi\("api\/codice", \{ method: "DELETE" \}\)/);
  assert.match(cambio, /nascondiIlCodice\(\)/);
  assert.match(cambio, /Generane uno nuovo/);
  assert.match(cambio, /Generate a new one/);
});
