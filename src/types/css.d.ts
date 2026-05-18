// TypeScript 6 tightened module resolution and no longer implicitly
// allows side-effect imports of CSS files. Declare the module so
// `import "~/styles/globals.css"` in app/layout.tsx typechecks.
declare module "*.css";
