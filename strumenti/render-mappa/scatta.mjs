/* Le foto della mappa vera di GdANav, scena per scena.
 *
 * Serve la cartella con `pagina.html`, gli stili e `node_modules` su un
 * piccolo server locale (MapLibre vuole i suoi worker da http, non da
 * file://), apre Chromium col WebGL in software e fotografa quando la mappa
 * ha finito di caricare. Le foto vanno in `foto/`. */
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const qui = new URL(".", import.meta.url).pathname;
const TIPI = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
};
const server = createServer(async (req, res) => {
  const percorso = join(qui, decodeURIComponent(new URL(req.url, "http://x").pathname));
  try {
    const corpo = await readFile(percorso);
    res.writeHead(200, { "content-type": TIPI[extname(percorso)] || "application/octet-stream" });
    res.end(corpo);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(0);
const porta = server.address().port;
await mkdir(join(qui, "foto"), { recursive: true });

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const pagina = await browser.newPage({ viewport: { width: 1280, height: 720 } });
pagina.on("console", (m) => console.log(`[pagina] ${m.text()}`));
for (const scena of ["citta", "incrocio", "forlanini", "est", "ovest"]) {
  for (const modo of ["oggi", "immersiva"]) {
    for (const stile of ["chiaro", "scuro"]) {
      await pagina.goto(
        `http://127.0.0.1:${porta}/pagina.html?scena=${scena}&stile=${stile}&modo=${modo}`,
      );
      try {
        await pagina.waitForSelector("body[data-pronta=si]", { timeout: 90000 });
      } catch {
        console.log(`${scena}/${modo}/${stile}: la mappa non ha finito in tempo, foto lo stesso`);
      }
      await pagina
        .locator("#schermo")
        .screenshot({ path: join(qui, "foto", `${scena}-${modo}-${stile}.png`) });
      console.log(`${scena}/${modo}/${stile}: fatta`);
    }
  }
}
/* Il telefono, in guida, nelle tre viste che si scelgono col tasto della
 * mappa: 2D, 3D e immersiva. */
const telefono = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
telefono.on("console", (m) => console.log(`[telefono] ${m.text()}`));
for (const scena of ["est", "incrocio", "forlanini"]) {
  for (const vista of ["piatta", "inclinata", "immersiva"]) {
    for (const stile of vista === "immersiva" ? ["chiaro", "scuro"] : ["chiaro"]) {
      await telefono.goto(
        `http://127.0.0.1:${porta}/telefono.html?scena=${scena}&stile=${stile}&vista=${vista}`,
      );
      try {
        await telefono.waitForSelector("body[data-pronta=si]", { timeout: 90000 });
      } catch {
        console.log(`telefono ${scena}/${vista}/${stile}: non ha finito in tempo, foto lo stesso`);
      }
      await telefono
        .locator("#schermo")
        .screenshot({ path: join(qui, "foto", `telefono-${scena}-${vista}-${stile}.png`) });
      console.log(`telefono ${scena}/${vista}/${stile}: fatta`);
    }
  }
}
await browser.close();
server.close();
