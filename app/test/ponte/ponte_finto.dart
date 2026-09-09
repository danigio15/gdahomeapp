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

  /// Quando e' `true`, non risponde ai comandi: e' Home Assistant che tace.
  bool muto = false;

  /// Quando e' `false`, e' un ponte di prima della compressione: nella
  /// stretta di mano non dice di saper aprire il gzip, e non comprime.
  bool conosceIlGzip = true;

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
            ? {'type': 'auth_ok', 'ha_version': 'ponte'}
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
            tipo.startsWith('ponte/chat/'))) {
      _manda(presa, {'id': id, ..._segnalazione(detto)});
      return;
    }

    /* Le commissioni: quello che il ponte vero fa da se', senza passare da
     * Home Assistant. Qui si serve da una cartella in memoria. */
    if (detto['type'] == 'ponte/http') {
      _manda(presa, {'id': id, ..._commissione(detto)});
      return;
    }
    if (detto['type'] == 'ponte/plancia') {
      final sua = planciaDelPonte;
      _manda(
        presa,
        sua == null
            ? {
                'id': id,
                'type': 'result',
                'success': false,
                'error': {
                  'code': 'not_found',
                  'message': 'questo ponte non ha la plancia',
                },
              }
            : {'id': id, 'type': 'result', 'success': true, 'result': sua},
      );
      return;
    }
    _manda(presa, {
      'id': id,
      'type': 'result',
      'success': true,
      'result': switch (detto['type']) {
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

  /// Se questa casa passa da un centralino: senza, le segnalazioni non si
  /// spediscono, e il ponte lo dice.
  bool conIlCentralino = true;

  /// Le segnalazioni che il ponte finto tiene, nella forma del ponte vero.
  final List<Map<String, dynamic>> segnalazioni = [];
  Map<String, dynamic>? chat;
  int _prossimaSegnalazione = 7;

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
        if (una == null) return no('non_trovata', 'non e\' tua');
        return si(filo(una));
      case 'ponte/segnalazioni/rispondi':
        final una = trova(detto['numero']);
        if (una == null) return no('non_trovata', 'non e\' tua');
        (una['messaggi'] as List).add({
          'da': 'casa',
          'testo': detto['testo'],
          'il': '2026-09-08T12:00:00Z',
        });
        return si(filo(una));
      case 'ponte/segnalazioni/allega':
        final una = trova(detto['numero']);
        if (una == null) return no('non_trovata', 'non e\' tua');
        final allegato = _unAllegato(detto);
        if (allegato == null) return no('invalid_format', 'manca il file');
        if (allegato['byte'] as int > 10 * 1024 * 1024) {
          return no('troppo_grande', 'troppo grande');
        }
        allegati.add(allegato);
        (una['messaggi'] as List).add({
          'da': 'casa',
          'testo': '📷 ${allegato['nome']} (${allegato['byte']} B)',
          'il': '2026-09-08T12:30:00Z',
        });
        return si(filo(una));
      case 'ponte/chat/allega':
        final allegato = _unAllegato(detto);
        if (allegato == null) return no('invalid_format', 'manca il file');
        allegati.add(allegato);
        chat ??= {
          'numero': _prossimaSegnalazione++,
          'tipo': 'chat',
          'titolo': 'Chat di assistenza',
          'stato': 'aperta',
          'aperta_il': '2026-09-08T10:00:00Z',
          'url': 'https://github.com/x/y/issues/9',
          'messaggi': <Map<String, dynamic>>[],
        };
        (chat!['messaggi'] as List).add({
          'da': 'casa',
          'testo': '🎬 ${allegato['nome']} (${allegato['byte']} B)',
          'il': '2026-09-08T12:30:00Z',
        });
        return si(filo(chat!));
      case 'ponte/chat/leggi':
        return si({'chat': chat == null ? null : filo(chat!)});
      case 'ponte/chat/scrivi':
        chat ??= {
          'numero': _prossimaSegnalazione++,
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
    'titolo': 'DashboardModern',
    'istanza': 'ponte',
    'profilo': 'primary',
    'primario': true,
    'file': 294,
    'commit': '0f4180bbd69d5d1b7979c7ccb193280e77cfd000',
    'portata_il': '2026-09-08T17:54:08.396Z',
  };

  /// I file che il ponte finto sa servire con `ponte/http`: il percorso, il
  /// tipo e i byte. Sotto `/api/` si risponde con l'eco della richiesta.
  final Map<String, (String, List<int>)> file = {};

  /// Le commissioni arrivate, in ordine: serve a contare quante volte un
  /// file e' stato chiesto davvero.
  final List<Map<String, dynamic>> commissioni = [];

  Map<String, dynamic> _commissione(Map<String, dynamic> detto) {
    commissioni.add(detto);
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
      return _pacchetto(
        404,
        'text/plain',
        utf8.encode('qui non c\'e\' niente'),
      );
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
  }) => {
    'entity_id': id,
    'state': stato,
    'attributes': {
      if (nome != null) 'friendly_name': nome,
      if (unita != null) 'unit_of_measurement': unita,
      if (tipo != null) 'device_class': tipo,
    },
    'last_changed': cambiataIl ?? '2026-09-07T07:00:00.000000+00:00',
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
        await chiudi();
        return;
      }
      _ponte._detto(this, dentro);
      return;
    }

    final detto = jsonDecode(testo) as Map<String, dynamic>;
    if (!_ponte.conosceIlTelefono) {
      _presa.add(
        jsonEncode({
          'v': versioneDelProtocollo,
          'no': 'riabbina questo telefono',
          'riabbina': true,
        }),
      );
      await chiudi();
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
      /* Chi si sta abbinando la chiave del filo non ce l'ha ancora. */
      chiaveDelFilo: detto['abbina'] == true ? null : chiaveBuona,
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
    _ponte._manda(this, {'type': 'auth_required', 'ha_version': 'ponte'});
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
  Future<void> chiudi() async {
    _ponte.prese.remove(this);
    try {
      await _coda;
    } catch (_) {
      /* Quello che era in coda e' andato storto: si chiude lo stesso. */
    }
    try {
      await _presa.close();
    } catch (_) {
      /* Gia' chiusa. */
    }
  }
}
