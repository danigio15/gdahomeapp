package com.gdahome.gdahome

import android.content.Context
import android.view.WindowManager
import com.gdahome.gdahome.auto.IlNavigatoreInAuto
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/*
 * Una FlutterFragmentActivity e non una FlutterActivity.
 *
 * Lo chiede `local_auth`: BiometricPrompt e' un frammento di AndroidX, e per
 * mostrarlo gli serve una activity che sappia tenere dei frammenti. Con una
 * FlutterActivity normale il volto e l'impronta non falliscono con un errore
 * chiaro — sollevano `no_fragment_activity`, che e' un guasto e non un «no».
 */
class MainActivity : FlutterFragmentActivity() {
    /*
     * Nella versione col navigatore in auto il motore e' uno per il telefono
     * e per la macchina, e lo tiene `IlNavigatoreInAuto`: se Android Auto
     * l'ha gia' acceso, si riusa. Nella gdahome di sempre ognuno il suo, come
     * prima (`null` = se lo fa l'activity).
     */
    override fun provideFlutterEngine(context: Context): FlutterEngine? =
        if (IlNavigatoreInAuto.acceso(context)) IlNavigatoreInAuto.motore(context) else null

    /*
     * La finestra riservata, quando il lucchetto e' acceso
     * (`lib/casa/la_finestra.dart`): niente plancia nell'elenco delle app
     * recenti, e niente fotografie dello schermo. La decide l'app, e qui si
     * mette o si toglie e basta.
     */
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        if (IlNavigatoreInAuto.acceso(this)) IlNavigatoreInAuto.collega(flutterEngine, this)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "gdahome/finestra")
            .setMethodCallHandler { chiamata, risposta ->
                when (chiamata.method) {
                    "riservata" -> {
                        if (chiamata.arguments == true) {
                            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                        } else {
                            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                        }
                        risposta.success(null)
                    }
                    else -> risposta.notImplemented()
                }
            }
    }
}
