/// La home: la plancia vera, e una barra laterale per tutto il resto.
///
/// Aprendo l'app si vede la casa — la plancia di DashboardModern, quella
/// vera, dentro un riquadro — e nient'altro. Niente elenco di entita', niente
/// tessere rifatte: chi si e' disegnato la casa la vuole vedere cosi'. Quello
/// che di solito le sta intorno (i dispositivi, gli aiutanti, Zigbee, le
/// automazioni, le case) sta nella barra, che si chiama dal bordo sinistro.
///
/// Le pagine della plancia — le luci, il clima, l'energia, la configurazione —
/// stanno dentro la plancia, nella sua barra: qui non si ripetono.
library;

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../vestito/marchio.dart';
import '../vestito/pezzi.dart';
import 'barra.dart';
import 'dispositivi.dart';
import 'menu.dart';
import 'plancia_vera.dart';

class Home extends StatefulWidget {
  const Home({
    super.key,
    required this.collegamento,
    required this.vaiAlleCase,
    required this.plancia,
  });

  final Collegamento collegamento;
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
          /* Senza barra del titolo la pagina comincia sotto l'orologio del
           * telefono: l'aria in cima gliela lascia questo, e solo dove la
           * barra non c'e' — dove c'e', quell'aria l'ha gia' lasciata lei.
           * In fondo lo stesso: la plancia ha la sua barra proprio li', e
           * non deve finire sotto i gesti del telefono. */
          SafeArea(
            top: sullaPlancia,
            bottom: sullaPlancia,
            child: Padding(
              padding: const EdgeInsets.only(left: spazioPerLaBarra),
              /* Le sezioni restano in piedi anche quando non si guardano: la
               * plancia e' una pagina web, e rifarla da capo a ogni ritorno
               * vorrebbe dire riaprirla ogni volta. */
              child: IndexedStack(
                index: Sezione.values.indexOf(_sezione),
                children: [
                  for (final sezione in Sezione.values)
                    switch (sezione) {
                      Sezione.plancia => PlanciaVera(
                        key: _plancia,
                        collegamento: collegamento,
                        fabbrica: widget.plancia,
                        vaiAlleCase: widget.vaiAlleCase,
                      ),
                      Sezione.dispositivi => Dispositivi(
                        collegamento: collegamento,
                      ),
                      _ => _InArrivo(sezione),
                    },
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
