/* La vetrina: una casa d'esempio, per le schermate del Play Store.
 *
 * Le schermate si fanno sull'emulatore, dove non c'e' nessun telefono a
 * portare la fotografia. Avviata con l'extra `vetrina` (`adb shell am start …
 * --es vetrina casa`, vedi `.github/workflows/vetrina.yml`) l'app non accende
 * il Data Layer e mostra questa casa; i tocchi non partono per nessun posto.
 */
package com.gdahome.gdahome.orologio

object Vetrina {
    private const val FOTO = """
        {"v":1,"premium":true,"casa":"Casa al mare","quando":0,
         "comandi":[
          {"id":"c1","nome":"Cancello","disegno":"varco","conferma":false},
          {"id":"c2","nome":"Portone","disegno":"serratura","conferma":true},
          {"id":"c3","nome":"Luci giardino","disegno":"luce","conferma":false},
          {"id":"c4","nome":"Arrivo a casa","disegno":"scena","conferma":false}],
         "dispositivi":[
          {"id":"d1","nome":"Salone","genere":"luce","stato":"Accesa","acceso":true},
          {"id":"d2","nome":"Garage","genere":"varco","stato":"Aperto","acceso":true},
          {"id":"d3","nome":"Lavatrice","genere":"presa","stato":"Spenta","acceso":false},
          {"id":"d4","nome":"Cucina","genere":"luce","stato":"Spenta","acceso":false}],
         "azioni":[
          {"id":"a1","nome":"Buonanotte","subito":true},
          {"id":"a2","nome":"Esco di casa","subito":true},
          {"id":"a3","nome":"Irrigazione","subito":false}],
         "persone":[{"nome":"Anna","inCasa":true},{"nome":"Marco","inCasa":false}],
         "misure":[{"nome":"Produzione","valore":"3,2 kW"},{"nome":"Consumo","valore":"1,1 kW"},
          {"nome":"Batteria","valore":"86 %"}],
         "nav":{"attiva":true,"casa":true,"lavoro":true,"tipo":10,"distanza":350,
          "istruzione":"Svolta a destra in Via Roma","strada":"Via Roma","restanti":12400,
          "secondi":840,"arrivo":0,"destinazione":"Casa","velocita":48,"limite":50}}
    """

    /** La fotografia d'esempio, aggiornata adesso e con l'arrivo fra quattordici minuti. */
    fun laFoto(): LaFoto? {
        val f = LaFoto.leggi(FOTO) ?: return null
        val adesso = System.currentTimeMillis()
        return f.copy(quando = adesso, guida = f.guida.copy(arrivoMs = adesso + 14 * 60_000))
    }

    /** Dove si apre, per ogni schermata chiesta. */
    fun destinazione(schermata: String, foto: LaFoto): String? = when (schermata) {
        "navigatore", "dispositivi", "azioni", "come" -> schermata
        "conferma" -> foto.comandi.firstOrNull { it.conferma }?.let { "conferma/${android.net.Uri.encode(it.id)}" }
        else -> null
    }
}
