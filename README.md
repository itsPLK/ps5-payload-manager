<p align="center">
 <img src="./assets/icon0.png" width="128" />
</p>
<h1 align="center">PS5 Payload Manager</h1>

<p align="center">A modern, web-based dashboard to easily manage, import, and automatically load payloads on your PS5.</p>

<p align="center">
  <a href="https://crowdin.com/project/ps5-payload-manager"><img src="https://badges.crowdin.net/ps5-payload-manager/localized.svg" alt="Crowdin"></a>
</p>

<p align="center">
 <img src="./pldmgr_screenshot.png" width="600" />
</p>

## Features
- **Web-Based Interface**: A modern dashboard to manage payloads from your PC, phone, or the PS5 itself.
- **Import Payloads**: Easily add new payloads from a USB drive or download them from the cloud repository.
- **Automated Startup**: Set up a list of payloads to load automatically whenever you start the manager.
- **Home Screen Shortcut**: Installs a dedicated "Payload Manager" app icon to your PS5 home screen for quick access.
- **Auto-Close Disc Player**: Optional setting to automatically close the Disc Player on startup (useful for BD-JB users).


## Installation

### Using an Autoloader (Recommended)
It is highly recommended to use **Payload Manager** together with an **Autoloader**:

[Y2JB](https://github.com/itsPLK/ps5-y2jb-autoloader) | [BD-JB](https://github.com/itsPLK/ps5-bdjb-autoloader) | [Lua](https://github.com/itsPLK/ps5-lua-autoloader)

`pldmgr.elf` is already included as the default payload in the latest versions of the Autoloaders linked above.

If you are using an older version and don't want to update the entire autoloader, you can simply:
1. Place `pldmgr.elf` into your `autoload` directory.
2. Add `pldmgr.elf` as the only entry in your `autoload.txt` config file.

### Standalone / Manual Loading
You can also manually load the manager like any other `.elf` file. Grab the latest version from the [Releases](https://github.com/itsPLK/ps5-payload-manager/releases) page.

## Custom Repositories
You can add third-party payload repositories to the manager. To learn how to create your own repository JSON and host it, see the [Custom Repositories Guide](CUSTOM_REPOSITORIES.md).

## Translations
PS5 Payload Manager supports multiple languages thanks to the community! 
If you'd like to help translate the app into your native language or improve existing translations, please visit our [Crowdin project](https://crowdin.com/project/ps5-payload-manager). 
All translations are managed exclusively through Crowdin.

**Translation Guidelines:**
- Please only submit translations in languages you are fluent in.
- Only translate strings when you know exactly what they mean in the context of the app. If you're unsure, it's much better to leave it untranslated than to guess incorrectly.
- *Pro Tip:* The best way to translate is to have the Payload Manager running on your PS5 or browser so you can navigate the UI and see the exact context of the buttons and descriptions you are translating!

### Supported Languages
| Language | Progress | Translator(s) |
| :--- | :---: | :--- |
| **Chinese Simplified** | [![zh-CN proofreading](https://img.shields.io/badge/dynamic/json?color=green&label=zh-CN&style=flat&logo=crowdin&query=%24.progress.14.data.approvalProgress&url=https%3A%2F%2Fbadges.awesome-crowdin.com%2Fstats-12556057-913733.json)](https://crowdin.com/project/ps5-payload-manager) | [owendswang](https://crowdin.com/profile/owendswang) |
| **German** | [![de proofreading](https://img.shields.io/badge/dynamic/json?color=green&label=de&style=flat&logo=crowdin&query=%24.progress.1.data.approvalProgress&url=https%3A%2F%2Fbadges.awesome-crowdin.com%2Fstats-12556057-913733.json)](https://crowdin.com/project/ps5-payload-manager) | [xEasy4Breezy](https://crowdin.com/profile/xEasy4Breezy) |
| **Italian** | [![it proofreading](https://img.shields.io/badge/dynamic/json?color=green&label=it&style=flat&logo=crowdin&query=%24.progress.5.data.approvalProgress&url=https%3A%2F%2Fbadges.awesome-crowdin.com%2Fstats-12556057-913733.json)](https://crowdin.com/project/ps5-payload-manager) | [Leon90](https://crowdin.com/profile/Leon90) |
| **Persian** | [![fa proofreading](https://img.shields.io/badge/dynamic/json?color=green&label=fa&style=flat&logo=crowdin&query=%24.progress.3.data.approvalProgress&url=https%3A%2F%2Fbadges.awesome-crowdin.com%2Fstats-12556057-913733.json)](https://crowdin.com/project/ps5-payload-manager) | [Epinor](https://crowdin.com/profile/Epinor) |
| **Polish** | [![pl proofreading](https://img.shields.io/badge/dynamic/json?color=green&label=pl&style=flat&logo=crowdin&query=%24.progress.9.data.approvalProgress&url=https%3A%2F%2Fbadges.awesome-crowdin.com%2Fstats-12556057-913733.json)](https://crowdin.com/project/ps5-payload-manager) | [najdek](https://crowdin.com/profile/najdek) |
| **Portuguese, Brazilian** | [![pt-BR proofreading](https://img.shields.io/badge/dynamic/json?color=green&label=pt-BR&style=flat&logo=crowdin&query=%24.progress.10.data.approvalProgress&url=https%3A%2F%2Fbadges.awesome-crowdin.com%2Fstats-12556057-913733.json)](https://crowdin.com/project/ps5-payload-manager) | [slipttees](https://crowdin.com/profile/slipttees), [matmarson](https://crowdin.com/profile/matmarson), [marcusvrb](https://crowdin.com/profile/marcusvrb) |
| **Russian** | [![ru proofreading](https://img.shields.io/badge/dynamic/json?color=green&label=ru&style=flat&logo=crowdin&query=%24.progress.11.data.approvalProgress&url=https%3A%2F%2Fbadges.awesome-crowdin.com%2Fstats-12556057-913733.json)](https://crowdin.com/project/ps5-payload-manager) | [Akela-1979](https://crowdin.com/profile/Akela-1979) |
| **Spanish** | [![es-ES proofreading](https://img.shields.io/badge/dynamic/json?color=green&label=es-ES&style=flat&logo=crowdin&query=%24.progress.2.data.approvalProgress&url=https%3A%2F%2Fbadges.awesome-crowdin.com%2Fstats-12556057-913733.json)](https://crowdin.com/project/ps5-payload-manager) | [Slayver95](https://crowdin.com/profile/Slayver95), [kXmpX](https://crowdin.com/profile/kXmpX) |
| **Turkish** | [![tr proofreading](https://img.shields.io/badge/dynamic/json?color=green&label=tr&style=flat&logo=crowdin&query=%24.progress.12.data.approvalProgress&url=https%3A%2F%2Fbadges.awesome-crowdin.com%2Fstats-12556057-913733.json)](https://crowdin.com/project/ps5-payload-manager) | [Sezar61](https://crowdin.com/profile/Sezar61) |
| **Ukrainian** | [![uk proofreading](https://img.shields.io/badge/dynamic/json?color=green&label=uk&style=flat&logo=crowdin&query=%24.progress.13.data.approvalProgress&url=https%3A%2F%2Fbadges.awesome-crowdin.com%2Fstats-12556057-913733.json)](https://crowdin.com/project/ps5-payload-manager) | [Mikeeee](https://crowdin.com/profile/Mikeeee) |

## Credits
- [John Törnblom](https://github.com/john-tornblom) - for the [shell UI installer](https://github.com/ps5-payload-dev/ftpsrv/blob/master/install-ps5.c) and various payloads used as reference.
- [BenNoxXD](https://github.com/BenNoxXD) - for the [Disc Player App termination logic](https://github.com/BenNoxXD/PS5-BDJ-HEN-loader/blob/main/HENloader_C_part/src/kill_disc_player.c).
- [owendswang](https://github.com/owendswang) - for [contributions](https://github.com/itsPLK/ps5-payload-manager/commits/main/?author=owendswang)
- Everyone else contributing to the PS5 homebrew scene.

## Donations
If you'd like to support my work, please check out the [DONATE.md](DONATE.md) file.

## Development
For build instructions and deployment details, see [DEVELOPMENT.md](DEVELOPMENT.md).
