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
      return "Nessun centralino: da fuori casa l'app non entra. Si mette nelle opzioni di questo add-on.";
    }
    if (centralino.rifiutata) return "Il centralino ci rifiuta: " + centralino.rifiutata;
    if (!centralino.dentro) return "Sto chiamando il centralino…";
    return "Collegato al centralino: da fuori casa si entra.";
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

  /* ─── L'aggiornamento del ponte ──────────────────────────────────────────
   *
   * Un add-on locale non ha nessun negozio dietro: Home Assistant guarda il
   * manifesto che trova in `/addons/ponte`, e quella e' l'unica versione che
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
    if (!stato.gettone) {
      riga += " Non so se ce n'è una più nuova.";
      spiega =
        "Per guardare da sé serve un gettone di GitHub, una volta sola: " +
        "Impostazioni → Add-on → Il ponte → Configurazione, casella «gettone». " +
        "Un gettone a grana fine sulla sola repository dell'app, con Contents: Read-only.";
    } else if (stato.cE === true) {
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
    trova("riguarda").hidden = !stato.gettone;
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
        disegnaLaProvenienza(stato.plancia);
        disegnaIlLink(stato.app);
        disegnaIDispositivi(stato.dispositivi, stato.massimi);
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
