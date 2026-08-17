export interface Prompt {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Context {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DocxTemplate {
  id: string;
  name: string;
  storage_path: string;
  variables: string[];
  template_type: "resume" | "cover_letter";
  profile_id: string | null;
  prompt_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileAssignment {
  id: string;
  profile_id: string;
  user_id: string;
  created_at: string;
}
