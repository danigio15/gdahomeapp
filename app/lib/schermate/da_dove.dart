/// «In casa» o «da fuori», con un pallino del colore giusto.
///
/// Sembra un dettaglio tecnico e invece e' la prima domanda di chi apre l'app
/// fuori casa e vede qualcosa di strano: *sto guardando dati veri o vecchi?*
///
/// Sta in due posti — sotto il nome della casa, in cima, e nel menu laterale —
/// ed e' lo stesso pezzo apposta: cosi' non puo' dire due cose diverse.
library;

import 'package:flutter/material.dart';

import '../casa/casa_conosciuta.dart';
import '../casa/collegamento.dart';
import '../vestito/pezzi.dart';
import '../vestito/tema.dart';

class DaDoveSiPassa extends StatelessWidget {
  const DaDoveSiPassa(this.collegamento, {super.key, this.piccolo = false});

  final Collegamento collegamento;

  /// `true` quando sta in una riga stretta, sotto un titolo.
  final bool piccolo;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final (testo, colore) = switch ((
      collegamento.comeVa,
      collegamento.daDove,
    )) {
      (ComeVa.aperta, DaDove.daDentro) => ('in casa', Colori.bene),
      (ComeVa.aperta, DaDove.daFuori) => ('da fuori', Colori.ambraScura),
      (ComeVa.aperta, DaDove.dalCentralino) => ('da fuori', Colori.ambraScura),
      (ComeVa.aperta, null) => ('collegata', Colori.bene),
      (ComeVa.inCammino, _) => (
        'sto cercando la casa…',
        colori.onSurfaceVariant,
      ),
      (ComeVa.irraggiungibile, _) => ('non raggiungibile', colori.error),
      (ComeVa.segnoScaduto, _) => ('da riabbinare', colori.error),
      (ComeVa.nessunaCasa, _) => ('nessuna casa', colori.onSurfaceVariant),
    };
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Pallino(colore, lato: piccolo ? 7 : 8),
        SizedBox(width: piccolo ? 6 : 7),
        Flexible(
          child: Text(
            testo,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: (piccolo ? testi.bodySmall : testi.bodyMedium)?.copyWith(
              color: colori.onSurfaceVariant,
            ),
          ),
        ),
      ],
    );
  }
}
