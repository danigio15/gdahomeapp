/// L'app di casa.
///
/// Il portone decide dove mandare chi apre l'app: al primo avvio se non c'e'
/// ancora un segno nel portachiavi, dritto in casa se c'e'. Nient'altro.
library;

import 'package:flutter/material.dart';

import 'ponte/custodia.dart';
import 'ponte/filo.dart';
import 'ponte/indirizzo.dart';
import 'schermate/casa.dart';
import 'schermate/primo_avvio.dart';

void main() => runApp(const AppDiCasa());

class AppDiCasa extends StatelessWidget {
  const AppDiCasa({super.key, this.custodia});

  /// Sostituibile nelle prove, dove il portachiavi del sistema non c'e'.
  final Custodia? custodia;

  @override
  Widget build(BuildContext context) {
    const seme = Color(0xFF0EA5E9);
    return MaterialApp(
      title: 'Casa',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(colorSchemeSeed: seme, brightness: Brightness.light),
      darkTheme: ThemeData(colorSchemeSeed: seme, brightness: Brightness.dark),
      home: Portone(custodia: custodia ?? const CustodiaDelSistema()),
    );
  }
}

class Portone extends StatefulWidget {
  const Portone({super.key, required this.custodia});

  final Custodia custodia;

  @override
  State<Portone> createState() => _PortoneState();
}

class _PortoneState extends State<Portone> {
  Filo? _filo;
  bool _guardato = false;

  @override
  void initState() {
    super.initState();
    _guarda();
  }

  Future<void> _guarda() async {
    final segno = await widget.custodia.leggiIlSegno();
    final dove = await widget.custodia.leggiLIndirizzo();
    if (!mounted) return;
    setState(() {
      _guardato = true;
      if (segno != null && dove != null) _filo = _apriIlFilo(dove, segno);
    });
  }

  Filo _apriIlFilo(IndirizzoDelPonte dove, String segno) {
    final filo = Filo(indirizzo: dove, segno: segno);
    /* L'esito non si aspetta qui: la schermata della casa guarda lo stato del
     * filo e racconta da sola cosa sta succedendo. Un errore adesso vorrebbe
     * dire solo che il telefono non e' ancora in rete. */
    filo.apri().catchError((Object _) {});
    return filo;
  }

  Future<void> _esci() async {
    final vecchio = _filo;
    setState(() => _filo = null);
    await vecchio?.chiudi();
    await widget.custodia.dimentica();
  }

  @override
  void dispose() {
    _filo?.chiudi();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_guardato) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final filo = _filo;
    if (filo == null) {
      return PrimoAvvio(
        custodia: widget.custodia,
        quandoEntra: (dove, segno) =>
            setState(() => _filo = _apriIlFilo(dove, segno)),
      );
    }
    return SchermataDellaCasa(
      /* La chiave lega la schermata a questo filo: cambiando filo — perche' si
       * e' riabbinato — Flutter costruisce una schermata nuova invece di
       * riusare quella vecchia con dentro lo stato della casa di prima. */
      key: ValueKey(filo),
      filo: filo,
      quandoEsce: _esci,
    );
  }
}
