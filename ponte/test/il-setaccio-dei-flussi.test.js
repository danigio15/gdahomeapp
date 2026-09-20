/* Il setaccio dei flussi: quello che di una plancia non esce mai da casa.
 *
 * Da lontano si sceglie quale telecamera va dove, non dove sta il suo flusso.
 * Il setaccio deve riconoscere un flusso ovunque stia — anche in mezzo a un
 * testo JSON, che e' come una plancia tiene i suoi valori — e la strada di
 * ritorno deve rimettere al loro posto i flussi di casa, o il primo
 * salvataggio dal quadro cancellerebbe l'indirizzo di ogni telecamera.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { conIFlussiDiCasa, eUnFlusso, haFlussi, senzaFlussi } from "../src/plancia-da-lontano.js";

test("un flusso si riconosce dallo schema, dalla lista HLS o dal gettone, ovunque stia", () => {
  for (const uno of [
    "rtsp://u:p@192.168.1.9/ingresso",
    "  RTSPS://cam/x",
    "rtmp://cam/live",
    "webrtc://go2rtc/ingresso",
    "http://192.168.1.9:1984/api/stream.m3u8?src=ingresso",
    "https://casa.example/api/ws?src=ingresso",
    "http://cam/mjpeg",
    "http://cam/video?token=abc",
    "vedi rtsp://cam/x per il flusso",
  ]) {
    assert.equal(eUnFlusso(uno), true, uno);
  }
  for (const uno of ["camera.ingresso", "Ingresso", "http://casa.example/logo.png", "", 12, null]) {
    assert.equal(eUnFlusso(uno), false, String(uno));
  }
});

const VALORI = {
  dm_schema_version: "4",
  cd_stanze: JSON.stringify([{ id: "cucina", name: "Cucina" }]),
  cd_cameras: JSON.stringify([
    { entity: "camera.ingresso", name: "Ingresso", rtsp: "rtsp://u:p@192.168.1.9/ingresso" },
    { entity: "camera.giardino", name: "Giardino", rtsp: "" },
  ]),
};

test("il setaccio guarda dentro i testi JSON, e lascia il resto lettera per lettera", () => {
  assert.equal(haFlussi(VALORI), true);
  const puliti = senzaFlussi(VALORI);
  assert.equal(haFlussi(puliti), false);
  assert.equal(puliti.dm_schema_version, "4");
  /* Quello che non aveva flussi non si riscrive nemmeno. */
  assert.equal(puliti.cd_stanze, VALORI.cd_stanze);
  const telecamere = JSON.parse(puliti.cd_cameras);
  assert.deepEqual(telecamere, [
    { entity: "camera.ingresso", name: "Ingresso", rtsp: "" },
    { entity: "camera.giardino", name: "Giardino", rtsp: "" },
  ]);
  /* E un testo che non e' JSON e non e' un flusso resta com'e'. */
  assert.equal(senzaFlussi("{non e' json"), "{non e' json");
});

test("i flussi di casa tornano al loro posto, anche se le telecamere hanno cambiato posto", () => {
  const correnti = VALORI;
  /* Il quadro ha visto i flussi vuoti, ha girato le telecamere e ne ha
   * rinominata una. */
  const nuovi = {
    ...senzaFlussi(VALORI),
    cd_cameras: JSON.stringify([
      { entity: "camera.giardino", name: "Giardino", rtsp: "" },
      { entity: "camera.ingresso", name: "Portone", rtsp: "" },
    ]),
  };
  const rimessi = conIFlussiDiCasa(nuovi, correnti);
  assert.deepEqual(JSON.parse(rimessi.cd_cameras), [
    { entity: "camera.giardino", name: "Giardino", rtsp: "" },
    { entity: "camera.ingresso", name: "Portone", rtsp: "rtsp://u:p@192.168.1.9/ingresso" },
  ]);
  /* Quello che non c'entra coi flussi e' come l'ha scritto il quadro. */
  assert.equal(rimessi.cd_stanze, nuovi.cd_stanze);
  assert.equal(rimessi.dm_schema_version, "4");
});

test("un flusso scritto dal quadro non passa per un flusso di casa, e un vuoto voluto resta vuoto", () => {
  /* Vuoto dove in casa non c'era un flusso: e' una scelta, resta. */
  const senza = conIFlussiDiCasa({ cd_nota: "" }, { cd_nota: "una nota" });
  assert.deepEqual(senza, { cd_nota: "" });
  /* Nessun cambiamento: torna la stessa cosa, non una copia. */
  const uguali = { a: "1", b: JSON.stringify([{ id: 1 }]) };
  assert.equal(conIFlussiDiCasa(uguali, { a: "1", b: uguali.b }), uguali);
  /* Senza niente in casa, quello che arriva e' quello che si scrive. */
  assert.deepEqual(conIFlussiDiCasa({ a: "" }, null), { a: "" });
});
