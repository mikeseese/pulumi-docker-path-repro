# pulumi-docker Windows Dockerfile path repro

Minimal program showing that `docker.Image` fails on Windows when the Dockerfile is in a subdirectory of the build context:

```
error: error reading build output: failed to read dockerfile: open docker\app\Dockerfile: no such file or directory
```

The Dockerfile path is given with forward slashes, but the provider sends it to the Linux Docker daemon with backslashes. This broke in `@pulumi/docker` 4.11.0 and is still broken in 5.2.1. 4.10.0 works.

See [ISSUE.md](ISSUE.md) for the full write-up and root cause.

## Run it

On Windows, with a Linux Docker engine running:

```sh
npm install
pulumi login --local
pulumi stack init dev
pulumi up --yes
```

To compare with the last working version:

```sh
npm install @pulumi/docker@4.10.0
pulumi up --yes
```

Clean up:

```sh
pulumi destroy --yes
pulumi stack rm dev --yes
docker rmi pulumi-docker-windows-repro:latest
```
