/// «Collega WHOOP»: l'account WHOOP, con OAuth2, e i suoi dati.
///
/// ## Come si collega
///
/// 1. [CollegamentoWhoop.collega] apre nel navigatore la pagina di WHOOP
///    che chiede «GdAHome puo' leggere recupero, sonno, allenamenti…?», con
///    uno `state` fatto qui, a caso, e ricordato dieci minuti.
/// 2. Chi dice di si' torna all'app da `gdahome://whoop?code=…&state=…`
///    (`ponte/il_link.dart` lo passa a [CollegamentoWhoop.ritorno]). Uno
///    `state` che non e' il nostro, o scaduto, non collega niente: un link
///    puo' arrivare da chiunque.
/// 3. Il `code` si scambia coi token. **Il client secret non sta nell'app**:
///    un'app si smonta, e un secret dentro e' di tutti. Lo scambio passa
///    dallo sportello ([ConfigurazioneWhoop.sportello]), un nostro servizio
///    che aggiunge `client_id` e `client_secret` e gira la domanda a WHOOP,
///    senza tenere niente. Se WHOOP accettera' il PKCE per le app (oggi la
///    documentazione parla solo di secret: da verificare), basta accendere
///    [ConfigurazioneWhoop.pkce] e lo scambio va diretto, col `code_verifier`
///    al posto del secret.
/// 4. I token stanno **solo su questo telefono**, nel portachiavi del
///    sistema (Keychain, Keystore), mai nella casa ne' nel centralino.
///
/// ## Poi
///
/// [CollegamentoWhoop.aggiorna] prende recupero, ciclo, sonno e allenamenti,
/// al piu' ogni quarto d'ora: lo chiama il lettore a ogni invio della Salute
/// (`lettore_con_whoop.dart`), anche ad app chiusa, e la pagina quando si
/// apre. Il token d'accesso dura poco: quando sta per scadere si rinnova
/// col `refresh_token` (scope `offline`), sempre dallo sportello. Se WHOOP
/// non lo accetta piu' — l'accesso tolto dal sito di WHOOP — il collegamento
/// si chiude e la pagina chiede di rifarlo.
///
/// [CollegamentoWhoop.scollega] chiede a WHOOP di togliere l'accesso, e
/// cancella token e dati dal telefono anche se WHOOP non risponde.
///
/// ## Da verificare sulla documentazione WHOOP
///
/// Senza rete verso developer.whoop.com, gli indirizzi e i campi sono quelli
/// noti dell'API v2: [autorizzazioneWhoop], [tokenWhoop], [apiWhoop], le vie
/// `/v2/...`, la revoca `DELETE /v2/user/access`, lo `state` di almeno otto
/// lettere, il PKCE. Sono tutti qui in cima.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import '../../casa/cassaforte.dart';
import '../../parole.dart';
import 'whoop.dart';

/// L'identificativo dell'app GdAHome sul portale sviluppatori di WHOOP
/// (developer-dashboard.whoop.com). **Da compilare** quando l'app e'
/// registrata: vuoto, «Collega WHOOP» non si mostra. Non e' un segreto.
const whoopClientId = '';

/// Lo sportello che custodisce il client secret e fa lo scambio dei token:
/// `https://…/whoop`, a cui l'app aggiunge `/token`. **Da compilare.**
/// Vuoto, e senza PKCE, «Collega WHOOP» non si mostra.
const sportelloWhoop = '';

/// Dove WHOOP rimanda dopo il si': va scritto uguale nel portale WHOOP
/// («Redirect URIs»). Lo schema `gdahome` e' gia' dell'app
/// (`AndroidManifest.xml`, `Info.plist`).
const ritornoWhoop = 'gdahome://whoop';

/// Cosa si chiede di leggere. `offline` da' il `refresh_token`: senza, il
/// collegamento durerebbe un'ora.
const scopeWhoop = [
  'read:recovery',
  'read:cycles',
  'read:sleep',
  'read:workout',
  'read:profile',
  'read:body_measurement',
  'offline',
];

/// Da verificare: la pagina del consenso.
final autorizzazioneWhoop = Uri.parse(
  'https://api.prod.whoop.com/oauth/oauth2/auth',
);

/// Da verificare: lo scambio e il rinnovo dei token.
final tokenWhoop = Uri.parse('https://api.prod.whoop.com/oauth/oauth2/token');

/// Da verificare: la radice dell'API.
const apiWhoop = 'https://api.prod.whoop.com/developer';

/// Ogni quanto si chiede a WHOOP, al massimo: come la Salute.
const ogniQuantoWhoop = Duration(minutes: 15);

/// Quanto vale un «collega» lasciato a meta': il tempo di dire di si' nel
/// navigatore.
const attesaWhoop = Duration(minutes: 10);

/// Come e' fatto il collegamento di questa app.
class ConfigurazioneWhoop {
  const ConfigurazioneWhoop({
    required this.clientId,
    this.sportello,
    this.pkce = false,
    this.ritorno = ritornoWhoop,
  });

  /// Quella dell'app, dalle costanti qui sopra.
  static final diGdaHome = ConfigurazioneWhoop(
    clientId: whoopClientId,
    sportello: sportelloWhoop.isEmpty ? null : Uri.parse(sportelloWhoop),
  );

  final String clientId;

  /// Il nostro servizio col client secret. `null`: si scambia diretto con
  /// WHOOP, e serve il [pkce].
  final Uri? sportello;

  /// Se WHOOP accetta il PKCE (`code_challenge` S256). Acceso, lo si manda
  /// anche passando dallo sportello: una difesa in piu'.
  final bool pkce;
  final String ritorno;

  /// Se «Collega WHOOP» si puo' offrire.
  bool get pronta => clientId.isNotEmpty && (sportello != null || pkce);
}

/// I token, come li tiene il portachiavi.
class TokenWhoop {
  const TokenWhoop({
    required this.accesso,
    required this.scade,
    this.rinnovo,
    this.utente,
  });

  final String accesso;
  final String? rinnovo;
  final DateTime scade;

  /// L'identificativo WHOOP dell'utente, dal profilo: solo per sapere che
  /// il collegamento funziona. Niente nome, niente email.
  final String? utente;

  bool scadeEntro(Duration margine, DateTime adesso) =>
      !scade.isAfter(adesso.add(margine));

  TokenWhoop con({String? utente}) => TokenWhoop(
    accesso: accesso,
    rinnovo: rinnovo,
    scade: scade,
    utente: utente ?? this.utente,
  );

  /// Dalla risposta di WHOOP (`access_token`, `refresh_token`,
  /// `expires_in`). Un rinnovo senza `refresh_token` nuovo tiene il vecchio.
  static TokenWhoop? daRisposta(
    Object? risposta,
    DateTime adesso, {
    String? rinnovoDiPrima,
    String? utente,
  }) {
    if (risposta is! Map) return null;
    final accesso = risposta['access_token'];
    if (accesso is! String || accesso.isEmpty) return null;
    final dura = risposta['expires_in'];
    final rinnovo = risposta['refresh_token'];
    return TokenWhoop(
      accesso: accesso,
      rinnovo: rinnovo is String && rinnovo.isNotEmpty
          ? rinnovo
          : rinnovoDiPrima,
      scade: adesso.add(Duration(seconds: dura is num ? dura.toInt() : 3600)),
      utente: utente,
    );
  }

  String get comeSiScrive => jsonEncode({
    'a': accesso,
    'r': ?rinnovo,
    's': scade.millisecondsSinceEpoch,
    'u': ?utente,
  });

  static TokenWhoop? daQuelloCheCEra(String? scritto) {
    if (scritto == null) return null;
    try {
      final m = jsonDecode(scritto);
      if (m is! Map) return null;
      final a = m['a'];
      final s = m['s'];
      if (a is! String || s is! int) return null;
      return TokenWhoop(
        accesso: a,
        rinnovo: m['r'] is String ? m['r'] as String : null,
        scade: DateTime.fromMillisecondsSinceEpoch(s),
        utente: m['u'] is String ? m['u'] as String : null,
      );
    } catch (_) {
      return null;
    }
  }
}

enum StatoWhoop {
  /// Mai collegato, o scollegato.
  scollegato,

  /// Collegato: ci sono i token.
  collegato,

  /// Era collegato, ma WHOOP non accetta piu' i token (l'accesso tolto dal
  /// sito di WHOOP, la password cambiata): va rifatto.
  daRicollegare,
}

/// Com'e' finito un ritorno da WHOOP ([CollegamentoWhoop.ritorno]).
enum EsitoWhoop {
  collegato,

  /// Chi guardava ha detto di no, o ha chiuso la pagina.
  annullato,

  /// Lo `state` non e' il nostro, o e' scaduto: non si collega niente.
  linkNonValido,

  /// WHOOP o lo sportello hanno rifiutato il `code`.
  rifiutato,

  /// La rete, o lo sportello, non rispondono.
  nonRisponde;

  String get spiegazione => switch (this) {
    EsitoWhoop.collegato => inLingua(
      it: 'WHOOP collegato: recupero, sforzo e sonno arrivano nella Salute.',
      en: 'WHOOP connected: recovery, strain and sleep now reach Health.',
    ),
    EsitoWhoop.annullato => inLingua(
      it: 'Collegamento a WHOOP annullato.',
      en: 'WHOOP connection cancelled.',
    ),
    EsitoWhoop.linkNonValido => inLingua(
      it:
          'Questo ritorno da WHOOP non è valido o è scaduto: riprova da '
          '«Collega».',
      en:
          'This return from WHOOP is invalid or expired: try again from '
          '“Connect”.',
    ),
    EsitoWhoop.rifiutato => inLingua(
      it: 'WHOOP non ha accettato il collegamento. Riprova.',
      en: "WHOOP didn't accept the connection. Try again.",
    ),
    EsitoWhoop.nonRisponde => inLingua(
      it: 'WHOOP non risponde: controlla la rete e riprova.',
      en: "WHOOP isn't answering: check your connection and try again.",
    ),
  };
}

/// La rete non ha risposto, o ha risposto male: si tiene quello che c'era.
class WhoopNonRisponde implements Exception {
  const WhoopNonRisponde(this.perche);
  final String perche;
  @override
  String toString() => 'WhoopNonRisponde: $perche';
}

/// Il portachiavi dei token WHOOP: lo stesso del sistema, ma **senza** la
/// copia fuori dal portachiavi che tiene i segni di casa
/// (`ponte_del_portachiavi.dart`) e senza le copie di iCloud
/// (`first_unlock_this_device`: si legge anche ad app chiusa, per il giro
/// della Salute, ma resta su questo iPhone).
const portachiaviWhoop = CassaforteDelSistema(
  dentro: FlutterSecureStorage(
    aOptions: AndroidOptions(),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  ),
  riscriviLeVecchie: false,
);

class CollegamentoWhoop {
  CollegamentoWhoop({
    ConfigurazioneWhoop? configurazione,
    this.cassaforte = portachiaviWhoop,
    http.Client? rete,
    Future<bool> Function(Uri)? apri,
    DateTime Function()? adesso,
    Random? caso,
  }) : configurazione = configurazione ?? ConfigurazioneWhoop.diGdaHome,
       _rete = rete ?? http.Client(),
       _apri = apri ?? _apriNelNavigatore,
       _adesso = adesso ?? DateTime.now,
       _caso = caso ?? Random.secure();

  /// Quello dell'app: c'e' dopo `main.dart`.
  static CollegamentoWhoop? istanza;

  static const chiaveToken = 'whoop.token';
  static const chiaveDati = 'whoop.dati';
  static const chiaveAttesa = 'whoop.attesa';

  final ConfigurazioneWhoop configurazione;

  /// Il portachiavi dei token e degli ultimi dati.
  final Cassaforte cassaforte;
  final http.Client _rete;
  final Future<bool> Function(Uri) _apri;
  final DateTime Function() _adesso;
  final Random _caso;
  final _cambiamenti = StreamController<void>.broadcast();

  TokenWhoop? _token;
  DatiWhoop? _ultimi;
  bool _caricato = false;
  bool _perso = false;
  Future<DatiWhoop?>? _inCorso;

  Stream<void> get cambiamenti => _cambiamenti.stream;

  StatoWhoop get stato => _token != null
      ? StatoWhoop.collegato
      : _perso
      ? StatoWhoop.daRicollegare
      : StatoWhoop.scollegato;

  bool get collegato => _token != null;

  /// Se nella pagina si offre «Collega»: la configurazione c'e', o si e'
  /// gia' collegati (per poter scollegare).
  bool get siMostra => configurazione.pronta || collegato;

  /// Gli ultimi dati presi, anche di un giro di prima (stanno nel
  /// portachiavi, cifrati).
  DatiWhoop? get ultimi => _ultimi;

  void _avvisa() {
    if (!_cambiamenti.isClosed) _cambiamenti.add(null);
  }

  Future<void> carica() async {
    if (_caricato) return;
    _caricato = true;
    try {
      _token = TokenWhoop.daQuelloCheCEra(await cassaforte.leggi(chiaveToken));
      if (_token != null) {
        final dati = await cassaforte.leggi(chiaveDati);
        _ultimi = dati == null ? null : DatiWhoop.daJson(jsonDecode(dati));
      }
    } catch (_) {
      /* Il portachiavi non risponde: come scollegato, si riprova al
       * prossimo avvio. */
    }
    _avvisa();
  }

  // ─── Collegare ──────────────────────────────────────────────────────────

  String _aCaso(int quanti) =>
      base64UrlEncode([for (var i = 0; i < quanti; i++) _caso.nextInt(256)])
          .replaceAll('=', '');

  /// L'indirizzo della pagina del consenso, con lo `state` e, se acceso, la
  /// sfida PKCE.
  Future<Uri> _laPaginaDelConsenso(String state, String? verificatore) async {
    final sfida = verificatore == null
        ? null
        : base64UrlEncode(
            (await Sha256().hash(utf8.encode(verificatore))).bytes,
          ).replaceAll('=', '');
    return autorizzazioneWhoop.replace(
      queryParameters: {
        'response_type': 'code',
        'client_id': configurazione.clientId,
        'redirect_uri': configurazione.ritorno,
        'scope': scopeWhoop.join(' '),
        'state': state,
        if (sfida != null) ...{
          'code_challenge': sfida,
          'code_challenge_method': 'S256',
        },
      },
    );
  }

  /// Apre la pagina di WHOOP. `false` se non si e' aperta, o se il
  /// collegamento in questa app non e' pronto. Il resto arriva col link di
  /// ritorno ([ritorno]).
  Future<bool> collega() async {
    await carica();
    if (!configurazione.pronta) return false;
    final state = _aCaso(24);
    final verificatore = configurazione.pkce ? _aCaso(48) : null;
    /* L'attesa si ricorda nel portachiavi, non in memoria: mentre si dice
     * di si' nel navigatore il telefono puo' chiudere l'app, e il link
     * di ritorno la riapre da capo. */
    await cassaforte.scrivi(
      chiaveAttesa,
      jsonEncode({
        'state': state,
        'v': ?verificatore,
        'da': _adesso().millisecondsSinceEpoch,
      }),
    );
    return _apri(await _laPaginaDelConsenso(state, verificatore));
  }

  /// Il link di ritorno: `gdahome://whoop?code=…&state=…`, o `?error=…`.
  Future<EsitoWhoop> ritorno(Uri link) async {
    await carica();
    final attesa = await _lAttesa();
    /* Un'attesa si usa una volta sola, comunque vada. */
    await cassaforte.cancella(chiaveAttesa);
    final parametri = link.queryParameters;
    final state = parametri['state'];
    if (attesa == null ||
        state == null ||
        !_stessoState(state, attesa.state) ||
        _adesso().difference(attesa.da) > attesaWhoop) {
      return EsitoWhoop.linkNonValido;
    }
    if (parametri['error'] != null) return EsitoWhoop.annullato;
    final code = parametri['code'];
    if (code == null || code.isEmpty) return EsitoWhoop.linkNonValido;
    final ({int stato, Object? corpo}) risposta;
    try {
      risposta = await _scambia({
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': configurazione.ritorno,
        'code_verifier': ?attesa.verificatore,
      });
    } on WhoopNonRisponde {
      return EsitoWhoop.nonRisponde;
    }
    if (risposta.stato >= 500) return EsitoWhoop.nonRisponde;
    final token = risposta.stato == 200
        ? TokenWhoop.daRisposta(risposta.corpo, _adesso())
        : null;
    if (token == null) return EsitoWhoop.rifiutato;
    await _salvaIlToken(token);
    _perso = false;
    /* Il profilo: solo l'identificativo, per sapere che i token
     * funzionano. Poi i dati, subito, per la pagina. */
    try {
      final profilo = await _prendi('/v2/user/profile/basic');
      final utente = profilo is Map ? profilo['user_id'] : null;
      if (utente != null && _token != null) {
        await _salvaIlToken(_token!.con(utente: '$utente'));
      }
    } catch (_) {}
    /* I dati subito, cosi' la pagina mostra le schede appena si torna. */
    try {
      await aggiorna(forza: true);
    } catch (_) {}
    _avvisa();
    return EsitoWhoop.collegato;
  }

  Future<({String state, String? verificatore, DateTime da})?>
  _lAttesa() async {
    try {
      final m = jsonDecode(await cassaforte.leggi(chiaveAttesa) ?? 'null');
      if (m is! Map || m['state'] is! String || m['da'] is! int) return null;
      return (
        state: m['state'] as String,
        verificatore: m['v'] is String ? m['v'] as String : null,
        da: DateTime.fromMillisecondsSinceEpoch(m['da'] as int),
      );
    } catch (_) {
      return null;
    }
  }

  /* Lo state si confronta senza fermarsi alla prima lettera diversa. */
  bool _stessoState(String a, String b) {
    if (a.length != b.length) return false;
    var diverse = 0;
    for (var i = 0; i < a.length; i++) {
      diverse |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }
    return diverse == 0;
  }

  /// Lo scambio col server dei token: dallo sportello, che aggiunge il
  /// secret, o diretto a WHOOP col PKCE.
  Future<({int stato, Object? corpo})> _scambia(
    Map<String, String> campi,
  ) async {
    final sportello = configurazione.sportello;
    final http.Response risposta;
    try {
      risposta = sportello != null
          ? await _rete
                .post(
                  sportello.replace(path: '${sportello.path}/token'),
                  headers: {'content-type': 'application/json'},
                  body: jsonEncode(campi),
                )
                .timeout(const Duration(seconds: 20))
          : await _rete
                .post(
                  tokenWhoop,
                  body: {...campi, 'client_id': configurazione.clientId},
                )
                .timeout(const Duration(seconds: 20));
    } catch (errore) {
      throw WhoopNonRisponde('$errore');
    }
    Object? corpo;
    try {
      corpo = jsonDecode(risposta.body);
    } catch (_) {}
    return (stato: risposta.statusCode, corpo: corpo);
  }

  Future<void> _salvaIlToken(TokenWhoop token) async {
    _token = token;
    await cassaforte.scrivi(chiaveToken, token.comeSiScrive);
  }

  // ─── Rinnovare ──────────────────────────────────────────────────────────

  /// Il token buono per i prossimi minuti: rinnovato se serve. `null` se il
  /// collegamento si e' perso.
  Future<TokenWhoop?> _tokenBuono({bool forza = false}) async {
    final token = _token;
    if (token == null) return null;
    if (!forza && !token.scadeEntro(const Duration(minutes: 2), _adesso())) {
      return token;
    }
    final rinnovo = token.rinnovo;
    if (rinnovo == null) {
      await _perdi();
      return null;
    }
    final risposta = await _scambia({
      'grant_type': 'refresh_token',
      'refresh_token': rinnovo,
      'scope': 'offline',
    });
    if (risposta.stato == 200) {
      final nuovo = TokenWhoop.daRisposta(
        risposta.corpo,
        _adesso(),
        rinnovoDiPrima: rinnovo,
        utente: token.utente,
      );
      if (nuovo != null) {
        await _salvaIlToken(nuovo);
        return nuovo;
      }
    }
    if (risposta.stato == 400 || risposta.stato == 401) {
      /* Un rinnovo rifiutato puo' voler dire che un altro giro — la
       * sveglia di Android, in un altro motore — ha appena rinnovato lui, e
       * il refresh token vecchio non vale piu'. Si guarda nel portachiavi
       * prima di arrendersi. */
      final scritto = TokenWhoop.daQuelloCheCEra(
        await cassaforte.leggi(chiaveToken),
      );
      if (scritto != null && scritto.rinnovo != rinnovo) {
        _token = scritto;
        return scritto;
      }
      await _perdi();
      return null;
    }
    throw WhoopNonRisponde('rinnovo: ${risposta.stato}');
  }

  /* WHOOP non accetta piu' i token: il collegamento e' finito, e lo si
   * dice nella pagina. */
  Future<void> _perdi() async {
    _token = null;
    _ultimi = null;
    _perso = true;
    await cassaforte.cancella(chiaveToken);
    await cassaforte.cancella(chiaveDati);
    _avvisa();
  }

  // ─── Leggere ────────────────────────────────────────────────────────────

  /// Una GET all'API, col token buono; un 401 rinnova e riprova una volta.
  Future<Object?> _prendi(String via, {Map<String, String>? query}) async {
    for (var giro = 0; giro < 2; giro++) {
      final token = await _tokenBuono(forza: giro > 0);
      if (token == null) throw const WhoopNonRisponde('scollegato');
      final http.Response risposta;
      try {
        risposta = await _rete
            .get(
              Uri.parse('$apiWhoop$via').replace(queryParameters: query),
              headers: {'authorization': 'Bearer ${token.accesso}'},
            )
            .timeout(const Duration(seconds: 20));
      } catch (errore) {
        throw WhoopNonRisponde('$errore');
      }
      if (risposta.statusCode == 401 && giro == 0) continue;
      if (risposta.statusCode != 200) {
        throw WhoopNonRisponde('$via: ${risposta.statusCode}');
      }
      try {
        return jsonDecode(risposta.body);
      } catch (_) {
        throw WhoopNonRisponde('$via: risposta illeggibile');
      }
    }
    throw const WhoopNonRisponde('token rifiutato');
  }

  /// Prende i dati da WHOOP, se e' ora (un quarto d'ora dall'ultima volta)
  /// o se [forza]. Torna gli ultimi dati che si hanno: quelli nuovi, o
  /// quelli di prima se WHOOP non risponde. `null` se scollegato.
  Future<DatiWhoop?> aggiorna({bool forza = false}) async {
    await carica();
    if (!collegato) return null;
    final ultimi = _ultimi;
    if (!forza &&
        ultimi != null &&
        _adesso().difference(ultimi.preso) < ogniQuantoWhoop) {
      return ultimi;
    }
    return _inCorso ??= _prendiTutto().whenComplete(() => _inCorso = null);
  }

  Future<DatiWhoop?> _prendiTutto() async {
    /* Ognuna per conto suo: uno scope negato o una via che non risponde
     * lasciano vuota solo la sua scheda. */
    var andate = 0;
    Future<Object?> una(String via, int quanti) async {
      try {
        final r = await _prendi(via, query: {'limit': '$quanti'});
        andate++;
        return r;
      } on WhoopNonRisponde {
        return null;
      }
    }

    final recuperi = await una('/v2/recovery', 7);
    final cicli = await una('/v2/cycle', 2);
    final sonni = await una('/v2/activity/sleep', 5);
    final allenamenti = await una('/v2/activity/workout', 5);
    if (!collegato) return null;
    if (andate == 0) return _ultimi;
    final dati = DatiWhoop.dalleRisposte(
      preso: _adesso(),
      recuperi: recuperi,
      cicli: cicli,
      sonni: sonni,
      allenamenti: allenamenti,
    );
    _ultimi = dati;
    try {
      await cassaforte.scrivi(chiaveDati, jsonEncode(dati.inJson()));
    } catch (_) {}
    _avvisa();
    return dati;
  }

  // ─── Scollegare ─────────────────────────────────────────────────────────

  /// Toglie l'accesso: chiede a WHOOP di revocarlo, e cancella token e dati
  /// dal telefono anche se WHOOP non risponde.
  Future<void> scollega() async {
    await carica();
    final token = _token;
    if (token != null) {
      try {
        await _rete
            .delete(
              Uri.parse('$apiWhoop/v2/user/access'),
              headers: {'authorization': 'Bearer ${token.accesso}'},
            )
            .timeout(const Duration(seconds: 10));
      } catch (_) {
        /* Il token resta valido fino alla scadenza, e senza il refresh
         * token, cancellato qui, nessuno lo rinnova. */
      }
    }
    _token = null;
    _ultimi = null;
    _perso = false;
    await cassaforte.cancella(chiaveToken);
    await cassaforte.cancella(chiaveDati);
    await cassaforte.cancella(chiaveAttesa);
    _avvisa();
  }
}

Future<bool> _apriNelNavigatore(Uri dove) async {
  try {
    return await launchUrl(dove, mode: LaunchMode.externalApplication);
  } catch (_) {
    return false;
  }
}
