import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, TextInput, Button, Group } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import Editor from "@monaco-editor/react";
import useConfig from "../../../store/useConfig";
import toast from "react-hot-toast";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import useFile from "../../../store/useFile";
import { updateJsonAtPath } from "../../../lib/utils/updateJsonAtPath";

// return the complete node data for editing
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "";
  
  // single primitive value (leaf node)
  if (nodeRows.length === 1 && !nodeRows[0].key) {
    try {
      return JSON.stringify(nodeRows[0].value, null, 2);
    } catch {
      return String(nodeRows[0].value);
    }
  }

  // object with multiple properties - only include primitive values (not nested objects/arrays)
  const obj: Record<string, unknown> = {};
  nodeRows?.forEach(row => {
    // Only include primitive values, not nested objects or arrays
    if (row.key && row.type !== "object" && row.type !== "array") {
      obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const getJson = useJson(state => state.getJson);
  const setJson = useJson(state => state.setJson);
  const setContents = useFile(state => state.setContents);
  const [editValue, setEditValue] = React.useState("");
  const [editing, setEditing] = React.useState(false);
  const themeMode = useConfig(state => (state.darkmodeEnabled ? "vs-dark" : "light"));
  
  React.useEffect(() => {
    if (nodeData?.text) {
      setEditValue(normalizeNodeData(nodeData.text));
      setEditing(false);
    }
  }, [nodeData]);
  const handleSave = () => {
    try {
      if (!nodeData?.path) {
        throw new Error("Invalid node path");
      }
      
      // Get the current full JSON
      const currentJson = JSON.parse(getJson());
      
      // Navigate to the node's parent to get the current value
      let parentObj = currentJson;
      let currentValue = currentJson;
      
      for (let i = 0; i < nodeData.path.length; i++) {
        parentObj = currentValue;
        currentValue = currentValue[nodeData.path[i]];
      }
      
      // Parse the edited value
      let parsed: unknown = editValue;
      try {
        parsed = JSON.parse(editValue);
      } catch (err) {
        // keep as string
        parsed = editValue;
      }
      
      // If the original value is an object and parsed is an object, merge them
      if (typeof currentValue === "object" && currentValue !== null && !Array.isArray(currentValue) &&
          typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        // Merge the edited properties back into the original object
        parsed = { ...currentValue, ...parsed };
      }

      const updatedJson = updateJsonAtPath(getJson(), nodeData.path, parsed);
      // Format the JSON with proper indentation
      const formattedJson = JSON.stringify(JSON.parse(updatedJson), null, 2);
      
      setJson(formattedJson);
      // Also update the file contents so the left editor reflects the change and persists
      setContents({ contents: formattedJson, hasChanges: true });
      toast.success("Value updated successfully");
      onClose();
    } catch (error) {
      console.error("Failed to update value:", error);
      toast.error("Failed to update value");
    }
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center" style={{ marginBottom: "8px" }}>
            <Text fz="lg" fw={600}>Node Content</Text>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!editing && (
                <Button 
                  onClick={() => setEditing(true)}
                  style={{ backgroundColor: "#404040", color: "#2563eb" }}
                  size="sm"
                >
                  Edit
                </Button>
              )}
              <CloseButton onClick={onClose} />
            </div>
          </Flex>

          <Flex justify="space-between" align="center" style={{ marginBottom: "4px" }}>
            <Text fz="xs" fw={500} style={{ color: "white" }}>
              Content
            </Text>
            {editing && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Button 
                  onClick={handleSave}
                  style={{ backgroundColor: "#16a34a", color: "white" }}
                  size="sm"
                >
                  Save
                </Button>
                <Button 
                  color="red" 
                  onClick={() => { setEditValue(normalizeNodeData(nodeData?.text ?? [])); setEditing(false); }}
                  style={{ backgroundColor: "#a3a3a3", color: "white" }}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            )}
          </Flex>

          {editing ? (
            <div style={{ height: 260 }}>
              <Editor
                theme={themeMode}
                defaultLanguage="json"
                value={editValue}
                onChange={(v) => setEditValue(v ?? "")}
                options={{ minimap: { enabled: false }, formatOnPaste: true }}
              />
            </div>
          ) : (
            <ScrollArea.Autosize mah={250} maw={600}>
              <CodeHighlight
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            </ScrollArea.Autosize>
          )}
        </Stack>

        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
