# snyk/snyk-docker-pull

A library that pulls container images.

## API

| Function              | Description                                  |
| --------------------- | -------------------------------------------- |
| new DockerPull().pull | Downloads an image from a Container Registry |

## Tests

See the internal Confluence page **snyk-docker-pull: Local Testing Setup** for environment variable names, 1Password credential locations, and instructions for running the test suite locally.

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
