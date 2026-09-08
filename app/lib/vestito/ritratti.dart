/// Il ritratto di una persona: la faccia scelta in configurazione.
///
/// Sono i render 3D di Fluent Emoji, gli stessi della plancia, incastrati allo
/// stesso modo: si sceglie una testa — persona, capelli, carnagione — e un
/// busto — abito, genere, carnagione — e la testa si posa sul busto.
///
/// Il posarla non e' a occhio: i ritratti di sola testa sono inquadrati piu'
/// grandi di quelli che stanno sopra un corpo vestito, e le misure prese in
/// fase di costruzione dicono dove sta la testa in ognuno. Il rapporto fra le
/// due larghezze e' la scala, e la differenza fra i due centri e' lo
/// spostamento.
///
/// Quello che qui non c'e' — e sulla plancia si', ed e' scritto perche' si
/// sappia — sono i ritocchi a pixel: la tinta dei capelli fuori dalle varianti
/// gia' incise, la barba trapiantata da un'altra testa, le iridi, gli
/// occhiali, il colore dell'abito. Le varianti incise coprono capelli rossi,
/// bianchi, biondi, ricci e calvi e tutte e cinque le carnagioni, che e' quasi
/// tutto quello che una faccia dice da lontano.
library;

import 'package:flutter/material.dart';

import 'ritratti_catalogo.dart';

/// Quale faccia: le scelte fatte in configurazione, gia' ripulite.
class FacciaScelta {
  const FacciaScelta({
    required this.persona,
    required this.capelli,
    required this.carnagione,
    required this.vestito,
  });

  /// Dalla configurazione della plancia (`avatar.face`), con i ripieghi che
  /// usa lei: una scelta che non conosciamo vale come la prima dell'elenco.
  factory FacciaScelta.dalla(Map<Object?, Object?> grezza) {
    String dentro(Object? valore, List<String> quali) {
      final scritto = '${valore ?? ''}'.trim();
      return quali.contains(scritto) ? scritto : quali.first;
    }

    final persona = dentro(grezza['persona'], personeDeiRitratti);
    var capelli = '${grezza['capelli'] ?? ''}'.trim();
    /* «barba», «rossi», «bianchi» e «biondi» sono varianti dei lisci nella
     * configurazione nuova: la plancia le riporta li' e poi ci lavora sopra a
     * pixel. Qui invece la variante incisa c'e' gia', e si usa quella. */
    if (!capelliDeiRitratti.contains(capelli)) capelli = capelliDeiRitratti.first;
    return FacciaScelta(
      persona: persona,
      capelli: personeConICapelli.contains(persona)
          ? capelli
          : capelliDeiRitratti.first,
      carnagione: dentro(grezza['carnagione'], carnagioniDeiRitratti),
      vestito: dentro(grezza['vestito'], vestitiDeiRitratti),
    );
  }

  final String persona;
  final String capelli;
  final String carnagione;
  final String vestito;

  /// Uomo o donna, per gli abiti che esistono in un genere solo.
  String get genere => switch (persona) {
    'donna' || 'ragazza' || 'anziana' => 'donna',
    'uomo' || 'ragazzo' || 'anziano' => 'uomo',
    _ => 'donna',
  };

  /// Il file della testa, o `null` se questa combinazione non ha un render.
  String? get testa =>
      testeDeiRitratti['$persona|$capelli|$carnagione'] ??
      testeDeiRitratti['$persona|${capelliDeiRitratti.first}|$carnagione'];

  /// Il file del busto. `nessuno` vuol dire la sola testa.
  String? get busto {
    if (vestito == 'nessuno') return null;
    final chiave = abitiSintetici[vestito] ?? vestito;
    /* Il genere mancante ricade sull'altro con grazia: «In attesa» esiste solo
     * al femminile, e un ritratto maschile che lo sceglie porta quel busto
     * invece di una casella rotta. */
    return bustiDeiRitratti['$chiave|$genere|$carnagione'] ??
        bustiDeiRitratti['$chiave|donna|$carnagione'] ??
        bustiDeiRitratti['$chiave|uomo|$carnagione'];
  }
}

/// Il ritratto disegnato, in un quadrato di lato [lato].
class Ritratto extends StatelessWidget {
  const Ritratto(this.faccia, {super.key, required this.lato});

  final FacciaScelta faccia;
  final double lato;

  @override
  Widget build(BuildContext context) {
    final testa = faccia.testa;
    if (testa == null) return SizedBox(width: lato, height: lato);
    final busto = faccia.busto;
    final misuraTesta = misureDeiRitratti[testa];
    final misuraBusto = busto == null ? null : misureDeiRitratti[busto];

    /* Quanto vale un punto della tela dei render, qui. */
    final passo = lato / latoDelRitratto;

    Widget immagine(String nome, {required double misura, required Offset da}) {
      final quanti = MediaQuery.devicePixelRatioOf(context);
      return Positioned(
        left: da.dx,
        top: da.dy,
        width: misura,
        height: misura,
        child: Image.asset(
          'assets/ritratti/$nome.webp',
          width: misura,
          height: misura,
          /* Decodificata alla misura che serve: un render da 192 tenuto in
           * memoria a piena taglia per una faccia da 60 punti e' otto volte i
           * pixel che si vedono. */
          cacheWidth: (misura * quanti).round(),
          cacheHeight: (misura * quanti).round(),
          filterQuality: FilterQuality.medium,
        ),
      );
    }

    if (busto == null || misuraBusto == null || misuraTesta == null) {
      return SizedBox(
        width: lato,
        height: lato,
        child: Stack(
          children: [immagine(testa, misura: lato, da: Offset.zero)],
        ),
      );
    }

    /* La testa si riscala sul busto: il rapporto fra le due larghezze, e lo
     * scarto fra i due centri. */
    final scala = misuraBusto.largo / misuraTesta.largo;
    final x = misuraBusto.cx - misuraTesta.cx * scala;
    final y = misuraBusto.alto - misuraTesta.alto * scala;

    return SizedBox(
      width: lato,
      height: lato,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          immagine(busto, misura: lato, da: Offset.zero),
          immagine(
            testa,
            misura: lato * scala,
            da: Offset(x * passo, y * passo),
          ),
        ],
      ),
    );
  }
}
