package com.gdahome.gdahome

import android.os.Bundle
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
     * prima.
     *
     * Si prende **per nome**, dalla cache, e non passandolo
     * (`provideFlutterEngine`, com'era). La differenza sta tutta nella
     * chiusura: un motore passato FlutterFragmentActivity lo spegne quando
     * l'activity se ne va — il suo frammento nasce con «distruggi il motore
     * con me» — e la cache restava con un motore spento in mano. Da li' la
     * macchina riceveva quello: niente GPS e niente dati dell'auto finche'
     * non si riapriva l'app. Uno preso per nome resta acceso
     * (`shouldDestroyEngineWithHost` e' falso), e l'activity lo usa e basta.
     *
     * Si accende **prima** di `super.onCreate`: quando Android ricrea
     * l'activity dopo aver chiuso il processo, il frammento torna da solo col
     * nome del motore scritto dentro, e lo cerca subito.
     */
    override fun onCreate(savedInstanceState: Bundle?) {
        if (IlNavigatoreInAuto.acceso(this)) IlNavigatoreInAuto.motore(this)
        super.onCreate(savedInstanceState)
    }

    override fun getCachedEngineId(): String? =
        if (IlNavigatoreInAuto.acceso(this)) IlNavigatoreInAuto.MOTORE else super.getCachedEngineId()

    /*
     * La finestra riservata, quando il lucchetto e' acceso
     * (`lib/casa/la_finestra.dart`): niente plancia nell'elenco delle app
     * recenti, e niente fotografie dello schermo. La decide l'app, e qui si
     * mette o si toglie e basta.
     */
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, FINESTRA)
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

    /* Il motore puo' restare acceso dopo l'activity: la finestra invece e'
     * di questa, e il filo che la tocca se ne va con lei. */
    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, FINESTRA).setMethodCallHandler(null)
        super.cleanUpFlutterEngine(flutterEngine)
    }

    private companion object {
        const val FINESTRA = "gdahome/finestra"
    }
}
