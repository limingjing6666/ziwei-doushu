/**
 * 兼容层：真实实现在 components/birth/BirthForm.tsx。
 *
 * lib/ziwei/share.ts、lib/ziwei/history.ts、app/heming/page.tsx 与回归脚本
 * 仍然从本路径导入组件与 BirthFormState 类型，因此这里只做转出，不放实现。
 */
export { default } from "@/components/birth/BirthForm";
export type {
  BirthFormProps,
  BirthFormState,
  BirthFormVariant,
} from "@/components/birth/BirthForm";
