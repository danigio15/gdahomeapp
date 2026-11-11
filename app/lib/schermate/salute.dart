/// La pagina «Salute»: le misure dell'orologio, portate a casa.
///
/// Un interruttore, un nome, le misure da mandare. Sopra si dice da dove si
/// legge — Apple Salute sull'iPhone, Health Connect su Android — e sotto,
/// sempre in vista, dove vanno: nella casa, e da nessun'altra parte. Nella
/// plancia compaiono nella pagina Salute, col nome scritto qui.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../parole.dart';
import '../salute/il_corpo.dart';
import '../salute/lettore.dart';
import '../salute/postino_della_salute.dart';
import '../vestito/oggetti.dart';
import '../vestito/pezzi.dart';

class SchermataDellaSalute extends StatefulWidget {
  const SchermataDellaSalute({
    super.key,
    required this.collegamento,
    required this.postino,
    this.nuda = false,
    this.doveIniziale,
  });

  final Collegamento collegamento;
  final PostinoDellaSalute postino;
  final bool nuda;

  /// Per le prove e i disegni: dove si legge, senza chiederlo al telefono.
  final DoveSiLegge? doveIniziale;

  @override
  State<SchermataDellaSalute> createState() => _StatoDellaSalute();
}

class _StatoDellaSalute extends State<SchermataDellaSalute> {
  late final _nome = TextEditingController(text: widget.postino.scelte.persona);
  DoveSiLegge? _dove;
  bool _lavorando = false;
  StreamSubscription<void>? _ascolto;

  PostinoDellaSalute get _postino => widget.postino;

  @override
  void initState() {
    super.initState();
    _dove = widget.doveIniziale;
    _ascolto = _postino.cambiamenti.listen((_) {
      if (mounted) setState(() {});
    });
    unawaited(_prepara());
  }

  Future<void> _prepara() async {
    final scelte = await _postino.carica();
    if (scelte.persona.isEmpty && _nome.text.isEmpty) {
      _nome.text = await widget.collegamento.archivio.proprietario();
    } else if (_nome.text.isEmpty) {
      _nome.text = scelte.persona;
    }
    _dove ??= await _postino.lettore.dove();
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _ascolto?.cancel();
    _nome.dispose();
    super.dispose();
  }

  Future<void> _lavora(Future<void> Function() cosa) async {
    setState(() => _lavorando = true);
    try {
      await cosa();
    } finally {
      if (mounted) setState(() => _lavorando = false);
    }
  }

  ScelteDellaSalute get _scelte =>
      _postino.scelte.con(persona: personaPulita(_nome.text));

  Future<void> _interruttore(bool acceso) => _lavora(() async {
    final filo = widget.collegamento.filo;
    if (!acceso) {
      await _postino.spegni(filo);
      _avviso(
        inLingua(
          it: 'Spento: la casa ha tolto le tue misure.',
          en: 'Turned off: your home removed your readings.',
        ),
      );
      return;
    }
    final fatto = await _postino.accendi(filo, _scelte);
    if (!fatto) {
      _avviso(
        inLingua(
          it: 'Il telefono non ha dato il permesso di leggere la salute.',
          en: "The phone didn't allow reading health data.",
        ),
      );
      return;
    }
    final guasto = _postino.ultimoGuasto;
    if (guasto != null) _avviso(guasto.spiegazione);
  });

  Future<void> _adAppChiusa(bool si) =>
      _lavora(() => _postino.cambiaAdAppChiusa(si));

  Future<void> _cambiaMisura(MisuraDelCorpo misura, bool si) => _lavora(() {
    final misure = {..._postino.scelte.misure};
    si ? misure.add(misura) : misure.remove(misura);
    return _postino.cambia(
      widget.collegamento.filo,
      _scelte.con(misure: misure),
    );
  });

  Future<void> _salvaIlNome() =>
      _lavora(() => _postino.cambia(widget.collegamento.filo, _scelte));

  Future<void> _mandaAdesso() => _lavora(() async {
    final quante = await _postino.manda(widget.collegamento.filo, subito: true);
    _avviso(
      quante == null
          ? (_postino.ultimoGuasto ?? GuastoDellaSalute.casaNonRisponde)
                .spiegazione
          : inLingua(
              it: 'Mandate $quante misure alla casa.',
              en: 'Sent $quante readings to your home.',
            ),
    );
  });

  /* I permessi che Android ha tolto (o che non si sono mai dati): la domanda
   * di Health Connect, con tutte le misure che mancano. Se resta fuori
   * qualcosa — chi dice di no due volte non vede piu' la domanda — si dice
   * dove si danno a mano. */
  Future<void> _daiIPermessi() => _lavora(() async {
    final restano = await _postino.chiediIPermessiCheMancano(
      widget.collegamento.filo,
    );
    _avviso(
      restano == 0
          ? inLingua(
              it: 'Permessi dati: le misure arrivano alla casa.',
              en: 'Permissions granted: readings are on their way home.',
            )
          : inLingua(
              it:
                  'Mancano ancora $restano permessi. Se la richiesta non '
                  'compare: Impostazioni → Health Connect → Autorizzazioni '
                  'app → GdAHome.',
              en:
                  '$restano permissions still missing. If the request does '
                  'not show: Settings → Health Connect → App permissions → '
                  'GdAHome.',
            ),
    );
  });

  void _avviso(String testo) {
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)
        ?.showSnackBar(SnackBar(content: Text(testo)));
  }

  @override
  Widget build(BuildContext context) {
    final corpo = _ilCorpo(context);
    if (widget.nuda) return corpo;
    return Scaffold(
      appBar: AppBar(
        title: Text(inLingua(it: 'Salute', en: 'Health')),
      ),
      body: corpo,
    );
  }

  Widget _ilCorpo(BuildContext context) {
    final dove = _dove;
    if (dove == null) return const Center(child: CircularProgressIndicator());
    if (dove == DoveSiLegge.daNessunaParte) {
      return StatoVuoto(
        icona: Icons.monitor_heart_outlined,
        titolo: inLingua(
          it: 'La salute si legge dal telefono',
          en: 'Health is read from the phone',
        ),
        sotto: inLingua(
          it:
              "Apri GdAHome sull'iPhone o sul telefono Android: da lì si "
              'portano a casa le misure dell\'orologio.',
          en:
              'Open GdAHome on your iPhone or Android phone: that is where '
              'your watch readings are brought home.',
        ),
      );
    }
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final scelte = _postino.scelte;
    final lette = _postino.ultimeLette;
    final daInstallare = dove == DoveSiLegge.healthConnectDaInstallare;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Scheda(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Oggetto('salute', lato: 52),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          inLingua(
                            it: 'Le misure del tuo orologio, a casa',
                            en: 'Your watch readings, at home',
                          ),
                          style: testi.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          dove == DoveSiLegge.appleSalute
                              ? inLingua(
                                  it: 'Da Apple Salute: iPhone e Apple Watch.',
                                  en: 'From Apple Health: iPhone and Apple Watch.',
                                )
                              : inLingua(
                                  it:
                                      'Da Health Connect: Galaxy Watch, Pixel Watch, Fitbit, '
                                      'Amazfit e gli altri che ci scrivono.',
                                  en:
                                      'From Health Connect: Galaxy Watch, Pixel Watch, Fitbit, '
                                      'Amazfit and others that write to it.',
                                ),
                          style: testi.bodyMedium?.copyWith(
                            color: colori.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (daInstallare) ...[
                const SizedBox(height: 14),
                Text(
                  inLingua(
                    it: 'Su questo telefono Health Connect manca o va aggiornato.',
                    en: 'Health Connect is missing or needs an update on this phone.',
                  ),
                  style: testi.bodyMedium,
                ),
                const SizedBox(height: 8),
                FilledButton.tonalIcon(
                  onPressed: () =>
                      unawaited(_postino.lettore.installaHealthConnect()),
                  icon: const Icon(Icons.download_rounded),
                  label: Text(
                    inLingua(
                      it: 'Installa Health Connect',
                      en: 'Install Health Connect',
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 10),
              SwitchListTile.adaptive(
                key: const Key('salute-interruttore'),
                contentPadding: EdgeInsets.zero,
                value: scelte.acceso,
                onChanged: _lavorando || daInstallare ? null : _interruttore,
                title: Text(
                  inLingua(
                    it: 'Manda le misure alla casa',
                    en: 'Send readings to your home',
                  ),
                  style: testi.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                subtitle: Text(
                  _quando(scelte, lette.length),
                  style: _rifiutata(scelte)
                      ? TextStyle(color: colori.error)
                      : null,
                ),
              ),
              if (scelte.acceso && _postino.ultimoGuasto != null)
                _ilGuasto(context, _postino.ultimoGuasto!),
              if (scelte.acceso)
                SwitchListTile.adaptive(
                  key: const Key('salute-ad-app-chiusa'),
                  contentPadding: EdgeInsets.zero,
                  value: scelte.adAppChiusa,
                  onChanged: _lavorando ? null : _adAppChiusa,
                  title: Text(
                    inLingua(
                      it: 'Manda anche ad app chiusa',
                      en: 'Also send when the app is closed',
                    ),
                    style: testi.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  subtitle: Text(
                    dove == DoveSiLegge.appleSalute
                        ? inLingua(
                            it:
                                'Quando Salute ha un dato nuovo, l\'iPhone '
                                'sveglia GdAHome e lo manda alla casa. I tempi '
                                'li decide l\'iPhone; a telefono bloccato '
                                'aspetta che lo sblocchi.',
                            en:
                                'When Health has new data, the iPhone wakes '
                                'GdAHome to send it home. The iPhone decides '
                                'when; while locked it waits until you unlock.',
                          )
                        : inLingua(
                            it:
                                'Ogni mezz\'ora circa, quando c\'è la rete. '
                                'Android può rimandare col risparmio '
                                'energetico.',
                            en:
                                'About every half hour, when online. Android '
                                'may delay it to save battery.',
                          ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Insegna(
          inLingua(
            it: 'Come ti chiama la casa',
            en: 'What your home calls you',
          ),
        ),
        Scheda(
          child: TextField(
            key: const Key('salute-nome'),
            controller: _nome,
            maxLength: 30,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _salvaIlNome(),
            onTapOutside: (_) {
              FocusManager.instance.primaryFocus?.unfocus();
              if (personaPulita(_nome.text) != scelte.persona) {
                unawaited(_salvaIlNome());
              }
            },
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.person_outline_rounded),
              hintText: inLingua(it: 'Il tuo nome', en: 'Your name'),
              counterText: '',
              helperText: inLingua(
                it: 'Nella pagina Salute della plancia le tue misure portano questo nome.',
                en: 'On the dashboard Health page your readings carry this name.',
              ),
              helperMaxLines: 2,
            ),
          ),
        ),
        const SizedBox(height: 16),
        Insegna(inLingua(it: 'Cosa mandare', en: 'What to send')),
        Scheda(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            children: [
              for (final misura in MisuraDelCorpo.values)
                if (siPuoLeggere(
                  misura,
                  iPhone:
                      dove != DoveSiLegge.healthConnect &&
                      dove != DoveSiLegge.healthConnectDaInstallare,
                ))
                  CheckboxListTile.adaptive(
                    key: Key('salute-misura-${misura.name}'),
                    value: scelte.misure.contains(misura),
                    onChanged: _lavorando
                        ? null
                        : (si) => _cambiaMisura(misura, si == true),
                    title: Text(misura.titolo),
                    subtitle: _sottoLaMisura(
                      context,
                      misura,
                      lette[misura],
                      manca:
                          scelte.acceso &&
                          _postino.letto &&
                          scelte.misure.contains(misura) &&
                          lette[misura] == null,
                      senzaPermesso:
                          scelte.acceso &&
                          scelte.misure.contains(misura) &&
                          _postino.senzaPermesso.contains(misura),
                      iPhone: dove == DoveSiLegge.appleSalute,
                    ),
                    secondary: _segno(misura),
                  ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (scelte.acceso && _postino.senzaPermesso.isNotEmpty) ...[
          FilledButton.tonalIcon(
            key: const Key('salute-permessi'),
            onPressed: _lavorando ? null : _daiIPermessi,
            icon: const Icon(Icons.health_and_safety_outlined),
            label: Text(
              inLingua(
                it: 'Dai i permessi che mancano',
                en: 'Grant the missing permissions',
              ),
            ),
          ),
          const SizedBox(height: 8),
        ],
        if (scelte.acceso)
          OutlinedButton.icon(
            key: const Key('salute-manda'),
            onPressed: _lavorando ? null : _mandaAdesso,
            icon: const Icon(Icons.sync_rounded),
            label: Text(inLingua(it: 'Manda adesso', en: 'Send now')),
          ),
        const SizedBox(height: 16),
        Scheda(
          colore: colori.primaryContainer.withValues(alpha: .35),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.lock_outline_rounded, color: colori.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  inLingua(
                    it:
                        'Le misure vanno solo alla tua casa, cifrate, e diventano '
                        'sensori del tuo Home Assistant. Non passano da nessun nostro '
                        'server e GdAHome non scrive mai in Salute: legge e basta. '
                        'Spegnendo, la casa le cancella.',
                    en:
                        'Readings go only to your home, encrypted, and become sensors '
                        'in your Home Assistant. They never pass through any server of '
                        'ours and GdAHome never writes to Health: it only reads. Turning '
                        'this off makes your home delete them.',
                  ),
                  style: testi.bodySmall,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /* La casa ha detto di no per un motivo suo: non e' «riprovo fra poco». */
  bool _rifiutata(ScelteDellaSalute scelte) =>
      scelte.acceso &&
      switch (_postino.ultimoGuasto) {
        GuastoDellaSalute.premiumRichiesto ||
        GuastoDellaSalute.telefonoNonIntestato ||
        GuastoDellaSalute.altro => true,
        GuastoDellaSalute.casaNonRisponde || null => false,
      };

  Widget _ilGuasto(BuildContext context, GuastoDellaSalute guasto) {
    final colori = Theme.of(context).colorScheme;
    final grave = guasto != GuastoDellaSalute.casaNonRisponde;
    return Container(
      key: const Key('salute-guasto'),
      margin: const EdgeInsets.only(top: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: (grave ? colori.errorContainer : colori.surfaceContainerHighest)
            .withValues(alpha: .7),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            grave ? Icons.block_rounded : Icons.wifi_off_rounded,
            color: grave ? colori.error : colori.onSurfaceVariant,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              guasto.spiegazione,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: grave
                    ? colori.onErrorContainer
                    : colori.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sottoLaMisura(
    BuildContext context,
    MisuraDelCorpo misura,
    Lettura? lettura, {
    required bool manca,
    required bool iPhone,
    bool senzaPermesso = false,
  }) {
    final riga = Text(_riga(misura, lettura));
    if (!manca && !senzaPermesso) return riga;
    final colori = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        riga,
        const SizedBox(height: 2),
        Text(
          /* Senza il permesso non e' «l'orologio non la misura»: e' che il
           * telefono non la lascia leggere, e si rimedia col tasto sotto. */
          senzaPermesso
              ? inLingua(
                  it: 'Manca il permesso di Health Connect.',
                  en: 'The Health Connect permission is missing.',
                )
              : nessunValore(misura, iPhone: iPhone),
          key: Key(
            senzaPermesso
                ? 'salute-permesso-${misura.name}'
                : 'salute-manca-${misura.name}',
          ),
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: colori.tertiary),
        ),
      ],
    );
  }

  String _quando(ScelteDellaSalute scelte, int quante) {
    if (!scelte.acceso) {
      return inLingua(
        it: 'Spento: la casa non riceve niente.',
        en: 'Off: your home receives nothing.',
      );
    }
    if (_rifiutata(scelte)) {
      return inLingua(
        it: 'Acceso, ma la casa non accetta le misure.',
        en: "On, but your home doesn't accept the readings.",
      );
    }
    final ultimo = scelte.ultimoInvio;
    if (ultimo == null) return inLingua(it: 'Acceso.', en: 'On.');
    final ora =
        '${ultimo.hour.toString().padLeft(2, '0')}:${ultimo.minute.toString().padLeft(2, '0')}';
    if (scelte.ultimoDaChiusa) {
      return inLingua(
        it: 'Acceso · ultimo invio alle $ora, ad app chiusa.',
        en: 'On · last sent at $ora, with the app closed.',
      );
    }
    return scelte.adAppChiusa
        ? inLingua(
            it: 'Acceso · ultimo invio alle $ora, con l\'app aperta.',
            en: 'On · last sent at $ora, with the app open.',
          )
        : inLingua(
            it:
                'Acceso · ultimo invio alle $ora, ogni quarto d\'ora con '
                'l\'app aperta.',
            en: 'On · last sent at $ora, every quarter hour while the app is open.',
          );
  }

  /* I numeri come li scrive chi legge: «7.842» e «78,4» in italiano,
   * «7,842» e «78.4» in inglese. */
  String _numero(double v, {int cifre = 0}) {
    final italiano = inLingua(it: 'it', en: 'en') == 'it';
    final testo = v.toStringAsFixed(cifre);
    final parti = testo.split('.');
    final intera = parti[0].replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+$)'),
      (m) => '${m[1]}${italiano ? '.' : ','}',
    );
    if (parti.length == 1) return intera;
    return '$intera${italiano ? ',' : '.'}${parti[1]}';
  }

  String _riga(MisuraDelCorpo misura, Lettura? lettura) {
    if (lettura == null) return misura.comeSiLegge;
    final v = lettura.valore;
    final valore = switch (misura) {
      MisuraDelCorpo.passi => _numero(v),
      MisuraDelCorpo.battito ||
      MisuraDelCorpo.battitoRiposo => '${_numero(v)} bpm',
      MisuraDelCorpo.peso => '${_numero(v, cifre: 1)} kg',
      MisuraDelCorpo.grasso => '${_numero(v, cifre: 1)}%',
      MisuraDelCorpo.ossigeno => '${_numero(v)}%',
      MisuraDelCorpo.sistolica ||
      MisuraDelCorpo.diastolica => '${_numero(v)} mmHg',
      MisuraDelCorpo.sonno =>
        '${v ~/ 60} h ${(v % 60).round().toString().padLeft(2, '0')}',
      MisuraDelCorpo.calorie ||
      MisuraDelCorpo.calorieRiposo => '${_numero(v)} kcal',
      MisuraDelCorpo.distanza => '${_numero(v, cifre: 2)} km',
      MisuraDelCorpo.piani => inLingua(
        it: '${_numero(v)} piani',
        en: '${_numero(v)} flights',
      ),
      MisuraDelCorpo.esercizio => '${_numero(v)} min',
      MisuraDelCorpo.inPiedi => '${_numero(v)} h',
    };
    final giorno = quandoSeNonOggi(lettura.quando, _postino.adesso);
    return '${misura.comeSiLegge} · $valore${giorno == null ? '' : ' · $giorno'}';
  }

  /* Un'icona colorata per misura: le emoji ogni telefono le disegna a modo
   * suo, e in fila sembrano di sei app diverse. */
  Widget _segno(MisuraDelCorpo misura) {
    final (icona, colore) = switch (misura) {
      MisuraDelCorpo.passi => (
        Icons.directions_walk_rounded,
        const Color(0xFF16A34A),
      ),
      MisuraDelCorpo.battito => (
        Icons.favorite_rounded,
        const Color(0xFFE11D48),
      ),
      MisuraDelCorpo.battitoRiposo => (
        Icons.favorite_border_rounded,
        const Color(0xFFE11D48),
      ),
      MisuraDelCorpo.peso => (
        Icons.monitor_weight_rounded,
        const Color(0xFF0EA5E9),
      ),
      MisuraDelCorpo.grasso => (Icons.percent_rounded, const Color(0xFF0EA5E9)),
      MisuraDelCorpo.sistolica || MisuraDelCorpo.diastolica => (
        Icons.monitor_heart_rounded,
        const Color(0xFF9333EA),
      ),
      MisuraDelCorpo.ossigeno => (Icons.air_rounded, const Color(0xFF0891B2)),
      MisuraDelCorpo.sonno => (Icons.bedtime_rounded, const Color(0xFF4F46E5)),
      MisuraDelCorpo.calorie => (
        Icons.local_fire_department_rounded,
        const Color(0xFFEA580C),
      ),
      MisuraDelCorpo.calorieRiposo => (
        Icons.local_fire_department_outlined,
        const Color(0xFFEA580C),
      ),
      MisuraDelCorpo.distanza => (
        Icons.straighten_rounded,
        const Color(0xFF16A34A),
      ),
      MisuraDelCorpo.piani => (Icons.stairs_rounded, const Color(0xFF16A34A)),
      MisuraDelCorpo.esercizio => (
        Icons.directions_run_rounded,
        const Color(0xFF65A30D),
      ),
      MisuraDelCorpo.inPiedi => (
        Icons.accessibility_new_rounded,
        const Color(0xFF0891B2),
      ),
    };
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: colore.withValues(alpha: .14),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(icona, color: colore, size: 22),
    );
  }
}
