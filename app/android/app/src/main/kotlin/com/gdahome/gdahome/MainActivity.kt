package com.gdahome.gdahome

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.view.WindowManager
import com.gdahome.gdahome.auto.IlNavigatoreInAuto
import com.gdahome.gdahome.orologio.IlTramiteDellOrologio
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
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
        /* L'orologio Wear OS. Nella versione col navigatore in auto l'ha gia'
         * collegato `IlNavigatoreInAuto`; rifarlo non fa danni. */
        IlTramiteDellOrologio.collega(flutterEngine.dartExecutor.binaryMessenger, this)
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
                    /* Il tablet a muro di notte (`lib/casa/lo_schermo.dart`):
                     * la luminosita' della sola finestra, da 0 (la piu'
                     * bassa) a 1; -1 torna a quella del sistema. */
                    "luminosita" -> {
                        val valore = (chiamata.arguments as? Number)?.toFloat() ?: -1f
                        val attributi = window.attributes
                        attributi.screenBrightness =
                            if (valore < 0f) WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
                            else valore.coerceIn(0f, 1f)
                        window.attributes = attributi
                        risposta.success(null)
                    }
                    /* Il campanello a muro (`lib/casa/lo_schermo.dart`): lo
                     * schermo che non si spegne mentre il pannello lo chiede.
                     * Spento il pannello torna del sistema, e l'app smette
                     * anche di passare sopra il blocco. */
                    "acceso" -> {
                        if (chiamata.arguments == true) {
                            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                        } else {
                            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                            sopraIlBlocco(false)
                        }
                        risposta.success(null)
                    }
                    /* Suona il campanello: luce piena, e uno schermo spento si
                     * riaccende sopra il blocco, come una chiamata. */
                    "sveglia" -> {
                        sveglia()
                        risposta.success(null)
                    }
                    /* «Parla» del citofono: il microfono, chiesto al sistema
                     * la prima volta. La risposta arriva dopo, nel
                     * `onRequestPermissionsResult` qui sotto. */
                    "microfono" -> {
                        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
                            PackageManager.PERMISSION_GRANTED
                        ) {
                            risposta.success(true)
                        } else {
                            microfonoInAttesa?.success(false)
                            microfonoInAttesa = risposta
                            ActivityCompat.requestPermissions(
                                this,
                                arrayOf(Manifest.permission.RECORD_AUDIO),
                                MICROFONO,
                            )
                        }
                    }
                    else -> risposta.notImplemented()
                }
            }
    }

    private var microfonoInAttesa: MethodChannel.Result? = null

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != MICROFONO) return
        microfonoInAttesa?.success(grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED)
        microfonoInAttesa = null
    }

    private fun sopraIlBlocco(si: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(si)
            setTurnScreenOn(si)
        } else {
            @Suppress("DEPRECATION")
            val bandiere = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            if (si) window.addFlags(bandiere) else window.clearFlags(bandiere)
        }
    }

    /*
     * Lo schermo si accende davvero solo con un wake lock che lo chiede
     * (`ACQUIRE_CAUSES_WAKEUP`): `setTurnScreenOn` vale per quando l'activity
     * torna davanti, non per un'activity che e' gia' li' a schermo spento. Il
     * lock dura pochi secondi — poi lo schermo resta acceso per
     * `FLAG_KEEP_SCREEN_ON`, o si rispegne come vuole il sistema.
     */
    private fun sveglia() {
        sopraIlBlocco(true)
        val attributi = window.attributes
        attributi.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
        window.attributes = attributi
        val energia = getSystemService(POWER_SERVICE) as? PowerManager ?: return
        if (energia.isInteractive) return
        try {
            @Suppress("DEPRECATION")
            energia.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
                    PowerManager.ACQUIRE_CAUSES_WAKEUP or
                    PowerManager.ON_AFTER_RELEASE,
                "gdahome:campanello",
            ).acquire(10_000L)
        } catch (_: SecurityException) {
            /* Senza il permesso: la pagina suona, lo schermo resta com'e'. */
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
        const val MICROFONO = 4201
    }
}
