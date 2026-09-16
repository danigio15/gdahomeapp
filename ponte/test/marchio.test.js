/* La faccia di gdahome sulla plancia.
 *
 * Quello che questa prova tiene fermo e' la promessa che rende il lavoro
 * gratis per sempre: **la cartella non si tocca**. La plancia resta la copia
 * verbatim della dashboard, col suo sigillo intatto, e il nome e il marchio si
 * mettono al momento di servire. Se un giorno qualcuno «semplificasse»
 * cambiando i file, questa prova lo direbbe: il sigillo non torna piu'.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { NOME, NOME_DI_PRIMA, laPagina, vestiDiGdahome } from "../src/marchio.js";
import { Plancia } from "../src/plancia.js";

const plancia = new Plancia();
const dove = (relativo) => `/dashboardmodern_static/${plancia.impronta}/${relativo}`;

test("la pagina servita non dice piu' il nome di prima", (t) => {
  if (!plancia.cE) return t.skip("senza plancia non c'e' niente da vestire");
  const servita = plancia.leggi(dove("legacy/dashboard.html"));
  assert.equal(servita.stato, 200);
  const testo = servita.corpo.toString("utf8");

  /* Il titolo nella linguetta del browser, e la parola in maiuscolo sotto il
   * logo del velo d'avvio: e' la prima cosa che si vede aprendo. */
  assert.match(testo, /<title>gdahome<\/title>/);
  assert.match(testo, /<b>gdahome<\/b>/);
  /* E l'immagine del velo e' la nostra. Si guarda il formato e non i byte:
   * quelli cambiano il giorno che si ridisegna il marchio, il fatto che sia
   * WebP e non piu' il PNG della dashboard no. */
  assert.match(testo, /id="cd-boot-overlay"><img src="data:image\/webp;base64,/);

  /* In tutta la pagina, zero volte. */
  assert.equal(testo.includes(NOME_DI_PRIMA), false);
});

test("il logo servito e' quello di gdahome, non quello della dashboard", (t) => {
  if (!plancia.cE) return t.skip("senza plancia non c'e' niente da vestire");
  const servito = plancia.leggi(dove("legacy/logo.png"));
  assert.equal(servito.stato, 200);
  assert.equal(servito.tipo, "image/png");

  const nostro = readFileSync(fileURLToPath(new URL("../marchio/gdahome.png", import.meta.url)));
  assert.deepEqual(servito.corpo, nostro);

  /* E non e' quello che sta sul disco dentro la plancia: quello e' rimasto
   * dov'era, perche' la cartella non si tocca. */
  const suo = readFileSync(fileURLToPath(new URL("../plancia/legacy/logo.png", import.meta.url)));
  assert.notDeepEqual(servito.corpo, suo);
});

test("l'alt del logo, dentro il runtime, dice gdahome", (t) => {
  if (!plancia.cE) return t.skip("senza plancia non c'e' niente da vestire");
  const servito = plancia.leggi(dove("legacy/dashboard-runtime-it.js"));
  assert.equal(servito.stato, 200);
  const testo = servito.corpo.toString("utf8");
  assert.match(testo, /alt="gdahome"/);
  assert.equal(testo.includes('alt="Dashboard Modern"'), false);

  /* Ma i **nomi delle cose** restano: `window.DashboardModernModules` e i
   * suoi fratelli sono i ganci con cui i file della plancia si parlano fra
   * loro, e cambiarli vorrebbe dire rompere la plancia per un nome che
   * nessuno legge. */
  assert.match(testo, /DashboardModernModules/);
});

test("e la scritta accanto al logo dice gda home", (t) => {
  if (!plancia.cE) return t.skip("senza plancia non c'e' niente da vestire");
  /* Questa mancava, e si vedeva sulla testata: il segno era il nostro e le
   * parole di fianco dicevano ancora «Dashboard MODERN», cioe' il marchio di
   * un altro appoggiato al nostro. */
  const servito = plancia.leggi(dove("legacy/dashboard-runtime-it.js"));
  const testo = servito.corpo.toString("utf8");

  assert.match(testo, />gda<\/span>/);
  assert.match(testo, />home<\/span>/);
  assert.equal(testo.includes(">MODERN</span>"), false, "la parola di prima non c'e' piu'");

  /* E anche in inglese: e' lo stesso marchio, e una testata vestita a meta'
   * si vedrebbe solo a chi cambia lingua. */
  const inglese = plancia.leggi(dove("legacy/dashboard-runtime-en.js"));
  const suo = inglese.corpo.toString("utf8");
  assert.match(suo, />gda<\/span>/);
  assert.equal(suo.includes(">MODERN</span>"), false);
});

test("la cartella della plancia non si e' toccata: il sigillo torna", () => {
  /* La prova che conta. Se un giorno il nome si cambiasse dentro i file
   * invece che al momento di servire, e nessuno risigillasse, il ponte di
   * tutte le case direbbe «modificata» su una plancia a posto. */
  assert.equal(plancia.provenienza.quanti ?? 0, 0);
  assert.notEqual(plancia.provenienza.stato, "modificata");
});

test("vestire non solleva mai, e quello che non riguarda passa com'e'", () => {
  /* Un file qualunque non si tocca. */
  const suoi = Buffer.from("ciao");
  const uguale = vestiDiGdahome("legacy/config.js", suoi, "text/javascript");
  assert.deepEqual(uguale.corpo, suoi);

  /* E una pagina che non ha niente da cambiare torna com'era, senza errori. */
  assert.equal(laPagina("<html><body>niente</body></html>"), "<html><body>niente</body></html>");

  /* Nemmeno con dentro qualcosa di storto. */
  const storto = vestiDiGdahome(
    "legacy/dashboard.html",
    Buffer.from([0xff, 0xfe, 0x00]),
    "text/html",
  );
  assert.ok(Buffer.isBuffer(storto.corpo));
  assert.equal(NOME, "gdahome");
});

test("il manifesto dice gdahome tre volte: il nome, lo slug e la voce nella barra", () => {
  const manifesto = readFileSync(fileURLToPath(new URL("../config.yaml", import.meta.url)), "utf8");

  /* Tre righe, e tre mestieri diversi: il `name` e' quello che si legge nel
   * negozio degli add-on, il `panel_title` e' come si chiama la console nella
   * barra laterale, e lo `slug` e' l'identita' dell'add-on per il Supervisor.
   *
   * Lo slug sta in una prova perche' cambiarlo costa caro: Home Assistant lo
   * vedrebbe come un add-on **nuovo**, e chi ce l'ha si ritroverebbe senza
   * opzioni, senza telefoni abbinati e senza plance. Cambiarlo si puo' — si e'
   * fatto, da `ponte` a `gdahome`, quando ce l'aveva una macchina di prova
   * sola — ma deve essere una cosa voluta, non un riordino. */
  assert.match(manifesto, new RegExp(`^name: ${NOME}$`, "m"));
  assert.match(manifesto, new RegExp(`^slug: ${NOME}$`, "m"));
  assert.match(manifesto, new RegExp(`^panel_title: ${NOME}$`, "m"));

  /* E il nome di prima non sta in nessuna delle righe che Home Assistant
   * mostra. Nei commenti si', ed e' giusto: quella e' la provenienza della
   * plancia — «1.4.24 e' la versione di DashboardModern che sta in plancia/» —
   * e chi legge il manifesto ha il diritto di sapere cosa c'e' dentro. Quello
   * che non deve piu' comparire e' il nome di un altro prodotto **a schermo**. */
  for (const riga of ["name", "panel_title", "description"]) {
    const scritto = new RegExp(`^${riga}: (.*)$`, "m").exec(manifesto);
    assert.ok(scritto, `nel manifesto non c'e' nessun «${riga}:»`);
    assert.equal(
      scritto[1].includes(NOME_DI_PRIMA),
      false,
      `«${riga}:» nel manifesto dice ancora ${NOME_DI_PRIMA}`,
    );
  }
});

test("l'app e l'add-on portano lo stesso numero", () => {
  const manifesto = readFileSync(fileURLToPath(new URL("../config.yaml", import.meta.url)), "utf8");
  const pubspec = readFileSync(
    fileURLToPath(new URL("../../app/pubspec.yaml", import.meta.url)),
    "utf8",
  );

  const dellAddon = /^version: "([^"]+)"$/m.exec(manifesto);
  const dellApp = /^version: ([0-9]+)\.([0-9]+)\.([0-9]+)\+([0-9]+)$/m.exec(pubspec);
  assert.ok(dellAddon, "il manifesto non dice che versione e'");
  assert.ok(dellApp, "il pubspec non dice che versione e'");

  /* Lo stesso numero, perche' sono la stessa cosa: chi apre l'app e apre la
   * console si aspetta di leggere due volte quello che ha installato.
   *
   * Con una differenza ammessa, e una sola: l'add-on puo' portarsi un **quarto
   * numero** — le sue correzioni fra due versioni della plancia, che nel
   * negozio sono l'unico modo di far comparire «Aggiorna» — e il **nome**
   * dell'app no, perche' un numero fatto cosi' i negozi dei telefoni non lo
   * prendono. Quel quarto numero l'app se lo porta nel numero di costruzione,
   * qui sotto. */
  const [, grande, medio, piccolo, costruzione] = dellApp;
  const suoi = dellAddon[1].split(".");
  assert.deepEqual(suoi.slice(0, 3), [grande, medio, piccolo]);
  assert.ok(
    suoi.length === 3 || suoi.length === 4,
    `la versione dell'add-on ha ${suoi.length} numeri: tre, o quattro col nostro`,
  );

  /* E il numero di costruzione — quello che vogliono i negozi, che deve solo
   * crescere — si deriva dal nome: 1.4.24 diventa 104240, e la correzione
   * dell'add-on e' l'ultima cifra: 1.4.24.1 diventa 104241. Cosi' non c'e' un
   * secondo numero da ricordarsi, e ogni versione della plancia ha dieci
   * correzioni a disposizione per andare anche nel negozio. */
  /* E il terzo posto: il numero che l'app **fa vedere**.
   *
   * Il `pubspec` lo legge chi costruisce, non l'app che gira, e per rileggerlo
   * da dentro servirebbe un pacchetto in piu': quindi lo stesso programma che
   * scrive questi due scrive anche un file Dart, e l'app legge quello. Tre
   * posti sono tre occasioni di dire tre numeri diversi — meno questa prova. */
  const dart = readFileSync(
    fileURLToPath(new URL("../../app/lib/versione.dart", import.meta.url)),
    "utf8",
  );
  const nome = /^const String versioneDiQuestApp = "([^"]+)";$/m.exec(dart);
  const costruito = /^const int costruzioneDiQuestApp = (\d+);$/m.exec(dart);
  const scritto = /^const String numeroDiQuestApp = "([^"]+)";$/m.exec(dart);
  assert.ok(nome && costruito && scritto, "l'app non dice che numero e'");
  assert.equal(nome[1], `${grande}.${medio}.${piccolo}`);
  assert.equal(costruito[1], costruzione);
  assert.equal(scritto[1], `${nome[1]} (${costruzione})`);

  const correzione = suoi.length === 4 ? Number(suoi[3]) : 0;
  assert.ok(correzione >= 0 && correzione <= 9, "di correzioni ce ne stanno dieci, da 0 a 9");
  assert.equal(
    Number(costruzione),
    (Number(grande) * 10000 + Number(medio) * 100 + Number(piccolo)) * 10 + correzione,
  );
});
