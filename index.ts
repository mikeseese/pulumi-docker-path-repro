import * as docker from "@pulumi/docker";

// The Dockerfile lives in a subdirectory of the build context. The path is
// given with forward slashes, yet on Windows the provider sends it to the
// daemon as "docker\app\Dockerfile", which the Linux daemon can't open.
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
