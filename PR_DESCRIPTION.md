# Pull Request: Added customized Docker tags

## Summary
This PR updates the CI workflow to assign custom Docker image tags instead of always using `latest`.

The workflow now:
- tags images with the PR head commit SHA for validation builds
- tags images as `latest` when merged to `main`
- keeps image names traceable and avoids collisions between PR builds and production builds

## Changes made
Updated `.github/workflows/ci.yml` for all service images:
- `k8s-three-tier-starter-api`
- `k8s-three-tier-starter-app`
- `k8s-three-tier-starter-db`

For each image, a new step determines the tag:
- `latest` on push to `main`
- `${{ github.event.pull_request.head.sha }}` for PR validation builds

The Docker build step now uses the generated value instead of a hardcoded `latest` tag.

## Why this is needed
Using a single `latest` tag for every PR build can cause:
- incorrect image reuse across PRs
- confusion when validating builds
- ambiguity between test images and release images

This ensures builds are uniquely identifiable and production pushes remain clearly marked as `latest`.

## Validation
- Confirmed the workflow still builds the Docker image for each service
- PR builds validate without pushing to Docker Hub
- Push builds to `main` continue to publish tagged images

## Notes
The workflow still keeps `push: ${{ github.event_name == 'push' }}` behavior, so images are only published on push events, while PRs continue to validate build correctness without pushing.
