# Pardus Tampermonkey Suite

**Pardus Tampermonkey Suite** is a collection of JavaScript tools and utilities designed to enhance and streamline interaction with the Pardus web interface using Tampermonkey.

## Contents

- **TamperMonkeyImport**  
  Script to import all setting for tampermonkey

- **global-files**  
  Shared javascript files used for the userjs such as a global logging, ap route planner, and cookie access

- **resources**  
  Static resources (e.g., images, JSON files, templates) used by the scripts.

- **userjs**  
  Main Tampermonkey user scripts intended to run on the Pardus website.

## Features

- Enables custom automation and enhanced features for Pardus users.
- Modular architecture: shared utilities and assets are centralized.
- Easy to extend and maintain.

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension in your browser.
2. Navigate to the `userjs` folder and install the required `.user.js` script(s).
3. If applicable, make sure to mirror the folder structure (`TamperMonkeyImport`, `global-files`, `resources`) in your local setup or host them appropriately, depending on how your scripts reference these assets.

## Usage

- After installation, the scripts will run automatically when browsing the Pardus web interface.
- Configure any settings (if applicable) via the Tampermonkey dashboard or within the scripts themselves.

<!--
## Configuration

If there's a config file or customizable parameters, describe them here. For example:

| File / Variable       | Description                                      | Default |
|-----------------------|--------------------------------------------------|---------|
| `config.js` (in userjs) | API endpoint for resource loading               | `https://...` |
-->
## Development

1. Clone the repo:
   ```bash
   git clone https://github.com/spacerules/pardus-tampermonkey.git
   cd pardus-tampermonkey
