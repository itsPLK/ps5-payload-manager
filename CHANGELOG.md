## v0.4.2

### 🚀 Features & UX Improvements
* **System Language Support**: Added a "System Default" option in Settings to dynamically follow the OS/browser language ([#69](https://github.com/itsPLK/ps5-payload-manager/pull/69)).
* **New Languages**:
  * **German** (thanks to xEasy4Breezy)
  * **Persian** (thanks to Epinor)
  * **Spanish** (thanks to Slayver95, kXmpX)
  * **Turkish** (thanks to Sezar61)
  * **Ukrainian** (thanks to Mikeeee)

### 🛠️ Backend & Bug Fixes
* **Build Script**: Fixed an issue where translation files could sometimes be missing when compiling releases from source (thanks to @owendswang).

**Full Changelog**: [v0.4.1...v0.4.2](https://github.com/itsPLK/ps5-payload-manager/compare/v0.4.1...v0.4.2)

## v0.4.1
### 🚀 Features & UX Improvements
* **Translations**: Updated existing translations and added new languages.
* **New Languages**:
  * **Italian** (thanks to Leon90)
  * **Portuguese (Brazilian)** (thanks to matmarson, slipttees, marcusvrb)
  * **Russian** (thanks to Akela-1979)

**Full Changelog**: [v0.4.0...v0.4.1](https://github.com/itsPLK/ps5-payload-manager/compare/v0.4.0...v0.4.1)

## v0.4.0

### 🚀 Features & UX Improvements
* **Translations**: Added localization support (i18n) for the web dashboard.
* **New Languages**: 
  * **Chinese Simplified** (thanks to @owendswang)
  * **Polish**

### 🛠️ Backend & Bug Fixes
* **Static Linking**: Statically link third-party dependencies in the build script to prevent dynamic linking issues (thanks to @owendswang in [#66](https://github.com/itsPLK/ps5-payload-manager/pull/66)).

**Full Changelog**: [v0.3.3...v0.4.0](https://github.com/itsPLK/ps5-payload-manager/compare/v0.3.3...v0.4.0)

## v0.3.3

### 🚀 Features & UX Improvements
* **Cloud Repository Search & Sort**: Added search functionality and sorting options (Category, Update Time, Name) to the Cloud Repository view. Sort preferences are persisted across sessions.
* **Custom Payload Categories**: Added support for custom payload categories in third-party repositories and increased source limits.
* **Media App Category**: Moved the Payload Manager launcher icon to the "Media" tab on the PS5 home screen to keep the Games tab clean (thanks to @lucaszhongsj).  
  *Note: You may need to remove your existing Payload Manager shortcut from the home screen first for the new one to correctly appear in the Media tab.*
* **Repository Version Display**: When a custom repository explicitly defines a version, the frontend now displays it instead of trying to guess it from the filename (thanks to @lucaszhongsj).

### 🛠️ Backend & Bug Fixes
* **Standby Recovery**: Fixed an issue where the HTTP server would become unresponsive after waking the console from Rest Mode or dropping the network connection. The daemon now cleanly restarts the socket to recover the connection (fixes [#61](https://github.com/itsPLK/ps5-payload-manager/issues/61)).
* **SSL Verification Fixes**: Resolved intermittent SSL verification failures with mbedTLS and added a fallback to insecure downloads on SSL verification failure (fixes [#42](https://github.com/itsPLK/ps5-payload-manager/issues/42)).
* **App Installer Cleanup**: Added missing termination calls for the application installer utility (`sceAppInstUtil`) to ensure it closes properly.
* **iOS File Upload**: Removed the `accept` attribute on the file input to help mitigate an issue where payloads were greyed out for some iOS users ([#39](https://github.com/itsPLK/ps5-payload-manager/issues/39)).

**Full Changelog**: [v0.3.1...v0.3.3](https://github.com/itsPLK/ps5-payload-manager/compare/v0.3.1...v0.3.3)

## v0.3.1

- Fixed an issue where installed payloads were not showing on the dashboard for some users ([#28](https://github.com/itsPLK/ps5-payload-manager/issues/28)).
- Restored the USB scanning limit strictly to the root level.
- Added options to copy instead of move when importing payloads from USB.

**Full Changelog**: [v0.3.0...v0.3.1](https://github.com/itsPLK/ps5_next_menu/compare/v0.3.0...v0.3.1)

## v0.3.0

### 🚀 Features & UX Improvements
* **Multi-Source Payload Repositories**: Added support for adding, removing, and reordering third-party payload repository URLs via a new **Manage Sources** settings view. Payloads within the **Storage Hub** are now grouped by source with dedicated catalogs and origin badges. ([f4c76fb](https://github.com/itsPLK/ps5_next_menu/commit/f4c76fb))
* **Active Processes Management**: Added a dedicated **Active Processes** dashboard tab to view real-time processes, PIDs, and memory footprint, with support for terminating them via SIGKILL. ([631e7de](https://github.com/itsPLK/ps5_next_menu/commit/631e7de))
* **Alphabetical Sorting & Repository Polish**: As the payload repository grew larger, sorting by payload update date became cluttered. Repository payloads are now sorted alphabetically by name (with available updates pinned to the top), and also display payload version/update information. ([293f44b](https://github.com/itsPLK/ps5_next_menu/commit/293f44b))
* **UI & Mobile Layout Polish**:
  * Optimized card layouts on mobile to eliminate wasted vertical space and prevent overlapping text on narrow viewports. ([af72c9b](https://github.com/itsPLK/ps5_next_menu/commit/af72c9b))
  * Refined Settings, Log Viewer, and Manage Sources UI elements to fit narrower viewports and mobile screens. ([b3fe1b5](https://github.com/itsPLK/ps5_next_menu/commit/b3fe1b5))

### 🛠️ Backend, Performance & Refactoring
* **Daemon Codebase Decomposition**: Decomposed monolithic `main.c` and `payload_mgr.c` into 8 separate, single-responsibility modules (`http_server`, `repository`, `sources`, `config`, `log_server`, `json_helpers`, `sha256`, and `process_mgr`) for easier maintainability. ([2189ee9](https://github.com/itsPLK/ps5_next_menu/commit/2189ee9))
* **Disc Player Kill (for BD-JB users)**: Reduced total wait time from 8s to 2s during the disc player suspension process. ([7a001e4](https://github.com/itsPLK/ps5_next_menu/commit/7a001e4))
* **Log Polish**: Polling-related logs (`/list_payloads`, etc.) are now muted under normal operating conditions to prevent spamming output, and explicit logs are printed for process kill requests. ([0bf2b5e](https://github.com/itsPLK/ps5_next_menu/commit/0bf2b5e))

### ⚙️ Documentation & Polish
* **Custom Repositories Guide**: Created a comprehensive documentation guide (`CUSTOM_REPOSITORIES.md`) explaining the JSON structure required to host third-party payload repositories. ([0e0a434](https://github.com/itsPLK/ps5_next_menu/commit/0e0a434))

**Full Changelog**: [v0.2.0...v0.3.0](https://github.com/itsPLK/ps5_next_menu/compare/v0.2.0...v0.3.0)

## v0.2.0

### 🚀 Features & UX Improvements
* **Sidebar State Persistence**: The sidebar's expanded/collapsed state is now persisted in `localStorage` across page reloads. ([7570084](https://github.com/itsPLK/ps5_next_menu/commit/7570084))
* **Settings Page Redesign**: Updated `SettingsView` layout to a responsive grid for better visual alignment and UI consistency. ([2e7de34](https://github.com/itsPLK/ps5_next_menu/commit/2e7de34))
* **UX & Navigation Enhancements**:
  * Added automatic scrolling to the **USB Storage** section when clicking the redirect button in the Autoload section. ([6d14acf](https://github.com/itsPLK/ps5_next_menu/commit/6d14acf))
  * Added automatic scrolling to the top of the main container when changing views. ([75b20ce](https://github.com/itsPLK/ps5_next_menu/commit/75b20ce))
* **Visual Polish**:
  * Added dedicated favicon and application icons. ([c8c380b](https://github.com/itsPLK/ps5_next_menu/commit/c8c380b))
  * Fixed alignment and spacing on the `DonateView`. ([10c4233](https://github.com/itsPLK/ps5_next_menu/commit/10c4233))
  * Refined download modal title. ([7dee294](https://github.com/itsPLK/ps5_next_menu/commit/7dee294))

### 🛠️ Backend & Bug Fixes
* **Directory Cleanup**: Empty directories are now automatically cleaned up after deleting a payload (fixes [#24](https://github.com/itsPLK/ps5-payload-manager/issues/24)). ([5ff5295](https://github.com/itsPLK/ps5_next_menu/commit/5ff5295))
* **USB Payload Loading**: Fixed loading and scanning payloads from the root directory of a USB drive, limiting root scans strictly to the root level. ([bfc4d09](https://github.com/itsPLK/ps5_next_menu/commit/bfc4d09))
* **Daemon Reliability**: Daemon startup now safely replaces existing instances. ([a34ecff](https://github.com/itsPLK/ps5_next_menu/commit/a34ecff))
* **Error Reporting**: Improved launch error reporting back to the user when a payload fails to execute. ([38b1124](https://github.com/itsPLK/ps5_next_menu/commit/38b1124))
* **Log Reduction**: Removed verbose payload scanning status logs under normal operating conditions to prevent spam. ([0380757](https://github.com/itsPLK/ps5_next_menu/commit/0380757))

### ⚙️ CI/CD & Build System
* **GitHub Releases**: Added an on-demand automated release workflow (`release.yml`) to compile, package, and upload the build ELF binary. ([10b786b](https://github.com/itsPLK/ps5_next_menu/commit/10b786b))
* **Docker Build Strategy**: Migrated the SDK image reference to a dedicated `ps5-payload-sdk-pldmgr` tag to avoid image conflicts. ([cfba6b8](https://github.com/itsPLK/ps5_next_menu/commit/cfba6b8))
* **Build Portability**: Made frontend build scripts (`sed` commands) compatible and portable across macOS and Linux environment hosts. ([54c2728](https://github.com/itsPLK/ps5_next_menu/commit/54c2728))
* **Script Housekeeping**: Removed deprecated curl shutdown steps from `deploy.sh`. ([1ebcf98](https://github.com/itsPLK/ps5_next_menu/commit/1ebcf98))

**Full Changelog**: [v0.1.1...v0.2.0](https://github.com/itsPLK/ps5_next_menu/compare/v0.1.1...v0.2.0)

## v0.1.1

- Resolved legacy WebKit (PS5 4.03 / Safari 12) compatibility bugs.
- Improved autoload countdown synchronization.


## v0.1.0

- Initial release
