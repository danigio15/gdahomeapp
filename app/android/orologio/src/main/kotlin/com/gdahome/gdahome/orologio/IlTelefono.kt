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

/* Per quanto si crede alla riga girata al tocco, se il telefono non la
 * conferma: il tempo che il telefono si da' per sentire lo stato nuovo dalla
 * casa (`quantoSiAspettaLoStato` in `lib/auto/in_auto.dart`), e un po'. */
private const val QUANTO_SI_CREDE_AL_TOCCO_MS = 12_000L

/* Dopo quanto, a comando andato, si chiede al telefono la fotografia. */
private const val FRA_QUANTO_SI_RICHIEDE_MS = 4_000L

class IlTelefono(context: Context, private val vetrina: Boolean = false) {
    private val contesto = context.applicationContext
    private val principale = Handler(Looper.getMainLooper())

    var foto by mutableStateOf<LaFoto?>(null)
        private set

    /* ─── La riga che cambia al tocco ─────────────────────────────────────
     *
     * «Premo e dopo un po' da' il tap di feedback, ma non cambia stato.» Il
     * tocco fa il giro del telefono e della casa prima di tornare, e intanto
     * al polso non succedeva niente. Adesso la riga si gira subito, col suo
     * colpetto, e resta girata finche' il telefono non dice com'e' davvero:
     * se il comando non parte torna com'era, con l'avviso; se parte, la
     * fotografia che arriva dopo la conferma — o, passato il tempo, la
     * smentisce: e' lei la verita'.
     *
     * [vera] e' l'ultima fotografia arrivata dal telefono; [attese] le righe
     * girate al tocco (l'entita', com'e' attesa, fino a quando ci si crede).
     * Quello che si disegna, [foto], e' la prima con sopra le seconde. Tutto
     * sul filo principale. */
    private var vera: LaFoto? = null
    private val attese = mutableMapOf<String, Pair<Boolean, Long>>()

    /* Il comando in viaggio: se ha girato una riga, quale. */
    private var comandoInViaggio = false
    private var rigaGirata: String? = null

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

    fun premi(id: String) {
        if (vetrina) return
        /* Il tocco si sente e si vede subito; com'e' andata arriva dopo. */
        vibra(true)
        comandoInViaggio = true
        rigaGirata = if (gira(id)) id else null
        chiedi(JSONObject().put("cosa", "comando").put("id", id))
    }

    /** Gira la riga di [id], se e' quella di un dispositivo. */
    private fun gira(id: String): Boolean {
        val riga = foto?.dispositivi?.firstOrNull { it.id == id } ?: return false
        attese[id] = Pair(!riga.acceso, System.currentTimeMillis() + QUANTO_SI_CREDE_AL_TOCCO_MS)
        mostra()
        /* Passato il tempo, vale quello che dice il telefono. */
        principale.postDelayed({ mostra() }, QUANTO_SI_CREDE_AL_TOCCO_MS + 100)
        return true
    }

    /** Disegna la fotografia del telefono, con sopra le righe girate al tocco. */
    private fun mostra() {
        val arrivata = vera ?: return
        val adesso = System.currentTimeMillis()
        attese.entries.removeAll { it.value.second <= adesso }
        foto = if (attese.isEmpty()) {
            arrivata
        } else {
            arrivata.copy(
                dispositivi = arrivata.dispositivi.map { d ->
                    val attesa = attese[d.id]
                    when {
                        attesa == null -> d
                        // Il telefono la conferma: non c'e' piu' niente da aspettare.
                        attesa.first == d.acceso -> {
                            attese.remove(d.id)
                            d
                        }
                        else -> d.girato()
                    }
                },
            )
        }
    }

    fun vai(dove: String) = chiedi(JSONObject().put("cosa", "vai").put("dove", dove))

    fun ferma() = chiedi(JSONObject().put("cosa", "ferma"))

    private fun prendi(testo: String?) {
        LaFoto.leggi(testo)?.let {
            vera = it
            mostra()
        }
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
                if (nodo != null) manda(nodo.id, messaggio, zitto, capacita = true) else colTelefonoCollegato(messaggio, zitto)
            }
            .addOnFailureListener { colTelefonoCollegato(messaggio, zitto) }
    }

    /* «Il telefono non risponde», dal Galaxy Watch col telefono accanto e
     * GdAHome aperta. La capacita' `gdahome_telefono` a volte non arriva
     * all'orologio (Samsung la fa girare tardi, o dopo un aggiornamento
     * dell'app non la riannuncia): allora si prova col telefono collegato,
     * che e' quasi sempre l'unico. Se GdAHome c'e' risponde lui, come prima. */
    private fun colTelefonoCollegato(messaggio: JSONObject, zitto: Boolean) {
        Wearable.getNodeClient(contesto).connectedNodes
            .addOnSuccessListener { nodi ->
                val nodo = nodi.firstOrNull { it.isNearby } ?: nodi.firstOrNull()
                if (nodo == null) {
                    if (!zitto) finito(false, "L'orologio non è collegato al telefono. Controlla il Bluetooth.")
                    return@addOnSuccessListener
                }
                manda(nodo.id, messaggio, zitto, capacita = false)
            }
            .addOnFailureListener {
                if (!zitto) finito(false, "L'orologio non è collegato al telefono. Controlla il Bluetooth.")
            }
    }

    private fun manda(nodo: String, messaggio: JSONObject, zitto: Boolean, capacita: Boolean) {
        Wearable.getMessageClient(contesto)
            .sendRequest(nodo, TOCCO, messaggio.toString().toByteArray(Charsets.UTF_8))
            .addOnSuccessListener { byte ->
                val r = runCatching { JSONObject(String(byte, Charsets.UTF_8)) }.getOrNull() ?: JSONObject()
                r.optString("foto", "").takeIf { it.isNotEmpty() }?.let { prendi(it) }
                if (!zitto) {
                    val ok = r.optBoolean("ok", false)
                    finito(ok, r.optString("testo", "").ifEmpty { if (ok) "Fatto" else "Non è partito" })
                }
            }
            .addOnFailureListener {
                if (zitto) return@addOnFailureListener
                // Collegato ma senza risposta: sul telefono GdAHome non c'e', o
                // e' una versione diversa da quella dell'orologio.
                finito(
                    false,
                    if (capacita) "Il telefono non ha risposto" else "Aggiorna GdAHome sul telefono dal Play Store, poi aprila una volta.",
                )
            }
    }

    private fun finito(bene: Boolean, testo: String) {
        inCorso = false
        val eraUnComando = comandoInViaggio
        val girata = rigaGirata
        comandoInViaggio = false
        rigaGirata = null
        if (girata != null && !bene) {
            /* Non e' partito: la riga torna com'era. */
            attese.remove(girata)
            mostra()
        }
        avviso = testo
        /* Il colpetto del tocco c'e' gia' stato: qui si sente solo il no. */
        if (!(bene && eraUnComando)) vibra(bene)
        principale.postDelayed({ if (avviso == testo) avviso = null }, 3_000)
        /* Lo stato nuovo il telefono lo manda da se' quando la casa lo dice;
         * se per strada si perde, fra poco lo si chiede. */
        if (bene && eraUnComando) {
            principale.postDelayed({ chiedi(JSONObject().put("cosa", "aggiorna"), zitto = true) }, FRA_QUANTO_SI_RICHIEDE_MS)
        }
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
