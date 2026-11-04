**Title:** docker.Image: "failed to read dockerfile" on Windows when Dockerfile is in a subdirectory (regression in v4.11.0, still in v5.2.1)

### What happened?

On Windows, `docker.Image` fails to build when the Dockerfile is in a subdirectory of the build context:

```
error: error reading build output: failed to read dockerfile: open docker\app\Dockerfile: no such file or directory
```

The Dockerfile path is passed with forward slashes (`docker/app/Dockerfile`), but the provider sends it to the (Linux) Docker daemon with Windows separators, so the daemon looks for a file literally named `docker\app\Dockerfile`.

This is the same bug as #624, which was fixed by #645 (`relDockerfile = filepath.ToSlash(relDockerfile)`). That conversion was dropped in #1583 (commit d8e7898, released in v4.11.0), which replaced the path logic in `provider/image.go` with `clibuild.GetContextFromLocalDir(build.Context, build.Dockerfile)`. `GetContextFromLocalDir` returns the relative Dockerfile path from `filepath.Rel`, so it uses OS-native separators. The docker CLI converts it afterwards with `archive.CanonicalTarNameForPath`, but the provider no longer does.

The `dockerfileInContext := !strings.HasPrefix(relDockerfile, "../")` check right after it has the same problem on Windows (`..\`).

### Example

`Pulumi.yaml`:

```yaml
name: pulumi-docker-windows-repro
runtime: nodejs
```

`package.json`:

```json
{
  "name": "pulumi-docker-windows-repro",
  "private": true,
  "main": "index.ts",
  "dependencies": {
    "@pulumi/docker": "5.2.1",
    "@pulumi/pulumi": "^3.200.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.0.0"
  }
}
```

`index.ts`:

```ts
import * as docker from "@pulumi/docker";

const image = new docker.Image("repro", {
  imageName: "pulumi-docker-windows-repro:latest",
  skipPush: true,
  build: {
    context: ".",
    dockerfile: "docker/app/Dockerfile",
    builderVersion: docker.BuilderVersion.BuilderBuildKit,
    platform: "linux/amd64",
  },
});

export const imageName = image.imageName;
```

`docker/app/Dockerfile`:

```dockerfile
FROM scratch
COPY hello.txt /hello.txt
```

`hello.txt`:

```
hello
```

Steps (on Windows, with a Linux Docker engine):

```sh
npm install
pulumi stack init dev
pulumi up --yes
```

Output with `@pulumi/docker` 5.2.1 (also 4.11.0, 4.11.1):

```
 +  docker:index:Image repro creating (9s) error: error reading build output: failed to read dockerfile: open docker\app\Dockerfile: no such file or directory
 +  docker:index:Image repro **creating failed** error: error reading build output: failed to read dockerfile: open docker\app\Dockerfile: no such file or directory
Diagnostics:
  docker:index:Image (repro):
    error: error reading build output: failed to read dockerfile: open docker\app\Dockerfile: no such file or directory
```

With `@pulumi/docker` 4.10.0 the same program succeeds.

Suggested fix in `provider/image.go`, right after the `GetContextFromLocalDir` call:

```go
relDockerfile = filepath.ToSlash(relDockerfile)
```

(or `archive.CanonicalTarNameForPath(relDockerfile)`, matching the docker CLI).

### Output of `pulumi about`

```
CLI
Version      3.237.0
Go Version   go1.26.3
Go Compiler  gc

Plugins
KIND      NAME    VERSION
resource  docker  5.2.1
language  nodejs  3.237.0

Host
OS       Microsoft Windows 11 Pro
Version  10.0.26200 Build 26200
Arch     x86_64

This project is written in nodejs: executable='C:\Program Files\nodejs\node.exe' version='v24.22.1' packagemanagerVersion='12.2.1' packagemanager='npm'

Backend
Name           MyMachine
URL            file://~
User           MYMACHINE\myuser
Organizations
Token type     personal

Dependencies:
NAME            VERSION
@pulumi/docker  5.2.1
@pulumi/pulumi  3.274.0
@types/node     22.20.5
typescript      5.9.3
```

### Additional context

- OS: Windows 11 Pro (10.0.26200), amd64
- Pulumi CLI: v3.237.0
- Node.js: v24.22.1
- Docker: Rancher Desktop, client 28.0.1-rd, engine 26.1.5 (linux)
- Last working version: 4.10.0. First broken version: 4.11.0. Still broken in 5.2.1 and on `master`.
- Tested with BuildKit (`builderVersion: BuilderBuildKit`). A Dockerfile at the root of the context has no path separator, so it presumably isn't affected.
