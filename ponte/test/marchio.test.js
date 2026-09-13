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

test("la cartella della plancia non si e' toccata: il sigillo torna", () => {
  /* La prova che conta. Se un giorno il nome si cambiasse dentro i file
   * invece che al momento di servire, il ponte direbbe «modificata» a tutti
   * — e al primo `porta-la-plancia.mjs` quel lavoro sarebbe da rifare. */
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

  /* E il nome di prima non ci sta piu' da nessuna parte. */
  assert.equal(manifesto.includes(NOME_DI_PRIMA), false);
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
   * console si aspetta di leggere due volte quello che ha installato. */
  const [, grande, medio, piccolo, costruzione] = dellApp;
  assert.equal(`${grande}.${medio}.${piccolo}`, dellAddon[1]);

  /* E il numero di costruzione — quello che vogliono i negozi, che deve solo
   * crescere — si deriva dal nome: 1.4.24 diventa 10424. Cosi' non c'e' un
   * secondo numero da ricordarsi. */
  assert.equal(Number(costruzione), Number(grande) * 10000 + Number(medio) * 100 + Number(piccolo));
});
