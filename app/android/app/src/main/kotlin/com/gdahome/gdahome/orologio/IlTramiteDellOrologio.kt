/* L'orologio Wear OS, dal lato del telefono.
 *
 * E' la copia per Android di `ios/Runner/LOrologio.swift`, e la regola e' la
 * stessa di Android Auto: l'orologio con la casa non parla. Il telefono gli
 * porta la fotografia — gli stessi tre file che legge l'auto, e la guida di
 * gdanav — e quando al polso si tocca qualcosa lo fa partire per la strada di
 * sempre: il comando lasciato scritto e il motore dei comandi svegliato
 * (`IlPonteDellAuto`).
 *
 * Il formato e' in `docs/OROLOGIO.md`; l'app per l'orologio sta in
 * `android/orologio`.
 */
package com.gdahome.gdahome.orologio

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.gdahome.gdahome.auto.IlPonteDellAuto
import com.gdahome.gdahome.auto.LaLicenzaInAuto
import com.gdahome.gdahome.auto.lasciaIlComando
import com.gdahome.gdahome.auto.leggiIComandi
import com.gdahome.gdahome.auto.leggiLaFoto
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodChannel
import it.gdanav.gdanav_app.auto.PonteAuto
import org.json.JSONArray
import org.json.JSONObject

object IlTramiteDellOrologio {
    /** Dove sta la fotografia nel Data Layer: lo stesso nome nell'orologio. */
    const val FOTO = "/gdahome/foto"

    /** Dove arrivano i tocchi dal polso. */
    const val TOCCO = "/gdahome/tocco"

    private val principale = Handler(Looper.getMainLooper())
    private var contesto: Context? = null
    private var inArrivo = false
    private var ultima: String? = null

    /* La guida arriva ogni secondo e anche piu' spesso: al polso si manda al
     * piu' una volta al secondo, e solo se e' cambiato qualcosa. */
    private val dallaGuida: () -> Unit = { mandaFraPoco() }

    /**
     * Il canale su cui il Dart dice «i file dell'auto sono cambiati»
     * (`lib/auto/sul_telefono.dart`), e la guida di gdanav. Si chiama per ogni
     * motore dell'app: chiamarlo due volte non fa danni.
     */
    fun collega(messaggi: BinaryMessenger, context: Context) {
        contesto = context.applicationContext
        MethodChannel(messaggi, "gdahome/orologio").setMethodCallHandler { chiamata, risposta ->
            if (chiamata.method == "aggiorna") {
                manda(context.applicationContext)
                risposta.success(null)
            } else {
                risposta.notImplemented()
            }
        }
        PonteAuto.smetti(dallaGuida)
        PonteAuto.ascolta(dallaGuida)
    }

    private fun mandaFraPoco() {
        if (inArrivo) return
        inArrivo = true
        principale.postDelayed({
            inArrivo = false
            contesto?.let { manda(it) }
        }, 1_000)
    }

    /** La fotografia per il polso, in JSON: vedi `docs/OROLOGIO.md`. */
    fun fotografia(context: Context): String {
        val premium = LaLicenzaInAuto.premium(context)
        val foto = JSONObject().put("v", 1).put("premium", premium)
        /* Senza Premium al polso si dice cosa serve, e i nomi di casa restano
         * sul telefono. */
        if (!premium) return foto.toString()
        val casa = leggiLaFoto(context, perIlPolso = true)
        foto.put("casa", casa?.casa ?: "")
        foto.put("quando", casa?.quando ?: 0L)
        foto.put(
            "comandi",
            JSONArray(
                leggiIComandi(context).comandi.map {
                    JSONObject()
                        .put("id", it.id)
                        .put("nome", it.nome)
                        .put("disegno", it.icona.ifEmpty { it.genere })
                        .put("conferma", it.conferma)
                },
            ),
        )
        foto.put(
            "dispositivi",
            JSONArray(
                casa?.dispositivi.orEmpty().map {
                    JSONObject()
                        .put("id", it.id)
                        .put("nome", it.nome)
                        .put("genere", it.genere)
                        .put("stato", it.stato)
                        .put("acceso", it.acceso)
                },
            ),
        )
        foto.put(
            "azioni",
            JSONArray(
                casa?.azioni.orEmpty().map {
                    JSONObject().put("id", it.id).put("nome", it.nome).put("subito", it.subitoAlPolso)
                },
            ),
        )
        foto.put(
            "persone",
            JSONArray(casa?.persone.orEmpty().map { JSONObject().put("nome", it.nome).put("inCasa", it.inCasa) }),
        )
        foto.put(
            "misure",
            JSONArray(casa?.fotovoltaico.orEmpty().map { JSONObject().put("nome", it.nome).put("valore", it.valore) }),
        )
        foto.put("nav", laGuida())
        return foto.toString()
    }

    /** Quello che si vede al polso della guida: niente mappa, niente posizione. */
    private fun laGuida(): JSONObject {
        val g = PonteAuto.guida
        val nav = JSONObject()
            .put("attiva", g != null)
            .put("casa", PonteAuto.casa() != null)
            .put("lavoro", PonteAuto.lavoro() != null)
        PonteAuto.messaggio?.takeIf { it.isNotBlank() }?.let { nav.put("messaggio", it) }
        PonteAuto.cruscotto.velocita?.let { nav.put("velocita", it) }
        PonteAuto.cruscotto.limite?.let { nav.put("limite", it) }
        if (g != null) {
            nav.put("tipo", g.tipo)
                .put("distanza", g.distanzaM)
                .put("istruzione", g.istruzione)
                .put("strada", g.strada)
                .put("restanti", g.restantiM)
                .put("secondi", g.restantiS)
                .put("arrivo", g.arrivoMs)
                .put("destinazione", g.destinazione)
            g.rotonda?.let { nav.put("rotonda", it) }
        }
        return nav
    }

    /**
     * La mette nel Data Layer, che la porta all'orologio quando c'e' e la
     * tiene per quando torna. Uguale a quella di prima, non si manda: il Data
     * Layer la riconsegnerebbe lo stesso, e l'orologio si sveglierebbe per
     * niente. Lo chiamano il filo principale e il servizio in ascolto, che
     * gira su un altro: uno alla volta.
     */
    @Synchronized
    fun manda(context: Context) {
        val foto = runCatching { fotografia(context) }.getOrNull() ?: return
        if (foto == ultima) return
        ultima = foto
        runCatching {
            val richiesta = PutDataMapRequest.create(FOTO).apply {
                dataMap.putString("foto", foto)
            }.asPutDataRequest().setUrgent()
            Wearable.getDataClient(context).putDataItem(richiesta)
        }
    }

    /**
     * Un tocco dal polso. [finito] riceve, una volta, la risposta da mostrare
     * all'orologio, in JSON: `{"ok": true, "testo": "Fatto"}`.
     *
     * «Android dice fatto ma in realta' non fa nulla.» Per un comando si
     * rispondeva «Fatto» appena scritto il file, prima che il Dart lo
     * eseguisse: se poi non partiva (la casa che non risponde, un tasto che
     * vuole l'app) al polso restava una bugia. Adesso si aspetta com'e'
     * finita, come sull'iPhone (`LOrologio.swift`), al piu' [ATTESA_MS].
     */
    fun esegui(context: Context, detto: String, finito: (String) -> Unit) {
        val messaggio = runCatching { JSONObject(detto) }.getOrNull() ?: JSONObject()
        fun risposta(ok: Boolean, testo: String) = JSONObject().put("ok", ok).put("testo", testo).toString()
        if (messaggio.optString("cosa", "") != "comando" || !LaLicenzaInAuto.premium(context)) {
            return finito(subito(context, messaggio))
        }
        val id = messaggio.optString("id", "").trim()
        if (id.isEmpty()) return finito(risposta(false, "Comando sconosciuto"))
        if (!lasciaIlComando(context, id, dalPolso = true)) {
            return finito(risposta(false, "Non sono riuscito a mandarlo"))
        }
        principale.post {
            var detta = false
            val rispondi: (String) -> Unit = { testo ->
                if (!detta) {
                    detta = true
                    finito(testo)
                }
            }
            val tardi = Runnable { rispondi(risposta(true, "Mandato: la casa non ha ancora risposto")) }
            principale.postDelayed(tardi, ATTESA_MS)
            IlPonteDellAuto.sveglia(context) { com ->
                principale.post {
                    principale.removeCallbacks(tardi)
                    rispondi(conLaFoto(context, com))
                }
            }
        }
    }

    /**
     * La risposta al polso, e con lei la fotografia di adesso quando il
     * comando e' andato.
     *
     * «Accende le luci ma non cambia stato.» Il Dart corregge la fotografia
     * quando Home Assistant dice lo stato nuovo, e per una luce lo dice quasi
     * sempre prima ancora di rispondere al comando: quando arriva «fatto» la
     * riga giusta e' gia' sul disco. L'orologio la fotografia dentro una
     * risposta la sa prendere da sempre (`IlTelefono.kt`, `manda`): cosi' la
     * riga cambia insieme alla conferma, senza aspettare il Data Layer. Se lo
     * stato arriva dopo, parte da se' quando il Dart lo dice ([manda]).
     */
    private fun conLaFoto(context: Context, com: String?): String {
        val detta = comEFinita(com)
        if (com != "fatto") return detta
        return runCatching { JSONObject(detta).put("foto", fotografia(context)).toString() }.getOrDefault(detta)
    }

    /** Quello che si dice al polso, da com'e' finito il comando nel Dart (`ComeEFinitaInAuto`). */
    fun comEFinita(com: String?): String {
        fun risposta(ok: Boolean, testo: String) = JSONObject().put("ok", ok).put("testo", testo).toString()
        return when (com) {
            "fatto" -> risposta(true, "Fatto")
            // Il comando l'ha preso un altro giro gia' in corso: parte da li'.
            "niente" -> risposta(true, "Mandato")
            "aspettaLApp" -> risposta(false, "Questo si fa dal telefono: apri GdAHome")
            "senzaPremium" -> risposta(false, "Serve GdAHome Premium")
            "senzaCasa" -> risposta(false, "La casa non risponde. Apri GdAHome sul telefono e riprova")
            else -> risposta(false, "Parte appena apri GdAHome sul telefono")
        }
    }

    /** Quanto si aspetta che il Dart dica com'e' finito il comando. */
    private const val ATTESA_MS = 9_000L

    /** I tocchi a cui si risponde subito: tutto tranne un comando. */
    private fun subito(context: Context, messaggio: JSONObject): String {
        fun risposta(ok: Boolean, testo: String) = JSONObject().put("ok", ok).put("testo", testo).toString()
        val cosa = messaggio.optString("cosa", "")
        if (cosa == "aggiorna") {
            ultima = null
            manda(context)
            return JSONObject().put("ok", true).put("foto", fotografia(context)).toString()
        }
        /* Uno schermo rimasto aperto al polso mentre Premium finiva: non parte
         * niente, come in auto. */
        if (!LaLicenzaInAuto.premium(context)) return risposta(false, "Serve GdAHome Premium")
        return when (cosa) {
            "vai" -> {
                val dove = messaggio.optString("dove", "")
                val luogo = when (dove) {
                    "casa" -> PonteAuto.casa()
                    "lavoro" -> PonteAuto.lavoro()
                    else -> null
                }
                if (luogo == null) {
                    risposta(false, "Apri il navigatore sul telefono e imposta ${if (dove == "lavoro") "Lavoro" else "Casa"}")
                } else {
                    PonteAuto.vai(luogo)
                    risposta(true, "Calcolo il percorso…")
                }
            }
            "ferma" -> {
                PonteAuto.fermaDallAuto()
                risposta(true, "Guida finita")
            }
            else -> risposta(false, "Non so cosa fare")
        }
    }
}
