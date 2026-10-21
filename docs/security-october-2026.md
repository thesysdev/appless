# October 2026 security update

Verified on 2026-10-21. This update keeps npm, Expo SDK 54, React Native
0.81.5, and React 19.1.0. Expo changes from 54.0.36 to 54.0.37 and jest-expo
from 54.0.17 to 54.0.18 to match the SDK's supported patch versions.

## Dependency changes and overrides

The lockfile updates shell-quote to 1.12.0, Undici to 6.29.1, tar to 7.5.22,
and the affected XML, glob, CSS, YAML, compression, and source-map packages.
It retains their compatible major versions.

Three parent-specific overrides address pinned vulnerable dependencies:

- `@expo/metro-config > postcss` uses 8.5.31 instead of the vulnerable 8.4
  range. The existing PostCSS 8 processor API remains available. A CSS
  processing check passes with the override.
- `xcode > uuid` uses 11.1.1. xcode uses the CommonJS `uuid.v4()` API, which
  this release retains. A check generated 1,000 unique 24-character project
  identifiers through xcode's own `generateUuid()` method.
- `@expo/metro@54.2.0` pins Metro and its companion packages to 0.83.8.
  [Metro 0.83.8](https://github.com/react/metro/releases/tag/v0.83.8) backports
  the removal of `image-size` and uses vendored image parsers. The packages
  move together on their existing patch line. This avoids a forced
  image-size 2.x override and leaves Expo SDK 54 and React Native unchanged.

The existing react-lang patch still applies after a clean npm install.

## Remaining dependency findings

The final npm audit reports 51 affected package entries, including parent
packages. These entries trace to three unresolved leaf packages. The audit
count does not establish deployed runtime protection.

- `expo > @expo/cli > node-forge@1.4.0`, also reached through Expo certificate
  tooling, has no published fix for
  [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
- `metro-file-map > micromatch > braces@3.0.3`, also reached through
  patch-package and Jest tools, has no published fix for
  [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- `js-yaml@3.15.2 > argparse@1.0.10 > sprintf-js@1.0.3` has no published
  fixed sprintf-js release for
  [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).
  Replacing argparse or js-yaml across major versions requires a separate
  caller migration.

Avoid untrusted glob and formatting inputs in development tools. Follow
upstream fixes for these packages. No Expo SDK major change was forced.

## Validation and rollout checks

A clean npm install, patch application, type checking, all 22 Jest tests,
Expo's dependency-version check, and the iOS bundle export pass. The iOS
export is a JavaScript and Hermes bundle check. It does not verify an Xcode
build, native device behavior, or production TLS validation.

This repository does not pin Node. The checks used Node 24.22.1. Use a
patched runtime for local development, CI, and any separately managed
container image. Rebuild native development binaries and test them on the
supported devices before release.

No tracked Cloudflare configuration, cloudflared dependency, or container
recipe was found. Where the project uses Cloudflare outside this checkout,
apply the [official incident guidance](https://blog.cloudflare.com/emudhra-certificate-compromise/).
Check Tunnel deployments for cloudflared 2026.10.2 or later. Rebuild customer
Containers and Sandboxes with patched runtime and CA packages. Review
custom origin certificates and uploaded mutual TLS trust stores separately.
No compatibility-date change is required by this update.

Confirm the application's actual certificate verifier after rollout.
A trusted root's presence does not by itself prove acceptance of a
compromised intermediate. Managed-service mitigations do not establish
customer container or runtime protection. No deployment, account TLS
change, live certificate replacement, or HTTPS interception change was made.
