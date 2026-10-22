/* I fornitori di energia, collegati dentro GdAHome.
 *
 * «Userei le integrazioni in essere su Home Assistant tramite HACS,
 * inglobandole nella nostra.» Le integrazioni di E.ON Energia Italia e di
 * ENGIE Italia (tutte e due MIT) vivono dentro l'integrazione GdAHome
 * (`custom_components/dashboardmodern/fornitori/`): qui c'e' la scheda che le
 * collega, nelle impostazioni dell'Energia. I sensori che nascono sono quelli
 * che la linguetta Bollette sa gia' leggere.
 *
 * Il dialogo e' col ponte di GdAHome (`ponte/src/fornitori.js`):
 * `dashboardmodern/fornitori/stato` per vedere, `…/collega`, `…/codice`,
 * `…/incolla`, `…/aggiorna`, `…/scollega` per fare — tutti solo per chi
 * amministra la casa. Le password non restano nella plancia: partono, e il
 * campo si svuota.
 */
import {
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  quandoSiCambiaPagina,
  root,
  senzaCadere,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_FORNITORI__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  stato: null,
  alle: 0,
  inVolo: false,
  firma: "",
  /* Il passo in corso: `{ fornitore, passo: "scegli"|"credenziali"|"codice"
   * |"incolla", link, errore }`. */
  passo: null,
});

/* I fornitori come si mostrano: il colore e l'iniziale, non i marchi. */
const ASPETTO = Object.freeze({
  eon: { colore: "#e2001a", iniziale: "EO" },
  engie: { colore: "#00aaff", iniziale: "EN" },
  enel: { colore: "#008c5a", iniziale: "EL" },
  octopus: { colore: "#5840ff", iniziale: "OC" },
});

function segno(id) {
  const a = ASPETTO[id] || { colore: "#64748b", iniziale: "?" };
  return `<span class="dm-forn-segno" style="--forn:${a.colore}" aria-hidden="true">${esc(a.iniziale)}</span>`;
}

/* ── la domanda all'integrazione ──────────────────────────────────────── */

function chiediLoStato(forza = false) {
  const ora = Date.now();
  if (state.inVolo || (!forza && ora - state.alle < 60_000)) return;
  state.inVolo = true;
  state.alle = ora;
  chiediAHomeAssistant({ type: "dashboardmodern/fornitori/stato" }, 10_000)
    .then((detto) => {
      state.stato = detto && typeof detto === "object" ? detto : null;
      schedule();
    })
    .catch((errore) => {
      if (/socket/i.test(String(errore?.message || errore))) state.alle = 0;
    })
    .finally(() => {
      state.inVolo = false;
    });
}

function perche(codice) {
  if (codice === "credenziali")
    return t("Email o password non sono giuste.", "Email or password is wrong.");
  if (codice === "codice")
    return t("Il codice non è giusto, o è scaduto.", "The code is wrong, or expired.");
  if (codice === "captcha")
    return t(
      "Il fornitore chiede di dimostrare di non essere un robot: serve l'accesso dal browser.",
      "The supplier wants to check you are not a robot: you need to sign in from the browser.",
    );
  if (codice === "link")
    return t(
      "L'indirizzo incollato non è quello giusto: copia quello della pagina dopo l'accesso.",
      "The pasted address is not the right one: copy the one of the page after signing in.",
    );
  if (codice === "scaduto")
    return t(
      "È passato troppo tempo: ricomincia da capo.",
      "Too much time has passed: start over.",
    );
  if (/admin|amministra|forbidden|unauthorized/i.test(codice))
    return t("Serve un utente amministratore.", "An administrator is needed.");
  return t(
    "Il fornitore non risponde. Riprova fra poco.",
    "The supplier does not answer. Try again shortly.",
  );
}

function quando(alle) {
  if (!alle) return "";
  const minuti = Math.round((Date.now() - alle) / 60_000);
  if (minuti < 2) return t("adesso", "just now");
  if (minuti < 90) return `${minuti} ${t("minuti fa", "minutes ago")}`;
  return `${Math.round(minuti / 60)} ${t("ore fa", "hours ago")}`;
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function rigaCollegato(c) {
  const daRifare = c.stato === "da-ricollegare";
  return `<div class="dm-forn-riga" data-stato="${esc(c.stato || "ok")}">
      ${segno(c.fornitore)}
      <span class="dm-forn-testo">
        <b>${esc(c.nome)}</b>
        <small>${esc(
          [
            c.pod ? `POD ${c.pod}` : "",
            daRifare
              ? t("da ricollegare", "needs reconnecting")
              : `${t("aggiornato", "updated")} ${quando(c.aggiornato)}`,
          ]
            .filter(Boolean)
            .join(" · "),
        )}</small>
      </span>
      ${
        daRifare
          ? `<button type="button" class="dm-forn-tasto" data-dm-forn-ricollega="${esc(c.fornitore)}">${esc(t("Ricollega", "Reconnect"))}</button>`
          : `<button type="button" class="dm-forn-tasto dm-forn-tenue" data-dm-forn-aggiorna="${esc(c.id)}" aria-label="${esc(t("Aggiorna", "Refresh"))}">🔄</button>`
      }
      <button type="button" class="dm-forn-tasto dm-forn-tenue" data-dm-forn-scollega="${esc(c.id)}">${esc(t("Scollega", "Disconnect"))}</button>
    </div>`;
}

/* Cosa porta il fornitore: una parola del ponte, tradotta qui. */
function cosaPorta(cosa) {
  if (cosa === "luce") return t("Luce · bollette e consumi", "Electricity · bills and consumption");
  if (cosa === "luce-gas")
    return t("Luce e gas · bollette e consumi", "Electricity and gas · bills and consumption");
  return "";
}

function sceltaFornitori(disponibili) {
  return `<div class="dm-forn-scelta">${disponibili
    .map((f) => {
      const pronto = f.pronto !== false;
      return `<button type="button" class="dm-forn-scheda"${pronto ? ` data-dm-forn-scegli="${esc(f.id)}"` : " disabled"}>
          ${segno(f.id)}
          <span><b>${esc(f.nome)}</b><small>${esc(
            pronto
              ? cosaPorta(f.cosa)
              : f.perche === "nessuna-integrazione"
                ? t("Nessuna integrazione esistente", "No integration exists yet")
                : t("Presto", "Soon"),
          )}</small></span>
        </button>`;
    })
    .join("")}</div>`;
}

/* La testa di ogni passo: da dove si torna, e di chi si parla.
 *
 * «Dopo aver cliccato su un fornitore non mi fa tornare indietro.» Scelto
 * E.ON, la scheda diventava il modulo e basta: l'unica strada per l'elenco
 * era «Annulla», in fondo, sotto la tastiera. Il ritorno sta anche in cima,
 * dove lo si cerca, e fa la stessa cosa. */
function testaDelPasso(f) {
  return `<button type="button" class="dm-forn-indietro" data-dm-forn-annulla>← ${esc(t("Fornitori", "Suppliers"))}</button>
      <div class="dm-forn-testa">${segno(f.id)}<b>${esc(f.nome)}</b></div>`;
}

function passoCredenziali(f, errore) {
  return `<div class="dm-forn-passo">
      ${testaDelPasso(f)}
      <p class="ed-hint">${esc(
        t(
          "Le credenziali dell'area clienti. Passano da GdAHome, in casa, solo per entrare: la password non si salva, si tengono solo i gettoni d'accesso del fornitore.",
          "Your customer-area credentials. They go through GdAHome, at home, only to sign in: the password is not saved, only the supplier's access tokens are kept.",
        ),
      )}</p>
      <label class="dm-forn-campo"><span>Email</span><input class="ed-input" type="email" autocomplete="off" data-dm-forn-email></label>
      <label class="dm-forn-campo"><span>Password</span><input class="ed-input" type="password" autocomplete="new-password" data-dm-forn-password></label>
      ${errore ? `<small class="dm-forn-errore">${esc(perche(errore))}</small>` : ""}
      <div class="dm-forn-tasti">
        <button type="button" class="dm-forn-tasto dm-forn-pieno" data-dm-forn-entra>${esc(t("Collega", "Connect"))}</button>
        <button type="button" class="dm-forn-tasto dm-forn-tenue" data-dm-forn-annulla>${esc(t("Annulla", "Cancel"))}</button>
      </div>
    </div>`;
}

function passoCodice(f, errore) {
  return `<div class="dm-forn-passo">
      ${testaDelPasso(f)}
      <p class="ed-hint">${esc(
        t(
          "Il fornitore ha mandato un codice per SMS al tuo telefono. Scrivilo qui.",
          "The supplier sent a code by text message to your phone. Type it here.",
        ),
      )}</p>
      <label class="dm-forn-campo"><span>${esc(t("Codice SMS", "SMS code"))}</span><input class="ed-input dm-forn-codice" inputmode="numeric" autocomplete="one-time-code" maxlength="8" data-dm-forn-codice></label>
      ${errore ? `<small class="dm-forn-errore">${esc(perche(errore))}</small>` : ""}
      <div class="dm-forn-tasti">
        <button type="button" class="dm-forn-tasto dm-forn-pieno" data-dm-forn-conferma>${esc(t("Conferma", "Confirm"))}</button>
        <button type="button" class="dm-forn-tasto dm-forn-tenue" data-dm-forn-annulla>${esc(t("Annulla", "Cancel"))}</button>
      </div>
    </div>`;
}

/* L'accesso dal browser: si apre il sito del fornitore, si entra, e si
 * incolla l'indirizzo dove si e' arrivati. ENGIE lo fa sempre cosi', E.ON
 * quando chiede di dimostrare di non essere un robot. */
function passoIncolla(f, link, errore) {
  return `<div class="dm-forn-passo">
      ${testaDelPasso(f)}
      <ol class="dm-forn-istruzioni">
        <li>${esc(t("Apri l'accesso del fornitore ed entra con le tue credenziali.", "Open the supplier's sign-in and log in with your credentials."))}
          <a class="dm-forn-link" href="${esc(link || "#")}" target="_blank" rel="noopener noreferrer">${esc(t("Apri l'accesso", "Open sign-in"))} ↗</a></li>
        ${
          f.id === "eon"
            ? `<li>${esc(t("Dopo l'accesso il browser prova ad aprire l'app di E.ON e non ci riesce: apri gli strumenti per sviluppatori (F12), scheda Console, e copia la riga che contiene «code=».", "After signing in the browser tries to open the E.ON app and fails: open the developer tools (F12), Console tab, and copy the line that contains “code=”."))}</li>`
            : `<li>${esc(t("Dopo l'accesso la pagina resta bianca o dà errore: è normale.", "After signing in the page stays blank or shows an error: that is normal."))}</li>
        <li>${esc(t("Copia l'indirizzo dalla barra del browser e incollalo qui.", "Copy the address from the browser bar and paste it here."))}</li>`
        }
      </ol>
      <p class="ed-hint">${esc(t("Meglio dal computer: sul telefono potrebbe aprirsi l'app del fornitore.", "Better from a computer: on a phone the supplier's app may open."))}</p>
      <label class="dm-forn-campo"><span>${esc(t("Indirizzo della pagina", "Page address"))}</span><input class="ed-input" type="password" autocomplete="off" spellcheck="false" placeholder="https://…" data-dm-forn-incolla></label>
      ${errore ? `<small class="dm-forn-errore">${esc(perche(errore))}</small>` : ""}
      <div class="dm-forn-tasti">
        <button type="button" class="dm-forn-tasto dm-forn-pieno" data-dm-forn-incolla-ok>${esc(t("Collega", "Connect"))}</button>
        <button type="button" class="dm-forn-tasto dm-forn-tenue" data-dm-forn-annulla>${esc(t("Annulla", "Cancel"))}</button>
      </div>
    </div>`;
}

export function schedaDeiFornitori(stato, passo = null) {
  const collegati = Array.isArray(stato?.collegati) ? stato.collegati : [];
  const disponibili = Array.isArray(stato?.disponibili) ? stato.disponibili : [];
  const f = disponibili.find((x) => x.id === passo?.fornitore) || null;
  let corpo;
  if (f && passo.passo === "credenziali") corpo = passoCredenziali(f, passo.errore);
  else if (f && passo.passo === "codice") corpo = passoCodice(f, passo.errore);
  else if (f && passo.passo === "incolla") corpo = passoIncolla(f, passo.link, passo.errore);
  else
    corpo = `${collegati.length ? `<div class="dm-forn-collegati">${collegati.map(rigaCollegato).join("")}</div>` : ""}
      <div class="dm-forn-sotto">${esc(collegati.length ? t("Aggiungi un fornitore", "Add a supplier") : t("Scegli il tuo fornitore", "Pick your supplier"))}</div>
      ${sceltaFornitori(disponibili)}`;
  return `<div class="ed-sec-title">🔌 ${esc(t("Fornitori di energia", "Energy suppliers"))}</div>
    <div class="ed-hint">${esc(
      t(
        "Bollette, consumi e contratto arrivano dal fornitore e finiscono nella linguetta Bollette.",
        "Bills, consumption and contract come from the supplier and go to the Bills tab.",
      ),
    )}</div>
    ${corpo}`;
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

function laScheda() {
  return doc?.getElementById?.("dm-energia-fornitori") || null;
}

function comanda(tipo, dati, tasto, dopo) {
  if (tasto) {
    tasto.disabled = true;
    tasto.dataset.parola = tasto.textContent;
    tasto.textContent = t("Un momento…", "One moment…");
  }
  return chiediAHomeAssistant({ type: tipo, ...dati }, 90_000)
    .then((detto) => dopo(detto || {}))
    .catch((no) => {
      if (tasto) {
        tasto.disabled = false;
        tasto.textContent = tasto.dataset.parola || tasto.textContent;
      }
      const codice = String(no?.code || no?.message || no || "");
      if (state.passo) state.passo = { ...state.passo, errore: codice };
      else root.edToast?.(perche(codice));
      schedule();
    });
}

/* Dopo un passo l'integrazione dice com'e' andata: collegato, serve il
 * codice, o serve l'accesso dal browser (col suo link). */
function dopoIlPasso(detto) {
  if (detto.serve === "codice") state.passo = { ...state.passo, passo: "codice", errore: "" };
  else if (detto.serve === "incolla")
    state.passo = {
      ...state.passo,
      passo: "incolla",
      link: detto.link || "",
      errore: detto.perche || "",
    };
  else {
    state.passo = null;
    if (detto.stato) state.stato = detto.stato;
    root.edToast?.(t("Fornitore collegato", "Supplier connected"));
  }
  schedule();
}

function clic(event) {
  const scheda = laScheda();
  const qui = (sel) => event.target.closest?.(sel);
  const scegli = qui("[data-dm-forn-scegli]") || qui("[data-dm-forn-ricollega]");
  if (scegli) {
    event.preventDefault();
    const id = scegli.dataset.dmFornScegli || scegli.dataset.dmFornRicollega;
    const f = (state.stato?.disponibili || []).find((x) => x.id === id);
    if (!f) return;
    if (f.modo === "link")
      comanda("dashboardmodern/fornitori/inizia", { fornitore: id }, scegli, (detto) => {
        state.passo = { fornitore: id, passo: "incolla", link: detto.link || "", errore: "" };
        schedule();
      });
    else {
      state.passo = { fornitore: id, passo: "credenziali", errore: "" };
      schedule();
    }
    return;
  }
  if (qui("[data-dm-forn-annulla]")) {
    event.preventDefault();
    if (state.passo)
      chiediAHomeAssistant({ type: "dashboardmodern/fornitori/annulla" }).catch(() => {});
    state.passo = null;
    schedule();
    return;
  }
  const entra = qui("[data-dm-forn-entra]");
  if (entra) {
    event.preventDefault();
    const email = clean(scheda.querySelector("[data-dm-forn-email]")?.value);
    const campo = scheda.querySelector("[data-dm-forn-password]");
    const password = campo?.value || "";
    if (campo) campo.value = "";
    comanda(
      "dashboardmodern/fornitori/collega",
      { fornitore: state.passo.fornitore, email, password },
      entra,
      dopoIlPasso,
    );
    return;
  }
  const conferma = qui("[data-dm-forn-conferma]");
  if (conferma) {
    event.preventDefault();
    const codice = clean(scheda.querySelector("[data-dm-forn-codice]")?.value);
    comanda(
      "dashboardmodern/fornitori/codice",
      { fornitore: state.passo.fornitore, codice },
      conferma,
      dopoIlPasso,
    );
    return;
  }
  const incolla = qui("[data-dm-forn-incolla-ok]");
  if (incolla) {
    event.preventDefault();
    const campo = scheda.querySelector("[data-dm-forn-incolla]");
    const indirizzo = clean(campo?.value);
    if (campo) campo.value = "";
    comanda(
      "dashboardmodern/fornitori/incolla",
      { fornitore: state.passo.fornitore, indirizzo },
      incolla,
      dopoIlPasso,
    );
    return;
  }
  const aggiorna = qui("[data-dm-forn-aggiorna]");
  if (aggiorna) {
    event.preventDefault();
    comanda(
      "dashboardmodern/fornitori/aggiorna",
      { collegamento: aggiorna.dataset.dmFornAggiorna },
      aggiorna,
      (detto) => {
        if (detto.stato) state.stato = detto.stato;
        schedule();
      },
    );
    return;
  }
  const scollega = qui("[data-dm-forn-scollega]");
  if (scollega) {
    event.preventDefault();
    const sicuro = root.confirm?.(
      t(
        "Scollegare il fornitore? I suoi sensori spariscono e i gettoni d'accesso si cancellano.",
        "Disconnect the supplier? Its sensors disappear and the access tokens are deleted.",
      ),
    );
    if (!sicuro) return;
    comanda(
      "dashboardmodern/fornitori/scollega",
      { collegamento: scollega.dataset.dmFornScollega },
      scollega,
      (detto) => {
        if (detto.stato) state.stato = detto.stato;
        schedule();
      },
    );
  }
}

/* ── il montaggio ─────────────────────────────────────────────────────── */

function ensureScheda() {
  const editor = doc?.querySelector?.(
    '#ed-body[data-editor="energy"],#editor-modal [data-editor="energy"]',
  );
  const impostazioni = editor?.querySelector?.('[data-energy-panel="settings"]');
  if (!impostazioni) return;
  chiediLoStato();
  if (!state.stato) return;
  let scheda = laScheda();
  if (!scheda) {
    scheda = doc.createElement("div");
    scheda.id = "dm-energia-fornitori";
    scheda.className = "ed-form dm-forn";
    scheda.addEventListener("click", clic);
    /* In cima alle impostazioni: e' la prima cosa da fare per le bollette. */
    impostazioni.prepend(scheda);
  }
  const markup = schedaDeiFornitori(state.stato, state.passo);
  if (state.firma === markup && scheda.firstElementChild) return;
  state.firma = markup;
  scheda.innerHTML = markup;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      ensureScheda();
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] fornitori", errore);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

function installStyles() {
  installStyle(
    "dm-fornitori-style",
    `
    .dm-forn{display:grid;gap:10px}
    .dm-forn-segno{display:inline-grid;place-items:center;flex:0 0 auto;width:38px;height:38px;border-radius:12px;
      background:var(--forn);color:#fff;font-weight:900;font-size:14px;letter-spacing:.02em;box-shadow:inset 0 -2px 0 rgba(0,0,0,.12)}
    .dm-forn-collegati{display:grid;gap:8px}
    .dm-forn-riga{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:16px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff)}
    .dm-forn-riga[data-stato="da-ricollegare"]{border-color:color-mix(in srgb,#f59e0b 55%,var(--card-border,#e2e8f0))}
    .dm-forn-testo{display:grid;gap:2px;min-width:0;flex:1 1 auto}
    .dm-forn-testo b{font-size:14px;font-weight:850}
    .dm-forn-testo small{font-size:12px;font-weight:700;color:var(--text-dim,#64748b);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-forn-riga[data-stato="da-ricollegare"] small{color:#b45309}
    .dm-forn-tasto{flex:0 0 auto;padding:8px 12px;border-radius:12px;border:1px solid var(--card-border,#e2e8f0);
      background:var(--card-bg,#fff);color:var(--text,#0f172a);font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
    .dm-forn-tenue{color:var(--text-dim,#64748b)}
    /* Il tasto che manda: pieno e nostro, non quello dei «Salva» dell'editor,
       che e' scritto per stare in fondo a un modulo e altri fogli lo
       ritoccano. */
    .dm-forn-pieno{border:0;background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:10px 18px;font-size:13.5px}
    .dm-forn-pieno:disabled{opacity:.6;cursor:default}
    .dm-forn-indietro{justify-self:start;padding:4px 2px;border:0;background:none;color:var(--accent,#0284c7);
      font:inherit;font-size:13px;font-weight:850;cursor:pointer}
    .dm-forn-sotto{margin-top:4px;font-size:11px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    .dm-forn-scelta{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
    .dm-forn-scheda{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;text-align:left;cursor:pointer;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);color:var(--text,#0f172a);font:inherit}
    .dm-forn-scheda span{display:grid;gap:1px;min-width:0}
    .dm-forn-scheda b{font-size:13.5px;font-weight:850}
    .dm-forn-scheda small{font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b)}
    .dm-forn-scheda:disabled{cursor:default;opacity:.55}
    .dm-forn-scheda:not(:disabled):hover{border-color:var(--accent,#0ea5e9)}
    .dm-forn-passo{display:grid;gap:10px;padding:14px;border-radius:18px;border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff)}
    .dm-forn-testa{display:flex;align-items:center;gap:10px;font-size:15px}
    .dm-forn-campo{display:grid;gap:4px}
    .dm-forn-campo>span{font-size:12px;font-weight:800;color:var(--text-dim,#64748b)}
    .dm-forn-codice{font-size:22px!important;letter-spacing:.3em;text-align:center;max-width:220px}
    .dm-forn-errore{font-size:12.5px;font-weight:800;color:#b45309}
    .dm-forn-tasti{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .dm-forn-istruzioni{margin:0;padding-left:20px;display:grid;gap:8px;font-size:13px;font-weight:650}
    .dm-forn-link{display:inline-block;margin-left:6px;font-weight:850;color:var(--accent,#0284c7)}
    `,
  );
}

export function installIFornitoriDiEnergia() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  onEditorRedraw("__dmFornitoriSection", schedule);
  for (const evento of ["dashboardmodern:editor-rendered", "dashboardmodern:legacy-ready"])
    root.addEventListener?.(evento, schedule);
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

senzaCadere(installIFornitoriDiEnergia);
