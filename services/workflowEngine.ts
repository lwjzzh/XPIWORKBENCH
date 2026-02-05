
import { App, Component } from '../types/schema';
import { getAppById, proxyRequest, proxyStreamRequest } from './storage';
import { useSettingsStore } from '../store/useSettingsStore';

export interface ExecutionResult {
    success: boolean;
    data?: any;
    error?: string;
    duration: number;
    headers?: any;
}

// --- CONFIGURATION ---
const ENABLE_MOCK_MODE = false; 

// --- HELPERS ---

export const mergeParameters = (component: Component, userInputs: Record<string, any>): Record<string, any> => {
    const merged: Record<string, any> = {};
    component.parameters.forEach(p => {
        if (userInputs[p.key] !== undefined && userInputs[p.key] !== null) {
            merged[p.key] = userInputs[p.key];
        } else if (p.value !== undefined && p.value !== null) {
            merged[p.key] = String(p.value);
        } else {
            merged[p.key] = "";
        }
    });
    return merged;
};

// Helper to resolve dot notation (e.g. "env.API_KEY" or "step1.data.id")
export const resolvePath = (obj: any, path: string): any => {
    if (!path) return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
    }
    return current;
};

// Robust string interpolation supporting dot notation
// FIX: Added '-' to regex to support UUIDs
export const interpolateString = (template: string, values: Record<string, any>): string => {
    if (!template) return '';
    // Match {{ variable.path }}
    return template.replace(/{{\s*([a-zA-Z0-9_$.-]+)\s*}}/g, (match, path) => {
        const val = resolvePath(values, path);
        if (val !== undefined && val !== null) {
            return (typeof val === 'object') ? JSON.stringify(val) : String(val);
        }
        return match; 
    });
};

// Robust JSON Interpolation with Object Substitution
export const interpolateJSON = (templateStr: string, values: Record<string, any>): string => {
    try {
        const root = JSON.parse(templateStr);

        const walk = (node: any): any => {
            if (typeof node === 'string') {
                // Exact Match Substitution (e.g. "{{$messages}}") to preserve types (Array/Object)
                // FIX: Added '-' to regex to support UUIDs
                const exactMatch = node.match(/^\s*{{\s*([a-zA-Z0-9_$.-]+)\s*}}\s*$/);
                if (exactMatch) {
                    const path = exactMatch[1];
                    const val = resolvePath(values, path);
                    if (val !== undefined) {
                        return val; 
                    }
                }
                return interpolateString(node, values);
            } else if (Array.isArray(node)) {
                return node.map(walk);
            } else if (node !== null && typeof node === 'object') {
                const newObj: any = {};
                for (const key in node) {
                    newObj[key] = walk(node[key]);
                }
                return newObj;
            }
            return node;
        };

        const processed = walk(root);
        return JSON.stringify(processed);
    } catch (e) {
        console.warn("InterpolateJSON failed to parse template, falling back to string replacement", e);
        return interpolateString(templateStr, values);
    }
};

// --- EXECUTION LOGIC ---

export const executeComponent = async (
    component: Component, 
    inputs: Record<string, any>,
    context: Record<string, any> = {},
    onStream?: (partialData: string) => void
): Promise<ExecutionResult> => {
    const startTime = Date.now();
    
    // Merge inputs and context. 
    const mergedData = { ...context, ...mergeParameters(component, inputs) };

    // --- MOCK MODE ---
    if (ENABLE_MOCK_MODE) {
        await new Promise(r => setTimeout(r, 1000));
        return { success: true, data: { text: "Mock Data" }, duration: 1000 };
    }

    // --- REAL MODE ---
    try {
        const { url, method, headers, bodyTemplate, bodyType, stream } = component.apiConfig;

        // 1. Interpolate
        const finalUrl = interpolateString(url, mergedData);
        const finalHeaders: Record<string, string> = {};
        headers.forEach(h => {
            if (h.key) finalHeaders[h.key] = interpolateString(h.value, mergedData);
        });

        let finalBody = "";
        if (method !== 'GET') {
            if (bodyType === 'json' && bodyTemplate) {
                finalBody = interpolateJSON(bodyTemplate, mergedData);
            } else if (bodyType === 'form-data' && bodyTemplate) {
                try {
                    const parsed = JSON.parse(bodyTemplate);
                    const entries: {key: string, value: string}[] = Array.isArray(parsed) ? parsed : [];
                    const interpolatedEntries = entries.map(entry => ({
                        key: entry.key,
                        value: interpolateString(entry.value, mergedData) 
                    }));
                    finalBody = JSON.stringify(interpolatedEntries);
                    finalHeaders['Content-Type'] = 'multipart/form-data';
                } catch (e) {
                     throw new Error("Invalid Form Data configuration.");
                }
            }
        }

        // 4. Call Backend (Stream vs Standard)
        let bodyData: any;
        let responseHeaders: any;

        if (stream && onStream) {
            // STREAMING EXECUTION
            let fullRawText = "";
            let sseAccumulator = ""; 
            let streamBuffer = ""; 
            
            await proxyStreamRequest(method, finalUrl, finalHeaders, finalBody, (chunk) => {
                fullRawText += chunk;
                streamBuffer += chunk;

                // Simple Heuristic: If it starts with "data:", treat as SSE
                const isSSE = streamBuffer.trimStart().startsWith('data:') || sseAccumulator.length > 0;

                if (isSSE) {
                    const lines = streamBuffer.split('\n');
                    streamBuffer = lines.pop() || "";

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                            try {
                                const jsonStr = trimmed.substring(6);
                                const json = JSON.parse(jsonStr);
                                
                                let content = "";
                                if (json.choices?.[0]?.delta?.content) content = json.choices[0].delta.content;
                                else if (json.content) content = json.content;
                                else if (json.response) content = json.response; // Ollama

                                if (content) {
                                    sseAccumulator += content;
                                    onStream(sseAccumulator);
                                }
                            } catch (e) { }
                        }
                    }
                } else {
                    onStream(fullRawText);
                }
            });

            if (sseAccumulator) {
                bodyData = sseAccumulator;
            } else {
                try {
                    if (fullRawText.trim().startsWith('{') || fullRawText.trim().startsWith('[')) {
                        bodyData = JSON.parse(fullRawText);
                    } else {
                        bodyData = fullRawText;
                    }
                } catch(e) { bodyData = fullRawText; }
            }

        } else {
            // STANDARD EXECUTION
            const response = await proxyRequest(method, finalUrl, finalHeaders, finalBody);
            
            if (!response.success) {
                throw new Error(response.error || `HTTP ${response.status} Error`);
            }

            bodyData = response.body;
            responseHeaders = response.headers;

            try {
                if (bodyData && (bodyData.trim().startsWith('{') || bodyData.trim().startsWith('['))) {
                    bodyData = JSON.parse(bodyData);
                }
            } catch (e) { /* ignore */ }

            if (response.status >= 400) {
                throw new Error(`HTTP ${response.status}: ${typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData)}`);
            }
        }

        return {
            success: true,
            data: bodyData,
            duration: Date.now() - startTime,
            headers: responseHeaders
        };

    } catch (e: any) {
        return {
            success: false,
            error: e.message,
            duration: Date.now() - startTime
        };
    }
};

export const executeApp = async (
    appId: string,
    userInputs: Record<string, Record<string, any>>, 
    onStepUpdate?: (componentId: string, status: 'running' | 'success' | 'error', result?: any, error?: string) => void,
    context: Record<string, any> = {}
): Promise<void> => {
    
    const app = await getAppById(appId);
    if (!app) throw new Error(`App ${appId} not found`);

    const { envVars } = useSettingsStore.getState();
    const pipelineContext: Record<string, any> = { 
        env: envVars,
        ...context
    };

    for (const comp of app.components) {
        onStepUpdate?.(comp.id, 'running', undefined);

        const stepInputs = { ...(userInputs[comp.id] || {}) };
        
        // Input interpolation
        Object.keys(stepInputs).forEach(key => {
            let val = stepInputs[key];
            if (typeof val === 'string' && val.includes('{{')) {
                val = interpolateString(val, pipelineContext);
                stepInputs[key] = val;
            }
        });

        // Flow Control Logic
        const maxRetries = comp.flowControl?.retryCount || 0;
        const retryDelay = comp.flowControl?.retryDelay || 1000;
        const continueOnError = comp.flowControl?.continueOnError || false;

        let attempts = 0;
        let success = false;
        let lastError = "";
        let resultData: any = null;

        while (attempts <= maxRetries && !success) {
            if (attempts > 0) {
                console.log(`Retrying step ${comp.id}, attempt ${attempts}...`);
                await new Promise(r => setTimeout(r, retryDelay));
            }

            try {
                // Execute
                const handleStream = (partialData: string) => {
                    onStepUpdate?.(comp.id, 'running', partialData);
                };

                const result = await executeComponent(comp, stepInputs, pipelineContext, handleStream);

                if (result.success) {
                    success = true;
                    resultData = result.data;
                    
                    pipelineContext[comp.id] = result.data;
                    pipelineContext[`${comp.id}_response`] = result;
                    onStepUpdate?.(comp.id, 'success', result.data);
                } else {
                    lastError = result.error || "Unknown Error";
                }

            } catch (e: any) {
                lastError = e.message;
            }
            
            attempts++;
        }

        if (!success) {
            onStepUpdate?.(comp.id, 'error', undefined, lastError);
            pipelineContext[`${comp.id}_error`] = lastError; // FIX: Inject error into context
            if (!continueOnError) {
                // Stop Pipeline
                break;
            } else {
                // Continue Pipeline
                console.warn(`Step ${comp.id} failed but 'continueOnError' is enabled.`);
            }
        }
    }
};
