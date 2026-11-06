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

  /* Il tema chiaro o scuro, quello di Home Assistant.
   *
   * Questa pagina sta in un telaio dentro Home Assistant, e il suo tema li'
   * dentro non arriva: un telaio e' un altro documento, e le variabili di
   * Home Assistant restano fuori. Ma l'ingress sta sullo stesso indirizzo di
   * Home Assistant, e allora il fondo della pagina che ci contiene si puo'
   * leggere: chiaro o scuro, lo si scrive qui in `data-theme` — chi tiene
   * Home Assistant scuro su un telefono chiaro vede la console scura, come il
   * resto. Dove non si legge — la pagina aperta da sola, un telaio di un
   * altro sito — vale il tema del browser (`prefers-color-scheme`). */
  function laLuce(colore) {
    var detto = String(colore || "").trim();
    var r;
    var g;
    var b;
    var corto = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(detto);
    var lungo = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(detto);
    var rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(detto);
    if (corto) {
      r = parseInt(corto[1] + corto[1], 16);
      g = parseInt(corto[2] + corto[2], 16);
      b = parseInt(corto[3] + corto[3], 16);
    } else if (lungo) {
      r = parseInt(lungo[1], 16);
      g = parseInt(lungo[2], 16);
      b = parseInt(lungo[3], 16);
    } else if (rgb) {
      r = Number(rgb[1]);
      g = Number(rgb[2]);
      b = Number(rgb[3]);
    } else {
      return null;
    }
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  function ilTemaDiCasa() {
    var radice = vediPagina.documentElement;
    var fondo = "";
    try {
      if (window.parent && window.parent !== window) {
        fondo = window.parent
          .getComputedStyle(window.parent.document.documentElement)
          .getPropertyValue("--primary-background-color");
      }
    } catch (_altroSito) {
      fondo = "";
    }
    var luce = laLuce(fondo);
    if (luce === null) radice.removeAttribute("data-theme");
    else radice.setAttribute("data-theme", luce < 0.5 ? "dark" : "light");
  }

  ilTemaDiCasa();

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
      "Con GdAHome Base la plancia è una, la principale: le altre sono comprese in Premium.",
      "With GdAHome Base there is one dashboard, the main one: the others come with Premium.",
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
    utente_richiesto: [
      "Scegli per chi è il telefono, poi genera il QR code.",
      "Choose who the phone is for, then generate the QR code.",
    ],
    utente_sconosciuto: [
      "Quella persona non c'è più fra gli utenti di Home Assistant: ricarica la pagina e scegline un'altra.",
      "That person is no longer among Home Assistant's users: reload the page and choose another.",
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
   * Una sezione per volta. La Casa e' il punto da cui si parte: i suoi tasti
   * grandi, le righe che si toccano e — sugli schermi larghi — le linguette in
   * cima portano altrove (`data-vai`). La sezione scelta resta scritta
   * nell'indirizzo — `#telefoni` — con `replaceState`, che non aggiunge un
   * passo alla storia del browser: il tasto «indietro» del browser continua a
   * portare fuori dalla pagina, come prima. Quello della pagina,
   * `data-vai="indietro"`, torna da dove si e' venuti.
   *
   * Due sezioni arrivano dopo, quando si sa se servono: la licenza, e
   * l'installatore. Se l'indirizzo chiedeva una di quelle, ci si va appena
   * compare. «Abbina» non ha una linguetta sua: si accende quella dei
   * telefoni, che e' la stessa faccenda. */
  var LE_SEZIONI = [
    "panoramica",
    "abbina",
    "telefoni",
    "plance",
    "licenza",
    "installatore",
    "avanzate",
  ];
  var LINGUETTA_DI = { abbina: "telefoni" };
  var laSezione = "panoramica";
  var sezionePrima = "";
  var richiesta = (function () {
    var detta = String(window.location.hash || "").replace(/^#/, "");
    return LE_SEZIONI.indexOf(detta) >= 0 ? detta : "";
  })();

  function laLinguetta(nome) {
    return vediPagina.querySelector('.sezioni [data-vai="' + nome + '"]');
  }

  function vaiA(nome, comeSiArriva) {
    if (nome === "indietro")
      nome = sezionePrima && sezionePrima !== laSezione ? sezionePrima : "panoramica";
    var linguetta = laLinguetta(nome);
    if (LE_SEZIONI.indexOf(nome) < 0 || (linguetta && linguetta.hidden)) nome = "panoramica";
    /* Da dove si viene, per «Indietro»: la Casa, o la sezione da cui si e'
     * partiti (dai telefoni ad «Aggiungi un telefono», e ritorno). */
    if (nome !== laSezione) sezionePrima = nome === "panoramica" ? "" : laSezione;
    laSezione = nome;
    /* Sul telefono la testata dice dove si e': il marchio nella Casa, «‹» e
     * il nome della sezione altrove (`data-sezione` lo legge il foglio). */
    vediPagina.documentElement.setAttribute("data-sezione", nome);
    var suoTitolo = trova("sezione-" + nome);
    suoTitolo = suoTitolo && suoTitolo.querySelector("h2");
    trova("titolo-testata").textContent = suoTitolo ? suoTitolo.textContent.trim() : "";
    var accesa = LINGUETTA_DI[nome] || nome;
    LE_SEZIONI.forEach(function (una) {
      var sezione = trova("sezione-" + una);
      if (sezione) sezione.hidden = una !== nome;
      var sua = laLinguetta(una);
      if (!sua) return;
      if (una === accesa) sua.setAttribute("aria-current", "page");
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

  /* Un tocco su un `data-vai`: la sezione voluta resta la richiesta, anche se
   * la sua linguetta non c'e' ancora — ci si va appena compare. */
  function vaiDove(voluta) {
    vaiA(voluta);
    richiesta = voluta === "indietro" ? laSezione : voluta;
  }

  vediPagina.addEventListener("click", function (evento) {
    var dove = evento.target && evento.target.closest ? evento.target.closest("[data-vai]") : null;
    if (!dove) return;
    vaiDove(dove.getAttribute("data-vai"));
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
    vaiDove(dove.getAttribute("data-vai"));
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

  /* La domanda prima di una cosa che non si disfa: togliere un telefono, una
   * plancia, revocare la casa di prova, smettere di mandare il rapporto.
   *
   * Una finestra della pagina e non quella del browser: dentro Home Assistant
   * quella del browser porta in cima l'indirizzo dell'ingress e sembra un
   * errore, e sul telefono copre tutto senza dire di chi e'. Il tasto pronto
   * sotto il dito e' «Annulla»: chi ha toccato per sbaglio non perde niente.
   * Dove `<dialog>` non c'e', si torna alla finestra del browser. */
  function chiediConferma(titolo, testo, siParola) {
    var finestra = trova("conferma");
    if (!finestra || typeof finestra.showModal !== "function") {
      return Promise.resolve(window.confirm(titolo + "\n\n" + testo));
    }
    trova("conferma-titolo").textContent = titolo;
    trova("conferma-testo").textContent = testo;
    trova("conferma-si").textContent = siParola;
    return new Promise(function (risolvi) {
      var chiusa = function () {
        finestra.removeEventListener("close", chiusa);
        risolvi(finestra.returnValue === "si");
      };
      finestra.returnValue = "";
      finestra.addEventListener("close", chiusa);
      finestra.showModal();
      trova("conferma-no").focus();
    });
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
    if (!mancano) return due("Scaduto", "Expired");
    var minuti = Math.floor(mancano / 60);
    var secondi = mancano % 60;
    var quanto = minuti + ":" + (secondi < 10 ? "0" : "") + secondi;
    return due("Vale ancora " + quanto, "Good for another " + quanto);
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

  /* Cos'e', per un telefono che l'ha detto: «Samsung · Android 15 · app
   * 1.15.0». Chi non l'ha detto — un'app di prima, il browser — resta com'era
   * («app su Android»). */
  function comEFattoAPieno(uno) {
    var marca = String((uno && uno.marca) || "").trim();
    var versione = String((uno && uno.versione) || "").trim();
    var app = String((uno && uno.app) || "").trim();
    var quale = String((uno && uno.sistema) || "").toLowerCase();
    var pezzi = [];
    if (marca || versione) {
      if (marca) pezzi.push(marca);
      var sistema = quale === "ios" ? "iOS" : quale === "android" ? "Android" : "";
      if (sistema) pezzi.push(versione ? sistema + " " + versione : sistema);
    } else {
      pezzi.push(comEFatto(uno && uno.sistema));
    }
    if (app) pezzi.push("app " + app);
    return pezzi.join(" · ");
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
    disegnaLeTappe();
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
    disegnaLeTappe();
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
          "Home Assistant risponde, e GdAHome è in piedi.",
          "Home Assistant answers, and GdAHome is up.",
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
        "GdAHome lo raggiunge e lo comanda.",
        "GdAHome reaches it and drives it.",
      );
      scriviIlRimedio("rimedio-casa", "", "");
      return;
    }
    trova("riga-casa").textContent = due(
      "GdAHome adesso non riesce a parlargli.",
      "GdAHome can't talk to it right now.",
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
  /* Perche' da fuori non si entra quando non e' un guasto: «opzioni» se e'
   * spento nell'add-on, «premium» se la casa ha Base. Lo legge la frase in
   * cima alla Casa. */
  var fuoriSpento = "";

  function disegnaIlFuori(centralino) {
    var come;
    var corto;
    var riga;
    var perche = "";
    var cosaFare = "";
    fuoriSpento = "";
    var soloInCasa = due(
      "Adesso l'app entra solo quando sei sulla rete di casa.",
      "Right now the app gets in only on your home network.",
    );
    if (!centralino || !centralino.configurato) {
      come = "spento";
      fuoriSpento = "opzioni";
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
      fuoriSpento = "premium";
      corto = due("solo con Premium", "Premium only");
      /* Corta: che da fuori serve Premium lo dicono gia' la parola colorata
       * e la frase in cima alla Casa. */
      riga = due(
        "Sulla rete di casa l'app entra sempre.",
        "On your home network the app always gets in.",
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
      trova("voce-plancia").hidden = true;
      trova("plancia-riga").hidden = true;
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
    /* Nella Casa la riga c'e' solo quando non va; accanto alla versione, nelle
     * Avanzate, c'e' sempre. */
    trova("voce-plancia").hidden = acceso;
    trova("plancia-riga").textContent = spiega.textContent;
    trova("plancia-riga").hidden = !spiega.textContent;
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

  /* La versione, nella targhetta accanto al nome. Il resto — da dove
   * arrivano gli aggiornamenti — sta nelle Avanzate. */
  function disegnaLaVersione(versione) {
    if (!versione) return;
    trova("targhetta").textContent = versione;
    trova("targhetta").hidden = false;
  }

  /* ─── «Serve riavviare Home Assistant», nella Panoramica ──────────────────
   *
   * Quando la cartella «www» non c'era all'avvio di Home Assistant, la plancia
   * nelle «Plance» non si apre finche' Home Assistant non riparte. Lo dicono
   * la Plancia stessa e la campanella; qui lo si dice in cima alla
   * Panoramica, con le stesse parole — `IL_RIAVVIO` in
   * `src/plance-in-casa.js`, che una prova tiene uguale a queste.
   *
   * Si guarda quello che ha detto il ponte (`manca === "riavvio"`, cioe' Home
   * Assistant ha risposto «non c'e'») e la prova fatta da questa pagina
   * (`paginaChe === "no"`). Un «non lo so» non accende niente: dire di
   * riavviare per un dubbio vorrebbe dire far riavviare per niente. */
  function laRigaDelRiavvio(esito, prova) {
    var serve = Boolean(esito && esito.manca === "riavvio") || prova === "no";
    return {
      serve: serve,
      titolo: due("Serve riavviare Home Assistant una volta", "Home Assistant needs one restart"),
      passi: due(
        "Impostazioni \u2192 Sistema \u2192 Riavvia (in alto a destra \u23fb) \u2192 Riavvia Home Assistant",
        "Settings \u2192 System \u2192 Restart (top right \u23fb) \u2192 Restart Home Assistant",
      ),
      perche: due(
        "La cartella «www» non c'era quando Home Assistant è partito: l'ha creata GdAHome. Dopo il riavvio la plancia compare da sola nelle «Plance», entro un minuto, su tutti i dispositivi.",
        "The “www” folder wasn't there when Home Assistant started: GdAHome created it. After the restart the dashboard shows up by itself in “Dashboards”, within a minute, on every device.",
      ),
      corto: due("da fare", "to do"),
    };
  }

  function disegnaIlRiavvio(esito) {
    var voce = trova("voce-riavvio");
    if (!voce) return;
    var riga = laRigaDelRiavvio(esito, paginaChe);
    voce.hidden = !riga.serve;
    trova("titolo-riavvio").textContent = riga.titolo;
    trova("passi-riavvio").textContent = riga.passi;
    if (riga.serve) pastiglia("pas-riavvio", "male", riga.corto);
    else trova("pas-riavvio").hidden = true;
    scriviIlRimedio("rimedio-riavvio", "", riga.serve ? riga.perche : "");
    contaIGuai();
  }

  /* Il numerino rosso-giallo sulla linguetta della Panoramica: quante righe
   * non vanno. Si guarda da qualunque sezione, e dice di tornare li'. */
  function contaIGuai() {
    var quanti = 0;
    ["pas-casa", "pas-fuori", "pas-plancia", "pas-riavvio"].forEach(function (id) {
      var una = trova(id);
      if (una && !una.hidden && una.dataset.come === "male") quanti += 1;
    });
    scriviIlNumerino("quanti-panoramica", quanti);
    disegnaLEroe();
  }

  /* ─── La frase in cima alla Casa ──────────────────────────────────────────
   *
   * «Tutto a posto», o cosa non va — in parole di chi ci abita — e, quando
   * c'e', il tasto che lo aggiusta. Si legge dalle righe qui sotto, che sono
   * gia' disegnate: la frase e le righe non possono dire due cose diverse. */
  function disegnaLEroe() {
    var eroe = trova("eroe");
    if (!eroe) return;
    var casa = trova("pas-casa").dataset.come;
    var fuori = trova("pas-fuori").dataset.come;
    var plancia = trova("pas-plancia");
    var riavvio = !trova("voce-riavvio").hidden;
    var guai = [];
    if (casa === "male")
      guai.push(
        due(
          "GdAHome adesso non riesce a parlare con Home Assistant.",
          "GdAHome can't talk to Home Assistant right now.",
        ),
      );
    if (riavvio)
      guai.push(
        due(
          "Home Assistant va riavviato una volta: poi la plancia compare da sola.",
          "Home Assistant needs one restart: then the dashboard shows up by itself.",
        ),
      );
    if (fuori === "male")
      guai.push(
        due(
          "Da fuori casa l'app adesso non entra: la casa riprova da sola.",
          "Right now the app can't get in from away: the home keeps retrying by itself.",
        ),
      );
    if (!plancia.hidden && plancia.dataset.come === "male")
      guai.push(
        due("La plancia non è quella pubblicata.", "The dashboard isn't the published one."),
      );
    var come;
    var titolo;
    var riga;
    if (guai.length) {
      come = "male";
      titolo =
        guai.length === 1
          ? due("C'è una cosa da sistemare", "One thing needs fixing")
          : due(
              "Ci sono " + guai.length + " cose da sistemare",
              guai.length + " things need fixing",
            );
      riga = guai.join(" ");
    } else if (casa === "attesa") {
      come = "attesa";
      titolo = due("Sto guardando come sta la casa…", "Checking how your home is doing…");
      riga = "";
    } else {
      come = "bene";
      titolo = due("Tutto a posto", "All good");
      if (fuori === "bene")
        riga = due(
          "La casa risponde, ed è raggiungibile anche da fuori.",
          "Your home answers, and you can reach it from away too.",
        );
      else if (fuori === "attesa")
        riga = due(
          "La casa risponde. Si sta collegando per entrare anche da fuori…",
          "Your home answers. It is connecting so you can get in from away too…",
        );
      else if (fuoriSpento === "premium")
        riga = due(
          "La casa risponde dal Wi-Fi di casa. Da fuori si entra con Premium.",
          "Your home answers on its own Wi-Fi. From away you get in with Premium.",
        );
      else
        riga = due(
          "La casa risponde dal Wi-Fi di casa. L'accesso da fuori è spento nelle opzioni.",
          "Your home answers on its own Wi-Fi. Access from away is off in the options.",
        );
    }
    eroe.dataset.come = come;
    trova("eroe-titolo").textContent = titolo;
    trova("eroe-riga").textContent = riga;
    trova("eroe-riga").hidden = !riga;
    trova("eroe-disegno").setAttribute(
      "href",
      come === "bene" ? "#ic-spunta" : come === "male" ? "#ic-attenzione" : "#ic-casa",
    );
    /* Il tasto c'e' quando c'e' qualcosa che si aggiusta da qui: il riavvio,
     * che si fa dalle Impostazioni di Home Assistant. Il resto passa da solo,
     * e un tasto che non fa niente sarebbe una promessa falsa. */
    trova("eroe-azione").hidden = !riavvio;
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
      ? due("Nessuno, per ora", "None yet")
      : due(
          (quanti === 1 ? "1 abbinato" : quanti + " abbinati") +
            " · " +
            (collegati === 1 ? "1 collegato" : collegati + " collegati"),
          quanti + " paired · " + collegati + " connected",
        );
    disegnaLAnteprima(
      "anteprima-telefoni",
      dispositivi.map(function (uno) {
        return comeSiChiama(uno);
      }),
    );
    trova("telefoni-spiega").textContent = due(
      "I telefoni e i tablet che entrano in questa casa. Puoi abbinarne fino a " + massimi + ".",
      "The phones and tablets that get into this home. You can pair up to " + massimi + ".",
    );
    /* «3 di 10»: era «1 di 10 telefono», con la parola che si accordava col
     * numero sbagliato. Il numero da solo si legge meglio, e non sbaglia.
     * Nei dieci stanno i telefoni di casa: quelli di prova non li contano. */
    var diCasa = dispositivi.filter(function (uno) {
      return !uno.finoA;
    }).length;
    /* «2 di 10» e quattro righe sotto: le due di prova non contano, e lo si
     * dice, invece di lasciarlo indovinare. */
    var diProva = dispositivi.length - diCasa;
    trova("conteggio").textContent = due(
      diCasa + " di " + massimi + (diProva ? " · più " + diProva + " di prova" : ""),
      diCasa + " of " + massimi + (diProva ? " · plus " + diProva + " trial" : ""),
    );

    /* Mentre un nome si sta scrivendo, l'elenco resta com'e'. */
    if (inModifica.indexOf("telefono:") === 0) return;

    var elenco = trova("elenco");
    elenco.textContent = "";

    /* Con l'elenco vuoto il tasto sta al centro, dove si guarda: due tasti
     * uguali nella stessa schermata farebbero chiedere quale premere. */
    trova("aggiungi-dall-elenco").hidden = !quanti;
    if (!quanti) {
      elenco.appendChild(
        unVuoto(
          "ic-telefono",
          due("Nessun telefono, per ora", "No phones yet"),
          due(
            "Abbina il primo con un QR code: ci vuole un minuto.",
            "Pair the first one with a QR code: it takes a minute.",
          ),
          due("Aggiungi un telefono", "Add a phone"),
          "abbina",
        ),
      );
      return;
    }

    dispositivi.forEach(function (uno) {
      var riga = vediPagina.createElement("li");

      /* La faccia della riga: un riquadro tondo col disegno di un telefono,
       * verde quando quel telefono e' collegato adesso. */
      var sistema = String(uno.sistema || "").toLowerCase();
      riga.appendChild(
        unaFaccia(
          sistema === "ios"
            ? "ic-mela"
            : sistema === "android"
              ? "ic-robot"
              : sistema === "web"
                ? "ic-browser"
                : "ic-telefono",
          uno.collegati ? "bene" : "spenta",
        ),
      );

      var nome = vediPagina.createElement("div");
      nome.className = "nome";
      var rigaDelNome = vediPagina.createElement("div");
      rigaDelNome.className = "riga-del-nome";
      var forte = vediPagina.createElement("strong");
      /* `textContent`, mai `innerHTML`: il nome lo scrive chi si abbina, e
       * arriva dalla porta esposta. */
      forte.textContent = comeSiChiama(uno);
      rigaDelNome.appendChild(forte);
      /* Di chi e' questo telefono. Va detto: un telefono senza padrone vede
       * **tutte** le plance, comprese quelle riservate a qualcuno, ed e'
       * esattamente quello di cui bisogna accorgersi guardando l'elenco —
       * per questo quell'etichetta e' gialla. Chi ha scritto di chi e' il
       * telefono («Di chi e' questo telefono?» nell'app) ce l'ha gia' nel
       * nome. */
      var diChi = uno.proprietario && uno.utente ? "" : nomeDellUtente(uno.utente);
      /* «Tablet ingresso · di Tablet ingresso»: se il nome dice gia' di chi
       * e', l'etichetta sarebbe un'eco. */
      var suoNome = ilNomeDellUtente(uno.utente);
      if (suoNome && comeSiChiama(uno).toLowerCase().indexOf(suoNome.toLowerCase()) >= 0)
        diChi = "";
      if (diChi) {
        var suo = vediPagina.createElement("span");
        suo.className = "chip" + (uno.utente ? "" : " giallo");
        suo.textContent = diChi;
        rigaDelNome.appendChild(suo);
      }
      /* Un telefono entrato con la casa di prova lo dice accanto al nome, con
       * la sua scadenza: e' l'ora in cui uscira' da solo. */
      if (uno.finoA) {
        var aTempo = vediPagina.createElement("span");
        aTempo.className = "etichetta-prova";
        aTempo.textContent = due(
          "di prova · fino al " + unGiornoCorto(uno.finoA),
          "test · until " + unGiornoCorto(uno.finoA),
        );
        rigaDelNome.appendChild(aTempo);
      }
      nome.appendChild(rigaDelNome);
      /* Quando si e' visto, come lo direbbe una persona: «adesso», «2 ore
       * fa», «ieri». Il verde vuol dire collegato in questo momento. */
      var sotto = vediPagina.createElement("span");
      var quando = vediPagina.createElement("b");
      quando.className = uno.collegati ? "vivo" : "";
      quando.textContent = uno.collegati
        ? due("Collegato adesso", "Connected now")
        : due("Visto ", "Seen ") + quantoTempoFa(uno.vistoIl);
      sotto.appendChild(quando);
      sotto.appendChild(vediPagina.createTextNode(" · " + comEFattoAPieno(uno)));
      nome.appendChild(sotto);
      riga.appendChild(nome);

      /* «⋯»: Rinomina e Togli in un menu. Sono cose di una volta ogni tanto,
       * e due tasti per ogni riga facevano dell'elenco un muro di tasti. Il
       * menu resta aperto mentre la pagina si ridisegna (`menuAperto`). */
      var tasti = vediPagina.createElement("div");
      tasti.className = "tasti stretti";
      var aperto = menuAperto === uno.id;
      var treSegni = unTasto("", "tenue tre-punti");
      treSegni.appendChild(unDisegno("ic-altro"));
      treSegni.setAttribute("aria-label", due("Altro", "More"));
      treSegni.setAttribute("aria-haspopup", "menu");
      treSegni.setAttribute("aria-expanded", aperto ? "true" : "false");
      treSegni.addEventListener("click", function () {
        menuAperto = menuAperto === uno.id ? "" : uno.id;
        if (lUltimoStato) disegnaIDispositivi(lUltimoStato.dispositivi, lUltimoStato.massimi);
      });
      tasti.appendChild(treSegni);
      var menu = vediPagina.createElement("div");
      menu.className = "menu";
      menu.setAttribute("role", "menu");
      menu.hidden = !aperto;
      tasti.appendChild(menu);

      var rinomina = unTasto(due("Rinomina", "Rename"), "voce-menu");
      rinomina.setAttribute("role", "menuitem");
      rinomina.addEventListener("click", function () {
        menuAperto = "";
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
      menu.appendChild(rinomina);

      var stacca = unTasto(
        due("Togli da questa casa", "Remove from this home"),
        "voce-menu toglie",
      );
      stacca.setAttribute("role", "menuitem");
      stacca.addEventListener("click", function () {
        menuAperto = "";
        menu.hidden = true;
        chiediConferma(
          due("Togliere «" + comeSiChiama(uno) + "»?", "Remove “" + comeSiChiama(uno) + "”?"),
          due(
            "Esce subito da questa casa. Per rientrare dovrà abbinarsi di nuovo, con un QR code nuovo.",
            "It leaves this home right away. To get back in it will have to pair again, with a new QR code.",
          ),
          due("Togli", "Remove"),
        ).then(function (si) {
          if (!si) return;
          stacca.disabled = true;
          avvisaITelefoni("");
          chiedi("api/dispositivi/" + encodeURIComponent(uno.id), { method: "DELETE" })
            .then(aggiornaTutto)
            .catch(function (errore) {
              stacca.disabled = false;
              avvisaITelefoni(errore.message);
            });
        });
      });
      menu.appendChild(stacca);
      riga.appendChild(tasti);

      elenco.appendChild(riga);
    });
  }

  /* I primi nomi in piccolo, sulla mattonella della Casa: tre al massimo, e
   * «+2» per gli altri. Si capisce cosa c'e' dentro senza aprirla. */
  function disegnaLAnteprima(id, nomi) {
    var dove = trova(id);
    if (!dove) return;
    dove.textContent = "";
    nomi.slice(0, 3).forEach(function (nome) {
      var uno = vediPagina.createElement("span");
      uno.className = "chip";
      /* `textContent`: i nomi li ha scritti una persona. */
      uno.textContent = nome;
      dove.appendChild(uno);
    });
    if (nomi.length > 3) {
      var altri = vediPagina.createElement("span");
      altri.className = "chip";
      altri.textContent = "+" + (nomi.length - 3);
      dove.appendChild(altri);
    }
    dove.hidden = !nomi.length;
  }

  /* Il menu «⋯» aperto, se ce n'e' uno: l'id del telefono. Un tocco fuori
   * lo chiude, come Escape. */
  var menuAperto = "";

  function chiudiIlMenu() {
    if (!menuAperto) return;
    menuAperto = "";
    if (lUltimoStato) disegnaIDispositivi(lUltimoStato.dispositivi, lUltimoStato.massimi);
  }

  vediPagina.addEventListener("click", function (evento) {
    var dove = evento.target;
    if (dove && dove.closest && dove.closest(".tre-punti, .menu")) return;
    chiudiIlMenu();
  });
  vediPagina.addEventListener("keydown", function (evento) {
    if (evento.key === "Escape") chiudiIlMenu();
  });

  /* Un disegno del foglio dei simboli, da mettere in un tasto. */
  function unDisegno(quale) {
    var disegno = vediPagina.createElementNS("http://www.w3.org/2000/svg", "svg");
    disegno.setAttribute("class", "ic");
    disegno.setAttribute("aria-hidden", "true");
    var uso = vediPagina.createElementNS("http://www.w3.org/2000/svg", "use");
    uso.setAttribute("href", "#" + quale);
    disegno.appendChild(uso);
    return disegno;
  }

  /* «adesso», «5 min fa», «2 ore fa», «ieri», «3 giorni fa», poi la data. */
  function quantoTempoFa(quando) {
    if (!quando) return due("mai", "never");
    var minuti = Math.round((Date.now() - quando) / 60000);
    if (minuti < 1) return due("adesso", "just now");
    if (minuti < 60) return due(minuti + " min fa", minuti + " min ago");
    var ore = Math.round(minuti / 60);
    if (ore < 24)
      return ore === 1 ? due("un'ora fa", "an hour ago") : due(ore + " ore fa", ore + " hours ago");
    var giorni = Math.round(ore / 24);
    if (giorni === 1) return due("ieri", "yesterday");
    if (giorni < 7) return due(giorni + " giorni fa", giorni + " days ago");
    return unGiornoCorto(quando);
  }

  /* Un elenco vuoto: non una riga grigia, ma cosa fare — il disegno, due
   * parole, e il tasto che porta dove si comincia. */
  function unVuoto(disegno, titolo, testo, tasto, vai) {
    var vuoto = vediPagina.createElement("li");
    vuoto.className = "vuoto";
    vuoto.appendChild(unaFaccia(disegno, ""));
    var forte = vediPagina.createElement("strong");
    forte.textContent = titolo;
    vuoto.appendChild(forte);
    var riga = vediPagina.createElement("p");
    riga.textContent = testo;
    vuoto.appendChild(riga);
    if (tasto) {
      var vaiLi = unTasto(tasto, "");
      vaiLi.setAttribute("data-vai", vai);
      vuoto.appendChild(vaiLi);
    }
    return vuoto;
  }

  /* ─── Le plance ─────────────────────────────────────────────────────────────
   *
   * Una riga per plancia: come si chiama, che tipo e', chi la vede, e due
   * tasti — «Apri», e «Gestisci», che apre sotto la riga chi la vede, il nome
   * e, per quelle che non sono la prima, «Togli». Prima erano quattro tasti in
   * fila per ogni riga, e sul telefono l'elenco diventava un muro di tasti.
   *
   * La prima non si toglie, e il tasto non c'e': un tasto che c'e' e che
   * risponde «questa no» e' peggio di un tasto che non c'e'. */
  var nuovaAperta = false;

  function disegnaLePlance(plance) {
    var elenco = trova("elenco-plance");
    if (!elenco) return;
    var quante = plance ? plance.length : 0;
    var siPuo = quante < PLANCE_AL_MASSIMO && !soloBase;
    trova("apri-nuova-plancia").disabled = !siPuo;
    trova("aggiungi-plancia").disabled = !siPuo;
    if (!siPuo) nuovaAperta = false;
    /* Modello e utenti servono solo a chi ne sta aggiungendo una. */
    trova("scheda-nuova-plancia").hidden = !nuovaAperta;
    if (nuovaAperta) riempiGliUtentiDellaNuova();
    scriviIlNumerino("quanti-plance", quante);
    trova("plance-conta").textContent = due(
      quante + " di " + PLANCE_AL_MASSIMO,
      quante + " of " + PLANCE_AL_MASSIMO,
    );
    trova("riepilogo-plance").textContent = !quante
      ? due("Nessuna plancia", "No dashboard")
      : quante === 1
        ? due("1 plancia", "1 dashboard")
        : due(quante + " plance", quante + " dashboards");
    disegnaLAnteprima(
      "anteprima-plance",
      (plance || []).map(function (una) {
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
      var rigaDelTitolo = vediPagina.createElement("div");
      rigaDelTitolo.className = "riga-del-nome";
      var forte = vediPagina.createElement("strong");
      /* `textContent`, mai `innerHTML`: il titolo l'ha scritto una persona. */
      forte.textContent = una.titolo;
      rigaDelTitolo.appendChild(forte);
      /* Una plancia a muro lo dice accanto al nome: chi la apre sul telefono
       * e trova un pannello invece della plancia deve poterlo leggere qui. */
      if (una.a_muro || una.a_occhio || una.a_casa3d) {
        var aMuro = vediPagina.createElement("span");
        aMuro.className = "etichetta-muro";
        aMuro.textContent = una.a_muro
          ? due("📟 a muro", "📟 on the wall")
          : una.a_casa3d
            ? due("🧊 casa 3D", "🧊 3D home")
            : due("👁️ colpo d'occhio", "👁️ at a glance");
        rigaDelTitolo.appendChild(aMuro);
      }
      nome.appendChild(rigaDelTitolo);
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
          ? due("La principale", "The main one")
          : due("Aggiunta da te", "Added by you")) +
        " · " +
        chi.join(" · ");
      nome.appendChild(sotto);
      riga.appendChild(nome);

      var tasti = vediPagina.createElement("div");
      tasti.className = "tasti";

      /* «Apri»: la voce della plancia fra le «Plance» di Home Assistant
       * (`gdahome-<profilo>`, la scrive `src/plance-in-casa.js`), nella stessa
       * finestra. Una scheda nuova, nell'app di Home Assistant sul telefono,
       * si apre nel browser senza la sessione dell'ingress, e Home Assistant
       * rispondeva «401: Unauthorized»; la voce della barra laterale invece la
       * sessione la chiede da se' (`carta/accompagna.js`). */
      var apri = vediPagina.createElement("a");
      apri.className = "tenue";
      apri.textContent = due("Apri", "Open");
      apri.target = "_top";
      apri.href = "/gdahome-" + encodeURIComponent(una.profilo);
      tasti.appendChild(apri);

      /* «Gestisci»: il pannello sotto la riga. Uno per volta — aprirne un
       * altro chiude quello di prima — e resta aperto mentre la pagina si
       * ridisegna da sola ogni dieci secondi (`cassettoAperto`). */
      var aperto = cassettoAperto === una.profilo;
      var gestisci = unTasto(aperto ? due("Chiudi", "Close") : due("Gestisci", "Manage"), "tenue");
      gestisci.setAttribute("aria-expanded", aperto ? "true" : "false");
      gestisci.addEventListener("click", function () {
        cassettoAperto = cassettoAperto === una.profilo ? "" : una.profilo;
        disegnaLePlance(plance);
      });
      tasti.appendChild(gestisci);
      riga.appendChild(tasti);

      if (aperto) {
        var pannello = vediPagina.createElement("div");
        pannello.className = "pannello";

        /* «Chi la vede»: le spunte, nel pannello. Sotto la riga e non in una
         * finestra: le spunte sono poche — quanti utenti ha una casa. */
        var spunte = vediPagina.createElement("div");
        spunte.className = "chi-la-vede";
        pannello.appendChild(spunte);
        riempiLeSpunte(spunte, una);

        var suoiTasti = vediPagina.createElement("div");
        suoiTasti.className = "bottoni";
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
        suoiTasti.appendChild(rinomina);

        if (!una.primaria) {
          var togli = unTasto(due("Togli la plancia", "Remove the dashboard"), "toglie");
          togli.addEventListener("click", function () {
            chiediConferma(
              due("Togliere «" + una.titolo + "»?", "Remove “" + una.titolo + "”?"),
              due(
                "Va via anche come l'hai preparata: sezioni, tessere, stanze. Non si rimette a posto.",
                "The way you set it up goes too: sections, cards, rooms. There is no putting it back.",
              ),
              due("Togli", "Remove"),
            ).then(function (si) {
              if (!si) return;
              togli.disabled = true;
              avvisaLePlance("");
              chiedi("api/plance", {
                method: "DELETE",
                body: JSON.stringify({ profilo: una.profilo }),
              })
                .then(function () {
                  cassettoAperto = "";
                  return aggiornaTutto();
                })
                .catch(function (errore) {
                  togli.disabled = false;
                  avvisaLePlance(errore.message);
                });
            });
          });
          suoiTasti.appendChild(togli);
        }
        pannello.appendChild(suoiTasti);
        riga.appendChild(pannello);
      }

      elenco.appendChild(riga);
    });
  }

  /* La scheda della plancia nuova si apre col tasto in cima alla sezione, e
   * si richiude con «Annulla» o quando la plancia e' fatta. */
  function apriLaNuova(si) {
    nuovaAperta = si;
    trova("scheda-nuova-plancia").hidden = !si;
    if (!si) return;
    riempiGliUtentiDellaNuova();
    trova("titolo-plancia").focus();
  }

  trova("apri-nuova-plancia").addEventListener("click", function () {
    apriLaNuova(true);
  });
  trova("chiudi-nuova-plancia").addEventListener("click", function () {
    apriLaNuova(false);
  });

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
        "Con GdAHome Base la plancia è una, la principale. Con Premium, fino a otto.",
        "With GdAHome Base there is one dashboard, the main one. With Premium, up to eight.",
      );
      nota.hidden = false;
      return;
    }
    if (premium === false) {
      nota.textContent = due(
        "Con GdAHome Base, nell'app e nel browser si apre solo la principale: le altre sono comprese in Premium. In Home Assistant, fra le Dashboard, ci sono tutte.",
        "With GdAHome Base, the app and the browser open only the main one: the others come with Premium. In Home Assistant, among the Dashboards, they are all there.",
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

  /* Il nome nudo di un utente, senza «di»: `""` se non si sa. */
  function ilNomeDellUtente(chi) {
    var cercato = String(chi || "").trim();
    var nome = "";
    (gliUtenti || []).forEach(function (uno) {
      if (uno.id === cercato) nome = String(uno.nome || "");
    });
    return nome;
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
        var capo = vediPagina.createElement("p");
        capo.className = "etichetta";
        capo.textContent = due("Chi la vede", "Who sees it");
        dove.appendChild(capo);
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

  /* Chi usa ancora le tessere di gdahome, in parole: la risorsa di Lovelace
   * c'e' per loro, e senza di loro non c'e'. */
  function chiUsaLeTessere(esito) {
    var dove = Array.isArray(esito.tessere_in) ? esito.tessere_in : [];
    return dove.join(", ");
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
    /* La cosa che fa vedere un «404» al posto della plancia, e che da quella
     * pagina non si capisce: qui si dice. La prova e' fatta da questa pagina
     * (`laPaginaSiApre`), che sta sullo stesso indirizzo di Home Assistant. */
    if (paginaChe === "no") {
      riga += due(
        " ⚠️ Home Assistant non serve ancora la pagina che apre la plancia.",
        " ⚠️ Home Assistant isn't serving the page that opens the dashboard yet.",
      );
    } else if (paginaChe === "rotta") {
      riga += due(
        " ⚠️ Home Assistant risponde, ma non con la pagina che apre la plancia.",
        " ⚠️ Home Assistant answers, but not with the page that opens the dashboard.",
      );
    } else if (paginaChe === "si") {
      riga += due(
        " La pagina che apre la plancia si scarica.",
        " The page that opens the dashboard downloads.",
      );
    } else if (esito.riavvia) {
      riga += due(
        " ⚠️ Riavvia Home Assistant una volta (Impostazioni → Sistema → Riavvia):" +
          " la cartella «www» non c'era e l'ho fatta io, e Home Assistant i file che" +
          " stanno dentro li serve solo se quella cartella c'era quando è partito." +
          " Dopo il riavvio la plancia compare da sola, entro un minuto.",
        " ⚠️ Restart Home Assistant once (Settings → System → Restart):" +
          " the “www” folder wasn't there and I made it, and Home Assistant" +
          " serves the files inside it only if that folder existed when it started." +
          " After the restart the dashboard shows up by itself within a minute.",
      );
    }
    /* La risorsa di Lovelace: alla plancia non serve piu', e resta solo per
     * chi le tessere di gdahome le usa ancora. Si dice per chi. */
    if (esito.tessere === true) {
      riga += due(
        " La risorsa di Lovelace resta per chi usa le tessere di GdAHome (" +
          chiUsaLeTessere(esito) +
          ")" +
          (esito.risorsa_in_elenco === false ? ", ma ⚠️ Lovelace non ce l'ha in elenco." : "."),
        " The Lovelace resource stays for whoever uses GdAHome's cards (" +
          chiUsaLeTessere(esito) +
          ")" +
          (esito.risorsa_in_elenco === false ? ", but ⚠️ Lovelace doesn't list it." : "."),
      );
    } else if (esito.risorsa === "tolta") {
      riga += due(
        " La risorsa di Lovelace di prima l'ho tolta: alla plancia non serve più.",
        " I removed the old Lovelace resource: the dashboard doesn't need it anymore.",
      );
    }
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
            ", dell'integrazione DashboardModern e non di GdAHome." +
            " Se l'integrazione non c'è più, quella voce apre con «Errore di configurazione»" +
            " e non si aggiusta riavviando: si leva da Impostazioni → Dashboard." +
            " Questo add-on non la tocca.",
          " ⚠️ Your sidebar still has " +
            nomi +
            ", from the DashboardModern integration and not from GdAHome." +
            " If the integration is gone, that entry opens with a configuration error" +
            " and restarting won't fix it: remove it from Settings → Dashboards." +
            " This add-on doesn't touch it.",
        ) + " ";
    }

    /* E cosa ci trova, adesso, chi apre quella voce. L'unico foglietto che il
     * ponte ci puo' scrivere al posto della plancia e' quello del riavvio: è
     * la cosa da sapere per prima, perché è quella che stanno guardando gli
     * altri. Di ricaricare la pagina non si chiede piu' a nessuno: la
     * Plancia ha dentro solo tessere di Home Assistant. */
    if (esito.tessera_nella_vista === "markdown")
      riga += due(
        " Chi la apre adesso legge il foglietto che dice di riavviare, non la plancia:" +
          " ci torna da sé appena Home Assistant serve la pagina.",
        " Whoever opens it now reads the note telling them to restart, not the dashboard:" +
          " it goes back by itself as soon as Home Assistant serves the page.",
      );
    return riga;
  }

  /* La pagina che apre la plancia si scarica? Lo si chiede a Home Assistant.
   *
   * Questa pagina sta dentro l'ingress, cioe' **sullo stesso indirizzo** di
   * Home Assistant: un indirizzo che comincia per `/local/` da qui arriva a
   * lui, non a noi. E' l'unico posto da cui si possa provare quello che poi
   * prova la tessera «pagina web» della Plancia.
   *
   * `""` vuol dire «non si e' ancora provato», e si dice diversamente da «no»:
   * un avviso grosso mostrato mentre ancora non si sa sarebbe un avviso
   * sbagliato meta' delle volte. */
  var paginaChe = "";

  /* Il segno che la pagina porta in testa: una risposta «200» da sola non
   * basta, deve essere lei. Lo stesso di `SEGNO_DELL_APERTURA` nel ponte. */
  var IL_SEGNO = 'name="gdahome" content="apri"';

  function laPaginaSiApre(dove) {
    if (!dove || paginaChe === "si") return Promise.resolve(paginaChe);
    return fetch(dove, { cache: "no-store" })
      .then(function (risposta) {
        if (!risposta.ok) {
          paginaChe = risposta.status === 404 ? "no" : "";
          return paginaChe;
        }
        return risposta.text().then(function (testo) {
          paginaChe = String(testo).indexOf(IL_SEGNO) >= 0 ? "si" : "rotta";
          return paginaChe;
        });
      })
      .catch(function () {
        /* Senza rete non si sa, e non si dice niente: la riga resta quella. */
        paginaChe = "";
        return paginaChe;
      });
  }

  /* Il foglietto sotto la riga: si vede solo quando c'e' qualcosa da fare, e
   * dice **cosa** fare — non com'e' fatto il mondo. */
  function avvisaSullaPagina(esito) {
    var dove = trova("avviso-cartina");
    if (!dove) return;
    var testo = "";
    if (paginaChe === "no") {
      testo = due(
        "Home Assistant non serve ancora la pagina che apre la plancia, e finché non la " +
          "serve nella Plancia c'è il foglietto che dice di riavviarlo. Riavvialo una volta " +
          "(Impostazioni → Sistema → Riavvia): la cartella «www» la apre quando parte, e i " +
          "file arrivati dopo li serve solo dal riavvio dopo. Poi la plancia compare da sola, " +
          "su tutti i dispositivi.",
        "Home Assistant isn't serving the page that opens the dashboard yet, and until it " +
          "does the dashboard shows a note asking to restart it. Restart it once (Settings → " +
          "System → Restart): it opens the “www” folder when it starts, and files " +
          "that arrive later it serves only from the next restart on. Then the dashboard " +
          "shows up by itself, on every device.",
      );
    } else if (paginaChe === "rotta") {
      testo = due(
        "Home Assistant risponde all'indirizzo della pagina che apre la plancia, ma non con " +
          "quella pagina. Riavvia l'add-on, che la riscrive da sé a ogni avvio; se succede " +
          "ancora, scrivilo dalle segnalazioni.",
        "Home Assistant answers at the address of the page that opens the dashboard, but " +
          "not with that page. Restart the add-on, which rewrites it by itself at every " +
          "start; if it happens again, say so from the reports.",
      );
    } else if (esito && esito.tessere === true && esito.risorsa_guaio) {
      /* Solo per chi le tessere le usa: alla plancia la risorsa non serve. */
      testo =
        due(
          "Le tessere di GdAHome (" +
            chiUsaLeTessere(esito) +
            ") vogliono la loro risorsa di Lovelace, e Lovelace non la vuole dichiarare. " +
            "Quasi sempre vuol dire che questa casa tiene le dashboard in YAML: lì va " +
            "dichiarata a mano in configuration.yaml — lovelace: resources: - url: " +
            "/local/gdahome/caricatore.js?giro=1  type: module. La plancia non ne ha " +
            "bisogno, e si apre comunque. Lovelace ha risposto: ",
          "GdAHome's cards (" +
            chiUsaLeTessere(esito) +
            ") need their Lovelace resource, and Lovelace won't declare it. Nearly always " +
            "this means this home keeps its dashboards in YAML: there it has to be declared " +
            "by hand in configuration.yaml — lovelace: resources: - url: " +
            "/local/gdahome/caricatore.js?giro=1  type: module. The dashboard doesn't need " +
            "it, and opens anyway. Lovelace answered: ",
        ) + esito.risorsa_guaio;
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
          "Con GdAHome Base, da questo indirizzo la casa non si apre: serve Premium. Con l'app sul telefono, sulla rete di casa, si entra sempre.",
          "With GdAHome Base, this address doesn't open the home: it needs Premium. With the app on the phone, on your home network, you always get in.",
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
        "Quando ce n'è uno nuovo: Impostazioni → Componenti aggiuntivi → GdAHome → Aggiorna.",
        "When there is a new one: Settings → Add-ons → GdAHome → Update.",
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
        "GdAHome se la scarica, la mette al posto di questa e si ricostruisce. " +
          "Ci mette qualche minuto, e mentre lo fa questa pagina non risponde: è normale, " +
          "torna da sé.",
        "GdAHome downloads it, puts it in place of this one and rebuilds itself. " +
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
    /* Il tema di Home Assistant si cambia senza ricaricare questa pagina: lo
     * si riguarda a ogni giro, e costa una lettura. */
    ilTemaDiCasa();
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
        disegnaIlRiavvio(stato.plance_in_casa);
        laPaginaSiApre(stato.plance_in_casa && stato.plance_in_casa.apertura).then(function () {
          trova("stato-plance-in-casa").textContent = comeVannoLePlanceInCasa(stato.plance_in_casa);
          avvisaSullaPagina(stato.plance_in_casa);
          disegnaIlRiavvio(stato.plance_in_casa);
        });
        contaIGuai();
        /* Al tetto il tasto si spegne, e si dice perche' accanto: un tasto
         * grigio senza una parola fa pensare a un guasto. I telefoni della
         * casa di prova non contano. */
        var diCasa = stato.dispositivi.filter(function (uno) {
          return !uno.finoA;
        }).length;
        pieno = diCasa >= stato.massimi;
        trova("abbina-pieno").hidden = !pieno;
        trova("abbina-pieno").textContent = due(
          "Hai già " +
            stato.massimi +
            " telefoni abbinati: per aggiungerne uno, prima togline un altro da «I tuoi telefoni».",
          "You already have " +
            stato.massimi +
            " phones paired: to add one, first remove another from “Your phones”.",
        );
        if (!stato.abbinamento.attivo) nascondiIlCodice();
        /* Gli utenti, se all'apertura Home Assistant non li ha dati: senza, la
         * tappa 1 resta vuota e il QR non si puo' generare. */
        if (!gliUtenti) riempiIlPerChi();
        disegnaLeTappe();
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
          "La console non riesce a leggere lo stato di GdAHome.",
          "The console can't read GdAHome's state.",
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

  /* Se si e' arrivati al tetto dei telefoni: lo dice lo stato. */
  var pieno = false;

  function riprendiIlCodice() {
    return chiedi("api/codice")
      .then(function (vivo) {
        if (!vivo.attivo) return;
        /* La tappa 1 torna su chi era: il codice e' suo. */
        if (vivo.utente) trova("per-chi").value = vivo.utente;
        codicePer = trova("per-chi").value;
        spiegaIlPerChi();
        disegnaIlCodice(vivo.codice, vivo.scadeIl);
      })
      .catch(function () {
        /* Se non si riesce a riprenderlo si resta senza: il bottone e' li'. */
      });
  }

  /* Per chi e' il codice a schermo: se la tappa 1 cambia, quel codice non va
   * piu' bene. */
  var codicePer = "";

  /* Le tre tappe, in una funzione che non tocca la pagina: dice a che punto
   * si e', e se il tasto si puo' premere. La pagina la disegna, e la prova
   * `il-qr-chiede-per-chi` la compila e la interroga. */
  function leTappe(scelto, vivo, alTetto) {
    return {
      chi: scelto ? "fatto" : "adesso",
      genera: vivo ? "fatto" : scelto ? "adesso" : "dopo",
      qr: vivo ? "adesso" : "dopo",
      /* Il QR non si genera senza sapere per chi e', ne' oltre il tetto. */
      siPuoGenerare: Boolean(scelto) && !alTetto,
      spiega: alTetto
        ? ""
        : !scelto
          ? due("Prima scegli per chi è.", "First choose who it is for.")
          : vivo
            ? due(
                "Fatto. Se è scaduto, o serve a un altro telefono, generane uno nuovo.",
                "Done. If it has expired, or another phone needs it, generate a new one.",
              )
            : due(
                "Vale una volta sola, per pochi minuti.",
                "It works once only, for a few minutes.",
              ),
    };
  }

  function disegnaLeTappe() {
    var scelto = trova("per-chi").value;
    var vivo = !trova("codice-vivo").hidden;
    var tappe = leTappe(scelto, vivo, pieno);
    trova("tappa-chi").dataset.stato = tappe.chi;
    trova("tappa-genera").dataset.stato = tappe.genera;
    trova("tappa-qr").dataset.stato = tappe.qr;
    trova("fabbrica").disabled = !tappe.siPuoGenerare;
    /* Col QR a schermo il tasto non e' piu' «il» tasto: ne fa un altro. */
    trova("fabbrica").className = vivo ? "tenue" : "";
    trova("fabbrica-parole").textContent = vivo
      ? due("Un QR code nuovo", "A new QR code")
      : due("Genera il QR code", "Generate the QR code");
    if (!cambiato) trova("genera-spiega").textContent = tappe.spiega;
    trova("genera-spiega").hidden = !trova("genera-spiega").textContent;
  }

  /* Le plance che una persona vedra': quelle senza restrizioni, quelle dove
   * c'e' il suo nome, e quelle «solo amministratori» se amministra. Le stesse
   * regole di `plance.js`, dette qui per leggerle prima di inquadrare. */
  function lePlanceDi(utente) {
    var plance = (lUltimoStato && lUltimoStato.plance) || [];
    return plance.filter(function (una) {
      var suoi = Array.isArray(una.utenti) ? una.utenti.filter(Boolean) : [];
      if (suoi.length && suoi.indexOf(utente.id) < 0) return false;
      if (una.solo_admin && !utente.amministratore) return false;
      return true;
    });
  }

  /* Sotto «Per chi è», cosa vedra': il telefono eredita le plance di quella
   * persona, ed e' meglio leggerlo prima di inquadrare. */
  function spiegaIlPerChi() {
    var scelta = trova("per-chi");
    var spiega = trova("per-chi-spiega");
    var utente = null;
    (gliUtenti || []).forEach(function (uno) {
      if (uno.id === scelta.value) utente = uno;
    });
    spiega.hidden = !utente;
    if (!utente) return;
    var sue = lePlanceDi(utente).map(function (una) {
      return una.titolo;
    });
    spiega.textContent = !sue.length
      ? due(
          "Non vedrà nessuna plancia: in «Le plance» scegli cosa può vedere.",
          "It won't see any dashboard: choose what it can see in “Dashboards”.",
        )
      : sue.length === 1
        ? due("Vedrà la plancia «", "It will see the “") + sue[0] + due("».", "” dashboard.")
        : due("Vedrà " + sue.length + " plance: ", "It will see " + sue.length + " dashboards: ") +
          iNomiInFila(sue) +
          ".";
  }

  /* «Per chi e'» il codice: gli utenti attivi della casa, e nessuno scelto
   * di serie — anche dove l'utente e' uno solo. Una scelta gia' fatta e'
   * proprio quella che non si guarda, e un telefono intestato alla persona
   * sbagliata vede le plance sbagliate. */
  function riempiIlPerChi() {
    var scelta = trova("per-chi");
    chiediGliUtenti()
      .then(function (utenti) {
        var prima = scelta.value;
        scelta.textContent = "";
        var nessuno = vediPagina.createElement("option");
        nessuno.value = "";
        nessuno.disabled = true;
        nessuno.textContent = due("Scegli una persona…", "Choose a person…");
        scelta.appendChild(nessuno);
        utenti
          .filter(function (uno) {
            return uno.attivo !== false;
          })
          .forEach(function (uno) {
            var voce = vediPagina.createElement("option");
            voce.value = uno.id;
            /* `textContent`: il nome di un utente l'ha scritto una persona. */
            voce.textContent =
              uno.nome + (uno.amministratore ? due(" · amministratore", " · admin") : "");
            scelta.appendChild(voce);
          });
        scelta.value = prima || "";
        if (scelta.value !== prima) scelta.value = "";
        spiegaIlPerChi();
        disegnaLeTappe();
      })
      .catch(function () {
        /* Senza l'elenco non si puo' scegliere, e il QR resta spento: lo si
         * dice, e si riprova al giro dopo. */
        var spiega = trova("per-chi-spiega");
        spiega.hidden = false;
        spiega.textContent = due(
          "Non riesco a chiedere a Home Assistant chi c'è in casa: riprovo fra poco.",
          "I can't ask Home Assistant who lives here: trying again shortly.",
        );
      });
  }

  /* Cambiare persona col QR a schermo lo annulla: quel codice e' intestato a
   * chi era scelto prima. Si dice, e si chiede di generarne un altro. */
  var cambiato = false;
  trova("per-chi").addEventListener("change", function () {
    spiegaIlPerChi();
    var vivo = !trova("codice-vivo").hidden;
    if (vivo && trova("per-chi").value !== codicePer) {
      cambiato = true;
      trova("genera-spiega").textContent = due(
        "Hai cambiato persona: il QR code di prima non vale più. Generane uno nuovo.",
        "You changed the person: the previous QR code no longer works. Generate a new one.",
      );
      chiedi("api/codice", { method: "DELETE" })
        .catch(function () {
          /* Se il ponte non risponde, il codice scade da solo fra pochi minuti. */
        })
        .then(function () {
          /* La frase resta finche' non se ne genera uno nuovo (`cambiato`). */
          nascondiIlCodice();
        });
      return;
    }
    disegnaLeTappe();
  });

  riempiIlPerChi();

  trova("fabbrica").addEventListener("click", function () {
    avvisa("");
    /* Sempre per qualcuno: il ponte un codice senza nessuno lo rifiuta. */
    var voluto = trova("per-chi").value;
    cambiato = false;
    if (!voluto) {
      disegnaLeTappe();
      return;
    }
    trova("fabbrica").disabled = true;
    chiedi("api/codice", {
      method: "POST",
      body: JSON.stringify({ utente: voluto }),
    })
      .then(function (fatto) {
        codicePer = voluto;
        disegnaIlCodice(fatto.codice, fatto.scadeIl);
      })
      .catch(function (errore) {
        avvisa(errore.message);
        disegnaLeTappe();
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
        partenza: laPartenzaScelta(),
        utenti: gliUtentiScelti(),
      }),
    })
      .then(function () {
        casella.value = "";
        /* Si riparte dalla scelta di sempre: a muro, e la vedono tutti. */
        var caselle = trova("nuova-plancia").querySelectorAll("input");
        for (var i = 0; i < caselle.length; i += 1)
          caselle[i].checked =
            caselle[i].type === "radio" &&
            (caselle[i].value === "muro" || caselle[i].value === "principale");
        mostraLaPartenza();
        apriLaNuova(false);
        return aggiornaTutto();
      })
      .catch(function (errore) {
        tasto.disabled = false;
        avvisaLePlance(errore.message);
      });
  }

  /* Da dove parte una plancia a colpo d'occhio: dalla principale o da zero.
   * La domanda si vede solo per lei: le altre partono come sempre. */
  function laPartenzaScelta() {
    var scelta = trova("nuova-plancia").querySelector('input[name="partenza-plancia"]:checked');
    return scelta ? scelta.value : "principale";
  }
  function mostraLaPartenza() {
    var dove = trova("partenza-plancia");
    if (dove) dove.hidden = ilModelloScelto() !== "occhio";
  }
  vediPagina.addEventListener("change", function (evento) {
    if (evento.target && evento.target.name === "modello-plancia") mostraLaPartenza();
  });

  /* Il modello della plancia nuova: a muro, a colpo d'occhio o classica. */
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
    /* Allungarla, lo stesso: e' come farla di nuovo, per piu' tempo. */
    trova("prova-allunga").hidden = !gestore;
    trova("prova-allunga-spiega").hidden = !gestore;
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

  /* «Allunga di 7 giorni»: lo stesso codice, che sta gia' nelle note di chi
   * rivede l'app, vale per altri sette giorni da adesso. Il QR e le lettere
   * non cambiano; cambia la data. */
  trova("prova-allunga").addEventListener("click", function () {
    var tasto = trova("prova-allunga");
    avvisaLaProva("");
    tasto.disabled = true;
    chiedi("api/prova", { method: "PATCH", body: JSON.stringify({ giorni: 7 }) })
      .then(function (allungata) {
        tasto.disabled = false;
        disegnaLaProva(allungata);
        return aggiornaTutto();
      })
      .catch(function (errore) {
        tasto.disabled = false;
        avvisaLaProva(errore.message);
      });
  });

  trova("prova-revoca").addEventListener("click", function () {
    chiediConferma(
      due("Revocare la casa di prova?", "Revoke the test home?"),
      due(
        "Il codice smette di valere e i telefoni entrati con lui escono subito.",
        "The code stops working and the phones that came in with it leave right away.",
      ),
      due("Revoca", "Revoke"),
    ).then(function (si) {
      if (si) revocaLaProva();
    });
  });

  function revocaLaProva() {
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
  }

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

  /* «Smetti».
   *
   * Prima si chiede, con la stessa finestra che chiede prima di togliere un
   * telefono: chi non voleva premerlo se ne va con «Annulla».
   *
   * E smettere vuol dire smettere: si ferma adesso **e** si svuota la casella
   * nella scheda dell'add-on, se no al primo riavvio ricomincerebbe. Dove il
   * Supervisor non lascia scrivere si dice cosa fare a mano, invece di dire
   * che e' andata. */
  trova("quadro-smetti").addEventListener("click", function () {
    var tasto = trova("quadro-smetti");
    chiediConferma(
      due("Smettere di mandare il rapporto?", "Stop sending the report?"),
      due(
        (chiHaFattoLImpianto || "Chi ti ha fatto l'impianto") +
          " non vedrà più come sta l'impianto, né se va aggiornato.",
        (chiHaFattoLImpianto || "Whoever installed your home") +
          " will no longer see how the system is doing, or whether it needs updating.",
      ),
      due("Smetti", "Stop"),
    ).then(function (si) {
      if (!si) return;
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
  });

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
    if (sua.compresa) pezzi.push(due("compreso in GdAHome Premium", "included in GdAHome Premium"));
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

  /* Fino a quando vale, detto senza «Premium» davanti: per lo stato in
   * grande, dove «Premium» e' gia' il titolo, e per la mattonella della Casa,
   * dove c'e' gia' il bollino. Stessa regola di `comEMessa` per gli
   * abbonamenti nei giorni del margine. */
  function finoAQuando(sua) {
    var nelMargine = sua.pagato != null && sua.pagato <= Date.now();
    var finoAl = sua.pagato != null && !nelMargine ? sua.pagato : sua.scade;
    var pezzi = [
      finoAl == null ? due("Per sempre", "For good") : due("Fino al ", "Until ") + unGiorno(finoAl),
    ];
    if (daDove(sua.origine)) pezzi.push(daDove(sua.origine));
    if (nelMargine) pezzi.push(due("rinnovo in attesa", "renewal pending"));
    return pezzi.join(" · ");
  }

  /* Base e Premium in una riga sola: cosa hai, e cosa aggiungerebbe. */
  function laRigaDiBase() {
    return due(
      "Usi la casa dal Wi-Fi di casa, con la plancia principale. Premium aggiunge l'accesso da fuori e tutte le plance.",
      "You use your home on its own Wi-Fi, with the main dashboard. Premium adds access from away and every dashboard.",
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
    /* Lo stato in grande: «Premium attivo», fino a quando e da dove; o «Base»
     * e, in una riga, cosa aggiungerebbe Premium. */
    trova("scheda-licenza").dataset.premium = gdahome.attiva ? "si" : "no";
    trova("licenza-titolo").textContent = gdahome.attiva
      ? due("Premium attivo", "Premium is on")
      : "Base";
    trova("licenza-riga").textContent = gdahome.attiva ? finoAQuando(gdahome) : laRigaDiBase();
    /* Chi ha gia' Premium non deve leggere come comprarlo: gli resta il
     * codice, che allunga o regala. */
    trova("attiva-titolo").textContent = gdahome.attiva
      ? due("Hai un codice regalo?", "Have a gift code?")
      : due("Come si attiva", "How to activate it");
    trova("via-negozio").hidden = Boolean(gdahome.attiva);
    trova("via-codice").hidden = Boolean(gdahome.attiva);
    /* Con Base quella riga l'ha gia' detta lo stato in grande. */
    /* Il confronto: la colonna di questa casa e' evidenziata. */
    trova("scheda-vantaggi").dataset.premium = gdahome.attiva ? "si" : "no";
    trova("tuo-base").hidden = Boolean(gdahome.attiva);
    trova("tuo-premium").hidden = !gdahome.attiva;
    /* Sotto, l'altra app della casa: GdANav, che dentro Premium e' compreso. */
    var elenco = trova("elenco-licenze");
    elenco.textContent = "";
    elenco.appendChild(
      unaRigaDiLicenza(
        "GdANav",
        gdanav,
        due(
          "Base: navigazione completa per l'auto termica",
          "Base: full navigation for combustion cars",
        ),
      ),
    );
    /* La mattonella della Casa: il bollino, e fino a quando. */
    trova("riepilogo-licenza").textContent = gdahome.attiva
      ? finoAQuando(gdahome)
      : due("Scopri cosa aggiunge Premium", "See what Premium adds");
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
        ? due("Controllata ", "Checked ") + quantoFa(ultima.quando)
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
