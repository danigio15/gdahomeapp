/// La home: la plancia vera, e una barra laterale per tutto il resto.
///
/// Aprendo l'app si vede la casa — la plancia di DashboardModern, quella
/// vera, dentro un riquadro — e nient'altro. Niente elenco di entita', niente
/// tessere rifatte: chi si e' disegnato la casa la vuole vedere cosi'. Quello
/// che di solito le sta intorno (i dispositivi, gli aiutanti, Zigbee, le
/// automazioni, le case) sta nella barra, che si chiama dal bordo sinistro.
///
/// Le pagine della plancia — le luci, il clima, l'energia — stanno dentro la
/// plancia, nella sua barra: qui non si ripetono. La **configurazione** no:
/// quella esce dalla plancia e diventa una sezione dell'app (vedi
/// `menu.dart`), perche' e' una cosa della casa e non una pagina della
/// dashboard.
library;

import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb;
import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../casa/impostazioni.dart';
import '../misure/lavori.dart';
import '../vestito/marchio.dart';
import '../vestito/pezzi.dart';
import 'acquisti.dart';
import 'assistenza.dart';
import '../vestito/quanto_e_largo.dart';
import 'barra.dart';
import 'configurazione.dart';
import 'dispositivi.dart';
import 'firma.dart';
import 'menu.dart';
import 'misure.dart';
import 'plancia_vera.dart';
import 'segnalazioni.dart';

class Home extends StatefulWidget {
  const Home({
    super.key,
    required this.collegamento,
    required this.vaiAlleCase,
    required this.plancia,
    required this.impostazioni,
  });

  final Collegamento collegamento;
  final Impostazioni impostazioni;
  final VoidCallback vaiAlleCase;

  /// Come si apre la plancia vera: il servitore e il riquadro. Sostituibile
  /// nelle prove.
  final FabbricaDellaPlancia plancia;

  @override
  State<Home> createState() => _HomeState();
}

class _HomeState extends State<Home> {
  final _barra = GlobalKey<BarraDelleSezioniState>();
  final _plancia = GlobalKey<PlanciaVeraState>();
  Sezione _sezione = Sezione.plancia;

  /// Quello che una segnalazione porta con se' senza che nessuno lo scriva:
  /// e' la meta' delle domande che chi legge farebbe per prime.
  Map<String, String> _diagnostica() {
    final collegamento = widget.collegamento;
    return {
      'app': versioneDellApp.isEmpty ? 'sviluppo' : versioneDellApp,
      'sistema': kIsWeb ? 'web' : defaultTargetPlatform.name,
      'casa': collegamento.casa?.nome ?? '',
      'da_dove': collegamento.daDove?.name ?? '',
      'stato': collegamento.comeVa.name,
      if (collegamento.perche != null) 'perche': collegamento.perche!,
      if (collegamento.traffico != null) 'filo': collegamento.traffico!,
      'schermo': Misure.io.riassunto,
      'lavori': Lavori.io.riassunto,
      'plancia': widget.impostazioni.riassunto,
    };
  }

  void _vai(Sezione dove) {
    /* Toccare «Plancia» quando ci si e' gia' la ricarica: e' il gesto piu'
     * vicino a tirare giu' per aggiornare, che dentro un riquadro non c'e'. */
    if (dove == _sezione) {
      if (dove == Sezione.plancia) _plancia.currentState?.ricarica();
      return;
    }
    setState(() => _sezione = dove);
  }

  @override
  Widget build(BuildContext context) {
    final collegamento = widget.collegamento;
    /* Sulla plancia la barra del titolo non c'e': la plancia ha la sua
     * testata, col nome della casa e il meteo, e una seconda riga sopra
     * direbbe le stesse cose a tre centimetri di distanza. */
    final sullaPlancia = _sezione == Sezione.plancia;
    return Scaffold(
      appBar: sullaPlancia
          ? null
          : AppBar(
              leading: Padding(
                padding: const EdgeInsets.only(left: 12, top: 8, bottom: 8),
                child: GestureDetector(
                  onTap: widget.vaiAlleCase,
                  child: const Marchio(lato: 30),
                ),
              ),
              leadingWidth: 54,
              titleSpacing: 4,
              title: Text(_sezione.titolo),
              actions: [
                IconButton(
                  icon: const Icon(Icons.home_work_rounded),
                  tooltip: 'Le tue case',
                  onPressed: widget.vaiAlleCase,
                ),
              ],
              /* Una riga sottile che dice «sto ricollegando»: i dati vecchi
               * restano a schermo, e si vede che stanno per cambiare. */
              bottom: collegamento.comeVa == ComeVa.inCammino
                  ? const PreferredSize(
                      preferredSize: Size.fromHeight(3),
                      child: LinearProgressIndicator(minHeight: 3),
                    )
                  : null,
            ),
      /* La barra sta **sopra** la pagina, non accanto: e' una dock, si chiama
       * quando serve e sparisce quando non serve. Sotto la pagina si lascia
       * l'aria che le tocca, se no l'ultima riga finisce sotto la maniglia. */
      body: Stack(
        children: [
          /* Sulla plancia il fondo dell'app non si vede.
           *
           * Dietro le bande del sistema — l'orologio in cima, i gesti in
           * fondo — ci va lo stesso grigio della pagina, piatto, senza gli
           * aloni: cosi' quelle bande non sembrano il bordo di un'altra
           * cosa, e la plancia si legge come una pagina sola che arriva
           * fino ai lati dello schermo. Sotto ci sta comunque il fondo
           * vivo, che si rivede appena si esce dalla plancia. */
          if (sullaPlancia)
            Positioned.fill(
              child: ColoredBox(color: Theme.of(context).colorScheme.surface),
            ),
          /* Senza barra del titolo la pagina comincia sotto l'orologio del
           * telefono: l'aria in cima gliela lascia questo, e solo dove la
           * barra non c'e' — dove c'e', quell'aria l'ha gia' lasciata lei.
           * In fondo lo stesso: la plancia ha la sua barra proprio li', e
           * non deve finire sotto i gesti del telefono. */
          SafeArea(
            /* Alla plancia lo schermo si da' tutto, barre di sistema
             * comprese: dove non scrivere lo sa la pagina, e se lo tiene lei
             * (vedi `Servitore.margini`). Sulle altre sezioni la barra del
             * titolo pensa alla cima, e qui si toglie solo l'aria in fondo,
             * che se no l'ultima riga finisce sotto i tasti del telefono. */
            top: false,
            bottom: !sullaPlancia,
            child: Padding(
              /* Alla plancia lo schermo si da' tutto: la maniglia della
               * barra le galleggia sopra, che e' quello che fa una maniglia,
               * e dieci punti tolti a tutte le pagine si vedevano solo li'.
               *
               * Dove la barra **resta** invece — su un computer, su un tablet
               * di lato — il posto glielo si lascia per davvero, e anche alla
               * plancia: li' la barra non galleggia sopra niente, sta accanto,
               * e una plancia che le finisce sotto e' una plancia con una
               * fascia che non si puo' toccare. */
              padding: EdgeInsets.only(
                left: sullaPlancia && !QuantoELargo.di(context).laBarraResta
                    ? 0
                    : quantoPerLaBarra(context),
              ),
              /* Le sezioni restano in piedi anche quando non si guardano: la
               * plancia e' una pagina web, e rifarla da capo a ogni ritorno
               * vorrebbe dire riaprirla ogni volta. */
              child: IndexedStack(
                index: Sezione.values.indexOf(_sezione),
                children: [
                  for (final sezione in Sezione.values)
                    /* Le pagine dell'app si fermano dove si legge ancora e
                     * restano in mezzo: una riga lunga duemila punti l'occhio
                     * non la segue, e su un computer una configurazione larga
                     * tutta la finestra e' un modulo che si attraversa col
                     * collo. La plancia no: quella ha un disegno suo che si
                     * adatta, e le si da' tutto quello che c'e'. */
                    QuantoCiSta(
                      quanto: sezione == Sezione.plancia
                          ? double.infinity
                          : null,
                      child: switch (sezione) {
                        Sezione.plancia => PlanciaVera(
                          key: _plancia,
                          collegamento: collegamento,
                          fabbrica: widget.plancia,
                          impostazioni: widget.impostazioni,
                          vaiAlleCase: widget.vaiAlleCase,
                        ),
                        Sezione.dispositivi => Dispositivi(
                          collegamento: collegamento,
                          visibile: _sezione == Sezione.dispositivi,
                        ),
                        Sezione.configurazione => SchermataDellaConfigurazione(
                          collegamento: collegamento,
                          impostazioni: widget.impostazioni,
                          /* Serve al ritratto delle persone, che lo disegna
                           * la plancia: e' la stessa che serve la plancia
                           * vera, accesa una volta sola per tutta l'app. */
                          fabbrica: widget.plancia,
                        ),
                        Sezione.acquisti => SchermataDegliAcquisti(
                          collegamento: collegamento,
                        ),
                        Sezione.segnalazioni => SchermataDelleSegnalazioni(
                          collegamento: collegamento,
                          diagnostica: _diagnostica,
                        ),
                        Sezione.assistenza => SchermataDellAssistenza(
                          collegamento: collegamento,
                          diagnostica: _diagnostica,
                          impostazioni: widget.impostazioni,
                        ),
                        _ => _InArrivo(sezione),
                      },
                    ),
                ],
              ),
            ),
          ),
          BarraDelleSezioni(
            key: _barra,
            sezioni: vociDellaBarra(),
            aperta: _sezione,
            vai: _vai,
            vaiAlleCase: widget.vaiAlleCase,
            collegamento: collegamento,
          ),
        ],
      ),
    );
  }
}

/// Una sezione che non c'e' ancora.
class _InArrivo extends StatelessWidget {
  const _InArrivo(this.sezione);
  final Sezione sezione;

  @override
  Widget build(BuildContext context) => StatoVuoto(
    icona: Icons.construction_rounded,
    titolo: '${sezione.titolo}: in arrivo',
    sotto: 'Questa parte dell\'app non e\' ancora scritta.',
  );
}
