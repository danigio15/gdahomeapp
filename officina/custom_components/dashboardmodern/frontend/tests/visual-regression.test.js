import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { readLegacyBundle } from "./legacy-source.js";

const legacy = new URL("../legacy/", import.meta.url);
const expectedTabs = [
  "home",
  "energy",
  "appliances-main",
  "ev",
  "boiler",
  "clima",
  "temp",
  "tapparelle",
  "irrigazione",
  "piscina",
  "security",
  "server",
  "config",
];
/* Le impronte cambiano solo con una modifica voluta al foglio vendorizzato.
 * Questo giro sono due:
 *
 *  - il telefono non decide piu' lui quanto e' grande un carattere. Android
 *    gonfia da solo il testo dentro i contenitori che scorrono in orizzontale,
 *    ed e' per questo che il font delle linguette delle stanze in Temperature
 *    tornava «sballato» ogni volta che lo si rimpiccioliva in CSS;
 *  - le linguette dell'editor stanno in colonna. Erano diciassette voci in una
 *    fila che scorreva, tre visibili per volta: adesso si vedono tutte e il
 *    corpo della scheda si apre accanto invece che sotto. Da telefono tenuto in
 *    piedi la colonna si stringe al simbolo — il nome lo nasconde chi quel
 *    pezzo lo crea — e si riallarga appena il telefono si gira;
 *  - tutte le finestre della plancia hanno una veste sola: erano nate una alla
 *    volta e si vedeva — un anello bianco cucito nel bordo che sul tema scuro
 *    faceva da taglio, un'entrata lunga mezzo secondo, e un tasto di chiusura
 *    che pesava piu' del titolo;
 *  - a barra ferma sparisce il sensore che la chiama. Da desktop la barra sta
 *    nascosta e si affaccia quando il puntatore le arriva vicino: a chiamarla
 *    e' un rettangolo invisibile che le sborda intorno, e che sta dentro di
 *    lei — quindi sopra la pagina. Con la barra gia' ferma e alzata quella
 *    fascia cadeva sulla seconda fila delle tessere della Home, e quelle
 *    tessere non si riuscivano a premere. Sotto, un po' di respiro in piu';
 *  - la barra e' piu' bassa e meno trasparente. Era alta ottanta pixel e
 *    velata al sessantacinque per cento: con del contenuto sotto le scritte
 *    delle sezioni ci si perdevano dentro. Adesso il fondo e' quasi pieno, il
 *    vetro sfoca di piu' — quello che passa sotto si intuisce e non si legge,
 *    che e' il punto di un vetro smerigliato — e ogni voce costa dodici pixel
 *    in meno: l'icona e il nome ci stanno lo stesso, il resto era aria;
 *  - sul tondo di chiusura dello storico c'era una X di troppo. La X la
 *    disegna il ::before della regola generica, che azzera la misura del
 *    testo per nascondere quella scritta nel markup; la regola specifica
 *    dello storico rimetteva font-size 14px e le si vedevano tutte e due;
 *  - il Chiudi resta in cima anche a lista scorsa. Nei popup lunghi (il
 *    Clima rapido con tante stanze) l'intestazione scorreva via col
 *    contenuto: «il tasto Chiudi sta troppo in fondo e non si legge». Ora
 *    e' sticky sul bordo alto del foglio, col fondo pieno, e il foglio non
 *    supera l'area visibile vera (dvh) sull'app Android;
 *  - la chiusura si legge, e si legge uguale dappertutto. «Rendi coerenti le
 *    x chiudi ovunque, non solo x»: qui dentro il tondino nascondeva la
 *    parola (font-size:0) e ridisegnava la croce col ::before, mentre lo
 *    storico aveva pure una regola sua che rimetteva il testo. Ora .ev-waw-close
 *    torna la pillola scritta «✕ CHIUDI» — nessun azzeramento del carattere,
 *    nessun ::before, e l'eccezione dello storico non serve piu': tutti i
 *    fogli della plancia chiudono con la stessa pastiglia. */
/* I due fogli si sono mossi due volte, e tutt'e due per la barra in basso.
 *
 * Prima: le scritte lunghe uscivano dalla loro linguetta e finivano una sopra
 * l'altra («ENERGELÆTTRODOMESTIAUTGESTIONE TERMICGA»). Adesso si tagliano coi
 * puntini, la linguetta ha un tetto e la barra non e' mai piu' larga dello
 * schermo.
 *
 * Poi: su un tablet appeso al muro le voci stavano strette per niente. Le
 * regole del tocco sono scritte per un telefono — 72 punti a linguetta, 7 alla
 * scritta, e tutte impaccate a sinistra — e un tablet le prendeva uguali, con
 * mezza barra vuota a destra. Da 900 punti di larghezza in su adesso si
 * dividono la riga che c'e'.
 *
 * Questa impronta non e' una regola: e' una firma. Serve a far vedere che i
 * fogli si sono mossi, e chi la aggiorna deve sapere perche'. */
const vendoredCssSnapshots = {
  "dashboard-runtime-it.css": "037c40fba6739bb56149e942a33fc88d60e999b8b81aaa08f0f928998e2ce993",
  "dashboard-runtime-en.css": "44da756d2402956e2c497c6a519d291d364c43631df13b98198dea52beb07d3f",
};

for (const file of ["dashboard.html", "dashboard-en.html"]) {
  const source = readLegacyBundle(file);
  test(`${file}: navbar order and structural classes retain their DOM snapshot`, () => {
    const nav = source.match(/<nav class="tabs bottom-nav-bar">([\s\S]*?)<\/nav>/)?.[1] || "";
    assert.deepEqual(
      [...nav.matchAll(/data-tab="([^"]+)"/g)].map((match) => match[1]),
      expectedTabs,
    );
    for (const token of [
      "tab active",
      "icon",
      "text",
      "page active",
      "weather-widget",
      "cam-card",
      "appl-wide-card",
    ])
      assert.match(source, new RegExp(`class="[^"]*${token}`));
  });
  test(`${file}: Lights has assignment/reorder but no room lifecycle controls`, () => {
    const editor = source.slice(
      source.indexOf("function editorRenderLuci"),
      source.indexOf("function cdLuciAddRoom"),
    );
    assert.match(editor, /cdLuciSetRoom/);
    assert.match(editor, /cdLuciMove/);
    assert.doesNotMatch(
      editor,
      /ed-new-luci-room|cdLuciRenameRoom|cdLuciDeleteRoom|cdLuciAddRoom\(/,
    );
  });
  test(`${file}: canonical CRUD branches do not write legacy storage`, () => {
    for (const functionName of ["edApplSave", "edApplDel", "dmSaveCameras"]) {
      const start = source.indexOf(`function ${functionName}`);
      const body = source.slice(start, source.indexOf("\n}", start) + 2);
      const canonical = body.match(/if\(store\)\{?([\s\S]*?)(?:return;?|\}\s*else)/)?.[1] || "";
      assert.doesNotMatch(canonical, /localStorage\.(?:setItem|removeItem)/, functionName);
    }
  });
}

test("language-specific vendored layout styles retain byte-for-byte snapshots", () => {
  for (const [file, expected] of Object.entries(vendoredCssSnapshots)) {
    const value = readFileSync(new URL(`../legacy/${file}`, import.meta.url));
    assert.equal(createHash("sha256").update(value).digest("hex"), expected, file);
  }
});

test("shared legacy CSS does not own appliance card geometry", () => {
  const source = readFileSync(new URL("../legacy/dashboard-runtime.css", import.meta.url), "utf8");
  assert.doesNotMatch(source, /#page-appliances-main\s+\.appl-page-grid/);
  assert.doesNotMatch(source, /#page-appliances-main\s+\.appl-wide-card/);
  assert.doesNotMatch(source, /#page-appliances-main\s+\.appl-ic/);
  assert.doesNotMatch(source, /\.appl-action-btn\s*\{/);
});
