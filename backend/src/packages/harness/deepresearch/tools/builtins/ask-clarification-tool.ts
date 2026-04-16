export interface ClarificationRequest {
  question: string;
  clarificationType:
    | "missing_info"
    | "ambiguous_requirement"
    | "approach_choice"
    | "risk_confirmation"
    | "suggestion";
  context?: string;
  options?: string[];
}

export const askClarificationTool = {
  name: "ask_clarification",
  description: "Request clarification before continuing risky or ambiguous work",
  invoke: async (request: ClarificationRequest) => request
};
