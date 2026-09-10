/* Le prove delle foto: caricare, elencare, servire, e non uscire dalla
 * cartella. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BASE_DELLE_FOTO, BASE_DI_CASA, Foto, FOTO_MASSIMA, nomePulito } from "../src/foto.js";

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

/* ─── La cartella di Home Assistant ──────────────────────────────────────── */

/* Chi ha una casa da qualche anno ha duecento immagini in `config/www` e le
 * sceglieva da li'. Il ponte ci entra in sola lettura, e gli indirizzi che
 * scrive sono quelli veri di Home Assistant — `/local/…` — cosi' la stessa
 * configurazione mostra la stessa foto nella plancia dentro Home Assistant e
 * nella plancia dentro l'app. */

function cartellaDiCasa() {
  const dove = mkdtempSync(join(tmpdir(), "casa-"));
  mkdirSync(join(dove, "www", "auto"), { recursive: true });
  writeFileSync(join(dove, "www", "sfondo.png"), PNG);
  writeFileSync(join(dove, "www", "auto", "leapmotor.jpg"), JPEG);
  writeFileSync(join(dove, "www", "segreti.yaml"), "niente");
  return {
    foto: new Foto({
      cartella: join(dove, "www"),
      base: BASE_DI_CASA,
      scrivibile: false,
    }),
    dove,
    via: () => rmSync(dove, { recursive: true, force: true }),
  };
}

test("le immagini di Home Assistant si elencano con l'indirizzo vero", () => {
  const { foto, via } = cartellaDiCasa();
  try {
    const dentro = foto.elenca();
    assert.equal(dentro.available, true);
    assert.deepEqual(
      dentro.images.map((una) => una.url),
      ["/local/sfondo.png"],
    );
    assert.deepEqual(
      dentro.folders.map((una) => una.name),
      ["auto"],
    );
    /* Un file che non e' un'immagine non si elenca: li' dentro ci sono anche
     * le automazioni e i segreti di chi ci abita. */
    assert.equal(
      dentro.images.some((una) => una.name.endsWith(".yaml")),
      false,
    );
    assert.deepEqual(
      foto.elenca("auto").images.map((una) => una.url),
      ["/local/auto/leapmotor.jpg"],
    );
  } finally {
    via();
  }
});

test("da Home Assistant si legge e non si scrive", () => {
  const { foto, via } = cartellaDiCasa();
  try {
    const letta = foto.leggi("/local/sfondo.png");
    assert.equal(letta.stato, 200);
    assert.equal(letta.tipo, "image/png");

    /* La cartella di chi ci abita non si tocca: un add-on che ci lascia
     * dentro file e' un add-on che, il giorno che si disinstalla, lascia
     * sporco in casa d'altri. */
    assert.equal(foto.carica("nuova.png", PNG), null);
  } finally {
    via();
  }
});

test("una cartella che non c'e' e' un magazzino vuoto, non un errore", () => {
  /* Il Supervisor la monta solo se il manifesto la chiede, e chi lancia il
   * ponte sul banco non ne ha nessuna. Prima qui il ponte cadeva a meta'
   * accensione, lasciando in piedi i server gia' aperti. */
  const senza = new Foto({ cartella: "", base: BASE_DI_CASA, scrivibile: false });
  assert.equal(senza.cE, false);
  assert.equal(senza.elenca().available, false);
  assert.equal(senza.leggi("/local/sfondo.png").stato, 404);
  assert.equal(senza.carica("nuova.png", PNG), null);
});
