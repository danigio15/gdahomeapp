/// Le prove del servitore: la plancia vera servita a un browser, passando dal
/// ponte.
///
/// Il browser qui e' `HttpClient` e `WebSocket` di `dart:io`, e dall'altra
/// parte c'e' il ponte finto, che sa servire file con `ponte/http`. Quello
/// che si prova: i file arrivano dal ponte una volta sola e poi dal disco, la
/// pagina ha in testa le premesse giuste, la porta ha la sua chiave, e il
/// WebSocket della pagina parla Home Assistant coi numeri suoi mentre sul filo
/// passano quelli del filo.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/pannello.dart';
import 'package:gdahome/plancia/servitore.dart';
import 'package:gdahome/ponte/filo.dart';

import '../ponte/ponte_finto.dart';

const _base = '/dashboardmodern_static/abc123';
const _pagina =
    '<!DOCTYPE html><html lang="it"><head><link rel="stylesheet" '
    'href="./dashboard-runtime-it.css"></head><body>la plancia</body></html>';
const _modulo =
    'export const uno = 1;\n'
    '// un modulo della plancia, lungo abbastanza da essere compresso\n';

/// I moduli della pagina finta, come li scrive la plancia vera: quattro righe
/// `modulepreload`, relative alla cartella della pagina.
const _iSuoiModuli = ['uno', 'due', 'tre', 'quattro'];

String _laPaginaColSuoElenco([List<String> quali = _iSuoiModuli]) => [
  '<!DOCTYPE html><html lang="it"><head>',
  ...quali.map((q) => '<link rel="modulepreload" href="../src/core/$q.js">'),
  '<link rel="stylesheet" href="./dashboard-runtime-it.css">',
  '</head><body>la plancia</body></html>',
].join('\n');

void main() {
  late PonteFinto ponte;
  late Filo filo;
  late Directory cartella;
  late Servitore servitore;
  final cliente = HttpClient();

  setUp(() async {
    ponte = await PonteFinto.alza();
    ponte.file['$_base/legacy/dashboard.html'] = (
      'text/html; charset=utf-8',
      utf8.encode(_pagina),
    );
    ponte.file['$_base/src/core/uno.js'] = (
      'text/javascript; charset=utf-8',
      utf8.encode(_modulo),
    );
    ponte.file['/dashboardmodern_static/avatars/1.png'] = (
      'image/png',
      [137, 80, 78, 71, 0, 1, 2, 3],
    );
    /* Una foto di casa col nome che le ha dato chi l'ha scattata. */
    ponte.file['/local/mia auto.png'] = (
      'image/png',
      [137, 80, 78, 71, 4, 5, 6, 7],
    );
    filo = Filo.fisso(
      indirizzo: ponte.indirizzo,
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
      attesaMassima: const Duration(milliseconds: 80),
    );
    await filo.apri();
    cartella = await Directory.systemTemp.createTemp('servitore-');
    servitore = Servitore(filo: () => filo, cartella: cartella);
    await servitore.alza();
  });

  test('sul telefono la porta è sempre quella, e se è occupata si prende la vicina', () async {
    /* Un browser tiene quello che una pagina si salva per **origine**, e
       * l'origine e' fatta anche dalla porta: con una porta a caso a ogni
       * avvio la plancia ripartiva ogni volta senza la sua configurazione. */
    final suaCartella = await Directory.systemTemp.createTemp('porta-');
    final primo = Servitore(filo: () => filo, cartella: suaCartella);
    final secondo = Servitore(filo: () => filo, cartella: suaCartella);
    try {
      await primo.alza(porta: portaDiCasa);
      expect(primo.porta, greaterThanOrEqualTo(portaDiCasa));
      expect(primo.porta, lessThan(portaDiCasa + porteDaProvare));

      /* Occupata: la prossima, non una a caso. */
      await secondo.alza(porta: portaDiCasa);
      expect(secondo.porta, primo.porta + 1);
    } finally {
      await primo.spegni();
      await secondo.spegni();
      await suaCartella.delete(recursive: true);
    }
  });

  tearDown(() async {
    await servitore.spegni();
    await filo.chiudi();
    await ponte.spegni();
    await cartella.delete(recursive: true);
  });

  /// Come bussa la pagina: col biscotto della chiave, che il browser mette
  /// da se' dopo la prima volta. Con [senzaChiave] si bussa come chiunque
  /// altro.
  Future<(int, String, List<int>)> prendi(
    String percorso, {
    bool senzaChiave = false,
    String? query,
  }) async {
    final richiesta = await cliente.getUrl(
      servitore.radice.replace(path: percorso, query: query),
    );
    if (!senzaChiave) {
      richiesta.cookies.add(Cookie('gdahome', servitore.chiave));
    }
    final risposta = await richiesta.close();
    final byte = await risposta.fold<List<int>>(
      [],
      (tutti, pezzo) => tutti..addAll(pezzo),
    );
    return (
      risposta.statusCode,
      risposta.headers.contentType?.toString() ?? '',
      byte,
    );
  }

  PannelloDellaPlancia pannello() => PannelloDellaPlancia(
    percorso: 'dashboardmodern',
    titolo: 'DashboardModern',
    base: _base,
    istanza: 'e1',
    profilo: 'primary',
    primario: true,
    varianti: const ['dashboard.html'],
  );

  test(
    'la pagina sa quanto prendono le barre del telefono, e ci si tiene fuori',
    () async {
      /* Prima le due bande le teneva l'app, intorno al riquadro: la plancia
       * sembrava una pagina dentro una cornice, e sopra e sotto l'aria era
       * doppia. Adesso il riquadro arriva ai bordi e le misure le sa la
       * pagina. */
      servitore.margini = (alto: 37, basso: 24);
      final dove = servitore.paginaDi(pannello());
      final richiesta = await cliente.getUrl(dove);
      final risposta = await richiesta.close();
      final byte = await risposta.fold<List<int>>(
        [],
        (tutti, pezzo) => tutti..addAll(pezzo),
      );
      final testo = utf8.decode(byte);

      expect(testo, contains('--gdahome-alto:37px'));
      expect(testo, contains('--gdahome-basso:24px'));
      /* Il contenuto comincia sotto l'orologio e finisce sopra i tasti, e la
       * barra della plancia si appoggia sopra i tasti.
       *
       * Il margine in cima va al **corpo**: `.app` nella pagina non esiste
       * — e' un guscio di una plancia piu' vecchia, rimasto nel foglio di
       * stile — quindi la regola di prima non colpiva niente e la testata
       * finiva sotto l'orologio. */
      expect(testo, contains('html body{padding-top:var(--gdahome-alto)'));
      expect(testo, isNot(contains('.app{padding-top')));
      /* In fondo non si scrive niente di nostro: il numero si mette **nella
       * variabile della plancia**, e i suoi numeri li fa lei — la barra a
       * `18 + fondo`, la riserva a `112 + fondo`, la maniglia a `6 + fondo`,
       * e lo `scroll-padding-bottom`, che e' quello che fa fermare sopra la
       * barra anche chi arriva con un salto.
       *
       * Qui prima stavano ricopiati i suoi numeri — 112, 40, 8 — e ricopiati
       * male: la barra la mettevamo dieci punti piu' in basso di dove la mette
       * lei, dentro la sua riserva, e quei dieci punti diventavano una
       * striscia di niente sotto l'ultima riga di ogni pagina. */
      expect(testo, contains('--dm-fondo-di-sistema'));
      expect(
        testo,
        contains('var mio=24;'),
        reason: 'il numero è quello che ha misurato Flutter',
      );
      expect(
        testo,
        isNot(contains('padding-bottom')),
        reason: 'la riserva in fondo la decide la plancia',
      );
      expect(
        testo,
        isNot(contains('bottom:calc(var(--gdahome-basso)')),
        reason: 'dove sta la barra lo decide la plancia',
      );
      /* Mai al ribasso, e riscritto quando lei rifà il suo conto. */
      expect(testo, contains('if(suo()>=mio)return'));
      expect(testo, contains('MutationObserver'));
      expect(testo, contains('"resize"'));
      /* Lo stile sta **in fondo**, dopo il foglio della plancia: fra due
       * `!important` della stessa forza vince l'ultimo che si legge, e
       * messo in testa perdeva — la barra della plancia finiva sotto i
       * tasti del telefono. */
      expect(
        testo.indexOf('gdahome-misure'),
        greaterThan(testo.indexOf('dashboard-runtime')),
      );
    },
  );

  test(
    'ogni plancia ha il suo indirizzo, e la prima tiene quello di sempre',
    () async {
      /* La pagina non legge quel pezzo — le premesse le mette il servitore — e
     * serve a una cosa sola: **essere un indirizzo diverso**. Chi guarda il
     * riquadro lo rifa' quando l'indirizzo cambia, e due plance dello stesso
     * ponte hanno gli stessi file e la stessa pagina: senza, scegliere l'altra
     * plancia non cambierebbe niente a schermo. */
      final prima = servitore.paginaDi(pannello());
      expect(prima.queryParameters.containsKey('plancia'), isFalse);

      final altra = servitore.paginaDi(
        PannelloDellaPlancia(
          percorso: 'gdahome',
          titolo: 'Casa al mare',
          base: _base,
          istanza: 'gdahome-casa-al-mare',
          profilo: 'casa-al-mare',
          primario: false,
          varianti: const ['dashboard.html'],
        ),
      );
      expect(altra.queryParameters['plancia'], 'casa-al-mare');
      expect(altra, isNot(prima));
      /* Ma la chiave c'e' ancora: da qui non passa niente senza. */
      expect(altra.queryParameters['ingresso'], servitore.chiave);
      /* E il servitore sa quale plancia sta servendo: e' da li' che la pagina
     * prende il suo profilo e la sua istanza. */
      expect(servitore.pannello!.profilo, 'casa-al-mare');
    },
  );

  test('ogni casa ha il suo indirizzo, e la pagina il suo cassetto', () async {
    /* Due case dello stesso telefono hanno la stessa pagina: senza la casa
     * nell'indirizzo cambiare casa non rifaceva il riquadro, e la pagina
     * teneva un deposito solo per tutte — con la testata della casa di
     * prima, scritta all'avvio. */
    final senza = servitore.paginaDi(pannello());
    expect(senza.queryParameters.containsKey('casa'), isFalse);
    final dove = servitore.paginaDi(pannello(), casa: 'casa_0a1b');
    expect(dove.queryParameters['casa'], 'casa_0a1b');
    expect(dove.queryParameters['ingresso'], servitore.chiave);
    expect(dove, isNot(senza));

    final richiesta = await cliente.getUrl(dove);
    final risposta = await richiesta.close();
    final byte = await risposta.fold<List<int>>(
      [],
      (tutti, pezzo) => tutti..addAll(pezzo),
    );
    final testo = utf8.decode(byte);
    expect(
      testo,
      contains('window.__DASHBOARDMODERN_INSTANCE__="e1-casa_0a1b";'),
    );
    expect(testo, contains('var da="cd_e1_",a="cd_e1-casa_0a1b_"'));
  });

  test('la pagina arriva dal ponte, con le premesse in testa e la chiave '
      'nell\'indirizzo', () async {
    final dove = servitore.paginaDi(pannello());
    expect(
      dove.toString(),
      'http://127.0.0.1:${servitore.porta}$_base/legacy/dashboard.html'
      '?ingresso=${servitore.chiave}',
    );
    expect(servitore.chiave, hasLength(32));

    /* La prima volta la chiave sta nell'indirizzo e nessun biscotto
       * ancora: lo mette la risposta. */
    final richiesta = await cliente.getUrl(dove);
    final risposta = await richiesta.close();
    final byte = await risposta.fold<List<int>>(
      [],
      (tutti, pezzo) => tutti..addAll(pezzo),
    );
    expect(risposta.statusCode, 200);
    expect(risposta.headers.contentType.toString(), startsWith('text/html'));
    final biscotto = risposta.cookies.singleWhere(
      (uno) => uno.name == 'gdahome',
    );
    expect(biscotto.value, servitore.chiave);
    expect(biscotto.httpOnly, isTrue);
    /* Niente che vieti di mostrarla in un riquadro: nel collaudo sta in
       * un riquadro dentro l'app web. */
    expect(risposta.headers.value('x-frame-options'), isNull);

    final testo = utf8.decode(byte);
    /* Lo script sta subito dopo `<head>`, prima del foglio di stile. */
    final dopoLaTesta = testo.indexOf('<head>') + '<head>'.length;
    expect(
      testo.substring(dopoLaTesta),
      startsWith('<script>window.__DASHBOARDMODERN_HOSTED__=true;'),
    );
    /* Il WebSocket che la pagina trova va sempre al servitore, qualunque
       * indirizzo gli si dia. */
    expect(testo, contains('window.__DASHBOARDMODERN_BRIDGE_WS__=(function'));
    expect(testo, contains('location.host+"/api/websocket"'));
    expect(testo, contains('Cucita.OPEN=1;'));
    expect(testo, contains('window.__DASHBOARDMODERN_INSTANCE__="e1";'));
    expect(testo, contains('window.__DASHBOARDMODERN_PROFILE__="primary";'));
    expect(testo, contains('window.__DASHBOARDMODERN_PRIMARY__=true;'));
    expect(testo, contains('window.__DASHBOARDMODERN_LOCALE__="it";'));
    expect(testo, contains('la plancia'));
  });

  test(
    'senza la chiave non si ottiene niente: né file, né chiamate, né filo',
    () async {
      final (pagina, _, _) = await prendi(
        '$_base/legacy/dashboard.html',
        senzaChiave: true,
      );
      expect(pagina, 403);
      final (sbagliata, _, _) = await prendi(
        '$_base/legacy/dashboard.html',
        senzaChiave: true,
        query: 'ingresso=nonlaso',
      );
      expect(sbagliata, 403);
      final (modulo, _, _) = await prendi(
        '$_base/src/core/uno.js',
        senzaChiave: true,
      );
      expect(modulo, 403);
      final (api, _, _) = await prendi('/api/states', senzaChiave: true);
      expect(api, 403);
      expect(ponte.commissioni, isEmpty);

      await expectLater(
        WebSocket.connect('ws://127.0.0.1:${servitore.porta}/api/websocket'),
        throwsA(isA<WebSocketException>()),
      );

      /* Sul telefono la radice non porta da nessuna parte: la chiave non si
       * chiede a nessuno. */
      final (radice, _, _) = await prendi('/', senzaChiave: true);
      expect(radice, 403);
    },
  );

  test(
    'un file si chiede al ponte una volta sola, poi sta sul disco',
    () async {
      final (stato, tipo, byte) = await prendi('$_base/src/core/uno.js');
      expect(stato, 200);
      expect(tipo, startsWith('text/javascript'));
      expect(utf8.decode(byte), _modulo);
      expect(ponte.commissioni, hasLength(1));
      expect(ponte.commissioni.single['percorso'], '$_base/src/core/uno.js');
      expect(ponte.commissioni.single['metodo'], 'GET');

      /* La seconda volta il ponte non lo vede nemmeno. */
      final (stato2, _, byte2) = await prendi('$_base/src/core/uno.js');
      expect(stato2, 200);
      expect(utf8.decode(byte2), _modulo);
      expect(ponte.commissioni, hasLength(1));
      expect(
        File('${cartella.path}$_base/src/core/uno.js').existsSync(),
        isTrue,
      );
    },
  );

  test(
    'lo stesso file chiesto da più parti insieme si chiede una volta',
    () async {
      final tutte = await Future.wait([
        for (var i = 0; i < 6; i += 1) prendi('$_base/src/core/uno.js'),
      ]);
      expect(tutte.every((una) => una.$1 == 200), isTrue);
      expect(ponte.commissioni, hasLength(1));
    },
  );

  test('un\'immagine arriva com\'è, e un file che non c\'è è un 404', () async {
    final (stato, tipo, byte) = await prendi(
      '/dashboardmodern_static/avatars/1.png',
    );
    expect(stato, 200);
    expect(tipo, 'image/png');
    expect(byte, [137, 80, 78, 71, 0, 1, 2, 3]);

    final (mancante, _, _) = await prendi('$_base/src/core/due.js');
    expect(mancante, 404);
    /* Un 404 non si tiene sul disco: domani potrebbe esserci. */
    expect(
      File('${cartella.path}$_base/src/core/due.js').existsSync(),
      isFalse,
    );
  });

  test('la pagina del ritratto la fa il servitore, non il ponte', () async {
    /* E' una pagina **nostra**, messa di fianco ai file della plancia perche'
     * e' li' che va a prendere il compositore che disegna la faccia. Al ponte
     * non c'e': chiedergliela vorrebbe dire un 404 al posto di un ritratto. */
    final (stato, tipo, corpo) = await prendi(
      '$_base/gdahome-ritratto.html',
      query: 'persona=donna&carnagione=media',
    );
    expect(stato, 200);
    expect(tipo, startsWith('text/html'));
    final scritto = utf8.decode(corpo);
    expect(scritto, contains('person-avatar-section.js'));
    /* Relativo apposta: la pagina sta di fianco ai moduli, e cosi' vale sia
     * sul telefono sia nel browser, dove davanti c'e' il prefisso dell'app. */
    expect(scritto, contains('"./src/sections/person-avatar-section.js"'));
    expect(ponte.commissioni, isEmpty);
  });

  test('la porta della Configurazione apre la pagina della dashboard, non una '
      'nostra', () async {
    final dove = servitore.paginaDi(pannello());
    final richiesta = await cliente.getUrl(dove);
    final risposta = await richiesta.close();
    final byte = await risposta.fold<List<int>>(
      [],
      (tutti, pezzo) => tutti..addAll(pezzo),
    );
    final testo = utf8.decode(byte);

    /* La voce nella barra in fondo alla plancia se ne va: la Config si apre
       * dal menu dell'app. */
    expect(testo, contains('#tab-config,.tab[data-tab="config"]'));
    /* La **pagina** resta: dentro ci stanno la tessera che apre l'editor,
       * il Tema, la Tavolozza, la Barra, «Sostieni il progetto». Nasconderla
       * voleva dire perderle. */
    expect(testo, isNot(contains('#page-config{display:none')));
    expect(testo, isNot(contains(',#page-config,')));
    /* Una sola tessera nascosta: le Segnalazioni, che nell'app passano dal
       * centralino e non dall'integrazione. */
    expect(testo, contains('#page-config #dm-tkt-card{display:none'));
    /* Le due maniglie: si apre premendo la sua linguetta, e si torna
       * dov'era. */
    expect(testo, contains('window.gdahomeApriLaConfig=function()'));
    expect(testo, contains('window.gdahomeTornaDallaConfig=function()'));
    expect(testo, contains('getElementById("page-config")'));
    /* Chi lascia aperto l'editor di una tessera e tocca «Plancia» vuole la
       * plancia, non aspettare. Una finestra aperta sopra la pagina si mangia
       * il tocco sulla linguetta della barra, e il ritorno riprovava per tre
       * secondi e mezzo prima di arrendersi: sembrava un tasto rotto. Adesso
       * si chiude prima quello che sta sopra, e **prima** di toccare la
       * linguetta. */
    expect(testo, contains('var chiudiQuelloChEAperto=function()'));
    /* E si cerca la classe **giusta**. Qui c'era `#editor-modal.show`, che
       * prendeva l'Editor e nient'altro, e `.modal.show`, che in quella pagina
       * non esiste: le finestre della plancia sono `.modal-wrapper`. Con la
       * classe sbagliata non si chiudeva niente, e uscire dall'Editor dal menu
       * lasciava la plancia sotto un velo che si prendeva tutti i tocchi. */
    expect(testo, contains('.modal-wrapper.show'));
    expect(testo, contains('dialog[open]'));
    /* Le due che la pagina crea si buttano via, come fa il loro ✕. */
    expect(testo, contains('finestra.id==="editor-modal"'));
    expect(testo, contains('finestra.id==="edit-plancia-modal"'));
    /* E lo stile scritto nell'elemento si cancella: vince su qualunque
       * classe, e senza questo il velo restava su. */
    expect(testo, contains('finestra.style.pointerEvents=""'));
    expect(testo, contains('finestra.style.visibility=""'));
    final chiude = testo.indexOf('chiudiQuelloChEAperto();');
    final tocca = testo.indexOf('var voce=laVoce(dove)||laVoce("home");');
    expect(chiude, greaterThan(0), reason: 'il ritorno non chiude niente');
    expect(
      chiude,
      lessThan(tocca),
      reason: 'chiude dopo aver toccato la linguetta: troppo tardi',
    );
    /* Il tema, la tavolozza e la barra non si scrivono piu' nel deposito
       * della pagina: quelle scelte sono delle sue tessere, e riscriverle a
       * ogni caricamento le cancellava. */
    expect(testo, isNot(contains('cd_theme')));
    expect(testo, isNot(contains('cd_navbar_mode')));
    expect(testo, isNot(contains('cd_tavolozza')));
  });

  test('un percorso strano non arriva al ponte', () async {
    final (uno, _, _) = await prendi('/dashboardmodern_static/../etc/passwd');
    expect(uno, anyOf(400, 404));
    final (due, _, _) = await prendi('/altrove/x.js');
    expect(due, 404);
    expect(ponte.commissioni, isEmpty);
  });

  test(
    'un nome con lo spazio dentro è un nome, non un percorso strano',
    () async {
      /* Sotto `/local/` stanno le foto di casa, e i nomi li sceglie chi le ha
     * scattate: «mia auto.png» arriva come `mia%20auto.png`. Prima era
     * «percorso strano» e 400, e la foto dell'auto non si vedeva. */
      final (stato, _, corpo) = await prendi('/local/mia auto.png');
      expect(stato, 200);
      expect(corpo, isNotEmpty);
      expect(ponte.commissioni.last['percorso'], '/local/mia auto.png');
    },
  );

  test('le chiamate REST passano dal ponte, col metodo e col corpo', () async {
    final richiesta = await cliente.postUrl(
      servitore.radice.replace(
        path: '/api/services/light/turn_on',
        query: 'a=1',
      ),
    );
    richiesta.cookies.add(Cookie('gdahome', servitore.chiave));
    richiesta.headers.contentType = ContentType.json;
    /* La pagina ospitata manda un segno vuoto: non deve arrivare da nessuna
     * parte. */
    richiesta.headers.set('authorization', 'Bearer ');
    richiesta.write('{"entity_id":"light.sala"}');
    final risposta = await richiesta.close();
    final corpo = await risposta.transform(utf8.decoder).join();
    expect(risposta.statusCode, 200);
    final eco = jsonDecode(corpo) as Map<String, dynamic>;
    expect(eco['metodo'], 'POST');
    expect(eco['percorso'], '/api/services/light/turn_on?a=1');
    expect(eco['tipo'], startsWith('application/json'));
    expect(eco['corpo'], '{"entity_id":"light.sala"}');
    expect(ponte.commissioni.single.containsKey('intestazioni'), isFalse);
  });

  group('il WebSocket della pagina', () {
    Future<WebSocket> apri({Servitore? di}) => WebSocket.connect(
      'ws://127.0.0.1:${(di ?? servitore).porta}/api/websocket',
      headers: {'cookie': 'gdahome=${(di ?? servitore).chiave}'},
    );

    test('parla Home Assistant coi numeri della pagina, e sul filo passano '
        'quelli del filo', () async {
      /* Il filo ha gia' mandato qualcosa: i numeri del filo e quelli
         * della pagina non possono coincidere. */
      await filo.chiedi({'type': 'get_states'});
      await filo.chiedi({'type': 'get_states'});

      final presa = await apri();
      final arrivati = <Map<String, dynamic>>[];
      presa.listen(
        (dynamic testo) =>
            arrivati.add(jsonDecode(testo as String) as Map<String, dynamic>),
      );

      /* Come il ponte del pannello: `auth_ok` e basta, senza chiedere
         * niente. Un `auth` mandato lo stesso non fa niente. */
      await _finoA(() => arrivati.isNotEmpty);
      expect(arrivati.single['type'], 'auth_ok');
      presa.add(
        jsonEncode({
          'type': 'auth',
          'access_token': '__dashboardmodern_hosted__',
        }),
      );
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(arrivati, hasLength(1));
      /* Perche' i conti tornino sotto: due messaggi prima di quelli della
         * pagina. */
      arrivati.add(const {'type': 'auth_required'});

      final primaDellaPagina = ponte.arrivati.length;
      presa.add(jsonEncode({'id': 1, 'type': 'get_states'}));
      presa.add(
        jsonEncode({
          'id': 2,
          'type': 'subscribe_events',
          'event_type': 'state_changed',
        }),
      );
      await _finoA(() => arrivati.length == 4);
      final risposte = arrivati.sublist(2);
      expect(risposte.map((una) => una['id']), containsAll([1, 2]));
      expect(
        risposte.every(
          (una) => una['type'] == 'result' && una['success'] == true,
        ),
        isTrue,
      );

      /* Sul filo sono passati con numeri del filo: dopo quelli gia' usati
         * dal filo per conto suo, e diversi da quelli della pagina. */
      final sulFilo = ponte.arrivati.sublist(primaDellaPagina);
      expect(sulFilo.map((uno) => uno['type']), [
        'get_states',
        'subscribe_events',
      ]);
      final numeriDelFilo = sulFilo.map((uno) => uno['id'] as int).toList();
      expect(numeriDelFilo, [3, 4]);

      /* Un evento sulla sottoscrizione torna col numero della pagina. */
      final numeroDellaSottoscrizione = numeriDelFilo.last;
      ponte.cambia(numeroDellaSottoscrizione, 'light.sala', {'state': 'on'});
      await _finoA(() => arrivati.length == 5);
      expect(arrivati.last['type'], 'event');
      expect(arrivati.last['id'], 2);

      /* La disdetta traduce il numero, e dopo non arriva piu' niente. */
      presa.add(
        jsonEncode({'id': 3, 'type': 'unsubscribe_events', 'subscription': 2}),
      );
      await _finoA(() => arrivati.length == 6);
      expect(arrivati.last['id'], 3);
      final disdetta = ponte.arrivati.lastWhere(
        (uno) => uno['type'] == 'unsubscribe_events',
      );
      expect(disdetta['subscription'], numeroDellaSottoscrizione);
      ponte.cambia(numeroDellaSottoscrizione, 'light.sala', {'state': 'off'});
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(arrivati, hasLength(6));

      await presa.close();
    });

    test(
      'quando il filo cade la pagina si vede chiudere il WebSocket',
      () async {
        final presa = await apri();
        final arrivati = <Map<String, dynamic>>[];
        final chiusa = Completer<void>();
        presa.listen(
          (dynamic testo) =>
              arrivati.add(jsonDecode(testo as String) as Map<String, dynamic>),
          onDone: chiusa.complete,
        );
        await _finoA(() => arrivati.isNotEmpty);
        expect(arrivati.single['type'], 'auth_ok');

        await ponte.buttaGiu();
        await chiusa.future.timeout(const Duration(seconds: 5));
        expect(presa.closeCode, WebSocketStatus.goingAway);
      },
    );

    test(
      'se il filo non torna, la pagina lo viene a sapere invece di aspettare '
      'per sempre',
      () async {
        await filo.chiudi();
        final senzaFilo = Servitore(filo: () => null, cartella: cartella);
        await senzaFilo.alza();
        final presa = await apri(di: senzaFilo);
        final arrivati = <Map<String, dynamic>>[];
        presa.listen(
          (dynamic testo) =>
              arrivati.add(jsonDecode(testo as String) as Map<String, dynamic>),
        );
        /* Venti secondi sarebbero troppi per una prova: si guarda solo che
         * non dica `auth_ok` con un filo che non c'e'. */
        await Future<void>.delayed(const Duration(milliseconds: 300));
        expect(arrivati.where((uno) => uno['type'] == 'auth_ok'), isEmpty);
        await senzaFilo.spegni();
      },
    );
  });
  test('la plancia che non è tua lo dice in una pagina che si legge', () async {
    /* Quello che si vedeva prima era una riga di testo a monospazio
       * incollata in cima, sotto l'orologio del telefono, che diceva anche
       * una bugia: «il ponte non ha risposto», proprio mentre il ponte aveva
       * risposto benissimo — aveva detto no.
       *
       * Questa pagina la vede chi ha un add-on di oggi e un'app di ieri:
       * l'app nuova ha la sua schermata e viene prima. */
    ponte.nientePerTe = true;
    final (stato, tipo, byte) = await prendi('$_base/legacy/dashboard.html');
    final pagina = utf8.decode(byte);

    expect(stato, 403, reason: 'è un rifiuto, non un intoppo');
    expect(tipo, contains('text/html'));
    expect(pagina, contains('Non hai plance associate alla tua utenza'));
    expect(pagina, contains('Chi la vede'));
    expect(
      pagina,
      isNot(contains('il ponte non ha risposto')),
      reason: 'il ponte ha risposto: ha detto no',
    );
  });

  /* ─── Il pacco ─────────────────────────────────────────────────────────── */

  /// Mette nel ponte finto la pagina coi suoi moduli, e i moduli.
  void laPlanciaColSuoElenco([List<String> quali = _iSuoiModuli]) {
    ponte.file['$_base/legacy/dashboard.html'] = (
      'text/html; charset=utf-8',
      utf8.encode(_laPaginaColSuoElenco(quali)),
    );
    for (final quale in quali) {
      if (quale == 'manca') continue;
      ponte.file['$_base/src/core/$quale.js'] = (
        'text/javascript; charset=utf-8',
        utf8.encode('$_modulo// sono $quale\n'),
      );
    }
  }

  Future<String> laPagina() async {
    final richiesta = await cliente.getUrl(servitore.paginaDi(pannello()));
    final risposta = await richiesta.close();
    final byte = await risposta.fold<List<int>>(
      [],
      (tutti, pezzo) => tutti..addAll(pezzo),
    );
    return utf8.decode(byte);
  }

  String sulDisco(String quale) => '${cartella.path}$_base/src/core/$quale.js';

  test('la pagina porta avanti i suoi moduli, e in un pacco solo', () async {
    /* Il cuore di tutto il lavoro. La pagina dice quali file vuole subito, e
     * il servitore li va a prendere **prima** che il browser li chieda, tutti
     * in una commissione. Da fuori casa la plancia a freddo ne chiede
     * trecentosettantanove, e ogni giro passa dal centralino: in pacchi da
     * quaranta sono nove giri invece di trecentosettantanove. */
    laPlanciaColSuoElenco();
    expect(await laPagina(), contains('la plancia'));

    await _finoA(() => ponte.pacchi.isNotEmpty);
    await _finoA(
      () => _iSuoiModuli.every((quale) => File(sulDisco(quale)).existsSync()),
    );

    expect(ponte.pacchi.length, 1, reason: 'quattro moduli, un giro');
    expect(
      ponte.pacchi.single,
      _iSuoiModuli.map((quale) => '$_base/src/core/$quale.js').toList(),
      reason: 'nell\'ordine in cui la pagina li scrive',
    );

    /* E le commissioni singole sono **una**: la pagina. I moduli sono passati
     * dal pacco, che fra le commissioni non conta. */
    expect(ponte.commissioni.map((detto) => detto['percorso']).toList(), [
      '$_base/legacy/dashboard.html',
    ]);
  });

  test('e poi il browser li trova sul disco, senza tornare sul filo', () async {
    laPlanciaColSuoElenco();
    await laPagina();
    await _finoA(
      () => _iSuoiModuli.every((quale) => File(sulDisco(quale)).existsSync()),
    );
    final finoAQui = ponte.commissioni.length;

    for (final quale in _iSuoiModuli) {
      final (stato, tipo, byte) = await prendi('$_base/src/core/$quale.js');
      expect(stato, 200, reason: quale);
      expect(tipo, startsWith('text/javascript'));
      expect(utf8.decode(byte), contains('sono $quale'));
    }
    expect(
      ponte.commissioni.length,
      finoAQui,
      reason: 'il filo non lo ha più toccato nessuno',
    );
  });

  test('quelli che nel pacco non ci stanno si richiedono, e finisce', () async {
    /* Il ponte riempie il pacco fino a trecentottantaquattro kilobyte e poi
     * smette: quello che non ci sta non torna, e chi l'ha chiesto lo
     * richiede. Qui il pacco sta pieno con un file, cosi' si vedono tutti i
     * giri — e si vede che finiscono. */
    ponte.paccoFinoA = 1;
    laPlanciaColSuoElenco();
    await laPagina();
    await _finoA(
      () => _iSuoiModuli.every((quale) => File(sulDisco(quale)).existsSync()),
    );
    expect(ponte.pacchi.length, _iSuoiModuli.length);
    /* Ogni giro e' piu' corto del precedente: e' la ragione per cui finisce. */
    expect(ponte.pacchi.map((uno) => uno.length).toList(), [4, 3, 2, 1]);
  });

  test(
    'un modulo che non c\'è torna col suo 404, e gli altri arrivano',
    () async {
      laPlanciaColSuoElenco(const ['uno', 'manca', 'due']);
      await laPagina();
      await _finoA(() => ponte.pacchi.isNotEmpty);
      await _finoA(
        () =>
            File(sulDisco('uno')).existsSync() &&
            File(sulDisco('due')).existsSync(),
      );

      final (stato, _, _) = await prendi('$_base/src/core/manca.js');
      expect(stato, 404);
      expect(
        File(sulDisco('manca')).existsSync(),
        isFalse,
        reason: 'non si tiene un 404',
      );
    },
  );

  /// Come [prendi], con le intestazioni: sia quelle che si mandano sia
  /// quelle che tornano.
  Future<HttpClientResponse> chiedi(
    String percorso, {
    Map<String, String> con = const {},
  }) async {
    final richiesta = await cliente.getUrl(
      servitore.radice.replace(path: percorso),
    );
    richiesta.cookies.add(Cookie('gdahome', servitore.chiave));
    con.forEach(richiesta.headers.set);
    final risposta = await richiesta.close();
    await risposta.drain<void>();
    return risposta;
  }

  test(
    'ogni casa ha il suo deposito: un file di una non si serve all\'altra',
    () async {
      /* Due case con la stessa versione della plancia hanno gli stessi
     * percorsi. Col deposito unico, il file preso dalla prima si serviva
     * anche alla seconda, qualunque cosa ci fosse dentro. */
      servitore.paginaDi(pannello(), casa: 'casa_uno');
      final (_, _, dallaPrima) = await prendi('$_base/src/core/uno.js');
      expect(utf8.decode(dallaPrima), _modulo);

      ponte.file['$_base/src/core/uno.js'] = (
        'text/javascript; charset=utf-8',
        utf8.encode('export const due = 2;\n'),
      );
      servitore.paginaDi(pannello(), casa: 'casa_due');
      final (stato, _, dallaSeconda) = await prendi('$_base/src/core/uno.js');
      expect(stato, 200);
      expect(utf8.decode(dallaSeconda), 'export const due = 2;\n');

      /* Due cartelle, e nessuna delle due in cima. */
      expect(servitore.deposito.path, contains('/case/'));
      expect(
        File('${cartella.path}$_base/src/core/uno.js').existsSync(),
        isFalse,
      );

      /* E tornando alla prima, il suo. */
      servitore.paginaDi(pannello(), casa: 'casa_uno');
      final (_, _, ancoraLaPrima) = await prendi('$_base/src/core/uno.js');
      expect(utf8.decode(ancoraLaPrima), _modulo);
    },
  );

  test('il nome della cartella di una casa è sempre un nome e basta', () {
    for (final casa in ['casa_0a1b', '../../su', 'a/b', '.', 'è casa']) {
      final nome = cartellaDellaCasa(casa);
      expect(nome, matches(RegExp(r'^[A-Za-z0-9_-]+$')), reason: casa);
    }
    expect(cartellaDellaCasa('a'), isNot(cartellaDellaCasa('b')));
  });

  test('il WebView richiede sempre, e col segno della casa', () async {
    /* Il WebView e' uno per tutte le case. Tenere un modulo «per sempre»
     * voleva dire che il file di una casa restava a rispondere anche per
     * l'altra, senza passare di qui. */
    servitore.paginaDi(pannello(), casa: 'casa_uno');
    final prima = await chiedi('$_base/src/core/uno.js');
    expect(prima.statusCode, 200);
    expect(prima.headers.value('cache-control'), 'no-cache');
    final segno = prima.headers.value('etag');
    expect(segno, isNotNull);

    /* Stessa casa, stesso segno: «uguale», senza nemmeno il file. */
    final dinuovo = await chiedi(
      '$_base/src/core/uno.js',
      con: {'if-none-match': segno!},
    );
    expect(dinuovo.statusCode, 304);
    expect(ponte.commissioni, hasLength(1));

    /* Un'altra casa: il segno non vale piu', e il file si rimanda. */
    servitore.paginaDi(pannello(), casa: 'casa_due');
    final altra = await chiedi(
      '$_base/src/core/uno.js',
      con: {'if-none-match': segno},
    );
    expect(altra.statusCode, 200);
    expect(altra.headers.value('etag'), isNot(segno));
  });

  test(
    'le foto di casa non si tengono: il nome lo sceglie chi le carica',
    () async {
      final (_, _, prima) = await prendi('/local/mia auto.png');
      expect(prima, [137, 80, 78, 71, 4, 5, 6, 7]);
      ponte.file['/local/mia auto.png'] = ('image/png', [137, 80, 78, 71, 9]);
      final (_, _, dopo) = await prendi('/local/mia auto.png');
      expect(dopo, [137, 80, 78, 71, 9]);
      final risposta = await chiedi('/local/mia auto.png');
      expect(risposta.headers.value('cache-control'), 'no-store');
      expect(Directory('${cartella.path}/local').existsSync(), isFalse);
    },
  );

  test('su questa porta non si registra nessun service worker', () async {
    /* Resterebbe li' anche per le pagine delle altre case. */
    final risposta = await chiedi(
      '$_base/src/core/uno.js',
      con: {'service-worker': 'script'},
    );
    expect(risposta.statusCode, 404);
    expect(ponte.commissioni, isEmpty);
  });

  test('la seconda volta non si chiede più niente', () async {
    /* Il percorso ha dentro l'impronta della plancia: quello che c'e' non
     * cambia mai, e un file preso una volta vale finche' esiste. Il pacco
     * serve al primo avvio, e al secondo non deve fare niente. */
    laPlanciaColSuoElenco();
    await laPagina();
    await _finoA(
      () => _iSuoiModuli.every((quale) => File(sulDisco(quale)).existsSync()),
    );
    expect(ponte.pacchi.length, 1);

    await laPagina();
    /* Un giro dal disco per ognuno: se `_portaAvanti` volesse chiedere
     * qualcosa, l'avrebbe già fatto prima di questi quattro. */
    for (final quale in _iSuoiModuli) {
      expect((await prendi('$_base/src/core/$quale.js')).$1, 200);
    }
    expect(ponte.pacchi.length, 1, reason: 'niente di nuovo da prendere');
  });
}

Future<void> _finoA(
  bool Function() condizione, {
  Duration entro = const Duration(seconds: 5),
}) async {
  final fine = DateTime.now().add(entro);
  while (DateTime.now().isBefore(fine)) {
    if (condizione()) return;
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
  throw StateError('l\'attesa è scaduta');
}
