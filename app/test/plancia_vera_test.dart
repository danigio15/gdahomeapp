/// Le prove della schermata della plancia: quando la pagina resta, e quando
/// si rifa'.
///
/// La pagina e' un WebView, e un WebView rifatto e' la plancia che si
/// riapre da capo: la pagina, i moduli, la configurazione, il velo. Qui il
/// WebView non c'e' — c'e' un riquadro finto che conta quante volte nasce e
/// quante muore — e quello che si prova e' quante volte lo si butta via.
///
/// Come in `portone_test.dart`, tutto quello che tocca la rete sta dentro
/// `runAsync`: il ponte finto e il filo vogliono il tempo vero.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/casa/impostazioni.dart';
import 'package:gdahome/plancia/pannello.dart';
import 'package:gdahome/plancia/servitore_qui/qui.dart';
import 'package:gdahome/ponte/filo.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/plancia_vera.dart';

import 'ponte/ponte_finto.dart';

/// La plancia vera, senza WebView: un servitore che non serve niente e un
/// riquadro che si conta.
class _PlanciaFinta extends FabbricaDellaPlancia {
  /// Quante volte e' nato un riquadro, e quante ne e' morto uno.
  int nati = 0;
  int morti = 0;

  @override
  Future<ServitoreDiQuestoSistema?> servitore(
    Filo? Function() filo, {
    String lingua = 'it',
  }) async => _ServitoreFinto();

  @override
  Widget riquadro(
    Uri pagina, {
    required Key chiave,
    required VoidCallback quandoCaricata,
    required void Function(String perche) quandoFallisce,
    bool ibrido = false,
    ({double alto, double basso}) margini = (alto: 0, basso: 0),
    void Function(String pagina)? quandoCambiaPagina,
    void Function()? quandoChiedeIlMenu,
    void Function(String foto)? quandoFotografaLaCasa,
  }) => _RiquadroFinto(
    key: chiave,
    pagina: pagina,
    fabbrica: this,
    caricata: quandoCaricata,
  );
}

class _ServitoreFinto implements ServitoreDiQuestoSistema {
  @override
  Uri paginaDi(PannelloDellaPlancia pannello, {String casa = ''}) => Uri.parse(
    'http://127.0.0.1:1${pannello.percorsoDellaPagina('it')}?casa=$casa',
  );

  @override
  Uri indirizzoDi(String percorso, {Map<String, String> domande = const {}}) =>
      Uri.parse('http://127.0.0.1:1$percorso');

  @override
  Future<void> spegni() async {}

  @override
  set leggera(bool valore) {}

  @override
  set margini(({double alto, double basso}) quanto) {}
}

/// Si dice caricato al primo fotogramma, come una pagina che arriva.
class _RiquadroFinto extends StatefulWidget {
  const _RiquadroFinto({
    super.key,
    required this.pagina,
    required this.fabbrica,
    required this.caricata,
  });
  final Uri pagina;
  final _PlanciaFinta fabbrica;
  final VoidCallback caricata;

  @override
  State<_RiquadroFinto> createState() => _RiquadroFintoState();
}

class _RiquadroFintoState extends State<_RiquadroFinto> {
  @override
  void initState() {
    super.initState();
    widget.fabbrica.nati += 1;
    WidgetsBinding.instance.addPostFrameCallback((_) => widget.caricata());
  }

  @override
  void dispose() {
    widget.fabbrica.morti += 1;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      Center(child: Text('LA PLANCIA ${widget.pagina}'));
}

/// Aspetta, nel tempo vero, che una condizione si avveri.
Future<void> _finoA(bool Function() condizione) async {
  final fine = DateTime.now().add(const Duration(seconds: 5));
  while (!condizione()) {
    if (DateTime.now().isAfter(fine)) throw StateError('l\'attesa è scaduta');
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
}

/// La schermata, ridisegnata a ogni cambiamento del collegamento: e' quello
/// che fa il portone, che qui non c'e'.
Widget _laSchermata(
  Collegamento collegamento,
  FabbricaDellaPlancia plancia,
  Impostazioni impostazioni,
) => MaterialApp(
  home: Scaffold(
    body: StreamBuilder<void>(
      stream: collegamento.cambiamenti,
      builder: (_, _) => PlanciaVera(
        collegamento: collegamento,
        fabbrica: plancia,
        impostazioni: impostazioni,
      ),
    ),
  ),
);

void main() {
  late PonteFinto ponte;
  late Collegamento collegamento;
  late Impostazioni impostazioni;

  /// Una casa aperta, con la sua plancia gia' letta.
  Future<void> apriLaCasa(WidgetTester tester) => tester.runAsync(() async {
    ponte = await PonteFinto.alza();
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();
    await archivio.aggiungi(
      nome: 'Casa',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      inCasa: ponte.indirizzo,
    );
    collegamento = Collegamento(
      archivio: archivio,
      sonda: Sonda(bussa: (dove) async => dove == ponte.indirizzo.salute),
    );
    await collegamento.apri();
    await _finoA(() => collegamento.pannelloLetto);
    impostazioni = Impostazioni(
      sulTelefono: true,
      android: true,
      dispensa: DispensaInMemoria(),
    );
    await impostazioni.carica();
  });

  Future<void> chiudiLaCasa(WidgetTester tester) => tester.runAsync(() async {
    await collegamento.chiudi();
    await ponte.spegni();
  });

  testWidgets('tornando dopo il riposo del filo la pagina è la stessa, '
      'non una rifatta', (tester) async {
    /* «Tempo di caricamento app lentissimo.» Dopo mezzo minuto in tasca il
     * filo va a riposo, e al ritorno si riapre: fin qui e' giusto. Ma la
     * schermata, per il tempo di riaprirlo, non sapeva piu' dove fosse la
     * plancia: scriveva «Cerco la plancia…» al posto della pagina, e la
     * pagina — il WebView — se ne andava. Al ritorno ne nasceva un'altra, e
     * la plancia ripartiva da zero. */
    await apriLaCasa(tester);
    final plancia = _PlanciaFinta();
    await tester.pumpWidget(_laSchermata(collegamento, plancia, impostazioni));
    await tester.pump();
    await tester.pump();
    expect(find.textContaining('LA PLANCIA'), findsOneWidget);
    expect(plancia.nati, 1);

    await tester.runAsync(collegamento.riposa);
    await tester.pump();
    expect(find.textContaining('Cerco la plancia'), findsNothing);
    expect(find.textContaining('LA PLANCIA'), findsOneWidget);
    /* La riga che dice «sto ricollegando»: la pagina resta, coi suoi dati. */
    expect(find.byType(LinearProgressIndicator), findsOneWidget);

    await tester.runAsync(() async {
      collegamento.sveglia();
      await _finoA(
        () => collegamento.comeVa == ComeVa.aperta && collegamento.dentro,
      );
    });
    await tester.pump();
    await tester.pump();

    expect(find.textContaining('LA PLANCIA'), findsOneWidget);
    expect(plancia.morti, 0, reason: 'la pagina è stata buttata via');
    expect(plancia.nati, 1, reason: 'la pagina è stata rifatta da capo');
    expect(find.byType(LinearProgressIndicator), findsNothing);

    await chiudiLaCasa(tester);
  });
}
