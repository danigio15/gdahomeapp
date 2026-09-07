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
    if (detto['type'] == 'un_comando_che_non_esiste') {
      _manda(presa, {
        'id': id,
        'type': 'result',
        'success': false,
        'error': {'code': 'unknown_command', 'message': 'non so cosa sia'},
      });
      return;
    }
    _manda(presa, {
      'id': id,
      'type': 'result',
      'success': true,
      'result': detto['type'] == 'get_states' ? entita : null,
    });
  }

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
      }),
    );
    _busta = Busta(chiave, io: DaChi.casa);
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
