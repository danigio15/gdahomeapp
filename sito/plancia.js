/* La plancia dimostrativa del sito: si tocca, e risponde.
 *
 * Non è un video e non sono fotografie. È l'app disegnata in HTML, con
 * dentro la casa demo del collaudo — `collaudo/casa-demo.json`, le stesse
 * 234 entità contro cui girano le prove: sette stanze, otto luci, cinque
 * termostati, un fotovoltaico con la batteria, sei elettrodomestici. Chi
 * arriva sul sito accende una luce e vede il consumo salire, chiude una
 * tapparella e la vede scendere, inserisce l'allarme e la casa cambia stato.
 *
 * Perché così e non un filmato: un filmato lo si guarda, una plancia la si
 * tocca, e la differenza fra le due cose è tutto quello che questo progetto
 * vuole far capire in venti secondi.
 *
 * Quello che è finto, ed è giusto dirlo: non c'è nessuna casa dall'altra
 * parte. I comandi cambiano una mappa in memoria, non un'entità di Home
 * Assistant. Il fotovoltaico segue l'ora vera di chi guarda — di notte non
 * produce niente, e la casa tira dalla batteria — perché una vetrina che
 * mostra il sole alle tre di notte si riconosce subito.
 *
 * I lucchetti sulle sezioni a pagamento sono quelli veri di
 * `sito/listino.js`, che è la copia di `app/lib/schermate/acquisti/
 * catalogo.dart`.
 */

(function () {
  "use strict";

  var DATI = window.CASA_DEMO;
  if (!DATI) return;

  var ICONE = "statico/oggetti/";

  /* ── Fare pezzi di pagina senza scrivere cento volte le stesse righe ──── */

  function h(tag, attributi) {
    var nodo = document.createElement(tag);
    var a = attributi || {};
    for (var chiave in a) {
      if (!Object.prototype.hasOwnProperty.call(a, chiave)) continue;
      var v = a[chiave];
      if (v === null || v === undefined || v === false) continue;
      if (chiave === "classe") nodo.className = v;
      else if (chiave === "testo") nodo.textContent = v;
      else if (chiave === "html") nodo.innerHTML = v;
      else if (chiave === "stile") nodo.setAttribute("style", v);
      else if (chiave.slice(0, 2) === "on") nodo[chiave] = v;
      else nodo.setAttribute(chiave, v);
    }
    for (var i = 2; i < arguments.length; i++) {
      var figlio = arguments[i];
      if (figlio === null || figlio === undefined || figlio === false) continue;
      if (Array.isArray(figlio)) {
        for (var k = 0; k < figlio.length; k++) if (figlio[k]) nodo.appendChild(figlio[k]);
        continue;
      }
      nodo.appendChild(typeof figlio === "string" ? document.createTextNode(figlio) : figlio);
    }
    return nodo;
  }

  /* Lo stesso, per l'SVG: i nodi di un disegno vogliono il loro spazio dei
   * nomi, e `document.createElement` ne fa di quelli che il browser non
   * disegna. */
  function sv(tag, attributi) {
    var nodo = document.createElementNS("http://www.w3.org/2000/svg", tag);
    var a = attributi || {};
    for (var chiave in a)
      if (Object.prototype.hasOwnProperty.call(a, chiave)) nodo.setAttribute(chiave, a[chiave]);
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) nodo.appendChild(arguments[i]);
    return nodo;
  }

  function icona(nome, lato) {
    return h("img", {
      classe: "pl-icona",
      src: ICONE + nome + ".svg",
      alt: "",
      width: lato || 24,
      height: lato || 24,
      loading: "lazy",
    });
  }

  /* Un numero come lo scrive la plancia: Oswald, stretto e alto, con l'unità
   * più piccola di fianco. Sulla plancia i numeri non sono scritti col
   * carattere del testo, ed è la prima cosa che si vede di una tessera. */
  function cifra(valore, unita, classe) {
    return h(
      "div",
      { classe: "pl-cifra " + (classe || "") },
      h("span", { classe: "pl-cifra-n", testo: valore }),
      unita ? h("span", { classe: "pl-cifra-u", testo: unita }) : null,
    );
  }

  /* ── Lo stato della casa ──────────────────────────────────────────────── */

  var stato = {};
  Object.keys(DATI.entita).forEach(function (id) {
    var e = DATI.entita[id];
    var attributi = {};
    Object.keys(e.attributi || {}).forEach(function (k) {
      attributi[k] = e.attributi[k];
    });
    stato[id] = { stato: e.stato, attributi: attributi };
  });

  var P = DATI.plancia;

  function val(id, difetto) {
    return stato[id] ? stato[id].stato : difetto === undefined ? "" : difetto;
  }
  function num(id, difetto) {
    var n = Number(val(id, difetto));
    return isFinite(n) ? n : difetto || 0;
  }
  function attr(id, chiave, difetto) {
    var e = stato[id];
    if (!e || e.attributi[chiave] === undefined) return difetto;
    return e.attributi[chiave];
  }
  function nomeDi(id, difetto) {
    return attr(id, "friendly_name", difetto || id);
  }
  var ACCESI = {
    on: 1,
    open: 1,
    unlocked: 1,
    playing: 1,
    cleaning: 1,
    home: 1,
  };
  function acceso(id) {
    return !!ACCESI[val(id)];
  }

  function poni(id, nuovo, attributi) {
    if (!stato[id]) stato[id] = { stato: nuovo, attributi: {} };
    else stato[id].stato = nuovo;
    if (attributi)
      Object.keys(attributi).forEach(function (k) {
        stato[id].attributi[k] = attributi[k];
      });
  }

  function scambia(id, acceso_, spento) {
    poni(id, acceso(id) ? spento : acceso_);
    disegna();
  }

  /* ── Quanto tira la casa ──────────────────────────────────────────────
   *
   * Il consumo non è un numero scritto da qualche parte: si calcola da quello
   * che è acceso adesso. È il pezzo che tiene insieme la dimostrazione —
   * accendi il forno nella pagina degli elettrodomestici e nella pagina
   * dell'energia il consumo sale, come succederebbe in casa. */
  var WATT = {
    "switch.lavatrice": 612,
    "switch.lavastoviglie": 1180,
    "switch.asciugatrice": 1900,
    "switch.forno": 2100,
    "switch.robot": 42,
    "switch.boiler": 1500,
    "switch.piscina_pompa": 550,
    "switch.piscina_riscaldamento": 2400,
    "switch.esterno_giardino": 60,
    "switch.presa_tv": 110,
    "switch.presa_firestick": 4,
    "switch.presa_modem": 12,
    "switch.presa_camera": 30,
    "switch.acquario_luce": 25,
    "switch.acquario_pompa": 18,
    "switch.pompa_solare": 45,
    "switch.solare_termico": 8,
    "switch.inverter_ventola": 22,
    "switch.antifurto": 6,
  };
  var BASE = 410; /* il frigo, il modem, le spie: la casa che non spegne mai */

  function potenzaCasa() {
    var w = BASE;
    P.luci.forEach(function (l) {
      if (acceso(l.entity)) w += 6 + (Number(attr(l.entity, "brightness", 255)) / 255) * 14;
    });
    Object.keys(WATT).forEach(function (id) {
      if (acceso(id)) w += WATT[id];
    });
    P.clima.forEach(function (c) {
      var modo = val(c.entity);
      if (modo === "cool") w += 780;
      else if (modo === "heat") w += 1250;
      else if (modo === "dry" || modo === "fan_only") w += 240;
    });
    if (val("vacuum.robot") === "cleaning") w += 48;
    return Math.round(w + ondina * 40);
  }

  /* Il sole segue l'ora di chi guarda: alle tre di notte non produce, e la
   * casa tira dalla batteria. Una vetrina che mostra il sole a mezzanotte si
   * riconosce al primo sguardo. */
  function curvaSolare(ora) {
    var alba = 6.5,
      tramonto = 20.5;
    if (ora <= alba || ora >= tramonto) return 0;
    return Math.pow(Math.sin((Math.PI * (ora - alba)) / (tramonto - alba)), 1.3);
  }
  function solare() {
    var d = new Date();
    var ora = d.getHours() + d.getMinutes() / 60;
    return Math.round(7900 * curvaSolare(ora) * (0.92 + ondina * 0.16));
  }

  /* Quanto si prende l'auto: il sole che avanza oltre una soglia, fino a
   * quanto la wallbox regge. Cresce piano invece di accendersi di colpo — un
   * gradino nel disegno della giornata sembra un errore di disegno, e una
   * wallbox in modalità solare davvero insegue il sole, non scatta.
   *
   * È la stessa regola per i numeri di adesso e per il disegno della
   * giornata: se fossero due, la linea e i numeri racconterebbero due case
   * diverse. */
  function quantoPrendeLAuto(avanzo) {
    return Math.min(Math.max(Math.round(avanzo - 1400), 0), 4200);
  }

  /* Il bilancio: il sole copre la casa, quello che avanza carica la batteria
   * e poi va in rete; quello che manca lo mette la batteria, e poi la rete. */
  function bilancio() {
    var sole = solare();
    var casa = potenzaCasa();
    var soc = num("sensor.batteria_soc", 68);

    /* L'auto sta in «Ricarica solare», che è la modalità con cui la casa demo
     * ha la wallbox: tira solo il sole che avanza, e quando il sole cala si
     * ferma. Senza questa regola, di mezzogiorno la casa mostrerebbe dieci
     * chilowatt di consumo e la dimostrazione racconterebbe il contrario di
     * quello che vuole raccontare. */
    var auto = 0;
    var avanzo = sole - casa;
    if (num("sensor.auto_batteria", 74) < 95) {
      auto = quantoPrendeLAuto(avanzo);
      casa += auto;
      avanzo = sole - casa;
    }

    var batteria = 0;
    if (avanzo > 0) batteria = soc < 98 ? Math.min(avanzo, 3000) : 0;
    else batteria = soc > 12 ? -Math.min(-avanzo, 3500) : 0;
    var rete = casa - sole + batteria;
    return {
      sole: sole,
      casa: casa,
      auto: auto,
      batteria: batteria,
      rete: rete,
      soc: soc,
    };
  }

  /* Il consumo di una giornata, ora per ora: la casa che si sveglia, il
   * pranzo, la sera. Serve al disegno del giorno, e non è preso da nessun
   * sensore — la casa demo è una fotografia di un istante, non una giornata.
   * È l'unica cosa inventata di quel disegno: il sole no, quello è la stessa
   * curva che muove i numeri qui sopra. */
  function consumoDellOra(ora) {
    var gobba = function (centro, largo, quanto) {
      var d = (ora - centro) / largo;
      return quanto * Math.exp(-d * d);
    };
    return (
      380 +
      gobba(7.5, 1.3, 1500) +
      gobba(12.8, 1.6, 1800) +
      gobba(19.8, 1.9, 2600) +
      gobba(22.3, 1.1, 700)
    );
  }

  function autoDellOra(sole, casa) {
    return quantoPrendeLAuto(sole - casa);
  }

  function disegnoDelGiorno() {
    var LARGO = 720,
      ALTO = 200,
      SU = 14,
      GIU = 26,
      SINISTRA = 30;
    var passi = [];
    var massimo = 1000;
    for (var i = 0; i <= 96; i++) {
      var ora = (i / 96) * 24;
      var sole = 7900 * curvaSolare(ora);
      var casa = consumoDellOra(ora);
      casa += autoDellOra(sole, casa);
      massimo = Math.max(massimo, sole, casa);
      passi.push({ ora: ora, sole: sole, casa: casa });
    }
    massimo = Math.ceil(massimo / 1000) * 1000;

    var x = function (ora) {
      return SINISTRA + (ora / 24) * (LARGO - SINISTRA);
    };
    var y = function (w) {
      return ALTO - GIU - (w / massimo) * (ALTO - GIU - SU);
    };
    var filo = function (chiave) {
      return passi
        .map(function (p, k) {
          return (k ? "L" : "M") + x(p.ora).toFixed(1) + " " + y(p[chiave]).toFixed(1);
        })
        .join(" ");
    };

    var adesso = new Date();
    var oraAdesso = adesso.getHours() + adesso.getMinutes() / 60;

    var righe = [];
    for (var k = 0; k <= massimo; k += massimo / 2) {
      righe.push(
        sv("line", {
          x1: SINISTRA,
          x2: LARGO,
          y1: y(k),
          y2: y(k),
          stroke: "var(--bordo-tenue)",
          "stroke-width": 1,
        }),
      );
      righe.push(
        sv(
          "text",
          {
            x: SINISTRA - 6,
            y: y(k) + 4,
            "text-anchor": "end",
            "font-size": 10,
            fill: "var(--testo-lieve)",
          },
          document.createTextNode((k / 1000).toFixed(0) + " kW"),
        ),
      );
    }

    var ore = [];
    [0, 6, 12, 18, 24].forEach(function (o) {
      ore.push(
        sv(
          "text",
          {
            x: x(o),
            y: ALTO - 8,
            "text-anchor": o === 0 ? "start" : o === 24 ? "end" : "middle",
            "font-size": 10,
            fill: "var(--testo-lieve)",
          },
          document.createTextNode(o === 24 ? "24" : String(o).padStart(2, "0")),
        ),
      );
    });

    var disegno = sv(
      "svg",
      {
        viewBox: "0 0 " + LARGO + " " + ALTO,
        class: "pl-giorno",
        role: "img",
        "aria-label": "Il sole e il consumo di casa lungo la giornata, ora per ora.",
      },
      sv(
        "defs",
        null,
        sv(
          "linearGradient",
          { id: "pl-sfumatura-sole", x1: "0", y1: "0", x2: "0", y2: "1" },
          sv("stop", {
            offset: "0",
            "stop-color": "var(--ambra)",
            "stop-opacity": "0.45",
          }),
          sv("stop", {
            offset: "1",
            "stop-color": "var(--ambra)",
            "stop-opacity": "0",
          }),
        ),
      ),
    );
    righe.forEach(function (r) {
      disegno.appendChild(r);
    });
    ore.forEach(function (r) {
      disegno.appendChild(r);
    });
    disegno.appendChild(
      sv("path", {
        d:
          filo("sole") +
          " L" +
          x(24).toFixed(1) +
          " " +
          y(0).toFixed(1) +
          " L" +
          x(0).toFixed(1) +
          " " +
          y(0).toFixed(1) +
          " Z",
        fill: "url(#pl-sfumatura-sole)",
      }),
    );
    disegno.appendChild(
      sv("path", {
        d: filo("sole"),
        fill: "none",
        stroke: "var(--ambra)",
        "stroke-width": 2,
        "stroke-linejoin": "round",
      }),
    );
    disegno.appendChild(
      sv("path", {
        d: filo("casa"),
        fill: "none",
        stroke: "var(--azzurro)",
        "stroke-width": 2,
        "stroke-linejoin": "round",
      }),
    );
    disegno.appendChild(
      sv("line", {
        x1: x(oraAdesso),
        x2: x(oraAdesso),
        y1: SU - 6,
        y2: y(0),
        stroke: "var(--testo-lieve)",
        "stroke-width": 1.2,
        "stroke-dasharray": "3 4",
      }),
    );
    disegno.appendChild(
      sv("circle", {
        cx: x(oraAdesso),
        cy: y(7900 * curvaSolare(oraAdesso)),
        r: 4,
        fill: "var(--ambra)",
        stroke: "var(--pl-tessera)",
        "stroke-width": 2,
      }),
    );

    return disegno;
  }

  /* ── I pezzi che si ripetono ──────────────────────────────────────────── */

  function tessera(opzioni) {
    var o = opzioni || {};
    var testa = o.titolo
      ? h(
          "div",
          { classe: "pl-testa" },
          o.disegno ? icona(o.disegno, 22) : null,
          h("span", { classe: "pl-titolo", testo: o.titolo, title: o.titolo }),
          o.lato ? h("span", { classe: "pl-lato", testo: o.lato }) : null,
        )
      : null;
    var nodo = h(
      "div",
      {
        classe: "pl-tessera" + (o.classe ? " " + o.classe : "") + (o.larga ? " pl-larga" : ""),
      },
      testa,
    );
    for (var i = 1; i < arguments.length; i++) if (arguments[i]) nodo.appendChild(arguments[i]);
    return nodo;
  }

  function interruttore(su, quando) {
    return h("button", {
      classe: "pl-interruttore" + (su ? " pl-sì" : ""),
      onclick: quando,
      "aria-pressed": su ? "true" : "false",
      "aria-label": su ? "Spegni" : "Accendi",
      type: "button",
    });
  }

  /* Il lucchetto: una sezione che nella casa gratis è chiusa. Non è un muro
   * finto messo per far dispetto — è esattamente quello che il ponte fa alla
   * configurazione quando il diritto non ha la chiave. */
  function lucchetto(cosa, prezzo) {
    return h(
      "div",
      { classe: "pl-chiuso" },
      h("div", { classe: "pl-chiuso-serratura", html: SERRATURA }),
      h("p", { classe: "pl-chiuso-cosa", testo: cosa }),
      h("p", {
        classe: "pl-chiuso-prezzo",
        testo: "Casa completa · " + prezzo,
      }),
      h("button", {
        classe: "pl-chiuso-bottone",
        type: "button",
        testo: "Vedi i piani",
        onclick: function () {
          var dove = document.getElementById("piani");
          if (dove) dove.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      }),
    );
  }

  var SERRATURA =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" ' +
    'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
    'stroke-linejoin="round"><rect x="4" y="10.5" width="16" height="10" ' +
    'rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>';

  /* Le cose che si aggiornano da sole: ogni disegno le registra, e il
   * battito le richiama. Senza questo, per far muovere un numero bisognerebbe
   * ridisegnare tutta la pagina, e un cursore trascinato si perderebbe a
   * metà. */
  var viventi = [];
  function vivi(fn) {
    viventi.push(fn);
    fn();
  }

  /* ── Le sezioni della plancia ─────────────────────────────────────────── */

  function stanzaDi(id) {
    for (var i = 0; i < P.stanze.length; i++) if (P.stanze[i].id === id) return P.stanze[i];
    return null;
  }

  var METEO = {
    sunny: ["Sereno", "☀️"],
    partlycloudy: ["Poco nuvoloso", "⛅"],
    cloudy: ["Nuvoloso", "☁️"],
    rainy: ["Pioggia", "🌧️"],
    clear_night: ["Sereno", "🌙"],
  };

  function sezioneHome() {
    var b = bilancio();
    var condizione = val("weather.casa", "sunny");
    var meteo = METEO[condizione] || METEO.sunny;

    var lucciAccese = P.luci.filter(function (l) {
      return acceso(l.entity);
    }).length;
    var aperte = P.tapparelle.filter(function (t) {
      return t.contact && acceso(t.contact);
    }).length;

    /* Il meteo */
    var tMeteo = tessera(
      { titolo: "Fuori", disegno: "aria" },
      h(
        "div",
        { classe: "pl-meteo" },
        h("div", { classe: "pl-meteo-segno", testo: meteo[1] }),
        h(
          "div",
          null,
          cifra(Math.round(Number(attr("weather.casa", "temperature", 26))), "°C"),
          h("p", { classe: "pl-sotto", testo: meteo[0] }),
        ),
      ),
      h(
        "div",
        { classe: "pl-righe" },
        riga("Umidità", attr("weather.casa", "humidity", 42) + " %"),
        riga("Vento", attr("weather.casa", "wind_speed", 11.5) + " km/h"),
      ),
    );

    /* Chi c'è */
    var persone = ["person.giovanni", "person.laura", "person.marco"].map(function (id) {
      var s = val(id);
      var dentro = s === "home";
      return h(
        "div",
        { classe: "pl-persona" + (dentro ? " pl-sì" : "") },
        h("span", {
          classe: "pl-tondo",
          testo: nomeDi(id, "?").slice(0, 1),
        }),
        h(
          "div",
          null,
          h("p", { classe: "pl-persona-nome", testo: nomeDi(id) }),
          h("p", {
            classe: "pl-sotto",
            testo: dentro ? "In casa" : s === "not_home" ? "Fuori" : s,
          }),
        ),
      );
    });
    var tPersone = tessera(
      { titolo: "Chi c'è", disegno: "persone" },
      h("div", { classe: "pl-persone" }, persone),
    );

    /* Adesso: il numero che si muove */
    var nConsumo = cifra("—", "W", "pl-grande");
    var nSole = cifra("—", "W", "pl-grande pl-oro");
    var quotaSole = h("div", { classe: "pl-barra-sole" });
    var conLaRete = h("p", { classe: "pl-sotto", testo: "" });
    vivi(function () {
      var c = bilancio();
      nConsumo.firstChild.textContent = c.casa.toLocaleString("it-IT");
      nSole.firstChild.textContent = c.sole.toLocaleString("it-IT");
      quotaSole.setAttribute(
        "style",
        "width:" + Math.min(100, (c.sole / Math.max(c.casa, c.sole, 1)) * 100) + "%",
      );
      conLaRete.textContent =
        c.rete < -50
          ? "Stai regalando " + Math.abs(c.rete) + " W alla rete"
          : c.rete > 50
            ? "Dalla rete " + c.rete + " W"
            : "In pareggio con la rete";
    });
    var tAdesso = tessera(
      { titolo: "Adesso", disegno: "energia", lato: "in tempo reale" },
      h(
        "div",
        { classe: "pl-due" },
        h("div", null, h("p", { classe: "pl-sotto", testo: "Consumo" }), nConsumo),
        h("div", null, h("p", { classe: "pl-sotto", testo: "Dal sole" }), nSole),
      ),
      h("div", { classe: "pl-barra-doppia" }, quotaSole),
      conLaRete,
    );

    /* Il riepilogo, che porta dove serve */
    var tRiepilogo = tessera(
      { titolo: "La casa in due righe", disegno: "evidenza" },
      h(
        "div",
        { classe: "pl-righe pl-cliccabili" },
        rigaVai(
          lucciAccese === 0
            ? "Nessuna luce accesa"
            : lucciAccese === 1
              ? "Una luce accesa"
              : lucciAccese + " luci accese",
          "luci",
        ),
        rigaVai(
          aperte === 0
            ? "Finestre tutte chiuse"
            : aperte === 1
              ? "Una finestra aperta"
              : aperte + " finestre aperte",
          "finestre",
        ),
        rigaVai(
          val("alarm_control_panel.casa") === "disarmed"
            ? "Allarme disinserito"
            : "Allarme inserito",
          "sicurezza",
        ),
        rigaVai(
          val("vacuum.robot") === "cleaning" ? "Il robot sta pulendo" : "Il robot è alla base",
          "stanze",
        ),
      ),
    );

    /* Le azioni rapide: cambiano la casa davvero */
    var tAzioni = tessera(
      { titolo: "Azioni rapide", disegno: "azioni" },
      h(
        "div",
        { classe: "pl-azioni" },
        azione("Spegni le luci", function () {
          P.luci.forEach(function (l) {
            poni(l.entity, "off");
          });
          disegna();
        }),
        azione("Chiudi le tapparelle", function () {
          P.tapparelle.forEach(function (t) {
            poni(t.entity, "closed", { current_position: 0 });
          });
          disegna();
        }),
        azione(
          val("alarm_control_panel.casa") === "disarmed"
            ? "Inserisci l'allarme"
            : "Disinserisci l'allarme",
          function () {
            poni(
              "alarm_control_panel.casa",
              val("alarm_control_panel.casa") === "disarmed" ? "armed_away" : "disarmed",
            );
            disegna();
          },
        ),
        azione("Buonanotte", function () {
          P.luci.forEach(function (l) {
            poni(l.entity, "off");
          });
          P.tapparelle.forEach(function (t) {
            poni(t.entity, "closed", { current_position: 0 });
          });
          P.clima.forEach(function (c) {
            poni(c.entity, "off");
          });
          poni("alarm_control_panel.casa", "armed_home");
          poni("media_player.salone", "off");
          disegna();
        }),
      ),
    );

    /* Quello che suona */
    var media = "media_player.salone";
    var tMedia = tessera(
      { titolo: "Musica", disegno: "media" },
      h(
        "div",
        { classe: "pl-media" },
        h(
          "div",
          null,
          h("p", {
            classe: "pl-media-titolo",
            testo: attr(media, "media_title", "—"),
          }),
          h("p", {
            classe: "pl-sotto",
            testo: attr(media, "media_artist", ""),
          }),
        ),
        h("button", {
          classe: "pl-tondo-bottone" + (acceso(media) ? " pl-sì" : ""),
          type: "button",
          "aria-label": acceso(media) ? "Metti in pausa" : "Riprendi",
          html: acceso(media)
            ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="7" y="5" width="4" height="14" rx="1"/><rect x="13" y="5" width="4" height="14" rx="1"/></svg>'
            : '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
          onclick: function () {
            poni(media, acceso(media) ? "paused" : "playing");
            disegna();
          },
        }),
      ),
    );

    /* L'agenda e la lista */
    var tAgenda = tessera(
      { titolo: "In programma", disegno: "agenda" },
      h(
        "div",
        { classe: "pl-righe" },
        riga(attr("calendar.famiglia", "message", "—"), "oggi"),
        riga(attr("calendar.lavoro", "message", "—"), "domani"),
        riga("Spesa", "3 cose"),
      ),
    );

    return griglia([tAdesso, tRiepilogo, tMeteo, tPersone, tAzioni, tMedia, tAgenda]);
  }

  function riga(che, quanto) {
    return h(
      "div",
      { classe: "pl-riga" },
      h("span", { testo: che }),
      h("span", { classe: "pl-riga-v", testo: String(quanto) }),
    );
  }
  function rigaVai(che, dove) {
    return h(
      "button",
      {
        classe: "pl-riga pl-riga-vai",
        type: "button",
        onclick: function () {
          vai(dove);
        },
      },
      h("span", { testo: che }),
      h("span", { classe: "pl-freccia", testo: "→" }),
    );
  }
  function azione(che, quando) {
    return h("button", {
      classe: "pl-azione",
      type: "button",
      testo: che,
      onclick: quando,
    });
  }

  function griglia(tessere) {
    return h("div", { classe: "pl-griglia" }, tessere);
  }

  /* ── Energia ──────────────────────────────────────────────────────────── */

  function sezioneEnergia() {
    var nodi = {};
    function nodo(chiave, titolo, disegno, classe) {
      var n = cifra("—", "W");
      var scritta = h("p", { classe: "pl-sotto", testo: titolo });
      nodi[chiave] = n;
      nodi["nome-" + chiave] = scritta;
      return h(
        "div",
        { classe: "pl-flusso-nodo " + (classe || "") },
        icona(disegno, 26),
        scritta,
        n,
      );
    }

    function filo(chiave) {
      var f = h("div", { classe: "pl-filo pl-filo-" + chiave });
      nodi["filo-" + chiave] = f;
      return f;
    }

    var flusso = h(
      "div",
      { classe: "pl-flusso" },
      nodo("sole", "Fotovoltaico", "solare", "pl-flusso-sole"),
      filo("sole"),
      nodo("casa", "Casa", "home", "pl-flusso-casa"),
      filo("rete"),
      nodo("rete", "Rete", "prese", "pl-flusso-rete"),
      filo("batteria"),
      nodo("batteria", "Batteria", "batterie", "pl-flusso-batteria"),
    );

    var socBarra = h("div", { classe: "pl-soc-dentro" });

    vivi(function () {
      var b = bilancio();
      nodi.sole.firstChild.textContent = b.sole.toLocaleString("it-IT");
      nodi.casa.firstChild.textContent = b.casa.toLocaleString("it-IT");
      nodi.rete.firstChild.textContent = Math.abs(b.rete).toLocaleString("it-IT");
      nodi.batteria.firstChild.textContent = Math.abs(b.batteria).toLocaleString("it-IT");
      nodi["filo-sole"].className = "pl-filo pl-filo-sole" + (b.sole > 60 ? " pl-scorre" : "");
      nodi["filo-rete"].className =
        "pl-filo pl-filo-rete" +
        (Math.abs(b.rete) > 60 ? " pl-scorre" : "") +
        (b.rete < -60 ? " pl-indietro" : "");
      nodi["filo-batteria"].className =
        "pl-filo pl-filo-batteria" +
        (Math.abs(b.batteria) > 60 ? " pl-scorre" : "") +
        (b.batteria < -60 ? " pl-indietro" : "");
      /* «Batteria 644 W» da solo non dice niente: quello che serve sapere è
       * se si sta caricando o svuotando. Lo stesso per la rete. */
      nodi["nome-rete"].textContent =
        b.rete > 60 ? "Rete · prelevi" : b.rete < -60 ? "Rete · immetti" : "Rete";
      nodi["nome-batteria"].textContent =
        b.batteria > 60
          ? "Batteria · si carica"
          : b.batteria < -60
            ? "Batteria · si svuota"
            : "Batteria";
      socBarra.setAttribute("style", "width:" + b.soc + "%");
    });

    var b = bilancio();

    var tFlusso = tessera(
      {
        titolo: "Dove va la corrente, adesso",
        disegno: "energia",
        lato: b.rete < -60 ? "stai vendendo" : b.sole > 60 ? "autoconsumo" : "dalla rete",
        larga: true,
      },
      flusso,
      h(
        "div",
        { classe: "pl-soc" },
        h("span", { classe: "pl-sotto", testo: "Batteria" }),
        h("div", { classe: "pl-soc-fuori" }, socBarra),
        h("span", { classe: "pl-riga-v", testo: b.soc + " %" }),
      ),
    );

    var tGiorno = tessera(
      {
        titolo: "La giornata, ora per ora",
        disegno: "solare",
        lato: "il tratteggio è adesso",
        larga: true,
      },
      disegnoDelGiorno(),
      h(
        "div",
        { classe: "pl-legenda" },
        h("span", { classe: "pl-legenda-sole", testo: "dal sole" }),
        h("span", { classe: "pl-legenda-casa", testo: "consumo di casa" }),
      ),
    );

    var tOggi = tessera(
      { titolo: "Oggi", disegno: "solare" },
      h(
        "div",
        { classe: "pl-due" },
        h(
          "div",
          null,
          h("p", { classe: "pl-sotto", testo: "Prodotto" }),
          cifra(num("sensor.fv_energia_oggi", 21.6).toFixed(1), "kWh", "pl-oro"),
        ),
        h(
          "div",
          null,
          h("p", { classe: "pl-sotto", testo: "Consumato" }),
          cifra(num("sensor.casa_energia_oggi", 14.6).toFixed(1), "kWh"),
        ),
      ),
      h(
        "div",
        { classe: "pl-righe" },
        riga("Preso dalla rete", num("sensor.rete_prelievo_oggi", 3.2) + " kWh"),
        riga("Dato alla rete", num("sensor.rete_immissione_oggi", 7.9) + " kWh"),
        riga("In batteria", num("sensor.batteria_caricata_oggi", 6.4) + " kWh"),
      ),
    );

    /* I carichi, con la barra lunga quanto tirano */
    var adesso = bilancio();
    function quantoTira(c) {
      /* La wallbox non è un numero scritto: è il sole che avanza. */
      return c.power_entity === "sensor.wallbox_potenza" ? adesso.auto : num(c.power_entity, 0);
    }
    var massimo = 1;
    P.carichi.forEach(function (c) {
      massimo = Math.max(massimo, quantoTira(c));
    });
    var tCarichi = tessera(
      { titolo: "Chi consuma", disegno: "widget" },
      h(
        "div",
        { classe: "pl-carichi" },
        P.carichi.map(function (c) {
          var w = quantoTira(c);
          return h(
            "div",
            { classe: "pl-carico" },
            h(
              "div",
              { classe: "pl-carico-testa" },
              h("span", { testo: c.name }),
              h("span", {
                classe: "pl-riga-v",
                testo: w.toLocaleString("it-IT") + " W",
              }),
            ),
            h(
              "div",
              { classe: "pl-carico-fuori" },
              h("div", {
                classe: "pl-carico-dentro",
                stile: "width:" + Math.round((w / massimo) * 100) + "%;background:" + c.color,
              }),
            ),
          );
        }),
      ),
    );

    /* Quello che nella casa gratis è chiuso. */
    var tReport = tessera(
      { titolo: "Report e confronti", disegno: "evidenza" },
      lucchetto(
        "I report mensili, l'analisi per dispositivo e i confronti nel tempo. L'energia di adesso resta gratis, sempre.",
        "19,99 €",
      ),
    );

    return griglia([tFlusso, tGiorno, tOggi, tCarichi, tReport]);
  }

  /* ── Luci ─────────────────────────────────────────────────────────────── */

  function sezioneLuci() {
    var accese = P.luci.filter(function (l) {
      return acceso(l.entity);
    }).length;

    var tutte = tessera(
      { titolo: "Tutte le luci", disegno: "luci", lato: accese + " accese" },
      h(
        "div",
        { classe: "pl-azioni" },
        azione("Accendi tutte", function () {
          P.luci.forEach(function (l) {
            poni(l.entity, "on");
          });
          disegna();
        }),
        azione("Spegni tutte", function () {
          P.luci.forEach(function (l) {
            poni(l.entity, "off");
          });
          disegna();
        }),
      ),
    );

    var tessere = P.luci.map(function (l) {
      var id = l.entity;
      var su = acceso(id);
      var luce = Math.round((Number(attr(id, "brightness", 255)) / 255) * 100);
      var stanza = stanzaDi(l.room_id);
      var etichetta = h("span", {
        classe: "pl-riga-v",
        testo: su ? luce + " %" : "spenta",
      });

      /* Una luce spenta non ha una luminosità: in Home Assistant l'attributo
       * non c'è proprio. Il cursore va a zero e si spegne insieme a lei —
       * lasciarlo al massimo sotto la parola «spenta» è la cosa che fa
       * fermare chi legge a chiedersi quale delle due è vera. */
      var cursore = h("input", {
        classe: "pl-cursore",
        type: "range",
        min: "0",
        max: "100",
        value: String(su ? luce : 0),
        "aria-label": "Luminosità di " + l.name,
        disabled: su ? null : "disabled",
        oninput: function (e) {
          var v = Math.max(1, Number(e.target.value));
          poni(id, "on", { brightness: Math.round((v / 100) * 255) });
          etichetta.textContent = v + " %";
        },
      });

      return tessera(
        {
          titolo: l.name,
          disegno: "luci",
          lato: stanza ? stanza.name : null,
          classe: "pl-luce" + (su ? " pl-accesa" : ""),
        },
        h(
          "div",
          { classe: "pl-luce-riga" },
          etichetta,
          interruttore(su, function () {
            scambia(id, "on", "off");
          }),
        ),
        cursore,
      );
    });

    return griglia([tutte].concat(tessere));
  }

  /* ── Clima ────────────────────────────────────────────────────────────── */

  var MODI = {
    off: "Spento",
    cool: "Fresco",
    heat: "Caldo",
    dry: "Deumidifica",
    fan_only: "Ventola",
  };

  function sezioneClima() {
    return griglia(
      P.clima.map(function (c) {
        var id = c.entity;
        var modo = val(id, "off");
        var mira = Number(attr(id, "temperature", 21));
        var adesso = Number(attr(id, "current_temperature", 22));

        function sposta(quanto) {
          var nuovo = Math.min(
            Number(attr(id, "max_temp", 30)),
            Math.max(Number(attr(id, "min_temp", 16)), mira + quanto),
          );
          poni(id, modo === "off" ? "heat" : modo, { temperature: nuovo });
          disegna();
        }

        return tessera(
          {
            titolo: c.name,
            disegno: "clima",
            lato: MODI[modo] || modo,
            classe: "pl-clima" + (modo !== "off" ? " pl-attivo pl-" + modo : ""),
          },
          h(
            "div",
            { classe: "pl-termostato" },
            h("button", {
              classe: "pl-passo",
              type: "button",
              testo: "−",
              "aria-label": "Meno mezzo grado",
              onclick: function () {
                sposta(-0.5);
              },
            }),
            h(
              "div",
              { classe: "pl-termostato-mezzo" },
              cifra(mira.toFixed(1).replace(".", ","), "°C", "pl-grande"),
              h("p", {
                classe: "pl-sotto",
                testo: "in stanza " + adesso.toFixed(1).replace(".", ",") + " °C",
              }),
            ),
            h("button", {
              classe: "pl-passo",
              type: "button",
              testo: "+",
              "aria-label": "Più mezzo grado",
              onclick: function () {
                sposta(0.5);
              },
            }),
          ),
          h(
            "div",
            { classe: "pl-modi" },
            ["off", "cool", "heat", "dry"].map(function (m) {
              return h("button", {
                classe: "pl-modo" + (m === modo ? " pl-sì" : ""),
                type: "button",
                testo: MODI[m],
                onclick: function () {
                  poni(id, m);
                  disegna();
                },
              });
            }),
          ),
        );
      }),
    );
  }

  /* ── Temperatura ──────────────────────────────────────────────────────── */

  function sezioneTemperatura() {
    var tessere = P.stanze.map(function (s) {
      var t = num(s.temp, 21);
      var u = num(s.hum, 45);
      /* Da 15 a 30 gradi: la barra dice a colpo d'occhio chi è fuori posto. */
      var dove = Math.max(0, Math.min(100, ((t - 15) / 15) * 100));
      return tessera(
        { titolo: s.name, disegno: "temperatura", lato: s.floor },
        h(
          "div",
          { classe: "pl-due" },
          h(
            "div",
            null,
            cifra(t.toFixed(1).replace(".", ","), "°C", "pl-grande"),
            h("p", { classe: "pl-sotto", testo: "temperatura" }),
          ),
          h(
            "div",
            null,
            cifra(Math.round(u), "%"),
            h("p", { classe: "pl-sotto", testo: "umidità" }),
          ),
        ),
        h(
          "div",
          { classe: "pl-termometro" },
          h("div", { classe: "pl-termometro-punto", stile: "left:" + dove + "%" }),
        ),
      );
    });
    return griglia(tessere);
  }

  /* ── Finestre e tapparelle ────────────────────────────────────────────── */

  function sezioneFinestre() {
    return griglia(
      P.tapparelle.map(function (t) {
        var id = t.entity;
        var dove = Number(attr(id, "current_position", 100));
        var stanza = stanzaDi(t.room_id);
        var aperta = t.contact && acceso(t.contact);

        function metti(quanto) {
          poni(id, quanto > 0 ? "open" : "closed", { current_position: quanto });
          disegna();
        }

        return tessera(
          {
            titolo: t.name,
            disegno: "tapparelle",
            lato: stanza ? stanza.name : null,
          },
          h(
            "div",
            { classe: "pl-finestra" },
            h("div", {
              classe: "pl-tapparella",
              stile: "height:" + (100 - dove) + "%",
            }),
            h("div", { classe: "pl-vetro" }),
          ),
          h(
            "div",
            { classe: "pl-riga" },
            h("span", {
              testo: aperta ? "Finestra aperta" : "Finestra chiusa",
              classe: aperta ? "pl-allerta" : "",
            }),
            h("span", { classe: "pl-riga-v", testo: dove + " %" }),
          ),
          h(
            "div",
            { classe: "pl-azioni" },
            azione("Su", function () {
              metti(100);
            }),
            azione("Metà", function () {
              metti(50);
            }),
            azione("Giù", function () {
              metti(0);
            }),
          ),
        );
      }),
    );
  }

  /* ── Sicurezza ────────────────────────────────────────────────────────── */

  var ALLARME = {
    disarmed: "Disinserito",
    armed_home: "Inserito, in casa",
    armed_away: "Inserito, fuori casa",
  };

  function sezioneSicurezza() {
    var s = val("alarm_control_panel.casa", "disarmed");

    var tAllarme = tessera(
      {
        titolo: "Allarme",
        disegno: "sicurezza",
        classe: "pl-allarme" + (s === "disarmed" ? "" : " pl-inserito"),
      },
      h("p", { classe: "pl-allarme-stato", testo: ALLARME[s] || s }),
      h(
        "div",
        { classe: "pl-modi" },
        [
          ["disarmed", "Disinserisci"],
          ["armed_home", "In casa"],
          ["armed_away", "Fuori casa"],
        ].map(function (m) {
          return h("button", {
            classe: "pl-modo" + (m[0] === s ? " pl-sì" : ""),
            type: "button",
            testo: m[1],
            onclick: function () {
              poni("alarm_control_panel.casa", m[0]);
              disegna();
            },
          });
        }),
      ),
    );

    var varchi = [
      "binary_sensor.porta_ingresso",
      "binary_sensor.cancello_pedonale",
      "binary_sensor.finestra_cucina",
      "binary_sensor.finestra_soggiorno",
      "binary_sensor.movimento_giardino",
      "binary_sensor.fumo_cucina",
    ];
    var aperti = varchi.filter(acceso).length;

    /* Un sensore di movimento non è «aperto», e uno di fumo nemmeno: Home
     * Assistant lo dice nella classe, e chi legge la plancia si aspetta la
     * parola giusta. */
    var PAROLE = {
      motion: ["movimento", "fermo"],
      smoke: ["fumo!", "pulito"],
      moisture: ["bagnato", "asciutto"],
      door: ["aperto", "chiuso"],
      window: ["aperta", "chiusa"],
    };
    function comeSta(id) {
      var classe = attr(id, "device_class", "door");
      var due = PAROLE[classe] || PAROLE.door;
      return acceso(id) ? due[0] : due[1];
    }
    var tVarchi = tessera(
      {
        titolo: "Porte e finestre",
        disegno: "varchi",
        lato: aperti === 0 ? "tutto chiuso" : aperti + " da guardare",
      },
      h(
        "div",
        { classe: "pl-righe" },
        varchi.map(function (id) {
          var su = acceso(id);
          return h(
            "div",
            { classe: "pl-riga" },
            h("span", { testo: nomeDi(id) }),
            h("span", {
              classe: "pl-pallino " + (su ? "pl-pallino-sì" : "pl-pallino-no"),
              testo: comeSta(id),
            }),
          );
        }),
      ),
    );

    var tSerrature = tessera(
      { titolo: "Serrature", disegno: "aperture" },
      h(
        "div",
        { classe: "pl-righe" },
        ["lock.portone", "lock.garage"].map(function (id) {
          var chiusa = val(id) === "locked";
          return h(
            "div",
            { classe: "pl-riga" },
            h("span", { testo: nomeDi(id) }),
            h("button", {
              classe: "pl-modo" + (chiusa ? " pl-sì" : ""),
              type: "button",
              testo: chiusa ? "Chiusa" : "Aperta",
              onclick: function () {
                poni(id, chiusa ? "unlocked" : "locked");
                disegna();
              },
            }),
          );
        }),
      ),
    );

    /* Le telecamere: la prima è gratis, la seconda no. È il limite vero del
     * listino, mostrato dove si sente. */
    var tessereCamere = P.telecamere.map(function (c, i) {
      if (i === 0)
        return tessera(
          { titolo: c.name, disegno: "telecamere", lato: "dal vivo" },
          h(
            "div",
            { classe: "pl-camera" },
            h("div", { classe: "pl-camera-scena" }),
            h("span", { classe: "pl-camera-spia", testo: "● REC" }),
            h("span", {
              classe: "pl-camera-nota",
              testo: "qui, in casa, c'è il flusso della telecamera",
            }),
          ),
        );
      return tessera(
        { titolo: c.name, disegno: "telecamere" },
        lucchetto("La prima telecamera è gratis. Dalla seconda in poi si sblocca.", "19,99 €"),
      );
    });

    return griglia([tAllarme, tVarchi, tSerrature].concat(tessereCamere));
  }

  /* ── Stanze ───────────────────────────────────────────────────────────── */

  function sezioneStanze() {
    return griglia(
      P.stanze.map(function (s) {
        var luci = P.luci.filter(function (l) {
          return l.room_id === s.id;
        });
        var accese = luci.filter(function (l) {
          return acceso(l.entity);
        }).length;
        var clima = P.clima.filter(function (c) {
          return c.room_id === s.id;
        })[0];
        var tapp = P.tapparelle.filter(function (t) {
          return t.room_id === s.id;
        })[0];

        return tessera(
          {
            titolo: s.name,
            disegno: "stanze",
            lato: s.floor,
            classe: accese > 0 ? "pl-stanza-viva" : "",
          },
          h(
            "div",
            { classe: "pl-due" },
            h(
              "div",
              null,
              cifra(num(s.temp, 21).toFixed(1).replace(".", ","), "°C"),
              h("p", { classe: "pl-sotto", testo: "temperatura" }),
            ),
            h(
              "div",
              null,
              cifra(Math.round(num(s.hum, 45)), "%"),
              h("p", { classe: "pl-sotto", testo: "umidità" }),
            ),
          ),
          luci.length
            ? h(
                "div",
                { classe: "pl-riga" },
                h("span", {
                  testo:
                    luci.length === 1
                      ? "Una luce"
                      : luci.length + " luci" + (accese ? " · " + accese + " accese" : ""),
                }),
                interruttore(accese > 0, function () {
                  var spegni = accese > 0;
                  luci.forEach(function (l) {
                    poni(l.entity, spegni ? "off" : "on");
                  });
                  disegna();
                }),
              )
            : null,
          clima ? riga("Clima", MODI[val(clima.entity, "off")] || val(clima.entity)) : null,
          tapp
            ? riga("Tapparella", Number(attr(tapp.entity, "current_position", 100)) + " %")
            : null,
        );
      }),
    );
  }

  /* ── Elettrodomestici ─────────────────────────────────────────────────── */

  function sezioneElettrodomestici() {
    return griglia(
      P.elettrodomestici.map(function (a, i) {
        /* Il primo dispositivo collegato è gratis davvero, non una vetrina:
         * chi prova l'app deve vederla funzionare. Dal secondo si chiede. */
        if (i > 0)
          return tessera(
            { titolo: a.name, disegno: "elettrodomestici" },
            lucchetto(
              "Il primo dispositivo collegato è gratis. Dal secondo in poi si sblocca.",
              "19,99 €",
            ),
          );

        var su = a.control_entity ? acceso(a.control_entity) : false;
        var fase = a.state_entity ? val(a.state_entity, "—") : "—";
        var restano = a.remaining_entity ? num(a.remaining_entity, 0) : 0;

        return tessera(
          {
            titolo: a.name,
            disegno: "elettrodomestici",
            lato: fase,
            classe: su ? "pl-attivo" : "",
          },
          h(
            "div",
            { classe: "pl-due" },
            h(
              "div",
              null,
              cifra(a.power_entity ? num(a.power_entity, 0).toLocaleString("it-IT") : "0", "W"),
              h("p", { classe: "pl-sotto", testo: "adesso" }),
            ),
            h(
              "div",
              null,
              cifra(restano, "min"),
              h("p", { classe: "pl-sotto", testo: "alla fine" }),
            ),
          ),
          h(
            "div",
            { classe: "pl-riga" },
            h("span", {
              testo: "Oggi " + (a.daily_energy_entity ? num(a.daily_energy_entity, 0) : 0) + " kWh",
            }),
            a.control_entity
              ? interruttore(su, function () {
                  scambia(a.control_entity, "on", "off");
                })
              : null,
          ),
        );
      }),
    );
  }

  /* ── Le schermate che sono dell'app, non della plancia ────────────────── */

  function schermataDispositivi() {
    var perDominio = {};
    Object.keys(stato).forEach(function (id) {
      var d = id.split(".")[0];
      (perDominio[d] = perDominio[d] || []).push(id);
    });
    var NOMI = {
      sensor: "Sensori",
      binary_sensor: "Sensori acceso/spento",
      switch: "Interruttori",
      light: "Luci",
      climate: "Termostati",
      cover: "Tapparelle",
      lock: "Serrature",
      media_player: "Lettori",
      person: "Persone",
      camera: "Telecamere",
      vacuum: "Robot",
      calendar: "Calendari",
      todo: "Liste",
      weather: "Meteo",
      select: "Scelte",
      script: "Script",
      alarm_control_panel: "Allarme",
    };

    return h(
      "div",
      { classe: "pl-elenco" },
      h("p", {
        classe: "pl-nota",
        testo:
          "Tutte le entità della casa, divise per dominio, con gli " +
          "interruttori dove ha senso. È la schermata dell'app, e resta " +
          "gratis per sempre.",
      }),
      Object.keys(perDominio)
        .sort(function (a, b) {
          return perDominio[b].length - perDominio[a].length;
        })
        .map(function (d) {
          var quali = perDominio[d];
          return h(
            "details",
            { classe: "pl-dominio" },
            h(
              "summary",
              null,
              h("span", { testo: NOMI[d] || d }),
              h("span", { classe: "pl-riga-v", testo: quali.length }),
            ),
            h(
              "div",
              { classe: "pl-righe" },
              quali.slice(0, 12).map(function (id) {
                var comandabile = d === "light" || d === "switch" || d === "lock";
                return h(
                  "div",
                  { classe: "pl-riga" },
                  h("span", { testo: nomeDi(id) }),
                  comandabile
                    ? interruttore(acceso(id), function () {
                        if (d === "lock") poni(id, acceso(id) ? "locked" : "unlocked");
                        else poni(id, acceso(id) ? "off" : "on");
                        disegna();
                      })
                    : h("span", {
                        classe: "pl-riga-v",
                        testo:
                          val(id) +
                          (attr(id, "unit_of_measurement", "")
                            ? " " + attr(id, "unit_of_measurement", "")
                            : ""),
                      }),
                );
              }),
              quali.length > 12
                ? h("p", {
                    classe: "pl-nota",
                    testo: "e altre " + (quali.length - 12),
                  })
                : null,
            ),
          );
        }),
    );
  }

  function schermataAcquisti() {
    var L = window.LISTINO;
    if (!L) return h("div", null, "");

    function voce(a, grande) {
      return h(
        "div",
        { classe: "pl-acquisto" + (grande ? " pl-acquisto-grande" : "") },
        icona(a.disegno, 26),
        h(
          "div",
          { classe: "pl-acquisto-testo" },
          h("p", { classe: "pl-acquisto-titolo", testo: a.titolo }),
          h("p", { classe: "pl-sotto", testo: a.sotto }),
        ),
        h(
          "div",
          { classe: "pl-acquisto-prezzo" },
          h("span", { classe: "pl-acquisto-soldi", testo: a.soldi || "gratis" }),
          a.quando ? h("span", { classe: "pl-sotto", testo: a.quando }) : null,
        ),
      );
    }

    return h(
      "div",
      { classe: "pl-elenco" },
      h(
        "div",
        { classe: "pl-prova" },
        h("p", { classe: "pl-prova-titolo", testo: "La prova è accesa" }),
        h("p", {
          classe: "pl-sotto",
          testo:
            "Restano 11 giorni con tutto acceso. Nessuna carta, e non " +
            "l'hai chiesta tu: parte da sola al primo abbinamento.",
        }),
      ),
      h("h4", { classe: "pl-sottotitolo", testo: "Quello che non si paga" }),
      h(
        "ul",
        { classe: "pl-gratis" },
        L.sempreGratis.map(function (r) {
          return h("li", { testo: r });
        }),
      ),
      h("h4", { classe: "pl-sottotitolo", testo: "Il pacchetto" }),
      voce(L.casaCompleta, true),
      voce(L.casaCompletaAlMese),
      h("h4", { classe: "pl-sottotitolo", testo: "Oppure una cosa sola" }),
      h(
        "div",
        null,
        L.singoli.map(function (a) {
          return voce(a);
        }),
      ),
      h("p", {
        classe: "pl-nota",
        testo:
          "Si paga per casa, non per telefono: chi compra lo vede sul suo " +
          "telefono, sul tablet in cucina e su quello di sua moglie.",
      }),
    );
  }

  function inArrivo(titolo, cosa, quando) {
    return h(
      "div",
      { classe: "pl-arrivo" },
      h("span", { classe: "pl-arrivo-fase", testo: quando }),
      h("h4", { classe: "pl-arrivo-titolo", testo: titolo }),
      h("p", { classe: "pl-sotto", testo: cosa }),
    );
  }

  /* ── Le voci del menu e le sezioni ────────────────────────────────────── */

  var SEZIONI = [
    { chiave: "home", nome: "Home", disegno: "home", disegna: sezioneHome },
    {
      chiave: "energia",
      nome: "Energia",
      disegno: "energia",
      disegna: sezioneEnergia,
    },
    { chiave: "luci", nome: "Luci", disegno: "luci", disegna: sezioneLuci },
    { chiave: "clima", nome: "Clima", disegno: "clima", disegna: sezioneClima },
    {
      chiave: "temperatura",
      nome: "Temperatura",
      disegno: "temperatura",
      disegna: sezioneTemperatura,
    },
    {
      chiave: "finestre",
      nome: "Finestre",
      disegno: "tapparelle",
      disegna: sezioneFinestre,
    },
    {
      chiave: "sicurezza",
      nome: "Sicurezza",
      disegno: "sicurezza",
      disegna: sezioneSicurezza,
    },
    {
      chiave: "stanze",
      nome: "Stanze",
      disegno: "stanze",
      disegna: sezioneStanze,
    },
    {
      chiave: "elettrodomestici",
      nome: "Elettrodomestici",
      disegno: "elettrodomestici",
      disegna: sezioneElettrodomestici,
    },
  ];

  var VOCI = [
    { chiave: "plancia", nome: "Plancia", disegno: "home" },
    { chiave: "dispositivi", nome: "Dispositivi", disegno: "widget" },
    { chiave: "acquisti", nome: "Acquisti", disegno: "mie" },
    {
      chiave: "aiutanti",
      nome: "Aiutanti",
      disegno: "impostazioni",
      arrivo: "fase 2",
      cosa: "I sette aiutanti classici di Home Assistant — interruttori, numeri, testi, orari — creati dall'app, nativi, senza cercarli in fondo a un menu.",
    },
    {
      chiave: "zigbee",
      nome: "Zigbee",
      disegno: "runtime",
      arrivo: "fase 3",
      cosa: "Abbinare un dispositivo Zigbee dall'app: ZHA e Zigbee2MQTT tutti e due, dietro un'interfaccia sola.",
    },
    {
      chiave: "automazioni",
      nome: "Automazioni",
      disegno: "azioni",
      arrivo: "fase 4",
      cosa: "Il mago delle automazioni: si scrive un'automazione rispondendo a delle domande, e compare in Home Assistant come le altre.",
    },
  ];

  /* ── Il disegno ───────────────────────────────────────────────────────── */

  var vista = { voce: "plancia", sezione: "home" };
  var dentro = null; /* dove si disegna il contenuto */
  var barra = null; /* la fila delle sezioni della plancia */
  var menu = null;

  function vai(sezione) {
    vista.voce = "plancia";
    vista.sezione = sezione;
    disegna();
  }

  function sezioneOra() {
    for (var i = 0; i < SEZIONI.length; i++)
      if (SEZIONI[i].chiave === vista.sezione) return SEZIONI[i];
    return SEZIONI[0];
  }

  function disegna() {
    if (!dentro) return;
    viventi = [];
    dentro.innerHTML = "";

    /* Il menu dell'app */
    menu.innerHTML = "";
    VOCI.forEach(function (v) {
      menu.appendChild(
        h(
          "button",
          {
            classe:
              "pl-voce" +
              (v.chiave === vista.voce ? " pl-sì" : "") +
              (v.arrivo ? " pl-voce-arrivo" : ""),
            type: "button",
            onclick: function () {
              vista.voce = v.chiave;
              disegna();
            },
          },
          icona(v.disegno, 20),
          h("span", { testo: v.nome }),
          v.arrivo ? h("span", { classe: "pl-bollo", testo: v.arrivo }) : null,
        ),
      );
    });

    /* La fila delle sezioni: c'è solo dentro la plancia */
    barra.innerHTML = "";
    barra.hidden = vista.voce !== "plancia";
    if (vista.voce === "plancia")
      SEZIONI.forEach(function (s) {
        barra.appendChild(
          h(
            "button",
            {
              classe: "pl-scheda" + (s.chiave === vista.sezione ? " pl-sì" : ""),
              type: "button",
              onclick: function () {
                vista.sezione = s.chiave;
                disegna();
              },
            },
            icona(s.disegno, 18),
            h("span", { testo: s.nome }),
          ),
        );
      });

    if (vista.voce === "plancia") dentro.appendChild(sezioneOra().disegna());
    else if (vista.voce === "dispositivi") dentro.appendChild(schermataDispositivi());
    else if (vista.voce === "acquisti") dentro.appendChild(schermataAcquisti());
    else {
      var v = VOCI.filter(function (x) {
        return x.chiave === vista.voce;
      })[0];
      dentro.appendChild(inArrivo(v.nome, v.cosa, v.arrivo));
    }
  }

  /* ── Il battito ───────────────────────────────────────────────────────
   *
   * Ogni due secondi e mezzo i numeri si muovono di poco, come si muoverebbero
   * in casa. `ondina` è l'unico caso in cui la dimostrazione inventa qualcosa:
   * serve a non far vedere un numero fermo, che è la cosa che fa capire in un
   * secondo che si sta guardando una fotografia. */
  var ondina = 0;
  var passo = 0;
  setInterval(function () {
    passo += 1;
    ondina = Math.sin(passo / 3.1) * 0.5 + Math.sin(passo / 7.7) * 0.5;
    for (var i = 0; i < viventi.length; i++) viventi[i]();
  }, 2500);

  /* ── L'accensione ─────────────────────────────────────────────────────── */

  function accendi() {
    var dove = document.getElementById("plancia-viva");
    if (!dove) return;

    menu = h("nav", { classe: "pl-menu", "aria-label": "Le voci dell'app" });
    barra = h("div", { classe: "pl-barra", role: "tablist" });
    dentro = h("div", { classe: "pl-dentro" });

    var telaio = h(
      "div",
      { classe: "pl-telaio" },
      h(
        "div",
        { classe: "pl-cima" },
        h("div", { classe: "pl-semafori" }),
        h(
          "div",
          { classe: "pl-cima-nome" },
          h("img", {
            src: "statico/marchio.png",
            alt: "",
            width: 22,
            height: 22,
            classe: "pl-cima-marchio",
          }),
          h("span", { testo: "gdahome — Casa demo" }),
        ),
        h("span", { classe: "pl-spia", testo: "dentro casa · cifrato" }),
      ),
      h(
        "div",
        { classe: "pl-corpo" },
        h(
          "aside",
          { classe: "pl-fianco" },
          h(
            "div",
            { classe: "pl-casa" },
            icona("home", 22),
            h(
              "div",
              null,
              h("p", { classe: "pl-casa-nome", testo: "Casa demo" }),
              h("p", { classe: "pl-sotto", testo: "234 entità" }),
            ),
          ),
          menu,
        ),
        h("main", { classe: "pl-principale" }, barra, dentro),
      ),
    );

    dove.appendChild(telaio);
    disegna();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", accendi);
  else accendi();
})();
