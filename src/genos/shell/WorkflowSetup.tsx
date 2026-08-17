import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { SlashCommandDef } from "../commands";
import {
  FIRECRAWL_WORKFLOW_SETUPS,
  setupCreditBudget,
  validateWorkflowSetup,
  visibleWorkflowFields,
  type WorkflowFieldDef,
  type WorkflowSetupValues,
} from "../workflows";
import { useCds } from "../theme";
import { Text, TextInput, linearType } from "../typography";
import { ProviderIcon } from "../ui/ProviderIcon";

export function initialWorkflowValues(command: SlashCommandDef, argument: string): WorkflowSetupValues {
  const values: WorkflowSetupValues = {};
  const fields = FIRECRAWL_WORKFLOW_SETUPS[command.workflowId].fields;
  const firstTaskField = fields.find((candidate) =>
    candidate.required && (candidate.type === "text" || candidate.type === "url") && !candidate.visibleWhen,
  );
  if (firstTaskField && argument.trim()) values[firstTaskField.id] = argument.slice(0, 10_000);
  for (const candidate of fields) {
    if (candidate.type === "select" && candidate.options?.length) values[candidate.id] = candidate.options[0].value;
    if (candidate.type === "number" && candidate.required) values[candidate.id] = candidate.min ?? 1;
    if (candidate.type === "checkbox") values[candidate.id] = false;
  }
  if (command.workflowId === "firecrawl" && argument.trim()) {
    try {
      const url = new URL(argument.trim());
      if (url.protocol === "http:" || url.protocol === "https:") {
        values.operation = "scrape";
        values.url = argument.trim();
      }
    } catch {
      values.operation = "search";
      values.query = argument.slice(0, 10_000);
    }
  } else if (command.workflowId === "firecrawl") {
    delete values.operation;
  }
  return values;
}

function Field({
  definition,
  value,
  error,
  onChange,
}: {
  definition: WorkflowFieldDef;
  value: string | number | boolean | undefined;
  error?: string;
  onChange: (value: string | number | boolean) => void;
}) {
  const t = useCds();
  if (definition.type === "checkbox") {
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value === true }}
        accessibilityLabel={definition.label}
        onPress={() => onChange(value !== true)}
        style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8 }}
      >
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: value ? t.tint : t.sep, backgroundColor: value ? t.tint : t.group, alignItems: "center", justifyContent: "center" }}>
          {value === true && <Text style={{ color: "#fff", fontSize: 13 }}>✓</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.ink, ...linearType.bodySmall }}>{definition.label}</Text>
          {!!definition.hint && <Text style={{ color: t.ink2, ...linearType.caption }}>{definition.hint}</Text>}
          {!!error && <Text style={{ color: t.red, ...linearType.caption }}>{error}</Text>}
        </View>
      </Pressable>
    );
  }
  if (definition.type === "select") {
    return (
      <View style={{ gap: 7 }}>
        <Text style={{ color: t.ink, ...linearType.bodySmall }}>{definition.label}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {definition.options?.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: value === option.value }}
              onPress={() => onChange(option.value)}
              style={{ paddingVertical: 7, paddingHorizontal: 11, borderRadius: 14, backgroundColor: value === option.value ? t.tint : t.fill }}
            >
              <Text style={{ color: value === option.value ? "#fff" : t.ink, fontSize: 12 }}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        {!!error && <Text style={{ color: t.red, ...linearType.caption }}>{error}</Text>}
      </View>
    );
  }
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.ink, ...linearType.bodySmall }}>{definition.label}</Text>
      <TextInput
        accessibilityLabel={definition.label}
        value={value === undefined ? "" : String(value)}
        onChangeText={(next) => onChange(definition.type === "number" ? next : next.slice(0, 10_000))}
        placeholder={definition.placeholder}
        placeholderTextColor={t.ink3}
        autoCapitalize="none"
        keyboardType={definition.type === "number" ? "number-pad" : definition.type === "url" ? "url" : "default"}
        style={{ borderWidth: 1, borderColor: error ? t.red : t.sep, backgroundColor: t.group, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 12, color: t.ink, fontSize: 13 }}
      />
      {!!error && <Text style={{ color: t.red, ...linearType.caption }}>{error}</Text>}
    </View>
  );
}

export function WorkflowSetup({ command, argument, onCancel, onSubmit }: {
  command: SlashCommandDef;
  argument: string;
  onCancel: () => void;
  onSubmit: (values: WorkflowSetupValues) => void;
}) {
  const t = useCds();
  const [values, setValues] = useState<WorkflowSetupValues>(() => initialWorkflowValues(command, argument));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fields = useMemo(() => visibleWorkflowFields(command.workflowId, values), [command.workflowId, values]);
  const budget = setupCreditBudget(command.workflowId, values);

  const submit = () => {
    const nextErrors = validateWorkflowSetup(command.workflowId, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSubmit(values);
  };

  return (
    <View style={{ position: "absolute", inset: 0, zIndex: 85, backgroundColor: t.bg, paddingTop: 48 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, paddingBottom: 50, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <ProviderIcon providerId="firecrawl" size={42} cornerRadius={10} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, ...linearType.cardTitle }}>{command.title}</Text>
            <Text style={{ color: t.ink2, ...linearType.caption }}>Deterministic workflow setup</Text>
          </View>
        </View>
        <Text style={{ color: t.ink2, ...linearType.bodySmall }}>
          Complete the required inputs below. Nothing is sent to Firecrawl until you confirm the displayed budget and press Run.
        </Text>
        {fields.map((definition) => (
          <Field key={definition.id} definition={definition} value={values[definition.id]} error={errors[definition.id]} onChange={(value) => setValues((current) => ({ ...current, [definition.id]: value }))} />
        ))}
        <View accessibilityLabel={`Maximum Firecrawl budget ${budget} credits`} style={{ padding: 14, borderRadius: 14, backgroundColor: t.fill, gap: 4 }}>
          <Text style={{ color: t.ink, fontSize: 14, fontWeight: "600" }}>Maximum budget: {budget} credits</Text>
          <Text style={{ color: t.ink2, ...linearType.caption }}>This is a ceiling, not expected spend. Exhaustive research can use up to 750 credits.</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable accessibilityLabel="Cancel workflow setup" onPress={onCancel} style={{ flex: 1, padding: 12, borderRadius: 20, backgroundColor: t.fill, alignItems: "center" }}>
            <Text style={{ color: t.ink, ...linearType.button }}>Cancel</Text>
          </Pressable>
          <Pressable accessibilityLabel={`Run with maximum ${budget} credits`} onPress={submit} style={{ flex: 1, padding: 12, borderRadius: 20, backgroundColor: t.tint, alignItems: "center" }}>
            <Text style={{ color: "#fff", ...linearType.button }}>Run workflow</Text>
          </Pressable>
        </View>
        <Text style={{ color: t.ink2, textAlign: "center", ...linearType.caption }}>
          Results stay in AppLess as structured views with sources. File/CSV export is not available.
        </Text>
      </ScrollView>
    </View>
  );
}
