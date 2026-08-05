{{/*
Expand the name of the chart.
*/}}
{{- define "custom-rhcl-console.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "custom-rhcl-console.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s" $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "custom-rhcl-console.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: custom-rhcl-console
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}

{{/*
Selector labels for the plugin Deployment
*/}}
{{- define "custom-rhcl-console.selectorLabels" -}}
app: {{ include "custom-rhcl-console.fullname" . }}
app.kubernetes.io/name: {{ include "custom-rhcl-console.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: plugin
{{- end }}

{{/*
Plugin ServiceAccount name
*/}}
{{- define "custom-rhcl-console.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "custom-rhcl-console.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
dns-prober resource name
*/}}
{{- define "custom-rhcl-console.dnsProber" -}}
dns-prober
{{- end }}

{{/*
dns-prober selector labels
*/}}
{{- define "custom-rhcl-console.dnsProberSelectorLabels" -}}
app: {{ include "custom-rhcl-console.dnsProber" . }}
app.kubernetes.io/name: {{ include "custom-rhcl-console.dnsProber" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: dns-prober
{{- end }}

{{/*
ConsolePlugin CR name (must stay in sync with frontend PROXY_PATH)
*/}}
{{- define "custom-rhcl-console.pluginName" -}}
{{- .Values.consolePlugin.name | default "custom-rhcl-console" }}
{{- end }}

{{/*
Effective dnsProberUrl written into the ConfigMap
*/}}
{{- define "custom-rhcl-console.dnsProberUrl" -}}
{{- if .Values.config.dnsProberUrl }}
{{- .Values.config.dnsProberUrl }}
{{- else if .Values.dnsProber.enabled }}
{{- printf "/api/proxy/plugin/%s/dns-prober" (include "custom-rhcl-console.pluginName" .) }}
{{- end }}
{{- end }}
