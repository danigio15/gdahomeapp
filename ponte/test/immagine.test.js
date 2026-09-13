/* Quello che il ponte legge dal disco, l'immagine se lo porta dentro.
 *
 * La prova nasce da un difetto pagato caro, e il difetto era una riga che non
 * c'era. Il `Dockerfile` copiava `src/`, `console/`, `plancia/` e `app/`, e
 * non copiava `carta/`: dentro l'add-on installato, il file che il ponte deve
 * mettere nella `www` di Home Assistant non esisteva.
 *
 * **Come si vedeva.** Non si vedeva. L'add-on partiva, la voce compariva nella
 * barra laterale, la Plancia c'era — e aprendola usciva «Errore di
 * configurazione» e niente altro, perche' la tessera non poteva registrarsi e
 * il motivo Home Assistant lo mostra solo dentro l'editor. Da fuori: una
 * pagina rosa senza una parola. Tre giri di ipotesi sbagliate, e la risposta
 * stava in una riga del registro: `ENOENT: copyfile '/app/carta/plancia.js'`.
 * Lo stesso valeva per `marchio/`, che serve a vestire la plancia col nome e
 * col logo di gdahome: quello non sollevava nemmeno — la plancia si vedeva col
 * nome di prima, e nessuno lo diceva.
 *
 * **Perche' nessuna prova lo prendeva.** Perche' tutte fanno girare il ponte
 * dalla repository, dove quelle cartelle ci sono. L'unico posto dove mancano
 * e' l'immagine, e l'immagine qui non si costruisce: costruirla vorrebbe dire
 * Docker, il Supervisor e qualche minuto. Ma non serve costruirla — serve
 * leggere le due liste e confrontarle, e sono tutte e due dei file di testo.
 *
 * **Come si tiene ferma.** Non con un elenco scritto a mano, che invecchia il
 * giorno che qualcuno aggiunge una cartella: si legge **dal programma** cosa
 * apre (`new URL("../qualcosa/…")`, `join(QUI, "..", "qualcosa")`) e si guarda
 * che il `Dockerfile` abbia una `COPY` per ognuna. Chi domani aggiunge una
 * cartella nuova e si scorda la riga, se lo sente dire qui invece che da una
 * pagina rosa in casa di qualcuno.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const qui = (relativo) => fileURLToPath(new URL(relativo, import.meta.url));
const SRC = qui("../src");

/* Quello che il ponte apre fuori da `src/`, letto dal programma stesso. */
function cosaApreIlPonte() {
  const quali = new Set();
  for (const file of readdirSync(SRC)) {
    if (!file.endsWith(".js")) continue;
    const testo = readFileSync(join(SRC, file), "utf8");
    for (const [, nome] of testo.matchAll(/new URL\("\.\.\/([A-Za-z0-9_.-]+)/g)) quali.add(nome);
    for (const [, nome] of testo.matchAll(/join\(QUI, "\.\.", "([A-Za-z0-9_.-]+)"/g))
      quali.add(nome);
  }
  return [...quali].sort();
}

test("l'immagine si porta dentro tutto quello che il ponte apre", () => {
  const dockerfile = readFileSync(qui("../Dockerfile"), "utf8");
  const apre = cosaApreIlPonte();

  /* Se questa lista tornasse vuota la prova direbbe «tutto a posto» senza aver
   * guardato niente, ed e' il modo piu' comune in cui una prova smette di
   * servire. */
  assert.ok(apre.length >= 4, `il ponte sembra non aprire niente: ${apre.join(", ")}`);

  for (const nome of apre) {
    const copiata = new RegExp(`^COPY ${nome.replace(/\./g, "\\.")}/? `, "m").test(dockerfile);
    assert.ok(
      copiata,
      `il ponte apre «${nome}» ma il Dockerfile non lo copia: dentro l'add-on non ci sara'`,
    );
  }
});

test("e le due che erano rimaste fuori ci sono per nome", () => {
  /* Le altre le tiene la prova qui sopra, che si aggiorna da se'. Queste due
   * si nominano perche' sono quelle che sono mancate davvero, e una riga con
   * dentro il nome di un difetto vero e' la riga che nessuno cancella per
   * sbaglio. */
  const dockerfile = readFileSync(qui("../Dockerfile"), "utf8");
  assert.match(dockerfile, /^COPY carta\/ /m);
  assert.match(dockerfile, /^COPY marchio\/ /m);
});
