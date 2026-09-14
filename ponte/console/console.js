/* La console del ponte, dietro l'autenticazione di Home Assistant.
 *
 * Tutte le chiamate sono relative — `api/stato`, non `/api/stato` — perche'
 * l'ingress mette davanti un prefisso che cambia a ogni riavvio. Con la via
 * relativa il browser lo tiene da solo; con quella assoluta si finirebbe fuori
 * dall'add-on.
 */

(function () {
  "use strict";

  var vediPagina = document;
  var quandoScade = null;

  /* Quante plance si tengono: lo stesso numero che ha il ponte
   * (`plance.js`). Qui serve solo a spegnere il tasto quando si e' arrivati
   * al tetto, invece di farlo premere per sentirsi dire di no. */
  var PLANCE_AL_MASSIMO = 8;

  function trova(id) {
    return vediPagina.getElementById(id);
  }

  function chiedi(via, opzioni) {
    return fetch(
      via,
      Object.assign({ headers: { "content-type": "application/json" } }, opzioni),
    ).then(function (risposta) {
      return risposta.json().then(function (corpo) {
        if (!risposta.ok)
          throw new Error(corpo && corpo.errore ? corpo.errore : "non ha funzionato");
        return corpo;
      });
    });
  }

  /* Una pastiglia della striscia in cima: il pallino prende il colore, e le
   * parole restano corte. Il racconto lungo sta nel cassetto, che si apre solo
   * a chi lo cerca. */
  function pastiglia(quale, come, corto) {
    var dove = trova(quale);
    if (!dove) return;
    dove.hidden = false;
    dove.dataset.come = come;
    var testo = dove.querySelector("[data-corto]");
    if (testo) testo.textContent = corto;
  }

  /* Il riquadro tondo col disegno, in testa a una riga di elenco. Il disegno
   * sta nel foglio dei simboli in cima alla pagina: niente si scarica. */
  function unaFaccia(quale, come) {
    var faccia = vediPagina.createElement("span");
    faccia.className = "faccia" + (come ? " " + come : "");
    var disegno = vediPagina.createElementNS("http://www.w3.org/2000/svg", "svg");
    disegno.setAttribute("class", "ic");
    disegno.setAttribute("aria-hidden", "true");
    var uso = vediPagina.createElementNS("http://www.w3.org/2000/svg", "use");
    uso.setAttribute("href", "#" + quale);
    disegno.appendChild(uso);
    faccia.appendChild(disegno);
    return faccia;
  }

  function avvisa(testo) {
    var avviso = trova("avviso");
    avviso.textContent = testo || "";
    avviso.hidden = !testo;
  }

  function quandoIlTempoDice(scadeIl) {
    var mancano = Math.max(0, Math.round((scadeIl - Date.now()) / 1000));
    if (!mancano) return "scaduto";
    var minuti = Math.floor(mancano / 60);
    var secondi = mancano % 60;
    return "vale ancora " + (minuti ? minuti + " min " : "") + secondi + " s";
  }

  /* Quando si e' visto un telefono, come lo direbbe una persona.
   *
   * `toLocaleString()` scrive «13/09/2026, 14:40:49»: una riga di numeri che
   * va a capo dove lo spazio e' stretto, e non risponde alla domanda vera —
   * che e' «adesso, poco fa, o l'altro giorno?». */
  /* I nomi che un dispositivo si da' da se' e che non vogliono dire niente.
   *
   * Android, a chi gli chiede come si chiama, risponde **`localhost`**: non e'
   * un difetto nostro, e' quello che risponde. Chiamare «localhost» il
   * telefono di qualcuno e' peggio che non dargli un nome, perche' sembra un
   * nome. Adesso l'app manda qualcosa di sensato — vedi
   * `casa/questo_dispositivo.dart` — ma chi si e' abbinato prima ce l'ha
   * ancora scritto, e l'archivio non si va a riscrivere di nascosto: si
   * scrive bene qui, dove si legge. */
  var NOMI_CHE_NON_DICONO = ["localhost", "localhost.localdomain", "android", "unknown"];

  function comeSiChiama(uno) {
    var detto = String((uno && uno.nome) || "").trim();
    if (detto && NOMI_CHE_NON_DICONO.indexOf(detto.toLowerCase()) < 0) return detto;
    var quale = String((uno && uno.sistema) || "").toLowerCase();
    if (quale === "android") return "Telefono Android";
    if (quale === "ios") return "iPhone";
    if (quale === "web") return "Browser";
    return "Dispositivo";
  }

  /* Cos'e' questo, detto a parole.
   *
   * In un elenco «android» e «sconosciuto» non dicono niente: chi guarda vuole
   * sapere se quella riga e' l'app o il browser, perche' la stessa persona si
   * abbina da tutti e due e le righe si somigliano tutte. «sconosciuto» resta
   * sui dispositivi di prima, e allora si dice com'e': non lo ha detto. */
  function comEFatto(sistema) {
    var quale = String(sistema || "").toLowerCase();
    if (quale === "web") return "browser";
    if (quale === "android") return "app su Android";
    if (quale === "ios") return "app su iPhone";
    if (!quale || quale === "sconosciuto") return "non dice cos'è";
    return quale;
  }

  function dataLeggibile(quando) {
    if (!quando) return "mai";
    try {
      var q = new Date(quando);
      var ora = q.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      var oggi = new Date();
      var ieri = new Date(oggi.getTime() - 24 * 60 * 60 * 1000);
      if (q.toDateString() === oggi.toDateString()) return "oggi alle " + ora;
      if (q.toDateString() === ieri.toDateString()) return "ieri alle " + ora;
      return q.toLocaleDateString([], { day: "numeric", month: "long" }) + " alle " + ora;
    } catch (_errore) {
      return "—";
    }
  }

  /* Sedici lettere di fila non le copia nessuno senza perdere il segno:
   * quattro gruppi da quattro si copiano un gruppo per volta. */
  function aGruppi(codice) {
    return String(codice).replace(/(.{4})(?=.)/g, "$1-");
  }

  function disegnaIlCodice(codice, scadeIl) {
    trova("codice").textContent = aGruppi(codice);
    /* La marca del tempo non e' scaramanzia: senza, il browser rimette il
     * QR code di prima quando se ne fabbrica un altro nello stesso minuto,
     * e chi inquadra si abbina con un codice gia' speso. */
    trova("qr").src = "api/qr.svg?" + Date.now();
    trova("codice-vivo").hidden = false;
    trova("senza-codice").hidden = true;
    trova("a-mano").hidden = false;
    trova("annulla").hidden = false;
    if (quandoScade) clearInterval(quandoScade);
    var aggiorna = function () {
      trova("scadenza").textContent = quandoIlTempoDice(scadeIl);
      if (scadeIl <= Date.now()) {
        clearInterval(quandoScade);
        nascondiIlCodice();
        aggiornaTutto();
      }
    };
    aggiorna();
    quandoScade = setInterval(aggiorna, 1000);
  }

  function nascondiIlCodice() {
    trova("codice-vivo").hidden = true;
    trova("senza-codice").hidden = false;
    trova("a-mano").hidden = true;
    trova("annulla").hidden = true;
    if (quandoScade) clearInterval(quandoScade);
    quandoScade = null;
  }

  /* Come sta il filo con Home Assistant: due parole per la pastiglia, e la
   * frase intera per il cassetto. */
  function comeVaLaCasa(casa) {
    if (casa && casa.viva) {
      return {
        come: "bene",
        corto: "risponde",
        lungo: "Home Assistant risponde, e gdahome è in piedi.",
      };
    }
    return {
      come: "male",
      corto: "non risponde",
      lungo: "Home Assistant non risponde: " + ((casa && casa.perche) || "non dice perché"),
    };
  }

  /* Come va il filo verso il centralino, in una riga.
   *
   * Va detto qui e non lasciato scoprire in stazione: chi sbaglia l'indirizzo
   * nella scheda dell'add-on non ha nessun altro posto dove accorgersene, e
   * quello che vedrebbe sarebbe soltanto un'app che «non trova la casa». */
  function comeVaIlCentralino(centralino) {
    if (!centralino || !centralino.configurato) {
      return {
        come: "spento",
        corto: "spento",
        lungo:
          "Nessun centralino: da fuori casa l'app non entra. Si riaccende con " +
          "«da fuori casa» nelle opzioni di questo add-on.",
      };
    }
    /* E **dove** chiama, non solo se ci arriva.
     *
     * Da quando nelle opzioni non c'e' piu' la casella dell'indirizzo, questa
     * riga e' l'unico posto dove si legge: chi vuole sapere se la sua casa sta
     * sul centralino nuovo o su quello di prima lo guarda qui, invece di
     * andarselo a cercare nel programma. */
    var dove = centralino.dove || "";
    if (centralino.rifiutata) {
      return {
        come: "male",
        corto: "rifiutati",
        lungo: "Il centralino ci rifiuta: " + centralino.rifiutata,
      };
    }
    /* E **perche'** non ci arriva, se non ci arriva.
     *
     * «Sto chiamando…» per un'ora non e' un'informazione: e' un'attesa. Il
     * motivo vero lo sa il filo — il nome che non si risolve, la porta chiusa,
     * una risposta che non e' un WebSocket — e va scritto qui, che e' il posto
     * dove si guarda. */
    if (!centralino.dentro) {
      return {
        come: "male",
        /* Nella pastiglia il motivo vero, corto: «non entra» da solo manderebbe
         * a cercarlo altrove, ed e' quello che e' costato un pomeriggio. */
        corto: centralino.perche ? "non entra — " + centralino.perche : "sto chiamando…",
        lungo:
          "Sto chiamando " +
          (dove || "il centralino") +
          "…" +
          (centralino.perche ? " L'ultimo tentativo: " + centralino.perche + "." : ""),
      };
    }
    return {
      come: "bene",
      corto: "si entra",
      lungo: "Collegato a " + (dove || "il centralino") + ": da fuori casa si entra.",
    };
  }

  /* Da dove viene la plancia, in tre righe.
   *
   * Il verdetto e' uno di quattro, e si dicono tutti e quattro senza girarci
   * intorno: originale e firmata, intatta ma senza firma, modificata (con
   * quali file), o senza provenienza. Chi legge deve poter rispondere a «e'
   * quella vera?» senza sapere niente di firme. */
  function disegnaLaProvenienza(plancia) {
    var scheda = trova("provenienza");
    if (!scheda) return;
    if (!plancia) {
      scheda.hidden = true;
      trova("pas-plancia").hidden = true;
      return;
    }
    scheda.hidden = false;
    var quale = plancia.versione ? "DashboardModern " + plancia.versione : "DashboardModern";
    var spiega = trova("provenienza-spiega");
    var quali = trova("provenienza-quali");
    var acceso = plancia.stato === "originale" || plancia.stato === "non-firmata";
    /* Nella pastiglia: la versione e una parola. Chi vuole sapere cosa vuol
     * dire quella parola apre il cassetto e trova la frase intera. */
    pastiglia(
      "pas-plancia",
      acceso ? "bene" : "male",
      (plancia.versione || "") +
        " " +
        {
          originale: "originale",
          "non-firmata": "intatta",
          modificata: "modificata",
          "senza-origine": "provenienza sconosciuta",
        }[plancia.stato],
    );
    spiega.textContent =
      plancia.stato === "originale"
        ? quale + ": ogni file è quello pubblicato, e la firma lo conferma."
        : plancia.stato === "non-firmata"
          ? quale +
            ": ogni file torna con le impronte scritte dentro. Manca solo la firma di chi l'ha pubblicata."
          : plancia.stato === "modificata"
            ? "Qualcosa qui dentro non è come è stato pubblicato: " +
              plancia.perche +
              ". Se non l'hai toccata tu, reinstalla l'add-on."
            : plancia.perche || "";
    var elenco = plancia.quali || [];
    quali.hidden = elenco.length === 0;
    if (elenco.length) {
      trova("provenienza-elenco").textContent =
        elenco.join("\n") +
        (plancia.quanti > elenco.length ? "\n… e altri " + (plancia.quanti - elenco.length) : "");
    }
  }

  function disegnaIDispositivi(dispositivi, massimi) {
    var elenco = trova("elenco");
    elenco.textContent = "";
    trova("conteggio").textContent =
      dispositivi.length +
      " di " +
      massimi +
      (dispositivi.length === 1 ? " telefono" : " telefoni");

    if (!dispositivi.length) {
      var vuoto = vediPagina.createElement("li");
      vuoto.className = "vuoto";
      vuoto.textContent = "Nessun telefono abbinato.";
      elenco.appendChild(vuoto);
      return;
    }

    dispositivi.forEach(function (uno) {
      var riga = vediPagina.createElement("li");

      /* La faccia della riga: un riquadro tondo col disegno di un telefono,
       * verde quando quel telefono e' collegato adesso. Prima c'erano un
       * pallino e una parola nel `title`, che si legge solo col mouse fermo
       * sopra: sul telefono, cioe' dove si guarda questa pagina, non c'era
       * nessun modo di saperlo. */
      riga.appendChild(unaFaccia("ic-telefono", uno.collegati ? "acceso" : ""));

      var nome = vediPagina.createElement("div");
      nome.className = "nome";
      var forte = vediPagina.createElement("strong");
      /* `textContent`, mai `innerHTML`: il nome lo scrive chi si abbina, e
       * arriva dalla porta esposta. */
      forte.textContent = comeSiChiama(uno);
      var sotto = vediPagina.createElement("span");
      /* Di chi e' questo telefono. Va detto: un telefono senza padrone vede
       * **tutte** le plance, comprese quelle riservate a qualcuno, ed e'
       * esattamente quello di cui bisogna accorgersi guardando l'elenco. */
      var diChi = nomeDellUtente(uno.utente);
      sotto.textContent =
        comEFatto(uno.sistema) +
        " · " +
        (uno.collegati ? "collegato adesso" : "visto " + dataLeggibile(uno.vistoIl)) +
        (diChi ? " · " + diChi : "");
      nome.appendChild(forte);
      nome.appendChild(sotto);
      riga.appendChild(nome);

      var stacca = vediPagina.createElement("button");
      stacca.className = "tenue";
      stacca.type = "button";
      stacca.textContent = "Togli associazione";
      stacca.addEventListener("click", function () {
        if (
          !window.confirm(
            "Togliere l'associazione di «" + comeSiChiama(uno) + "»? Dovrà riabbinarsi da capo.",
          )
        )
          return;
        stacca.disabled = true;
        chiedi("api/dispositivi/" + encodeURIComponent(uno.id), { method: "DELETE" })
          .then(aggiornaTutto)
          .catch(function (errore) {
            stacca.disabled = false;
            avvisa(errore.message);
          });
      });
      riga.appendChild(stacca);

      elenco.appendChild(riga);
    });
  }

  /* Le plance di questa casa.
   *
   * Una riga per plancia: come si chiama, e — per quelle che non sono la prima
   * — il tasto per toglierla. Il nome si cambia premendoci sopra: e' la stessa
   * cosa che si fa in Home Assistant col nome di un'integrazione, e non vale
   * una finestra tutta sua.
   *
   * La prima non si toglie, e il tasto non c'e': un tasto che c'e' e che
   * risponde «questa no» e' peggio di un tasto che non c'e'. */
  function disegnaLePlance(plance) {
    var elenco = trova("elenco-plance");
    if (!elenco) return;
    elenco.textContent = "";
    var quante = plance ? plance.length : 0;
    trova("aggiungi-plancia").disabled = quante >= PLANCE_AL_MASSIMO;

    (plance || []).forEach(function (una) {
      var riga = vediPagina.createElement("li");
      riga.appendChild(unaFaccia("ic-plance", una.primaria ? "acceso" : ""));

      var nome = vediPagina.createElement("div");
      nome.className = "nome";
      var forte = vediPagina.createElement("strong");
      /* `textContent`, mai `innerHTML`: il titolo l'ha scritto una persona. */
      forte.textContent = una.titolo;
      var sotto = vediPagina.createElement("span");
      var suoi = Array.isArray(una.utenti) ? una.utenti.filter(Boolean) : [];
      /* Le due restrizioni si sommano, e la riga le dice tutte e due: chi
       * legge «la vede 1 utente» e non sa che chiede anche di amministrare
       * cerca il guaio dove non c'e'. */
      var chi = [];
      if (suoi.length === 1) chi.push("la vede 1 utente");
      else if (suoi.length > 1) chi.push("la vedono " + suoi.length + " utenti");
      if (una.solo_admin) chi.push("solo amministratori");
      if (chi.length === 0) chi.push("la vedono tutti");
      sotto.textContent =
        (una.primaria ? "la prima, quella di sempre" : "aggiunta da te") + " · " + chi.join(" · ");
      nome.appendChild(forte);
      nome.appendChild(sotto);
      riga.appendChild(nome);

      var tasti = vediPagina.createElement("div");
      tasti.className = "tasti";

      /* «Apri»: la plancia, servita dal ponte, qui dentro.
       *
       * E' lo stesso indirizzo che apre la sua voce fra le «Plance» di Home
       * Assistant, e sta qui perche' e' il posto dove si guarda quando si e'
       * appena aggiunta una plancia — prima di andare a cercarla nella barra
       * laterale. Relativo, non assoluto: davanti c'e' il prefisso
       * dell'ingress, che cambia a ogni riavvio di Home Assistant e che da
       * qui non si conosce. */
      var apri = vediPagina.createElement("a");
      apri.className = "tenue";
      apri.textContent = "Apri";
      apri.target = "_blank";
      apri.rel = "noopener";
      apri.href = una.primaria ? "plancia/" : "plancia/" + encodeURIComponent(una.profilo) + "/";
      tasti.appendChild(apri);

      var rinomina = vediPagina.createElement("button");
      rinomina.className = "tenue";
      rinomina.type = "button";
      rinomina.textContent = "Rinomina";
      rinomina.addEventListener("click", function () {
        var come = window.prompt("Come si chiama questa plancia?", una.titolo);
        if (come === null) return;
        rinomina.disabled = true;
        chiedi("api/plance", {
          method: "PATCH",
          body: JSON.stringify({ profilo: una.profilo, titolo: come }),
        })
          .then(aggiornaTutto)
          .catch(function (errore) {
            rinomina.disabled = false;
            avvisaLePlance(errore.message);
          });
      });
      tasti.appendChild(rinomina);

      if (!una.primaria) {
        var togli = vediPagina.createElement("button");
        togli.className = "tenue";
        togli.type = "button";
        togli.textContent = "Togli";
        togli.addEventListener("click", function () {
          if (
            !window.confirm(
              "Togliere «" +
                una.titolo +
                "»? Va via anche come l'hai configurata: sezioni, tessere, stanze. Non si rimette a posto.",
            )
          )
            return;
          togli.disabled = true;
          chiedi("api/plance", {
            method: "DELETE",
            body: JSON.stringify({ profilo: una.profilo }),
          })
            .then(aggiornaTutto)
            .catch(function (errore) {
              togli.disabled = false;
              avvisaLePlance(errore.message);
            });
        });
        tasti.appendChild(togli);
      }

      /* «Chi la vede»: le spunte, sotto la riga.
       *
       * Sotto e non in una finestra: le spunte sono poche — quanti utenti ha
       * una casa — e una finestra per tre caselle e' una finestra da chiudere.
       * Si apre una riga per volta: aprirne un'altra chiude quella di prima,
       * se no l'elenco delle plance diventa un muro di caselle. */
      var chiLaVede = vediPagina.createElement("button");
      chiLaVede.className = "tenue";
      chiLaVede.type = "button";
      chiLaVede.textContent = "Chi la vede";
      chiLaVede.setAttribute("aria-expanded", "false");
      tasti.appendChild(chiLaVede);

      riga.appendChild(tasti);

      var spunte = vediPagina.createElement("div");
      spunte.className = "chi-la-vede";
      spunte.hidden = true;
      riga.appendChild(spunte);

      chiLaVede.addEventListener("click", function () {
        /* Aprirne uno chiude l'altro: una per volta, se no l'elenco delle
         * plance diventa un muro di caselle. */
        cassettoAperto = cassettoAperto === una.profilo ? "" : una.profilo;
        disegnaLePlance(plance);
      });

      if (cassettoAperto === una.profilo) {
        spunte.hidden = false;
        chiLaVede.setAttribute("aria-expanded", "true");
        riempiLeSpunte(spunte, una);
      }

      elenco.appendChild(riga);
    });
  }

  /* Gli utenti della casa, chiesti una volta e tenuti da parte.
   *
   * Non cambiano mentre si guarda questa pagina, e chiederli a ogni apertura
   * di un cassetto vorrebbe dire una chiamata a Home Assistant per ogni clic.
   * Si rileggono alla prossima apertura della pagina. */
  var gliUtenti = null;

  /* Quale cassetto «chi la vede» e' aperto, se ce n'e' uno.
   *
   * Sta fuori dalla funzione che disegna perche' la pagina si ridisegna da
   * sola ogni dieci secondi: senza questa riga, il cassetto si chiuderebbe da
   * solo mentre uno sta spuntando le caselle — e si chiuderebbe anche subito
   * dopo aver spuntato, perche' salvare ridisegna. */
  var cassettoAperto = "";

  /* Il nome di un utente dal suo identificativo, da quello che si e' gia'
   * chiesto. Un telefono senza padrone lo dice a parole — «vede tutte le
   * plance» — perche' e' la cosa vera e la si deve poter leggere. */
  function nomeDellUtente(chi) {
    var cercato = String(chi || "").trim();
    if (!cercato) return "vede tutte le plance";
    if (!gliUtenti) return "";
    var uno = null;
    for (var quale = 0; quale < gliUtenti.length; quale += 1) {
      if (gliUtenti[quale].id === cercato) uno = gliUtenti[quale];
    }
    return uno ? "di " + uno.nome : "";
  }

  function chiediGliUtenti() {
    if (gliUtenti) return Promise.resolve(gliUtenti);
    return chiedi("api/utenti").then(function (detto) {
      gliUtenti = Array.isArray(detto.utenti) ? detto.utenti : [];
      return gliUtenti;
    });
  }

  /* Le spunte: un utente per riga, e «la vedono tutti» come stato di partenza.
   *
   * Si salva a ogni spunta e non con un tasto «Salva»: sono due stati e non un
   * modulo da compilare, e un tasto «Salva» che si dimentica di premere e' un
   * tasto che fa credere di aver cambiato qualcosa. */
  function riempiLeSpunte(dove, quale) {
    /* Gli utenti li abbiamo gia'? Allora si disegna subito, senza passare per
     * una riga d'attesa. Non e' una finezza: questo cassetto si ridisegna
     * insieme alla pagina ogni dieci secondi, e un «sto chiedendo…» che
     * lampeggia ogni dieci secondi si vede. */
    if (!gliUtenti) {
      dove.textContent = "";
      var attesa = vediPagina.createElement("p");
      attesa.className = "minuta";
      attesa.textContent = "Sto chiedendo a Home Assistant chi c'è in casa…";
      dove.appendChild(attesa);
    }

    chiediGliUtenti()
      .then(function (utenti) {
        dove.textContent = "";
        var suoi = Array.isArray(quale.utenti) ? quale.utenti.filter(Boolean).map(String) : [];

        /* La riga in cima dice **come sta adesso**, non come si fa a cambiarla.
         *
         * Le due scelte si sommano, e una riga che dicesse solo una delle due
         * mentirebbe: chi ha spuntato due nomi e acceso l'interruttore
         * leggerebbe «la vedono solo gli utenti spuntati» e non capirebbe
         * perche' uno dei due non la vede. */
        var spiega = vediPagina.createElement("p");
        spiega.className = "minuta";
        var admin = quale.solo_admin === true;
        if (suoi.length === 0 && !admin) {
          spiega.textContent =
            "La vedono tutti quelli che entrano in questa casa. Riservala qui sotto.";
        } else if (suoi.length === 0) {
          spiega.textContent =
            "La vedono solo gli amministratori della casa. Spegni tutto per riaprirla a tutti.";
        } else if (!admin) {
          spiega.textContent =
            "La vedono solo gli utenti spuntati. Spegni tutto per riaprirla a tutti.";
        } else {
          spiega.textContent =
            "La vedono solo gli utenti spuntati, e solo se amministrano la casa. " +
            "Spegni tutto per riaprirla a tutti.";
        }
        dove.appendChild(spiega);

        /* «Solo gli amministratori»: l'altra meta', e sta nello stesso
         * cassetto perche' e' la stessa domanda — chi la vede — fatta in un
         * altro modo. Un elenco di nomi va rifatto ogni volta che cambia
         * qualcuno; «chi ha le chiavi di casa» si aggiorna da se'. */
        var soloAdmin = vediPagina.createElement("label");
        soloAdmin.className = "spunta capo";
        var interruttore = vediPagina.createElement("input");
        interruttore.type = "checkbox";
        interruttore.checked = quale.solo_admin === true;
        var comeSiChiama = vediPagina.createElement("span");
        comeSiChiama.textContent = "Solo gli amministratori della casa";
        soloAdmin.appendChild(interruttore);
        soloAdmin.appendChild(comeSiChiama);
        dove.appendChild(soloAdmin);

        interruttore.addEventListener("change", function () {
          interruttore.disabled = true;
          chiedi("api/plance", {
            method: "PATCH",
            body: JSON.stringify({ profilo: quale.profilo, solo_admin: interruttore.checked }),
          })
            .then(aggiornaTutto)
            .catch(function (errore) {
              interruttore.disabled = false;
              interruttore.checked = !interruttore.checked;
              avvisaLePlance(errore.message);
            });
        });

        /* «e anche», non «oppure»: le due si sommano, e un'etichetta che
         * dicesse «oppure» farebbe credere che accenderne una spenga
         * l'altra. */
        var quali = vediPagina.createElement("p");
        quali.className = "etichetta";
        quali.textContent = "e anche, solo questi utenti";
        dove.appendChild(quali);

        if (utenti.length === 0) {
          var vuoto = vediPagina.createElement("p");
          vuoto.className = "minuta";
          vuoto.textContent = "In questa casa c'è un utente solo: non c'è niente da scegliere.";
          dove.appendChild(vuoto);
          return;
        }

        utenti.forEach(function (uno) {
          var riga = vediPagina.createElement("label");
          riga.className = "spunta utente";
          var casella = vediPagina.createElement("input");
          casella.type = "checkbox";
          casella.checked = suoi.indexOf(uno.id) !== -1;
          var nome = vediPagina.createElement("span");
          /* `textContent`: il nome di un utente l'ha scritto una persona. */
          nome.textContent = uno.nome + (uno.amministratore ? " · amministratore" : "");
          riga.appendChild(casella);
          riga.appendChild(nome);
          dove.appendChild(riga);

          casella.addEventListener("change", function () {
            var scelti = [];
            /* Solo le caselle degli **utenti**, non tutte quelle del cassetto:
             * in cima c'e' l'interruttore degli amministratori, e contandolo
             * ogni utente prenderebbe l'identificativo di quello dopo. */
            var caselle = dove.querySelectorAll(".spunta.utente input");
            for (var i = 0; i < caselle.length; i += 1) {
              if (caselle[i].checked) scelti.push(utenti[i].id);
            }
            for (var j = 0; j < caselle.length; j += 1) caselle[j].disabled = true;
            chiedi("api/plance", {
              method: "PATCH",
              body: JSON.stringify({ profilo: quale.profilo, utenti: scelti }),
            })
              .then(aggiornaTutto)
              .catch(function (errore) {
                for (var k = 0; k < caselle.length; k += 1) caselle[k].disabled = false;
                casella.checked = !casella.checked;
                avvisaLePlance(errore.message);
              });
          });
        });
      })
      .catch(function (errore) {
        dove.textContent = "";
        var male = vediPagina.createElement("p");
        male.className = "avviso";
        male.textContent =
          "Non riesco a chiedere a Home Assistant chi c'è in casa: " + errore.message;
        dove.appendChild(male);
      });
  }

  /* Chi parla di piu' in casa, e quanto. */
  function disegnaIChiacchieroni(come) {
    var riga = trova("stato-chiacchieroni");
    var elenco = trova("elenco-chiacchieroni");
    if (!riga || !elenco) return;
    elenco.textContent = "";
    if (!come) {
      riga.textContent = "Non lo so ancora: nessun telefono collegato.";
      return;
    }
    var quanti = Number(come.eventi) || 0;
    var quando = come.intero ? "nell'ultimo minuto" : "negli ultimi " + come.secondi + " s";
    riga.textContent =
      quanti === 0
        ? "Nessun evento " + quando + ": la casa sta zitta."
        : quanti + (quanti === 1 ? " evento " : " eventi ") + quando + ".";
    (come.quali || []).forEach(function (una) {
      var voce = vediPagina.createElement("li");
      var nome = vediPagina.createElement("div");
      nome.className = "nome";
      var forte = vediPagina.createElement("strong");
      /* `textContent`: il nome di un'entita' lo ha scritto chi ci abita. */
      forte.textContent = una.entita;
      var sotto = vediPagina.createElement("span");
      var suoi = Number(una.eventi) || 0;
      var fetta = quanti ? Math.round((suoi / quanti) * 100) : 0;
      sotto.textContent =
        suoi +
        (suoi === 1 ? " evento" : " eventi") +
        (quanti ? " · " + fetta + "% del traffico" : "");
      nome.appendChild(forte);
      nome.appendChild(sotto);
      /* La stessa percentuale, disegnata: tre numeri in colonna si confrontano
       * contando, tre barre si confrontano guardando. E' la stessa scala della
       * scritta di sopra — quanta parte del traffico di tutta la casa — non una
       * scala sua che farebbe sembrare la prima voce sempre piena. */
      if (quanti) {
        var quota = vediPagina.createElement("div");
        quota.className = "quota";
        var dentro = vediPagina.createElement("i");
        dentro.style.width = fetta + "%";
        quota.appendChild(dentro);
        nome.appendChild(quota);
      }
      voce.appendChild(nome);
      elenco.appendChild(voce);
    });
  }

  /* Se le plance sono davvero comparse fra le «Plance» di Home Assistant.
   *
   * E' la riga che mancava. Le plance le tiene il ponte, ma la voce nella
   * barra laterale la fa Home Assistant, e fra le due cose ci sono tre
   * passaggi che possono non riuscire — la cartina da scrivere, la risorsa da
   * dichiarare, la Plancia da creare. Quando non riescono, il ponte lo scrive
   * nel registro: cioe' in un posto dove nessuno guarda. Qui invece sta dove
   * si guarda, che e' accanto all'elenco. */
  function comeVannoLePlanceInCasa(esito) {
    if (!esito) return "Sto guardando se le plance sono fra le «Plance» di Home Assistant…";
    var riga = esito.fatto
      ? "Nella barra laterale di Home Assistant ci sono " +
        ((Number(esito.quante) || 0) === 1 ? "1 voce" : (Number(esito.quante) || 0) + " voci") +
        (esito.tolte ? ", e " + esito.tolte + " sono state levate" : "") +
        "."
      : "Le plance non sono nella barra laterale di Home Assistant: " + (esito.perche || "");
    /* Le cose che fanno uscire «Errore di configurazione» al posto della
     * plancia, e che da quella pagina non si capiscono: qui si dicono.
     *
     * La prima e' provata, non indovinata: `laCartinaSiScarica` la chiede a
     * Home Assistant da questa pagina, che sta sul suo stesso indirizzo. */
    if (esito.risorsa_guaio) {
      riga += " ⚠️ Lovelace non prende la cartina: " + esito.risorsa_guaio;
    } else if (cartinaChe === "no") {
      riga += " ⚠️ Home Assistant non serve la cartina della plancia.";
    } else if (cartinaChe === "rotta") {
      riga += " ⚠️ La cartina si scarica ma non registra la tessera.";
    } else if (cartinaChe === "si") {
      riga += " La cartina si scarica, e la tessera si registra.";
    } else if (esito.riavvia) {
      riga +=
        " ⚠️ Riavvia Home Assistant una volta (Impostazioni → Sistema → Riavvia):" +
        " la cartella «www» non c'era e l'ho fatta io, e Home Assistant i file che" +
        " stanno dentro li serve solo se quella cartella c'era quando è partito." +
        " Finché non riparte, aprendo la plancia esce «Errore di configurazione».";
    } else if (esito.ricarica) {
      riga +=
        " Ricarica la pagina di Home Assistant: la cartina è stata dichiarata adesso," +
        " e il browser la va a prendere al giro dopo.";
    }
    /* E cosa ne dice Home Assistant, riletto da lui: due fatti, non due
     * opinioni. Stanno sempre a schermo — anche quando va tutto bene — perche'
     * sono quelli che si guardano quando la plancia non si apre, e una riga
     * che compare solo nei guai e' una riga che nessuno sa dove cercare. */
    if (esito.risorsa_in_elenco === true) riga += " Lovelace ha la cartina in elenco.";
    if (esito.risorsa_in_elenco === false) riga += " ⚠️ Lovelace non ha la cartina in elenco.";
    if (esito.tessera_nella_vista)
      riga += " Nella Plancia c'è «" + esito.tessera_nella_vista + "».";
    return riga;
  }

  /* La cartina si scarica? Lo si chiede a Home Assistant.
   *
   * Questa pagina sta dentro l'ingress, cioe' **sullo stesso indirizzo** di
   * Home Assistant: un indirizzo che comincia per `/local/` da qui arriva a
   * lui, non a noi. E' l'unico posto da cui si possa provare quello che poi
   * prova il browser di chi apre la plancia.
   *
   * `""` vuol dire «non si e' ancora provato», e si dice diversamente da «no»:
   * un avviso grosso mostrato mentre ancora non si sa sarebbe un avviso
   * sbagliato meta' delle volte. */
  var cartinaChe = "";

  /* Dove sta la cartina, come l'ha detta il ponte: serve al bottone qui
   * sotto, che la carica nella pagina di Home Assistant. */
  var laCartina = "";

  /* Come si chiama la tessera: lo stesso nome sta in `carta/plancia.js`, ed e'
   * quello con cui Lovelace la cerca. Se nessuno l'ha registrata,
   * `custom:gdahome-plancia` non esiste e Home Assistant disegna «Errore di
   * configurazione» — senza dire questo, e senza dire niente altro. */
  var LA_TESSERA = "gdahome-plancia";

  function laCartinaSiScarica(dove) {
    if (dove) laCartina = dove;
    if (!dove || cartinaChe === "si") return Promise.resolve(cartinaChe);
    return fetch(dove, { cache: "no-store" })
      .then(function (risposta) {
        if (!risposta.ok) {
          cartinaChe = "no";
          return cartinaChe;
        }
        /* Si scarica. Allora si prova anche a **eseguirla**, perche' «il file
         * c'e'» e «la tessera esiste» sono due cose diverse e portano a due
         * rimedi diversi: un file che si scarica e non registra la tessera e'
         * un file rotto, e una tessera che si registra qui ma in una Plancia
         * non esiste vuol dire che Lovelace quella risorsa non la carica — il
         * browser che non l'ha ancora vista, o le dashboard tenute in YAML,
         * dove le risorse dallo storage non si leggono. */
        return import(dove).then(
          function () {
            cartinaChe = window.customElements.get(LA_TESSERA) ? "si" : "rotta";
            return cartinaChe;
          },
          function () {
            cartinaChe = "rotta";
            return cartinaChe;
          },
        );
      })
      .catch(function () {
        /* Senza rete non si sa, e non si dice niente: la riga resta quella. */
        cartinaChe = "";
        return cartinaChe;
      });
  }

  /* Il foglietto sotto la riga: si vede solo quando c'e' qualcosa da fare, e
   * dice **cosa** fare — non com'e' fatto il mondo. */
  /* La tessera **nella pagina di Home Assistant**, non in questa.
   *
   * Questa pagina gira dentro un riquadro, sullo stesso indirizzo di Home
   * Assistant: puo' guardare la sua. Ed e' li' che la tessera deve esistere —
   * qui non serve a niente.
   *
   * E' la differenza che mancava. Home Assistant l'elenco delle risorse lo
   * legge **quando la pagina si carica**: una pagina aperta prima che la
   * cartina esistesse non la conosce, e continua a non conoscerla finche' non
   * si ricarica per davvero — che nell'app di Home Assistant vuol dire
   * svuotarle la cache, non riaprirla. Da fuori sembra che l'add-on non
   * funzioni, e invece e' a posto da un pezzo. */
  function laTesseraNellaPagina() {
    try {
      var fuori = window.parent;
      if (!fuori || fuori === window || !fuori.customElements) return "non-lo-so";
      return fuori.customElements.get(LA_TESSERA) ? "si" : "no";
    } catch (_errore) {
      /* Se il riquadro non ci lascia guardare fuori, non si sa: e non si dice
       * niente, invece di dire una cosa a caso. */
      return "non-lo-so";
    }
  }

  /* E caricarcela, adesso.
   *
   * E' la stessa cosa che fa Home Assistant con le risorse di Lovelace — un
   * `<script type="module">` nella sua pagina — fatta a mano una volta sola.
   * Da li' in poi la tessera esiste in quella pagina e la Plancia si apre,
   * senza aspettare una ricarica che nell'app non si sa come si fa. */
  function caricaLaCartinaDiLa(dove) {
    try {
      var fuori = window.parent;
      if (!fuori || fuori === window) return Promise.resolve(false);
      var documento = fuori.document;
      var segno = documento.createElement("script");
      segno.type = "module";
      segno.src = new URL(dove, fuori.location.origin).href;
      return new Promise(function (finito) {
        segno.onload = function () {
          finito(laTesseraNellaPagina() === "si");
        };
        segno.onerror = function () {
          finito(false);
        };
        documento.head.appendChild(segno);
      });
    } catch (_errore) {
      return Promise.resolve(false);
    }
  }

  function avvisaSullaCartina(ilGuaioDellaRisorsa) {
    var dove = trova("avviso-cartina");
    if (!dove) return;
    var testo = "";
    if (ilGuaioDellaRisorsa) {
      testo =
        "La cartina sta sul disco ma Lovelace non la vuole dichiarare, e senza quella " +
        "la tessera della plancia non esiste in nessuna pagina: aprendola dalle " +
        "«Plance» esce «Errore di configurazione». Quasi sempre vuol dire che questa " +
        "casa tiene le dashboard in YAML (lovelace: mode: yaml in configuration.yaml): " +
        "lì Home Assistant le risorse dallo storage non le legge, e va dichiarata a " +
        "mano. Nel configuration.yaml: lovelace: mode: yaml, poi resources: con - url: " +
        "/local/gdahome/plancia.js  e  type: module. Poi riavvia Home Assistant. " +
        "Lovelace ha risposto: " +
        ilGuaioDellaRisorsa;
    } else if (cartinaChe === "no") {
      testo =
        "Home Assistant non serve la cartina della plancia, e senza quella la plancia " +
        "aperta dalle «Plance» esce con «Errore di configurazione». Riavvialo una volta " +
        "(Impostazioni → Sistema → Riavvia): la cartella «www» la apre quando parte, e i " +
        "file arrivati dopo li serve solo dal riavvio dopo.";
    } else if (cartinaChe === "rotta") {
      testo =
        "La cartina si scarica ma non registra la tessera: il file è arrivato rotto. " +
        "Riavvia l'add-on, che la riscrive da sé a ogni avvio; se succede ancora, " +
        "scrivilo dalle segnalazioni.";
    } else if (cartinaChe === "si" && laTesseraNellaPagina() === "no") {
      testo =
        "La cartina c'è e si scarica, ma **questa pagina di Home Assistant non ce l'ha**: " +
        "l'elenco delle risorse lo legge quando si carica, e questa si è caricata prima che " +
        "la cartina esistesse. Finché resta così, la plancia esce con «Errore di " +
        "configurazione» qualunque cosa faccia l'add-on. Il bottone qui sotto gliela mette " +
        "adesso: poi apri la plancia dalla barra laterale e si apre. Una volta sola — dalla " +
        "prossima ricarica vera se la prende da sé. Nell'app di Home Assistant la ricarica " +
        "vera è Impostazioni → App companion → Svuota la cache, e riaprire.";
    } else if (cartinaChe === "si") {
      testo =
        "Se aprendo la plancia dalle «Plance» esce «Errore di configurazione»: da qui la " +
        "cartina si scarica e la tessera si registra, quindi il file è a posto ed è " +
        "Lovelace che non la carica. Due cose, in quest'ordine. 1) Ricarica a fondo la " +
        "pagina di Home Assistant — nell'app: Impostazioni → App companion → Svuota la " +
        "cache, e riapri: una risorsa aggiunta adesso il browser la vede al giro dopo. " +
        "2) Se succede anche da un browser che non l'ha mai aperta, Home Assistant tiene " +
        "le dashboard in YAML (lovelace: mode: yaml) e le risorse dallo storage non le " +
        "legge: allora va dichiarata a mano in configuration.yaml — lovelace: resources: " +
        "- url: /local/gdahome/plancia.js  type: module.";
    }
    dove.textContent = testo;
    dove.hidden = !testo;
    /* Il bottone si vede solo quando c'e' davvero da premerlo. */
    var tasti = trova("ripara-cartina");
    if (tasti) tasti.hidden = !(cartinaChe === "si" && laTesseraNellaPagina() === "no");
  }

  trova("carica-la-cartina").addEventListener("click", function () {
    var tasto = trova("carica-la-cartina");
    tasto.disabled = true;
    caricaLaCartinaDiLa(laCartina).then(function (andata) {
      tasto.disabled = false;
      trova("avviso-cartina").textContent = andata
        ? "Fatto: adesso apri la plancia dalla barra laterale, si apre. Se la chiudi e " +
          "riapri l'app di Home Assistant senza svuotarle la cache, questa pagina torna " +
          "com'era e il bottone ricompare."
        : "Non ci sono riuscito da qui. Allora: Impostazioni → App companion → Svuota la " +
          "cache, e riapri Home Assistant.";
      if (andata) trova("ripara-cartina").hidden = true;
    });
  });

  function avvisaLePlance(testo) {
    var avviso = trova("avviso-plance");
    if (!avviso) return;
    avviso.textContent = testo || "";
    avviso.hidden = !testo;
  }

  /* Il link a gdahome da browser.
   *
   * Si vede solo se l'app c'e' davvero dentro questo add-on: un link che porta
   * a un 404 e' peggio di nessun link.
   *
   * E si dice subito, non dopo, se questa pagina e' aperta su un indirizzo
   * `http`: li' la plancia nel browser non si disegna — un service worker i
   * browser lo fanno girare solo su `https` o `localhost`, ed e' una regola
   * loro. Scoprirlo dopo aver aperto l'app, guardando un riquadro che spiega,
   * e' un giro piu' lungo per la stessa notizia. */
  function disegnaIlLink(ce) {
    trova("scheda-app").hidden = !ce;
    if (!ce) return;
    trova("avviso-sicuro").hidden = window.isSecureContext !== false;
  }

  /* L'indirizzo di gdahome da aprire fuori casa.
   *
   * Il centralino serve anche l'app, sotto `/app/`: e' lo stesso posto dove
   * la casa sta in attesa, ed e' pubblico e in `https`. L'indirizzo lo dice
   * il ponte — e' quello che ha in configurazione — e qui si trasforma da
   * `wss://…` in `https://…/app/`: sono lo stesso posto, e chiederlo due
   * volte a chi installa sarebbe chiederglielo una volta di troppo.
   *
   * Se il centralino e' spento («da fuori casa» a no) non c'e' nessun link da
   * dare, e la riga non compare. */
  function disegnaIlLinkDiFuori(dove) {
    var riquadro = trova("link-di-fuori");
    var indirizzo = "";
    try {
      if (dove) {
        var suo = new URL(String(dove).replace(/^ws/, "http"));
        /* Solo `https`: un link `http` non farebbe girare il service worker,
         * e la plancia nel browser non si disegnerebbe. Meglio nessun link
         * che un link che mostra mezza app. */
        if (suo.protocol === "https:") indirizzo = suo.origin + "/app/";
      }
    } catch (_male) {
      indirizzo = "";
    }
    riquadro.hidden = !indirizzo;
    if (!indirizzo) return;
    trova("link-di-fuori-indirizzo").textContent = indirizzo;
    trova("apri-di-fuori").href = indirizzo;
  }

  /* ─── L'aggiornamento del ponte ──────────────────────────────────────────
   *
   * Un add-on locale non ha nessun negozio dietro: Home Assistant guarda il
   * manifesto che trova in `/addons/gdahome`, e quella e' l'unica versione che
   * conosce. Finche' quei file non cambiano, «Aggiorna» non compare mai —
   * e a cambiarli serviva un terminale e un gettone da incollare ogni volta.
   * Da qui lo fa il ponte.
   */
  function avvisaSullAggiornamento(testo) {
    var avviso = trova("aggiornamento-avviso");
    avviso.textContent = testo || "";
    avviso.hidden = !testo;
  }

  function disegnaLAggiornamento(stato) {
    trova("aggiornamento").hidden = !stato.locale;
    if (!stato.locale) return;
    var riga = "Questo add-on è la versione " + (stato.mia || "—") + ".";
    var spiega = "";
    var siPuo = false;
    /* Il gettone non c'entra più niente.
     *
     * Finché la repository era privata, senza un gettone di GitHub non si
     * poteva nemmeno sapere che versione c'è: la richiesta tornava «non
     * esiste». Adesso è pubblica, il manifesto lo legge chiunque, e questa
     * scheda dice quello che sa — non se qualcuno ha incollato un gettone in
     * una casella. Quella casella è rimasta e si lascia vuota. */
    if (stato.cE === true) {
      riga += " C'è la " + stato.nuova + ".";
      spiega =
        "gdahome se la scarica, la mette al posto di questa e si ricostruisce. " +
        "Ci mette qualche minuto, e mentre lo fa questa pagina non risponde: è normale, " +
        "torna da sé.";
      siPuo = true;
    } else if (stato.cE === false) {
      riga += " È l'ultima.";
      spiega = "";
    } else {
      riga += " Non riesco a sapere se ce n'è una più nuova.";
      spiega = stato.guaio || "";
    }
    trova("aggiornamento-riga").textContent = riga;
    trova("aggiornamento-spiega").textContent = spiega;
    trova("aggiorna-il-ponte").hidden = !siPuo;
  }

  function guardaLAggiornamento() {
    return chiedi("api/aggiornamento")
      .then(disegnaLAggiornamento)
      .catch(function () {
        /* Un ponte vecchio non ha questa via: la scheda resta nascosta, e non
         * si scrive nessun errore per una cosa che non c'e' ancora. */
      });
  }

  trova("riguarda").addEventListener("click", function () {
    avvisaSullAggiornamento("");
    trova("riguarda").disabled = true;
    guardaLAggiornamento().then(function () {
      trova("riguarda").disabled = false;
    });
  });

  trova("aggiorna-il-ponte").addEventListener("click", function () {
    avvisaSullAggiornamento("Sto scaricando la versione nuova…");
    trova("aggiorna-il-ponte").disabled = true;
    chiedi("api/aggiornamento", { method: "POST" })
      .then(function (fatto) {
        avvisaSullAggiornamento(
          "La " +
            fatto.versione +
            " è dentro. Mi sto ricostruendo: fra un minuto o due ricarica questa pagina.",
        );
      })
      .catch(function (errore) {
        avvisaSullAggiornamento(errore.message);
        trova("aggiorna-il-ponte").disabled = false;
      });
  });

  function aggiornaTutto() {
    return chiedi("api/stato")
      .then(function (stato) {
        var laCasa = comeVaLaCasa(stato.casa);
        pastiglia("pas-casa", laCasa.come, laCasa.corto);
        trova("spiega-casa").textContent = laCasa.lungo;
        trova("porta").textContent = stato.porta;
        var fuori = comeVaIlCentralino(stato.centralino);
        pastiglia("pas-fuori", fuori.come, fuori.corto);
        trova("spiega-centralino").textContent = fuori.lungo;
        /* La versione, sempre a schermo accanto al nome: oggi si leggeva solo
         * dentro una scheda che compare soltanto sugli add-on locali, e a chi
         * l'ha preso dal negozio non la diceva nessuno. */
        if (stato.versione) {
          trova("targhetta").textContent = stato.versione;
          trova("targhetta").hidden = false;
        }
        /* L'assistenza: la scheda compare solo dove la chiave c'e'.
         *
         * E' l'unico posto dove si legge che quella chiave e' arrivata: Home
         * Assistant un campo `password` lo nasconde e non lo rimostra, quindi
         * chi l'ha appena incollata riapre la scheda, trova la casella vuota e
         * non ha modo di sapere se sia stata presa. */
        var risponde = Boolean(stato.assistenza && stato.assistenza.console);
        trova("assistenza").hidden = !risponde;
        if (risponde) {
          trova("stato-assistenza").textContent =
            "Questa casa risponde alle chat di assistenza: la console è accesa.";
        }
        /* La diagnostica del traffico si vede **solo dove si risponde**.
         *
         * A chi ha gdahome in casa quella scheda non serve e spaventa: elenca
         * entita' col nome tecnico, conta eventi al minuto, e parla di filtri
         * da mettere in Home Assistant. Serve a chi guarda una casa che va a
         * scatti per capire da dove comincia il traffico — e quello e' chi
         * risponde alle segnalazioni, cioe' chi ha la chiave della console.
         *
         * Si appoggia alla stessa condizione dell'assistenza apposta: una
         * condizione sola, un posto solo dove cambiarla. */
        trova("chiacchieroni").hidden = !risponde;
        if (risponde) disegnaIChiacchieroni(stato.chiacchieroni);
        disegnaLaProvenienza(stato.plancia);
        disegnaIlLink(stato.app);
        disegnaIlLinkDiFuori(stato.app ? stato.centralino.dove : "");
        disegnaIDispositivi(stato.dispositivi, stato.massimi);
        disegnaLePlance(stato.plance);
        /* La riga si scrive subito con quello che si sa, e si riscrive quando
         * la prova della cartina torna: chi guarda vede una frase giusta
         * adesso e una piu' precisa mezzo secondo dopo, invece di un vuoto. */
        trova("stato-plance-in-casa").textContent = comeVannoLePlanceInCasa(stato.plance_in_casa);
        laCartinaSiScarica(stato.plance_in_casa && stato.plance_in_casa.cartina).then(function () {
          trova("stato-plance-in-casa").textContent = comeVannoLePlanceInCasa(stato.plance_in_casa);
          avvisaSullaCartina(stato.plance_in_casa && stato.plance_in_casa.risorsa_guaio);
        });
        trova("fabbrica").disabled = stato.dispositivi.length >= stato.massimi;
        if (!stato.abbinamento.attivo) nascondiIlCodice();
        avvisa("");
        /* Un codice ancora buono si rimette a schermo da solo.
         *
         * Serve a un caso che capita davvero: la pagina si ricarica — un tocco
         * per sbaglio, l'add-on che si riavvia, la scheda che si riapre —
         * mentre il codice vale ancora. Senza questo, chi sta inquadrando deve
         * fabbricarne un altro, cioe' buttare via un codice buono e
         * ricominciare davanti a qualcuno che aspetta. */
        if (stato.abbinamento.attivo && trova("codice-vivo").hidden) return riprendiIlCodice();
        return undefined;
      })
      .catch(function (errore) {
        pastiglia("pas-casa", "male", "non si legge");
        trova("spiega-casa").textContent = "La console non riesce a leggere lo stato di gdahome.";
        avvisa(errore.message);
      });
  }

  function riprendiIlCodice() {
    return chiedi("api/codice")
      .then(function (vivo) {
        if (vivo.attivo) disegnaIlCodice(vivo.codice, vivo.scadeIl);
      })
      .catch(function () {
        /* Se non si riesce a riprenderlo si resta senza: il bottone e' li'. */
      });
  }

  /* «Per chi e'» il codice: si riempie con gli utenti della casa.
   *
   * Compare solo se ce n'e' piu' di uno: in una casa con un utente solo non
   * c'e' niente da scegliere, e una casella con una voce sola fa una domanda
   * inutile. Di serie resta su «chi sta usando questa pagina», che e' quello
   * che serve quasi sempre. */
  function riempiIlPerChi() {
    var riga = trova("per-chi-riga");
    var scelta = trova("per-chi");
    if (!riga || !scelta) return;
    chiediGliUtenti()
      .then(function (utenti) {
        if (utenti.length < 2) {
          riga.hidden = true;
          return;
        }
        var prima = scelta.value;
        scelta.textContent = "";
        var chiPreme = vediPagina.createElement("option");
        chiPreme.value = "";
        chiPreme.textContent = "chi sta usando questa pagina";
        scelta.appendChild(chiPreme);
        utenti.forEach(function (uno) {
          var voce = vediPagina.createElement("option");
          voce.value = uno.id;
          /* `textContent`: il nome di un utente l'ha scritto una persona. */
          voce.textContent = uno.nome;
          scelta.appendChild(voce);
        });
        scelta.value = prima || "";
        riga.hidden = false;
      })
      .catch(function () {
        /* Senza l'elenco non si puo' scegliere, e non e' un guaio: il codice
         * si fabbrica comunque, intestato a chi sta premendo. */
        riga.hidden = true;
      });
  }

  riempiIlPerChi();

  trova("fabbrica").addEventListener("click", function () {
    avvisa("");
    var scelta = trova("per-chi");
    var riga = trova("per-chi-riga");
    var voluto = scelta && riga && !riga.hidden ? scelta.value : "";
    chiedi("api/codice", {
      method: "POST",
      body: JSON.stringify(voluto ? { utente: voluto } : {}),
    })
      .then(function (fatto) {
        disegnaIlCodice(fatto.codice, fatto.scadeIl);
      })
      .catch(function (errore) {
        avvisa(errore.message);
      });
  });

  /* Aggiungere una plancia: un nome, e il tasto.
   *
   * Il nome non e' obbligatorio — chi lascia la casella vuota si prende
   * «Plancia», che si rinomina dopo — e con Invio si aggiunge, che e' quello
   * che fa un dito su una casella di testo. */
  function aggiungiUnaPlancia() {
    var casella = trova("titolo-plancia");
    var tasto = trova("aggiungi-plancia");
    avvisaLePlance("");
    tasto.disabled = true;
    chiedi("api/plance", {
      method: "POST",
      body: JSON.stringify({ titolo: casella.value }),
    })
      .then(function () {
        casella.value = "";
        return aggiornaTutto();
      })
      .catch(function (errore) {
        tasto.disabled = false;
        avvisaLePlance(errore.message);
      });
  }

  trova("aggiungi-plancia").addEventListener("click", aggiungiUnaPlancia);
  trova("titolo-plancia").addEventListener("keydown", function (evento) {
    if (evento.key === "Enter") aggiungiUnaPlancia();
  });

  trova("annulla").addEventListener("click", function () {
    chiedi("api/codice", { method: "DELETE" }).then(function () {
      nascondiIlCodice();
      aggiornaTutto();
    });
  });

  aggiornaTutto();
  setInterval(aggiornaTutto, 10000);
  /* La versione nuova si guarda all'apertura e poi ogni dieci minuti: la
   * risposta arriva da GitHub, e una cosa che cambia una volta al giorno non
   * si chiede ogni dieci secondi come il resto. */
  guardaLAggiornamento();
  setInterval(guardaLAggiornamento, 10 * 60 * 1000);
})();
