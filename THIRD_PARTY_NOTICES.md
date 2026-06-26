# Third-Party Notices

This project redistributes selected third-party assets and uses open-source dependencies. Keep this file updated when vendored assets or major dependency groups change.

## ProjectDiscovery Nuclei Templates

- Source: https://github.com/projectdiscovery/nuclei-templates
- License: MIT
- Usage: curated AI/LLM-related Nuclei YAML templates are vendored under `nuclei-templates/` and embedded into release binaries.
- Scope: this repository includes only the selected AI/LLM template subset plus the local profile file used to keep scans focused.

## Checkmarx KICS Queries

- Source: https://github.com/Checkmarx/kics
- License: Apache-2.0
- Usage: a slim subset of KICS query files is vendored under `pkg/cloudscan/kics-queries/` and embedded for local cloud/IaC scanning.
- License file: `pkg/cloudscan/kics-queries/LICENSE`

## Wails Runtime

- Source: https://github.com/wailsapp/wails
- License: MIT
- Usage: generated frontend runtime bindings under `frontend/wailsjs/`.
