/// I pezzi che tornano in tutte le pagine della plancia.
///
/// Il riquadro di stato in cima («ACCESE 4/8»), la coppia di bottoni
/// («Accendi tutte · Spegni tutte»), la pastiglia con una parola, l'insegna
/// col conto. Sono qui perche' cinque pagine che disegnano la stessa cosa in
/// cinque modi sono la prima cosa che fa sembrare una plancia raffazzonata.
library;

import 'package:flutter/material.dart';

import '../../ponte/errori.dart';
import '../../vestito/pezzi.dart';
import '../../vestito/tema.dart';

/// Il colore di una sezione, da `#rrggbb`.
Color coloreDaTesto(String esadecimale, [Color ripiego = Colori.notteChiara]) {
  final testo = esadecimale.replaceFirst('#', '');
  if (testo.length != 6) return ripiego;
  final valore = int.tryParse(testo, radix: 16);
  return valore == null ? ripiego : Color(0xFF000000 | valore);
}

/// Un comando alla casa, con l'errore detto a schermo se non va.
Future<void> esegui(
  BuildContext context,
  Future<void> Function() comando,
) async {
  try {
    await comando();
  } on ErroreDelPonte catch (errore) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(errore.spiegazione)));
  }
}

/// Un riquadro con un'etichetta piccola e un valore grande: «STATO · 4/8
/// ACCESE», «AMBIENTE MEDIO · 23,1°».
class RiquadroDiStato extends StatelessWidget {
  const RiquadroDiStato({
    super.key,
    required this.etichetta,
    required this.valore,
    this.sotto,
    this.colore,
  });

  final String etichetta;
  final String valore;
  final String? sotto;
  final Color? colore;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Scheda(
      padding: const EdgeInsets.fromLTRB(14, 10, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            etichetta.toUpperCase(),
            style: testi.labelSmall?.copyWith(
              color: colori.onSurfaceVariant,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            valore,
            style: testi.titleLarge?.copyWith(
              fontWeight: FontWeight.w700,
              color: colore ?? colori.onSurface,
            ),
          ),
          if (sotto != null)
            Text(
              sotto!,
              style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
            ),
        ],
      ),
    );
  }
}

/// Due bottoni affiancati dentro una scheda: «Accendi tutte · Spegni tutte».
class DueBottoni extends StatelessWidget {
  const DueBottoni({
    super.key,
    required this.sinistra,
    required this.destra,
    this.iconaSinistra,
    this.iconaDestra,
    this.quandoSinistra,
    this.quandoDestra,
  });

  final String sinistra;
  final String destra;
  final IconData? iconaSinistra;
  final IconData? iconaDestra;
  final VoidCallback? quandoSinistra;
  final VoidCallback? quandoDestra;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    Widget bottone(String testo, IconData? icona, VoidCallback? quando) =>
        Expanded(
          child: TextButton(
            onPressed: quando,
            style: TextButton.styleFrom(
              foregroundColor: colori.onSurface,
              minimumSize: const Size(0, 48),
              shape: const RoundedRectangleBorder(),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icona != null) ...[
                  Icon(icona, size: 18),
                  const SizedBox(width: 6),
                ],
                Text(testo),
              ],
            ),
          ),
        );
    return Scheda(
      padding: EdgeInsets.zero,
      child: IntrinsicHeight(
        child: Row(
          children: [
            bottone(sinistra, iconaSinistra, quandoSinistra),
            VerticalDivider(width: 1, color: colori.outlineVariant),
            bottone(destra, iconaDestra, quandoDestra),
          ],
        ),
      ),
    );
  }
}

/// Una pastiglia con una parola, e magari un'icona: «ACCESA», «Casa».
/// Bottoni due per riga.
///
/// Il tema da' ai bottoni un'altezza fissa e nessuna larghezza, cioe' tutta
/// quella che trovano: sei tasti diventano sei righe, e una centrale con sei
/// inserimenti riempiva uno schermo intero per dire una cosa sola. Qui la
/// larghezza gliela si da', e chi resta da solo in fondo tiene la sua meta'
/// invece di allargarsi e sembrare un tasto diverso dagli altri.
class DuePerRiga extends StatelessWidget {
  const DuePerRiga(this.figli, {super.key, this.spazio = 8});

  final List<Widget> figli;
  final double spazio;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, misure) {
      final larghezza = (misure.maxWidth - spazio) / 2;
      return Wrap(
        spacing: spazio,
        runSpacing: spazio,
        children: [
          for (final figlio in figli) SizedBox(width: larghezza, child: figlio),
        ],
      );
    },
  );
}

class Pillolina extends StatelessWidget {
  const Pillolina({
    super.key,
    required this.testo,
    required this.colore,
    this.icona,
    this.piena = false,
    this.maiuscolo = false,
  });

  final String testo;
  final Color colore;
  final IconData? icona;
  final bool piena;
  final bool maiuscolo;

  @override
  Widget build(BuildContext context) {
    final inchiostro = piena ? Colors.white : colore;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: piena ? colore : colore.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icona != null) ...[
            Icon(icona, size: 13, color: inchiostro),
            const SizedBox(width: 4),
          ],
          Text(
            maiuscolo ? testo.toUpperCase() : testo,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: inchiostro,
              fontWeight: FontWeight.w700,
              letterSpacing: maiuscolo ? 0.6 : 0,
            ),
          ),
        ],
      ),
    );
  }
}

/// L'insegna di un gruppo col suo conto: «SOGGIORNO ⟨2/2⟩», e magari
/// un'azione a destra.
class InsegnaConConto extends StatelessWidget {
  const InsegnaConConto({
    super.key,
    required this.testo,
    this.conto,
    this.azione,
    this.icona,
  });

  final String testo;
  final String? conto;
  final Widget? azione;
  final Widget? icona;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(left: 4, right: 4, bottom: 8, top: 4),
      child: Row(
        children: [
          if (icona != null) ...[icona!, const SizedBox(width: 6)],
          Text(
            testo.toUpperCase(),
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: colori.onSurfaceVariant,
              letterSpacing: 1.4,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (conto != null) ...[const SizedBox(width: 8), Bollino(conto!)],
          const Spacer(),
          if (azione != null) azione!,
        ],
      ),
    );
  }
}

/// Il disegno di una stanza, da quello che c'e' scritto in configurazione:
/// un'emoji passa com'e', un `mdi:…` diventa il disegno piu' vicino di casa.
Widget disegnoDellaStanza(String icona, {double lato = 20, Color? colore}) {
  final testo = icona.trim();
  if (testo.isEmpty) {
    return Icon(Icons.door_front_door_outlined, size: lato, color: colore);
  }
  if (!testo.startsWith('mdi:')) {
    return Text(testo, style: TextStyle(fontSize: lato * 0.9));
  }
  return Icon(_iconaMdi(testo.substring(4)), size: lato, color: colore);
}

const _disegniMdi = [
  (['sofa', 'couch'], Icons.weekend_rounded),
  (['stove', 'kitchen', 'chef', 'fridge'], Icons.kitchen_rounded),
  (['bed'], Icons.bed_rounded),
  (['baby', 'child'], Icons.child_care_rounded),
  (['shower', 'bath', 'toilet'], Icons.shower_rounded),
  (['desk', 'office', 'laptop'], Icons.desk_rounded),
  (['garage', 'car'], Icons.garage_rounded),
  (['tree', 'flower', 'garden', 'grass'], Icons.park_rounded),
  (['washing', 'laundry'], Icons.local_laundry_service_rounded),
  (['stairs'], Icons.stairs_rounded),
  (['door'], Icons.door_front_door_rounded),
  (['pool'], Icons.pool_rounded),
  (['television', 'tv'], Icons.tv_rounded),
  (['silverware', 'table'], Icons.table_restaurant_rounded),
  (['home'], Icons.home_rounded),
];

IconData _iconaMdi(String nome) {
  final chiave = nome.toLowerCase();
  for (final (parole, icona) in _disegniMdi) {
    if (parole.any(chiave.contains)) return icona;
  }
  return Icons.meeting_room_rounded;
}
