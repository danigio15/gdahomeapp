/// Le prove del servitore: la plancia vera servita a un browser, passando dal
/// ponte.
///
/// Il browser qui e' `HttpClient` e `WebSocket` di `dart:io`, e dall'altra
/// parte c'e' il ponte finto, che sa servire file con `ponte/http`. Quello
/// che si prova: i file arrivano dal ponte una volta sola e poi dal disco, la
/// pagina ha in testa le premesse giuste, e il WebSocket della pagina parla
/// Home Assistant coi numeri suoi mentre sul filo passano quelli del filo.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/pannello.dart';
import 'package:gdahome/plancia/servitore.dart';
import 'package:gdahome/ponte/filo.dart';

import '../ponte/ponte_finto.dart';

const _base = '/dashboardmodern_static/abc123';
const _pagina =
    '<!DOCTYPE html><html lang="it"><head><link rel="stylesheet" '
    'href="./dashboard-runtime-it.css"></head><body>la plancia</body></html>';
const _modulo =
    'export const uno = 1;\n// un modulo della plancia, lungo abbastanza da essere compresso\n';

void main() {
  late PonteFinto ponte;
  late Filo filo;
  late Directory cartella;
  late Servitore servitore;
  final cliente = HttpClient();

  setUp(() async {
    ponte = await PonteFinto.alza();
    ponte.file['$_base/legacy/dashboard.html'] = (
      'text/html; charset=utf-8',
      utf8.encode(_pagina),
    );
    ponte.file['$_base/src/core/uno.js'] = (
      'text/javascript; charset=utf-8',
      utf8.encode(_modulo),
    );
    ponte.file['/dashboardmodern_static/avatars/1.png'] = (
      'image/png',
      [137, 80, 78, 71, 0, 1, 2, 3],
    );
    filo = Filo.fisso(
      indirizzo: ponte.indirizzo,
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
      attesaMassima: const Duration(milliseconds: 80),
    );
    await filo.apri();
    cartella = await Directory.systemTemp.createTemp('servitore-');
    servitore = Servitore(filo: () => filo, cartella: cartella);
    await servitore.alza();
  });

  tearDown(() async {
    await servitore.spegni();
    await filo.chiudi();
    await ponte.spegni();
    await cartella.delete(recursive: true);
  });

  Future<(int, String, List<int>)> prendi(String percorso) async {
    final richiesta = await cliente.getUrl(
      servitore.radice.replace(path: percorso),
    );
    final risposta = await richiesta.close();
    final byte = await risposta.fold<List<int>>(
      [],
      (tutti, pezzo) => tutti..addAll(pezzo),
    );
    return (
      risposta.statusCode,
      risposta.headers.contentType?.toString() ?? '',
      byte,
    );
  }

  PannelloDellaPlancia pannello() => PannelloDellaPlancia(
    percorso: 'dashboardmodern',
    titolo: 'DashboardModern',
    base: _base,
    istanza: 'e1',
    profilo: 'primary',
    primario: true,
    varianti: const ['dashboard.html'],
  );

  test('la pagina arriva dal ponte, con le premesse in testa', () async {
    final dove = servitore.paginaDi(pannello());
    expect(
      dove.toString(),
      'http://127.0.0.1:${servitore.porta}$_base/legacy/dashboard.html',
    );

    final (stato, tipo, byte) = await prendi(dove.path);
    expect(stato, 200);
    expect(tipo, startsWith('text/html'));
    final testo = utf8.decode(byte);
    /* Lo script sta subito dopo `<head>`, prima del foglio di stile. */
    final dopoLaTesta = testo.indexOf('<head>') + '<head>'.length;
    expect(
      testo.substring(dopoLaTesta),
      startsWith('<script>window.__DASHBOARDMODERN_HOSTED__=true;'),
    );
    expect(
      testo,
      contains('window.__DASHBOARDMODERN_BRIDGE_WS__=window.WebSocket;'),
    );
    expect(testo, contains('window.__DASHBOARDMODERN_INSTANCE__="e1";'));
    expect(testo, contains('window.__DASHBOARDMODERN_PROFILE__="primary";'));
    expect(testo, contains('window.__DASHBOARDMODERN_PRIMARY__=true;'));
    expect(testo, contains('window.__DASHBOARDMODERN_LOCALE__="it";'));
    expect(testo, contains('la plancia'));
  });

  test(
    'un file si chiede al ponte una volta sola, poi sta sul disco',
    () async {
      final (stato, tipo, byte) = await prendi('$_base/src/core/uno.js');
      expect(stato, 200);
      expect(tipo, startsWith('text/javascript'));
      expect(utf8.decode(byte), _modulo);
      expect(ponte.commissioni, hasLength(1));
      expect(ponte.commissioni.single['percorso'], '$_base/src/core/uno.js');
      expect(ponte.commissioni.single['metodo'], 'GET');

      /* La seconda volta il ponte non lo vede nemmeno. */
      await Future<void>.delayed(const Duration(milliseconds: 50));
      final (stato2, _, byte2) = await prendi('$_base/src/core/uno.js');
      expect(stato2, 200);
      expect(utf8.decode(byte2), _modulo);
      expect(ponte.commissioni, hasLength(1));
      expect(
        File('${cartella.path}$_base/src/core/uno.js').existsSync(),
        isTrue,
      );
    },
  );

  test(
    'lo stesso file chiesto da piu\' parti insieme si chiede una volta',
    () async {
      final tutte = await Future.wait([
        for (var i = 0; i < 6; i += 1) prendi('$_base/src/core/uno.js'),
      ]);
      expect(tutte.every((una) => una.$1 == 200), isTrue);
      expect(ponte.commissioni, hasLength(1));
    },
  );

  test(
    'un\'immagine arriva com\'e\', e un file che non c\'e\' e\' un 404',
    () async {
      final (stato, tipo, byte) = await prendi(
        '/dashboardmodern_static/avatars/1.png',
      );
      expect(stato, 200);
      expect(tipo, 'image/png');
      expect(byte, [137, 80, 78, 71, 0, 1, 2, 3]);

      final (mancante, _, _) = await prendi('$_base/src/core/due.js');
      expect(mancante, 404);
      /* Un 404 non si tiene sul disco: domani potrebbe esserci. */
      expect(
        File('${cartella.path}$_base/src/core/due.js').existsSync(),
        isFalse,
      );
    },
  );

  test('un percorso strano non arriva al ponte', () async {
    final (uno, _, _) = await prendi('/dashboardmodern_static/../etc/passwd');
    expect(uno, anyOf(400, 404));
    final (due, _, _) = await prendi('/altrove/x.js');
    expect(due, 404);
    final (tre, _, _) = await prendi('/dashboardmodern_static/a b.js');
    expect(tre, 400);
    expect(ponte.commissioni, isEmpty);
  });

  test('le chiamate REST passano dal ponte, col metodo e col corpo', () async {
    final richiesta = await cliente.postUrl(
      servitore.radice.replace(
        path: '/api/services/light/turn_on',
        query: 'a=1',
      ),
    );
    richiesta.headers.contentType = ContentType.json;
    /* La pagina ospitata manda un segno vuoto: non deve arrivare da nessuna parte. */
    richiesta.headers.set('authorization', 'Bearer ');
    richiesta.write('{"entity_id":"light.sala"}');
    final risposta = await richiesta.close();
    final corpo = await risposta.transform(utf8.decoder).join();
    expect(risposta.statusCode, 200);
    final eco = jsonDecode(corpo) as Map<String, dynamic>;
    expect(eco['metodo'], 'POST');
    expect(eco['percorso'], '/api/services/light/turn_on?a=1');
    expect(eco['tipo'], startsWith('application/json'));
    expect(eco['corpo'], '{"entity_id":"light.sala"}');
    expect(ponte.commissioni.single.containsKey('intestazioni'), isFalse);
  });

  group('il WebSocket della pagina', () {
    Future<WebSocket> apri() =>
        WebSocket.connect('ws://127.0.0.1:${servitore.porta}/api/websocket');

    test('parla Home Assistant coi numeri della pagina, e sul filo passano quelli del filo', () async {
      /* Il filo ha gia' mandato qualcosa: i numeri del filo e quelli della
       * pagina non possono coincidere. */
      await filo.chiedi({'type': 'get_states'});
      await filo.chiedi({'type': 'get_states'});

      final presa = await apri();
      final arrivati = <Map<String, dynamic>>[];
      presa.listen(
        (dynamic testo) =>
            arrivati.add(jsonDecode(testo as String) as Map<String, dynamic>),
      );

      await _finoA(() => arrivati.isNotEmpty);
      expect(arrivati.first['type'], 'auth_required');
      presa.add(
        jsonEncode({
          'type': 'auth',
          'access_token': '__dashboardmodern_hosted__',
        }),
      );
      await _finoA(() => arrivati.length == 2);
      expect(arrivati[1]['type'], 'auth_ok');

      final primaDellaPagina = ponte.arrivati.length;
      presa.add(jsonEncode({'id': 1, 'type': 'get_states'}));
      presa.add(
        jsonEncode({
          'id': 2,
          'type': 'subscribe_events',
          'event_type': 'state_changed',
        }),
      );
      await _finoA(() => arrivati.length == 4);
      final risposte = arrivati.sublist(2);
      expect(risposte.map((una) => una['id']), containsAll([1, 2]));
      expect(
        risposte.every(
          (una) => una['type'] == 'result' && una['success'] == true,
        ),
        isTrue,
      );

      /* Sul filo sono passati con numeri del filo: dopo quelli gia' usati dal
       * filo per conto suo, e diversi da quelli della pagina. */
      final sulFilo = ponte.arrivati.sublist(primaDellaPagina);
      expect(sulFilo.map((uno) => uno['type']), [
        'get_states',
        'subscribe_events',
      ]);
      final numeriDelFilo = sulFilo.map((uno) => uno['id'] as int).toList();
      expect(numeriDelFilo, [3, 4]);

      /* Un evento sulla sottoscrizione torna col numero della pagina. */
      final numeroDellaSottoscrizione =
          ponte.arrivati.lastWhere(
                (uno) => uno['type'] == 'subscribe_events',
              )['id']
              as int;
      ponte.cambia(numeroDellaSottoscrizione, 'light.sala', {'state': 'on'});
      await _finoA(() => arrivati.length == 5);
      expect(arrivati.last['type'], 'event');
      expect(arrivati.last['id'], 2);

      /* La disdetta traduce il numero, e dopo non arriva piu' niente. */
      presa.add(
        jsonEncode({'id': 3, 'type': 'unsubscribe_events', 'subscription': 2}),
      );
      await _finoA(() => arrivati.length == 6);
      expect(arrivati.last['id'], 3);
      final disdetta = ponte.arrivati.lastWhere(
        (uno) => uno['type'] == 'unsubscribe_events',
      );
      expect(disdetta['subscription'], numeroDellaSottoscrizione);
      ponte.cambia(numeroDellaSottoscrizione, 'light.sala', {'state': 'off'});
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(arrivati, hasLength(6));

      await presa.close();
    });

    test(
      'quando il filo cade la pagina si vede chiudere il WebSocket',
      () async {
        final presa = await apri();
        final arrivati = <Map<String, dynamic>>[];
        final chiusa = Completer<void>();
        presa.listen(
          (dynamic testo) =>
              arrivati.add(jsonDecode(testo as String) as Map<String, dynamic>),
          onDone: chiusa.complete,
        );
        await _finoA(() => arrivati.isNotEmpty);
        presa.add(jsonEncode({'type': 'auth', 'access_token': 'x'}));
        await _finoA(() => arrivati.length == 2);

        await ponte.buttaGiu();
        await chiusa.future.timeout(const Duration(seconds: 5));
        expect(presa.closeCode, WebSocketStatus.goingAway);
      },
    );

    test('se il filo non torna, la pagina lo viene a sapere invece di aspettare per sempre', () async {
      await filo.chiudi();
      final senzaFilo = Servitore(filo: () => null, cartella: cartella);
      await senzaFilo.alza();
      final presa = await WebSocket.connect(
        'ws://127.0.0.1:${senzaFilo.porta}/api/websocket',
      );
      final arrivati = <Map<String, dynamic>>[];
      presa.listen(
        (dynamic testo) =>
            arrivati.add(jsonDecode(testo as String) as Map<String, dynamic>),
      );
      await _finoA(() => arrivati.isNotEmpty);
      presa.add(jsonEncode({'type': 'auth', 'access_token': 'x'}));
      /* Venti secondi sarebbero troppi per una prova: si guarda solo che non
       * risponda `auth_ok` a un filo che non c'e'. */
      await Future<void>.delayed(const Duration(milliseconds: 300));
      expect(arrivati.where((uno) => uno['type'] == 'auth_ok'), isEmpty);
      await senzaFilo.spegni();
    });
  });
}

Future<void> _finoA(
  bool Function() condizione, {
  Duration entro = const Duration(seconds: 5),
}) async {
  final fine = DateTime.now().add(entro);
  while (DateTime.now().isBefore(fine)) {
    if (condizione()) return;
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
  throw StateError('l\'attesa e\' scaduta');
}
