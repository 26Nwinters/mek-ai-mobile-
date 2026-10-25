plugins { id("com.android.application") }

// GitHub Actions supplies these values from encrypted repository secrets.
// They are not committed to git and are required only for release builds.
val mekSigningKeyPath = System.getenv("MEK_SIGNING_KEYSTORE_PATH")
val mekSigningPassword = System.getenv("MEK_SIGNING_PASSWORD")

android {
    namespace = "com.mekai.mobile"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.mekai.mobile"
        minSdk = 31
        targetSdk = 36
        versionCode = 21
        versionName = "0.7.4"
    }
    signingConfigs {
        create("mekaiPermanent") {
            if (!mekSigningKeyPath.isNullOrBlank()) storeFile = file(mekSigningKeyPath)
            if (!mekSigningPassword.isNullOrBlank()) {
                storePassword = mekSigningPassword
                keyPassword = mekSigningPassword
            }
            keyAlias = "mekai-home"
            storeType = "pkcs12"
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            // Never let a release silently use Gradle's local debug certificate.
            signingConfig = signingConfigs.getByName("mekaiPermanent")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
