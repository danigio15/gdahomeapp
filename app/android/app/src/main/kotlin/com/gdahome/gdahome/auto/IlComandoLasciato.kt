/* Il comando che l'auto lascia scritto, e che esegue l'app.
 *
 * Il servizio dell'auto non parla con la casa: non ha il filo, non ha le
 * chiavi, e dargliele vorrebbe dire due posti che sanno entrare in casa. Cosi'
 * scrive cosa e' stato premuto in un file suo, e l'app — l'unica che il filo
 * ce l'ha — lo esegue appena e' viva.
 *
 * Uno alla volta e con la sua ora: se si preme due volte il cancello resta
 * l'ultimo, perche' due ordini identici a distanza di un secondo sono una
 * pressione sola. E l'ora serve all'app per buttare via un comando vecchio:
 * «apri il cancello» arrivato mezz'ora fa non e' piu' quello che uno voleva.
 */
package com.gdahome.gdahome.auto

import android.content.Context
import org.json.JSONObject
import java.io.File

private const val NOME_DEL_FILE = "gdahome-auto-comando.json"

fun fileDelComando(context: Context): File = File(context.filesDir, NOME_DEL_FILE)

/** Lascia scritto il comando. Torna `false` se non si e' potuto scrivere. */
fun lasciaIlComando(context: Context, id: String): Boolean {
    val quale = id.trim()
    if (quale.isEmpty()) return false
    val json = JSONObject()
        .put("azione", quale)
        .put("quando", System.currentTimeMillis())
    return runCatching { fileDelComando(context).writeText(json.toString()) }.isSuccess
}
