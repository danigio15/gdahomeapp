package com.gdahome.gdahome

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Base64
import java.io.File

/**
 * Il foglietto dell'abbinamento, consegnato dall'add-on sui pannelli senza
 * root (Shelly, display Android): li' l'add-on non puo' scrivere nella cartella
 * dell'app, e allora glielo manda con un messaggio
 * (`am broadcast … --es foglietto <base64>`), e l'app lo scrive da se' dove
 * `lib/muro/avvio_muro.dart` lo legge al prossimo avvio.
 *
 * Nel manifest il ricevitore chiede il permesso DUMP a chi manda: ce l'ha la
 * shell dell'ADB, non ce l'ha nessuna app. Cosi' un'app qualunque sul
 * pannello non puo' infilare un foglietto e portarlo in un'altra casa.
 *
 * Solo GdAHome Muro: l'app del telefono ha lo stesso codice, e qui non fa
 * niente.
 */
class IlFoglietto : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (context.packageName != "com.gdahome.muro") return
        val scritto = intent.getStringExtra("foglietto") ?: return
        val testo = try {
            String(Base64.decode(scritto, Base64.DEFAULT), Charsets.UTF_8)
        } catch (_: IllegalArgumentException) {
            return
        }
        if (testo.isBlank() || testo.length > 64 * 1024) return
        val cartella = context.filesDir
        /* L'esito di prima non vale piu': quello nuovo lo scrive l'app. */
        File(cartella, "abbinamento.esito").delete()
        File(cartella, "abbinamento.rovinato").delete()
        val provvisorio = File(cartella, "abbinamento.json.nuovo")
        provvisorio.writeText(testo, Charsets.UTF_8)
        if (!provvisorio.renameTo(File(cartella, "abbinamento.json"))) return
        resultCode = Activity.RESULT_OK
    }
}
