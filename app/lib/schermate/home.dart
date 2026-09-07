/// La home: la plancia, e un menu laterale per tutto il resto.
///
/// Aprendo l'app si vede la casa — la plancia di DashboardModern — e
/// nient'altro. Niente elenco di entita', niente tessere coi numeri: chi si e'
/// disegnato la casa la vuole vedere cosi', e quello che di solito le sta
/// intorno (i dispositivi, gli aiutanti, Zigbee, le automazioni, le case) sta
/// dietro il bottone in alto a sinistra.
///
/// In cima restano due cose sole: il nome della casa, e da dove ci si sta
/// passando. Quella seconda riga sembra un dettaglio e invece e' la prima
/// domanda di chi apre l'app fuori casa e vede qualcosa di strano: sto
/// guardando dati veri o vecchi?
///
/// La plancia vera non c'e' ancora: al suo posto c'e' scritto cosa ci sara'.
/// Quando arrivera' cambiera' [_Plancia], e il resto restera' com'e'.
library;

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../vestito/pezzi.dart';
import 'da_dove.dart';
import 'dispositivi.dart';
import 'menu.dart';

class Home extends StatefulWidget {
  const Home({
    super.key,
    required this.collegamento,
    required this.vaiAlleCase,
  });

  final Collegamento collegamento;
  final VoidCallback vaiAlleCase;

  @override
  State<Home> createState() => _HomeState();
}

class _HomeState extends State<Home> {
  final _impalcatura = GlobalKey<ScaffoldState>();
  Sezione _sezione = Sezione.plancia;

  @override
  Widget build(BuildContext context) {
    final collegamento = widget.collegamento;
    return Scaffold(
      key: _impalcatura,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu_rounded),
          tooltip: 'Menu',
          onPressed: () => _impalcatura.currentState?.openDrawer(),
        ),
        titleSpacing: 4,
        title: _sezione == Sezione.plancia
            ? _NomeEStato(collegamento: collegamento)
            : Text(_sezione.titolo),
        /* Una riga sottile che dice «sto ricollegando»: i dati vecchi restano
         * a schermo, e si vede che stanno per cambiare. */
        bottom: collegamento.comeVa == ComeVa.inCammino
            ? const PreferredSize(
                preferredSize: Size.fromHeight(3),
                child: LinearProgressIndicator(minHeight: 3),
              )
            : null,
      ),
      drawer: MenuLaterale(
        collegamento: collegamento,
        aperta: _sezione,
        vai: (dove) => setState(() => _sezione = dove),
        vaiAlleCase: widget.vaiAlleCase,
      ),
      body: switch (_sezione) {
        Sezione.dispositivi => Dispositivi(collegamento: collegamento),
        _ => _Plancia(collegamento: collegamento),
      },
    );
  }
}

/// Il nome della casa, e sotto da dove si sta passando.
class _NomeEStato extends StatelessWidget {
  const _NomeEStato({required this.collegamento});
  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          collegamento.casa?.nome ?? 'Casa',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 1),
        DaDoveSiPassa(collegamento, piccolo: true),
      ],
    );
  }
}

/// Dove sta la plancia. Per ora dice cosa ci sara', e come sta la casa.
class _Plancia extends StatelessWidget {
  const _Plancia({required this.collegamento});
  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () => collegamento.apri(forza: true),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [_corpo()],
      ),
    );
  }

  Widget _corpo() {
    switch (collegamento.comeVa) {
      case ComeVa.nessunaCasa:
        return const StatoVuoto(
          dentroUnaLista: true,
          icona: Icons.home_outlined,
          titolo: 'Nessuna casa',
          sotto: 'Aggiungine una per cominciare.',
        );
      case ComeVa.segnoScaduto:
        return StatoVuoto(
          dentroUnaLista: true,
          icona: Icons.link_off_rounded,
          titolo: 'Questo telefono e\' stato staccato',
          sotto: collegamento.perche ?? 'Riabbina la casa con un quadretto nuovo dalla console del ponte.',
        );
      case ComeVa.irraggiungibile:
        return StatoVuoto(
          dentroUnaLista: true,
          icona: Icons.cloud_off_rounded,
          titolo: 'Non trovo la casa',
          sotto: collegamento.perche ?? 'Sto continuando a provare.',
        );
      case ComeVa.inCammino:
      case ComeVa.aperta:
        final stato = collegamento.stato;
        if (stato == null || !stato.pieno) return const _Attesa();
        return const StatoVuoto(
          dentroUnaLista: true,
          icona: Icons.dashboard_customize_rounded,
          titolo: 'La plancia arriva qui',
          sotto:
              'Le sezioni di DashboardModern, come le hai disegnate in '
              'Home Assistant. Intanto, dal menu, ci sono i dispositivi.',
        );
    }
  }
}

class _Attesa extends StatelessWidget {
  const _Attesa();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(vertical: 120),
    child: Center(child: CircularProgressIndicator()),
  );
}
