part of 'notifiche.dart';

/* ─── Come le vuoi: semplici o elaborate ───────────────────────────────────
 *
 * In cima alla pagina la scelta per tutte: «Semplici», solo testo, o
 * «Elaborate», con la scheda disegnata sul telefono e la foto della
 * telecamera. Poi ogni voce si apre e si sceglie da sola
 * ([FoglioDellaVoce]): lo stile si puo' cambiare anche una per una.
 *
 * Le scelte stanno sul ponte, come le altre: e' lui che decide se mandare, e
 * come scriverla (`su` in `ponte/src/notifiche.js`). */

/// Le paroline sotto una voce: «NUOVA», e come arriva.
List<(String, Color)> etichetteDellaVoce(
  ImpostazioniDelleNotifiche imp,
  String evento,
) => [
  if (evento == 'blackout') (inLingua(it: 'NUOVA', en: 'NEW'), Colori.bene),
  if (eventiElaborabili.contains(evento))
    imp.elaborata(evento)
        ? (inLingua(it: 'ELABORATA', en: 'RICH'), _viola)
        : (inLingua(it: 'SEMPLICE', en: 'SIMPLE'), _ardesia),
];

const _viola = Color(0xFF7C3AED);
const _ardesia = Color(0xFF64748B);

/// «ELABORATA», «SEMPLICE», «NUOVA»: una parolina colorata sotto la voce.
class _Etichetta extends StatelessWidget {
  const _Etichetta({required this.testo, required this.colore});
  final String testo;
  final Color colore;

  @override
  Widget build(BuildContext context) {
    final scuro = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: colore.withValues(alpha: scuro ? 0.28 : 0.13),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        testo,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.6,
          color: scuro ? Color.lerp(colore, Colors.white, 0.55) : colore,
        ),
      ),
    );
  }
}

/// Le due scelte, con un'anteprima piccola di ognuna.
class _ComeLeVuoi extends StatelessWidget {
  const _ComeLeVuoi({
    required this.stile,
    required this.iPhone,
    required this.cambia,
    this.spento = false,
  });

  final String stile;
  final bool iPhone;
  final bool spento;
  final ValueChanged<String> cambia;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Opacity(
      opacity: spento ? 0.5 : 1,
      child: Scheda(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _UnoStile(
                    chiave: const Key('stile-semplici'),
                    scelto: stile == 'semplici',
                    titolo: inLingua(it: 'Semplici', en: 'Simple'),
                    sotto: inLingua(
                      it: 'Solo testo. Leggere, uguali su ogni telefono.',
                      en: 'Text only. Light, the same on every phone.',
                    ),
                    anteprima: const _Anteprima(elaborata: false),
                    tocca: spento ? null : () => cambia('semplici'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _UnoStile(
                    chiave: const Key('stile-elaborate'),
                    scelto: stile == 'elaborate',
                    titolo: inLingua(it: 'Elaborate', en: 'Rich'),
                    sotto: inLingua(
                      it:
                          'Con la scheda col grafico e le foto delle '
                          'telecamere.',
                      en: 'With the chart card and the camera photos.',
                    ),
                    anteprima: const _Anteprima(elaborata: true),
                    tocca: spento ? null : () => cambia('elaborate'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: colori.surfaceContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.lock_rounded,
                    size: 16,
                    color: colori.onSurfaceVariant,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      iPhone
                          ? inLingua(
                              it:
                                  'Con le elaborate le foto delle telecamere '
                                  'passano dal nostro server delle notifiche '
                                  'cifrate con la chiave di questo iPhone: il '
                                  'server non le può vedere e le cancella '
                                  'appena consegnate. Con le semplici non '
                                  'passa nessuna foto.',
                              en:
                                  'With rich ones the camera photos go '
                                  'through our notification server encrypted '
                                  'with this iPhone\'s key: the server can\'t '
                                  'see them and deletes them once delivered. '
                                  'With simple ones no photo goes through.',
                            )
                          : inLingua(
                              it:
                                  'Con le elaborate la scheda la disegna '
                                  'questo telefono, e le foto passano dal '
                                  'centralino cifrate con la sua chiave: il '
                                  'centralino non le può vedere e le cancella '
                                  'appena consegnate. Con le semplici non '
                                  'passa nessuna foto.',
                              en:
                                  'With rich ones this phone draws the card, '
                                  'and photos go through the relay encrypted '
                                  'with its key: the relay can\'t see them '
                                  'and deletes them once delivered. With '
                                  'simple ones no photo goes through.',
                            ),
                      style: testi.bodySmall?.copyWith(
                        color: colori.onSurfaceVariant,
                        height: 1.4,
                      ),
                    ),
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

class _UnoStile extends StatelessWidget {
  const _UnoStile({
    required this.chiave,
    required this.scelto,
    required this.titolo,
    required this.sotto,
    required this.anteprima,
    required this.tocca,
  });

  final Key chiave;
  final bool scelto;
  final String titolo;
  final String sotto;
  final Widget anteprima;
  final VoidCallback? tocca;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Material(
      key: chiave,
      color: scelto
          ? colori.primaryContainer.withValues(alpha: 0.45)
          : colori.surfaceContainerLow,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: scelto ? colori.primary : colori.outlineVariant,
          width: 2,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: tocca,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      titolo,
                      style: testi.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (scelto)
                    Icon(
                      Icons.check_circle_rounded,
                      size: 18,
                      color: colori.primary,
                    ),
                ],
              ),
              const SizedBox(height: 3),
              Text(
                sotto,
                style: testi.bodySmall?.copyWith(
                  color: colori.onSurfaceVariant,
                  fontSize: 11,
                ),
              ),
              const SizedBox(height: 8),
              anteprima,
            ],
          ),
        ),
      ),
    );
  }
}

/// Una notifica in piccolo: solo testo, o col grafico.
class _Anteprima extends StatelessWidget {
  const _Anteprima({required this.elaborata});
  final bool elaborata;

  @override
  Widget build(BuildContext context) {
    final scuro = Theme.of(context).brightness == Brightness.dark;
    final testo = TextStyle(
      fontSize: 10,
      height: 1.3,
      color: scuro ? Colors.white : const Color(0xFF0F172A),
    );
    return Container(
      padding: const EdgeInsets.all(7),
      decoration: BoxDecoration(
        color: scuro ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(10),
        boxShadow: const [
          BoxShadow(
            blurRadius: 6,
            offset: Offset(0, 2),
            color: Color(0x22000000),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            inLingua(
              it: 'Lavatrice finita · 0,05 €',
              en: 'Washer done · €0.05',
            ),
            style: testo.copyWith(fontWeight: FontWeight.w700),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (!elaborata)
            Text(
              inLingua(
                it: '1 h 52 min · 72% dal sole',
                en: '1 h 52 min · 72% from the sun',
              ),
              style: testo,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            )
          else
            Container(
              height: 30,
              margin: const EdgeInsets.only(top: 4),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(6),
                color: const Color(0xFF0F172A),
              ),
              child: const CustomPaint(
                painter: _UnaCurvaPiccola(),
                size: Size.infinite,
              ),
            ),
        ],
      ),
    );
  }
}

class _UnaCurvaPiccola extends CustomPainter {
  const _UnaCurvaPiccola();

  @override
  void paint(Canvas canvas, Size size) {
    const valori = [0.1, 0.9, 0.85, 0.2, 0.15, 0.45, 0.2, 0.5, 0.15, 0.05];
    final strada = Path()..moveTo(0, size.height);
    for (var i = 0; i < valori.length; i += 1) {
      strada.lineTo(
        i * size.width / (valori.length - 1),
        size.height - valori[i] * size.height * 0.85,
      );
    }
    strada
      ..lineTo(size.width, size.height)
      ..close();
    canvas.drawPath(strada, Paint()..color = const Color(0xFFFBBF24));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/* ─── Il foglio di una voce ────────────────────────────────────────────── */

/// Quali entita' si possono scegliere per una voce: gli elettrodomestici,
/// gli UPS, le telecamere e i sensori di movimento.
bool _vaBenePer(String evento, Entita una) => switch (evento) {
  'elettrodomestici' => const {
    'switch',
    'sensor',
    'binary_sensor',
    'select',
  }.contains(una.dominio),
  'blackout' =>
    const {'sensor', 'binary_sensor'}.contains(una.dominio) &&
        (una.id.contains('ups') ||
            una.id.contains('nut') ||
            una.nome.toLowerCase().contains('ups')),
  'movimento' =>
    una.dominio == 'camera' ||
        (una.dominio == 'binary_sensor' &&
            const {
              'motion',
              'occupancy',
              'presence',
            }.contains(una.attributi['device_class'])),
  _ => false,
};

/// Un nome da leggere quando la casa non ne dice uno: `switch.lavatrice_2`
/// diventa «Lavatrice 2».
String nomeDallId(String id) {
  final dopo = id.contains('.') ? id.substring(id.indexOf('.') + 1) : id;
  final parole = dopo.replaceAll('_', ' ').trim();
  if (parole.isEmpty) return id;
  return parole[0].toUpperCase() + parole.substring(1);
}

/// Il foglio di una voce: come arriva quella notifica, su questo telefono.
///
/// Ogni scelta si salva appena la si tocca, come gli interruttori della
/// pagina: [cambia] la porta sul ponte.
class FoglioDellaVoce extends StatefulWidget {
  const FoglioDellaVoce({
    super.key,
    required this.evento,
    required this.scelta,
    required this.stileGenerale,
    required this.cambia,
    this.entita = const [],
    this.chiediLeEntita,
    this.prova,
  });

  final String evento;
  final SceltaDellaVoce scelta;

  /// `semplici` o `elaborate`, per dire cosa vuol dire «come tutte».
  final String stileGenerale;
  final ValueChanged<SceltaDellaVoce> cambia;

  /// Le entita' della casa, per «Quali»: i loro nomi, e la scelta.
  final List<Entita> entita;

  /// Se [entita] e' vuota — la pagina si puo' aprire prima della plancia —
  /// si chiedono alla casa.
  final Future<List<Entita>> Function()? chiediLeEntita;

  /// «Prova: mandamela adesso». `null` se la casa adesso non risponde, o il
  /// telefono non le ha ancora detto dove mandarle.
  final VoidCallback? prova;

  @override
  State<FoglioDellaVoce> createState() => _StatoDelFoglio();
}

class _StatoDelFoglio extends State<FoglioDellaVoce> {
  late SceltaDellaVoce _scelta = widget.scelta;
  late List<Entita> _entita = widget.entita;

  @override
  void initState() {
    super.initState();
    final chiedi = widget.chiediLeEntita;
    if (_entita.isEmpty && chiedi != null) unawaited(_leEntita(chiedi));
  }

  Future<void> _leEntita(Future<List<Entita>> Function() chiedi) async {
    try {
      final lette = await chiedi();
      if (mounted && lette.isNotEmpty) setState(() => _entita = lette);
    } catch (_) {
      /* Senza, i nomi si ricavano dagli identificativi. */
    }
  }

  String get _evento => widget.evento;

  bool get _urgente =>
      categorieDelleNotifiche['urgenti']?.contains(_evento) ?? false;

  void _cambia(SceltaDellaVoce nuova) {
    setState(() => _scelta = nuova);
    widget.cambia(nuova);
  }

  Future<void> _sceglieQuali() async {
    final adatte = [
      for (final una in _entita)
        if (_vaBenePer(_evento, una)) una,
    ];
    final scelte = await showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _SceltaDiPiu(entita: adatte, scelte: _scelta.quali),
    );
    if (scelte != null) _cambia(_scelta.con(quali: scelte));
  }

  Future<void> _scriviLaSoglia() async {
    final campo = TextEditingController(
      text: _scelta.soglia == null ? '' : _numeroDetto(_scelta.soglia!),
    );
    final euro = _evento == 'elettrodomestici';
    final scritta = await showDialog<String>(
      context: context,
      builder: (contesto) => AlertDialog(
        title: Text(
          euro
              ? inLingua(
                  it: 'Solo se il ciclo costa più di',
                  en: 'Only if the cycle costs more than',
                )
              : inLingua(
                  it: 'Solo se manca da più di',
                  en: 'Only if it\'s out for more than',
                ),
        ),
        content: TextField(
          controller: campo,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(suffixText: euro ? '€' : 'min'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(contesto).pop(''),
            child: Text(inLingua(it: 'Sempre', en: 'Always')),
          ),
          FilledButton(
            onPressed: () => Navigator.of(contesto).pop(campo.text),
            child: Text(inLingua(it: 'Fatto', en: 'Done')),
          ),
        ],
      ),
    );
    campo.dispose();
    if (scritta == null) return;
    final numero = double.tryParse(scritta.trim().replaceAll(',', '.'));
    _cambia(
      numero == null || numero <= 0
          ? _scelta.con(senzaSoglia: true)
          : _scelta.con(soglia: numero),
    );
  }

  Future<void> _sceglieOra(bool dalle) async {
    final adesso =
        (dalle ? _scelta.dalle : _scelta.alle) ?? (dalle ? '08:00' : '22:00');
    final parti = adesso.split(':');
    final ora = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: int.tryParse(parti.first) ?? 0,
        minute: int.tryParse(parti.last) ?? 0,
      ),
    );
    if (ora == null) return;
    String due(int n) => n.toString().padLeft(2, '0');
    final detta = '${due(ora.hour)}:${due(ora.minute)}';
    _cambia(
      dalle
          ? _scelta.con(dalle: detta, alle: _scelta.alle ?? '22:00')
          : _scelta.con(alle: detta, dalle: _scelta.dalle ?? '08:00'),
    );
  }

  String _numeroDetto(double numero) {
    final testo = numero == numero.roundToDouble()
        ? numero.round().toString()
        : numero.toStringAsFixed(2);
    return inLingua(it: testo.replaceAll('.', ','), en: testo);
  }

  String get _qualiDetti {
    if (_scelta.quali.isEmpty) {
      return switch (_evento) {
        'movimento' => inLingua(it: 'Tutte le telecamere', en: 'All cameras'),
        'blackout' => inLingua(it: 'Tutti gli UPS', en: 'All UPSs'),
        _ => inLingua(it: 'Tutti', en: 'All'),
      };
    }
    final nomi = {for (final una in _entita) una.id: una.nome};
    return _scelta.quali.map((id) => nomi[id] ?? nomeDallId(id)).join(', ');
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final nome = comeSiChiama(_evento);
    final elaborabile = eventiElaborabili.contains(_evento);
    final conQuali = const {
      'elettrodomestici',
      'blackout',
      'movimento',
    }.contains(_evento);
    final conSoglia = _evento == 'elettrodomestici' || _evento == 'blackout';
    final conOrari = !_urgente && _evento != 'riepilogo';
    final conCome = !_urgente && _evento != 'riepilogo';
    final generale = widget.stileGenerale == 'elaborate'
        ? inLingua(it: 'elaborate', en: 'rich')
        : inLingua(it: 'semplici', en: 'simple');
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.85,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          children: [
            Row(
              children: [
                Oggetto(nome.disegno, lato: 30),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    nome.titolo,
                    style: testi.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              inLingua(
                it:
                    'Ogni scelta vale solo per questa notifica, su questo '
                    'telefono.',
                en:
                    'Each choice applies only to this notification, on '
                    'this phone.',
              ),
              style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
            ),
            const SizedBox(height: 8),
            if (elaborabile)
              _RigaDelFoglio(
                etichetta: inLingua(it: 'Stile', en: 'Style'),
                child: _Pezzi(
                  chiave: const Key('voce-stile'),
                  scelto: _scelta.stile,
                  voci: {
                    'come-tutte': inLingua(
                      it: 'Come tutte ($generale)',
                      en: 'Like all ($generale)',
                    ),
                    'semplice': inLingua(it: 'Semplice', en: 'Simple'),
                    'elaborata': inLingua(it: 'Elaborata', en: 'Rich'),
                  },
                  cambia: (stile) => _cambia(_scelta.con(stile: stile)),
                ),
              ),
            if (conQuali)
              _RigaDelFoglio(
                etichetta: inLingua(it: 'Quali', en: 'Which'),
                tocca: _sceglieQuali,
                child: Text(_qualiDetti, maxLines: 2),
              ),
            if (_evento == 'movimento')
              _RigaDelFoglio(
                etichetta: inLingua(it: 'Quando', en: 'When'),
                child: _Pezzi(
                  chiave: const Key('voce-quando'),
                  scelto: _scelta.quando,
                  voci: {
                    'casa-vuota-o-notte': inLingua(
                      it: 'Casa vuota o notte',
                      en: 'Away or night',
                    ),
                    'casa-vuota': inLingua(it: 'Casa vuota', en: 'Away'),
                    'notte': inLingua(it: 'Di notte', en: 'At night'),
                    'sempre': inLingua(it: 'Sempre', en: 'Always'),
                  },
                  cambia: (quando) => _cambia(_scelta.con(quando: quando)),
                ),
              ),
            if (conSoglia)
              _RigaDelFoglio(
                etichetta: inLingua(it: 'Solo se', en: 'Only if'),
                tocca: _scriviLaSoglia,
                child: Text(
                  _scelta.soglia == null
                      ? inLingua(it: 'Sempre', en: 'Always')
                      : _evento == 'elettrodomestici'
                      ? inLingua(
                          it:
                              'il ciclo costa più di '
                              '${_numeroDetto(_scelta.soglia!)} €',
                          en:
                              'the cycle costs more than '
                              '€${_numeroDetto(_scelta.soglia!)}',
                        )
                      : inLingua(
                          it:
                              'manca da più di '
                              '${_numeroDetto(_scelta.soglia!)} min',
                          en:
                              'out for more than '
                              '${_numeroDetto(_scelta.soglia!)} min',
                        ),
                ),
              ),
            _RigaDelFoglio(
              etichetta: inLingua(it: 'Suono', en: 'Sound'),
              child: _Pezzi(
                chiave: const Key('voce-suono'),
                scelto: _scelta.suono,
                voci: {
                  if (!_urgente) 'muta': inLingua(it: 'Muta', en: 'Silent'),
                  'normale': inLingua(it: 'Normale', en: 'Normal'),
                  'suo': inLingua(it: 'Il suo suono', en: 'Its own'),
                },
                cambia: (suono) => _cambia(_scelta.con(suono: suono)),
              ),
            ),
            if (conOrari)
              _RigaDelFoglio(
                etichetta: inLingua(it: 'Orari', en: 'Hours'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SwitchListTile(
                      key: const Key('voce-orari'),
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      title: Text(
                        _scelta.haGliOrari
                            ? inLingua(
                                it: 'Solo in queste ore',
                                en: 'Only in these hours',
                              )
                            : inLingua(it: 'Sempre', en: 'Always'),
                      ),
                      value: _scelta.haGliOrari,
                      onChanged: (si) => _cambia(
                        si
                            ? _scelta.con(dalle: '08:00', alle: '22:00')
                            : _scelta.con(senzaOrari: true),
                      ),
                    ),
                    if (_scelta.haGliOrari)
                      Wrap(
                        spacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(inLingua(it: 'dalle', en: 'from')),
                          ActionChip(
                            label: Text(_scelta.dalle!),
                            onPressed: () => _sceglieOra(true),
                          ),
                          Text(inLingua(it: 'alle', en: 'to')),
                          ActionChip(
                            label: Text(_scelta.alle!),
                            onPressed: () => _sceglieOra(false),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            if (conCome)
              _RigaDelFoglio(
                etichetta: inLingua(it: 'Come', en: 'How'),
                child: _Pezzi(
                  chiave: const Key('voce-come'),
                  scelto: _scelta.come,
                  voci: {
                    'subito': inLingua(it: 'Subito', en: 'Right away'),
                    'riepilogo': inLingua(
                      it: 'Nel riepilogo della sera',
                      en: 'In the evening summary',
                    ),
                  },
                  cambia: (come) => _cambia(_scelta.con(come: come)),
                ),
              ),
            if (_evento == 'elettrodomestici')
              _RigaDelFoglio(
                etichetta: inLingua(it: 'Dentro', en: 'Inside'),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final pezzo in pezziDellElettrodomestico)
                      FilterChip(
                        label: Text(switch (pezzo) {
                          'durata' => inLingua(it: 'Durata', en: 'Duration'),
                          'kwh' => 'kWh',
                          'costo' => inLingua(it: 'Costo', en: 'Cost'),
                          'sole' => inLingua(it: '☀️ Sole', en: '☀️ Sun'),
                          _ => inLingua(it: 'Consiglio', en: 'Tip'),
                        }),
                        selected: _scelta.dentro.contains(pezzo),
                        onSelected: (si) => _cambia(
                          _scelta.con(
                            dentro: [
                              for (final uno in pezziDellElettrodomestico)
                                if (uno == pezzo
                                    ? si
                                    : _scelta.dentro.contains(uno))
                                  uno,
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            if (widget.prova != null) ...[
              const SizedBox(height: 16),
              FilledButton.icon(
                key: const Key('voce-prova'),
                onPressed: widget.prova,
                icon: const Icon(Icons.send_rounded),
                label: Text(
                  inLingua(
                    it: 'Prova: mandamela adesso',
                    en: 'Test: send it now',
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RigaDelFoglio extends StatelessWidget {
  const _RigaDelFoglio({
    required this.etichetta,
    required this.child,
    this.tocca,
  });

  final String etichetta;
  final Widget child;
  final VoidCallback? tocca;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final riga = Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 82,
            child: Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                etichetta.toUpperCase(),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                  color: colori.onSurfaceVariant,
                ),
              ),
            ),
          ),
          Expanded(
            child: tocca == null
                ? child
                : Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Row(
                      children: [
                        Expanded(child: child),
                        Icon(
                          Icons.chevron_right_rounded,
                          color: colori.onSurfaceVariant,
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colori.outlineVariant)),
      ),
      child: tocca == null ? riga : InkWell(onTap: tocca, child: riga),
    );
  }
}

/// Una scelta fra poche: pastiglie che vanno a capo, non un segmento che
/// non ci sta.
class _Pezzi extends StatelessWidget {
  const _Pezzi({
    required this.chiave,
    required this.scelto,
    required this.voci,
    required this.cambia,
  });

  final Key chiave;
  final String scelto;
  final Map<String, String> voci;
  final ValueChanged<String> cambia;

  @override
  Widget build(BuildContext context) => Wrap(
    key: chiave,
    spacing: 6,
    runSpacing: 6,
    children: [
      for (final MapEntry(:key, :value) in voci.entries)
        ChoiceChip(
          label: Text(value),
          selected: key == scelto,
          onSelected: (_) => cambia(key),
        ),
    ],
  );
}

/// Quali entita': piu' d'una, con la ricerca. Nessuna scelta vuol dire tutte.
class _SceltaDiPiu extends StatefulWidget {
  const _SceltaDiPiu({required this.entita, required this.scelte});
  final List<Entita> entita;
  final List<String> scelte;

  @override
  State<_SceltaDiPiu> createState() => _StatoDellaSceltaDiPiu();
}

class _StatoDellaSceltaDiPiu extends State<_SceltaDiPiu> {
  late final Set<String> _scelte = {...widget.scelte};
  String _cerca = '';

  @override
  Widget build(BuildContext context) {
    final parola = _cerca.toLowerCase();
    final trovate = [
      for (final una in widget.entita)
        if (parola.isEmpty ||
            una.id.toLowerCase().contains(parola) ||
            una.nome.toLowerCase().contains(parola))
          una,
    ].take(200).toList();
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.75,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: TextField(
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search_rounded),
                hintText: inLingua(it: 'Cerca', en: 'Search'),
              ),
              onChanged: (testo) => setState(() => _cerca = testo),
            ),
          ),
          if (widget.entita.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                inLingua(
                  it: 'In casa non c\'è niente di adatto: valgono tutti.',
                  en: 'Nothing suitable at home: all of them count.',
                ),
              ),
            ),
          Expanded(
            child: ListView.builder(
              itemCount: trovate.length,
              itemBuilder: (_, i) {
                final una = trovate[i];
                return CheckboxListTile(
                  value: _scelte.contains(una.id),
                  title: Text(una.nome),
                  subtitle: Text(
                    una.id,
                    style: const TextStyle(fontFamily: 'monospace'),
                  ),
                  onChanged: (si) => setState(() {
                    if (si == true) {
                      _scelte.add(una.id);
                    } else {
                      _scelte.remove(una.id);
                    }
                  }),
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Row(
                children: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(<String>[]),
                    child: Text(inLingua(it: 'Tutti', en: 'All')),
                  ),
                  const Spacer(),
                  FilledButton(
                    onPressed: () => Navigator.of(context).pop([
                      for (final una in widget.entita)
                        if (_scelte.contains(una.id)) una.id,
                      for (final id in _scelte)
                        if (!widget.entita.any((una) => una.id == id)) id,
                    ]),
                    child: Text(inLingua(it: 'Fatto', en: 'Done')),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
