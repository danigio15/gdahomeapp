import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/notifiche/al_navigatore.dart';
import 'package:gdahome/notifiche/busta.dart';
import 'package:gdahome/notifiche/consegna.dart';
import 'package:gdahome/notifiche/postino.dart';

/// L'iPhone con GdAHome sullo schermo dell'auto (CarPlay) e il telefono
/// bloccato in tasca.
///
/// Per iOS l'app e' in primo piano — per la scena dell'auto — e la notifica,
/// invece di mostrarla, la passa all'app (`onMessage`); la finestra del
/// telefono pero' e' `paused`. Prima l'app, credendosi in sottofondo, la
/// passava solo al navigatore: in auto l'avviso per qualche secondo, e sul
/// telefono niente — ne' schermata di blocco, ne' suono, ne' centro
/// notifiche. Adesso la mostra sempre, **e** la passa al navigatore; e mai
/// due volte la stessa.
///
/// Chiavi, telefoni e case inventati.
const _chiave =
    '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
const _telefono = 'dm_0123456789abcdef';

/// Una busta chiusa come le chiude il ponte (`ponte/src/spinta.js`): la
/// versione, dodici byte a caso, il testo cifrato, il sigillo.
Future<String> _chiudi(Map<String, dynamic> notifica) async {
  final scatola = await AesGcm.with256bits().encrypt(
    utf8.encode(jsonEncode(notifica)),
    secretKey: await chiaveDellaSpinta(_chiave, _telefono),
    nonce: List<int>.generate(12, (i) => i + 1),
    aad: utf8.encode('$etichettaDellaSpinta|$_telefono'),
  );
  return base64.encode([
    versioneDellaSpinta,
    ...scatola.nonce,
    ...scatola.cipherText,
    ...scatola.mac.bytes,
  ]);
}

Future<Map<String, dynamic>> _spinta({
  required String id,
  String tipo = 'elettrodomestico',
  String urgenza = 'normale',
  String titolo = 'Lavatrice finita',
  bool chiamata = false,
}) async => {
  'g': '1',
  'd': _telefono,
  'b': await _chiudi({
    'v': 1,
    'id': id,
    'tipo': tipo,
    'cat': 'elettrodomestici',
    'urg': urgenza,
    'titolo': titolo,
    'testo': 'Bucato pronto',
    'quando': 1790000000000,
    'scade': 4102444800000,
    if (chiamata) 'chiamata': true,
    if (chiamata) 'camera': 'camera.ingresso',
  }),
};

void main() {
  final legame = TestWidgetsFlutterBinding.ensureInitialized();
  const canale = MethodChannel('dexterous.com/flutter/local_notifications');

  /// Le notifiche locali mostrate: quello che finisce sul telefono.
  late List<MethodCall> mostrate;
  late CassaforteInMemoria cassaforte;
  late Postino postino;

  /// Tutto quello che arriva al navigatore in questa prova.
  late List<Map<String, Object?>> alNavigatore;

  setUp(() async {
    mostrate = [];
    legame.defaultBinaryMessenger.setMockMethodCallHandler(canale, (
      chiamata,
    ) async {
      if (chiamata.method == 'show') mostrate.add(chiamata);
      return null;
    });
    cassaforte = CassaforteInMemoria();
    final archivio = ArchivioDelleCase(cassaforte);
    await archivio.apri();
    await archivio.aggiungi(
      nome: 'Villa Gialla',
      segno: 'segno-finto',
      identificativo: _telefono,
      chiave: _chiave,
    );
    postino = Postino(
      collegamento: Collegamento(archivio: ArchivioDelleCase(cassaforte)),
      cassaforte: cassaforte,
    );
    alNavigatore = [];
    final ascolto = ascoltaLeNotifiche().listen(alNavigatore.add);
    addTearDown(() async {
      await ascolto.cancel();
      postino.dispose();
      legame.defaultBinaryMessenger.setMockMethodCallHandler(canale, null);
      debugDefaultTargetPlatformOverride = null;
      legame.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    });
  });

  /// L'iPhone, con la finestra del telefono in [stato].
  void sullIphone(AppLifecycleState stato) {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    IOSFlutterLocalNotificationsPlugin.registerWith();
    legame.handleAppLifecycleStateChanged(stato);
  }

  void suAndroid() {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    AndroidFlutterLocalNotificationsPlugin.registerWith();
  }

  /// Il tempo che la porta del navigatore consegni.
  Future<void> unAttimo() =>
      Future<void>.delayed(const Duration(milliseconds: 20));

  for (final stato in [
    AppLifecycleState.paused,
    AppLifecycleState.hidden,
    AppLifecycleState.detached,
  ]) {
    test('iPhone, CarPlay davanti e telefono bloccato (${stato.name}): la '
        'notifica si vede sul telefono e arriva al navigatore', () async {
      sullIphone(stato);
      await postino.arrivataAdAppAperta(await _spinta(id: 'n-${stato.name}'));
      await unAttimo();
      // Sul telefono: la copia locale, col suo titolo.
      expect(mostrate, hasLength(1));
      expect((mostrate.single.arguments as Map)['title'], 'Lavatrice finita');
      // E al navigatore, che la mostra sull'auto.
      expect(alNavigatore, hasLength(1));
      expect(alNavigatore.single['id'], 'n-${stato.name}');
      expect(alNavigatore.single['_casa'], 'Villa Gialla');
    });
  }

  test('iPhone: la stessa notifica consegnata due volte si mostra una volta '
      'sola, sul telefono e al navigatore', () async {
    sullIphone(AppLifecycleState.paused);
    final spinta = await _spinta(id: 'n-doppia');
    await postino.arrivataAdAppAperta(spinta);
    await postino.arrivataAdAppAperta(spinta);
    // Anche tornando davanti: e' gia' stata vista.
    legame.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await postino.arrivataAdAppAperta(spinta);
    await unAttimo();
    expect(mostrate, hasLength(1));
    expect(alNavigatore, hasLength(1));
  });

  test('iPhone, app davanti: come prima, una copia sul telefono e una al '
      'navigatore', () async {
    sullIphone(AppLifecycleState.resumed);
    await postino.arrivataAdAppAperta(await _spinta(id: 'n-davanti'));
    await unAttimo();
    expect(mostrate, hasLength(1));
    expect(alNavigatore, hasLength(1));
  });

  test('iPhone, la strada di sottofondo: la mostra il sistema, l\'app no '
      '(sarebbe la doppia)', () async {
    sullIphone(AppLifecycleState.paused);
    await quandoArrivaDaChiusa(
      RemoteMessage(data: await _spinta(id: 'n-sottofondo')),
    );
    await unAttimo();
    expect(mostrate, isEmpty);
  });

  test(
    'Android: niente di cambiato, la mostra sempre l\'app, una volta',
    () async {
      suAndroid();
      final spinta = await _spinta(id: 'n-android');
      await postino.arrivataAdAppAperta(spinta);
      await postino.arrivataAdAppAperta(spinta);
      await unAttimo();
      expect(mostrate, hasLength(1));
      expect((mostrate.single.arguments as Map)['title'], 'Lavatrice finita');
      expect(alNavigatore, hasLength(1));
    },
  );

  group('il campanello', () {
    Future<Map<String, dynamic>> campanello(String id) => _spinta(
      id: id,
      tipo: 'campanello',
      urgenza: 'urgente',
      titolo: 'Suona il campanello',
      chiamata: true,
    );

    test('col telefono bloccato e CarPlay davanti si vede sul telefono, ma la '
        'telecamera non si apre da sola', () async {
      sullIphone(AppLifecycleState.paused);
      final tocchi = <ToccoDellaNotifica>[];
      final ascolto = postino.tocchi.listen(tocchi.add);
      addTearDown(ascolto.cancel);
      await postino.arrivataAdAppAperta(await campanello('c-bloccato'));
      await unAttimo();
      expect(mostrate, hasLength(1));
      expect(alNavigatore, hasLength(1));
      expect(tocchi, isEmpty);
      expect(postino.prendiInSospeso(), isEmpty);
    });

    test('con l\'app davanti si apre subito, come sempre', () async {
      sullIphone(AppLifecycleState.resumed);
      final tocchi = <ToccoDellaNotifica>[];
      final ascolto = postino.tocchi.listen(tocchi.add);
      addTearDown(ascolto.cancel);
      await postino.arrivataAdAppAperta(await campanello('c-davanti'));
      await unAttimo();
      expect(mostrate, hasLength(1));
      expect(tocchi.single.notifica.id, 'c-davanti');
    });

    test('quando si apre da solo: su Android sempre, sull\'iPhone solo con '
        'qualcuno davanti', () {
      for (final stato in [null, ...AppLifecycleState.values]) {
        expect(campanelloSubito(TargetPlatform.android, stato), isTrue);
      }
      expect(campanelloSubito(TargetPlatform.iOS, null), isTrue);
      expect(
        campanelloSubito(TargetPlatform.iOS, AppLifecycleState.resumed),
        isTrue,
      );
      expect(
        campanelloSubito(TargetPlatform.iOS, AppLifecycleState.inactive),
        isTrue,
      );
      expect(
        campanelloSubito(TargetPlatform.iOS, AppLifecycleState.paused),
        isFalse,
      );
      expect(
        campanelloSubito(TargetPlatform.iOS, AppLifecycleState.hidden),
        isFalse,
      );
      expect(
        campanelloSubito(TargetPlatform.iOS, AppLifecycleState.detached),
        isFalse,
      );
    });
  });
}
