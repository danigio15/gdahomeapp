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
  });

  final bool visibile;
  final Collegamento? collegamento;
  final GlobalKey<NavigatorState> navigatore;

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

/// Nel browser non c'e' nessuna auto da ascoltare.
void ascoltaLAuto() {}
