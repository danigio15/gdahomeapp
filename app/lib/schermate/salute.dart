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
    }
  });

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
          ? inLingua(
              it: 'La casa non risponde: riprovo da solo fra poco.',
              en: "Your home isn't answering: I'll retry shortly.",
            )
          : inLingua(
              it: 'Mandate $quante misure alla casa.',
              en: 'Sent $quante readings to your home.',
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
                subtitle: Text(_quando(scelte, lette.length)),
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
                CheckboxListTile.adaptive(
                  key: Key('salute-misura-${misura.name}'),
                  value: scelte.misure.contains(misura),
                  onChanged: _lavorando
                      ? null
                      : (si) => _cambiaMisura(misura, si == true),
                  title: Text(misura.titolo),
                  subtitle: Text(_riga(misura, lette[misura])),
                  secondary: _segno(misura),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
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

  String _quando(ScelteDellaSalute scelte, int quante) {
    if (!scelte.acceso) {
      return inLingua(
        it: 'Spento: la casa non riceve niente.',
        en: 'Off: your home receives nothing.',
      );
    }
    final ultimo = scelte.ultimoInvio;
    if (ultimo == null) return inLingua(it: 'Acceso.', en: 'On.');
    final ora =
        '${ultimo.hour.toString().padLeft(2, '0')}:${ultimo.minute.toString().padLeft(2, '0')}';
    return inLingua(
      it: 'Acceso · ultimo invio alle $ora, ogni quarto d\'ora con l\'app aperta.',
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
      MisuraDelCorpo.grasso || MisuraDelCorpo.ossigeno => '${_numero(v)}%',
      MisuraDelCorpo.sistolica ||
      MisuraDelCorpo.diastolica => '${_numero(v)} mmHg',
      MisuraDelCorpo.sonno =>
        '${v ~/ 60} h ${(v % 60).round().toString().padLeft(2, '0')}',
      MisuraDelCorpo.calorie => '${_numero(v)} kcal',
    };
    return '${misura.comeSiLegge} · $valore';
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
