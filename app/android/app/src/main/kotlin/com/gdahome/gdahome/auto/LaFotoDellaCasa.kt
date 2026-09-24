/* Quello che l'auto sa della casa: una fotografia, non un filo.
 *
 * In auto non si tiene aperto un collegamento. Il servizio dell'auto vive nello
 * stesso processo dell'app, ma l'app puo' non essere aperta affatto: chi sale
 * in macchina accende Android Auto, non gdahome. Aprire da qui un secondo filo
 * verso il ponte vorrebbe dire una seconda copia dell'autenticazione, delle
 * chiavi e degli errori — cioe' due posti che sanno parlare con la casa, e il
 * giorno che si scostano nessuno sa quale ha ragione.
 *
 * Quindi l'app lascia una fotografia in un file suo, e l'auto legge quella. E'
 * poca roba — tre numeri, chi c'e' in casa, sei tasti — e invecchia in fretta:
 * per questo la fotografia porta il momento in cui e' stata scattata, e le
 * schermate lo dicono invece di far credere che sia adesso.
 *
 * ── Quando la fotografia non c'e' ────────────────────────────────────────
 *
 * Si dice, e non si inventa niente. Una schermata che mostra numeri finti
 * perche' quelli veri non sono arrivati e' la cosa peggiore che possa fare un
 * cruscotto: chi guarda non ha modo di accorgersene. Senza file si scrive che
 * l'app non ha ancora mandato niente, e si dice cosa fare.
 */
package com.gdahome.gdahome.auto

import android.content.Context
import org.json.JSONObject
import java.io.File

/** Il file in cui l'app lascia la fotografia. Sta nella cartella privata. */
private const val NOME_DEL_FILE = "gdahome-auto.json"

/** Oltre questo la fotografia e' vecchia e lo si dice. Mezz'ora. */
const val QUANTO_VALE_MS = 30L * 60L * 1000L

data class Misura(val nome: String, val valore: String)

data class Persona(val nome: String, val inCasa: Boolean)

/**
 * Un tasto della griglia.
 *
 * L'[id] e' «posto|nome» — «0|Cancello» — e non un nome di entita'. Le azioni
 * rapide un nome loro con cui chiamarle non ce l'hanno: la plancia le preme per
 * posto nell'elenco. Il nome gli sta accanto perche' fra la fotografia e il
 * tasto premuto qualcuno puo' aver riordinato l'elenco, e allora il terzo posto
 * non e' piu' la stessa azione: chi esegue controlla, e se non torna non preme
 * niente. Qui l'id non si guarda: si porta di la' com'e'.
 */
data class Azione(
    val id: String,
    val nome: String,
    val segno: String,
    /**
     * Se parte da sola, anche con l'app chiusa e lo schermo spento.
     *
     * Lo dicono in due, ed e' il telefono a scriverlo: la plancia sa cos'e'
     * l'azione — una con una conferma da mostrare, o un menu da far scegliere,
     * qualcuno che guardi ce lo vuole — e il telefono sa se c'e' il lucchetto,
     * che quando c'e' non fa partire niente senza che l'app sia stata aperta.
     * Qui non si decide: si legge, e si scrive la cosa giusta sul tasto.
     */
    val subito: Boolean,
)

data class FotoDellaCasa(
    val casa: String,
    val quando: Long,
    val fotovoltaico: List<Misura>,
    val persone: List<Persona>,
    val azioni: List<Azione>,
) {
    fun vecchia(adesso: Long): Boolean = quando <= 0L || adesso - quando > QUANTO_VALE_MS
}

/** Dove l'app scrive e l'auto legge: un posto solo, scritto una volta. */
fun fileDellaFoto(context: Context): File = File(context.filesDir, NOME_DEL_FILE)

/**
 * La fotografia, o `null` se non c'e' o non si legge.
 *
 * Non solleva mai: un file mezzo scritto, un JSON storto o un permesso negato
 * valgono «non ce l'ho», che e' una risposta che le schermate sanno disegnare.
 * In auto un'eccezione e' una schermata nera mentre uno guida.
 */
fun leggiLaFoto(context: Context): FotoDellaCasa? {
    val file = fileDellaFoto(context)
    if (!file.isFile) return null
    val testo = runCatching { file.readText() }.getOrNull() ?: return null
    val json = runCatching { JSONObject(testo) }.getOrNull() ?: return null
    return FotoDellaCasa(
        casa = json.optString("casa", ""),
        quando = json.optLong("quando", 0L),
        fotovoltaico = leMisure(json),
        persone = lePersone(json),
        azioni = leAzioni(json),
    )
}

private fun leMisure(json: JSONObject): List<Misura> {
    val elenco = json.optJSONArray("fotovoltaico") ?: return emptyList()
    val fuori = mutableListOf<Misura>()
    for (i in 0 until elenco.length()) {
        val voce = elenco.optJSONObject(i) ?: continue
        val nome = voce.optString("nome", "").trim()
        val valore = voce.optString("valore", "").trim()
        if (nome.isNotEmpty() && valore.isNotEmpty()) fuori.add(Misura(nome, valore))
    }
    return fuori
}

private fun lePersone(json: JSONObject): List<Persona> {
    val elenco = json.optJSONArray("persone") ?: return emptyList()
    val fuori = mutableListOf<Persona>()
    for (i in 0 until elenco.length()) {
        val voce = elenco.optJSONObject(i) ?: continue
        val nome = voce.optString("nome", "").trim()
        if (nome.isNotEmpty()) fuori.add(Persona(nome, voce.optBoolean("inCasa", false)))
    }
    return fuori
}

/* Sei e non di piu'. In auto la griglia ne mostra sei per schermata, e la
 * settima vorrebbe dire scorrere: una cosa che si fa da fermi. Chi ne ha
 * scelte di piu' vede le prime sei, che sono quelle che ha messo davanti. */
const val AZIONI_AL_MASSIMO = 6

private fun leAzioni(json: JSONObject): List<Azione> {
    val elenco = json.optJSONArray("azioni") ?: return emptyList()
    val fuori = mutableListOf<Azione>()
    for (i in 0 until elenco.length()) {
        if (fuori.size >= AZIONI_AL_MASSIMO) break
        val voce = elenco.optJSONObject(i) ?: continue
        val id = voce.optString("id", "").trim()
        val nome = voce.optString("nome", "").trim()
        if (id.isNotEmpty() && nome.isNotEmpty()) {
            fuori.add(
                Azione(
                    id = id,
                    nome = nome,
                    segno = voce.optString("segno", "").trim(),
                    /* Non scritto vale «no»: una fotografia di un'app piu'
                     * vecchia di questo campo non deve promettere che il tasto
                     * parte da solo. */
                    subito = voce.optBoolean("subito", false),
                ),
            )
        }
    }
    return fuori
}
