/// Il lettore del QR code.
///
/// Il QR code lo **disegna** il ponte, senza dipendenze, in
/// `ponte/src/qr.js`. Leggerlo e' un altro mestiere: vuole la fotocamera, la
/// messa a fuoco, la luce che cambia in mano a chi inquadra. Sotto ci stanno
/// MLKit e Vision, che sono del sistema, e scriverne uno a mano vorrebbe dire
/// un lettore peggiore di quello che ogni telefono ha gia' dentro.
///
/// Quello che si vede: la fotocamera a tutto schermo, un riquadro in mezzo, e
/// una riga sotto. Niente bottone «conferma»: quando il QR code entra nel
/// riquadro, si e' finito. Chi inquadra non deve fare altro.
library;

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

/// Cosa torna dal lettore.
///
/// Sono **tre** cose, non due, e la terza e' quella che si dimentica: chi apre
/// il lettore e trova una fotocamera che non si apre non ha «annullato». Ha
/// bisogno di scrivere a mano, e riportarlo alla schermata di prima con in
/// mezzo allo schermo lo stesso bottone che ha appena fallito vuol dire
/// lasciarlo li'.
sealed class Letto {
  const Letto();
}

/// Un QR code, con dentro la sua riga.
final class UnQrCode extends Letto {
  const UnQrCode(this.riga);
  final String riga;
}

/// Si e' tornati indietro senza leggere niente. Non e' un errore, e non si
/// dice niente a nessuno.
final class NienteDaLeggere extends Letto {
  const NienteDaLeggere();
}

/// La fotocamera non c'e', o non si apre, o non le e' stato dato il permesso:
/// si scrivono le lettere.
final class SiScriveAMano extends Letto {
  const SiScriveAMano();
}

/// Cosa succede quando qualcuno tocca «Inquadra il QR code».
///
/// E' una funzione, e non una chiamata dritta a questa schermata, per un
/// motivo solo: dall'altra parte c'e' la fotocamera, che nelle prove non
/// esiste. Una schermata che se la va a prendere da sola non si puo' provare —
/// e quella da provare e' proprio lei, perche' e' li' che si decide cosa fare
/// di quello che si e' letto.
typedef Inquadra = Future<Letto> Function(BuildContext dove);

/// Apre il lettore, e torna quello che ne e' uscito.
Future<Letto> colLaFotocamera(BuildContext dove) async {
  final letto = await Navigator.of(dove).push<Letto>(
    MaterialPageRoute(
      builder: (_) => const LettoreDiQrCode(),
      fullscreenDialog: true,
    ),
  );
  /* `null` vuol dire che si e' usciti dal fianco — la freccia indietro, il
   * gesto — e li' non c'e' niente da fare. */
  return letto ?? const NienteDaLeggere();
}

class LettoreDiQrCode extends StatefulWidget {
  const LettoreDiQrCode({super.key});

  @override
  State<LettoreDiQrCode> createState() => _LettoreDiQrCodeState();
}

class _LettoreDiQrCodeState extends State<LettoreDiQrCode> {
  /// Solo i QR code, e solo il primo di ognuno.
  ///
  /// `formats` stretto non e' pignoleria: un lettore che cerca anche i codici
  /// a barre del supermercato guarda ogni fotogramma piu' volte, e in mano si
  /// sente. `noDuplicates` evita di leggere lo stesso QR code trenta volte
  /// al secondo mentre si toglie la mano.
  final _fotocamera = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );

  /// Si esce una volta sola. La fotocamera legge a raffica, e senza questo si
  /// chiuderebbe la schermata due volte — cioe' si tornerebbe indietro anche
  /// da quella prima.
  bool _fatto = false;

  @override
  void dispose() {
    _fotocamera.dispose();
    super.dispose();
  }

  void _letto(BarcodeCapture presi) {
    if (_fatto) return;
    for (final letto in presi.barcodes) {
      final dentro = letto.rawValue;
      if (dentro == null || dentro.isEmpty) continue;
      _fatto = true;
      Navigator.of(context).pop(UnQrCode(dentro));
      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text('Inquadra il QR code'),
        actions: [
          ValueListenableBuilder(
            valueListenable: _fotocamera,
            builder: (_, stato, _) => IconButton(
              tooltip: 'Torcia',
              onPressed: stato.torchState == TorchState.unavailable
                  ? null
                  : _fotocamera.toggleTorch,
              icon: Icon(
                stato.torchState == TorchState.on
                    ? Icons.flashlight_on
                    : Icons.flashlight_off,
              ),
            ),
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _fotocamera,
            onDetect: _letto,
            errorBuilder: (_, guaio) => _Guaio(guaio: guaio),
          ),
          const _Mirino(),
        ],
      ),
    );
  }
}

/// Il riquadro in mezzo, e la riga che dice cosa fare.
///
/// Il riquadro non serve al lettore — legge tutto quello che vede — serve a chi
/// inquadra: senza un posto dove mettere il QR code, si tiene il telefono
/// troppo lontano e non succede niente.
class _Mirino extends StatelessWidget {
  const _Mirino();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, spazio) {
        final lato = (spazio.biggest.shortestSide * 0.72).clamp(180.0, 320.0);
        return Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: lato,
              height: lato,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white, width: 3),
                borderRadius: BorderRadius.circular(20),
              ),
            ),
            const SizedBox(height: 28),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                'Il QR code è presente nella scheda «gdahome», dentro '
                'Home Assistant.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 15),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Quando la fotocamera non si apre.
///
/// Il caso che capita davvero e' uno: il permesso negato — per sbaglio, o
/// perche' si e' toccato «no» la prima volta. Dirlo per nome e mandare a
/// scrivere le lettere e' l'unica cosa utile: una schermata nera con un
/// triangolino non dice a nessuno cosa fare.
class _Guaio extends StatelessWidget {
  const _Guaio({required this.guaio});

  final MobileScannerException guaio;

  @override
  Widget build(BuildContext context) {
    final negato = guaio.errorCode == MobileScannerErrorCode.permissionDenied;
    return ColoredBox(
      color: Colors.black,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                negato
                    ? Icons.no_photography_outlined
                    : Icons.videocam_off_outlined,
                color: Colors.white70,
                size: 48,
              ),
              const SizedBox(height: 16),
              Text(
                negato
                    ? 'gdahome non ha il permesso di usare la fotocamera. '
                          'Puoi darglielo dalle impostazioni del telefono, '
                          'oppure tornare indietro e inserire il codice a mano.'
                    : 'La fotocamera non si apre. Torna indietro e '
                          'inserisci il codice a mano: è scritto sotto il QR '
                          'code.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 15),
              ),
              const SizedBox(height: 24),
              FilledButton.tonal(
                /* Non si torna indietro e basta: si torna indietro **dicendo
                 * cosa serve**, e la schermata di prima apre le lettere. Chi
                 * ha appena visto la fotocamera fallire non deve trovarsi
                 * davanti lo stesso bottone che ha appena fallito. */
                onPressed: () =>
                    Navigator.of(context).pop(const SiScriveAMano()),
                child: const Text('Inserisci il codice'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
