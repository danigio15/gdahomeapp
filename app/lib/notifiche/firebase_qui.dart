/// Con quale progetto Firebase parla questa app, se parla con uno.
///
/// I file di Firebase — `google-services.json` per Android,
/// `GoogleService-Info.plist` per l'iPhone — **non stanno nella
/// repository**: li scrive il workflow dai segreti di GitHub al momento di
/// costruire (`.github/workflows/app.yml`), e chi costruisce senza quei
/// segreti ottiene un'app che funziona in tutto, tranne le notifiche.
///
///  - Su **Android** il file lo legge il plugin di Gradle
///    (`android/app/build.gradle.kts`, solo se il file c'e'), e Firebase si
///    accende da se' con quello: qui non serve niente.
///  - Sull'**iPhone** il file non entra nel progetto di Xcode — aggiungerlo
///    vorrebbe dire ritoccare il progetto a ogni costruzione — e allora il
///    workflow ne legge i cinque campi che servono e li passa all'app come
///    `--dart-define`. Sono gli stessi che Firebase metterebbe nel file:
///    identificano il progetto, non aprono niente.
library;

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

const _chiave = String.fromEnvironment('FIREBASE_IOS_API_KEY');
const _app = String.fromEnvironment('FIREBASE_IOS_APP_ID');
const _mittente = String.fromEnvironment('FIREBASE_IOS_SENDER_ID');
const _progetto = String.fromEnvironment('FIREBASE_IOS_PROJECT_ID');
const _pacchetto = String.fromEnvironment(
  'FIREBASE_IOS_BUNDLE_ID',
  defaultValue: 'com.gdahome.gdahome',
);

/// Le opzioni da passare a Firebase, o `null` quando le deve trovare da se'
/// (Android) o non ci sono (l'iPhone costruito senza i segreti).
FirebaseOptions? opzioniDiFirebase() {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.iOS) return null;
  if (_chiave.isEmpty || _app.isEmpty || _mittente.isEmpty) return null;
  if (_progetto.isEmpty) return null;
  return const FirebaseOptions(
    apiKey: _chiave,
    appId: _app,
    messagingSenderId: _mittente,
    projectId: _progetto,
    iosBundleId: _pacchetto,
  );
}

/// Se su questo telefono ha senso provare ad accendere Firebase: sull'iPhone
/// solo se il workflow ha passato il progetto, su Android sempre — se il file
/// non c'era, l'accensione fallisce e le notifiche restano spente.
bool firebaseCiPuoEssere() {
  if (kIsWeb) return false;
  return switch (defaultTargetPlatform) {
    TargetPlatform.android => true,
    TargetPlatform.iOS => opzioniDiFirebase() != null,
    _ => false,
  };
}
