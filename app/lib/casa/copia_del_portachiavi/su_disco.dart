/// Sul telefono: un file nella cartella di supporto dell'app.
///
/// Sull'iPhone quella cartella e' fuori dalle copie di iCloud e di iTunes
/// (`AppDelegate.fuoriDalleCopie`): la copia dei segni non esce dal telefono,
/// come i segni stessi. Disinstallando l'app se ne va con lei.
library;

import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import 'copia.dart';

CopiaDelPortachiavi copiaDiQuestoSistema({
  required String nome,
  String? cartella,
}) => CopiaSuDisco(nome: nome, cartella: cartella);

/// Il file `portachiavi-ponte-<nome>.json`: un oggetto JSON, chiave per
/// chiave. Si scrive su un file di passaggio e poi lo si rinomina, cosi' una
/// scrittura interrotta a meta' lascia la copia di prima, mai una storta.
class CopiaSuDisco implements CopiaDelPortachiavi {
  CopiaSuDisco({required this.nome, this.cartella});

  /// Lo scomparto del portachiavi di cui e' la copia: `casa`, `gdanav`.
  final String nome;

  /// Dove sta; `null`: la cartella di supporto dell'app. Nelle prove una
  /// cartella provvisoria.
  final String? cartella;

  static String nomeDelFile(String nome) => 'portachiavi-ponte-$nome.json';

  Future<File> _file() async {
    final dove = cartella ?? (await getApplicationSupportDirectory()).path;
    return File('$dove/${nomeDelFile(nome)}');
  }

  @override
  Future<Map<String, String>?> leggi() async {
    try {
      final file = await _file();
      if (!await file.exists()) return null;
      final letto = jsonDecode(await file.readAsString());
      if (letto is! Map) return null;
      return {
        for (final MapEntry(:key, :value) in letto.entries)
          if (key is String && value is String) key: value,
      };
    } catch (_) {
      /* Una copia che non c'e', o che non si legge, vale come nessuna copia:
       * il portachiavi resta com'e'. */
      return null;
    }
  }

  @override
  Future<void> scrivi(Map<String, String> segni) async {
    final file = await _file();
    await file.parent.create(recursive: true);
    final provvisorio = File('${file.path}.parte');
    await provvisorio.writeAsString(jsonEncode(segni), flush: true);
    await provvisorio.rename(file.path);
  }
}
