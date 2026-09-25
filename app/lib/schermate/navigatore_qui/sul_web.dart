/// Il navigatore nel browser: non c'e'.
///
/// La voce del menu nella webapp non compare (`Sezione.navigatore` e' solo
/// dell'app); questa schermata c'e' perche' la firma e' una sola.
library;

import 'package:flutter/widgets.dart';

import '../../casa/collegamento.dart';

class IlNavigatore extends StatelessWidget {
  const IlNavigatore({
    super.key,
    required this.visibile,
    required this.navigatore,
    this.collegamento,
    this.menuOspite,
    this.apriIlMenu,
  });

  final bool visibile;
  final Collegamento? collegamento;
  final VoidCallback? menuOspite;
  final ValueNotifier<bool>? apriIlMenu;
  final GlobalKey<NavigatorState> navigatore;

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

/// Nel browser non c'e' nessuna auto da ascoltare.
void ascoltaLAuto() {}

/// Nel browser la tessera non c'e': non c'e' il navigatore.
Widget? laTesseraDelNavigatore({
  required bool scelta,
  required VoidCallback apri,
  required VoidCallback impostazioni,
  Object? fonte,
}) => null;
