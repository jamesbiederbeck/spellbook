APP_ID = dev.nobugs.spellbook

# WHISPER=1 (default): bundles the vendored whisper.cpp JNI bridge
# (libwhisper.so + deps, pinned in whisper_cpp_binary_version.json) so
# MainActivity's record button actually transcribes.
# WHISPER=0: same Java sources compile (WhisperBridge/WhisperLib are only
# ever touched from behind a BuildConfig.WHISPER_ENABLED check, so nothing
# needs excluding from SRC) but no native libs are downloaded or packaged —
# the record button stays disabled at runtime.
WHISPER ?= 1

SRC := $(shell find src -name "*.java")

OUT = out
CLASSES = $(OUT)/classes
DEX = $(OUT)/classes.dex
RESZIP = $(OUT)/compiled_res.zip

GEN_DIR = $(OUT)/gen
BUILD_CONFIG = $(GEN_DIR)/dev/nobugs/spellbook/BuildConfig.java
WHISPER_ENABLED = $(if $(filter 1,$(WHISPER)),true,false)

UNSIGNED = unsigned.apk
ALIGNED = aligned.apk

ANDROID_JAR ?= /usr/lib/android-sdk/platforms/android-33/android.jar
AAPT2 ?= /usr/lib/android-sdk/build-tools/33.0.1/aapt2
D8 ?= d8

KEYSTORE = debug.keystore
DEVICE ?= $(or $(ANDROID_DEVICE),$(shell $(ADB) devices | awk 'NR>1 && $$2=="device" {print $$1; exit}'))
ADB = ../../platform-tools/adb

# Vendored whisper.cpp JNI bridge (arm64-v8a only). Pinned release lives in
# whisper_cpp_binary_version.json — bump that file (and its sha256) to pick
# up a new build from jamesbiederbeck/whisper.cpp-vendored-android, rather
# than editing this Makefile.
WHISPER_PIN = whisper_cpp_binary_version.json
NATIVE_ABI = arm64-v8a
NATIVE_LIBS_DIR = $(OUT)/lib/$(NATIVE_ABI)
WHISPER_STAMP = $(OUT)/.whisper_libs_stamp
WHISPER_SO_FILES = libwhisper.so libggml.so libggml-base.so libggml-cpu.so libomp.so

all: $(ALIGNED)

# Regenerated every build (cheap) but only touched if the content actually
# changes, so switching WHISPER back and forth doesn't force a needless
# rebuild when it ends up back at the same value.
.PHONY: $(BUILD_CONFIG)
$(BUILD_CONFIG):
	mkdir -p $(dir $@)
	echo 'package dev.nobugs.spellbook; final class BuildConfig { static final boolean WHISPER_ENABLED = $(WHISPER_ENABLED); private BuildConfig() {} }' > $@.tmp
	cmp -s $@.tmp $@ 2>/dev/null && rm $@.tmp || mv $@.tmp $@

$(DEX): $(SRC) $(BUILD_CONFIG)
	rm -rf $(CLASSES) $(OUT)/classes*.dex
	mkdir -p $(CLASSES)
	javac -source 8 -target 8 -classpath $(ANDROID_JAR) -d $(CLASSES) $(SRC) $(BUILD_CONFIG)
	$(D8) --lib $(ANDROID_JAR) --min-api 26 --output $(OUT) $$(find $(CLASSES) -name "*.class")

RES := $(shell find res -type f)

$(RESZIP): $(RES)
	mkdir -p $(OUT)
	$(AAPT2) compile --dir res -o $(RESZIP)

# Downloads the pinned AAR, verifies it against whisper_cpp_binary_version.json's
# sha256, and extracts just the arm64-v8a .so files (the AAR also carries a
# Kotlin classes.jar / AndroidManifest.xml for upstream's own Gradle
# consumers — irrelevant here, since this app declares its own plain-Java
# WhisperLib matching libwhisper.so's exported JNI symbols directly; see
# src/com/whispercpp/whisper/WhisperLib.java).
$(WHISPER_STAMP): $(WHISPER_PIN)
	mkdir -p $(OUT)/whisper $(NATIVE_LIBS_DIR)
	REPO=$$(python3 -c "import json;print(json.load(open('$(WHISPER_PIN)'))['vendor_repo'])"); \
	TAG=$$(python3 -c "import json;print(json.load(open('$(WHISPER_PIN)'))['release_tag'])"); \
	ASSET=$$(python3 -c "import json;print(json.load(open('$(WHISPER_PIN)'))['asset_name'])"); \
	SHA=$$(python3 -c "import json;print(json.load(open('$(WHISPER_PIN)'))['asset_sha256'])"); \
	curl -sL "https://github.com/$$REPO/releases/download/$$TAG/$$ASSET" -o $(OUT)/whisper/whisper.aar; \
	echo "$$SHA  $(OUT)/whisper/whisper.aar" | sha256sum -c -
	cd $(OUT)/whisper && unzip -o whisper.aar $(addprefix jni/$(NATIVE_ABI)/,$(WHISPER_SO_FILES))
	cp $(addprefix $(OUT)/whisper/jni/$(NATIVE_ABI)/,$(WHISPER_SO_FILES)) $(NATIVE_LIBS_DIR)/
	touch $@

ifeq ($(WHISPER),1)
NATIVE_DEP = $(WHISPER_STAMP)
NATIVE_ZIP_CMD = (cd $(OUT) && zip -u ../$(UNSIGNED) lib/$(NATIVE_ABI)/*.so)
else
NATIVE_DEP =
NATIVE_ZIP_CMD = true
endif

$(UNSIGNED): $(DEX) $(RESZIP) $(NATIVE_DEP) AndroidManifest.xml
	$(AAPT2) link \
		-I $(ANDROID_JAR) \
		--manifest AndroidManifest.xml \
		--min-sdk-version 26 \
		--target-sdk-version 33 \
		$(RESZIP) \
		-o $(UNSIGNED)
	zip -j -u $(UNSIGNED) $(OUT)/classes*.dex
	$(NATIVE_ZIP_CMD)

$(ALIGNED): $(UNSIGNED)
	rm -f $(ALIGNED)
	zipalign -p 4 $(UNSIGNED) $(ALIGNED)
	apksigner sign \
		--ks $(KEYSTORE) \
		--ks-pass pass:android \
		--key-pass pass:android \
		$(ALIGNED)

install: $(ALIGNED)
	$(ADB) connect $(DEVICE)
	$(ADB) -s $(DEVICE) install -r $(ALIGNED)

run: install
	$(ADB) -s $(DEVICE) shell am start -n $(APP_ID)/.MainActivity

keystore:
	keytool -genkeypair \
		-keystore $(KEYSTORE) \
		-alias androiddebugkey \
		-keyalg RSA \
		-keysize 2048 \
		-validity 10000 \
		-storepass android \
		-keypass android \
		-dname "CN=Android Debug,O=Android,C=US"

clean:
	rm -rf out *.apk
