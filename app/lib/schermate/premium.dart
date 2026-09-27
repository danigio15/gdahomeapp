/// La pagina di gdahome Premium: cosa comprende, quanto costa, come si ha.
///
/// Ci si arriva dal menu, e da ogni lucchetto dell'app: una plancia in piu',
/// una casa in piu', la Configurazione, Zigbee, la casa da fuori. Chi arriva
/// da un lucchetto legge in cima **perche'** e' qui ([perche]).
///
/// La pagina e' fatta come quella di gdanav, riga per riga: il nome, una
/// riga, cosa comprende, cosa resta gratis, i due piani da scegliere, un
/// solo bottone, la nota del rinnovo, «Ripristina abbonamento», «Ho un
/// codice regalo», Privacy e Condizioni d'uso. Cambiano i colori, che sono
/// quelli di gdahome, e le parole.
///
/// Premium e' **della casa**: si compra per la casa aperta, e tutti i
/// telefoni abbinati a lei — e la webapp — lo diventano insieme. Sul web non
/// si compra: li' non c'e' un negozio, e la pagina manda al telefono. Un
/// codice regalo invece si riscatta anche da li'.
library;

import 'dart:async';

import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../casa/collegamento.dart';
import '../licenza/gettone.dart';
import '../licenza/licenza.dart';
import '../licenza/negozio.dart';
import '../parole.dart';
import '../vestito/tema.dart';

/// Gli acquisti dell'app: uno solo, acceso dal portone (`main.dart`) appena
/// c'e' la casa. `null` dove non si compra — il web, le prove.
GestoreDegliAcquisti? acquistiDellApp;

/// Apre la pagina Premium sopra quello che c'e'.
Future<void> apriLaPaginaPremium(
  BuildContext context,
  Collegamento collegamento, {
  String? perche,
}) => Navigator.of(context, rootNavigator: true).push<void>(
  MaterialPageRoute(
    builder: (_) => SchermataPremium(
      collegamento: collegamento,
      acquisti: acquistiDellApp,
      perche: perche,
    ),
  ),
);

/// Perche' si arriva alla pagina da un lucchetto: una riga, da mostrare in
/// cima.
abstract final class PerchePremium {
  static String get unAltraCasa => inLingua(
    it:
        'Per aggiungere un\'altra casa serve che almeno una delle tue case '
        'sia Premium.',
    en: 'To add another home, at least one of your homes must be Premium.',
  );

  static String get altrePlance => inLingua(
    it: 'Le plance oltre la principale sono comprese in gdahome Premium.',
    en: 'Dashboards beyond the main one come with gdahome Premium.',
  );

  static String get configurazione => inLingua(
    it: 'La configurazione della plancia dall\'app è di gdahome Premium.',
    en: 'Configuring the dashboard from the app is part of gdahome Premium.',
  );

  static String get zigbee => inLingua(
    it:
        'Aggiungere dispositivi Zigbee dall\'app, scegliendo dove metterli, è '
        'di gdahome Premium.',
    en:
        'Adding Zigbee devices from the app, and choosing where they go, is '
        'part of gdahome Premium.',
  );

  static String get fuoriCasa => inLingua(
    it:
        'Fuori casa serve gdahome Premium. Sotto il Wi-Fi di casa si entra '
        'come sempre.',
    en:
        'Away from home you need gdahome Premium. On your home Wi-Fi you get '
        'in as always.',
  );
}

class SchermataPremium extends StatefulWidget {
  const SchermataPremium({
    super.key,
    required this.collegamento,
    this.acquisti,
    this.perche,
    this.sulWeb = kIsWeb,
  });

  final Collegamento collegamento;

  /// Il negozio: `null` dove non c'e', e allora i prezzi sono quelli di
  /// riserva e il bottone per comprare non va.
  final GestoreDegliAcquisti? acquisti;

  /// Da quale lucchetto si arriva, in una riga.
  final String? perche;

  /// Nella webapp: non si compra, si manda al telefono.
  final bool sulWeb;

  /// L'informativa sulla privacy, sul sito.
  static const privacy = 'https://gdahome.org/privacy.html';

  /// Le condizioni d'uso: quelle standard di Apple (EULA), come in gdanav,
  /// valide anche per Google Play finche' gdahome non ne ha di sue sul sito.
  static const condizioni =
      'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

  @override
  State<SchermataPremium> createState() => _SchermataPremiumState();
}

class _SchermataPremiumState extends State<SchermataPremium> {
  late final Listenable _ascolta = Listenable.merge([
    widget.collegamento.licenza,
    ?widget.acquisti,
  ]);

  /// Il piano scelto: l'annuale, finche' non si tocca l'altro.
  var _scelto = pianoAnnuale;

  @override
  void initState() {
    super.initState();
    /* La licenza fresca: chi apre questa pagina puo' aver appena comprato da
     * un altro telefono. */
    unawaited(widget.collegamento.rileggiLaLicenza());
    unawaited(widget.acquisti?.avvia());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Premium')),
      body: ListenableBuilder(
        listenable: _ascolta,
        builder: (context, _) => _laPagina(context),
      ),
    );
  }

  Widget _laPagina(BuildContext context) {
    final licenza = widget.collegamento.licenza;
    final casa = widget.collegamento.casa;
    final premium = licenza.premiumDi(casa);
    final acquisti = widget.acquisti;
    final s = Theme.of(context).colorScheme;
    final t = Theme.of(context).textTheme;

    /* Col negozio che risponde si compra; senza (niente rete, un telefono
     * senza Play Store) i prezzi si mostrano lo stesso, quelli di listino. */
    final dalNegozio =
        !widget.sulWeb && acquisti != null && acquisti.disponibile;
    String prezzo(String piano) =>
        acquisti?.prezzoDi(piano) ?? prezzoDiRiserva(piano);
    final giorni = dalNegozio ? acquisti.provaDi(_scelto) : 0;
    final inCorso = acquisti?.inCorso ?? false;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      children: [
        if (widget.perche case final perche? when !premium) ...[
          _IlPerche(perche),
          const SizedBox(height: 16),
        ],
        Row(
          children: [
            Icon(Icons.workspace_premium, color: s.primary, size: 36),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'gdahome Premium',
                style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          premium
              ? _comeSta(
                  licenza.gettoneDi(casa),
                  licenza.controlliAccesi,
                  casa?.nome,
                )
              : _perChi(acquisti, dalNegozio),
          key: const Key('stato-premium'),
          style: t.bodyLarge,
        ),
        const SizedBox(height: 12),
        for (final (icona, titolo, testo) in _funzioni(widget.sulWeb))
          _Voce(icona: icona, titolo: titolo, testo: testo),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.check_circle_outline,
              size: 18,
              color: s.onSurfaceVariant,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                inLingua(
                  it:
                      'Gratis per tutti: una plancia, una casa, il '
                      'collegamento da casa.',
                  en:
                      'Free for everyone: one dashboard, one home, the '
                      'connection from home.',
                ),
                style: t.bodySmall?.copyWith(color: s.onSurfaceVariant),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (!premium) ...[
          for (final id in [pianoAnnuale, pianoMensile])
            _Piano(
              id: id,
              prezzo: prezzo(id),
              scelto: _scelto == id,
              nota: id == pianoAnnuale
                  ? _risparmio(prezzo(pianoMensile), prezzo(pianoAnnuale))
                  : null,
              onTap: () => setState(() => _scelto = id),
            ),
          const SizedBox(height: 8),
          if (widget.sulWeb)
            const _SulWeb()
          else ...[
            FilledButton(
              key: const Key('compra-premium'),
              onPressed: inCorso || !dalNegozio
                  ? null
                  : () => unawaited(acquisti.compra(_scelto)),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
              ),
              child: inCorso
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(
                      !dalNegozio
                          ? inLingua(it: 'Prova gratis', en: 'Try for free')
                          : giorni > 0
                          ? inLingua(
                              it: 'Prova gratis per $giorni giorni',
                              en: 'Try free for $giorni days',
                            )
                          : inLingua(
                              it: 'Abbonati a ${prezzo(_scelto)}',
                              en: 'Subscribe for ${prezzo(_scelto)}',
                            ),
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                dalNegozio
                    ? _ilRinnovo(prezzo(_scelto), giorni > 0)
                    : _senzaNegozio(),
                key: dalNegozio ? null : const Key('negozio-assente'),
                textAlign: TextAlign.center,
                style: t.bodySmall?.copyWith(color: s.onSurfaceVariant),
              ),
            ),
            TextButton(
              onPressed: dalNegozio && !inCorso
                  ? () => unawaited(acquisti.ripristina())
                  : null,
              child: Text(
                inLingua(
                  it: 'Ripristina abbonamento',
                  en: 'Restore subscription',
                ),
              ),
            ),
          ],
        ],
        OutlinedButton.icon(
          key: const Key('codice-regalo'),
          onPressed: () => _ilCodice(context),
          icon: const Icon(Icons.redeem),
          label: Text(
            inLingua(it: 'Ho un codice regalo', en: 'I have a gift code'),
          ),
        ),
        if (!premium)
          /* L'App Store vuole i due link accanto all'abbonamento. */
          Wrap(
            alignment: WrapAlignment.center,
            children: [
              TextButton(
                onPressed: () => _apri(SchermataPremium.privacy),
                child: const Text('Privacy'),
              ),
              TextButton(
                onPressed: () => _apri(SchermataPremium.condizioni),
                child: Text(
                  inLingua(it: 'Condizioni d\'uso', en: 'Terms of use'),
                ),
              ),
            ],
          ),
        if (acquisti?.errore case final errore?) _Riga(errore, colore: s.error),
        if (acquisti?.fatto case final fatto?)
          _Riga(fatto, colore: Colori.bene),
      ],
    );
  }

  Future<void> _ilCodice(BuildContext context) async {
    final fatto = await showDialog<bool>(
      context: context,
      builder: (_) => _IlCodiceRegalo(collegamento: widget.collegamento),
    );
    if (fatto != true || !context.mounted) return;
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(
        content: Text(
          inLingua(
            it: 'Codice riscattato: la casa è Premium.',
            en: 'Code redeemed: your home is Premium.',
          ),
        ),
      ),
    );
  }

  static Future<void> _apri(String indirizzo) async {
    try {
      await launchUrl(
        Uri.parse(indirizzo),
        mode: LaunchMode.externalApplication,
      );
    } catch (_) {}
  }

  /// La riga sotto il nome, per chi non ha Premium. La prova si promette
  /// solo se c'e': col negozio che risponde e dice «niente prova» (l'hai
  /// gia' usata) non la si nomina.
  static String _perChi(GestoreDegliAcquisti? acquisti, bool dalNegozio) {
    final senzaProva =
        dalNegozio &&
        acquisti!.provaDi(pianoMensile) == 0 &&
        acquisti.provaDi(pianoAnnuale) == 0;
    if (senzaProva) {
      return inLingua(
        it: 'Per la casa intera, su tutti i telefoni abbinati.',
        en: 'For the whole home, on every paired phone.',
      );
    }
    return inLingua(
      it:
          'Per la casa intera, su tutti i telefoni abbinati, con '
          '$giorniDiProva giorni di prova gratuita.',
      en:
          'For the whole home, on every paired phone, with a '
          '$giorniDiProva-day free trial.',
    );
  }

  /// La nota sotto il bottone: il rinnovo, e dove si disdice.
  String _ilRinnovo(String prezzo, bool prova) {
    final nome = _nomeDelNegozio();
    final dal = nome == 'App Store' ? 'dall\'App Store' : 'dal $nome';
    return inLingua(
      it:
          '${prova ? 'Poi ' : ''}$prezzo, rinnovo automatico. Disdici quando '
          'vuoi $dal${prova ? ': se disdici durante la prova non paghi '
                    'nulla.' : '.'}',
      en:
          '${prova ? 'Then ' : ''}$prezzo, renews automatically. Cancel any '
          'time from the $nome${prova ? ': cancel during the trial and you '
                    'pay nothing.' : '.'}',
    );
  }

  /// La nota quando il negozio non risponde.
  String _senzaNegozio() {
    final nome = _nomeDelNegozio();
    final il = nome == 'App Store' ? 'L\'App Store' : 'Il $nome';
    return inLingua(
      it:
          '$il non risponde adesso: i prezzi sono quelli di listino, e per '
          'comprare bisogna riprovare tra poco.',
      en:
          'The $nome isn\'t responding right now: these are list prices, '
          'try again shortly to buy.',
    );
  }

  /// Il Play Store su Android, l'App Store sull'iPhone: quello che dice il
  /// negozio, o quello della piattaforma se il negozio non c'e'.
  String _nomeDelNegozio() {
    final nome = widget.acquisti?.negozio?.nome;
    if (nome != null && nome.isNotEmpty) return nome;
    return defaultTargetPlatform == TargetPlatform.iOS
        ? 'App Store'
        : 'Play Store';
  }

  /// «Risparmi il 17%» rispetto a dodici mesi pagati uno per uno.
  static String? _risparmio(String mensile, String annuale) {
    double? euro(String prezzo) => double.tryParse(
      prezzo.replaceAll(RegExp(r'[^\d,.]'), '').replaceAll(',', '.'),
    );
    final m = euro(mensile), a = euro(annuale);
    if (m == null || a == null || m <= 0) return null;
    final r = (100 * (1 - a / (m * 12))).round();
    return r > 0 ? inLingua(it: 'Risparmi il $r%', en: 'Save $r%') : null;
  }

  /// La riga sotto il nome per chi ha Premium: fino a quando, da dove.
  /// «Premium è attivo fino al 12 marzo 2027 · regalo.»
  static String _comeSta(Gettone? gettone, bool controlli, String? casa) {
    if (!controlli || gettone == null) {
      return inLingua(it: 'Tutto è aperto.', en: 'Everything is unlocked.');
    }
    final perChi = casa == null
        ? ''
        : inLingua(
            it: ' Vale per «$casa» e per tutti i suoi telefoni.',
            en: ' It covers “$casa” and all of its phones.',
          );
    final scade = gettone.scade;
    if (gettone.prova && scade != null) {
      return inLingua(
            it: 'Prova gratuita fino ${_alGiorno(scade)}.',
            en: 'Free trial until ${dataInParole(scade)}.',
          ) +
          perChi;
    }
    final quando = scade == null
        ? inLingua(
            it: 'Premium è attivo per sempre',
            en: 'Premium is active forever',
          )
        : inLingua(
            it: 'Premium è attivo fino ${_alGiorno(scade)}',
            en: 'Premium is active until ${dataInParole(scade)}',
          );
    final origine = switch (gettone.origine) {
      'regalo' => inLingua(it: 'regalo', en: 'gift'),
      'installatore' => inLingua(
        it: 'dal tuo installatore',
        en: 'from your installer',
      ),
      'negozio' => inLingua(it: 'abbonamento', en: 'subscription'),
      _ => '',
    };
    return '${origine.isEmpty ? quando : '$quando · $origine'}.$perChi';
  }
}

/// Cosa comprende Premium: solo quello che c'e' davvero.
List<(IconData, String, String)> _funzioni(bool sulWeb) {
  /* L'auto di questo telefono: Android Auto su Android, CarPlay sull'iPhone.
   * Solo quella: le regole dell'App Store non vogliono altri sistemi nominati
   * nell'app per iPhone. Sul web, e altrove, tutte e due. */
  final tutteEDue = inLingua(
    it: 'Android Auto e CarPlay',
    en: 'Android Auto and CarPlay',
  );
  final auto = sulWeb
      ? tutteEDue
      : switch (defaultTargetPlatform) {
          TargetPlatform.android => 'Android Auto',
          TargetPlatform.iOS => 'CarPlay',
          _ => tutteEDue,
        };
  return [
    (
      Icons.dashboard_customize_outlined,
      inLingua(it: 'Più plance e più case', en: 'More dashboards and homes'),
      inLingua(
        it: 'Fino a 8 plance per casa e 10 case nell\'app',
        en: 'Up to 8 dashboards per home and 10 homes in the app',
      ),
    ),
    (
      Icons.public,
      inLingua(
        it: 'Da fuori casa, sicuro e diretto',
        en: 'From away, secure and direct',
      ),
      inLingua(
        it: 'Dal centralino, cifrato da un capo all\'altro',
        en: 'Through the relay, encrypted end to end',
      ),
    ),
    (
      Icons.tune,
      inLingua(it: 'Configurazione dall\'app', en: 'Configure from the app'),
      inLingua(
        it: 'La plancia si cambia dal telefono',
        en: 'Change the dashboard from your phone',
      ),
    ),
    (
      Icons.sensors,
      inLingua(
        it: 'Dispositivi Zigbee dall\'app',
        en: 'Zigbee devices from the app',
      ),
      inLingua(
        it: 'Li abbini dal telefono e scegli dove metterli',
        en: 'Pair them from your phone and choose where they go',
      ),
    ),
    (
      Icons.navigation_outlined,
      inLingua(it: 'gdanav Premium compreso', en: 'gdanav Premium included'),
      inLingua(
        it: '$auto, soste alle colonnine, Home Assistant',
        en: '$auto, charging stops, Home Assistant',
      ),
    ),
  ];
}

/// La riga in cima quando si arriva da un lucchetto: piccola, col
/// lucchetto, come le righe di gdanav.
class _IlPerche extends StatelessWidget {
  const _IlPerche(this.testo);
  final String testo;

  @override
  Widget build(BuildContext context) {
    final s = Theme.of(context).colorScheme;
    return Container(
      key: const Key('perche-premium'),
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: s.secondaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lock_outline, size: 18, color: s.onSecondaryContainer),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              testo,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: s.onSecondaryContainer,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Un piano da scegliere: il pallino, il nome, il prezzo a destra.
class _Piano extends StatelessWidget {
  const _Piano({
    required this.id,
    required this.prezzo,
    required this.scelto,
    required this.onTap,
    this.nota,
  });

  final String id;
  final String prezzo;
  final bool scelto;
  final String? nota;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final s = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Material(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: scelto ? s.primary : s.outline.withValues(alpha: 0.45),
            width: scelto ? 2 : 1,
          ),
        ),
        child: InkWell(
          key: Key('piano-$id'),
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 16, 12),
            child: Row(
              children: [
                Icon(
                  scelto ? Icons.radio_button_checked : Icons.radio_button_off,
                  color: scelto ? s.primary : null,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        id == pianoAnnuale
                            ? inLingua(it: 'Annuale', en: 'Yearly')
                            : inLingua(it: 'Mensile', en: 'Monthly'),
                        style: t.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (nota case final n?)
                        Text(n, style: t.bodySmall?.copyWith(color: s.primary)),
                    ],
                  ),
                ),
                Text(
                  prezzo,
                  style: t.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Una voce di cosa comprende: l'icona, il titolo, una riga sotto.
class _Voce extends StatelessWidget {
  const _Voce({required this.icona, required this.titolo, required this.testo});

  final IconData icona;
  final String titolo;
  final String testo;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icona, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  titolo,
                  style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                Text(testo, style: t.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Sul web, al posto del bottone: si compra dal telefono.
class _SulWeb extends StatelessWidget {
  const _SulWeb();

  @override
  Widget build(BuildContext context) {
    final s = Theme.of(context).colorScheme;
    return Padding(
      key: const Key('premium-sul-web'),
      padding: const EdgeInsets.fromLTRB(0, 8, 0, 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.phone_iphone, size: 18, color: s.onSurfaceVariant),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              inLingua(
                it:
                    'Da qui non si compra: abbonati dall\'app gdahome sul '
                    'telefono, e Premium arriva anche qui. Un codice regalo '
                    'invece lo puoi riscattare anche dal browser.',
                en:
                    'You can\'t buy from here: subscribe in the gdahome app on '
                    'your phone, and Premium shows up here too. A gift code, '
                    'though, can be redeemed from the browser as well.',
              ),
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: s.onSurfaceVariant),
            ),
          ),
        ],
      ),
    );
  }
}

class _Riga extends StatelessWidget {
  const _Riga(this.testo, {required this.colore});
  final String testo;
  final Color colore;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: Text(
      testo,
      textAlign: TextAlign.center,
      style: TextStyle(color: colore),
    ),
  );
}

/// «al 12 marzo 2027», ma «all'8 ottobre»: l'1, l'8 e l'11 cominciano con
/// una vocale.
String _alGiorno(DateTime quando) =>
    '${const {1, 8, 11}.contains(quando.day) ? "all'" : 'al '}'
    '${dataInParole(quando)}';

/// «12 marzo 2027», «12 March 2027».
String dataInParole(DateTime quando) {
  const mesi = [
    'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', //
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
  ];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June', //
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  final locale = quando.toLocal();
  return inLingua(
    it: '${locale.day} ${mesi[locale.month - 1]} ${locale.year}',
    en: '${locale.day} ${months[locale.month - 1]} ${locale.year}',
  );
}

/// Il foglio per il codice regalo: si scrive, si manda alla casa.
class _IlCodiceRegalo extends StatefulWidget {
  const _IlCodiceRegalo({required this.collegamento});
  final Collegamento collegamento;

  @override
  State<_IlCodiceRegalo> createState() => _IlCodiceRegaloState();
}

class _IlCodiceRegaloState extends State<_IlCodiceRegalo> {
  final _testo = TextEditingController();
  bool _staMandando = false;
  String? _errore;

  @override
  void dispose() {
    _testo.dispose();
    super.dispose();
  }

  Future<void> _manda() async {
    setState(() {
      _staMandando = true;
      _errore = null;
    });
    try {
      await widget.collegamento.riscatta(_testo.text);
      if (mounted) Navigator.of(context).pop(true);
    } on LicenzaRifiutata catch (no) {
      if (mounted) {
        setState(() {
          _staMandando = false;
          _errore = no.spiegazione;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(inLingua(it: 'Codice regalo', en: 'Gift code')),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            inLingua(
              it:
                  'Il codice che ti hanno dato, per attivare Premium su '
                  'questa casa e su tutti i suoi telefoni.',
              en:
                  'The code you were given, to turn on Premium for this '
                  'home and all of its phones.',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('campo-codice'),
            controller: _testo,
            autofocus: true,
            textCapitalization: TextCapitalization.characters,
            autocorrect: false,
            enableSuggestions: false,
            enabled: !_staMandando,
            decoration: InputDecoration(
              hintText: 'GDA-XXXX-XXXX-XXXX',
              border: const OutlineInputBorder(),
              errorText: _errore,
              errorMaxLines: 3,
            ),
            onSubmitted: (_) => _manda(),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _staMandando
              ? null
              : () => Navigator.of(context).pop(false),
          child: Text(inLingua(it: 'Annulla', en: 'Cancel')),
        ),
        FilledButton(
          key: const Key('riscatta-codice'),
          onPressed: _staMandando ? null : _manda,
          style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
          child: _staMandando
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(inLingua(it: 'Riscatta', en: 'Redeem')),
        ),
      ],
    );
  }
}
