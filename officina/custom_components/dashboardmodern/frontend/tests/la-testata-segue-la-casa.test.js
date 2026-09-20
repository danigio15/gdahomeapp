/* «Passando da una casa all'altra nell'app, il titolo in testa alla plancia
 * resta quello della casa di prima — GBC STORE PERUGIA — mentre i dati sono
 * quelli giusti, finche' non si chiude e si riapre l'app.»
 *
 * Il titolo lo scriveva solo l'avvio, da `cd_branding` nel deposito del
 * browser; la configurazione condivisa che arriva dopo rifaceva le tessere,
 * la barra, il disegno — non la testata. Nell'app tutte le case avevano lo
 * stesso deposito, quindi la pagina partiva col marchio dell'ultima casa
 * vista, e nessuno lo correggeva. Adesso il marchio e' una funzione che si
 * puo' richiamare, e la rilettura la richiama. */
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const leggi = (nome) => readFileSync(new URL(`../${nome}`, import.meta.url), "utf8");

function funzioneDelRuntime(sorgente, nome) {
  const inizio = sorgente.indexOf(`function ${nome}(`);
  assert.notEqual(inizio, -1, `${nome} manca`);
  const fine = sorgente.indexOf("\n}\n", inizio);
  assert.notEqual(fine, -1, `${nome} non finisce`);
  return sorgente.slice(inizio, fine + 2);
}

/* Una pagina finta: la testata com'e' scritta in `dashboard.html`, e un
 * deposito da cui `cdCfg` legge. */
function unaPagina(deposito) {
  const elemento = (testo) => ({ textContent: testo, dataset: {} });
  const h1 = elemento("Smart Home");
  const p = elemento("Smart Home Dashboard");
  const document = {
    title: "Smart Home",
    querySelector: (quale) => (quale === "header h1" ? h1 : quale === "header h1 + p" ? p : null),
  };
  const contesto = { document, cdCfg: (chiave) => deposito[chiave] || {} };
  contesto.window = contesto;
  return { h1, p, document, contesto: vm.createContext(contesto) };
}

for (const runtime of ["dashboard-runtime-it.js", "dashboard-runtime-en.js"]) {
  test(`${runtime}: la testata segue la configurazione, anche quando arriva dopo`, () => {
    const sorgente = leggi(`legacy/${runtime}`);
    const deposito = { cd_branding: { title: "GBC STORE PERUGIA", subtitle: "Negozio" } };
    const pagina = unaPagina(deposito);
    vm.runInContext(funzioneDelRuntime(sorgente, "cdApplyBranding"), pagina.contesto);

    /* L'avvio: il deposito ha il marchio dell'ultima casa vista. */
    vm.runInContext("cdApplyBranding()", pagina.contesto);
    assert.equal(pagina.h1.textContent, "GBC STORE PERUGIA");
    assert.equal(pagina.p.textContent, "Negozio");
    assert.equal(pagina.document.title, "GBC STORE PERUGIA — Smart Home");

    /* Poi arriva la configurazione della casa al mare, dal ponte. */
    deposito.cd_branding = { title: "Casa al mare" };
    vm.runInContext("cdApplyBranding()", pagina.contesto);
    assert.equal(pagina.h1.textContent, "Casa al mare");
    assert.equal(pagina.document.title, "Casa al mare — Smart Home");
    /* Senza un sottotitolo suo torna quello di serie: non resta «Negozio». */
    assert.equal(pagina.p.textContent, "Smart Home Dashboard");

    /* E una casa che un titolo non ce l'ha torna alla scritta di serie. */
    deposito.cd_branding = {};
    vm.runInContext("cdApplyBranding()", pagina.contesto);
    assert.equal(pagina.h1.textContent, "Smart Home");
    assert.equal(pagina.document.title, "Smart Home");
  });

  test(`${runtime}: l'avvio passa dalla stessa funzione, non da una copia`, () => {
    const sorgente = leggi(`legacy/${runtime}`);
    const avvio = sorgente.slice(sorgente.indexOf("(function applyUserConfig()"));
    assert.match(avvio.slice(0, 700), /cdOnReady\(cdApplyBranding\)/);
    assert.equal(
      sorgente.split("h1.textContent = brand.title").length,
      2,
      "la testata si scrive in un posto solo",
    );
  });
}

test("la configurazione condivisa, quando arriva, riscrive anche la testata", () => {
  const sezione = leggi("src/sections/config-persistence-section.js");
  const corpo = sezione.slice(sezione.indexOf("function refreshRuntimeAfterRestore"));
  const passi = corpo.slice(corpo.indexOf("runSteps("), corpo.indexOf("stepReporter("));
  assert.match(passi, /\["cdApplyBranding", \(\) => root\.cdApplyBranding\?\.\(\)\]/);
  /* Prima del disegno, che e' l'ultimo passo. */
  assert.ok(passi.indexOf('"cdApplyBranding"') < passi.indexOf('["render"'));
});
