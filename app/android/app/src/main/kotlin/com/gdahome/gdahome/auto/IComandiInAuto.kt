/* I comandi rapidi in auto: quelli dietro il tasto con la casa, sulla mappa
 * del navigatore (versione col navigatore in auto).
 *
 * Li sceglie chi guida sul telefono (`lib/schermate/comandi_in_auto.dart`) e
 * l'app li scrive in `gdahome-auto-comandi.json` (`lib/auto/i_comandi.dart`):
 * i nomi dei campi sono gli stessi dei due lati. Premuto un comando, parte
 * come i tasti di sempre: il segno lasciato scritto e il motore dei comandi
 * svegliato (`IlTastoPremuto.kt`), che trova la ricetta e la esegue.
 *
 * Una serratura chiede prima conferma: un tocco sbagliato guidando non deve
 * aprire la porta di casa.
 */
package com.gdahome.gdahome.auto

import android.content.Context
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.constraints.ConstraintManager
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.CarColor
import androidx.car.app.model.CarIcon
import androidx.car.app.model.GridItem
import androidx.car.app.model.GridTemplate
import androidx.car.app.model.ItemList
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Template
import androidx.core.graphics.drawable.IconCompat
import com.gdahome.gdahome.R
import org.json.JSONObject
import java.io.File

private const val NOME_DEI_COMANDI = "gdahome-auto-comandi.json"
private const val COMANDI_AL_MASSIMO = 12

/* Quanti ne entrano nella griglia di QUESTA auto: sei su tutte, di piu' sugli
 * schermi grandi. Lo dice l'auto, dalla versione 2 delle API; prima, sei. */
private fun quantiNeStanno(context: CarContext): Int =
    runCatching {
        if (context.carAppApiLevel < 2) return@runCatching 6
        context.getCarService(ConstraintManager::class.java)
            .getContentLimit(ConstraintManager.CONTENT_LIMIT_TYPE_GRID)
    }.getOrDefault(6).coerceIn(6, COMANDI_AL_MASSIMO)

data class ComandoInAuto(
    val id: String,
    val nome: String,
    val genere: String,
    val conferma: Boolean,
)

data class IComandi(val comandi: List<ComandoInAuto>, val arrivo: ComandoInAuto?)

fun leggiIComandi(context: Context): IComandi {
    val file = File(context.filesDir, NOME_DEI_COMANDI)
    if (!file.isFile) return IComandi(emptyList(), null)
    val json = runCatching { JSONObject(file.readText()) }.getOrNull()
        ?: return IComandi(emptyList(), null)
    val elenco = json.optJSONArray("comandi")
    val comandi = mutableListOf<ComandoInAuto>()
    if (elenco != null) {
        for (i in 0 until elenco.length()) {
            if (comandi.size >= COMANDI_AL_MASSIMO) break
            val uno = elenco.optJSONObject(i) ?: continue
            val id = uno.optString("id", "").trim()
            val nome = uno.optString("nome", "").trim()
            if (id.isEmpty() || nome.isEmpty()) continue
            comandi.add(
                ComandoInAuto(
                    id = id,
                    nome = nome,
                    genere = uno.optString("genere", "").trim(),
                    conferma = uno.optBoolean("conferma", false),
                ),
            )
        }
    }
    val arrivo = json.optString("arrivo", "").trim()
    return IComandi(comandi, comandi.firstOrNull { it.id == arrivo })
}

/** Preme un comando: se chiede conferma, prima la conferma. */
fun premiIlComando(screen: Screen, comando: ComandoInAuto) {
    if (comando.conferma) {
        screen.screenManager.push(ConfermaInAuto(screen.carContext, comando))
    } else {
        premiEDillo(screen.carContext, comando.id, comando.nome, true)
    }
}

class IComandiInAuto(context: CarContext) : Screen(context) {
    override fun onGetTemplate(): Template {
        val comandi = leggiIComandi(carContext).comandi
        val elenco = ItemList.Builder()
        if (comandi.isEmpty()) {
            elenco.setNoItemsMessage(carContext.getString(R.string.auto_senza_comandi))
        }
        for (comando in comandi.take(quantiNeStanno(carContext))) {
            elenco.addItem(
                GridItem.Builder()
                    .setTitle(comando.nome)
                    .setImage(ilSegno(carContext, comando.genere))
                    .setOnClickListener { premiIlComando(this, comando) }
                    .build(),
            )
        }
        return GridTemplate.Builder()
            .setSingleList(elenco.build())
            .setTitle(carContext.getString(R.string.auto_comandi))
            .setHeaderAction(Action.BACK)
            /* I dispositivi e com'e' la casa restano a un tocco: sono gli
             * schermi di gdahome in auto di sempre. */
            .setActionStrip(
                ActionStrip.Builder()
                    .addAction(
                        Action.Builder()
                            .setTitle(carContext.getString(R.string.auto_dispositivi))
                            .setOnClickListener { screenManager.push(LaCasaInAuto(carContext)) }
                            .build(),
                    )
                    .build(),
            )
            .build()
    }
}

/** «Sei sicuro?», per i comandi che non si fanno per sbaglio. */
class ConfermaInAuto(context: CarContext, private val comando: ComandoInAuto) : Screen(context) {
    override fun onGetTemplate(): Template =
        MessageTemplate.Builder(carContext.getString(R.string.auto_conferma, comando.nome))
            .setTitle(comando.nome)
            .setHeaderAction(Action.BACK)
            .addAction(
                Action.Builder()
                    .setTitle(carContext.getString(R.string.auto_conferma_si))
                    .setBackgroundColor(CarColor.PRIMARY)
                    .setOnClickListener {
                        premiEDillo(carContext, comando.id, comando.nome, true)
                        finish()
                    }
                    .build(),
            )
            .addAction(
                Action.Builder()
                    .setTitle(carContext.getString(R.string.auto_conferma_no))
                    .setOnClickListener { finish() }
                    .build(),
            )
            .build()
}

/** Il disegno di un comando, per genere: gli stessi della casa in auto. */
fun ilSegno(context: CarContext, genere: String): CarIcon {
    val disegno = when (genere) {
        "varco" -> R.drawable.auto_varco
        "porta" -> R.drawable.auto_porta
        "luce" -> R.drawable.auto_luce
        "presa" -> R.drawable.auto_presa
        else -> R.drawable.auto_azione
    }
    return CarIcon.Builder(IconCompat.createWithResource(context, disegno))
        .setTint(CarColor.DEFAULT)
        .build()
}
