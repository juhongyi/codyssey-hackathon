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
  ],
  options: {
    exclude: "(^|/)(node_modules|\\.venv|dist|outputs)/",
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
  },
};
