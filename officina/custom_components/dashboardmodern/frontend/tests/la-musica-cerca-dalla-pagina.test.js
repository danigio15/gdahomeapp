/* «Nelle impostazioni posso richiamare brani o playlist: sarebbe possibile
 * avere tale box nella sua sezione?» (#347)
 *
 * Sugli Echo il riquadro «Cerca e ascolta» c'era gia'. Sugli altri lettori
 * (Music Assistant, Sonos, Spotify) adesso c'e' anche li': chi sa cercare
 * apre la libreria gia' sui risultati, chi sa solo sfogliare apre la
 * libreria, e chi non sa nemmeno elencare non ha il riquadro. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const leggi = (percorso) => readFile(new URL(percorso, import.meta.url), "utf8");

test("la Musica sa aprire la libreria gia' sui risultati di una ricerca", async () => {
  const musica = await leggi("../src/sections/media-player-section.js");
  const corpo = musica.slice(musica.indexOf("export function cercaSulLettore"));
  const funzione = corpo.slice(0, corpo.indexOf("\n}\n") + 3);
  /* Prima la libreria (che sa anche dire di no), poi la ricerca solo su chi
   * sa cercare. */
  assert.match(funzione, /if \(!apriLoSfoglio\(entity\)\) return false;/);
  assert.match(funzione, /puo\?\.trova === true\) cerca\(cercato\)/);
});

test("il riquadro della pagina cerca sugli altri lettori e suona sugli Echo", async () => {
  const radio = await leggi("../src/sections/radio-section.js");
  assert.match(radio, /dove\?\.echo \? cercaSullEchoMarkup\(\) : cercaSulLettoreMarkup\(dove\)/);
  const markup = radio.slice(radio.indexOf("function cercaSulLettoreMarkup"));
  const corpo = markup.slice(0, markup.indexOf("\n}\n") + 3);
  /* Senza libreria niente riquadro; senza ricerca solo «Sfoglia». */
  assert.match(corpo, /if \(!puo\.sfoglia\) return "";/);
  assert.match(corpo, /if \(!puo\.trova\)/);
  assert.match(corpo, /data-dm-radio-cerca-trova/);
  assert.match(corpo, /data-dm-radio-sfoglia/);
  /* L'invio della tastiera fa la stessa cosa del tasto. */
  assert.match(radio, /cercaDove\(doveSuona\(iLettori\(\)\), state\.cosa\)/);
});
