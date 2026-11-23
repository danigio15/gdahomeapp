/* Chi rifa' la testata sulla Home la rimette sempre accesa.
 *
 * Il guardiano della testata (`weather-in-masthead-section.js`), per far
 * rifare i conti a WebKit, la spegne e la riaccende rimettendo lo stile in
 * linea com'era. Ma «com'era» puo' essere «spenta»: e' quello che le voci delle
 * sezioni nate dopo il guscio (Batterie, Sport, Varchi…) le scrivono addosso
 * aprendo la loro pagina. Rimesso tale e quale, sulla Home restava uno stile
 * che diceva «spenta», tenuto a bada solo dalla regola col peso massimo: un
 * filo solo, e quando quel filo manca la testata non torna. Sulla Home una
 * testata spenta non e' mai lo stato giusto, quindi chi la rifa' la riaccende.
 */
import assert from "node:assert/strict";
import test from "node:test";

globalThis.document = {
  scrollingElement: { scrollTop: 0 },
  body: { scrollTop: 0 },
  querySelector: (sel) => (sel === ".page.active" ? { id: "page-home" } : null),
};
globalThis.scrollTo = () => {};

function testata(display = "", peso = "") {
  const stile = new Map(display ? [["display", [display, peso]]] : []);
  const r = { width: 390, height: 100, top: 0, bottom: 100, left: 0, right: 390 };
  const sinistra = { getBoundingClientRect: () => r, getClientRects: () => [r] };
  return {
    stile,
    getBoundingClientRect: () => r,
    querySelector: () => sinistra,
    querySelectorAll: () => [sinistra],
    style: {
      getPropertyValue: (nome) => stile.get(nome)?.[0] || "",
      getPropertyPriority: (nome) => stile.get(nome)?.[1] || "",
      setProperty: (nome, valore, p = "") => stile.set(nome, [valore, p]),
      removeProperty: (nome) => stile.delete(nome),
    },
    offsetWidth: 390,
  };
}

const { rifaiLaFila } = await import("../src/sections/weather-in-masthead-section.js");

test("spenta in linea da una sezione, rifatta sulla Home torna accesa", () => {
  const header = testata("none");
  assert.equal(rifaiLaFila(header, { sempre: true }), true);
  assert.equal(header.stile.has("display"), false);
});

test("uno stile in linea acceso resta quello che era, col suo peso", () => {
  const header = testata("flex", "important");
  assert.equal(rifaiLaFila(header, { sempre: true }), true);
  assert.deepEqual(header.stile.get("display"), ["flex", "important"]);
});
