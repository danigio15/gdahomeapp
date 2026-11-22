/* Le foto della cornice del tablet a muro (`le-foto-del-riposo.js`): stanno
 * nel ponte, col nome che da' il ponte; entra solo un JPEG, un PNG o un WebP
 * vero e non troppo grande, al massimo sessanta; le legge chi e' di casa, le
 * mette e le toglie solo chi amministra; un nome che arriva da fuori non
 * diventa mai un percorso. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Commissioni } from "../src/commissioni.js";
import {
  FOTO_DEL_RIPOSO_AL_MASSIMO,
  FOTO_DEL_RIPOSO_MASSIMA,
  FotoDelRiposo,
  FotoDelRiposoNo,
  tipoDallaFirma,
} from "../src/le-foto-del-riposo.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };
const CHI = "d00dfeedd00dfeedd00dfeedd00dfeed";

/* Tre immagini finte: la firma giusta e il resto riempito. */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2044, 7)]);
const PNG = Buffer.concat([Buffer.from("\x89PNG\r\n\x1a\n", "latin1"), Buffer.alloc(1016, 3)]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF", "latin1"),
  Buffer.alloc(4, 0),
  Buffer.from("WEBPVP8 ", "latin1"),
  Buffer.alloc(500, 9),
]);
const MINI = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xdb]), Buffer.alloc(300, 1)]);

function unaCartella(opzioni = {}) {
  const dove = mkdtempSync(join(tmpdir(), "riposo-foto-"));
  const cartella = join(dove, "riposo-foto");
  return {
    cartella,
    foto: new FotoDelRiposo({ cartella, ...opzioni }),
    via: () => rmSync(dove, { recursive: true, force: true }),
  };
}

function commissioniCon(foto) {
  const commissioni = new Commissioni({ registro: ZITTO, fotoDelRiposo: foto });
  const chiedi = (detto, { amministra = true, chi = CHI } = {}) =>
    commissioni.rispondi({ id: 1, ...detto }, { chiChiede: chi, puoAmministrare: amministra });
  return { commissioni, chiedi };
}

test("la firma dice il tipo, non il nome", () => {
  assert.equal(tipoDallaFirma(JPEG), "image/jpeg");
  assert.equal(tipoDallaFirma(PNG), "image/png");
  assert.equal(tipoDallaFirma(WEBP), "image/webp");
  assert.equal(tipoDallaFirma(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")), "");
  assert.equal(tipoDallaFirma(Buffer.from("GIF89a-------")), "");
});

test("una foto entra col nome del ponte, si elenca, si legge e si toglie", () => {
  const { cartella, foto, via } = unaCartella();
  try {
    const messa = foto.carica(JPEG, "image/jpeg", MINI);
    assert.match(messa.id, /^[a-z0-9]{16}$/);
    assert.deepEqual(readdirSync(cartella).sort(), [`${messa.id}.jpg`, `${messa.id}.mini.jpg`]);
    const [voce] = foto.elenco();
    assert.equal(voce.id, messa.id);
    assert.equal(voce.tipo, "image/jpeg");
    assert.equal(voce.peso, JPEG.length);
    assert.equal(voce.mini, true);
    assert.ok(foto.leggi(messa.id).byte.equals(JPEG));
    assert.ok(foto.leggi(messa.id, { mini: true }).byte.equals(MINI));
    assert.equal(foto.togli(messa.id), true);
    assert.deepEqual(readdirSync(cartella), []);
    assert.equal(foto.togli(messa.id), false);
  } finally {
    via();
  }
});

test("entrano JPEG, PNG e WebP veri; il resto e' un no che dice perche'", () => {
  const { foto, via } = unaCartella();
  try {
    assert.equal(foto.carica(PNG, "image/png").tipo, "image/png");
    assert.equal(foto.carica(WEBP, "image/webp").tipo, "image/webp");
    const no = (fai, codice) =>
      assert.throws(fai, (e) => e instanceof FotoDelRiposoNo && e.codice === codice);
    no(() => foto.carica(Buffer.from("GIF89a-------"), "image/gif"), "tipo");
    no(() => foto.carica(Buffer.from("<svg></svg>........"), "image/svg+xml"), "tipo");
    /* Un PNG che dice di essere un JPEG non passa: il tipo e' quello della firma. */
    no(() => foto.carica(PNG, "image/jpeg"), "firma");
    no(() => foto.carica(Buffer.from("non sono una foto, sono testo"), "image/jpeg"), "firma");
    no(
      () => foto.carica(Buffer.concat([JPEG, Buffer.alloc(FOTO_DEL_RIPOSO_MASSIMA)]), "image/jpeg"),
      "grande",
    );
    no(() => foto.carica(JPEG, "image/jpeg", PNG), "mini");
    /* Dei no non resta niente. */
    assert.equal(foto.elenco().length, 2);
  } finally {
    via();
  }
});

test("al massimo sessanta: la sessantunesima aspetta che se ne tolga una", () => {
  assert.equal(FOTO_DEL_RIPOSO_AL_MASSIMO, 60);
  const { foto, via } = unaCartella({ quante: 3 });
  try {
    const ids = [1, 2, 3].map(() => foto.carica(JPEG, "image/jpeg").id);
    assert.throws(
      () => foto.carica(JPEG, "image/jpeg"),
      (e) => e instanceof FotoDelRiposoNo && e.codice === "piena",
    );
    foto.togli(ids[0]);
    assert.ok(foto.carica(JPEG, "image/jpeg").id);
  } finally {
    via();
  }
});

test("un nome che arriva da fuori non diventa un percorso", () => {
  const { cartella, foto, via } = unaCartella();
  try {
    const messa = foto.carica(JPEG, "image/jpeg");
    /* Un file accanto, che non e' una foto del ponte, e uno fuori dalla cartella. */
    writeFileSync(join(cartella, "segreto.jpg"), JPEG);
    writeFileSync(join(cartella, "..", "fuori.jpg"), JPEG);
    for (const nome of [
      "../fuori",
      "..%2Ffuori",
      "segreto",
      `${messa.id}.jpg`,
      `${messa.id}/../${messa.id}`,
      messa.id.toUpperCase(),
      "",
      null,
      { id: messa.id },
    ]) {
      assert.equal(foto.leggi(nome), null, String(nome));
      assert.equal(foto.togli(nome), false, String(nome));
    }
    /* Il file messo li' a mano non si vede e resta dov'e'. */
    assert.deepEqual(
      foto.elenco().map((f) => f.id),
      [messa.id],
    );
    assert.ok(existsSync(join(cartella, "segreto.jpg")));
    assert.ok(existsSync(join(cartella, "..", "fuori.jpg")));
  } finally {
    via();
  }
});

test("dal filo: chi amministra carica e toglie, chi e' di casa guarda e basta", async () => {
  const { foto, via } = unaCartella();
  try {
    const { chiedi } = commissioniCon(foto);
    const carica = (opzioni) =>
      chiedi(
        {
          type: "ponte/riposo/foto/carica",
          tipo: "image/jpeg",
          data: JPEG.toString("base64"),
          mini: MINI.toString("base64"),
        },
        opzioni,
      );
    /* Chi non amministra: un no, e non resta niente. */
    const negata = await carica({ amministra: false });
    assert.equal(negata.success, false);
    assert.equal(negata.error.code, "unauthorized");
    assert.equal(foto.elenco().length, 0);

    const messa = await carica();
    assert.equal(messa.success, true);
    const id = messa.result.id;

    /* Chi e' di casa vede l'elenco e la foto, anche senza amministrare. */
    const elenco = await chiedi({ type: "ponte/riposo/foto/elenco" }, { amministra: false });
    assert.equal(elenco.success, true);
    assert.deepEqual(
      elenco.result.foto.map((f) => f.id),
      [id],
    );
    assert.equal(elenco.result.al_massimo, 60);
    const letta = await chiedi(
      { type: "ponte/riposo/foto/leggi", foto: id, mini: true },
      { amministra: false },
    );
    assert.equal(letta.success, true);
    assert.equal(letta.result.tipo, "image/jpeg");
    assert.ok(Buffer.from(letta.result.data, "base64").equals(MINI));

    /* Togliere e' di chi amministra. */
    const togliNo = await chiedi(
      { type: "ponte/riposo/foto/togli", foto: id },
      { amministra: false },
    );
    assert.equal(togliNo.error.code, "unauthorized");
    assert.equal(foto.elenco().length, 1);
    const tolta = await chiedi({ type: "ponte/riposo/foto/togli", foto: id });
    assert.equal(tolta.result.tolta, true);
    assert.equal(foto.elenco().length, 0);
  } finally {
    via();
  }
});

test("dal filo: chi non e' entrato non vede le foto di casa", async () => {
  const { foto, via } = unaCartella();
  try {
    foto.carica(JPEG, "image/jpeg");
    const { chiedi } = commissioniCon(foto);
    const elenco = await chiedi(
      { type: "ponte/riposo/foto/elenco" },
      { chi: "", amministra: false },
    );
    assert.equal(elenco.success, false);
    assert.equal(elenco.error.code, "unauthorized");
    const id = foto.elenco()[0].id;
    const letta = await chiedi(
      { type: "ponte/riposo/foto/leggi", foto: id },
      { chi: "", amministra: false },
    );
    assert.equal(letta.success, false);
  } finally {
    via();
  }
});

test("dal filo: quello che non e' una foto si rifiuta con un motivo", async () => {
  const { foto, via } = unaCartella();
  try {
    const { chiedi } = commissioniCon(foto);
    const prova = (detto) => chiedi({ type: "ponte/riposo/foto/carica", ...detto });
    const svg = await prova({
      tipo: "image/svg+xml",
      data: Buffer.from("<svg onload='x'></svg>........").toString("base64"),
    });
    assert.equal(svg.error.code, "invalid_upload");
    assert.equal(svg.error.motivo, "tipo");
    const finta = await prova({ tipo: "image/png", data: JPEG.toString("base64") });
    assert.equal(finta.error.motivo, "firma");
    const vuota = await prova({ tipo: "image/jpeg", data: "" });
    assert.equal(vuota.error.code, "invalid_format");
    const nonBase64 = await prova({ tipo: "image/jpeg", data: "@@@ non e' base64 @@@" });
    assert.equal(nonBase64.error.code, "invalid_format");
    const enorme = await prova({
      tipo: "image/jpeg",
      data: Buffer.concat([JPEG, Buffer.alloc(FOTO_DEL_RIPOSO_MASSIMA)]).toString("base64"),
    });
    assert.equal(enorme.error.code, "invalid_format");
    assert.equal(foto.elenco().length, 0);
  } finally {
    via();
  }
});

test("dal filo: una persona non carica centinaia di foto di fila", async () => {
  const { foto, via } = unaCartella({ quante: 500 });
  try {
    const { chiedi } = commissioniCon(foto);
    const carica = () =>
      chiedi({ type: "ponte/riposo/foto/carica", tipo: "image/png", data: PNG.toString("base64") });
    for (let i = 0; i < 40; i += 1) assert.equal((await carica()).success, true);
    const troppe = await carica();
    assert.equal(troppe.error.code, "rate_limited");
  } finally {
    via();
  }
});

test("un ponte senza cartella delle foto non conosce i comandi", async () => {
  const { chiedi } = commissioniCon(null);
  const elenco = await chiedi({ type: "ponte/riposo/foto/elenco" });
  assert.equal(elenco.success, false);
  assert.equal(elenco.error.code, "unknown_command");
});
