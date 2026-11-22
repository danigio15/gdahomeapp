/* «Apri GdAHome su questo telefono»: il link con l'invito, per chi guarda la
 * console dallo stesso telefono che vuole collegare.
 *
 * Un telefono non puo' inquadrare il proprio schermo. Sotto il QR c'e' un
 * bottone che apre GdAHome con la stessa riga del QR dentro un link,
 * `gdahome://collega?invito=…`, scritta con `encodeURIComponent`. Il link che
 * esce di qui e' lo stesso che l'app rilegge in `app/test/ponte/il_link_test.dart`:
 * il vettore e' scritto a mano in tutte e due le prove, e non si tocca da una
 * parte sola. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { invito, leggiLInvito } from "../src/invito.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const pagina = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");
const programma = readFileSync(join(QUI, "..", "console", "console.js"), "utf8");

/* Una funzione vera della console, ritagliata dal file: e' un copione del
 * browser e non si importa (come in `il-qr-chiede-per-chi.test.js`). */
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
  return new Function(`${programma.slice(inizio, fine)}; return ${nome};`)();
}

/* Lo stesso vettore di `app/test/ponte/il_link_test.dart`. */
const RIGA =
  "gdahome|1|ABCD2345EFGH6789|wss://centralino.esempio.dev|192.168.1.50:8098,10.0.0.4:8098";
const LINK =
  "gdahome://collega?invito=gdahome%7C1%7CABCD2345EFGH6789%7Cwss%3A%2F%2Fcentralino.esempio.dev%7C192.168.1.50%3A8098%2C10.0.0.4%3A8098";

test("il link porta l'invito del QR, codificato, e niente altro", () => {
  const ilLink = dallaConsole("ilLinkDiGdAHome");
  assert.equal(
    invito({
      codice: "ABCD2345EFGH6789",
      centralino: "wss://centralino.esempio.dev",
      indirizzi: ["192.168.1.50:8098", "10.0.0.4:8098"],
    }),
    RIGA,
  );
  assert.equal(ilLink(RIGA, false), LINK);

  /* Si rilegge intero: dentro il link c'e' l'invito, e solo lui. */
  const letto = new URL(LINK);
  assert.equal(letto.protocol, "gdahome:");
  assert.equal(letto.host, "collega");
  assert.deepEqual([...letto.searchParams.keys()], ["invito"]);
  assert.deepEqual(leggiLInvito(letto.searchParams.get("invito")), leggiLInvito(RIGA));
});

test("su Android il link dice anche l'app, per il Play Store se manca", () => {
  const ilLink = dallaConsole("ilLinkDiGdAHome");
  assert.equal(
    ilLink(RIGA, true),
    "intent://collega?invito=gdahome%7C1%7CABCD2345EFGH6789%7Cwss%3A%2F%2Fcentralino.esempio.dev%7C192.168.1.50%3A8098%2C10.0.0.4%3A8098" +
      "#Intent;scheme=gdahome;package=com.gdahome.gdahome;end",
  );
});

test("il bottone sta sotto il QR, sopra il codice da copiare, e apre fuori dalla pagina", () => {
  const qr = pagina.indexOf('id="codice-vivo"');
  const bottone = pagina.indexOf('id="apri-qui"');
  const aMano = pagina.indexOf('id="a-mano"');
  assert.ok(qr > 0 && bottone > qr && aMano > bottone, "l'ordine e' QR, bottone, codice");

  const ancora = /<a\b[^>]*\bid="apri-gdahome"[^>]*>/.exec(pagina);
  assert.ok(ancora, "il bottone e' un'ancora vera");
  /* Una pagina nuova: nell'app di Home Assistant per iPhone va al sistema,
   * che apre GdAHome; caricato al posto della pagina, diventa un errore. */
  assert.match(ancora[0], /\starget="_blank"/);
  assert.match(ancora[0], /\srel="noopener noreferrer"/);
  assert.match(ancora[0], /data-en="Open GdAHome on this phone"/);
  assert.match(pagina, />Apri GdAHome su questo telefono</);
  assert.match(pagina, /Se GdAHome non si apre, copia il codice qui sotto\./);
  assert.match(pagina, /data-en="If GdAHome doesn't open, copy the code below\."/);
});

test("il bottone si accende con l'invito che il ponte manda, e si spegne col codice", () => {
  /* Le due strade da cui arriva un codice — fabbricato adesso, o ripreso
   * dopo una ricarica — passano tutte e due l'invito. */
  assert.match(programma, /disegnaIlCodice\(fatto\.codice, fatto\.scadeIl, fatto\.invito\)/);
  assert.match(programma, /disegnaIlCodice\(vivo\.codice, vivo\.scadeIl, vivo\.invito\)/);
  assert.match(
    programma,
    /trova\("apri-gdahome"\)\.href = invito \? ilLinkDiGdAHome\(invito, SU_ANDROID\) : "#";/,
  );

  const nascondi = programma.slice(
    programma.indexOf("function nascondiIlCodice("),
    programma.indexOf("disegnaLeTappe();", programma.indexOf("function nascondiIlCodice(")),
  );
  assert.match(nascondi, /trova\("apri-qui"\)\.hidden = true;/);
  assert.match(nascondi, /trova\("apri-gdahome"\)\.href = "#";/);
});
