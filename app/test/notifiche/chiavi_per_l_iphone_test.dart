import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/casa_conosciuta.dart';
import 'package:gdahome/notifiche/busta.dart';
import 'package:gdahome/notifiche/chiavi_per_l_iphone.dart';

void main() {
  group('la notifica toccata', laNotificaToccata);
  test(
    "all'estensione va solo la chiave delle notifiche, mai quella del filo",
    () async {
      final filo = List.filled(32, 'ab').join();
      final case_ = [
        CasaConosciuta(
          id: 'casa-1',
          nome: 'Casa',
          segno: 's',
          identificativo: 'dm_0123456789abcdef',
          chiave: filo,
        ),
        CasaConosciuta(id: 'casa-2', nome: 'Mare', segno: 's'),
      ];
      final chiavi = await chiaviPerLEstensione(case_);
      expect(chiavi.keys, [
        'dm_0123456789abcdef',
      ], reason: 'senza chiave del filo non c\'e\' niente da lasciare');
      final voce = chiavi['dm_0123456789abcdef']!;
      expect(voce['n'], 'Casa');
      expect(voce['c'], 'casa-1');
      expect(voce['k'], hasLength(64));
      expect(voce['k'], isNot(filo));
      final attesa = await (await chiaveDellaSpinta(
        filo,
        'dm_0123456789abcdef',
      )).extractBytes();
      expect(
        voce['k'],
        attesa.map((b) => b.toRadixString(16).padLeft(2, '0')).join(),
      );
    },
  );
}

/* «Faccio guarda e mi apre la home di GdA»: partendo da chiusa, sull'iPhone
 * Firebase la notifica toccata non la passa sempre. La tiene da parte
 * `AppDelegate.swift`, e l'app la chiede. */
void laNotificaToccata() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const canale = MethodChannel('gdahome/notifiche-iphone');

  tearDown(() {
    debugDefaultTargetPlatformOverride = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(canale, null);
  });

  test(
    "sull'iPhone la notifica toccata si chiede, coi soli campi di testo",
    () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      final chieste = <String>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(canale, (chiamata) async {
            chieste.add(chiamata.method);
            return {'g': '1', 'd': 'tel', 'b': 'busta', 'x': 3};
          });
      final toccata = await notificaToccataSullIphone();
      expect(chieste, ['toccata']);
      expect(toccata, {'g': '1', 'd': 'tel', 'b': 'busta'});
    },
  );

  test('senza notifica toccata, o fuori dall\'iPhone, niente', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(canale, (_) async => null);
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    expect(await notificaToccataSullIphone(), isNull);
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    expect(await notificaToccataSullIphone(), isNull);
  });
}
