/* Le tessere hanno il colore della loro sezione, e il rosso solo quando
 * segnalano qualcosa.
 *
 * «I colori dei widget devono richiamare i colori delle sezioni e diventare
 * rossi solo in caso di segnalazioni.» La tessera delle batterie era gialla
 * sopra una pagina Batterie verde, e altre si facevano rosse per uno stato
 * qualunque: il rosso non diceva piu' niente.
 */
import assert from "node:assert/strict";
import test from "node:test";

const memoria = new Map();
globalThis.localStorage = {
  getItem: (chiave) => (memoria.has(chiave) ? memoria.get(chiave) : null),
  setItem: (chiave, valore) => memoria.set(chiave, String(valore)),
  removeItem: (chiave) => memoria.delete(chiave),
};
globalThis.document = undefined;
const { colorataComeLaSezione } = await import("../src/sections/home-widgets-section.js");
const { tintaDellaPagina } = await import("../src/sections/page-masthead-section.js");

test("a riposo la tessera ha il colore dell'intestazione della sua pagina", () => {
  const batterie = colorataComeLaSezione({ key: "batterie", accent: "#94a3b8", alert: false });
  assert.equal(batterie.accent, tintaDellaPagina("page-batterie"));
  assert.match(batterie.accent, /^rgb\(\d+,\d+,\d+\)$/);
  const luci = colorataComeLaSezione({ key: "luci", accent: "#f59e0b" });
  assert.equal(luci.accent, tintaDellaPagina("page-luci"));
});

test("quando segnala diventa rossa, qualunque fosse il suo colore", () => {
  const batterie = colorataComeLaSezione({ key: "batterie", accent: "#eab308", alert: true });
  assert.equal(batterie.accent, "#dc2626");
});

test("senza pagina tiene il suo colore, ma il rosso no", () => {
  assert.equal(colorataComeLaSezione({ key: "allagamenti", accent: "#38bdf8" }).accent, "#38bdf8");
  assert.equal(colorataComeLaSezione({ key: "chi-sa", accent: "#ef4444" }).accent, "#64748b");
});
