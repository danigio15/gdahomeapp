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
  "calcio-champions-classifica": `${ESPN_CLASSIFICHE}/soccer/uefa.champions/standings`,
  "calcio-europa-classifica": `${ESPN_CLASSIFICHE}/soccer/uefa.europa/standings`,
  "calcio-conference-classifica": `${ESPN_CLASSIFICHE}/soccer/uefa.europa.conf/standings`,
  "calcio-roma-tutte": `${ESPN}/soccer/all/teams/104/schedule`,
  "calcio-roma-tutte-prossime": `${ESPN}/soccer/all/teams/104/schedule?fixture=true`,
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

/* Dal vivo: cosa danno le fonti mentre una sessione e' in corso (F1 dal
 * sito del cronometraggio e da OpenF1, ESPN, MotoGP). Prima di tutto il
 * resto, perche' la sessione non aspetta. */
async function testo(url) {
  try {
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0", accept: "*/*" } });
    const t = await r.text();
    return { url, stato: r.status, lunghezza: t.length, testo: t.slice(0, 60000) };
  } catch (e) {
    return { url, errore: String(e) };
  }
}
const LT = "https://livetiming.formula1.com/static";
const indice = await testo(`${LT}/2026/Index.json`);
await salva("live-f1-indice", indice);
await salva("live-f1-stato-stream", await testo(`${LT}/StreamingStatus.json`));
try {
  const idx = JSON.parse(indice.testo.replace(/^\uFEFF/, ""));
  const riunione = idx.Meetings?.at(-1);
  const sessione = riunione?.Sessions?.at(-1);
  if (sessione?.Path) {
    for (const f of [
      "SessionInfo.json",
      "SessionStatus.json",
      "TrackStatus.json",
      "LapCount.json",
      "DriverList.json",
      "TimingData.json",
      "TimingAppData.json",
      "TimingStats.json",
      "RaceControlMessages.json",
      "TimingData.jsonStream",
    ]) {
      await salva(`live-f1-${f.replace(/\W/g, "-")}`, await testo(`${LT}/${sessione.Path}${f}`));
    }
  }
} catch (e) {
  console.log("live f1", e);
}
const OPENF1 = "https://api.openf1.org/v1";
for (const [nome, u] of Object.entries({
  sessione: "sessions?session_key=latest",
  intervalli: "intervals?session_key=latest",
  posizioni: "position?session_key=latest",
  giri: "laps?session_key=latest&lap_number>=1",
  piloti: "drivers?session_key=latest",
})) {
  await salva(`live-openf1-${nome}`, await testo(`${OPENF1}/${u}`));
}
await salva("live-espn-f1", await testo(`${ESPN}/racing/f1/scoreboard`));
await salva("live-moto-lite", await testo(`${MOTO}/timing-gateway/livetiming-lite`));
console.log("live fatto");
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
      /* Le qualifiche (Q1 e Q2): toccando la sessione la plancia le mostra. */
      for (const q of (sessioni.json || []).filter((s) => s.type === "Q"))
        await salva(
          `moto-q${q.number}`,
          await scarica(`${MOTO}/results/session/${q.id}/classification?test=false`),
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

/* Il dettaglio di una partita finita: marcatori, cartellini, formazioni,
 * statistiche. L'ultima partita giocata dall'Inter in campionato, in inglese
 * e in italiano. */
const giocate = (
  (await scarica(`${ESPN}/soccer/ita.1/teams/110/schedule`)).json?.events || []
).filter((e) => e.competitions?.[0]?.status?.type?.completed);
const ultima = giocate.at(-1);
if (ultima) {
  await salva("calcio-partita", await scarica(`${ESPN}/soccer/ita.1/summary?event=${ultima.id}`));
  await salva(
    "calcio-partita-italiano",
    await scarica(`${ESPN}/soccer/ita.1/summary?event=${ultima.id}&lang=it&region=it`),
  );
}
/* E una partita in corso o di oggi, se c'e', per vedere il dettaglio dal vivo. */
const oggi = (await scarica(`${ESPN}/soccer/ita.1/scoreboard`)).json?.events || [];
const viva = oggi.find((e) => e.status?.type?.state === "in") || oggi[0];
if (viva)
  await salva(
    "calcio-partita-oggi",
    await scarica(`${ESPN}/soccer/ita.1/summary?event=${viva.id}`),
  );

/* Gli stemmi delle squadre, piccoli come li chiede il ponte (128 px): quelli
 * della Serie A e delle avversarie dell'Inter. Servono alle foto della pagina. */
await mkdir(`${qui}loghi`, { recursive: true });
const ids = new Set();
const squadre = (await scarica(`${ESPN}/soccer/ita.1/teams`)).json;
for (const t of squadre?.sports?.[0]?.leagues?.[0]?.teams || []) ids.add(String(t.team.id));
for (const nome of ["calcio-inter-tutte", "calcio-inter-tutte-prossime"]) {
  const j = (
    await scarica(
      DA_SCARICARE[nome] ||
        `${ESPN}/soccer/all/teams/110/schedule${nome.endsWith("prossime") ? "?fixture=true" : ""}`,
    )
  ).json;
  for (const e of j?.events || [])
    for (const c of e.competitions?.[0]?.competitors || []) ids.add(String(c.team?.id));
}
for (const id of ids) {
  if (!/^\d+$/.test(id)) continue;
  const r = await fetch(
    `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${id}.png&h=128&w=128`,
  );
  if (!r.ok) continue;
  await writeFile(`${qui}loghi/${id}.png`, Buffer.from(await r.arrayBuffer()));
}
console.log("loghi", ids.size);

/* Le qualifiche di un Gran Premio per numero (Austin 2026 e' il 18): il
 * dettaglio che la plancia chiede toccando «Qualifiche». */
await salva("f1-qualifiche-18", await scarica(`${F1}/current/18/qualifying.json`));
await salva("f1-qualifiche-2026-18", await scarica(`${F1}/2026/18/qualifying.json`));

/* L'ultima partita del Napoli (ESPN 114), col dettaglio: statistiche e
 * formazioni. */
const delNapoli = (
  (await scarica(`${ESPN}/soccer/all/teams/114/schedule`)).json?.events || []
).filter((e) => e.competitions?.[0]?.status?.type?.completed);
const napoli = delNapoli.at(-1);
if (napoli) {
  const lega = napoli.league?.slug || napoli.competitions?.[0]?.league?.slug || "ita.1";
  await salva(
    "calcio-napoli-partita",
    await scarica(`${ESPN}/soccer/ita.1/summary?event=${napoli.id}`),
  );
  console.log("napoli", napoli.id, lega);
}

/* I simboli delle scuderie di F1: si provano gli indirizzi possibili e si
 * scrive quali rispondono, e con che tipo. */
await mkdir(`${qui}scuderie`, { recursive: true });
const costruttori =
  (await scarica(`${F1}/current/constructorStandings.json`)).json?.MRData?.StandingsTable
    ?.StandingsLists?.[0]?.ConstructorStandings || [];
const NOMI_F1 = {
  mercedes: "mercedes",
  ferrari: "ferrari",
  mclaren: "mclaren",
  red_bull: "redbullracing",
  rb: "racingbulls",
  alpine: "alpine",
  haas: "haasf1team",
  audi: "audi",
  sauber: "kicksauber",
  williams: "williams",
  aston_martin: "astonmartin",
  cadillac: "cadillac",
};
const prove = [];
for (const c of costruttori) {
  const id = c.Constructor?.constructorId;
  const slug = NOMI_F1[id] || String(id).replace(/_/g, "");
  const candidati = [
    `https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000000/common/f1/2026/${slug}/2026${slug}logowhite.webp`,
    `https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000000/common/f1/2026/${slug}/2026${slug}logo.webp`,
    `https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000000/common/f1/2025/${slug}/2025${slug}logowhite.webp`,
    `https://media.formula1.com/content/dam/fom-website/teams/2025/${slug}-logo.png`,
    `https://media.formula1.com/content/dam/fom-website/teams/2024/${slug}-logo.png.transform/2col/image.png`,
  ];
  for (const u of candidati) {
    let stato = 0;
    let tipo = "";
    let byte = 0;
    try {
      const r = await fetch(u);
      stato = r.status;
      tipo = r.headers.get("content-type") || "";
      if (r.ok) {
        const b = Buffer.from(await r.arrayBuffer());
        byte = b.length;
        const est = tipo.includes("webp") ? "webp" : tipo.includes("svg") ? "svg" : "png";
        await writeFile(`${qui}scuderie/${id}-${candidati.indexOf(u)}.${est}`, b);
      }
    } catch (e) {
      tipo = String(e?.message || e);
    }
    prove.push({ id, slug, u, stato, tipo, byte });
  }
}
await salva("f1-scuderie-loghi", prove);
console.log("scuderie", prove.filter((p) => p.stato === 200).length, "/", prove.length);
