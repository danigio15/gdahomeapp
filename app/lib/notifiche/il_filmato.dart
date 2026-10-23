/// Il mini video del movimento: cinque secondi prima e cinque dopo.
///
/// Il video lo fa la casa (`ponte/src/i-filmati.js`) con le istantanee della
/// telecamera, due al secondo, e lo tiene chiuso con una chiave che ha solo
/// la notifica. Qui lo si chiede sul filo col numero e la chiave della
/// notifica (`ponte/notifiche/filmato`): la casa lo da' solo a un utente
/// entrato che quella telecamera la vede. Non passa mai da Google, da Apple
/// o dal centralino in chiaro, e il telefono non lo salva.
library;

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../ponte/errori.dart';
import '../parole.dart';

/// Un fotogramma: `t` sono i millisecondi dal movimento (meno prima, piu'
/// dopo).
typedef FotogrammaDelFilmato = ({int t, Uint8List jpeg});

class FilmatoDelMovimento {
  const FilmatoDelMovimento({
    required this.camera,
    required this.quando,
    required this.fotogrammi,
  });

  final String camera;
  final DateTime quando;

  /// In ordine di tempo, almeno uno.
  final List<FotogrammaDelFilmato> fotogrammi;

  /// Dal primo all'ultimo fotogramma.
  int get dal => fotogrammi.first.t;
  int get al => fotogrammi.last.t;

  /// Dalla risposta della casa, com'e' arrivata sul filo. `null` se non e'
  /// un video.
  static FilmatoDelMovimento? daTesto(String testo) {
    try {
      final letto = jsonDecode(testo);
      final dentro = letto is Map && letto['result'] is Map
          ? letto['result'] as Map
          : letto;
      return daMappa(dentro);
    } catch (_) {
      return null;
    }
  }

  static FilmatoDelMovimento? daMappa(Object? grezzo) {
    if (grezzo is! Map) return null;
    final camera = grezzo['camera'];
    final quando = grezzo['quando'];
    final elenco = grezzo['fotogrammi'];
    if (camera is! String || quando is! num || elenco is! List) return null;
    final fotogrammi = <FotogrammaDelFilmato>[
      for (final uno in elenco)
        if (uno is Map && uno['t'] is num && uno['jpeg'] is String)
          (t: (uno['t'] as num).toInt(), jpeg: base64.decode(uno['jpeg'])),
    ]..sort((a, b) => a.t.compareTo(b.t));
    if (fotogrammi.isEmpty) return null;
    return FilmatoDelMovimento(
      camera: camera,
      quando: DateTime.fromMillisecondsSinceEpoch(quando.toInt()),
      fotogrammi: fotogrammi,
    );
  }
}

/// Come e' andata la domanda del video.
enum EsitoDelFilmato {
  /// Il video c'e'.
  arrivato,

  /// La casa ha risposto, e il video non c'e': scaduto (tre giorni), o la
  /// telecamera a questo utente non si mostra, o la casa non e' Premium.
  nonCe,

  /// La casa non ha risposto: il filo non si e' aperto in tempo, o e' caduto.
  /// Non vuol dire che il video non ci sia — si riprova.
  nonRisponde,
}

/// I codici con cui la casa dice davvero «quel video non c'e' per te».
/// Tutto il resto — il filo che cade, una risposta che non arriva — e'
/// «non risponde», e si riprova.
const Set<String> _codiciDelNo = {
  'not_found',
  'invalid_format',
  'unauthorized',
  'premium-richiesto',
  'unknown_command',
  /* Il video e' rimasto senza fotogrammi: la telecamera in quei secondi non
   * ha dato immagini. Riprovare non lo fa venire. */
  'filmato-vuoto',
};

/// Chiede il video alla casa. La casa aspetta i cinque secondi dopo, se il
/// video si sta ancora facendo: per questo si aspetta piu' del solito.
///
/// «Non c'è il video»: toccando la notifica dalla schermata bloccata l'app
/// parte da zero, e il filo con la casa si sta ancora aprendo. Prima la
/// domanda partiva in quel momento, trovava il filo chiuso e si arrendeva
/// subito — e la pagina diceva «il video non c'è più» di un video che c'era.
/// Adesso si aspetta il filo, e si riprova finche' c'e' tempo ([attesa]):
/// «non c'e'» lo dice solo la casa.
Future<({EsitoDelFilmato esito, FilmatoDelMovimento? filmato, String? codice})>
ilFilmatoDi(
  Collegamento collegamento,
  ({String id, String chiave}) film, {
  Duration attesa = const Duration(seconds: 30),
  Duration fraUnaProvaELAltra = const Duration(seconds: 1),
}) async {
  /* Le prove, contate: una al secondo per [attesa]. */
  final prove = (attesa.inMilliseconds ~/ fraUnaProvaELAltra.inMilliseconds)
      .clamp(1, 1000);
  for (var prova = 0; ; prova += 1) {
    final filo = collegamento.filo;
    if (filo != null && filo.dentro) {
      try {
        final testo = await filo.testoDi({
          'type': 'ponte/notifiche/filmato',
          'film': {'id': film.id, 'chiave': film.chiave},
        }, entro: const Duration(seconds: 40));
        /* Un paio di megabyte di base64: si aprono fuori dal filo che
         * disegna. */
        final filmato = await compute(FilmatoDelMovimento.daTesto, testo);
        return filmato == null
            ? (esito: EsitoDelFilmato.nonCe, filmato: null, codice: null)
            : (esito: EsitoDelFilmato.arrivato, filmato: filmato, codice: null);
      } on ComandoRifiutato catch (errore) {
        if (_codiciDelNo.contains(errore.codice)) {
          return (
            esito: EsitoDelFilmato.nonCe,
            filmato: null,
            codice: errore.codice,
          );
        }
      } catch (_) {
        /* Il filo caduto a meta', una risposta in ritardo: si riprova. */
      }
    }
    if (prova >= prove) {
      return (esito: EsitoDelFilmato.nonRisponde, filmato: null, codice: null);
    }
    await Future<void>.delayed(fraUnaProvaELAltra);
  }
}

/// Il video che gira: i fotogrammi alla loro ora, poi da capo. Un tocco lo
/// ferma e lo fa ripartire. Sotto, la barra del tempo col segno del
/// movimento.
class LettoreDelFilmato extends StatefulWidget {
  const LettoreDelFilmato(this.filmato, {super.key, this.fermo});

  final FilmatoDelMovimento filmato;

  /// Fermo su un fotogramma, per i disegni e le prove: i millisecondi dal
  /// movimento.
  final int? fermo;

  @override
  State<LettoreDelFilmato> createState() => _StatoDelLettore();
}

class _StatoDelLettore extends State<LettoreDelFilmato> {
  int _qui = 0;
  bool _fermo = false;
  Timer? _prossimo;

  List<FotogrammaDelFilmato> get _fotogrammi => widget.filmato.fotogrammi;

  @override
  void initState() {
    super.initState();
    if (widget.fermo != null) {
      _fermo = true;
      final i = _fotogrammi.indexWhere((f) => f.t >= widget.fermo!);
      _qui = i < 0 ? _fotogrammi.length - 1 : i;
    } else {
      _avanti();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    /* Tutti i fotogrammi pronti prima: senza, il primo giro sfarfalla. */
    for (final uno in _fotogrammi) {
      unawaited(precacheImage(MemoryImage(uno.jpeg), context));
    }
  }

  void _avanti() {
    _prossimo?.cancel();
    if (_fermo) return;
    final ultimo = _qui >= _fotogrammi.length - 1;
    /* Fra un fotogramma e l'altro il tempo vero; alla fine una pausa, poi da
     * capo. */
    final attesa = ultimo
        ? 1200
        : (_fotogrammi[_qui + 1].t - _fotogrammi[_qui].t).clamp(80, 1500);
    _prossimo = Timer(Duration(milliseconds: attesa), () {
      if (!mounted) return;
      setState(() => _qui = ultimo ? 0 : _qui + 1);
      _avanti();
    });
  }

  void _tocca() {
    setState(() => _fermo = !_fermo);
    _avanti();
  }

  @override
  void dispose() {
    _prossimo?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final fotogramma = _fotogrammi[_qui];
    final dal = widget.filmato.dal;
    final lungo = (widget.filmato.al - dal).clamp(1, 1 << 30);
    final secondi = (fotogramma.t / 1000).round();
    final detto = secondi == 0
        ? inLingua(it: 'il movimento', en: 'motion')
        : secondi < 0
        ? '$secondi s'
        : '+$secondi s';
    return GestureDetector(
      onTap: _tocca,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.memory(
            fotogramma.jpeg,
            key: const Key('filmato-fotogramma'),
            fit: BoxFit.cover,
            gaplessPlayback: true,
          ),
          /* Il tempo: in basso, sopra la barra. */
          Positioned(
            right: 12,
            bottom: 18,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                detto,
                key: const Key('filmato-tempo'),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
            ),
          ),
          if (_fermo)
            const Center(
              child: CircleAvatar(
                radius: 30,
                backgroundColor: Colors.black54,
                child: Icon(
                  Icons.play_arrow_rounded,
                  color: Colors.white,
                  size: 40,
                ),
              ),
            ),
          /* La barra: dove si e', e il segno del movimento. */
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: 6,
            child: LayoutBuilder(
              builder: (context, misure) {
                final largo = misure.maxWidth;
                final fatto = (fotogramma.t - dal) / lungo;
                final movimento = (0 - dal) / lungo;
                return Stack(
                  children: [
                    Container(color: Colors.white24),
                    Container(
                      width: largo * fatto.clamp(0.0, 1.0),
                      color: Colors.white,
                    ),
                    if (movimento > 0 && movimento < 1)
                      Positioned(
                        left: largo * movimento - 2,
                        top: 0,
                        bottom: 0,
                        width: 4,
                        child: Container(
                          key: const Key('filmato-movimento'),
                          color: const Color(0xFFEF4444),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
