## Playbook: iac/k8s-no-resource-limits (remediate)

Drop privileges in `securityContext`:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 10001
  allowPrivilegeEscalation: false
  capabilities:
    drop: ["ALL"]
  readOnlyRootFilesystem: true
```

Remove `privileged: true` and `hostNetwork: true` unless the workload
genuinely requires them; if so, add a comment explaining why so the
next reviewer doesn't re-flag it.

Consider adding a `resources:` block with requests and limits so the
pod participates in the cluster's QoS scheduling:

```yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 1
    memory: 512Mi
```
