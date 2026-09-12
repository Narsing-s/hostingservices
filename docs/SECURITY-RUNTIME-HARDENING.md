# Runtime Security Hardening

The runtime now applies defense-in-depth controls to customer containers.

## Container isolation

Every managed application container is created with:

- `Privileged=false`
- Linux capabilities dropped with `CapDrop: ["ALL"]`
- `no-new-privileges:true`
- optional read-only root filesystem through `RUNTIME_READONLY_ROOTFS=true`
- explicit CPU, memory and PID limits
- a dedicated managed runtime network

Customers must not be able to request Docker host privileges through the deployment API.

## Host filesystem protection

Production host-path volume binds are disabled by default. Set `ALLOW_RUNTIME_HOST_BINDS=true` only on explicitly controlled infrastructure where host mounts are part of the operator design.

Managed/persistent volumes should be represented by the platform volume lifecycle rather than arbitrary Docker host paths.

## Network isolation

The runtime network can be made Docker-internal by setting `NEXUS_RUNTIME_NETWORK_INTERNAL=true`. Public applications should normally remain behind the platform proxy rather than receiving arbitrary host ports.

## Production requirements

Operators should additionally run the engine on dedicated worker nodes, restrict Docker socket access, keep the engine endpoint private, and use a hardened container runtime/host OS. These controls cannot safely be replaced by application code alone.

## Verification checklist

- [x] Internal engine endpoints require the engine secret.
- [x] Containers cannot request privileged mode through customer input.
- [x] All Linux capabilities are dropped by default.
- [x] `no-new-privileges` is enabled.
- [x] Host path mounts are blocked in production by default.
- [x] CPU, memory and PID limits are enforced at the Docker runtime layer.
- [x] Organization CPU, memory and storage quotas are enforced at the database layer.
- [ ] Production deployment nodes use a separate Docker/runtime security boundary.
- [ ] Egress policy is enforced at the node/network firewall layer.
- [ ] Image signing and admission verification are enabled.
