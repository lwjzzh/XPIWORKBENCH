
// API Configuration Model
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type BodyType = 'json' | 'form-data' | 'none';

export interface ApiHeader {
  id: string;
  key: string;
  value: string;
}

export interface ApiConfig {
  url: string;
  method: HttpMethod;
  headers: ApiHeader[]; 
  bodyType: BodyType;
  bodyTemplate?: string; // JSON string with {{variable}} placeholders
  stream?: boolean; // Enable streaming response (SSE/Chunks)
}

// UI/Parameter Model
// Added: number, date, boolean, radio, email
export type ParamUiType = 'input' | 'textarea' | 'select' | 'password' | 'file' | 'number' | 'date' | 'boolean' | 'radio' | 'email';

export interface ParamDefinition {
  id: string;
  key: string; // The variable name used in API template or logic
  label: string;
  value: string; // Default value or Fixed value
  isVisible: boolean; // If false, treated as a hidden/fixed system parameter
  uiType: ParamUiType;
  options?: { label: string; value: string }[]; // For select and radio types
  description?: string; // Tooltip or help text
  required?: boolean;
}

// Flow Control Configuration (New)
export interface FlowControl {
    continueOnError: boolean; // If true, pipeline continues even if this step fails
    retryCount: number; // 0 to 5
    retryDelay: number; // ms
    timeout?: number; // ms (optional override)
}

// Component Model (Encapsulates an API call and its UI)
export interface Component {
  id: string;
  name: string;
  description?: string;
  apiConfig: ApiConfig;
  parameters: ParamDefinition[]; // Replaces inputFields
  flowControl?: FlowControl; // New field
}

// App Configuration
export type AppRunMode = 'chat' | 'panel';

export interface App {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  runMode: AppRunMode;
  components: Component[];
  layoutConfig?: {
    direction: 'vertical' | 'horizontal';
    gap: number;
  };
  createdAt: number;
  updatedAt: number;
  isPinned?: boolean; // New field for App pinning
}

// Session Model (For Persistence)
export interface Session {
    id: string;
    appId: string;
    name: string;
    type: 'chat' | 'panel';
    data: any; // Dynamic content based on type (messages[] or inputValues{})
    updatedAt: number;
    isPinned?: boolean; // New field for pinning chats
}

// Execution Log Structure
export interface ExecutionLog {
  id: string;
  appId: string;
  timestamp: number;
  status: 'success' | 'error';
  steps: ExecutionStepLog[];
}

export interface ExecutionStepLog {
  stepId: string;
  stepName: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: any;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: any;
  };
  duration: number;
  error?: string;
}
