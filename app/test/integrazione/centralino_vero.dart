/// Il centralino vero, acceso per davvero.
///
/// `node centralino/src/index.js`: lo stesso processo che girerebbe su un
/// server, con il suo archivio delle case. Serve a una prova sola ma
/// importante — quella in cui il telefono non ha **nessun** indirizzo della
/// casa e ci arriva lo stesso.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

class CentralinoVero {
  CentralinoVero._(this._processo, this._archivio, this.porta);

  final Process _processo;
  final Directory _archivio;
  final int porta;

  final List<String> registro = [];

  /// Come ci arriva il ponte, e come ci arriva il telefono.
  String get dove => 'ws://127.0.0.1:$porta';

  static Directory get cartella {
    var qui = Directory.current;
    for (var i = 0; i < 4; i += 1) {
      final forse = Directory('${qui.path}/centralino');
      if (forse.existsSync()) return forse;
      qui = qui.parent;
    }
    throw StateError('non trovo la cartella del centralino');
  }

  static Future<CentralinoVero> accendi() async {
    final archivio = await Directory.systemTemp.createTemp(
      'centralino-collaudo-',
    );
    final porta = await _unaPortaLibera();

    final processo = await Process.start(
      'node',
      ['${cartella.path}/src/index.js'],
      environment: {
        'CENTRALINO_PORTA': '$porta',
        'CENTRALINO_DATI': archivio.path,
        'CENTRALINO_REGISTRO': 'debug',
      },
    );

    final centralino = CentralinoVero._(processo, archivio, porta);
    processo.stdout
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen(centralino.registro.add);
    processo.stderr
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen(centralino.registro.add);

    await centralino._aspettaCheSiaVivo();
    return centralino;
  }

  Future<void> _aspettaCheSiaVivo() async {
    final fine = DateTime.now().add(const Duration(seconds: 15));
    while (DateTime.now().isBefore(fine)) {
      try {
        if ((await salute())['vivo'] == true) return;
      } catch (_) {
        /* Non e' ancora su. */
      }
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    throw StateError('il centralino non si è alzato:\n${registro.join('\n')}');
  }

  /// Quante case sono collegate adesso. E' cosi' che si aspetta che il ponte
  /// abbia finito di chiamare fuori.
  Future<int> quanteCase() async => (await salute())['case'] as int? ?? 0;

  Future<Map<String, dynamic>> salute() async {
    final cliente = HttpClient();
    try {
      final richiesta = await cliente.getUrl(
        Uri.parse('http://127.0.0.1:$porta/salute'),
      );
      final risposta = await richiesta.close();
      final letto = jsonDecode(await risposta.transform(utf8.decoder).join());
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
    if (_archivio.existsSync()) await _archivio.delete(recursive: true);
  }
}

Future<int> _unaPortaLibera() async {
  final presa = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
  final porta = presa.port;
  await presa.close();
  return porta;
}
