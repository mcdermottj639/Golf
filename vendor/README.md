Three.js 0.186.1, MIT, bundled without modification as a local ES module.
Used only by Links' lazy-loaded perspective renderer; no CDN or runtime build.
Source: https://github.com/mrdoob/three/tree/r186
Reproduce with three@0.186.1 and esbuild@0.28.2 (or equivalent ES2020 minifier):
`esbuild` bundle an entry `export * from "three";` with format esm, minify,
target es2020, legalComments eof, outfile vendor/three-r186.js.
See THREE-LICENSE.txt. The tracked bundle is the deployed/offline asset.
