/* Risposte vere delle fonti dello sport, per scrivere il codice e le prove
 * su dati come sono davvero. Da qui la sessione di lavoro non le raggiunge;
 * GitHub si'. Le risposte vanno in `campioni/`, una per file. */
import { mkdir, writeFile } from "node:fs/promises";

const qui = new URL(".", import.meta.url).pathname;
const ESPN = "https://site.api.espn.com/apis/site/v2/sports";
const ESPN_CLASSIFICHE = "https://site.web.api.espn.com/apis/v2/sports";
const F1 = "https://api.jolpi.ca/ergast/f1";
const MOTO = "https://api.motogp.pulselive.com/motogp/v1";

const DA_SCARICARE = {
  "calcio-serie-a-squadre": `${ESPN}/soccer/ita.1/teams`,
  "calcio-serie-a-partite": `${ESPN}/soccer/ita.1/scoreboard`,
  "calcio-serie-a-classifica": `${ESPN_CLASSIFICHE}/soccer/ita.1/standings`,
  "calcio-inter-calendario": `${ESPN}/soccer/ita.1/teams/110/schedule`,
  "calcio-inter-prossime": `${ESPN}/soccer/ita.1/teams/110/schedule?fixture=true`,
  "calcio-inter": `${ESPN}/soccer/ita.1/teams/110`,
  "calcio-champions-partite": `${ESPN}/soccer/uefa.champions/scoreboard`,
  "calcio-premier-squadre": `${ESPN}/soccer/eng.1/teams`,
  "f1-ultima-gara": `${F1}/current/last/results.json`,
  "f1-ultime-qualifiche": `${F1}/current/last/qualifying.json`,
  "f1-calendario": `${F1}/current.json`,
  "f1-piloti": `${F1}/current/driverStandings.json`,
  "f1-costruttori": `${F1}/current/constructorStandings.json`,
  "f1-sprint": `${F1}/current/last/sprint.json`,
  "moto-stagioni": `${MOTO}/results/seasons`,
  "calcio-inter-tutte": `${ESPN}/soccer/all/teams/110/schedule`,
  "calcio-inter-tutte-prossime": `${ESPN}/soccer/all/teams/110/schedule?fixture=true`,
  "calcio-inter-champions": `${ESPN}/soccer/uefa.champions/teams/110/schedule`,
  "calcio-inter-italiano": `${ESPN}/soccer/ita.1/teams/110/schedule?lang=it&region=it`,
  "calcio-serie-a-partite-italiano": `${ESPN}/soccer/ita.1/scoreboard?lang=it&region=it`,
  "calcio-serie-a-giorno": `${ESPN}/soccer/ita.1/scoreboard?dates=20261025`,
};

async function scarica(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  const testo = await r.text();
  try {
    return { stato: r.status, json: JSON.parse(testo) };
  } catch {
    return { stato: r.status, testo: testo.slice(0, 2000) };
  }
}

await mkdir(`${qui}campioni`, { recursive: true });
const salva = (nome, cosa) =>
  writeFile(`${qui}campioni/${nome}.json`, `${JSON.stringify(cosa, null, 1)}\n`);
for (const [nome, url] of Object.entries(DA_SCARICARE)) {
  const r = await scarica(url);
  await salva(nome, { url, ...r });
  console.log(nome, r.stato);
}

/* MotoGP: stagione di quest'anno, la categoria MotoGP, l'ultimo evento
 * finito, le sue sessioni, la classifica della gara e del campionato. */
const stagioni = (await scarica(`${MOTO}/results/seasons`)).json || [];
const stagione = stagioni.find((s) => s.current) || stagioni[0];
if (stagione) {
  const eventi = await scarica(`${MOTO}/results/events?seasonUuid=${stagione.id}&isFinished=true`);
  await salva("moto-eventi-finiti", eventi);
  const tutti = await scarica(`${MOTO}/results/events?seasonUuid=${stagione.id}`);
  await salva("moto-eventi", tutti);
  const ultimo = (eventi.json || []).filter((e) => !e.test).at(-1);
  if (ultimo) {
    const categorie = await scarica(`${MOTO}/results/categories?eventUuid=${ultimo.id}`);
    await salva("moto-categorie", categorie);
    const motogp =
      (categorie.json || []).find((c) => /motogp/i.test(c.name)) || (categorie.json || [])[0];
    if (motogp) {
      const sessioni = await scarica(
        `${MOTO}/results/sessions?eventUuid=${ultimo.id}&categoryUuid=${motogp.id}`,
      );
      await salva("moto-sessioni", sessioni);
      const gara =
        (sessioni.json || []).find((s) => s.type === "RAC") || (sessioni.json || []).at(-1);
      if (gara) {
        await salva(
          "moto-gara",
          await scarica(`${MOTO}/results/session/${gara.id}/classification?test=false`),
        );
      }
      const spr = (sessioni.json || []).find((s) => s.type === "SPR");
      if (spr)
        await salva(
          "moto-sprint",
          await scarica(`${MOTO}/results/session/${spr.id}/classification?test=false`),
        );
      await salva(
        "moto-classifica",
        await scarica(
          `${MOTO}/results/standings?seasonUuid=${stagione.id}&categoryUuid=${motogp.id}`,
        ),
      );
    }
  }
}
