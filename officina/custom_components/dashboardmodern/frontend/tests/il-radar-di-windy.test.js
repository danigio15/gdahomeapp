/* «Vorrei il radar pioggia con Windy.»
 *
 * Windy non ha tessere gratuite: ha una mappa da mettere dentro una pagina. La
 * plancia la mostra in un riquadro, e il riquadro e' una porta: qui si prova
 * che l'indirizzo lo costruisce solo il nucleo, che un collegamento incollato
 * si legge (e non si usa com'e'), e che nel riquadro non entra niente che non
 * sia la pagina di Windy fatta per stare dentro le altre.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  ORIGINE_WINDY,
  SANDBOX_WINDY,
  STRATI_WINDY,
  cornicePermessa,
  daIndirizzoWindy,
  indirizzoWindy,
  zoomWindy,
} from "../src/core/radar-mappa.js";
import {
  editorDelRadarMarkup,
  fonteDelRadar,
  nomeDelServizio,
  radarScelto,
  servizioScelto,
  vistaWindy,
} from "../src/sections/radar-meteo-section.js";

const sorgente = readFileSync(
  new URL("../src/sections/radar-meteo-section.js", import.meta.url),
  "utf8",
);

test("l'indirizzo di Windy lo fa il nucleo: punto, zoom, strato e unita', nient'altro", () => {
  const src = indirizzoWindy({ lat: 45.46, lon: 9.19, zoom: 8 });
  const url = new URL(src);
  assert.equal(url.origin, ORIGINE_WINDY);
  assert.equal(url.pathname, "/embed.html");
  const p = Object.fromEntries(url.searchParams);
  assert.deepEqual(p, {
    type: "map",
    location: "coordinates",
    metricRain: "mm",
    metricTemp: "°C",
    metricWind: "km/h",
    zoom: "8",
    overlay: "radar",
    product: "radar",
    level: "surface",
    lat: "45.4600",
    lon: "9.1900",
  });
  /* La pioggia prevista e' l'altro strato che si sa mostrare. */
  assert.equal(
    new URL(indirizzoWindy({ lat: 45, lon: 9, strato: "rain" })).searchParams.get("overlay"),
    "rain",
  );
  /* Uno strato che non e' pioggia diventa radar: il riquadro e' il radar. */
  assert.equal(
    new URL(indirizzoWindy({ lat: 45, lon: 9, strato: "wind" })).searchParams.get("overlay"),
    "radar",
  );
  assert.deepEqual([...STRATI_WINDY], ["radar", "rain"]);
  /* Lo zoom resta fra regione e citta'; senza, quello di serie. */
  assert.equal(new URL(indirizzoWindy({ lat: 45, lon: 9 })).searchParams.get("zoom"), "8");
  assert.equal(zoomWindy(1), 3);
  assert.equal(zoomWindy(19), 11);
  assert.equal(zoomWindy(""), null);
  /* Senza un punto non c'e' indirizzo — e la casella vuota non e' l'equatore. */
  assert.equal(indirizzoWindy({ lat: "", lon: "" }), "");
  assert.equal(indirizzoWindy({ lat: 95, lon: 9 }), "");
});

test("un collegamento di windy.com si legge: punto, zoom e strato", () => {
  assert.deepEqual(daIndirizzoWindy("https://www.windy.com/-Radar-radar?radar,45.46,9.19,8"), {
    lat: 45.46,
    lon: 9.19,
    zoom: 8,
    strato: "radar",
  });
  /* Quello della segnalazione: la pagina del sito, senza strato. */
  assert.deepEqual(daIndirizzoWindy("https://www.windy.com/?40.964,14.215,9"), {
    lat: 40.964,
    lon: 14.215,
    zoom: 9,
    strato: "radar",
  });
  assert.deepEqual(
    daIndirizzoWindy("https://www.windy.com/it/-Pioggia-neve-rain?rain,41.902,12.496,8"),
    { lat: 41.902, lon: 12.496, zoom: 8, strato: "rain" },
  );
  /* Un'ora in mezzo non e' una latitudine. */
  assert.deepEqual(daIndirizzoWindy("https://windy.com/?rain,2026101812,45.4,9.1,7"), {
    lat: 45.4,
    lon: 9.1,
    zoom: 7,
    strato: "rain",
  });
  /* Windy senza numeri e' comunque Windy: il posto lo da' casa. */
  assert.deepEqual(daIndirizzoWindy("https://www.windy.com/"), {
    lat: null,
    lon: null,
    zoom: null,
    strato: "radar",
  });
  /* E la pagina da incorporare, coi suoi nomi. */
  assert.deepEqual(
    daIndirizzoWindy(
      "https://embed.windy.com/embed.html?type=map&lat=44.5&lon=11.3&zoom=6&overlay=rain&product=ecmwf",
    ),
    { lat: 44.5, lon: 11.3, zoom: 6, strato: "rain" },
  );
  assert.equal(daIndirizzoWindy("https://embed.windy.com/embed2.html?lat=44.5&lon=11.3").lat, 44.5);
});

test("quello che non e' Windy non si legge come Windy", () => {
  for (const no of [
    "",
    "windy.com/?45,9,8",
    "https://windy.com.esempio.org/?45.4,9.1,8",
    "https://esempiowindy.com/?45.4,9.1,8",
    "https://www.windy.com.evil.example/?45.4,9.1,8",
    "https://embed.windy.com/altro.html?lat=45&lon=9",
    "https://embed.windy.com:8443/embed.html?lat=45&lon=9",
    "https://qualcuno:segreto@www.windy.com/?45.4,9.1,8",
    "javascript:alert(1)//windy.com",
    "https://tilecache.rainviewer.com/{z}/{x}/{y}.png",
  ])
    assert.equal(daIndirizzoWindy(no), null, no);
});

test("nel riquadro entra solo la pagina di Windy: tutto il resto e' un no", () => {
  assert.equal(cornicePermessa(indirizzoWindy({ lat: 45.46, lon: 9.19, zoom: 8 })), true);
  for (const no of [
    "",
    "about:blank",
    "javascript:alert(1)",
    "data:text/html,<b>x</b>",
    "http://embed.windy.com/embed.html?lat=45&lon=9",
    "https://www.windy.com/?45.4,9.1,8",
    "https://windy.com/embed.html",
    "https://embed.windy.com.evil.example/embed.html",
    "https://evil.example/embed.html?x=https://embed.windy.com",
    "https://embed.windy.com/embed2.html?lat=45&lon=9",
    "https://embed.windy.com/embed.html#altro",
    "https://embed.windy.com:444/embed.html",
    "https://qualcuno@embed.windy.com/embed.html",
    "https://EMBED.windy.com/../evil.html",
    "//embed.windy.com/embed.html",
  ])
    assert.equal(cornicePermessa(no), false, no);
  /* Il sandbox: gli script e la sua origine, niente finestre nuove, niente
   * moduli, niente navigazione della pagina di sopra. */
  assert.deepEqual(SANDBOX_WINDY.split(" ").sort(), ["allow-same-origin", "allow-scripts"]);
});

test("Windy si sceglie dalla tendina, o incollandone un collegamento", () => {
  assert.equal(servizioScelto({ servizio: "windy" }), "windy");
  /* Il collegamento incollato in «Un indirizzo mio» non e' piu' un errore. */
  assert.equal(
    servizioScelto({ servizio: "modello", modello: "https://www.windy.com/?40.964,14.215,9" }),
    "windy",
  );
  /* Le tessere restano com'erano. */
  assert.equal(servizioScelto({}), "rainviewer");
  assert.equal(
    servizioScelto({ servizio: "modello", modello: "https://e/{z}/{x}/{y}.png" }),
    "modello",
  );
  assert.equal(servizioScelto({ servizio: "modello", modello: "https://esempio.org/radar" }), "");

  const scelto = radarScelto({ servizio: "windy", lat: "45.46", lon: "9.19" });
  assert.equal(scelto.modo, "windy");
  assert.equal(nomeDelServizio(scelto), "Windy");
  assert.equal(fonteDelRadar({ servizio: "windy", lat: "45.46", lon: "9.19" }), "mappa");

  const incollato = radarScelto({
    servizio: "modello",
    modello: "https://www.windy.com/-Radar-radar?radar,45.46,9.19,8",
  });
  assert.equal(incollato.modo, "windy");
  assert.deepEqual(incollato.windy, { lat: 45.46, lon: 9.19, zoom: 8, strato: "radar" });
});

test("dove guarda Windy: il collegamento se lo dice, se no il posto scelto e il raggio", () => {
  const incollato = radarScelto({
    servizio: "modello",
    modello: "https://www.windy.com/-Radar-radar?radar,45.46,9.19,8",
  });
  const vista = vistaWindy(incollato, 640, 400);
  assert.equal(vista.zoom, 8);
  assert.ok(cornicePermessa(vista.src));
  assert.equal(new URL(vista.src).searchParams.get("lat"), "45.4600");

  /* Dalla tendina: le coordinate scritte, e lo zoom che fa entrare i trenta
   * chilometri nel riquadro — fra regione e citta'. */
  const scritto = vistaWindy(
    radarScelto({ servizio: "windy", lat: "41.9", lon: "12.5" }),
    640,
    400,
  );
  assert.equal(new URL(scritto.src).searchParams.get("lat"), "41.9000");
  assert.ok(scritto.zoom >= 7 && scritto.zoom <= 10, `zoom ${scritto.zoom}`);
  /* Un raggio piu' largo, uno zoom piu' largo. */
  const largo = vistaWindy(
    radarScelto({ servizio: "windy", lat: "41.9", lon: "12.5", raggio: "200" }),
    640,
    400,
  );
  assert.ok(largo.zoom < scritto.zoom);
});

test("la tendina ha Windy, e con Windy le caselle delle tessere si nascondono", () => {
  const html = editorDelRadarMarkup({ servizio: "windy", lat: "45.46", lon: "9.19" }, {});
  assert.match(html, /<option value="windy" selected>Windy \(mappa in un riquadro\)<\/option>/);
  /* Le tessere restano scelte possibili. */
  assert.match(html, /<option value="rainviewer">RainViewer<\/option>/);
  assert.match(html, /<option value="modello">/);
  /* Fondo, tetto della pioggia, animazione e prova sono cose delle tessere. */
  assert.ok((html.match(/data-dm-radar-solo="tessere"/g) || []).length >= 4);
});

test("il riquadro nasce col sandbox, senza referrer, pigro e solo dopo il cancello", () => {
  const corpo = sorgente.slice(sorgente.indexOf("function daWindy("));
  const fine = corpo.indexOf("\nexport function disegnaRadar(");
  const daWindy = corpo.slice(0, fine);
  assert.match(daWindy, /setAttribute\("sandbox", SANDBOX_WINDY\)/);
  assert.match(daWindy, /setAttribute\("referrerpolicy", "no-referrer"\)/);
  assert.match(daWindy, /setAttribute\("loading", "lazy"\)/);
  /* Il cancello viene prima del riquadro, e l'indirizzo e' quello del nucleo. */
  assert.ok(daWindy.indexOf("cornicePermessa(src)") < daWindy.indexOf('createElement("iframe")'));
  assert.doesNotMatch(daWindy, /scelto\.modello/);
  /* E nessun altro riquadro nasce in questo modulo. */
  assert.equal((sorgente.match(/createElement\("iframe"\)/g) || []).length, 1);
});
