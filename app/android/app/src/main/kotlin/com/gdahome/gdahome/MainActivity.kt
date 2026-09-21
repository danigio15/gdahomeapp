package com.gdahome.gdahome

import io.flutter.embedding.android.FlutterFragmentActivity

/*
 * Una FlutterFragmentActivity e non una FlutterActivity.
 *
 * Lo chiede `local_auth`: BiometricPrompt e' un frammento di AndroidX, e per
 * mostrarlo gli serve una activity che sappia tenere dei frammenti. Con una
 * FlutterActivity normale il volto e l'impronta non falliscono con un errore
 * chiaro — sollevano `no_fragment_activity`, che e' un guasto e non un «no».
 */
class MainActivity : FlutterFragmentActivity()
