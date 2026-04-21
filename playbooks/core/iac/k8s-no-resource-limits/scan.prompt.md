## Playbook: iac/k8s-no-resource-limits (scan)

A Kubernetes manifest declares a container with escalated privileges
(privileged: true, runAsUser: 0, or hostNetwork: true). Confirm that
the privilege is actually required for the workload to function.

Severity:
- critical — application pod (web/api/worker) with any of these set
- high — system-level daemonset that could use a narrower capability
- medium — CNI / node-agent / CSI driver where these are sometimes
  legitimate but should be documented

Do not flag if the manifest is clearly a core cluster component
(kube-proxy, CNI driver, node-exporter) that documents its need for
elevated privileges.
