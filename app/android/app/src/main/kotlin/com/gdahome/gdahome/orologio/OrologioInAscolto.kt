/* Il telefono in ascolto dell'orologio, anche con l'app chiusa.
 *
 * Il sistema accende questo servizio quando dal polso arriva una richiesta
 * sul percorso `/gdahome/tocco`: si risponde con quello che l'orologio deve
 * dire («Fatto», o cosa non va). Il lavoro vero lo fa
 * `IlTramiteDellOrologio.esegui`.
 */
package com.gdahome.gdahome.orologio

import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.WearableListenerService

class OrologioInAscolto : WearableListenerService() {
    override fun onRequest(nodeId: String, path: String, request: ByteArray): Task<ByteArray>? {
        if (path != IlTramiteDellOrologio.TOCCO) return null
        val risposta = runCatching {
            IlTramiteDellOrologio.esegui(applicationContext, request.toString(Charsets.UTF_8))
        }.getOrElse { """{"ok":false,"testo":"Non è partito"}""" }
        return Tasks.forResult(risposta.toByteArray(Charsets.UTF_8))
    }
}
