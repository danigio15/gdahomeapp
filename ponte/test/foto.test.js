/* Le prove delle foto: caricare, elencare, servire, e non uscire dalla
 * cartella. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BASE_DELLE_FOTO, Foto, FOTO_MASSIMA, nomePulito } from "../src/foto.js";

const PNG = Buffer.concat([Buffer.from("\x89PNG\r\n\x1a\n", "latin1"), Buffer.alloc(16, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16, 2)]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4),
  Buffer.from("WEBP"),
  Buffer.alloc(8),
]);

function cartella() {
  const dove = mkdtempSync(join(tmpdir(), "foto-"));
  return {
    foto: new Foto({ cartella: join(dove, "www") }),
    dove,
    via: () => rmSync(dove, { recursive: true, force: true }),
  };
}

test("i nomi si puliscono senza perdere l'estensione", () => {
  assert.equal(nomePulito("Foto Auto.JPG"), "foto-auto.jpg");
  assert.equal(nomePulito("../../etc/passwd.png"), "passwd.png");
  assert.equal(nomePulito("照片.jpg"), "foto.jpg");
  assert.equal(nomePulito(""), "foto.png");
  assert.equal(nomePulito(".nascosta.png"), "nascosta.png");
});

test("senza foto la cartella non c'e', e si dice", () => {
  const { foto, via } = cartella();
  assert.deepEqual(foto.elenca(), {
    path: "",
    folders: [],
    images: [],
    available: false,
    truncated: false,
  });
  assert.equal(foto.leggi(`${BASE_DELLE_FOTO}/dashboardmodern/x.png`).stato, 404);
  via();
});

test("una foto si carica, si elenca e si serve; una seconda con lo stesso nome si numera", () => {
  const { foto, via } = cartella();
  const prima = foto.carica("Auto.png", PNG);
  assert.deepEqual(prima, { path: `${BASE_DELLE_FOTO}/dashboardmodern/auto.png` });
  const seconda = foto.carica("auto.png", JPEG);
  assert.deepEqual(seconda, { path: `${BASE_DELLE_FOTO}/dashboardmodern/auto-2.png` });
  assert.deepEqual(foto.carica("ritratto.webp", WEBP), {
    path: `${BASE_DELLE_FOTO}/dashboardmodern/ritratto.webp`,
  });

  const radice = foto.elenca();
  assert.equal(radice.available, true);
  assert.deepEqual(radice.folders, [{ name: "dashboardmodern", path: "dashboardmodern" }]);
  assert.deepEqual(radice.images, []);

  const dentro = foto.elenca("dashboardmodern/");
  assert.equal(dentro.path, "dashboardmodern");
  assert.deepEqual(
    dentro.images.map((una) => una.name),
    ["auto-2.png", "auto.png", "ritratto.webp"],
  );
  assert.equal(dentro.images[1].url, `${BASE_DELLE_FOTO}/dashboardmodern/auto.png`);
  assert.equal(dentro.truncated, false);

  const servita = foto.leggi(prima.path);
  assert.equal(servita.stato, 200);
  assert.equal(servita.tipo, "image/png");
  assert.deepEqual(servita.corpo, PNG);
  assert.equal(foto.leggi(`${seconda.path}?v=1`).stato, 200);
  via();
});

test("si rifiuta quello che non e' un'immagine, o e' troppo grande, o e' un SVG", () => {
  const { foto, via } = cartella();
  assert.equal(foto.carica("finta.png", Buffer.from("non sono un png, sono testo lungo")), null);
  assert.equal(foto.carica("vuota.png", Buffer.alloc(0)), null);
  assert.equal(foto.carica("grande.png", Buffer.concat([PNG, Buffer.alloc(FOTO_MASSIMA)])), null);
  assert.equal(
    foto.carica("disegno.svg", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")),
    null,
  );
  assert.equal(foto.carica("documento.pdf", PNG), null, "l'estensione conta");
  assert.equal(foto.carica("x.png", "non un buffer"), null);
  via();
});

test("dalla cartella non si esce, ne' leggendo ne' elencando", () => {
  const { foto, dove, via } = cartella();
  foto.carica("auto.png", PNG);
  writeFileSync(join(dove, "segreto.png"), PNG);
  mkdirSync(join(dove, "www", "vuota"));
  writeFileSync(join(dove, "www", ".nascosta.png"), PNG);
  writeFileSync(join(dove, "www", "nota.txt"), "non e' un'immagine");

  assert.equal(foto.elenca(".."), null);
  assert.equal(foto.elenca("../segreto.png"), null);
  assert.equal(foto.elenca("dashboardmodern/auto.png"), null, "un file non e' una cartella");
  assert.equal(foto.elenca("mai-vista"), null);
  const radice = foto.elenca("/");
  assert.deepEqual(
    radice.folders.map((una) => una.name),
    ["dashboardmodern", "vuota"],
  );
  assert.deepEqual(radice.images, [], "niente file nascosti, niente non-immagini");

  assert.equal(foto.leggi(`${BASE_DELLE_FOTO}/../segreto.png`).stato, 404);
  assert.equal(foto.leggi(`${BASE_DELLE_FOTO}/dashboardmodern/../../segreto.png`).stato, 404);
  assert.equal(foto.leggi(`${BASE_DELLE_FOTO}/nota.txt`).stato, 404);
  assert.equal(foto.leggi("/dashboardmodern_static/abc/legacy/dashboard.html").stato, 404);
  assert.equal(foto.leggi("").stato, 404);
  via();
});
