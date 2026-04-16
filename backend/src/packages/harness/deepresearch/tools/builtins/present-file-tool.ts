import path from "node:path";

export const presentFileTool = {
  name: "present_file",
  description: "Return metadata for a generated output artifact",
  invoke: async (filePath: string) => ({
    path: filePath,
    name: path.basename(filePath)
  })
};
