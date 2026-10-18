/* Il catalogo dei disegni da riquadro: tanti, e tutti in ordine.
 *
 * «Bisognerebbe ampliare il catalogo delle cose, quindi crea tantissimi
 * disegni che si possono selezionare.» Con piu' di cento disegni nella stessa
 * pagina basta un id ripetuto perche' un disegno si prenda la sfumatura di un
 * altro, basta un riferimento esterno perche' il riquadro resti vuoto senza
 * rete, basta un SVG malformato perche' il browser non disegni niente. Qui si
 * controllano tutti, uno per uno, e si controlla che la ricerca li trovi come
 * li chiama chi li cerca: con o senza accenti, in italiano o in inglese.
 */
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import test from "node:test";

import {
  DISEGNI_DA_RIQUADRO,
  GRUPPI_DISEGNI,
  cercaDisegni,
  disegnoDaRiquadro,
} from "../src/core/disegni-da-riquadro.js";

const MODULO = new URL("../src/core/disegni-da-riquadro.js", import.meta.url);
const GRUPPI = new Set(GRUPPI_DISEGNI.map((g) => g.chiave));

/* Un controllo di buona forma XML, senza dipendenze: ogni carattere del
 * documento sta in un tag, ogni tag aperto si chiude, nessun attributo e'
 * ripetuto, nessun valore contiene «<». */
function formaXml(svg) {
  const tag = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"<]*")*)\s*(\/?)>/y;
  const pila = [];
  let i = 0;
  while (i < svg.length) {
    tag.lastIndex = i;
    const m = tag.exec(svg);
    if (!m) {
      const testo = svg.slice(i, svg.indexOf("<", i) === -1 ? svg.length : svg.indexOf("<", i));
      if (!testo.length || /[<>&]/.test(testo))
        return `testo o tag rotto a ${i}: ${svg.slice(i, i + 40)}`;
      i += testo.length;
      continue;
    }
    const [, chiude, nome, attributi, vuoto] = m;
    const nomi = [...attributi.matchAll(/([\w:-]+)="/g)].map((a) => a[1]);
    if (new Set(nomi).size !== nomi.length) return `attributo ripetuto in <${nome}>`;
    if (chiude) {
      if (pila.pop() !== nome) return `</${nome}> non chiude quello che era aperto`;
    } else if (!vuoto) pila.push(nome);
    i = tag.lastIndex;
  }
  return pila.length ? `restano aperti: ${pila.join(", ")}` : null;
}

test("il catalogo e' grande e ogni gruppo ha la sua parte", () => {
  assert.ok(DISEGNI_DA_RIQUADRO.length >= 120, `solo ${DISEGNI_DA_RIQUADRO.length} disegni`);
  for (const g of GRUPPI_DISEGNI) {
    assert.ok(g.nome.it && g.nome.en, `gruppo ${g.chiave} senza nome`);
    const quanti = DISEGNI_DA_RIQUADRO.filter((d) => d.gruppo === g.chiave).length;
    assert.ok(quanti >= 6, `il gruppo ${g.chiave} ha solo ${quanti} disegni`);
  }
});

test("i sei disegni approvati ci sono ancora, con le loro chiavi", () => {
  for (const chiave of ["proiettore", "decoder", "cancello", "albero", "lampione", "prato"]) {
    assert.ok(disegnoDaRiquadro(chiave), `manca ${chiave}`);
  }
  assert.equal(disegnoDaRiquadro("non-esiste"), null);
  assert.equal(disegnoDaRiquadro(undefined), null);
});

test("ogni voce ha chiave unica, gruppo noto, nomi, parole e fuoco", () => {
  const viste = new Set();
  for (const d of DISEGNI_DA_RIQUADRO) {
    assert.match(d.chiave, /^[a-z0-9]+(-[a-z0-9]+)*$/, `chiave strana: ${d.chiave}`);
    assert.ok(!viste.has(d.chiave), `chiave ripetuta: ${d.chiave}`);
    viste.add(d.chiave);
    assert.ok(GRUPPI.has(d.gruppo), `${d.chiave}: gruppo ${d.gruppo} sconosciuto`);
    assert.ok(typeof d.nome.it === "string" && d.nome.it.trim(), `${d.chiave} senza nome italiano`);
    assert.ok(typeof d.nome.en === "string" && d.nome.en.trim(), `${d.chiave} senza nome inglese`);
    assert.ok(
      Array.isArray(d.parole) && d.parole.length >= 3,
      `${d.chiave}: poche parole per cercarlo`,
    );
    assert.equal(d.fuoco.length, 2);
    for (const v of d.fuoco) assert.ok(v >= 0 && v <= 100, `${d.chiave}: fuoco fuori scala`);
    assert.equal(disegnoDaRiquadro(d.chiave), d);
  }
});

test("ogni disegno e' un SVG ben fatto, 240x240, che si taglia senza deformarsi", () => {
  for (const d of DISEGNI_DA_RIQUADRO) {
    const svg = d.svg();
    assert.equal(svg, d.svg(), `${d.chiave}: il disegno cambia da una chiamata all'altra`);
    assert.ok(
      svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"'),
      d.chiave,
    );
    assert.match(svg, /preserveAspectRatio="xMidYMid slice"/, d.chiave);
    assert.equal(formaXml(svg), null, `${d.chiave}: ${formaXml(svg)}`);
    assert.doesNotMatch(svg, /NaN|undefined|Infinity/, `${d.chiave}: numeri rotti`);
    assert.ok(svg.length < 20000, `${d.chiave} pesa ${svg.length} caratteri`);
  }
});

test("gli id sono prefissati con la chiave e unici in tutto il catalogo", () => {
  const tutti = new Set();
  for (const d of DISEGNI_DA_RIQUADRO) {
    const svg = d.svg();
    const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    for (const id of ids) {
      assert.ok(id.startsWith(`${d.chiave}-`), `${d.chiave}: id senza prefisso «${id}»`);
      assert.ok(!tutti.has(id), `id ripetuto nel catalogo: ${id}`);
      tutti.add(id);
    }
    for (const [, rif] of svg.matchAll(/url\(#([^)]+)\)/g)) {
      assert.ok(ids.includes(rif), `${d.chiave}: url(#${rif}) non punta a niente`);
    }
    assert.ok(!svg.includes("@"), `${d.chiave}: un «@» non sostituito`);
  }
});

test("nessun riferimento fuori dal disegno", () => {
  for (const d of DISEGNI_DA_RIQUADRO) {
    const svg = d.svg().replace('xmlns="http://www.w3.org/2000/svg"', "");
    assert.doesNotMatch(
      svg,
      /https?:|\/\/|<image|<script|<foreignObject|href=|xlink|\bon\w+=/i,
      d.chiave,
    );
  }
});

test("il modulo resta leggero", () => {
  const peso = statSync(MODULO).size;
  assert.ok(peso < 400 * 1024, `il modulo pesa ${Math.round(peso / 1024)} KB`);
  const totale = DISEGNI_DA_RIQUADRO.reduce((s, d) => s + d.svg().length, 0);
  assert.ok(totale < 1500 * 1024, `i disegni insieme pesano ${Math.round(totale / 1024)} KB`);
});

test("la ricerca trova i disegni col nome, senza accenti, in inglese e coi sinonimi", () => {
  const chiavi = (testo, lingua) => cercaDisegni(testo, lingua).map((d) => d.chiave);
  assert.equal(cercaDisegni("").length, DISEGNI_DA_RIQUADRO.length);
  assert.equal(cercaDisegni("   ").length, DISEGNI_DA_RIQUADRO.length);
  assert.deepEqual(chiavi("zzzz nessuno"), []);
  assert.ok(chiavi("caffè").includes("macchina-caffe"));
  assert.ok(chiavi("CAFFE").includes("macchina-caffe"));
  assert.ok(chiavi("Macchina del caffe").includes("macchina-caffe"));
  assert.ok(chiavi("fridge", "en").includes("frigorifero"));
  assert.ok(chiavi("washing machine", "en").includes("lavatrice"));
  assert.ok(chiavi("frigo").includes("frigorifero"));
  assert.ok(chiavi("calorifero").includes("termosifone"));
  assert.ok(chiavi("antifurto").includes("allarme"));
  assert.ok(chiavi("umidità").includes("deumidificatore"));
  assert.equal(chiavi("lavastoviglie")[0], "lavastoviglie");
  assert.equal(chiavi("luce esterna")[0], "lampione");
  assert.equal(chiavi("tv", "en")[0], "tv");
  /* Il nome del gruppo porta dentro tutto il gruppo. */
  const cucina = chiavi("cucina");
  for (const d of DISEGNI_DA_RIQUADRO.filter((x) => x.gruppo === "cucina"))
    assert.ok(cucina.includes(d.chiave));
});
