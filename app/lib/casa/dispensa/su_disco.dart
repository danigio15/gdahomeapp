/// Sul telefono: un file nella cartella di supporto dell'app.
library;

import 'dart:io';

import 'package:path_provider/path_provider.dart';

import 'dispensa.dart';

Dispensa dispensaDiQuestoSistema({String nome = 'impostazioni.json'}) =>
    DispensaSuDisco(nome);

/// Un file, di solito `impostazioni.json`. Se il disco non c'e' — nelle prove
/// non c'e' il sistema che dice dove sta la cartella — si fa come se fosse
/// vuoto: un'impostazione che non si ricorda non e' un motivo per non partire.
class DispensaSuDisco implements Dispensa {
  DispensaSuDisco([this.nome = 'impostazioni.json']);

  /// Come si chiama il file, nella cartella di supporto dell'app.
  final String nome;

  Future<File> _file() async {
    final supporto = await getApplicationSupportDirectory();
    return File('${supporto.path}/$nome');
  }

  @override
  Future<String?> leggi() async {
    try {
      final file = await _file();
      if (!await file.exists()) return null;
      return await file.readAsString();
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> scrivi(String testo) async {
    try {
      final file = await _file();
      await file.parent.create(recursive: true);
      final provvisorio = File('${file.path}.parte');
      await provvisorio.writeAsString(testo, flush: true);
      await provvisorio.rename(file.path);
    } catch (_) {
      /* Si resta con quello che si ha in memoria. */
    }
  }
}
