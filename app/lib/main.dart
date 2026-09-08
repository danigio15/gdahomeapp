/// L'app di casa.
///
/// Il portone tiene aperto **un** collegamento — una casa alla volta — e decide
/// cosa far vedere: la schermata per aggiungere una casa se non ce n'e'
/// nessuna, la home se c'e'. Tutto quello che le schermate sanno della rete
/// passa da li'.
library;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import 'casa/archivio_delle_case.dart';
import 'casa/cassaforte.dart';
import 'casa/collegamento.dart';
import 'ponte/centralino.dart';
import 'schermate/aggiungi_casa.dart';
import 'schermate/home.dart';
import 'schermate/le_case.dart';
import 'schermate/plancia_vera.dart';
import 'vestito/sfondo.dart';
import 'vestito/tema.dart';

/// Acceso solo nella versione costruita per il collaudo, con
/// `--dart-define=COLLAUDO=true`.
///
/// Serve a una cosa sola: **poter guardare l'app da fuori**. Flutter disegna
/// su una tela, quindi in una pagina web non c'e' nessun bottone da premere e
/// nessun testo da leggere per chi non ha gli occhi — un programma che guida
/// il browser, o una persona che usa un lettore di schermo. L'albero
/// dell'accessibilita' e' quello che li rimette, ed e' anche il motivo per cui
/// tenerlo acceso non e' un trucco da collaudo: e' la stessa cosa che serve a
/// chi l'app la usa senza vederla.
///
/// `bool.fromEnvironment` si decide quando si costruisce, non quando si gira:
/// nella versione che va sui telefoni questa riga non c'e' proprio.
const bool _perIlCollaudo = bool.fromEnvironment('COLLAUDO');

void main() {
  if (_perIlCollaudo) {
    WidgetsFlutterBinding.ensureInitialized();
    SemanticsBinding.instance.ensureSemantics();
  }
  runApp(const AppDiCasa());
}

class AppDiCasa extends StatelessWidget {
  const AppDiCasa({
    super.key,
    this.cassaforte,
    this.collegamento,
    this.plancia,
  });

  /// Sostituibili nelle prove, dove il portachiavi, la rete e il WebView non
  /// ci sono.
  final Cassaforte? cassaforte;
  final Collegamento? collegamento;
  final FabbricaDellaPlancia? plancia;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'gdahome',
      debugShowCheckedModeBanner: false,
      theme: temaChiaro(),
      darkTheme: temaScuro(),
      /* Il fondo vivo sta qui, sotto tutte le schermate e una volta sola: se
       * lo mettesse ogni pagina, gli aloni ripartirebbero da capo a ogni
       * cambio di pagina, e sarebbe un lampo invece di un cielo. */
      builder: (context, schermata) =>
          SfondoVivo(child: schermata ?? const SizedBox.shrink()),
      home: Portone(
        cassaforte: cassaforte,
        collegamento: collegamento,
        plancia: plancia,
      ),
    );
  }
}

class Portone extends StatefulWidget {
  const Portone({super.key, this.cassaforte, this.collegamento, this.plancia});

  final Cassaforte? cassaforte;
  final Collegamento? collegamento;
  final FabbricaDellaPlancia? plancia;

  @override
  State<Portone> createState() => _PortoneState();
}

class _PortoneState extends State<Portone> {
  late final Collegamento _collegamento;
  late final FabbricaDellaPlancia _plancia =
      widget.plancia ?? FabbricaDellaPlancia();
  bool _pronto = false;

  @override
  void initState() {
    super.initState();
    _collegamento =
        widget.collegamento ??
        Collegamento(
          archivio: ArchivioDelleCase(
            widget.cassaforte ?? const CassaforteDelSistema(),
          ),
        );
    _accendi();
  }

  Future<void> _accendi() async {
    if (!_collegamento.archivio.aperto) await _collegamento.archivio.apri();
    /* Una volta sola. Da li' in poi il collegamento si gestisce da solo — si
     * riconnette, cambia approdo, cambia casa — e riavviarlo a ogni
     * ricostruzione vorrebbe dire buttare giu' il filo ogni volta che gira lo
     * schermo. */
    if (!_collegamento.avviato) await _collegamento.apri();
    if (!mounted) return;
    setState(() => _pronto = true);
    _collegamento.cambiamenti.listen((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _collegamento.chiudi();
    super.dispose();
  }

  Future<void> _aggiungiUnaCasa() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (contesto) => AggiungiCasa(
          centralino: centralinoDiDifetto,
          archivio: _collegamento.archivio,
          quandoFatto: (_) async {
            Navigator.of(contesto).pop();
            await _collegamento.apri();
          },
        ),
      ),
    );
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    if (!_pronto) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_collegamento.archivio.vuoto) {
      return AggiungiCasa(
        centralino: centralinoDiDifetto,
        archivio: _collegamento.archivio,
        quandoFatto: (_) => _collegamento.apri(),
      );
    }
    return Home(
      collegamento: _collegamento,
      plancia: _plancia,
      vaiAlleCase: () async {
        await Navigator.of(context).push<void>(
          MaterialPageRoute(
            builder: (_) => LeCase(
              collegamento: _collegamento,
              aggiungiUnaCasa: _aggiungiUnaCasa,
            ),
          ),
        );
        if (mounted) setState(() {});
      },
    );
  }
}
