/// Le foto della plancia: quelle che stanno in `/data/www` sul ponte.
///
/// Servono all'auto — che ne vuole due, una ferma e una con la spina attaccata
/// — e agli elettrodomestici, che possono avere il loro ritratto invece di un
/// disegno. La plancia le chiede all'indirizzo `/dashboardmodern_static/www/…`
/// e l'app fa lo stesso, passando dal servitore.
///
/// Il pezzo che le tiene sta gia' nel ponte da settembre (`ponte/src/foto.js`,
/// comandi `dashboardmodern/www/list` e `www/upload`): qui c'e' solo chi lo
/// chiede. Era una delle cose gia' finite che nessuno usava.
library;

import 'dart:convert';
import 'dart:typed_data';

import '../../ponte/filo.dart';

/// Quanto si aspetta: elencare e' veloce, caricare dieci megabyte no.
const attesaDellElenco = Duration(seconds: 20);
const attesaDelCaricamento = Duration(seconds: 60);

/// Quanto puo' pesare una foto: e' il limite del ponte.
const fotoMassima = 10 * 1024 * 1024;

/// Una cartella dentro `www`.
class Cartella {
  const Cartella({required this.nome, required this.percorso});
  final String nome;
  final String percorso;
}

/// Una foto.
class Foto {
  const Foto({
    required this.nome,
    required this.percorso,
    required this.indirizzo,
  });

  final String nome;

  /// Dove sta dentro `www`: `caricate/auto.png`.
  final String percorso;

  /// Come la chiede la pagina: `/dashboardmodern_static/www/caricate/auto.png`.
  /// E' quello che va scritto nella configurazione.
  final String indirizzo;
}

/// Cosa c'e' in una cartella.
class DentroLaCartella {
  const DentroLaCartella({
    required this.dove,
    required this.cartelle,
    required this.foto,
    required this.cE,
    required this.troncata,
  });

  const DentroLaCartella.niente()
    : dove = '',
      cartelle = const [],
      foto = const [],
      cE = false,
      troncata = false;

  final String dove;
  final List<Cartella> cartelle;
  final List<Foto> foto;

  /// `false` quando la cartella `www` non esiste: nessuno ha ancora caricato
  /// niente, e non e' un errore.
  final bool cE;

  /// Ce n'erano troppe e il ponte si e' fermato: si dice, invece di far
  /// credere che siano tutte.
  final bool troncata;
}

/// Chiede cosa c'e' in una cartella di `www`.
Future<DentroLaCartella> elencaLeFoto(Filo filo, {String dove = ''}) async {
  final detto = await filo.chiedi({
    'type': 'dashboardmodern/www/list',
    'path': dove,
  }, entro: attesaDellElenco);
  return leggiLaCartella(detto['result']);
}

/// Separata da chi la chiede, cosi' le prove non hanno bisogno di un filo.
DentroLaCartella leggiLaCartella(dynamic risultato) {
  if (risultato is! Map) return const DentroLaCartella.niente();
  List<Map<String, dynamic>> elenco(String quale) {
    final letto = risultato[quale];
    if (letto is! List) return const [];
    return [
      for (final uno in letto)
        if (uno is Map) Map<String, dynamic>.from(uno),
    ];
  }

  return DentroLaCartella(
    dove: '${risultato['path'] ?? ''}',
    cE: risultato['available'] != false,
    troncata: risultato['truncated'] == true,
    cartelle: [
      for (final una in elenco('folders'))
        Cartella(
          nome: '${una['name'] ?? ''}',
          percorso: '${una['path'] ?? ''}',
        ),
    ],
    foto: [
      for (final una in elenco('images'))
        Foto(
          nome: '${una['name'] ?? ''}',
          percorso: '${una['path'] ?? ''}',
          indirizzo: '${una['url'] ?? ''}',
        ),
    ],
  );
}

/// Quando il ponte non accetta una foto.
class FotoRifiutata implements Exception {
  const FotoRifiutata(this.perche);
  final String perche;
  @override
  String toString() => perche;
}

/// Manda una foto al ponte e restituisce dove l'ha messa.
Future<Foto> caricaUnaFoto(
  Filo filo, {
  required String nome,
  required Uint8List byte,
}) async {
  if (byte.isEmpty) {
    throw const FotoRifiutata('La foto e\' vuota.');
  }
  if (byte.length > fotoMassima) {
    throw const FotoRifiutata('La foto e\' piu\' grande di 10 MB.');
  }
  final detto = await filo.chiedi({
    'type': 'dashboardmodern/www/upload',
    'filename': nome,
    'data': base64Encode(byte),
  }, entro: attesaDelCaricamento);
  final messa = detto['result'];
  if (messa is! Map) {
    throw const FotoRifiutata('Il ponte non ha detto dove l\'ha messa.');
  }
  return Foto(
    nome: '${messa['name'] ?? nome}',
    percorso: '${messa['path'] ?? ''}',
    indirizzo: '${messa['url'] ?? ''}',
  );
}
