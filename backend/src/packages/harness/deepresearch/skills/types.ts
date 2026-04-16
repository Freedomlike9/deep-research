export interface Skill {
  name: string;
  description: string;
  content: string;
  category: "public" | "custom";
  enabled: boolean;
  path: string;
}
