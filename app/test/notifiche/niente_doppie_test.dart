import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/notifiche/postino.dart';

/// Una cassaforte che non risponde: il portachiavi di Android appena
/// riacceso, o occupato dall'app nello stesso momento.
class _CassaforteMuta implements Cassaforte {
  @override
  Future<String?> leggi(String chiave) async =>
      throw StateError('il portachiavi non risponde');

  @override
  Future<void> scrivi(String chiave, String valore) async =>
      throw StateError('il portachiavi non risponde');

  @override
  Future<void> cancella(String chiave) async {}
}

/// «Le notifiche sempre a doppio»: sull'iPhone la notifica la mostra il
/// sistema, e l'app ne mostrava una seconda copia quando era sveglia in
/// sottofondo. Sull'iPhone l'app la mostra solo quando il sistema la tace e
/// gliela passa; su Android, dove il sistema non mostra niente, sempre.
///
/// E il contrario, «le notifiche non partono se l'app non e' collegata»: una
/// notifica non deve sparire in nessun punto della strada.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('sull iPhone la copia locale solo se il sistema la tace', () {
    expect(mostraLaCopiaLocale(TargetPlatform.iOS, inPrimoPiano: true), isTrue);
    expect(
      mostraLaCopiaLocale(TargetPlatform.iOS, inPrimoPiano: false),
      isFalse,
    );
  });

  test('su Android la mostra sempre l app', () {
    expect(
      mostraLaCopiaLocale(TargetPlatform.android, inPrimoPiano: false),
      isTrue,
    );
    expect(
      mostraLaCopiaLocale(TargetPlatform.android, inPrimoPiano: true),
      isTrue,
    );
  });

  test('per l iPhone anche l app inattiva ha qualcuno davanti', () {
    /* Il centro notifiche tirato giu', il selettore delle app: davanti al
     * telefono c'e' qualcuno. */
    expect(inPrimoPianoPerLIphone(AppLifecycleState.resumed), isTrue);
    expect(inPrimoPianoPerLIphone(AppLifecycleState.inactive), isTrue);
    expect(inPrimoPianoPerLIphone(null), isTrue);
    /* Con la finestra del telefono dietro, no. Ma questo non dice piu' chi
     * mostra la notifica: quella che iOS passa all'app (`onMessage`) l'app la
     * mostra sempre, anche qui — e' il telefono bloccato con CarPlay davanti
     * (`iphone_con_carplay_test.dart`). */
    expect(inPrimoPianoPerLIphone(AppLifecycleState.paused), isFalse);
    expect(inPrimoPianoPerLIphone(AppLifecycleState.hidden), isFalse);
    expect(inPrimoPianoPerLIphone(AppLifecycleState.detached), isFalse);
  });

  test('il gettone si ridice ogni tanto, e prima se la casa non ha '
      'risposto', () {
    final adesso = DateTime(2026, 10, 18, 12);
    expect(quandoRidirlo(adesso, riuscito: true), DateTime(2026, 10, 18, 18));
    expect(
      quandoRidirlo(adesso, riuscito: false),
      DateTime(2026, 10, 18, 12, 10),
    );
  });

  test('col portachiavi che non risponde la notifica non fa cadere '
      'niente', () async {
    final dati = <String, dynamic>{
      'g': '1',
      'd': 'dm_0123456789abcdef',
      'b': 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=',
    };
    /* Si mostra la frase di riserva (che nelle prove non ha dove andare), e
     * non si solleva niente: ad app chiusa un errore qui era una notifica
     * sparita. */
    expect(await apriEMostra(dati, _CassaforteMuta()), isNull);
  });
}
