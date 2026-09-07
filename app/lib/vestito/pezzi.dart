/// I pezzi che tornano in tutte le schermate.
///
/// Una scheda, un'insegna, una tessera, un pallino, uno stato vuoto. Sono
/// pochi e sono qui perche' due schermate che disegnano la stessa cosa in due
/// modi diversi sono la prima cosa che fa sembrare un'app raffazzonata.
library;

import 'package:flutter/material.dart';

/// Una scheda: fondo chiaro, angoli morbidi, niente ombra.
class Scheda extends StatelessWidget {
  const Scheda({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.quandoPremuta,
    this.colore,
    this.bordo,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? quandoPremuta;
  final Color? colore;
  final Color? bordo;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final forma = BorderRadius.circular(20);
    return Material(
      color: colore ?? colori.surfaceContainerLowest,
      shape: RoundedRectangleBorder(
        borderRadius: forma,
        side: bordo == null ? BorderSide.none : BorderSide(color: bordo!),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: quandoPremuta,
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

/// Il titolo di una sezione: piccolo, spaziato, di lato.
class Insegna extends StatelessWidget {
  const Insegna(this.testo, {super.key, this.azione});

  final String testo;
  final Widget? azione;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(left: 4, right: 4, bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              testo.toUpperCase(),
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: colori.onSurfaceVariant,
                letterSpacing: 1.4,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          if (azione != null) azione!,
        ],
      ),
    );
  }
}

/// Un'icona dentro un cerchio tenue.
class Cerchietto extends StatelessWidget {
  const Cerchietto({
    super.key,
    required this.icona,
    this.colore,
    this.fondo,
    this.lato = 40,
  });

  final IconData icona;
  final Color? colore;
  final Color? fondo;
  final double lato;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Container(
      width: lato,
      height: lato,
      decoration: BoxDecoration(
        color: fondo ?? colori.primaryContainer,
        shape: BoxShape.circle,
      ),
      child: Icon(
        icona,
        size: lato * 0.52,
        color: colore ?? colori.onPrimaryContainer,
      ),
    );
  }
}

/// Come si presenta una tessera del riassunto.
enum TonoDellaTessera { quieto, acceso, attenzione }

/// Una tessera del riassunto: icona, numero grande, etichetta sotto.
class Tessera extends StatelessWidget {
  const Tessera({
    super.key,
    required this.icona,
    required this.titolo,
    required this.valore,
    this.dettaglio,
    this.tono = TonoDellaTessera.quieto,
    this.quandoPremuta,
  });

  final IconData icona;
  final String titolo;
  final String valore;
  final String? dettaglio;
  final TonoDellaTessera tono;
  final VoidCallback? quandoPremuta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final (fondoIcona, coloreIcona) = switch (tono) {
      TonoDellaTessera.quieto => (
        colori.surfaceContainer,
        colori.onSurfaceVariant,
      ),
      TonoDellaTessera.acceso => (
        colori.secondaryContainer,
        colori.onSecondaryContainer,
      ),
      TonoDellaTessera.attenzione => (
        colori.errorContainer,
        colori.onErrorContainer,
      ),
    };
    return Scheda(
      quandoPremuta: quandoPremuta,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Cerchietto(icona: icona, fondo: fondoIcona, colore: coloreIcona),
          const SizedBox(height: 14),
          Text(
            valore,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: testi.titleLarge?.copyWith(height: 1.1),
          ),
          const SizedBox(height: 2),
          Text(
            titolo,
            style: testi.bodyMedium?.copyWith(color: colori.onSurfaceVariant),
          ),
          if (dettaglio != null) ...[
            const SizedBox(height: 6),
            Text(
              dettaglio!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
            ),
          ],
        ],
      ),
    );
  }
}

/// Un pallino di stato.
class Pallino extends StatelessWidget {
  const Pallino(this.colore, {super.key, this.lato = 8});
  final Color colore;
  final double lato;

  @override
  Widget build(BuildContext context) => Container(
    width: lato,
    height: lato,
    decoration: BoxDecoration(color: colore, shape: BoxShape.circle),
  );
}

/// Un'etichetta piccola in una pillola: «presto», «aperta».
class Bollino extends StatelessWidget {
  const Bollino(this.testo, {super.key, this.colore, this.fondo});
  final String testo;
  final Color? colore;
  final Color? fondo;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: fondo ?? colori.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        testo,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: colore ?? colori.onSurfaceVariant,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

/// Quando non c'e' niente da far vedere: un'icona, due righe, e magari un
/// bottone. Sta dentro una lista, cosi' il gesto di tirare giu' per riprovare
/// funziona lo stesso.
class StatoVuoto extends StatelessWidget {
  const StatoVuoto({
    super.key,
    required this.icona,
    required this.titolo,
    required this.sotto,
    this.azione,
    this.dentroUnaLista = false,
  });

  final IconData icona;
  final String titolo;
  final String sotto;
  final Widget? azione;

  /// `true` quando sta gia' dentro una lista che scorre: allora e' una
  /// colonna e basta, perche' una lista dentro una lista non scorre bene.
  final bool dentroUnaLista;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final pezzi = [
      Center(
        child: Cerchietto(
          icona: icona,
          lato: 76,
          fondo: colori.surfaceContainer,
          colore: colori.onSurfaceVariant,
        ),
      ),
      const SizedBox(height: 20),
      Text(titolo, textAlign: TextAlign.center, style: testi.titleLarge),
      const SizedBox(height: 8),
      Text(
        sotto,
        textAlign: TextAlign.center,
        style: testi.bodyMedium?.copyWith(color: colori.onSurfaceVariant),
      ),
      if (azione != null) ...[
        const SizedBox(height: 24),
        Center(child: azione!),
      ],
    ];
    const bordo = EdgeInsets.fromLTRB(32, 72, 32, 32);
    if (dentroUnaLista) {
      return Padding(
        padding: bordo,
        child: Column(mainAxisSize: MainAxisSize.min, children: pezzi),
      );
    }
    return ListView(padding: bordo, children: pezzi);
  }
}
