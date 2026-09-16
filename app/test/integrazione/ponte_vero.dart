/// Il ponte vero, acceso per davvero.
///
/// Non una finzione del ponte: `node ponte/src/index.js`, lo stesso processo
/// che gira dentro l'add-on, con le sue due porte e il suo archivio.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'casa_finta.dart';
import 'porte.dart';

class PonteVero {
  PonteVero._(
    this._processo,
    this._archivio,
    this.portaDellApp,
    this.portaDellaConsole,
  );

  final Process _processo;
  final Directory _archivio;
  final int portaDellApp;
  final int portaDellaConsole;

  final List<String> registro = [];

  String get indirizzo => '127.0.0.1:$portaDellApp';
  String get console => 'http://127.0.0.1:$portaDellaConsole';

  /// Dove sta il ponte rispetto a questo pacchetto.
  static Directory get cartella {
    var qui = Directory.current;
    /* `flutter test` gira dalla cartella dell'app; da altrove si sale finche'
     * non si trova. */
    for (var i = 0; i < 4; i += 1) {
      final forse = Directory('${qui.path}/ponte');
      if (forse.existsSync()) return forse;
      qui = qui.parent;
    }
    throw StateError('non trovo la cartella del ponte');
  }

  /// Node c'e'? Senza, questa prova non ha senso e si salta invece di rompersi.
  static bool get cENode {
    try {
      return Process.runSync('node', ['--version']).exitCode == 0;
    } catch (_) {
      return false;
    }
  }

  /// Accende il ponte, e se la porta gliel'hanno soffiata riprova.
  ///
  /// Perche' possa succedere sta scritto in `porte.dart`. Qui conta che non
  /// c'e' niente da capire quando succede: si prendono due numeri nuovi e si
  /// riparte, che e' quello che farebbe una persona guardando il registro.
  static Future<PonteVero> accendi(CasaFinta casa, {String? centralino}) async {
    for (var tentativo = 1; ; tentativo += 1) {
      try {
        return await _unTentativo(casa, centralino: centralino);
      } on PortaOccupata catch (guaio) {
        if (tentativo == quantiTentativi) {
          throw StateError(
            'il ponte non si è alzato: la porta era occupata '
            '$quantiTentativi volte di fila.\n${guaio.registro}',
          );
        }
      }
    }
  }

  static Future<PonteVero> _unTentativo(
    CasaFinta casa, {
    String? centralino,
  }) async {
    final archivio = await Directory.systemTemp.createTemp('ponte-collaudo-');
    final porte = await porteLibere(2);
    final app = porte[0];
    final consolle = porte[1];

    /* Le opzioni le legge il ponte da `/data/options.json`, come dentro
     * l'add-on: qui `/data` e' una cartella temporanea. */
    await File('${archivio.path}/options.json').writeAsString(
      jsonEncode({
        'porta_app': app,
        'dispositivi_massimi': 5,
        'minuti_del_codice': 5,
        'giorni_di_silenzio': 90,
        'registro': 'debug',
        if (centralino != null) 'centralino': centralino,
      }),
    );

    final processo = await Process.start(
      'node',
      ['${cartella.path}/src/index.js'],
      environment: {
        'PONTE_ARCHIVIO': archivio.path,
        'PONTE_CONSOLE': '${cartella.path}/console',
        'PONTE_PORTA_CONSOLE': '$consolle',
        /* Il segno del Supervisor: nel mondo vero glielo da' Home Assistant. */
        'SUPERVISOR_TOKEN': segnoDelSupervisor,
        'PONTE_CASA': casa.indirizzo,
      },
    );

    final ponte = PonteVero._(processo, archivio, app, consolle);
    processo.stdout
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen(ponte.registro.add);
    processo.stderr
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen(ponte.registro.add);

    try {
      await ponte._aspettaCheSiaVivo();
    } catch (_) {
      await ponte.spegni();
      if (parlaDiPortaOccupata(ponte.registro)) {
        throw PortaOccupata(ponte.registro.join('\n'));
      }
      rethrow;
    }
    return ponte;
  }

  Future<void> _aspettaCheSiaVivo() async {
    /* Se il processo muore durante l'avvio, aspettare gli altri quattordici
     * secondi non lo fa resuscitare: si smette subito, e chi ha chiamato
     * riprova o dice cos'e' andato storto. */
    var caduto = false;
    unawaited(_processo.exitCode.then((_) => caduto = true));

    final fine = DateTime.now().add(const Duration(seconds: 15));
    while (DateTime.now().isBefore(fine)) {
      try {
        final risposta = await _chiedi('http://$indirizzo/salute');
        if (risposta['vivo'] == true) return;
      } catch (_) {
        /* Non e' ancora su. */
      }
      if (caduto) {
        /* Un istante perche' le ultime righe di `stderr` arrivino nel
         * registro: e' li' dentro che c'e' scritto perche' e' morto. */
        await Future<void>.delayed(const Duration(milliseconds: 200));
        break;
      }
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    throw StateError('il ponte non si è alzato:\n${registro.join('\n')}');
  }

  /// Fabbrica un codice di abbinamento **dalla console**, che e' l'unico posto
  /// da cui puo' nascere. Nel mondo vero e' un dito che preme un bottone.
  Future<String> codiceDiAbbinamento() async {
    final detto = await _chiedi('$console/api/codice', metodo: 'POST');
    final codice = detto['codice'];
    if (codice is! String) {
      throw StateError('la console non ha dato un codice: $detto');
    }
    return codice;
  }

  /// Il QR code, come riga: quello che l'app leggerebbe
  /// inquadrando.
  ///
  /// Lo scrive il ponte vero, non la prova: qui dentro ci finisce dentro anche
  /// **quale centralino chiama questa casa**, ed e' proprio quella la parte
  /// che si vuole vedere arrivare fino in fondo.
  Future<String> invitoDiAbbinamento() async {
    final detto = await _chiedi('$console/api/codice', metodo: 'POST');
    final scritto = detto['invito'];
    if (scritto is! String) {
      throw StateError('la console non ha dato un invito: $detto');
    }
    return scritto;
  }

  Future<Map<String, dynamic>> statoDellaConsole() =>
      _chiedi('$console/api/stato');

  Future<Map<String, dynamic>> _chiedi(
    String dove, {
    String metodo = 'GET',
  }) async {
    final cliente = HttpClient();
    try {
      final richiesta = await cliente.openUrl(metodo, Uri.parse(dove));
      final risposta = await richiesta.close();
      final corpo = await risposta.transform(utf8.decoder).join();
      final letto = jsonDecode(corpo);
      return letto is Map<String, dynamic> ? letto : {};
    } finally {
      cliente.close(force: true);
    }
  }

  Future<void> spegni() async {
    _processo.kill(ProcessSignal.sigterm);
    await _processo.exitCode.timeout(
      const Duration(seconds: 5),
      onTimeout: () {
        _processo.kill(ProcessSignal.sigkill);
        return -1;
      },
    );
    if (_archivio.existsSync()) {
      await _archivio.delete(recursive: true);
    }
  }
}
