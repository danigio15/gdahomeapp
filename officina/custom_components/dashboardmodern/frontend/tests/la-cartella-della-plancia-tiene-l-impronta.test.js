/* «Questo DWG non si legge», dal telefono: il motore dei DWG si chiedeva al
 * ponte senza l'impronta della plancia, e il ponte rispondeva 404. Qui si
 * pretende che l'indirizzo dei file di `legacy/vendor/` tenga l'impronta
 * quando c'e' (ponte), e vada bene anche quando non c'e' (Home Assistant). */
import assert from "node:assert/strict";
import test from "node:test";
import { cartellaDellaPlancia, daiVendor } from "../src/core/cartella-della-plancia.js";

test("servita dal ponte: l'impronta resta, che il modulo sia nel pacco o sciolto", () => {
  for (const qui of [
    "https://casa.example/dashboardmodern_static/b5be9a4ec8bcd2e8/pacco/src/sections/section-runtime.js",
    "https://casa.example/dashboardmodern_static/b5be9a4ec8bcd2e8/src/sections/casa-3d-crea-section.js",
    "https://casa.example/dashboardmodern_static/b5be9a4ec8bcd2e8/legacy/dashboard.html",
  ])
    assert.equal(
      cartellaDellaPlancia(qui),
      "https://casa.example/dashboardmodern_static/b5be9a4ec8bcd2e8/",
      qui,
    );
  assert.equal(
    daiVendor(
      "http://192.168.1.5:8099/dashboardmodern_static/b5be9a4ec8bcd2e8/pacco/chunk-2HDBHXHW.js",
      "libredwg/wasm/libredwg-web.wasm",
      "riserva",
    ),
    "http://192.168.1.5:8099/dashboardmodern_static/b5be9a4ec8bcd2e8/legacy/vendor/libredwg/wasm/libredwg-web.wasm",
  );
});

test("servita da Home Assistant, col prefisso stabile o con la versione", () => {
  assert.equal(
    cartellaDellaPlancia(
      "http://ha.local:8123/dashboardmodern_static/src/sections/casa-3d-section.js",
    ),
    "http://ha.local:8123/dashboardmodern_static/",
  );
  assert.equal(
    cartellaDellaPlancia(
      "http://ha.local:8123/dashboardmodern_static/1.18.7.19-abc/src/sections/x.js",
    ),
    "http://ha.local:8123/dashboardmodern_static/1.18.7.19-abc/",
  );
});

test("fuori da una plancia servita (le prove) si usa la riserva", () => {
  assert.equal(cartellaDellaPlancia("http://127.0.0.1:4173/src/sections/x.js"), null);
  assert.equal(
    daiVendor("http://127.0.0.1:4173/src/sections/x.js", "pdfjs/pdf.min.js", "rel"),
    "rel",
  );
});
