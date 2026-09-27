/// La pagina di gdahome Premium: cosa comprende, quanto costa, come si ha.
///
/// Ci si arriva dal menu, e da ogni lucchetto dell'app: una plancia in piu',
/// una casa in piu', la Configurazione, Zigbee, la casa da fuori. Chi arriva
/// da un lucchetto legge in cima **perche'** e' qui ([perche]), e sotto
/// trova le stesse tre porte di sempre: i due piani del negozio, «Ripristina
/// acquisti», «Ho un codice regalo».
///
/// Premium e' **della casa**, e la pagina lo dice: si compra per la casa
/// aperta, e tutti i telefoni abbinati a lei — e la webapp — lo diventano
/// insieme. Sul web non si compra: li' non c'e' un negozio, e la pagina
/// manda al telefono. Un codice regalo invece si riscatta anche da li'.
library;

import 'dart:async';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../licenza/gettone.dart';
import '../licenza/licenza.dart';
import '../licenza/negozio.dart';
import '../parole.dart';
import '../vestito/oggetti.dart';
import '../vestito/pezzi.dart';
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
  /// riserva e i tasti per comprare non ci sono.
  final GestoreDegliAcquisti? acquisti;

  /// Da quale lucchetto si arriva, in una riga.
  final String? perche;

  /// Nella webapp: non si compra, si manda al telefono.
  final bool sulWeb;

  @override
  State<SchermataPremium> createState() => _SchermataPremiumState();
}

class _SchermataPremiumState extends State<SchermataPremium> {
  late final Listenable _ascolta = Listenable.merge([
    widget.collegamento.licenza,
    ?widget.acquisti,
  ]);

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
      appBar: AppBar(title: const Text('gdahome Premium')),
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
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 40),
      children: [
        if (widget.perche case final perche? when !premium) ...[
          _IlPerche(perche),
          const SizedBox(height: 14),
        ],
        _LaTestata(
          casa: casa?.nome,
          premium: premium,
          gettone: licenza.gettoneDi(casa),
          controlli: licenza.controlliAccesi,
        ),
        const SizedBox(height: 24),
        Insegna(inLingua(it: 'Cosa comprende', en: 'What\'s included')),
        const _CosaComprende(),
        const SizedBox(height: 24),
        if (!premium) ...[
          Insegna(inLingua(it: 'I piani', en: 'Plans')),
          if (widget.sulWeb) ...[_SulWeb(), const SizedBox(height: 12)],
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _Piano(
                  titolo: inLingua(it: 'Mensile', en: 'Monthly'),
                  prezzo:
                      acquisti?.prezzoDi(pianoMensile) ??
                      prezzoDiRiserva(pianoMensile),
                  sotto: inLingua(
                    it: 'Si disdice quando vuoi',
                    en: 'Cancel any time',
                  ),
                  compra: _compraIl(pianoMensile),
                  conTasto: !widget.sulWeb,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _Piano(
                  titolo: inLingua(it: 'Annuale', en: 'Yearly'),
                  prezzo:
                      acquisti?.prezzoDi(pianoAnnuale) ??
                      prezzoDiRiserva(pianoAnnuale),
                  sotto: inLingua(
                    it: 'Due mesi gratis rispetto al mensile',
                    en: 'Two months free compared to monthly',
                  ),
                  evidenza: inLingua(it: 'conviene', en: 'best value'),
                  compra: _compraIl(pianoAnnuale),
                  conTasto: !widget.sulWeb,
                ),
              ),
            ],
          ),
          if (!widget.sulWeb && (acquisti == null || !acquisti.disponibile))
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 10, 4, 0),
              child: Text(
                inLingua(
                  it:
                      'Il negozio non risponde adesso: i prezzi sono quelli '
                      'di listino.',
                  en:
                      'The store isn\'t responding right now: these are '
                      'list prices.',
                ),
                style: testi.bodySmall?.copyWith(
                  color: colori.onSurfaceVariant,
                ),
              ),
            ),
          const SizedBox(height: 16),
        ],
        if (acquisti?.inCorso ?? false)
          const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: LinearProgressIndicator(),
          ),
        if (acquisti?.errore case final errore?)
          _Riga(errore, colore: colori.error),
        if (acquisti?.fatto case final fatto?)
          _Riga(fatto, colore: Colori.bene),
        OutlinedButton.icon(
          onPressed: () => _ilCodice(context),
          icon: const Icon(Icons.redeem_rounded),
          label: Text(
            inLingua(it: 'Ho un codice regalo', en: 'I have a gift code'),
          ),
        ),
        if (!widget.sulWeb) ...[
          const SizedBox(height: 8),
          TextButton(
            onPressed: acquisti?.disponibile ?? false
                ? () => unawaited(acquisti!.ripristina())
                : null,
            child: Text(
              inLingua(it: 'Ripristina acquisti', en: 'Restore purchases'),
            ),
          ),
        ],
        const SizedBox(height: 16),
        Text(
          inLingua(
            it:
                'Premium vale per la casa, non per il telefono: tutti i '
                'telefoni abbinati a questa casa, e la webapp, lo sono '
                'insieme. L\'abbonamento si rinnova da solo e si disdice dal '
                'negozio. Dentro c\'è anche gdanav Premium.',
            en:
                'Premium belongs to the home, not the phone: every phone '
                'paired with this home, and the web app, get it together. '
                'The subscription renews automatically and is cancelled from '
                'the store. gdanav Premium is included.',
          ),
          textAlign: TextAlign.center,
          style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
        ),
      ],
    );
  }

  /// Il tasto per comprare un piano: `null` dove non si compra.
  VoidCallback? _compraIl(String piano) {
    final acquisti = widget.acquisti;
    if (widget.sulWeb || acquisti == null || !acquisti.disponibile) {
      return null;
    }
    if (acquisti.inCorso) return null;
    return () => unawaited(acquisti.compra(piano));
  }

  Future<void> _ilCodice(BuildContext context) async {
    final fatto = await showDialog<bool>(
      context: context,
      builder: (_) => _IlCodiceRegalo(collegamento: widget.collegamento),
    );
    if (fatto != true || !context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          inLingua(
            it: 'Codice riscattato: grazie!',
            en: 'Code redeemed: thank you!',
          ),
        ),
      ),
    );
  }
}

/// La riga in cima quando si arriva da un lucchetto.
class _IlPerche extends StatelessWidget {
  const _IlPerche(this.testo);
  final String testo;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: colori.secondaryContainer,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.lock_rounded,
            size: 20,
            color: colori.onSecondaryContainer,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              testo,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: colori.onSecondaryContainer,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// La testata: il nome, per quale casa, e come sta.
class _LaTestata extends StatelessWidget {
  const _LaTestata({
    required this.casa,
    required this.premium,
    required this.gettone,
    required this.controlli,
  });

  final String? casa;
  final bool premium;
  final Gettone? gettone;
  final bool controlli;

  @override
  Widget build(BuildContext context) {
    final stato = premium
        ? _comeSta(gettone, controlli)
        : inLingua(it: 'Base', en: 'Basic');
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1E3A5F), Colori.notte],
        ),
        boxShadow: Scheda.ombra(context),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Oggetto('evidenza', lato: 40),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'gdahome',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      'PREMIUM',
                      style: TextStyle(
                        fontFamily: 'Oswald',
                        color: Colors.white,
                        fontSize: 30,
                        height: 1.05,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: premium
                      ? Colori.bene
                      : Colors.white.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  premium
                      ? inLingua(it: 'Attivo', en: 'Active')
                      : inLingua(it: 'Base', en: 'Basic'),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            casa == null
                ? inLingua(
                    it: 'Per tutta la casa, su tutti i telefoni.',
                    en: 'For the whole home, on every phone.',
                  )
                : inLingua(
                    it: 'Per «$casa», su tutti i telefoni della casa.',
                    en: 'For “$casa”, on every phone in the home.',
                  ),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            premium
                ? stato
                : inLingua(
                    it:
                        'Adesso: una plancia, una casa, collegamento solo '
                        'in casa.',
                    en: 'Now: one dashboard, one home, connection at home only.',
                  ),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.72),
              fontSize: 13,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }

  /// «Premium fino al 12 marzo 2027 · regalo».
  static String _comeSta(Gettone? gettone, bool controlli) {
    if (!controlli || gettone == null) {
      return inLingua(it: 'Tutto è aperto.', en: 'Everything is unlocked.');
    }
    final scade = gettone.scade;
    final quando = scade == null
        ? inLingua(it: 'Premium per sempre', en: 'Premium forever')
        : inLingua(
            it: 'Premium fino al ${dataInParole(scade)}',
            en: 'Premium until ${dataInParole(scade)}',
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
    return origine.isEmpty ? quando : '$quando · $origine';
  }
}

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

/// Cosa comprende, riga per riga.
class _CosaComprende extends StatelessWidget {
  const _CosaComprende();

  @override
  Widget build(BuildContext context) {
    final righe = [
      (
        Icons.dashboard_customize_rounded,
        inLingua(it: 'Più plance e più case', en: 'More dashboards and homes'),
        inLingua(
          it: 'Fino a 8 plance per casa e 10 case nell\'app.',
          en: 'Up to 8 dashboards per home and 10 homes in the app.',
        ),
      ),
      (
        Icons.public_rounded,
        inLingua(
          it: 'Da fuori casa, sicuro e diretto',
          en: 'From away, secure and direct',
        ),
        inLingua(
          it: 'Dal centralino, cifrato da un capo all\'altro.',
          en: 'Through the relay, encrypted end to end.',
        ),
      ),
      (
        Icons.tune_rounded,
        inLingua(it: 'Configurazione dall\'app', en: 'Configure from the app'),
        inLingua(
          it: 'La plancia si cambia dal telefono.',
          en: 'Change the dashboard from your phone.',
        ),
      ),
      (
        Icons.sensors_rounded,
        inLingua(
          it: 'Dispositivi Zigbee dall\'app',
          en: 'Zigbee devices from the app',
        ),
        inLingua(
          it: 'Li abbini dal telefono e scegli dove metterli.',
          en: 'Pair them from your phone and choose where they go.',
        ),
      ),
      (
        Icons.navigation_rounded,
        inLingua(it: 'gdanav Premium compreso', en: 'gdanav Premium included'),
        inLingua(
          it: 'Android Auto e CarPlay, soste alle colonnine, Home Assistant.',
          en: 'Android Auto and CarPlay, charging stops, Home Assistant.',
        ),
      ),
    ];
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Scheda(
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
      child: Column(
        children: [
          for (final (i, (icona, titolo, sotto)) in righe.indexed) ...[
            if (i > 0) Divider(color: colori.outlineVariant, height: 1),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  Cerchietto(
                    icona: icona,
                    lato: 38,
                    fondo: colori.secondaryContainer,
                    colore: colori.onSecondaryContainer,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          titolo,
                          style: testi.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          sotto,
                          style: testi.bodySmall?.copyWith(
                            color: colori.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Un piano: il nome, il prezzo del negozio, il tasto.
class _Piano extends StatelessWidget {
  const _Piano({
    required this.titolo,
    required this.prezzo,
    required this.sotto,
    required this.compra,
    this.evidenza,
    this.conTasto = true,
  });

  /// Sul web il tasto non c'e': li' non si compra.
  final bool conTasto;

  final String titolo;
  final String prezzo;
  final String sotto;
  final VoidCallback? compra;
  final String? evidenza;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Scheda(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      bordo: evidenza != null ? Colori.ambra : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          /* Alta uguale con e senza il bollino: i due piani stanno affiancati,
           * e i prezzi devono stare alla stessa altezza. */
          SizedBox(
            height: 26,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    titolo.toUpperCase(),
                    style: testi.labelMedium?.copyWith(
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w800,
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ),
                if (evidenza case final e?)
                  Bollino(
                    e,
                    fondo: colori.secondaryContainer,
                    colore: colori.onSecondaryContainer,
                  ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              prezzo,
              maxLines: 1,
              style: carattereDelNumero(
                corpo: 26,
                peso: FontWeight.w700,
                colore: colori.onSurface,
              ),
            ),
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: 34,
            child: Text(
              sotto,
              maxLines: 2,
              style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
            ),
          ),
          if (conTasto) ...[
            const SizedBox(height: 10),
            FilledButton(
              onPressed: compra,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(44),
                backgroundColor: evidenza != null ? Colori.ambraScura : null,
              ),
              child: Text(inLingua(it: 'Abbonati', en: 'Subscribe')),
            ),
          ],
        ],
      ),
    );
  }
}

/// Sul web: si compra dal telefono.
class _SulWeb extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Scheda(
      child: Row(
        children: [
          Cerchietto(icona: Icons.phone_iphone_rounded, lato: 40),
          const SizedBox(width: 12),
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
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(color: colori.onSurface),
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
    padding: const EdgeInsets.only(bottom: 12),
    child: Text(
      testo,
      textAlign: TextAlign.center,
      style: Theme.of(context).textTheme.bodyMedium
          ?.copyWith(color: colore, fontWeight: FontWeight.w600),
    ),
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
                  'Il codice vale per la casa aperta adesso, e per tutti i '
                  'suoi telefoni.',
              en:
                  'The code applies to the home open right now, and to all '
                  'of its phones.',
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _testo,
            autofocus: true,
            textCapitalization: TextCapitalization.characters,
            enabled: !_staMandando,
            decoration: InputDecoration(
              hintText: 'GDA-XXXX-XXXX-XXXX',
              errorText: _errore,
              errorMaxLines: 3,
            ),
            onSubmitted: (_) => _manda(),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _staMandando ? null : () => Navigator.of(context).pop(),
          child: Text(inLingua(it: 'Annulla', en: 'Cancel')),
        ),
        FilledButton(
          onPressed: _staMandando ? null : _manda,
          style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
          child: _staMandando
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(inLingua(it: 'Riscatta', en: 'Redeem')),
        ),
      ],
    );
  }
}
