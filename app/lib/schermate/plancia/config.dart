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
import '../../casa/stato_della_casa.dart';
import '../../plancia/configurazione.dart';
import '../../plancia/scrittura.dart';
import '../../vestito/oggetti.dart';
import '../../vestito/pezzi.dart';

/// Un campo di una cosa: quale casella si riempie, e con che tipo di entita'.
///
/// `dominii` dice cosa ha senso li' dentro: chi cerca il sensore di una
/// stanza non deve scorrere trecento interruttori.
class CampoDellaSezione {
  const CampoDellaSezione({
    required this.chiave,
    required this.nome,
    required this.dominii,
  });

  final String chiave;
  final String nome;
  final List<String> dominii;
}

/// Una sezione che si puo' configurare da qui, e di cosa e' fatta.
///
/// Tutte hanno la stessa forma — un elenco di cose, e una cosa e' un nome piu'
/// i suoi campi — perche' e' quella che hanno davvero nella configurazione
/// della plancia. Cambia solo quali campi.
class SezioneDaRiempire {
  const SezioneDaRiempire({
    required this.chiave,
    required this.nome,
    required this.disegno,
    required this.cosaCiSta,
    required this.cosePlurale,
    required this.campi,
    this.idPrefisso = '',
  });

  /// Come si chiama nello stato canonico: `sockets`, `cameras`, `rooms`…
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

  final List<CampoDellaSezione> campi;

  /// Quando le cose di questa sezione hanno un codice a cui altre si
  /// riferiscono — le stanze, per dirne una — quello nuovo si fabbrica cosi'.
  final String idPrefisso;
}

/// Le entita' che possono comandare qualcosa di acceso e spento.
const _interruttori = ['switch', 'input_boolean', 'light'];

/// Le sezioni che quest'app sa riempire.
///
/// Le altre — l'energia col suo bilancio, le luci con la loro mappa
/// «entita' → nome» — hanno una forma diversa e vanno fatte una per una:
/// finche' non ci sono, si configurano dalla dashboard, e la pagina lo dice
/// invece di far finta.
const sezioniDaRiempire = <SezioneDaRiempire>[
  SezioneDaRiempire(
    chiave: 'rooms',
    nome: 'Stanze',
    disegno: 'stanze',
    cosaCiSta: 'una stanza',
    cosePlurale: 'stanze',
    idPrefisso: 'stanza',
    campi: [
      CampoDellaSezione(
        chiave: 'temp',
        nome: 'Temperatura',
        dominii: ['sensor', 'number'],
      ),
      CampoDellaSezione(
        chiave: 'hum',
        nome: 'Umidità',
        dominii: ['sensor', 'number'],
      ),
    ],
  ),
  SezioneDaRiempire(
    chiave: 'climate',
    nome: 'Clima',
    disegno: 'clima',
    cosaCiSta: 'una macchina',
    cosePlurale: 'macchine',
    campi: [
      CampoDellaSezione(
        chiave: 'entity',
        nome: 'La macchina',
        dominii: ['climate', 'water_heater'],
      ),
    ],
  ),
  SezioneDaRiempire(
    chiave: 'covers',
    nome: 'Finestre e tapparelle',
    disegno: 'tapparelle',
    cosaCiSta: 'una tapparella',
    cosePlurale: 'tapparelle',
    campi: [
      CampoDellaSezione(
        chiave: 'entity',
        nome: 'La tapparella',
        dominii: ['cover'],
      ),
    ],
  ),
  SezioneDaRiempire(
    chiave: 'sockets',
    nome: 'Prese',
    disegno: 'prese',
    cosaCiSta: 'una presa',
    cosePlurale: 'prese',
    campi: [
      CampoDellaSezione(
        chiave: 'entity',
        nome: 'L\'interruttore',
        dominii: _interruttori,
      ),
    ],
  ),
  SezioneDaRiempire(
    chiave: 'cameras',
    nome: 'Telecamere',
    disegno: 'telecamere',
    cosaCiSta: 'una telecamera',
    cosePlurale: 'telecamere',
    campi: [
      CampoDellaSezione(
        chiave: 'entity',
        nome: 'La telecamera',
        dominii: ['camera'],
      ),
    ],
  ),
  SezioneDaRiempire(
    chiave: 'robots',
    nome: 'Robot',
    disegno: 'robot',
    cosaCiSta: 'un robot',
    cosePlurale: 'robot',
    campi: [
      CampoDellaSezione(
        chiave: 'entity',
        nome: 'Il robot',
        dominii: ['vacuum'],
      ),
    ],
  ),
  SezioneDaRiempire(
    chiave: 'appliances',
    nome: 'Elettrodomestici',
    disegno: 'elettrodomestici',
    cosaCiSta: 'un elettrodomestico',
    cosePlurale: 'elettrodomestici',
    idPrefisso: 'app',
    campi: [
      CampoDellaSezione(
        chiave: 'power_entity',
        nome: 'Quanto consuma',
        dominii: ['sensor'],
      ),
      CampoDellaSezione(
        chiave: 'control_entity',
        nome: 'Come si accende',
        dominii: _interruttori,
      ),
      CampoDellaSezione(
        chiave: 'daily_energy_entity',
        nome: 'Quanto ha consumato oggi',
        dominii: ['sensor'],
      ),
    ],
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
                  'Le altre — energia, luci, agenda, sicurezza, auto, '
                  'irrigazione, piscina, solare termico, continuità, MiniPC — '
                  'non sono un elenco di cose: hanno una forma tutta loro, e '
                  'per adesso si configurano dalla dashboard.',
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

  SezioneDaRiempire get _sezione => widget.sezione;

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    final colori = Theme.of(context).colorScheme;
    final cose = _cosePresenti(_config, _sezione.chiave);
    final casa = widget.collegamento.stato;

    return Scaffold(
      appBar: AppBar(title: Text(_sezione.nome)),
      body: cose.isEmpty
          ? StatoVuoto(
              icona: Icons.add_circle_outline_rounded,
              titolo: 'Ancora niente',
              sotto:
                  'Aggiungi ${_sezione.cosaCiSta}: '
                  'la sezione comparirà da sola.',
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
              itemCount: cose.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, posto) {
                final cosa = cose[posto];
                final riempiti = _sezione.campi
                    .where((c) => '${cosa[c.chiave] ?? ''}'.isNotEmpty)
                    .toList();
                return Scheda(
                  quandoPremuta: _staSalvando ? null : () => _apri(posto),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _comeSiChiama(cosa, casa),
                              style: testi.titleSmall,
                            ),
                            const SizedBox(height: 3),
                            Text(
                              riempiti.isEmpty
                                  ? 'niente collegato'
                                  : riempiti
                                        .map(
                                          (c) => '${c.nome}: ${cosa[c.chiave]}',
                                        )
                                        .join('\n'),
                              style: testi.bodySmall?.copyWith(
                                color: colori.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        Icons.chevron_right_rounded,
                        color: colori.onSurfaceVariant,
                      ),
                    ],
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _staSalvando ? null : _aggiungi,
        icon: const Icon(Icons.add_rounded),
        label: Text('Aggiungi ${_sezione.cosaCiSta}'),
      ),
    );
  }

  /// Come si chiama una cosa: il nome scritto, o quello dell'entita' che ha
  /// dentro, o niente.
  String _comeSiChiama(Map<String, Object?> cosa, StatoDellaCasa? casa) {
    final scritto = '${cosa['name'] ?? ''}'.trim();
    if (scritto.isNotEmpty) return scritto;
    for (final campo in _sezione.campi) {
      final id = '${cosa[campo.chiave] ?? ''}'.trim();
      if (id.isEmpty) continue;
      return casa?[id]?.nome ?? id;
    }
    return 'Senza nome';
  }

  Future<void> _aggiungi() async {
    final cose = _cosePresenti(_config, _sezione.chiave);
    final nuova = <String, Object?>{
      if (_sezione.idPrefisso.isNotEmpty)
        'id': '${_sezione.idPrefisso}-${DateTime.now().millisecondsSinceEpoch}',
    };
    final compilata = await _componi(nuova);
    if (compilata == null) return;
    await _salva([...cose, compilata]);
  }

  Future<void> _apri(int posto) async {
    final cose = _cosePresenti(_config, _sezione.chiave);
    if (posto >= cose.length) return;
    final rifatta = await _componi(cose[posto]);
    if (rifatta == null) return;
    /* Una cosa svuotata si toglie: e' il modo di cancellarla senza un secondo
     * tasto che dice la stessa cosa in un altro posto. */
    if (rifatta.isEmpty) {
      await _salva([...cose]..removeAt(posto));
      return;
    }
    await _salva([...cose]..[posto] = rifatta);
  }

  /// Apre la scheda di una cosa. Torna `null` se non si e' cambiato niente,
  /// e una mappa vuota quando si e' chiesto di toglierla.
  Future<Map<String, Object?>?> _componi(Map<String, Object?> cosa) =>
      showModalBottomSheet<Map<String, Object?>>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => _SchedaDellaCosa(
          sezione: _sezione,
          cosa: cosa,
          casa: widget.collegamento.stato,
        ),
      );

  Future<void> _salva(List<Map<String, Object?>> cose) async {
    setState(() => _staSalvando = true);
    final esito = await widget.collegamento.salvaLaPlancia(
      _config.cambiaLaSezione(_sezione.chiave, cose),
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

/// La scheda di una cosa: il nome, e un campo per ogni casella da riempire.
class _SchedaDellaCosa extends StatefulWidget {
  const _SchedaDellaCosa({
    required this.sezione,
    required this.cosa,
    required this.casa,
  });

  final SezioneDaRiempire sezione;
  final Map<String, Object?> cosa;
  final StatoDellaCasa? casa;

  @override
  State<_SchedaDellaCosa> createState() => _SchedaDellaCosaState();
}

class _SchedaDellaCosaState extends State<_SchedaDellaCosa> {
  late final Map<String, Object?> _cosa = Map.of(widget.cosa);
  late final TextEditingController _nome = TextEditingController(
    text: '${widget.cosa['name'] ?? ''}',
  );

  @override
  void dispose() {
    _nome.dispose();
    super.dispose();
  }

  bool get _eNuova =>
      widget.cosa['name'] == null &&
      widget.sezione.campi.every((c) => widget.cosa[c.chiave] == null);

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Container(
      decoration: BoxDecoration(
        color: colori.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: colori.outlineVariant,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                _eNuova ? 'Aggiungi ${widget.sezione.cosaCiSta}' : 'Modifica',
                style: testi.titleMedium,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _nome,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Come si chiama',
                  helperText: 'Se lo lasci vuoto vale il nome che ha in casa.',
                ),
              ),
              for (final campo in widget.sezione.campi) ...[
                const SizedBox(height: 14),
                _RigaDelCampo(
                  campo: campo,
                  scelta: '${_cosa[campo.chiave] ?? ''}',
                  casa: widget.casa,
                  quandoScelta: (id) => setState(() {
                    if (id.isEmpty) {
                      _cosa.remove(campo.chiave);
                    } else {
                      _cosa[campo.chiave] = id;
                    }
                  }),
                ),
              ],
              const SizedBox(height: 22),
              FilledButton(onPressed: _salva, child: const Text('Salva')),
              if (!_eNuova) ...[
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () =>
                      Navigator.of(context).pop(<String, Object?>{}),
                  style: TextButton.styleFrom(foregroundColor: colori.error),
                  child: Text('Togli ${widget.sezione.cosaCiSta}'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _salva() {
    final nome = _nome.text.trim();
    if (nome.isEmpty) {
      _cosa.remove('name');
    } else {
      _cosa['name'] = nome;
    }
    Navigator.of(context).pop(_cosa);
  }
}

/// Una riga della scheda: cosa c'e' adesso in quella casella, e il modo di
/// cambiarla.
class _RigaDelCampo extends StatelessWidget {
  const _RigaDelCampo({
    required this.campo,
    required this.scelta,
    required this.casa,
    required this.quandoScelta,
  });

  final CampoDellaSezione campo;
  final String scelta;
  final StatoDellaCasa? casa;
  final void Function(String id) quandoScelta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final viva = scelta.isEmpty ? null : casa?[scelta];
    return Scheda(
      quandoPremuta: () => _scegli(context),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  campo.nome.toUpperCase(),
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.9,
                    color: colori.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  scelta.isEmpty ? 'niente' : (viva?.nome ?? scelta),
                  style: testi.titleSmall?.copyWith(
                    color: scelta.isEmpty ? colori.onSurfaceVariant : null,
                  ),
                ),
                if (scelta.isNotEmpty)
                  Text(
                    scelta,
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                      fontFamily: 'monospace',
                    ),
                  ),
              ],
            ),
          ),
          if (scelta.isNotEmpty)
            IconButton(
              tooltip: 'Togli',
              onPressed: () => quandoScelta(''),
              icon: const Icon(Icons.close_rounded),
            ),
          Icon(Icons.chevron_right_rounded, color: colori.onSurfaceVariant),
        ],
      ),
    );
  }

  Future<void> _scegli(BuildContext context) async {
    final tutte = casa?.tutte() ?? const <Entita>[];
    final candidate = [
      for (final entita in tutte)
        if (campo.dominii.contains(entita.dominio)) entita,
    ]..sort((a, b) => a.nome.toLowerCase().compareTo(b.nome.toLowerCase()));
    final presa = await showModalBottomSheet<Entita>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _Scelta(candidate: candidate, cosaSiCerca: campo.nome),
    );
    if (presa != null) quandoScelta(presa.id);
  }
}

/// Scegliere un'entita': l'elenco di quelle che ci stanno, con la ricerca.
class _Scelta extends StatefulWidget {
  const _Scelta({required this.candidate, required this.cosaSiCerca});

  final List<Entita> candidate;

  /// Cosa si sta cercando, per scriverlo nella casella della ricerca.
  final String cosaSiCerca;

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
                  labelText: 'Cerca: ${widget.cosaSiCerca.toLowerCase()}',
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
