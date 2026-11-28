package com.gdahome.gdahome.rete

import io.flutter.plugin.common.BinaryMessenger

/*
 * Sul telefono le impostazioni del pannello non ci sono: il canale non si
 * apre. L'altra faccia sta in `src/muro`.
 */
object IlPannello {
    @Suppress("UNUSED_PARAMETER")
    fun collega(messaggi: BinaryMessenger, activity: android.app.Activity) {}
}
