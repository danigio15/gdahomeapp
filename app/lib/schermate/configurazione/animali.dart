/// Gli animali di casa (#358): la scheda «🐾 Animali» della Config.
///
/// Un animale non e' un apparecchio, e non e' una riga di due campi: e' un
/// nome, una foto, una stanza e ventitre' caselle sparse su piu' dispositivi
/// — la ciotola, la lettiera, l'acqua, la porta col microchip, il collare —
/// piu' otto soglie. Le caselle si riempiono da sole scegliendo il
/// dispositivo da un'integrazione (PetKit, SurePetcare, Tractive, Litter
/// Robot), come per gli elettrodomestici, con una differenza che viene
/// dall'animale: le sue cose stanno su piu' dispositivi, e collegarne un
/// secondo si somma al primo.
///
/// Il modello e il motore che indovina stanno in `casa/plancia/animali.dart`,
/// accanto all'originale.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/animali.dart';
import '../../casa/plancia/apparecchio.dart';
import '../../casa/plancia/legame.dart' show stanzaPerArea;
import '../../casa/plancia/scatto.dart';
import '../../vestito/pezzi.dart';
import 'integrazioni.dart';
import 'le_foto.dart';
import 'pezzi.dart';

class SchermataDegliAnimali extends StatefulWidget {
  const SchermataDegliAnimali({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDegliAnimali> createState() => _SchermataDegliAnimaliState();
}

class _SchermataDegliAnimaliState extends State<SchermataDegliAnimali> {
  List<Map<String, dynamic>>? _elenco;
  int _daQualeScatto = -1;

  List<Map<String, dynamic>> _leggi(Scatto scatto) {
    if (_elenco == null || _daQualeScatto != scatto.revisione) {
      _elenco = normalizzaAnimali(scatto.aperto(chiaveDegliAnimali));
      _daQualeScatto = scatto.revisione;
    }
    return _elenco!;
  }

  List<Apparecchio> _stanzeDi(Scatto scatto) => leggiGliApparecchi(
    scatto.aperto(Sezione.stanze.chiave),
    sezione: Sezione.stanze,
  );

  /// Si scrive **normalizzato**, come fa la plancia a ogni salvataggio: tutte
  /// le chiavi, nell'ordine suo.
  void _segna(Quaderno quaderno) {
    quaderno.segna(chiaveDegliAnimali, normalizzaAnimali(_elenco));
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Gli animali',
    sotto:
        'Il gatto e il cane di casa: la ciotola, la lettiera, la fontanella, '
        'la porta col microchip, il collare. Ogni animale ha la sua scheda '
        'nella pagina Animali della plancia.',
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      final elenco = _leggi(scatto);
      final stanze = _stanzeDi(scatto);
      final pieno = elenco.length >= massimoAnimali;
      return [
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: pieno ? null : () => _dalCatalogo(stanze, quaderno),
            icon: const Icon(Icons.extension_rounded),
            label: const Text('Aggiungi da un\'integrazione'),
          ),
        ),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
          child: Text(
            'PetKit, SurePetcare, Tractive, Litter-Robot… Scegli il '
            'dispositivo e le sue entita\' finiscono da sole nelle caselle '
            'giuste: il livello del cibo, l\'ultima pulizia, la posizione.',
            style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
              color: Theme.of(dentro).colorScheme.onSurfaceVariant,
              height: 1.4,
            ),
          ),
        ),
        if (elenco.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 28),
            child: StatoVuoto(
              icona: Icons.pets_rounded,
              titolo: 'Nessun animale configurato',
              sotto: 'Aggiungi un animale qui sotto.',
              dentroUnaLista: true,
            ),
          )
        else
          for (final (posto, uno) in elenco.indexed)
            _LaScheda(
              animale: uno,
              apri: () => _apri(posto, stanze, quaderno),
              togli: () => _togli(posto, uno, quaderno),
            ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton.tonalIcon(
            onPressed: pieno ? null : () => _apri(-1, stanze, quaderno),
            icon: const Icon(Icons.add_rounded),
            label: Text(
              pieno ? 'Non piu\' di $massimoAnimali' : 'Aggiungi animale',
            ),
          ),
        ),
      ];
    },
  );

  Future<void> _apri(
    int posto,
    List<Apparecchio> stanze,
    Quaderno quaderno,
  ) async {
    final nuovo = posto < 0;
    final quale = nuovo
        ? normalizzaAnimale(const {}, _elenco!.length)
        : normalizzaAnimale(_elenco![posto], posto);
    final fatto = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (dentro) => _UnAnimale(
          collegamento: widget.collegamento,
          animale: quale,
          stanze: stanze,
          indice: nuovo ? _elenco!.length : posto,
        ),
      ),
    );
    if (fatto != true) return;
    if (nuovo) {
      _elenco!.add(quale);
    } else {
      _elenco![posto] = quale;
    }
    _segna(quaderno);
  }

  Future<void> _dalCatalogo(List<Apparecchio> stanze, Quaderno quaderno) async {
    final scelto = await scegliDaUnIntegrazione(
      context,
      collegamento: widget.collegamento,
    );
    if (scelto == null || !mounted) return;
    final andata = collegaAnimaleAlDispositivo(
      dispositivo: scelto.dispositivo,
      entita: scelto.tutte.isNotEmpty ? scelto.tutte : scelto.entita,
      stato: (id) => widget.collegamento.stato?[id],
      nomeDellIntegrazione: scelto.integrazione?.nome ?? '',
      indice: _elenco!.length,
    );
    /* Niente riconosciuto: e' la stessa risposta della plancia, e non si
     * salva niente — una scheda vuota con dentro il nome di un termostato
     * non e' un animale. */
    if (andata.riempite.isEmpty) {
      await showDialog<void>(
        context: context,
        builder: (dentro) => AlertDialog(
          title: const Text('Niente per un animale'),
          content: Text(
            'Da questo dispositivo non si riconosce niente di un animale: ne\' '
            'la ciotola, ne\' la lettiera, ne\' il collare. Se e\' '
            '${scelto.dispositivo.nome}, aggiungi l\'animale a mano e scegli '
            'le entita\' una per una.',
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.of(dentro).pop(),
              child: const Text('Ho capito'),
            ),
          ],
        ),
      );
      return;
    }
    final animale = andata.animale;
    if ('${animale['stanza']}'.isEmpty) {
      animale['stanza'] = stanzaPerArea(scelto.dispositivo.stanza, stanze);
    }
    _elenco!.add(animale);
    _segna(quaderno);
    if (!mounted) return;
    final quante = andata.riempite.length;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${animale['nome']} — aggiunto da '
          '${scelto.integrazione?.nome ?? scelto.dispositivo.integrazione}: '
          '$quante ${quante == 1 ? 'casella riempita' : 'caselle riempite'}.',
        ),
      ),
    );
  }

  Future<void> _togli(
    int posto,
    Map<String, dynamic> quale,
    Quaderno quaderno,
  ) async {
    final nome = '${quale['nome']}'.isNotEmpty
        ? '${quale['nome']}'
        : 'questo animale';
    final sicuro = await showDialog<bool>(
      context: context,
      builder: (dentro) => AlertDialog(
        title: Text('Elimino $nome?'),
        content: const Text(
          'Sparisce dalla plancia. Le entita\' di casa non si toccano.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dentro).pop(false),
            child: const Text('Lascia stare'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dentro).pop(true),
            child: const Text('Elimina'),
          ),
        ],
      ),
    );
    if (sicuro != true) return;
    _elenco!.removeAt(posto);
    _segna(quaderno);
  }
}

/// La riga di un animale nell'elenco: il simbolo della specie, il nome, e da
/// cosa si capisce che e' configurato.
class _LaScheda extends StatelessWidget {
  const _LaScheda({
    required this.animale,
    required this.apri,
    required this.togli,
  });

  final Map<String, dynamic> animale;
  final VoidCallback apri;
  final VoidCallback togli;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final specie = specieDiSerie(animale['specie']);
    final nome = '${animale['nome']}'.isNotEmpty
        ? '${animale['nome']}'
        : 'Animale';
    final indizio = [
      '${animale['cibo_livello']}',
      '${animale['lettiera_ultima']}',
      '${animale['porta']}',
    ].firstWhere((uno) => uno.isNotEmpty, orElse: () => 'nessuna entita\'');
    final dispositivi = (animale['dispositivi'] as List).length;
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        onTap: apri,
        leading: CircleAvatar(
          backgroundColor: colori.primaryContainer,
          child: Text(specie.$2, style: const TextStyle(fontSize: 18)),
        ),
        title: Text(nome),
        subtitle: Text(
          dispositivi > 0
              ? '$indizio · $dispositivi '
                    '${dispositivi == 1 ? 'dispositivo' : 'dispositivi'}'
              : indizio,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
        ),
        trailing: IconButton(
          onPressed: togli,
          icon: const Icon(Icons.delete_outline_rounded),
          color: colori.error,
          tooltip: 'Elimina',
        ),
      ),
    );
  }
}

/// La scheda di un animale: tutte le caselle, a gruppi, come nella Config.
class _UnAnimale extends StatefulWidget {
  const _UnAnimale({
    required this.collegamento,
    required this.animale,
    required this.stanze,
    required this.indice,
  });

  final Collegamento collegamento;
  final Map<String, dynamic> animale;
  final List<Apparecchio> stanze;
  final int indice;

  @override
  State<_UnAnimale> createState() => _UnAnimaleState();
}

class _UnAnimaleState extends State<_UnAnimale> {
  String? _manca;

  Map<String, dynamic> get _a => widget.animale;
  Map<String, dynamic> get _soglie => _a['soglie'] as Map<String, dynamic>;

  void _tocca(VoidCallback cosa) => setState(() {
    _manca = null;
    cosa();
  });

  void _salva() {
    if (!animaleConQualcosa(_a)) {
      setState(
        () => _manca =
            'Serve almeno il nome, oppure un\'entita\' in una delle caselle.',
      );
      return;
    }
    Navigator.of(context).pop(true);
  }

  Future<void> _collega() async {
    final scelto = await scegliDaUnIntegrazione(
      context,
      collegamento: widget.collegamento,
    );
    if (scelto == null || !mounted) return;
    final andata = collegaAnimaleAlDispositivo(
      dispositivo: scelto.dispositivo,
      entita: scelto.tutte.isNotEmpty ? scelto.tutte : scelto.entita,
      stato: (id) => widget.collegamento.stato?[id],
      nomeDellIntegrazione: scelto.integrazione?.nome ?? '',
      indice: widget.indice,
      precedente: _a,
    );
    _tocca(() {
      _a
        ..clear()
        ..addAll(andata.animale);
    });
    if (!mounted) return;
    final quante = andata.riempite.length;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          quante == 0
              ? 'Niente da aggiungere: le caselle erano gia\' piene.'
              : '$quante ${quante == 1 ? 'casella compilata' : 'caselle compilate'}.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final nome = '${_a['nome']}';
    final foto = '${_a['foto']}';
    final stanza = '${_a['stanza']}';
    final dispositivi = (_a['dispositivi'] as List)
        .cast<Map<String, dynamic>>();
    return Scaffold(
      appBar: AppBar(title: Text(nome.isNotEmpty ? nome : 'Un animale')),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 32),
          children: [
            CampoDiTesto(
              etichetta: 'Nome',
              valore: nome,
              suggerimento: 'Micio',
              cambiato: (scritto) => _tocca(() => _a['nome'] = scritto.trim()),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              initialValue: specieDiSerie(_a['specie']).$1,
              decoration: const InputDecoration(
                labelText: 'Specie',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              items: [
                for (final (chiave, icona, parola) in leSpecie)
                  DropdownMenuItem(
                    value: chiave,
                    child: Text('$icona $parola'),
                  ),
              ],
              onChanged: (scelto) =>
                  _tocca(() => _a['specie'] = scelto ?? 'altro'),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                FilledButton.tonalIcon(
                  onPressed: () async {
                    final scelta = await scegliUnaFoto(
                      context,
                      collegamento: widget.collegamento,
                      titolo:
                          'La foto di ${nome.isNotEmpty ? nome : 'questo animale'}',
                      adesso: foto,
                    );
                    if (scelta == null) return;
                    _tocca(() => _a['foto'] = scelta);
                  },
                  icon: const Icon(Icons.photo_camera_rounded),
                  label: const Text('Scegli la foto'),
                ),
                if (foto.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  TextButton.icon(
                    onPressed: () => _tocca(() => _a['foto'] = ''),
                    icon: const Icon(Icons.close_rounded, size: 18),
                    label: const Text('Togli la foto'),
                  ),
                ],
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 4, 4, 0),
              child: Text(
                foto.isNotEmpty
                    ? foto
                    : 'Senza foto la scheda mostra il simbolo della specie.',
                style: testi.bodySmall?.copyWith(
                  color: colori.onSurfaceVariant,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              initialValue:
                  widget.stanze.any((una) => _idDellaStanza(una) == stanza)
                  ? stanza
                  : '',
              decoration: const InputDecoration(
                labelText: 'Stanza',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              items: [
                const DropdownMenuItem(
                  value: '',
                  child: Text('— Nessuna stanza —'),
                ),
                for (final una in widget.stanze)
                  DropdownMenuItem(
                    value: _idDellaStanza(una),
                    child: Text(una.nome.isNotEmpty ? una.nome : una.id),
                  ),
              ],
              onChanged: (scelto) => _tocca(() => _a['stanza'] = scelto ?? ''),
            ),
            const SizedBox(height: 18),
            Scheda(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'I dispositivi collegati',
                    style: testi.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  if (dispositivi.isEmpty)
                    Text(
                      'Nessuno: le caselle qui sotto si riempiono a mano, o '
                      'collegando un dispositivo.',
                      style: testi.bodySmall?.copyWith(
                        color: colori.onSurfaceVariant,
                        height: 1.4,
                      ),
                    )
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final uno in dispositivi)
                          Chip(
                            avatar: const Icon(Icons.link_rounded, size: 16),
                            label: Text(
                              '${uno['nome']}'
                              '${'${uno['integrazione_nome']}'.isNotEmpty ? ' · ${uno['integrazione_nome']}' : ''}',
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                      ],
                    ),
                  const SizedBox(height: 10),
                  FilledButton.tonalIcon(
                    onPressed: _collega,
                    icon: const Icon(Icons.extension_rounded, size: 18),
                    label: Text(
                      dispositivi.isEmpty
                          ? 'Collega un dispositivo'
                          : 'Collega un altro dispositivo',
                    ),
                  ),
                ],
              ),
            ),
            for (final (gruppo, titolo) in gruppiDellAnimale) ...[
              const SizedBox(height: 22),
              Insegna(titolo),
              for (final campo in leCaselleDellAnimale)
                if (campo.gruppo == gruppo) ...[
                  CampoDiEntita(
                    etichetta: campo.etichetta,
                    chiave: campo.chiave,
                    contesto: 'di ${nome.isNotEmpty ? nome : 'un animale'}',
                    domini: campo.domini,
                    esempio: campo.esempio,
                    valore: '${_a[campo.chiave] ?? ''}',
                    collegamento: widget.collegamento,
                    cambiato: (scritto) =>
                        _tocca(() => _a[campo.chiave] = scritto.trim()),
                  ),
                  if (campo.spiega != null)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(4, 3, 4, 0),
                      child: Text(
                        campo.spiega!,
                        style: testi.bodySmall?.copyWith(
                          color: colori.onSurfaceVariant,
                        ),
                      ),
                    ),
                  const SizedBox(height: 14),
                ],
              for (final azione in leAzioniDellAnimale)
                if (azione.gruppo == gruppo) ...[
                  CampoDiEntita(
                    etichetta: '${azione.glifo} ${azione.etichetta}',
                    chiave: azione.chiave,
                    contesto: 'di ${nome.isNotEmpty ? nome : 'un animale'}',
                    domini: azione.domini,
                    esempio: azione.esempio,
                    valore: '${_a[azione.chiave] ?? ''}',
                    collegamento: widget.collegamento,
                    cambiato: (scritto) =>
                        _tocca(() => _a[azione.chiave] = scritto.trim()),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(4, 3, 4, 0),
                    child: Text(
                      'Un tasto che compare sulla scheda dell\'animale. Va '
                      'bene un button.*, uno script.* o uno switch.*.',
                      style: testi.bodySmall?.copyWith(
                        color: colori.onSurfaceVariant,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                ],
            ],
            const SizedBox(height: 22),
            const Insegna('⚠️ Quando avvisare'),
            for (final (chiave, etichetta) in etichetteDelleSoglie) ...[
              CampoDiTesto(
                etichetta: etichetta,
                valore: '${_soglie[chiave] ?? ''}',
                suggerimento: '${soglieDiSerie[chiave]}',
                numerico: true,
                cambiato: (scritto) => _tocca(() {
                  /* Vuoto vale il valore di serie: e' cosi' che la plancia
                   * legge la casella, e cosi' si scrive. */
                  _soglie[chiave] = sogliaScritta(
                    scritto,
                    soglieDiSerie[chiave]!,
                  );
                }),
              ),
              const SizedBox(height: 12),
            ],
            Text(
              'Vuoto vale il valore di serie scritto in grigio.',
              style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
            ),
            const SizedBox(height: 22),
            if (_manca != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(
                  _manca!,
                  style: testi.bodyMedium?.copyWith(
                    color: colori.error,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            FilledButton.icon(
              onPressed: _salva,
              icon: const Icon(Icons.save_rounded),
              label: const Text('Salva animale'),
            ),
          ],
        ),
      ),
    );
  }

  /// L'identificativo della stanza come lo scrive la plancia: `id`, o il
  /// nome se la stanza non ha un identificativo.
  static String _idDellaStanza(Apparecchio una) =>
      una.id.isNotEmpty ? una.id : una.nome;
}
