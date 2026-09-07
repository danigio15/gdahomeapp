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

  function aggiornaTutto() {
    return chiedi("api/stato")
      .then(function (stato) {
        trova("stato-casa").textContent = stato.casa.viva
          ? "Home Assistant risponde. Il ponte e' in piedi."
          : "Home Assistant non risponde: " + stato.casa.perche;
        trova("porta").textContent = stato.porta;
        trova("stato-centralino").textContent = comeVaIlCentralino(stato.centralino);
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
})();
