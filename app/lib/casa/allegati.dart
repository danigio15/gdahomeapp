/// Scegliere una foto o un video dal telefono, per allegarli.
///
/// Sotto c'e' il selettore del sistema — quello di Android e di iOS — che
/// non vuole permessi per la galleria e usa quello della fotocamera che
/// l'app ha gia' per il codice a quadretti. Una foto si chiede gia' ridotta:
/// 1600 punti sul lato lungo bastano per capire cosa si vede, e pesano
/// qualche centinaio di chilobyte invece di dieci megabyte.
///
/// Chi disegna le schermate riceve una funzione, non questo modulo: nelle
/// prove al suo posto c'e' una funzione che torna un file finto.
library;

import 'package:image_picker/image_picker.dart';

import 'segnalazioni.dart';

/// Da dove viene.
enum DaDoveLAllegato {
  galleria('Una foto dalla galleria'),
  fotocamera('Scatta una foto'),
  video('Un video dalla galleria');

  const DaDoveLAllegato(this.nome);
  final String nome;
}

/// Come si sceglie: torna `null` se la persona ci ha ripensato.
typedef ScegliUnAllegato = Future<Allegato?> Function(DaDoveLAllegato daDove);

/// Un file scelto che non si puo' mandare, e perche'.
class AllegatoNonBuono implements Exception {
  const AllegatoNonBuono(this.spiegazione);
  final String spiegazione;

  @override
  String toString() => spiegazione;
}

/// La scelta vera, col selettore del sistema.
Future<Allegato?> scegliDalTelefono(DaDoveLAllegato daDove) async {
  final selettore = ImagePicker();
  final XFile? file = switch (daDove) {
    DaDoveLAllegato.galleria => await selettore.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 82,
    ),
    DaDoveLAllegato.fotocamera => await selettore.pickImage(
      source: ImageSource.camera,
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 82,
    ),
    DaDoveLAllegato.video => await selettore.pickVideo(
      source: ImageSource.gallery,
      maxDuration: const Duration(seconds: 30),
    ),
  };
  if (file == null) return null;
  final byte = await file.readAsBytes();
  if (byte.isEmpty) throw const AllegatoNonBuono('Il file e\' vuoto.');
  if (byte.length > Allegato.massimo) {
    throw AllegatoNonBuono(
      'Questo file pesa ${pesoLeggibile(byte.length)}: al massimo '
      '${pesoLeggibile(Allegato.massimo)}. Un video va tenuto corto, '
      'venti o trenta secondi.',
    );
  }
  return Allegato(
    nome: file.name.isEmpty ? 'allegato' : file.name,
    tipo: file.mimeType ?? tipoDalNome(file.name),
    byte: byte,
  );
}

/// Il tipo dal nome, quando il sistema non lo dice.
String tipoDalNome(String nome) {
  final punto = nome.lastIndexOf('.');
  final coda = punto < 0 ? '' : nome.substring(punto + 1).toLowerCase();
  return switch (coda) {
    'jpg' || 'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'webp' => 'image/webp',
    'gif' => 'image/gif',
    'heic' => 'image/heic',
    'heif' => 'image/heif',
    'mp4' || 'm4v' => 'video/mp4',
    'mov' => 'video/quicktime',
    'webm' => 'video/webm',
    '3gp' => 'video/3gpp',
    _ => 'application/octet-stream',
  };
}
