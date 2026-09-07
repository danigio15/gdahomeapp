/// L'app di casa.
///
/// Il portone tiene aperto **un** collegamento — una casa alla volta — e decide
/// cosa far vedere: la schermata per aggiungere una casa se non ce n'e'
/// nessuna, la home se c'e'. Tutto quello che le schermate sanno della rete
/// passa da li'.
library;

import 'package:flutter/material.dart';

import 'casa/archivio_delle_case.dart';
import 'casa/cassaforte.dart';
import 'casa/collegamento.dart';
import 'schermate/aggiungi_casa.dart';
import 'schermate/casa.dart';
import 'schermate/home.dart';
import 'schermate/le_case.dart';

void main() => runApp(const AppDiCasa());

class AppDiCasa extends StatelessWidget {
  const AppDiCasa({super.key, this.cassaforte, this.collegamento});

  /// Sostituibili nelle prove, dove il portachiavi e la rete non ci sono.
  final Cassaforte? cassaforte;
  final Collegamento? collegamento;

  @override
  Widget build(BuildContext context) {
    const seme = Color(0xFF0EA5E9);
    return MaterialApp(
      title: 'Casa',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(colorSchemeSeed: seme, brightness: Brightness.light),
      darkTheme: ThemeData(colorSchemeSeed: seme, brightness: Brightness.dark),
      home: Portone(cassaforte: cassaforte, collegamento: collegamento),
    );
  }
}

class Portone extends StatefulWidget {
  const Portone({super.key, this.cassaforte, this.collegamento});

  final Cassaforte? cassaforte;
  final Collegamento? collegamento;

  @override
  State<Portone> createState() => _PortoneState();
}

class _PortoneState extends State<Portone> {
  late final Collegamento _collegamento;
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
        archivio: _collegamento.archivio,
        quandoFatto: (_) => _collegamento.apri(),
      );
    }
    return Home(
      collegamento: _collegamento,
      vaiAiDispositivi: () => Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => SchermataDeiDispositivi(collegamento: _collegamento),
        ),
      ),
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
