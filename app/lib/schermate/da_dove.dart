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
import '../parole.dart';
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
      (ComeVa.aperta, DaDove.daDentro) => (
        inLingua(it: 'in casa', en: 'at home'),
        Colori.bene,
      ),
      (ComeVa.aperta, DaDove.daFuori) => (
        inLingua(it: 'da fuori', en: 'away'),
        Colori.ambraScura,
      ),
      (ComeVa.aperta, DaDove.dalCentralino) => (
        inLingua(it: 'da fuori', en: 'away'),
        Colori.ambraScura,
      ),
      (ComeVa.aperta, null) => (
        inLingua(it: 'collegata', en: 'connected'),
        Colori.bene,
      ),
      (ComeVa.inCammino, _) => (
        inLingua(it: 'sto cercando la casa…', en: 'looking for your home…'),
        colori.onSurfaceVariant,
      ),
      (ComeVa.irraggiungibile, _) => (
        inLingua(it: 'non raggiungibile', en: 'unreachable'),
        colori.error,
      ),
      (ComeVa.segnoScaduto, _) => (
        inLingua(it: 'da riabbinare', en: 'needs pairing again'),
        colori.error,
      ),
      (ComeVa.nessunaCasa, _) => (
        inLingua(it: 'nessuna casa', en: 'no home'),
        colori.onSurfaceVariant,
      ),
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
