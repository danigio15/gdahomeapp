/// Il ritratto di una persona: comporlo, e vederlo.
///
/// Le file sono quelle della Config della dashboard — persona, capelli, barba,
/// i colori, la carnagione, il vestito, gli occhiali, la collana — e le file
/// che per una certa persona non vogliono dire niente non si vedono: un
/// ragazzo non ha varianti di capelli, e un vestito che il compositore non sa
/// ricolorare non ha un colore.
///
/// A **disegnare** e' la plancia, non noi: la pagina in `plancia/ritratto.dart`
/// carica il suo compositore e gli chiede l'immagine. Cosi' quello che si vede
/// mentre si sceglie e' esattamente quello che si vedra' nella plancia — e
/// resta vero da solo il giorno che il compositore cambia.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/persone.dart';
import '../../plancia/ritratto.dart';
import '../../plancia/servitore_qui/qui.dart';
import '../plancia_vera.dart' show FabbricaDellaPlancia;
import '../riquadro/qui.dart';

/// La faccia di una persona: il ritratto se ce l'ha, l'emoji se c'e', le
/// iniziali per ultime.
///
/// Le iniziali non sono un ripiego triste: sono l'avatar che non si deve
/// disegnare, come nelle rubriche dei telefoni.
class FacciaDellaPersona extends StatelessWidget {
  const FacciaDellaPersona({
    super.key,
    required this.persona,
    required this.collegamento,
    required this.quanto,
    this.fabbrica,
  });

  final Persona persona;
  final Collegamento collegamento;
  final double quanto;

  /// Senza, il ritratto non si disegna e restano l'emoji e le iniziali: e'
  /// quello che succede nelle prove, dove un WebView non c'e'.
  final FabbricaDellaPlancia? fabbrica;

  @override
  Widget build(BuildContext context) {
    final ritratto = persona.ritratto;
    final fabbrica = this.fabbrica;
    if (ritratto != null && fabbrica != null) {
      return SizedBox(
        width: quanto,
        height: quanto,
        child: IlRitratto(
          scelte: ritratto,
          collegamento: collegamento,
          fabbrica: fabbrica,
        ),
      );
    }
    return Container(
      width: quanto,
      height: quanto,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: coloreDellaPersona(persona.colore),
        shape: BoxShape.circle,
      ),
      child: persona.emoji.isNotEmpty
          ? Text(persona.emoji, style: TextStyle(fontSize: quanto * 0.5))
          : Text(
              inizialiDi(persona.nome),
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: quanto * 0.36,
              ),
            ),
    );
  }
}

/// Un colore scritto come lo scrive la plancia: `#0ea5e9`.
Color coloreDellaPersona(String scritta) {
  final quanto = int.tryParse(scritta.replaceAll('#', ''), radix: 16);
  return quanto == null ? const Color(0xff64748b) : Color(0xff000000 | quanto);
}

/// Il ritratto disegnato dalla plancia, dentro un riquadro.
class IlRitratto extends StatefulWidget {
  const IlRitratto({
    super.key,
    required this.scelte,
    required this.collegamento,
    required this.fabbrica,
  });

  final RitrattoScelto scelte;
  final Collegamento collegamento;
  final FabbricaDellaPlancia fabbrica;

  @override
  State<IlRitratto> createState() => _IlRitrattoState();
}

class _IlRitrattoState extends State<IlRitratto> {
  ServitoreDiQuestoSistema? _servitore;
  bool _chiesto = false;
  Uri? _pagina;
  WebViewController? _controllore;

  @override
  void initState() {
    super.initState();
    unawaited(_accendi());
  }

  @override
  void didUpdateWidget(IlRitratto vecchio) {
    super.didUpdateWidget(vecchio);
    if (vecchio.scelte.scritto.toString() != widget.scelte.scritto.toString()) {
      _ricarica();
    }
  }

  Future<void> _accendi() async {
    _chiesto = true;
    final servitore = await widget.fabbrica.servitore(
      () => widget.collegamento.filo,
    );
    if (!mounted) return;
    setState(() => _servitore = servitore);
    _ricarica();
  }

  void _ricarica() {
    final servitore = _servitore;
    final base = widget.collegamento.pannello?.base;
    if (servitore == null || base == null || base.isEmpty) return;
    final pagina = servitore.indirizzoDi(
      '$base/$fileDelRitratto',
      domande: widget.scelte.scritto,
    );
    final controllore = _controllore;
    setState(() => _pagina = pagina);
    if (controllore != null) unawaited(ricarica(controllore, pagina));
  }

  @override
  Widget build(BuildContext context) {
    final pagina = _pagina;
    if (pagina == null) {
      return Center(
        child: SizedBox(
          width: 16,
          height: 16,
          child: _chiesto
              ? const CircularProgressIndicator(strokeWidth: 2)
              : const SizedBox.shrink(),
        ),
      );
    }
    final controllore = _controllore ??= costruisciIlControllore(
      quandoCaricata: () {},
      quandoFallisce: (_) {},
      siPuoAndare: (_) => false,
      sfondo: Colors.transparent,
    );
    unawaited(ricarica(controllore, pagina));
    return riquadroDelWebView(controllore, ibrido: false);
  }
}

/* ─── La schermata che compone ───────────────────────────────────────────── */

class SchermataDelRitratto extends StatefulWidget {
  const SchermataDelRitratto({
    super.key,
    required this.collegamento,
    required this.adesso,
    this.fabbrica,
  });

  final Collegamento collegamento;
  final RitrattoScelto adesso;
  final FabbricaDellaPlancia? fabbrica;

  @override
  State<SchermataDelRitratto> createState() => _SchermataDelRitrattoState();
}

class _SchermataDelRitrattoState extends State<SchermataDelRitratto> {
  late var _scelte = widget.adesso;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final fabbrica = widget.fabbrica;
    final haCapelli = personaHaCapelli(_scelte.persona);
    final siRicolora = vestitoRicolorabile(_scelte.vestito);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Il ritratto'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(_scelte),
            child: const Text('Tienilo'),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            /* L'anteprima sta in cima e resta ferma: si sceglie guardando, e
             * una faccia che scorre via mentre si prova un colore vuol dire
             * scegliere alla cieca. */
            Container(
              height: 180,
              alignment: Alignment.center,
              child: fabbrica == null
                  ? Icon(
                      Icons.face_rounded,
                      size: 90,
                      color: colori.onSurfaceVariant,
                    )
                  : SizedBox(
                      width: 160,
                      height: 160,
                      child: IlRitratto(
                        scelte: _scelte,
                        collegamento: widget.collegamento,
                        fabbrica: fabbrica,
                      ),
                    ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
                children: [
                  _Fila(
                    titolo: 'Chi e\'',
                    quali: lePersone,
                    adesso: _scelte.persona,
                    scelto: (uno) =>
                        setState(() => _scelte = _scelte.con(persona: uno)),
                  ),
                  if (haCapelli)
                    _Fila(
                      titolo: 'Capelli',
                      quali: iCapelli,
                      adesso: _scelte.capelli,
                      scelto: (uno) =>
                          setState(() => _scelte = _scelte.con(capelli: uno)),
                    ),
                  if (haCapelli && _scelte.capelli != 'calvo')
                    _Fila(
                      titolo: 'Colore dei capelli',
                      quali: iColoriDeiCapelli,
                      adesso: _scelte.coloreCapelli,
                      scelto: (uno) => setState(
                        () => _scelte = _scelte.con(coloreCapelli: uno),
                      ),
                    ),
                  _Fila(
                    titolo: 'Barba',
                    quali: leBarbe,
                    adesso: _scelte.barba,
                    scelto: (uno) =>
                        setState(() => _scelte = _scelte.con(barba: uno)),
                  ),
                  if (_scelte.barba != 'nessuna')
                    _Fila(
                      titolo: 'Colore della barba',
                      quali: iColoriDellaBarba,
                      adesso: _scelte.coloreBarba,
                      sotto:
                          'Lasciando «naturale» segue i capelli: '
                          'viene ${_scelte.barbaComeViene}.',
                      scelto: (uno) => setState(
                        () => _scelte = _scelte.con(coloreBarba: uno),
                      ),
                    ),
                  _Fila(
                    titolo: 'Carnagione',
                    quali: leCarnagioni,
                    adesso: _scelte.carnagione,
                    scelto: (uno) =>
                        setState(() => _scelte = _scelte.con(carnagione: uno)),
                  ),
                  _Fila(
                    titolo: 'Occhi',
                    quali: iColoriDegliOcchi,
                    adesso: _scelte.occhi,
                    scelto: (uno) =>
                        setState(() => _scelte = _scelte.con(occhi: uno)),
                  ),
                  _Fila(
                    titolo: 'Occhiali',
                    quali: gliOcchiali,
                    adesso: _scelte.occhiali,
                    scelto: (uno) =>
                        setState(() => _scelte = _scelte.con(occhiali: uno)),
                  ),
                  _Fila(
                    titolo: 'Vestito',
                    quali: iVestiti,
                    adesso: _scelte.vestito,
                    scelto: (uno) =>
                        setState(() => _scelte = _scelte.con(vestito: uno)),
                  ),
                  if (siRicolora)
                    _Fila(
                      titolo: 'Colore del vestito',
                      quali: iColoriDelVestito,
                      adesso: _scelte.coloreVestito,
                      scelto: (uno) => setState(
                        () => _scelte = _scelte.con(coloreVestito: uno),
                      ),
                    ),
                  if (_scelte.vestito != 'nessuno')
                    _Fila(
                      titolo: 'Collana',
                      quali: leCollane,
                      adesso: _scelte.collana,
                      scelto: (uno) =>
                          setState(() => _scelte = _scelte.con(collana: uno)),
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

/// Una fila di scelte.
class _Fila extends StatelessWidget {
  const _Fila({
    required this.titolo,
    required this.quali,
    required this.adesso,
    required this.scelto,
    this.sotto = '',
  });

  final String titolo;
  final List<(String, String)> quali;
  final String adesso;
  final ValueChanged<String> scelto;
  final String sotto;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 14),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(titolo, style: Theme.of(context).textTheme.labelLarge),
        if (sotto.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              sotto,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final (chiave, come) in quali)
              ChoiceChip(
                label: Text(come),
                selected: adesso == chiave,
                onSelected: (_) => scelto(chiave),
              ),
          ],
        ),
      ],
    ),
  );
}
