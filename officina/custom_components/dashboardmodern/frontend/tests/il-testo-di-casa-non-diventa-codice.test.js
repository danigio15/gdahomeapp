/* Un nome resta un nome.
 *
 * La plancia gira nella stessa origine di Home Assistant, e quello che scrive
 * nelle sue pagine arriva da fuori: il `friendly_name` e lo stato di
 * un'entita', le unita' di misura, le icone e i nomi della configurazione —
 * che e' condivisa fra tutti quelli di casa. Il guscio li metteva dentro
 * `innerHTML` cosi' com'erano, e nei gestori scritti nell'HTML
 * (`onclick="apriStorico(event, '…')"`) l'apice sostituito con `&#39;` non
 * bastava: il browser lo rimette a posto prima di eseguire il gestore.
 *
 * Queste prove fanno girare le funzioni vere del guscio, italiano e inglese, e
 * alcune dei moduli, con un nome scritto apposta per rompere ogni contesto —
 * testo, attributo, stringa dentro un gestore — e controllano tre cose:
 *  - la pagina che esce ha gli stessi elementi e gli stessi attributi che ha
 *    con un nome qualunque: niente tag o attributi in piu';
 *  - il testo si legge com'e' stato scritto;
 *  - i gestori, eseguiti, ricevono il nome intero come argomento e non
 *    eseguono nient'altro.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");

/* Un nome che prova tutti i contesti insieme: chiude una stringa JavaScript,
 * chiude un attributo, apre un tag con un gestore. */
const CATTIVO = `x'); alert(1);//"><img src=x onerror=alert(2)>'`;
const BUONO = "Lavatrice di casa";

/* ── strumenti ──────────────────────────────────────────────────────────── */

function funzione(sorgente, nome) {
  const inizio = sorgente.indexOf(`function ${nome}(`);
  assert.notEqual(inizio, -1, `${nome} manca`);
  const corpo = sorgente.indexOf("{", inizio);
  let profondita = 0;
  let apice = "";
  let saltato = false;
  for (let i = corpo; i < sorgente.length; i += 1) {
    const c = sorgente[i];
    if (apice) {
      if (saltato) saltato = false;
      else if (c === "\\") saltato = true;
      else if (c === apice) apice = "";
      continue;
    }
    if (c === "'" || c === '"' || c === "`") apice = c;
    else if (c === "{") profondita += 1;
    else if (c === "}" && --profondita === 0) return sorgente.slice(inizio, i + 1);
  }
  throw new Error(`${nome} non finisce`);
}

const ENTITA = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decodifica(testo) {
  return testo.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tutto, nome) => {
    if (nome[0] === "#")
      return String.fromCodePoint(
        nome[1] === "x" || nome[1] === "X" ? parseInt(nome.slice(2), 16) : Number(nome.slice(1)),
      );
    return ENTITA[nome.toLowerCase()] ?? tutto;
  });
}

/* I tag di un pezzo di HTML, con i loro attributi, letti come li leggerebbe
 * il browser. Basta per quello che serve qui: dire quali elementi e quali
 * attributi esistono. */
function tagDi(html) {
  const tag = [];
  const apertura =
    /<([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g;
  for (const [, nome, grezzi] of html.matchAll(apertura)) {
    const attributi = new Map();
    const attributo = /\s+([^\s"'>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g;
    for (const [, chiave, valore = ""] of grezzi.matchAll(attributo)) {
      const nudo = /^["']/.test(valore) ? valore.slice(1, -1) : valore;
      attributi.set(chiave.toLowerCase(), decodifica(nudo));
    }
    tag.push({ nome: nome.toLowerCase(), attributi });
  }
  return tag;
}

const forma = (html) =>
  tagDi(html).map(({ nome, attributi }) => `${nome}[${[...attributi.keys()].sort().join(",")}]`);

const testoDi = (html) => decodifica(html.replace(/<[^>]*>/g, ""));

/* Esegue ogni gestore `on…` come farebbe il browser, con le funzioni della
 * plancia sostituite da registratori. */
function eseguiGestori(html) {
  const chiamate = [];
  const allarmi = [];
  const registra =
    (nome) =>
    (...argomenti) =>
      chiamate.push([nome, ...argomenti]);
  const contesto = vm.createContext({
    alert: (...a) => allarmi.push(a),
    event: { stopPropagation() {}, preventDefault() {} },
    document: { getElementById: () => ({}) },
    window: {},
  });
  const PAROLE = new Set(["function", "if", "return", "typeof", "call"]);
  for (const { attributi } of tagDi(html))
    for (const [chiave, codice] of attributi) {
      if (!chiave.startsWith("on")) continue;
      /* Ogni funzione chiamata dal gestore diventa un registratore. */
      for (const [, nome] of codice.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g))
        if (!PAROLE.has(nome) && !(nome in contesto)) contesto[nome] = registra(nome);
      vm.runInContext(`(function(){${codice}\n}).call({})`, contesto);
    }
  return { chiamate, allarmi };
}

function assertInnocuo(cattivo, buono, etichetta) {
  /* Stessi elementi, stessi attributi: un <img> o un onerror in piu' si
   * vedrebbero qui. */
  assert.deepEqual(forma(cattivo), forma(buono), `${etichetta}: il nome ha aggiunto markup`);
  const { allarmi } = eseguiGestori(cattivo);
  assert.deepEqual(allarmi, [], `${etichetta}: un gestore ha eseguito codice del nome`);
}

const elemento = () => ({ innerHTML: "", classList: { add() {}, remove() {} }, style: {} });
function paginaFinta() {
  const elementi = {};
  return {
    elementi,
    document: { getElementById: (id) => (elementi[id] ||= elemento()) },
  };
}

/* ── il guscio ──────────────────────────────────────────────────────────── */

const AIUTANTI = ["cdEsc", "cdJs", "cdUrlOk", "cdUrl", "cdColor", "cdIconMarkup"];

for (const lingua of ["it", "en"]) {
  const sorgente = leggi(`../legacy/dashboard-runtime-${lingua}.js`);
  const conAiutanti = (...nomi) =>
    [...AIUTANTI, ...nomi].map((n) => funzione(sorgente, n)).join("\n");

  test(`${lingua}: cdEsc, cdJs e cdUrl fanno ognuno il suo mestiere`, () => {
    const c = vm.createContext({});
    vm.runInContext(conAiutanti(), c);
    assert.equal(
      c.cdEsc(`<a href="x" title='y'>&</a>`),
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
    assert.equal(c.cdEsc(null), "");
    assert.equal(c.cdEsc(0), "0");
    /* cdJs: dentro un attributo diventa, una volta decodificato, una stringa
     * JavaScript che vale esattamente il nome. */
    const js = c.cdJs(CATTIVO);
    assert.ok(!/["'<>]/.test(js), "cdJs lascia caratteri che chiudono l'attributo");
    assert.equal(vm.runInNewContext(decodifica(js)), CATTIVO);
    for (const buono of [
      "https://casa.example/x.png",
      "http://192.168.1.2:8123/local/a.png",
      "/local/auto.png",
      "/api/camera_proxy/camera.giardino?token=a&b=c",
      "img/relativa.png",
      "data:image/png;base64,iVBORw0KGgo=",
      "data:image/jpeg;base64,AAAA",
    ])
      assert.equal(c.cdUrlOk(buono), buono, buono);
    for (const cattivo of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      " javascript:alert(1)",
      "java\tscript:alert(1)",
      "vbscript:msgbox(1)",
      "data:text/html,<script>alert(1)</script>",
      "data:image/svg+xml,<svg onload=alert(1)>",
    ])
      assert.equal(c.cdUrlOk(cattivo), "", cattivo);
    assert.equal(c.cdColor("#0ea5e9", "red"), "#0ea5e9");
    assert.equal(c.cdColor("rgb(1, 2, 3)", "red"), "rgb(1, 2, 3)");
    assert.equal(c.cdColor('red;"><img src=x>', "#fff"), "#fff");
  });

  test(`${lingua}: un'icona che non e' mdi: esce come testo, non come markup`, () => {
    const c = vm.createContext({});
    vm.runInContext(conAiutanti(), c);
    assert.equal(c.cdIconMarkup("🛋️", 22), "🛋️");
    const icona = c.cdIconMarkup(CATTIVO, 22);
    assert.deepEqual(tagDi(icona), []);
    assert.equal(testoDi(icona), CATTIVO);
    const mdi = c.cdIconMarkup('mdi:sofa" onclick="alert(1)', 22);
    assert.deepEqual(forma(mdi), ["ha-icon[icon,style]"]);
  });

  test(`${lingua}: il dettaglio dell'elettrodomestico scrive nome, stato e unita' come testo`, () => {
    const disegna = (nome) => {
      const { elementi, document } = paginaFinta();
      const entita = "switch.lavatrice";
      const contesto = vm.createContext({
        document,
        navigator: {},
        STATES: {
          [entita]: {
            state: nome,
            attributes: { friendly_name: nome, unit_of_measurement: nome },
          },
        },
        getAppliances: () => [{ name: nome, entities: [entita] }],
        cdApplStatus: () => ({ label: "OFF", cls: "off", w: null }),
        cdApplianceVisual: () => "<svg></svg>",
        cdApplianceDisplayName: (a) => a.name,
      });
      vm.runInContext(
        `${conAiutanti("apriApplianceDetail")};this.apri=apriApplianceDetail`,
        contesto,
      );
      contesto.apri(0);
      return elementi["details-title"].innerHTML + elementi["details-list"].innerHTML;
    };
    const cattivo = disegna(CATTIVO);
    assertInnocuo(cattivo, disegna(BUONO), "dettaglio elettrodomestico");
    assert.ok(testoDi(cattivo).includes(CATTIVO), "il nome non si legge com'e' stato scritto");
    const { chiamate } = eseguiGestori(cattivo);
    const storico = chiamate.find(([nome]) => nome === "apriStorico");
    assert.deepEqual(storico.slice(2), ["switch.lavatrice", CATTIVO]);
  });

  test(`${lingua}: gli avvisi personalizzati condivisi non portano markup nella Home`, () => {
    const disegna = (nome) => {
      const { elementi, document } = paginaFinta();
      const avvisi = [{ name: nome, icon: nome, entity: "binary_sensor.acqua", cond: "on" }];
      const contesto = vm.createContext({
        document,
        STATES: {
          "binary_sensor.acqua": { state: "on", attributes: { friendly_name: nome } },
        },
        cdCfgList: () => avvisi,
      });
      vm.runInContext(
        `${conAiutanti("cdAvvisoActive", "cdRenderCustomAvvisi", "_avvRenderPopup")};this.home=cdRenderCustomAvvisi;this.popup=_avvRenderPopup`,
        contesto,
      );
      contesto.home();
      contesto.popup(avvisi[0], 0, true);
      return (
        elementi["glance-custom-wrap"].innerHTML +
        elementi["details-title"].innerHTML +
        elementi["details-list"].innerHTML
      );
    };
    const cattivo = disegna(CATTIVO);
    assertInnocuo(cattivo, disegna(BUONO), "avvisi personalizzati");
    assert.ok(testoDi(cattivo).includes(CATTIVO));
  });

  test(`${lingua}: le sostituzioni di entita' si cancellano col loro nome intero`, () => {
    const disegna = (nome) => {
      const contesto = vm.createContext({ ENTITY_OVERRIDES: { [nome]: nome } });
      vm.runInContext(`${conAiutanti("editorRenderSost")};this.sost=editorRenderSost`, contesto);
      return contesto.sost();
    };
    const cattivo = disegna(CATTIVO);
    assertInnocuo(cattivo, disegna(BUONO), "sostituzioni");
    const { chiamate } = eseguiGestori(cattivo);
    assert.deepEqual(
      chiamate.filter(([nome]) => nome === "edDelOverride"),
      [["edDelOverride", CATTIVO]],
    );
  });

  test(`${lingua}: il nome di una telecamera non apre niente oltre alla telecamera`, () => {
    const disegna = (nome) => {
      const { elementi, document } = paginaFinta();
      const contesto = vm.createContext({
        document,
        getCameras: () => [{ name: nome, entity: `camera.${nome}` }],
      });
      vm.runInContext(
        `${conAiutanti("camSlug", "buildCamCards")};this.carte=buildCamCards`,
        contesto,
      );
      contesto.carte();
      return elementi["cam-grid"].innerHTML;
    };
    const cattivo = disegna(CATTIVO);
    assertInnocuo(cattivo, disegna(BUONO), "telecamere");
    const { chiamate } = eseguiGestori(cattivo);
    assert.equal(chiamate[0][0], "apriCamera");
    assert.equal(chiamate[0][1], `cam-${CATTIVO}`);
    assert.ok(chiamate[0][2].endsWith(CATTIVO.toUpperCase()));
  });

  test(`${lingua}: l'immagine di un elettrodomestico accetta solo indirizzi da immagine`, () => {
    const visuale = (valore, nome = BUONO) => {
      const contesto = vm.createContext({
        DM_APPLIANCES: [],
        window: {
          DashboardModernModules: {
            data: { applianceMedia: () => ({ kind: "image", value: valore }) },
          },
        },
      });
      contesto.DashboardModernModules = contesto.window.DashboardModernModules;
      vm.runInContext(
        `${conAiutanti("cdApplianceIcon", "cdApplianceType", "cdApplianceVisual")};this.visuale=cdApplianceVisual`,
        contesto,
      );
      return contesto.visuale({ name: nome }, 30);
    };
    const [img] = tagDi(visuale("javascript:alert(1)"));
    assert.equal(img.attributi.get("src"), "");
    const [vera] = tagDi(visuale("/local/lavatrice.png"));
    assert.equal(vera.attributi.get("src"), "/local/lavatrice.png");
    const conNome = visuale("/local/lavatrice.png", CATTIVO);
    assert.deepEqual(forma(conNome), forma(visuale("/local/lavatrice.png")));
    assert.equal(tagDi(conNome)[0].attributi.get("alt"), CATTIVO);
  });

  test(`${lingua}: nessun gestore del guscio mette un valore fra apici a mano`, () => {
    /* La forma che ha dato il difetto: `'${…}'` o `'+x+'` fra apici dentro un
     * on…="". I valori in un gestore passano da cdJs; fra apici restano solo
     * le costanti del guscio, elencate qui una per una. */
    const COSTANTI = new Set(["x.e", "a.t", "type", "k", "encodeURIComponent(h.sel)"]);
    const sospetti = [];
    for (const [riga, numero] of sorgente.split("\n").map((r, i) => [r, i + 1]))
      for (const [gestore] of riga.matchAll(/\bon[a-z]+="[^"]*"/g))
        for (const [, a, b] of gestore.matchAll(
          /'\$\{([^}]*)\}'|\\?''\s*\+\s*([^+]+?)\s*\+\s*'\\?'/g,
        ))
          if (!COSTANTI.has((a ?? b).trim())) sospetti.push(`${numero}: ${gestore.slice(0, 120)}`);
    assert.deepEqual(sospetti, []);
  });
}

/* ── il debug del guscio ────────────────────────────────────────────────── */

for (const lingua of ["it", "en"]) {
  test(`${lingua}: il pannello di debug scrive lo stato come testo`, () => {
    const sorgente = leggi(`../legacy/dashboard-debug-${lingua}.js`);
    const pannello = { innerHTML: "" };
    const contesto = vm.createContext({
      document: { getElementById: (id) => (id === "debug-content" ? pannello : null) },
      STATES: { "dm.server_cpu": { state: CATTIVO, last_updated: new Date().toISOString() } },
      Date,
      Math,
    });
    vm.runInContext(`${sorgente};this.aggiorna=updateDebug`, contesto);
    contesto.aggiorna();
    for (const { nome } of tagDi(pannello.innerHTML)) assert.notEqual(nome, "img");
    assert.ok(testoDi(pannello.innerHTML).includes(CATTIVO));
  });
}

/* ── i moduli ───────────────────────────────────────────────────────────── */

test("esc dei moduli copre i cinque caratteri, e jsArg regge dentro un gestore", async () => {
  const { esc, jsArg } = await import("../src/sections/shared.js");
  assert.equal(
    esc(`<a href="x" title='y'>&</a>`),
    "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
  );
  const js = jsArg(CATTIVO);
  assert.ok(!/["'<>]/.test(js));
  assert.equal(vm.runInNewContext(decodifica(js)), CATTIVO);
});

test("la scheda Luci: il cestino e le frecce ricevono l'entita' intera", async () => {
  const deposito = new Map();
  const prima = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (deposito.has(k) ? deposito.get(k) : null),
    setItem: (k, v) => deposito.set(k, String(v)),
    removeItem: (k) => deposito.delete(k),
  };
  try {
    const { renderCanonicalLightsEditor } =
      await import("../src/sections/lights-alerts-section.js");
    const disegna = (id) => {
      deposito.set("cd_luci", JSON.stringify({ [id]: id, "light.seconda": "Seconda" }));
      return renderCanonicalLightsEditor();
    };
    const cattivo = disegna(`light.${CATTIVO}`);
    assertInnocuo(cattivo, disegna("light.buona"), "scheda Luci");
    const { chiamate } = eseguiGestori(cattivo);
    const cestino = chiamate.find(
      ([nome, entita]) => nome === "dmLuceDel" && entita !== "light.seconda",
    );
    assert.deepEqual(cestino, ["dmLuceDel", `light.${CATTIVO}`]);
  } finally {
    globalThis.localStorage = prima;
  }
});

test("una marca d'auto scritta a mano resta testo", async () => {
  const { carBrandVisual } = await import("../src/core/personalization-catalog.js");
  /* Senza lettere di una marca vera dentro: una marca riconosciuta usa il
   * nome del catalogo, e qui si vuole la strada del nome scritto a mano. */
  const disegno = carBrandVisual(`"><u onclick=alert(1)>`, 30);
  for (const { nome, attributi } of tagDi(disegno)) {
    assert.notEqual(nome, "img");
    for (const chiave of attributi.keys()) assert.ok(!chiave.startsWith("on"), chiave);
  }
});

test("un simbolo che porta markup non passa per un'emoji", async () => {
  const { directEmoji } = await import("../src/core/personalization-catalog.js");
  assert.equal(directEmoji("🛋️"), "🛋️");
  assert.equal(directEmoji("<b>x</b>"), "");
  assert.equal(directEmoji('"><i>'), "");
});
