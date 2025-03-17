# snyk/snyk-docker-pull

A library that pulls container images.

## API

| Function              | Description                                  |
| --------------------- | -------------------------------------------- |
| new DockerPull().pull | Downloads an image from a Container Registry |

## Tests

### Infrastructure

| Container Registry      | How to access                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| Docker Hub (docker-hub) | [DockerHub](https://hub.docker.com/), then 1Password: `Development > Okta - team magma Docker Hub` |

### Local

Set up your local env with the following env vars (see 1Password):

```
export SNYK_DRA_AZURE_USERNAME=snykgoof
export SNYK_DRA_AZURE_PASSWORD=<See 1password: Development/Azure Container Registry (ACR) - Docker Registry Agent>
export SNYK_DRA_AZURE_REPOSITORY=snykgoof/azure-goof
export SNYK_DRA_AZURE_REGISTRY_BASE=snykgoof.azurecr.io

export SNYK_DRA_DOCKER_HUB_USERNAME=snykgoof
export SNYK_DRA_DOCKER_HUB_PASSWORD=<See 1password: Development/DockerHub - snykgoof user>
export SNYK_DRA_DOCKER_HUB_REPOSITORY=snykgoof/dockerhub-goof
export SNYK_OCI_MULTI_ARCH_DOCKER_HUB_REPOSITORY=snykgoof/nodejs18
export SNYK_DRA_DOCKER_HUB_REGISTRY_BASE=registry-1.docker.io
```

To run the tests:

```console
$ npm run test
```

## Linting and formatting

> Note: Linting tasks are also run as part of the test run. However, due to
> their execution speed, it can be useful to run them as you develop, to keep
> your code organized.

To run the code formatting tasks:

```console
$ npm run format
```

To run the linting tasks:

```console
$ npm run lint
```
