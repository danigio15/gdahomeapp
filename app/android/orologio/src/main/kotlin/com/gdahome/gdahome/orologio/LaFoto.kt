/* La fotografia che il telefono porta al polso.
 *
 * La scrive `IlTramiteDellOrologio.kt` sul telefono (e `LOrologio.swift`
 * sull'iPhone, per l'Apple Watch): il formato e' in `docs/OROLOGIO.md`. Si
 * legge campo per campo, e tutto quello che non torna vale «non c'e'».
 */
package com.gdahome.gdahome.orologio

import org.json.JSONArray
import org.json.JSONObject

data class Comando(val id: String, val nome: String, val disegno: String, val conferma: Boolean)

data class Dispositivo(val id: String, val nome: String, val genere: String, val stato: String, val acceso: Boolean)

data class Azione(val id: String, val nome: String, val subito: Boolean)

data class Persona(val nome: String, val inCasa: Boolean)

data class Misura(val nome: String, val valore: String)

/** La guida di gdanav, se si sta guidando. */
data class Guida(
    val attiva: Boolean = false,
    val tipo: Int = 0,
    val distanza: Double = 0.0,
    val istruzione: String = "",
    val strada: String = "",
    val restanti: Double = 0.0,
    val arrivoMs: Long = 0L,
    val messaggio: String = "",
    val haCasa: Boolean = false,
    val haLavoro: Boolean = false,
    val velocita: Double? = null,
    val limite: Int? = null,
)

data class LaFoto(
    val premium: Boolean = false,
    val casa: String = "",
    val quando: Long = 0L,
    val comandi: List<Comando> = emptyList(),
    val dispositivi: List<Dispositivo> = emptyList(),
    val azioni: List<Azione> = emptyList(),
    val persone: List<Persona> = emptyList(),
    val misure: List<Misura> = emptyList(),
    val guida: Guida = Guida(),
) {
    companion object {
        fun leggi(testo: String?): LaFoto? {
            if (testo.isNullOrBlank() || testo.length > 256 * 1024) return null
            val json = runCatching { JSONObject(testo) }.getOrNull() ?: return null
            val nav = json.optJSONObject("nav")
            return LaFoto(
                premium = json.optBoolean("premium", false),
                casa = json.optString("casa", "").trim(),
                quando = json.optLong("quando", 0L),
                comandi = righe(json.optJSONArray("comandi")).mapNotNull { r ->
                    val id = r.optString("id", "").trim()
                    val nome = r.optString("nome", "").trim()
                    if (id.isEmpty() || nome.isEmpty()) null
                    else Comando(id, nome, r.optString("disegno", "").trim(), r.optBoolean("conferma", false))
                },
                dispositivi = righe(json.optJSONArray("dispositivi")).mapNotNull { r ->
                    val id = r.optString("id", "").trim()
                    val nome = r.optString("nome", "").trim()
                    if (id.isEmpty() || nome.isEmpty()) null
                    else Dispositivo(
                        id,
                        nome,
                        r.optString("genere", "").trim().lowercase(),
                        r.optString("stato", "").trim(),
                        r.optBoolean("acceso", false),
                    )
                },
                azioni = righe(json.optJSONArray("azioni")).mapNotNull { r ->
                    val id = r.optString("id", "").trim()
                    val nome = r.optString("nome", "").trim()
                    if (id.isEmpty() || nome.isEmpty()) null else Azione(id, nome, r.optBoolean("subito", false))
                },
                persone = righe(json.optJSONArray("persone")).mapNotNull { r ->
                    val nome = r.optString("nome", "").trim()
                    if (nome.isEmpty()) null else Persona(nome, r.optBoolean("inCasa", false))
                },
                misure = righe(json.optJSONArray("misure")).mapNotNull { r ->
                    val nome = r.optString("nome", "").trim()
                    val valore = r.optString("valore", "").trim()
                    if (nome.isEmpty() || valore.isEmpty()) null else Misura(nome, valore)
                },
                guida = if (nav == null) Guida() else Guida(
                    attiva = nav.optBoolean("attiva", false),
                    tipo = nav.optInt("tipo", 0),
                    distanza = nav.optDouble("distanza", 0.0).takeIf { it.isFinite() } ?: 0.0,
                    istruzione = nav.optString("istruzione", "").trim(),
                    strada = nav.optString("strada", "").trim(),
                    restanti = nav.optDouble("restanti", 0.0).takeIf { it.isFinite() } ?: 0.0,
                    arrivoMs = nav.optLong("arrivo", 0L),
                    messaggio = nav.optString("messaggio", "").trim(),
                    haCasa = nav.optBoolean("casa", false),
                    haLavoro = nav.optBoolean("lavoro", false),
                    velocita = if (nav.has("velocita")) nav.optDouble("velocita").takeIf { it.isFinite() } else null,
                    limite = if (nav.has("limite")) nav.optInt("limite") else null,
                ),
            )
        }

        private fun righe(a: JSONArray?): List<JSONObject> {
            if (a == null) return emptyList()
            return (0 until minOf(a.length(), 12)).mapNotNull { a.optJSONObject(it) }
        }
    }
}

/** Il segno di un comando o di un dispositivo. */
fun segno(genere: String): String = when (genere) {
    "varco" -> "🚧"
    "porta" -> "🚪"
    "luce" -> "💡"
    "presa" -> "🔌"
    "scena" -> "✨"
    "serratura" -> "🔒"
    else -> "⚡"
}

/** La freccia della manovra, dal tipo di Valhalla (come `IconeManovra.kt` di gdanav). */
fun freccia(tipo: Int): String = when (tipo) {
    4, 5, 6 -> "🏁"
    9, 18, 20 -> "↗"
    2, 10 -> "→"
    11 -> "↘"
    12, 13 -> "↩"
    14 -> "↙"
    3, 15 -> "←"
    16, 19, 21 -> "↖"
    23 -> "⑂"
    24 -> "⑂"
    25, 37, 38 -> "⤙"
    26, 27 -> "⟲"
    28, 29 -> "⛴"
    else -> "↑"
}

/** «350 m», «1,2 km», «24 km». */
fun metri(m: Double): String = when {
    m < 1000 -> "${(Math.round(m / 10) * 10)} m"
    m >= 10_000 -> "${Math.round(m / 1000)} km"
    else -> String.format(java.util.Locale.ITALY, "%.1f km", m / 1000)
}
