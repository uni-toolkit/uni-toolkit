import path from "path";

export function getOutputJsonPath(filePath: string) {
  const relativePath = path.relative(process.env.UNI_INPUT_DIR!, filePath);
  const { name, dir } = path.parse(relativePath);

  return path.join(process.env.UNI_OUTPUT_DIR!, dir, name + ".json");
}

export function isMiniProgram() {
  return process.env.UNI_PLATFORM?.startsWith("mp-");
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}
