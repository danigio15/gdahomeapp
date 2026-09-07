/// La home: la prima cosa che si vede aprendo l'app.
///
/// Tre fasce, in quest'ordine, e l'ordine e' la sostanza:
///
///  1. **da dove si sta passando** — in casa o da fuori. Sembra un dettaglio
///     tecnico e invece e' la prima domanda di chi apre l'app fuori casa e
///     vede qualcosa di strano: sto guardando dati veri o vecchi?
///  2. **il riassunto** — luci accese, finestre aperte, temperatura. Quello che
///     si guarda uscendo di casa;
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
    final casa = collegamento.casa;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(casa?.nome ?? 'Casa'),
            _SottoTitolo(collegamento: collegamento),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.swap_horiz),
            tooltip: 'Le tue case',
            onPressed: vaiAlleCase,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => collegamento.apri(forza: true),
        child: _corpo(context),
      ),
    );
  }

  Widget _corpo(BuildContext context) {
    switch (collegamento.comeVa) {
      case ComeVa.nessunaCasa:
        return const _Messaggio(
          icona: Icons.home_outlined,
          titolo: 'Nessuna casa',
          sotto: 'Aggiungine una per cominciare.',
        );
      case ComeVa.segnoScaduto:
        return _Messaggio(
          icona: Icons.link_off,
          titolo: 'Questo telefono e\' stato staccato',
          sotto:
              collegamento.perche ??
              'Riabbina la casa con un codice nuovo dalla console del ponte.',
        );
      case ComeVa.irraggiungibile:
        return _Messaggio(
          icona: Icons.cloud_off,
          titolo: 'Non trovo la casa',
          sotto: collegamento.perche ?? 'Sto continuando a provare.',
        );
      case ComeVa.inCammino:
      case ComeVa.aperta:
        final stato = collegamento.stato;
        if (stato == null || !stato.pieno) {
          return const Center(child: CircularProgressIndicator());
        }
        return _pagina(context, Riassunto.di(stato));
    }
  }

  Widget _pagina(BuildContext context, Riassunto riassunto) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        _Tessere(riassunto: riassunto),
        if (riassunto.luciAccese.isNotEmpty) ...[
          const SizedBox(height: 8),
          _SpegniTutto(collegamento: collegamento, luci: riassunto.luciAccese),
        ],
        const SizedBox(height: 24),
        _Insegna('Dove si va'),
        const SizedBox(height: 8),
        _Voce(
          icona: Icons.devices_other,
          titolo: 'Dispositivi',
          sotto: '${riassunto.quante} entita\' in questa casa',
          quandoPremuto: vaiAiDispositivi,
        ),
        const _Voce(
          icona: Icons.tune,
          titolo: 'Aiutanti',
          sotto: 'Interruttori, numeri, orari, contatori',
          quandoArriva: 'presto',
        ),
        const _Voce(
          icona: Icons.settings_input_antenna,
          titolo: 'Zigbee',
          sotto: 'Aggiungere un dispositivo, con ZHA o Zigbee2MQTT',
          quandoArriva: 'presto',
        ),
        const _Voce(
          icona: Icons.auto_awesome,
          titolo: 'Automazioni',
          sotto: 'Quando succede una cosa, fanne un\'altra',
          quandoArriva: 'presto',
        ),
        const _Voce(
          icona: Icons.dashboard_customize,
          titolo: 'Plancia',
          sotto: 'Le sezioni di DashboardModern',
          quandoArriva: 'per ultima',
        ),
      ],
    );
  }
}

/// «In casa» o «da fuori», sotto il nome della casa.
class _SottoTitolo extends StatelessWidget {
  const _SottoTitolo({required this.collegamento});
  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) {
    final (testo, icona) = switch ((collegamento.comeVa, collegamento.daDove)) {
      (ComeVa.aperta, DaDove.daDentro) => ('in casa', Icons.wifi),
      (ComeVa.aperta, DaDove.daFuori) => ('da fuori', Icons.public),
      (ComeVa.aperta, null) => ('collegata', Icons.check),
      (ComeVa.inCammino, _) => ('sto cercando la casa…', Icons.more_horiz),
      (ComeVa.irraggiungibile, _) => ('non raggiungibile', Icons.cloud_off),
      (ComeVa.segnoScaduto, _) => ('da riabbinare', Icons.link_off),
      (ComeVa.nessunaCasa, _) => ('nessuna casa', Icons.home_outlined),
    };
    final colori = Theme.of(context).colorScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icona, size: 12, color: colori.onSurfaceVariant),
        const SizedBox(width: 4),
        Text(
          testo,
          style: Theme.of(context).textTheme.labelSmall
              ?.copyWith(color: colori.onSurfaceVariant),
        ),
      ],
    );
  }
}

class _Tessere extends StatelessWidget {
  const _Tessere({required this.riassunto});
  final Riassunto riassunto;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        for (final tessera in riassunto.tessere)
          _Tessera(tessera: tessera, larga: riassunto.tessere.length == 1),
      ],
    );
  }
}

class _Tessera extends StatelessWidget {
  const _Tessera({required this.tessera, this.larga = false});
  final TesseraDelRiassunto tessera;
  final bool larga;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final quanto = MediaQuery.sizeOf(context).width;
    /* Due per riga sui telefoni, una sola quando ce n'e' una sola: una tessera
     * a meta' schermo con niente di fianco sembra un errore. */
    final larghezza = larga ? quanto - 32 : (quanto - 44) / 2;

    return Container(
      width: larghezza.clamp(140, 420),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tessera.attenzione
            ? colori.errorContainer.withValues(alpha: 0.45)
            : colori.surfaceContainerHighest.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            tessera.titolo,
            style: testi.labelMedium?.copyWith(color: colori.onSurfaceVariant),
          ),
          const SizedBox(height: 4),
          Text(tessera.valore, style: testi.titleLarge),
          if (tessera.dettaglio != null) ...[
            const SizedBox(height: 4),
            Text(
              tessera.dettaglio!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
            ),
          ],
        ],
      ),
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
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: FilledButton.tonalIcon(
      onPressed: _sto ? null : _spegni,
      icon: const Icon(Icons.lightbulb_outline, size: 18),
      label: Text(
        widget.luci.length == 1
            ? 'Spegni la luce accesa'
            : 'Spegni tutte le luci',
      ),
    ),
  );
}

class _Insegna extends StatelessWidget {
  const _Insegna(this.testo);
  final String testo;

  @override
  Widget build(BuildContext context) => Text(
    testo.toUpperCase(),
    style: Theme.of(context).textTheme.labelSmall?.copyWith(
      color: Theme.of(context).colorScheme.primary,
      letterSpacing: 1.2,
      fontWeight: FontWeight.w700,
    ),
  );
}

class _Voce extends StatelessWidget {
  const _Voce({
    required this.icona,
    required this.titolo,
    required this.sotto,
    this.quandoPremuto,
    this.quandoArriva,
  });

  final IconData icona;
  final String titolo;
  final String sotto;
  final VoidCallback? quandoPremuto;

  /// Quando c'e', la voce e' spenta e questo e' quello che si legge di fianco.
  final String? quandoArriva;

  @override
  Widget build(BuildContext context) {
    final ancoraNo = quandoArriva != null;
    final colori = Theme.of(context).colorScheme;
    return Opacity(
      opacity: ancoraNo ? 0.45 : 1,
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Icon(icona),
        title: Text(titolo),
        subtitle: Text(sotto),
        trailing: ancoraNo
            ? Text(
                quandoArriva!,
                style: Theme.of(context).textTheme.labelSmall
                    ?.copyWith(color: colori.onSurfaceVariant),
              )
            : const Icon(Icons.chevron_right),
        onTap: quandoPremuto,
        enabled: !ancoraNo,
      ),
    );
  }
}

class _Messaggio extends StatelessWidget {
  const _Messaggio({
    required this.icona,
    required this.titolo,
    required this.sotto,
  });
  final IconData icona;
  final String titolo;
  final String sotto;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    /* Dentro una lista, non dentro un Center: cosi' il gesto di tirare giu'
     * per riprovare funziona anche quando non c'e' niente da mostrare. */
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 80),
      children: [
        Icon(icona, size: 48, color: colori.onSurfaceVariant),
        const SizedBox(height: 16),
        Text(
          titolo,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        Text(
          sotto,
          textAlign: TextAlign.center,
          style: TextStyle(color: colori.onSurfaceVariant),
        ),
      ],
    );
  }
}
