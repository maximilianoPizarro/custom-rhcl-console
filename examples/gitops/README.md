# GitOps integration

This chart is designed to be synced by OpenShift GitOps (Argo CD), the same way
[`migration-toolkit-rhcl`](https://github.com/maximilianoPizarro/migration-toolkit-rhcl)
is wired into
[`from-3scale-to-connectivity-link`](https://github.com/maximilianoPizarro/from-3scale-to-connectivity-link).

## Standalone Argo CD Application

See [`application.yaml`](application.yaml):

```bash
oc apply -f examples/gitops/application.yaml
```

## App-of-apps entry (`from-3scale-to-connectivity-link`)

Add the following under `helmApps:` in
[`examples/helm/values.yaml`](https://github.com/maximilianoPizarro/from-3scale-to-connectivity-link/blob/main/examples/helm/values.yaml)
(alongside `migration-toolkit-rhcl` and `apishift`):

```yaml
# OpenShift Console dynamic plugin for Connectivity Link / Kuadrant.
# Chart: maximilianoPizarro/custom-rhcl-console (helm/custom-rhcl-console).
# Installs into namespace custom-rhcl-console (plugin ConfigMap is hardcoded there).
- id: custom-rhcl-console
  enabled: true
  repoURL: "https://github.com/maximilianoPizarro/custom-rhcl-console"
  path: helm/custom-rhcl-console
  targetRevision: "main"
  destinationNamespace: custom-rhcl-console
  syncWave: "10"
  values:
    image:
      repository: quay.io/maximilianopizarro/custom-rhcl-console
      tag: latest
      pullPolicy: Always
    consolePlugin:
      patchConsole: true
    dnsProber:
      enabled: true
      image:
        repository: quay.io/maximilianopizarro/custom-rhcl-console-dns-prober
        tag: latest
        pullPolicy: Always
    config:
      grafanaNamespace: observability
      grafanaRouteName: grafana
      tempoNamespace: tempo
      tempoGatewayRouteName: tempo-tempo-rhcl-gateway
      developerPortalUrl: ""
      developerHubUrl: "https://backstage-developer-hub-developer-hub.{{ .Values.deployer.domain }}"
```

### Sync-wave rationale

| Wave | Component | Why |
|------|-----------|-----|
| 6 | `rhcl-operator` / Kuadrant | CRDs and policies must exist before the plugin is useful |
| 5–6 | observability / Tempo | Optional deeplink targets |
| **10** | **custom-rhcl-console** | Late wave — UI only; does not block workload provisioning |

### After sync

1. Confirm pods: `oc -n custom-rhcl-console get pods`
2. Confirm ConsolePlugin: `oc get consoleplugin custom-rhcl-console`
3. Open the OpenShift Console → **Connectivity Link** sidebar section
4. (Optional) disable dns-prober with `dnsProber.enabled: false` if not needed

## Artifact Hub / Helm repo

Once GitHub Pages + chart-releaser publish the index:

```bash
helm repo add custom-rhcl-console https://maximilianoPizarro.github.io/custom-rhcl-console/
helm install custom-rhcl-console custom-rhcl-console/custom-rhcl-console \
  -n custom-rhcl-console --create-namespace
```

Register the same URL on [Artifact Hub](https://artifacthub.io) as an OCI/HTTP Helm repository owned by the maintainers listed in `artifacthub-repo.yml`.
