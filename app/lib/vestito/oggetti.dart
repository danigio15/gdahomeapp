/// Gli oggetti delle sezioni: i disegni della plancia, non dei simboli.
///
/// Sulla plancia ogni sezione ha un oggetto disegnato — la lampadina col vetro
/// e la ghiera, il fiocco di ghiaccio, il termometro col mercurio — con una
/// sola fonte di luce per tutti e la sua ombra sotto. Non sono emoji (ogni
/// telefono le disegna a modo suo, e sei tessere vicine finiscono con sei
/// stili diversi) e non sono simboli a contorno (sembrano finti: una lampadina
/// spenta fatta di due linee grigie non sembra una lampadina).
///
/// Qui dentro non ce n'e' nemmeno uno rifatto a somiglianza. Sono **gli
/// stessi**, presi dalla plancia e messi in `assets/oggetti` uno per file: chi
/// passa dal telefono alla dashboard deve riconoscere le sue cose, e «fatto
/// somigliante» vuol dire un'altra app.
library;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Un oggetto, disegnato.
///
/// `quantoSpento` lo smorza, e va tenuto **basso**. Sulla plancia le voci
/// della barra che non si stanno guardando perdono poco piu' di un quarto del
/// colore — `grayscale(.28)` — non tutto: una fila di disegni grigi non sembra
/// una barra a riposo, sembra un'app che non ha finito di caricare. Quello che
/// dice «sei qui» e' la pastiglia scura sotto la voce scelta, non il colore
/// tolto a tutte le altre.
class Oggetto extends StatelessWidget {
  const Oggetto(
    this.disegno, {
    super.key,
    this.lato = 19,
    this.quantoSpento = 0,
    this.velo = 1,
  });

  /// Il nome del disegno: `luci`, `clima`, `tapparelle`…
  final String disegno;
  final double lato;

  /// Quanto colore togliergli, da 0 a 1.
  final double quantoSpento;

  /// Quanto e' opaco, da 0 a 1. Serve alle voci che non ci sono ancora.
  final double velo;

  @override
  Widget build(BuildContext context) {
    final quadro = SvgPicture.asset(
      'assets/oggetti/$disegno.svg',
      width: lato,
      height: lato,
      /* Un disegno che non c'e' non deve lasciare un buco che sposta tutto il
       * resto: al suo posto resta il vuoto della stessa misura. */
      placeholderBuilder: (_) => SizedBox(width: lato, height: lato),
    );
    final tinto = quantoSpento <= 0
        ? quadro
        : ColorFiltered(
            colorFilter: ColorFilter.matrix(_menoColore(quantoSpento)),
            child: quadro,
          );
    return velo >= 1 ? tinto : Opacity(opacity: velo, child: tinto);
  }
}

/// La matrice che toglie una parte del colore.
///
/// A `quanto = 0` non tocca niente, a `1` resta il grigio: in mezzo si mescola
/// fra i due, che e' quello che fa il filtro dei fogli di stile.
List<double> _menoColore(double quanto) {
  final q = quanto.clamp(0.0, 1.0);
  const r = 0.2126, v = 0.7152, b = 0.0722;
  return <double>[
    r * q + (1 - q), v * q, b * q, 0, 0, //
    r * q, v * q + (1 - q), b * q, 0, 0, //
    r * q, v * q, b * q + (1 - q), 0, 0, //
    0, 0, 0, 1, 0,
  ];
}

/// Quali disegni ci sono. Serve a chi deve sapere se una chiave ne ha uno.
const disegniDegliOggetti = <String>{
  'agenda',
  'allagamenti',
  'allerte',
  'aperture',
  'aria',
  'assistenza',
  'avvisi',
  'azioni',
  'backup',
  'batterie',
  'caldaia',
  'clima',
  'custom',
  'elettrodomestici',
  'energia',
  'ev',
  'evidenza',
  'fumo',
  'home',
  'impostazioni',
  'irrigazione',
  'luci',
  'media',
  'mie',
  'minipc',
  'persone',
  'piscina',
  'prese',
  'rifiuti',
  'robot',
  'runtime',
  'scaldabagno',
  'segnalazioni',
  'sicurezza',
  'solare',
  'stanze',
  'tapparelle',
  'telecamere',
  'temperatura',
  'todo',
  'ups',
  'widget',
};

/// Il disegno di una tessera, dalla sua chiave.
///
/// Le chiavi delle tessere e i nomi dei disegni sono le stesse parole — e non
/// per caso: vengono tutte e due dalla plancia. Quelle che uno si costruisce
/// da se' («custom-2») non hanno un oggetto nostro: per quelle c'e' il punto
/// esclamativo dentro il triangolo, che e' quello che usa la plancia.
String disegnoDellaTessera(String chiave) {
  final radice = chiave.split(RegExp('[_-]')).first;
  return disegniDegliOggetti.contains(radice) ? radice : 'custom';
}
