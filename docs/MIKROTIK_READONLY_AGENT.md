# MikroTik read-only monitoring agent

## Scope and safety

The service reads RouterOS data over HTTPS only. The integration issues only HTTP GET requests to fixed REST resources: `/rest/system/identity`, `/rest/system/resource`, and `/rest/interface`. It contains no RouterOS write endpoint, no arbitrary path input, no CLI/API command execution, no automatic reboot, no firewall/route/interface changes, and no retry storm.

Connection targets are restricted to private IPv4 management addresses (RFC1918; localhost is permitted only in tests). HTTP, redirects, embedded URL credentials, non-private public targets, and invalid TLS certificates are rejected. A custom CA can be supplied with MIKROTIK_CA_FILE; certificate verification remains enabled.

CPU and memory thresholds are local operational heuristics, not MikroTik vendor limits. Findings are explanations and safe checks only; they do not execute corrective actions.

## RouterOS account setup

Use a dedicated management VLAN or VPN and permit HTTPS only from the application host. Enable the `www-ssl` service, install a certificate whose issuing CA is trusted by the backend host/container, and disable plain HTTP `www` for this integration.

Create a custom group rather than using the built-in `read` group. MikroTik documents that its default `read` group also has permissions such as reboot, test, sensitive and other access; the custom group below grants only read and REST login policies.

```routeros
/user group add name=monitor-agent policy=read,rest-api
/user add name=monitor-agent group=monitor-agent password="GENERATE-A-UNIQUE-LONG-PASSWORD"
```

Do not grant `write`, `policy`, `reboot`, `test`, `ftp`, `sensitive`, `sniff`, or `romon`. Verify the effective group policy on the target RouterOS release before connecting.

## Backend environment

```dotenv
MIKROTIK_BASE_URL=https://192.168.88.1
MIKROTIK_USERNAME=monitor-agent
MIKROTIK_PASSWORD=USE_A_UNIQUE_SECRET
MIKROTIK_CA_FILE=/run/secrets/mikrotik-ca.pem
```

Keep the credentials in a secret manager or container secret, not in Git, the database, or application logs. Restart the backend after configuring secrets. The status endpoint is available to owner, general manager, admin and auditor roles:

- `GET /api/network-monitoring/status` performs a fresh read-only collection.
- `GET /api/network-monitoring/history?limit=20` returns stored observations.

If no MikroTik credentials are configured, the service reports `DISABLED` and does not attempt a connection. Real-device verification requires an isolated RouterOS test device, a trusted HTTPS certificate, and the dedicated account above.

## Trusted diagnostic sources

- REST API and HTTPS guidance: https://help.mikrotik.com/docs/spaces/ROS/pages/47579162/REST+API
- User groups and policy definitions: https://help.mikrotik.com/docs/spaces/ROS/pages/8978504/User
- System resource metrics: https://help.mikrotik.com/docs/spaces/ROS/pages/40992875/Resource
- Ethernet link diagnostics: https://help.mikrotik.com/docs/spaces/ROS/pages/8323191/Ethernet
- Traffic counters: https://help.mikrotik.com/docs/spaces/ROS/pages/139526175/Interface+stats+and+monitor-traffic
- RouterOS logs: https://help.mikrotik.com/docs/spaces/ROS/pages/328094/Log
