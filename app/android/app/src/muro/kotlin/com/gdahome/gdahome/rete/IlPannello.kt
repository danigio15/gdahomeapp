package com.gdahome.gdahome.rete

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.net.wifi.WifiManager
import android.os.Build
import android.provider.Settings
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodChannel
import java.net.NetworkInterface

/*
 * Le impostazioni del pannello a muro, per le pagine «Wi-Fi», «Schermo»,
 * «Suono» e «Informazioni» del menu (`lib/schermate/il_pannello.dart`).
 *
 * - Wi-Fi: la rete, il segnale, la velocita'; «Cambia rete» apre la scelta di
 *   Android (le Impostazioni restano sul pannello apposta).
 * - Schermo: la luminosita' e quella automatica, nelle impostazioni di
 *   sistema. Scriverle vuole WRITE_SETTINGS, che l'add-on da' all'app
 *   installandola (`appops`); senza, si cambia almeno quella di questa
 *   finestra, che sul muro e' sempre davanti.
 * - Suono: il volume.
 *
 * Solo nell'app del pannello: sul telefono queste cose sono di Android.
 */
object IlPannello {
    const val CANALE = "gdahome/pannello"

    fun collega(messaggi: BinaryMessenger, activity: android.app.Activity) {
        val app = activity.applicationContext
        MethodChannel(messaggi, CANALE).setMethodCallHandler { chiamata, risposta ->
            runCatching {
                when (chiamata.method) {
                    "stato" -> risposta.success(stato(app))
                    "luminosita" -> {
                        val valore = (chiamata.arguments as? Number)?.toInt()?.coerceIn(1, 255) ?: 128
                        val scritta = scriviSistema(app, Settings.System.SCREEN_BRIGHTNESS, valore)
                        val finestra = activity.window
                        activity.runOnUiThread {
                            val p = finestra.attributes
                            /* Senza il permesso, almeno questa finestra; col
                             * permesso, si lascia decidere al sistema. */
                            p.screenBrightness = if (scritta) -1f else valore / 255f
                            finestra.attributes = p
                        }
                        risposta.success(scritta)
                    }
                    "automatica" -> {
                        val si = chiamata.arguments == true
                        risposta.success(
                            scriviSistema(
                                app,
                                Settings.System.SCREEN_BRIGHTNESS_MODE,
                                if (si) Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC
                                else Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL,
                            ),
                        )
                    }
                    "volume" -> {
                        val audio = app.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                        val massimo = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
                        val valore = (chiamata.arguments as? Number)?.toInt()?.coerceIn(0, massimo) ?: 0
                        for (flusso in listOf(AudioManager.STREAM_MUSIC, AudioManager.STREAM_NOTIFICATION, AudioManager.STREAM_RING)) {
                            val max = audio.getStreamMaxVolume(flusso)
                            runCatching { audio.setStreamVolume(flusso, valore * max / massimo.coerceAtLeast(1), 0) }
                        }
                        risposta.success(true)
                    }
                    "apriWifi" -> {
                        activity.startActivity(
                            Intent(Settings.ACTION_WIFI_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                        )
                        risposta.success(true)
                    }
                    else -> risposta.notImplemented()
                }
            }.onFailure { risposta.error("pannello", it.message, null) }
        }
    }

    private fun scriviSistema(context: Context, chiave: String, valore: Int): Boolean {
        if (Build.VERSION.SDK_INT >= 23 && !Settings.System.canWrite(context)) return false
        return runCatching { Settings.System.putInt(context.contentResolver, chiave, valore) }.getOrDefault(false)
    }

    private fun stato(context: Context): Map<String, Any?> {
        val wifi = context.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        @Suppress("DEPRECATION")
        val info = wifi?.connectionInfo
        val ssid = info?.ssid?.trim('"')?.takeUnless { it.isBlank() || it == "<unknown ssid>" }
        val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val ip = runCatching {
            NetworkInterface.getNetworkInterfaces().toList()
                .flatMap { it.inetAddresses.toList() }
                .firstOrNull { !it.isLoopbackAddress && it.hostAddress?.contains('.') == true }
                ?.hostAddress
        }.getOrNull()
        return mapOf(
            "ssid" to ssid,
            "collegato" to ((info?.networkId ?: -1) != -1),
            "segnale" to info?.rssi,
            "velocita" to info?.linkSpeed,
            "frequenza" to info?.frequency,
            "ip" to ip,
            "luminosita" to runCatching { Settings.System.getInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS) }.getOrNull(),
            "automatica" to (runCatching { Settings.System.getInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS_MODE) }.getOrNull() == Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC),
            "puoScrivere" to (Build.VERSION.SDK_INT < 23 || Settings.System.canWrite(context)),
            "volume" to audio.getStreamVolume(AudioManager.STREAM_MUSIC),
            "volumeMassimo" to audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC),
            "modello" to Build.MODEL,
            "produttore" to Build.MANUFACTURER,
            "android" to Build.VERSION.RELEASE,
        )
    }
}
