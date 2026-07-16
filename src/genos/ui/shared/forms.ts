/**
 * Form-state logic shared by all design systems: react-lang field-state
 * plumbing, model-supplied value seeding, keyboard behavior, and Select item
 * decoding. Design systems own only the visual styling of their inputs.
 */
import {
  useFormName,
  useGetFieldValue,
  useSetDefaultValue,
  useSetFieldValue,
} from "@openuidev/react-lang";

/**
 * Field state for one named input. `seedValue` is the model-supplied initial
 * value (the contract's `value` prop, or a Slider's defaultValue): it seeds
 * empty form state once streaming settles, so prefilled edit screens actually
 * show the values the model carried over.
 */
export function useFieldState(name: string, componentType: string, seedValue?: unknown) {
  const formName = useFormName();
  const getFieldValue = useGetFieldValue();
  const setFieldValue = useSetFieldValue();
  const value = getFieldValue(formName, name);
  useSetDefaultValue({
    formName,
    componentType,
    name,
    existingValue: value,
    defaultValue: seedValue,
  });
  return {
    value,
    set: (next: unknown, persist: boolean) =>
      setFieldValue(formName, componentType, name, next, persist),
  };
}

const KEYBOARD: Record<string, "default" | "email-address" | "numeric" | "url"> = {
  email: "email-address",
  number: "numeric",
  url: "url",
};

/** TextInput behavior derived from the contract's input `type`. */
export function textInputBehaviorProps(type?: string) {
  return {
    secureTextEntry: type === "password",
    keyboardType: KEYBOARD[type ?? "text"] ?? "default",
    autoCapitalize: (type === "email" || type === "url" ? "none" : "sentences") as
      | "none"
      | "sentences",
  };
}

export interface SelectItemProps {
  value?: string;
  label?: string;
}

/** Decode react-lang's evaluated SelectItem elements into plain options. */
export function readSelectItems(items: unknown): SelectItemProps[] {
  return ((Array.isArray(items) ? items : []) as Array<{ props?: SelectItemProps }>)
    .map((it) => it?.props)
    .filter((p): p is SelectItemProps => !!p);
}
