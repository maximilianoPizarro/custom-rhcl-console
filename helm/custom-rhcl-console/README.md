# custom-rhcl-console Helm Chart

OpenShift Console dynamic plugin for **Red Hat Connectivity Link** (Kuadrant). Surfaces Gateways, HTTPRoutes, policies, TLS/DNS health, traffic metrics, and API Products in the admin console sidebar.

## Prerequisites

- OpenShift 4.19+ with cluster-admin (or equivalent) access
- Kuadrant / Connectivity Link installed
- Helm 3

## Installation

```bash
helm repo add custom-rhcl-console https://maximilianoPizarro.github.io/custom-rhcl-console/
helm repo update
helm install custom-rhcl-console custom-rhcl-console/custom-rhcl-console \
  -n custom-rhcl-console --create-namespace
```

### From this repository (GitOps / local)

```bash
helm upgrade --install custom-rhcl-console ./helm/custom-rhcl-console \
  -n custom-rhcl-console --create-namespace
```

> **Namespace:** install into `custom-rhcl-console`. The plugin hardcodes ConfigMap lookups to that namespace.

Landing page & Helm index (GitHub Pages `/docs`):
https://maximilianoPizarro.github.io/custom-rhcl-console/

### With custom runtime config

```bash
helm upgrade --install custom-rhcl-console ./helm/custom-rhcl-console \
  -n custom-rhcl-console --create-namespace \
  --set config.grafanaNamespace=observability \
  --set config.grafanaRouteName=grafana \
  --set config.developerHubUrl=https://backstage.apps.example.com \
  --set dnsProber.enabled=true
```

## Architecture

| Layer | Technology | Description |
|-------|------------|-------------|
| Plugin | React 18, PatternFly 6, OpenShift Console SDK | Dynamic plugin served by nginx (HTTPS :9001) |
| Runtime | OpenShift service-CA TLS | Console requires HTTPS plugin backends |
| Companion | Quarkus dns-prober (optional) | Live DNS / TLS / security-header probes via ConsolePlugin proxy |

## Values

| Value | Default | Description |
|-------|---------|-------------|
| `image.repository` | `quay.io/maximilianopizarro/custom-rhcl-console` | Plugin image |
| `image.tag` | `v0.1.0` | Plugin image tag |
| `replicas` | `1` | Plugin Deployment replicas |
| `consolePlugin.name` | `custom-rhcl-console` | ConsolePlugin CR name |
| `consolePlugin.displayName` | `Connectivity Link` | Sidebar section label |
| `consolePlugin.patchConsole` | `true` | Auto-enable plugin on `console.operator` |
| `config.grafanaNamespace` | `""` | Override Grafana namespace for deeplinks |
| `config.grafanaRouteName` | `""` | Override Grafana Route name |
| `config.tempoNamespace` | `""` | Override Tempo namespace |
| `config.tempoGatewayRouteName` | `""` | Override Tempo gateway Route |
| `config.developerPortalUrl` | `""` | External Developer Portal URL (sidebar item) |
| `config.developerHubUrl` | `""` | Internal Developer Hub / RHDH URL |
| `dnsProber.enabled` | `true` | Deploy dns-prober companion |
| `dnsProber.image.repository` | `quay.io/maximilianopizarro/custom-rhcl-console` | Same Quay repo as the plugin |
| `dnsProber.image.tag` | `dns-prober-v0.1.0` | dns-prober image tag |
| `dnsProber.route.enabled` | `true` | Create OpenShift Route for dns-prober |
| `route.enabled` | `false` | Route for the plugin Service (usually not needed) |

## Container Images

| Image | Description |
|-------|-------------|
| `quay.io/maximilianopizarro/custom-rhcl-console:v0.1.0` | Plugin nginx (UBI9 nginx-124) |
| `quay.io/maximilianopizarro/custom-rhcl-console:dns-prober-v0.1.0` | Quarkus dns-prober (UBI9 OpenJDK 21) |

## GitOps

Point OpenShift GitOps / Argo CD at repository path `helm/custom-rhcl-console` (see [examples/gitops](../../examples/gitops)).

## License

Apache-2.0
