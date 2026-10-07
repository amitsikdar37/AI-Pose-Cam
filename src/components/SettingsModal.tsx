import React, { useState } from 'react';
import {
  X,
  Key,
  Cpu,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Clipboard,
  Sparkles,
} from 'lucide-react';
import type { CameraSensorInfo, ResolutionMode } from '../types/camera';
import { aiVisionService } from '../services/aiVisionService';

interface SettingsModalProps {
  sensorInfo: CameraSensorInfo | null;
  onClose: () => void;
  onSetResolutionMode?: (mode: ResolutionMode) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  sensorInfo,
  onClose,
  onSetResolutionMode,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState<string>(aiVisionService.getApiKey());
  const [hfTokenInput, setHfTokenInput] = useState<string>(aiVisionService.getHfToken());
  const [pollinationsKeyInput, setPollinationsKeyInput] = useState<string>(aiVisionService.getPollinationsKey());
  const [showKey, setShowKey] = useState(false);
  const [showHfKey, setShowHfKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(aiVisionService.getPreferredModel());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; models?: string[] } | null>(null);
  const [testingHf, setTestingHf] = useState(false);
  const [hfTestResult, setHfTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestHfToken = async () => {
    setTestingHf(true);
    setHfTestResult(null);
    const result = await aiVisionService.testHfToken(hfTokenInput.trim());
    setHfTestResult(result);
    setTestingHf(false);
  };

  const handleSaveApiKey = () => {
    const cleaned = aiVisionService.sanitizeApiKey(apiKeyInput);
    setApiKeyInput(cleaned);
    aiVisionService.setApiKey(cleaned);
    aiVisionService.setHfToken(hfTokenInput.trim());
    aiVisionService.setPollinationsKey(pollinationsKeyInput.trim());
    aiVisionService.setPreferredModel(selectedModel);
    setSavedSuccess(true);
    setTestResult(null);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleTestApiKey = async () => {
    const cleaned = aiVisionService.sanitizeApiKey(apiKeyInput);
    setApiKeyInput(cleaned);
    aiVisionService.setApiKey(cleaned);
    aiVisionService.setHfToken(hfTokenInput.trim());
    aiVisionService.setPollinationsKey(pollinationsKeyInput.trim());
    aiVisionService.setPreferredModel(selectedModel);
    setTestingConnection(true);
    setTestResult(null);
    const result = await aiVisionService.testConnection();
    setTestResult(result);
    setTestingConnection(false);
  };

  const handleClearApiKey = () => {
    aiVisionService.setApiKey('');
    setApiKeyInput('');
    setSavedSuccess(false);
    setTestResult(null);
  };

  const handleClearHfToken = () => {
    aiVisionService.setHfToken('');
    setHfTokenInput('');
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const cleaned = aiVisionService.sanitizeApiKey(text);
        setApiKeyInput(cleaned);
        setTestResult(null);
      }
    } catch {
      // Browser clipboard permission denied
    }
  };

  const trimmedKey = apiKeyInput.trim();
  const keyLength = trimmedKey.length;
  const isModernAQKey = trimmedKey.startsWith('AQ.');
  const isLegacyAIzaKey = trimmedKey.startsWith('AIza');
  const isValidFormat = (isModernAQKey && keyLength >= 45) || (isLegacyAIzaKey && keyLength === 39);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#121218] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-lg mx-auto max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">AI Director Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. Google Gemini & Imagen API Key */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-white">Gemini & Imagen API Key</span>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Powers instant scene object recognition and tailored text-to-image pose generation.
            </p>

            <div className="space-y-2">
              <div className="relative flex items-center">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder="Paste AIzaSy... or AQ.key..."
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setTestResult(null);
                  }}
                  className={`w-full bg-black/60 border rounded-xl py-2.5 pl-3.5 pr-20 text-xs text-white placeholder-gray-500 font-mono focus:outline-none transition-colors ${
                    apiKeyInput.trim().length === 0
                      ? 'border-white/10 focus:border-emerald-500'
                      : isValidFormat
                      ? 'border-emerald-500/80 focus:border-emerald-400'
                      : 'border-amber-500/80 focus:border-amber-400'
                  }`}
                />
                <div className="absolute right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="p-1.5 text-gray-400 hover:text-emerald-400 transition-colors"
                    title="Paste from clipboard"
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Model Selection */}
              <div className="pt-1">
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">Vision & Prompt Model</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'gemini-3.5-flash', label: '3.5 Flash', badge: 'Ultra Vision' },
                    { id: 'gemini-3.8-flash', label: '3.8 Flash', badge: 'Next-Gen' },
                    { id: 'gemini-3.5-flash-lite', label: '3.5 Lite', badge: 'Fast' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedModel(m.id)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium border flex flex-col items-center justify-center transition-colors ${
                        selectedModel === m.id
                          ? 'bg-emerald-500/20 border-emerald-500/80 text-emerald-300'
                          : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <span className="font-semibold">{m.label}</span>
                      <span className="text-[9px] opacity-75 font-mono">{m.badge}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons: Clear / Test / Save */}
              <div className="flex items-center justify-between pt-1">
                {apiKeyInput ? (
                  <button
                    onClick={handleClearApiKey}
                    className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear Key
                  </button>
                ) : (
                  <span className="text-[11px] text-gray-500">Free Pollinations AI fallback active</span>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestApiKey}
                    disabled={testingConnection || !apiKeyInput.trim()}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    {testingConnection ? (
                      <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                    ) : (
                      <span>Test Key</span>
                    )}
                  </button>

                  <button
                    onClick={handleSaveApiKey}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors shadow-sm active:scale-95"
                  >
                    {savedSuccess ? 'Saved!' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Connection Status */}
              {testResult && (
                <div
                  className={`mt-2 p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                    testResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-red-950/40 border-red-500/40 text-red-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <span className="leading-snug">{testResult.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Pose Reference Photo Generator (Quality & Quota) */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold text-white">Pose Photo Quality</span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                hfTokenInput.trim()
                  ? 'bg-purple-500/20 text-purple-300 border-purple-400/40'
                  : pollinationsKeyInput.trim()
                  ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                  : 'bg-white/10 text-gray-400 border-white/10'
              }`}>
                {hfTokenInput.trim() ? 'FLUX.1 [12B Studio]' : pollinationsKeyInput.trim() ? 'Pollinations FLUX' : 'Free AI (Distilled)'}
              </span>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              For crisp, human-realistic reference photos with accurate hands, real skin, and studio lighting, connect a 100% free Hugging Face token.
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-gray-300">
                  Hugging Face Token <span className="text-emerald-400 font-normal">(Free, No Credit Card)</span>
                </label>
                <a
                  href="https://huggingface.co/settings/tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                >
                  <span>Get Free Token</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>

              <div className="relative flex items-center">
                <input
                  type={showHfKey ? 'text' : 'password'}
                  placeholder="Paste hf_... token"
                  value={hfTokenInput}
                  onChange={(e) => setHfTokenInput(e.target.value)}
                  className={`w-full bg-black/60 border rounded-xl py-2 pl-3 pr-16 text-xs text-white placeholder-gray-500 font-mono focus:outline-none transition-colors ${
                    hfTokenInput.trim() ? 'border-purple-500/80 focus:border-purple-400' : 'border-white/10 focus:border-purple-500'
                  }`}
                />
                <div className="absolute right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const txt = await navigator.clipboard.readText();
                        if (txt) setHfTokenInput(txt.trim());
                      } catch {}
                    }}
                    className="p-1 text-gray-400 hover:text-purple-400 transition-colors"
                    title="Paste from clipboard"
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHfKey(!showHfKey)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                  >
                    {showHfKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-purple-950/30 border border-purple-500/20 text-[10px] text-purple-200 leading-relaxed">
                <span className="font-bold text-purple-300 block mb-0.5">⚠️ Required Token Permission:</span>
                When creating your token on Hugging Face, select Token type <strong className="text-white">"Write"</strong> (or enable <strong className="text-white">"Make calls to Inference Providers"</strong>). A repo read-only token cannot generate images.
              </div>

              <div className="pt-2 border-t border-white/5 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-gray-400">
                    Pollinations API Key <span className="text-gray-500 font-normal">(Optional)</span>
                  </label>
                  <a
                    href="https://enter.pollinations.ai"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  >
                    <span>enter.pollinations.ai</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="Paste Pollinations key (optional)..."
                  value={pollinationsKeyInput}
                  onChange={(e) => setPollinationsKeyInput(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl py-1.5 px-3 text-xs text-white placeholder-gray-500 font-mono focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                {hfTokenInput || pollinationsKeyInput ? (
                  <button
                    onClick={() => {
                      handleClearHfToken();
                      aiVisionService.setPollinationsKey('');
                      setPollinationsKeyInput('');
                      setHfTestResult(null);
                    }}
                    className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear Tokens
                  </button>
                ) : (
                  <span className="text-[10px] text-gray-400">
                    Without key: runs fast zero-key fallback
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestHfToken}
                    disabled={testingHf || !hfTokenInput.trim()}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors disabled:opacity-40 flex items-center gap-1"
                  >
                    {testingHf ? (
                      <RefreshCw className="w-3 h-3 animate-spin text-purple-400" />
                    ) : (
                      <span>Test Token</span>
                    )}
                  </button>

                  <button
                    onClick={handleSaveApiKey}
                    className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors shadow-sm active:scale-95"
                  >
                    Save Quality
                  </button>
                </div>
              </div>

              {/* HF Test Result Box */}
              {hfTestResult && (
                <div
                  className={`mt-2 p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                    hfTestResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-red-950/40 border-red-500/40 text-red-300'
                  }`}
                >
                  {hfTestResult.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <span className="leading-snug">{hfTestResult.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Dynamic Camera Hardware & Resolution Settings */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Detected Camera Hardware</span>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                {sensorInfo ? `${sensorInfo.maxMegapixels} MP Native` : 'Detecting...'}
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs">
                <span className="text-gray-300 font-medium">📷 Rear Camera Hardware:</span>
                <span className="font-mono text-emerald-300 font-bold">
                  {sensorInfo?.hardwareProfiles?.environment
                    ? `${sensorInfo.hardwareProfiles.environment.maxMegapixels} MP (${sensorInfo.hardwareProfiles.environment.maxWidth}×${sensorInfo.hardwareProfiles.environment.maxHeight})`
                    : sensorInfo?.facingMode === 'environment'
                    ? `${sensorInfo.maxMegapixels} MP (${sensorInfo.maxWidth}×${sensorInfo.maxHeight})`
                    : 'Switch camera to detect (🔄)'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs">
                <span className="text-gray-300 font-medium">🤳 Front Selfie Hardware:</span>
                <span className="font-mono text-emerald-300 font-bold">
                  {sensorInfo?.hardwareProfiles?.user
                    ? `${sensorInfo.hardwareProfiles.user.maxMegapixels} MP (${sensorInfo.hardwareProfiles.user.maxWidth}×${sensorInfo.hardwareProfiles.user.maxHeight})`
                    : sensorInfo?.facingMode === 'user'
                    ? `${sensorInfo.maxMegapixels} MP (${sensorInfo.maxWidth}×${sensorInfo.maxHeight})`
                    : 'Switch camera to detect (🔄)'}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed pt-1">
              Every photo is captured dynamically at the maximum native resolution provided by your device's camera hardware.
            </p>

            {onSetResolutionMode && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {(['max', '12mp'] as ResolutionMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onSetResolutionMode(mode)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                      (sensorInfo?.resolutionMode || 'max') === mode
                        ? 'bg-emerald-500 text-black border-emerald-400 shadow-md'
                        : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {mode === 'max' ? `MAX (${sensorInfo?.maxMegapixels || ''} MP)` : 'STANDARD (12 MP)'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
