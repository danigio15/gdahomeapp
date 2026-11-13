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
import 'package:gdahome/auto/in_auto.dart';
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
    final wear = _leggi('$_wear/IlTelefono.kt');
    expect(wear, contains('val foto = r.optString("foto", "")'));
    expect(wear, contains('prendi(foto)'));
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
  test('la schermata aperta al polso disegna la fotografia di adesso', () {
    /* «Il tasto resta spento.» La schermata dei dispositivi si apriva con
     * la fotografia del momento in cui la si toccava, e ridisegnava quella:
     * la riga girata al tocco e quella corretta dal telefono non si
     * vedevano. Adesso ognuna legge quella viva del telefono. */
    final apple = _leggi('ios/Orologio/LaCasa.swift');
    expect(
      apple,
      contains('private var foto: LaFoto { telefono.foto ?? ricevuta }'),
    );
    for (final schermata in [
      'LaCasa',
      'Dispositivi',
      'Azioni',
      'ComeStaLaCasa',
    ]) {
      expect(
        apple,
        isNot(contains('struct $schermata: View {\n  let foto: LaFoto')),
        reason: schermata,
      );
    }
    final wear = _leggi('$_wear/AlPolso.kt');
    expect(
      wear,
      contains('composable("dispositivi") { Dispositivi(telefono.foto ?: foto'),
    );
    expect(wear, isNot(contains('{ Dispositivi(foto, telefono) }')));
  });

  test('l\'orologio chiede com\'e\' la casa, e il telefono lo chiede al '
      'Dart con la stessa parola', () {
    expect(guardaLoStato, 'stato');
    final wear = _leggi('$_wear/IlTelefono.kt');
    expect(wear, contains('put("cosa", "stato")'));
    expect(wear, contains('SGUARDI_DOPO_IL_COMANDO_MS'));
    final apple = _leggi('ios/Orologio/IlTelefono.swift');
    expect(apple, contains('sendMessage(["cosa": "stato"])'));
    expect(apple, contains('sguardiDopoIlComando'));
    expect(
      _leggi('ios/Orologio/GdahomeOrologio.swift'),
      contains('telefono.davanti(nuova == .active)'),
    );

    final android = _leggi('$_kotlin/orologio/IlTramiteDellOrologio.kt');
    expect(android, contains('optString("cosa", "") == "stato"'));
    final ponte = _leggi('$_kotlin/auto/IlPonteDellAuto.kt');
    expect(ponte, contains('const val STATO = "$guardaLoStato"'));
    /* Anche il motore acceso apposta: all'avvio esegue solo il comando
     * lasciato, e lo sguardo glielo si chiede dopo. */
    expect(ponte, contains('canale.invokeMethod(GUARDA, STATO, risposta)'));

    expect(_leggi('ios/Runner/LOrologio.swift'), contains('case "stato":'));
    expect(
      _leggi('ios/Runner/LaCasaInCarPlay.swift'),
      contains('invokeMethod("guarda", arguments: "$guardaLoStato")'),
    );
  });

  test('una fotografia piu\' vecchia non riporta indietro la riga', () {
    expect(
      _leggi('$_kotlin/orologio/IlTramiteDellOrologio.kt'),
      contains('foto.put("agg", '),
    );
    expect(
      _leggi('ios/Runner/LOrologio.swift'),
      contains('foto["agg"] = LaCasaInCarPlay.quandoEScrittaLaFoto()'),
    );
    expect(_leggi('$_wear/IlTelefono.kt'), contains('nuova.agg < prima.agg'));
    expect(
      _leggi('ios/Orologio/IlTelefono.swift'),
      contains('nuova.agg < prima.agg'),
    );
  });
}
