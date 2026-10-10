/* Il filo col telefono, dal polso.
 *
 * L'orologio non ha le chiavi di casa, e non deve averle: se le avesse,
 * sarebbero due i posti che sanno entrare. La fotografia arriva dal Data
 * Layer (`/gdahome/foto`), e un tocco si chiede al telefono
 * (`/gdahome/tocco`), che lo esegue col filo dell'app e risponde con la frase
 * da mostrare. Vedi `docs/OROLOGIO.md`.
 */
package com.gdahome.gdahome.orologio

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import org.json.JSONObject

private const val FOTO = "/gdahome/foto"
private const val TOCCO = "/gdahome/tocco"
private const val TELEFONO = "gdahome_telefono"

class IlTelefono(context: Context, private val vetrina: Boolean = false) {
    private val contesto = context.applicationContext
    private val principale = Handler(Looper.getMainLooper())

    var foto by mutableStateOf<LaFoto?>(null)
        private set

    /** Com'e' andato l'ultimo tocco. Si toglie da solo. */
    var avviso by mutableStateOf<String?>(null)
        private set

    /** Se un tocco e' in viaggio verso il telefono. */
    var inCorso by mutableStateOf(false)
        private set

    private val ascolto = DataClient.OnDataChangedListener { eventi ->
        for (e in eventi) {
            if (e.type != DataEvent.TYPE_CHANGED || e.dataItem.uri.path != FOTO) continue
            /* Si legge qui dentro: il buffer si libera appena si esce. */
            val testo = DataMapItem.fromDataItem(e.dataItem).dataMap.getString("foto")
            principale.post { prendi(testo) }
        }
    }

    fun accendi() {
        /* La vetrina (`Vetrina.kt`): la casa d'esempio, e nessun filo. */
        if (vetrina) {
            foto = Vetrina.laFoto()
            return
        }
        Wearable.getDataClient(contesto).addListener(ascolto)
        /* L'ultima che il Data Layer ha tenuto: c'e' subito, anche col
         * telefono lontano. Poi se ne chiede una fresca. */
        Wearable.getDataClient(contesto)
            .getDataItems(Uri.Builder().scheme("wear").path(FOTO).build())
            .addOnSuccessListener { elementi ->
                val testo = elementi.firstOrNull()?.let { DataMapItem.fromDataItem(it).dataMap.getString("foto") }
                elementi.release()
                prendi(testo)
            }
        chiedi(JSONObject().put("cosa", "aggiorna"), zitto = true)
    }

    fun spegni() {
        if (vetrina) return
        Wearable.getDataClient(contesto).removeListener(ascolto)
    }

    fun premi(id: String) = chiedi(JSONObject().put("cosa", "comando").put("id", id))

    fun vai(dove: String) = chiedi(JSONObject().put("cosa", "vai").put("dove", dove))

    fun ferma() = chiedi(JSONObject().put("cosa", "ferma"))

    private fun prendi(testo: String?) {
        LaFoto.leggi(testo)?.let { foto = it }
    }

    /* Al telefono vicino che ha gdahome: quello che si annuncia con la
     * capacita' `gdahome_telefono` (`app/src/main/res/values/orologio.xml`). */
    private fun chiedi(messaggio: JSONObject, zitto: Boolean = false) {
        if (vetrina) return
        if (!zitto) inCorso = true
        Wearable.getCapabilityClient(contesto)
            .getCapability(TELEFONO, CapabilityClient.FILTER_REACHABLE)
            .addOnSuccessListener { info ->
                val nodo = info.nodes.firstOrNull { it.isNearby } ?: info.nodes.firstOrNull()
                if (nodo == null) {
                    if (!zitto) finito(false, "Il telefono non risponde. Tienilo vicino, con gdahome installata.")
                    return@addOnSuccessListener
                }
                Wearable.getMessageClient(contesto)
                    .sendRequest(nodo.id, TOCCO, messaggio.toString().toByteArray(Charsets.UTF_8))
                    .addOnSuccessListener { byte ->
                        val r = runCatching { JSONObject(String(byte, Charsets.UTF_8)) }.getOrNull() ?: JSONObject()
                        r.optString("foto", "").takeIf { it.isNotEmpty() }?.let { prendi(it) }
                        if (!zitto) {
                            val ok = r.optBoolean("ok", false)
                            finito(ok, r.optString("testo", "").ifEmpty { if (ok) "Fatto" else "Non è partito" })
                        }
                    }
                    .addOnFailureListener { if (!zitto) finito(false, "Il telefono non ha risposto") }
            }
            .addOnFailureListener { if (!zitto) finito(false, "Il telefono non risponde") }
    }

    private fun finito(bene: Boolean, testo: String) {
        inCorso = false
        avviso = testo
        vibra(bene)
        principale.postDelayed({ if (avviso == testo) avviso = null }, 3_000)
    }

    @Suppress("DEPRECATION")
    private fun vibra(bene: Boolean) {
        runCatching {
            val v = contesto.getSystemService(Vibrator::class.java) ?: return
            v.vibrate(
                if (bene) VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
                else VibrationEffect.createWaveform(longArrayOf(0, 80, 80, 80), -1),
            )
        }
    }
}
