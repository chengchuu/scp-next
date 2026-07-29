type Operation = "upload" | "download";
type ExampleInterface = "cli" | "typescript";

interface ExampleValues {
  exampleInterface: ExampleInterface;
  operation: Operation;
  localPath: string;
  remotePath: string;
  host: string;
  username: string;
  recursive: boolean;
}

function shellArgument(value: string): string {
  return /^[A-Za-z0-9_./:@-]+$/.test(value)
    ? value
    : `'${value.replaceAll("'", "'\"'\"'")}'`;
}

export function generateCliExample(values: ExampleValues): string {
  const source = values.operation === "upload" ? values.localPath : values.remotePath;
  const destination =
    values.operation === "upload" ? values.remotePath : values.localPath;
  return [
    `scp-next ${values.operation} ${shellArgument(source)} ${shellArgument(destination)} \\`,
    `  --host ${shellArgument(values.host)} \\`,
    `  --username ${shellArgument(values.username)} \\`,
    ...(values.recursive ? ["  --recursive \\"] : []),
    "  --dry-run"
  ].join("\n");
}

export function generateTypeScriptExample(values: ExampleValues): string {
  const options = [
    `  host: ${JSON.stringify(values.host)},`,
    `  username: ${JSON.stringify(values.username)},`,
    "  password: process.env.SCP_NEXT_PASSWORD,",
    `  localPath: ${JSON.stringify(values.localPath)},`,
    `  remotePath: ${JSON.stringify(values.remotePath)},`,
    ...(values.recursive ? ["  recursive: true,"] : []),
    "  dryRun: true,"
  ];
  return [
    `import { ${values.operation} } from "scp-next";`,
    "",
    `await ${values.operation}({`,
    ...options,
    "});"
  ].join("\n");
}

function readValues(form: HTMLFormElement): ExampleValues {
  const data = new FormData(form);
  const value = (name: string) => {
    const entry = data.get(name);
    return typeof entry === "string" ? entry.trim() : "";
  };
  const exampleInterface = value("interface");
  const operation = value("operation");
  if (
    (exampleInterface !== "cli" && exampleInterface !== "typescript") ||
    (operation !== "upload" && operation !== "download")
  ) {
    throw new Error("Choose a supported example format and operation.");
  }
  const values: ExampleValues = {
    exampleInterface,
    operation,
    localPath: value("localPath"),
    remotePath: value("remotePath"),
    host: value("host"),
    username: value("username"),
    recursive: data.get("recursive") === "on"
  };
  if (!values.localPath || !values.remotePath || !values.host || !values.username) {
    throw new Error("Local path, remote path, host, and username are required.");
  }
  if (
    [values.localPath, values.remotePath, values.host, values.username].some((item) =>
      /[\r\n]/.test(item)
    )
  ) {
    throw new Error("Example values cannot contain line breaks.");
  }
  return values;
}

if (typeof document !== "undefined") {
  const form = document.querySelector<HTMLFormElement>("[data-example-form]");
  const output = document.querySelector<HTMLElement>("[data-example-output]");
  const errorRegion = document.querySelector<HTMLElement>("[data-example-error]");

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const values = readValues(form);
      if (output) {
        output.textContent =
          values.exampleInterface === "cli"
            ? generateCliExample(values)
            : generateTypeScriptExample(values);
      }
      if (errorRegion) errorRegion.textContent = "";
    } catch (error) {
      if (errorRegion) {
        errorRegion.textContent =
          error instanceof Error ? error.message : "The example could not be generated.";
      }
    }
  });
}
