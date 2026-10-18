/// Una notifica toccata: cosa c'era dentro, e i suoi tasti.
///
/// Due forme. Il **campanello** si apre a tutto schermo, come una chiamata:
/// la foto della porta, «Ignora» e «Apri». Ogni altra notifica sale in un
/// foglio dal basso, col testo intero e i tasti che la casa le ha messo
/// sotto.
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
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../casa/la_finestra.dart';
import '../notifiche/consegna.dart';
import '../notifiche/modello.dart';
import '../notifiche/postino.dart';
import '../parole.dart';
import '../vestito/tema.dart';
import 'la_tua_giornata.dart';

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
}) async {
  final notifica = tocco.notifica;
  /* «OK»: la notifica e' gia' tolta, e non c'e' altro da fare. */
  if (tocco.tasto == 'ok') return;
  /* Il riepilogo della sera: «Apri la giornata» (o «Apri Energia», da un
   * ponte di prima), o il tocco sulla notifica, aprono la pagina. Il
   * riepilogo semplice di Base, senza quel tasto, si legge nel foglio. */
  if (notifica.apreLaGiornata &&
      (tocco.tasto == null ||
          tocco.tasto == tastoDellaGiornata ||
          tocco.tasto == 'energia')) {
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
      await _premi(context, tocco, tasto.first, postino);
      return;
    }
  }
  if (!context.mounted) return;
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
  await showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) =>
        _IlFoglio(tocco: tocco, collegamento: collegamento, postino: postino),
  );
}

Future<bool> _premi(
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

class _IlFoglio extends StatefulWidget {
  const _IlFoglio({
    required this.tocco,
    required this.collegamento,
    required this.postino,
  });

  final ToccoDellaNotifica tocco;
  final Collegamento collegamento;
  final Postino? postino;

  @override
  State<_IlFoglio> createState() => _StatoDelFoglio();
}

class _StatoDelFoglio extends State<_IlFoglio> {
  Uint8List? _foto;

  @override
  void initState() {
    super.initState();
    final camera = widget.tocco.notifica.camera;
    if (camera != null) {
      unawaited(
        laFotoDi(widget.collegamento, camera).then((foto) {
          if (mounted) setState(() => _foto = foto);
        }),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final notifica = widget.tocco.notifica;
    final testi = Theme.of(context).textTheme;
    final vale = notifica.valeAncora(DateTime.now());
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(notifica.titolo, style: testi.titleLarge),
            const SizedBox(height: 6),
            Text(notifica.testo, style: testi.bodyLarge),
            /* Da dove viene: «Automazione di Home Assistant · …». */
            if (notifica.fonte case final String fonte) ...[
              const SizedBox(height: 6),
              Text(
                fonte,
                style: testi.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
            if (_foto != null) ...[
              const SizedBox(height: 14),
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Image.memory(_foto!, fit: BoxFit.cover),
              ),
            ],
            const SizedBox(height: 16),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                for (final tasto in notifica.tasti)
                  if (!tasto.apre && !tasto.chiude && vale)
                    FilledButton.tonal(
                      onPressed: () async {
                        final fatto = await _premi(
                          context,
                          widget.tocco,
                          tasto,
                          widget.postino,
                        );
                        if (fatto && context.mounted) {
                          Navigator.of(context).pop();
                        }
                      },
                      child: Text(tasto.etichetta),
                    ),
              ],
            ),
          ],
        ),
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
    final fatto = await _premi(context, widget.tocco, tasto, widget.postino);
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
                      'gdahome · ${inLingua(it: 'Campanello', en: 'Doorbell')}',
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
                          Image.memory(
                            _foto!,
                            fit: BoxFit.cover,
                            gaplessPlayback: true,
                          )
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
