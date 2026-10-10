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

  /* Prima di tutto il resto: le parole della pagina, nella lingua di chi
   * guarda. Va fatto prima che qualcosa si agganci a quei nodi, e prima che
   * qualcuno legga il testo di un tasto per rimetterlo dov'era: e' successo,
   * e «Smetti di mandarlo» tornava in italiano a chi leggeva in inglese. */
  laPaginaNellaSuaLingua();

  /* Quante plance si tengono: lo stesso numero che ha il ponte
   * (`plance.js`). Qui serve solo a spegnere il tasto quando si e' arrivati
   * al tetto, invece di farlo premere per sentirsi dire di no. */
  var PLANCE_AL_MASSIMO = 30;

  /* Se questa casa sta nei limiti di gdahome Base **dentro il ponte**. Lo
   * dice `api/licenza` (`limitata`), e il ponte di oggi non lo dice mai: i
   * lucchetti di Base li mettono l'app e il browser. Resta per un ponte che un
   * giorno tornasse a limitare: allora il tasto «Aggiungi» si spegne. */
  var soloBase = false;

  /* Se questa casa ha gdahome Premium, per le frasi che con Base direbbero il
   * falso: «da fuori si entra», «funziona da casa e da fuori». Vero anche con
   * le licenze spente, perche' senza licenze non c'e' nessun lucchetto.
   * `null` finche' `api/licenza` non ha risposto: allora si dice com'era. */
  var premium = null;

  function trova(id) {
    return vediPagina.getElementById(id);
  }

  /* I «no» del ponte, a parole.
   *
   * Alcune vie rispondono con un codice — `troppe_plance`, `senza_titolo` —
   * e una frase in `spiegazione`; altre con la frase dentro `errore`. La
   * pagina scriveva il campo `errore` com'era, e chi aggiungeva una nona
   * plancia leggeva «troppe_plance». Adesso un codice che si conosce diventa
   * una frase nelle due lingue, uno che non si conosce passa la sua
   * spiegazione, e solo in fondo resta il codice nudo. */
  var I_NO = {
    troppe_plance: [
      "Le plance sono già trenta: per aggiungerne una, prima togline un'altra.",
      "There are already thirty dashboards: remove one before adding another.",
    ],
    "premium-richiesto": [
      "Con gdahome Base la plancia è una, la principale: le altre sono comprese in Premium.",
      "With gdahome Base there is one dashboard, the main one: the others come with Premium.",
    ],
    senza_titolo: ["Scrivi un nome.", "Type a name."],
    non_la_prima: ["La prima plancia non si toglie.", "The first dashboard can't be removed."],
    plancia_sconosciuta: [
      "Quella plancia non c'è più: ricarica la pagina.",
      "That dashboard is gone: reload the page.",
    ],
    senza_plance: ["Questo add-on non tiene le plance.", "This add-on doesn't keep dashboards."],
    senza_utenti: [
      "Non riesco a chiedere a Home Assistant chi c'è in casa: riprova fra poco.",
      "I can't ask Home Assistant who lives here: try again shortly.",
    ],
    "licenze-spente": [
      "Le licenze in questo add-on sono spente.",
      "Licences are turned off in this add-on.",
    ],
  };

  function laFraseDelNo(corpo) {
    var codice = corpo && corpo.errore ? String(corpo.errore) : "";
    var detta = I_NO[codice];
    if (detta) return due(detta[0], detta[1]);
    if (corpo && corpo.spiegazione) return String(corpo.spiegazione);
    return codice || due("Non ha funzionato.", "It didn't work.");
  }

  function chiedi(via, opzioni) {
    return fetch(
      via,
      Object.assign({ headers: { "content-type": "application/json" } }, opzioni),
    ).then(function (risposta) {
      /* Una risposta che non e' JSON — la pagina d'errore dell'ingress, un
       * proxy in mezzo — non deve diventare «Unexpected token <». */
      return risposta
        .json()
        .catch(function () {
          return {};
        })
        .then(function (corpo) {
          if (!risposta.ok) throw new Error(laFraseDelNo(corpo));
          return corpo;
        });
    });
  }

  /* ─── Le sezioni ────────────────────────────────────────────────────────────
   *
   * Sei sezioni, una per volta. Le linguette in cima le scelgono, e cosi' le
   * righe della Panoramica e i tasti che portano altrove (`data-vai`). La
   * sezione scelta resta scritta nell'indirizzo — `#telefoni` — con
   * `replaceState`, che non aggiunge un passo alla storia del browser: il
   * tasto «indietro» continua a portare fuori dalla pagina, come prima.
   *
   * Due linguette arrivano dopo, quando si sa se servono: la licenza, e
   * l'installatore. Se l'indirizzo chiedeva una di quelle, ci si va appena
   * compare. */
  var LE_SEZIONI = ["panoramica", "telefoni", "plance", "licenza", "installatore", "avanzate"];
  var laSezione = "panoramica";
  var richiesta = (function () {
    var detta = String(window.location.hash || "").replace(/^#/, "");
    return LE_SEZIONI.indexOf(detta) >= 0 ? detta : "";
  })();

  function laLinguetta(nome) {
    return vediPagina.querySelector('.sezioni [data-vai="' + nome + '"]');
  }

  function vaiA(nome, comeSiArriva) {
    var linguetta = laLinguetta(nome);
    if (!linguetta || linguetta.hidden) nome = "panoramica";
    laSezione = nome;
    LE_SEZIONI.forEach(function (una) {
      var sezione = trova("sezione-" + una);
      if (sezione) sezione.hidden = una !== nome;
      var sua = laLinguetta(una);
      if (!sua) return;
      if (una === nome) sua.setAttribute("aria-current", "page");
      else sua.removeAttribute("aria-current");
    });
    try {
      window.history.replaceState(null, "", "#" + nome);
    } catch (_niente) {
      /* Dentro un telaio che non lo lascia fare, la sezione resta scelta lo
       * stesso: solo, una pagina ricaricata riparte dalla Panoramica. */
    }
    if (comeSiArriva !== "da-sola") window.scrollTo(0, 0);
  }

  function mostraLaLinguetta(nome, si) {
    var linguetta = laLinguetta(nome);
    if (!linguetta) return;
    linguetta.hidden = !si;
    if (si && richiesta === nome && laSezione !== nome) vaiA(nome, "da-sola");
    if (!si && laSezione === nome) vaiA("panoramica", "da-sola");
  }

  vediPagina.addEventListener("click", function (evento) {
    var dove = evento.target && evento.target.closest ? evento.target.closest("[data-vai]") : null;
    if (!dove) return;
    richiesta = dove.getAttribute("data-vai");
    vaiA(richiesta);
  });

  /* E se l'indirizzo cambia da fuori — un link con `#licenza`, la sezione
   * scritta a mano — la pagina va dove dice. `replaceState` questo evento
   * non lo fa partire, quindi qui non si gira in tondo. */
  window.addEventListener("hashchange", function () {
    var detta = String(window.location.hash || "").replace(/^#/, "");
    if (LE_SEZIONI.indexOf(detta) < 0) return;
    richiesta = detta;
    vaiA(detta, "da-sola");
  });

  /* Le righe della Panoramica si toccano, e da tastiera si premono: Invio o
   * spazio, come un tasto. */
  vediPagina.addEventListener("keydown", function (evento) {
    if (evento.key !== "Enter" && evento.key !== " ") return;
    var dove = evento.target;
    if (!dove || !dove.classList || !dove.classList.contains("si-tocca")) return;
    evento.preventDefault();
    richiesta = dove.getAttribute("data-vai");
    vaiA(richiesta);
  });

  /* ─── I pezzi che si ripetono ───────────────────────────────────────────── */

  /* Lo stato di una riga, in una parola colorata. Il racconto lungo sta sotto
   * la riga quando c'e' qualcosa da fare, e nel cassetto di chi risponde. */
  function pastiglia(quale, come, corto) {
    var dove = trova(quale);
    if (!dove) return;
    dove.hidden = false;
    dove.dataset.come = come;
    var testo = dove.querySelector("[data-corto]");
    if (testo) testo.textContent = corto;
  }

  /* La faccia di una riga della Panoramica prende il colore della sua parola:
   * verde, rossa, gialla mentre si aspetta, grigia quando e' spenta. */
  function coloraLaFaccia(id, come) {
    var faccia = trova(id);
    if (!faccia) return;
    var colore = { bene: "bene", male: "male", attesa: "attesa", spento: "spenta" }[come] || "";
    faccia.className = "faccia" + (colore ? " " + colore : "");
  }

  /* Sotto una riga che non va: il perche', e cosa fare. Il perche' lo dice
   * il ponte, cosa fare lo dice la pagina. */
  function scriviIlRimedio(id, perche, cosaFare) {
    var dove = trova(id);
    if (!dove) return;
    dove.textContent = "";
    if (perche) {
      var forte = vediPagina.createElement("b");
      forte.textContent = due("Perché: ", "Why: ");
      dove.appendChild(forte);
      /* Il perche' arriva dal ponte, spesso senza il punto: glielo si mette,
       * se no si attacca alla frase dopo. */
      var detto = /[.!?…]$/.test(perche) ? perche : perche + ".";
      dove.appendChild(vediPagina.createTextNode(detto + (cosaFare ? " " : "")));
    }
    if (cosaFare) dove.appendChild(vediPagina.createTextNode(cosaFare));
    dove.hidden = !perche && !cosaFare;
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

  /* Un tasto piccolo, per le righe degli elenchi: tenue di serie, pieno se
   * gli si da' la classe vuota — quello e' il tasto che conta, «Salva». */
  function unTasto(parole, classe) {
    var tasto = vediPagina.createElement("button");
    tasto.type = "button";
    tasto.className = classe === undefined ? "tenue" : classe;
    tasto.textContent = parole;
    return tasto;
  }

  function avvisa(testo) {
    var avviso = trova("avviso");
    avviso.textContent = testo || "";
    avviso.hidden = !testo;
  }

  function avvisaITelefoni(testo) {
    var avviso = trova("avviso-telefoni");
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

  /* I nomi che un dispositivo si da' da se' e che non vogliono dire niente.
   *
   * Android, a chi gli chiede come si chiama, risponde **`localhost`**: non e'
   * un difetto nostro, e' quello che risponde. Chiamare «localhost» il
   * telefono di qualcuno e' peggio che non dargli un nome, perche' sembra un
   * nome. Adesso l'app manda qualcosa di sensato — vedi
   * `casa/questo_dispositivo.dart` — ma chi si e' abbinato prima ce l'ha
   * ancora scritto, e l'archivio non si va a riscrivere di nascosto: si
   * scrive bene qui, dove si legge. E adesso si rinomina, col tasto. */
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

  /* Quando si e' visto un telefono, come lo direbbe una persona.
   *
   * `toLocaleString()` scrive «13/09/2026, 14:40:49»: una riga di numeri che
   * va a capo dove lo spazio e' stretto, e non risponde alla domanda vera —
   * che e' «adesso, poco fa, o l'altro giorno?». */
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

  /* ─── Come sta la casa ──────────────────────────────────────────────────── */

  /* Come sta il filo con Home Assistant: due parole per la riga, e la frase
   * intera per il cassetto. */
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

  /* La riga «Home Assistant» della Panoramica. */
  function disegnaLaCasa(casa) {
    var laCasa = comeVaLaCasa(casa);
    pastiglia("pas-casa", laCasa.come, laCasa.corto);
    coloraLaFaccia("faccia-casa", laCasa.come);
    trova("spiega-casa").textContent = laCasa.lungo;
    if (laCasa.come === "bene") {
      trova("riga-casa").textContent = due(
        "gdahome lo raggiunge e lo comanda.",
        "gdahome reaches it and drives it.",
      );
      scriviIlRimedio("rimedio-casa", "", "");
      return;
    }
    trova("riga-casa").textContent = due(
      "gdahome adesso non riesce a parlargli.",
      "gdahome can't talk to it right now.",
    );
    scriviIlRimedio(
      "rimedio-casa",
      (casa && casa.perche) || "",
      due(
        "Succede mentre Home Assistant si riavvia, e passa da sé. Se dura, riavvia l'add-on.",
        "It happens while Home Assistant restarts, and passes by itself. If it lasts, restart the add-on.",
      ),
    );
  }

  /* Perché non entra, **a parole**.
   *
   * Il motivo vero lo sa il filo, e finora arrivava in questa pagina com'era:
   * `getaddrinfo ENOTFOUND tramite.gdahome.org`, `connect ECONNREFUSED`,
   * `certificate has expired`. Sono parole fra due macchine, e chi legge
   * questa pagina non è una macchina: quelle righe o si cercano su internet o
   * non dicono niente — e sono quattro guasti con quattro rimedi diversi.
   *
   * Qui le poche che si conoscono diventano una frase corta per la pastiglia e
   * una lunga col rimedio. Quella grezza resta in fondo alla lunga, fra
   * parentesi: a chi risponde alle segnalazioni serve **quella**, e toglierla
   * vorrebbe dire scambiare una diagnosi con una traduzione.
   *
   * Quello che non si riconosce passa com'era: un guasto nuovo detto male è
   * peggio di un guasto nuovo detto com'è. */
  function ilPercheInParole(perche) {
    var detto = String(perche || "");
    var nudo = detto.toLowerCase();
    var ha = function (pezzo) {
      return nudo.indexOf(pezzo) >= 0;
    };
    var frase = null;
    if (ha("enotfound") || ha("eai_again"))
      frase = {
        corto: due("il nome non si risolve", "the name doesn't resolve"),
        lungo: due(
          "Il nome di quell'indirizzo non si risolve: o è scritto male, o il DNS di questa casa non risponde.",
          "That address's name doesn't resolve: either it is misspelled, or this home's DNS isn't answering.",
        ),
      };
    else if (ha("econnrefused"))
      frase = {
        corto: due("porta chiusa", "port closed"),
        lungo: due(
          "Quell'indirizzo c'è, ma su quella porta non risponde nessuno: il centralino è spento, o sta su un'altra porta.",
          "That address exists, but nothing answers on that port: the relay is off, or it listens on another port.",
        ),
      };
    else if (ha("etimedout") || ha("timeout"))
      frase = {
        corto: due("nessuno risponde", "nobody answers"),
        lungo: due(
          "Nessuno risponde a quell'indirizzo: c'è un filtro in mezzo, o la macchina del centralino è giù.",
          "Nobody answers at that address: something is filtering in between, or the relay's machine is down.",
        ),
      };
    else if (ha("econnreset") || ha("epipe"))
      frase = {
        corto: due("il filo si chiude subito", "the connection closes at once"),
        lungo: due(
          "Il filo si apre e si chiude subito: qualcuno in mezzo lo taglia.",
          "The connection opens and closes at once: something in between is cutting it.",
        ),
      };
    else if (ha("cert_has_expired") || ha("certificate has expired"))
      frase = {
        corto: due("certificato scaduto", "expired certificate"),
        lungo: due(
          "Il certificato di quell'indirizzo è scaduto: va rinnovato sul centralino.",
          "That address's certificate has expired: it has to be renewed on the relay.",
        ),
      };
    else if (ha("altname"))
      frase = {
        corto: due("certificato di un altro nome", "certificate for another name"),
        lungo: due(
          "Il certificato di quell'indirizzo è intestato a un altro nome: l'indirizzo scritto qui e quello del certificato non sono lo stesso.",
          "That address's certificate is issued for another name: the address written here and the certificate's are not the same.",
        ),
      };
    else if (
      ha("self signed") ||
      ha("self-signed") ||
      ha("self_signed") ||
      ha("unable to verify") ||
      ha("unable_to_verify")
    )
      frase = {
        corto: due("certificato non fidato", "untrusted certificate"),
        lungo: due(
          "Il certificato di quell'indirizzo non è firmato da nessuno di cui fidarsi.",
          "That address's certificate is not signed by anyone to trust.",
        ),
      };
    else if (ha("ha risposto"))
      frase = {
        corto: detto,
        lungo: due(
          "Da quell'indirizzo risponde qualcosa che non è un centralino.",
          "Something answers at that address, and it is not a relay.",
        ),
      };
    if (!frase) return { corto: detto, lungo: detto };
    /* La riga grezza resta, fra parentesi: è quella che serve a chi deve
     * capire, e la frase sopra è quella che serve a chi deve decidere. Le
     * parentesi stanno dentro la frase, prima del punto, e non dopo. */
    return {
      corto: frase.corto,
      lungo: frase.lungo.replace(/\.$/, "") + " (" + detto + ").",
    };
  }

  /* Che rete Zigbee ha trovato il ponte, e cos'ha visto per dirlo.
   *
   * Esiste per una ragione sola: **una casa che ha Zigbee e un ponte che non
   * lo trova erano indistinguibili da una casa che Zigbee non ce l'ha**. In
   * tutt'e due i casi la voce «Zigbee» nel menu dell'app non compare, e chi
   * guarda non ha nessun modo di sapere quale dei due gli e' capitato — ne'
   * se aspettare, ne' cosa andare a controllare.
   *
   * E' lo stesso guasto contro cui questa pagina ha gia' scritto due volte:
   * il «perche'» del centralino e la provenienza della plancia. Un guasto
   * muto e' il peggiore che ci sia, e questa riga toglie il silenzio. */
  function scriviLoZigbee(zigbee) {
    var blocco = trova("blocco-zigbee");
    if (!blocco) return;
    if (!zigbee || !zigbee.chiesto) {
      /* Il ponte quella domanda non l'ha ancora fatta: la fa quando l'app
       * chiede «cosa sa fare questa casa». Scrivere «nessuna rete» adesso
       * vorrebbe dire dire una cosa che non si sa. */
      blocco.hidden = true;
      return;
    }
    blocco.hidden = false;
    var righe = [];
    if (zigbee.quale === "zha") {
      righe.push(
        due("La rete e' ZHA, dentro Home Assistant.", "The network is ZHA, inside Home Assistant."),
      );
    } else if (zigbee.quale) {
      righe.push(
        due("La rete e' Zigbee2MQTT, cassetta «", "The network is Zigbee2MQTT, mailbox “") +
          zigbee.cassetta +
          due("».", "”."),
      );
    } else {
      righe.push(
        due(
          "Nessuna rete Zigbee: nell'app la voce non compare. Qui sotto cos'ha guardato.",
          "No Zigbee network: the app does not show the entry. Below, what it looked at.",
        ),
      );
    }
    if (zigbee.zha) righe.push(zigbee.zha);
    if (zigbee.posta) righe.push(zigbee.posta);
    trova("spiega-zigbee").textContent = righe.join(" ");
  }

  /* Come va il filo verso il centralino, in una riga, per il cassetto di chi
   * risponde: con l'indirizzo e la riga grezza, che a lui servono.
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
            "“from away” in this add-on's options.",
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
      const inParole = ilPercheInParole(centralino.perche);
      return {
        come: "male",
        corto: centralino.perche
          ? due("non entra — ", "can't get in — ") + inParole.corto
          : due("sto chiamando…", "calling…"),
        lungo:
          due("Sto chiamando ", "Calling ") +
          (dove || due("il centralino", "the relay")) +
          "…" +
          (centralino.perche
            ? due(" L'ultimo tentativo: ", " The last attempt: ") + inParole.lungo
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

  /* La riga «Da fuori casa» della Panoramica, per chi ci abita.
   *
   * Il cassetto qui sopra dice a chi risponde dove chiama la casa e la riga
   * grezza dell'errore. Qui si risponde a un'altra domanda — «col telefono
   * fuori casa, entro?» — e quando la risposta e' no si dice perche' e cosa
   * succede adesso, sotto la riga.
   *
   * Con gdahome Base il filo c'e' — e' da li' che passa l'abbinamento — ma da
   * fuori l'app non entra: il verde direbbe il contrario. Grigio, e non
   * rosso: non e' un guasto. */
  function disegnaIlFuori(centralino) {
    var come;
    var corto;
    var riga;
    var perche = "";
    var cosaFare = "";
    var soloInCasa = due(
      "Adesso l'app entra solo quando sei sulla rete di casa.",
      "Right now the app gets in only on your home network.",
    );
    if (!centralino || !centralino.configurato) {
      come = "spento";
      corto = due("spento", "off");
      riga = due(
        "Da fuori casa l'app non entra: è spento nelle opzioni di questo add-on, alla voce «da fuori casa».",
        "From away the app can't get in: it is turned off in this add-on's options, under “from away”.",
      );
    } else if (centralino.rifiutata) {
      come = "male";
      corto = due("non entra", "can't get in");
      riga = soloInCasa;
      perche =
        due("il centralino rifiuta questa casa: ", "the relay turns this home away: ") +
        centralino.rifiutata;
    } else if (!centralino.dentro && centralino.perche) {
      come = "male";
      corto = due("non entra", "can't get in");
      riga = soloInCasa;
      perche = ilPercheInParole(centralino.perche).lungo;
      cosaFare = due(
        "La casa riprova da sola: appena il collegamento torna, da fuori si rientra.",
        "The home keeps retrying by itself: as soon as the connection is back, you get in from away again.",
      );
    } else if (!centralino.dentro) {
      come = "attesa";
      corto = due("sto chiamando…", "calling…");
      riga = due(
        "La casa si sta collegando al centralino.",
        "The home is connecting to the relay.",
      );
    } else if (premium === false) {
      come = "spento";
      corto = due("solo con Premium", "Premium only");
      riga = due(
        "Il collegamento c'è, ma da fuori casa l'app entra solo con gdahome Premium. Sulla rete di casa entra sempre.",
        "The connection is there, but from away the app gets in only with gdahome Premium. On your home network it always gets in.",
      );
    } else {
      come = "bene";
      corto = due("si entra", "reachable");
      riga = due(
        "L'app entra anche quando sei fuori, col telefono in rete mobile.",
        "The app gets in from away too, with the phone on mobile data.",
      );
    }
    pastiglia("pas-fuori", come, corto);
    coloraLaFaccia("faccia-fuori", come);
    trova("riga-fuori").textContent = riga;
    scriviIlRimedio("rimedio-fuori", perche, cosaFare);
  }

  /* Da dove viene la plancia, in tre righe.
   *
   * Il verdetto e' uno di quattro, e si dicono tutti e quattro senza girarci
   * intorno: originale e firmata, intatta ma senza firma, modificata (con
   * quali file), o senza provenienza. Chi legge deve poter rispondere a «e'
   * quella vera?» senza sapere niente di firme.
   *
   * Nella Panoramica sta accanto alla versione, in una parola; quando non va,
   * sotto c'e' la frase intera. Nel cassetto di chi risponde, l'elenco dei
   * file che non tornano. */
  function disegnaLaProvenienza(plancia) {
    var scheda = trova("provenienza");
    if (!scheda) return;
    if (!plancia) {
      scheda.hidden = true;
      trova("pas-plancia").hidden = true;
      trova("faccia-versione").className = "faccia spenta";
      scriviIlRimedio("rimedio-plancia", "", "");
      return;
    }
    scheda.hidden = false;
    var quale = plancia.versione ? "DashboardModern " + plancia.versione : "DashboardModern";
    var spiega = trova("provenienza-spiega");
    var quali = trova("provenienza-quali");
    var acceso = plancia.stato === "originale" || plancia.stato === "non-firmata";
    pastiglia(
      "pas-plancia",
      acceso ? "bene" : "male",
      due("plancia ", "dashboard ") +
        (plancia.versione ? plancia.versione + " " : "") +
        {
          originale: due("originale", "original"),
          "non-firmata": due("intatta", "untouched"),
          modificata: due("modificata", "changed"),
          "senza-origine": due("di provenienza sconosciuta", "of unknown origin"),
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
    scriviIlRimedio("rimedio-plancia", "", acceso ? "" : spiega.textContent);
    trova("faccia-versione").className = "faccia " + (acceso ? "spenta" : "male");
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

  /* La riga «Versione» della Panoramica, e la targhetta accanto al nome. */
  function disegnaLaVersione(versione) {
    if (!versione) return;
    trova("targhetta").textContent = versione;
    trova("targhetta").hidden = false;
    trova("riepilogo-versione").textContent = due(
      "gdahome " + versione + " · gli aggiornamenti arrivano da Home Assistant",
      "gdahome " + versione + " · updates come from Home Assistant",
    );
  }

  /* Il numerino rosso-giallo sulla linguetta della Panoramica: quante righe
   * non vanno. Si guarda da qualunque sezione, e dice di tornare li'. */
  function contaIGuai() {
    var quanti = 0;
    ["pas-casa", "pas-fuori", "pas-plancia"].forEach(function (id) {
      var una = trova(id);
      if (una && !una.hidden && una.dataset.come === "male") quanti += 1;
    });
    scriviIlNumerino("quanti-panoramica", quanti);
  }

  function scriviIlNumerino(id, quanti) {
    var dove = trova(id);
    if (!dove) return;
    dove.textContent = String(quanti);
    dove.hidden = !quanti;
  }

  /* ─── Rinominare dentro la riga ─────────────────────────────────────────────
   *
   * Il nome si cambia dove si legge: la riga diventa una casella col nome di
   * adesso, e due tasti. Niente finestra del browser — dentro Home Assistant
   * sembra un errore, e sul telefono copre mezza pagina.
   *
   * Mentre si scrive, quell'elenco non si ridisegna: la pagina si rinfresca
   * ogni dieci secondi, e una casella che sparisce a meta' parola e' una
   * casella che fa perdere quello che si e' scritto. */
  var inModifica = "";

  function rinominaQui(riga, chiave, attuale, quantoLungo, salva, avvisaLi) {
    inModifica = chiave;
    var nome = riga.querySelector(".nome");
    var tasti = riga.querySelector(".tasti");
    if (nome) nome.hidden = true;
    if (tasti) tasti.hidden = true;

    var modulo = vediPagina.createElement("div");
    modulo.className = "rinomina";
    var casella = vediPagina.createElement("input");
    casella.type = "text";
    casella.maxLength = quantoLungo;
    casella.value = attuale;
    casella.setAttribute("aria-label", due("Il nome nuovo", "The new name"));
    var bene = unTasto(due("Salva", "Save"), "");
    var lascia = unTasto(due("Annulla", "Cancel"), "tenue");
    modulo.appendChild(casella);
    modulo.appendChild(bene);
    modulo.appendChild(lascia);
    riga.insertBefore(modulo, tasti || null);

    var chiudi = function () {
      inModifica = "";
      aggiornaTutto();
    };
    bene.addEventListener("click", function () {
      bene.disabled = true;
      lascia.disabled = true;
      avvisaLi("");
      salva(casella.value).then(chiudi, function (errore) {
        bene.disabled = false;
        lascia.disabled = false;
        avvisaLi(errore.message);
      });
    });
    lascia.addEventListener("click", chiudi);
    casella.addEventListener("keydown", function (evento) {
      if (evento.key === "Enter") bene.click();
      if (evento.key === "Escape") chiudi();
    });
    casella.focus();
    casella.select();
  }

  /* ─── I telefoni ────────────────────────────────────────────────────────── */

  function disegnaIDispositivi(dispositivi, massimi) {
    var quanti = dispositivi.length;
    var collegati = dispositivi.filter(function (uno) {
      return uno.collegati;
    }).length;
    scriviIlNumerino("quanti-telefoni", quanti);
    trova("riepilogo-telefoni").textContent = !quanti
      ? due("Nessun telefono abbinato", "No phone paired")
      : due(
          (quanti === 1 ? "1 abbinato" : quanti + " abbinati") +
            " · " +
            (collegati === 1 ? "1 collegato adesso" : collegati + " collegati adesso"),
          quanti + " paired · " + collegati + " connected right now",
        );
    trova("telefoni-spiega").textContent = due(
      "I telefoni e i tablet che usano gdahome per questa casa. Ne puoi abbinare fino a " +
        massimi +
        ".",
      "The phones and tablets that use gdahome for this home. You can pair up to " + massimi + ".",
    );
    /* «3 di 10»: era «1 di 10 telefono», con la parola che si accordava col
     * numero sbagliato. Il numero da solo si legge meglio, e non sbaglia. */
    trova("conteggio").textContent = due(quanti + " di " + massimi, quanti + " of " + massimi);

    /* Mentre un nome si sta scrivendo, l'elenco resta com'e'. */
    if (inModifica.indexOf("telefono:") === 0) return;

    var elenco = trova("elenco");
    elenco.textContent = "";

    if (!quanti) {
      var vuoto = vediPagina.createElement("li");
      vuoto.className = "vuoto";
      vuoto.textContent = due(
        "Nessun telefono abbinato: genera il QR code qui sopra e inquadralo con l'app.",
        "No phone paired: generate the QR code above and scan it with the app.",
      );
      elenco.appendChild(vuoto);
      return;
    }

    dispositivi.forEach(function (uno) {
      var riga = vediPagina.createElement("li");

      /* La faccia della riga: un riquadro tondo col disegno di un telefono,
       * verde quando quel telefono e' collegato adesso. Si legge anche sul
       * telefono, dove un `title` col mouse fermo sopra non c'e'. */
      riga.appendChild(unaFaccia("ic-telefono", uno.collegati ? "bene" : "spenta"));

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
      /* Un telefono entrato con la casa di prova lo dice accanto al nome, con
       * la sua scadenza: e' l'ora in cui uscira' da solo. */
      if (uno.finoA) {
        var rigaDelNome = vediPagina.createElement("div");
        rigaDelNome.className = "riga-del-nome";
        var aTempo = vediPagina.createElement("span");
        aTempo.className = "etichetta-prova";
        aTempo.textContent = due(
          "di prova · fino al " + unGiornoCorto(uno.finoA),
          "test · until " + unGiornoCorto(uno.finoA),
        );
        rigaDelNome.appendChild(forte);
        rigaDelNome.appendChild(aTempo);
        nome.appendChild(rigaDelNome);
      } else {
        nome.appendChild(forte);
      }
      nome.appendChild(sotto);
      riga.appendChild(nome);

      var tasti = vediPagina.createElement("div");
      tasti.className = "tasti";

      var rinomina = unTasto(due("Rinomina", "Rename"), "tenue");
      rinomina.addEventListener("click", function () {
        rinominaQui(
          riga,
          "telefono:" + uno.id,
          comeSiChiama(uno),
          60,
          function (nuovo) {
            return chiedi("api/dispositivi/" + encodeURIComponent(uno.id), {
              method: "PATCH",
              body: JSON.stringify({ nome: nuovo }),
            });
          },
          avvisaITelefoni,
        );
      });
      tasti.appendChild(rinomina);

      var stacca = unTasto(due("Togli", "Unpair"), "toglie");
      stacca.addEventListener("click", function () {
        if (
          !window.confirm(
            due(
              "Togliere «" +
                comeSiChiama(uno) +
                "»? Esce subito da questa casa, e per rientrare dovrà riabbinarsi da capo.",
              "Unpair “" +
                comeSiChiama(uno) +
                "”? It leaves this home right away, and to get back in it will have to pair again from scratch.",
            ),
          )
        )
          return;
        stacca.disabled = true;
        avvisaITelefoni("");
        chiedi("api/dispositivi/" + encodeURIComponent(uno.id), { method: "DELETE" })
          .then(aggiornaTutto)
          .catch(function (errore) {
            stacca.disabled = false;
            avvisaITelefoni(errore.message);
          });
      });
      tasti.appendChild(stacca);
      riga.appendChild(tasti);

      elenco.appendChild(riga);
    });
  }

  /* ─── Le plance ─────────────────────────────────────────────────────────────
   *
   * Una riga per plancia: come si chiama, chi la vede, e i tasti — «Apri»,
   * «Rinomina», «Chi la vede», e per quelle che non sono la prima «Togli».
   *
   * La prima non si toglie, e il tasto non c'e': un tasto che c'e' e che
   * risponde «questa no» e' peggio di un tasto che non c'e'. */
  function disegnaLePlance(plance) {
    var elenco = trova("elenco-plance");
    if (!elenco) return;
    var quante = plance ? plance.length : 0;
    trova("aggiungi-plancia").disabled = quante >= PLANCE_AL_MASSIMO || soloBase;
    /* Modello e utenti servono solo a chi puo' aggiungerne una. */
    trova("nuova-plancia").hidden = quante >= PLANCE_AL_MASSIMO || soloBase;
    if (!trova("nuova-plancia").hidden) riempiGliUtentiDellaNuova();
    scriviIlNumerino("quanti-plance", quante);
    trova("plance-conta").textContent = due(
      quante + " di " + PLANCE_AL_MASSIMO,
      quante + " of " + PLANCE_AL_MASSIMO,
    );
    trova("riepilogo-plance").textContent = !quante
      ? due("Nessuna plancia", "No dashboard")
      : (quante === 1
          ? due("1 plancia: ", "1 dashboard: ")
          : quante + due(" plance: ", " dashboards: ")) +
        iNomiInFila(
          plance.map(function (una) {
            return una.titolo;
          }),
        );

    if (inModifica.indexOf("plancia:") === 0) return;
    elenco.textContent = "";

    (plance || []).forEach(function (una) {
      var riga = vediPagina.createElement("li");
      riga.appendChild(unaFaccia("ic-plance", una.primaria ? "bene" : ""));

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
          ? due("la principale", "the main one")
          : due("aggiunta da te", "added by you")) +
        " · " +
        chi.join(" · ");
      /* Una plancia a muro lo dice accanto al nome: chi la apre sul telefono
       * e trova un pannello invece della plancia deve poterlo leggere qui. */
      if (una.a_muro) {
        var rigaDelTitolo = vediPagina.createElement("div");
        rigaDelTitolo.className = "riga-del-nome";
        var aMuro = vediPagina.createElement("span");
        aMuro.className = "etichetta-muro";
        aMuro.textContent = due("📟 a muro", "📟 on the wall");
        rigaDelTitolo.appendChild(forte);
        rigaDelTitolo.appendChild(aMuro);
        nome.appendChild(rigaDelTitolo);
      } else nome.appendChild(forte);
      nome.appendChild(sotto);
      riga.appendChild(nome);

      var tasti = vediPagina.createElement("div");
      tasti.className = "tasti";

      /* «Apri»: la plancia, servita dal ponte, in una scheda sua.
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

      var rinomina = unTasto(due("Rinomina", "Rename"), "tenue");
      rinomina.addEventListener("click", function () {
        rinominaQui(
          riga,
          "plancia:" + una.profilo,
          una.titolo,
          40,
          function (nuovo) {
            return chiedi("api/plance", {
              method: "PATCH",
              body: JSON.stringify({ profilo: una.profilo, titolo: nuovo }),
            });
          },
          avvisaLePlance,
        );
      });
      tasti.appendChild(rinomina);

      /* «Chi la vede»: le spunte, sotto la riga.
       *
       * Sotto e non in una finestra: le spunte sono poche — quanti utenti ha
       * una casa — e una finestra per tre caselle e' una finestra da chiudere.
       * Si apre una riga per volta: aprirne un'altra chiude quella di prima,
       * se no l'elenco delle plance diventa un muro di caselle. */
      var chiLaVede = unTasto(due("Chi la vede", "Who sees it"), "tenue");
      chiLaVede.setAttribute("aria-expanded", "false");
      tasti.appendChild(chiLaVede);

      if (!una.primaria) {
        var togli = unTasto(due("Togli", "Remove"), "toglie");
        togli.addEventListener("click", function () {
          if (
            !window.confirm(
              due(
                "Togliere «" +
                  una.titolo +
                  "»? Va via anche come l'hai configurata: sezioni, tessere, stanze. Non si rimette a posto.",
                "Remove “" +
                  una.titolo +
                  "”? The way you configured it goes too: sections, cards, rooms. There is no putting it back.",
              ),
            )
          )
            return;
          togli.disabled = true;
          avvisaLePlance("");
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

  /* «Casa e Ospiti», «Casa, Ospiti e Mare», «Casa, Ospiti, Mare e altre 2»:
   * una riga sola, anche con trenta plance. */
  function iNomiInFila(nomi) {
    if (nomi.length > 3) {
      var altre = nomi.length - 3;
      return (
        nomi.slice(0, 3).join(", ") +
        due(" e " + (altre === 1 ? "un'altra" : "altre " + altre), " and " + altre + " more")
      );
    }
    if (nomi.length > 1)
      return nomi.slice(0, -1).join(", ") + due(" e ", " and ") + nomi[nomi.length - 1];
    return nomi[0] || "";
  }

  /* La riga sotto le plance che dice cosa cambia con Base.
   *
   * Il ponte non limita le plance — ci sono tutte, anche in Home Assistant —
   * ma l'app e il browser con Base aprono solo la principale. Chi ne aggiunge
   * una seconda da qui e poi non la trova nell'app deve averlo letto prima. */
  function disegnaLaNotaDellePlance() {
    var nota = trova("plance-premium");
    if (soloBase) {
      nota.textContent = due(
        "Con gdahome Base la plancia è una, la principale. Con Premium, fino a otto.",
        "With gdahome Base there is one dashboard, the main one. With Premium, up to eight.",
      );
      nota.hidden = false;
      return;
    }
    if (premium === false) {
      nota.textContent = due(
        "Con gdahome Base, nell'app e nel browser si apre solo la principale: le altre sono comprese in Premium. In Home Assistant, fra le Dashboard, ci sono tutte.",
        "With gdahome Base, the app and the browser open only the main one: the others come with Premium. In Home Assistant, among the Dashboards, they are all there.",
      );
      nota.hidden = false;
      return;
    }
    nota.hidden = true;
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

  /* ─── Le plance in Home Assistant (nel cassetto di chi risponde) ──────────
   *
   * Se le plance sono davvero comparse fra le «Plance» di Home Assistant.
   *
   * Le plance le tiene il ponte, ma la voce nella barra laterale la fa Home
   * Assistant, e fra le due cose ci sono tre passaggi che possono non
   * riuscire — la cartina da scrivere, la risorsa da dichiarare, la Plancia da
   * creare. Quando non riescono, il ponte lo scrive nel registro: cioe' in un
   * posto dove nessuno guarda. Qui invece sta dove si guarda. */

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
        "Checking whether the dashboards are among Home Assistant's “Dashboards”…",
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
          " the “www” folder wasn't there and I made it, and Home Assistant" +
          " serves the files inside it only if that folder existed when it started." +
          " Until it restarts, opening the dashboard gives “Configuration error”.",
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
       * se in elenco c'e' gia' quella nuova. */
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
        " The dashboard holds “" + esito.tessera_nella_vista + "”.",
      );
    /* La Plancia rimasta dall'integrazione, ed e' la riga che mancava.
     *
     * Qualcuno ha riavviato Home Assistant tre volte su una voce che nessun
     * riavvio puo' aggiustare, e poi e' andato a chiederlo su Facebook. Il
     * ponte quell'elenco ce l'aveva — lo scriveva nel registro — e qui non
     * compariva. */
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

  /* La tessera **nella pagina di Home Assistant**, non in questa.
   *
   * Questa pagina gira dentro un riquadro, sullo stesso indirizzo di Home
   * Assistant: puo' guardare la sua. Ed e' li' che la tessera deve esistere —
   * qui non serve a niente.
   *
   * Home Assistant l'elenco delle risorse lo legge **quando la pagina si
   * carica**: una pagina aperta prima che la cartina esistesse non la conosce,
   * e continua a non conoscerla finche' non si ricarica per davvero — che
   * nell'app di Home Assistant vuol dire svuotarle la cache, non riaprirla. */
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

  /* Il foglietto sotto la riga: si vede solo quando c'e' qualcosa da fare, e
   * dice **cosa** fare — non com'e' fatto il mondo. */
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
            "“Dashboards” gives “Configuration error”. Nearly always " +
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
          "dashboard opened from “Dashboards” gives “Configuration " +
          "error”. Restart it once (Settings → System → Restart): it opens the " +
          "“www” folder when it starts, and files that arrive later it serves " +
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
      /* Senza asterischi: questa riga va in `textContent`, e due asterischi
       * per parte si leggevano tali e quali. */
      testo = due(
        "La cartina c'è e si scarica, ma questa pagina di Home Assistant non ce l'ha: " +
          "l'elenco delle risorse lo legge quando si carica, e questa si è caricata prima che " +
          "la cartina esistesse. Finché resta così, la plancia esce con «Errore di " +
          "configurazione» qualunque cosa faccia l'add-on. Il bottone qui sotto gliela mette " +
          "adesso: poi apri la plancia dalla barra laterale e si apre. Una volta sola — dalla " +
          "prossima ricarica vera se la prende da sé. Nell'app di Home Assistant la ricarica " +
          "vera è Impostazioni → App companion → Svuota la cache, e riaprire.",
        "The panel file is there and it downloads, but this Home Assistant page does " +
          "not have it: it reads the resource list when it loads, and this one loaded " +
          "before the panel file existed. While it stays that way, the dashboard gives " +
          "“Configuration error” whatever the add-on does. The button below " +
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
        "If opening the dashboard from “Dashboards” gives “Configuration " +
          "error”: from here the panel file downloads and the card registers, so the " +
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

  /* ─── gdahome nel browser ───────────────────────────────────────────────────
   *
   * Il link a gdahome da browser.
   *
   * Si vede solo se l'app c'e' davvero dentro questo add-on: un link che porta
   * a un 404 e' peggio di nessun link.
   *
   * E si dice subito, non dopo, se questa pagina e' aperta su un indirizzo
   * `http`: li' la plancia nel browser non si disegna — un service worker i
   * browser lo fanno girare solo su `https` o `localhost`, ed e' una regola
   * loro. */
  function disegnaIlLink(ce) {
    trova("scheda-app").hidden = !ce;
    if (!ce) return;
    trova("avviso-sicuro").hidden = window.isSecureContext !== false;
  }

  /* L'indirizzo di gdahome da aprire nel browser, quando c'e'. */
  var ilLinkDiFuori = "";

  /* L'indirizzo di gdahome da aprire fuori casa.
   *
   * Il centralino serve anche l'app, sotto `/app/`: e' lo stesso posto dove
   * la casa sta in attesa, ed e' pubblico e in `https`. L'indirizzo lo dice
   * il ponte — e' quello che ha in configurazione — e qui si trasforma da
   * `wss://…` in `https://…/app/`: sono lo stesso posto, e chiederlo due
   * volte a chi installa sarebbe chiederglielo una volta di troppo.
   *
   * Se il centralino e' spento («da fuori casa» a no) non c'e' nessun link da
   * dare, e la riga non compare.
   *
   * Arriva tutto lo stato del centralino e non il solo indirizzo: l'indirizzo
   * dice se un link **esiste**, `dentro` dice se oggi porta da qualche parte,
   * e sono due cose diverse che vanno dette tutte e due. Vedi qui sotto. */
  function disegnaIlLinkDiFuori(centralino) {
    var riquadro = trova("link-di-fuori");
    var dove = (centralino && centralino.dove) || "";
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
    avvisaSeLaCasaNonEAttaccata(centralino, Boolean(indirizzo));
    ilLinkDiFuori = indirizzo;
    scriviIlLinkDiFuori();
  }

  /* Le parole accanto al link, nella scheda e nella Panoramica.
   *
   * Con gdahome Base quell'indirizzo la casa non la apre: il browser li' sta
   * sempre «fuori casa», e fuori casa serve Premium. Scrivere «funziona da
   * casa e da fuori» a chi ha Base era una promessa che il tasto non
   * manteneva. Le parole arrivano in due tempi — il link con lo stato, la
   * licenza con la sua via — e si riscrivono a ognuno dei due. */
  function scriviIlLinkDiFuori() {
    var indirizzo = ilLinkDiFuori;
    trova("azione-browser").hidden = !indirizzo;
    if (!indirizzo) return;
    var conBase = premium === false;
    var corto = indirizzo.replace(/^https:\/\//, "").replace(/\/$/, "");
    trova("link-di-fuori-indirizzo").textContent = indirizzo;
    trova("apri-di-fuori").href = indirizzo;
    trova("azione-browser-apri").href = indirizzo;
    trova("link-di-fuori-riga").textContent = conBase
      ? due(
          "Con gdahome Base, da questo indirizzo la casa non si apre: serve Premium. Con l'app sul telefono, sulla rete di casa, si entra sempre.",
          "With gdahome Base, this address doesn't open the home: it needs Premium. With the app on the phone, on your home network, you always get in.",
        )
      : due(
          "Un indirizzo vero: si salva fra i preferiti, si può mandare. Funziona da casa e da fuori.",
          "An address of its own: bookmark it, send it to someone. It works from home and from away.",
        );
    trova("azione-browser-riga").textContent =
      corto +
      " · " +
      (conBase
        ? due("serve Premium", "needs Premium")
        : due("da casa e da fuori", "from home and from away"));
  }

  /* Il tasto c'e', ma adesso non porta da nessuna parte.
   *
   * L'indirizzo del centralino resta quello giusto anche quando la casa non gli
   * e' attaccata: si salva fra i preferiti, e domani funziona. Premuto oggi,
   * pero', apre un'app che gira e poi dice «non trovo la casa» — ed e' la
   * risposta che manda a cercare il difetto nel telefono, che e' l'ultimo posto
   * dove sta.
   *
   * Quindi si dice qui, accanto al tasto, e si dice che il link non e'
   * sbagliato: e' la casa che in questo momento non c'e'. */
  function avvisaSeLaCasaNonEAttaccata(centralino, ceIlLink) {
    var avviso = trova("avviso-casa-scollegata");
    var fuori = Boolean(ceIlLink && centralino && centralino.configurato && !centralino.dentro);
    avviso.hidden = !fuori;
    if (!fuori) return;
    var perche = centralino.rifiutata || centralino.perche || "";
    avviso.textContent =
      due(
        "Adesso questa casa non è collegata al centralino: da quell'indirizzo l'app non entra. ",
        "Right now this home is not connected to the relay: from that address the app cannot get in. ",
      ) +
      (perche ? due("L'ultimo tentativo: ", "The last attempt: ") + perche + ". " : "") +
      due(
        "Il link resta buono: appena la casa si riaggancia, si entra.",
        "The link stays good: as soon as the home hooks back up, you get in.",
      );
  }

  /* ─── L'aggiornamento del ponte ──────────────────────────────────────────
   *
   * Gli aggiornamenti arrivano dal negozio di Home Assistant, come per ogni
   * altro add-on, e questa scheda lo dice: quale versione gira, e dove si
   * preme «Aggiorna».
   *
   * Qui c'era anche un bottone che si portava dentro la versione nuova da se'.
   * Serviva a chi teneva l'add-on copiato in `/addons/gdahome`, e per farlo il
   * ponte voleva quella cartella in scrittura e un ruolo da amministratore del
   * Supervisor. Il manifesto non li chiede piu' — il perche' sta in
   * `config.yaml` — e allora il ponte risponde `locale: false` in ogni casa:
   * il bottone, e quello che guarda su GitHub se c'e' una versione nuova, non
   * si mostrano.
   */
  function avvisaSullAggiornamento(testo) {
    var avviso = trova("aggiornamento-avviso");
    avviso.textContent = testo || "";
    avviso.hidden = !testo;
  }

  function disegnaLAggiornamento(stato) {
    trova("aggiornamento").hidden = false;
    var laMia = stato.mia
      ? due(
          "Questo add-on è la versione " + stato.mia + ". ",
          "This add-on is version " + stato.mia + ". ",
        )
      : "";
    if (stato.locale !== true) {
      trova("aggiornamento-riga").textContent =
        laMia +
        due(
          "Gli aggiornamenti arrivano da Home Assistant, come per ogni altro add-on.",
          "Updates come from Home Assistant, like for any other add-on.",
        );
      trova("aggiornamento-spiega").textContent = due(
        "Quando ce n'è uno nuovo: Impostazioni → Componenti aggiuntivi → gdahome → Aggiorna.",
        "When there is a new one: Settings → Add-ons → gdahome → Update.",
      );
      trova("aggiorna-il-ponte").hidden = true;
      trova("riguarda").hidden = true;
      return;
    }
    trova("riguarda").hidden = false;
    var riga = due(
      "Questo add-on è la versione " + (stato.mia || "—") + ".",
      "This add-on is version " + (stato.mia || "—") + ".",
    );
    var spiega = "";
    var siPuo = false;
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

  /* ─── Il giro di ogni dieci secondi ─────────────────────────────────────── */

  /* L'ultimo stato letto: le righe che dipendono anche dalla licenza si
   * ridisegnano quando arriva lei, senza aspettare il giro dopo. */
  var lUltimoStato = null;

  function aggiornaTutto() {
    return chiedi("api/stato")
      .then(function (stato) {
        lUltimoStato = stato;
        disegnaLaCasa(stato.casa);
        trova("porta").textContent = stato.porta;
        trova("spiega-centralino").textContent = comeVaIlCentralino(stato.centralino).lungo;
        disegnaIlFuori(stato.centralino);
        scriviLoZigbee(stato.zigbee);
        /* La versione, sempre a schermo accanto al nome. */
        disegnaLaVersione(stato.versione);
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
        /* E «Se qualcosa non torna» lo stesso, per la stessa ragione: a chi
         * ha gdahome in casa i rimedi li dice la Panoramica, sotto la riga che
         * non va; il racconto tecnico serve a chi risponde. */
        trova("non-torna").hidden = !risponde;
        disegnaLaProvenienza(stato.plancia);
        disegnaIlLink(stato.app);
        disegnaIlLinkDiFuori(stato.app ? stato.centralino : null);
        disegnaIDispositivi(stato.dispositivi, stato.massimi);
        laProvaSiVede(stato.gestore === true, stato.prova);
        seguiLaProva(stato.prova);
        disegnaLePlance(stato.plance);
        /* La riga si scrive subito con quello che si sa, e si riscrive quando
         * la prova della cartina torna: chi guarda vede una frase giusta
         * adesso e una piu' precisa mezzo secondo dopo, invece di un vuoto. */
        trova("stato-plance-in-casa").textContent = comeVannoLePlanceInCasa(stato.plance_in_casa);
        laCartinaSiScarica(stato.plance_in_casa && stato.plance_in_casa.cartina).then(function () {
          trova("stato-plance-in-casa").textContent = comeVannoLePlanceInCasa(stato.plance_in_casa);
          avvisaSullaCartina(stato.plance_in_casa && stato.plance_in_casa.risorsa_guaio);
        });
        contaIGuai();
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
        coloraLaFaccia("faccia-casa", "male");
        trova("riga-casa").textContent = due(
          "La console non riesce a leggere lo stato di gdahome.",
          "The console can't read gdahome's state.",
        );
        trova("spiega-casa").textContent = trova("riga-casa").textContent;
        scriviIlRimedio(
          "rimedio-casa",
          errore.message,
          due(
            "Se l'add-on si sta riavviando, fra poco torna da sé.",
            "If the add-on is restarting, it comes back by itself shortly.",
          ),
        );
        contaIGuai();
      });
  }

  /* ─── Abbinare un telefono ──────────────────────────────────────────────── */

  function riprendiIlCodice() {
    return chiedi("api/codice")
      .then(function (vivo) {
        if (vivo.attivo) disegnaIlCodice(vivo.codice, vivo.scadeIl);
      })
      .catch(function () {
        /* Se non si riesce a riprenderlo si resta senza: il bottone e' li'. */
      });
  }

  /* Sotto «Per chi è», chi vedrà cosa: il telefono eredita le plance di
   * quella persona, ed e' meglio leggerlo prima di inquadrare. */
  function spiegaIlPerChi() {
    var scelta = trova("per-chi");
    var spiega = trova("per-chi-spiega");
    if (!scelta || !spiega) return;
    var nome = "";
    (gliUtenti || []).forEach(function (uno) {
      if (uno.id === scelta.value) nome = uno.nome;
    });
    spiega.textContent = nome
      ? due(
          "Il telefono vedrà le plance che vede " + nome + ".",
          "The phone will see the dashboards " + nome + " sees.",
        )
      : due(
          "Il telefono vedrà le plance che vedi tu.",
          "The phone will see the dashboards you see.",
        );
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
        spiegaIlPerChi();
      })
      .catch(function () {
        /* Senza l'elenco non si puo' scegliere, e non e' un guaio: il codice
         * si fabbrica comunque, intestato a chi sta premendo. */
        riga.hidden = true;
      });
  }

  riempiIlPerChi();
  trova("per-chi").addEventListener("change", spiegaIlPerChi);

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

  trova("annulla").addEventListener("click", function () {
    chiedi("api/codice", { method: "DELETE" }).then(function () {
      nascondiIlCodice();
      aggiornaTutto();
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
      body: JSON.stringify({
        titolo: casella.value,
        modello: ilModelloScelto(),
        utenti: gliUtentiScelti(),
      }),
    })
      .then(function () {
        casella.value = "";
        /* Si riparte dalla scelta di sempre: a muro, e la vedono tutti. */
        var caselle = trova("nuova-plancia").querySelectorAll("input");
        for (var i = 0; i < caselle.length; i += 1)
          caselle[i].checked = caselle[i].type === "radio" && caselle[i].value === "muro";
        return aggiornaTutto();
      })
      .catch(function (errore) {
        tasto.disabled = false;
        avvisaLePlance(errore.message);
      });
  }

  /* Il modello della plancia nuova: a muro o classica. */
  function ilModelloScelto() {
    var scelto = trova("nuova-plancia").querySelector('input[name="modello-plancia"]:checked');
    return scelto ? scelto.value : "classica";
  }

  /* Gli utenti spuntati per la plancia nuova. Nessuno vuol dire tutti, come
   * nel cassetto «Chi la vede» delle plance che ci sono gia'. */
  function gliUtentiScelti() {
    var scelti = [];
    var caselle = trova("utenti-plancia-nuova").querySelectorAll("input[data-utente]");
    for (var i = 0; i < caselle.length; i += 1) {
      if (caselle[i].checked) scelti.push(caselle[i].getAttribute("data-utente"));
    }
    return scelti;
  }

  /* Le spunte di chi vede la plancia nuova: si disegnano una volta, e non a
   * ogni giro della pagina, se no le spunte appena messe sparirebbero. */
  function riempiGliUtentiDellaNuova() {
    var dove = trova("utenti-plancia-nuova");
    if (!dove || dove.getAttribute("data-pieno") === "1") return;
    dove.setAttribute("data-pieno", "1");
    chiediGliUtenti()
      .then(function (utenti) {
        dove.textContent = "";
        var spiega = vediPagina.createElement("p");
        spiega.className = "minuta";
        spiega.textContent =
          utenti.length === 0
            ? due(
                "In questa casa c'è un utente solo: la vede lui.",
                "This home has a single user: they see it.",
              )
            : due(
                "Nessuno spuntato: la vedono tutti. Per un tablet a muro, spunta l'utente con cui è entrato il tablet.",
                "Nobody ticked: everyone sees it. For a wall tablet, tick the user the tablet signed in with.",
              );
        dove.appendChild(spiega);
        utenti.forEach(function (uno) {
          var riga = vediPagina.createElement("label");
          riga.className = "spunta";
          var casella = vediPagina.createElement("input");
          casella.type = "checkbox";
          casella.setAttribute("data-utente", uno.id);
          var nome = vediPagina.createElement("span");
          /* `textContent`: il nome di un utente l'ha scritto una persona. */
          nome.textContent =
            uno.nome + (uno.amministratore ? due(" · amministratore", " · admin") : "");
          riga.appendChild(casella);
          riga.appendChild(nome);
          dove.appendChild(riga);
        });
      })
      .catch(function () {
        /* Senza utenti si aggiunge lo stesso: la vedono tutti, e si
         * restringe dopo dal suo «Chi la vede». */
        dove.removeAttribute("data-pieno");
        dove.textContent = "";
        var spiega = vediPagina.createElement("p");
        spiega.className = "minuta";
        spiega.textContent = due(
          "Non riesco a chiedere gli utenti a Home Assistant: la vedranno tutti, e la restringi dopo da «Chi la vede».",
          "I can't ask Home Assistant for the users: everyone will see it, and you can restrict it later from «Who sees it».",
        );
        dove.appendChild(spiega);
      });
  }

  trova("aggiungi-plancia").addEventListener("click", aggiungiUnaPlancia);
  trova("titolo-plancia").addEventListener("keydown", function (evento) {
    if (evento.key === "Enter") aggiungiUnaPlancia();
  });

  /* ─── La casa di prova ──────────────────────────────────────────────────
   *
   * Il codice per chi rivede l'app: vale fino a sette giorni e per piu'
   * telefoni, e chi entra con lui entra come l'utente scelto qui, che non
   * amministra. Il codice si chiede ad `api/prova` solo quando lo si deve
   * disegnare: lo stato, ogni dieci secondi, dice soltanto se c'e', fino a
   * quando, e quanti telefoni sono entrati.
   *
   * La scheda si vede solo nell'Home Assistant del gestore (`gestore` nello
   * stato), o dove una casa di prova c'e' gia' — quella si deve poter
   * revocare da dovunque sia nata. */
  var laProva = null;
  var gliUtentiDellaProva = false;

  function laProvaSiVede(gestore, breve) {
    var si = gestore || Boolean(breve && breve.attiva);
    trova("scheda-prova").hidden = !si;
    /* Il tasto per farne una nuova, solo al gestore: altrove la scheda c'e'
     * solo per guardare e revocare quella che c'e'. */
    trova("prova-fai").hidden = !gestore;
    if (si && gestore && !gliUtentiDellaProva) {
      gliUtentiDellaProva = true;
      riempiIlPerChiDellaProva();
    }
  }

  function avvisaLaProva(testo) {
    var avviso = trova("avviso-prova");
    avviso.textContent = testo || "";
    avviso.hidden = !testo;
  }

  /* «6 ott», per il bollino accanto al nome di un telefono. */
  function unGiornoCorto(quando) {
    try {
      return new Date(quando).toLocaleDateString([], { day: "numeric", month: "short" });
    } catch (_errore) {
      return "—";
    }
  }

  /* «lunedì 6 ottobre, 23:10»: sotto il QR, dove si legge fino a quando vale. */
  function unGiornoIntero(quando) {
    try {
      var q = new Date(quando);
      return (
        q.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }) +
        ", " +
        q.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    } catch (_errore) {
      return "—";
    }
  }

  function quantiTelefoni(quanti) {
    return due(
      quanti === 1 ? "1 telefono" : quanti + " telefoni",
      quanti === 1 ? "1 phone" : quanti + " phones",
    );
  }

  /* Per chi: solo gli utenti che non amministrano. Chi entra col codice di
   * prova entra come lui, e un amministratore darebbe a uno sconosciuto la
   * casa intera: la console non lo propone, e il ponte comunque lo rifiuta. */
  function riempiIlPerChiDellaProva() {
    var scelta = trova("prova-per-chi");
    var tasto = trova("prova-fai");
    chiediGliUtenti()
      .then(function (utenti) {
        var prima = scelta.value;
        scelta.textContent = "";
        var buoni = utenti.filter(function (uno) {
          return !uno.amministratore && uno.attivo !== false;
        });
        buoni.forEach(function (uno) {
          var voce = vediPagina.createElement("option");
          voce.value = uno.id;
          /* `textContent`: il nome di un utente l'ha scritto una persona. */
          voce.textContent = due(
            uno.nome + " · senza amministrazione",
            uno.nome + " · not an administrator",
          );
          scelta.appendChild(voce);
        });
        if (!buoni.length) {
          var nessuno = vediPagina.createElement("option");
          nessuno.value = "";
          nessuno.textContent = due(
            "nessun utente che non amministra",
            "no user who isn't an administrator",
          );
          scelta.appendChild(nessuno);
          trova("prova-chi-scegliere").textContent = due(
            "In Home Assistant non c'è ancora un utente che non amministra. Creane uno — " +
              "Impostazioni › Persone › Aggiungi persona, senza «Amministratore» — e riapri " +
              "questa pagina.",
            "Home Assistant has no user yet who isn't an administrator. Make one — Settings › " +
              "People › Add person, without “Administrator” — and reopen this page.",
          );
        } else if (prima) {
          scelta.value = prima;
        }
        tasto.disabled = !buoni.length;
      })
      .catch(function () {
        tasto.disabled = true;
        avvisaLaProva(
          due(
            "Non riesco a sapere chi sono gli utenti di Home Assistant: riapri la pagina fra poco.",
            "I can't find out who Home Assistant's users are: reopen the page in a moment.",
          ),
        );
      });
  }

  /* Le due facce della scheda: senza codice le scelte e il tasto, con il
   * codice il QR, le lettere, chi entra e la revoca. */
  function disegnaLaProva(prova) {
    laProva = prova && prova.attiva ? prova : null;
    trova("prova-da-fare").hidden = Boolean(laProva);
    trova("prova-fatta").hidden = !laProva;
    if (!laProva) {
      trova("prova-conta").textContent = due("per chi rivede l'app", "for whoever reviews the app");
      return;
    }
    trova("prova-codice").textContent = aGruppi(laProva.codice);
    /* La marca e' l'ora in cui il codice e' nato: un codice nuovo ha un QR
     * nuovo, e il browser non rimette quello di prima. */
    trova("prova-qr").src = "api/prova/qr.svg?" + laProva.natoIl;
    trova("prova-scarica").href = "api/prova/qr.png?" + laProva.natoIl;
    trova("prova-scadenza").textContent =
      due("Vale fino a ", "Good until ") + unGiornoIntero(laProva.scadeIl);
    disegnaChiEntraDiProva();
  }

  /* Le righe che cambiano col numero dei telefoni entrati. Il nome
   * dell'utente lo ha scritto una persona: va in un nodo di testo, mai in
   * `innerHTML`. */
  function disegnaChiEntraDiProva() {
    if (!laProva) return;
    var quanti = Number(laProva.telefoni) || 0;
    trova("prova-conta").textContent = due("attiva · ", "active · ") + quantiTelefoni(quanti);
    var chi = trova("prova-chi");
    chi.textContent = "";
    var nome = "";
    (gliUtenti || []).forEach(function (uno) {
      if (uno.id === laProva.utente) nome = uno.nome;
    });
    chi.appendChild(
      vediPagina.createTextNode(
        due("Chi entra con questo codice è ", "Whoever uses this code is "),
      ),
    );
    var forte = vediPagina.createElement("b");
    forte.textContent = nome || due("l'utente scelto", "the chosen user");
    chi.appendChild(forte);
    chi.appendChild(
      vediPagina.createTextNode(
        due(". Entrati finora: ", ". So far: ") + quantiTelefoni(quanti) + ".",
      ),
    );
    trova("prova-revoca-spiega").textContent =
      (quanti
        ? due(
            "Revocando, il codice smette di valere e " +
              (quanti === 1
                ? "il telefono entrato con lui esce subito."
                : "i " + quanti + " telefoni entrati con lui escono subito."),
            "Revoking stops the code, and " +
              (quanti === 1
                ? "the phone that came in with it leaves right away."
                : "the " + quanti + " phones that came in with it leave right away."),
          )
        : due("Revocando, il codice smette di valere.", "Revoking stops the code.")) +
      " " +
      due("Alla scadenza succede lo stesso da solo.", "At expiry the same happens by itself.");
  }

  /* Dallo stato di ogni dieci secondi: il codice si richiede solo se e'
   * nato adesso, o cambiato; per il resto basta ridisegnare i conti. */
  function seguiLaProva(breve) {
    if (!breve || !breve.attiva) {
      if (laProva) disegnaLaProva(null);
      return;
    }
    if (laProva && laProva.scadeIl === breve.scadeIl) {
      laProva.telefoni = breve.telefoni;
      disegnaChiEntraDiProva();
      return;
    }
    chiedi("api/prova")
      .then(disegnaLaProva)
      .catch(function (errore) {
        avvisaLaProva(errore.message);
      });
  }

  trova("prova-fai").addEventListener("click", function () {
    var tasto = trova("prova-fai");
    avvisaLaProva("");
    tasto.disabled = true;
    chiedi("api/prova", {
      method: "POST",
      body: JSON.stringify({
        utente: trova("prova-per-chi").value,
        giorni: Number(trova("prova-quanto").value) || 7,
      }),
    })
      .then(function (fatta) {
        tasto.disabled = false;
        disegnaLaProva(fatta);
        return aggiornaTutto();
      })
      .catch(function (errore) {
        tasto.disabled = false;
        avvisaLaProva(errore.message);
      });
  });

  /* «Copia il codice», a gruppi come si legge. Dentro il telaio di Home
   * Assistant gli appunti possono non esserci: allora si seleziona il testo,
   * e lo si copia a mano. Come per la matricola. */
  trova("prova-copia").addEventListener("click", function () {
    var tasto = trova("prova-copia");
    var testo = trova("prova-codice").textContent;
    if (!testo) return;
    var fatto = function () {
      tasto.textContent = due("Copiato", "Copied");
      setTimeout(function () {
        tasto.textContent = due("Copia il codice", "Copy the code");
      }, 1800);
    };
    var aMano = function () {
      var scelta = vediPagina.defaultView.getSelection();
      var tratto = vediPagina.createRange();
      tratto.selectNodeContents(trova("prova-codice"));
      scelta.removeAllRanges();
      scelta.addRange(tratto);
      tasto.textContent = due("Selezionato: copialo", "Selected: copy it");
    };
    var appunti = navigator.clipboard;
    if (!appunti || !appunti.writeText) {
      aMano();
      return;
    }
    appunti.writeText(testo).then(fatto, aMano);
  });

  trova("prova-revoca").addEventListener("click", function () {
    if (
      !window.confirm(
        due(
          "Revocare la casa di prova? Il codice smette di valere e i telefoni entrati con lui " +
            "escono subito.",
          "Revoke the test home? The code stops working and the phones that came in with it " +
            "leave right away.",
        ),
      )
    )
      return;
    var tasto = trova("prova-revoca");
    tasto.disabled = true;
    chiedi("api/prova", { method: "DELETE" })
      .then(function () {
        tasto.disabled = false;
        disegnaLaProva(null);
        return aggiornaTutto();
      })
      .catch(function (errore) {
        tasto.disabled = false;
        avvisaLaProva(errore.message);
      });
  });

  /* ─── L'installatore ─────────────────────────────────────────────────────
   *
   * Due schede possibili, e la linguetta c'e' se ce n'e' almeno una: il
   * quadro di chi ha fatto l'impianto (questa casa gli manda il rapporto), e
   * la Gestione installatore (questo Home Assistant e' di chi installa). */
  var ilQuadroCe = false;
  var laGestioneCe = false;
  var chiHaFattoLImpianto = "";
  var ogniQuantiMinuti = 1;

  function disegnaLInstallatore() {
    var si = ilQuadroCe || laGestioneCe;
    mostraLaLinguetta("installatore", si);
    trova("voce-installatore").hidden = !si;
    if (!si) return;
    trova("riepilogo-installatore").textContent = ilQuadroCe
      ? (chiHaFattoLImpianto || due("Chi ti ha fatto l'impianto", "Whoever installed your home")) +
        due(" riceve un rapporto ", " gets a status report ") +
        ogniTanto(ogniQuantiMinuti)
      : due(
          "Da qui si apre la tua Gestione installatore",
          "Your Installer management opens from here",
        );
  }

  /* «ogni minuto», «ogni 5 minuti»: prima si leggeva «ogni 1 minuti». */
  function ogniTanto(minuti) {
    var quanti = Number(minuti) || 1;
    return quanti === 1
      ? due("ogni minuto", "every minute")
      : due("ogni " + quanti + " minuti", "every " + quanti + " minutes");
  }

  /* La Gestione installatore: la scheda c'e' solo dove l'add-on ha
   * l'interruttore acceso. Una porta che non si apre e' peggio di una porta
   * che non c'e', ed e' la stessa regola della voce «Console» nell'app. */
  function guardaIlCruscotto() {
    chiedi("api/cruscotto")
      .then(function (detto) {
        var scheda = trova("scheda-cruscotto");
        if (!detto || !detto.installatore || !detto.dove) {
          scheda.hidden = true;
          laGestioneCe = false;
          disegnaLInstallatore();
          return;
        }
        var vai = trova("cruscotto-vai");
        vai.href = detto.dove;
        /* Col biglietto: la scheda si apre gia' aperta, senza ribattere la
         * chiave. La scheda si apre subito, al tocco — un browser lascia
         * aprire una scheda solo mentre il dito e' sul tasto — e l'indirizzo
         * le si da' quando il biglietto arriva. Se il quadro non lo da', ci
         * va l'indirizzo com'e', e la chiave la chiede la pagina, com'era. */
        if (!vai.dataset.biglietto) {
          vai.dataset.biglietto = "sì";
          vai.addEventListener("click", function (evento) {
            var scheda = null;
            try {
              scheda = window.open("", "_blank");
            } catch (_niente) {
              scheda = null;
            }
            if (!scheda) return;
            evento.preventDefault();
            chiedi("api/cruscotto/biglietto", { method: "POST", body: "{}" })
              .then(function (risposta) {
                scheda.location = risposta && risposta.dove ? risposta.dove : vai.href;
              })
              .catch(function () {
                scheda.location = vai.href;
              });
          });
        }
        scheda.hidden = false;
        laGestioneCe = true;
        disegnaLInstallatore();
      })
      .catch(function () {
        /* Un ponte vecchio non conosce quella via: la scheda resta via, ed e'
         * la risposta giusta. */
      });
  }

  function quandoEArrivato(esito) {
    if (!esito) return due("non ne è ancora partito nessuno", "none has gone out yet");
    var quanti = Math.round((Date.now() - esito.quando) / 60000);
    var fa =
      quanti < 1
        ? due("adesso", "just now")
        : quanti < 60
          ? quanti + due(" min fa", " min ago")
          : Math.round(quanti / 60) + due(" ore fa", " hours ago");
    if (esito.andata) return due("l'ultimo rapporto è arrivato ", "the last report arrived ") + fa;
    return due("l'ultimo rapporto non è arrivato (", "the last report did not arrive (") + fa + ")";
  }

  /* Il quadro di chi ha fatto l'impianto.
   *
   * Questa scheda compare **solo** dove quella casella e' piena — cioe' quasi
   * mai — e fa una cosa sola che le altre non fanno: mostra il testo che parte
   * da questa casa, intero e senza riassunti. Un riassunto di quello che esce
   * e' esattamente la cosa di cui ci si dovrebbe fidare.
   *
   * Si chiede ogni minuto e non ogni dieci secondi come il resto. */
  function guardaIlQuadro() {
    return chiedi("api/quadro")
      .then(function (quadro) {
        var scheda = trova("scheda-quadro");
        if (!quadro || !quadro.acceso) {
          scheda.hidden = true;
          ilQuadroCe = false;
          disegnaLInstallatore();
          return;
        }
        scheda.hidden = false;
        ilQuadroCe = true;
        /* Chi riceve, col nome dell'installatore se il quadro l'ha detto.
         *
         * Il nome viene da chi tiene il quadro, non da lui: non c'e'
         * nessuna via da cui un installatore possa cambiarsi il nome, quindi
         * nessuno puo' presentarsi qui dentro come qualcun altro. L'indirizzo
         * si mostra lo stesso, e non e' ridondanza: e' quello che si controlla
         * se il nome non convince. */
        chiHaFattoLImpianto = quadro.chi || "";
        ogniQuantiMinuti = quadro.ogni;
        trova("quadro-chi").textContent =
          chiHaFattoLImpianto || due("Chi ti ha fatto l'impianto", "Whoever installed your home");
        var doveSta = String(quadro.dove || "")
          .replace(/^https?:\/\//, "")
          .replace(/\/$/, "");
        trova("quadro-dove").textContent = due(
          "Questa casa gli manda un rapporto " +
            ogniTanto(quadro.ogni) +
            ", passando da " +
            doveSta +
            ": così vede se l'impianto funziona e se va aggiornato.",
          "This home sends them a status report " +
            ogniTanto(quadro.ogni) +
            ", through " +
            doveSta +
            ": that way they see whether the system works and needs updating.",
        );
        trova("quadro-esito").textContent = quandoEArrivato(quadro.esito);
        /* I due interruttori in piu', se sono accesi: li dice il rapporto
         * stesso, che e' quello partito davvero. */
        var ultima = quadro.ultima || {};
        trova("quadro-vede-plancia").hidden = ultima.configurazione !== true;
        trova("quadro-puo").hidden = ultima.manutenzione !== true;
        /* Il testo com'e' partito. `JSON.stringify` con l'indentazione: e' lo
         * stesso oggetto che e' andato, non una sua descrizione. */
        trova("quadro-testo").textContent = quadro.ultima
          ? JSON.stringify(quadro.ultima, null, 2)
          : due(
              "Non ne è ancora partito nessuno: il primo esce pochi secondi dopo l'accensione.",
              "None has gone out yet: the first one leaves a few seconds after start-up.",
            );
        disegnaLInstallatore();
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
    /* La parola si scrive qui e non si legge dal tasto: letta dal tasto
     * prima della traduzione tornava in italiano a chi leggeva in inglese. */
    var parola = due("Smetti di mandarlo", "Stop sending it");
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
            ilQuadroCe = false;
            disegnaLInstallatore();
            return;
          }
          /* Fermata adesso, ma la casella e' rimasta piena: va detto, perche'
           * al riavvio ricomincia. */
          avviso.hidden = false;
          avviso.className = "avviso giallo";
          avviso.textContent = due(
            "Non manda più niente da adesso, ma la casella «Il codice di chi ti ha fatto l'impianto» è rimasta piena: svuotala nella scheda di questo add-on, se no al prossimo riavvio ricomincia.",
            "It sends nothing from now on, but the “The code of whoever installed your home” box is still filled in: empty it in this add-on's options, otherwise it starts again at the next restart.",
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

  /* ─── La licenza ────────────────────────────────────────────────────────── */

  /* Una data per una persona: «12 marzo 2027», non un numero. */
  function unGiorno(quando) {
    try {
      return new Date(quando).toLocaleDateString(INGLESE ? "en-GB" : "it-IT", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch (_errore) {
      return new Date(quando).toISOString().slice(0, 10);
    }
  }

  /* Da dove viene, in una parola che dica qualcosa a chi ci abita. */
  function daDove(origine) {
    if (origine === "negozio") return due("abbonamento", "subscription");
    if (origine === "regalo") return due("regalo", "gift");
    if (origine === "installatore")
      return due("da chi ti ha fatto l'impianto", "from your installer");
    return "";
  }

  /* Quanto tempo fa, in parole corte. */
  function quantoFa(quando) {
    var minuti = Math.round((Date.now() - quando) / 60000);
    if (minuti < 1) return due("adesso", "just now");
    if (minuti < 60) return minuti + due(" min fa", " min ago");
    return Math.round(minuti / 60) + due(" ore fa", " hours ago");
  }

  /* Com'e' messa un'app, in una riga: la stessa nella scheda e nella
   * Panoramica, cosi' le due non possono dire cose diverse. */
  function comEMessa(sua, perBase) {
    if (!sua.attiva) return perBase;
    var pezzi = [];
    /* Di un abbonamento si scrive la fine del periodo pagato, non quella
     * coi giorni di margine per il rinnovo. Nei giorni del margine — il
     * periodo pagato e' finito e il rinnovo non e' ancora arrivato — una
     * data gia' passata non si scrive: si scrive fino a quando vale, e che
     * il rinnovo si aspetta. */
    var nelMargine = sua.pagato != null && sua.pagato <= Date.now();
    var finoAl = sua.pagato != null && !nelMargine ? sua.pagato : sua.scade;
    pezzi.push(
      finoAl == null
        ? due("Premium per sempre", "Premium for good")
        : due("Premium fino al ", "Premium until ") + unGiorno(finoAl),
    );
    if (sua.compresa) pezzi.push(due("compreso in gdahome Premium", "included in gdahome Premium"));
    else {
      if (daDove(sua.origine)) pezzi.push(daDove(sua.origine));
      if (nelMargine) pezzi.push(due("rinnovo in attesa", "renewal pending"));
    }
    return pezzi.join(" · ");
  }

  /* La riga di un'app: il nome, com'e' messa, e il bollino. */
  function unaRigaDiLicenza(nome, sua, perBase) {
    var riga = vediPagina.createElement("li");
    var parole = vediPagina.createElement("div");
    parole.className = "nome";
    var forte = vediPagina.createElement("strong");
    forte.textContent = nome;
    var sotto = vediPagina.createElement("span");
    sotto.textContent = comEMessa(sua, perBase);
    parole.appendChild(forte);
    parole.appendChild(sotto);
    riga.appendChild(parole);
    var bollino = vediPagina.createElement("span");
    bollino.className = "bollino" + (sua.attiva ? " premium" : "");
    bollino.textContent = sua.attiva ? "Premium" : "Base";
    riga.appendChild(bollino);
    return riga;
  }

  function perBaseGdahome() {
    return due(
      "Base: una sola plancia nell'app e nel browser, e accesso solo dalla rete di casa",
      "Base: one dashboard in the app and the browser, and access only from the home network",
    );
  }

  function disegnaLaLicenza(stato) {
    if (!stato || !stato.attive) {
      mostraLaLinguetta("licenza", false);
      trova("voce-licenza").hidden = true;
      soloBase = false;
      /* Licenze spente: nessun lucchetto, e nessuna frase su Premium. */
      premium = true;
      ridisegnaQuelloCheDipendeDallaLicenza();
      return;
    }
    mostraLaLinguetta("licenza", true);
    trova("voce-licenza").hidden = false;
    var spenta = { attiva: false };
    var gdahome = stato.gdahome || spenta;
    var gdanav = stato.gdanav || spenta;
    /* Base limita la casa solo se il ponte lo dice, e il ponte di oggi non
     * lo dice mai: i lucchetti di Base li mettono l'app e il browser, e qui
     * non si spengono tasti che la casa non spegne. Un ponte di prima, che
     * `limitata` non la mandava, limitava con Base. */
    soloBase = stato.limitata === undefined ? !gdahome.attiva : stato.limitata === true;
    premium = Boolean(gdahome.attiva);
    var elenco = trova("elenco-licenze");
    elenco.textContent = "";
    elenco.appendChild(unaRigaDiLicenza("gdahome", gdahome, perBaseGdahome()));
    elenco.appendChild(
      unaRigaDiLicenza(
        "gdanav",
        gdanav,
        due(
          "Base: navigazione completa per l'auto termica",
          "Base: full navigation for combustion cars",
        ),
      ),
    );
    /* La riga della Panoramica: gdahome, che e' la licenza della casa. */
    trova("riepilogo-licenza").textContent = comEMessa(gdahome, perBaseGdahome());
    var bollino = trova("bollino-licenza");
    bollino.textContent = gdahome.attiva ? "Premium" : "Base";
    bollino.className = "bollino" + (gdahome.attiva ? " premium" : "");
    /* La matricola: si vede appena il ponte la dice. */
    var matricola = String(stato.casa || "");
    trova("matricola").hidden = !matricola;
    trova("licenza-casa").textContent = matricola;
    /* Quando e' stata chiesta l'ultima volta: la casa la rinnova da se' ogni
     * sei ore, e chi guarda deve poter vedere che lo fa. */
    var ultima = stato.ultima;
    trova("licenza-quando").textContent = !ultima
      ? ""
      : ultima.andata
        ? due("controllata ", "checked ") + quantoFa(ultima.quando)
        : due("il quadro non risponde", "the licence server isn't answering");
    ridisegnaQuelloCheDipendeDallaLicenza();
  }

  /* Le frasi che cambiano fra Base e Premium, ridette appena la licenza
   * arriva o cambia, senza aspettare il giro dello stato. */
  function ridisegnaQuelloCheDipendeDallaLicenza() {
    if (lUltimoStato) disegnaIlFuori(lUltimoStato.centralino);
    scriviIlLinkDiFuori();
    disegnaLaNotaDellePlance();
    contaIGuai();
  }

  function guardaLaLicenza() {
    return chiedi("api/licenza")
      .then(function (stato) {
        var prima = soloBase;
        disegnaLaLicenza(stato);
        /* Le plance dipendono da questa risposta: se e' cambiata, si
         * ridisegnano subito invece che al giro dopo. */
        if (prima !== soloBase) return aggiornaTutto();
        return undefined;
      })
      .catch(function () {
        /* Come per il quadro: una via che non risponde non fa sparire la
         * scheda sotto gli occhi di chi la sta leggendo. */
      });
  }

  function avvisaLaLicenza(testo, bene) {
    var avviso = trova("avviso-licenza");
    avviso.textContent = testo || "";
    avviso.className = "avviso" + (bene ? " bene" : "");
    avviso.hidden = !testo;
  }

  /* Le frasi dei no del quadro, dai loro codici: la pagina non indovina da
   * una frase inglese scritta da una macchina. */
  function percheNo(codice, altrimenti) {
    var frasi = {
      "codice-storto": due(
        "Un codice regalo è fatto così: GDA-XXXX-XXXX-XXXX.",
        "A gift code looks like this: GDA-XXXX-XXXX-XXXX.",
      ),
      "codice-inesistente": due("Questo codice non esiste.", "This code doesn't exist."),
      "codice-gia-usato": due(
        "Questo codice è già stato usato.",
        "This code has already been used.",
      ),
      "quadro-irraggiungibile": due(
        "Il quadro delle licenze non risponde: riprova fra poco.",
        "The licence server isn't answering: try again shortly.",
      ),
    };
    return frasi[codice] || altrimenti || due("Non ha funzionato.", "It didn't work.");
  }

  function riscattaIlCodice() {
    var casella = trova("codice-regalo");
    var tasto = trova("riscatta");
    if (!casella.value.trim()) return;
    avvisaLaLicenza("");
    tasto.disabled = true;
    fetch("api/licenza/riscatta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ codice: casella.value }),
    })
      .then(function (risposta) {
        return risposta.json().then(function (corpo) {
          if (!risposta.ok) {
            avvisaLaLicenza(percheNo(corpo && corpo.errore, corpo && corpo.spiegazione));
            return undefined;
          }
          casella.value = "";
          disegnaLaLicenza(corpo);
          avvisaLaLicenza(
            due(
              "Fatto: il codice vale per questa casa.",
              "Done: the code now counts for this home.",
            ),
            true,
          );
          return aggiornaTutto();
        });
      })
      .catch(function () {
        avvisaLaLicenza(percheNo("quadro-irraggiungibile"));
      })
      .finally(function () {
        tasto.disabled = false;
      });
  }

  trova("riscatta").addEventListener("click", riscattaIlCodice);

  /* «Ricontrolla adesso»: la casa chiede subito la licenza al quadro, invece
   * di aspettare il giro delle sei ore. Com'e' andata lo dice `ultima`: un
   * quadro che non risponde lascia la licenza di prima, e si dice. */
  var finisceIlFatto = null;
  function avvisaIlControllo(testo, bene) {
    clearTimeout(finisceIlFatto);
    var avviso = trova("avviso-ricontrolla");
    avviso.textContent = testo || "";
    avviso.className = "avviso" + (bene ? " bene" : "");
    avviso.hidden = !testo;
    /* Il «fatto» si legge e se ne va; un no resta, finche' non si riprova. */
    if (bene)
      finisceIlFatto = setTimeout(function () {
        avvisaIlControllo("");
      }, 8000);
  }

  trova("ricontrolla").addEventListener("click", function () {
    var tasto = trova("ricontrolla");
    avvisaIlControllo("");
    tasto.disabled = true;
    tasto.textContent = due("Ricontrollo…", "Checking…");
    chiedi("api/licenza/ricontrolla", { method: "POST" })
      .then(function (stato) {
        var prima = soloBase;
        disegnaLaLicenza(stato);
        var ultima = stato && stato.ultima;
        if (ultima && ultima.andata)
          avvisaIlControllo(
            due("Fatto: la licenza è aggiornata.", "Done: the licence is up to date."),
            true,
          );
        else
          avvisaIlControllo(
            due(
              "Il quadro delle licenze non risponde: resta la licenza di prima. Riprova fra poco.",
              "The licence server isn't answering: the previous licence stays. Try again shortly.",
            ),
          );
        if (prima !== soloBase) return aggiornaTutto();
        return undefined;
      })
      .catch(function () {
        avvisaIlControllo(
          due(
            "Non è stato possibile ricontrollare: riprova fra poco.",
            "It couldn't be checked: try again shortly.",
          ),
        );
      })
      .finally(function () {
        tasto.disabled = false;
        tasto.textContent = due("Ricontrolla adesso", "Check now");
      });
  });

  /* «Copia» la matricola. Dentro il telaio di Home Assistant gli appunti
   * possono non esserci: allora si seleziona il testo, e lo si copia a mano. */
  trova("copia-matricola").addEventListener("click", function () {
    var tasto = trova("copia-matricola");
    var testo = trova("licenza-casa").textContent;
    if (!testo) return;
    var fatto = function () {
      tasto.textContent = due("Copiata", "Copied");
      setTimeout(function () {
        tasto.textContent = due("Copia", "Copy");
      }, 1800);
    };
    var aMano = function () {
      var scelta = vediPagina.defaultView.getSelection();
      var tratto = vediPagina.createRange();
      tratto.selectNodeContents(trova("licenza-casa"));
      scelta.removeAllRanges();
      scelta.addRange(tratto);
      tasto.textContent = due("Selezionata: copiala", "Selected: copy it");
    };
    var appunti = navigator.clipboard;
    if (!appunti || !appunti.writeText) {
      aMano();
      return;
    }
    appunti.writeText(testo).then(fatto, aMano);
  });
  trova("codice-regalo").addEventListener("keydown", function (evento) {
    if (evento.key === "Enter") riscattaIlCodice();
  });

  /* ─── Si parte ──────────────────────────────────────────────────────────── */

  /* La sezione dell'indirizzo, o la Panoramica. Quelle che arrivano dopo — la
   * licenza, l'installatore — ci portano da sole quando compaiono. */
  vaiA(richiesta || "panoramica", "da-sola");

  aggiornaTutto();
  setInterval(aggiornaTutto, 10000);
  /* La versione nuova si guarda all'apertura e poi ogni dieci minuti: la
   * risposta arriva da GitHub, e una cosa che cambia una volta al giorno non
   * si chiede ogni dieci secondi come il resto. */
  guardaLAggiornamento();
  setInterval(guardaLAggiornamento, 10 * 60 * 1000);
  /* E il rapporto al quadro: ogni minuto, come parte. */
  guardaIlQuadro();
  guardaIlCruscotto();
  setInterval(guardaIlQuadro, 60 * 1000);
  /* E la licenza: la casa la rinnova ogni sei ore, e qui basta guardarla ogni
   * minuto — un codice riscattato si ridisegna da se', senza aspettare. */
  guardaLaLicenza();
  setInterval(guardaLaLicenza, 60 * 1000);
})();
