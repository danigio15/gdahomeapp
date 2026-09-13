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

  function dataLeggibile(quando) {
    if (!quando) return "mai";
    try {
      return new Date(quando).toLocaleString();
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
     * quadretto di prima quando se ne fabbrica un altro nello stesso minuto,
     * e chi inquadra si abbina con un codice gia' speso. */
    trova("quadretto").src = "api/qr.svg?" + Date.now();
    trova("codice-vivo").hidden = false;
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
    trova("annulla").hidden = true;
    if (quandoScade) clearInterval(quandoScade);
    quandoScade = null;
  }

  /* Come va il filo verso il centralino, in una riga.
   *
   * Va detto qui e non lasciato scoprire in stazione: chi sbaglia l'indirizzo
   * nella scheda dell'add-on non ha nessun altro posto dove accorgersene, e
   * quello che vedrebbe sarebbe soltanto un'app che «non trova la casa». */
  function comeVaIlCentralino(centralino) {
    if (!centralino || !centralino.configurato) {
      return (
        "Nessun centralino: da fuori casa l'app non entra. Si riaccende con " +
        "«da fuori casa» nelle opzioni di questo add-on."
      );
    }
    /* E **dove** chiama, non solo se ci arriva.
     *
     * Da quando nelle opzioni non c'e' piu' la casella dell'indirizzo, questa
     * riga e' l'unico posto dove si legge: chi vuole sapere se la sua casa sta
     * sul centralino nuovo o su quello di prima lo guarda qui, invece di
     * andarselo a cercare nel programma. */
    var dove = centralino.dove || "";
    if (centralino.rifiutata) return "Il centralino ci rifiuta: " + centralino.rifiutata;
    if (!centralino.dentro) return "Sto chiamando " + (dove || "il centralino") + "…";
    return "Collegato a " + (dove || "il centralino") + ": da fuori casa si entra.";
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
      return;
    }
    scheda.hidden = false;
    var quale = plancia.versione ? "DashboardModern " + plancia.versione : "DashboardModern";
    var riga = trova("provenienza-riga");
    var spiega = trova("provenienza-spiega");
    var quali = trova("provenienza-quali");
    var acceso = plancia.stato === "originale" || plancia.stato === "non-firmata";
    riga.innerHTML =
      '<span class="pallino' +
      (acceso ? " acceso" : "") +
      '"></span> ' +
      quale +
      " — " +
      {
        originale: "originale, firma verificata",
        "non-firmata": "i file tornano tutti",
        modificata: "modificata",
        "senza-origine": "provenienza sconosciuta",
      }[plancia.stato];
    spiega.textContent =
      plancia.stato === "originale"
        ? "Ogni file di questa plancia e' quello pubblicato, e la firma lo conferma."
        : plancia.stato === "non-firmata"
          ? "Ogni file torna con le impronte scritte dentro. Manca solo la firma di chi l'ha pubblicata."
          : plancia.stato === "modificata"
            ? "Qualcosa qui dentro non e' come e' stato pubblicato: " +
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

      var pallino = vediPagina.createElement("span");
      pallino.className = "pallino" + (uno.collegati ? " acceso" : "");
      pallino.title = uno.collegati ? "collegato adesso" : "non collegato";
      riga.appendChild(pallino);

      var nome = vediPagina.createElement("div");
      nome.className = "nome";
      var forte = vediPagina.createElement("strong");
      /* `textContent`, mai `innerHTML`: il nome lo scrive chi si abbina, e
       * arriva dalla porta esposta. */
      forte.textContent = uno.nome;
      var sotto = vediPagina.createElement("span");
      sotto.textContent = uno.sistema + " · visto " + dataLeggibile(uno.vistoIl);
      nome.appendChild(forte);
      nome.appendChild(sotto);
      riga.appendChild(nome);

      var stacca = vediPagina.createElement("button");
      stacca.className = "tenue";
      stacca.type = "button";
      stacca.textContent = "Stacca";
      stacca.addEventListener("click", function () {
        if (!window.confirm("Staccare «" + uno.nome + "»? Dovra' riabbinarsi da capo.")) return;
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

      var nome = vediPagina.createElement("div");
      nome.className = "nome";
      var forte = vediPagina.createElement("strong");
      /* `textContent`, mai `innerHTML`: il titolo l'ha scritto una persona. */
      forte.textContent = una.titolo;
      var sotto = vediPagina.createElement("span");
      sotto.textContent = una.primaria ? "la prima, quella di sempre" : "aggiunta da te";
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

      riga.appendChild(tasti);
      elenco.appendChild(riga);
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
      sotto.textContent =
        suoi +
        (suoi === 1 ? " evento" : " eventi") +
        (quanti ? " · " + Math.round((suoi / quanti) * 100) + "% del traffico" : "");
      nome.appendChild(forte);
      nome.appendChild(sotto);
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
    if (cartinaChe === "no") {
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

  /* Come si chiama la tessera: lo stesso nome sta in `carta/plancia.js`, ed e'
   * quello con cui Lovelace la cerca. Se nessuno l'ha registrata,
   * `custom:gdahome-plancia` non esiste e Home Assistant disegna «Errore di
   * configurazione» — senza dire questo, e senza dire niente altro. */
  var LA_TESSERA = "gdahome-plancia";

  function laCartinaSiScarica(dove) {
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
  function avvisaSullaCartina() {
    var dove = trova("avviso-cartina");
    if (!dove) return;
    var testo = "";
    if (cartinaChe === "no") {
      testo =
        "Home Assistant non serve la cartina della plancia, e senza quella la plancia " +
        "aperta dalle «Plance» esce con «Errore di configurazione». Riavvialo una volta " +
        "(Impostazioni → Sistema → Riavvia): la cartella «www» la apre quando parte, e i " +
        "file arrivati dopo li serve solo dal riavvio dopo.";
    } else if (cartinaChe === "rotta") {
      testo =
        "La cartina si scarica ma non registra la tessera: il file e' arrivato rotto. " +
        "Riavvia l'add-on, che la riscrive da se' a ogni avvio; se succede ancora, " +
        "scrivilo dalle segnalazioni.";
    } else if (cartinaChe === "si") {
      testo =
        "Se aprendo la plancia dalle «Plance» esce «Errore di configurazione»: da qui la " +
        "cartina si scarica e la tessera si registra, quindi il file e' a posto ed e' " +
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
  }

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
    var riga = "Questo ponte è la versione " + (stato.mia || "—") + ".";
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
        "Il ponte se la scarica, la mette al posto di questa e si ricostruisce. " +
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
        trova("stato-casa").textContent = stato.casa.viva
          ? "Home Assistant risponde. Il ponte e' in piedi."
          : "Home Assistant non risponde: " + stato.casa.perche;
        trova("porta").textContent = stato.porta;
        trova("stato-centralino").textContent = comeVaIlCentralino(stato.centralino);
        disegnaIChiacchieroni(stato.chiacchieroni);
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
          avvisaSullaCartina();
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
        trova("stato-casa").textContent = "La console non riesce a leggere lo stato.";
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

  trova("fabbrica").addEventListener("click", function () {
    avvisa("");
    chiedi("api/codice", { method: "POST" })
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
