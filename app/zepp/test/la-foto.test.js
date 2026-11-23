/* La fotografia al polso si legge come sugli altri orologi (`LaFoto.kt`):
 * campo per campo, e quello che non torna vale «non c'e'». E la casa
 * d'esempio risponde ai tocchi come una casa. */

import { test } from "node:test";
import assert from "node:assert/strict";

import { diGenere, diQuando, girato, leggiLaFoto } from "../utils/la-foto.js";
import { comandoNellaVetrina, laFotoDellaVetrina } from "../app-side/vetrina.js";

test("una fotografia rotta non e' una fotografia", () => {
  assert.equal(leggiLaFoto(""), null);
  assert.equal(leggiLaFoto("{non e' json"), null);
  assert.equal(leggiLaFoto("x".repeat(70 * 1024)), null);
});

test("le righe senza id o senza nome restano fuori, la luminosita' sta fra 0 e 100", () => {
  const foto = leggiLaFoto(
    JSON.stringify({
      casa: " Casa ",
      dispositivi: [
        { id: "a", nome: "Cucina", genere: "LUCE", acceso: true, luminosita: 140 },
        { id: "", nome: "Senza id" },
        { id: "b", nome: "Cancello", genere: "varco", acceso: "si" },
      ],
      azioni: [{ id: "x", nome: "Buonanotte", subito: true }, { nome: "Senza id" }],
    }),
  );
  assert.equal(foto.casa, "Casa");
  assert.equal(foto.dispositivi.length, 2);
  assert.equal(foto.dispositivi[0].genere, "luce");
  assert.equal(foto.dispositivi[0].luminosita, 100);
  assert.equal(foto.dispositivi[1].acceso, false, "solo true vuol dire acceso");
  assert.equal(foto.dispositivi[1].luminosita, null);
  assert.equal(foto.azioni.length, 1);
  assert.deepEqual(
    diGenere(foto, ["varco", "porta"]).map((d) => d.id),
    ["b"],
  );
});

test("al massimo ventiquattro dispositivi, come gli altri orologi", () => {
  const tanti = Array.from({ length: 40 }, (_, i) => ({
    id: `d${i}`,
    nome: `Luce ${i}`,
    genere: "luce",
  }));
  assert.equal(leggiLaFoto({ dispositivi: tanti }).dispositivi.length, 24);
});

test("la riga girata al tocco dice la parola opposta", () => {
  const d = { id: "a", nome: "Cucina", stato: "Spenta", acceso: false };
  assert.deepEqual(girato(d), { ...d, stato: "Accesa", acceso: true });
  assert.equal(girato({ ...d, stato: "Al 40%" }).stato, "Al 40%");
});

test("di quando e' la fotografia", () => {
  const adesso = 10 * 60 * 60 * 1000;
  assert.equal(diQuando(0, adesso), "Non si sa di quando è");
  assert.equal(diQuando(adesso - 30 * 1000, adesso), "Aggiornato adesso");
  assert.equal(diQuando(adesso - 12 * 60 * 1000, adesso), "Di 12 minuti fa");
  assert.equal(diQuando(adesso - 3 * 60 * 60 * 1000, adesso), "Di 3 ore fa");
});

test("la casa d'esempio gira le luci e ne cambia la luminosita'", () => {
  const prima = leggiLaFoto(laFotoDellaVetrina());
  const cucina = prima.dispositivi.find((d) => d.nome === "Cucina");
  assert.equal(cucina.acceso, false);
  const r = comandoNellaVetrina({ id: cucina.id, cosa: "gira" });
  assert.equal(r.ok, true);
  assert.equal(leggiLaFoto(r.foto).dispositivi.find((d) => d.id === cucina.id).stato, "Accesa");
  const dimmer = comandoNellaVetrina({ id: cucina.id, cosa: "luminosita", valore: 30 });
  assert.equal(leggiLaFoto(dimmer.foto).dispositivi.find((d) => d.id === cucina.id).luminosita, 30);
  assert.equal(comandoNellaVetrina({ id: "nessuno", cosa: "gira" }).ok, false);
});
