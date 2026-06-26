APP_NAME := Lack
BUILD_DIR := build/bin
DARWIN_APP := $(BUILD_DIR)/$(APP_NAME).app
ARM_APP := $(BUILD_DIR)/$(APP_NAME)-arm64.app
AMD_APP := $(BUILD_DIR)/$(APP_NAME)-amd64.app
UNIVERSAL_APP := $(BUILD_DIR)/$(APP_NAME)-universal.app
VERSION_FILE := VERSION
# Read version from VERSION file if present, otherwise use 'dev'
VERSION := $(strip $(shell test -f $(VERSION_FILE) && sed -n '1p' $(VERSION_FILE) || echo dev))
# Edition: 'enterprise' (default) or 'personal'
EDITION ?= enterprise
EDITION := $(strip $(EDITION))
VALID_EDITIONS := enterprise personal
ifneq ($(filter $(EDITION),$(VALID_EDITIONS)),$(EDITION))
$(error EDITION must be one of: $(VALID_EDITIONS))
endif

# 版本	构建命令
# 企业版 (默认)	make all 或 make EDITION=enterprise all
# 个人版	make EDITION=personal all

VERSION_PLAIN := $(shell echo $(VERSION) | sed 's/^v//')
GIT_COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)
GIT_DATE := $(shell git log -1 --format=%ci 2>/dev/null || echo unknown)
UNIVERSAL_DMG := $(BUILD_DIR)/$(APP_NAME)-$(VERSION)-$(EDITION)-universal.dmg
ARM_DMG := $(BUILD_DIR)/$(APP_NAME)-$(VERSION)-$(EDITION)-arm64.dmg
AMD_DMG := $(BUILD_DIR)/$(APP_NAME)-$(VERSION)-$(EDITION)-amd64.dmg
WINDOWS_EXE := $(BUILD_DIR)/$(APP_NAME)-$(VERSION)-$(EDITION)-windows-amd64.exe
CHECKSUMS_FILE := $(BUILD_DIR)/$(APP_NAME)-$(VERSION)-$(EDITION)-checksums.txt
RELEASE_ARTIFACTS := $(ARM_DMG) $(AMD_DMG) $(UNIVERSAL_DMG) $(WINDOWS_EXE)
ARM_BIN := $(ARM_APP)/Contents/MacOS/$(APP_NAME)
AMD_BIN := $(AMD_APP)/Contents/MacOS/$(APP_NAME)
UNIVERSAL_BIN := $(UNIVERSAL_APP)/Contents/MacOS/$(APP_NAME)
WAILS := wails
DARWIN_CGO_LDFLAGS := -framework UniformTypeIdentifiers -mmacosx-version-min=10.13
WITH_EMBEDDED_VERSION := set -e; backup=$$(mktemp); cp VERSION "$$backup"; restore_version() { cp "$$backup" VERSION; rm -f "$$backup"; }; trap restore_version EXIT HUP INT TERM; printf '%s\n' "$(VERSION)" > VERSION;

.PHONY: all verify go-verify frontend-verify frontend-install frontend-lint frontend-test frontend-build release-preflight mac mac-arm64 mac-amd64 mac-universal windows clean help icon-icns checksums

all: release-preflight mac-universal windows checksums

verify: frontend-verify go-verify

go-verify: frontend-build
	go mod verify
	go test ./...

frontend-verify: frontend-lint frontend-test frontend-build

frontend-install:
	cd frontend && pnpm install --frozen-lockfile

frontend-lint: | frontend-install
	cd frontend && pnpm lint

frontend-test: | frontend-install
	cd frontend && pnpm test

frontend-build: | frontend-install
	cd frontend && pnpm build

release-preflight:
	@if [ "$(ALLOW_DIRTY)" != "1" ]; then \
	  if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$$(git ls-files --others --exclude-standard)" ]; then \
	    echo "Error: worktree has uncommitted changes. Commit/stash first or set ALLOW_DIRTY=1 for a local build."; \
	    git status --short; \
	    exit 1; \
	  fi; \
	fi

mac: mac-arm64 mac-amd64

mac-arm64:
	@command -v $(WAILS) >/dev/null || (echo "wails not installed" && exit 1)
	@command -v hdiutil >/dev/null || (echo "hdiutil not found" && exit 1)
	@command -v plutil >/dev/null || echo "plutil not found, will skip Info.plist version update"
	@rm -rf "$(DARWIN_APP)" "$(ARM_APP)"
	@rm -f "$(BUILD_DIR)/$(APP_NAME).dmg" "$(ARM_DMG)"
	@$(WITH_EMBEDDED_VERSION) CGO_LDFLAGS="$(DARWIN_CGO_LDFLAGS)" VITE_APP_VERSION="$(VERSION_PLAIN)" VITE_EDITION="$(EDITION)" $(WAILS) build -platform darwin/arm64
	@test -d "$(DARWIN_APP)" || (echo "Error: mac arm64 build did not produce $(DARWIN_APP)" && exit 1)
	@mv "$(DARWIN_APP)" "$(ARM_APP)"
	@# set Info.plist version
	@if command -v plutil >/dev/null; then \
	  plutil -replace CFBundleShortVersionString -string "$(VERSION_PLAIN)" "$(ARM_APP)/Contents/Info.plist" && \
	  plutil -replace CFBundleVersion -string "$(VERSION_PLAIN)" "$(ARM_APP)/Contents/Info.plist"; \
	fi
	@# rename dmg if exists
	@if [ -f "$(BUILD_DIR)/$(APP_NAME).dmg" ]; then \
	  mv "$(BUILD_DIR)/$(APP_NAME).dmg" "$(ARM_DMG)"; \
	fi
	@# create dmg with app named Lack.app (not Lack-arm64.app)
	@if [ ! -f "$(ARM_DMG)" ]; then \
	  rm -rf "$(DARWIN_APP)" && cp -R "$(ARM_APP)" "$(DARWIN_APP)" && \
	  hdiutil create -fs HFS+ -volname "$(APP_NAME)" -srcfolder "$(DARWIN_APP)" -ov -format UDZO "$(ARM_DMG)" && \
	  rm -rf "$(DARWIN_APP)"; \
	fi
	@test -s "$(ARM_DMG)" || (echo "Error: missing or empty mac arm64 artifact: $(ARM_DMG)" && exit 1)

mac-amd64:
	@command -v $(WAILS) >/dev/null || (echo "wails not installed" && exit 1)
	@command -v hdiutil >/dev/null || (echo "hdiutil not found" && exit 1)
	@command -v plutil >/dev/null || echo "plutil not found, will skip Info.plist version update"
	@rm -rf "$(DARWIN_APP)" "$(AMD_APP)"
	@rm -f "$(BUILD_DIR)/$(APP_NAME).dmg" "$(AMD_DMG)"
	@$(WITH_EMBEDDED_VERSION) CGO_LDFLAGS="$(DARWIN_CGO_LDFLAGS)" VITE_APP_VERSION="$(VERSION_PLAIN)" VITE_EDITION="$(EDITION)" $(WAILS) build -platform darwin/amd64
	@test -d "$(DARWIN_APP)" || (echo "Error: mac amd64 build did not produce $(DARWIN_APP)" && exit 1)
	@mv "$(DARWIN_APP)" "$(AMD_APP)"
	@# set Info.plist version
	@if command -v plutil >/dev/null; then \
	  plutil -replace CFBundleShortVersionString -string "$(VERSION_PLAIN)" "$(AMD_APP)/Contents/Info.plist" && \
	  plutil -replace CFBundleVersion -string "$(VERSION_PLAIN)" "$(AMD_APP)/Contents/Info.plist"; \
	fi
	@# rename dmg if exists
	@if [ -f "$(BUILD_DIR)/$(APP_NAME).dmg" ]; then \
	  mv "$(BUILD_DIR)/$(APP_NAME).dmg" "$(AMD_DMG)"; \
	fi
	@# create dmg with app named Lack.app (not Lack-amd64.app)
	@if [ ! -f "$(AMD_DMG)" ]; then \
	  rm -rf "$(DARWIN_APP)" && cp -R "$(AMD_APP)" "$(DARWIN_APP)" && \
	  hdiutil create -fs HFS+ -volname "$(APP_NAME)" -srcfolder "$(DARWIN_APP)" -ov -format UDZO "$(AMD_DMG)" && \
	  rm -rf "$(DARWIN_APP)"; \
	fi
	@test -s "$(AMD_DMG)" || (echo "Error: missing or empty mac amd64 artifact: $(AMD_DMG)" && exit 1)

mac-universal: mac-arm64 mac-amd64
	@command -v lipo >/dev/null || (echo "lipo not found" && exit 1)
	@command -v hdiutil >/dev/null || (echo "hdiutil not found" && exit 1)
	@rm -rf "$(DARWIN_APP)" "$(UNIVERSAL_APP)"
	@rm -f "$(UNIVERSAL_DMG)"
	@cp -R "$(ARM_APP)" "$(UNIVERSAL_APP)"
	lipo -create -output "$(UNIVERSAL_BIN)" "$(ARM_BIN)" "$(AMD_BIN)"
	@# create universal dmg with app named Lack.app
	@rm -rf "$(DARWIN_APP)" && cp -R "$(UNIVERSAL_APP)" "$(DARWIN_APP)"
	@hdiutil create -fs HFS+ -volname "$(APP_NAME)" -srcfolder "$(DARWIN_APP)" -ov -format UDZO "$(UNIVERSAL_DMG)"
	@rm -rf "$(DARWIN_APP)"
	@test -s "$(UNIVERSAL_DMG)" || (echo "Error: missing or empty mac universal artifact: $(UNIVERSAL_DMG)" && exit 1)

windows:
	@command -v $(WAILS) >/dev/null || (echo "wails not installed" && exit 1)
	@rm -f "$(WINDOWS_EXE)" "$(BUILD_DIR)/$(APP_NAME).exe" "$(BUILD_DIR)/windows-amd64/$(APP_NAME).exe"
	@$(WITH_EMBEDDED_VERSION) VITE_APP_VERSION="$(VERSION_PLAIN)" VITE_EDITION="$(EDITION)" $(WAILS) build -platform windows/amd64
	@set -e; \
	if [ -f "$(BUILD_DIR)/$(APP_NAME).exe" ]; then \
	  mv "$(BUILD_DIR)/$(APP_NAME).exe" "$(WINDOWS_EXE)"; \
	elif [ -f "$(BUILD_DIR)/windows-amd64/$(APP_NAME).exe" ]; then \
	  mv "$(BUILD_DIR)/windows-amd64/$(APP_NAME).exe" "$(WINDOWS_EXE)"; \
	else \
	  echo "Error: Windows build did not produce $(APP_NAME).exe"; \
	  exit 1; \
	fi; \
	test -s "$(WINDOWS_EXE)" || (echo "Error: missing or empty Windows artifact: $(WINDOWS_EXE)" && exit 1)

checksums:
	@echo "==> Generating SHA-256 checksums..."
	@set -e; \
	for f in $(RELEASE_ARTIFACTS); do \
	  if [ ! -s "$$f" ]; then \
	    echo "Error: missing or empty release artifact: $$f"; \
	    exit 1; \
	  fi; \
	done
	@rm -f "$(CHECKSUMS_FILE)"
	@echo "# Build Info" >> "$(CHECKSUMS_FILE)"
	@echo "Version: $(VERSION)" >> "$(CHECKSUMS_FILE)"
	@echo "Git Commit: $(GIT_COMMIT)" >> "$(CHECKSUMS_FILE)"
	@echo "Git Branch: $(GIT_BRANCH)" >> "$(CHECKSUMS_FILE)"
	@echo "Git Date: $(GIT_DATE)" >> "$(CHECKSUMS_FILE)"
	@echo "Build Date: $$(date '+%Y-%m-%d %H:%M:%S %z')" >> "$(CHECKSUMS_FILE)"
	@echo "" >> "$(CHECKSUMS_FILE)"
	@echo "# SHA-256 Checksums" >> "$(CHECKSUMS_FILE)"
	@cd "$(BUILD_DIR)" && for f in $(notdir $(RELEASE_ARTIFACTS)); do \
	  shasum -a 256 "$$f" >> "$(notdir $(CHECKSUMS_FILE))"; \
	done
	@echo "==> Checksums saved to $(CHECKSUMS_FILE)"
	@cat "$(CHECKSUMS_FILE)"

clean:
	rm -rf "$(BUILD_DIR)"

help:
	@echo "Targets:"; \
	echo "  all            Run release preflight, build mac universal (arm64+amd64) and windows"; \
	echo "  verify         Run Go and frontend verification"; \
	echo "  go-verify      Run go mod verify and go test ./..."; \
	echo "  frontend-verify Run pnpm install --frozen-lockfile, lint, test and build"; \
	echo "  frontend-build Build frontend/dist for Go embed"; \
	echo "  release-preflight Fail release builds on dirty worktrees unless ALLOW_DIRTY=1"; \
	echo "  mac            Build mac arm64 and amd64 .app bundles"; \
	echo "  mac-universal  Create universal .app and .dmg from both arch builds"; \
	echo "  windows        Build Windows amd64 .exe"; \
	echo "  icon-icns      Convert PNG to ICNS (set ICON_PNG, optional ICON_ICNS)"; \
	echo "  clean"; \
	echo ""; \
	echo "Variables:"; \
	echo "  VERSION_FILE   Path to version file (default: VERSION)"; \
	echo "  EDITION        Build edition: 'enterprise' (default) or 'personal'"; \
	echo "  ICON_PNG       Source PNG for icon-icns (default: build/appicon.png)"; \
	echo "  ICON_ICNS      Output ICNS for icon-icns (default: ICON_PNG with .icns)";

# Convert a PNG to ICNS for DMG/app icon usage
ICON_PNG ?= build/appicon.png
ICON_ICNS ?= $(ICON_PNG:.png=.icns)

icon-icns:
	@command -v sips >/dev/null || (echo "sips not found (macOS built-in)." && exit 1)
	@command -v iconutil >/dev/null || (echo "iconutil not found. Install Xcode Command Line Tools: xcode-select --install" && exit 1)
	@[ -f "$(ICON_PNG)" ] || (echo "PNG not found: $(ICON_PNG)" && exit 1)
	@TMP_DIR=$$(mktemp -d); \
	ICONSET="$$TMP_DIR/icon.iconset"; mkdir -p "$$ICONSET"; \
	W=$$(sips -g pixelWidth  "$(ICON_PNG)" 2>/dev/null | awk '/pixelWidth/ {print $$2}'); \
	H=$$(sips -g pixelHeight "$(ICON_PNG)" 2>/dev/null | awk '/pixelHeight/ {print $$2}'); \
	if [ -n "$$W" ] && [ -n "$$H" ] && { [ "$$W" -lt 1024 ] || [ "$$H" -lt 1024 ]; }; then \
	  echo "Warning: ICON_PNG is $${W}x$${H}; recommended >= 1024x1024 for best quality"; \
	fi; \
	{ \
	  echo "16 icon_16x16.png"; \
	  echo "32 icon_16x16@2x.png"; \
	  echo "32 icon_32x32.png"; \
	  echo "64 icon_32x32@2x.png"; \
	  echo "128 icon_128x128.png"; \
	  echo "256 icon_128x128@2x.png"; \
	  echo "256 icon_256x256.png"; \
	  echo "512 icon_256x256@2x.png"; \
	  echo "512 icon_512x512.png"; \
	  echo "1024 icon_512x512@2x.png"; \
	} | while read -r sz name; do \
	  sips -z $$sz $$sz "$(ICON_PNG)" --out "$$ICONSET/$$name" >/dev/null; \
	done; \
	iconutil -c icns "$$ICONSET" -o "$(ICON_ICNS)" >/dev/null; \
	rm -rf "$$TMP_DIR"; \
	echo "Created: $(ICON_ICNS)"
