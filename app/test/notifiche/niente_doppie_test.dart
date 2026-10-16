import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/notifiche/postino.dart';

/// «Le notifiche sempre a doppio»: sull'iPhone la notifica la mostra il
/// sistema, e l'app ne mostrava una seconda copia quando era sveglia in
/// sottofondo. Sull'iPhone l'app la mostra solo in primo piano; su Android,
/// dove il sistema non mostra niente, sempre.
void main() {
  test('sull iPhone la copia locale solo in primo piano', () {
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
}
