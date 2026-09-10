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
import '../../casa/plancia/marchi.dart';
import '../../casa/plancia/caselle.dart' as le_caselle;
import '../../casa/plancia/piu_di_uno.dart';
import '../../vestito/pezzi.dart';
import 'le_foto.dart';
import 'marche.dart';
import 'pezzi.dart';

/// Un campo di una voce, oltre a quelli che hanno tutte.
class CampoDellaVoce {
  const CampoDellaVoce(
    this.chiave,
    this.etichetta, {
    this.spiega,
    this.entita = false,
    this.domini = const [],
    this.come = ComeSiRiempie.aMano,
    this.venivaDa,
    this.bandiera = false,
  });

  final String chiave;
  final String etichetta;
  final String? spiega;
  final bool entita;
  final List<String> domini;

  /// Come si riempie: battendola, o scegliendo da un elenco.
  final ComeSiRiempie come;

  /// Come si chiamava, quando l'app la scriveva col nome sbagliato.
  ///
  /// La temperatura di uno scaldabagno finiva in `temp` e la plancia legge
  /// `temperatura`; la carica di un gruppo di continuita' in `battery` invece
  /// che `batteria`. Si salvavano senza un errore e non le leggeva nessuno.
  /// Quello che c'e' nel nome vecchio si vede lo stesso, e al primo
  /// salvataggio passa in quello giusto.
  final String? venivaDa;

  /// Un si'/no invece di una casella: il verso di una lettura.
  final bool bandiera;
}

/// Da dove viene quello che finisce in una casella.
enum ComeSiRiempie {
  /// Si batte. Va bene per il modello di un'auto, che e' una parola sua.
  aMano,

  /// **La marca**, da una griglia di loghi.
  ///
  /// Non e' un vezzo: chi ha una Škoda non deve indovinare se si scrive
  /// «Skoda», «skoda» o «Škoda», e la plancia quella marca la disegna col suo
  /// colore solo se la riconosce. Una casella di testo libero, con dentro un
  /// esempio scritto in grigio, e' anche il modo piu' rapido di far credere
  /// che l'esempio sia un dato bloccato nel codice.
  laMarca,

  /// La sagoma dell'auto, fra le otto della plancia.
  laSagoma,
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
                    /* Niente marca e modello veri qui dentro: un esempio
                     * scritto in grigio, visto di sfuggita, sembra un dato
                     * bloccato nel codice. */
                    suggerimento: 'Come la chiami tu',
                    cambiato: (scritto) =>
                        setState(() => voce.metti('name', scritto)),
                  ),
                  const SizedBox(height: 14),
                  for (final campo in widget.campi) ...[
                    switch (campo.come) {
                      /* Prima di tutto il nome vecchio, se ce n'e' uno: quello
                       * che ci sta dentro si legge, e il primo tocco lo
                       * sposta nella casella giusta. */
                      _ when campo.bandiera => SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        value: _leggi(voce, campo) == 'true',
                        onChanged: (acceso) => setState(
                          () => _scrivi(voce, campo, acceso ? true : null),
                        ),
                        title: Text(campo.etichetta),
                        subtitle: campo.spiega == null
                            ? null
                            : Text(campo.spiega!),
                        dense: true,
                      ),
                      ComeSiRiempie.laMarca => _LaMarca(
                        valore: '${voce.dentro[campo.chiave] ?? ''}',
                        collegamento: widget.collegamento,
                        cambiata: (scritto) =>
                            setState(() => voce.metti(campo.chiave, scritto)),
                      ),
                      ComeSiRiempie.laSagoma => _LaSagoma(
                        valore: '${voce.dentro[campo.chiave] ?? ''}',
                        cambiata: (scelta) =>
                            setState(() => voce.metti(campo.chiave, scelta)),
                      ),
                      ComeSiRiempie.aMano when campo.entita => CampoDiEntita(
                        etichetta: campo.etichetta,
                        valore: _leggi(voce, campo),
                        domini: campo.domini,
                        contesto: widget.famiglia.unaCosa,
                        collegamento: widget.collegamento,
                        cambiato: (scritto) =>
                            setState(() => _scrivi(voce, campo, scritto)),
                      ),
                      ComeSiRiempie.aMano => CampoDiTesto(
                        etichetta: campo.etichetta,
                        valore: _leggi(voce, campo),
                        suggerimento: campo.spiega,
                        cambiato: (scritto) =>
                            setState(() => _scrivi(voce, campo, scritto)),
                      ),
                    },
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

/// La marca dell'auto: il logo, il nome, e il tasto che apre la griglia.
class _LaMarca extends StatelessWidget {
  const _LaMarca({
    required this.valore,
    required this.collegamento,
    required this.cambiata,
  });

  final String valore;
  final Collegamento collegamento;
  final ValueChanged<String> cambiata;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final marca = marcaDaScritta(valore);
    return Scheda(
      padding: EdgeInsets.zero,
      child: ListTile(
        leading: SizedBox(
          width: 44,
          height: 44,
          child: marca == null
              ? Icon(
                  Icons.directions_car_filled_outlined,
                  color: colori.onSurfaceVariant,
                )
              : IlLogo(marca: marca, collegamento: collegamento, quanto: 40),
        ),
        title: Text(
          marca?.nome ?? (valore.isEmpty ? 'La marca' : valore),
          style: testi.titleSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          marca != null
              ? 'La plancia la disegna col suo colore'
              : (valore.isEmpty
                    ? 'Toccala e scegli dai loghi'
                    : 'Non e\' una delle marche che la plancia conosce: '
                          'sceglila per avere il logo'),
          style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
        ),
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: () async {
          final scelta = await scegliLaMarca(
            context,
            collegamento: collegamento,
            adesso: valore,
          );
          if (scelta != null) cambiata(scelta);
        },
      ),
    );
  }
}

/// La sagoma dell'auto: quale disegno la rappresenta quando non c'e' una foto.
class _LaSagoma extends StatelessWidget {
  const _LaSagoma({required this.valore, required this.cambiata});

  final String valore;
  final ValueChanged<String> cambiata;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final quale = leSagomeDellAuto
        .where((una) => una.id == valore)
        .firstOrNull;
    return Scheda(
      padding: EdgeInsets.zero,
      child: ListTile(
        leading: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: Text(
              quale?.disegno ?? '🚗',
              style: const TextStyle(fontSize: 26),
            ),
          ),
        ),
        title: Text(
          quale?.nome ?? 'Che auto e\'',
          style: testi.titleSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          'La sagoma che si vede quando non c\'e\' una foto',
          style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
        ),
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: () async {
          final scelta = await scegliLaSagoma(context, adesso: valore);
          if (scelta != null) cambiata(scelta);
        },
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

/// Quello che c'e' nella casella, o nel nome che aveva prima.
///
/// Il nome vecchio si legge finche' quello giusto e' vuoto: chi aveva battuto
/// la temperatura del suo scaldabagno la ritrova al suo posto invece di
/// trovare un campo vuoto e chiedersi dove sia finita.
String _leggi(Voce voce, CampoDellaVoce campo) {
  final adesso = '${voce.dentro[campo.chiave] ?? ''}';
  if (adesso.trim().isNotEmpty) return adesso;
  final vecchio = campo.venivaDa;
  return vecchio == null ? adesso : '${voce.dentro[vecchio] ?? ''}';
}

/// Scrive nella casella giusta, e toglie di mezzo quella vecchia.
///
/// Se restasse, chi apre la stessa scheda dal browser vedrebbe due caselle che
/// dicono la stessa cosa e non saprebbe quale conta.
void _scrivi(Voce voce, CampoDellaVoce campo, Object? valore) {
  voce.metti(campo.chiave, valore);
  final vecchio = campo.venivaDa;
  if (vecchio != null) voce.dentro.remove(vecchio);
}
