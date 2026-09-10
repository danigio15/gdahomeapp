/// Le persone di casa, per bene.
///
/// Fino a ieri qui c'era la schermata generica delle voci: nome, entita', un
/// emoji. Di una persona la plancia sa molto di piu' — la foto, la batteria
/// del telefono, gli otto sensori che la Companion App si porta dietro, se
/// nasconderla dalla Home, il colore delle iniziali — e soprattutto sa la sua
/// **faccia**, che nella Config della dashboard si compone e qui non si poteva
/// nemmeno scegliere.
///
/// Il ritratto lo disegna il compositore della plancia, non noi: come e
/// perche' sta scritto in `plancia/ritratto.dart`.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/home.dart' show chiaveDellePersone;
import '../../casa/plancia/persone.dart';
import '../../casa/plancia/scatto.dart';
import '../../vestito/pezzi.dart';
import '../plancia_vera.dart' show FabbricaDellaPlancia;
import 'le_foto.dart';
import 'pezzi.dart';
import 'ritratto.dart';

class SchermataDellePersone extends StatefulWidget {
  const SchermataDellePersone({
    super.key,
    required this.collegamento,
    this.fabbrica,
  });

  final Collegamento collegamento;

  /// Chi accende il servitore, che e' quello che serve il ritratto. Senza —
  /// nelle prove — restano l'emoji e le iniziali.
  final FabbricaDellaPlancia? fabbrica;

  @override
  State<SchermataDellePersone> createState() => _SchermataDellePersoneState();
}

class _SchermataDellePersoneState extends State<SchermataDellePersone> {
  List<Persona>? _elenco;
  int _daQualeScatto = -1;

  List<Persona> _leggi(Scatto scatto) {
    if (_elenco == null || _daQualeScatto != scatto.revisione) {
      _elenco = lePersoneDi(scatto.aperto(chiaveDellePersone));
      _daQualeScatto = scatto.revisione;
    }
    return _elenco!;
  }

  void _segna(Quaderno quaderno) {
    quaderno.segna(chiaveDellePersone, [
      for (final una in _elenco!) una.dentro,
    ]);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Le persone',
    sotto:
        'Chi usa questa casa: il nome, la faccia, la presenza e quello che il '
        'suo telefono racconta.',
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      final elenco = _leggi(scatto);
      return [
        if (elenco.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 28),
            child: StatoVuoto(
              icona: Icons.people_outline_rounded,
              titolo: 'Non c\'e\' nessuno, ancora',
              sotto: 'Aggiungi una persona qui sotto.',
              dentroUnaLista: true,
            ),
          )
        else
          for (final (posto, una) in elenco.indexed)
            _LaScheda(
              persona: una,
              collegamento: widget.collegamento,
              fabbrica: widget.fabbrica,
              primo: posto == 0,
              ultimo: posto == elenco.length - 1,
              apri: () => _apri(posto, quaderno),
              sposta: (di) {
                final dove = posto + di;
                if (dove < 0 || dove >= elenco.length) return;
                elenco.insert(dove, elenco.removeAt(posto));
                _segna(quaderno);
              },
              togli: () => _togli(posto, una, quaderno),
            ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton.tonalIcon(
            onPressed: () => _apri(-1, quaderno),
            icon: const Icon(Icons.person_add_alt_rounded),
            label: const Text('Aggiungi una persona'),
          ),
        ),
      ];
    },
  );

  Future<void> _apri(int posto, Quaderno quaderno) async {
    final nuova = posto < 0;
    final quale = nuova
        ? Persona.nuova(quale: _elenco!.length)
        : Persona(Map<String, dynamic>.from(_elenco![posto].dentro));
    final fatto = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (dentro) => _UnaPersona(
          collegamento: widget.collegamento,
          fabbrica: widget.fabbrica,
          persona: quale,
        ),
      ),
    );
    if (fatto != true) return;
    if (nuova) {
      _elenco!.add(quale);
    } else {
      _elenco![posto] = quale;
    }
    _segna(quaderno);
  }

  Future<void> _togli(int posto, Persona quale, Quaderno quaderno) async {
    final come = quale.nome.isNotEmpty ? quale.nome : 'questa persona';
    final sicuro = await showDialog<bool>(
      context: context,
      builder: (dentro) => AlertDialog(
        title: Text('Tolgo $come?'),
        content: const Text(
          'Sparisce dalla plancia. La persona in Home Assistant non si tocca: '
          'resta dov\'e\'.\n\nSe ti serve solo nasconderla per un po\', apri la '
          'sua scheda e spegni «Si vede in Home»: cosi\' al ritorno non c\'e\' '
          'niente da rifare.',
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
    _elenco!.removeAt(posto);
    _segna(quaderno);
  }
}

/// Una persona nell'elenco.
class _LaScheda extends StatelessWidget {
  const _LaScheda({
    required this.persona,
    required this.collegamento,
    required this.fabbrica,
    required this.primo,
    required this.ultimo,
    required this.apri,
    required this.sposta,
    required this.togli,
  });

  final Persona persona;
  final Collegamento collegamento;
  final FabbricaDellaPlancia? fabbrica;
  final bool primo;
  final bool ultimo;
  final VoidCallback apri;
  final void Function(int di) sposta;
  final VoidCallback togli;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Scheda(
        padding: EdgeInsets.zero,
        child: Column(
          children: [
            ListTile(
              leading: FacciaDellaPersona(
                persona: persona,
                collegamento: collegamento,
                fabbrica: fabbrica,
                quanto: 44,
              ),
              title: Text(
                persona.nome.isNotEmpty ? persona.nome : 'Senza nome',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                [
                  if (persona.entita.isNotEmpty) persona.entita,
                  if (persona.nascosta) 'nascosta in Home',
                ].join(' · '),
                style: TextStyle(fontSize: 12, color: colori.onSurfaceVariant),
              ),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: apri,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 6),
              child: Row(
                children: [
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
                  const Spacer(),
                  TextButton.icon(
                    onPressed: togli,
                    icon: const Icon(Icons.delete_outline_rounded, size: 18),
                    label: const Text('Togli'),
                    style: TextButton.styleFrom(foregroundColor: colori.error),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Una persona aperta.
class _UnaPersona extends StatefulWidget {
  const _UnaPersona({
    required this.collegamento,
    required this.fabbrica,
    required this.persona,
  });

  final Collegamento collegamento;
  final FabbricaDellaPlancia? fabbrica;
  final Persona persona;

  @override
  State<_UnaPersona> createState() => _UnaPersonaState();
}

class _UnaPersonaState extends State<_UnaPersona> {
  bool _cambiato = false;

  void _tocca(VoidCallback cosa) => setState(() {
    cosa();
    _cambiato = true;
  });

  @override
  Widget build(BuildContext context) {
    final quale = widget.persona;
    final colori = Theme.of(context).colorScheme;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (uscito, _) {
        if (!uscito) Navigator.of(context).pop(_cambiato);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(quale.nome.isNotEmpty ? quale.nome : 'Una persona'),
        ),
        body: SafeArea(
          top: false,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 32),
            children: [
              CampoDiTesto(
                etichetta: 'Come si chiama',
                valore: quale.nome,
                cambiato: (scritto) =>
                    _tocca(() => quale.metti('name', scritto)),
              ),
              const SizedBox(height: 14),
              CampoDiEntita(
                etichetta: 'Quale entita\'',
                valore: quale.entita,
                collegamento: widget.collegamento,
                domini: dominiDellaPersona,
                contesto: 'una persona',
                cambiato: (scritto) =>
                    _tocca(() => quale.metti('entity', scritto)),
              ),
              const SizedBox(height: 14),

              /* ── La faccia ─────────────────────────────────────────────── */
              Scheda(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        FacciaDellaPersona(
                          persona: quale,
                          collegamento: widget.collegamento,
                          fabbrica: widget.fabbrica,
                          quanto: 64,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'La faccia',
                                style: Theme.of(context).textTheme.titleSmall
                                    ?.copyWith(fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _comeSiVede(quale),
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(
                                      color: colori.onSurfaceVariant,
                                      height: 1.4,
                                    ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        FilledButton.tonalIcon(
                          onPressed: _componiIlRitratto,
                          icon: const Icon(
                            Icons.face_retouching_natural_rounded,
                            size: 18,
                          ),
                          label: Text(
                            quale.ritratto == null
                                ? 'Componi il ritratto'
                                : 'Cambia il ritratto',
                          ),
                        ),
                        if (quale.ritratto != null)
                          TextButton.icon(
                            onPressed: () =>
                                _tocca(() => quale.mettiIlRitratto(null)),
                            icon: const Icon(Icons.close_rounded, size: 18),
                            label: const Text('Togli il ritratto'),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              /* ── Le altre due strade per la faccia ─────────────────────── */
              Row(
                children: [
                  Expanded(
                    child: CampoDiTesto(
                      etichetta: 'Emoji',
                      valore: quale.emoji,
                      suggerimento: 'Se non vuoi un ritratto',
                      cambiato: (scritto) =>
                          _tocca(() => quale.mettiNellAvatar('emoji', scritto)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: IconButton.filledTonal(
                      onPressed: () async {
                        final scelta = await scegliUnaFoto(
                          context,
                          collegamento: widget.collegamento,
                          titolo: 'La foto di ${quale.nome}',
                          adesso: quale.foto,
                        );
                        if (scelta == null) return;
                        _tocca(() => quale.metti('photo', scelta));
                      },
                      icon: const Icon(Icons.photo_camera_rounded),
                      tooltip: 'Una foto vera',
                    ),
                  ),
                ],
              ),
              if (quale.foto.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          quale.foto,
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 11,
                            color: colori.onSurfaceVariant,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: () => _tocca(() => quale.metti('photo', '')),
                        child: const Text('Togli'),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 10),
              _IlColore(
                quale: quale.colore,
                scelto: (colore) =>
                    _tocca(() => quale.mettiNellAvatar('color', colore)),
              ),
              const SizedBox(height: 14),

              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: !quale.nascosta,
                onChanged: (acceso) =>
                    _tocca(() => quale.metti('nascosta', !acceso)),
                title: const Text('Si vede in Home'),
                subtitle: const Text(
                  'Spegnendola resta configurata ma sparisce dalla Home: chi '
                  'va via per un mese non deve rifare la sua scheda al ritorno.',
                ),
              ),
              const SizedBox(height: 8),

              /* ── Quello che racconta il suo telefono ───────────────────── */
              Text(
                'Quello che racconta il suo telefono',
                style: Theme.of(context).textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                'Tutte facoltative. Arrivano dalla Companion App, '
                'dall\'orologio, o da Waze e Proximity per chi li usa.',
                style: Theme.of(context).textTheme.bodySmall
                    ?.copyWith(color: colori.onSurfaceVariant, height: 1.4),
              ),
              const SizedBox(height: 12),
              CampoDiEntita(
                etichetta: 'Batteria del telefono',
                valore: '${quale.dentro['battery'] ?? ''}',
                collegamento: widget.collegamento,
                domini: const ['sensor'],
                contesto: 'la batteria di un telefono',
                cambiato: (scritto) =>
                    _tocca(() => quale.metti('battery', scritto)),
              ),
              for (final (campo, etichetta, domini) in iSensoriDellaPersona)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: CampoDiEntita(
                    etichetta: etichetta,
                    valore: '${quale.dentro[campo] ?? ''}',
                    collegamento: widget.collegamento,
                    domini: domini,
                    contesto: etichetta.toLowerCase(),
                    cambiato: (scritto) =>
                        _tocca(() => quale.metti(campo, scritto)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _comeSiVede(Persona quale) {
    if (quale.foto.isNotEmpty) {
      return 'Si vede la foto: e\' quella che vince su tutto.';
    }
    if (quale.ritratto != null) return 'Si vede il ritratto qui accanto.';
    if (quale.emoji.isNotEmpty) return 'Si vede l\'emoji.';
    return 'Senza foto, senza ritratto e senza emoji si vedono le iniziali: '
        '«${inizialiDi(quale.nome)}».';
  }

  Future<void> _componiIlRitratto() async {
    final quale = widget.persona;
    final scelto = await Navigator.of(context).push<RitrattoScelto>(
      MaterialPageRoute(
        builder: (dentro) => SchermataDelRitratto(
          collegamento: widget.collegamento,
          fabbrica: widget.fabbrica,
          adesso: quale.ritratto ?? const RitrattoScelto(),
        ),
      ),
    );
    if (scelto == null) return;
    _tocca(() => quale.mettiIlRitratto(scelto));
  }
}

/// Il colore delle iniziali.
class _IlColore extends StatelessWidget {
  const _IlColore({required this.quale, required this.scelto});

  final String quale;
  final ValueChanged<String> scelto;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'Il colore delle iniziali',
        style: Theme.of(context).textTheme.labelLarge,
      ),
      const SizedBox(height: 8),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final uno in iColoriDellaPersona)
            InkWell(
              onTap: () => scelto(uno),
              borderRadius: BorderRadius.circular(20),
              child: Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: coloreDellaPersona(uno),
                  shape: BoxShape.circle,
                  border: uno == quale
                      ? Border.all(
                          color: Theme.of(context).colorScheme.onSurface,
                          width: 3,
                        )
                      : null,
                ),
              ),
            ),
        ],
      ),
    ],
  );
}
