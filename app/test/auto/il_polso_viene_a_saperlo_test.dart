/// Lo stato nuovo arriva al polso: i pezzi che stanno fuori dal Dart.
///
/// «Funziona, ma non aggiorna lo stato: rimane sempre spenta ma è accesa.» La
/// fotografia corretta dopo un comando la scrive il Dart, e questo ha le sue
/// prove (`dal_polso_alla_casa_test.dart`). Ma da li' al vetro dell'orologio
/// ci sono Kotlin e Swift, che qui dentro non girano: i loro anelli si tengono
/// fermi leggendoli. E' poco — dice che la riga c'e', non che funziona — ma
/// ognuno di questi anelli, tolto, non da' nessun errore: da' una riga al
/// polso che non cambia piu'.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/auto/sul_telefono.dart';

String _leggi(String dove) => File(dove).readAsStringSync();

const _kotlin = 'android/app/src/main/kotlin/com/gdahome/gdahome';
const _wear = 'android/orologio/src/main/kotlin/com/gdahome/gdahome/orologio';

void main() {
  test('il canale su cui il Dart dice «la fotografia e\' cambiata» e\' lo '
      'stesso nei tre posti', () {
    expect(canaleDellOrologio, 'gdahome/orologio');
    expect(
      _leggi('$_kotlin/orologio/IlTramiteDellOrologio.kt'),
      contains('MethodChannel(messaggi, "$canaleDellOrologio")'),
    );
    expect(
      _leggi('ios/Runner/LOrologio.swift'),
      contains('FlutterMethodChannel(name: "$canaleDellOrologio"'),
    );
  });

  test('su Android anche il motore senza schermo sa dirlo all\'orologio', () {
    /* Ad app chiusa il comando dal polso lo esegue un motore acceso apposta
     * (`IlPonteDellAuto.sveglia`). Quel canale non ce l'aveva: la fotografia
     * si correggeva sul disco e al polso non arrivava mai — «accende le luci
     * ma non cambia stato». */
    final ponte = _leggi('$_kotlin/auto/IlPonteDellAuto.kt');
    final acceso = ponte.indexOf('val nuovo = FlutterEngine(');
    final partito = ponte.indexOf('nuovo.dartExecutor.executeDartEntrypoint(');
    expect(acceso, greaterThan(0));
    expect(partito, greaterThan(acceso));
    expect(
      ponte.substring(acceso, partito),
      contains(
        'IlTramiteDellOrologio.collega(nuovo.dartExecutor.binaryMessenger',
      ),
      reason: 'prima che il Dart parta, e sul suo stesso motore',
    );
  });

  test('la risposta a un comando andato porta la fotografia di adesso', () {
    /* Lo stato nuovo di una luce arriva quasi sempre prima del si' al
     * comando: quando il telefono risponde «fatto» la riga giusta e' gia'
     * scritta, e viaggia con la risposta. */
    final android = _leggi('$_kotlin/orologio/IlTramiteDellOrologio.kt');
    expect(android, contains('rispondi(conLaFoto(context, com))'));
    expect(android, contains('.put("foto", fotografia(context))'));
    final iphone = _leggi('ios/Runner/LOrologio.swift');
    expect(iphone, contains('detta["foto"] = self.fotografia()'));
  });

  test('e l\'orologio la prende da li\'', () {
    expect(
      _leggi('$_wear/IlTelefono.kt'),
      contains('r.optString("foto", "").takeIf { it.isNotEmpty() }'),
    );
    final apple = _leggi('ios/Orologio/IlTelefono.swift');
    expect(apple, contains('let foto = risposta["foto"] as? String'));
    expect(apple, contains('if let foto { prendi(foto) }'));
  });

  test('l\'iPhone lascia al Dart il tempo di sentire lo stato nuovo', () {
    /* La conferma parte appena la casa accetta; lo stato nuovo il Dart lo
     * aspetta dopo. Chiudere subito il tempo chiesto a iOS voleva dire farsi
     * sospendere prima che arrivasse. */
    final iphone = _leggi('ios/Runner/LOrologio.swift');
    expect(
      iphone,
      contains(
        'DispatchQueue.main.asyncAfter(deadline: .now() + 12) { chiudi() }',
      ),
    );
  });
}
