part of 'notifiche.dart';

/* ─── Da Home Assistant ────────────────────────────────────────────────────
 *
 * Le automazioni di Home Assistant che mandano notifiche ai telefoni (con
 * l'app di Home Assistant), trovate dal ponte
 * (`ponte/src/notifiche-di-home-assistant.js`): per ognuna si sceglie se
 * riceverla anche qui. Di serie spente, tutte.
 *
 * In Base: il testo, su questo telefono, delle automazioni che mandano a lui
 * (o a tutti). Con Premium: la foto, i tasti, mandarle ad altri telefoni o a
 * tutti, e «Proponimi le nuove». Quello che in Base non c'e' ha il bollino
 * PREMIUM, e al tocco la spiegazione. */

/// Il disegno di un'automazione, da come si chiama: la lavatrice, la porta,
/// l'allarme. Quello che non si riconosce e' un avviso.
String disegnoDellAutomazione(AutomazioneCheAvvisa automazione) {
  final testo = '${automazione.alias} ${automazione.titolo}'.toLowerCase();
  bool c(String quali) => RegExp(quali).hasMatch(testo);
  if (c(
    'lavatric|lavastovigl|asciugatric|forno|elettrodomest|washer|dish|dryer',
  )) {
    return 'elettrodomestici';
  }
  if (c('allarm|antifurto|moviment|intrus|alarm|motion|sicurezz')) {
    return 'sicurezza';
  }
  if (c('telecamer|camera|campanell|doorbell')) return 'telecamere';
  if (c('garage|porta|portone|cancell|finestr|door|gate|window')) {
    return 'varchi';
  }
  if (c('batteri|battery')) return 'batterie';
  if (c('allag|perdita|leak|acqua|water')) return 'allagamenti';
  if (c('freezer|frigo|temperatur|caldo|freddo|fridge')) return 'temperatura';
  if (c('bollett|contator|energi|kwh|consum|fotovolt|energy|power')) {
    return 'energia';
  }
  if (c('meteo|buongiorno|pioggia|sole|weather|rain|morning')) return 'solare';
  return 'avvisi';
}

/// «oggi alle 18:42», «ieri alle 18:42», «il 12/10 alle 18:42».
String unaVoltaDetta(DateTime quando, DateTime adesso) {
  String due(int n) => n.toString().padLeft(2, '0');
  final ora = '${due(quando.hour)}:${due(quando.minute)}';
  final giorno = DateTime(quando.year, quando.month, quando.day);
  final oggi = DateTime(adesso.year, adesso.month, adesso.day);
  /* Il cambio dell'ora fa giorni di 23 o 25 ore: si arrotonda. */
  final quanti = (oggi.difference(giorno).inHours + 12) ~/ 24;
  if (quanti == 0) return inLingua(it: 'oggi alle $ora', en: 'today at $ora');
  if (quanti == 1) {
    return inLingua(it: 'ieri alle $ora', en: 'yesterday at $ora');
  }
  return inLingua(
    it: 'il ${quando.day}/${quando.month} alle $ora',
    en: 'on ${quando.month}/${quando.day} at $ora',
  );
}

/// Il nome di un telefono della casa: «Telefono di Persona 1», o il modello.
String nomeDelTelefono(TelefonoDellaCasa? telefono) {
  final nome = telefono?.nome.trim() ?? '';
  if (nome.isNotEmpty) {
    return inLingua(it: 'Telefono di $nome', en: '$nome\'s phone');
  }
  final modello = telefono?.modello.trim() ?? '';
  if (modello.isNotEmpty) return modello;
  return inLingua(it: 'Un altro telefono', en: 'Another phone');
}

enum _Tinta { blu, ambra, grigio, verde }

/// Dove arriva, in una parola: la prima etichetta della riga.
(String, _Tinta) _ilDestino(
  AutomazioneCheAvvisa riga,
  NotificheDaHomeAssistant dati, {
  required bool premium,
}) {
  final a = riga.a;
  if (premium && riga.acceso && a == 'tutti') {
    return (inLingua(it: 'Tutti i telefoni', en: 'All phones'), _Tinta.blu);
  }
  if (premium && riga.acceso && a != 'questo' && a != 'tutti') {
    return (nomeDelTelefono(dati.telefono(a)), _Tinta.blu);
  }
  switch (riga.bersaglio) {
    case 'questo':
      return (inLingua(it: 'Questo telefono', en: 'This phone'), _Tinta.blu);
    case 'tutti':
      return (inLingua(it: 'Tutti i telefoni', en: 'All phones'), _Tinta.blu);
  }
  if (premium && riga.acceso) {
    return (inLingua(it: 'Questo telefono', en: 'This phone'), _Tinta.blu);
  }
  if (riga.bersaglio == 'altro') {
    final nome = riga.telefoni.isEmpty
        ? ''
        : (dati.telefono(riga.telefoni.first)?.nome.trim() ?? '');
    return (
      nome.isEmpty
          ? inLingua(it: 'Va a un altro telefono', en: 'Goes to another phone')
          : inLingua(
              it: 'Va al telefono di $nome',
              en: 'Goes to $nome\'s phone',
            ),
      _Tinta.grigio,
    );
  }
  return (
    inLingua(
      it: 'Va a un telefono senza GdAHome',
      en: 'Goes to a phone without GdAHome',
    ),
    _Tinta.grigio,
  );
}

class _Chip extends StatelessWidget {
  const _Chip(this.testo, this.tinta);
  final String testo;
  final _Tinta tinta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final scuro = Theme.of(context).brightness == Brightness.dark;
    final (fondo, scritta) = switch (tinta) {
      _Tinta.blu => (
        scuro ? const Color(0xFF1E3A5F) : const Color(0xFFDBEAFE),
        scuro ? const Color(0xFFBFDBFE) : const Color(0xFF1E40AF),
      ),
      _Tinta.ambra => (
        scuro ? const Color(0xFF422006) : const Color(0xFFFEF3C7),
        scuro ? const Color(0xFFFCD34D) : const Color(0xFF92400E),
      ),
      _Tinta.verde => (
        scuro ? const Color(0xFF10321F) : const Color(0xFFDCFCE7),
        scuro ? const Color(0xFF86EFAC) : const Color(0xFF166534),
      ),
      _Tinta.grigio => (
        colori.surfaceContainerHighest,
        colori.onSurfaceVariant,
      ),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: fondo,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        testo,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
          color: scritta,
        ),
      ),
    );
  }
}

/// Le etichette di una riga: dove arriva, e com'e' fatta.
List<(String, _Tinta)> _leEtichette(
  AutomazioneCheAvvisa riga,
  NotificheDaHomeAssistant dati, {
  required bool premium,
}) => [
  _ilDestino(riga, dati, premium: premium),
  if (riga.conFoto) (inLingua(it: 'Con foto', en: 'With photo'), _Tinta.ambra),
  if (riga.conTasti)
    (inLingua(it: 'Con tasti', en: 'With buttons'), _Tinta.grigio),
  if (riga.urgente) (inLingua(it: 'Urgente', en: 'Urgent'), _Tinta.grigio),
  if (riga.testoCheCambia)
    (inLingua(it: 'Testo che cambia', en: 'Changing text'), _Tinta.grigio),
];

/// La sezione «Da Home Assistant» della pagina Notifiche.
class SezioneDaHomeAssistant extends StatelessWidget {
  const SezioneDaHomeAssistant({
    super.key,
    required this.dati,
    required this.premium,
    required this.cambia,
    required this.proponi,
    required this.apri,
    required this.spiegaIlPremium,
    this.spento = false,
  });

  final NotificheDaHomeAssistant dati;
  final bool premium;

  /// Le scelte di una o piu' automazioni, alla casa.
  final void Function(Map<String, Map<String, Object>> voci) cambia;
  final ValueChanged<bool> proponi;
  final ValueChanged<AutomazioneCheAvvisa> apri;
  final VoidCallback spiegaIlPremium;

  /// Con l'interruttore generale spento.
  final bool spento;

  /// Se in questa casa la si puo' accendere: in Base solo quelle per lui.
  bool _siAccende(AutomazioneCheAvvisa riga) => premium || riga.perMe;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final righe = dati.automazioni;
    final mieSpente = [
      for (final riga in righe)
        if (riga.perMe && !riga.acceso) riga,
    ];
    final quante = righe.length;
    return Column(
      key: const Key('sezione-da-home-assistant'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Titolo(
          disegno: 'automazioni',
          testo: inLingua(it: 'Da Home Assistant', en: 'From Home Assistant'),
        ),
        Scheda(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: colori.surfaceContainer,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Oggetto('home', lato: 26),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          quante == 1
                              ? inLingua(
                                  it:
                                      'Ho trovato 1 automazione che ti manda '
                                      'notifiche',
                                  en:
                                      'I found 1 automation that sends you '
                                      'notifications',
                                )
                              : inLingua(
                                  it:
                                      'Ho trovato $quante automazioni che ti '
                                      'mandano notifiche',
                                  en:
                                      'I found $quante automations that send '
                                      'you notifications',
                                ),
                          style: testi.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          inLingua(
                            it:
                                'Le mandano all\'app di Home Assistant. Scegli '
                                'quali ricevere anche qui: stesso momento, '
                                'stesso testo.',
                            en:
                                'They go to the Home Assistant app. Pick which '
                                'ones to get here too: same moment, same text.',
                          ),
                          style: testi.bodySmall?.copyWith(
                            color: colori.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (mieSpente.isNotEmpty && !spento) ...[
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.only(left: 48),
                  child: TextButton.icon(
                    key: const Key('accendi-quelle-di-questo-telefono'),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                    ),
                    onPressed: () => cambia({
                      for (final riga in mieSpente)
                        riga.chiave: {'acceso': true},
                    }),
                    icon: const Icon(Icons.done_all_rounded, size: 18),
                    label: Text(
                      inLingua(
                        it: 'Accendi quelle di questo telefono',
                        en: 'Turn on the ones for this phone',
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        Scheda(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (final (i, riga) in righe.indexed) ...[
                if (i > 0) const _Riga(),
                _RigaDaHomeAssistant(
                  riga: riga,
                  etichette: _leEtichette(riga, dati, premium: premium),
                  bloccata: !_siAccende(riga),
                  spento: spento,
                  cambia: (si) => cambia({
                    riga.chiave: {'acceso': si},
                  }),
                  tocca: _siAccende(riga) ? () => apri(riga) : spiegaIlPremium,
                ),
              ],
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(6, 10, 6, 12),
          child: Text(
            inLingua(
              it:
                  'Arrivano cifrate come le altre notifiche di GdAHome. L\'app '
                  'di Home Assistant continua a riceverle: se non le vuoi '
                  'doppie, spegnile lì.',
              en:
                  'They arrive encrypted like the other GdAHome notifications. '
                  'The Home Assistant app keeps getting them: if you don\'t '
                  'want them twice, turn them off there.',
            ),
            style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
          ),
        ),
        Scheda(
          padding: EdgeInsets.zero,
          child: _Interruttore(
            chiave: const Key('proponimi-le-nuove'),
            icona: Icons.fiber_new_rounded,
            titolo: inLingua(it: 'Proponimi le nuove', en: 'Suggest new ones'),
            sotto: inLingua(
              it:
                  'Quando aggiungi un\'automazione che manda notifiche, te lo '
                  'dico. Le nuove arrivano spente: le accendi tu.',
              en:
                  'When you add an automation that sends notifications, I\'ll '
                  'tell you. New ones arrive off: you turn them on.',
            ),
            valore: premium && dati.proponi,
            spento: spento,
            cambia: proponi,
            bloccata: premium ? null : spiegaIlPremium,
          ),
        ),
      ],
    );
  }
}

class _RigaDaHomeAssistant extends StatelessWidget {
  const _RigaDaHomeAssistant({
    required this.riga,
    required this.etichette,
    required this.bloccata,
    required this.spento,
    required this.cambia,
    required this.tocca,
  });

  final AutomazioneCheAvvisa riga;
  final List<(String, _Tinta)> etichette;

  /// Va al telefono di un altro, e la casa e' Base: grigia, e al tocco la
  /// spiegazione del Premium.
  final bool bloccata;
  final bool spento;
  final ValueChanged<bool> cambia;
  final VoidCallback tocca;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final testo = riga.testo;
    final contenuto = Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: colori.surfaceContainer,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Oggetto(disegnoDellAutomazione(riga), lato: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(text: riga.alias),
                      if (riga.nuova)
                        WidgetSpan(
                          alignment: PlaceholderAlignment.middle,
                          child: Padding(
                            padding: const EdgeInsets.only(left: 6),
                            child: _Etichetta(
                              testo: inLingua(it: 'NUOVA', en: 'NEW'),
                              colore: Colori.bene,
                            ),
                          ),
                        ),
                    ],
                  ),
                  style: testi.bodyLarge?.copyWith(fontWeight: FontWeight.w600),
                ),
                if (testo.isNotEmpty)
                  Text(
                    '«$testo»',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                const SizedBox(height: 5),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    for (final (testo, tinta) in etichette) _Chip(testo, tinta),
                  ],
                ),
              ],
            ),
          ),
          Icon(
            Icons.chevron_right_rounded,
            color: colori.onSurfaceVariant,
            size: 22,
          ),
          const SizedBox(width: 4),
          Switch(
            value: riga.acceso && !bloccata,
            onChanged: spento || bloccata ? null : cambia,
            activeTrackColor: colori.primary,
            activeThumbColor: colori.onPrimary,
          ),
        ],
      ),
    );
    return Opacity(
      opacity: spento || bloccata ? 0.5 : 1,
      child: spento
          ? contenuto
          : InkWell(
              key: Key('ha-${riga.chiave}'),
              onTap: tocca,
              child: contenuto,
            ),
    );
  }
}

/// Il foglio di un'automazione: quando parte, cosa dice, chi la riceve.
class FoglioDaHomeAssistant extends StatefulWidget {
  const FoglioDaHomeAssistant({
    super.key,
    required this.riga,
    required this.dati,
    required this.premium,
    required this.silenzio,
    required this.cambia,
    required this.spiegaIlPremium,
    this.adesso,
  });

  final AutomazioneCheAvvisa riga;
  final NotificheDaHomeAssistant dati;
  final bool premium;

  /// Le ore di silenzio di questo telefono, per dirle.
  final OreDiSilenzio silenzio;

  /// Le scelte alla casa: torna la riga com'e' adesso, o `null` se non e'
  /// andata.
  final Future<AutomazioneCheAvvisa?> Function(Map<String, Object> voce) cambia;
  final VoidCallback spiegaIlPremium;

  /// L'ora di adesso, per «ieri alle…»: per le prove e le fotografie.
  final DateTime? adesso;

  @override
  State<FoglioDaHomeAssistant> createState() => _StatoDelFoglioDaHA();
}

class _StatoDelFoglioDaHA extends State<FoglioDaHomeAssistant> {
  late AutomazioneCheAvvisa _riga = widget.riga;
  bool _inCorso = false;

  bool get _siAccende => widget.premium || _riga.perMe;

  Future<void> _cambia(Map<String, Object> voce) async {
    if (_inCorso) return;
    final prima = _riga;
    setState(() {
      _inCorso = true;
      _riga = _riga.con(
        acceso: voce['acceso'] as bool?,
        a: voce['a'] as String?,
        silenzio: voce['silenzio'] as bool?,
      );
    });
    final dopo = await widget.cambia(voce);
    if (!mounted) return;
    setState(() {
      _inCorso = false;
      _riga = dopo ?? prima;
    });
  }

  Widget _etichetta(BuildContext context, String testo) => Padding(
    padding: const EdgeInsets.only(top: 18, bottom: 8),
    child: Text(
      testo.toUpperCase(),
      style: Theme.of(context).textTheme.labelMedium?.copyWith(
        letterSpacing: 1.1,
        fontWeight: FontWeight.w700,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final riga = _riga;
    final dati = widget.dati;
    final premium = widget.premium;
    final adesso = widget.adesso ?? DateTime.now();
    final questo = dati.questo;
    final altri = [
      for (final uno in dati.telefoni)
        if (!uno.io) uno,
    ];
    final sotto = [
      inLingua(
        it: 'Automazione di Home Assistant',
        en: 'Home Assistant automation',
      ),
      if (riga.ultimaVolta case final DateTime quando)
        inLingua(it: 'scattata l\'ultima volta ', en: 'last ran ') +
            unaVoltaDetta(quando, adesso),
    ].join(' · ');
    final silenzio = widget.silenzio;
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              riga.alias,
              style: testi.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              sotto,
              style: testi.bodyMedium?.copyWith(color: colori.onSurfaceVariant),
            ),
            if (riga.quando case final String quando) ...[
              _etichetta(context, inLingua(it: 'Quando', en: 'When')),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: colori.surfaceContainer,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(quando, style: testi.bodyLarge),
              ),
            ],
            if (riga.testo.isNotEmpty) ...[
              _etichetta(
                context,
                inLingua(it: 'Cosa dice', en: 'What it says'),
              ),
              _LAnteprima(titolo: riga.titolo, testo: riga.testo),
              if (riga.testoCheCambia)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    riga.ultimoTesto != null
                        ? inLingua(
                            it:
                                'Il testo lo scrive Home Assistant quando '
                                'l\'automazione scatta: i numeri cambiano ogni '
                                'volta. Qui vedi l\'ultimo arrivato.',
                            en:
                                'Home Assistant writes the text when the '
                                'automation runs: the numbers change every '
                                'time. Here you see the latest one.',
                          )
                        : inLingua(
                            it:
                                'Il testo lo scrive Home Assistant quando '
                                'l\'automazione scatta: qui vedi com\'è '
                                'scritto, i numeri arrivano con la notifica.',
                            en:
                                'Home Assistant writes the text when the '
                                'automation runs: here you see how it\'s '
                                'written, the numbers come with the '
                                'notification.',
                          ),
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ),
            ],
            _etichetta(
              context,
              inLingua(it: 'Chi la riceve', en: 'Who gets it'),
            ),
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: colori.outlineVariant),
                borderRadius: BorderRadius.circular(16),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  _UnaScelta(
                    chiave: const Key('ha-a-questo'),
                    scelta: riga.a == 'questo',
                    titolo: inLingua(it: 'Questo telefono', en: 'This phone'),
                    sotto: [
                      if ((questo?.modello ?? '').isNotEmpty) questo!.modello,
                      if (riga.bersaglio == 'questo')
                        inLingua(
                          it: 'è lui in Home Assistant',
                          en: 'it\'s the one in Home Assistant',
                        )
                      else if (riga.bersaglio == 'tutti')
                        inLingua(
                          it: 'Home Assistant la manda a tutti',
                          en: 'Home Assistant sends it to everyone',
                        ),
                    ].join(' · '),
                    trovato: riga.bersaglio == 'questo',
                    tocca: _siAccende ? () => _cambia({'a': 'questo'}) : null,
                  ),
                  for (final altro in altri) ...[
                    const Divider(height: 1),
                    _UnaScelta(
                      chiave: Key('ha-a-${altro.id}'),
                      scelta: riga.a == altro.id,
                      titolo: nomeDelTelefono(altro),
                      sotto: altro.nome.trim().isEmpty ? '' : altro.modello,
                      bloccata: !premium,
                      tocca: premium
                          ? () => _cambia({'a': altro.id})
                          : widget.spiegaIlPremium,
                    ),
                  ],
                  const Divider(height: 1),
                  _UnaScelta(
                    chiave: const Key('ha-a-tutti'),
                    scelta: riga.a == 'tutti',
                    titolo: inLingua(
                      it: 'Tutti i telefoni della casa',
                      en: 'All the home\'s phones',
                    ),
                    sotto: inLingua(
                      it: 'Chi ha GdAHome e vede questa casa',
                      en: 'Whoever has GdAHome and sees this home',
                    ),
                    bloccata: !premium,
                    tocca: premium
                        ? () => _cambia({'a': 'tutti'})
                        : widget.spiegaIlPremium,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        inLingua(
                          it: 'Rispetta le ore di silenzio',
                          en: 'Respect quiet hours',
                        ),
                        style: testi.bodyLarge?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        silenzio.acceso
                            ? inLingua(
                                it:
                                    'Dalle ${silenzio.dalle} alle '
                                    '${silenzio.alle} aspetta il mattino',
                                en:
                                    'From ${silenzio.dalle} to '
                                    '${silenzio.alle} it waits for morning',
                              )
                            : inLingua(
                                it:
                                    'Su questo telefono le ore di silenzio '
                                    'sono spente',
                                en: 'Quiet hours are off on this phone',
                              ),
                        style: testi.bodySmall?.copyWith(
                          color: colori.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Switch(
                  key: const Key('ha-silenzio'),
                  value: riga.silenzio,
                  onChanged: _siAccende
                      ? (si) => _cambia({'silenzio': si})
                      : null,
                  activeTrackColor: colori.primary,
                  activeThumbColor: colori.onPrimary,
                ),
              ],
            ),
            if (!premium && (riga.conFoto || riga.conTasti)) ...[
              const SizedBox(height: 12),
              InkWell(
                onTap: widget.spiegaIlPremium,
                borderRadius: BorderRadius.circular(10),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      const BollinoPremium(),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          inLingua(
                            it:
                                'La foto e i tasti arrivano con Premium: '
                                'qui arriva il testo.',
                            en:
                                'The photo and the buttons come with '
                                'Premium: here you get the text.',
                          ),
                          style: testi.bodySmall?.copyWith(
                            color: colori.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 20),
            if (!riga.acceso)
              FilledButton(
                key: const Key('ha-ricevila'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                ),
                onPressed: !_siAccende
                    ? widget.spiegaIlPremium
                    : _inCorso
                    ? null
                    : () => _cambia({'acceso': true}),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (!_siAccende) ...[
                      const Icon(Icons.lock_rounded, size: 18),
                      const SizedBox(width: 8),
                    ],
                    Flexible(
                      child: Text(
                        inLingua(
                          it: 'Ricevila anche in GdAHome',
                          en: 'Get it in GdAHome too',
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              )
            else
              OutlinedButton(
                key: const Key('ha-non-piu'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                ),
                onPressed: _inCorso ? null : () => _cambia({'acceso': false}),
                child: Text(
                  inLingua(
                    it: 'Non riceverla più in GdAHome',
                    en: 'Stop getting it in GdAHome',
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Com'e' fatta, come arriva: il nome dell'app, il titolo e il testo.
class _LAnteprima extends StatelessWidget {
  const _LAnteprima({required this.titolo, required this.testo});
  final String titolo;
  final String testo;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colori.surfaceContainerLow,
        border: Border.all(color: colori.outlineVariant),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colori.blu,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.home_rounded,
              size: 18,
              color: Colors.white,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'GdAHome · Home Assistant',
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  titolo,
                  style: testi.bodyLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
                Text(testo, style: testi.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Una scelta di «Chi la riceve».
class _UnaScelta extends StatelessWidget {
  const _UnaScelta({
    required this.chiave,
    required this.scelta,
    required this.titolo,
    required this.sotto,
    required this.tocca,
    this.trovato = false,
    this.bloccata = false,
  });

  final Key chiave;
  final bool scelta;
  final String titolo;
  final String sotto;
  final VoidCallback? tocca;
  final bool trovato;

  /// Premium, in una casa Base: il bollino, e al tocco la spiegazione.
  final bool bloccata;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return InkWell(
      key: chiave,
      onTap: tocca,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Row(
          children: [
            Icon(
              scelta && !bloccata
                  ? Icons.radio_button_checked_rounded
                  : Icons.radio_button_unchecked_rounded,
              color: scelta && !bloccata
                  ? colori.primary
                  : colori.onSurfaceVariant,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    titolo,
                    style: testi.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (sotto.isNotEmpty)
                    Text(
                      sotto,
                      style: testi.bodySmall?.copyWith(
                        color: colori.onSurfaceVariant,
                      ),
                    ),
                ],
              ),
            ),
            if (trovato) ...[
              const SizedBox(width: 8),
              _Chip(inLingua(it: 'Trovato', en: 'Found'), _Tinta.verde),
            ],
            if (bloccata) ...[const SizedBox(width: 8), const BollinoPremium()],
          ],
        ),
      ),
    );
  }
}
