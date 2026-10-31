import clsx, { type ClassValue } from "clsx";

/** 合并 className（项目内统一入口，未来可换 tailwind-merge） */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
