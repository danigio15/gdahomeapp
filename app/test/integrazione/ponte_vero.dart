/// Il ponte vero, acceso per davvero.
///
/// Non una finzione del ponte: `node ponte/src/index.js`, lo stesso processo
/// che gira dentro l'add-on, con le sue due porte e il suo archivio.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'casa_finta.dart';

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

  static Future<PonteVero> accendi(CasaFinta casa) async {
    final archivio = await Directory.systemTemp.createTemp('ponte-collaudo-');
    final app = await _unaPortaLibera();
    final consolle = await _unaPortaLibera();

    /* Le opzioni le legge il ponte da `/data/options.json`, come dentro
     * l'add-on: qui `/data` e' una cartella temporanea. */
    await File('${archivio.path}/options.json').writeAsString(
      jsonEncode({
        'porta_app': app,
        'dispositivi_massimi': 5,
        'minuti_del_codice': 5,
        'giorni_di_silenzio': 90,
        'registro': 'debug',
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

    await ponte._aspettaCheSiaVivo();
    return ponte;
  }

  Future<void> _aspettaCheSiaVivo() async {
    final fine = DateTime.now().add(const Duration(seconds: 15));
    while (DateTime.now().isBefore(fine)) {
      try {
        final risposta = await _chiedi('http://$indirizzo/salute');
        if (risposta['vivo'] == true) return;
      } catch (_) {
        /* Non e' ancora su. */
      }
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    throw StateError('il ponte non si e\' alzato:\n${registro.join('\n')}');
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

Future<int> _unaPortaLibera() async {
  final presa = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
  final porta = presa.port;
  await presa.close();
  return porta;
}
