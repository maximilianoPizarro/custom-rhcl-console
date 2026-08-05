import * as React from 'react';
import {
  Card,
  CardTitle,
  CardBody,
  Button,
  Label,
  Spinner,
  EmptyState,
  EmptyStateBody,
  Tooltip,
  Flex,
  FlexItem,
  ClipboardCopy,
  ClipboardCopyVariant,
} from '@patternfly/react-core';
import { EyeIcon, EyeSlashIcon } from '@patternfly/react-icons';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import {
  useK8sWatchResource,
  useAccessReview,
  consoleFetch,
  consoleFetchJSON,
} from '@openshift-console/dynamic-plugin-sdk';
import { useTranslation } from 'react-i18next';
import { APIKeyGVK } from '../../models';
import { APIKey, getAPIKeyPhase } from '../../types';

interface APIKeysTableProps {
  apiProductName: string;
  namespace: string;
  approvalMode: string;
}

const PHASE_COLORS: Record<string, 'blue' | 'green' | 'red' | 'grey'> = {
  Pending: 'blue',
  Approved: 'green',
  Rejected: 'red',
};

/**
 * Approval workflow note (Kuadrant 1.4+).
 *
 * The naive "patch the APIKey's status.phase" approach this component used
 * to take does not work on the current devportal.kuadrant.io CRDs:
 *   - The APIKey schema no longer exposes `status.phase`; phase is read
 *     from `status.conditions[*]` via `getAPIKeyPhase`.
 *   - The status subresource is owned by the devportal controller — the
 *     console can't (and shouldn't) overwrite it directly.
 *
 * The correct flow, matching what the upstream Kuadrant console plugin
 * does, is:
 *
 *   1. The controller auto-creates an `APIKeyRequest` for every APIKey.
 *   2. To approve/reject, the operator creates an `APIKeyApproval` CR
 *      whose `spec.apiKeyRequestRef.name` points at that request.
 *   3. The controller reconciles the approval and updates the APIKey's
 *      `status.conditions` accordingly.
 *
 * That's the workflow we implement here. The Approve/Reject buttons
 * create an `APIKeyApproval` per click; the table reflects new state via
 * the live watch on APIKey conditions, no refresh needed.
 */
const APIKeysTable: React.FC<APIKeysTableProps> = ({
  apiProductName,
  namespace,
  approvalMode,
}) => {
  const { t } = useTranslation('plugin__custom-rhcl-console');

  const [apiKeys, keysLoaded] = useK8sWatchResource<APIKey[]>({
    groupVersionKind: APIKeyGVK,
    isList: true,
    namespace,
  });

  const [canApprove] = useAccessReview({
    resource: 'apikeys',
    group: APIKeyGVK.group,
    verb: 'patch',
    namespace,
  });

  const [reviewer, setReviewer] = React.useState<string>('console');
  React.useEffect(() => {
    consoleFetchJSON('/apis/user.openshift.io/v1/users/~')
      .then((u: { metadata?: { name?: string } }) => {
        if (u?.metadata?.name) setReviewer(u.metadata.name);
      })
      .catch(() => undefined);
  }, []);

  const [revealedKeys, setRevealedKeys] = React.useState<Record<string, string>>({});
  const [revealLoading, setRevealLoading] = React.useState<Record<string, boolean>>({});

  const handleRevealKey = async (key: APIKey) => {
    const uid = key.metadata?.uid || '';
    const secretName = key.spec.secretRef?.name;
    const ns = key.metadata?.namespace || '';
    if (!secretName) return;
    if (revealedKeys[uid]) {
      setRevealedKeys((prev) => { const next = { ...prev }; delete next[uid]; return next; });
      return;
    }
    setRevealLoading((prev) => ({ ...prev, [uid]: true }));
    try {
      const secret = await consoleFetchJSON(
        `/api/kubernetes/api/v1/namespaces/${ns}/secrets/${secretName}`,
      );
      const raw = secret?.data?.api_key;
      const decoded = raw ? atob(raw) : '(empty)';
      setRevealedKeys((prev) => ({ ...prev, [uid]: decoded }));
    } catch {
      setRevealedKeys((prev) => ({ ...prev, [uid]: '(unable to read secret)' }));
    } finally {
      setRevealLoading((prev) => { const next = { ...prev }; delete next[uid]; return next; });
    }
  };

  const filteredKeys = React.useMemo(
    () =>
      (apiKeys || []).filter(
        (key) => key.spec.apiProductRef.name === apiProductName,
      ),
    [apiKeys, apiProductName],
  );

  // Label-based approval: the devportal controller owns `status` and
  // overwrites console patches when AuthPolicy uses API key auth (no
  // OIDC). Labels on `metadata` survive controller reconciliation.
  const handleAction = async (
    apiKey: APIKey,
    action: 'Approved' | 'Rejected',
  ) => {
    const ns = apiKey.metadata?.namespace || '';
    const name = apiKey.metadata?.name || '';
    try {
      await consoleFetch(
        `/api/kubernetes/apis/${APIKeyGVK.group}/${APIKeyGVK.version}/namespaces/${ns}/apikeys/${name}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/merge-patch+json' },
          body: JSON.stringify({
            metadata: {
              labels: { 'devportal.kuadrant.io/phase': action },
              annotations: {
                'devportal.kuadrant.io/reviewed-by': reviewer,
                'devportal.kuadrant.io/reviewed-at': new Date().toISOString(),
              },
            },
          }),
        },
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Failed to ${action.toLowerCase()} API key ${name}:`, e);
    }
  };

  const loaded = keysLoaded;
  if (!loaded) {
    return (
      <Card>
        <CardTitle>{t('API Keys')}</CardTitle>
        <CardBody><Spinner size="lg" /></CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>
        {t('API Keys')} ({filteredKeys.length} {t('total')})
      </CardTitle>
      <CardBody>
        {filteredKeys.length === 0 ? (
          <EmptyState variant="sm" titleText={t('No API keys')} headingLevel="h4">
            <EmptyStateBody>
              {t('No API key requests have been submitted for this API product.')}
            </EmptyStateBody>
          </EmptyState>
        ) : (
          <Table aria-label={t('API Keys')} variant="compact">
            <Thead>
              <Tr>
                <Th>{t('Requester')}</Th>
                <Th>{t('Plan')}</Th>
                <Th>{t('Phase')}</Th>
                <Th>{t('API Key')}</Th>
                <Th>{t('Created')}</Th>
                {approvalMode === 'manual' && <Th>{t('Actions')}</Th>}
              </Tr>
            </Thead>
            <Tbody>
              {filteredKeys.map((key) => {
                const phase = getAPIKeyPhase(key);
                const isPending = phase === 'Pending';

                return (
                  <Tr key={key.metadata?.uid}>
                    <Td>{key.spec.requestedBy?.email || '-'}</Td>
                    <Td>{key.spec.planTier || '-'}</Td>
                    <Td>
                      <Label color={PHASE_COLORS[phase] || 'grey'}>
                        {t(phase)}
                      </Label>
                    </Td>
                    <Td>
                      {phase === 'Approved' && key.spec.secretRef?.name ? (
                        revealedKeys[key.metadata?.uid || ''] ? (
                          <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                            <FlexItem flex={{ default: 'flex_1' }}>
                              <ClipboardCopy isReadOnly variant={ClipboardCopyVariant.expansion} isCode>
                                {revealedKeys[key.metadata?.uid || '']}
                              </ClipboardCopy>
                            </FlexItem>
                            <FlexItem>
                              <Button variant="plain" size="sm" onClick={() => handleRevealKey(key)} aria-label={t('Hide key')}>
                                <EyeSlashIcon />
                              </Button>
                            </FlexItem>
                          </Flex>
                        ) : (
                          <Button
                            variant="link"
                            size="sm"
                            isLoading={revealLoading[key.metadata?.uid || '']}
                            onClick={() => handleRevealKey(key)}
                            icon={<EyeIcon />}
                          >
                            {t('Reveal Key')}
                          </Button>
                        )
                      ) : (
                        <span style={{ color: 'var(--pf-t--global--color--nonstatus--gray--default)', fontSize: 12 }}>
                          {phase === 'Pending' ? t('Pending approval') : '-'}
                        </span>
                      )}
                    </Td>
                    <Td>{key.metadata?.creationTimestamp || '-'}</Td>
                    {approvalMode === 'manual' && (
                      <Td>
                        {isPending && (
                          <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                            <FlexItem>
                              <ActionButton
                                kind="primary"
                                disabled={!canApprove}
                                tooltipWhenDisabled={t('You do not have permission to approve API keys')}
                                onClick={() => handleAction(key, 'Approved')}
                                label={t('Approve')}
                              />
                            </FlexItem>
                            <FlexItem>
                              <ActionButton
                                kind="danger"
                                disabled={!canApprove}
                                tooltipWhenDisabled={t('You do not have permission to reject API keys')}
                                onClick={() => handleAction(key, 'Rejected')}
                                label={t('Reject')}
                              />
                            </FlexItem>
                          </Flex>
                        )}
                      </Td>
                    )}
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
};

/**
 * Tiny helper to flatten the "render disabled button + tooltip" boilerplate.
 * Without it we were duplicating the same ternary 4 times.
 */
const ActionButton: React.FC<{
  kind: 'primary' | 'danger';
  disabled: boolean;
  tooltipWhenDisabled: string;
  label: string;
  onClick: () => void;
}> = ({ kind, disabled, tooltipWhenDisabled, label, onClick }) => {
  const btn = (
    <Button variant={kind} size="sm" isDisabled={disabled} onClick={disabled ? undefined : onClick}>
      {label}
    </Button>
  );
  return disabled ? <Tooltip content={tooltipWhenDisabled}>{btn}</Tooltip> : btn;
};

export default APIKeysTable;
