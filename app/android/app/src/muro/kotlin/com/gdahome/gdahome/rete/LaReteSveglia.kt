package com.gdahome.gdahome.rete

import android.content.Context
import android.net.wifi.WifiManager

/*
 * Il Wi-Fi del pannello sempre sveglio.
 *
 * Col risparmio energetico la radio dorme fra un segnale del router e
 * l'altro: quello che il pannello manda parte subito, quello che riceve
 * aspetta. Sui pannelli (Realtek) i dati da Home Assistant arrivavano a
 * scatti — 0,1 MB/s per installare un'app, il ping fra 9 e 46 ms — e cosi'
 * anche lo stato delle luci. Un pannello sta sempre attaccato alla corrente:
 * il risparmio non serve, e si spegne finche' l'app gira (`WIFI_MODE_FULL_HIGH_PERF`
 * e' proprio questo, su Android 8 e 9).
 *
 * Solo nell'app del pannello: sul telefono la batteria conta.
 */
object LaReteSveglia {
    private var blocco: WifiManager.WifiLock? = null

    fun tieni(context: Context) {
        if (blocco?.isHeld == true) return
        val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return
        @Suppress("DEPRECATION")
        val nuovo = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "gdahome:muro")
        nuovo.setReferenceCounted(false)
        runCatching { nuovo.acquire() }
        blocco = nuovo
    }
}
