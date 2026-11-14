/// Riaprire l'app e trovare la plancia collegata, senza ricaricarla.
///
/// «Con l'ultimo aggiornamento quando riapro l'app resta il puntino rosso,
/// devo fare refresh della plancia.» Il pallino rosso in cima alla plancia
/// dice che la sua presa non ha `auth_ok`. Dentro l'app quella presa va al
/// servitore del telefono, che la cuce sul filo con la casa
/// (`plancia/cucitura.dart`): `auth_ok` arriva solo quando il filo c'e'.
///
/// Qui c'e' tutto quello che sta nel telefono — il collegamento, il
/// servitore, la cucitura, un ponte finto dall'altra parte — e la pagina e'
/// un `WebSocket` di `dart:io` che fa quello che fa la plancia: si collega,
/// si abbona agli stati, e quando l'app le dice che il filo c'e'
/// (`Collegamento.filoTornato`, che `schermate/plancia_vera.dart` gira alla
/// pagina come `gdahome:filo`) si ricollega se non lo e'.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/plancia/servitore.dart';
import 'package:gdahome/ponte/sonda.dart';

import '../ponte/ponte_finto.dart';

/// La plancia, vista dal suo WebSocket.
class _Pagina {
  _Pagina(this._servitore);

  final Servitore _servitore;
  WebSocket? _presa;

  /// Il pallino: verde quando la presa di adesso ha avuto `auth_ok`.
  bool verde = false;

  /// Quante prese ha aperto: una plancia ricaricata ricomincerebbe da capo,
  /// questa no.
  int prese = 0;

  /// Gli eventi degli stati arrivati, con l'entita'.
  final eventi = <String>[];

  var _numero = 0;

  Future<void> collegati() async {
    final vecchia = _presa;
    _presa = null;
    await vecchia?.close();
    prese += 1;
    final presa = await WebSocket.connect(
      'ws://127.0.0.1:${_servitore.porta}/api/websocket',
      headers: {'cookie': 'gdahome=${_servitore.chiave}'},
    );
    _presa = presa;
    presa.listen(
      (dynamic testo) {
        if (!identical(_presa, presa)) return;
        final detto = jsonDecode(testo as String) as Map<String, dynamic>;
        if (detto['type'] == 'auth_ok') {
          verde = true;
          /* Come il runtime al suo `auth_ok`: gli stati, e l'abbonamento. */
          presa.add(jsonEncode({'id': ++_numero, 'type': 'get_states'}));
          presa.add(
            jsonEncode({
              'id': ++_numero,
              'type': 'subscribe_events',
              'event_type': 'state_changed',
            }),
          );
        }
        if (detto['type'] == 'event') {
          final dati = (detto['event'] as Map?)?['data'] as Map?;
          eventi.add('${dati?['entity_id']}');
        }
      },
      onDone: () {
        if (identical(_presa, presa)) verde = false;
      },
    );
  }

  /// `gdahome:filo`: da scollegata ci si ricollega, subito.
  Future<void> ilFiloCE() async {
    if (verde) return;
    await collegati();
  }

  Future<void> chiudi() async {
    final presa = _presa;
    _presa = null;
    await presa?.close();
  }
}

void main() {
  late PonteFinto ponte;
  late Collegamento collegamento;
  late Servitore servitore;
  late Directory cartella;

  setUp(() async {
    ponte = await PonteFinto.alza();
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();
    await archivio.aggiungi(
      nome: 'Casa al lago',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      inCasa: ponte.indirizzo,
    );
    collegamento = Collegamento(
      archivio: archivio,
      sonda: Sonda(
        attesa: const Duration(milliseconds: 200),
        vantaggio: const Duration(milliseconds: 40),
        bussa: (dove) async => dove == ponte.indirizzo.salute,
      ),
    );
    cartella = await Directory.systemTemp.createTemp('il-filo-torna-');
    servitore = Servitore(filo: () => collegamento.filo, cartella: cartella);
    await servitore.alza();
  });

  tearDown(() async {
    await collegamento.chiudi();
    await servitore.spegni();
    await ponte.spegni();
    await cartella.delete(recursive: true);
  });

  test('il collegamento dice quando il filo è di nuovo dentro, una volta per '
      'ritorno', () async {
    var dette = 0;
    final ascolto = collegamento.filoTornato.listen((_) => dette += 1);
    await collegamento.apri();
    await _finoA(() => dette == 1);

    await collegamento.riposa();
    await Future<void>.delayed(const Duration(milliseconds: 100));
    expect(dette, 1, reason: 'a riposo non si dice niente');

    collegamento.sveglia();
    await _finoA(() => dette == 2, entro: const Duration(seconds: 5));

    /* Rifatto apposta — tirando giu' per aggiornare, la strada di casa —
     * conta come un ritorno. */
    await collegamento.apri(forza: true);
    await _finoA(() => dette == 3, entro: const Duration(seconds: 5));
    await Future<void>.delayed(const Duration(milliseconds: 200));
    expect(dette, 3, reason: 'lo stesso filo dentro non si ridice');
    await ascolto.cancel();
  });

  test('app in tasca, filo chiuso, ripresa: la plancia torna collegata e '
      'riabbonata agli stati senza ricaricarsi', () async {
    final pagina = _Pagina(servitore);
    await collegamento.apri();
    await pagina.collegati();
    await _finoA(() => pagina.verde);
    /* Da qui in poi l'app gira alla pagina ogni ritorno del filo, come fa
     * `schermate/plancia_vera.dart`. */
    final ascolto = collegamento.filoTornato.listen(
      (_) => unawaited(pagina.ilFiloCE()),
    );

    // In tasca: il filo va a riposo, e la cucitura chiude la presa.
    await collegamento.riposa();
    await _finoA(() => !pagina.verde);

    // Il WebView torna davanti prima dell'app, e la plancia prova subito:
    // la presa si apre, ma il filo non c'e' ancora e `auth_ok` non arriva.
    await pagina.collegati();
    await Future<void>.delayed(const Duration(milliseconds: 300));
    expect(pagina.verde, isFalse);

    int abbonamenti() =>
        ponte.arrivati.where((m) => m['type'] == 'subscribe_events').length;
    final primaDelRitorno = abbonamenti();

    // L'app torna davanti: il filo si riapre, e appena e' dentro la plancia
    // e' verde — molto prima dei venti secondi che la cucitura aspetta.
    final da = DateTime.now();
    collegamento.sveglia();
    await _finoA(() => pagina.verde, entro: const Duration(seconds: 5));
    expect(DateTime.now().difference(da), lessThan(const Duration(seconds: 5)));
    expect(pagina.prese, lessThanOrEqualTo(3), reason: 'nessuna ricarica');

    // E gli stati arrivano di nuovo: l'abbonamento e' stato rifatto.
    await _finoA(() => abbonamenti() > primaDelRitorno);
    final abbonamento = ponte.arrivati.lastWhere(
      (m) => m['type'] == 'subscribe_events',
    );
    ponte.cambia(abbonamento['id'] as int, 'light.portico', {'state': 'on'});
    await _finoA(() => pagina.eventi.contains('light.portico'));

    await ascolto.cancel();
    await pagina.chiudi();
  });
}

Future<void> _finoA(
  bool Function() condizione, {
  Duration entro = const Duration(seconds: 3),
}) async {
  final fine = DateTime.now().add(entro);
  while (DateTime.now().isBefore(fine)) {
    if (condizione()) return;
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
  throw StateError('l\'attesa è scaduta');
}
