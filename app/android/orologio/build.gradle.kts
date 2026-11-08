// gdahome al polso: l'app per gli orologi Wear OS.
//
// Si costruisce a parte dal telefono, e solo quando lo si chiede:
//   GDAHOME_OROLOGIO=si ./gradlew :orologio:assembleRelease
// (vedi `settings.gradle.kts` e docs/OROLOGIO.md).
//
// Con la casa non parla: la fotografia gliela porta il telefono, e i tocchi
// li fa partire il telefono. Per questo deve avere **lo stesso nome e la
// stessa firma** dell'app del telefono: il Data Layer di Wear OS mette in
// contatto solo app che si chiamano uguale e sono firmate dalla stessa chiave.
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.0"
}

// La stessa chiave del telefono, con le stesse regole (`app/build.gradle.kts`).
val chiaveVera =
    Properties().apply {
        val dove = rootProject.file("chiave.properties")
        if (dove.exists()) dove.inputStream().use { load(it) }
    }
val cELaChiaveVera = chiaveVera.getProperty("storeFile") != null

// Il numero per il negozio: quello del telefono, un miliardo piu' su.
//
// Telefono e orologio stanno nella stessa scheda del Play Store, e li' due
// pacchetti non possono avere lo stesso numero. Prima l'orologio era «il
// telefono piu' uno», contando sui salti di cento del telefono (1.10.11 →
// 1101100); ma le correzioni del telefono stanno proprio li' in mezzo
// (1.18.12.1 → 1181201), e la 1.18.12.1 il Play Store l'ha rifiutata:
// «Version code 1181201 has already been used», preso dall'orologio della
// 1.18.12. Un miliardo sopra non si scontra con nessun numero del telefono,
// cresce con lui, e sta sotto il massimo del negozio (2100000000).
val versione = rootProject.file("../pubspec.yaml").readLines()
    .first { it.startsWith("version:") }
    .substringAfter("version:").trim()
val nomeDellaVersione = versione.substringBefore("+")
val numeroDelTelefono = versione.substringAfter("+").toInt()

android {
    namespace = "com.gdahome.gdahome.orologio"
    compileSdk = 37

    signingConfigs {
        getByName("debug") {
            storeFile = rootProject.file("app/chiave-di-prova.jks")
            storePassword = "gdahome"
            keyAlias = "gdahome"
            keyPassword = "gdahome"
        }
        if (cELaChiaveVera) {
            create("vera") {
                // Relativo alla cartella del telefono, come la legge lui.
                storeFile = project(":app").file(chiaveVera.getProperty("storeFile"))
                storePassword = chiaveVera.getProperty("storePassword")
                keyAlias = chiaveVera.getProperty("keyAlias") ?: "gdahome"
                keyPassword =
                    chiaveVera.getProperty("keyPassword")
                        ?: chiaveVera.getProperty("storePassword")
            }
        }
    }

    defaultConfig {
        // Lo stesso del telefono: e' questo che li fa parlare.
        applicationId = "com.gdahome.gdahome"
        // Wear OS 3, il primo dei Wear OS di adesso.
        minSdk = 30
        targetSdk = 36
        versionCode = 1_000_000_000 + numeroDelTelefono
        versionName = nomeDellaVersione
    }

    buildTypes {
        // Come sul telefono: quello di prova si chiama `.prova`, e parla con
        // il telefono di prova.
        getByName("debug") {
            applicationIdSuffix = ".prova"
        }
        release {
            isMinifyEnabled = false
            if (cELaChiaveVera) {
                signingConfig = signingConfigs.getByName("vera")
            } else {
                signingConfig = signingConfigs.getByName("debug")
                applicationIdSuffix = ".prova"
                versionNameSuffix = "-prova"
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

dependencies {
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.wear.compose:compose-material:1.4.1")
    implementation("androidx.wear.compose:compose-foundation:1.4.1")
    implementation("androidx.wear.compose:compose-navigation:1.4.1")
    implementation("com.google.android.gms:play-services-wearable:19.0.0")
}
