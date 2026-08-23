# Labbench

Dev tooling that lives in this repo but is never part of the deployed site (`xlab-utsa.github.io`). Each subfolder is a self-contained app/script for the people building this site, not for site visitors — think of it as the workbench next to the actual product, not the product itself.

Nothing under here should ever be referenced by the main site's build config. If a future root-level build/deploy setup is added, explicitly exclude this directory.

## What's here

- **`schema-visualizer/`** — interactive diagram of the content data schema (`../types/content.ts` / `../docs/SCHEMA.md`). See its own README for how to run it.
