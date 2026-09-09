/// Acquisti: cosa e' acceso su questa casa, e cosa si puo' sbloccare.
///
/// La schermata comincia da quello che **non** si paga, e non e' cortesia:
/// un'app che apre la pagina degli acquisti con un listino sembra un'app che
/// ti ha fatto entrare per venderti qualcosa. Qui la prima scheda dice cosa
/// resta gratis per sempre, la seconda cosa e' acceso adesso, e solo dopo
/// viene il listino.
///
/// Non compra ancora niente: i bottoni ci sono e dicono cosa faranno, perche'
/// un catalogo si guarda prima di scriverlo (`docs/ACQUISTI.md`).
library;

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../vestito/oggetti.dart';
import '../vestito/pezzi.dart';
import 'acquisti/catalogo.dart';

class SchermataDegliAcquisti extends StatelessWidget {
  const SchermataDegliAcquisti({
    super.key,
    required this.collegamento,
    this.compra,
  });

  final Collegamento collegamento;

  /// Cosa fare quando si tocca un acquisto. Ancora nessuno: il giro coi
  /// negozi e col centralino e' da scrivere.
  final void Function(Acquisto quale)? compra;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final casa = collegamento.casa?.nome ?? 'questa casa';
    return ListView(
      key: const PageStorageKey('acquisti'),
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
      children: [
        _Prova(casa: casa),
        const SizedBox(height: 22),
        const Insegna('Gratis, per sempre'),
        Scheda(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Vedere e comandare casa tua non si paga, e non si paghera\'.',
                style: Theme.of(context).textTheme.bodyMedium
                    ?.copyWith(fontWeight: FontWeight.w600, height: 1.4),
              ),
              const SizedBox(height: 12),
              for (final riga in sempreGratis)
                Padding(
                  padding: const EdgeInsets.only(bottom: 7),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.check_rounded,
                        size: 17,
                        color: colori.primary,
                      ),
                      const SizedBox(width: 9),
                      Expanded(
                        child: Text(
                          riga,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: colori.onSurfaceVariant,
                                height: 1.35,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        const Insegna('Togliere i limiti'),
        _Voce(quale: casaCompleta, compra: compra),
        const SizedBox(height: 10),
        _Voce(quale: casaCompletaAlMese, compra: compra),
        const SizedBox(height: 22),
        const Insegna('Oppure una cosa sola'),
        for (final quale in singoli) ...[
          _Voce(quale: quale, compra: compra),
          const SizedBox(height: 10),
        ],
        const SizedBox(height: 12),
        const Insegna('Senza passare dal negozio'),
        for (final quale in senzaNegozio) ...[
          _Voce(quale: quale, compra: compra),
          const SizedBox(height: 10),
        ],
        const SizedBox(height: 12),
        _Nota(),
      ],
    );
  }
}

/// La prova: cosa e' acceso adesso, e fino a quando.
class _Prova extends StatelessWidget {
  const _Prova({required this.casa});
  final String casa;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Scheda(
      colore: colori.primaryContainer,
      bordo: colori.primaryContainer,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Oggetto('agenda', lato: 26),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Prova aperta su $casa',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: colori.onPrimaryContainer,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const Bollino('14 giorni'),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'Fino al 23 settembre hai tutto acceso, senza aver dato una '
            'carta a nessuno. Dopo, quello che sta qui sotto resta gratis '
            'lo stesso: si chiudono solo i limiti.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: colori.onPrimaryContainer.withValues(alpha: 0.85),
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}

class _Voce extends StatelessWidget {
  const _Voce({required this.quale, this.compra});

  final Acquisto quale;
  final void Function(Acquisto quale)? compra;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final gratis = quale.modo == Modo.gratis;
    return Scheda(
      quandoPremuta: compra == null ? null : () => compra!(quale),
      bordo: quale.consigliato ? colori.primary : null,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Oggetto(quale.disegno, lato: 28),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        quale.titolo,
                        style: Theme.of(context).textTheme.titleSmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                    ),
                    if (quale.consigliato) ...[
                      const SizedBox(width: 8),
                      const Bollino('consigliato'),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  quale.sotto,
                  style: Theme.of(context).textTheme.bodySmall
                      ?.copyWith(color: colori.onSurfaceVariant, height: 1.4),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                quale.soldi,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: gratis ? colori.primary : colori.onSurface,
                ),
              ),
              if (!gratis)
                Text(
                  quale.quandoSiPaga,
                  style: Theme.of(context).textTheme.labelSmall
                      ?.copyWith(color: colori.onSurfaceVariant),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Le due righe che tolgono le domande: per casa, e non per telefono.
class _Nota extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Scheda(
      colore: colori.surfaceContainerHigh,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Si compra per la casa, non per il telefono',
            style: Theme.of(context).textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            'Quello che sblocchi lo vedono tutti i telefoni abbinati a questa '
            'casa: il tablet in cucina non si ricompra niente. Se hai piu\' '
            'case, ognuna fa storia a se\'. E «Ripristina gli acquisti» '
            'rimette tutto anche su un telefono nuovo.',
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: colori.onSurfaceVariant, height: 1.45),
          ),
        ],
      ),
    );
  }
}
