/// Una notifica toccata: cosa c'era dentro, e i suoi tasti.
///
/// «Quando si clicca sulla notifica venga aperta l'app con la
/// visualizzazione della stessa notifica.» Toccata, una notifica apre **la
/// sua pagina** (`la_notifica.dart`): com'era la notifica — il titolo, il
/// testo, la foto del momento o la scheda, i tasti — e sotto un tasto che
/// porta dove sta la cosa di cui parla (`notifiche/dove_apre.dart`): la
/// telecamera dal vivo, la pagina della plancia, «La tua giornata», il
/// navigatore.
///
/// Fanno eccezione il **campanello** che sta suonando, che si apre a tutto
/// schermo come una chiamata (la foto della porta, «Ignora» e «Apri»), e i
/// tasti della notifica: «Guarda» apre **la telecamera**
/// ([SchermataDellaTelecamera]), «Apri la giornata» la giornata, gli altri
/// vanno alla casa.
///
/// **La foto non e' mai passata da Google o da Apple.** Nella notifica c'e'
/// solo il nome della telecamera — e solo se a chi tiene questo telefono quella
/// telecamera si mostra (`ponte/src/notifiche.js`). La foto si chiede qui, alla
/// casa, sul filo cifrato, con le stesse regole della plancia: chi non la
/// vede nella plancia non la vede nemmeno qui.
///
/// **«Apri» col telefono bloccato chiede di sbloccarlo.** Il campanello si
/// mostra sopra il blocco perche' chi suona non aspetta; il cancello no: chi
/// trova il telefono sul tavolo non apre il cancello di casa.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io' show Directory;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../aggiornamento_obbligatorio.dart' show apriIlNegozio;
import '../casa/collegamento.dart';
import '../casa/la_finestra.dart';
import '../notifiche/consegna.dart';
import '../notifiche/dove_apre.dart';
import '../notifiche/il_filmato.dart';
import '../notifiche/le_immagini.dart';
import '../notifiche/modello.dart';
import '../notifiche/postino.dart';
import '../parole.dart';
import '../vestito/foto_a_misura.dart';
import '../vestito/tema.dart';
import 'la_notifica.dart';
import 'la_tua_giornata.dart';

/// Se un tocco su questa notifica apre la telecamera: «Guarda», o il tocco
/// sulla notifica del movimento. Serve che la notifica ne porti una — il
/// ponte la mette solo se a chi tiene il telefono quella telecamera si
/// mostra — e vale in Base come in Premium: la foto la da' la casa sul filo,
/// e dal nostro server non passa.
///
/// «Niente, su Android continua a non andare, e anche su iPhone»: toccando
/// la notifica — non il tasto — si apriva la pagina della notifica, che il
/// video non lo sa mostrare: c'era la foto, e basta. E sulla schermata
/// bloccata il tocco sulla notifica e' quello che si fa. Adesso una notifica
/// che porta il mini video, toccata, apre il video come «Guarda».
@visibleForTesting
bool apreLaTelecamera(ToccoDellaNotifica tocco) {
  final notifica = tocco.notifica;
  if (notifica.camera == null || notifica.chiamata) return false;
  if (tocco.tasto == null && notifica.film != null) return true;
  return tocco.tasto == 'guarda';
}

/// Dove va l'app per una notifica, quando il posto e' una pagina della
/// plancia o il navigatore: `true` se ci e' arrivata. Lo da' la schermata
/// che tiene la plancia (`home.dart`); senza, o con `false` — la casa non
/// risponde, la plancia quella pagina non ce l'ha — si apre la pagina
/// della notifica.
typedef VaiAllaNotifica = Future<bool> Function(DoveApre dove);

/// La foto di una telecamera, chiesta alla casa sul filo.
Future<Uint8List?> laFotoDi(Collegamento collegamento, String camera) async {
  final filo = collegamento.filo;
  if (filo == null || !filo.dentro) return null;
  try {
    final detto = await filo.risultato({
      'type': 'ponte/http',
      'metodo': 'GET',
      'percorso': '/api/camera_proxy/$camera',
    });
    if (detto is! Map || detto['stato'] != 200 || detto['corpo'] is! String) {
      return null;
    }
    return base64.decode(detto['corpo'] as String);
  } catch (_) {
    return null;
  }
}

/// Mostra quello che una notifica toccata deve mostrare.
Future<void> apriLaNotifica(
  BuildContext context, {
  required ToccoDellaNotifica tocco,
  required Collegamento collegamento,
  Postino? postino,
  VaiAllaNotifica? vaiA,
}) async {
  final notifica = tocco.notifica;
  /* «OK»: la notifica e' gia' tolta, e non c'e' altro da fare. */
  if (tocco.tasto == 'ok') return;
  /* Il riepilogo della sera: «Apri la giornata» (o «Apri Energia», da un
   * ponte di prima), o il tocco sulla notifica, aprono la pagina. Il
   * riepilogo semplice di Base, senza quel tasto, si legge nel foglio. */
  if (notifica.apreLaGiornata &&
      (tocco.tasto == tastoDellaGiornata || tocco.tasto == 'energia')) {
    await apriLaTuaGiornata(
      context,
      collegamento: collegamento,
      casa: tocco.casa,
    );
    return;
  }
  /* Un tasto premuto dalla notifica: si porta alla casa e basta. */
  if (tocco.tasto != null) {
    final tasto = notifica.tasti.where((uno) => uno.id == tocco.tasto);
    if (tasto.isNotEmpty && !tasto.first.apre) {
      await premiIlTasto(context, tocco, tasto.first, postino);
      return;
    }
  }
  if (!context.mounted) return;
  /* La notifica e' di un'altra casa: ci si sposta, come per un tasto, se no
   * la foto la si chiederebbe alla casa sbagliata. */
  if (collegamento.casa?.id != tocco.casa &&
      collegamento.archivio.quella(tocco.casa) != null) {
    try {
      await collegamento.archivio.scegli(tocco.casa);
      unawaited(collegamento.apri(forza: true));
    } catch (_) {
      /* Resta dov'era: la foto, se non arriva, non arriva. */
    }
    if (!context.mounted) return;
  }
  if (apreLaTelecamera(tocco)) {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SchermataDellaTelecamera(
          tocco: tocco,
          collegamento: collegamento,
          postino: postino,
        ),
      ),
    );
    return;
  }
  if (notifica.chiamata && notifica.valeAncora(DateTime.now())) {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => SchermataDelCampanello(
          tocco: tocco,
          collegamento: collegamento,
          postino: postino,
        ),
      ),
    );
    return;
  }
  final dove = doveApre(notifica);
  /* Il tasto della pagina che porta al posto della notifica. Per la plancia e
   * il navigatore la pagina si chiude prima: ci si va da sotto. Se non ci si
   * arriva — la casa non risponde, la plancia quella pagina non ce l'ha — si
   * resta dove si e'. */
  Future<void> vai(BuildContext pagina) async {
    switch (dove.posto) {
      case PostoDellaNotifica.telecamera:
        await Navigator.of(pagina).push(
          MaterialPageRoute<void>(
            builder: (_) => SchermataDellaTelecamera(
              tocco: ToccoDellaNotifica(
                casa: tocco.casa,
                notifica: notifica,
                tasto: 'guarda',
              ),
              collegamento: collegamento,
              postino: postino,
            ),
          ),
        );
      case PostoDellaNotifica.giornata:
        await apriLaTuaGiornata(
          pagina,
          collegamento: collegamento,
          casa: tocco.casa,
        );
      case PostoDellaNotifica.plancia || PostoDellaNotifica.navigatore:
        if (vaiA == null) return;
        Navigator.of(pagina).pop();
        try {
          await vaiA(dove);
        } catch (_) {
          /* Resta dov'e'. */
        }
      case PostoDellaNotifica.negozio:
        await apriIlNegozio();
      case PostoDellaNotifica.pagina:
        return;
    }
  }

  final etichetta = switch (dove.posto) {
    PostoDellaNotifica.plancia ||
    PostoDellaNotifica.navigatore when vaiA == null => null,
    _ => etichettaDelPosto(dove),
  };
  if (!context.mounted) return;
  await Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => SchermataDellaNotifica(
        tocco: tocco,
        nomeDellaCasa:
            collegamento.archivio.quella(tocco.casa)?.nome ??
            collegamento.casa?.nome ??
            '',
        collegamento: collegamento,
        postino: postino,
        etichettaDelPosto: etichetta,
        vaiAlPosto: etichetta == null ? null : vai,
      ),
    ),
  );
}

/// Porta alla casa il tasto premuto su una notifica, e dice com'e' andata.
Future<bool> premiIlTasto(
  BuildContext context,
  ToccoDellaNotifica tocco,
  TastoDellaNotifica tasto,
  Postino? postino,
) async {
  final messaggero = ScaffoldMessenger.maybeOf(context);
  if (postino == null) return false;
  try {
    await postino.premi(tocco, tasto.id);
    messaggero?.showSnackBar(
      SnackBar(
        content: Text(
          '${tasto.etichetta}: ${inLingua(it: 'fatto', en: 'done')}',
        ),
      ),
    );
    return true;
  } catch (errore) {
    messaggero?.showSnackBar(SnackBar(content: Text('$errore')));
    return false;
  }
}

/// La telecamera di una notifica: «Guarda» sul movimento o sull'antifurto.
///
/// Come il campanello: una foto ogni due secondi, chiesta alla casa sul filo
/// con le regole della plancia — chi non vede quella telecamera nella
/// plancia non la vede nemmeno qui (il ponte risponde di no). Sotto, il testo
/// della notifica e i suoi tasti che fanno qualcosa (Inserisci, Disinserisci,
/// Spegni sirena), finche' la notifica vale. Con l'app appena aperta il filo
/// si sta ancora aprendo: le prime foto non arrivano, e si continua a
/// chiedere.
class SchermataDellaTelecamera extends StatefulWidget {
  const SchermataDellaTelecamera({
    super.key,
    required this.tocco,
    required this.collegamento,
    this.postino,
    this.fotoIniziale,
    this.filmatoIniziale,
    this.adesso,
    this.cartellaDelleImmagini,
  });

  final ToccoDellaNotifica tocco;
  final Collegamento collegamento;
  final Postino? postino;

  /// La foto da mostrare senza chiederla: per le prove e i disegni.
  final Uint8List? fotoIniziale;

  /// Il mini video da mostrare senza chiederlo: per le prove e i disegni.
  final FilmatoDelMovimento? filmatoIniziale;

  /// L'ora per decidere se i tasti valgono ancora: per le prove.
  final DateTime? adesso;

  /// Dove stanno le immagini delle notifiche: per le prove.
  final Directory? cartellaDelleImmagini;

  @override
  State<SchermataDellaTelecamera> createState() => _StatoDellaTelecamera();
}

class _StatoDellaTelecamera extends State<SchermataDellaTelecamera> {
  Uint8List? _foto;
  Timer? _giro;
  bool _chiesta = false;
  String? _premuto;

  /// La foto del momento della notifica, quando il telefono la tiene.
  Uint8List? _delMomento;

  /// Se si sta guardando dal vivo, invece della foto del momento.
  bool _dalVivo = false;

  /// Il mini video del movimento, quando la notifica lo porta: cinque
  /// secondi prima e cinque dopo (`il_filmato.dart`).
  FilmatoDelMovimento? _filmato;

  /// Se si sta guardando il video (o lo si sta aspettando dalla casa).
  bool _inVideo = false;

  /// Se il video la casa non l'ha dato: scaduto, o non si mostra.
  bool _senzaVideo = false;

  /// Perche' la casa ha detto di no (`not_found`, `unauthorized`…).
  String? _perche;

  /// Se la casa non ha risposto in tempo: il video puo' esserci, si riprova.
  bool _videoNonArriva = false;

  /// Si chiude quando si sa se il telefono ha la foto del momento.
  final Completer<void> _momentoCercato = Completer<void>();

  /// Se il video lo si sta gia' chiedendo alla casa.
  bool _videoInArrivo = false;

  NotificaArrivata get _notifica => widget.tocco.notifica;

  @override
  void initState() {
    super.initState();
    _foto = widget.fotoIniziale;
    _filmato = widget.filmatoIniziale;
    _inVideo = _filmato != null;
    if (widget.fotoIniziale == null && widget.filmatoIniziale == null) {
      unawaited(_comincia());
    } else {
      _momentoCercato.complete();
    }
  }

  /* «Ti fa vedere il live e non la foto.» Toccando «Guarda» su un
   * movimento, quello che si vuole vedere per primo e' chi c'era alle 19:00,
   * non il balcone vuoto di adesso. La foto del momento il telefono ce l'ha
   * gia' — e' quella della notifica (`le_immagini.dart`) — e viene prima; il
   * dal vivo e' un tasto. Senza foto del momento, si parte dal vivo come
   * prima. */
  /* Col mini video acceso, si parte dal video: e' quello che il tester
   * chiedeva — chi c'era prima, e cosa ha fatto dopo. Mentre la casa lo
   * prepara (fino a cinque secondi, se il movimento e' di adesso) c'e' gia'
   * la foto del momento sotto mano; se il video non arriva, si resta li'. */
  Future<void> _comincia() async {
    final film = _notifica.film;
    if (film != null) {
      setState(() => _inVideo = true);
      unawaited(_caricaIlVideo(film));
    }
    final tenuta = await prendiLImmagine(
      _notifica.id,
      cartella: widget.cartellaDelleImmagini,
    );
    _momentoCercato.complete();
    if (!mounted) return;
    if (tenuta != null) {
      setState(() => _delMomento = tenuta);
      return;
    }
    if (film == null) _guardaDalVivo();
  }

  Future<void> _caricaIlVideo(({String id, String chiave}) film) async {
    if (_videoInArrivo) return;
    _videoInArrivo = true;
    final risposta = await ilFilmatoDi(widget.collegamento, film);
    _videoInArrivo = false;
    if (!mounted) return;
    if (risposta.filmato != null) {
      setState(() {
        _filmato = risposta.filmato;
        _videoNonArriva = false;
      });
      return;
    }
    /* Il «no» della casa puo' arrivare prima che il telefono abbia trovato
     * la foto del momento: prima la si aspetta, poi si sceglie. */
    await _momentoCercato.future;
    if (!mounted) return;
    setState(() {
      /* «Non c'è» lo dice solo la casa. Se non ha risposto il video può
       * esserci: si dice, e c'è «Riprova». */
      if (risposta.esito == EsitoDelFilmato.nonRisponde) {
        _videoNonArriva = true;
      } else {
        _senzaVideo = true;
        _perche = risposta.codice;
      }
      _inVideo = false;
    });
    if (_delMomento == null) _guardaDalVivo();
  }

  void _vaiAlVideo() {
    final film = _notifica.film;
    if (film == null || _senzaVideo) return;
    setState(() {
      _inVideo = true;
      _videoNonArriva = false;
    });
    if (_filmato == null) unawaited(_caricaIlVideo(film));
  }

  void _guardaDalVivo() {
    final camera = _notifica.camera;
    if (camera == null || _giro != null) return;
    setState(() => _dalVivo = true);
    unawaited(_unaFoto(camera));
    _giro = Timer.periodic(const Duration(seconds: 2), (_) => _unaFoto(camera));
  }

  Future<void> _unaFoto(String camera) async {
    final foto = await laFotoDi(widget.collegamento, camera);
    if (!mounted) return;
    setState(() {
      _chiesta = true;
      if (foto != null) _foto = foto;
    });
  }

  @override
  void dispose() {
    _giro?.cancel();
    super.dispose();
  }

  Future<void> _tasto(TastoDellaNotifica tasto) async {
    if (_premuto != null) return;
    setState(() => _premuto = tasto.id);
    await premiIlTasto(context, widget.tocco, tasto, widget.postino);
    if (mounted) setState(() => _premuto = null);
  }

  @override
  Widget build(BuildContext context) {
    final ora = TimeOfDay.fromDateTime(_notifica.quando);
    String due(int n) => n.toString().padLeft(2, '0');
    final vale = _notifica.valeAncora(widget.adesso ?? DateTime.now());
    final tasti = [
      for (final tasto in _notifica.tasti)
        if (!tasto.apre && !tasto.chiude && vale) tasto,
    ];
    final momento = _dalVivo || _inVideo ? null : _delMomento;
    final foto = momento ?? _foto;
    final video = _inVideo ? _filmato : null;
    final alle = '${due(ora.hour)}:${due(ora.minute)}';
    return Scaffold(
      backgroundColor: const Color(0xFF14110F),
      /* La testata e' quella di tutte le notifiche (`TestataDellaNotifica`):
       * la fascia nel colore della notifica, la freccia, il disegno, di che
       * cosa parla, il titolo e quando. «L'intestazione deve essere come le
       * altre notifiche.» Prima qui c'era una barra trasparente, con la
       * freccia e il titolo scuri sul fondo scuro: non si vedevano, e
       * sembrava di non poter tornare indietro. */
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TestataDellaNotifica(
            notifica: _notifica,
            nomeDellaCasa:
                widget.collegamento.archivio.quella(widget.tocco.casa)?.nome ??
                '',
          ),
          /* Sotto la testata la pagina scorre se non ci sta (un telefono
           * piccolo, di traverso), e quando ci sta i tasti restano in fondo:
           * e' quello che fa `SliverFillRemaining` con lo `Spacer` dentro. */
          Expanded(
            child: CustomScrollView(
              slivers: [
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: SafeArea(
                    top: false,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 18, 16, 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          /* Al piu' meta' dello schermo: su un telefono di traverso, o su
               * un tablet, la foto si fa piu' piccola invece di spingere fuori
               * i tasti. */
                          ConstrainedBox(
                            constraints: BoxConstraints(
                              maxHeight:
                                  MediaQuery.sizeOf(context).height * 0.5,
                            ),
                            child: Align(
                              alignment: Alignment.topCenter,
                              heightFactor: 1,
                              child: AspectRatio(
                                aspectRatio: 16 / 10,
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(22),
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      if (video != null)
                                        LettoreDelFilmato(
                                          video,
                                          key: const Key('telecamera-video'),
                                        )
                                      else if (_inVideo)
                                        Container(
                                          color: const Color(0xFF2E2A26),
                                          alignment: Alignment.center,
                                          child: Column(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              const SizedBox(
                                                width: 34,
                                                height: 34,
                                                child:
                                                    CircularProgressIndicator(
                                                      strokeWidth: 3,
                                                      color: Colors.white54,
                                                    ),
                                              ),
                                              const SizedBox(height: 14),
                                              Text(
                                                inLingua(
                                                  it: 'Si prepara il video del movimento…',
                                                  en: 'Getting the motion clip ready…',
                                                ),
                                                key: const Key(
                                                  'telecamera-video-attesa',
                                                ),
                                                style: const TextStyle(
                                                  color: Colors.white54,
                                                ),
                                              ),
                                            ],
                                          ),
                                        )
                                      else if (foto != null)
                                        FotoAMisura(
                                          foto,
                                          key: const Key('telecamera-foto'),
                                        )
                                      else
                                        Container(
                                          color: const Color(0xFF2E2A26),
                                          alignment: Alignment.center,
                                          child: Column(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              const Icon(
                                                Icons.videocam_rounded,
                                                size: 52,
                                                color: Colors.white38,
                                              ),
                                              const SizedBox(height: 10),
                                              Text(
                                                _chiesta
                                                    ? inLingua(
                                                        it: 'La casa non manda ancora la foto…',
                                                        en:
                                                            'The home isn\'t sending the '
                                                            'picture yet…',
                                                      )
                                                    : inLingua(
                                                        it: 'Si chiede la foto alla casa…',
                                                        en: 'Asking the home for the picture…',
                                                      ),
                                                style: const TextStyle(
                                                  color: Colors.white54,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      Positioned(
                                        left: 12,
                                        top: 12,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 10,
                                            vertical: 6,
                                          ),
                                          decoration: BoxDecoration(
                                            color: Colors.black54,
                                            borderRadius: BorderRadius.circular(
                                              999,
                                            ),
                                          ),
                                          child: Row(
                                            children: [
                                              Icon(
                                                _inVideo
                                                    ? Icons.movie_rounded
                                                    : momento == null
                                                    ? Icons.circle
                                                    : Icons
                                                          .photo_camera_rounded,
                                                size:
                                                    momento == null && !_inVideo
                                                    ? 10
                                                    : 14,
                                                color:
                                                    momento == null && !_inVideo
                                                    ? const Color(0xFFEF4444)
                                                    : Colors.white,
                                              ),
                                              const SizedBox(width: 7),
                                              Text(
                                                _inVideo
                                                    ? inLingua(
                                                        it: 'VIDEO DELLE $alle',
                                                        en: '$alle CLIP',
                                                      )
                                                    : momento == null
                                                    ? inLingua(
                                                        it: 'DAL VIVO',
                                                        en: 'LIVE',
                                                      )
                                                    : inLingua(
                                                        it: 'ALLE $alle',
                                                        en: 'AT $alle',
                                                      ),
                                                key: const Key(
                                                  'telecamera-quando',
                                                ),
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontWeight: FontWeight.w700,
                                                  letterSpacing: 0.5,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 18),
                          Text(
                            /* Il testo del movimento porta gia' l'ora («21:59 · casa
                 * vuota»); senza testo, l'ora. */
                            _notifica.testo.isNotEmpty
                                ? _notifica.testo
                                : '${due(ora.hour)}:${due(ora.minute)}',
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 17,
                            ),
                          ),
                          /* Fra il video, la foto del momento e il dal vivo. */
                          const SizedBox(height: 14),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              if (_inVideo) ...[
                                if (_delMomento != null)
                                  _TastoDellaVista(
                                    chiave: const Key('telecamera-alla-foto'),
                                    icona: Icons.photo_camera_rounded,
                                    testo: inLingua(
                                      it: 'Foto delle $alle',
                                      en: '$alle picture',
                                    ),
                                    tocca: () => setState(() {
                                      _inVideo = false;
                                      _dalVivo = false;
                                    }),
                                  ),
                                if (_notifica.camera != null)
                                  _TastoDellaVista(
                                    chiave: const Key('telecamera-al-vivo'),
                                    icona: Icons.videocam_rounded,
                                    testo: inLingua(
                                      it: 'Guarda dal vivo',
                                      en: 'Watch live',
                                    ),
                                    tocca: () {
                                      setState(() => _inVideo = false);
                                      if (_giro != null) {
                                        setState(() => _dalVivo = true);
                                      } else {
                                        _guardaDalVivo();
                                      }
                                    },
                                  ),
                              ] else ...[
                                if (_notifica.film != null && !_senzaVideo)
                                  _TastoDellaVista(
                                    chiave: const Key('telecamera-al-video'),
                                    icona: Icons.movie_rounded,
                                    testo: _videoNonArriva
                                        ? inLingua(
                                            it: 'Riprova il video',
                                            en: 'Retry the clip',
                                          )
                                        : inLingua(
                                            it: 'Rivedi il video',
                                            en: 'Replay the clip',
                                          ),
                                    tocca: _vaiAlVideo,
                                  ),
                                /* Dalla foto del momento al dal vivo, e ritorno. */
                                if (_delMomento != null &&
                                    _notifica.camera != null)
                                  _TastoDellaVista(
                                    chiave: const Key('telecamera-cambia'),
                                    icona: _dalVivo
                                        ? Icons.photo_camera_rounded
                                        : Icons.videocam_rounded,
                                    testo: _dalVivo
                                        ? inLingua(
                                            it: 'Torna alla foto delle $alle',
                                            en: 'Back to the $alle picture',
                                          )
                                        : inLingua(
                                            it: 'Guarda dal vivo',
                                            en: 'Watch live',
                                          ),
                                    tocca: () {
                                      if (_dalVivo) {
                                        setState(() => _dalVivo = false);
                                      } else if (_giro != null) {
                                        setState(() => _dalVivo = true);
                                      } else {
                                        _guardaDalVivo();
                                      }
                                    },
                                  ),
                              ],
                            ],
                          ),
                          if (_senzaVideo) ...[
                            const SizedBox(height: 8),
                            Text(
                              switch (_perche) {
                                'unauthorized' => inLingua(
                                  it:
                                      'Il video di questa telecamera non si mostra al '
                                      'tuo utente.',
                                  en: "This camera's clip isn't shown to your user.",
                                ),
                                'premium-richiesto' => inLingua(
                                  it: 'I mini video sono di GdAHome Premium.',
                                  en: 'Short clips are part of GdAHome Premium.',
                                ),
                                'filmato-vuoto' => inLingua(
                                  it:
                                      'In quei secondi la telecamera non ha mandato '
                                      'immagini alla casa: il video non si è potuto fare. '
                                      'La foto del momento c\'è.',
                                  en:
                                      "In those seconds the camera sent the home no "
                                      "pictures: the clip couldn't be made. The picture "
                                      "of the moment is there.",
                                ),
                                'unknown_command' => inLingua(
                                  it:
                                      'La casa non sa ancora fare i mini video: aggiorna '
                                      'l\'add-on GdAHome.',
                                  en:
                                      "The home can't make clips yet: update the GdAHome "
                                      'add-on.',
                                ),
                                _ => inLingua(
                                  it:
                                      'Il video di questo movimento non c\'è più: la casa '
                                      'li tiene tre giorni.',
                                  en:
                                      'This motion clip is no longer there: the home '
                                      'keeps them for three days.',
                                ),
                              },
                              key: const Key('telecamera-senza-video'),
                              style: const TextStyle(
                                color: Colors.white54,
                                fontSize: 13,
                              ),
                            ),
                          ],
                          if (_videoNonArriva) ...[
                            const SizedBox(height: 8),
                            Text(
                              inLingua(
                                it:
                                    'La casa non ha risposto in tempo: il video non è '
                                    'arrivato. Riprova fra poco.',
                                en:
                                    "The home didn't answer in time: the clip didn't "
                                    'arrive. Try again shortly.',
                              ),
                              key: const Key('telecamera-video-non-arriva'),
                              style: const TextStyle(
                                color: Colors.white54,
                                fontSize: 13,
                              ),
                            ),
                          ],
                          const Spacer(),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              for (final tasto in tasti)
                                FilledButton.tonal(
                                  onPressed: _premuto == null
                                      ? () => _tasto(tasto)
                                      : null,
                                  child: Text(tasto.etichetta),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Il campanello, a tutto schermo.
class SchermataDelCampanello extends StatefulWidget {
  const SchermataDelCampanello({
    super.key,
    required this.tocco,
    required this.collegamento,
    this.postino,
    this.fotoIniziale,
    this.sopraIlBlocco = true,
  });

  final ToccoDellaNotifica tocco;
  final Collegamento collegamento;
  final Postino? postino;

  /// La foto da mostrare senza chiederla: per le prove e i disegni.
  final Uint8List? fotoIniziale;

  /// Se accendere lo schermo e passare sopra il blocco, come una chiamata.
  final bool sopraIlBlocco;

  @override
  State<SchermataDelCampanello> createState() => _StatoDelCampanello();
}

class _StatoDelCampanello extends State<SchermataDelCampanello> {
  Uint8List? _foto;
  Timer? _giro;
  bool _premuto = false;

  NotificaArrivata get _notifica => widget.tocco.notifica;

  @override
  void initState() {
    super.initState();
    _foto = widget.fotoIniziale;
    if (widget.sopraIlBlocco) {
      unawaited(
        canaleDellaFinestra.invokeMethod<void>('sveglia').catchError((_) {}),
      );
    }
    final camera = _notifica.camera;
    if (camera != null && widget.fotoIniziale == null) {
      unawaited(_unaFoto(camera));
      /* «Dal vivo»: una foto ogni due secondi, finche' la schermata e'
       * aperta. Non un video: una foto per volta passa dal filo come tutto il
       * resto, con le sue regole. */
      _giro = Timer.periodic(
        const Duration(seconds: 2),
        (_) => _unaFoto(camera),
      );
    }
    /* Un campanello di un minuto fa non suona piu'. */
    Timer(const Duration(seconds: 60), () {
      if (mounted) Navigator.of(context).maybePop();
    });
  }

  Future<void> _unaFoto(String camera) async {
    final foto = await laFotoDi(widget.collegamento, camera);
    if (foto != null && mounted) setState(() => _foto = foto);
  }

  @override
  void dispose() {
    _giro?.cancel();
    if (widget.sopraIlBlocco) {
      unawaited(
        canaleDellaFinestra
            .invokeMethod<void>('acceso', false)
            .catchError((_) {}),
      );
    }
    super.dispose();
  }

  Future<void> _apri(TastoDellaNotifica tasto) async {
    if (_premuto) return;
    /* Col telefono bloccato si chiede di sbloccarlo, prima. */
    final sbloccato =
        await canaleDellaFinestra
            .invokeMethod<bool>('sblocca')
            .catchError((_) => true) ??
        true;
    if (!sbloccato || !mounted) return;
    setState(() => _premuto = true);
    final fatto = await premiIlTasto(
      context,
      widget.tocco,
      tasto,
      widget.postino,
    );
    if (!mounted) return;
    if (fatto) {
      Navigator.of(context).maybePop();
    } else {
      setState(() => _premuto = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final apri = _notifica.tasti.where((uno) => uno.id == 'apri');
    final ora = TimeOfDay.fromDateTime(_notifica.quando);
    String due(int n) => n.toString().padLeft(2, '0');
    return Scaffold(
      backgroundColor: const Color(0xFF1C1612),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF3A3530), Color(0xFF2A1D14), Color(0xFF34302C)],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.asset(
                        'assets/marchio/gda.png',
                        width: 28,
                        height: 28,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'GdAHome · ${inLingua(it: 'Campanello', en: 'Doorbell')}',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                AspectRatio(
                  aspectRatio: 4 / 3.6,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(28),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        if (_foto != null)
                          FotoAMisura(_foto!)
                        else
                          Container(
                            color: const Color(0xFF4A423B),
                            alignment: Alignment.center,
                            child: Icon(
                              _notifica.camera == null
                                  ? Icons.doorbell_rounded
                                  : Icons.videocam_rounded,
                              size: 56,
                              color: Colors.white38,
                            ),
                          ),
                        if (_notifica.camera != null)
                          Positioned(
                            left: 14,
                            top: 14,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 7,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.circle,
                                    size: 12,
                                    color: Color(0xFFEF4444),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    inLingua(it: 'DAL VIVO', en: 'LIVE'),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  _notifica.titolo,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 32,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '${_notifica.testo} · ${due(ora.hour)}:${due(ora.minute)}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70, fontSize: 18),
                ),
                const Spacer(flex: 2),
                Row(
                  mainAxisAlignment: apri.isEmpty
                      ? MainAxisAlignment.center
                      : MainAxisAlignment.spaceAround,
                  children: [
                    _Tondo(
                      colore: const Color(0xFFEF4444),
                      icona: Icons.close_rounded,
                      etichetta: inLingua(it: 'Ignora', en: 'Ignore'),
                      tocca: () => Navigator.of(context).maybePop(),
                    ),
                    if (apri.isNotEmpty)
                      _Tondo(
                        colore: Colori.bene,
                        icona: Icons.lock_open_rounded,
                        etichetta: inLingua(it: 'Apri', en: 'Open'),
                        tocca: _premuto ? null : () => _apri(apri.first),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Tondo extends StatelessWidget {
  const _Tondo({
    required this.colore,
    required this.icona,
    required this.etichetta,
    required this.tocca,
  });

  final Color colore;
  final IconData icona;
  final String etichetta;
  final VoidCallback? tocca;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: colore.withValues(alpha: 0.25),
        ),
        child: Material(
          color: colore,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: tocca,
            child: SizedBox(
              width: 76,
              height: 76,
              child: Icon(icona, color: Colors.white, size: 38),
            ),
          ),
        ),
      ),
      const SizedBox(height: 8),
      Text(
        etichetta,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
    ],
  );
}

/// Un tasto per cambiare quello che si guarda: il video, la foto, il vivo.
class _TastoDellaVista extends StatelessWidget {
  const _TastoDellaVista({
    required this.chiave,
    required this.icona,
    required this.testo,
    required this.tocca,
  });

  final Key chiave;
  final IconData icona;
  final String testo;
  final VoidCallback tocca;

  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
    key: chiave,
    style: OutlinedButton.styleFrom(
      foregroundColor: Colors.white,
      side: const BorderSide(color: Colors.white38),
    ),
    onPressed: tocca,
    icon: Icon(icona),
    label: Text(testo),
  );
}
