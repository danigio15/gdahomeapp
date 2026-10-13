/* L'accompagnatore: quello che la plancia ha bisogno da Home Assistant, fatto
 * da dentro il riquadro invece che da una tessera nostra.
 *
 * **Perche' esiste.** La plancia dentro le «Plance» di Home Assistant la
 * apriva una tessera nostra (`ponte/carta/plancia.js`), e una tessera nostra
 * vuol dire una **risorsa di Lovelace**: un file che il frontend di Home
 * Assistant carica una volta sola, quando la pagina parte. Una pagina gia'
 * aperta — e nell'app sul telefono restano aperte per giorni — una risorsa
 * dichiarata dopo non la vede, e allora nella Plancia finiva il foglietto
 * «Manca un passaggio solo… ricarica questa pagina». Sul telefono non si sa
 * come si fa, e non si doveva chiedere.
 *
 * Adesso la Plancia ha dentro solo tessere **di Home Assistant**: la tessera
 * «pagina web» (`iframe`), a pagina intera, che apre `/local/gdahome/apri.html`
 * — una pagina servita da Home Assistant stesso, quindi sullo **stesso
 * indirizzo** del suo frontend. Da li' dentro la pagina arriva a `hass` di chi
 * guarda (`parent.document.querySelector("home-assistant").hass`) e fa quello
 * che faceva la tessera: chiede la sessione dell'ingress, mette il biscotto,
 * toglie la barra della dashboard, e poi **si sposta lei** sulla plancia
 * servita dall'add-on. Una configurazione di Plancia cambiata Home Assistant la
 * applica da se', senza ricaricare niente: aggiornamenti e prime installazioni
 * non chiedono niente a nessuno.
 *
 * **Due posti, un file.** Questo file serve in due momenti:
 *
 *  1. dentro `apri.html`, prima di andare alla plancia: trovare `hass`,
 *     chiedere la sessione, togliere la barra;
 *  2. dentro la **pagina della plancia** servita dall'add-on, che il ponte ci
 *     mette in testa (`ponte/src/premesse.js`): li' resta a tenere viva la
 *     sessione — che il Supervisor fa scadere dopo un quarto d'ora — e a
 *     rimettere la barra quando si entra in modifica o quando si va via.
 *
 * Il ponte lo copia dentro `apri.html` quando la scrive nella `www`, e lo
 * cuce in testa alla pagina della plancia quando la serve: e' scritto una
 * volta, e non si scollano.
 *
 * **Niente privilegi nuovi.** Le chiamate sono le stesse tre che faceva la
 * tessera e che fa il frontend di Home Assistant quando apri la scheda di un
 * add-on: `supervisor/api` con `/addons/<slug>/info`, `/ingress/session` e
 * `/ingress/validate_session`, fatte con la connessione di **chi guarda**.
 * Home Assistant le lascia fare anche a chi non amministra, e solo quelle. Il
 * cancello vero resta nell'add-on, che guarda chi bussa (`X-Remote-User-Id`,
 * che arriva dall'ingress e non dalla pagina).
 *
 * **Scritto alla vecchia**: niente `async`, niente `?.`, niente classi. Lo
 * eseguono anche i telefoni e i tablet di qualche anno fa, e un errore di
 * sintassi qui vorrebbe dire nessuna plancia, da nessuna parte. E' un copione
 * classico e non un modulo: va cucito dentro uno script qualunque.
 */
(function (finestra) {
  if (finestra.__gdahomeAccompagna) return;

  /* Il segno che `apri.html` lascia sul riquadro di Home Assistant che la
   * contiene. La pagina della plancia, dopo, guarda quello: se c'e', il
   * riquadro e' nostro e la barra e la sessione sono cose sue; se non c'e' —
   * la plancia aperta dalla scheda dell'add-on, o dentro la tessera di
   * qualcuno — non tocca niente, perche' li' quelle cose le fa qualcun altro. */
  var SEGNO = "data-gdahome";
  var NOSTRO = "apri";

  /* Ogni quanto si rinfresca la sessione dell'ingress. Il Supervisor la tiene
   * viva un quarto d'ora e la rinnova a ogni controllo: mezzo minuto e' quello
   * che faceva la tessera ed e' quello che fa il frontend di Home Assistant. */
  var OGNI_QUANTO = 30000;

  /* Ogni quanto si guarda se Home Assistant e' entrato in modifica. Sono due
   * letture di una proprieta': un secondo e' piu' che abbastanza per non
   * lasciare nessuno senza «Fatto» davanti. */
  var OGNI_MODIFICA = 1000;

  /* La barra della dashboard, e perche' va via.
   *
   * Una Plancia di Home Assistant ha **sempre** la sua barra: il titolo, la
   * lente, il piu', la matita. Sopra la plancia non ci va — e' una pagina
   * intera, con il suo menu — e la tessera la toglieva da dentro la pagina di
   * Home Assistant. Adesso la toglie questo file, da dentro il riquadro: e' lo
   * stesso documento, e la barra e' due porte sopra.
   *
   * Un foglio di stile nella radice ombra di `hui-root`, e non gli stili in
   * linea: la barra Home Assistant la ridisegna quando gli pare, e un
   * selettore resta. E per rimetterla basta buttare il foglio. */
  var FOGLIO = "gdahome-senza-barra";
  var SENZA_BARRA =
    ".header { display: none !important; }\n" +
    /* Non si azzera il riempimento del contenuto: si azzera la **misura** con
     * cui Home Assistant lo calcola. Cosi' va via l'altezza della barra e resta
     * lo spazio del notch, che serve ancora. */
    ":host { --header-height: 0px !important; }\n";

  /* E la cornice della tessera «pagina web»: un bordo e due angoli tondi
   * intorno a una pagina intera non ci vanno. Sta nell'ombra di quella
   * tessera e di nessun'altra. */
  var CORNICE = "gdahome-senza-cornice";
  var SENZA_CORNICE =
    "ha-card { border: 0 !important; border-radius: 0 !important;" +
    " box-shadow: none !important; overflow: hidden; }\n";

  /* Chi sta sopra un nodo, anche quando sopra c'e' il confine di un'ombra:
   * dentro una radice ombra `parentNode` torna `null` all'ultimo passo, e da
   * li' si sale con `host`. */
  function sopra(nodo) {
    if (!nodo) return null;
    return nodo.parentNode || nodo.host || null;
  }

  /* Dove sta il riquadro: sotto quale barra, e se e' solo nella sua vista.
   *
   * La barra si toglie **solo** da una vista a pannello — quella che gdahome
   * si fabbrica. In una vista a griglia la stessa barra porta le linguette
   * delle altre pagine, e toglierle a chi si e' messo la plancia in mezzo alle
   * sue sarebbe un danno. */
  function doveSiamo(da) {
    var nodo = sopra(da);
    var pannello = false;
    for (var passi = 0; nodo && passi < 60; passi += 1) {
      var chi = String(nodo.localName || "").toLowerCase();
      if (chi === "hui-panel-view") pannello = true;
      if (chi === "hui-root") return { tetto: nodo, pannello: pannello };
      nodo = sopra(nodo);
    }
    return { tetto: null, pannello: pannello };
  }

  /* In modifica la barra resta: «Fatto» sta li', ed e' l'unico modo di
   * uscirne. */
  function inModifica(tetto) {
    try {
      return Boolean(tetto && tetto.lovelace && tetto.lovelace.editMode === true);
    } catch (_e) {
      return false;
    }
  }

  /* Il riquadro di Home Assistant che ci contiene, se ce n'e' uno e se si
   * lascia toccare. Su un altro dominio `frameElement` e' `null`. */
  function ilRiquadro(dove) {
    try {
      return (dove || finestra).frameElement || null;
    } catch (_e) {
      return null;
    }
  }

  function eNostro(riquadro) {
    try {
      return Boolean(riquadro && riquadro.getAttribute(SEGNO) === NOSTRO);
    } catch (_e) {
      return false;
    }
  }

  /* Mette un foglio in una radice ombra, una volta sola: ha un nome, e il
   * secondo giro lo ritrova. */
  function unFoglio(radice, nome, testo) {
    if (!radice || typeof radice.appendChild !== "function") return false;
    try {
      if (radice.getElementById && radice.getElementById(nome)) return true;
      var documento = radice.ownerDocument || (radice.host && radice.host.ownerDocument);
      if (!documento) return false;
      var foglio = documento.createElement("style");
      foglio.id = nome;
      foglio.textContent = testo;
      radice.appendChild(foglio);
      return true;
    } catch (_e) {
      return false;
    }
  }

  function viaIlFoglio(radice, nome) {
    try {
      var foglio = radice && radice.getElementById && radice.getElementById(nome);
      if (foglio && foglio.parentNode) foglio.parentNode.removeChild(foglio);
    } catch (_e) {
      /* Se non si lascia togliere, resta: e' un foglio di stile. */
    }
  }

  /* La barra: tolta se siamo soli in una vista a pannello e non in modifica,
   * rimessa altrimenti. Torna `true` se adesso la barra non c'e'. */
  function laBarra(riquadro) {
    var dove = doveSiamo(riquadro);
    var tetto = dove.tetto;
    if (!tetto || !tetto.shadowRoot) return false;
    if (!dove.pannello || inModifica(tetto)) {
      viaIlFoglio(tetto.shadowRoot, FOGLIO);
      return false;
    }
    return unFoglio(tetto.shadowRoot, FOGLIO, SENZA_BARRA);
  }

  function rimettiLaBarra(riquadro) {
    var tetto = doveSiamo(riquadro).tetto;
    if (tetto && tetto.shadowRoot) viaIlFoglio(tetto.shadowRoot, FOGLIO);
  }

  /* Via la cornice della tessera «pagina web» che ci contiene. Solo quella:
   * se il riquadro sta dentro qualcos'altro, non si tocca niente. */
  function laCornice(riquadro) {
    try {
      var radice = riquadro && riquadro.getRootNode && riquadro.getRootNode();
      var chi = radice && radice.host && String(radice.host.localName || "").toLowerCase();
      if (chi !== "hui-iframe-card") return false;
      return unFoglio(radice, CORNICE, SENZA_CORNICE);
    } catch (_e) {
      return false;
    }
  }

  /* `hass` di chi guarda: quello della pagina di Home Assistant che ci
   * contiene. Stesso indirizzo, quindi si legge; `null` se non c'e' o se
   * non e' ancora pronto. */
  function laCasa(dove) {
    try {
      var su = (dove || finestra).parent;
      if (!su || su === (dove || finestra)) return null;
      var ha = su.document && su.document.querySelector("home-assistant");
      var hass = ha && ha.hass;
      if (!hass || typeof hass.callWS !== "function") return null;
      return hass;
    } catch (_e) {
      return null;
    }
  }

  /* E aspettarlo, se la pagina di Home Assistant e' ancora a meta': al primo
   * avvio dell'app sul telefono il riquadro puo' partire prima che `hass` ci
   * sia. Si guarda ogni decimo di secondo, fino a `quanto`.
   *
   * Si aspetta anche **chi** guarda (`hass.user`), che Home Assistant chiede
   * dopo essersi collegato: senza, un elenco di utenti abilitati direbbe «non
   * e' per te» a chi e' solo arrivato un attimo prima del suo nome. Allo
   * scadere si va avanti con quello che c'e'. */
  function aspettaLaCasa(quanto, dove) {
    return new Promise(function (ok, no) {
      var fine = Date.now() + (quanto || 15000);
      (function guarda() {
        var hass = laCasa(dove);
        if (hass && hass.user) return ok(hass);
        if (hass && Date.now() >= fine) return ok(hass);
        if (Date.now() >= fine) {
          var errore = new Error("Home Assistant non risponde");
          errore.tipo = "casa";
          return no(errore);
        }
        setTimeout(guarda, 100);
        return undefined;
      })();
    });
  }

  /* Il biscotto della sessione, messo come lo mette Home Assistant:
   * `SameSite=Strict` e il percorso ristretto all'ingress. Quel biscotto non
   * deve viaggiare da nessun'altra parte. */
  function mettiLaSessione(documento, sessione) {
    var sicuro = documento.location && documento.location.protocol === "https:" ? ";Secure" : "";
    documento.cookie =
      "ingress_session=" + sessione + ";path=/api/hassio_ingress/;SameSite=Strict" + sicuro;
  }

  /* Quella che c'e' nel biscotto, se questa pagina lo vede: lo vede la pagina
   * della plancia, che sta sotto `/api/hassio_ingress/`. */
  function laSessioneDelBiscotto(documento) {
    try {
      var pezzi = String(documento.cookie || "").split(/;\s*/);
      for (var i = 0; i < pezzi.length; i += 1) {
        if (pezzi[i].indexOf("ingress_session=") === 0) {
          return pezzi[i].slice("ingress_session=".length);
        }
      }
    } catch (_e) {
      /* Niente biscotto: se ne fa uno. */
    }
    return "";
  }

  /* Una sessione nuova, chiesta come la chiede Home Assistant: sul WebSocket,
   * `supervisor/api` con `/ingress/session`. La via REST di una volta resta
   * come ripiego per le versioni in cui quella nuova non c'e'. Se falliscono
   * tutt'e due si racconta la prima, che e' quella buona. */
  function laSessione(hass, documento) {
    return hass
      .callWS({ type: "supervisor/api", endpoint: "/ingress/session", method: "post" })
      .then(function (detto) {
        var sessione = String(
          (detto && (detto.session || (detto.data && detto.data.session))) || "",
        );
        if (sessione) return sessione;
        throw new Error("Home Assistant non ha dato una sessione per l'ingresso");
      })
      .then(null, function (primo) {
        if (typeof hass.callApi !== "function") throw primo;
        return hass.callApi("POST", "hassio/ingress/session").then(
          function (detto) {
            var sessione = String(
              (detto && ((detto.data && detto.data.session) || detto.session)) || "",
            );
            if (sessione) return sessione;
            throw primo;
          },
          function () {
            throw primo;
          },
        );
      })
      .then(function (sessione) {
        mettiLaSessione(documento, sessione);
        return sessione;
      });
  }

  /* Tenerla viva: non se ne fa una nuova ogni mezzo minuto, si dice al
   * Supervisor che quella di prima e' ancora in uso. Se non vale piu' — il
   * Supervisor si e' riavviato, il telefono e' stato in tasca una notte — se
   * ne fa una nuova. */
  function rinfresca(hass, documento, sessione) {
    if (!sessione) return laSessione(hass, documento);
    return hass
      .callWS({
        type: "supervisor/api",
        endpoint: "/ingress/validate_session",
        method: "post",
        data: { session: sessione },
      })
      .then(
        function () {
          return sessione;
        },
        function () {
          return laSessione(hass, documento);
        },
      );
  }

  /* Cosa e' andato storto, **leggibile**: il `message` se c'e', se no quello
   * che c'e' dentro, e in ultimo il JSON. Un «[object Object]» ha gia'
   * nascosto un guasto per tre ore. */
  function perche(errore) {
    if (typeof errore === "string" && errore) return errore;
    if (errore && typeof errore.message === "string" && errore.message) return errore.message;
    if (errore && errore.body && typeof errore.body.message === "string")
      return errore.body.message;
    if (errore && typeof errore === "object") {
      var pezzi = [];
      if (errore.code !== undefined) pezzi.push("codice " + errore.code);
      if (errore.status_code !== undefined) pezzi.push("HTTP " + errore.status_code);
      if (errore.error) pezzi.push(String(errore.error));
      if (pezzi.length) return pezzi.join(", ");
      try {
        var scritto = JSON.stringify(errore);
        if (scritto && scritto !== "{}") return scritto;
      } catch (_e) {
        /* Se non si puo' nemmeno scrivere, si va avanti col ripiego. */
      }
    }
    return "non ha funzionato, e non ha detto perche'";
  }

  /* ─── Dentro la pagina della plancia ─────────────────────────────────────
   *
   * Quello che faceva la tessera **finche' stava a schermo**: la sessione
   * tenuta viva ogni mezzo minuto, e la barra tolta e rimessa. Parte solo se
   * il riquadro porta il segno di `apri.html`; altrove non fa niente.
   *
   * `pagehide` e' il posto dove la tessera rimetteva la barra quando se ne
   * andava (`disconnectedCallback`): quando Home Assistant toglie il riquadro
   * — si cambia Plancia, si entra in un'altra pagina — il documento dentro se
   * ne va, e prima di andarsene la rimette. */
  function accompagna() {
    var riquadro = ilRiquadro();
    if (!eNostro(riquadro)) return false;
    var documento = finestra.document;
    var sessione = laSessioneDelBiscotto(documento);
    var inCorso = false;
    var giro = function () {
      if (inCorso) return;
      var hass = laCasa();
      if (!hass) return;
      inCorso = true;
      rinfresca(hass, documento, sessione || laSessioneDelBiscotto(documento)).then(
        function (nuova) {
          sessione = nuova;
          inCorso = false;
        },
        function () {
          /* Si riprova al giro dopo: la pagina sta in piedi con la sessione
           * di prima. */
          inCorso = false;
        },
      );
    };
    var battito = setInterval(giro, OGNI_QUANTO);
    /* Un telefono che si risveglia dopo ore ha una sessione scaduta: si
     * rinfresca appena la pagina torna a schermo, non al prossimo giro. */
    var tornata = function () {
      if (documento.visibilityState === "visible") giro();
    };
    documento.addEventListener("visibilitychange", tornata);
    laBarra(riquadro);
    laCornice(riquadro);
    var guardia = setInterval(function () {
      laBarra(riquadro);
    }, OGNI_MODIFICA);
    finestra.addEventListener("pagehide", function () {
      clearInterval(battito);
      clearInterval(guardia);
      documento.removeEventListener("visibilitychange", tornata);
      rimettiLaBarra(riquadro);
    });
    return true;
  }

  finestra.__gdahomeAccompagna = {
    SEGNO: SEGNO,
    NOSTRO: NOSTRO,
    FOGLIO: FOGLIO,
    doveSiamo: doveSiamo,
    ilRiquadro: ilRiquadro,
    laBarra: laBarra,
    rimettiLaBarra: rimettiLaBarra,
    laCornice: laCornice,
    laCasa: laCasa,
    aspettaLaCasa: aspettaLaCasa,
    laSessione: laSessione,
    rinfresca: rinfresca,
    perche: perche,
    accompagna: accompagna,
  };
})(window);
