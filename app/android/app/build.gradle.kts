plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    // La chiave con cui si firmano i pacchetti di prova.
    //
    // Sta qui dentro, nel progetto, e **deve starci**: senza, ogni macchina
    // che compila se ne genera una nuova, Android vede due firme diverse e
    // rifiuta di installare il pacchetto nuovo sopra il vecchio. Chi lo prova
    // e' costretto a disinstallare — e disinstallando **perde l'abbinamento**,
    // perche' il segno della casa sta nel portachiavi del telefono e con l'app
    // se ne va.
    //
    // Il risultato era che ogni versione nuova costava all'utente un giro
    // completo: stacca, fabbrica un codice, riabbina. Con una chiave ferma il
    // pacchetto nuovo si installa sopra e non gli si chiede piu' niente.
    //
    // Non e' un segreto e non protegge niente: firma soltanto i pacchetti di
    // prova, quelli che si passano a mano. Il giorno che si va sui negozi
    // servira' una chiave vera, tenuta fuori di qui.
    signingConfigs {
        getByName("debug") {
            storeFile = file("chiave-di-prova.jks")
            storePassword = "gdahome"
            keyAlias = "gdahome"
            keyPassword = "gdahome"
        }
    }

    namespace = "com.gdahome.gdahome"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.gdahome.gdahome"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
