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
    val icona: String,
    /* Il dominio della ricetta («cover», «light», «scene»…). Serve al disegno
     * quando il genere non lo sa dire: vedi [ilSegno]. */
    val dominio: String,
    val conferma: Boolean,
)

/** [metri]: a quanti metri da Casa si propone [arrivo], come scelto sul telefono. */
data class IComandi(val comandi: List<ComandoInAuto>, val arrivo: ComandoInAuto?, val metri: Float = 500f)

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
                    icona = uno.optString("icona", "").trim(),
                    dominio = uno.optString("dominio", "").trim(),
                    conferma = uno.optBoolean("conferma", false),
                ),
            )
        }
    }
    val arrivo = json.optString("arrivo", "").trim()
    val metri = json.optInt("metri", 500).coerceIn(50, 5_000).toFloat()
    return IComandi(comandi, comandi.firstOrNull { it.id == arrivo }, metri)
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
        if (!LaLicenzaInAuto.premium(carContext)) return senzaPremium(carContext)
        val comandi = leggiIComandi(carContext).comandi
        val elenco = ItemList.Builder()
        if (comandi.isEmpty()) {
            elenco.setNoItemsMessage(carContext.getString(R.string.auto_senza_comandi))
        }
        for (comando in comandi.take(quantiNeStanno(carContext))) {
            val (sopra, sotto) = suDueRighe(comando.nome)
            elenco.addItem(
                GridItem.Builder()
                    .setTitle(sopra)
                    /* Come in «Dispositivi»: se sotto non c'e' niente ci va
                     * uno spazio, perche' una tessera senza la riga sotto e'
                     * piu' bassa delle altre. */
                    .setText(sotto.ifBlank { " " })
                    .setImage(ilSegno(carContext, comando.genere, comando.dominio, comando.icona))
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

/* Il nome su due righe.
 *
 * L'auto taglia il titolo della griglia — «Cancello Automatico» diventa
 * «Cancello Auto…» — e la seconda riga, che c'e', la lasciavamo vuota. Allora
 * un nome lungo si spezza allo spazio che lascia i due pezzi piu' pari: il
 * primo sopra, il resto sotto. Uno corto resta dov'e': spezzare «Cancello» in
 * «Can» e «cello» non aiuta nessuno. */
private const val NOME_CORTO = 12

fun suDueRighe(nome: String): Pair<String, String> {
    if (nome.length <= NOME_CORTO) return nome to ""
    var dove = -1
    var peggio = Int.MAX_VALUE
    for (i in nome.indices) {
        if (nome[i] != ' ') continue
        /* Il pezzo piu' lungo dei due: si sceglie lo spazio che lo accorcia. */
        val quanto = maxOf(i, nome.length - i - 1)
        if (quanto < peggio) {
            peggio = quanto
            dove = i
        }
    }
    return if (dove < 0) nome to "" else nome.substring(0, dove) to nome.substring(dove + 1)
}

/* Che cos'e' questo comando, per il disegno.
 *
 * Lo dice il telefono («GenereDelComando» in `lib/auto/i_comandi.dart`), ma
 * «azione» e' anche il suo ripiego, e i comandi scritti prima di questa
 * correzione ce l'hanno tutti. Allora quando il genere non dice niente si
 * guarda il dominio della ricetta, che nel file c'e' sempre: un cancello gia'
 * scritto smette di uscire col fulmine senza aspettare che lo si risalvi. */
private fun ilGenere(genere: String, dominio: String): String {
    if (genere.isNotEmpty() && genere != "azione") return genere
    return when (dominio) {
        "scene", "script" -> "scena"
        "cover" -> "varco"
        "lock" -> "serratura"
        "light" -> "luce"
        "switch", "input_boolean", "fan" -> "presa"
        else -> "azione"
    }
}

/**
 * Il disegno di un comando, e il suo colore.
 *
 * I sette generi hanno sette disegni, gli stessi che si vedono sul telefono.
 * Il colore prima era `CarColor.DEFAULT` — «tingilo tu» — e l'auto li faceva
 * tutti bianchi: sei tessere identiche, e per riconoscerle restava solo il
 * nome, che nella griglia viene pure tagliato. Questi colori li da' l'auto, e
 * li da' giusti tanto sul tema chiaro quanto sullo scuro: un disegno colorato
 * da noi, invece, resterebbe uguale su tutti e due.
 */
fun ilSegno(context: CarContext, genere: String, dominio: String = "", icona: String = ""): CarIcon {
    val quale = if (icona.isNotEmpty()) icona else ilGenere(genere, dominio)
    val disegno = when (quale) {
        "varco" -> R.drawable.auto_varco
        "porta" -> R.drawable.auto_porta
        "luce" -> R.drawable.auto_luce
        "presa" -> R.drawable.auto_presa
        "scena" -> R.drawable.auto_scena
        "serratura" -> R.drawable.auto_serratura
        else -> R.drawable.auto_azione
    }
    val colore = when (quale) {
        "varco", "porta" -> CarColor.BLUE
        "luce" -> CarColor.YELLOW
        "presa" -> CarColor.GREEN
        "scena" -> CarColor.PRIMARY
        /* Rosso: e' l'unico che, premuto, apre casa — ed e' anche l'unico che
         * prima di farlo chiede conferma. */
        "serratura" -> CarColor.RED
        else -> CarColor.DEFAULT
    }
    return CarIcon.Builder(IconCompat.createWithResource(context, disegno))
        .setTint(colore)
        .build()
}
