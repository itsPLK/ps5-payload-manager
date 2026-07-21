# Payload Manager - Native PS5 ELF Daemon Makefile

# Tools
PYTHON := python3
CC     := /opt/ps5-payload-sdk/bin/prospero-clang
STRIP  := /opt/ps5-payload-sdk/bin/prospero-strip

# Paths
SDK      := /opt/ps5-payload-sdk
TARGET   := $(SDK)/target
INCLUDES := -Iinclude -I$(TARGET)/include
LIBS     := $(TARGET)/lib/libcurl.a \
            $(TARGET)/lib/libmbedtls.a \
            $(TARGET)/lib/libmbedx509.a \
            $(TARGET)/lib/libmbedcrypto.a \
            $(TARGET)/lib/libmicrohttpd.a \
            -L$(TARGET)/lib -lpthread \
            -lSceNetCtl -lSceUserService -lSceSystemService \
            -lSceAppInstUtil -lSceHttp2 -lSceSsl -lSceNet

# Source Files
SRCS := src/main.c src/http_server.c src/config.c src/log_server.c \
        src/sha256.c src/json_helpers.c src/repository.c src/sources.c \
        src/payload_mgr.c src/process_mgr.c \
        src/ps5_launcher.c src/notification.c src/utils.c src/autoload.c \
        src/app_installer.c
OBJS := $(SRCS:.c=.o)
ELF  := pldmgr.elf

# Assets
FRONTEND_DIST := frontend/dist/index.html
ASSET_HEADER  := include/assets_index_html.h
CA_HEADER     := include/assets_cacert_pem.h
MANIFEST_HEADER := include/assets_cache_appcache.h
FRONTEND_MANIFEST := frontend/dist/cache.appcache
FAVICON_SVG_HEADER := include/assets_favicon_svg.h
ICON_PNG_HEADER := include/assets_icon_png.h




# Compiler Flags
CFLAGS := -Os -Wall -ffunction-sections -fdata-sections $(INCLUDES)
LDFLAGS := -Wl,--gc-sections

all: $(ELF)

# Build the React frontend
.PHONY: frontend-build
frontend-build:
	@echo "Building frontend..."
	git submodule update --init --recursive
	cd frontend && npm install && npm run build
	@VERSION=$$(grep '#define MENU_VERSION' include/pldmgr.h | awk '{print $$3}' | tr -d '"'); \
	COMMIT=$$(git rev-parse --short HEAD 2>/dev/null || echo "unknown"); \
	git diff --quiet || COMMIT="DEV"; \
	DATE=$$(date -u +"%Y-%m-%d %H:%M:%S UTC"); \
	TITLE="Payload Manager v$$VERSION by PLK ($$COMMIT, built at $$DATE)"; \
	echo "Updating title in index.html to: $$TITLE"; \
	TMP=$$(mktemp "$${TMPDIR:-/tmp}/pldmgr.XXXXXX"); \
	sed "s|\[\[TITLE_PLACEHOLDER\]\]|$$TITLE|g" frontend/dist/index.html > $$TMP; \
	mv $$TMP frontend/dist/index.html; \
	echo "Updating build date in cache.appcache to: $$DATE"; \
	TMP=$$(mktemp "$${TMPDIR:-/tmp}/pldmgr.XXXXXX"); \
	sed "s|\[\[BUILD_DATE\]\]|$$DATE|g" frontend/dist/cache.appcache > $$TMP; \
	mv $$TMP frontend/dist/cache.appcache



$(ASSET_HEADER): $(FRONTEND_DIST)
	@echo "Generating asset header..."
	$(PYTHON) tools/gen_assets.py $(FRONTEND_DIST) $(ASSET_HEADER) index_html

$(MANIFEST_HEADER): $(FRONTEND_DIST)
	@echo "Generating Manifest asset header..."
	$(PYTHON) tools/gen_assets.py $(FRONTEND_MANIFEST) $(MANIFEST_HEADER) cache_appcache

$(FAVICON_SVG_HEADER): $(FRONTEND_DIST)
	@echo "Generating Favicon SVG asset header..."
	$(PYTHON) tools/gen_assets.py frontend/dist/favicon.svg $(FAVICON_SVG_HEADER) favicon_svg

$(ICON_PNG_HEADER): $(FRONTEND_DIST)
	@echo "Generating Icon PNG asset header..."
	$(PYTHON) tools/gen_assets.py frontend/dist/icon.png $(ICON_PNG_HEADER) icon_png

$(CA_HEADER):
	@echo "Downloading CA bundle..."
	wget -O include/cacert.pem https://curl.se/ca/cacert.pem
	$(PYTHON) tools/gen_assets.py include/cacert.pem $(CA_HEADER) cacert_pem
	rm include/cacert.pem

$(FRONTEND_DIST):
	@echo "ERROR: frontend/dist/index.html not found!"
	@echo "Please run 'make frontend-build' locally on your host machine first."
	@exit 1

$(ELF): $(ASSET_HEADER) $(MANIFEST_HEADER) $(CA_HEADER) $(FAVICON_SVG_HEADER) $(ICON_PNG_HEADER) $(SRCS)
	@echo "Building $(ELF)..."
	$(CC) $(CFLAGS) $(LDFLAGS) -o $(ELF) $(SRCS) $(LIBS)
	@echo "Stripping $(ELF)..."
	$(STRIP) $(ELF)

clean:
	rm -f $(ELF) $(ASSET_HEADER) $(MANIFEST_HEADER) $(CA_HEADER) $(FAVICON_SVG_HEADER) $(ICON_PNG_HEADER) src/*.o





dist-clean: clean
	rm -rf frontend/dist

.PHONY: all clean frontend-build dist-clean
