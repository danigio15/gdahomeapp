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

  /* ─── Le due lingue ──────────────────────────────────────────────────────── */

  /* In che lingua si legge questa pagina.
   *
   * La regola e' quella dell'app (`app/lib/parole.dart`): fra le lingue del
   * browser si prende la prima che sappiamo dire; se non ne sappiamo nessuna
   * si dice in inglese, che e' la lingua di chi non ha la nostra.
   *
   * Non si guarda la lingua di Home Assistant: questa pagina sta dentro un
   * telaio, e da dentro quel telaio la lingua di HA non si vede senza aprirgli
   * un filo. Quella del browser e' la stessa cosa in quasi tutti i casi — chi
   * tiene HA in inglese ha il browser in inglese — e non costa niente. */
  var INGLESE = (function () {
    var quali =
      navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language || ""];
    for (var i = 0; i < quali.length; i += 1) {
      var codice = String(quali[i]).slice(0, 2).toLowerCase();
      if (codice === "it") return false;
      if (codice === "en") return true;
    }
    return true;
  })();

  /* La stessa frase nelle due lingue, una accanto all'altra.
   *
   * Come `inLingua` nell'app, e per lo stesso motivo: una traduzione che sta
   * lontana dal suo originale invecchia da sola, e nessuno se ne accorge
   * finche' non la legge un inglese. */
  function due(it, en) {
    return INGLESE ? en : it;
  }

  /* Le parole inglesi della pagina stanno **nella pagina**, in `data-en`
   * accanto alle italiane: si rileggono una accanto all'altra, e non c'e' una
   * seconda copia di `index.html` da tenere allineata.
   *
   * `data-en` porta il contenuto — anche col suo `<b>` dentro, che in una
   * frase serve — e si scrive prima che qualunque cosa si agganci a quei nodi.
   * `data-en-<attributo>` invece porta un attributo: `data-en-placeholder`
   * riempie `placeholder`, `data-en-aria-label` riempie `aria-label`. */
  function laPaginaNellaSuaLingua() {
    if (!INGLESE) return;
    vediPagina.documentElement.lang = "en";
    var tutti = vediPagina.querySelectorAll("[data-en]");
    for (var i = 0; i < tutti.length; i += 1) {
      tutti[i].innerHTML = tutti[i].getAttribute("data-en");
    }
    var conAttributi = vediPagina.querySelectorAll("*");
    for (var q = 0; q < conAttributi.length; q += 1) {
      var nodo = conAttributi[q];
      for (var a = nodo.attributes.length - 1; a >= 0; a -= 1) {
        var nome = nodo.attributes[a].name;
        if (nome.indexOf("data-en-") !== 0) continue;
        nodo.setAttribute(nome.slice("data-en-".length), nodo.attributes[a].value);
      }
    }
  }

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
          throw new Error(
            corpo && corpo.errore ? corpo.errore : due("non ha funzionato", "it didn't work"),
          );
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
    if (!mancano) return due("scaduto", "expired");
    var minuti = Math.floor(mancano / 60);
    var secondi = mancano % 60;
    var quanto = (minuti ? minuti + " min " : "") + secondi + " s";
    return due("vale ancora " + quanto, "good for another " + quanto);
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
    if (quale === "android") return due("Telefono Android", "Android phone");
    if (quale === "ios") return "iPhone";
    if (quale === "web") return due("Browser", "Browser");
    return due("Dispositivo", "Device");
  }

  /* Cos'e' questo, detto a parole.
   *
   * In un elenco «android» e «sconosciuto» non dicono niente: chi guarda vuole
   * sapere se quella riga e' l'app o il browser, perche' la stessa persona si
   * abbina da tutti e due e le righe si somigliano tutte. «sconosciuto» resta
   * sui dispositivi di prima, e allora si dice com'e': non lo ha detto. */
  function comEFatto(sistema) {
    var quale = String(sistema || "").toLowerCase();
    if (quale === "web") return due("browser", "browser");
    if (quale === "android") return due("app su Android", "app on Android");
    if (quale === "ios") return due("app su iPhone", "app on iPhone");
    if (!quale || quale === "sconosciuto") return due("non dice cos'è", "doesn't say what it is");
    return quale;
  }

  function dataLeggibile(quando) {
    if (!quando) return due("mai", "never");
    try {
      var q = new Date(quando);
      var ora = q.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      var oggi = new Date();
      var ieri = new Date(oggi.getTime() - 24 * 60 * 60 * 1000);
      if (q.toDateString() === oggi.toDateString())
        return due("oggi alle " + ora, "today at " + ora);
      if (q.toDateString() === ieri.toDateString())
        return due("ieri alle " + ora, "yesterday at " + ora);
      var giorno = q.toLocaleDateString([], { day: "numeric", month: "long" });
      return due(giorno + " alle " + ora, giorno + " at " + ora);
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
        corto: due("risponde", "answering"),
        lungo: due(
          "Home Assistant risponde, e gdahome è in piedi.",
          "Home Assistant answers, and gdahome is up.",
        ),
      };
    }
    return {
      come: "male",
      corto: due("non risponde", "not answering"),
      lungo:
        due("Home Assistant non risponde: ", "Home Assistant isn't answering: ") +
        ((casa && casa.perche) || due("non dice perché", "it doesn't say why")),
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
        corto: due("spento", "off"),
        lungo: due(
          "Nessun centralino: da fuori casa l'app non entra. Si riaccende con " +
            "«da fuori casa» nelle opzioni di questo add-on.",
          "No relay: from away the app cannot get in. You turn it back on with " +
            "\u201Cfrom away\u201D in this add-on's options.",
        ),
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
        corto: due("rifiutati", "turned away"),
        lungo:
          due("Il centralino ci rifiuta: ", "The relay turns us away: ") + centralino.rifiutata,
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
        corto: centralino.perche
          ? due("non entra — ", "can't get in — ") + centralino.perche
          : due("sto chiamando…", "calling…"),
        lungo:
          due("Sto chiamando ", "Calling ") +
          (dove || due("il centralino", "the relay")) +
          "…" +
          (centralino.perche
            ? due(" L'ultimo tentativo: ", " The last attempt: ") + centralino.perche + "."
            : ""),
      };
    }
    return {
      come: "bene",
      corto: due("si entra", "reachable"),
      lungo: due(
        "Collegato a " + (dove || "il centralino") + ": da fuori casa si entra.",
        "Connected to " + (dove || "the relay") + ": from away you get in.",
      ),
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
          originale: due("originale", "original"),
          "non-firmata": due("intatta", "untouched"),
          modificata: due("modificata", "changed"),
          "senza-origine": due("provenienza sconosciuta", "origin unknown"),
        }[plancia.stato],
    );
    spiega.textContent =
      plancia.stato === "originale"
        ? due(
            quale + ": ogni file è quello pubblicato, e la firma lo conferma.",
            quale + ": every file is the published one, and the signature says so.",
          )
        : plancia.stato === "non-firmata"
          ? due(
              quale +
                ": ogni file torna con le impronte scritte dentro. Manca solo la firma di chi l'ha pubblicata.",
              quale +
                ": every file matches the fingerprints written inside. Only the publisher's signature is missing.",
            )
          : plancia.stato === "modificata"
            ? due(
                "Qualcosa qui dentro non è come è stato pubblicato: " +
                  plancia.perche +
                  ". Se non l'hai toccata tu, reinstalla l'add-on.",
                "Something in here is not as it was published: " +
                  plancia.perche +
                  ". If you didn't touch it yourself, reinstall the add-on.",
              )
            : plancia.perche || "";
    var elenco = plancia.quali || [];
    quali.hidden = elenco.length === 0;
    if (elenco.length) {
      trova("provenienza-elenco").textContent =
        elenco.join("\n") +
        (plancia.quanti > elenco.length
          ? due(
              "\n… e altri " + (plancia.quanti - elenco.length),
              "\n… and " + (plancia.quanti - elenco.length) + " more",
            )
          : "");
    }
  }

  function disegnaIDispositivi(dispositivi, massimi) {
    var elenco = trova("elenco");
    elenco.textContent = "";
    trova("conteggio").textContent = due(
      dispositivi.length +
        " di " +
        massimi +
        (dispositivi.length === 1 ? " telefono" : " telefoni"),
      dispositivi.length + " of " + massimi + (dispositivi.length === 1 ? " phone" : " phones"),
    );

    if (!dispositivi.length) {
      var vuoto = vediPagina.createElement("li");
      vuoto.className = "vuoto";
      vuoto.textContent = due("Nessun telefono abbinato.", "No phone paired.");
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
        (uno.collegati
          ? due("collegato adesso", "connected right now")
          : due("visto ", "seen ") + dataLeggibile(uno.vistoIl)) +
        (diChi ? " · " + diChi : "");
      nome.appendChild(forte);
      nome.appendChild(sotto);
      riga.appendChild(nome);

      var stacca = vediPagina.createElement("button");
      stacca.className = "tenue";
      stacca.type = "button";
      stacca.textContent = due("Togli associazione", "Unpair");
      stacca.addEventListener("click", function () {
        if (
          !window.confirm(
            due(
              "Togliere l'associazione di «" + comeSiChiama(uno) + "»? Dovrà riabbinarsi da capo.",
              "Unpair \u201C" +
                comeSiChiama(uno) +
                "\u201D? It will have to pair again from scratch.",
            ),
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
      if (suoi.length === 1) chi.push(due("la vede 1 utente", "1 user sees it"));
      else if (suoi.length > 1)
        chi.push(due("la vedono " + suoi.length + " utenti", suoi.length + " users see it"));
      if (una.solo_admin) chi.push(due("solo amministratori", "admins only"));
      if (chi.length === 0) chi.push(due("la vedono tutti", "everyone sees it"));
      sotto.textContent =
        (una.primaria
          ? due("la prima, quella di sempre", "the first one, the one always here")
          : due("aggiunta da te", "added by you")) +
        " · " +
        chi.join(" · ");
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
      apri.textContent = due("Apri", "Open");
      apri.target = "_blank";
      apri.rel = "noopener";
      apri.href = una.primaria ? "plancia/" : "plancia/" + encodeURIComponent(una.profilo) + "/";
      tasti.appendChild(apri);

      var rinomina = vediPagina.createElement("button");
      rinomina.className = "tenue";
      rinomina.type = "button";
      rinomina.textContent = due("Rinomina", "Rename");
      rinomina.addEventListener("click", function () {
        var come = window.prompt(
          due("Come si chiama questa plancia?", "What is this dashboard called?"),
          una.titolo,
        );
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
        togli.textContent = due("Togli", "Remove");
        togli.addEventListener("click", function () {
          if (
            !window.confirm(
              due(
                "Togliere «" +
                  una.titolo +
                  "»? Va via anche come l'hai configurata: sezioni, tessere, stanze. Non si rimette a posto.",
                "Remove \u201C" +
                  una.titolo +
                  "\u201D? The way you configured it goes too: sections, cards, rooms. There is no putting it back.",
              ),
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
      chiLaVede.textContent = due("Chi la vede", "Who sees it");
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
    if (!cercato) return due("vede tutte le plance", "sees every dashboard");
    if (!gliUtenti) return "";
    var uno = null;
    for (var quale = 0; quale < gliUtenti.length; quale += 1) {
      if (gliUtenti[quale].id === cercato) uno = gliUtenti[quale];
    }
    return uno ? due("di " + uno.nome, uno.nome + "'s") : "";
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
      attesa.textContent = due(
        "Sto chiedendo a Home Assistant chi c'è in casa…",
        "Asking Home Assistant who lives here…",
      );
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
          spiega.textContent = due(
            "La vedono tutti quelli che entrano in questa casa. Riservala qui sotto.",
            "Everyone who gets into this home sees it. Reserve it below.",
          );
        } else if (suoi.length === 0) {
          spiega.textContent = due(
            "La vedono solo gli amministratori della casa. Spegni tutto per riaprirla a tutti.",
            "Only the home's admins see it. Turn everything off to reopen it to everyone.",
          );
        } else if (!admin) {
          spiega.textContent = due(
            "La vedono solo gli utenti spuntati. Spegni tutto per riaprirla a tutti.",
            "Only the ticked users see it. Turn everything off to reopen it to everyone.",
          );
        } else {
          spiega.textContent = due(
            "La vedono solo gli utenti spuntati, e solo se amministrano la casa. " +
              "Spegni tutto per riaprirla a tutti.",
            "Only the ticked users see it, and only if they administer the home. " +
              "Turn everything off to reopen it to everyone.",
          );
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
        comeSiChiama.textContent = due(
          "Solo gli amministratori della casa",
          "Only the home's admins",
        );
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
        quali.textContent = due("e anche, solo questi utenti", "and also, only these users");
        dove.appendChild(quali);

        if (utenti.length === 0) {
          var vuoto = vediPagina.createElement("p");
          vuoto.className = "minuta";
          vuoto.textContent = due(
            "In questa casa c'è un utente solo: non c'è niente da scegliere.",
            "This home has a single user: there is nothing to choose.",
          );
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
          nome.textContent =
            uno.nome + (uno.amministratore ? due(" · amministratore", " · admin") : "");
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
          due(
            "Non riesco a chiedere a Home Assistant chi c'è in casa: ",
            "I can't ask Home Assistant who lives here: ",
          ) + errore.message;
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
      riga.textContent = due(
        "Non lo so ancora: nessun telefono collegato.",
        "I don't know yet: no phone connected.",
      );
      return;
    }
    var quanti = Number(come.eventi) || 0;
    var quando = come.intero
      ? due("nell'ultimo minuto", "in the last minute")
      : due("negli ultimi " + come.secondi + " s", "in the last " + come.secondi + " s");
    riga.textContent =
      quanti === 0
        ? due(
            "Nessun evento " + quando + ": la casa sta zitta.",
            "No events " + quando + ": the home is quiet.",
          )
        : due(
            quanti + (quanti === 1 ? " evento " : " eventi ") + quando + ".",
            quanti + (quanti === 1 ? " event " : " events ") + quando + ".",
          );
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
      sotto.textContent = due(
        suoi +
          (suoi === 1 ? " evento" : " eventi") +
          (quanti ? " · " + fetta + "% del traffico" : ""),
        suoi +
          (suoi === 1 ? " event" : " events") +
          (quanti ? " · " + fetta + "% of the traffic" : ""),
      );
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
  /* La versione scritta in fondo all'indirizzo della cartina: `?v=1.4.32.6`.
   *
   * Vuota se non c'e' — un indirizzo scritto a mano, una cartina registrata da
   * una versione che non la metteva — e allora non si dice niente invece di
   * dire una cosa sbagliata. */
  function laVersioneDellaCartina(indirizzo) {
    const pezzi = /[?&]v=([^&]+)/.exec(String(indirizzo || ""));
    if (!pezzi) return "";
    try {
      return decodeURIComponent(pezzi[1]);
    } catch (_errore) {
      return pezzi[1];
    }
  }

  function comeVannoLePlanceInCasa(esito) {
    if (!esito)
      return due(
        "Sto guardando se le plance sono fra le «Plance» di Home Assistant…",
        "Checking whether the dashboards are among Home Assistant's \u201CDashboards\u201D…",
      );
    var quante = Number(esito.quante) || 0;
    var riga = esito.fatto
      ? due(
          "Nella barra laterale di Home Assistant ci sono " +
            (quante === 1 ? "1 voce" : quante + " voci") +
            (esito.tolte ? ", e " + esito.tolte + " sono state levate" : "") +
            ".",
          "The Home Assistant sidebar has " +
            (quante === 1 ? "1 entry" : quante + " entries") +
            (esito.tolte ? ", and " + esito.tolte + " were taken away" : "") +
            ".",
        )
      : due(
          "Le plance non sono nella barra laterale di Home Assistant: ",
          "The dashboards are not in the Home Assistant sidebar: ",
        ) + (esito.perche || "");
    /* Le cose che fanno uscire «Errore di configurazione» al posto della
     * plancia, e che da quella pagina non si capiscono: qui si dicono.
     *
     * La prima e' provata, non indovinata: `laCartinaSiScarica` la chiede a
     * Home Assistant da questa pagina, che sta sul suo stesso indirizzo. */
    if (esito.risorsa_guaio) {
      riga +=
        due(" ⚠️ Lovelace non prende la cartina: ", " ⚠️ Lovelace won't take the panel file: ") +
        esito.risorsa_guaio;
    } else if (cartinaChe === "no") {
      riga += due(
        " ⚠️ Home Assistant non serve la cartina della plancia.",
        " ⚠️ Home Assistant isn't serving the dashboard's panel file.",
      );
    } else if (cartinaChe === "rotta") {
      riga += due(
        " ⚠️ La cartina si scarica ma non registra la tessera.",
        " ⚠️ The panel file downloads but registers no card.",
      );
    } else if (cartinaChe === "si") {
      riga += due(
        " La cartina si scarica, e la tessera si registra.",
        " The panel file downloads, and the card registers.",
      );
    } else if (esito.riavvia) {
      riga += due(
        " ⚠️ Riavvia Home Assistant una volta (Impostazioni → Sistema → Riavvia):" +
          " la cartella «www» non c'era e l'ho fatta io, e Home Assistant i file che" +
          " stanno dentro li serve solo se quella cartella c'era quando è partito." +
          " Finché non riparte, aprendo la plancia esce «Errore di configurazione».",
        " ⚠️ Restart Home Assistant once (Settings → System → Restart):" +
          " the \u201Cwww\u201D folder wasn't there and I made it, and Home Assistant" +
          " serves the files inside it only if that folder existed when it started." +
          " Until it restarts, opening the dashboard gives \u201CConfiguration error\u201D.",
      );
    } else if (esito.ricarica) {
      riga += due(
        " Ricarica la pagina di Home Assistant: la cartina è stata dichiarata adesso," +
          " e il browser la va a prendere al giro dopo.",
        " Reload the Home Assistant page: the panel file has just been declared," +
          " and the browser picks it up on the next round.",
      );
    } else if (esito.aggiornata) {
      /* La riga che mancava, e si è vista: l'add-on aggiornato, la pagina no.
       *
       * L'elenco delle risorse Home Assistant lo legge all'avvio della pagina.
       * Su una pagina già aperta continua a girare la cartina di prima, e
       * qualunque correzione ci sia dentro quella nuova non arriva — mentre
       * qui c'era scritto che andava tutto bene. */
      riga += due(
        " ⚠️ Ricarica questa pagina di Home Assistant (F5): la cartina della" +
          " plancia è passata a questa versione, ma una pagina già aperta" +
          " continua a far girare quella di prima — e le correzioni non si" +
          " vedono. Si fa una volta per aggiornamento.",
        " ⚠️ Reload this Home Assistant page (F5): the dashboard's panel file" +
          " moved to this version, but an already open page keeps running the" +
          " previous one — and the fixes don't show. Once per update.",
      );
    }
    /* E cosa ne dice Home Assistant, riletto da lui: due fatti, non due
     * opinioni. Stanno sempre a schermo — anche quando va tutto bene — perche'
     * sono quelli che si guardano quando la plancia non si apre, e una riga
     * che compare solo nei guai e' una riga che nessuno sa dove cercare. */
    if (esito.risorsa_in_elenco === true) {
      /* **Quale** cartina, non solo «ce l'ha».
       *
       * L'indirizzo porta la versione dell'add-on, e cambia a ogni
       * aggiornamento proprio perche' il browser vada a riprendere il file. Ma
       * l'elenco delle risorse Home Assistant lo legge all'avvio della pagina:
       * finche' non si ricarica, la pagina fa girare la cartina di prima anche
       * se in elenco c'e' gia' quella nuova. Erano due cose diverse che si
       * leggevano uguali, e chi guardava una correzione che non arrivava non
       * aveva modo di sapere se mancava l'aggiornamento o solo un F5. */
      const quale = laVersioneDellaCartina(esito.cartina_in_elenco);
      riga += due(
        " Lovelace ha la cartina in elenco" + (quale ? " (" + quale + ")" : "") + ".",
        " Lovelace lists the panel file" + (quale ? " (" + quale + ")" : "") + ".",
      );
    }
    if (esito.risorsa_in_elenco === false)
      riga += due(
        " ⚠️ Lovelace non ha la cartina in elenco.",
        " ⚠️ Lovelace doesn't list the panel file.",
      );
    if (esito.tessera_nella_vista)
      riga += due(
        " Nella Plancia c'è «" + esito.tessera_nella_vista + "».",
        " The dashboard holds \u201C" + esito.tessera_nella_vista + "\u201D.",
      );
    /* La Plancia rimasta dall'integrazione, ed e' la riga che mancava.
     *
     * Qualcuno ha riavviato Home Assistant tre volte su una voce che nessun
     * riavvio puo' aggiustare, e poi e' andato a chiederlo su Facebook. Il
     * ponte quell'elenco ce l'aveva — lo scriveva nel registro — e qui non
     * compariva. Sta **prima** delle altre righe perche', quando c'e', e'
     * quasi sempre la voce che hanno aperto. */
    var diPrima = Array.isArray(esito.plance_di_prima) ? esito.plance_di_prima : [];
    if (diPrima.length) {
      var nomi = diPrima
        .map(function (una) {
          return "«" + (una.titolo || una.dove) + "»";
        })
        .join(", ");
      riga +=
        due(
          " ⚠️ Nella barra laterale c'è ancora " +
            nomi +
            ", dell'integrazione DashboardModern e non di gdahome." +
            " Se l'integrazione non c'è più, quella voce apre con «Errore di configurazione»" +
            " e non si aggiusta riavviando: si leva da Impostazioni → Dashboard." +
            " Questo add-on non la tocca.",
          " ⚠️ Your sidebar still has " +
            nomi +
            ", from the DashboardModern integration and not from gdahome." +
            " If the integration is gone, that entry opens with a configuration error" +
            " and restarting won't fix it: remove it from Settings → Dashboards." +
            " This add-on doesn't touch it.",
        ) + " ";
    }

    /* E cosa ci trova, adesso, chi apre quella voce. Quando la cartina non si
     * serve il ponte ci scrive un foglietto — quello che dice di riavviare —
     * al posto della plancia: è la cosa da sapere per prima, perché è quella
     * che stanno guardando gli altri. */
    if (esito.tessera_nella_vista === "markdown")
      riga +=
        esito.manca === "ricarica"
          ? due(
              " Chi la apre adesso legge il foglietto che dice di ricaricare la pagina, non la" +
                " plancia: la cartina è stata dichiarata adesso, e una pagina già aperta i file" +
                " nuovi li prende quando riparte. Torna la plancia da sé.",
              " Whoever opens it now reads the note telling them to reload the page, not the" +
                " dashboard: the panel file has just been declared, and a page that is already" +
                " open picks up new files when it restarts. It goes back by itself.",
            )
          : due(
              " Chi la apre adesso legge il foglietto che dice di riavviare, non la plancia:" +
                " ci torna da sé appena Home Assistant serve la cartina.",
              " Whoever opens it now reads the note telling them to restart, not the dashboard:" +
                " it goes back by itself as soon as Home Assistant serves the panel file.",
            );
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
        due(
          "La cartina sta sul disco ma Lovelace non la vuole dichiarare, e senza quella " +
            "la tessera della plancia non esiste in nessuna pagina: aprendola dalle " +
            "«Plance» esce «Errore di configurazione». Quasi sempre vuol dire che questa " +
            "casa tiene le dashboard in YAML (lovelace: mode: yaml in configuration.yaml): " +
            "lì Home Assistant le risorse dallo storage non le legge, e va dichiarata a " +
            "mano. Nel configuration.yaml: lovelace: mode: yaml, poi resources: con - url: " +
            "/local/gdahome/plancia.js  e  type: module. Poi riavvia Home Assistant. " +
            "Lovelace ha risposto: ",
          "The panel file is on disk but Lovelace won't declare it, and without that " +
            "the dashboard's card exists on no page: opening it from " +
            "\u201CDashboards\u201D gives \u201CConfiguration error\u201D. Nearly always " +
            "this means this home keeps its dashboards in YAML (lovelace: mode: yaml in " +
            "configuration.yaml): there Home Assistant does not read resources from " +
            "storage, and it has to be declared by hand. In configuration.yaml: lovelace: " +
            "mode: yaml, then resources: with - url: /local/gdahome/plancia.js  and  " +
            "type: module. Then restart Home Assistant. Lovelace answered: ",
        ) + ilGuaioDellaRisorsa;
    } else if (cartinaChe === "no") {
      testo = due(
        "Home Assistant non serve la cartina della plancia, e senza quella la plancia " +
          "aperta dalle «Plance» esce con «Errore di configurazione». Riavvialo una volta " +
          "(Impostazioni → Sistema → Riavvia): la cartella «www» la apre quando parte, e i " +
          "file arrivati dopo li serve solo dal riavvio dopo.",
        "Home Assistant isn't serving the dashboard's panel file, and without it the " +
          "dashboard opened from \u201CDashboards\u201D gives \u201CConfiguration " +
          "error\u201D. Restart it once (Settings → System → Restart): it opens the " +
          "\u201Cwww\u201D folder when it starts, and files that arrive later it serves " +
          "only from the next restart on.",
      );
    } else if (cartinaChe === "rotta") {
      testo = due(
        "La cartina si scarica ma non registra la tessera: il file è arrivato rotto. " +
          "Riavvia l'add-on, che la riscrive da sé a ogni avvio; se succede ancora, " +
          "scrivilo dalle segnalazioni.",
        "The panel file downloads but registers no card: the file arrived broken. " +
          "Restart the add-on, which rewrites it by itself at every start; if it happens " +
          "again, say so from the reports.",
      );
    } else if (cartinaChe === "si" && laTesseraNellaPagina() === "no") {
      testo = due(
        "La cartina c'è e si scarica, ma **questa pagina di Home Assistant non ce l'ha**: " +
          "l'elenco delle risorse lo legge quando si carica, e questa si è caricata prima che " +
          "la cartina esistesse. Finché resta così, la plancia esce con «Errore di " +
          "configurazione» qualunque cosa faccia l'add-on. Il bottone qui sotto gliela mette " +
          "adesso: poi apri la plancia dalla barra laterale e si apre. Una volta sola — dalla " +
          "prossima ricarica vera se la prende da sé. Nell'app di Home Assistant la ricarica " +
          "vera è Impostazioni → App companion → Svuota la cache, e riaprire.",
        "The panel file is there and it downloads, but **this Home Assistant page does " +
          "not have it**: it reads the resource list when it loads, and this one loaded " +
          "before the panel file existed. While it stays that way, the dashboard gives " +
          "\u201CConfiguration error\u201D whatever the add-on does. The button below " +
          "puts it there now: then open the dashboard from the sidebar and it opens. Once " +
          "only — from the next real reload it takes it by itself. In the Home Assistant " +
          "app a real reload is Settings → Companion app → Clear the cache, and reopen.",
      );
    } else if (cartinaChe === "si") {
      testo = due(
        "Se aprendo la plancia dalle «Plance» esce «Errore di configurazione»: da qui la " +
          "cartina si scarica e la tessera si registra, quindi il file è a posto ed è " +
          "Lovelace che non la carica. Due cose, in quest'ordine. 1) Ricarica a fondo la " +
          "pagina di Home Assistant — nell'app: Impostazioni → App companion → Svuota la " +
          "cache, e riapri: una risorsa aggiunta adesso il browser la vede al giro dopo. " +
          "2) Se succede anche da un browser che non l'ha mai aperta, Home Assistant tiene " +
          "le dashboard in YAML (lovelace: mode: yaml) e le risorse dallo storage non le " +
          "legge: allora va dichiarata a mano in configuration.yaml — lovelace: resources: " +
          "- url: /local/gdahome/plancia.js  type: module.",
        "If opening the dashboard from \u201CDashboards\u201D gives \u201CConfiguration " +
          "error\u201D: from here the panel file downloads and the card registers, so the " +
          "file is fine and it is Lovelace that isn't loading it. Two things, in this " +
          "order. 1) Reload the Home Assistant page from scratch — in the app: Settings → " +
          "Companion app → Clear the cache, and reopen: a resource added now, the browser " +
          "sees on the next round. 2) If it happens from a browser that never opened it " +
          "either, Home Assistant keeps its dashboards in YAML (lovelace: mode: yaml) and " +
          "does not read resources from storage: then it has to be declared by hand in " +
          "configuration.yaml — lovelace: resources: - url: /local/gdahome/plancia.js  " +
          "type: module.",
      );
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
        ? due(
            "Fatto: adesso apri la plancia dalla barra laterale, si apre. Se la chiudi e " +
              "riapri l'app di Home Assistant senza svuotarle la cache, questa pagina torna " +
              "com'era e il bottone ricompare.",
            "Done: now open the dashboard from the sidebar and it opens. If you close and " +
              "reopen the Home Assistant app without clearing its cache, this page goes " +
              "back as it was and the button comes back too.",
          )
        : due(
            "Non ci sono riuscito da qui. Allora: Impostazioni → App companion → Svuota la " +
              "cache, e riapri Home Assistant.",
            "I couldn't do it from here. So: Settings → Companion app → Clear the cache, " +
              "and reopen Home Assistant.",
          );
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
    var riga = due(
      "Questo add-on è la versione " + (stato.mia || "—") + ".",
      "This add-on is version " + (stato.mia || "—") + ".",
    );
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
      riga += due(" C'è la " + stato.nuova + ".", " There is " + stato.nuova + ".");
      spiega = due(
        "gdahome se la scarica, la mette al posto di questa e si ricostruisce. " +
          "Ci mette qualche minuto, e mentre lo fa questa pagina non risponde: è normale, " +
          "torna da sé.",
        "gdahome downloads it, puts it in place of this one and rebuilds itself. " +
          "It takes a few minutes, and while it does this page doesn't answer: that's " +
          "normal, it comes back by itself.",
      );
      siPuo = true;
    } else if (stato.cE === false) {
      riga += due(" È l'ultima.", " It is the latest.");
      spiega = "";
    } else {
      riga += due(
        " Non riesco a sapere se ce n'è una più nuova.",
        " I can't tell whether there is a newer one.",
      );
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
    avvisaSullAggiornamento(
      due("Sto scaricando la versione nuova…", "Downloading the new version…"),
    );
    trova("aggiorna-il-ponte").disabled = true;
    chiedi("api/aggiornamento", { method: "POST" })
      .then(function (fatto) {
        avvisaSullAggiornamento(
          due(
            "La " +
              fatto.versione +
              " è dentro. Mi sto ricostruendo: fra un minuto o due ricarica questa pagina.",
            fatto.versione + " is in. I'm rebuilding myself: in a minute or two, reload this page.",
          ),
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
          trova("stato-assistenza").textContent = due(
            "Questa casa risponde alle chat di assistenza: la console è accesa.",
            "This home answers the support chats: the console is on.",
          );
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
        /* E «Se qualcosa non torna» lo stesso, per la stessa ragione.
         *
         * Era a schermo per tutti, ed era la cosa piu' confusionaria della
         * pagina: quattro etichette in maiuscolo, una colonna di prosa, e nei
         * guai sei righe rosse con dentro `lovelace: mode: yaml` e un pezzo di
         * `configuration.yaml`. Chi ha gdahome in casa non deve leggere niente
         * di tutto questo: se qualcosa non va lo dice, e la risposta gliela da'
         * chi guarda questa stessa pagina da dove si risponde.
         *
         * Cancellarla no: e' l'unica riga che, da qui, dice dove sta il pezzo
         * che manca — la cartina che Lovelace ha in elenco, la Plancia rimasta
         * dall'integrazione, la versione della plancia — ed e' quella che ha
         * trovato i difetti di questa settimana. Le si mette il cancello, non
         * la si butta. */
        trova("non-torna").hidden = !risponde;
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
        pastiglia("pas-casa", "male", due("non si legge", "can't be read"));
        trova("spiega-casa").textContent = due(
          "La console non riesce a leggere lo stato di gdahome.",
          "The console can't read gdahome's state.",
        );
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
        chiPreme.textContent = due("chi sta usando questa pagina", "whoever is using this page");
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

  /* ─── Il quadro di chi ha fatto l'impianto ──────────────────────────────
   *
   * Questa scheda compare **solo** dove quella casella e' piena — cioe' quasi
   * mai — e fa una cosa sola che le altre non fanno: mostra il testo che parte
   * da questa casa, intero e senza riassunti. Un riassunto di quello che esce
   * e' esattamente la cosa di cui ci si dovrebbe fidare.
   *
   * Si chiede ogni minuto e non ogni dieci secondi come il resto: il rapporto
   * parte ogni quindici minuti, e chiedere sei volte piu' spesso di quanto
   * cambi vuol dire sei richieste per niente. */
  /* Il cruscotto di chi installa: la scheda c'e' solo dove l'add-on ha
   * l'interruttore acceso. Una porta che non si apre e' peggio di una porta che
   * non c'e', ed e' la stessa regola della voce «Console» nell'app. */
  function guardaIlCruscotto() {
    chiedi("api/cruscotto")
      .then(function (detto) {
        var scheda = trova("scheda-cruscotto");
        if (!detto || !detto.installatore || !detto.dove) {
          scheda.hidden = true;
          return;
        }
        trova("cruscotto-vai").href = detto.dove;
        scheda.hidden = false;
      })
      .catch(function () {
        /* Un ponte vecchio non conosce quella via: la scheda resta via, ed e'
         * la risposta giusta. */
      });
  }

  function quandoEArrivata(esito) {
    if (!esito) return due("non è ancora partita nessuna", "none has gone out yet");
    var quanti = Math.round((Date.now() - esito.quando) / 60000);
    var fa =
      quanti < 1
        ? due("adesso", "just now")
        : quanti < 60
          ? quanti + due(" min fa", " min ago")
          : Math.round(quanti / 60) + due(" ore fa", " hours ago");
    if (esito.andata) return due("l'ultima è arrivata ", "the last one arrived ") + fa;
    return due("l'ultima non è arrivata (", "the last one did not arrive (") + fa + ")";
  }

  function guardaIlQuadro() {
    return chiedi("api/quadro")
      .then(function (quadro) {
        var scheda = trova("scheda-quadro");
        if (!quadro || !quadro.acceso) {
          scheda.hidden = true;
          return;
        }
        scheda.hidden = false;
        /* Chi riceve, col nome della ditta se il quadro l'ha detto.
         *
         * Il nome viene da chi tiene il quadro, non dalla ditta: non c'e'
         * nessuna via da cui un installatore possa cambiarsi il nome, quindi
         * nessuno puo' presentarsi qui dentro come qualcun altro. L'indirizzo
         * si mostra lo stesso, e non e' ridondanza: e' quello che si controlla
         * se il nome non convince. */
        trova("quadro-dove").textContent = quadro.chi
          ? due(
              "Questa casa manda un rapporto a " +
                quadro.chi +
                ", ogni " +
                quadro.ogni +
                " minuti, passando da " +
                quadro.dove +
                ".",
              "This home sends a postcard to " +
                quadro.chi +
                ", every " +
                quadro.ogni +
                " minutes, through " +
                quadro.dove +
                ".",
            )
          : due(
              "Questa casa manda un rapporto a " +
                quadro.dove +
                ", ogni " +
                quadro.ogni +
                " minuti.",
              "This home sends a postcard to " +
                quadro.dove +
                ", every " +
                quadro.ogni +
                " minutes.",
            );
        trova("quadro-esito").textContent = quandoEArrivata(quadro.esito);
        /* Il testo com'e' partito. `JSON.stringify` con l'indentazione: e' lo
         * stesso oggetto che e' andato, non una sua descrizione. */
        trova("quadro-testo").textContent = quadro.ultima
          ? JSON.stringify(quadro.ultima, null, 2)
          : due(
              "Non ne è ancora partita nessuna: la prima esce mezzo minuto dopo l'accensione.",
              "None has gone out yet: the first one leaves half a minute after start-up.",
            );
      })
      .catch(function () {
        /* Una via che non risponde non deve far sparire la scheda: chi la sta
         * leggendo perderebbe sotto gli occhi la cosa che stava guardando. */
      });
  }

  /* «Smetti», in due tempi.
   *
   * Il primo tocco chiede conferma e il secondo fa. Non e' una finestra che si
   * mette in mezzo: e' lo stesso tasto che cambia parola, e chi non voleva
   * premerlo se ne va senza dover chiudere niente.
   *
   * E smettere vuol dire smettere: si ferma adesso **e** si svuota la casella
   * nella scheda dell'add-on, se no al primo riavvio ricomincerebbe. Dove il
   * Supervisor non lascia scrivere si dice cosa fare a mano, invece di dire
   * che e' andata. */
  (function () {
    var tasto = trova("quadro-smetti");
    var parola = tasto.textContent;
    var sicuro = false;
    var orologio = null;

    tasto.addEventListener("click", function () {
      if (!sicuro) {
        sicuro = true;
        tasto.textContent = due("Sicuro? Premi di nuovo", "Sure? Press again");
        orologio = setTimeout(function () {
          sicuro = false;
          tasto.textContent = parola;
        }, 6000);
        return;
      }
      if (orologio) clearTimeout(orologio);
      sicuro = false;
      tasto.textContent = parola;
      tasto.disabled = true;
      chiedi("api/quadro", { method: "DELETE" })
        .then(function (esito) {
          var avviso = trova("quadro-avviso");
          if (esito && esito.spento) {
            trova("scheda-quadro").hidden = true;
            return;
          }
          /* Fermata adesso, ma la casella e' rimasta piena: va detto, perche'
           * al riavvio ricomincia. */
          avviso.hidden = false;
          avviso.className = "avviso giallo";
          avviso.textContent = due(
            "Non manda più niente da adesso, ma la casella «Il quadro» è rimasta piena: svuotala nella scheda di questo add-on, se no al prossimo riavvio ricomincia.",
            "It sends nothing from now on, but the «The panel» box is still filled in: empty it in this add-on's options, otherwise it starts again at the next restart.",
          );
        })
        .catch(function (errore) {
          var avviso = trova("quadro-avviso");
          avviso.hidden = false;
          avviso.className = "avviso";
          avviso.textContent = errore.message;
        })
        .finally(function () {
          tasto.disabled = false;
        });
    });
  })();

  /* Prima di tutto il resto: le parole della pagina, nella lingua di chi
   * guarda. Va fatto prima che qualcosa le riscriva, e prima che si legga il
   * testo di un tasto per rimetterlo dov'era. */
  laPaginaNellaSuaLingua();

  aggiornaTutto();
  setInterval(aggiornaTutto, 10000);
  /* La versione nuova si guarda all'apertura e poi ogni dieci minuti: la
   * risposta arriva da GitHub, e una cosa che cambia una volta al giorno non
   * si chiede ogni dieci secondi come il resto. */
  guardaLAggiornamento();
  setInterval(guardaLAggiornamento, 10 * 60 * 1000);
  /* E il rapporto al quadro: ogni minuto, che e' gia' quindici volte piu'
   * spesso di quanto parta. */
  guardaIlQuadro();
  guardaIlCruscotto();
  setInterval(guardaIlQuadro, 60 * 1000);
})();
