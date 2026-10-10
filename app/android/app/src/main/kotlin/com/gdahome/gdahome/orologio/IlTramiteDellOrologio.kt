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
        val casa = leggiLaFoto(context)
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
                    JSONObject().put("id", it.id).put("nome", it.nome).put("subito", it.subito)
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
     * Un tocco dal polso. Torna la risposta da mostrare all'orologio, in
     * JSON: `{"ok": true, "testo": "Fatto"}`.
     */
    fun esegui(context: Context, detto: String): String {
        val messaggio = runCatching { JSONObject(detto) }.getOrNull() ?: JSONObject()
        fun risposta(ok: Boolean, testo: String) = JSONObject().put("ok", ok).put("testo", testo).toString()
        val cosa = messaggio.optString("cosa", "")
        if (cosa == "aggiorna") {
            ultima = null
            manda(context)
            return JSONObject().put("ok", true).put("foto", fotografia(context)).toString()
        }
        /* Uno schermo rimasto aperto al polso mentre Premium finiva: non parte
         * niente, come in auto. */
        if (!LaLicenzaInAuto.premium(context)) return risposta(false, "Serve gdahome Premium")
        return when (cosa) {
            "comando" -> {
                val id = messaggio.optString("id", "").trim()
                if (id.isEmpty()) return risposta(false, "Comando sconosciuto")
                val scritto = lasciaIlComando(context, id)
                if (scritto) principale.post { IlPonteDellAuto.sveglia(context) }
                risposta(scritto, if (scritto) "Fatto" else "Non sono riuscito a mandarlo")
            }
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
