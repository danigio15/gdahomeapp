/* I telefoni abbinati col loro modello, e di chi sono.
 *
 * «Si aggiungi anche il modello del telefono, aggiungerei anche il nome di
 * chi e' il telefono.» Il nome lo fa la casa dal modello e dal nome scritto
 * nell'app; uno scelto a mano col tasto «Rinomina» non lo tocca piu'. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chiE, Dispositivi, nomeDalModello } from "../src/dispositivi.js";

function cartella() {
  const dove = mkdtempSync(join(tmpdir(), "dm-modello-"));
  return { dove, via: () => rmSync(dove, { recursive: true, force: true }) };
}

test("abbinato col modello: si chiama «<modello> di <chi>», e dice cos'e'", () => {
  const c = cartella();
  try {
    const d = new Dispositivi({ cartella: c.dove });
    const { dispositivo } = d.abbina({
      nome: "Galaxy S24 Ultra",
      sistema: "android",
      marca: "Samsung",
      modello: "Galaxy S24 Ultra",
      versione: "15",
      app: "1.15.0",
      proprietario: "Persona 1",
    });
    assert.equal(dispositivo.nome, "Galaxy S24 Ultra di Persona 1");
    const [riga] = d.elenco();
    assert.equal(riga.marca, "Samsung");
    assert.equal(riga.versione, "15");
    assert.equal(riga.app, "1.15.0");
    assert.equal(riga.proprietario, "Persona 1");
    assert.equal(riga.rinominato, false);
  } finally {
    c.via();
  }
});

test("senza di chi e', il nome e' solo il modello; senza modello resta quello detto", () => {
  assert.equal(nomeDalModello({ modello: "Pixel 9" }), "Pixel 9");
  assert.equal(nomeDalModello({ proprietario: "Persona 1" }), "");
  const c = cartella();
  try {
    const d = new Dispositivi({ cartella: c.dove });
    const { dispositivo } = d.abbina({ nome: "Telefono Android", sistema: "android" });
    assert.equal(dispositivo.nome, "Telefono Android");
  } finally {
    c.via();
  }
});

test("un telefono di prima si presenta: il nome automatico diventa il modello", () => {
  const c = cartella();
  try {
    const d = new Dispositivi({ cartella: c.dove });
    const { dispositivo } = d.abbina({ nome: "Telefono Android", sistema: "android" });
    assert.equal(
      d.presentati(dispositivo.id, {
        marca: "Samsung",
        modello: "Galaxy Tab S9",
        versione: "14",
        proprietario: "Persona 1",
      }),
      true,
    );
    assert.equal(d.elenco()[0].nome, "Galaxy Tab S9 di Persona 1");
    /* La seconda volta, uguale: niente da cambiare. */
    assert.equal(d.presentati(dispositivo.id, { modello: "Galaxy Tab S9" }), false);
    /* Di chi e' cambia: il nome segue, perche' l'ha fatto la casa. */
    assert.equal(d.presentati(dispositivo.id, { proprietario: "Persona 2" }), true);
    assert.equal(d.elenco()[0].nome, "Galaxy Tab S9 di Persona 2");
  } finally {
    c.via();
  }
});

test("rinominato a mano: il modello si scrive, il nome resta quello scelto", () => {
  const c = cartella();
  try {
    const d = new Dispositivi({ cartella: c.dove });
    const { dispositivo } = d.abbina({ nome: "Telefono Android", sistema: "android" });
    d.rinomina(dispositivo.id, "Il tablet della cucina");
    d.presentati(dispositivo.id, { modello: "Galaxy Tab S9", proprietario: "Persona 1" });
    const [riga] = d.elenco();
    assert.equal(riga.nome, "Il tablet della cucina");
    assert.equal(riga.modello, "Galaxy Tab S9");
    assert.equal(riga.rinominato, true);
    /* E dopo un riavvio vale lo stesso. */
    const dopo = new Dispositivi({ cartella: c.dove });
    dopo.presentati(dispositivo.id, { modello: "Galaxy Tab S10" });
    assert.equal(dopo.elenco()[0].nome, "Il tablet della cucina");
  } finally {
    c.via();
  }
});

test("un nome scritto da una persona prima di oggi non si sostituisce", () => {
  const c = cartella();
  try {
    const d = new Dispositivi({ cartella: c.dove });
    const { dispositivo } = d.abbina({ nome: "Telefono del salotto", sistema: "android" });
    d.presentati(dispositivo.id, { modello: "Pixel 9" });
    assert.equal(d.elenco()[0].nome, "Telefono del salotto");
  } finally {
    c.via();
  }
});

test("campi lunghi o strani: ripuliti, accorciati, e solo quelli conosciuti", () => {
  const detto = chiE({
    marca: "  Sam\u0000sung\n ",
    modello: "M".repeat(200),
    proprietario: "P".repeat(80),
    versione: 15,
    segno: "non si prende",
    utente: "nemmeno questo",
  });
  assert.deepEqual(Object.keys(detto).sort(), ["marca", "modello", "proprietario", "versione"]);
  assert.equal(detto.marca, "Samsung");
  assert.equal(detto.modello.length, 40);
  assert.equal(detto.proprietario.length, 30);
  assert.equal(detto.versione, "15");
});

test("il numero di costruzione dell'app: solo cifre, o niente", () => {
  assert.equal(chiE({ app: "1.18.7", costruzione: "1180715" }).costruzione, "1180715");
  assert.equal(chiE({ costruzione: 1180715 }).costruzione, "1180715");
  for (const storto of ["11807x5", "", "1".repeat(11), "-5", "1.5", null])
    assert.equal("costruzione" in chiE({ costruzione: storto }), false, String(storto));
});

test("chi-sono per un telefono che non c'e' non fa niente", () => {
  const c = cartella();
  try {
    const d = new Dispositivi({ cartella: c.dove });
    assert.equal(d.presentati("dm_inesistente", { modello: "Pixel 9" }), false);
  } finally {
    c.via();
  }
});
