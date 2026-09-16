/* Una Home Assistant finta, dentro la pagina.
 *
 * Serve a una cosa sola, ed è la ragione per cui questo sito esiste: far
 * vedere **la plancia vera**. Non una riproduzione, non un filmato, non delle
 * fotografie — quella di DashboardModern, gli stessi file che stanno
 * nell'add-on, che girano qui dentro e rispondono al dito.
 *
 * Il problema è che una plancia vuole una casa dietro, e un sito non ce l'ha:
 * non può aprire un WebSocket verso Home Assistant, e non ci sarebbe nessuna
 * Home Assistant a cui aprirlo. Allora la casa la si mette nella pagina.
 *
 * ## Come ci si attacca
 *
 * Non c'è niente da forzare: la plancia ha **un gancio fatto apposta**. Il suo
 * preludio (`legacy/bridge-prelude.js`) guarda se qualcuno ha già messo un
 * `__DASHBOARDMODERN_BRIDGE_WS__` nella finestra, e se c'è lo usa al posto del
 * WebSocket vero. È lo stesso gancio con cui l'app sul telefono le cuce
 * addosso il proprio filo: non è un WebSocket, è un oggetto finto messo nella
 * pagina insieme alle altre premesse. Qui dall'altra parte del gancio, invece
 * del filo verso casa, c'è questo file.
 *
 * Perciò basta che questo script giri **prima** del preludio: ci pensa
 * `strumenti/porta-nel-sito.mjs`, che infila i due `<script>` nella copia di
 * `dashboard.html` che finisce nel sito.
 *
 * ## Cosa risponde
 *
 * Il protocollo è quello vero di Home Assistant, e le risposte sono le stesse
 * di `collaudo/casa-finta.js` — la Home Assistant finta contro cui girano le
 * prove dal vivo. Quello che lì è un server in Node, qui è un oggetto in
 * pagina: cambia chi consegna le buste, non cosa c'è dentro.
 *
 * Due comandi non sono di Home Assistant ma del **ponte**, e vanno risposti
 * come li risponde lui, se no la plancia si apre senza configurazione:
 *
 *  - `dashboardmodern/config/get` — la configurazione della casa, nella forma
 *    di `Configurazione.leggi()`;
 *  - `dashboardmodern/config/set` — la plancia riscrive la sua configurazione
 *    appena parte, e vuole sapere com'è andata. Qui valgono le stesse regole
 *    del ponte (`ponte/src/configurazione.js`): i valori si **sostituiscono**,
 *    una scrittura vuota sopra una plancia configurata si **rifiuta**, e la
 *    revisione cresce e basta.
 *
 * ## Cosa è finto, e va detto
 *
 * Dall'altra parte non c'è nessuna casa. Gli stati stanno in una mappa qui
 * dentro: premere un interruttore la cambia e l'evento torna indietro come
 * tornerebbe da Home Assistant, quindi la plancia si muove per davvero — ma
 * non si accende niente da nessuna parte, e ricaricando la pagina la casa
 * torna com'era.
 *
 * La casa è quella del collaudo, `collaudo/casa-demo.json`: duecentotrentacinque
 * entità, sette stanze, un fotovoltaico con la batteria, sei elettrodomestici,
 * un'auto, una piscina. Le stesse contro cui girano le prove.
 */

(function () {
  "use strict";

  var DEMO = window.CASA_DEMO;
  if (!DEMO || !DEMO.entita) {
    console.error("[casa-in-pagina] manca la casa demo: carica prima casa.js");
    return;
  }

  var VERSIONE_HA = "2025.1.0";

  /* ── Gli stati ──────────────────────────────────────────────────────────
   *
   * Le date nel file sono ferme al giorno in cui la casa finta è stata
   * scritta: senza rimetterle a adesso, la plancia direbbe «visto 40 giorni
   * fa» accanto a ogni persona. Si fa lo stesso in `collaudo/casa-finta.js`,
   * e per la stessa ragione. */
  var ADESSO = new Date(Date.now() - 90000).toISOString();
  var entita = new Map();
  DEMO.entita.forEach(function (una) {
    entita.set(una.entity_id, {
      entity_id: una.entity_id,
      state: una.state,
      attributes: una.attributes || {},
      last_changed: ADESSO,
      last_updated: ADESSO,
      context: { id: "demo", parent_id: null, user_id: null },
    });
  });

  /* ── La configurazione, come la tiene il ponte ───────────────────────── */

  var PROFILO = (DEMO.configurazione && DEMO.configurazione.profile) || "primary";
  var scatto = copia((DEMO.configurazione && DEMO.configurazione.snapshot) || {});
  if (!scatto.values) scatto.values = {};

  function copia(che) {
    return JSON.parse(JSON.stringify(che));
  }

  function pubblico() {
    return {
      revision: scatto.revision || 0,
      updated_at: scatto.updated_at || Date.now(),
      keys_revision: scatto.keys_revision || 0,
      writer_generation: scatto.writer_generation || 0,
      reset: Boolean(scatto.reset),
      values: scatto.values,
    };
  }

  function letta() {
    return {
      profile: PROFILO,
      requested_profile: null,
      snapshot: pubblico(),
      recoverable: [],
      profiles: [PROFILO],
    };
  }

  /* «Configurata» vuol dire: ha almeno una chiave con qualcosa dentro. Il
   * ponte lo guarda per non farsi azzerare la plancia da una scrittura vuota
   * arrivata mentre la pagina si stava ancora caricando, e qui serve per la
   * stessa ragione: la plancia riscrive la sua configurazione appena parte, e
   * la prima volta la manda ancora mezza vuota. */
  function eConfigurata(valori) {
    if (!valori) return false;
    for (var chiave in valori) {
      if (!Object.prototype.hasOwnProperty.call(valori, chiave)) continue;
      var valore = valori[chiave];
      if (valore === null || valore === undefined || valore === "") continue;
      if (valore === "{}" || valore === "[]" || valore === "null") continue;
      return true;
    }
    return false;
  }

  function scritta(detto) {
    var mandato = detto.snapshot;
    if (!mandato || typeof mandato !== "object" || !mandato.values)
      return { errore: "invalid_format", detto: "manca lo scatto" };

    var valori = mandato.values;
    var stato = "saved";

    if (detto.reset !== true && eConfigurata(scatto.values) && !eConfigurata(valori)) {
      /* Il rifiuto non è un errore: la plancia se lo aspetta, e riprova con
       * quello che ha quando ce l'ha. */
      stato = "refused-empty";
    } else if (JSON.stringify(scatto.values) === JSON.stringify(valori)) {
      stato = "unchanged";
      if (mandato.writer_generation > (scatto.writer_generation || 0))
        scatto.writer_generation = mandato.writer_generation;
      if (mandato.keys_revision > (scatto.keys_revision || 0))
        scatto.keys_revision = mandato.keys_revision;
    } else {
      scatto = {
        revision: (scatto.revision || 0) + 1,
        updated_at: mandato.updated_at || Date.now(),
        keys_revision: mandato.keys_revision || 0,
        writer_generation: mandato.writer_generation || 0,
        reset: detto.reset === true,
        values: valori,
      };
    }

    return { status: stato, profile: PROFILO, snapshot: pubblico(), recoverable: [] };
  }

  /* ── Gli appuntamenti e le cose da fare ─────────────────────────────────
   *
   * Non stanno negli stati: lo stato di un `calendar.*` dice soltanto se c'è
   * qualcosa in corso, quello di un `todo.*` soltanto quante voci restano. Le
   * voci vere si chiedono coi servizi, e solo con `return_response`. Le date
   * sono relative a oggi, se no dopo una settimana l'agenda della
   * dimostrazione sarebbe tutta scaduta. */
  function fraQuanto(giorni, ore, minuti) {
    var quando = new Date();
    quando.setDate(quando.getDate() + giorni);
    quando.setHours(ore, minuti || 0, 0, 0);
    return quando;
  }
  function scritto(data) {
    function due(n) {
      return String(n).padStart(2, "0");
    }
    return (
      data.getFullYear() +
      "-" +
      due(data.getMonth() + 1) +
      "-" +
      due(data.getDate()) +
      "T" +
      due(data.getHours()) +
      ":" +
      due(data.getMinutes()) +
      ":00"
    );
  }

  var EVENTI = {
    "calendar.famiglia": [
      {
        summary: "Cena dai nonni",
        start: { dateTime: scritto(fraQuanto(0, 20, 0)) },
        end: { dateTime: scritto(fraQuanto(0, 22, 30)) },
      },
      {
        summary: "Partita di Marco",
        start: { dateTime: scritto(fraQuanto(2, 15, 30)) },
        end: { dateTime: scritto(fraQuanto(2, 17, 0)) },
      },
    ],
    "calendar.lavoro": [
      {
        summary: "Riunione settimanale",
        start: { dateTime: scritto(fraQuanto(1, 9, 30)) },
        end: { dateTime: scritto(fraQuanto(1, 10, 30)) },
      },
    ],
  };

  var COSE = {
    "todo.spesa": [
      { uid: "1", summary: "Pane", status: "needs_action" },
      { uid: "2", summary: "Latte", status: "needs_action" },
      { uid: "3", summary: "Caffè", status: "needs_action" },
      { uid: "4", summary: "Detersivo", status: "needs_action" },
    ],
    "todo.casa": [
      { uid: "1", summary: "Cambiare il filtro della VMC", status: "needs_action" },
      { uid: "2", summary: "Controllare la pressione della caldaia", status: "needs_action" },
    ],
  };

  /* ── La presa finta ─────────────────────────────────────────────────────
   *
   * Si comporta come un WebSocket quanto basta a chi la usa: `send`,
   * `close`, gli `on*` e `addEventListener`, le quattro costanti di stato.
   * Non eredita da `WebSocket` apposta — non si può costruirne uno senza
   * aprire una connessione. */
  var prese = [];
  var sottoscrizioni = new Map();

  function Presa(url) {
    var me = this;
    this.url = String(url || "");
    this.readyState = 0;
    this.protocol = "";
    this.extensions = "";
    this.bufferedAmount = 0;
    this.binaryType = "blob";
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this._ascolti = {};
    prese.push(this);
    /* L'apertura arriva dopo, come arriverebbe da una rete: chi chiama
     * `new WebSocket()` si aspetta di poter attaccare i suoi ascoltatori
     * prima che succeda qualcosa. */
    setTimeout(function () {
      if (me.readyState !== 0) return;
      me.readyState = 1;
      me._grida("open", {});
      me._manda({ type: "auth_required", ha_version: VERSIONE_HA });
    }, 0);
  }
  Presa.CONNECTING = Presa.prototype.CONNECTING = 0;
  Presa.OPEN = Presa.prototype.OPEN = 1;
  Presa.CLOSING = Presa.prototype.CLOSING = 2;
  Presa.CLOSED = Presa.prototype.CLOSED = 3;

  Presa.prototype.addEventListener = function (che, fn) {
    if (typeof fn !== "function") return;
    (this._ascolti[che] = this._ascolti[che] || []).push(fn);
  };
  Presa.prototype.removeEventListener = function (che, fn) {
    var elenco = this._ascolti[che];
    if (!elenco) return;
    var dove = elenco.indexOf(fn);
    if (dove >= 0) elenco.splice(dove, 1);
  };
  Presa.prototype.dispatchEvent = function (fatto) {
    this._grida(fatto.type, fatto);
    return true;
  };
  Presa.prototype._grida = function (che, fatto) {
    fatto.type = che;
    fatto.target = this;
    fatto.currentTarget = this;
    var me = this;
    var suo = this["on" + che];
    if (typeof suo === "function") {
      try {
        suo.call(this, fatto);
      } catch (errore) {
        console.error("[casa-in-pagina]", errore);
      }
    }
    (this._ascolti[che] || []).slice().forEach(function (fn) {
      try {
        fn.call(me, fatto);
      } catch (errore) {
        console.error("[casa-in-pagina]", errore);
      }
    });
  };
  Presa.prototype._manda = function (oggetto) {
    if (this.readyState !== 1) return;
    this._grida("message", { data: JSON.stringify(oggetto) });
  };
  Presa.prototype.close = function (codice, motivo) {
    if (this.readyState === 3) return;
    this.readyState = 3;
    sottoscrizioni.delete(this);
    this._grida("close", { code: codice || 1000, reason: motivo || "", wasClean: true });
  };
  Presa.prototype.send = function (testo) {
    var detto;
    try {
      detto = JSON.parse(testo);
    } catch (errore) {
      return;
    }
    var me = this;
    /* La risposta non arriva nello stesso giro: da una rete non arriverebbe,
     * e chi aspetta una risposta sincrona qui si romperebbe in casa vera. */
    setTimeout(function () {
      rispondi(me, detto);
    }, 0);
  };

  /* ── Le risposte ────────────────────────────────────────────────────── */

  function rispondi(presa, detto) {
    if (presa.readyState !== 1) return;

    function si(risultato) {
      presa._manda({
        id: detto.id,
        type: "result",
        success: true,
        result: risultato === undefined ? null : risultato,
      });
    }
    function no(codice, messaggio) {
      presa._manda({
        id: detto.id,
        type: "result",
        success: false,
        error: { code: codice, message: messaggio },
      });
    }

    if (detto.type === "auth") {
      /* Nessun segno da controllare: la plancia ospitata ne manda uno finto
       * apposta (`__dashboardmodern_hosted__`), e qui non c'è niente da
       * proteggere. */
      presa._manda({ type: "auth_ok", ha_version: VERSIONE_HA });
      return;
    }

    switch (detto.type) {
      case "ping":
        presa._manda({ id: detto.id, type: "pong" });
        return;

      case "get_states":
        si(Array.from(entita.values()));
        return;

      case "get_panels":
        /* Una casa senza DashboardModern installata: la plancia non sta in
         * Home Assistant, la porta il ponte. */
        si({ lovelace: { component_name: "lovelace", url_path: "lovelace", config: null } });
        return;

      case "get_config":
        si({
          location_name: "Casa demo",
          latitude: 45.4642,
          longitude: 9.19,
          elevation: 120,
          unit_system: { length: "km", mass: "kg", temperature: "°C", volume: "L" },
          time_zone: "Europe/Rome",
          currency: "EUR",
          language: "it",
          version: VERSIONE_HA,
          components: ["frontend", "dashboardmodern"],
          config_dir: "/config",
          state: "RUNNING",
        });
        return;

      /* ── I due comandi del ponte ─────────────────────────────────────── */

      case "dashboardmodern/config/get":
        si(letta());
        return;

      case "dashboardmodern/config/set": {
        var esito = scritta(detto);
        if (esito.errore) no(esito.errore, esito.detto);
        else si(esito);
        return;
      }

      case "dashboardmodern/config/restore":
        /* Qui non si tiene nessuna storia: non c'è niente da rimettere a
         * posto, e la plancia se lo aspetta. */
        si(letta());
        return;

      case "dashboardmodern/clima/timer/list":
        si([]);
        return;
      case "dashboardmodern/clima/timer/set":
      case "dashboardmodern/clima/timer/clear":
        si({ ok: true });
        return;

      case "dashboardmodern/integrations/catalog":
        si({ integrations: [], entities: [] });
        return;

      case "dashboardmodern/www/list":
        si([]);
        return;

      /* Le segnalazioni e la chat escono dalla plancia e diventano dell'app:
       * il ponte risponde con una frase invece che con un errore, e qui si fa
       * uguale. */
      case "dashboardmodern/tickets/list":
        si([]);
        return;

      case "get_services":
      case "history/history_during_period":
      case "recorder/statistics_during_period":
        si({});
        return;

      case "config/area_registry/list":
      case "config/floor_registry/list":
      case "config/device_registry/list":
      case "config/entity_registry/list":
      case "recorder/list_statistic_ids":
        si([]);
        return;

      case "frontend/get_user_data":
        si({ value: null });
        return;
      case "frontend/set_user_data":
        si();
        return;

      case "auth/sign_path":
        si({ path: detto.path });
        return;

      case "subscribe_events":
        sottoscrizioni.set(presa, detto.id);
        si();
        return;
      case "unsubscribe_events":
        sottoscrizioni.delete(presa);
        si();
        return;

      case "call_service":
        chiamaIlServizio(detto, si);
        return;

      default:
        si();
    }
  }

  function chiamaIlServizio(detto, si) {
    var bersaglio = (detto.target && detto.target.entity_id) || null;
    var quali = [].concat(bersaglio || []).filter(Boolean);
    var primo = quali[0];
    var dati = detto.service_data || {};

    /* I servizi che rispondono: si chiamano con `return_response`, ed è
     * l'unico modo di sapere cosa c'è in un calendario o in una lista. */
    if (detto.domain === "calendar" && detto.service === "get_events") {
      var risposta = {};
      quali.forEach(function (id) {
        risposta[id] = { events: EVENTI[id] || [] };
      });
      si({ response: risposta });
      return;
    }
    if (detto.domain === "todo" && detto.service === "get_items") {
      var cose = {};
      quali.forEach(function (id) {
        cose[id] = { items: COSE[id] || [] };
      });
      si({ response: cose });
      return;
    }
    if (detto.domain === "todo" && detto.service === "update_item") {
      var voci = COSE[primo] || [];
      var quale = voci.filter(function (una) {
        return una.uid === dati.item || una.summary === dati.item;
      })[0];
      if (quale) quale.status = dati.status || "completed";
      var restano = voci.filter(function (una) {
        return una.status !== "completed";
      }).length;
      muovi(primo, String(restano));
      si();
      return;
    }

    si();

    /* Il comando cambia davvero lo stato, e il cambiamento torna indietro:
     * così nella plancia l'interruttore si muove per conto suo, come farebbe
     * in casa. */
    quali.forEach(function (id) {
      var una = entita.get(id);
      if (!una) return;
      var dominio = id.split(".")[0];
      var attributi = null;
      var nuovo = null;

      switch (detto.service) {
        case "turn_on":
          nuovo = dominio === "cover" ? "open" : dominio === "lock" ? "unlocked" : "on";
          break;
        case "turn_off":
          nuovo = dominio === "cover" ? "closed" : dominio === "lock" ? "locked" : "off";
          break;
        case "toggle":
          nuovo = una.state === "on" ? "off" : "on";
          break;
        case "lock":
          nuovo = "locked";
          break;
        case "unlock":
          nuovo = "unlocked";
          break;
        case "open_cover":
          nuovo = "open";
          attributi = { current_position: 100 };
          break;
        case "close_cover":
          nuovo = "closed";
          attributi = { current_position: 0 };
          break;
        case "stop_cover":
          nuovo = una.state;
          break;
        case "set_cover_position":
          nuovo = Number(dati.position) > 0 ? "open" : "closed";
          attributi = { current_position: Number(dati.position) || 0 };
          break;
        case "set_temperature":
          nuovo = una.state;
          attributi = { temperature: Number(dati.temperature) };
          break;
        case "set_hvac_mode":
          nuovo = dati.hvac_mode || una.state;
          break;
        case "set_fan_mode":
          nuovo = una.state;
          attributi = { fan_mode: dati.fan_mode };
          break;
        case "select_option":
          nuovo = dati.option || una.state;
          break;
        case "volume_set":
          nuovo = una.state;
          attributi = { volume_level: Number(dati.volume_level) };
          break;
        case "media_play":
          nuovo = "playing";
          break;
        case "media_pause":
          nuovo = "paused";
          break;
        case "alarm_disarm":
          nuovo = "disarmed";
          break;
        case "alarm_arm_home":
          nuovo = "armed_home";
          break;
        case "alarm_arm_away":
          nuovo = "armed_away";
          break;
        case "start":
          nuovo = "cleaning";
          attributi = { status: "In pulizia" };
          break;
        case "pause":
          nuovo = "paused";
          attributi = { status: "In pausa" };
          break;
        case "return_to_base":
          nuovo = "returning";
          attributi = { status: "Sta tornando" };
          break;
        default:
          nuovo = una.state;
      }

      if (dominio === "light" && detto.service === "turn_on" && dati.brightness !== undefined)
        attributi = Object.assign(attributi || {}, { brightness: Number(dati.brightness) });
      if (dominio === "light" && detto.service === "turn_on" && dati.brightness_pct !== undefined)
        attributi = Object.assign(attributi || {}, {
          brightness: Math.round((Number(dati.brightness_pct) / 100) * 255),
        });

      muovi(id, nuovo, attributi);
    });
  }

  function muovi(id, nuovo, attributi) {
    var vecchia = entita.get(id);
    if (!vecchia) return;
    var una = {
      entity_id: id,
      state: nuovo === null || nuovo === undefined ? vecchia.state : String(nuovo),
      attributes: Object.assign({}, vecchia.attributes, attributi || {}),
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      context: { id: "demo", parent_id: null, user_id: null },
    };
    entita.set(id, una);
    racconta(vecchia, una);
  }

  function racconta(vecchia, nuova) {
    sottoscrizioni.forEach(function (numero, presa) {
      if (presa.readyState !== 1) return;
      presa._manda({
        id: numero,
        type: "event",
        event: {
          event_type: "state_changed",
          data: { entity_id: nuova.entity_id, old_state: vecchia, new_state: nuova },
          origin: "LOCAL",
          time_fired: nuova.last_updated,
          context: nuova.context,
        },
      });
    });
  }

  /* ── Il gancio ──────────────────────────────────────────────────────────
   *
   * `__DASHBOARDMODERN_BRIDGE_WS__` è quello che il preludio cerca; gli altri
   * due sono per il codice che non passa dal preludio. */
  window.__DASHBOARDMODERN_BRIDGE_WS__ = Presa;
  window.__DASHBOARDMODERN_BRIDGED__ = true;
  window.WebSocket = Presa;

  /* Una finestra su quello che c'è dentro, per il collaudo: `guarda-il-sito.mjs`
   * legge di qui per controllare che un comando dato alla plancia vera sia
   * arrivato davvero fin qui. */
  window.__CASA_IN_PAGINA__ = {
    entita: entita,
    scatto: function () {
      return pubblico();
    },
    quante: entita.size,
  };
})();
