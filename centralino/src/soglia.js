/* La soglia: cosa trova chi apre l'indirizzo nudo del centralino.
 *
 * Fino a ieri trovava questo — `{"errore":"qui non c'e' niente"}` — ed era
 * vero: qui non c'e' niente da aprire, il centralino gira buste fra un
 * telefono e la sua casa. Ma a chi arriva non serve sapere cosa **non** c'e':
 * serve sapere dove andare. L'indirizzo del tramite uno se lo mette fra i
 * segnalibri, lo detta, lo incolla senza il pezzo dopo la barra — e quella
 * riga lo lasciava li' a credere che fosse rotto.
 *
 * Adesso trova una porta: dice cos'e' questa macchina, e manda dove si va
 * davvero.
 *
 * **Gli indirizzi non stanno scritti qui.** Questo centralino se lo accende
 * anche chi vuole il proprio, e il suo non si chiama gdahome: i due nomi
 * arrivano da fuori — `NOME_DEL_SITO` e `NOME_DELL_APP`, gli stessi di
 * `accendi.sh` — e quello che non c'e' non viene inventato: la riga non
 * compare, e basta.
 *
 * **Niente viene da fuori.** Nessun carattere scaricato, nessuna libreria,
 * nessun contatore: e' la stessa promessa delle pagine del sito, e c'e' una
 * prova che la tiene.
 */

/* Un nome di macchina, e nient'altro: questi due finiscono dentro un `href`,
 * e arrivano da un file che scrive root — ma un indirizzo che non e' un
 * indirizzo si butta qui, non si scopre nel browser di qualcun altro. */
const NOME_BUONO = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export function nomePulito(detto) {
  const nome = String(detto ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");
  return NOME_BUONO.test(nome) ? nome.toLowerCase() : "";
}

const STILE = `
  :root{color-scheme:light dark;
    --fondo:#f6f7f9;--carta:#fff;--inchiostro:#101317;--tenue:#5b6471;
    --filo:#e3e6ea;--segno:#1f6feb}
  @media (prefers-color-scheme:dark){:root{
    --fondo:#0d1014;--carta:#161a20;--inchiostro:#eef1f5;--tenue:#9aa4b2;
    --filo:#242a32;--segno:#6aa9ff}}
  *{box-sizing:border-box}
  body{margin:0;padding:32px 20px;background:var(--fondo);color:var(--inchiostro);
    font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    display:flex;justify-content:center}
  main{width:100%;max-width:34rem;background:var(--carta);border:1px solid var(--filo);
    border-radius:18px;padding:28px 24px 22px}
  h1{margin:0;font-size:1.45rem;letter-spacing:-.01em}
  .sotto{margin:2px 0 18px;color:var(--tenue);font-size:.86rem;
    text-transform:uppercase;letter-spacing:.08em}
  p{margin:0 0 14px}
  .tenue{color:var(--tenue);font-size:.94rem}
  .tasto{display:inline-block;margin:6px 0 18px;padding:12px 20px;border-radius:999px;
    background:var(--segno);color:#fff;font-weight:700;text-decoration:none}
  ul{margin:0;padding:0;list-style:none;border-top:1px solid var(--filo)}
  li{padding:11px 0;border-bottom:1px solid var(--filo);display:flex;
    flex-wrap:wrap;gap:4px 12px;justify-content:space-between;align-items:baseline}
  li span{color:var(--tenue);font-size:.94rem}
  a{color:var(--segno)}
  code{font-size:.92em}
`;

/** La pagina della soglia. Le due righe che non si sanno non si scrivono. */
export function laSoglia({ sito = "", app = "" } = {}) {
  const ilSito = nomePulito(sito);
  const lApp = nomePulito(app);
  const righe = [];
  if (ilSito) righe.push(["Il sito", `https://${ilSito}`, ilSito]);
  if (lApp) righe.push(["L'app dal browser", `https://${lApp}`, lApp]);
  righe.push(["La console dell'assistenza", "/console/", "/console/"]);
  righe.push(["Se stai controllando che sia vivo", "/salute", "/salute"]);

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Il centralino di gdahome</title>
<meta name="robots" content="noindex" />
<style>${STILE}</style>
</head>
<body>
<main>
  <h1>gdahome</h1>
  <p class="sotto">Il centralino</p>
  <p>
    Qui non c'è niente da aprire, ed è come deve essere: questa macchina fa
    incontrare un telefono e la sua casa, e di quello che si dicono non capisce
    niente.
  </p>
  ${lApp ? `<p><a class="tasto" href="https://${lApp}">Apri gdahome</a></p>` : ""}
  <ul>
    ${righe
      .map(
        ([cosa, dove, come]) =>
          `<li><span>${cosa}</span><a href="${dove}"><code>${come}</code></a></li>`,
      )
      .join("\n    ")}
  </ul>
</main>
</body>
</html>
`;
}
