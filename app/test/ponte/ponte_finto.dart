/// Un ponte finto: finto nel comportamento, vero nel protocollo.
///
/// E' un server WebSocket di `dart:io` che fa le stesse **due** strette di
/// mano che fa il ponte vero: prima quella cifrata del portiere, poi, dentro,
/// quella di Home Assistant. Serve a provare il filo senza un telefono, senza
/// un emulatore e senza una casa: le prove girano in un secondo dentro la CI.
///
/// La cifratura qui e' vera, non finta. E' la stessa `cifra.dart` che usa
/// l'app, girata dalla parte della casa: se il telefono e la casa
/// smettessero di capirsi, queste prove diventerebbero rosse invece di
/// scoprirlo un utente. Che le due punte dicano gli **stessi byte** del Node
/// lo prova invece `cifra_test.dart`, coi vettori.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:gdahome/ponte/cifra.dart';
import 'package:gdahome/ponte/filo.dart' show segnoDelMucchio;
import 'package:gdahome/ponte/indirizzo.dart';

const String segnoBuono = 'un-segno-che-va-bene';

/// L'identificativo del telefono e la chiave del filo, come li darebbe un
/// abbinamento vero.
const String chiBuono = 'dm_unteleofonoqualunque';
const String chiaveBuona =
    '2b7e151628aed2a6abf7158809cf4f3c2b7e151628aed2a6abf7158809cf4f3c';

class PonteFinto {
  PonteFinto._(this._server);

  final HttpServer _server;
  final List<Map<String, dynamic>> arrivati = [];
  final List<TelefonoCollegato> prese = [];

  /// Quante volte qualcuno si e' collegato. Serve a provare la riconnessione.
  int collegamenti = 0;

  /// Quando e' `false`, il ponte rifiuta ogni segno: e' il telefono staccato
  /// dalla console.
  bool accettaIlSegno = true;

  /// Quando e' `false`, il ponte non riconosce piu' l'identificativo e la
  /// stretta di mano non parte nemmeno: e' il telefono staccato mentre era
  /// via, e la casa non ha piu' la sua chiave del filo.
  bool conosceIlTelefono = true;

  /// Insieme a `conosceIlTelefono = false`: la casa ha staccato il telefono
  /// ma della sua chiave del filo ha ancora memoria, e glielo dice dentro il
  /// cifrato invece che in chiaro.
  bool staccatoConLaChiave = false;

  /// Il codice di abbinamento vivo, come se la console l'avesse appena fatto.
  /// `null` vuol dire nessuno.
  String? codiceVivo;

  /// Quello che la casa dice di se', a chi si abbina: dove tornare.
  Map<String, dynamic>? ritorno;

  /// Quando e' `true`, la casa ha gia' tutti i telefoni che puo' avere, e chi
  /// si abbina se lo sente dire dentro il cifrato.
  bool casaPiena = false;

  /// Le conferme arrivate da chi si abbinava, aperte.
  final List<Map<String, dynamic>> conferme = [];

  /// Le prime parole in chiaro, come sono arrivate.
  final List<Map<String, dynamic>> strette = [];

  /// Quando e' `true`, non risponde ai comandi: e' Home Assistant che tace.
  bool muto = false;

  /// Quando e' `false`, e' un ponte di prima della compressione: nella
  /// stretta di mano non dice di saper aprire il gzip, e non comprime.
  bool conosceIlGzip = true;

  /// Quando c'e', chiude appena qualcuno si collega, dicendo questo: e' il
  /// centralino che accetta il filo e lo chiude subito perche' la casa non gli
  /// e' attaccata. Da fuori e' identico a un ponte vero che chiude in faccia.
  String? chiudeSubitoDicendo;

  static Future<PonteFinto> alza() async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final ponte = PonteFinto._(server);
    unawaited(ponte._ascolta());
    return ponte;
  }

  IndirizzoDelPonte get indirizzo =>
      IndirizzoDelPonte(casa: '127.0.0.1', porta: _server.port);

  Future<void> _ascolta() async {
    await for (final richiesta in _server) {
      if (!WebSocketTransformer.isUpgradeRequest(richiesta) ||
          richiesta.uri.path != '/casa') {
        richiesta.response.statusCode = HttpStatus.notFound;
        await richiesta.response.close();
        continue;
      }
      final presa = await WebSocketTransformer.upgrade(richiesta);
      collegamenti += 1;
      final perche = chiudeSubitoDicendo;
      if (perche != null) {
        await presa.close(WebSocketStatus.normalClosure, perche);
        continue;
      }
      final telefono = TelefonoCollegato(this, presa);
      prese.add(telefono);
      unawaited(telefono.avvia());
    }
  }

  void _detto(TelefonoCollegato presa, String grezzo) {
    final detto = jsonDecode(grezzo) as Map<String, dynamic>;

    if (detto['type'] == 'auth') {
      final buono = accettaIlSegno && detto['access_token'] == segnoBuono;
      _manda(
        presa,
        buono
            ? {'type': 'auth_ok', 'ha_version': 'gdahome'}
            : {'type': 'auth_invalid', 'message': 'segno non valido'},
      );
      if (!buono) unawaited(presa.chiudi());
      return;
    }

    arrivati.add(detto);
    if (muto) return;

    final id = detto['id'];
    /* Il colpetto, come lo fa Home Assistant: `ping` e si risponde `pong`.
     * Quando la casa e' muta non risponde nemmeno a questo, ed e' proprio
     * quello che serve a provare un filo morto senza chiusura. */
    if (detto['type'] == 'ping') {
      _manda(presa, {'id': id, 'type': 'pong'});
      return;
    }
    /* Un comando che Home Assistant non conosce: e' anche quello che risponde
     * una casa senza DashboardModern a `dashboardmodern/config/get`. */
    if (detto['type'] == 'un_comando_che_non_esiste' ||
        (detto['type'] == 'dashboardmodern/config/get' && !planciaInstallata)) {
      _manda(presa, {
        'id': id,
        'type': 'result',
        'success': false,
        'error': {'code': 'unknown_command', 'message': 'non so cosa sia'},
      });
      return;
    }
    /* Le segnalazioni e la chat: quello che il ponte vero porta al
     * centralino, qui sta in memoria. */
    final tipo = detto['type'];
    if (tipo is String &&
        (tipo.startsWith('ponte/segnalazioni/') ||
            tipo.startsWith('ponte/chat/') ||
            tipo.startsWith('ponte/console/') ||
            /* `ponte/quadro/` mancava, e il caso che gli risponde piu' sotto
             * era codice morto: una risposta scritta in una stanza dove la
             * domanda non entra. E' **lo stesso difetto** che il ponte vero
             * aveva su `ponte/quadro/stato`, rifatto qui dentro mentre lo si
             * provava — e la prova, non arrivando risposta, leggeva «questa
             * casa non ha nessun cruscotto», che e' la risposta giusta alla
             * domanda sbagliata.
             *
             * Chi aggiunge una famiglia di comandi la aggiunge qui. */
            tipo.startsWith('ponte/quadro/') ||
            tipo.startsWith('ponte/zigbee/') ||
            tipo.startsWith('ponte/aggiornamenti/'))) {
      chieste.add(detto);
      _manda(presa, {'id': id, ..._segnalazione(detto)});
      return;
    }

    /* Le commissioni: quello che il ponte vero fa da se', senza passare da
     * Home Assistant. Qui si serve da una cartella in memoria. */
    if (detto['type'] == 'ponte/http') {
      /* I file della plancia non si servono a chi non vede nessuna plancia:
       * fa cosi' il ponte vero, e serve che lo faccia anche questo, se no
       * l'unica strada rifiutata sarebbe quella principale. */
      final dove = detto['percorso'] as String? ?? '';
      if (nientePerTe && dove.startsWith('/dashboardmodern_static/')) {
        _manda(presa, {
          'id': id,
          'type': 'result',
          'success': false,
          'error': {
            'code': 'niente_per_te',
            'message': 'in questa casa non ci sono plance per la tua utenza',
          },
        });
        return;
      }
      _manda(presa, {'id': id, ..._commissione(detto)});
      return;
    }
    /* Il pacco: gli stessi file, piu' d'uno per volta. Come il ponte vero, si
     * riempie fino a [paccoFinoA] e poi si smette; quello che non ci sta non
     * torna, e chi l'ha chiesto lo richiede. */
    if (detto['type'] == 'ponte/http-molti') {
      final percorsi = detto['percorsi'];
      if (percorsi is! List || percorsi.isEmpty || percorsi.length > 40) {
        _manda(presa, {
          'id': id,
          'type': 'result',
          'success': false,
          'error': {'code': 'not_allowed', 'message': 'pacco non valido'},
        });
        return;
      }
      if (nientePerTe) {
        _manda(presa, {
          'id': id,
          'type': 'result',
          'success': false,
          'error': {
            'code': 'niente_per_te',
            'message': 'in questa casa non ci sono plance per la tua utenza',
          },
        });
        return;
      }
      pacchi.add(percorsi.map((quale) => '$quale').toList());
      final dentro = <String, dynamic>{};
      var quanto = 0;
      for (final uno in percorsi) {
        final quale = '$uno';
        if (!quale.startsWith('/dashboardmodern_static/')) {
          _manda(presa, {
            'id': id,
            'type': 'result',
            'success': false,
            'error': {
              'code': 'not_allowed',
              'message': 'nel pacco vanno solo i file della plancia',
            },
          });
          return;
        }
        if (dentro.containsKey(quale)) continue;
        final risposta = _unFile({'percorso': quale, 'metodo': 'GET'});
        dentro[quale] = risposta['result'];
        quanto += '${(risposta['result'] as Map)['corpo']}'.length;
        if (quanto >= paccoFinoA) break;
      }
      _manda(presa, {
        'id': id,
        'type': 'result',
        'success': true,
        'result': {'file': dentro},
      });
      return;
    }
    if (detto['type'] == 'ponte/plancia') {
      /* «Le plance ci sono, ma nessuna e' della tua utenza»: e' una risposta,
       * non un ponte senza plancia, e l'app non deve andare a cercarla fra i
       * pannelli di Home Assistant. */
      if (nientePerTe) {
        _manda(presa, {
          'id': id,
          'type': 'result',
          'success': false,
          'error': {
            'code': 'niente_per_te',
            'message': 'in questa casa non ci sono plance per la tua utenza',
          },
        });
        return;
      }
      final sua = planciaDelPonte;
      if (sua == null) {
        _manda(presa, {
          'id': id,
          'type': 'result',
          'success': false,
          'error': {
            'code': 'not_found',
            'message': 'questo ponte non ha la plancia',
          },
        });
        return;
      }
      /* Quale plancia, per chi ne ha piu' d'una. Senza, la prima — che e' la
       * risposta di sempre. Una che non c'e' e' un `not_found`, come nel ponte
       * vero: e' il caso che fa tornare l'app alla prima invece di restare su
       * una schermata vuota. */
      final voluto = detto['profilo'] as String? ?? '';
      final scelte = plance.where((una) => una['profilo'] == voluto);
      if (voluto.isNotEmpty && scelte.isEmpty) {
        _manda(presa, {
          'id': id,
          'type': 'result',
          'success': false,
          'error': {'code': 'not_found', 'message': 'quella plancia non c\'è'},
        });
        return;
      }
      final quale = voluto.isEmpty
          ? (plance.isEmpty ? null : plance.first)
          : scelte.first;
      _manda(presa, {
        'id': id,
        'type': 'result',
        'success': true,
        'result': {
          ...sua,
          if (quale != null) ...{
            'titolo': quale['titolo'],
            'istanza': quale['istanza'],
            'profilo': quale['profilo'],
            'primario': quale['primaria'],
          },
          'plance': plance,
        },
      });
      return;
    }
    _manda(presa, {
      'id': id,
      'type': 'result',
      'success': true,
      'result': switch (detto['type']) {
        'ponte/casa/dove' =>
          indirizziDiCasa == null
              ? null
              : {
                  'casa': 'la-casa-finta',
                  'centralino': null,
                  'indirizzi': [
                    for (final uno in indirizziDiCasa!) uno.toString(),
                  ],
                },
        'get_states' => entita,
        'get_panels' => pannelli ?? const <String, dynamic>{},
        'dashboardmodern/config/get' =>
          configurazione ?? {'profile': 'primary', 'snapshot': null},
        _ => null,
      },
    });
  }

  /// Quello che risponde `ponte/plancia`: la plancia dentro l'add-on. `null`
  /// e' un ponte che non ce l'ha, e dice di no.
  Map<String, dynamic>? planciaDelPonte = planciaNelPonte();

  /// Quando e' `true`, il ponte risponde che in questa casa non ci sono
  /// plance per chi chiede.
  bool nientePerTe = false;

  /// Quello che risponde `ponte/casa/dove`: dove sta questa casa sulla rete
  /// di casa. `null` e' un ponte di prima, che quel comando non lo conosce e
  /// risponde vuoto.
  List<IndirizzoDelPonte>? indirizziDiCasa;

  /// Le plance di questa casa. Una c'e' sempre — quella di sempre — e chi ne
  /// prova piu' d'una ne aggiunge a questa lista.
  final List<Map<String, dynamic>> plance = [
    {
      'profilo': 'primary',
      'titolo': 'gdahome',
      'istanza': 'gdahome',
      'primaria': true,
      'creata_il': 0,
    },
  ];

  /// Una plancia in piu', come la aggiunge il ponte vero: il cassetto ricavato
  /// dal titolo, e l'istanza col suo nome dietro.
  Map<String, dynamic> unaPlanciaInPiu(String titolo, {String? profilo}) {
    final quale =
        profilo ?? titolo.toLowerCase().replaceAll(RegExp('[^a-z0-9]+'), '-');
    final nuova = {
      'profilo': quale,
      'titolo': titolo,
      'istanza': 'gdahome-$quale',
      'primaria': false,
      'creata_il': 1,
    };
    plance.add(nuova);
    return nuova;
  }

  /// Se questa casa passa da un centralino: senza, le segnalazioni non si
  /// spediscono, e il ponte lo dice.
  bool conIlCentralino = true;

  /// Le segnalazioni che il ponte finto tiene, nella forma del ponte vero.
  final List<Map<String, dynamic>> segnalazioni = [];
  Map<String, dynamic>? chat;
  int _prossimaSegnalazione = 7;

  /// Cosa c'e' da aggiornare in casa, nella forma in cui risponde il ponte
  /// vero. Vuoto vuol dire «tutto aggiornato», che e' la risposta di quasi
  /// tutte le case quasi sempre.
  final List<Map<String, dynamic>> aggiornamenti = [];

  /// Le note lunghe che questa casa sa dare, per entita'.
  ///
  /// Una voce che c'e' con dentro `null` e' una casa che **dice no**: e' come
  /// si prova una Home Assistant che `update/release_notes` non lo conosce.
  final Map<String, String?> leNote = {};

  /// I loghi il cui indirizzo risponde male, per entita': il codice che
  /// risponde. Un 404 e' «non esiste»; un 502 e' un intoppo, e si riprova.
  final Map<String, int> iLoghiChePapperano = {};

  /// Quelli che sbagliano **una volta sola**: alla seconda domanda rispondono
  /// bene. E' come si guarda che il riprovare serva a qualcosa.
  final Set<String> iLoghiCheSbaglianoUnaVolta = {};

  /// I loghi che questa casa ha, per entita'. Chi non c'e' non ne ha uno.
  final Map<String, Uint8List> loghi = {};

  /// Se questo ponte sa rispondere sugli aggiornamenti.
  ///
  /// `false` e' un add-on piu' vecchio dell'app: non e' un guasto, e l'app
  /// deve dirlo com'e' invece di girare a vuoto.
  bool sagliAggiornamenti = true;

  /// Cosa gli e' stato chiesto di installare, e se gli e' stato chiesto di
  /// riavviare.
  final List<String> installati = [];
  bool riavviata = false;

  /// Se da questa casa si risponde alle chat delle altre.
  ///
  /// Nel ponte vero e' la chiave della console scritta nelle opzioni
  /// dell'add-on; qui e' un interruttore, perche' quello che cambia per l'app
  /// e' solo il si' o il no.
  bool laConsole = false;

  /* Se questa casa e' di chi installa, e il codice che il ponte le darebbe.
   * Il codice il ponte vero lo manda **solo a chi amministra**: qui si decide
   * riga per riga, che e' quello che serve alle prove. */
  bool lInstallatore = false;
  String ilCodiceDelCruscotto = '';

  /* ─── La rete Zigbee (#54) ────────────────────────────────────────────── */

  /// Che rete c'e': `''` per nessuna, `'zha'` o `'zigbee2mqtt'`.
  ///
  /// Sono le parole che manda il ponte vero (`Z2M` in `ponte/src/zigbee.js`),
  /// non quelle che l'app si e' data per comodita'. Qui c'era scritto `'z2m'`,
  /// e un ponte finto che parla la lingua inventata da chi lo interroga non
  /// prova niente: e' cosi' che la voce «Zigbee» e' rimasta invisibile per due
  /// versioni in tutte le case con Zigbee2MQTT, con le prove verdi.
  String laReteZigbee = '';

  /// Per quanto si apre, quando non lo dice chi la apre.
  int quantoRestaApertaZigbee = 240;

  /// Chi e' entrato da quando e' aperta. Le prove ce li mettono a mano: qui
  /// non c'e' nessuna rete vera da cui possa entrare qualcuno.
  final List<Map<String, dynamic>> entratiInZigbee = [];

  /// Chi e' stato rinominato, e come. Serve a provare che il nome e' arrivato
  /// dove doveva, invece di fidarsi della risposta.
  final Map<String, String> rinominatiInZigbee = {};

  int _zigbeeApertaFinoA = 0;

  int _adesso() => DateTime.now().millisecondsSinceEpoch ~/ 1000;

  int _quantoRestaZigbee() {
    final resta = _zigbeeApertaFinoA - _adesso();
    return resta > 0 ? resta : 0;
  }

  /// La coda di chi risponde: le linee, e per ognuna il suo filo.
  final List<Map<String, dynamic>> conversazioni = [];
  final Map<String, List<Map<String, dynamic>>> fili = {};
  int _prossimoDellaConsole = 1;

  /// Una casa chiede aiuto: nasce una linea, o si aggiunge al suo filo.
  void unaCasaChiedeAiuto(String linea, String testo, {String nome = ''}) {
    final riga = {
      'id': _prossimoDellaConsole++,
      'da': 'casa',
      'testo': testo,
      'scritto_il': 1757328000,
    };
    (fili[linea] ??= []).add(riga);
    final quale = conversazioni.cast<Map<String, dynamic>?>().firstWhere(
      (una) => una!['id'] == linea,
      orElse: () => null,
    );
    if (quale == null) {
      conversazioni.add({
        'id': linea,
        'nome': nome,
        'versione': 'plancia 1.4.19 ponte 0.19.0',
        'ha': '',
        'lingua': 'it',
        'non_letti': 1,
        'ultimo': testo,
        'ultimo_il': 1757328000,
      });
    } else {
      quale['non_letti'] = (quale['non_letti'] as int) + 1;
      quale['ultimo'] = testo;
    }
  }

  /// Il manutentore risponde a una segnalazione, o alla chat.
  void rispondeIlManutentore(int numero, String testo) {
    final filo = numero == chat?['numero']
        ? chat
        : segnalazioni.cast<Map<String, dynamic>?>().firstWhere(
            (una) => una!['numero'] == numero,
            orElse: () => null,
          );
    (filo!['messaggi'] as List).add({
      'da': 'manutentore',
      'testo': testo,
      'il': '2026-09-08T11:00:00Z',
    });
  }

  /// Gli allegati arrivati, per le prove: nome, tipo, quanti byte.
  final allegati = <Map<String, Object>>[];

  static Map<String, Object>? _unAllegato(Map<String, dynamic> detto) {
    final inBase64 = detto['byte'];
    if (inBase64 is! String || inBase64.isEmpty) return null;
    try {
      return {
        'nome': detto['nome']?.toString() ?? 'allegato',
        'tipo': detto['tipo']?.toString() ?? '',
        'byte': base64.decode(inBase64).length,
      };
    } on FormatException {
      return null;
    }
  }

  Map<String, dynamic> _segnalazione(Map<String, dynamic> detto) {
    Map<String, dynamic> no(String codice, String spiegazione) => {
      'type': 'result',
      'success': false,
      'error': {'code': codice, 'message': spiegazione},
    };
    Map<String, dynamic> si(Object? risultato) => {
      'type': 'result',
      'success': true,
      'result': risultato,
    };
    if (!conIlCentralino) {
      if (detto['type'] == 'ponte/segnalazioni/elenco') {
        return si({'spedibili': false, 'aggiornato_il': 0, 'segnalazioni': []});
      }
      return no('senza_centralino', 'nessun centralino');
    }
    Map<String, dynamic> filo(Map<String, dynamic> una) => {
      ...una,
      'messaggi': List.of(una['messaggi'] as List),
    };
    Map<String, dynamic>? trova(Object? numero) => segnalazioni
        .cast<Map<String, dynamic>?>()
        .firstWhere((una) => una!['numero'] == numero, orElse: () => null);
    switch (detto['type']) {
      case 'ponte/segnalazioni/elenco':
        return si({
          'spedibili': true,
          'aggiornato_il': 1,
          'segnalazioni': [
            for (final una in segnalazioni)
              {...una, 'messaggi': (una['messaggi'] as List).length},
          ],
        });
      case 'ponte/segnalazioni/crea':
        final titolo = detto['titolo']?.toString().trim() ?? '';
        if (titolo.isEmpty) return no('manca_il_titolo', 'Manca il titolo.');
        final una = {
          'numero': _prossimaSegnalazione++,
          'tipo': detto['tipo'],
          'titolo': titolo,
          'stato': 'aperta',
          'aperta_il': '2026-09-08T10:00:00Z',
          'url': 'https://github.com/x/y/issues/1',
          'diagnostica': detto['diagnostica'],
          'messaggi': [
            {
              'da': 'casa',
              'testo': detto['corpo'],
              'il': '2026-09-08T10:00:00Z',
            },
          ],
        };
        segnalazioni.insert(0, una);
        return si(filo(una));
      case 'ponte/segnalazioni/leggi':
        final una = trova(detto['numero']);
        if (una == null) return no('non_trovata', 'non è tua');
        return si(filo(una));
      case 'ponte/segnalazioni/rispondi':
        final una = trova(detto['numero']);
        if (una == null) return no('non_trovata', 'non è tua');
        (una['messaggi'] as List).add({
          'da': 'casa',
          'testo': detto['testo'],
          'il': '2026-09-08T12:00:00Z',
        });
        return si(filo(una));
      case 'ponte/segnalazioni/allega':
        final una = trova(detto['numero']);
        if (una == null) return no('non_trovata', 'non è tua');
        final allegato = _unAllegato(detto);
        if (allegato == null) return no('invalid_format', 'manca il file');
        if (allegato['byte'] as int > 10 * 1024 * 1024) {
          return no('troppo_grande', 'troppo grande');
        }
        allegati.add(allegato);
        /* Il disegno lo sceglie il tipo, come fa il centralino: una foto o un
         * video non si distinguono dal nome. */
        final disegno = (allegato['tipo']! as String).startsWith('image/')
            ? '📷'
            : '🎬';
        (una['messaggi'] as List).add({
          'da': 'casa',
          'testo': '$disegno ${allegato['nome']} (${allegato['byte']} B)',
          'il': '2026-09-08T12:30:00Z',
        });
        return si(filo(una));
      /* Alla chat non si allega niente: quella passa parole, e il ponte lo
       * dice con una frase invece di «non conosco». */
      case 'ponte/chat/allega':
        return no(
          'not_supported',
          'La chat di assistenza passa parole. Una foto si allega a una '
              'segnalazione.',
        );
      /* ─── La rete Zigbee (#54) ─────────────────────────────────────────
       *
       * Come nel ponte vero: `apri` e `chiudi` non rispondono «no» a una casa
       * senza rete — rispondono «si'» con dentro `fatto: false` e il motivo. E'
       * il caso che il cliente deve intercettare, e qui si puo' provare. */
      case 'ponte/zigbee/stato':
        return si({
          'quale': laReteZigbee,
          'aperta': _zigbeeApertaFinoA > _adesso(),
          'restano': _quantoRestaZigbee(),
          'entrati': entratiInZigbee,
        });
      case 'ponte/zigbee/apri':
        if (laReteZigbee.isEmpty) {
          return si({
            'fatto': false,
            'perche': 'questa casa non ha una rete Zigbee',
          });
        }
        final quanto = (detto['secondi'] as int?) ?? quantoRestaApertaZigbee;
        _zigbeeApertaFinoA = _adesso() + quanto;
        entratiInZigbee.clear();
        return si({'fatto': true, 'quale': laReteZigbee, 'restano': quanto});
      case 'ponte/zigbee/chiudi':
        _zigbeeApertaFinoA = 0;
        if (laReteZigbee.isEmpty) {
          return si({
            'fatto': false,
            'perche': 'questa casa non ha una rete Zigbee',
          });
        }
        return si({'fatto': true});
      case 'ponte/zigbee/rinomina':
        final quale = (detto['dispositivo'] as String? ?? '').trim();
        final come = (detto['nome'] as String? ?? '').trim();
        if (quale.isEmpty) {
          return si({'fatto': false, 'perche': 'quale dispositivo?'});
        }
        if (come.isEmpty) {
          return si({'fatto': false, 'perche': 'il nome e\' vuoto'});
        }
        for (final uno in entratiInZigbee) {
          if (uno['id'] == quale) uno['nome'] = come;
        }
        rinominatiInZigbee[quale] = come;
        return si({
          'fatto': true,
          'dispositivo': {
            'id': quale,
            'nome': come,
            'marca': 'IKEA',
            'modello': 'TRADFRI bulb E27',
            'tramite': laReteZigbee == 'zha' ? 'zha' : 'mqtt',
            /* Le entita' che ha portato dentro: senza, il passo dopo — il
             * foglietto della plancia — non saprebbe cosa proporre. */
            'entita':
                entratiInZigbee.firstWhere(
                  (uno) => uno['id'] == quale,
                  orElse: () => <String, dynamic>{},
                )['entita'] ??
                const <Map<String, String>>[],
          },
        });
      case 'ponte/quadro/stato':
        return si({
          'installatore': lInstallatore,
          'dove': lInstallatore ? 'https://quadro.gdahome.org/console/' : '',
          if (ilCodiceDelCruscotto.isNotEmpty) 'chiave': ilCodiceDelCruscotto,
          'gestore': false,
          'doveGestione': '',
        });
      case 'ponte/chat/stato':
        return si({
          'enabled': true,
          'console': laConsole,
          'opened': chat != null,
          'name': '',
          'unread': 0,
          'preview': '',
          'written_at': 0,
          'messages': chat == null ? 0 : (chat!['messaggi'] as List).length,
        });
      /* I quattro sportelli di chi risponde. Senza la chiave della console il
       * ponte vero risponde «forbidden» — non «non conosco»: la porta esiste,
       * e in questa casa non si apre. */
      case 'ponte/console/coda':
      case 'ponte/console/apri':
      case 'ponte/console/rispondi':
      case 'ponte/console/butta':
        if (!laConsole) {
          return no('forbidden', 'Questa casa non risponde alle chat.');
        }
        final linea = detto['linea']?.toString() ?? '';
        switch (detto['type']) {
          case 'ponte/console/coda':
            return si({'conversations': List.of(conversazioni)});
          case 'ponte/console/apri':
            /* Aperta vuol dire letta, come nel centralino vero. */
            for (final una in conversazioni) {
              if (una['id'] == linea) una['non_letti'] = 0;
            }
            return si({'messages': List.of(fili[linea] ?? const [])});
          case 'ponte/console/rispondi':
            final riga = {
              'id': _prossimoDellaConsole++,
              'da': 'console',
              'testo': detto['testo'],
              'scritto_il': 1757328600,
            };
            (fili[linea] ??= []).add(riga);
            return si({'message': riga});
          default:
            conversazioni.removeWhere((una) => una['id'] == linea);
            fili.remove(linea);
            return si({'dropped': true});
        }
      case 'ponte/aggiornamenti/elenco':
      case 'ponte/aggiornamenti/installa':
      case 'ponte/aggiornamenti/riavvia':
      case 'ponte/aggiornamenti/logo':
      case 'ponte/aggiornamenti/note':
        if (!sagliAggiornamenti) {
          return no('unknown_command', 'non conosco ${detto['type']}');
        }
        switch (detto['type']) {
          case 'ponte/aggiornamenti/elenco':
            return si({'aggiornamenti': aggiornamenti});
          /* Le note lunghe, come le manda il ponte vero: solo per chi ha
           * detto di saperle, e vuote sono una risposta. */
          case 'ponte/aggiornamenti/note':
            final chi = detto['entity_id']?.toString() ?? '';
            final voce = aggiornamenti.cast<Map<String, dynamic>?>().firstWhere(
              (uno) => uno!['entita'] == chi,
              orElse: () => null,
            );
            if (voce == null) {
              return no('not_found', 'quell\'aggiornamento non c\'è più');
            }
            if (voce['leNote'] != true) {
              return no(
                'not_found',
                'quell\'aggiornamento non ha note da leggere',
              );
            }
            if (leNote.containsKey(chi) && leNote[chi] == null) {
              return no('note_non_date', 'non conosco update/release_notes');
            }
            return si({
              'note': leNote[chi] ?? '',
              'versione': voce['a']?.toString() ?? '',
            });
          /* Il logo di un aggiornamento, come lo manda il ponte vero: la
           * stessa busta dei file di casa, e non compresso. Chi non ne ha uno
           * riceve un no, che non e' un guasto. */
          case 'ponte/aggiornamenti/logo':
            final chi = detto['entity_id']?.toString() ?? '';
            /* Un indirizzo che risponde male: si dice com'e', e non si finge
             * che quel logo non esista. */
            final storto = iLoghiChePapperano[chi];
            if (storto != null) {
              /* Una volta sola, se chi prova lo chiede: cosi' si guarda che
               * la seconda domanda vada a buon fine. */
              if (iLoghiCheSbaglianoUnaVolta.contains(chi)) {
                iLoghiCheSbaglianoUnaVolta.remove(chi);
                iLoghiChePapperano.remove(chi);
              }
              return si({'stato': storto, 'tipo': 'text/plain', 'corpo': ''});
            }
            final byte = loghi[chi];
            if (byte == null) {
              return no('not_found', 'questo aggiornamento non ha un logo');
            }
            return si({
              'stato': 200,
              'tipo': 'image/png',
              'corpo': base64Encode(byte),
            });
          case 'ponte/aggiornamenti/riavvia':
            riavviata = true;
            return si({'avviato': true});
          default:
            final quale = detto['entity_id']?.toString() ?? '';
            final voce = aggiornamenti.cast<Map<String, dynamic>?>().firstWhere(
              (uno) => uno!['entita'] == quale,
              orElse: () => null,
            );
            if (voce == null) {
              return no('not_found', 'quell\'aggiornamento non c\'è più');
            }
            installati.add(quale);
            /* Come il ponte vero: da qui in poi quella riga risulta in corso,
             * e l'app se lo fa dire dall'elenco invece di ricordarselo. */
            voce['inCorso'] = true;
            return si({
              'avviato': true,
              'gia': false,
              'stacca': voce['stacca'] == true,
            });
        }
      case 'ponte/chat/leggi':
        return si({'chat': chat == null ? null : filo(chat!)});
      case 'ponte/chat/scrivi':
        /* Come la disegna `comeLaVuoleLApp()` nel ponte: numero zero e
         * nessun indirizzo, perche' questa conversazione non e' una pagina
         * di GitHub — sta nel centralino della chat e in casa. */
        chat ??= {
          'numero': 0,
          'tipo': 'chat',
          'titolo': 'Chat di assistenza',
          'stato': 'aperta',
          'aperta_il': '2026-09-08T10:00:00Z',
          'url': '',
          'messaggi': <Map<String, dynamic>>[],
        };
        (chat!['messaggi'] as List).add({
          'da': 'casa',
          'testo': detto['testo'],
          'il': '2026-09-08T12:00:00Z',
        });
        return si(filo(chat!));
      default:
        return no('unknown_command', 'non conosco ${detto['type']}');
    }
  }

  /// I pannelli che risponde `get_panels`. `null` e' una casa senza
  /// DashboardModern: risponde lo stesso, ma senza quel pannello.
  Map<String, dynamic>? pannelli = pannelliConLaPlancia();

  /// La plancia come la descrive il ponte vero con `ponte/plancia`.
  static Map<String, dynamic> planciaNelPonte({
    String base = '/dashboardmodern_static/ponte1234',
  }) => {
    'base': base,
    'impronta': base.split('/').last,
    'varianti': ['dashboard-en.html', 'dashboard.html'],
    'titolo': 'gdahome',
    'istanza': 'gdahome',
    'profilo': 'primary',
    'primario': true,
    'file': 294,
    'commit': '0f4180bbd69d5d1b7979c7ccb193280e77cfd000',
    'portata_il': '2026-09-08T17:54:08.396Z',
  };

  /// I file che il ponte finto sa servire con `ponte/http`: il percorso, il
  /// tipo e i byte. Sotto `/api/` si risponde con l'eco della richiesta.
  final Map<String, (String, List<int>)> file = {};

  /// Le domande arrivate su questa strada, in ordine.
  ///
  /// Le segnalazioni, la chat, la console e gli aggiornamenti non passano da
  /// `_commissione`, e quindi non finivano in `commissioni`: una prova che
  /// contava li' contava **zero** e diceva verde per la ragione sbagliata.
  /// Quello che si vuole sapere spesso non e' cosa si vede, ma quante volte
  /// l'app ha chiesto — se un logo che non e' arrivato si richiede, se uno che
  /// non c'e' non si richiede piu'.
  final List<Map<String, dynamic>> chieste = [];

  /// Le commissioni arrivate, in ordine: serve a contare quante volte un
  /// file e' stato chiesto davvero.
  final List<Map<String, dynamic>> commissioni = [];

  /// I pacchi arrivati, in ordine: ognuno con i percorsi che conteneva.
  final List<List<String>> pacchi = [];

  /// Quanto ci sta in un pacco, in byte di base64. Nel ponte vero sono
  /// trecentottantaquattro kilobyte; nelle prove si mette piccolo per vedere
  /// cosa succede a quelli che non ci stanno.
  int paccoFinoA = 384 * 1024;

  Map<String, dynamic> _commissione(Map<String, dynamic> detto) {
    commissioni.add(detto);
    return _unFile(detto);
  }

  /// Un file, senza segnarlo fra le commissioni: e' quello che serve al pacco,
  /// che di commissioni ne e' una sola per quaranta file.
  Map<String, dynamic> _unFile(Map<String, dynamic> detto) {
    final percorso = detto['percorso'] as String? ?? '';
    final soloIlPercorso = percorso.split('?').first;
    if (percorso.startsWith('/api/')) {
      final corpo = detto['corpo'];
      final eco = jsonEncode({
        'metodo': detto['metodo'],
        'percorso': percorso,
        'tipo': detto['tipo'],
        'corpo': corpo is String ? utf8.decode(base64.decode(corpo)) : null,
      });
      return _pacchetto(
        200,
        'application/json; charset=utf-8',
        utf8.encode(eco),
      );
    }
    final trovato = file[soloIlPercorso];
    if (trovato == null) {
      return _pacchetto(404, 'text/plain', utf8.encode('qui non c\'è niente'));
    }
    return _pacchetto(200, trovato.$1, trovato.$2);
  }

  /// Come lo impacchetta il ponte vero: il testo viaggia compresso.
  static Map<String, dynamic> _pacchetto(
    int stato,
    String tipo,
    List<int> corpo,
  ) {
    final testo =
        tipo.startsWith('text/') ||
        tipo.startsWith('application/javascript') ||
        tipo.startsWith('application/json') ||
        tipo.startsWith('image/svg');
    return {
      'type': 'result',
      'success': true,
      'result': {
        'stato': stato,
        'tipo': tipo,
        if (testo && corpo.length >= 32) ...{
          'corpo': base64.encode(gzip.encode(corpo)),
          'compresso': 'gzip',
        } else
          'corpo': base64.encode(Uint8List.fromList(corpo)),
      },
    };
  }

  /// I pannelli di una casa con DashboardModern, come li da' `get_panels`.
  static Map<String, dynamic> pannelliConLaPlancia({
    String base = '/dashboardmodern_static/abc123',
  }) => {
    'lovelace': {
      'component_name': 'lovelace',
      'url_path': 'lovelace',
      'config': null,
    },
    'dashboardmodern': {
      'component_name': 'custom',
      'url_path': 'dashboardmodern',
      'title': 'DashboardModern',
      'config': {
        'entry_ids': ['e1'],
        'instance_id': 'e1',
        'config_profile': 'primary',
        'title': 'DashboardModern',
        'primary': true,
        'static_base': base,
        'legacy_variants': ['dashboard-en.html', 'dashboard.html'],
        '_panel_custom': {
          'name': 'dashboardmodern-panel-abc123',
          'embed_iframe': false,
          'trust_external': false,
          'module_url': '$base/panel.js',
        },
      },
    },
  };

  /// Se in questa casa c'e' DashboardModern. Senza, `config/get` non esiste.
  bool planciaInstallata = true;

  /// Quello che risponde `dashboardmodern/config/get`: la risposta intera,
  /// come la da' l'integrazione. `null` vuol dire una plancia mai
  /// configurata.
  Map<String, dynamic>? configurazione;

  /// Scrive solo se dall'altra parte c'e' ancora qualcuno.
  ///
  /// Serve perche' un telefono che se ne va chiude il filo *mentre* il ponte
  /// gli sta rispondendo — chiudere l'app dopo aver disdetto una
  /// sottoscrizione fa esattamente questo. Un ponte vero quella risposta la
  /// perde e non se ne accorge; qui senza guardia diventa un errore che fa
  /// fallire una prova che non c'entra niente.
  void _manda(TelefonoCollegato presa, Map<String, dynamic> cosa) =>
      presa.manda(jsonEncode(cosa));

  /// Quello che il ponte finto risponde a `get_states`. Le prove lo cambiano.
  List<Map<String, dynamic>> entita = [];

  /// Comodo per costruire un'entita' senza scrivere ogni volta la stessa roba.
  static Map<String, dynamic> unaEntita(
    String id,
    String stato, {
    String? nome,
    String? unita,
    String? tipo,
    String? cambiataIl,
    String? aggiornataIl,
  }) => {
    'entity_id': id,
    'state': stato,
    'attributes': {
      if (nome != null) 'friendly_name': nome,
      if (unita != null) 'unit_of_measurement': unita,
      if (tipo != null) 'device_class': tipo,
    },
    'last_changed': cambiataIl ?? '2026-09-07T07:00:00.000000+00:00',
    /* Home Assistant le manda tutte e due, e non sono la stessa cosa: la
     * prima si sposta solo quando cambia il **valore**, la seconda ogni volta
     * che lo stato si riscrive. Chi misura quanto ci mette un dato ad
     * arrivare guarda la seconda. */
    'last_updated':
        aggiornataIl ?? cambiataIl ?? '2026-09-07T07:00:00.000000+00:00',
  };

  /// Manda un `state_changed` come lo manderebbe Home Assistant.
  void cambia(int id, String entita, Map<String, dynamic>? nuovo) {
    evento(id, {
      'event_type': 'state_changed',
      'data': {'entity_id': entita, 'new_state': nuovo},
    });
  }

  /// Manda un evento a chi si e' sottoscritto con quel numero.
  void evento(int id, Map<String, dynamic> cosa) {
    for (final presa in List.of(prese)) {
      _manda(presa, {'id': id, 'type': 'event', 'event': cosa});
    }
  }

  /// Piu' eventi in **una busta sola**, com'e' fatto il mucchio che il ponte
  /// manda quando il filo passa dal centralino: il suo segno, e poi un
  /// messaggio per riga.
  void mucchio(int id, List<Map<String, dynamic>> eventi) {
    final righe = eventi.map(
      (cosa) => jsonEncode({'id': id, 'type': 'event', 'event': cosa}),
    );
    for (final presa in List.of(prese)) {
      presa.manda('$segnoDelMucchio${righe.join('\n')}');
    }
  }

  /// Butta giu' il filo senza avvisare: e' l'ascensore, la galleria, il
  /// passaggio dal Wi-Fi al 4G.
  Future<void> buttaGiu() async {
    for (final presa in List.of(prese)) {
      await presa.chiudi();
    }
    prese.clear();
  }

  Future<void> spegni() async {
    await buttaGiu();
    await _server.close(force: true);
  }
}

/* ─── Un telefono, dalla parte della casa ─────────────────────────────────── */

/// Fa la stretta di mano del portiere e poi imbusta tutto.
///
/// E' `ponte/src/portiere.js` scritto in Dart. Le due non condividono una
/// riga, e va bene cosi': se divergessero, le prove del filo lo direbbero
/// subito, ed e' proprio quello il lavoro di questo file.
class TelefonoCollegato {
  TelefonoCollegato(this._ponte, this._presa);

  final PonteFinto _ponte;
  final WebSocket _presa;

  Busta? _busta;
  Future<void> _coda = Future<void>.value();

  Future<void> avvia() async {
    _presa.listen(
      (dynamic grezzo) {
        final testo = grezzo as String;
        _coda = _coda.then((_) => _arrivato(testo));
      },
      onDone: () => _ponte.prese.remove(this),
      onError: (Object _) => _ponte.prese.remove(this),
    );
  }

  Future<void> _arrivato(String testo) async {
    if (_busta != null) {
      final String dentro;
      try {
        dentro = await _busta!.apri(testo);
      } on BustaGuasta {
        /* Abbinandosi, una conferma che non si apre e' un codice sbagliato, e
         * il no va in chiaro: come `ponte/src/portiere.js`. */
        if (_abbinando) {
          _presa.add(
            jsonEncode({
              'v': versioneDelProtocollo,
              'no': 'codice sbagliato',
              'motivo': 'codice',
            }),
          );
        }
        unawaited(chiudi());
        return;
      }
      if (_abbinando) {
        await _laConferma(dentro);
        return;
      }
      _ponte._detto(this, dentro);
      return;
    }

    final detto = jsonDecode(testo) as Map<String, dynamic>;
    _ponte.strette.add(detto);

    if (detto.containsKey('abbina')) {
      await _perAbbinare(detto);
      return;
    }

    if (!_ponte.conosceIlTelefono && !_ponte.staccatoConLaChiave) {
      _presa.add(
        jsonEncode({
          'v': versioneDelProtocollo,
          'no': 'riabbina questo telefono',
          'riabbina': true,
        }),
      );
      unawaited(chiudi());
      return;
    }

    final mia = await coppiaEffimera();
    final sua = base64.decode(detto['mia'] as String);
    final chiave = await chiaveDiSessione(
      miaPrivata: mia.privata,
      suaPubblica: sua,
      delTelefono: sua,
      dellaCasa: mia.pubblica,
      apertura: base64.decode(detto['apertura'] as String),
      chiaveDelFilo: chiaveBuona,
    );
    _presa.add(
      jsonEncode({
        'v': versioneDelProtocollo,
        'pronto': true,
        'mia': mia.inBase64,
        if (_ponte.conosceIlGzip) 'gzip': true,
      }),
    );
    /* Come il ponte vero: si comprime verso chi ha detto di saper aprire. */
    _busta = Busta(
      chiave,
      io: DaChi.casa,
      comprime: _ponte.conosceIlGzip && detto['gzip'] == true,
    );
    if (!_ponte.conosceIlTelefono) {
      /* Staccato, e detto dove lo puo' dire solo chi ha la chiave. */
      _ponte._manda(this, {
        'type': 'auth_invalid',
        'message': 'questo telefono è stato staccato da questa casa',
      });
      unawaited(chiudi());
      return;
    }
    _ponte._manda(this, {'type': 'auth_required', 'ha_version': 'gdahome'});
  }

  /* ─── L'abbinamento, come lo fa il portiere ─────────────────────────── */

  /* Qui dentro si e' nella coda di chi riceve: chiudere **aspettando** la
   * coda vorrebbe dire aspettare se stessi. Si chiude senza aspettare, e la
   * chiusura parte comunque dopo quello che si e' messo in coda. */

  bool _abbinando = false;
  String _telefono = '';
  String _casa = '';

  Future<void> _perAbbinare(Map<String, dynamic> detto) async {
    void no(String perche, String motivo) {
      _presa.add(
        jsonEncode({
          'v': versioneDelProtocollo,
          'no': perche,
          'motivo': motivo,
        }),
      );
      unawaited(chiudi());
    }

    if (detto['abbina'] != versioneDellAbbinamento) {
      no('aggiorna l\'app', 'aggiorna');
      return;
    }
    final codice = _ponte.codiceVivo;
    if (codice == null) {
      no('nessun codice di abbinamento è attivo', 'nessuno');
      return;
    }
    final mia = await coppiaEffimera();
    final sua = base64.decode(detto['mia'] as String);
    final chiave = await chiaveDiSessione(
      miaPrivata: mia.privata,
      suaPubblica: sua,
      delTelefono: sua,
      dellaCasa: mia.pubblica,
      apertura: base64.decode(detto['apertura'] as String),
      codice: codice,
    );
    _abbinando = true;
    _telefono = detto['mia'] as String;
    _casa = mia.inBase64;
    _presa.add(
      jsonEncode({
        'v': versioneDelProtocollo,
        'pronto': true,
        'mia': mia.inBase64,
      }),
    );
    _busta = Busta(chiave, io: DaChi.casa);
  }

  Future<void> _laConferma(String dentro) async {
    final detto = jsonDecode(dentro) as Map<String, dynamic>;
    _ponte.conferme.add(detto);
    if (detto['t'] != 'conferma' ||
        detto['telefono'] != _telefono ||
        detto['casa'] != _casa) {
      _ponte._manda(this, {
        't': 'no',
        'perche': 'conferma sbagliata',
        'motivo': 'codice',
      });
      unawaited(chiudi());
      return;
    }
    if (_ponte.casaPiena) {
      _ponte._manda(this, {
        't': 'no',
        'perche': 'sono gia\' abbinati 10 dispositivi',
        'motivo': 'telefoni',
      });
      unawaited(chiudi());
      return;
    }
    _ponte.codiceVivo = null;
    _ponte._manda(this, {
      't': 'ecco',
      'segno': segnoBuono,
      'chiave': chiaveBuona,
      'dispositivo': {'id': chiBuono, 'nome': detto['nome']},
      'ritorno': _ponte.ritorno,
    });
    unawaited(chiudi());
  }

  /// Scrive solo se dall'altra parte c'e' ancora qualcuno.
  ///
  /// Serve perche' un telefono che se ne va chiude il filo *mentre* il ponte
  /// gli sta rispondendo — chiudere l'app dopo aver disdetto una
  /// sottoscrizione fa esattamente questo. Un ponte vero quella risposta la
  /// perde e non se ne accorge; qui senza guardia diventa un errore che fa
  /// fallire una prova che non c'entra niente.
  void manda(String testo) {
    _coda = _coda.then((_) async {
      final busta = _busta;
      if (busta == null || _presa.readyState != WebSocket.open) return;
      try {
        _presa.add(await busta.chiudi(testo));
      } catch (_) {
        /* Chiusa fra il controllo e la scrittura. */
      }
    });
  }

  /// Chiude **dopo** aver finito di scrivere quello che era in coda.
  ///
  /// Serve perche' il ponte dice `auth_invalid` e subito dopo chiude, e
  /// imbustare e' asincrono: senza questa attesa la chiusura arriverebbe prima
  /// del messaggio, il telefono vedrebbe solo un filo caduto, e riproverebbe
  /// all'infinito su un segno che non vale piu'. Il ponte vero non ha il
  /// problema — imbusta di corsa — ma il telefono deve funzionare con tutti e
  /// due, e questa e' la parte in cui si guarda.
  Future<void> chiudi({String? perche}) async {
    _ponte.prese.remove(this);
    try {
      await _coda;
    } catch (_) {
      /* Quello che era in coda e' andato storto: si chiude lo stesso. */
    }
    try {
      await _presa.close(WebSocketStatus.normalClosure, perche);
    } catch (_) {
      /* Gia' chiusa. */
    }
  }
}
