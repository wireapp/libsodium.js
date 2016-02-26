OUT_DIR=./dist
LIBSODIUM_DIR=./libsodium
LIBSODIUM_JS_DIR=$(LIBSODIUM_DIR)/libsodium-js

all: $(OUT_DIR)/libsodium.js $(OUT_DIR)/libsodium-wrappers.js
	@echo
	ls -l $(OUT_DIR)/

$(OUT_DIR)/libsodium.js: $(LIBSODIUM_DIR)/test/js.done wrapper/libsodium-pre.js wrapper/libsodium-post.js
	mkdir -p $(OUT_DIR)
	cat wrapper/libsodium-pre.js $(LIBSODIUM_JS_DIR)/lib/libsodium.js wrapper/libsodium-post.js > $(OUT_DIR)/libsodium.js

$(OUT_DIR)/libsodium-wrappers.js: $(LIBSODIUM_DIR)/test/js.done wrapper/build-wrapper.js wrapper/build-doc.js wrapper/wrap-template.js
	mkdir -p $(OUT_DIR)
	iojs wrapper/build-wrapper.js || nodejs wrapper/build-wrapper.js || node wrapper/build-wrapper.js

$(LIBSODIUM_DIR)/test/js.done: $(LIBSODIUM_DIR)/configure
	cd $(LIBSODIUM_DIR) && ./dist-build/emscripten.sh

$(LIBSODIUM_DIR)/configure: $(LIBSODIUM_DIR)/configure.ac
	cd $(LIBSODIUM_DIR) && ./autogen.sh

$(LIBSODIUM_DIR)/configure.ac: .gitmodules
	git submodule update --init --recursive

clean:
	rm -f $(LIBSODIUM_DIR)/test/js.done
	rm -rf $(LIBSODIUM_JS_DIR)
	rm -rf $(OUT_DIR)
	-cd $(LIBSODIUM_DIR) && make distclean

distclean: clean

rewrap:
	rm -fr $(OUT_DIR)
	make
