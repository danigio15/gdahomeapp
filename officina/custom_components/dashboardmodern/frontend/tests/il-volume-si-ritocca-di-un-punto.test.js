/* Il volume della Musica: il cursore porta lontano, e il meno e il piu'
 * accanto fanno l'ultimo ritocco, un punto a tocco. Col dito sul cursore, fra
 * il 18 e il 22 non c'e' modo di fermarsi sul 20. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PASSO_DEL_VOLUME, volumeDopoIlPasso } from "../src/core/media-player.js";

const sezione = await readFile(
  new URL("../src/sections/media-player-section.js", import.meta.url),
  "utf8",
);

test("un tocco sposta il volume di un punto", () => {
  assert.equal(PASSO_DEL_VOLUME, 0.01);
  assert.equal(volumeDopoIlPasso(0.2, 1), 0.21);
  assert.equal(volumeDopoIlPasso(0.2, -1), 0.19);
  assert.equal(volumeDopoIlPasso(0.07, 1), 0.08, "senza i resti della virgola mobile");
});

test("il volume resta fra zero e cento", () => {
  assert.equal(volumeDopoIlPasso(1, 1), 1);
  assert.equal(volumeDopoIlPasso(0, -1), 0);
  assert.equal(volumeDopoIlPasso(null, 1), 0.01, "un volume che non si sa parte da zero");
});

test("chi sa mettere il volume a un numero ha il meno e il piu' accanto al cursore", () => {
  assert.match(sezione, /const aTocchi = riga\.puo\.volume && !riga\.spento;/);
  assert.match(sezione, /aTocchi \? tastoMarkup\(riga, "alza"/);
  assert.match(sezione, /toccaIlVolume\(entity, riga, comando === "alza" \? 1 : -1\)/);
  // Due tocchi di fila si sommano, anche prima che Home Assistant risponda.
  assert.match(sezione, /volumiChiesti\.get\(entity\)/);
});
