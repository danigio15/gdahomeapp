/// Le impostazioni dell'**app**: quelle che non sono della casa.
///
/// «Mi fai un'altra voce nel menu che sarebbe impostazioni app, e tutta la
/// parte legata a sicurezza app, codice, biometrico eccetera la sposti qui:
/// ora e' presente nell'icona catenaccio.»
///
/// ## Cos'era, e perche' non va bene
///
/// Era un **catenaccio in alto a destra** nella pagina «Le tue case». Per
/// arrivarci bisognava: aprire il menu, scegliere la casa in testa al
/// pannello, atterrare su una pagina che parla di case, e li' notare
/// un'icona. Quattro passi, e nessuno dei quattro dice «impostazioni».
///
/// Un'impostazione come questa si cerca **una volta sola**, a mente fredda, e
/// si cerca dove stanno le impostazioni. Adesso e' una voce del menu.
///
/// ## Cosa ci sta dentro
///
/// Oggi la sicurezza, e basta: il lucchetto, il volto, l'impronta, e i momenti
/// in cui l'app li chiede — tutto quello che c'era sotto il catenaccio,
/// spostato com'era (`il_lucchetto.dart`).
///
/// **La pagina resta questa anche quando ci sara' altro.** E' fatta a capitoli
/// apposta: oggi ce n'e' uno, «Sicurezza», e il secondo si aggiunge sotto
/// senza spostare niente. Le due cose dell'app che oggi stanno altrove — la
/// plancia leggera e la composizione ibrida — vivono in «Come va l'app»
/// perche' li' si leggono accanto ai fotogrammi che spiegano a cosa servono,
/// e spostarle qui vorrebbe dire staccare un interruttore dal numero che lo
/// giustifica.
///
/// ## Solo sul telefono
///
/// Come il catenaccio di prima: nel browser il volto e l'impronta non ci sono,
/// e una pagina che dice soltanto «questo qui non si puo' fare» e' una porta
/// che non si apre. Chi la voce ce l'ha lo decide `vociDellaBarra`, con
/// `soloNellApp`.
library;

import 'package:flutter/material.dart';

import '../casa/impostazioni.dart';
import '../casa/la_guardia.dart';
import '../parole.dart';
import 'il_lucchetto.dart';

/// La pagina «Impostazioni app».
class SchermataDelleImpostazioniDellApp extends StatelessWidget {
  const SchermataDelleImpostazioniDellApp({
    super.key,
    required this.impostazioni,
    required this.guardia,
    this.nuda = false,
    this.visibile = true,
  });

  final Impostazioni impostazioni;
  final LaGuardia guardia;

  /// `true` quando la barra del titolo la mette chi ospita — dentro la home
  /// ce n'e' gia' una, e due una sopra l'altra sono due.
  final bool nuda;

  /// Se questa e' la sezione che si guarda: dentro la home le pagine stanno
  /// tutte in piedi insieme, e al telefono si bussa solo quando si apre
  /// questa (vedi [SchermataDelLucchetto.visibile]).
  final bool visibile;

  @override
  Widget build(BuildContext context) {
    /* Il capitolo della sicurezza e' la schermata del lucchetto **com'e'**,
     * non una sua copia: gli interruttori, le prove che fa quando li accendi,
     * la promessa scritta in fondo. Rifarla qui vorrebbe dire due posti in cui
     * vive la stessa regola, e prima o poi due regole diverse. */
    final dentro = SchermataDelLucchetto(
      impostazioni: impostazioni,
      guardia: guardia,
      nuda: true,
      visibile: visibile,
    );
    if (nuda) return dentro;
    return Scaffold(
      appBar: AppBar(
        title: Text(inLingua(it: 'Impostazioni app', en: 'App settings')),
      ),
      body: dentro,
    );
  }
}
