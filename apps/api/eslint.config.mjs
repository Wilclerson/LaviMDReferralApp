import config from "@lavimd/eslint-config";

export default [
  ...config,
  {
    rules: {
      // NestJS resolves constructor dependencies from `design:paramtypes`
      // metadata, which only exists for *value* imports. Forcing `import type`
      // on injected providers would silently break dependency injection.
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },
  {
    files: ["**/*.spec.ts"],
    rules: {
      // `expect(mock.method).toHaveBeenCalled()` intentionally references a
      // method without binding it; this rule only makes sense for real classes.
      "@typescript-eslint/unbound-method": "off",
      // Hand-rolled test doubles are deliberately cast into place; the rule
      // flags those bridging casts even though they are what makes the double
      // usable. Production code keeps the rule enabled.
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
    },
  },
];
