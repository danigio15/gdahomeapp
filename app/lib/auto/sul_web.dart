/// La fotografia per l'auto, nel browser: non si lascia da nessuna parte.
///
/// Android Auto e' un telefono attaccato a una macchina. Nel browser non c'e',
/// e un file nemmeno. La funzione c'e' lo stesso perche' la firma e' una sola
/// — chi apre la plancia non sa su che sistema gira — e qui dice «no».
library;

import 'la_foto.dart';

/// Sempre `false`: non c'era niente dove scriverla.
Future<bool> lasciaLaFotoAllAuto(
  String detto, {
  required String casa,
  bool daSola = true,
}) async => false;

/// Sempre `null`: nessuna auto ha lasciato niente da premere.
Future<String?> prendiIlComandoDellAuto() async => null;

/// Nessuna ricetta: nel browser non c'e' niente che parta da solo.
Future<List<RicettaDellAzione>> leRicetteDellAuto() async => const [];
