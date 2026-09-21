/// «In attesa di riconoscimento»: il velo che sta davanti all'app, e il
/// foglietto che sta davanti a un comando (#54).
///
/// Sono la stessa cosa disegnata due volte, e il motivo e' quello che chiedono:
///
///  - il **velo** copre tutta l'app, e sotto non c'e' niente da vedere. E' il
///    lucchetto all'avvio e al ritorno: finche' non si passa, l'app non c'e'.
///    Fondo scuro, perche' un velo che assomiglia a una schermata dell'app fa
///    credere di essere gia' dentro;
///  - il **foglietto** sta sopra la schermata che si stava guardando, e quella
///    si vede sotto, sfocata. E' la seconda domanda — prima di un comando,
///    prima del cruscotto, prima di togliere una casa — e chi la legge deve
///    riconoscere il posto da cui e' partito.
///
/// ─── Cosa si vede mentre aspetta ──────────────────────────────────────────
///
/// I due riquadri, il volto e l'impronta, solo quelli che quel telefono ha
/// davvero. Non e' decorazione: e' la risposta alla domanda «cosa devo fare
/// adesso?», e senza si resta davanti a una finestra di sistema senza sapere
/// se guardare lo schermo o appoggiare il dito.
///
/// A chiedere davvero e' il sistema — la sua finestra sale da sola — e questa
/// schermata e' quello che resta sotto quando la si annulla: da li' si
/// riprova, o si passa al codice del telefono.
library;

import 'package:flutter/material.dart';

import '../casa/il_lucchetto.dart';
import '../casa/la_guardia.dart';
import '../parole.dart';
import '../vestito/marchio.dart';

/// Il disegno del volto e quello dell'impronta.
///
/// Quelli di Material: `face` e `fingerprint`. Non due disegni nostri, che
/// sarebbero due disegni in piu' da tenere: questi due li riconosce chiunque
/// abbia mai sbloccato un telefono.
IconData disegnoDi(ComeRiconosce come) => switch (come) {
  ComeRiconosce.volto => Icons.face_rounded,
  ComeRiconosce.impronta => Icons.fingerprint_rounded,
};

/// Come si chiama, per chi legge.
String nomeDi(ComeRiconosce come) => switch (come) {
  ComeRiconosce.volto => inLingua(it: 'Volto', en: 'Face'),
  ComeRiconosce.impronta => inLingua(it: 'Impronta', en: 'Fingerprint'),
};

/// Il velo davanti a tutta l'app: all'avvio, e tornandoci.
class IlVeloDelRiconoscimento extends StatelessWidget {
  const IlVeloDelRiconoscimento({
    super.key,
    required this.conCosa,
    required this.quandoRiprova,
    required this.casa,
    this.nonSaFarlo = false,
  });

  /// Con cosa questo telefono puo' rispondere: uno, due, o nessuno.
  final Set<ComeRiconosce> conCosa;

  final VoidCallback quandoRiprova;

  /// Il nome della casa a cui si sta entrando. Vuoto quando non ce n'e' una.
  final String casa;

  /// Il telefono non sa proprio rispondere: allora non si offre «Riprova»,
  /// che non porterebbe da nessuna parte, ma la strada per entrare lo stesso.
  final bool nonSaFarlo;

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    return ColoredBox(
      color: const Color(0xFF0B1220),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 48, 28, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Center(child: Marchio(lato: 76)),
              if (casa.isNotEmpty) ...[
                const SizedBox(height: 14),
                Text(
                  casa.toUpperCase(),
                  textAlign: TextAlign.center,
                  style: testi.labelMedium?.copyWith(
                    color: const Color(0xFF64748B),
                    letterSpacing: 4,
                  ),
                ),
              ],
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _IRiquadri(conCosa: conCosa, scuro: true),
                    const SizedBox(height: 26),
                    Text(
                      inLingua(
                        it: 'In attesa di riconoscimento',
                        en: 'Waiting to recognise you',
                      ),
                      textAlign: TextAlign.center,
                      style: testi.headlineSmall?.copyWith(
                        color: const Color(0xFFF8FAFC),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      nonSaFarlo
                          ? inLingua(
                              it:
                                  'Questo telefono non ha niente con cui '
                                  'riconoscerti. Puoi spegnere il lucchetto da '
                                  'Sicurezza.',
                              en:
                                  'This phone has nothing to recognise you '
                                  'with. You can turn the lock off in '
                                  'Security.',
                            )
                          : inLingua(
                              it:
                                  'Guarda il telefono, o appoggia il dito. Il '
                                  'volto e l\'impronta restano lì: gdahome '
                                  'riceve un sì e basta.',
                              en:
                                  'Look at the phone, or rest your finger. '
                                  'Face and fingerprint stay there: gdahome '
                                  'gets a yes and nothing more.',
                            ),
                      textAlign: TextAlign.center,
                      style: testi.bodyMedium?.copyWith(
                        color: const Color(0xFF94A3B8),
                      ),
                    ),
                  ],
                ),
              ),
              FilledButton(
                onPressed: quandoRiprova,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(54),
                ),
                child: Text(
                  nonSaFarlo
                      ? inLingua(it: 'Entra lo stesso', en: 'Go in anyway')
                      : inLingua(it: 'Riprova', en: 'Try again'),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.lock_rounded,
                    size: 17,
                    color: Color(0xFF64748B),
                  ),
                  const SizedBox(width: 9),
                  Flexible(
                    child: Text(
                      inLingua(
                        it:
                            'Il codice della casa resta nel portachiavi del '
                            'telefono',
                        en: 'The home\'s token stays in the phone\'s keychain',
                      ),
                      style: testi.bodySmall?.copyWith(
                        color: const Color(0xFF94A3B8),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Il foglietto davanti a una cosa sola: un comando, il cruscotto, una casa
/// da togliere.
///
/// Torna `true` se si e' passati. `false` o `null` — annullato, o il tasto
/// indietro — vogliono dire la stessa cosa, e chi chiama fa quello che farebbe
/// se avesse detto di no: niente.
Future<bool> ilFoglietto(
  BuildContext context, {
  required PrimaDi quale,
  required Set<ComeRiconosce> conCosa,
  required Future<ComeEAndata> Function() chiedi,
  String cosa = '',
}) async {
  final passato = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (context) => _IlFoglietto(
      quale: quale,
      conCosa: conCosa,
      chiedi: chiedi,
      cosa: cosa,
    ),
  );
  return passato ?? false;
}

class _IlFoglietto extends StatefulWidget {
  const _IlFoglietto({
    required this.quale,
    required this.conCosa,
    required this.chiedi,
    required this.cosa,
  });

  final PrimaDi quale;
  final Set<ComeRiconosce> conCosa;
  final Future<ComeEAndata> Function() chiedi;

  /// Su cosa: il nome della lampada, della casa. Vuoto quando non c'e' un
  /// nome da dire.
  final String cosa;

  @override
  State<_IlFoglietto> createState() => _IlFogliettoState();
}

class _IlFogliettoState extends State<_IlFoglietto> {
  @override
  void initState() {
    super.initState();
    /* Si chiede subito, appena il foglietto e' a schermo: la finestra del
     * sistema sale da sola, e questo foglietto e' quello che si vede sotto
     * quando la si annulla. Farlo premere prima vorrebbe dire due tocchi per
     * la stessa cosa. */
    WidgetsBinding.instance.addPostFrameCallback((_) => _chiedi());
  }

  Future<void> _chiedi() async {
    final andata = await widget.chiedi();
    if (!mounted) return;
    if (andata == ComeEAndata.si) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    final colori = Theme.of(context).colorScheme;
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      contentPadding: const EdgeInsets.fromLTRB(22, 26, 22, 12),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _IRiquadri(conCosa: widget.conCosa, scuro: false),
          const SizedBox(height: 18),
          Text(
            switch (widget.quale) {
              PrimaDi.iComandi => inLingua(
                it: 'In attesa di riconoscimento per comandare',
                en: 'Waiting to recognise you before the command',
              ),
              PrimaDi.ilCruscotto => inLingua(
                it: 'In attesa di riconoscimento per aprire il cruscotto',
                en: 'Waiting to recognise you before opening the fleet',
              ),
              PrimaDi.togliereUnaCasa => inLingua(
                it: 'In attesa di riconoscimento per togliere la casa',
                en: 'Waiting to recognise you before removing the home',
              ),
            },
            textAlign: TextAlign.center,
            style: testi.titleMedium,
          ),
          if (widget.cosa.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: colori.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(widget.cosa, style: testi.titleSmall),
            ),
          ],
          const SizedBox(height: 12),
          Text(
            inLingua(
              it: 'Finché non ti riconosce non succede niente.',
              en: 'Until it recognises you, nothing happens.',
            ),
            textAlign: TextAlign.center,
            style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(inLingua(it: 'Annulla', en: 'Cancel')),
        ),
        FilledButton(
          onPressed: _chiedi,
          child: Text(inLingua(it: 'Riprova', en: 'Try again')),
        ),
      ],
    );
  }
}

/// I due riquadri che pulsano: il volto e l'impronta, solo quelli che ci sono.
class _IRiquadri extends StatelessWidget {
  const _IRiquadri({required this.conCosa, required this.scuro});

  final Set<ComeRiconosce> conCosa;
  final bool scuro;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    /* Nessuno dei due: si passa dal codice del telefono, e il disegno lo dice.
     * Due riquadri spenti direbbero «guarda il telefono» a chi il volto non
     * l'ha mai registrato. */
    final quali = conCosa.isEmpty
        ? const <ComeRiconosce?>[null]
        : [
            for (final come in ComeRiconosce.values)
              if (conCosa.contains(come)) come,
          ];
    final tinta = scuro ? const Color(0xFF38BDF8) : colori.primary;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var quale = 0; quale < quali.length; quale += 1) ...[
          if (quale > 0) ...[
            const SizedBox(width: 14),
            Text(
              inLingua(it: 'o', en: 'or'),
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: scuro ? const Color(0xFF475569) : colori.outline,
              ),
            ),
            const SizedBox(width: 14),
          ],
          _UnRiquadro(
            quale: quali[quale],
            tinta: tinta,
            scuro: scuro,
            ritardo: Duration(milliseconds: quale * 950),
          ),
        ],
      ],
    );
  }
}

class _UnRiquadro extends StatefulWidget {
  const _UnRiquadro({
    required this.quale,
    required this.tinta,
    required this.scuro,
    required this.ritardo,
  });

  /// `null` quando non c'e' ne' volto ne' impronta: resta il codice.
  final ComeRiconosce? quale;
  final Color tinta;
  final bool scuro;
  final Duration ritardo;

  @override
  State<_UnRiquadro> createState() => _UnRiquadroState();
}

class _UnRiquadroState extends State<_UnRiquadro>
    with SingleTickerProviderStateMixin {
  late final AnimationController _battito = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1900),
  );

  @override
  void initState() {
    super.initState();
    /* Sfasati: due riquadri che pulsano insieme sembrano un lampeggio, due
     * sfasati sembrano due strade che aspettano. */
    Future<void>.delayed(widget.ritardo, () {
      if (mounted) _battito.repeat();
    });
  }

  @override
  void dispose() {
    _battito.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    final quale = widget.quale;
    return AnimatedBuilder(
      animation: _battito,
      builder: (context, figlio) {
        final quanto = Curves.easeOut.transform(_battito.value);
        return Container(
          width: 108,
          height: 108,
          decoration: BoxDecoration(
            color: widget.tinta.withValues(alpha: widget.scuro ? 0.14 : 0.10),
            borderRadius: BorderRadius.circular(34),
            border: Border.all(
              color: widget.tinta.withValues(alpha: 0.7),
              width: 2,
            ),
            boxShadow: [
              BoxShadow(
                color: widget.tinta.withValues(alpha: 0.40 * (1 - quanto)),
                blurRadius: 0,
                spreadRadius: 18 * quanto,
              ),
            ],
          ),
          child: figlio,
        );
      },
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            quale == null ? Icons.password_rounded : disegnoDi(quale),
            size: 46,
            color: widget.tinta,
          ),
          const SizedBox(height: 7),
          Text(
            quale == null
                ? inLingua(it: 'Codice', en: 'Passcode')
                : nomeDi(quale).toUpperCase(),
            style: testi.labelSmall?.copyWith(
              color: widget.tinta,
              letterSpacing: 1,
            ),
          ),
        ],
      ),
    );
  }
}
