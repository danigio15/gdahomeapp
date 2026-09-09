/// I carichi: i cerchi sotto la Home, con dentro i loro elettrodomestici.
///
/// Otto cerchi per impianto. Ognuno ha un nome, un disegno, un colore, e le
/// sue entita': la potenza adesso e i contatori. Dentro un cerchio ci stanno
/// fino a dodici elettrodomestici — il forno dentro la cucina — e un cerchio
/// senza sensore suo e' semplicemente la loro somma.
///
/// Il modello sta in `casa/plancia/carichi.dart` ed e' quello della plancia:
/// `cd_loads` e' l'unica verita', le tre chiavi storiche (`cd_flow_nodes`,
/// `cd_subload_groups`, `cd_subloads_extra`) si riscrivono come specchio
/// perche' la finestrella dentro la plancia le legge ancora.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/carichi.dart';
import '../../casa/plancia/energia.dart';
import '../../casa/plancia/scatto.dart';
import '../../vestito/pezzi.dart';
import 'pezzi.dart';

const chiaveDeiCarichi = 'cd_loads';
const chiaveDegliElettrodomestici = 'cd_appliances';
const chiaveDeiNodi = 'cd_flow_nodes';
const chiaveDeiGruppi = 'cd_subload_groups';
const chiaveDeiSottocarichi = 'cd_subloads_extra';

class SchermataDeiCarichi extends StatefulWidget {
  const SchermataDeiCarichi({
    super.key,
    required this.collegamento,
    this.impianto,
    this.quale = 0,
    this.quantiImpianti = 1,
  });

  final Collegamento collegamento;

  /// L'impianto di cui si stanno configurando i carichi. `null` quando la
  /// schermata si apre da sola e gli impianti non c'entrano.
  final Impianto? impianto;
  final int quale;
  final int quantiImpianti;

  @override
  State<SchermataDeiCarichi> createState() => _SchermataDeiCarichiState();
}

class _SchermataDeiCarichiState extends State<SchermataDeiCarichi> {
  List<Carico>? _modello;
  int _daQualeScatto = -1;

  List<Carico> _leggi(Scatto scatto) {
    if (_modello == null || _daQualeScatto != scatto.revisione) {
      _modello = modelloDeiCarichi(
        carichi: scatto.oggetti(chiaveDeiCarichi),
        elettrodomestici: scatto.oggetti(chiaveDegliElettrodomestici),
        /* Con due impianti la casella storica non vale piu': i cerchi del
         * secondo occupano le stesse cinque caselle del primo, e aprire i
         * carichi della casa di sopra faceva vedere il boiler della casa di
         * sotto — col suo sensore, e salvare glielo scriveva addosso. */
        nodi: specchioDeiCerchi(
          scatto.mappa(chiaveDeiNodi),
          widget.quantiImpianti,
        ),
        gruppi: scatto.oggetti(chiaveDeiGruppi),
        sottocarichi: scatto.mappa(chiaveDeiSottocarichi),
        impianto: widget.impianto,
        quale: widget.quale,
      );
      _daQualeScatto = scatto.revisione;
    }
    return _modello!;
  }

  void _segna(Scatto scatto, Quaderno quaderno) {
    final scritto = carichiDaScrivere(
      _modello!,
      prima: scatto.oggetti(chiaveDeiCarichi),
      impianto: widget.impianto == null
          ? null
          : (widget.quale == 0 ? '' : widget.impianto!.id),
    );
    quaderno.segna(chiaveDeiCarichi, scritto.carichi);
    quaderno.segna(chiaveDeiGruppi, scritto.gruppi);
    quaderno.segna(chiaveDeiSottocarichi, scritto.sottocarichi);
    /* Lo specchio delle cinque caselle si riscrive solo quando vuol ancora
     * dire qualcosa. Con due impianti riscriverlo vorrebbe dire mescolarli. */
    if (widget.quantiImpianti < 2) quaderno.segna(chiaveDeiNodi, scritto.nodi);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final dove = widget.quantiImpianti > 1 && widget.impianto != null
        ? ' di ${widget.impianto!.comeSiChiama(widget.quale)}'
        : '';
    return PaginaDiConfigurazione(
      titolo: 'I carichi$dove',
      sotto:
          'I cerchi che si vedono sotto la casa nella pagina Energia. Ognuno '
          'puo\' leggere una sua entita\', oppure essere la somma degli '
          'elettrodomestici che ci metti dentro.',
      collegamento: widget.collegamento,
      disegna: (dentro, scatto, quaderno) {
        final modello = _leggi(scatto);
        return [
          if (modello.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 28),
              child: StatoVuoto(
                icona: Icons.bubble_chart_outlined,
                titolo: 'Non c\'e\' ancora nessun carico',
                sotto: 'Aggiungine uno qui sotto.',
                dentroUnaLista: true,
              ),
            )
          else
            for (final (posto, uno) in modello.indexed)
              _LaScheda(
                carico: uno,
                primo: posto == 0,
                ultimo: posto == modello.length - 1,
                apri: () => _apri(posto, scatto, quaderno),
                sposta: (di) {
                  _modello = spostaIlCarico(modello, uno.id, di);
                  _segna(scatto, quaderno);
                },
                togli: () => _togli(posto, uno, scatto, quaderno),
                mostra: (acceso) {
                  uno.visibile = acceso;
                  _segna(scatto, quaderno);
                },
              ),
          const SizedBox(height: 12),
          if (modello.length < massimoDeiCarichi)
            FilledButton.tonalIcon(
              onPressed: () {
                final nato = caricoVuoto(
                  modello,
                  impianto: widget.impianto == null || widget.quale == 0
                      ? ''
                      : widget.impianto!.id,
                );
                modello.add(nato);
                _segna(scatto, quaderno);
              },
              icon: const Icon(Icons.add_rounded),
              label: const Text('Aggiungi un carico'),
            )
          else
            Text(
              'Otto carichi sono il massimo che la pagina Energia disegna.',
              style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
                color: Theme.of(dentro).colorScheme.onSurfaceVariant,
              ),
            ),
        ];
      },
    );
  }

  Future<void> _apri(int posto, Scatto scatto, Quaderno quaderno) async {
    final fatto = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (dentro) => _UnCarico(
          collegamento: widget.collegamento,
          carico: _modello![posto],
        ),
      ),
    );
    if (fatto != true) return;
    _segna(scatto, quaderno);
  }

  Future<void> _togli(
    int posto,
    Carico carico,
    Scatto scatto,
    Quaderno quaderno,
  ) async {
    final sicuro = await showDialog<bool>(
      context: context,
      builder: (dentro) => AlertDialog(
        title: Text('Tolgo ${carico.nome}?'),
        content: Text(
          carico.figli.isEmpty
              ? 'Sparisce il cerchio. Le entita\' di casa non si toccano.'
              : 'Sparisce il cerchio e i ${carico.figli.length} '
                    'elettrodomestici che ci sono dentro. Le entita\' di casa '
                    'non si toccano.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dentro).pop(false),
            child: const Text('Lascia stare'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dentro).pop(true),
            child: const Text('Togli'),
          ),
        ],
      ),
    );
    if (sicuro != true) return;
    _modello!.removeAt(posto);
    for (final (dove, uno) in _modello!.indexed) {
      uno.ordine = dove;
    }
    _segna(scatto, quaderno);
  }
}

/// La scheda di un carico nell'elenco: cosa legge, e se si vede.
class _LaScheda extends StatelessWidget {
  const _LaScheda({
    required this.carico,
    required this.primo,
    required this.ultimo,
    required this.apri,
    required this.sposta,
    required this.togli,
    required this.mostra,
  });

  final Carico carico;
  final bool primo;
  final bool ultimo;
  final VoidCallback apri;
  final ValueChanged<int> sposta;
  final VoidCallback togli;
  final ValueChanged<bool> mostra;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final avvisi = carico.avvisi;
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 5),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                _IlPallino(carico: carico),
                const SizedBox(width: 12),
                Expanded(
                  child: InkWell(
                    onTap: apri,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            carico.nome,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            carico.riassunto,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: colori.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                IconButton(
                  onPressed: primo ? null : () => sposta(-1),
                  icon: const Icon(Icons.keyboard_arrow_up_rounded),
                  tooltip: 'Su',
                ),
                IconButton(
                  onPressed: ultimo ? null : () => sposta(1),
                  icon: const Icon(Icons.keyboard_arrow_down_rounded),
                  tooltip: 'Giu\'',
                ),
                PopupMenuButton<String>(
                  onSelected: (cosa) => switch (cosa) {
                    'apri' => apri(),
                    'togli' => togli(),
                    _ => null,
                  },
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'apri', child: Text('Apri')),
                    PopupMenuItem(value: 'togli', child: Text('Togli')),
                  ],
                ),
              ],
            ),
            for (final avviso in avvisi)
              Padding(
                padding: const EdgeInsets.fromLTRB(0, 6, 12, 0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.info_outline_rounded,
                      size: 15,
                      color: colori.onSurfaceVariant,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        avviso,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colori.onSurfaceVariant,
                          height: 1.35,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    'Si vede nella plancia',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  Switch(value: carico.visibile, onChanged: mostra),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Il pallino col colore e il disegno del carico, come lo si vede nella
/// plancia.
class _IlPallino extends StatelessWidget {
  const _IlPallino({required this.carico});

  final Carico carico;

  static Color? _colore(String scritto) {
    final pulito = scritto.trim().replaceFirst('#', '');
    if (pulito.length != 6 && pulito.length != 8) return null;
    final numero = int.tryParse(pulito, radix: 16);
    if (numero == null) return null;
    return Color(pulito.length == 6 ? 0xFF000000 | numero : numero);
  }

  @override
  Widget build(BuildContext context) {
    final tinta =
        _colore(carico.colore) ?? Theme.of(context).colorScheme.primary;
    return Container(
      width: 42,
      height: 42,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: tinta.withValues(alpha: 0.18),
        shape: BoxShape.circle,
        border: Border.all(color: tinta.withValues(alpha: 0.55), width: 2),
      ),
      child: Text(carico.icona, style: const TextStyle(fontSize: 20)),
    );
  }
}

/// Un carico aperto: il nome, il disegno, il colore, le entita', e gli
/// elettrodomestici che ci stanno dentro.
class _UnCarico extends StatefulWidget {
  const _UnCarico({required this.collegamento, required this.carico});

  final Collegamento collegamento;
  final Carico carico;

  @override
  State<_UnCarico> createState() => _UnCaricoState();
}

class _UnCaricoState extends State<_UnCarico> {
  bool _cambiato = false;

  void _tocca(VoidCallback cosa) => setState(() {
    cosa();
    _cambiato = true;
  });

  @override
  Widget build(BuildContext context) {
    final carico = widget.carico;
    final colori = Theme.of(context).colorScheme;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (uscito, _) {
        if (!uscito) Navigator.of(context).pop(_cambiato);
      },
      child: Scaffold(
        appBar: AppBar(title: Text(carico.nome)),
        body: SafeArea(
          top: false,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 32),
            children: [
              CampoDiTesto(
                etichetta: 'Nome',
                valore: carico.nome,
                cambiato: (scritto) => _tocca(() => carico.nome = scritto),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: CampoDiTesto(
                      etichetta: 'Disegno',
                      valore: carico.icona,
                      suggerimento: '🔌',
                      cambiato: (scritto) =>
                          _tocca(() => carico.icona = scritto),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: CampoDiTesto(
                      etichetta: 'Colore',
                      valore: carico.colore,
                      mono: true,
                      suggerimento: '#ea580c',
                      cambiato: (scritto) =>
                          _tocca(() => carico.colore = scritto),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                children: [
                  for (final tinta in tavolozza)
                    _UnColore(
                      tinta: tinta,
                      scelto: carico.colore.toLowerCase() == tinta,
                      scegli: () => _tocca(() => carico.colore = tinta),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              Text(
                'Cosa legge',
                style: Theme.of(context).textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                'Basta il contatore totale: la plancia ricava da li\' il '
                'giorno e il mese. La potenza serve alla vista Istantaneo.',
                style: Theme.of(context).textTheme.bodySmall
                    ?.copyWith(color: colori.onSurfaceVariant, height: 1.4),
              ),
              const SizedBox(height: 12),
              CampoDiEntita(
                etichetta: 'Potenza adesso (W)',
                chiave: 'potenza_carico_w',
                contesto: 'di ${carico.nome}',
                domini: const ['sensor'],
                valore: carico.potenza,
                collegamento: widget.collegamento,
                cambiato: (scritto) => _tocca(() => carico.potenza = scritto),
              ),
              const SizedBox(height: 14),
              CampoDiEntita(
                etichetta: 'Contatore totale (kWh)',
                chiave: 'energia_totale_carico_kwh',
                contesto: 'di ${carico.nome}',
                domini: const ['sensor'],
                valore: carico.totale,
                collegamento: widget.collegamento,
                cambiato: (scritto) => _tocca(() => carico.totale = scritto),
              ),
              const SizedBox(height: 14),
              CampoDiEntita(
                etichetta: 'Consumata oggi (kWh)',
                chiave: 'energia_oggi_carico_kwh',
                contesto: 'di ${carico.nome}',
                domini: const ['sensor'],
                valore: carico.giorno,
                collegamento: widget.collegamento,
                cambiato: (scritto) => _tocca(() => carico.giorno = scritto),
              ),
              const SizedBox(height: 14),
              CampoDiEntita(
                etichetta: 'Consumata questo mese (kWh)',
                chiave: 'energia_mese_carico_kwh',
                contesto: 'di ${carico.nome}',
                domini: const ['sensor'],
                valore: carico.mese,
                collegamento: widget.collegamento,
                cambiato: (scritto) => _tocca(() => carico.mese = scritto),
              ),
              const SizedBox(height: 24),
              Text(
                'Nel Report',
                style: Theme.of(context).textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                'La linguetta «Report» della pagina Energia mette in fila '
                'quello che consuma e lo confronta. Il Report non ha un elenco '
                'suo: prende da qui.',
                style: Theme.of(context).textTheme.bodySmall
                    ?.copyWith(color: colori.onSurfaceVariant, height: 1.4),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: carico.nelReport,
                onChanged: (acceso) => _tocca(() => carico.nelReport = acceso),
                title: const Text('Si vede nel Report'),
                dense: true,
              ),
              if (carico.nelReport) ...[
                const SizedBox(height: 6),
                CampoDiTesto(
                  etichetta: 'Come si chiama nel Report',
                  valore: carico.nomeNelReport,
                  suggerimento: carico.nome,
                  cambiato: (scritto) =>
                      _tocca(() => carico.nomeNelReport = scritto),
                ),
              ],
              const SizedBox(height: 24),
              Text(
                'Cosa c\'e\' dentro',
                style: Theme.of(context).textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                'Gli elettrodomestici di questo cerchio. Se il cerchio non ha '
                'una sua entita\', la plancia mostra la loro somma.',
                style: Theme.of(context).textTheme.bodySmall
                    ?.copyWith(color: colori.onSurfaceVariant, height: 1.4),
              ),
              const SizedBox(height: 10),
              for (final (posto, figlio) in carico.figli.indexed)
                _UnFiglio(
                  figlio: figlio,
                  collegamento: widget.collegamento,
                  cambiato: () => _tocca(() {}),
                  togli: () => _tocca(() => carico.figli.removeAt(posto)),
                ),
              const SizedBox(height: 8),
              if (carico.figli.length < massimoDeiSottocarichi)
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: () => _tocca(
                      () => carico.figli.add(sottocaricoVuoto(carico)),
                    ),
                    icon: const Icon(Icons.add_rounded),
                    label: const Text('Aggiungi un elettrodomestico'),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Una pastiglia di colore della tavolozza.
class _UnColore extends StatelessWidget {
  const _UnColore({
    required this.tinta,
    required this.scelto,
    required this.scegli,
  });

  final String tinta;
  final bool scelto;
  final VoidCallback scegli;

  @override
  Widget build(BuildContext context) {
    final colore =
        _IlPallino._colore(tinta) ?? Theme.of(context).colorScheme.primary;
    return InkWell(
      onTap: scegli,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: colore,
          shape: BoxShape.circle,
          border: Border.all(
            color: scelto
                ? Theme.of(context).colorScheme.onSurface
                : Colors.transparent,
            width: 3,
          ),
        ),
        child: scelto
            ? const Icon(Icons.check_rounded, size: 18, color: Colors.white)
            : null,
      ),
    );
  }
}

/// Un elettrodomestico dentro un cerchio.
class _UnFiglio extends StatelessWidget {
  const _UnFiglio({
    required this.figlio,
    required this.collegamento,
    required this.cambiato,
    required this.togli,
  });

  final Sottocarico figlio;
  final Collegamento collegamento;
  final VoidCallback cambiato;
  final VoidCallback togli;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    /* Un elettrodomestico configurato nella sua sezione qui si mostra e basta:
     * riscriverlo sarebbe la seconda copia che questo modello esiste per
     * togliere. */
    if (figlio.altrui) {
      return Card(
        margin: const EdgeInsets.symmetric(vertical: 4),
        color: colori.surfaceContainerHighest,
        child: ListTile(
          leading: Text(figlio.icona, style: const TextStyle(fontSize: 22)),
          title: Text(figlio.nome),
          subtitle: const Text(
            'Arriva dagli elettrodomestici: si configura di la\'',
          ),
        ),
      );
    }
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        leading: Text(figlio.icona, style: const TextStyle(fontSize: 22)),
        title: Text(figlio.nome),
        subtitle: Text(
          figlio.potenza.isEmpty ? 'nessuna entita\'' : figlio.potenza,
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: colori.onSurfaceVariant),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        children: [
          Row(
            children: [
              Expanded(
                flex: 3,
                child: CampoDiTesto(
                  etichetta: 'Nome',
                  valore: figlio.nome,
                  cambiato: (scritto) {
                    figlio.nome = scritto;
                    cambiato();
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: CampoDiTesto(
                  etichetta: 'Disegno',
                  valore: figlio.icona,
                  suggerimento: '🔌',
                  cambiato: (scritto) {
                    figlio.icona = scritto;
                    cambiato();
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          CampoDiEntita(
            etichetta: 'Potenza adesso (W)',
            chiave: 'potenza_elettrodomestico_w',
            contesto: 'di ${figlio.nome}',
            domini: const ['sensor'],
            valore: figlio.potenza,
            collegamento: collegamento,
            cambiato: (scritto) {
              figlio.potenza = scritto;
              cambiato();
            },
          ),
          const SizedBox(height: 14),
          CampoDiEntita(
            etichetta: 'Acceso o spento',
            chiave: 'stato_elettrodomestico',
            contesto: 'di ${figlio.nome}',
            domini: const ['binary_sensor', 'switch'],
            valore: figlio.stato,
            collegamento: collegamento,
            cambiato: (scritto) {
              figlio.stato = scritto;
              cambiato();
            },
          ),
          const SizedBox(height: 14),
          CampoDiEntita(
            etichetta: 'Contatore totale (kWh)',
            chiave: 'energia_totale_elettrodomestico_kwh',
            contesto: 'di ${figlio.nome}',
            domini: const ['sensor'],
            valore: figlio.totale,
            collegamento: collegamento,
            cambiato: (scritto) {
              figlio.totale = scritto;
              cambiato();
            },
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: togli,
              icon: const Icon(Icons.delete_outline_rounded),
              label: const Text('Togli'),
              style: TextButton.styleFrom(foregroundColor: colori.error),
            ),
          ),
        ],
      ),
    );
  }
}
