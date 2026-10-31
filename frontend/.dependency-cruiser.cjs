module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-unresolved",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "components-may-not-import-app",
      severity: "error",
      from: { path: "^components/" },
      to: { path: "^app/" },
    },
    {
      name: "lib-may-not-import-app-or-components",
      severity: "error",
      from: { path: "^lib/" },
      to: { path: "^(app|components)/" },
    },
  ],
  options: {
    exclude: "(^|/)(node_modules|\\.venv|dist|outputs)/",
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
  },
};
