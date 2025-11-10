import { modify, applyEdits } from "jsonc-parser";

export type JsonPath = Array<string | number> | undefined;

/**
 * Update JSON string at a given jsonc-parser path.
 * Returns the updated JSON string with formatting preserved.
 */
export const updateJsonAtPath = (json: string, path: JsonPath, newValue: unknown) => {
  try {
    const edits = modify(json, path ?? [], newValue, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    });
    const updated = applyEdits(json, edits);
    return updated;
  } catch (error) {
    // If modify fails, rethrow so callers can show an error
    throw error;
  }
};

export default updateJsonAtPath;