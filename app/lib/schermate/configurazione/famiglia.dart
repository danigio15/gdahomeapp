/// Le schermate delle famiglie: quelle di cui ce n'e' piu' di una.
///
/// Auto elettriche, impianti solari, centrali d'allarme, scaldabagni, impianti
/// termici, continuita': la plancia ne tiene un elenco piu' la chiave che dice
/// qual e' quella scelta, e ogni voce si porta dentro **la sua mappatura di
/// entita'** e **le sue foto** (vedi `casa/plancia/piu_di_uno.dart`).
///
/// E' una schermata sola per tutte e sei, come per gli elenchi: cambia cosa si
/// chiede, non come si aggiunge, si sceglie o si toglie. Quello che cambia
/// davvero rispetto a un elenco semplice sono tre cose, e sono le tre che
/// mancavano:
///
///  - **la scelta.** Una pastiglia dice qual e' quella che si vede nella
///    pagina, e si cambia con un tocco.
///  - **le caselle dentro la voce.** Le diciassette domande dell'auto —
///    batteria, autonomia, stato della ricarica — hanno una risposta **per
///    auto**: e' questo che fa cambiare tutta la pagina quando si passa da una
///    all'altra.
///  - **le foto.** L'auto ne vuole due, ferma e attaccata alla spina.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/caselle.dart' as le_caselle;
import '../../casa/plancia/piu_di_uno.dart';
import '../../vestito/pezzi.dart';
import 'le_foto.dart';
import 'pezzi.dart';

/// Un campo di una voce, oltre a quelli che hanno tutte.
class CampoDellaVoce {
  const CampoDellaVoce(
    this.chiave,
    this.etichetta, {
    this.spiega,
    this.entita = false,
    this.domini = const [],
  });

  final String chiave;
  final String etichetta;
  final String? spiega;
  final bool entita;
  final List<String> domini;
}

/// La schermata di una famiglia.
class SchermataDiFamiglia extends StatelessWidget {
  const SchermataDiFamiglia({
    super.key,
    required this.titolo,
    required this.sotto,
    required this.collegamento,
    required this.famiglia,
    this.campi = const [],
    this.leFoto = false,
    this.sezioneDelleCaselle = '',
  });

  final String titolo;
  final String sotto;
  final Collegamento collegamento;
  final Famiglia famiglia;

  /// I campi propri: la marca e il modello di un'auto, l'entita' di una
  /// centrale.
  final List<CampoDellaVoce> campi;

  /// `true` per chi ha una foto — o due, come le auto.
  final bool leFoto;

  /// Da quale sezione del catalogo vengono le caselle di ogni voce: `ev`,
  /// `boiler`. Vuoto quando la famiglia non ne ha.
  final String sezioneDelleCaselle;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: titolo,
    sotto: sotto,
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) => [
      _Famiglia(
        collegamento: collegamento,
        famiglia: famiglia,
        campi: campi,
        leFoto: leFoto,
        sezioneDelleCaselle: sezioneDelleCaselle,
        scatto: scatto,
        quaderno: quaderno,
      ),
    ],
  );
}

class _Famiglia extends StatefulWidget {
  const _Famiglia({
    required this.collegamento,
    required this.famiglia,
    required this.campi,
    required this.leFoto,
    required this.sezioneDelleCaselle,
    required this.scatto,
    required this.quaderno,
  });

  final Collegamento collegamento;
  final Famiglia famiglia;
  final List<CampoDellaVoce> campi;
  final bool leFoto;
  final String sezioneDelleCaselle;
  final dynamic scatto;
  final Quaderno quaderno;

  @override
  State<_Famiglia> createState() => _FamigliaState();
}

class _FamigliaState extends State<_Famiglia> {
  Elenco? _elenco;
  int _daQualeScatto = -1;

  Elenco get elenco {
    final scatto = widget.scatto;
    if (_elenco == null || _daQualeScatto != scatto.revisione) {
      _elenco = Elenco.da(
        widget.famiglia,
        elenco: scatto.aperto(widget.famiglia.chiave),
        scelta: widget.famiglia.haUnaScelta
            ? scatto.aperto(widget.famiglia.laScelta)
            : null,
      );
      _daQualeScatto = scatto.revisione as int;
    }
    return _elenco!;
  }

  void _segna() {
    widget.quaderno.segna(widget.famiglia.chiave, elenco.daScrivere);
    if (widget.famiglia.haUnaScelta) {
      widget.quaderno.segna(widget.famiglia.laScelta, elenco.sceltaDaScrivere);
    }
    setState(() {});
  }

  Future<void> _apri(int quale) async {
    final voce = quale < 0
        ? Voce.nuova('')
        : Voce(Map<String, dynamic>.from(elenco.voci[quale].dentro));
    final fatto = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (dentro) => _UnaVoce(
          collegamento: widget.collegamento,
          famiglia: widget.famiglia,
          campi: widget.campi,
          leFoto: widget.leFoto,
          sezioneDelleCaselle: widget.sezioneDelleCaselle,
          voce: voce,
          nuova: quale < 0,
        ),
      ),
    );
    if (fatto != true) return;
    if (quale < 0) {
      elenco.aggiungi(voce);
    } else {
      elenco.voci[quale] = voce;
    }
    _segna();
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (elenco.voci.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 28),
            child: StatoVuoto(
              icona: Icons.playlist_add_rounded,
              titolo: 'Non ce n\'e\' ancora',
              sotto: 'Aggiungi ${widget.famiglia.unaCosa} qui sotto.',
              dentroUnaLista: true,
            ),
          )
        else
          for (final (quale, una) in elenco.voci.indexed) ...[
            _LaVoce(
              voce: una,
              scelta: elenco.scelta == quale,
              siSceglie: widget.famiglia.haUnaScelta,
              primo: quale == 0,
              ultimo: quale == elenco.voci.length - 1,
              apri: () => _apri(quale),
              scegli: () {
                elenco.scelta = quale;
                _segna();
              },
              togli: () {
                elenco.togli(quale);
                _segna();
              },
              sposta: (diQuanto) {
                elenco.sposta(quale, diQuanto);
                _segna();
              },
            ),
            const SizedBox(height: 10),
          ],
        const SizedBox(height: 6),
        FilledButton.tonalIcon(
          onPressed: () => _apri(-1),
          icon: const Icon(Icons.add_rounded),
          label: Text('Aggiungi ${widget.famiglia.unaCosa}'),
        ),
        if (widget.famiglia.haUnaScelta && elenco.voci.length > 1) ...[
          const SizedBox(height: 16),
          Text(
            'Quella con la pastiglia e\' quella che si vede nella plancia. '
            'Le altre restano configurate: si passa dall\'una all\'altra da '
            'li\'.',
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: colori.onSurfaceVariant, height: 1.4),
          ),
        ],
      ],
    );
  }
}

class _LaVoce extends StatelessWidget {
  const _LaVoce({
    required this.voce,
    required this.scelta,
    required this.siSceglie,
    required this.primo,
    required this.ultimo,
    required this.apri,
    required this.scegli,
    required this.togli,
    required this.sposta,
  });

  final Voce voce;
  final bool scelta;
  final bool siSceglie;
  final bool primo;
  final bool ultimo;
  final VoidCallback apri;
  final VoidCallback scegli;
  final VoidCallback togli;
  final void Function(int diQuanto) sposta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final quante = voce.caselle.length;
    return Scheda(
      quandoPremuta: apri,
      bordo: scelta ? colori.primary : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  voce.nome.isEmpty ? '(senza nome)' : voce.nome,
                  style: Theme.of(context).textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              if (scelta && siSceglie) const Bollino('nella plancia'),
            ],
          ),
          if (voce.sotto.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              voce.sotto,
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: colori.onSurfaceVariant),
            ),
          ],
          const SizedBox(height: 6),
          Text(
            [
              quante == 0
                  ? 'nessuna entita\' mappata'
                  : '$quante ${quante == 1 ? 'entita\'' : 'entita\''} mappate',
              if (voce.foto.isNotEmpty) 'con foto',
            ].join(' · '),
            style: Theme.of(context).textTheme.labelSmall
                ?.copyWith(color: colori.onSurfaceVariant),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              if (siSceglie && !scelta)
                TextButton(
                  onPressed: scegli,
                  child: const Text('Mettila nella plancia'),
                ),
              const Spacer(),
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
              IconButton(
                onPressed: togli,
                icon: const Icon(Icons.delete_outline_rounded),
                color: colori.error,
                tooltip: 'Togli',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/* ─── La schermata di una voce ───────────────────────────────────────────── */

class _UnaVoce extends StatefulWidget {
  const _UnaVoce({
    required this.collegamento,
    required this.famiglia,
    required this.campi,
    required this.leFoto,
    required this.sezioneDelleCaselle,
    required this.voce,
    required this.nuova,
  });

  final Collegamento collegamento;
  final Famiglia famiglia;
  final List<CampoDellaVoce> campi;
  final bool leFoto;
  final String sezioneDelleCaselle;
  final Voce voce;
  final bool nuova;

  @override
  State<_UnaVoce> createState() => _UnaVoceState();
}

class _UnaVoceState extends State<_UnaVoce> {
  Map<String, le_caselle.SezioneDiCaselle> _tutte = le_caselle.caselleLette;
  bool _soloLeVuote = false;

  @override
  void initState() {
    super.initState();
    if (_tutte.isEmpty) {
      le_caselle.leggiLeCaselle().then((lette) {
        if (mounted) setState(() => _tutte = lette);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final voce = widget.voce;
    final sezione = _tutte[widget.sezioneDelleCaselle];
    final caselle = sezione?.caselle ?? const [];
    final mappate = voce.caselle;
    final piene = caselle.where(
      (una) => (mappate[una.chiave] ?? '').isNotEmpty,
    );
    final daMostrare = _soloLeVuote
        ? caselle.where((una) => (mappate[una.chiave] ?? '').isEmpty).toList()
        : caselle;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.nuova
              ? 'Aggiungi ${widget.famiglia.unaCosa}'
              : (voce.nome.isEmpty ? 'Senza nome' : voce.nome),
        ),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                children: [
                  CampoDiTesto(
                    etichetta: 'Come si chiama',
                    valore: voce.nome,
                    suggerimento: 'Leapmotor B10',
                    cambiato: (scritto) =>
                        setState(() => voce.metti('name', scritto)),
                  ),
                  const SizedBox(height: 14),
                  for (final campo in widget.campi) ...[
                    if (campo.entita)
                      CampoDiEntita(
                        etichetta: campo.etichetta,
                        valore: '${voce.dentro[campo.chiave] ?? ''}',
                        domini: campo.domini,
                        contesto: widget.famiglia.unaCosa,
                        collegamento: widget.collegamento,
                        cambiato: (scritto) =>
                            setState(() => voce.metti(campo.chiave, scritto)),
                      )
                    else
                      CampoDiTesto(
                        etichetta: campo.etichetta,
                        valore: '${voce.dentro[campo.chiave] ?? ''}',
                        suggerimento: campo.spiega,
                        cambiato: (scritto) =>
                            setState(() => voce.metti(campo.chiave, scritto)),
                      ),
                    const SizedBox(height: 14),
                  ],

                  if (widget.leFoto) ...[
                    const SizedBox(height: 10),
                    const Insegna('Le foto'),
                    _UnaRigaDiFoto(
                      titolo: 'La foto',
                      sotto: 'Quella che si vede di solito',
                      adesso: voce.foto,
                      collegamento: widget.collegamento,
                      scelta: (dove) => setState(() => voce.foto = dove),
                    ),
                    const SizedBox(height: 8),
                    _UnaRigaDiFoto(
                      titolo: 'Con la spina attaccata',
                      sotto: 'Facoltativa: si vede mentre carica',
                      adesso: voce.fotoAttaccata,
                      collegamento: widget.collegamento,
                      scelta: (dove) =>
                          setState(() => voce.fotoAttaccata = dove),
                    ),
                  ],

                  if (widget.famiglia.haLeCaselle && caselle.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    const Insegna('Le sue entita\''),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
                      child: Text(
                        'Sono di questa, non della casa: e\' per questo che '
                        'cambiandola cambia tutta la pagina.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colori.onSurfaceVariant,
                          height: 1.4,
                        ),
                      ),
                    ),
                    Scheda(
                      colore: colori.surfaceContainerHigh,
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${piene.length} su ${caselle.length} riempite',
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                          ),
                          FilterChip(
                            label: const Text('Solo le vuote'),
                            selected: _soloLeVuote,
                            onSelected: (acceso) =>
                                setState(() => _soloLeVuote = acceso),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    for (final una in daMostrare) ...[
                      CampoDiEntita(
                        etichetta: una.etichetta,
                        chiave: una.chiave,
                        valore: mappate[una.chiave] ?? '',
                        collegamento: widget.collegamento,
                        cambiato: (scritto) => setState(() {
                          final dopo = Map<String, String>.from(voce.caselle);
                          if (scritto.trim().isEmpty) {
                            dopo.remove(una.chiave);
                          } else {
                            dopo[una.chiave] = scritto.trim();
                          }
                          voce.caselle = dopo;
                        }),
                      ),
                      const SizedBox(height: 14),
                    ],
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: voce.nome.trim().isEmpty
                      ? null
                      : () => Navigator.of(context).pop(true),
                  child: Text(
                    voce.nome.trim().isEmpty
                        ? 'Dagli un nome'
                        : (widget.nuova ? 'Aggiungi' : 'Fatto'),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _UnaRigaDiFoto extends StatelessWidget {
  const _UnaRigaDiFoto({
    required this.titolo,
    required this.sotto,
    required this.adesso,
    required this.collegamento,
    required this.scelta,
  });

  final String titolo;
  final String sotto;
  final String adesso;
  final Collegamento collegamento;
  final ValueChanged<String> scelta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Scheda(
      quandoPremuta: () async {
        final scelto = await scegliUnaFoto(
          context,
          collegamento: collegamento,
          titolo: titolo,
          adesso: adesso,
        );
        if (scelto != null) scelta(scelto);
      },
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  titolo,
                  style: Theme.of(context).textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 3),
                Text(
                  adesso.isEmpty ? sotto : adesso,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: adesso.isEmpty
                      ? Theme.of(context).textTheme.bodySmall
                            ?.copyWith(color: colori.onSurfaceVariant)
                      : TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 11,
                          color: colori.onSurfaceVariant,
                        ),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded),
        ],
      ),
    );
  }
}
