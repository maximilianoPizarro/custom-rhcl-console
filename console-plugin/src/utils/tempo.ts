/**
 * Deep-linking to the cluster's native Tempo trace explorer.
 *
 * Routes traffic into the OpenShift Console's **Observe → Traces** page
 * at `/observe/traces?...` instead of opening the Tempo gateway's
 * Jaeger UI in a new tab. Two reasons:
 *   1. UX consistency — operators land on the same trace explorer that
 *      Observe → Traces already exposes via the platform plugin, with
 *      the cluster identity propagated automatically.
 *   2. Auth — the embedded /observe/traces page reuses the Console's
 *      OAuth session; the Jaeger UI on `tempo-gateway` needed a token
 *      with `traces.read` on the tenant, which kube:admin doesn't
 *      necessarily have.
 *
 * The hook tries TempoStack first, then TempoMonolithic. Either CR
 * drives availability; when neither is found the hook returns
 * `available: false` so callers can render a disabled button + tooltip.
 */
import {
  useK8sWatchResource,
  K8sResourceCommon,
} from '@openshift-console/dynamic-plugin-sdk';
import { usePluginConfig } from './pluginConfig';

const DEFAULT_TEMPO_NS = 'tempo';
const DEFAULT_TEMPO_STACK_NAME = 'tempo-rhcl';

interface TempoStackResource extends K8sResourceCommon {
  spec?: {
    tenants?: {
      authentication?: { tenantName: string }[];
    };
  };
}

/**
 * Search context the trace explorer should open with. Only `serviceName`
 * and `lookback` are honored by the native Observe → Traces query
 * params today; richer filters (`tags`, `minDurationMs`) are accepted
 * for API stability — when the platform plugin starts respecting them
 * we can pass them through without touching every call site.
 */
export interface TempoSearchVars {
  /** service.name to pre-fill the Filter dropdown. */
  serviceName?: string;
  /** Free-form tag filter (reserved for future use). */
  tags?: Record<string, string>;
  /** Min duration in ms (reserved for future use). */
  minDurationMs?: number;
  /** Lookback window — `5m`, `30m`, `1h`, … Default `1h`. */
  lookback?: string;
}

export interface TempoLink {
  /** Internal Console URL (`/observe/traces?...`), or null when unavailable. */
  url: string | null;
  /** True while the TempoStack/TempoMonolithic lookup is in flight. */
  loading: boolean;
  /** False when Tempo isn't installed in this cluster. */
  available: boolean;
}

/**
 * Resolve the deep-link URL into the Console's Observe → Traces page,
 * pre-targeted at the right Tempo instance + tenant.
 *
 * Watches both TempoStack and TempoMonolithic CRs simultaneously.
 * TempoStack wins when both exist (it carries tenant metadata);
 * TempoMonolithic is used as fallback (single-tenant, defaults to 'dev').
 */
export function useTempoLink(vars: TempoSearchVars = {}): TempoLink {
  const { config } = usePluginConfig();
  const namespace = config.tempoNamespace || DEFAULT_TEMPO_NS;
  const stackName = config.tempoStackName || DEFAULT_TEMPO_STACK_NAME;

  const [stack, stackLoaded, stackErr] = useK8sWatchResource<TempoStackResource>({
    groupVersionKind: {
      group: 'tempo.grafana.com',
      version: 'v1alpha1',
      kind: 'TempoStack',
    },
    namespace,
    name: stackName,
    isList: false,
  });

  const [mono, monoLoaded, monoErr] = useK8sWatchResource<K8sResourceCommon>({
    groupVersionKind: {
      group: 'tempo.grafana.com',
      version: 'v1alpha1',
      kind: 'TempoMonolithic',
    },
    namespace,
    name: stackName,
    isList: false,
  });

  const bothLoaded = (stackLoaded || !!stackErr) && (monoLoaded || !!monoErr);
  if (!bothLoaded) {
    return { url: null, loading: true, available: false };
  }

  const hasStack = !stackErr && !!stack?.metadata?.name;
  const hasMono = !monoErr && !!mono?.metadata?.name;

  if (!hasStack && !hasMono) {
    return { url: null, loading: false, available: false };
  }

  // TempoStack carries per-tenant config; TempoMonolithic is single-tenant.
  const tenant = hasStack
    ? (stack as TempoStackResource).spec?.tenants?.authentication?.[0]?.tenantName || 'dev'
    : 'dev';

  const params = new URLSearchParams();
  params.set('namespace', namespace);
  params.set('name', stackName);
  params.set('tenant', tenant);
  params.set('start', vars.lookback || '1h');
  if (vars.serviceName) params.set('serviceName', vars.serviceName);

  const url = `/observe/traces?${params.toString()}`;
  return { url, loading: false, available: true };
}
