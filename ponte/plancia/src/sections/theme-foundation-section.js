/* Il tema scuro possiede anche il fondo.
 *
 * «Scuro» scuriva le card una per una — regole puntuali su schede, barre e
 * popup — ma le fondamenta del tema, le variabili di `:root` da cui il corpo
 * della pagina prende colore, restavano quelle chiare: `--bg-sculpted` e
 * compagnia non avevano mai avuto una versione notturna. Il risultato e' negli
 * screenshot arrivati piu' volte: card scure appoggiate su una pagina bianca,
 * titoli di sezione grigio chiaro sul bianco. Con il tema su «Auto» bastava
 * un telefono in modalita' scura di sistema per ritrovarsi quella via di
 * mezzo, senza aver toccato niente.
 *
 * La correzione sta dove deve stare: si ridefiniscono LE VARIABILI, una volta,
 * per `html[data-theme="dark"]`. Tutto quello che gia' legge `var(--...)` —
 * il body, le card di vetro, i bordi, i testi — si scurisce da solo, e le
 * regole puntuali che gia' esistevano continuano a fare il loro lavoro sopra
 * una base finalmente coerente. Il tema chiaro non cambia di una virgola:
 * queste righe vivono solo sotto l'attributo del tema scuro. */
import { installStyle } from "./shared.js";

const KEY = "__DASHBOARDMODERN_THEME_FOUNDATION__";
const STYLE_ID = "dm-theme-foundation-style";

export function installThemeFoundationSection() {
  const state = (globalThis[KEY] ||= { installed: false });
  if (state.installed) return false;
  state.installed = true;
  installStyle(STYLE_ID, `
    html[data-theme="dark"]{
      --bg-sculpted:#0b1220;
      --bg-1:#0f172a;
      --card-glass:rgba(20,30,52,.88);
      --card-border:#273652;
      --text:#e6edf7;
      --text-dim:#93a3ba;
      --card-bg:#141e34;
      --surface-2:#182338;
      --surface-3:#1e2b44;
      --shadow-sculpted:0 4px 20px rgba(0,0,0,.45),0 1px 4px rgba(0,0,0,.35);
      --shadow-hover:0 12px 35px rgba(0,0,0,.55),0 2px 8px rgba(0,0,0,.4);
      --shadow-glass:0 8px 30px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.06);
      --shadow-glass-strong:0 14px 40px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.07);
      color-scheme:dark;
    }
    /* #206: le variabili col NOME di Home Assistant, risolte sui token nostri.
     *
     * Decine di regole delle sezioni scrivono background:var(--card-background-color,#fff)
     * o var(--secondary-background-color,#f6f8fb): nomi del tema di HA che in
     * questo documento non esistono, quindi vinceva sempre il ripiego chiaro —
     * e col tema scuro il testo (che invece legge --text, tematizzato) finiva
     * chiaro su bianco: illeggibile. L'alias sta qui, nella fondazione: ogni
     * regola che usa il nome di HA riceve il token di DashboardModern, chiaro
     * col chiaro e scuro con lo scuro, senza toccare le regole una per una. */
    html{
      /* L'ombra «forte» aveva il nome e non la definizione: chi la chiedeva
       * ripiegava sulla sua ombra chiara, che sul fondo scuro non si vede. */
      --shadow-glass-strong:0 12px 34px rgba(15,23,42,.16);
      --card-background-color:var(--card-bg);
      --ha-card-background:var(--card-bg);
      --primary-background-color:var(--bg-sculpted);
      --secondary-background-color:var(--surface-2);
      --divider-color:var(--card-border);
      --secondary-text-color:var(--text-dim);
      --primary-text-color:var(--text);
    }

    /* Il margine laterale della plancia.
     *
     * Il guscio non ne ha mai avuto uno: il corpo della pagina parte a filo di
     * schermo, e tutto quello che ci sta dentro parte con lui. Su un telefono
     * si vede subito da dove: la «P» di PERSONE nasce sul bordo e sembra
     * tagliata, le tessere finiscono contro il vetro, e ogni titolo di sezione
     * comincia dove finisce il mondo. Non e' una scelta, e' una riga che
     * nessuno ha mai scritto.
     *
     * Qui si scrive, una volta sola e per tutte le pagine: il corpo tiene le
     * distanze dai bordi, e con box-sizing border-box gia' dichiarato nel
     * guscio nessuno diventa piu' largo di prima. La barra in basso non si
     * muove — e' fissa, il margine del corpo non la riguarda — e le finestre
     * nemmeno, per lo stesso motivo. Le tacche del telefono si rispettano,
     * dove ci sono. */
    /* La misura sta in un posto solo.
     *
     * La prima volta questa regola l'aveva scritta due volte: qui, e nel foglio
     * del chiosco, che sui telefoni e' sempre acceso e la scriveva col peso
     * massimo, chiedendo la tacca laterale con zero come ripiego. Su un
     * telefono senza tacca quella misura vale zero, e vinceva: il
     * margine c'era, scritto, e non si e' mai visto. Adesso la distanza ha un
     * nome, e chi ha bisogno di ripeterla ripete il nome. */
    :root{--dm-gutter:14px}
    @media(min-width:769px){:root{--dm-gutter:22px}}
    body{
      padding-left:max(var(--dm-gutter),env(safe-area-inset-left,0px));
      padding-right:max(var(--dm-gutter),env(safe-area-inset-right,0px));
    }

    /* Il nome della plancia deve leggersi anche di notte.
     *
     * Il titolo in alto a sinistra e' un testo riempito da un gradiente, e il
     * gradiente partiva da un blu notte scritto a mano. In tema chiaro si
     * legge benissimo; in tema scuro quella prima parola finisce su un fondo
     * dello stesso colore e sparisce — restava leggibile solo "Home". Tutto il
     * resto dell'intestazione, sottotitolo e pastiglia della connessione,
     * seguiva gia' il tema: era solo quel capo del gradiente a non farlo. E'
     * una fondamenta come le altre qui sopra: un colore che deve seguire il
     * tema, non la rifinitura di una sezione. */
    .brand-text h1{
      background:linear-gradient(135deg,var(--text,#0f172a),var(--green,#16a34a))!important;
      -webkit-background-clip:text!important;background-clip:text!important;
      -webkit-text-fill-color:transparent!important}

    /* Le due macchie dietro la plancia: sfumate, non sfocate.
     *
     * «La torre 3d va a scatti quando si clicca e non apre subito il popup
     * storico.» Non era la torre, e non era il clic: **la plancia intera**
     * andava a quindici fotogrammi al secondo, ferma, su ogni pagina, senza
     * che nessuno la toccasse. Il clic si notava soltanto perche' e' il
     * momento in cui uno si aspetta una risposta.
     *
     * A mangiarsi tutto sono queste due macchie. Sono larghe sessanta e
     * cinquanta volte un centesimo dello schermo, e portano un
     * «filter: blur(100px)»: una sfocatura gaussiana grande cento pixel su
     * mezzo schermo, che il browser rifa' a ogni fotogramma per sempre.
     *
     * ─── Le cure che non curano ───────────────────────────────────────────
     *
     * Qui prima c'era «will-change: transform» — promuovile a livello
     * composito e il browser non le rasterizza piu' — e la pausa con
     * «prefers-reduced-motion». Misurate, **non cambiano niente**: 15 al
     * secondo prima, 15 dopo. Anche fermando del tutto l'animazione resta a
     * 17: non e' il movimento che costa, e' la sfocatura, che si rifa'
     * comunque ogni volta che qualcosa sopra si ridisegna — e qualcosa sopra
     * si ridisegna sempre, fosse solo un LED che lampeggia.
     *
     * ─── Quella che cura ──────────────────────────────────────────────────
     *
     * Una sfocatura di un cerchio pieno **e' gia'** una sfumatura radiale: si
     * puo' scrivere invece di calcolarla. Gli stop qui sotto non sono a
     * occhio, sono la curva dell'errore di una gaussiana con sigma cento sul
     * raggio vero delle macchie, e messe accanto alla sfocatura non si
     * distinguono. Il raggio della sfumatura pero' si ferma al bordo della
     * scatola mentre la sfocatura sbordava, quindi le scatole vanno il doppio:
     * e' quello che fa lo «scale(2)» dentro l'animazione qui sotto.
     *
     * Misurato sulla plancia servita, con il freno della CPU a sei:
     * da 15 a 60 fotogrammi al secondo, e il peggiore da 167 ms a 17.
     *
     * Niente «will-change»: senza la sfocatura non c'e' piu' niente di caro da
     * tenere da parte, e una scatola larga il doppio promossa a livello sono
     * decine di megabyte di memoria su un tablet, per niente. */
    .animated-mesh-bg::before,.animated-mesh-bg::after{
      filter:none!important;
      background:radial-gradient(closest-side,
        rgb(var(--dm-macchia) / 1) 0%,
        rgb(var(--dm-macchia) / .98) 17%,
        rgb(var(--dm-macchia) / .84) 34%,
        rgb(var(--dm-macchia) / .5) 50%,
        rgb(var(--dm-macchia) / .16) 66%,
        rgb(var(--dm-macchia) / .02) 83%,
        rgb(var(--dm-macchia) / 0) 100%)!important}
    .animated-mesh-bg::before{--dm-macchia:220 252 231}
    .animated-mesh-bg::after{--dm-macchia:224 242 254}
    html[data-theme="dark"] .animated-mesh-bg::before{--dm-macchia:14 42 28}
    html[data-theme="dark"] .animated-mesh-bg::after{--dm-macchia:11 39 64}
    /* Lo stesso viaggio di prima, col doppio di scatola: la sfumatura finisce
     * dove finisce la scatola, la sfocatura invece sbordava. */
    @keyframes floatBlob{
      0%{transform:translate(0,0) scale(2)}
      100%{transform:translate(8vw,6vh) scale(2.3)}
    }
    @media (prefers-reduced-motion:reduce){
      .animated-mesh-bg::before,.animated-mesh-bg::after{animation-play-state:paused!important}
    }
  `);
  return true;
}
