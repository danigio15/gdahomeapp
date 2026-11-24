/* «Casa 3D»: si riapre sempre, e la finestra della telecamera si chiude.
 *
 * Dal telefono, il giorno della 1.19.28: «premendo sulla videocamera mi dà
 * errore… ma se premo sulla X per togliere l'errore della telecamera non mi
 * fa uscire: devo chiudere tutta l'app e riaprirla». E qualche minuto dopo:
 * «anzi, non mi si apre più la casa, sempre da telefono». E dal tablet: «ora
 * si apre, ma è ancora pesante per lui».
 *
 *   · la finestra del video. Il ridisegno la lasciava in pagina finche' la
 *     telecamera si poteva guardare — cioe' sempre — anche dopo la ✕, il
 *     tocco fuori o l'Esc. Adesso «aperta» lo dice la finestra
 *     (`cosaFareDelVideo`);
 *   · il disegno che cade con la pagina dietro. Il telefono che passa a
 *     un'altra app si vede riprendere il disegno dal browser: contate come le
 *     altre, quattro andate e ritorni in cinque minuti facevano dire alla casa
 *     che il dispositivo non ha memoria grafica, e gia' alla prima la casa
 *     tornava sgranata. Quelle non contano (`laCadutaConta`);
 *   · la pesantezza. Un tablet con poca memoria e pochi nuclei parte gia'
 *     leggero, e chi va a scatti lo stesso scende di un gradino alla volta
 *     (`fotogrammiLenti`, `lenta`).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { cosaFareDelVideo } from "../src/core/casa-3d.js";
import {
  CADUTE_AL_MASSIMO,
  FOTOGRAMMI_DA_MISURARE,
  GRADINI_PER_LA_LENTEZZA,
  GRAZIA_DEL_RITORNO_MS,
  TEMPO_DA_MISURARE_MS,
  cosaFareDopoLaCaduta,
  fotogrammiLenti,
  laCadutaConta,
  nucleiDelDispositivo,
  qualitaDellaCasa3D,
  senzaLeCaduteDiAdesso,
} from "../src/core/la-qualita-della-casa-3d.js";

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");
const SEZIONE = leggi("../src/sections/casa-3d-section.js");
/* il corpo di una funzione della sezione, fino alla graffa che la chiude */
const funzione = (nome) => {
  const da = SEZIONE.indexOf(`function ${nome}(`);
  assert.ok(da >= 0, `manca ${nome}`);
  return SEZIONE.slice(da, SEZIONE.indexOf("\n}\n", da));
};

/* ── la finestra della telecamera ─────────────────────────────────────── */

const GUARDABILI = new Set(["camera.ingresso", "camera.soggiorno"]);
const APERTA = { tipo: "telecamera", entity: "camera.ingresso" };

test("la finestra chiusa se ne va, anche se la telecamera si potrebbe guardare ancora", () => {
  /* la ✕, il tocco fuori e l'Esc tolgono la finestra dallo stato: il video
   * rimasto in pagina non la tiene aperta */
  assert.equal(cosaFareDelVideo(null, "camera.ingresso", GUARDABILI), "togli");
  assert.equal(cosaFareDelVideo(undefined, "camera.ingresso", GUARDABILI), "togli");
  /* anche quella in errore, che una telecamera guardabile lo e' lo stesso */
  assert.equal(cosaFareDelVideo(null, "camera.soggiorno", GUARDABILI), "togli");
  /* e quella di una telecamera che Home Assistant non conosce */
  assert.equal(cosaFareDelVideo(null, "camera.fantasma", GUARDABILI), "togli");
});

test("il video vivo non si riscrive finche' la sua finestra resta aperta", () => {
  assert.equal(cosaFareDelVideo(APERTA, "camera.ingresso", GUARDABILI), "resta");
  assert.equal(cosaFareDelVideo(APERTA, "", GUARDABILI), "niente");
  assert.equal(cosaFareDelVideo(null, "", GUARDABILI), "niente");
});

test("un'altra finestra al suo posto: il video di prima se ne va", () => {
  assert.equal(
    cosaFareDelVideo({ tipo: "clima", entity: "climate.camera" }, "camera.ingresso", GUARDABILI),
    "togli",
  );
  assert.equal(
    cosaFareDelVideo(
      { tipo: "telecamera", entity: "camera.soggiorno" },
      "camera.ingresso",
      GUARDABILI,
    ),
    "togli",
  );
});

test("una telecamera che smette di potersi guardare si chiude da sola", () => {
  assert.equal(cosaFareDelVideo(APERTA, "camera.ingresso", new Set()), "spegni");
  assert.equal(cosaFareDelVideo(APERTA, "camera.ingresso", null), "spegni");
});

test("il ridisegno chiede alla finestra, non al video rimasto in pagina", () => {
  const disegna = funzione("disegna");
  assert.match(
    disegna,
    /cosaFareDelVideo\(state\.finestra, video\?\.dataset\.c3Video, guardabili\)/,
  );
  /* la riga di prima: bastava che la telecamera si potesse guardare */
  assert.doesNotMatch(SEZIONE, /if \(video && guardabili\.has\(video\.dataset\.c3Video\)\)/);
  /* chiudere toglie la finestra comunque, anche se il ridisegno inciampa */
  const chiudi = funzione("chiudi");
  assert.match(chiudi, /state\.finestra = null;/);
  assert.match(chiudi, /sopra\.textContent = ""/);
  /* i tre modi di uscire */
  assert.match(SEZIONE, /if \(cosa === "chiudi"\) return chiudi\(\);/);
  assert.match(SEZIONE, /evento\.key === "Escape" && state\.finestra\) chiudi\(\)/);
  assert.match(funzione("alClic"), /cosa === "velo"[\s\S]*?chiudi\(\);/);
});

test("sotto l'errore della telecamera: cosa fare, «Riprova» e «Chiudi»", () => {
  const finestra = funzione("finestraMarkup");
  assert.match(finestra, /c3-video-aiuto/);
  assert.match(finestra, /data-c3s="rivedi"/);
  assert.match(finestra, /class="c3-tasto" data-c3s="chiudi"/);
  assert.match(finestra, /Cosa fare: controlla che la telecamera sia accesa/);
  /* si vede solo se il motore ha scritto un errore */
  assert.match(SEZIONE, /\.c3-finestra:has\(\.cam-popup-error\) \.c3-video-aiuto\{display:flex\}/);
  assert.match(SEZIONE, /\.c3-video-aiuto\{display:none/);
  /* una telecamera che Home Assistant non conosce lo dice subito */
  const accendi = funzione("accendiIlVideo");
  assert.match(accendi, /if \(!states\?\.\[entity\]\)/);
  assert.match(accendi, /Home Assistant non conosce questa telecamera/);
});

test("con una finestra sopra la casa non si disegna", () => {
  assert.match(funzione("disegna"), /state\.scena\?\.sospendi\?\.\(Boolean\(state\.finestra\)\)/);
  for (const file of [
    "../src/sections/casa-3d/scena.js",
    "../src/sections/casa-3d/scena-modello.js",
  ]) {
    const scena = leggi(file);
    assert.match(scena, /function sospendi\(si\)/, file);
    assert.match(scena, /if \(S\.morto \|\|[^\n]*S\.sospesa[^\n]*\) return;/, file);
    assert.match(scena, /\n {4}sospendi,\n/, file);
  }
});

/* ── il disegno che cade con la pagina dietro ─────────────────────────── */

test("una caduta con la pagina nascosta non e' il dispositivo che non ce la fa", () => {
  const adesso = 50 * 60 * 1000;
  assert.equal(laCadutaConta({ nascosta: true, tornataIl: 0, adesso }), false);
  /* in vista, e mai andata via: conta */
  assert.equal(laCadutaConta({ nascosta: false, tornataIl: 0, adesso }), true);
  assert.equal(laCadutaConta({ adesso }), true);
  /* appena tornata: il browser la caduta la dice anche al ritorno */
  assert.equal(laCadutaConta({ nascosta: false, tornataIl: adesso - 300, adesso }), false);
  assert.equal(
    laCadutaConta({ nascosta: false, tornataIl: adesso - GRAZIA_DEL_RITORNO_MS + 1, adesso }),
    false,
  );
  /* tornata da un pezzo: conta di nuovo */
  assert.equal(
    laCadutaConta({ nascosta: false, tornataIl: adesso - GRAZIA_DEL_RITORNO_MS, adesso }),
    true,
  );
  assert.equal(laCadutaConta({ nascosta: false, tornataIl: adesso - 60_000, adesso }), true);
  /* numeri storti non rompono niente */
  assert.equal(laCadutaConta({ nascosta: false, tornataIl: NaN, adesso: NaN }), true);
  assert.equal(laCadutaConta(), true);
});

test("il telefono che va e viene dieci volte non fa dire «basta»", () => {
  /* come fa la sezione: si conta solo se `laCadutaConta` */
  let cadute = [];
  let basta = false;
  let adesso = 10 * 60 * 1000;
  for (let i = 0; i < 10; i++) {
    adesso += 20_000;
    /* l'app va dietro, il disegno cade */
    if (laCadutaConta({ nascosta: true, tornataIl: adesso - 20_000, adesso })) {
      const esito = cosaFareDopoLaCaduta(cadute, adesso);
      cadute = esito.cadute;
      basta ||= esito.azione === "basta";
    }
  }
  assert.equal(cadute.length, 0);
  assert.equal(basta, false);
  /* senza la regola, le stesse cadute lo dicevano alla quinta */
  let contate = [];
  let diceva = false;
  for (let i = 0; i <= CADUTE_AL_MASSIMO; i++) {
    const esito = cosaFareDopoLaCaduta(contate, adesso + i * 20_000);
    contate = esito.cadute;
    diceva ||= esito.azione === "basta";
  }
  assert.equal(diceva, true);
  /* e la casa rifatta dopo una di quelle resta com'era, non piu' leggera */
  const q = qualitaDellaCasa3D({ dpr: 3, larghezza: 370, altezza: 520, cadute: cadute.length });
  assert.equal(q.pixel, 2);
  assert.equal(q.antialias, true);
});

test("la caduta arrivata un attimo prima che la pagina se ne andasse si toglie", () => {
  const adesso = 30 * 60 * 1000;
  const vecchia = adesso - 2 * 60 * 1000;
  assert.deepEqual(senzaLeCaduteDiAdesso([vecchia, adesso - 400], adesso), [vecchia]);
  assert.deepEqual(senzaLeCaduteDiAdesso([vecchia], adesso), [vecchia]);
  assert.deepEqual(senzaLeCaduteDiAdesso([adesso - GRAZIA_DEL_RITORNO_MS], adesso), [
    adesso - GRAZIA_DEL_RITORNO_MS,
  ]);
  assert.deepEqual(senzaLeCaduteDiAdesso(null, adesso), []);
  assert.deepEqual(senzaLeCaduteDiAdesso(["x", NaN, adesso - 10], adesso), []);
});

test("la sezione non conta le cadute con la pagina dietro, e al ritorno riparte", () => {
  const caduta = funzione("scenaCaduta");
  /* prima si guarda se conta, poi si conta */
  const guarda = caduta.indexOf("cadutaDelDispositivo(adesso)");
  const conta = caduta.indexOf("cosaFareDopoLaCaduta(");
  assert.ok(guarda >= 0 && conta > guarda, "si conta prima di guardare se la pagina si vede");
  assert.match(funzione("cadutaDelDispositivo"), /laCadutaConta\(\{ nascosta: paginaNascosta\(\)/);
  assert.match(SEZIONE, /addEventListener\?\.\("visibilitychange", alCambioDiVista\)/);
  const vista = funzione("alCambioDiVista");
  assert.match(vista, /senzaLeCaduteDiAdesso\(state\.cadute, adesso\)/);
  assert.match(vista, /state\.tornataIl = adesso;/);
  /* chi torna trova la casa, non il messaggio di prima */
  assert.match(
    vista,
    /if \(state\.guasto === "disegno"\) \{\s*state\.cadute = \[\];\s*state\.guasto = "";/,
  );
  /* anche il modello: caduto con la pagina dietro si rifa', non e' «guasto» */
  const modello = funzione("avviaIlModello");
  assert.match(
    modello,
    /if \(!cadutaDelDispositivo\(adesso\)\) \{\s*spegniLaScena\(\);\s*ridisegna\(\);\s*return;/,
  );
});

test("la casa che si riapre riparte da capo, e il «non si apre» ha sempre «Riprova»", () => {
  assert.match(funzione("togliLaTela"), /state\.guasto = "";/);
  assert.match(funzione("apriCasa3D"), /state\.guasto = "";/);
  const attesa = funzione("attesaMarkup");
  /* anche col solo modello di chi abita, che prima non aveva il tasto */
  const soloModello = attesa.slice(attesa.indexOf("vuota && usaIlModello(casa)"));
  assert.match(
    soloModello.slice(0, soloModello.indexOf("casaDaCreareMarkup")),
    /data-c3s="riprova"/,
  );
  /* la scena che non riesce a nascere non lascia i suoi pezzi sul palco */
  assert.match(funzione("avviaLaScena"), /sgombraIlPosto\(\);/);
  assert.match(funzione("sgombraIlPosto"), /posto\.textContent = "";/);
});

test("un «no» della licenza si richiede dopo un minuto, non dopo mezz'ora", () => {
  const premium = funzione("eCasaPremium");
  assert.match(premium, /state\.premium === false \? UN_MINUTO : MEZZ_ORA/);
  assert.match(SEZIONE, /const UN_MINUTO = 60 \* 1000;/);
});

/* ── la pesantezza ────────────────────────────────────────────────────── */

const TABLET = { larghezza: 1250, altezza: 660 };

test("un tablet con memoria media e quattro nuclei parte gia' leggero", () => {
  const debole = qualitaDellaCasa3D({ dpr: 2, ...TABLET, memoria: 4, nuclei: 4 });
  assert.deepEqual(debole, { pixel: 1, antialias: false, ombra: 1024, leggera: true });
  /* con otto nuclei resta com'era */
  const medio = qualitaDellaCasa3D({ dpr: 2, ...TABLET, memoria: 4, nuclei: 8 });
  assert.equal(medio.pixel, 1.5);
  assert.equal(medio.antialias, true);
  /* un computer con quattro nuclei e molta memoria non perde niente */
  const computer = qualitaDellaCasa3D({
    dpr: 1,
    larghezza: 1400,
    altezza: 800,
    memoria: 8,
    nuclei: 4,
  });
  assert.deepEqual(computer, { pixel: 1, antialias: true, ombra: 2048, leggera: false });
});

test("i nuclei da soli non dicono niente: Safari ne dichiara quattro anche a un iPhone", () => {
  const iphone = qualitaDellaCasa3D({
    dpr: 3,
    larghezza: 390,
    altezza: 520,
    memoria: null,
    nuclei: 4,
  });
  assert.equal(iphone.pixel, 2);
  assert.equal(iphone.antialias, true);
  assert.equal(iphone.ombra, 2048);
  assert.equal(nucleiDelDispositivo({ hardwareConcurrency: 4 }), 4);
  assert.equal(nucleiDelDispositivo({}), null);
  assert.equal(nucleiDelDispositivo(null), null);
  assert.equal(nucleiDelDispositivo({ hardwareConcurrency: "8" }), null);
});

test("chi va a scatti scende un gradino alla volta: i pixel, poi l'ombra", () => {
  const telefono = { dpr: 3, larghezza: 390, altezza: 520, memoria: 6 };
  const gradini = [0, 1, 2, 3, 4, 9].map((lenta) => qualitaDellaCasa3D({ ...telefono, lenta }));
  assert.deepEqual(
    gradini.map((q) => [q.pixel, q.ombra]),
    [
      [2, 2048],
      [1.5, 2048],
      [1, 2048],
      [1, 0],
      [0.75, 0],
      [0.75, 0],
    ],
  );
  assert.equal(gradini[0].leggera, false);
  assert.ok(gradini.slice(1).every((q) => q.leggera));
  /* l'antialias non si tocca: si decide una volta, quando nasce il disegno */
  assert.ok(gradini.every((q) => q.antialias === true));
  assert.equal(GRADINI_PER_LA_LENTEZZA, 4);
  /* un tablet gia' a uno salta subito all'ombra */
  const tablet = qualitaDellaCasa3D({ dpr: 2, ...TABLET, memoria: 2, lenta: 1 });
  assert.deepEqual([tablet.pixel, tablet.ombra], [1, 0]);
  /* numeri storti: nessun gradino */
  assert.equal(qualitaDellaCasa3D({ ...telefono, lenta: NaN }).pixel, 2);
  assert.equal(qualitaDellaCasa3D({ ...telefono, lenta: -3 }).pixel, 2);
});

test("i fotogrammi lenti: decide la mediana, e solo con abbastanza da guardare", () => {
  const di = (ms, quanti) => Array.from({ length: quanti }, () => ms);
  /* sessanta al secondo: va bene, ma solo dopo averne visti abbastanza */
  assert.equal(fotogrammiLenti(di(16.7, 30)), null);
  assert.equal(fotogrammiLenti(di(16.7, Math.ceil(TEMPO_DA_MISURARE_MS / 16.7) + 1)), 0);
  /* dodici al secondo: un gradino */
  assert.equal(fotogrammiLenti(di(83, FOTOGRAMMI_DA_MISURARE - 1)), null);
  assert.equal(fotogrammiLenti(di(83, 16)), 1);
  /* due al secondo: due gradini, e bastano i primi fotogrammi */
  assert.equal(fotogrammiLenti(di(500, FOTOGRAMMI_DA_MISURARE)), 2);
  /* un fotogramma lungo da solo — la pagina che fa altro — non e' lentezza */
  assert.equal(fotogrammiLenti([...di(16.7, 80), 4000]), 0);
  /* roba strana non conta */
  assert.equal(fotogrammiLenti(null), null);
  assert.equal(fotogrammiLenti([NaN, -1, 0, "x"]), null);
});

test("la scena misura i suoi voli, e l'ombra sfumata resta solo a qualita' piena", () => {
  const scena = leggi("../src/sections/casa-3d/scena.js");
  assert.match(scena, /if \(diFila && S\.vola\) misuraIlPasso\(passato\);/);
  assert.match(scena, /const gradini = fotogrammiLenti\(passi\);/);
  assert.match(scena, /opzioni\.quandoRallenta\?\.\(lenta\);/);
  assert.match(SEZIONE, /quandoRallenta: scenaLenta,/);
  assert.match(SEZIONE, /lenta: state\.lenta \|\| 0,/);
  for (const file of [
    "../src/sections/casa-3d/scena.js",
    "../src/sections/casa-3d/scena-modello.js",
  ]) {
    const sorgente = leggi(file);
    assert.match(
      sorgente,
      /shadowMap\.type = Q\.ombra >= 2048 \? THREE\.PCFSoftShadowMap : THREE\.PCFShadowMap;/,
      file,
    );
    assert.match(sorgente, /sole\.castShadow = Q\.ombra > 0;/, file);
    assert.match(sorgente, /nucleiDelDispositivo\(window\.navigator\)/, file);
  }
});

/* ── lo stesso difetto, nel Colpo d'occhio ────────────────────────────── */

test("anche nel Colpo d'occhio il video resta solo finche' la sua finestra e' aperta", () => {
  const occhio = leggi("../src/sections/colpo-d-occhio-section.js");
  assert.match(
    occhio,
    /state\.finestra\?\.tipo === "telecamera" && state\.finestra\.cam === video\?\.dataset\.ocVideo/,
  );
  assert.match(occhio, /if \(video && ancoraLei && occhio\.telecamere\.some\(/);
  /* la riga di prima: bastava che la telecamera fosse ancora fra le sue */
  assert.doesNotMatch(
    occhio,
    /if \(video && occhio\.telecamere\.some\(\(c\) => c\.entity === video\.dataset\.ocVideo\)\) return;/,
  );
});
