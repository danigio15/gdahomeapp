/* Ogni pagina chiede la chiave che il server le controlla davvero.
 *
 * Il quadro ha due porte e due chiavi diverse, e non si aprono a vicenda:
 *
 *  - `/console/` e' di chi installa, e il server ci mette davanti
 *    `installatori.riconosci(...)`: vuole **la chiave di quell'installatore**,
 *    quella che gli ha dato chi tiene il quadro;
 *  - `/gestore/` e' di chi il quadro lo tiene, e li' il confronto e' con
 *    `QUADRO_CHIAVE`, la chiave della macchina.
 *
 * La console pero' scriveva: «E' quella che sta sulla macchina come
 * QUADRO_CHIAVE». Un installatore che leggeva quella riga andava a cercare
 * una variabile d'ambiente su un computer che non ha mai visto, e la chiave
 * che aveva in tasca — l'unica che quella porta apre — non la provava nemmeno.
 * Il server non e' mai stato d'accordo con quel testo: `QUADRO_CHIAVE` su
 * `/console/` non ha mai aperto niente.
 *
 * Un errore cosi' non lo trova nessuna prova che guardi solo il codice, perche'
 * il codice funzionava. Lo trova solo chi legge la pagina con gli occhi di chi
 * la deve usare — o questa prova.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { MINUTI_DELL_INVITO } from "../src/chiavi.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const pagina = (quale) => readFileSync(join(QUI, "..", quale, "index.html"), "utf8");
const server = readFileSync(join(QUI, "..", "src", "server.js"), "utf8");

test("la console non manda l'installatore a cercare la chiave della macchina", () => {
  assert.equal(
    pagina("console").includes("QUADRO_CHIAVE"),
    false,
    "su /console/ la chiave della macchina non apre niente: nominarla manda a cercare dalla parte sbagliata",
  );
});

test("la gestione invece quella chiave la nomina, ed e' la sua", () => {
  /* Il rovescio della prova qui sopra: se la si scrivesse «nessuna pagina
   * nomina QUADRO_CHIAVE» passerebbe anche cancellando la riga che serve. */
  assert.match(
    server,
    /gestoreAperto[\s\S]{0,200}chiaveDelGestore/,
    "e' /gestore/ la porta che si apre con la chiave della macchina",
  );
});

test("e il server, per la console, continua a chiedere quella dell'installatore", () => {
  /* Le due meta': se un giorno la console cambiasse controllo, il testo qui
   * sopra tornerebbe a mentire senza che nessuno se ne accorga. */
  assert.match(
    server,
    /via\.startsWith\("\/console\/"\)[\s\S]{0,200}installatori\.riconosci/,
    "la console deve continuare a riconoscere l'installatore, non altro",
  );
});

test("l'invito vive abbastanza da poter essere incollato, e la pagina dice la stessa cosa", () => {
  /* Quindici minuti erano copiati dal codice che abbina un telefono, dove chi
   * abbina ha in mano il telefono. Qui il codice va copiato, portato dentro
   * Home Assistant, incollato in una casella e salvato, e poi il ponte deve
   * ripartire — e nel caso vero non lo incolla nemmeno chi lo genera. Scadeva
   * in mano, e il 403 che ne usciva dice «questa chiave non apre niente», non
   * «scaduto»: si va a cercare un guasto che non c'e'.
   *
   * Le due meta' tenute insieme sono il numero e la parola: se il numero
   * cambia e la pagina continua a dire «un giorno», la pagina mente a chi sta
   * decidendo se fare il codice adesso o dopo. */
  assert.ok(
    MINUTI_DELL_INVITO >= 60,
    "sotto l'ora un invito scade mentre lo si incolla, ed e' successo davvero",
  );
  assert.equal(MINUTI_DELL_INVITO, 24 * 60, "un giorno");
  const console_ = pagina("console");
  assert.match(console_, /vale un giorno/, "la pagina deve dire la durata vera");
  assert.equal(
    console_.includes("vale un quarto d'ora"),
    false,
    "e non quella di prima, che adesso sarebbe una bugia",
  );
});

test("fra una casa che si presenta e la pagina che lo mostra non passa un minuto", () => {
  /* Tre numeri che devono stare d'accordo, e che finora stavano scritti in tre
   * file senza che niente li tenesse insieme:
   *
   *  - quanto aspetta il ponte prima del primo rapporto (`PRIMA_ASPETTA`);
   *  - ogni quanto ne manda uno (`OGNI_DI_SERIE`);
   *  - ogni quanto questa pagina si ricarica.
   *
   * Gli scenari pero' sono **due**, e la prima stesura di questa prova li ha
   * mescolati sommandoli tutti e tre. Sono:
   *
   *  - **l'abbinamento**, che e' il momento in cui qualcuno guarda lo schermo:
   *    il ponte riparte col codice appena salvato e manda il primo rapporto
   *    dopo `PRIMA_ASPETTA`, non dopo un giro intero. Quindi `primo +
   *    ricarica`, e basta;
   *  - **una casa che cambia stato** mentre e' gia' abbinata: li' si aspetta il
   *    giro, quindi `ogni + ricarica`, e nessuno sta a guardare.
   *
   * La prova non fissa i numeri uno per uno — quelli si cambiano — ma i due
   * conti. */
  const ponte = readFileSync(join(QUI, "..", "..", "ponte", "src", "rapporto.js"), "utf8");
  const primo = Number(/const PRIMA_ASPETTA = ([\d_]+);/.exec(ponte)?.[1].replace(/_/g, ""));
  const ogni = Number(/export const OGNI_DI_SERIE = (\d+);/.exec(ponte)?.[1]);
  /* Il `}, N * 1000);` che chiude il `setInterval` che ricarica. La prima
   * stesura ci attaccava `\s*</script>` per essere sicura di prendere quello
   * giusto, e si e' rotta appena sotto ci e' finita un'altra riga: un aggancio
   * che dipende da cosa gli sta **dopo** e' un aggancio che si scolla al primo
   * che scrive li' sotto. `}, ` davanti basta a distinguerlo dall'altro
   * intervallo della pagina, che e' `setInterval(gira, 1000)` su una riga. */
  const ricarica = Number(/\}, (\d+) \* 1000\);/.exec(pagina("console"))?.[1]);

  assert.ok(Number.isFinite(primo) && Number.isFinite(ogni) && Number.isFinite(ricarica));

  const abbinare = primo / 1000 + ricarica;
  assert.ok(
    abbinare <= 30,
    `chi manda un codice aspetta ${abbinare}s prima di vedere la casa: troppi per stare davanti allo schermo`,
  );

  const cambiare = ogni * 60 + ricarica;
  assert.ok(
    cambiare <= 120,
    `una casa che cambia stato ci mette ${cambiare}s a vedersi: nessuno sta a guardare, ma due minuti sono il tetto`,
  );
});

test("il codice si scrive una volta sola: chi lo manda e chi lo ascolta si chiamano uguale", () => {
  /* Tre pezzi in tre file, e un nome che li tiene:
   *
   *  - `ponte/src/voci-nella-barra.js` mette il codice nella configurazione
   *    della plancia;
   *  - `ponte/carta/plancia.js` lo manda alla pagina con un `postMessage`;
   *  - queste due pagine lo ascoltano.
   *
   * Se uno dei tre cambia il nome del messaggio, gli altri due non se ne
   * accorgono: non c'e' nessun errore da nessuna parte, la pagina semplicemente
   * torna a chiedere il codice a mano — cioe' esattamente il difetto che questo
   * giro doveva togliere, tornato senza far rumore. */
  const carta = readFileSync(join(QUI, "..", "..", "ponte", "carta", "plancia.js"), "utf8");
  assert.match(
    carta,
    /postMessage\(\{ gdahome: "chiave", chiave \}, origine\)/,
    "la tessera deve mandarlo, e a un'origine sola",
  );
  for (const quale of ["console", "gestore"]) {
    assert.match(
      pagina(quale),
      /detto\.gdahome !== "chiave"/,
      `la pagina «${quale}» deve ascoltare quel messaggio`,
    );
  }
});

test("una chiave gia' battuta a mano non si fa sovrascrivere da una consegnata", () => {
  /* Chi ha battuto la sua chiave in questo browser ha deciso lui. Una consegna
   * che gliela cambia sotto e' un modo silenzioso di non far entrare piu'
   * nessuno — e succederebbe a chi apre la pagina da solo mentre l'add-on di
   * casa manda la sua. */
  for (const quale of ["console", "gestore"]) {
    assert.match(
      pagina(quale),
      /if \(!arrivata \|\| chiave\) return;/,
      `la pagina «${quale}» non deve scavalcare una chiave che c'e' gia'`,
    );
  }
});
