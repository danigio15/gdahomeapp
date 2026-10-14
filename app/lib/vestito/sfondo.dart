/// Il fondo dell'app: un colore, e basta.
///
/// C'erano due aloni sfocati — uno verde, uno celeste — che galleggiavano
/// sotto le schede, come sulla plancia. Erano la cosa che faceva sembrare
/// l'app disegnata da un modello: il fondo a macchie di luce e' il vestito di
/// mille app uscite tutte uguali nello stesso anno, e sotto una lista di
/// interruttori non dice niente. Adesso il fondo e' il grigio appena azzurrino
/// del tema (`Colori.fondo`, `Colori.fondoScuro`), e le schede ci si
/// appoggiano con la loro ombra: e' l'ombra a staccarle, non la macchia.
///
/// Sta sotto tutto, una volta sola, dietro ogni schermata: le pagine hanno il
/// fondo trasparente (`scaffoldBackgroundColor`) e ci stanno sopra. Il nome
/// e il posto restano quelli di prima — `SfondoVivo`, in `main.dart` — cosi'
/// nessuna schermata se ne accorge; «vivo» ormai vuol dire solo che cambia
/// col chiaro e scuro.
library;

import 'package:flutter/material.dart';

import 'tema.dart';

class SfondoVivo extends StatelessWidget {
  const SfondoVivo({super.key, this.child});

  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final scuro = Theme.of(context).brightness == Brightness.dark;
    return ColoredBox(
      color: scuro ? Colori.fondoScuro : Colori.fondo,
      child: child ?? const SizedBox.shrink(),
    );
  }
}
