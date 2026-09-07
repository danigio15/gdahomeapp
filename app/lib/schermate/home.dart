/// La home: la prima cosa che si vede aprendo l'app.
///
/// Tre fasce, in quest'ordine, e l'ordine e' la sostanza:
///
///  1. **da dove si sta passando** — in casa o da fuori. Sembra un dettaglio
///     tecnico e invece e' la prima domanda di chi apre l'app fuori casa e
///     vede qualcosa di strano: sto guardando dati veri o vecchi?
///  2. **adesso** — luci accese, finestre aperte, temperatura. Quello che si
///     guarda uscendo di casa;
///  3. **dove si va** — i blocchi dell'app. Quelli che non ci sono ancora sono
///     scritti spenti, invece di essere nascosti: si sa dove sta andando
///     l'app.
///
/// La plancia e' l'ultima tessera, ed e' l'ultimo blocco che arrivera'.
library;

import 'package:flutter/material.dart';

import '../casa/casa_conosciuta.dart';
import '../casa/collegamento.dart';
import '../casa/entita.dart';
import '../casa/riassunto.dart';
import '../ponte/errori.dart';
import '../vestito/pezzi.dart';
import '../vestito/tema.dart';
import 'firma.dart';

class Home extends StatelessWidget {
  const Home({
    super.key,
    required this.collegamento,
    required this.vaiAiDispositivi,
    required this.vaiAlleCase,
  });

  final Collegamento collegamento;
  final VoidCallback vaiAiDispositivi;
  final VoidCallback vaiAlleCase;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => collegamento.apri(forza: true),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              _Testata(collegamento: collegamento, vaiAlleCase: vaiAlleCase),
              const SizedBox(height: 22),
              ..._corpo(context),
              const Firma(),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _corpo(BuildContext context) {
    switch (collegamento.comeVa) {
      case ComeVa.nessunaCasa:
        return const [
          StatoVuoto(
            dentroUnaLista: true,
            icona: Icons.home_outlined,
            titolo: 'Nessuna casa',
            sotto: 'Aggiungine una per cominciare.',
          ),
        ];
      case ComeVa.segnoScaduto:
        return [
          StatoVuoto(
            dentroUnaLista: true,
            icona: Icons.link_off_rounded,
            titolo: 'Questo telefono e\' stato staccato',
            sotto:
                collegamento.perche ??
                'Riabbina la casa con un codice nuovo dalla console del ponte.',
          ),
        ];
      case ComeVa.irraggiungibile:
        return [
          StatoVuoto(
            dentroUnaLista: true,
            icona: Icons.cloud_off_rounded,
            titolo: 'Non trovo la casa',
            sotto: collegamento.perche ?? 'Sto continuando a provare.',
          ),
        ];
      case ComeVa.inCammino:
      case ComeVa.aperta:
        final stato = collegamento.stato;
        if (stato == null || !stato.pieno) return const [_Attesa()];
        return _pagina(context, Riassunto.di(stato));
    }
  }

  List<Widget> _pagina(BuildContext context, Riassunto riassunto) {
    return [
      const Insegna('Adesso'),
      _Griglia(
        pezzi: [
          for (final tessera in riassunto.tessere)
            _TesseraDelRiassunto(tessera: tessera, riassunto: riassunto),
        ],
      ),
      if (riassunto.luciAccese.isNotEmpty) ...[
        const SizedBox(height: 12),
        _SpegniTutto(collegamento: collegamento, luci: riassunto.luciAccese),
      ],
      const SizedBox(height: 28),
      const Insegna('Vai a'),
      _Porta(
        icona: Icons.devices_other_rounded,
        titolo: 'Dispositivi',
        sotto: '${riassunto.quante} entita\' in questa casa',
        quandoPremuta: vaiAiDispositivi,
      ),
      const SizedBox(height: 10),
      const _Porta(
        icona: Icons.tune_rounded,
        titolo: 'Aiutanti',
        sotto: 'Interruttori, numeri, orari, contatori',
        quandoArriva: 'presto',
      ),
      const SizedBox(height: 10),
      const _Porta(
        icona: Icons.settings_input_antenna_rounded,
        titolo: 'Zigbee',
        sotto: 'Aggiungere un dispositivo, con ZHA o Zigbee2MQTT',
        quandoArriva: 'presto',
      ),
      const SizedBox(height: 10),
      const _Porta(
        icona: Icons.auto_awesome_rounded,
        titolo: 'Automazioni',
        sotto: 'Quando succede una cosa, fanne un\'altra',
        quandoArriva: 'presto',
      ),
      const SizedBox(height: 10),
      const _Porta(
        icona: Icons.dashboard_customize_rounded,
        titolo: 'Plancia',
        sotto: 'Le sezioni di DashboardModern',
        quandoArriva: 'per ultima',
      ),
    ];
  }
}

/// Il nome della casa, e da dove si sta passando.
class _Testata extends StatelessWidget {
  const _Testata({required this.collegamento, required this.vaiAlleCase});
  final Collegamento collegamento;
  final VoidCallback vaiAlleCase;

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    final colori = Theme.of(context).colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                collegamento.casa?.nome ?? 'Casa',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: testi.headlineMedium,
              ),
              const SizedBox(height: 6),
              _Stato(collegamento: collegamento),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Material(
          color: colori.surfaceContainerLowest,
          shape: const CircleBorder(),
          clipBehavior: Clip.antiAlias,
          child: IconButton(
            icon: const Icon(Icons.swap_horiz_rounded),
            tooltip: 'Le tue case',
            onPressed: vaiAlleCase,
          ),
        ),
      ],
    );
  }
}

/// «In casa» o «da fuori», con un pallino del colore giusto.
class _Stato extends StatelessWidget {
  const _Stato({required this.collegamento});
  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final (testo, colore) = switch ((
      collegamento.comeVa,
      collegamento.daDove,
    )) {
      (ComeVa.aperta, DaDove.daDentro) => ('in casa', Colori.bene),
      (ComeVa.aperta, DaDove.daFuori) => ('da fuori', Colori.ambraScura),
      (ComeVa.aperta, DaDove.dalCentralino) => ('da fuori', Colori.ambraScura),
      (ComeVa.aperta, null) => ('collegata', Colori.bene),
      (ComeVa.inCammino, _) => (
        'sto cercando la casa…',
        colori.onSurfaceVariant,
      ),
      (ComeVa.irraggiungibile, _) => ('non raggiungibile', colori.error),
      (ComeVa.segnoScaduto, _) => ('da riabbinare', colori.error),
      (ComeVa.nessunaCasa, _) => ('nessuna casa', colori.onSurfaceVariant),
    };
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Pallino(colore),
        const SizedBox(width: 7),
        Text(
          testo,
          style: Theme.of(context).textTheme.bodyMedium
              ?.copyWith(color: colori.onSurfaceVariant),
        ),
      ],
    );
  }
}

class _Attesa extends StatelessWidget {
  const _Attesa();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(vertical: 80),
    child: Center(child: CircularProgressIndicator()),
  );
}

/// Due per riga, alte uguali. Quando ne resta una sola, sta da sola.
class _Griglia extends StatelessWidget {
  const _Griglia({required this.pezzi});
  final List<Widget> pezzi;

  @override
  Widget build(BuildContext context) {
    final righe = <Widget>[];
    for (var i = 0; i < pezzi.length; i += 2) {
      righe.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: pezzi[i]),
              const SizedBox(width: 12),
              if (i + 1 < pezzi.length)
                Expanded(child: pezzi[i + 1])
              else
                const Spacer(),
            ],
          ),
        ),
      );
      if (i + 2 < pezzi.length) righe.add(const SizedBox(height: 12));
    }
    return Column(children: righe);
  }
}

class _TesseraDelRiassunto extends StatelessWidget {
  const _TesseraDelRiassunto({required this.tessera, required this.riassunto});
  final TesseraDelRiassunto tessera;
  final Riassunto riassunto;

  @override
  Widget build(BuildContext context) {
    final (icona, tono) = switch (tessera.chiave) {
      'luci' => (
        Icons.lightbulb_rounded,
        riassunto.luciAccese.isEmpty
            ? TonoDellaTessera.quieto
            : TonoDellaTessera.acceso,
      ),
      'aperture' => (
        Icons.door_front_door_rounded,
        TonoDellaTessera.attenzione,
      ),
      'temperatura' => (Icons.thermostat_rounded, TonoDellaTessera.quieto),
      'allarme' => (
        Icons.shield_rounded,
        riassunto.allarmeInserito == true
            ? TonoDellaTessera.acceso
            : TonoDellaTessera.quieto,
      ),
      'prese' => (Icons.power_rounded, TonoDellaTessera.acceso),
      'mute' => (Icons.sensors_off_rounded, TonoDellaTessera.attenzione),
      _ => (Icons.circle_outlined, TonoDellaTessera.quieto),
    };
    return Tessera(
      icona: icona,
      titolo: tessera.titolo,
      valore: tessera.valore,
      dettaglio: tessera.dettaglio,
      tono: tono,
    );
  }
}

class _SpegniTutto extends StatefulWidget {
  const _SpegniTutto({required this.collegamento, required this.luci});
  final Collegamento collegamento;
  final List<Entita> luci;

  @override
  State<_SpegniTutto> createState() => _SpegniTuttoState();
}

class _SpegniTuttoState extends State<_SpegniTutto> {
  bool _sto = false;

  Future<void> _spegni() async {
    setState(() => _sto = true);
    final stato = widget.collegamento.stato;
    try {
      for (final luce in widget.luci) {
        await stato?.comanda('turn_off', luce.id);
      }
    } on ErroreDelPonte catch (errore) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(errore.spiegazione)));
    } finally {
      if (mounted) setState(() => _sto = false);
    }
  }

  @override
  Widget build(BuildContext context) => FilledButton.tonalIcon(
    onPressed: _sto ? null : _spegni,
    icon: const Icon(Icons.lightbulb_outline_rounded, size: 20),
    label: Text(
      widget.luci.length == 1
          ? 'Spegni la luce accesa'
          : 'Spegni tutte le luci',
    ),
  );
}

/// Una porta verso un blocco dell'app: icona, titolo, due parole.
class _Porta extends StatelessWidget {
  const _Porta({
    required this.icona,
    required this.titolo,
    required this.sotto,
    this.quandoPremuta,
    this.quandoArriva,
  });

  final IconData icona;
  final String titolo;
  final String sotto;
  final VoidCallback? quandoPremuta;

  /// Quando c'e', la porta e' ancora chiusa e questo e' quello che si legge
  /// di fianco.
  final String? quandoArriva;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final ancoraNo = quandoArriva != null;
    return Opacity(
      opacity: ancoraNo ? 0.55 : 1,
      child: Scheda(
        padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
        quandoPremuta: ancoraNo ? null : quandoPremuta,
        child: Row(
          children: [
            Cerchietto(icona: icona, lato: 44),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(titolo, style: testi.titleMedium),
                  const SizedBox(height: 2),
                  Text(
                    sotto,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (ancoraNo)
              Bollino(quandoArriva!)
            else
              Icon(Icons.chevron_right_rounded, color: colori.onSurfaceVariant),
          ],
        ),
      ),
    );
  }
}
