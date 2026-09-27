/* Il riquadro «Il servizio», nel cruscotto gdahome.
 *
 * «Mi fai più bella la parte dei dispositivi connessi nel cruscotto gestore.»
 * Il riquadro era due paragrafi in grassetto e cinque caselle stirate per
 * tutta la larghezza — il numero in alto a sinistra, e mezzo riquadro vuoto
 * accanto. Adesso ogni macchina ha la sua testa, con disegno, nome e la
 * pastiglia che dice come sta; i conti sono mattonelle; gli interruttori del
 * tramite sono pastiglie con la spia.
 *
 * Ma una faccenda di bellezza non si mette in una prova, e quella che si
 * mette e' un'altra: **`/salute` dice da giorni «non mi aggiorno», e questa
 * pagina non lo leggeva**. E' il segnale per cui il riquadro esiste — un
 * quadro che ha smesso di aggiornarsi non lo scopre nessun altro — e finiva
 * nel corpo della risposta senza arrivare a nessuno schermo.
 *
 * ─── Perche' fa girare la funzione invece di leggerla ────────────────────
 *
 * Perche' una prova che guarda il testo del programma dice solo che una
 * parola c'e'. Ne abbiamo gia' pagato il prezzo altrove: cure passate
 * avevano la loro prova verde e non curavano niente, perche' la prova
 * guardava le lettere e non quello che ne usciva. Qui `ilServizio()` viene
 * ritagliata dalla pagina e chiamata davvero, con i dati che le arriverebbero
 * dal server: quello che si controlla e' il pezzo di pagina che ne esce.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const PAGINA = readFileSync(join(QUI, "..", "gestore", "index.html"), "utf8");

/* Il pezzo di programma che comincia con `apre` e finisce quando le parentesi
 * graffe tornano a pari. Vale per quello che c'e' qui: chi ci scrivesse dentro
 * una graffa spaiata dentro una stringa se lo sente dire dal controllo sotto,
 * invece di trovarsi una prova che ritaglia il pezzo sbagliato. */
function ritaglia(apre) {
  const da = PAGINA.indexOf(apre);
  assert.ok(da >= 0, `nella pagina non c'e' piu' «${apre}»`);
  const primaGraffa = PAGINA.indexOf("{", da);
  let profondita = 0;
  for (let i = primaGraffa; i < PAGINA.length; i += 1) {
    if (PAGINA[i] === "{") profondita += 1;
    else if (PAGINA[i] === "}") {
      profondita -= 1;
      if (profondita === 0) return PAGINA.slice(da, i + 1);
    }
  }
  throw new Error(`«${apre}» non si chiude`);
}

/* La pagina non si puo' caricare qui — vuole un documento, un deposito e un
 * server — e allora si prende solo quello che serve al riquadro. */
function laFabbrica() {
  const pezzi = [
    "let SALUTE = null;",
    `const testo = (cosa) => String(cosa).replace(/[&<>"']/g, (uno) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[uno]);`,
    ritaglia("const LE_ICONE ="),
    ritaglia("function daQuantoAcceso"),
    ritaglia("function oreInParole"),
    ritaglia("function ilServizio"),
    "return (salute) => { SALUTE = salute; return ilServizio(); };",
  ];
  for (const pezzo of pezzi) {
    const graffe =
      [...pezzo].filter((c) => c === "{").length - [...pezzo].filter((c) => c === "}").length;
    assert.equal(graffe, 0, "un pezzo ritagliato ha le graffe spaiate");
  }
  // eslint-disable-next-line no-new-func
  return new Function(pezzi.join("\n"))();
}

const disegna = laFabbrica();

const IL_QUADRO = { vivo: true, versione: "1.6.1", case: 7, installatori: 2, gestore: true };
const IL_TRAMITE = {
  vivo: true,
  accesoDa: 486000,
  case: 6,
  installate: 11,
  collegamenti: 9,
  app: 4,
  web: 2,
  segnalazioni: true,
  chat: 3,
  console: true,
  posta: false,
};

test("senza numeri dal server il riquadro non c'e'", () => {
  assert.equal(disegna(null), "");
});

test("i conti del quadro e del tramite ci sono tutti, ognuno con la sua parola", () => {
  const html = disegna({ ...IL_QUADRO, tramite: IL_TRAMITE });
  for (const [quanti, cosa] of [
    ["7", "case seguite"],
    ["2", "installatori"],
    ["11", "impianti con gdahome"],
    ["6", "collegati adesso"],
    ["4", "la guardano dall&#39;app"],
    ["2", "la guardano dal browser"],
    ["3", "conversazioni di assistenza"],
  ]) {
    assert.match(
      html,
      new RegExp(`<b>${quanti}</b><span>${cosa}</span>`),
      `manca «${quanti} ${cosa}»`,
    );
  }
  assert.match(html, /versione 1\.6\.1/);
  assert.match(html, /acceso da 6 giorni/);
});

test("«non mi aggiorno» arriva sullo schermo: da quanto, e perche'", () => {
  /* Il difetto per nome: /salute lo diceva, e la pagina lo buttava via. */
  const fermo = disegna({
    ...IL_QUADRO,
    nonMiAggiorno: { da: "2026-09-20T10:00:00Z", ore: 76, perche: "git pull rifiutato" },
    tramite: IL_TRAMITE,
  });
  assert.match(fermo, /pastiglia guardare">non si aggiorna</);
  assert.match(fermo, /Fermo da 3 giorni — git pull rifiutato\./);

  const sano = disegna({ ...IL_QUADRO, tramite: IL_TRAMITE });
  assert.match(sano, /pastiglia posto">in ordine</);
  assert.doesNotMatch(sano, /Fermo da/);
});

test("il tramite dice come sta nella pastiglia, non in coda a una riga", () => {
  const acceso = disegna({ ...IL_QUADRO, tramite: IL_TRAMITE });
  assert.match(acceso, /pastiglia posto">acceso</);

  const muto = disegna({ ...IL_QUADRO, tramite: { ...IL_TRAMITE, vivo: false, accesoDa: null } });
  assert.match(muto, /pastiglia offline">non risponde</);
  /* E i suoi numeri restano: quello che aveva quando rispondeva si legge
   * ancora, altrimenti non si capisce cosa si e' perso. */
  assert.match(muto, /<b>6<\/b><span>collegati adesso<\/span>/);
});

test("gli interruttori del tramite concordano, uno per uno", () => {
  const html = disegna({ ...IL_QUADRO, tramite: IL_TRAMITE });
  /* «segnalazioni accesa» era scritto cosi', al singolare, per tutti e tre:
   * una parola sola per tre nomi di genere e numero diversi. */
  assert.match(html, /data-acceso="sì"><i><\/i>segnalazioni <b>attive<\/b>/);
  /* L'apostrofo passa da `testo()` come tutto il resto: qui si legge
   * `dell&#39;assistenza`, ed e' giusto cosi'. */
  assert.match(html, /data-acceso="sì"><i><\/i>console dell&#39;assistenza <b>attiva<\/b>/);
  assert.match(html, /data-acceso="no"><i><\/i>posta <b>non attiva<\/b>/);
  assert.doesNotMatch(html, /segnalazioni <b>accesa<\/b>/);
});

test("un tramite che non c'e' lo dice, e dice dove guardare", () => {
  const html = disegna({ ...IL_QUADRO, tramite: null });
  assert.match(html, /Il tramite/);
  assert.match(html, /non risponde di qui/);
  assert.match(html, /127\.0\.0\.1:8099\/salute/);
});

test("quello che arriva dal server non diventa pagina", () => {
  const html = disegna({
    ...IL_QUADRO,
    versione: '<img src=x onerror="alert(1)">',
    nonMiAggiorno: { da: "", ore: 5, perche: "<script>alert(2)</script>" },
    tramite: IL_TRAMITE,
  });
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script&gt;/);
});

/* «io voglio sapere su case, quanti hanno installato e funzionante gdahome.
 * app quanto stanno usando da app e collegamenti aperti quanti la stanno
 * usando da web.»
 *
 * Tre domande. Le mattonelle ne rispondevano una e mezza, e con le parole
 * sbagliate:
 *
 *   · «case collegate» sembrava «quante case hanno gdahome» ed era «quante ce
 *     l'hanno accesa e collegata in questo istante»;
 *   · «collegamenti aperti» non voleva dire niente per nessuno: era la somma
 *     dei fili, abbinamenti in corso compresi;
 *   · «app aperte» contava chiunque fosse abbinato — l'app sul telefono e una
 *     scheda di browser finivano nello stesso numero.
 *
 * Adesso ogni mattonella risponde a una domanda sola, e chi non la sa dire non
 * la disegna.
 */
test("ogni mattonella del tramite risponde a una domanda sola", () => {
  const html = disegna({
    ...IL_QUADRO,
    tramite: { ...IL_TRAMITE, installate: 152, case: 140, app: 7, web: 3 },
  });

  /* Quanti hanno installato, e quanti di quelli sono accesi adesso. Sono due
   * numeri, e il secondo non e' mai piu' grande del primo. */
  assert.match(html, /<b>152<\/b><span>impianti con gdahome<\/span>/);
  assert.match(html, /<b>140<\/b><span>collegati adesso<\/span>/);

  /* E chi sta guardando, diviso per come. */
  assert.match(html, /<b>7<\/b><span>la guardano dall&#39;app<\/span>/);
  assert.match(html, /<b>3<\/b><span>la guardano dal browser<\/span>/);

  /* Le parole che mentivano non ci sono piu'. */
  assert.doesNotMatch(html, /telefoni collegati/);
  assert.doesNotMatch(html, /collegamenti aperti/);
  assert.doesNotMatch(html, /case collegate/);
  assert.doesNotMatch(html, />app aperte</);
});

/* Un tramite non ancora aggiornato non sa dire i due numeri nuovi, e il quadro
 * li passa `null`. Una mattonella con dentro `null` — o uno zero che nessuno
 * ha contato — direbbe che nessuno ha installato gdahome e che nessuno la sta
 * guardando dal browser. Meglio due mattonelle in meno. */
test("i numeri che un tramite vecchio non dice non diventano zeri", () => {
  const html = disegna({
    ...IL_QUADRO,
    tramite: { ...IL_TRAMITE, installate: null, web: null },
  });
  assert.doesNotMatch(html, /impianti con gdahome/);
  assert.doesNotMatch(html, /la guardano dal browser/);

  /* Quello che sa dire lo dice come sempre. */
  assert.match(html, /<b>6<\/b><span>collegati adesso<\/span>/);
  assert.match(html, /<b>4<\/b><span>la guardano dall&#39;app<\/span>/);
});

/* Zero non e' «non lo so»: un tramite che risponde e dice zero ha contato, e
 * quello zero va scritto. Nessuno che guarda dal browser alle quattro di notte
 * e' una cosa vera. */
test("uno zero contato si scrive", () => {
  const html = disegna({ ...IL_QUADRO, tramite: { ...IL_TRAMITE, installate: 0, web: 0 } });
  assert.match(html, /<b>0<\/b><span>impianti con gdahome<\/span>/);
  assert.match(html, /<b>0<\/b><span>la guardano dal browser<\/span>/);
});
