/// «La tua giornata»: la pagina che si apre dal riepilogo della sera.
///
/// E' il disegno approvato (`completo.png`), dall'alto in basso: la testa col
/// sole di oggi, «In breve» (le tre o quattro cose da sapere, scritte dal
/// ponte), poi Energia (ora per ora, chi ha consumato di piu'), i soldi, la
/// batteria, il clima di casa, l'acqua calda, l'auto e i consumi, la casa,
/// il confronto, domani, e quello che c'e' da sistemare.
///
/// **Ogni sezione c'e' solo se ci sono i suoi numeri**: senza auto niente
/// auto, senza solare termico niente acqua calda. Ogni grafico ha la sua
/// legenda, e i grafici sono disegnati qui (niente librerie, niente
/// immagini): gli stessi colori della scheda della notifica — ambra il sole,
/// azzurro il consumo.
///
/// I numeri li chiede al ponte sul filo (`ponte/energia/giornata`,
/// `notifiche/giornata.dart`): nessun server nuovo, nessun nome di persona.
/// La pagina e' di gdahome Premium: a una casa Base il ponte risponde
/// `premium-richiesto`, e qui si spiega.
library;

import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../notifiche/giornata.dart';
import '../parole.dart';
import '../ponte/errori.dart';
import '../vestito/elettrodomestici.dart';
import '../vestito/oggetti.dart';
import '../vestito/pezzi.dart';
import '../vestito/tema.dart';
import 'premium.dart';

export '../notifiche/giornata.dart' show GiornataDellaCasa;

/// Apre «La tua giornata» sopra quello che c'e'. [casa] e' la casa della
/// notifica: se e' un'altra da quella aperta, ci si sposta.
Future<void> apriLaTuaGiornata(
  BuildContext context, {
  required Collegamento collegamento,
  String? casa,
}) => Navigator.of(context, rootNavigator: true).push<void>(
  MaterialPageRoute(
    builder: (_) =>
        SchermataDellaGiornata(collegamento: collegamento, casa: casa),
  ),
);

class SchermataDellaGiornata extends StatefulWidget {
  const SchermataDellaGiornata({
    super.key,
    this.collegamento,
    this.casa,
    this.chiedi,
  });

  final Collegamento? collegamento;

  /// La casa di cui si vuole la giornata; `null`, quella aperta.
  final String? casa;

  /// Chi chiede la giornata: per le prove. Di serie, il ponte sul filo.
  final Future<GiornataDellaCasa> Function()? chiedi;

  @override
  State<SchermataDellaGiornata> createState() => _StatoDellaGiornata();
}

class _StatoDellaGiornata extends State<SchermataDellaGiornata> {
  GiornataDellaCasa? _giornata;
  Object? _errore;
  bool _inArrivo = true;

  @override
  void initState() {
    super.initState();
    unawaited(_leggi());
  }

  Future<GiornataDellaCasa> _dalPonte() async {
    final collegamento = widget.collegamento;
    if (collegamento == null) {
      throw const FiloCaduto('nessuna casa');
    }
    final casa = widget.casa;
    if (casa != null && collegamento.casa?.id != casa) {
      if (collegamento.archivio.quella(casa) != null) {
        await collegamento.archivio.scegli(casa);
        await collegamento.apri(forza: true);
      }
    }
    /* Il filo puo' essere ancora in piedi a meta': si aspetta un poco, come
     * per i tasti delle notifiche (`postino.dart`). */
    for (var volta = 0; volta < 40; volta += 1) {
      final filo = collegamento.filo;
      if (filo != null && filo.dentro) return chiediLaGiornata(filo);
      await Future<void>.delayed(const Duration(milliseconds: 500));
    }
    throw FiloCaduto(
      inLingua(
        it: 'la casa non risponde: riprova fra poco',
        en: 'the home isn\'t answering: try again shortly',
      ),
    );
  }

  Future<void> _leggi() async {
    setState(() {
      _inArrivo = true;
      _errore = null;
    });
    try {
      final giornata = await (widget.chiedi ?? _dalPonte)();
      if (!mounted) return;
      setState(() {
        _giornata = giornata;
        _inArrivo = false;
      });
    } catch (errore) {
      if (!mounted) return;
      setState(() {
        _errore = errore;
        _inArrivo = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(inLingua(it: 'La tua giornata', en: 'Your day')),
      ),
      body: _ilCorpo(context),
    );
  }

  Widget _ilCorpo(BuildContext context) {
    final giornata = _giornata;
    final errore = _errore;
    if (_inArrivo && giornata == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (errore is PremiumRichiesto) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        children: [
          Scheda(
            padding: const EdgeInsets.all(20),
            child: SpiegazioneDelPremium(
              perche: PerchePremium.giornata,
              apriLaPagina: widget.collegamento == null
                  ? null
                  : () => apriLaPaginaPremium(
                      context,
                      widget.collegamento!,
                      perche: PerchePremium.giornata,
                    ),
            ),
          ),
        ],
      );
    }
    if (errore != null && giornata == null) {
      final vecchio = errore is ComandoRifiutato && errore.codice == 'unknown';
      return StatoVuoto(
        icona: Icons.cloud_off_rounded,
        titolo: inLingua(
          it: 'La giornata non si legge',
          en: 'Your day can\'t be read',
        ),
        sotto: vecchio
            ? inLingua(
                it:
                    'Forse GdAHome in casa è di una versione di prima: '
                    'aggiorna l\'add-on in Home Assistant.',
                en:
                    'Maybe GdAHome at home is an older version: update the '
                    'add-on in Home Assistant.',
              )
            : '$errore',
        azione: FilledButton.icon(
          onPressed: _leggi,
          icon: const Icon(Icons.refresh_rounded),
          label: Text(inLingua(it: 'Riprova', en: 'Try again')),
        ),
      );
    }
    if (giornata == null || giornata.vuota) {
      return StatoVuoto(
        icona: Icons.wb_twilight_rounded,
        titolo: inLingua(
          it: 'Oggi non c\'è ancora niente da raccontare',
          en: 'Nothing to tell about today yet',
        ),
        sotto: inLingua(
          it:
              'La casa conta l\'energia, il clima e il resto man mano che la '
              'giornata va avanti: riprova più tardi.',
          en:
              'The home counts energy, climate and the rest as the day goes '
              'on: try again later.',
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _leggi,
      child: PaginaDellaGiornata(giornata: giornata),
    );
  }
}

/* ─── la pagina ─────────────────────────────────────────────────────────── */

/// I colori della pagina, chiari e scuri. Quelli scuri sono del disegno
/// approvato; quelli chiari ne sono la versione di giorno, coi colori
/// dell'app.
class _Toni {
  const _Toni(this.scuro);
  final bool scuro;

  static _Toni di(BuildContext context) =>
      _Toni(Theme.of(context).brightness == Brightness.dark);

  Color get scheda => scuro ? const Color(0xFF111A2E) : Colors.white;
  Color get bordo => scuro ? const Color(0x0DFFFFFF) : const Color(0x120F172A);
  Color get tessera =>
      scuro ? const Color(0x08FFFFFF) : const Color(0xFFF1F5F9);
  Color get etichetta =>
      scuro ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
  Color get sezione =>
      scuro ? const Color(0xFF64748B) : const Color(0xFF64748B);
  Color get valore => scuro ? Colors.white : const Color(0xFF0F172A);
  Color get testo => scuro ? const Color(0xFFE2E8F0) : const Color(0xFF1E293B);
  Color get secondario =>
      scuro ? const Color(0xFFCBD5E1) : const Color(0xFF475569);
  Color get nome => scuro ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A);
  Color get griglia =>
      scuro ? const Color(0x0FFFFFFF) : const Color(0x120F172A);
  Color get base => scuro ? const Color(0x2EFFFFFF) : const Color(0x330F172A);
  Color get pista => scuro ? const Color(0x10FFFFFF) : const Color(0xFFE2E8F0);
  Color get riga => scuro ? const Color(0x0DFFFFFF) : const Color(0xFFE8EDF3);

  /// Il giallo dei numeri del sole: sul chiaro, ambra scura.
  Color get giallo => scuro ? const Color(0xFFFDE68A) : const Color(0xFFB45309);
  Color get consiglio =>
      scuro ? const Color(0xFFFDE68A) : const Color(0xFF92400E);
  Color get batteriaAuto =>
      scuro ? const Color(0xFFE2E8F0) : const Color(0xFF334155);
  Color get consumo => scuro ? _azzurro : const Color(0xFF0EA5E9);

  List<Color> get testa => scuro
      ? const [Color(0xFF3A2507), Color(0xFF141B2E), Color(0xFF0F172A)]
      : const [Color(0xFFFDE4BC), Color(0xFFFFF5E4), Colors.white];
}

const _sole = Color(0xFFF59E0B);
const _usatoInCasa = Color(0xFFD97706);
const _azzurro = Color(0xFF38BDF8);
const _dallaRete = Color(0xFF0284C7);
const _giallo = Color(0xFFFBBF24);

/// I colori delle stanze, e delle fasce, in ordine.
const _coloriDelleStanze = [
  Color(0xFF3987E5),
  Color(0xFFD95926),
  Color(0xFF199E70),
  Color(0xFFA855F7),
  Color(0xFFE0A100),
  Color(0xFFDB2777),
];
const _fuori = Color(0xFF94A3B8);
const _collettore = Color(0xFFD95926);
const _bollitore = Color(0xFF3987E5);
const _inViaggio = Color(0xFF3987E5);
const _coloriDelleFasce = {
  0: Color(0xFFD95926),
  1: Color(0xFFE0A100),
  2: Color(0xFF3987E5),
};

/// La pagina intera, senza la barra in cima: le sezioni una sotto l'altra.
///
/// Con [tuttaLunga] non scorre ed e' alta quanto serve: per le fotografie.
class PaginaDellaGiornata extends StatelessWidget {
  const PaginaDellaGiornata({
    super.key,
    required this.giornata,
    this.tuttaLunga = false,
  });

  final GiornataDellaCasa giornata;
  final bool tuttaLunga;

  @override
  Widget build(BuildContext context) {
    final g = giornata;
    final e = g.energia;
    final energia = <Widget>[
      if (e != null && (e.prodotta.length > 1 || e.consumata.length > 1))
        _OraPerOra(e, key: const Key('sezione-ora-per-ora')),
      if (g.piu.isNotEmpty)
        _ChiHaConsumato(g, key: const Key('sezione-consumi')),
      if (e != null && (e.euroRete != null || e.risparmio != null))
        _Soldi(g, key: const Key('sezione-soldi')),
      if (g.batteria != null)
        _Batteria(g.batteria!, key: const Key('sezione-batteria')),
    ];
    final clima = <Widget>[
      if (g.clima != null)
        _Temperature(g.clima!, key: const Key('sezione-temperature')),
      if (g.riscaldamento != null)
        _IlRiscaldamento(
          g.riscaldamento!,
          key: const Key('sezione-riscaldamento'),
        ),
    ];
    final acquaCalda = <Widget>[
      if (g.solareTermico != null)
        _IlSolareTermico(
          g.solareTermico!,
          key: const Key('sezione-solare-termico'),
        ),
    ];
    final auto = <Widget>[
      for (final (i, una) in g.auto.indexed)
        _LAuto(una, key: Key('sezione-auto-$i')),
      if (g.acqua != null) _Acqua(g.acqua!, key: const Key('sezione-acqua')),
    ];
    final casa = <Widget>[
      if (g.eventi.isNotEmpty || g.conti != null)
        _LaCasa(g, key: const Key('sezione-casa')),
    ];
    final confronto = _confrontoDi(g);
    final pezzi = <Widget>[
      if (e != null) _LaTesta(g, key: const Key('sezione-testa')),
      if (g.inBreve.isNotEmpty)
        _InBreve(g.inBreve, key: const Key('sezione-in-breve')),
      if (energia.isNotEmpty) ...[
        _Sezione(inLingua(it: 'Energia', en: 'Energy')),
        ...energia,
      ],
      if (clima.isNotEmpty) ...[
        _Sezione(inLingua(it: 'Clima di casa', en: 'Indoor climate')),
        ...clima,
      ],
      if (acquaCalda.isNotEmpty) ...[
        _Sezione(inLingua(it: 'Acqua calda', en: 'Hot water')),
        ...acquaCalda,
      ],
      if (auto.isNotEmpty) ...[
        _Sezione(inLingua(it: 'Auto e consumi', en: 'Car and usage')),
        ...auto,
      ],
      if (casa.isNotEmpty) ...[
        _Sezione(inLingua(it: 'La casa', en: 'The home')),
        ...casa,
      ],
      if (confronto.isNotEmpty)
        _Rispetto(confronto, key: const Key('sezione-confronto')),
      if (g.domani != null)
        _Domani(g.domani!, key: const Key('sezione-domani')),
      if (g.daSistemare.isNotEmpty)
        _DaSistemare(g.daSistemare, key: const Key('sezione-da-sistemare')),
    ];
    const margini = EdgeInsets.fromLTRB(16, 4, 16, 32);
    if (tuttaLunga) {
      return Padding(
        padding: margini,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: pezzi,
        ),
      );
    }
    return ListView(
      padding: margini,
      physics: const AlwaysScrollableScrollPhysics(),
      children: pezzi,
    );
  }
}

/// «Rispetto a»: quello che dice il ponte, o — da un ponte di prima — il sole
/// di ieri e della settimana.
List<(String, String, String)> _confrontoDi(GiornataDellaCasa g) {
  final c = g.confronto;
  final mese = g.energia?.giorno;
  if (c != null && !c.vuoto) {
    return [
      if (c.ieriSolePct case final v?)
        (
          inLingua(it: 'Ieri', en: 'Yesterday'),
          percentoConSegno(v),
          inLingua(it: 'di sole', en: 'of sun'),
        ),
      if (c.settimanaPct case final v?)
        (
          inLingua(it: 'Settimana', en: 'Week'),
          percentoConSegno(v),
          inLingua(it: 'sulla media', en: 'vs average'),
        ),
      if (c.meseRetePct case final v?)
        (
          mese == null ? inLingua(it: 'Mese', en: 'Month') : meseDi(mese),
          percentoConSegno(v),
          inLingua(it: 'di rete', en: 'of grid'),
        ),
    ];
  }
  final oggi = g.conSole ? g.energia?.sole : g.energia?.casa;
  if (oggi == null) return const [];
  final quale = g.conSole
      ? inLingua(it: 'di sole', en: 'of sun')
      : inLingua(it: 'di consumo', en: 'of usage');
  return [
    if (g.ieri case final ieri? when ieri > 0)
      (
        inLingua(it: 'Ieri', en: 'Yesterday'),
        percentoConSegno((oggi - ieri) / ieri * 100),
        quale,
      ),
    if (g.media case final media? when media > 0)
      (
        inLingua(it: 'Settimana', en: 'Week'),
        percentoConSegno((oggi - media) / media * 100),
        inLingua(it: 'sulla media', en: 'vs average'),
      ),
  ];
}

/* ─── i pezzi ───────────────────────────────────────────────────────────── */

/// Il nome di un gruppo di sezioni, piccolo e spaziato.
class _Sezione extends StatelessWidget {
  const _Sezione(this.testo);
  final String testo;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(4, 20, 4, 2),
    child: Text(
      testo.toUpperCase(),
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        letterSpacing: 11 * 0.14,
        color: _Toni.di(context).sezione,
      ),
    ),
  );
}

/// Un riquadro: il titolo in maiuscoletto a sinistra, una riga a destra, e
/// sotto il contenuto.
class _Riquadro extends StatelessWidget {
  const _Riquadro({required this.titolo, this.destra, required this.child});

  final String titolo;
  final Widget? destra;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final toni = _Toni.di(context);
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        color: toni.scheda,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: toni.bordo),
        boxShadow: toni.scuro
            ? null
            : const [
                BoxShadow(
                  color: Color(0x0F0F172A),
                  blurRadius: 12,
                  offset: Offset(0, 3),
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: LayoutBuilder(
              builder: (context, misure) => Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  ConstrainedBox(
                    constraints: BoxConstraints(
                      maxWidth: destra == null
                          ? misure.maxWidth
                          : misure.maxWidth * 0.62,
                    ),
                    child: Text(
                      titolo.toUpperCase(),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 11 * 0.12,
                        color: toni.etichetta,
                      ),
                    ),
                  ),
                  if (destra != null) ...[
                    const SizedBox(width: 10),
                    Expanded(
                      child: Align(
                        alignment: Alignment.centerRight,
                        child: destra!,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

/// La riga a destra del titolo di un riquadro.
class _Destra extends StatelessWidget {
  const _Destra(this.testo);
  final String testo;

  @override
  Widget build(BuildContext context) => Text(
    testo,
    textAlign: TextAlign.right,
    maxLines: 2,
    overflow: TextOverflow.ellipsis,
    style: TextStyle(
      fontSize: 12,
      fontWeight: FontWeight.w700,
      color: _Toni.di(context).secondario,
    ),
  );
}

/// Il titoletto dentro un riquadro: «LA RETE PER FASCIA», «RICARICA · …».
class _Titoletto extends StatelessWidget {
  const _Titoletto(this.testo);
  final String testo;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 12, bottom: 6),
    child: Text(
      testo.toUpperCase(),
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        letterSpacing: 11 * 0.08,
        color: _Toni.di(context).etichetta,
      ),
    ),
  );
}

/// Le tessere coi numeri: due o tre per riga, tutte alte uguali.
class _Tessere extends StatelessWidget {
  const _Tessere(this.voci, {this.perRiga = 3});

  /// `(etichetta, valore, sotto)`.
  final List<(String, String, String?)> voci;
  final int perRiga;

  @override
  Widget build(BuildContext context) {
    final toni = _Toni.di(context);
    Widget una((String, String, String?) voce) {
      final (etichetta, valore, sotto) = voce;
      return Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        decoration: BoxDecoration(
          color: toni.tessera,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                etichetta.toUpperCase(),
                maxLines: 1,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 10.5 * 0.08,
                  color: toni.etichetta,
                ),
              ),
            ),
            const SizedBox(height: 2),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                valore,
                style: TextStyle(
                  fontFamily: 'Oswald',
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  height: 1.25,
                  color: toni.valore,
                ),
              ),
            ),
            if (sotto != null)
              Text(
                sotto,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  height: 1.3,
                  color: toni.secondario,
                ),
              ),
          ],
        ),
      );
    }

    final righe = <Widget>[];
    for (var i = 0; i < voci.length; i += perRiga) {
      final queste = voci.skip(i).take(perRiga).toList();
      righe.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var j = 0; j < perRiga; j += 1) ...[
                if (j > 0) const SizedBox(width: 8),
                Expanded(
                  child: j < queste.length
                      ? una(queste[j])
                      : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        ),
      );
    }
    return Column(
      children: [
        for (final (i, riga) in righe.indexed) ...[
          if (i > 0) const SizedBox(height: 8),
          riga,
        ],
      ],
    );
  }
}

/// La legenda di un grafico: quadratini e parole.
class _Legenda extends StatelessWidget {
  const _Legenda(this.voci, {this.sopra = 0});

  final List<(Color, String)> voci;
  final double sopra;

  @override
  Widget build(BuildContext context) {
    final toni = _Toni.di(context);
    return Padding(
      padding: EdgeInsets.only(top: sopra),
      child: Wrap(
        spacing: 14,
        runSpacing: 4,
        children: [
          for (final (colore, testo) in voci)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 9,
                  height: 9,
                  decoration: BoxDecoration(
                    color: colore,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
                const SizedBox(width: 5),
                Text(
                  testo,
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: toni.secondario,
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

/// Un testo con `**grassetto**` segnato cosi'.
TextSpan _conGrassetto(String testo, TextStyle stile, Color forte) {
  final pezzi = testo.split('**');
  return TextSpan(
    style: stile,
    children: [
      for (final (i, pezzo) in pezzi.indexed)
        if (pezzo.isNotEmpty)
          TextSpan(
            text: pezzo,
            style: i.isOdd
                ? TextStyle(fontWeight: FontWeight.w700, color: forte)
                : null,
          ),
    ],
  );
}

/// Il disegno per un'icona detta dal ponte: un nome o un'emoji.
String _disegnoPer(String icona) {
  final chiave = icona.trim().toLowerCase();
  return switch (chiave) {
    'sole' || '☀️' || '☀' || 'solare' => 'solare',
    'clima' || 'temperatura' || '🌡️' || '🌡' => 'temperatura',
    'acqua' || 'acqua calda' || '🚿' || 'scaldabagno' => 'scaldabagno',
    'energia' || '⚡' || 'corrente' => 'energia',
    'batteria' || '🔋' || 'batterie' => 'batterie',
    'auto' || '🚗' || 'ev' => 'ev',
    'aggiornamento' || '⬆️' || 'aggiornamenti' => 'aggiornamenti',
    'offline' || 'spento' => 'avvisi',
    'irrigazione' || '💧' => 'irrigazione',
    'sicurezza' || 'antifurto' || '🔒' => 'sicurezza',
    _ when disegniDegliOggetti.contains(chiave) => chiave,
    _ => 'evidenza',
  };
}

/* ─── la testa ──────────────────────────────────────────────────────────── */

class _LaTesta extends StatelessWidget {
  const _LaTesta(this.g, {super.key});
  final GiornataDellaCasa g;

  @override
  Widget build(BuildContext context) {
    final toni = _Toni.di(context);
    final e = g.energia!;
    final conSole = g.conSole && e.sole != null;
    final grande = conSole ? e.sole : (e.casa ?? e.presi);
    final quota = conSole ? e.quotaInCasa : null;
    final giorno = e.giorno;
    final record = switch (g.record) {
      'mese' when giorno != null => inLingua(
        it: 'Il giorno più solare di ${meseDi(giorno)}',
        en: 'The sunniest day of ${meseDi(giorno)}',
      ),
      'anno' => inLingua(
        it: 'Il giorno più solare dell\'anno',
        en: 'The sunniest day of the year',
      ),
      _ => null,
    };
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: toni.scuro ? const Color(0x12FFFFFF) : const Color(0x1AB45309),
        ),
        gradient: RadialGradient(
          center: Alignment.topLeft,
          radius: 1.4,
          colors: toni.testa,
          stops: const [0, 0.55, 1],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (giorno != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                giornoDetto(giorno).toUpperCase(),
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 10.5 * 0.12,
                  color: toni.etichetta,
                ),
              ),
            ),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (grande != null)
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              decimaleDetto(grande, grande >= 100 ? 0 : 1),
                              style: TextStyle(
                                fontFamily: 'Oswald',
                                fontSize: 60,
                                fontWeight: FontWeight.w700,
                                height: 0.95,
                                color: toni.giallo,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              conSole
                                  ? inLingua(
                                      it: 'kWh dal sole',
                                      en: 'kWh from the sun',
                                    )
                                  : inLingua(
                                      it: 'kWh in casa',
                                      en: 'kWh at home',
                                    ),
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: toni.testo,
                              ),
                            ),
                          ],
                        ),
                      ),
                    if (record != null) ...[
                      const SizedBox(height: 10),
                      _Coppa(record),
                    ],
                  ],
                ),
              ),
              if (quota != null) ...[const SizedBox(width: 12), _Anello(quota)],
            ],
          ),
        ],
      ),
    );
  }
}

/// La pillola gialla del record.
class _Coppa extends StatelessWidget {
  const _Coppa(this.testo);
  final String testo;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(8, 4, 10, 4),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(999),
      gradient: const LinearGradient(
        colors: [Color(0xFFFDE68A), Color(0xFFF59E0B)],
      ),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(
          Icons.emoji_events_rounded,
          size: 13,
          color: Color(0xFF422006),
        ),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            testo,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: Color(0xFF422006),
            ),
          ),
        ),
      ],
    ),
  );
}

/// L'anello del sole rimasto in casa.
class _Anello extends StatelessWidget {
  const _Anello(this.quota);
  final double quota;

  @override
  Widget build(BuildContext context) {
    final toni = _Toni.di(context);
    return SizedBox(
      width: 104,
      height: 104,
      child: CustomPaint(
        painter: _DisegnoDellAnello(quota, toni.scuro),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${(quota * 100).round()}%',
                style: TextStyle(
                  fontFamily: 'Oswald',
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  height: 1,
                  color: toni.valore,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                inLingua(it: 'DEL SOLE\nIN CASA', en: 'OF SUN\nAT HOME'),
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w800,
                  height: 1.15,
                  letterSpacing: 9.5 * 0.06,
                  color: toni.etichetta,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DisegnoDellAnello extends CustomPainter {
  const _DisegnoDellAnello(this.quota, this.scuro);
  final double quota;
  final bool scuro;

  @override
  void paint(Canvas canvas, Size size) {
    /* Il disegno: 112 di lato, raggio 46, tratto 10. */
    final k = size.width / 112;
    final centro = size.center(Offset.zero);
    final raggio = 46 * k;
    canvas.drawCircle(
      centro,
      raggio,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 10 * k
        ..color = scuro ? const Color(0x14FFFFFF) : const Color(0x1A0F172A),
    );
    canvas.drawArc(
      Rect.fromCircle(center: centro, radius: raggio),
      -math.pi / 2,
      2 * math.pi * quota.clamp(0, 1),
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 10 * k
        ..strokeCap = StrokeCap.round
        ..color = _sole,
    );
  }

  @override
  bool shouldRepaint(_DisegnoDellAnello prima) =>
      prima.quota != quota || prima.scuro != scuro;
}

/* ─── in breve ──────────────────────────────────────────────────────────── */

class _InBreve extends StatelessWidget {
  const _InBreve(this.righe, {super.key});
  final List<Riga> righe;

  @override
  Widget build(BuildContext context) {
    final toni = _Toni.di(context);
    return _Riquadro(
      titolo: inLingua(it: 'In breve', en: 'In short'),
      child: Column(
        children: [
          for (final (i, riga) in righe.indexed)
            Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 22,
                    child: Padding(
                      padding: const EdgeInsets.only(top: 1),
                      child: Oggetto(_disegnoPer(riga.icona), lato: 17),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text.rich(
                      _conGrassetto(
                        riga.testo,
                        TextStyle(
                          fontSize: 13,
                          height: 1.45,
                          fontWeight: FontWeight.w500,
                          color: toni.testo,
                        ),
                        toni.valore,
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

/* ─── energia ───────────────────────────────────────────────────────────── */

class _OraPerOra extends StatelessWidget {
  const _OraPerOra(this.e, {super.key});
  final EnergiaDelGiorno e;

  @override
  Widget build(BuildContext context) {
    final toni = _Toni.di(context);
    final conSole = e.prodotta.any((v) => v > 0);
    final picco = e.picco;
    return _Riquadro(
      titolo: inLingua(it: 'Ora per ora', en: 'Hour by hour'),
      destra: picco == null || !conSole
          ? null
          : _Destra(
              e.piccoIl == null
                  ? inLingua(
                      it: 'picco ${decimaleDetto(picco, 1)} kW',
                      en: 'peak ${decimaleDetto(picco, 1)} kW',
                    )
                  : inLingua(
                      it:
                          'picco ${decimaleDetto(picco, 1)} kW alle '
                          '${e.piccoIl}',
                      en:
                          'peak ${decimaleDetto(picco, 1)} kW at '
                          '${e.piccoIl}',
                    ),
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Legenda([
            if (conSole) ...[
              (_sole.withValues(alpha: 0.55), inLingua(it: 'Sole', en: 'Sun')),
              (_usatoInCasa, inLingua(it: 'Usato in casa', en: 'Used at home')),
            ],
            (toni.consumo, inLingua(it: 'Consumo', en: 'Consumption')),
          ]),
          const SizedBox(height: 8),
          SizedBox(
            height: 170,
            child: CustomPaint(
              painter: _DisegnoOraPerOra(
                prodotta: conSole ? e.prodotta : const [],
                consumata: e.consumata,
                picco: conSole ? picco : null,
                piccoIl: e.piccoIl,
                toni: toni,
                carattere: DefaultTextStyle.of(context).style.fontFamily,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Le ore sotto un grafico: 00, 06, 12, 18, 24.
void _leOre(
  Canvas canvas,
  double sinistra,
  double larga,
  double base,
  Color colore,
) {
  for (final ora in const [0, 6, 12, 18, 24]) {
    final scritta = TextPainter(
      text: TextSpan(
        text: ora.toString().padLeft(2, '0'),
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 10.5,
          fontWeight: FontWeight.w600,
          color: colore,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final x = sinistra + ora * larga / 24;
    final dx = switch (ora) {
      0 => x,
      24 => x - scritta.width,
      _ => x - scritta.width / 2,
    };
    scritta.paint(
      canvas,
      Offset(
        dx,
        base - scritta.computeDistanceToActualBaseline(TextBaseline.alphabetic),
      ),
    );
    scritta.dispose();
  }
}

/// Un testo piccolo a destra del grafico: i gradi, le percentuali.
void _aDestra(Canvas canvas, String testo, Offset dove, Color colore) {
  final scritta = TextPainter(
    text: TextSpan(
      text: testo,
      style: TextStyle(
        fontFamily: 'Inter',
        fontSize: 10.5,
        fontWeight: FontWeight.w600,
        color: colore,
      ),
    ),
    textDirection: TextDirection.ltr,
  )..layout();
  scritta.paint(canvas, Offset(dove.dx, dove.dy - scritta.height / 2));
  scritta.dispose();
}

Offset _punto(
  int i,
  int quanti,
  double valore,
  Rect piano,
  double lo,
  double hi,
) => Offset(
  piano.left + (quanti <= 1 ? 0 : i * piano.width / (quanti - 1)),
  piano.bottom - ((valore - lo) / (hi - lo)).clamp(0, 1) * piano.height,
);

Path _lineaDi(List<double?> valori, Rect piano, double lo, double hi) {
  final strada = Path();
  var dentro = false;
  for (var i = 0; i < valori.length; i += 1) {
    final v = valori[i];
    if (v == null) {
      dentro = false;
      continue;
    }
    final p = _punto(i, valori.length, v, piano, lo, hi);
    if (dentro) {
      strada.lineTo(p.dx, p.dy);
    } else {
      strada.moveTo(p.dx, p.dy);
      dentro = true;
    }
  }
  return strada;
}

Path _areaDi(List<double> valori, Rect piano, double hi) {
  final strada = Path()..moveTo(piano.left, piano.bottom);
  for (var i = 0; i < valori.length; i += 1) {
    final p = _punto(i, valori.length, valori[i], piano, 0, hi);
    strada.lineTo(p.dx, p.dy);
  }
  strada
    ..lineTo(piano.right, piano.bottom)
    ..close();
  return strada;
}

class _DisegnoOraPerOra extends CustomPainter {
  const _DisegnoOraPerOra({
    required this.prodotta,
    required this.consumata,
    required this.picco,
    required this.piccoIl,
    required this.toni,
    this.carattere,
  });

  final List<double> prodotta;
  final List<double> consumata;
  final double? picco;
  final String? piccoIl;
  final _Toni toni;
  final String? carattere;

  @override
  void paint(Canvas canvas, Size size) {
    /* Il disegno: 340×170, la base a 148, cinque righe ogni 27,4, le ore a
     * 166. */
    final y = size.height / 170;
    final base = 148 * y;
    final piano = Rect.fromLTRB(0, 0, size.width, base);
    final sottile = Paint()
      ..color = toni.griglia
      ..strokeWidth = 1;
    for (var riga = 1; riga <= 5; riga += 1) {
      final quota = base - riga * 27.4 * y;
      canvas.drawLine(Offset(0, quota), Offset(size.width, quota), sottile);
    }
    canvas.drawLine(
      Offset(0, base),
      Offset(size.width, base),
      Paint()
        ..color = toni.base
        ..strokeWidth = 1,
    );
    final tutti = [...prodotta, ...consumata];
    if (tutti.length > 1) {
      final hi = math.max(tutti.reduce(math.max), 0.1) * 1.1;
      if (prodotta.length > 1) {
        canvas.drawPath(
          _areaDi(prodotta, piano, hi),
          Paint()
            ..shader = ui.Gradient.linear(piano.topCenter, piano.bottomCenter, [
              _usatoInCasa.withValues(alpha: 0.55),
              _usatoInCasa.withValues(alpha: 0.08),
            ]),
        );
        canvas.drawPath(
          _lineaDi(prodotta, piano, 0, hi),
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2
            ..strokeJoin = StrokeJoin.round
            ..color = _sole,
        );
        canvas.drawPath(
          _areaDi(
            [
              for (var i = 0; i < prodotta.length; i += 1)
                i < consumata.length ? math.min(prodotta[i], consumata[i]) : 0,
            ],
            piano,
            hi,
          ),
          Paint()..color = _usatoInCasa,
        );
      }
      if (consumata.length > 1) {
        canvas.drawPath(
          _lineaDi(consumata, piano, 0, hi),
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.2
            ..strokeJoin = StrokeJoin.round
            ..color = toni.consumo,
        );
      }
      if (picco != null && prodotta.length > 1) {
        final alto = prodotta.reduce(math.max);
        final i = prodotta.indexOf(alto);
        final p = _punto(i, prodotta.length, alto, piano, 0, hi);
        canvas.drawCircle(p, 4.5, Paint()..color = toni.scheda);
        canvas.drawCircle(
          p,
          4.5,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.4
            ..color = _giallo,
        );
        final scritta = TextPainter(
          text: TextSpan(
            text:
                '${decimaleDetto(picco!, 1)} kW'
                '${piccoIl == null ? '' : ' · $piccoIl'}',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: toni.giallo,
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout();
        var x = p.dx + 8;
        if (x + scritta.width > size.width) x = p.dx - 8 - scritta.width;
        final sopra =
            p.dy -
            6 -
            scritta.computeDistanceToActualBaseline(TextBaseline.alphabetic);
        scritta.paint(canvas, Offset(x, math.max(sopra, -6)));
        scritta.dispose();
      }
    }
    _leOre(canvas, 0, size.width, 166 * y, toni.etichetta);
  }

  @override
  bool shouldRepaint(_DisegnoOraPerOra prima) =>
      prima.prodotta != prodotta ||
      prima.consumata != consumata ||
      prima.toni.scuro != toni.scuro;
}

class _ChiHaConsumato extends StatelessWidget {
  const _ChiHaConsumato(this.g, {super.key});
  final GiornataDellaCasa g;

  @override
  Widget build(BuildContext context) {
    final toni = _Toni.di(context);
    final massimo = g.piu.map((c) => c.kwh).reduce(math.max);
    final casa = g.energia?.casa;
    String qualeSole(double? sole) {
      if (sole == null) return '';
      if (sole >= 0.99) return inLingua(it: 'tutto col sole', en: 'all sun');
      if (sole <= 0.01) return inLingua(it: 'dalla rete', en: 'from the grid');
      return inLingua(
        it: '${(sole * 100).round()}% sole',
        en: '${(sole * 100).round()}% sun',
      );
    }

    return _Riquadro(
      titolo: inLingua(it: 'Chi ha consumato di più', en: 'Who used the most'),
      destra: casa == null
          ? null
          : _Destra(
              inLingua(
                it: '${decimaleDetto(casa, 1)} kWh in casa',
                en: '${decimaleDetto(casa, 1)} kWh at home',
              ),
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, uno) in g.piu.indexed)
            Container(
              padding: EdgeInsets.only(top: i == 0 ? 2 : 10, bottom: 10),
              decoration: BoxDecoration(
                border: i == 0
                    ? null
                    : Border(top: BorderSide(color: toni.riga)),
              ),
              child: Row(
                children: [
                  SizedBox(
                    width: 28,
                    child: Elettrodomestico(
                      tipoDellElettrodomestico(uno.nome),
                      lato: 26,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text.rich(
                          TextSpan(
                            text: uno.nome,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: toni.nome,
                            ),
                            children: [
                              if (qualeSole(uno.sole).isNotEmpty)
                                TextSpan(
                                  text: '  ${qualeSole(uno.sole)}',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: toni.etichetta,
                                  ),
                                ),
                            ],
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 6),
                        _Barra(
                          parte: massimo <= 0 ? 0 : uno.kwh / massimo,
                          sole: uno.sole ?? 0,
                          pista: toni.pista,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(
                    width: 74,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerRight,
                          child: Text(
                            '${decimaleDetto(uno.kwh, 2)} kWh',
                            style: TextStyle(
                              fontFamily: 'Oswald',
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              height: 1.1,
                              color: toni.valore,
                            ),
                          ),
                        ),
                        if (uno.euro != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              euroDetto(uno.euro!),
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w600,
                                color: toni.etichetta,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          _Legenda([
            (_usatoInCasa, inLingua(it: 'dal sole', en: 'from the sun')),
            (_dallaRete, inLingua(it: 'dalla rete', en: 'from the grid')),
          ], sopra: 0),
        ],
      ),
    );
  }
}

/// La barra di un consumatore: lunga quanto ha consumato rispetto al primo,
/// divisa fra sole e rete.
class _Barra extends StatelessWidget {
  const _Barra({required this.parte, required this.sole, required this.pista});
  final double parte;
  final double sole;
  final Color pista;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 8,
    child: DecoratedBox(
      decoration: BoxDecoration(
        color: pista,
        borderRadius: BorderRadius.circular(4),
      ),
      child: FractionallySizedBox(
        alignment: Alignment.centerLeft,
        widthFactor: parte.clamp(0.02, 1),
        child: LayoutBuilder(
          builder: (context, misure) {
            final quota = sole.clamp(0.0, 1.0);
            final dalSole = misure.maxWidth * quota;
            final staccate = quota > 0.01 && quota < 0.99;
            return Row(
              children: [
                if (quota > 0.01)
                  _pezzo(
                    staccate ? math.max(dalSole - 1, 1) : misure.maxWidth,
                    _usatoInCasa,
                  ),
                if (staccate) const SizedBox(width: 2),
                if (quota < 0.99)
                  Expanded(child: _pezzo(double.infinity, _dallaRete)),
              ],
            );
          },
        ),
      ),
    ),
  );

  Widget _pezzo(double larga, Color colore) => Container(
    width: larga == double.infinity ? null : larga,
    decoration: BoxDecoration(
      color: colore,
      borderRadius: BorderRadius.circular(4),
    ),
  );
}

class _Soldi extends StatelessWidget {
  const _Soldi(this.g, {super.key});
  final GiornataDellaCasa g;

  @override
  Widget build(BuildContext context) {
    final toni = _Toni.di(context);
    final e = g.energia!;
    final giorno = e.giorno;
    final mese = g.meseEuro;
    final fasce = e.perFascia.entries.where((f) => f.value > 0).toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    final totale = fasce.fold<double>(0, (p, f) => p + f.value);
    final conPrezzi =
        fasce.isNotEmpty && fasce.every((f) => g.fasce.prezzi[f.key] != null);
    String nome(int i) => g.fasce.nomi[i] ?? 'F${i + 1}';
    Color colore(int i) =>
        _coloriDelleFasce[i] ??
        _coloriDelleStanze[i % _coloriDelleStanze.length];
    final cella = TextStyle(
      fontSize: 12.5,
      fontWeight: FontWeight.w600,
      color: toni.testo,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    final testata = TextStyle(
      fontSize: 10,
      fontWeight: FontWeight.w800,
      letterSpacing: 0.8,
      color: toni.etichetta,
    );
    return _Riquadro(
      titolo: inLingua(it: 'Soldi', en: 'Money'),
      destra: mese == null || giorno == null
          ? null
          : _Destra(
              inLingua(
                it: '${meseDi(giorno)}: ${euroDetto(mese)} finora',
                en: '${meseDi(giorno)}: ${euroDetto(mese)} so far',
              ),
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Tessere([
            if (e.euroRete != null)
              (
                inLingua(it: 'Rete', en: 'Grid'),
                euroDetto(e.euroRete!),
                e.presi == null ? null : '${decimaleDetto(e.presi!, 1)} kWh',
              ),
            if (e.ceduti != null && e.ceduti! > 0)
              e.euroCeduti != null
                  ? (
                      inLingua(it: 'Ceduti', en: 'Exported'),
                      '+${euroDetto(e.euroCeduti!)}',
                      '${decimaleDetto(e.ceduti!, 1)} kWh',
                    )
                  : (
                      inLingua(it: 'Ceduti', en: 'Exported'),
                      '${decimaleDetto(e.ceduti!, 1)} kWh',
                      inLingua(it: 'alla rete', en: 'to the grid'),
                    ),
            if (e.risparmio != null)
              (
                inLingua(it: 'Risparmiati', en: 'Saved'),
                euroDetto(e.risparmio!),
                inLingua(it: 'col sole', en: 'with the sun'),
              ),
          ]),
          if (fasce.isNotEmpty && totale > 0) ...[
            _Titoletto(inLingua(it: 'La rete per fascia', en: 'Grid by band')),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: SizedBox(
                height: 12,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final (i, f) in fasce.indexed) ...[
                      if (i > 0) const SizedBox(width: 2),
                      Expanded(
                        flex: math.max(1, (f.value / totale * 1000).round()),
                        child: ColoredBox(color: colore(f.key)),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Table(
              columnWidths: {
                0: const FlexColumnWidth(2.2),
                1: const FlexColumnWidth(),
                if (conPrezzi) 2: const FlexColumnWidth(1.2),
                if (conPrezzi) 3: const FlexColumnWidth(1.2),
              },
              children: [
                TableRow(
                  children: [
                    Text(
                      inLingua(it: 'FASCIA', en: 'BAND'),
                      style: testata,
                    ),
                    Text('KWH', style: testata, textAlign: TextAlign.right),
                    if (conPrezzi) ...[
                      Text('€/KWH', style: testata, textAlign: TextAlign.right),
                      Text(
                        inLingua(it: 'COSTO', en: 'COST'),
                        style: testata,
                        textAlign: TextAlign.right,
                      ),
                    ],
                  ],
                ),
                for (final f in fasce)
                  TableRow(
                    decoration: BoxDecoration(
                      border: Border(top: BorderSide(color: toni.riga)),
                    ),
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 7),
                        child: Row(
                          children: [
                            Container(
                              width: 9,
                              height: 9,
                              decoration: BoxDecoration(
                                color: colore(f.key),
                                borderRadius: BorderRadius.circular(3),
                              ),
                            ),
                            const SizedBox(width: 7),
                            Flexible(
                              child: Text(
                                nome(f.key),
                                style: cella,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 7),
                        child: Text(
                          decimaleDetto(f.value, 1),
                          style: cella,
                          textAlign: TextAlign.right,
                        ),
                      ),
                      if (conPrezzi) ...[
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 7),
                          child: Text(
                            decimaleDetto(g.fasce.prezzi[f.key]!, 3),
                            style: cella,
                            textAlign: TextAlign.right,
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 7),
                          child: Text(
                            euroDetto(f.value * g.fasce.prezzi[f.key]!),
                            style: cella,
                            textAlign: TextAlign.right,
                          ),
                        ),
                      ],
                    ],
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Batteria extends StatelessWidget {
  const _Batteria(this.b, {super.key});
  final BatteriaDiCasa b;

  @override
  Widget build(BuildContext context) {
    String percento(double v) => '${v.round()}%';
    final dalSole = b.caricataDalSole;
    return _Riquadro(
      titolo: inLingua(it: 'Batteria di casa', en: 'Home battery'),
      destra: b.capacita == null
          ? null
          : _Destra(
              '${decimaleDetto(b.capacita!, b.capacita! % 1 == 0 ? 0 : 1)} kWh',
            ),
      child: _Tessere(perRiga: 2, [
        if (b.caricata != null)
          (
            inLingua(it: 'Caricata', en: 'Charged'),
            '${decimaleDetto(b.caricata!, 1)} kWh',
            dalSole == null
                ? null
                : dalSole >= 0.99
                ? inLingua(it: 'tutta dal sole', en: 'all from the sun')
                : inLingua(
                    it: '${(dalSole * 100).round()}% dal sole',
                    en: '${(dalSole * 100).round()}% from the sun',
                  ),
          ),
        if (b.usata != null)
          (
            inLingua(it: 'Usata', en: 'Used'),
            '${decimaleDetto(b.usata!, 1)} kWh',
            inLingua(it: 'dalla casa', en: 'by the home'),
          ),
        if (b.massimo != null)
          (
            inLingua(it: 'Massimo', en: 'Peak'),
            percento(b.massimo!),
            b.massimoAlle == null
                ? null
                : inLingua(
                    it: 'alle ${b.massimoAlle}',
                    en: 'at ${b.massimoAlle}',
                  ),
          ),
        if (b.stasera != null)
          (
            inLingua(it: 'Stasera', en: 'Tonight'),
            percento(b.stasera!),
            inLingua(it: 'per la notte', en: 'for the night'),
          ),
      ]),
    );
  }
}

/* ─── clima ─────────────────────────────────────────────────────────────── */

/// Le tacche di un asse: due o tre numeri tondi dentro [lo, hi].
List<double> _tacche(double lo, double hi) {
  for (final passo in const [
    1.0,
    2.0,
    5.0,
    10.0,
    15.0,
    20.0,
    25.0,
    30.0,
    50.0,
  ]) {
    final prima = (lo / passo).ceil() * passo;
    final quante = ((hi - prima) / passo).floor() + 1;
    if (quante <= 3) {
      return [for (var i = 0; i < quante; i += 1) prima + i * passo];
    }
  }
  return [lo, hi];
}

/// Un grafico a linee ora per ora, con le tacche a destra.
class _DisegnoALinee extends CustomPainter {
  const _DisegnoALinee({
    required this.linee,
    required this.toni,
    this.fascia,
    this.scrittaDellaFascia,
  });

  /// `(valori, colore, tratteggiata)`.
  final List<(List<double?>, Color, bool)> linee;
  final _Toni toni;

  /// Una fascia d'ore da evidenziare (da, a), in ore decimali.
  final (double, double)? fascia;
  final String? scrittaDellaFascia;

  @override
  void paint(Canvas canvas, Size size) {
    const destra = 26.0;
    final piano = Rect.fromLTRB(0, 6, size.width - destra, size.height - 18);
    final tutti = [
      for (final (valori, _, _) in linee)
        for (final v in valori)
          if (v != null) v,
    ];
    if (tutti.isEmpty) return;
    var lo = tutti.reduce(math.min);
    var hi = tutti.reduce(math.max);
    final margine = math.max((hi - lo) * 0.12, 1.0);
    lo -= margine;
    hi += margine;
    if (fascia case (final da, final a)) {
      final x0 = piano.left + da / 24 * piano.width;
      final x1 = piano.left + a / 24 * piano.width;
      canvas.drawRect(
        Rect.fromLTRB(x0, 0, x1, piano.bottom),
        Paint()..color = _giallo.withValues(alpha: toni.scuro ? 0.07 : 0.12),
      );
      if (scrittaDellaFascia != null) {
        final scritta = TextPainter(
          text: TextSpan(
            text: scrittaDellaFascia,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: toni.scuro
                  ? const Color(0xFFFCD34D)
                  : const Color(0xFFB45309),
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout(maxWidth: piano.width);
        final x = math.min(x0 + 4, piano.right - scritta.width);
        scritta.paint(canvas, Offset(x, 1));
        scritta.dispose();
      }
    }
    final sottile = Paint()
      ..color = toni.griglia
      ..strokeWidth = 1;
    for (final tacca in _tacche(lo, hi)) {
      final y = piano.bottom - (tacca - lo) / (hi - lo) * piano.height;
      canvas.drawLine(Offset(0, y), Offset(piano.right, y), sottile);
      _aDestra(
        canvas,
        '${tacca.round()}°',
        Offset(piano.right + 4, y),
        toni.etichetta,
      );
    }
    /* Prima le tratteggiate, che stanno sotto. */
    for (final (valori, colore, tratteggiata) in [
      ...linee.where((l) => l.$3),
      ...linee.where((l) => !l.$3),
    ]) {
      final pennello = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeJoin = StrokeJoin.round
        ..color = colore;
      final strada = _lineaDi(valori, piano, lo, hi);
      if (!tratteggiata) {
        canvas.drawPath(strada, pennello);
        continue;
      }
      for (final pezzo in strada.computeMetrics()) {
        for (var d = 0.0; d < pezzo.length; d += 8) {
          canvas.drawPath(pezzo.extractPath(d, d + 4), pennello);
        }
      }
    }
    _leOre(canvas, 0, piano.width, size.height - 3, toni.etichetta);
  }

  @override
  bool shouldRepaint(_DisegnoALinee prima) =>
      prima.linee != linee || prima.toni.scuro != toni.scuro;
}

class _Temperature extends StatelessWidget {
  const _Temperature(this.c, {super.key});
  final ClimaDiCasa c;

  @override
  Widget build(BuildContext context) {
    final toni = _Toni.di(context);
    String gradi(double? v) => v == null ? '–' : '${decimaleDetto(v, 1)}°';
    final conUmidita = c.stanze.any((s) => s.umidita != null);
    final cella = TextStyle(
      fontSize: 12.5,
      fontWeight: FontWeight.w600,
      color: toni.testo,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    final testata = TextStyle(
      fontSize: 10,
      fontWeight: FontWeight.w800,
      letterSpacing: 0.8,
      color: toni.etichetta,
    );
    Widget aDestra(String testo, TextStyle stile) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Text(testo, style: stile, textAlign: TextAlign.right),
    );
    final conLinee =
        c.stanze.any((s) => s.ore.whereType<double>().length > 1) ||
        c.fuori.whereType<double>().length > 1;
    return _Riquadro(
      titolo: inLingua(it: 'Temperature', en: 'Temperatures'),
      destra: c.fuoriMin == null || c.fuoriMax == null
          ? null
          : _Destra(
              inLingua(
                it: 'fuori ${gradi(c.fuoriMin)} → ${gradi(c.fuoriMax)}',
                en: 'outside ${gradi(c.fuoriMin)} → ${gradi(c.fuoriMax)}',
              ),
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (conLinee) ...[
            _Legenda([
              for (final (i, s) in c.stanze.indexed)
                (_coloriDelleStanze[i % _coloriDelleStanze.length], s.nome),
              if (c.fuori.whereType<double>().length > 1)
                (_fuori, inLingua(it: 'Fuori', en: 'Outside')),
            ]),
            const SizedBox(height: 6),
            SizedBox(
              height: 150,
              child: CustomPaint(
                painter: _DisegnoALinee(
                  toni: toni,
                  linee: [
                    for (final (i, s) in c.stanze.indexed)
                      (
                        s.ore,
                        _coloriDelleStanze[i % _coloriDelleStanze.length],
                        false,
                      ),
                    if (c.fuori.whereType<double>().length > 1)
                      (c.fuori, _fuori, true),
                  ],
                ),
              ),
            ),
          ],
          if (c.stanze.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Table(
                columnWidths: {
                  0: const FlexColumnWidth(2.2),
                  1: const FlexColumnWidth(),
                  2: const FlexColumnWidth(1.1),
                  3: const FlexColumnWidth(),
                  if (conUmidita) 4: const FlexColumnWidth(1.3),
                },
                children: [
                  TableRow(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Text(
                          inLingua(it: 'STANZA', en: 'ROOM'),
                          style: testata,
                        ),
                      ),
                      aDestra('MIN', testata),
                      aDestra(inLingua(it: 'MEDIA', en: 'AVG'), testata),
                      aDestra('MAX', testata),
                      if (conUmidita)
                        aDestra(
                          inLingua(it: 'UMIDITÀ', en: 'HUMIDITY'),
                          testata,
                        ),
                    ],
                  ),
                  for (final (i, s) in c.stanze.indexed)
                    TableRow(
                      decoration: BoxDecoration(
                        border: Border(top: BorderSide(color: toni.riga)),
                      ),
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 7),
                          child: Row(
                            children: [
                              Container(
                                width: 9,
                                height: 9,
                                decoration: BoxDecoration(
                                  color:
                                      _coloriDelleStanze[i %
                                          _coloriDelleStanze.length],
                                  borderRadius: BorderRadius.circular(3),
                                ),
                              ),
                              const SizedBox(width: 7),
                              Flexible(
                                child: Text(
                                  s.nome,
                                  style: cella,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                        aDestra(gradi(s.min), cella),
                        aDestra(gradi(s.media), cella),
                        aDestra(gradi(s.max), cella),
                        if (conUmidita)
                          aDestra(
                            s.umidita == null ? '–' : '${s.umidita!.round()}%',
                            cella,
                          ),
                      ],
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _IlRiscaldamento extends StatelessWidget {
  const _IlRiscaldamento(this.r, {super.key});
  final Riscaldamento r;

  @override
  Widget build(BuildContext context) {
    final range = r.range;
    String gradi(double v) => decimaleDetto(v, v % 1 == 0 ? 0 : 1);
    final ieri = r.ieriMinuti;
    final acceso = r.minutiAcceso;
    final differenza = ieri != null && acceso != null ? acceso - ieri : null;
    return _Riquadro(
      titolo: inLingua(it: 'Riscaldamento', en: 'Heating'),
      destra: r.obiettivo == null
          ? null
          : _Destra(
              inLingua(
                it: 'obiettivo ${gradi(r.obiettivo!)}°',
                en: 'target ${gradi(r.obiettivo!)}°',
              ),
            ),
      child: _Tessere(perRiga: 2, [
        if (acceso != null)
          (
            inLingua(it: 'Acceso', en: 'On'),
            minutiDetti(acceso),
            inLingua(it: 'in tutto, oggi', en: 'in total, today'),
          ),
        if (r.comfort != null)
          (
            inLingua(it: 'Nel comfort', en: 'In comfort'),
            '${r.comfort!.round()}%',
            range == null
                ? inLingua(it: 'del tempo', en: 'of the time')
                : inLingua(
                    it: 'del tempo, ${gradi(range.$1)}–${gradi(range.$2)}°',
                    en: 'of the time, ${gradi(range.$1)}–${gradi(range.$2)}°',
                  ),
          ),
        if (r.finestreAperte != null)
          (
            inLingua(it: 'Finestre aperte', en: 'Windows open'),
            volte(r.finestreAperte!),
            r.minutiClimaSpento == null
                ? null
                : inLingua(
                    it: 'clima spento ${minutiDetti(r.minutiClimaSpento!)}',
                    en: 'climate off ${minutiDetti(r.minutiClimaSpento!)}',
                  ),
          ),
        if (differenza != null)
          (
            inLingua(it: 'Ieri', en: 'Yesterday'),
            differenza == 0
                ? '='
                : '${differenza > 0 ? '+' : '−'}${minutiDetti(differenza.abs())}',
            differenza == 0
                ? inLingua(it: 'come oggi', en: 'same as today')
                : differenza < 0
                ? inLingua(it: 'meno acceso', en: 'less on')
                : inLingua(it: 'più acceso', en: 'more on'),
          ),
      ]),
    );
  }
}

/* ─── acqua calda ───────────────────────────────────────────────────────── */

double? _oraDecimale(String? ora) {
  if (ora == null) return null;
  final parti = ora.split(':');
  final h = int.tryParse(parti.first);
  final m = parti.length > 1 ? int.tryParse(parti[1]) : 0;
  if (h == null || m == null) return null;
  return h + m / 60;
}

/// «9:05» invece di «09:05», come si scrive a mano.
String _senzaZero(String ora) =>
    ora.startsWith('0') && ora.length == 5 ? ora.substring(1) : ora;

/// Una riga con un'icona davanti, con `**grassetto**`.
class _RigaConIcona extends StatelessWidget {
  const _RigaConIcona({required this.disegno, required this.testo, this.icona});
  final String? disegno;
  final IconData? icona;
  final String testo;

  @override
  Widget build(BuildContext context) {
    final toni = _Toni.di(context);
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 22,
            child: icona != null
                ? Icon(icona, size: 18, color: Colori.bene)
                : Oggetto(disegno!, lato: 17),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text.rich(
              _conGrassetto(
                testo,
                TextStyle(
                  fontSize: 13,
                  height: 1.45,
                  fontWeight: FontWeight.w500,
                  color: toni.testo,
                ),
                toni.valore,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _IlSolareTermico extends StatelessWidget {
  const _IlSolareTermico(this.s, {super.key});
  final SolareTermico s;

  @override
  Widget build(BuildContext context) {
    final toni = _Toni.di(context);
    String gradi(double v) => '${v.round()}°';
    final da = _oraDecimale(s.pompaDa);
    final a = _oraDecimale(s.pompaA);
    final collettore = s.collettore;
    final bollitore = s.bollitore;
    final conLinee =
        (collettore?.ore.whereType<double>().length ?? 0) > 1 ||
        (bollitore?.ore.whereType<double>().length ?? 0) > 1;
    final pressione = s.pressione;
    final resistenza = s.resistenzaMinuti;
    return _Riquadro(
      titolo: inLingua(it: 'Solare termico', en: 'Solar thermal'),
      destra: pressione == null
          ? null
          : Container(
              padding: const EdgeInsets.fromLTRB(7, 3, 9, 3),
              decoration: BoxDecoration(
                color: toni.scuro
                    ? const Color(0xFF14532D)
                    : const Color(0xFFDCFCE7),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.check_rounded,
                    size: 13,
                    color: toni.scuro
                        ? const Color(0xFFBBF7D0)
                        : const Color(0xFF166534),
                  ),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      inLingua(
                        it: 'pressione ${decimaleDetto(pressione, 1)} bar',
                        en: 'pressure ${decimaleDetto(pressione, 1)} bar',
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: toni.scuro
                            ? const Color(0xFFBBF7D0)
                            : const Color(0xFF166534),
                      ),
                    ),
                  ),
                ],
              ),
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (conLinee) ...[
            _Legenda([
              if (collettore != null)
                (_collettore, inLingua(it: 'Collettore', en: 'Collector')),
              if (bollitore != null)
                (_bollitore, inLingua(it: 'Bollitore', en: 'Tank')),
            ]),
            const SizedBox(height: 6),
            SizedBox(
              height: 150,
              child: CustomPaint(
                painter: _DisegnoALinee(
                  toni: toni,
                  fascia: da != null && a != null ? (da, a) : null,
                  scrittaDellaFascia: da != null && a != null
                      ? inLingua(
                          it:
                              'pompa accesa ${_senzaZero(s.pompaDa!)}–'
                              '${_senzaZero(s.pompaA!)}',
                          en:
                              'pump on ${_senzaZero(s.pompaDa!)}–'
                              '${_senzaZero(s.pompaA!)}',
                        )
                      : null,
                  linee: [
                    if (collettore != null)
                      (collettore.ore, _collettore, false),
                    if (bollitore != null) (bollitore.ore, _bollitore, false),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
          ],
          _Tessere(perRiga: 2, [
            if (bollitore?.massima case final v?)
              (
                inLingua(it: 'Bollitore', en: 'Tank'),
                gradi(v),
                bollitore!.alle == null
                    ? null
                    : inLingua(
                        it: 'massimo alle ${bollitore.alle}',
                        en: 'peak at ${bollitore.alle}',
                      ),
              ),
            if (collettore?.massima case final v?)
              (
                inLingua(it: 'Collettore', en: 'Collector'),
                gradi(v),
                collettore!.alle == null
                    ? null
                    : inLingua(
                        it: 'massimo alle ${collettore.alle}',
                        en: 'peak at ${collettore.alle}',
                      ),
              ),
            if (s.pompaMinuti != null)
              (
                inLingua(it: 'Pompa', en: 'Pump'),
                minutiDetti(s.pompaMinuti!),
                inLingua(it: 'accesa', en: 'running'),
              ),
            if (s.caloreKwh != null)
              (
                inLingua(it: 'Calore preso', en: 'Heat gained'),
                '~${decimaleDetto(s.caloreKwh!, 1)} kWh',
                s.euro == null
                    ? null
                    : inLingua(
                        it: '≈ ${euroDetto(s.euro!)} di corrente risparmiati',
                        en: '≈ ${euroDetto(s.euro!)} of power saved',
                      ),
              ),
          ]),
          if (resistenza != null)
            _RigaConIcona(
              disegno: resistenza == 0 ? null : 'scaldabagno',
              icona: resistenza == 0 ? Icons.check_circle_rounded : null,
              testo: resistenza == 0
                  ? inLingua(
                      it:
                          'Resistenza elettrica **mai accesa**: l\'acqua l\'ha '
                          'scaldata tutta il sole.',
                      en:
                          'Electric heater **never on**: the sun heated all '
                          'the water.',
                    )
                  : inLingua(
                      it:
                          'Resistenza elettrica accesa per '
                          '**${minutiDetti(resistenza)}**.',
                      en:
                          'Electric heater on for '
                          '**${minutiDetti(resistenza)}**.',
                    ),
            ),
        ],
      ),
    );
  }
}

/* ─── auto e consumi ────────────────────────────────────────────────────── */

class _DisegnoDellAuto extends CustomPainter {
  const _DisegnoDellAuto({required this.auto, required this.toni});
  final AutoDelGiorno auto;
  final _Toni toni;

  @override
  void paint(Canvas canvas, Size size) {
    const destra = 30.0;
    final piano = Rect.fromLTRB(0, 4, size.width - destra, size.height - 16);
    double x(double ora) => piano.left + ora.clamp(0, 24) / 24 * piano.width;
    for (final (da, a, colore) in [
      for (final v in auto.viaggi) (v.da, v.a, _inViaggio),
      for (final r in auto.ricariche) (r.da, r.a, _usatoInCasa),
    ]) {
      final inizio = _oraDecimale(da);
      final fine = _oraDecimale(a);
      if (inizio == null || fine == null) continue;
      canvas.drawRect(
        Rect.fromLTRB(
          x(inizio),
          0,
          math.max(x(fine), x(inizio) + 2),
          piano.bottom,
        ),
        Paint()..color = colore.withValues(alpha: 0.16),
      );
    }
    final valori = [for (final (_, p) in auto.soc) p];
    final lo = valori.isEmpty
        ? 40.0
        : math.max(0.0, ((valori.reduce(math.min) - 10) / 10).floor() * 10.0);
    const hi = 100.0;
    double y(double p) =>
        piano.bottom - ((p - lo) / (hi - lo)).clamp(0, 1) * piano.height;
    for (final tacca in const [25.0, 50.0, 75.0, 100.0]) {
      if (tacca < lo) continue;
      _aDestra(
        canvas,
        '${tacca.round()}%',
        Offset(piano.right + 4, y(tacca)),
        toni.etichetta,
      );
    }
    if (auto.soc.length > 1) {
      final strada = Path();
      for (final (i, (ora, p)) in auto.soc.indexed) {
        if (i == 0) {
          strada.moveTo(x(ora), y(p));
        } else {
          strada.lineTo(x(ora), y(p));
        }
      }
      canvas.drawPath(
        strada,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeJoin = StrokeJoin.round
          ..color = toni.batteriaAuto,
      );
    }
    _leOre(canvas, 0, piano.width, size.height - 3, toni.etichetta);
  }

  @override
  bool shouldRepaint(_DisegnoDellAuto prima) =>
      prima.auto != auto || prima.toni.scuro != toni.scuro;
}

class _LAuto extends StatelessWidget {
  const _LAuto(this.auto, {super.key});
  final AutoDelGiorno auto;

  @override
  Widget build(BuildContext context) {
    final toni = _Toni.di(context);
    final viaggi = auto.viaggi.length;
    final ricariche = auto.ricariche.length;
    final quante = [
      if (viaggi > 0)
        viaggi == 1
            ? inLingua(it: '1 viaggio', en: '1 trip')
            : inLingua(it: '$viaggi viaggi', en: '$viaggi trips'),
      if (ricariche > 0)
        ricariche == 1
            ? inLingua(it: '1 ricarica', en: '1 charge')
            : inLingua(it: '$ricariche ricariche', en: '$ricariche charges'),
    ].join(' · ');
    String pct(double v) => '${v.round()}%';
    final km = auto.km;
    return _Riquadro(
      titolo: auto.nome,
      destra: quante.isEmpty ? null : _Destra(quante),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (auto.soc.length > 1 || viaggi > 0 || ricariche > 0) ...[
            _Legenda([
              (
                _usatoInCasa.withValues(alpha: 0.6),
                inLingua(it: 'In ricarica', en: 'Charging'),
              ),
              (
                _inViaggio.withValues(alpha: 0.6),
                inLingua(it: 'In viaggio', en: 'Driving'),
              ),
              if (auto.soc.length > 1)
                (toni.batteriaAuto, inLingua(it: 'Batteria', en: 'Battery')),
            ]),
            const SizedBox(height: 12),
            SizedBox(
              height: 90,
              child: CustomPaint(
                painter: _DisegnoDellAuto(auto: auto, toni: toni),
              ),
            ),
          ],
          for (final r in auto.ricariche) ...[
            _Titoletto(
              r.da != null && r.a != null
                  ? inLingua(
                      it: 'Ricarica · ${r.da}–${r.a}',
                      en: 'Charge · ${r.da}–${r.a}',
                    )
                  : inLingua(it: 'Ricarica', en: 'Charge'),
            ),
            _Tessere(perRiga: 2, [
              if (r.kwh != null)
                (
                  inLingua(it: 'Caricati', en: 'Charged'),
                  '${decimaleDetto(r.kwh!, 1)} kWh',
                  r.socDa != null && r.socA != null
                      ? '${pct(r.socDa!)} → ${pct(r.socA!)}'
                      : null,
                ),
              if (r.quotaSole != null)
                (
                  inLingua(it: 'Dal sole', en: 'From the sun'),
                  pct(r.quotaSole! * 100),
                  r.euro == null
                      ? null
                      : inLingua(
                          it: 'costo ${euroDetto(r.euro!)}',
                          en: 'cost ${euroDetto(r.euro!)}',
                        ),
                ),
            ]),
          ],
          if (auto.usatiKwh != null || km != null) ...[
            _Titoletto(
              inLingua(it: 'Scarica · in viaggio', en: 'Used · driving'),
            ),
            _Tessere(perRiga: 2, [
              if (auto.usatiKwh != null)
                (
                  inLingua(it: 'Usati', en: 'Used'),
                  '${decimaleDetto(auto.usatiKwh!, 1)} kWh',
                  auto.usatiPct == null
                      ? null
                      : inLingua(
                          it: '${pct(auto.usatiPct!)} della batteria',
                          en: '${pct(auto.usatiPct!)} of the battery',
                        ),
                ),
              if (km != null)
                (
                  inLingua(it: 'Percorsi', en: 'Driven'),
                  '${auto.kmStimati ? '≈ ' : ''}${km.round()} km',
                  auto.kwh100 == null
                      ? null
                      : '${decimaleDetto(auto.kwh100!, 1)} kWh/100 km',
                ),
            ]),
          ],
          if (viaggi > 0)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: _Elenco([
                for (final v in auto.viaggi)
                  (
                    v.da ?? '',
                    [
                          if (v.a != null)
                            inLingua(
                              it: 'fino alle ${v.a}',
                              en: 'until ${v.a}',
                            ),
                          if (v.soc != null) pct(v.soc!),
                          if (v.km != null)
                            '${auto.kmStimati ? '≈ ' : ''}${v.km!.round()} km',
                        ].join(' · ') +
                        (v.lento
                            ? inLingua(it: ', più lento', en: ', slower')
                            : ''),
                  ),
              ]),
            ),
          if (auto.socStasera != null)
            _RigaConIcona(
              disegno: 'batterie',
              testo: inLingua(
                it: 'Stasera al **${pct(auto.socStasera!)}**.',
                en: 'At **${pct(auto.socStasera!)}** tonight.',
              ),
            ),
        ],
      ),
    );
  }
}

/// Un elenco a due colonne: l'ora (o un'icona) e il testo.
class _Elenco extends StatelessWidget {
  const _Elenco(this.righe);
  final List<(String, String)> righe;

  @override
  Widget build(BuildContext context) {
    final toni = _Toni.di(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, (ora, testo)) in righe.indexed)
          Padding(
            padding: EdgeInsets.only(top: i == 0 ? 0 : 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 44,
                  child: Text(
                    ora,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: toni.etichetta,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    testo,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w500,
                      height: 1.35,
                      color: toni.testo,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _Acqua extends StatelessWidget {
  const _Acqua(this.a, {super.key});
  final AcquaEGas a;

  @override
  Widget build(BuildContext context) {
    return _Riquadro(
      titolo: inLingua(it: 'Acqua e gas', en: 'Water and gas'),
      child: _Tessere([
        if (a.litri != null)
          (
            inLingua(it: 'Acqua', en: 'Water'),
            '${a.litri!.round()} L',
            a.ieriPct == null
                ? null
                : inLingua(
                    it: '${percentoConSegno(a.ieriPct!)} su ieri',
                    en: '${percentoConSegno(a.ieriPct!)} vs yesterday',
                  ),
          ),
        if (a.gas != null)
          (
            'Gas',
            '${decimaleDetto(a.gas!, 1)} m³',
            a.gas! <= 0
                ? inLingua(it: 'tutto elettrico', en: 'all electric')
                : inLingua(it: 'oggi', en: 'today'),
          ),
        if (a.irrigazioneLitri != null)
          (
            inLingua(it: 'Irrigazione', en: 'Irrigation'),
            '${a.irrigazioneLitri!.round()} L',
            [
              if (a.irrigazioneZone != null)
                a.irrigazioneZone == 1
                    ? inLingua(it: '1 zona', en: '1 zone')
                    : inLingua(
                        it: '${a.irrigazioneZone} zone',
                        en: '${a.irrigazioneZone} zones',
                      ),
              ?a.irrigazioneAlle,
            ].join(', '),
          ),
      ]),
    );
  }
}

/* ─── la casa ───────────────────────────────────────────────────────────── */

class _LaCasa extends StatelessWidget {
  const _LaCasa(this.g, {super.key});
  final GiornataDellaCasa g;

  @override
  Widget build(BuildContext context) {
    final conti = g.conti;
    return _Riquadro(
      titolo: inLingua(it: 'La giornata in casa', en: 'The day at home'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (g.eventi.isNotEmpty)
            _Elenco([for (final e in g.eventi) (e.ora, e.testo)]),
          if (conti != null) ...[
            if (g.eventi.isNotEmpty) const SizedBox(height: 12),
            _Tessere([
              if (conti.porte != null)
                (
                  inLingua(it: 'Porte', en: 'Doors'),
                  '${conti.porte}',
                  inLingua(it: 'aperture', en: 'openings'),
                ),
              if (conti.automazioni != null)
                (
                  inLingua(it: 'Automazioni', en: 'Automations'),
                  '${conti.automazioni}',
                  inLingua(it: 'eseguite', en: 'run'),
                ),
              if (conti.avvisi != null)
                (
                  inLingua(it: 'Avvisi', en: 'Alerts'),
                  '${conti.avvisi}',
                  inLingua(it: 'allarmi', en: 'alarms'),
                ),
            ]),
          ],
        ],
      ),
    );
  }
}

class _Rispetto extends StatelessWidget {
  const _Rispetto(this.voci, {super.key});
  final List<(String, String, String)> voci;

  @override
  Widget build(BuildContext context) => _Riquadro(
    titolo: inLingua(it: 'Rispetto a', en: 'Compared with'),
    child: _Tessere([for (final (a, b, c) in voci) (a, b, c)]),
  );
}

/* ─── domani ────────────────────────────────────────────────────────────── */

class _Domani extends StatelessWidget {
  const _Domani(this.d, {super.key});
  final Domani d;

  @override
  Widget build(BuildContext context) {
    final toni = _Toni.di(context);
    final soleFino = d.soleFino;
    final destra = [
      if (soleFino != null)
        inLingua(
          it: 'sole fino alle ${int.tryParse(soleFino.split(':').first) ?? soleFino}',
          en: 'sun until ${int.tryParse(soleFino.split(':').first) ?? soleFino}',
        ),
      if (d.massima != null) 'max ${d.massima!.round()}°',
    ].join(' · ');
    return _Riquadro(
      titolo: inLingua(it: 'Domani', en: 'Tomorrow'),
      destra: destra.isEmpty ? null : _Destra(destra),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (d.cielo.isNotEmpty)
            Row(
              children: [
                for (final (ora, cielo) in d.cielo.take(8))
                  Expanded(
                    child: Column(
                      children: [
                        SizedBox(
                          width: 26,
                          height: 22,
                          child: CustomPaint(
                            painter: _IlTempo(cielo, toni.scuro),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          ora,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: toni.secondario,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          if (d.consiglio != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(
                d.consiglio!,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  height: 1.45,
                  color: toni.consiglio,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Il cielo di un'ora, disegnato: sole, poco nuvoloso, nuvole, pioggia.
class _IlTempo extends CustomPainter {
  const _IlTempo(this.cielo, this.scuro);
  final String cielo;
  final bool scuro;

  @override
  void paint(Canvas canvas, Size size) {
    final k = size.height / 22;
    final sole = Paint()..color = _giallo;
    final nuvola = Paint()
      ..color = scuro ? const Color(0xFFE2E8F0) : const Color(0xFF94A3B8);
    void ilSole(Offset c, double r) {
      canvas.drawCircle(c, r, sole);
      final raggi = Paint()
        ..color = _giallo
        ..strokeWidth = 1.6 * k
        ..strokeCap = StrokeCap.round;
      for (var i = 0; i < 8; i += 1) {
        final a = i * math.pi / 4;
        final dir = Offset(math.cos(a), math.sin(a));
        canvas.drawLine(
          c + dir * (r + 2.2 * k),
          c + dir * (r + 4.6 * k),
          raggi,
        );
      }
    }

    void laNuvola(Offset c, double s) {
      canvas
        ..drawCircle(c + Offset(-4.5, 1) * s, 4.2 * s, nuvola)
        ..drawCircle(c + Offset(1.5, -1.5) * s, 5.6 * s, nuvola)
        ..drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(c.dx - 8.5 * s, c.dy, 17 * s, 5.4 * s),
            Radius.circular(2.7 * s),
          ),
          nuvola,
        );
    }

    final centro = size.center(Offset.zero);
    switch (cielo) {
      case 'sole':
        ilSole(centro, 5.4 * k);
      case 'poco':
        ilSole(centro + Offset(-3, -3) * k, 4.4 * k);
        laNuvola(centro + Offset(2.5, 2.5) * k, 0.85 * k);
      case 'pioggia':
        laNuvola(centro + Offset(0, -3) * k, k);
        final goccia = Paint()
          ..color = const Color(0xFF38BDF8)
          ..strokeWidth = 1.6 * k
          ..strokeCap = StrokeCap.round;
        for (final dx in const [-5.0, 0.0, 5.0]) {
          canvas.drawLine(
            centro + Offset(dx, 5.5) * k,
            centro + Offset(dx - 1.5, 9) * k,
            goccia,
          );
        }
      default:
        laNuvola(centro + Offset(0, -1) * k, 1.1 * k);
    }
  }

  @override
  bool shouldRepaint(_IlTempo prima) =>
      prima.cielo != cielo || prima.scuro != scuro;
}

class _DaSistemare extends StatelessWidget {
  const _DaSistemare(this.righe, {super.key});
  final List<Riga> righe;

  @override
  Widget build(BuildContext context) {
    final toni = _Toni.di(context);
    return _Riquadro(
      titolo: inLingua(it: 'Da sistemare', en: 'To fix'),
      child: Column(
        children: [
          for (final (i, riga) in righe.indexed)
            Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 44,
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Oggetto(_disegnoPer(riga.icona), lato: 17),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text.rich(
                      _conGrassetto(
                        riga.testo,
                        TextStyle(
                          fontSize: 12.5,
                          height: 1.4,
                          fontWeight: FontWeight.w500,
                          color: toni.testo,
                        ),
                        toni.valore,
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
