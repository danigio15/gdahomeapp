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
/// ## I due capitoli
///
///  - **La plancia**: la plancia leggera e la composizione ibrida. Stavano in
///    «Come va l'app» — adesso «Diagnostica app» — accanto ai fotogrammi che
///    spiegano a cosa servono. «Spostale anche quelle in impostazioni app»: e
///    ha ragione, ed e' la stessa riga che divide le due pagine. Li' si
///    **guarda** per capire, qui si **tocca** per cambiare; un interruttore in
///    mezzo ai numeri e' un interruttore in una pagina che non e' sua;
///
///  - **Sicurezza**: il lucchetto, il volto, l'impronta, e i momenti in cui
///    l'app li chiede — tutto quello che c'era sotto il catenaccio, spostato
///    com'era (`il_lucchetto.dart`).
///
/// Lo scorrimento lo tiene il capitolo della sicurezza, e il primo capitolo
/// gli si passa da sopra ([SchermataDelLucchetto.inTesta]): quando il telefono
/// non ha nessuna guardia di suo, li' non c'e' un elenco di interruttori ma
/// uno stato vuoto che si prende la pagina intera, e chi ospita non puo'
/// saperlo prima.
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
import '../vestito/pezzi.dart';
import 'il_lucchetto.dart';

/// La pagina «Impostazioni app».
class SchermataDelleImpostazioniDellApp extends StatefulWidget {
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
  State<SchermataDelleImpostazioniDellApp> createState() =>
      _StatoDelleImpostazioniDellApp();
}

class _StatoDelleImpostazioniDellApp
    extends State<SchermataDelleImpostazioniDellApp> {
  @override
  Widget build(BuildContext context) {
    /* Il capitolo della sicurezza e' la schermata del lucchetto **com'e'**,
     * non una sua copia: gli interruttori, le prove che fa quando li accendi,
     * la promessa scritta in fondo. Rifarla qui vorrebbe dire due posti in cui
     * vive la stessa regola, e prima o poi due regole diverse. */
    final dentro = SchermataDelLucchetto(
      impostazioni: widget.impostazioni,
      guardia: widget.guardia,
      nuda: true,
      visibile: widget.visibile,
      inTesta: _LaPlancia(
        impostazioni: widget.impostazioni,
        cambiato: () => setState(() {}),
      ),
    );
    if (widget.nuda) return dentro;
    return Scaffold(
      appBar: AppBar(
        title: Text(inLingua(it: 'Impostazioni app', en: 'App settings')),
      ),
      body: dentro,
    );
  }
}

/// Il capitolo «La plancia»: i due interruttori che pesano sul riquadro.
///
/// Sono dell'app e non della plancia, e nella plancia non ci sono perche' non
/// ci possono essere: uno spegne le animazioni e le sfocature della pagina web,
/// l'altro dice ad Android di disegnare il riquadro per conto suo.
class _LaPlancia extends StatelessWidget {
  const _LaPlancia({required this.impostazioni, required this.cambiato});

  final Impostazioni impostazioni;

  /// Da chiamare quando un interruttore cambia: le impostazioni non sono un
  /// widget, e chi le disegna deve ridisegnarsi da solo.
  final VoidCallback cambiato;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Insegna(inLingua(it: 'La plancia', en: 'The dashboard')),
        Scheda(
          padding: const EdgeInsets.fromLTRB(6, 4, 6, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SwitchListTile(
                secondary: const Cerchietto(icona: Icons.speed_rounded),
                title: Text(
                  inLingua(it: 'Plancia leggera', en: 'Light dashboard'),
                ),
                subtitle: Text(
                  inLingua(
                    it:
                        'Spenta di serie. Ferma le animazioni che non '
                        'finiscono mai e toglie le sfocature dietro le '
                        'tessere: la plancia cambia aspetto. Solo se il '
                        'telefono proprio non ce la fa.',
                    en:
                        'Off by default. It stops the never-ending animations '
                        'and removes the blur behind the cards: the dashboard '
                        'looks different. Only if the phone really can\'t '
                        'keep up.',
                  ),
                ),
                value: impostazioni.planciaLeggera,
                onChanged: (valore) async {
                  await impostazioni.metti(planciaLeggera: valore);
                  cambiato();
                },
              ),
              if (impostazioni.android) ...[
                const Divider(height: 1, indent: 16, endIndent: 16),
                SwitchListTile(
                  secondary: const Cerchietto(icona: Icons.layers_rounded),
                  title: Text(
                    inLingua(
                      it: 'Composizione ibrida',
                      en: 'Hybrid composition',
                    ),
                  ),
                  subtitle: Text(
                    inLingua(
                      it:
                          'Il riquadro della plancia lo disegna Android per '
                          'conto suo, invece di passare da Flutter a ogni '
                          'fotogramma. Prova a spegnerla solo se con lei va '
                          'peggio.',
                      en:
                          'Android draws the dashboard frame on its own, '
                          'instead of going through Flutter on every frame. '
                          'Only try turning it off if things are worse with '
                          'it on.',
                    ),
                  ),
                  value: impostazioni.composizioneIbrida,
                  onChanged: (valore) async {
                    await impostazioni.metti(composizioneIbrida: valore);
                    cambiato();
                  },
                ),
              ],
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Text(
                  inLingua(
                    it:
                        'Cambiare un interruttore ricarica la plancia. Quanto '
                        'pesa si legge in Diagnostica app.',
                    en:
                        'Flipping either switch reloads the dashboard. What it '
                        'costs is in App diagnostics.',
                  ),
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
      ],
    );
  }
}
