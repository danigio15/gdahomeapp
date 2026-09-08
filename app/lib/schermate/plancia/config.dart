/// La Configurazione: dove si dice alla plancia cosa c'e' in casa.
///
/// Sulla dashboard questa e' una sidebar con ventotto voci e, dentro ognuna,
/// un modulo. Su un telefono quel modulo non ci sta, e riversarcelo a forza
/// vorrebbe dire un'app piu' complicata di Home Assistant — cioe' esattamente
/// la cosa che quest'app non deve essere.
///
/// Qui c'e' la stessa idea, ridotta a una domanda sola: **quali cose stanno in
/// questa sezione**. Si apre la sezione, si vede l'elenco, si aggiunge o si
/// toglie. Niente altro, perche' niente altro serve per far comparire una
/// sezione: sulla plancia una sezione non si accende con un interruttore, si
/// accende quando ci si mette dentro qualcosa — e si spegne da sola quando
/// resta vuota.
///
/// Quello che si salva torna in casa con `dashboardmodern/config/set`, cioe'
/// nella stessa configurazione che legge la dashboard: si tocca dal telefono e
/// si vede sul portatile, perche' e' la stessa e non una copia.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/entita.dart';
import '../../plancia/configurazione.dart';
import '../../plancia/scrittura.dart';
import '../../vestito/oggetti.dart';
import '../../vestito/pezzi.dart';

/// Una sezione che si puo' configurare da qui, e con che cosa si riempie.
///
/// `dominii` dice quali entita' hanno senso li' dentro: chi cerca una presa
/// non deve scorrere trecento sensori di temperatura. Vuoto vuol dire tutte.
class SezioneDaRiempire {
  const SezioneDaRiempire({
    required this.chiave,
    required this.nome,
    required this.disegno,
    required this.cosaCiSta,
    required this.cosePlurale,
    required this.dominii,
  });

  /// Come si chiama nello stato canonico: `sockets`, `cameras`…
  final String chiave;
  final String nome;
  final String disegno;

  /// Come si chiama una cosa di questa sezione: al singolare con il suo
  /// articolo — «una presa», «un robot» — e al plurale.
  ///
  /// Scritti, non ricavati: in italiano il genere di una parola non si deduce
  /// dalla parola, e «una robot» si legge una volta sola prima di far pensare
  /// che l'app l'abbia scritta una macchina.
  final String cosaCiSta;
  final String cosePlurale;
  final List<String> dominii;
}

/// Le sezioni che quest'app sa riempire: quelle fatte a elenco, dove una cosa
/// e' un'entita' e un nome.
///
/// Le altre — l'energia col suo bilancio, il clima con le sue unita', le
/// stanze coi loro sensori — hanno una forma tutta loro e vanno fatte una per
/// una: finche' non ci sono, si configurano dalla dashboard, e l'app lo dice
/// invece di far finta.
const sezioniDaRiempire = <SezioneDaRiempire>[
  SezioneDaRiempire(
    chiave: 'sockets',
    nome: 'Prese',
    disegno: 'prese',
    cosaCiSta: 'una presa',
    cosePlurale: 'prese',
    dominii: ['switch', 'input_boolean'],
  ),
  SezioneDaRiempire(
    chiave: 'cameras',
    nome: 'Telecamere',
    disegno: 'telecamere',
    cosaCiSta: 'una telecamera',
    cosePlurale: 'telecamere',
    dominii: ['camera'],
  ),
  SezioneDaRiempire(
    chiave: 'covers',
    nome: 'Finestre e tapparelle',
    disegno: 'tapparelle',
    cosaCiSta: 'una tapparella',
    cosePlurale: 'tapparelle',
    dominii: ['cover'],
  ),
  SezioneDaRiempire(
    chiave: 'robots',
    nome: 'Robot',
    disegno: 'robot',
    cosaCiSta: 'un robot',
    cosePlurale: 'robot',
    dominii: ['vacuum'],
  ),
];

class PaginaDellaConfigurazione extends StatelessWidget {
  const PaginaDellaConfigurazione({
    super.key,
    required this.collegamento,
    required this.configurazione,
  });

  final Collegamento collegamento;
  final ConfigurazioneDellaPlancia configurazione;

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    final colori = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Scheda(
          child: Row(
            children: [
              const Oggetto('impostazioni', lato: 34),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Configurazione', style: testi.titleMedium),
                    const SizedBox(height: 2),
                    Text(
                      'Quello che cambi qui vale anche sulla dashboard: '
                      'è la stessa configurazione, non una copia.',
                      style: testi.bodySmall?.copyWith(
                        color: colori.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        const Insegna('Le sezioni'),
        for (final sezione in sezioniDaRiempire) ...[
          _RigaDellaSezione(
            sezione: sezione,
            quante: _cosePresenti(configurazione, sezione.chiave).length,
            quandoPremuta: () => Navigator.of(context).push<void>(
              MaterialPageRoute(
                builder: (_) => _PaginaDaRiempire(
                  collegamento: collegamento,
                  sezione: sezione,
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
        ],
        const SizedBox(height: 18),
        Scheda(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.info_outline_rounded,
                size: 18,
                color: colori.onSurfaceVariant,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Le altre sezioni — energia, clima, stanze, elettrodomestici '
                  '— hanno una forma tutta loro e per adesso si configurano '
                  'dalla dashboard.',
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Le cose che stanno adesso in una sezione, come mappe grezze.
///
/// Grezze apposta: quello che l'app non sa leggere di una voce — un'icona, una
/// stanza, un campo di una versione piu' nuova — va rimesso dov'era quando si
/// risalva, e per rimetterlo bisogna non averlo mai perso.
List<Map<String, Object?>> _cosePresenti(
  ConfigurazioneDellaPlancia config,
  String chiave,
) {
  final dentro = config.sezione(chiave);
  if (dentro is! List) return [];
  return [
    for (final una in dentro)
      if (una is Map) {for (final v in una.entries) '${v.key}': v.value},
  ];
}

class _RigaDellaSezione extends StatelessWidget {
  const _RigaDellaSezione({
    required this.sezione,
    required this.quante,
    required this.quandoPremuta,
  });

  final SezioneDaRiempire sezione;
  final int quante;
  final VoidCallback quandoPremuta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Scheda(
      quandoPremuta: quandoPremuta,
      child: Row(
        children: [
          Oggetto(sezione.disegno, lato: 26),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(sezione.nome, style: testi.titleSmall),
                const SizedBox(height: 2),
                Text(
                  quante == 0
                      ? 'niente, per ora — la sezione non si vede'
                      : quante == 1
                      ? sezione.cosaCiSta
                      : '$quante ${sezione.cosePlurale}',
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: colori.onSurfaceVariant),
        ],
      ),
    );
  }
}

/// La pagina di una sezione: l'elenco di quello che ci sta, e il tasto per
/// aggiungerne.
class _PaginaDaRiempire extends StatefulWidget {
  const _PaginaDaRiempire({required this.collegamento, required this.sezione});

  final Collegamento collegamento;
  final SezioneDaRiempire sezione;

  @override
  State<_PaginaDaRiempire> createState() => _PaginaDaRiempireState();
}

class _PaginaDaRiempireState extends State<_PaginaDaRiempire> {
  bool _staSalvando = false;

  ConfigurazioneDellaPlancia get _config =>
      widget.collegamento.plancia ?? ConfigurazioneDellaPlancia.vuota;

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    final colori = Theme.of(context).colorScheme;
    final cose = _cosePresenti(_config, widget.sezione.chiave);
    final casa = widget.collegamento.stato;

    return Scaffold(
      appBar: AppBar(title: Text(widget.sezione.nome)),
      body: cose.isEmpty
          ? StatoVuoto(
              icona: Icons.add_circle_outline_rounded,
              titolo: 'Ancora niente',
              sotto:
                  'Aggiungi ${widget.sezione.cosaCiSta}: '
                  'la sezione comparirà da sola.',
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
              itemCount: cose.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, posto) {
                final cosa = cose[posto];
                final id = '${cosa['entity'] ?? ''}';
                final viva = casa?[id];
                return Scheda(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${cosa['name'] ?? ''}'.isNotEmpty
                                  ? '${cosa['name']}'
                                  : viva?.nome ?? id,
                              style: testi.titleSmall,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              id,
                              style: testi.bodySmall?.copyWith(
                                color: colori.onSurfaceVariant,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: 'Togli',
                        onPressed: _staSalvando ? null : () => _togli(posto),
                        icon: const Icon(Icons.remove_circle_outline_rounded),
                      ),
                    ],
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _staSalvando ? null : _aggiungi,
        icon: const Icon(Icons.add_rounded),
        label: Text('Aggiungi ${widget.sezione.cosaCiSta}'),
      ),
    );
  }

  Future<void> _aggiungi() async {
    final casa = widget.collegamento.stato;
    if (casa == null) return;
    final gia = _cosePresenti(
      _config,
      widget.sezione.chiave,
    ).map((c) => '${c['entity'] ?? ''}').toSet();
    final candidate = [
      for (final entita in casa.tutte())
        if (widget.sezione.dominii.contains(entita.dominio) &&
            !gia.contains(entita.id))
          entita,
    ]..sort((a, b) => a.nome.toLowerCase().compareTo(b.nome.toLowerCase()));

    final scelta = await showModalBottomSheet<Entita>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _Scelta(
        candidate: candidate,
        cosePlurale: widget.sezione.cosePlurale,
      ),
    );
    if (scelta == null) return;
    final cose = _cosePresenti(_config, widget.sezione.chiave)
      ..add({'entity': scelta.id, 'name': scelta.nome});
    await _salva(cose);
  }

  Future<void> _togli(int posto) async {
    final cose = _cosePresenti(_config, widget.sezione.chiave)..removeAt(posto);
    await _salva(cose);
  }

  Future<void> _salva(List<Map<String, Object?>> cose) async {
    setState(() => _staSalvando = true);
    final esito = await widget.collegamento.salvaLaPlancia(
      _config.cambiaLaSezione(widget.sezione.chiave, cose),
    );
    if (!mounted) return;
    setState(() => _staSalvando = false);
    if (esito.andata) return;
    final cosaDire = switch (esito.esito) {
      EsitoDelSalvataggio.scavalcata =>
        'Qualcuno ha cambiato la configurazione nel frattempo. '
            'Ho ricaricato la sua: riprova.',
      EsitoDelSalvataggio.rifiutataPerchePresumibilmenteVuota =>
        'La casa non ha accettato: sembrava di svuotare tutto.',
      _ => 'Non è stato salvato.',
    };
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(cosaDire)));
  }
}

/// Scegliere un'entita': l'elenco di quelle che ci stanno, con la ricerca.
class _Scelta extends StatefulWidget {
  const _Scelta({required this.candidate, required this.cosePlurale});

  final List<Entita> candidate;
  final String cosePlurale;

  @override
  State<_Scelta> createState() => _SceltaState();
}

class _SceltaState extends State<_Scelta> {
  String _cerca = '';

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final cercato = _cerca.trim().toLowerCase();
    final viste = [
      for (final entita in widget.candidate)
        if (cercato.isEmpty ||
            entita.nome.toLowerCase().contains(cercato) ||
            entita.id.toLowerCase().contains(cercato))
          entita,
    ];
    return Container(
      decoration: BoxDecoration(
        color: colori.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        builder: (context, scorrimento) => Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: colori.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
              child: TextField(
                autofocus: false,
                decoration: InputDecoration(
                  labelText: 'Cerca fra le ${widget.cosePlurale} di casa',
                  prefixIcon: const Icon(Icons.search_rounded),
                ),
                onChanged: (testo) => setState(() => _cerca = testo),
              ),
            ),
            if (viste.isEmpty)
              Expanded(
                child: Center(
                  child: Text(
                    widget.candidate.isEmpty
                        ? 'In questa casa non c\'è niente da mettere qui.'
                        : 'Nessuna corrisponde.',
                    style: testi.bodyMedium?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ),
              )
            else
              Expanded(
                child: ListView.builder(
                  controller: scorrimento,
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
                  itemCount: viste.length,
                  itemBuilder: (context, posto) => ListTile(
                    title: Text(viste[posto].nome),
                    subtitle: Text(
                      viste[posto].id,
                      style: testi.bodySmall?.copyWith(
                        color: colori.onSurfaceVariant,
                        fontFamily: 'monospace',
                      ),
                    ),
                    onTap: () => Navigator.of(context).pop(viste[posto]),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
