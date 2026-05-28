# LimsPlus Connect — architecture (offline mode)

This folder contains **Graphviz** (`.dot`) diagrams for how the **desktop app**, **client** (Electron shell + bundled portal), **Nest backend**, **embedded MongoDB**, and **Python integration server** work together—especially in **offline / LimsPlus Lite** mode.

## Render diagrams

Install **Graphviz binaries** ([download](https://graphviz.org/download/) or `brew install graphviz` on macOS), then:

```bash
pip install graphviz
python3 docs/render-diagrams.py
```

Output: `docs/rendered/*.png` and `*.svg`.

### One file manually (optional)

```bash
dot -Tpng docs/architecture-overview.dot -o docs/rendered/architecture-overview.png
dot -Tsvg docs/architecture-overview.dot -o docs/rendered/architecture-overview.svg
```

**Note:** The source of truth is the **`.dot`** files (Graphviz DOT language). Python does not replace `.dot` — it only renders them.

## Diagram index

| File | Description |
|------|-------------|
| [`architecture-overview.dot`](architecture-overview.dot) | High-level components: repo layout, packaged resources, loopback services |
| [`offline-lite-startup.dot`](offline-lite-startup.dot) | **LimsPlus Lite** startup sequence (first run vs later runs) |
| [`offline-data-layer.dot`](offline-data-layer.dot) | MongoDB seed, persistence, backup/restore, API data path |
| [`connect-vs-lite.dot`](connect-vs-lite.dot) | **Connect shell** (online-oriented) vs **Lite window** (offline portal) |

## Related docs

- [`../client/database/README.md`](../client/database/README.md) — bundled BSON seed (`database/dump`)
- [`../client/app/README.md`](../client/app/README.md) — Lite portal + Nest bundle layout
- [`../client/app/Backend-README.md`](../client/app/Backend-README.md) — Nest env vars for Lite

## Network scope (offline Lite)

All Lite services bind to **loopback** (`127.0.0.1`) only—they are not exposed on the LAN. Default ports (overridable via env):

| Service | Default port | Env override |
|---------|--------------|--------------|
| Embedded MongoDB | `27017` | `LIMS_LITE_MONGO_PORT` |
| Nest Lite API (GraphQL/REST) | `8080` | `LIMS_LITE_API_PORT` |
| Lite portal static HTTP | OS ephemeral | — |
| Connect shell (dev CRA) | `3000` | React dev server |
| Python gateway WS / HTTP | `6000` / `9000` | Integration Gateway |
