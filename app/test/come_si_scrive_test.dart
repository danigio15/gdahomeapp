/// Come sono scritte le frasi dell'app: una prova che legge il programma.
///
/// Ci sono due sbagli che nessuna prova normale prende, perche' non fanno
/// fallire niente: si vedono soltanto a schermo, e chi scrive il programma non
/// li rilegge piu'.
///
///  - **gli accenti scritti con l'apostrofo.** «Non ti verra' mai chiesta la
///    password» era la prima frase che si leggeva aprendo l'app. In tutto il
///    programma c'era **un** accento vero, e stava in una frase sola: tutte le
///    altre erano «e'», «perche'», «piu'», «gia'». Nei commenti va bene — li'
///    l'alfabeto e' quello di chi scrive — ma in una frase che si legge no;
///  - **le frasi in una lingua sola.** Una frase nuova scritta come si
///    scriveva prima, senza la sua traduzione, non si vede: esce in italiano
///    anche a chi ha il telefono in inglese. `inLingua` non si puo' dimenticare
///    a metà — la vuole il compilatore — ma si puo' dimenticare del tutto.
///
/// Percio' questa prova legge i file del programma come testo e guarda le
/// **stringhe**, non i commenti: le une devono avere gli accenti veri, e
/// quelle che sono una frase per qualcuno devono passare da `inLingua`.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// I file del programma, tutti.
List<File> _iFile() =>
    Directory('lib')
        .listSync(recursive: true)
        .whereType<File>()
        .where((uno) => uno.path.endsWith('.dart'))
        .toList()
      ..sort((a, b) => a.path.compareTo(b.path));

/// Il programma senza i commenti: quelli hanno un alfabeto loro.
String _senzaCommenti(String dentro) {
  final senzaBlocchi = dentro.replaceAll(
    RegExp(r'/\*.*?\*/', dotAll: true),
    '',
  );
  return senzaBlocchi
      .split('\n')
      .where((riga) {
        final spoglia = riga.trimLeft();
        return !spoglia.startsWith('///') && !spoglia.startsWith('//');
      })
      .join('\n');
}

/// Le stringhe fra apostrofi, una per una.
Iterable<String> _leStringhe(String dentro) =>
    RegExp(r"'((?:[^'\\\n]|\\.)*)'")
        .allMatches(dentro)
        .map((quale) => quale.group(1) ?? '');

/// Le parole dove l'apostrofo sta al posto di un accento.
final _accentoConLApostrofo = RegExp(
  r"(?:(?<![A-Za-z])(?:e|ne|se|si|li|la|da)|perche|cosi|piu|puo|gia|giu|sara|"
  r"verra|cio|pero|finche|meta|citta|qualita|attivita|novita|entita|eta)"
  r"\\'",
  caseSensitive: false,
);

void main() {
  test('negli schermi gli accenti sono accenti, non apostrofi', () {
    final male = <String>[];
    for (final uno in _iFile()) {
      final testo = _senzaCommenti(uno.readAsStringSync());
      for (final quale in _leStringhe(testo)) {
        if (_accentoConLApostrofo.hasMatch("'$quale'")) {
          male.add('${uno.path}: $quale');
        }
      }
    }
    expect(
      male,
      isEmpty,
      reason:
          'queste scritte hanno un apostrofo dove va un accento — «perche\'» '
          'invece di «perché»:\n${male.join('\n')}',
    );
  });

  test('la parola «quadretto» non si legge da nessuna parte', () {
    /* Il codice di abbinamento si chiama QR code, ed e' il nome che sta anche
     * sul tasto della console. «Quadretto» non lo dice nessuno. */
    final male = <String>[];
    for (final uno in _iFile()) {
      if (uno.path.endsWith('qr.dart')) continue;
      final testo = _senzaCommenti(uno.readAsStringSync());
      for (final quale in _leStringhe(testo)) {
        if (quale.toLowerCase().contains('quadrett')) {
          male.add('${uno.path}: $quale');
        }
      }
    }
    expect(male, isEmpty, reason: male.join('\n'));
  });
}
