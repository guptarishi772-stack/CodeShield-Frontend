/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Copy, Terminal, Trash2, Loader2, AlertTriangle, AlertCircle, Info, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface ThreatResult {
  category: string;
  count: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface AuditResponse {
  redactedText: string;
  threats: ThreatResult[];
}

export default function App() {
  const [inputText, setInputText] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const handleAudit = async () => {
    if (!inputText.trim()) return;

    setIsScanning(true);
    setError(null);
    setResult(null);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the following text/code for sensitive data (API keys, secrets, passwords, IPs, hostnames, DB strings, emails, phone numbers, etc.). 
        Redact all sensitive instances with [REDACTED]. 
        Also, provide a summary of the threats found with their categories and counts. 
        Severities should be:
        - CRITICAL: Private keys, credentials with broad access, cleartext passwords to critical systems.
        - HIGH: API keys, Secret tokens, DB connection strings.
        - MEDIUM: Private IP addresses, internal hostnames, emails, phone numbers.
        
        TEXT TO ANALYZE:
        """
        ${inputText}
        """`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              redactedText: { type: Type.STRING, description: "The full text with sensitive data replaced by [REDACTED]" },
              threats: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING, description: "Type of sensitive data (e.g., API Key, Email, IP Address)" },
                    count: { type: Type.NUMBER },
                    severity: { type: Type.STRING, enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] }
                  },
                  required: ["category", "count", "severity"]
                }
              }
            },
            required: ["redactedText", "threats"]
          }
        }
      });

      const auditData = JSON.parse(response.text || '{}') as AuditResponse;
      setResult(auditData);
    } catch (err) {
      console.error(err);
      setError('Failed to perform security audit. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const copyToClipboard = () => {
    if (result?.redactedText) {
      navigator.clipboard.writeText(result.redactedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const clearInput = () => {
    setInputText('');
    setResult(null);
    setError(null);
  };

  const getSeverityPill = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return 'severity-crit';
      case 'HIGH': return 'severity-high';
      case 'MEDIUM': return 'severity-med';
      default: return 'bg-emerald-500 text-white';
    }
  };

  const getStatCardClass = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return 'stat-crit';
      case 'HIGH': return 'stat-high';
      case 'MEDIUM': return 'stat-med';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8 flex flex-col max-w-[1280px] mx-auto overflow-hidden">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-surface border border-border rounded-xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-lg" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-primary flex items-center gap-2">
              CODESHIELD <span className="font-light opacity-50">v4.2</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-full text-[11px] font-bold uppercase tracking-wider">
          <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
          {isScanning ? 'Auditing Buffer...' : 'DLP Engine Active'}
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 flex-grow overflow-hidden">
        {/* Workspace Area */}
        <div className="flex flex-col gap-6 overflow-hidden">
          {/* Input Pane */}
          <div className="pane flex-grow min-h-[400px]">
            <div className="pane-header">
              <span className="pane-title">INPUT_BUFFER.raw</span>
              <button 
                onClick={clearInput}
                className="text-[10px] font-bold uppercase text-gray-400 hover:text-primary transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" />
                Clear Buffer
              </button>
            </div>
            <textarea
              autoFocus
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste code or text here to analyze for leaks..."
              className="w-full h-full p-6 font-mono text-sm resize-none outline-none text-gray-700 bg-white placeholder:text-gray-300 leading-relaxed"
            />
          </div>

          <button
            onClick={handleAudit}
            disabled={isScanning || !inputText.trim()}
            className={isScanning ? 'btn-primary opacity-50 cursor-not-allowed flex items-center justify-center gap-2' : 'btn-primary flex items-center justify-center gap-2'}
          >
            {isScanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            {isScanning ? 'INITIATING AUDIT...' : 'START SECURITY SCAN'}
          </button>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Sanitized Output Pane - Only show if result exists */}
          {result && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="pane animate-in fade-in slide-in-from-bottom-4 duration-500 h-[300px]"
            >
              <div className="pane-header">
                <span className="pane-title text-emerald-600 font-bold">OUTPUT_BUFFER.sanitized</span>
                <button 
                  onClick={copyToClipboard}
                  className="btn-secondary py-1.5 px-3 flex items-center gap-2 text-xs"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="p-6 overflow-y-auto font-mono text-sm leading-relaxed text-gray-600 bg-white h-full">
                {result.redactedText.split(/(\[REDACTED\])/).map((part, i) => 
                  part === '[REDACTED]' ? (
                    <span key={i} className="redacted whitespace-nowrap">
                      {part}
                    </span>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar Dashboard */}
        <aside className="flex flex-col gap-6">
          <div className="pane h-full">
            <div className="pane-header">
              <span className="pane-title">Threat Summary Panel</span>
            </div>
            
            <div className="p-6 flex flex-col gap-4 flex-grow overflow-y-auto">
              {result ? (
                result.threats.length > 0 ? (
                  result.threats.map((threat, idx) => (
                    <div key={idx} className={`stat-card ${getStatCardClass(threat.severity)}`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                        {threat.category}
                      </div>
                      <div className="text-2xl font-extrabold flex items-center justify-between">
                        {threat.count.toString().padStart(2, '0')}
                        <span className={`severity-pill ${getSeverityPill(threat.severity)}`}>
                          {threat.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-2 leading-tight">
                        Detection identified signature match in raw buffer.
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-20 px-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                      <ShieldCheck className="w-6 h-6 text-emerald-500" />
                    </div>
                    <p className="font-bold text-gray-900">Zero High-Risk Leaks</p>
                    <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">Seal integrity verified</p>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-20 px-8 text-gray-300">
                  <Terminal className="w-12 h-12 mb-4 opacity-10" />
                  <p className="text-xs font-bold uppercase tracking-[0.2em] leading-relaxed">
                    Awaiting Buffer for Analysis
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border bg-gray-50/30 flex flex-col gap-3">
              <button className="btn-primary w-full py-2.5 text-xs tracking-widest uppercase">
                Download Audit Report
              </button>
              <button onClick={clearInput} className="btn-secondary w-full py-2.5 text-xs tracking-widest uppercase">
                Clear and Refresh
              </button>
            </div>
          </div>
        </aside>
      </main>

      <footer className="mt-8 text-[10px] font-bold tracking-[0.3em] text-gray-400 uppercase text-center pb-8 border-t border-gray-200 pt-8">
        Proprietary Data Loss Prevention System • CodeShield Secure-Audit Layer
      </footer>
    </div>
  );
}
