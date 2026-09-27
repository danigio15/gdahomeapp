/// I pezzi che tornano in tutte le schermate.
///
/// Una scheda, un'insegna, un cerchietto, un pallino, un bollino, uno stato
/// vuoto. Sono pochi e sono qui perche' due schermate che disegnano la stessa
/// cosa in due modi diversi sono la prima cosa che fa sembrare un'app
/// raffazzonata.
library;

import 'package:flutter/material.dart';

import 'tema.dart';

/// Una scheda: bianca, angoli morbidi, e un'ombra che la stacca dal fondo.
///
/// E' il [Vetro] di gdanav — `gdanav_app/lib/componenti/vetro.dart` — con gli
/// stessi due strati d'ombra e lo stesso raggio: le due app sono dello stesso
/// produttore e una scheda deve essere la stessa scheda.
///
/// L'ombra non e' un vezzo: e' quello che fa **galleggiare** la scheda sopra
/// il cielo invece di incollarcela. Senza, il bianco su un fondo chiaro non si
/// vede, e la schermata sembra un foglio a righe.
///
/// **E niente filo intorno.** Ce l'aveva, e con l'ombra piu' marcata di gdanav
/// diventava un doppio contorno: l'ombra separa gia'. Il filo resta solo dove
/// qualcuno lo chiede apposta ([bordo]), che vuol dire «questa scheda dice
/// qualcosa» — un avviso, un errore.
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

  /// L'ombra di gdanav: due strati, uno largo che stacca e uno corto che
  /// appoggia. Sta in [Colori.ombra], perche' non e' solo di questa scheda:
  /// la usano il menu, le mattonelle, tutto quello che si alza dal fondo.
  static List<BoxShadow> ombra(BuildContext context) =>
      Colori.ombra(scuro: Theme.of(context).brightness == Brightness.dark);

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final forma = BorderRadius.circular(18);
    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: forma, boxShadow: ombra(context)),
      child: Material(
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
      ),
    );
  }
}

/// Il titolo di una sezione dentro una pagina.
///
/// **Scritto com'e', non in maiuscoletto spaziato.** Era
/// `LE TUE CASE` — labelMedium, tutte maiuscole, un punto e mezzo di aria fra
/// le lettere — ed e' la cosa che faceva sembrare le due app di due
/// produttori diversi: in gdanav un titolo di sezione e' una riga normale
/// (`titleSmall`, `la_tua_auto.dart`), e in gdahome era un'etichetta da
/// pannello di controllo.
///
/// Il maiuscoletto spaziato ha anche un difetto suo, e si vedeva: una parola
/// lunga come `CONFIGURAZIONE` in maiuscolo occupa un terzo in piu' di spazio
/// e si legge un terzo piu' piano. Resta nel menu, sui titoli dei gruppi, che
/// non si leggono: si contano.
class Insegna extends StatelessWidget {
  const Insegna(this.testo, {super.key, this.azione});

  final String testo;
  final Widget? azione;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Padding(
      /* Quattro, che sommati ai sedici della pagina fanno i venti di gdanav:
         li' il testo rientra di venti e le carte di sedici, e il titolo si
         stacca appena da quello che intitola. */
      padding: const EdgeInsets.only(left: 4, right: 4, bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              testo,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: colori.onSurface,
                fontWeight: FontWeight.w700,
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
