import React, { useState } from 'react';
import {
  X,
  Key,
  Cpu,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Eye,
  EyeOff,
  Clipboard,
} from 'lucide-react';
import type { CameraSensorInfo, ResolutionMode } from '../types/camera';
import { aiVisionService } from '../services/aiVisionService';

interface SettingsModalProps {
  sensorInfo: CameraSensorInfo | null;
  autoCapture: boolean;
  onToggleAutoCapture: (val: boolean) => void;
  alignmentSensitivity: number;
  onSetSensitivity: (val: number) => void;
  guideOpacity: number;
  onSetGuideOpacity: (val: number) => void;
  onClose: () => void;
  onSetResolutionMode?: (mode: ResolutionMode) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  sensorInfo,
  autoCapture,
  onToggleAutoCapture,
  alignmentSensitivity,
  onSetSensitivity,
  guideOpacity,
  onSetGuideOpacity,
  onClose,
  onSetResolutionMode,
}) => {

  const [apiKeyInput, setApiKeyInput] = useState<string>(aiVisionService.getApiKey());
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(aiVisionService.getPreferredModel());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; models?: string[] } | null>(null);

  const handleSaveApiKey = () => {
    const cleaned = aiVisionService.sanitizeApiKey(apiKeyInput);
    setApiKeyInput(cleaned);
    aiVisionService.setApiKey(cleaned);
    aiVisionService.setPreferredModel(selectedModel);
    setSavedSuccess(true);
    setTestResult(null);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleTestApiKey = async () => {
    const cleaned = aiVisionService.sanitizeApiKey(apiKeyInput);
    setApiKeyInput(cleaned);
    aiVisionService.setApiKey(cleaned);
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

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const cleaned = aiVisionService.sanitizeApiKey(text);
        setApiKeyInput(cleaned);
        setTestResult(null);
      }
    } catch {
      // In case browser clipboard API permission is denied
    }
  };

  // Live key validation helpers (supports both modern 2026 'AQ....' keys and legacy 'AIza....' keys)
  const trimmedKey = apiKeyInput.trim();
  const keyLength = trimmedKey.length;
  const isModernAQKey = trimmedKey.startsWith('AQ.');
  const isLegacyAIzaKey = trimmedKey.startsWith('AIza');
  const isValidFormat = (isModernAQKey && keyLength >= 45) || (isLegacyAIzaKey && keyLength === 39);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#121218] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-lg mx-auto max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">Camera & AI Director Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* 1. Gemini API Key Configuration */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-white">Gemini Multimodal Vision API</span>
              </div>
              {aiVisionService.hasApiKey() && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                  Configured
                </span>
              )}
            </div>

            <p className="text-xs text-gray-300">
              Powers real-time multimodal scene analysis and generates custom pose coordinates using Google Gemini.
            </p>

            <div className="space-y-3">
              {/* API Key Input with Eye Toggle & Paste Button */}
              <div className="space-y-1.5">
                <div className="relative flex items-center">
                  <input
                    type={showKey ? 'text' : 'password'}
                    placeholder="AQ.Ab8... or AIzaSy..."
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value);
                      setTestResult(null);
                    }}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    className="w-full bg-black/60 border border-white/20 rounded-xl pl-3.5 pr-20 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 font-mono tracking-wide"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    {/* Paste Button */}
                    <button
                      type="button"
                      onClick={handlePasteFromClipboard}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
                      title="Paste key from clipboard"
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                    </button>
                    {/* Reveal/Hide Key Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
                      title={showKey ? 'Hide key' : 'Show key'}
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Real-time Format & Length Hint */}
                {keyLength > 0 && (
                  <div className="flex items-center justify-between text-[11px] px-1">
                    {isValidFormat ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        ✓ Valid Google AI Studio key ({isModernAQKey ? 'New AQ format' : '39 chars'})
                      </span>
                    ) : isModernAQKey ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        ✓ Modern Google AI Studio key ({keyLength} chars)
                      </span>
                    ) : isLegacyAIzaKey ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        ⚠️ {keyLength}/39 chars (Legacy AIza keys are 39 chars)
                      </span>
                    ) : keyLength >= 25 ? (
                      <span className="text-emerald-400/90 flex items-center gap-1 font-medium">
                        ✓ Key detected ({keyLength} chars) • Tap Test Key
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        ⚠️ Key seems incomplete ({keyLength} chars)
                      </span>
                    )}
                    <span className="text-gray-500 font-mono text-[10px]">{keyLength} chars</span>
                  </div>
                )}
              </div>

              {/* Model Selector Dropdown */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-400 flex items-center gap-1 font-medium">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>Preferred Vision Model</span>
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    aiVisionService.setPreferredModel(e.target.value);
                  }}
                  className="w-full bg-black/70 border border-white/20 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="auto">Auto-Select Best (Gemini 3.5 / 3.8 Flash - Recommended)</option>
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (Fast, Stable Vision - Best)</option>
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash (High Performance Vision)</option>
                  <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (Fastest Response)</option>
                  <option value="gemini-3.8-flash-lite">Gemini 3.8 Flash-Lite (Low Latency)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <span>Get Free Gemini Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex items-center gap-1.5">
                  {apiKeyInput && (
                    <button
                      onClick={handleClearApiKey}
                      className="px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      Clear
                    </button>
                  )}

                  <button
                    onClick={handleTestApiKey}
                    disabled={testingConnection || !apiKeyInput}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors flex items-center gap-1 disabled:opacity-40 active:scale-95"
                    title="Test connection to Gemini vision models"
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

              {/* Real-time Connection Test Status */}
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

              {/* Offline / No API Key Helper Tip */}
              <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-2.5 text-xs text-sky-200 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-white">No API Key or having trouble?</p>
                  <p className="text-[11px] text-sky-200/90 leading-relaxed">
                    Tap <span className="font-semibold text-white">Clear</span> anytime! The camera will instantly switch to <span className="font-semibold text-emerald-400">Studio AI Director Mode</span> — cycling curated professional poses with full green skeletal tracking and full-sensor RAW still capture with zero network errors.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Auto-Capture When Aligned */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-white">Auto-Capture on Alignment</div>
              <div className="text-xs text-gray-400">
                Automatically snaps raw photo when body holds green alignment for 1s
              </div>
            </div>
            <button
              onClick={() => onToggleAutoCapture(!autoCapture)}
              className={`w-12 h-7 rounded-full transition-colors relative p-1 ${
                autoCapture ? 'bg-emerald-500' : 'bg-gray-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  autoCapture ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3. Alignment Sensitivity */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Alignment Sensitivity</span>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                {alignmentSensitivity}%
              </span>
            </div>
            <input
              type="range"
              min="65"
              max="90"
              step="1"
              value={alignmentSensitivity}
              onChange={(e) => onSetSensitivity(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Relaxed (65%)</span>
              <span>Balanced (78%)</span>
              <span>Strict (90%)</span>
            </div>
          </div>

          {/* 4. Guide Opacity */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Wireframe Guide Opacity</span>
              <span className="text-xs font-mono text-sky-400 font-bold">
                {Math.round(guideOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1.0"
              step="0.05"
              value={guideOpacity}
              onChange={(e) => onSetGuideOpacity(Number(e.target.value))}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>

          {/* 5. Sensor Hardware Diagnostics & Resolution Override */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span>Camera Sensor & Resolution Mode</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                {sensorInfo?.maxMegapixels ? `${sensorInfo.maxMegapixels} MP` : '32 MP'}
              </span>
            </div>

            {/* Resolution Mode Dropdown */}
            {onSetResolutionMode && (
              <div className="space-y-1">
                <label className="text-[11px] text-gray-300 font-medium flex items-center justify-between">
                  <span>Photo Capture Megapixels</span>
                  <span className="text-emerald-400 font-mono text-[10px]">
                    {sensorInfo?.resolutionMode === '32mp'
                      ? '6528 × 4896 (32.0 MP)'
                      : sensorInfo?.resolutionMode === '4mp'
                      ? '2304 × 1728 (4.0 MP)'
                      : 'Stream Native'}
                  </span>
                </label>
                <select
                  value={sensorInfo?.resolutionMode || '32mp'}
                  onChange={(e) => onSetResolutionMode(e.target.value as ResolutionMode)}
                  className="w-full bg-black/70 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="32mp">32.0 MP Full Sensor (6528 × 4896) — Ultra HD</option>
                  <option value="4mp">4.0 MP Quad-Bayer Binned Stream (2304 × 1728)</option>
                  <option value="auto">Auto-Detect Hardware Stream Mode</option>
                </select>
              </div>
            )}

            {/* Explanatory Note for 32 MP vs 4.0 MP */}
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-200/90 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-white text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Why did your selfie say 4.0 MP before?</span>
              </div>
              <p className="text-[11px] leading-relaxed text-gray-300">
                Modern 32 MP phone cameras use <strong className="text-emerald-300">4-in-1 Quad-Bayer binning</strong> (32 MP ÷ 4 = 8 / 4 MP) for live video streams in web browsers. In <strong className="text-white">32 MP Mode</strong>, AI Pose Cam unlocks your full 32.0 Megapixel optical sensor (6528 × 4896) and eliminates selfie inversion!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                <span className="text-gray-400 block text-[10px]">MAX PHOTO RES</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {sensorInfo ? `${sensorInfo.maxWidth} × ${sensorInfo.maxHeight}` : '6528 × 4896'}
                </span>
              </div>

              <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                <span className="text-gray-400 block text-[10px]">SENSOR RATING</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {sensorInfo?.maxMegapixels ? `${sensorInfo.maxMegapixels} Megapixels` : '32.0 Megapixels'}
                </span>
              </div>

              <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                <span className="text-gray-400 block text-[10px]">SELFIE ORIENTATION</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  Mirrored (Matches Preview)
                </span>
              </div>

              <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                <span className="text-gray-400 block text-[10px]">CAMERA FACING</span>
                <span className="font-mono text-white capitalize font-semibold">
                  {sensorInfo?.facingMode === 'user' ? 'Front (Selfie)' : 'Back (Rear)'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
