/// Nel browser il ponte e' spento: nessuna copia, da nessuna parte.
library;

import 'copia.dart';

CopiaDelPortachiavi copiaDiQuestoSistema({
  required String nome,
  String? cartella,
}) => const _Nessuna();

class _Nessuna implements CopiaDelPortachiavi {
  const _Nessuna();

  @override
  Future<Map<String, String>?> leggi() async => null;

  @override
  Future<void> scrivi(Map<String, String> segni) async {}
}
