/* La disposizione in ogni sezione, su una casa piena (#379).
 *
 * «Il discorso drag & drop deve essere ovunque.» Le prove della disposizione
 * guardano l'Auto e le Luci su una casa fatta apposta; queste guardano le
 * altre sezioni sulla casa demo — antifurto, telecamere, stanze per piano,
 * tapparelle, lettori, piscina, batterie, server, agenda — e per ognuna
 * pretendono tre cose:
 *
 *  - i riquadri hanno l'id scritto nella tabella della disposizione, non uno
 *    ricavato dal testo (che cambia con la lingua o con un numero), e un nome
 *    vero: niente «Riquadro 3», niente figure davanti alle parole;
 *  - in modifica la maniglia di ogni riquadro si vede e non ci sta sopra
 *    niente: chi la tocca prende il riquadro;
 *  - spostato un riquadro e salvato, ricaricando la pagina resta dov'e'.
 */
import { expect, test } from "@playwright/test";
import { apri, nellaCasaDemo, pronta } from "./helpers/casa-demo.js";

test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });

const GRUPPI = [
  {
    nome: "Sicurezza",
    sezioni: [
      {
        sezione: "security",
        riquadri: { antifurto: "Antifurto", fumo: "Rilevatori di fumo", telecamere: "Telecamere" },
        elenchi: { "security:telecamere/#cam-grid": ["camera.ingresso", "camera.giardino"] },
      },
      {
        sezione: "varchi",
        riquadri: { adesso: "In questo momento", elenco: "Porte e finestre" },
        elenchi: {
          "varchi:elenco": ["binary_sensor.porta_ingresso", "binary_sensor.finestra_cucina"],
        },
      },
      {
        sezione: "batterie",
        riquadri: { adesso: "In questo momento", elenco: "Batterie" },
        elenchi: { "batterie:elenco": ["sensor.auto_batteria", "sensor.ups_battery_charge"] },
      },
    ],
  },
  {
    nome: "Le stanze, le finestre e la musica",
    sezioni: [
      {
        sezione: "stanze",
        riquadri: { "piano-terra": "Piano terra", "primo-piano": "Primo piano" },
        elenchi: { "stanze:piano-terra": ["=room-soggiorno", "=room-cucina", "=room-garage"] },
      },
      {
        sezione: "tapparelle",
        riquadri: { riepilogo: "Riepilogo finestre", "cover.soggiorno": "Tapparella soggiorno" },
      },
      {
        sezione: "media",
        riquadri: { radio: "Radio", lettori: "Lettori" },
        elenchi: { "media:lettori": ["media_player.salone", "media_player.cucina"] },
        nomi: { "media:lettori": ["Salone", "Cucina", "Camera"] },
      },
      {
        sezione: "temp",
        riquadri: { stanze: "Stanze", andamento: "Andamento" },
        nomi: { "temp:stanze": ["Soggiorno", "Cucina", "Camera"] },
      },
    ],
  },
  {
    nome: "Fuori e nel ripostiglio",
    sezioni: [
      {
        sezione: "piscina",
        riquadri: { vasca: "Piscina", comandi: "Comandi", schede: "Qualità e filtrazione" },
        nomi: { "piscina:schede": ["Qualità acqua", "Filtrazione"] },
      },
      {
        sezione: "irrigazione",
        riquadri: { giardino: "Giardino", zone: "Zone" },
        elenchi: { "irrigazione:zone": ["dm-irr-card~prato-fronte", "dm-irr-card~orto"] },
        nomi: { "irrigazione:zone": ["Prato fronte", "Prato retro"] },
      },
      {
        sezione: "server",
        riquadri: { server: "Server", macchine: "Macchine virtuali" },
        /* Le misure del MiniPC (alimentazione, uptime, rete) si vedono solo
         * quando i loro sensori hanno risposto: qui si guarda che, quando ci
         * sono, abbiano nome e id loro — vedi `ancheSe`. */
        ancheSe: {
          "server:server/.srv-tel-grid": {
            voci: ["pwr", "uptime", "dl", "ul"],
            nomi: ["Alimentazione", "Uptime", "Download", "Upload"],
          },
        },
      },
      {
        sezione: "appliances-main",
        riquadri: { consumi: "Consumi", elettrodomestici: "Elettrodomestici" },
        elenchi: {
          "appliances-main:elettrodomestici/#appl-grid-overview": [
            "=appliance-lavatrice",
            "=appliance-forno",
          ],
        },
      },
    ],
  },
  {
    nome: "L'agenda, il tempo, il clima e l'energia",
    sezioni: [
      {
        sezione: "calendario",
        riquadri: {
          giorni: "Giorni",
          nuovo: "Nuovo evento",
          agenda: "Agenda",
          "da-fare": "Da fare",
        },
      },
      { sezione: "meteo", riquadri: { adesso: "Adesso" } },
      {
        /* Le carte si riordinano dentro il loro piano: un elenco per piano,
         * col titolo del piano fuori. */
        sezione: "clima",
        riquadri: { zone: "Zone" },
        elenchi: {
          "clima:zone/freddo-piano-terra": ["#card-climate-soggiorno"],
          "clima:zone/freddo-primo-piano": ["#card-climate-camera", "#card-climate-cameretta"],
        },
        nomi: { "clima:zone/freddo-primo-piano": ["Clima camera", "Clima cameretta"] },
      },
      {
        /* I numeri del banner si chiamavano tutti «Numeri»: adesso ognuno ha
         * la sua etichetta, e l'id del valore che la pagina ci scrive. */
        sezione: "energy",
        vista: () =>
          document.querySelector("#page-energy .sub-tab-btn[onclick*='panoramica']")?.click(),
        elenchi: {
          "energy:#view-panoramica/numeri": ["prod", "cons", "auto"],
          "energy:#view-panoramica/conti": ["pagato", "costo", "risp", "imm", "co2"],
        },
        riquadri: { "#view-panoramica": "Report" },
        nomi: {
          "energy:#view-panoramica/numeri": ["Produzione FV", "Consumo Totale", "Autosufficienza"],
          "energy:#view-panoramica/conti": ["Senza FV", "Costo Reale", "Risparmio"],
        },
      },
    ],
  },
  {
    nome: "Lo sport, i rifiuti, i contatori, gli animali e la salute",
    sezioni: [
      {
        sezione: "sport",
        riquadri: { "calcio:110": "Internazionale", f1: "Formula 1", motogp: "MotoGP" },
        elenchi: {
          "sport:calcio:110/schede": ["prossima", "ultime", "classifica"],
          "sport:calcio:110/coppa-uefa.champions": ["prossima", "ultime", "classifica"],
          "sport:f1/schede": ["prossima", "ultima-gara", "piloti", "costruttori"],
        },
        nomi: { "sport:calcio:110/schede": ["Ultime partite", "Serie A"] },
      },
      {
        sezione: "rifiuti",
        riquadri: { prossimo: "Prossimo ritiro", ritiri: "Prossimi ritiri" },
      },
      {
        sezione: "contatori",
        riquadri: { adesso: "In questo momento", elenco: "Contatori" },
        elenchi: {
          "contatori:elenco": [
            "sensor.contatore_acqua",
            "sensor.contatore_gas",
            "sensor.impianto_pressione",
          ],
        },
      },
      {
        sezione: "animali",
        riquadri: { filtri: "Filtri", micio: "Micio Gatto", fido: "Fido Cane" },
        elenchi: { "animali:micio/.dm-animale-gruppi": ["ciotola", "lettiera"] },
      },
      {
        sezione: "salute",
        riquadri: { passi: "Passi di oggi", misure: "Misure", fonte: "Da dove arrivano" },
        elenchi: { "salute:misure": ["battito", "peso", "sonno"] },
      },
    ],
  },
  {
    nome: "I viaggi, le automazioni e l'Energia",
    sezioni: [
      {
        sezione: "gdanav",
        riquadri: { nuovo: "Nuovo viaggio", viaggi: "Viaggi" },
        elenchi: { "gdanav:viaggi": ["elenco", "viaggio"] },
        nomi: { "gdanav:viaggi": ["I tuoi viaggi"] },
      },
      {
        /* Nella casa demo le Automazioni stanno sotto il velo del Premium:
         * si guardano gli id e i nomi, le maniglie no. */
        sezione: "automazioni-casa",
        tab: "automazioni",
        maniglie: false,
        riquadri: { numeri: "Numeri" },
        elenchi: { "automazioni-casa:numeri": ["attive", "spente", "prossima"] },
      },
      {
        /* La vista che si apre da sola: il flusso, non «Schema». */
        sezione: "energy",
        riquadri: { "#view-ist": "Flusso di energia" },
      },
    ],
  },
];

const elenchi = (page) =>
  page.evaluate(() =>
    window.dmDisposizione.elenchi().map((e) => ({ chiave: e.chiave, voci: e.voci, nomi: e.nomi })),
  );

/* Una sezione si ridisegna quando arrivano gli stati e le sue misure: si
 * aspetta che stia ferma prima di prenderla in mano. */
async function ferma(page) {
  let giri = -1;
  await expect
    .poll(
      async () => {
        const ora = await page.evaluate(() => window.dmDisposizione.giri());
        const fermo = ora === giri;
        giri = ora;
        return fermo;
      },
      { intervals: [500], timeout: 15_000 },
    )
    .toBe(true);
}

async function guarda(
  page,
  {
    sezione,
    tab,
    vista,
    riquadri = {},
    elenchi: attesi = {},
    nomi = {},
    ancheSe = {},
    maniglie = true,
  },
) {
  await apri(page, sezione, tab);
  if (vista) await page.evaluate(vista);
  const ids = Object.keys(riquadri);
  await expect
    .poll(async () => (await elenchi(page)).find((e) => e.chiave === sezione)?.voci || [], {
      timeout: 15_000,
    })
    .toEqual(expect.arrayContaining(ids));
  for (const [chiave, voci] of Object.entries(attesi))
    await expect
      .poll(async () => (await elenchi(page)).find((e) => e.chiave === chiave)?.voci || [], {
        timeout: 15_000,
      })
      .toEqual(expect.arrayContaining(voci));
  await ferma(page);
  const tutti = await elenchi(page);
  const pagina = tutti.find((e) => e.chiave === sezione);
  for (const [chiave, { voci, nomi: scritti }] of Object.entries(ancheSe)) {
    const elenco = tutti.find((e) => e.chiave === chiave);
    if (!elenco) continue;
    expect(elenco.voci, chiave).toEqual(voci);
    expect(elenco.nomi, chiave).toEqual(scritti);
  }
  for (const id of ids)
    expect(pagina.nomi[pagina.voci.indexOf(id)], `${sezione}: ${id}`).toBe(riquadri[id]);
  for (const [chiave, attesi] of Object.entries(nomi))
    expect(tutti.find((e) => e.chiave === chiave)?.nomi || []).toEqual(
      expect.arrayContaining(attesi),
    );
  /* Nessun nome di ripiego e nessuna figura davanti a una parola, in nessun
   * elenco della pagina. */
  for (const { chiave, nomi: scritti } of tutti.filter(
    (e) => e.chiave === sezione || e.chiave.startsWith(`${sezione}:`),
  ))
    for (const scritto of scritti) {
      expect(scritto, `${chiave}`).not.toMatch(/^(Riquadro|Box) \d/);
      expect(scritto, `${chiave}`).not.toMatch(/\p{Extended_Pictographic}/u);
    }

  /* In modifica: ogni maniglia si vede e, toccata nel mezzo, e' lei. */
  await page.evaluate(() => window.dmDisposizione.entraInModifica());
  await expect(page.locator("html")).toHaveAttribute("data-dm-modifica", sezione);
  /* Con un riquadro solo non c'e' niente da spostare, e niente maniglia. */
  for (const id of maniglie && pagina.voci.length > 1 ? pagina.voci : [])
    await expect
      .poll(
        () =>
          page.evaluate(
            ([s, id]) => {
              const el = document.querySelector(
                `#page-${s} [data-dm-disp-voce="${CSS.escape(id)}"] > [data-dm-disp-ctrl] .dm-disp-maniglia`,
              );
              if (!el) return "manca";
              el.scrollIntoView({ block: "center" });
              const r = el.getBoundingClientRect();
              if (!r.width || !r.height) return "non si vede";
              const sopra = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              if (sopra && (sopra === el || el.contains(sopra))) return "libera";
              return `coperta da ${sopra?.tagName} ${sopra?.className}`;
            },
            [sezione, id],
          ),
        { message: `${sezione}: la maniglia di ${id}` },
      )
      .toBe("libera");
  await page.locator('[data-dm-disp-azione="annulla"]').click();
  await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /./);
  return pagina;
}

for (const gruppo of GRUPPI)
  test(`${gruppo.nome}: i riquadri hanno id e nomi veri, e la maniglia si prende`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await nellaCasaDemo(page);
    for (const sezione of gruppo.sezioni) await guarda(page, sezione);
  });

/* Spostato, salvato, ricaricato: resta. Un riquadro per gruppo, preso dalla
 * tastiera (le prove della disposizione guardano gia' il mouse e il dito). */
for (const [sezione, gruppo] of [
  ["security", "Sicurezza"],
  ["media", "Musica"],
  ["piscina", "Piscina"],
  ["calendario", "Agenda"],
  ["sport", "Sport"],
  ["rifiuti", "Rifiuti"],
  ["contatori", "Acqua e gas"],
  ["animali", "Animali"],
  ["salute", "Salute"],
])
  test(`${gruppo}: un riquadro spostato e salvato resta dov'e' dopo aver ricaricato`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await nellaCasaDemo(page);
    await apri(page, sezione);
    await ferma(page);
    const prima = (await elenchi(page)).find((e) => e.chiave === sezione).voci;
    expect(prima.length).toBeGreaterThan(1);
    await page.evaluate(() => window.dmDisposizione.entraInModifica());
    /* Una freccia per volta, aspettando che la pagina si sia ridisegnata: se
     * la maniglia presa e' stata appena rifatta, il tasto cade nel vuoto e si
     * ripreme. */
    const dove = async () =>
      (await elenchi(page)).find((e) => e.chiave === sezione).voci.indexOf(prima[0]);
    for (let i = 1; i < prima.length; i += 1)
      await expect(async () => {
        if ((await dove()) < i) {
          await page
            .locator(
              `#page-${sezione} [data-dm-disp-voce="${prima[0]}"] > [data-dm-disp-ctrl] .dm-disp-maniglia`,
            )
            .focus();
          await page.keyboard.press("ArrowDown");
          await page.waitForTimeout(150);
        }
        expect(await dove()).toBe(i);
      }).toPass({ timeout: 15_000, intervals: [200, 400, 800] });
    const atteso = [...prima.slice(1), prima[0]];
    await expect
      .poll(async () => (await elenchi(page)).find((e) => e.chiave === sezione).voci)
      .toEqual(atteso);
    await page.locator('[data-dm-disp-azione="salva"]').click();
    await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /./);
    const scritta = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("cd_disposizione") || "{}"),
    );
    expect(scritta[sezione].ordine.at(-1)).toBe(prima[0]);

    await page.reload();
    await pronta(page);
    await apri(page, sezione);
    await expect
      .poll(async () => (await elenchi(page)).find((e) => e.chiave === sezione)?.voci, {
        timeout: 15_000,
      })
      .toEqual(atteso);
    /* E si vede: i riquadri stanno nella pagina in quest'ordine. */
    const inPagina = await page.evaluate(
      ([s, ids]) =>
        [...document.querySelectorAll(`#page-${s} [data-dm-blocco]`)]
          .filter((el) => el.offsetHeight > 0 && !el.parentElement.closest("[data-dm-blocco]"))
          .map((el) => el.getAttribute("data-dm-blocco"))
          .filter((id) => ids.includes(id)),
      [sezione, atteso],
    );
    expect(inPagina).toEqual(atteso);
  });

/* Il Clima: le carte di un piano si spostano dentro il piano, il titolo del
 * piano resta dov'e', e dopo aver ricaricato l'ordine e' quello salvato. */
test("Clima: una carta spostata nel suo piano resta li' dopo aver ricaricato", async ({ page }) => {
  test.setTimeout(180_000);
  const chiave = "clima:zone/freddo-primo-piano";
  const voci = async () => (await elenchi(page)).find((e) => e.chiave === chiave)?.voci;
  const inPagina = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("#clima-grid-freddo > *")].map((el) =>
        el.matches(".dm-cl-floor")
          ? `piano:${el.textContent.trim()}`
          : [...el.querySelectorAll(".dm-cl-card")].map((c) => c.id).join(","),
      ),
    );
  await nellaCasaDemo(page);
  await apri(page, "clima");
  await ferma(page);
  const prima = await voci();
  expect(prima).toEqual(["#card-climate-camera", "#card-climate-cameretta"]);
  const titoli = (await inPagina()).filter((x) => x.startsWith("piano:"));
  await page.evaluate(() => window.dmDisposizione.entraInModifica());
  await expect(async () => {
    if ((await voci())[0] === prima[0]) {
      /* Una carta di un elenco si prende lei, non una maniglia. */
      await page.locator(`#page-clima [data-dm-disp-voce="${prima[0]}"]`).focus();
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(150);
    }
    expect(await voci()).toEqual([prima[1], prima[0]]);
  }).toPass({ timeout: 15_000, intervals: [200, 400, 800] });
  await page.locator('[data-dm-disp-azione="salva"]').click();
  await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /./);

  await page.reload();
  await pronta(page);
  await apri(page, "clima");
  await expect.poll(voci, { timeout: 15_000 }).toEqual([prima[1], prima[0]]);
  const dopo = await inPagina();
  /* I titoli dei piani sono gli stessi, nello stesso posto; dentro il primo
   * piano la cameretta viene prima della camera. */
  expect(dopo.filter((x) => x.startsWith("piano:"))).toEqual(titoli);
  expect(dopo).toContain("card-climate-cameretta,card-climate-camera");
  expect(dopo).toContain("card-climate-soggiorno");
});

/* L'Irrigazione aveva «Le tue entita'» due volte: una volta sola. */
test("Irrigazione: «Le tue entità» c'e' una volta sola", async ({ page }) => {
  test.setTimeout(120_000);
  await nellaCasaDemo(page);
  await apri(page, "irrigazione");
  await ferma(page);
  await expect(page.locator("#page-irrigazione .dm-mie-ent")).toHaveCount(1);
});
