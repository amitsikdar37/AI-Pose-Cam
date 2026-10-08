import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  KeyRound,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Clipboard,
  X,
  HelpCircle,
  Camera,
  ChevronDown,
  ChevronUp,
  Check,
  Zap,
} from 'lucide-react';
import { aiVisionService } from '../services/aiVisionService';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onKeySaved,
}) => {
  const [geminiKey, setGeminiKey] = useState<string>(aiVisionService.getApiKey());
  const [hfToken, setHfToken] = useState<string>(aiVisionService.getHfToken());
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showHfKey, setShowHfKey] = useState(false);

  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiResult, setGeminiResult] = useState<{ success: boolean; message: string } | null>(null);

  const [testingHf, setTestingHf] = useState(false);
  const [hfResult, setHfResult] = useState<{ success: boolean; message: string } | null>(null);

  const [showGeminiFaq, setShowGeminiFaq] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleTestGemini = async () => {
    if (!geminiKey.trim()) return;
    setTestingGemini(true);
    setGeminiResult(null);
    try {
      const res = await aiVisionService.testConnection(geminiKey);
      setGeminiResult(res);
      if (res.success) {
        aiVisionService.setApiKey(geminiKey);
        onKeySaved?.();
      }
    } catch {
      setGeminiResult({ success: false, message: 'Could not connect. Please check your internet connection.' });
    } finally {
      setTestingGemini(false);
    }
  };

  const handleTestHf = async () => {
    if (!hfToken.trim()) return;
    setTestingHf(true);
    setHfResult(null);
    try {
      const res = await aiVisionService.testHfToken(hfToken);
      setHfResult(res);
      if (res.success) {
        aiVisionService.setHfToken(hfToken);
        onKeySaved?.();
      }
    } catch {
      setHfResult({ success: false, message: 'Could not connect to Hugging Face.' });
    } finally {
      setTestingHf(false);
    }
  };

  const handlePasteGemini = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const cleaned = text.trim();
        setGeminiKey(cleaned);
        // Auto test upon pasting if it looks like an API key
        if (cleaned.startsWith('AIzaSy') || cleaned.length > 25) {
          setTestingGemini(true);
          const res = await aiVisionService.testConnection(cleaned);
          setGeminiResult(res);
          if (res.success) {
            aiVisionService.setApiKey(cleaned);
            onKeySaved?.();
          }
          setTestingGemini(false);
        }
      }
    } catch {
      // Clipboard permission denied or unsupported
    }
  };

  const handlePasteHf = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const cleaned = text.trim();
        setHfToken(cleaned);
        if (cleaned.startsWith('hf_')) {
          setTestingHf(true);
          const res = await aiVisionService.testHfToken(cleaned);
          setHfResult(res);
          if (res.success) {
            aiVisionService.setHfToken(cleaned);
            onKeySaved?.();
          }
          setTestingHf(false);
        }
      }
    } catch {
      // Clipboard permission denied
    }
  };

  const handleFinish = () => {
    // Save entered values
    if (geminiKey.trim()) {
      aiVisionService.setApiKey(geminiKey);
    }
    if (hfToken.trim()) {
      aiVisionService.setHfToken(hfToken);
    }
    // Mark onboarding as seen in localStorage
    try {
      localStorage.setItem('posecam_has_seen_onboarding', 'true');
    } catch {}

    setSavedSuccess(true);
    onKeySaved?.();
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleSkip = () => {
    try {
      localStorage.setItem('posecam_has_seen_onboarding', 'true');
    } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-zinc-900/95 via-zinc-900/90 to-black border border-white/15 rounded-3xl shadow-2xl p-5 sm:p-7 text-white max-h-[92vh] overflow-y-auto space-y-6">
        {/* Close Button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Close setup"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 1. Welcoming Hero Header */}
        <div className="text-center space-y-2 pt-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Quick 30-Second Free Setup</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
            Welcome to Pose Cam
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 max-w-md mx-auto leading-relaxed">
            Your personal AI photographer. To enable the AI Director to inspect your camera view and guide your poses, connect your free Google key below.
          </p>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px] text-gray-300 font-medium">
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              100% Free Forever
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Takes ~30 Seconds
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
              No Credit Card
            </span>
          </div>
        </div>

        {/* 2. Step 1: Google Gemini API Key (Core Requirement) */}
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-black/40 p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                1
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white">Google AI Director Key</h3>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-emerald-500 text-black">
                    Required for AI
                  </span>
                </div>
                <p className="text-xs text-gray-300 mt-0.5">
                  Allows Pose Cam to analyze your surroundings, outfit, and suggest tailored poses.
                </p>
              </div>
            </div>
          </div>

          {/* Visual Step-by-Step Guide */}
          <div className="rounded-xl bg-black/50 border border-white/10 p-3 text-xs space-y-2.5">
            <div className="font-semibold text-gray-200 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-400">
              <span>How to get it in 3 easy steps:</span>
            </div>
            <ol className="space-y-2 text-gray-300 pl-1">
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-emerald-300 flex-shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Tap the button below to open <strong>Google AI Studio</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-emerald-300 flex-shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Sign in with any Google / Gmail account & tap <strong>"Create API Key"</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-emerald-300 flex-shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  Copy your key and tap <strong>"Paste"</strong> in the box below!
                </span>
              </li>
            </ol>

            {/* Direct Link Button */}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="mt-1 w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] cursor-pointer"
            >
              <span>Open Google AI Studio to Get Free Key</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Key Input Field */}
          <div className="space-y-2">
            <div className="relative flex items-center">
              <KeyRound className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type={showGeminiKey ? 'text' : 'password'}
                placeholder="Paste your key here (e.g. AIzaSy...)"
                value={geminiKey}
                onChange={(e) => {
                  setGeminiKey(e.target.value);
                  setGeminiResult(null);
                }}
                className={`w-full bg-black/70 border rounded-xl py-2.5 pl-9 pr-24 text-xs font-mono text-white placeholder-gray-500 focus:outline-none transition-colors ${
                  geminiKey.trim()
                    ? 'border-emerald-500/80 focus:border-emerald-400'
                    : 'border-white/15 focus:border-emerald-500'
                }`}
              />
              <div className="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePasteGemini}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="Paste from clipboard"
                >
                  <Clipboard className="w-3 h-3" />
                  <span>Paste</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Test Key Button & Status */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestGemini}
                disabled={testingGemini || !geminiKey.trim()}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {testingGemini ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3 h-3 text-emerald-400" />
                    <span>Test & Verify Key</span>
                  </>
                )}
              </button>

              {geminiResult?.success && (
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified & Ready!
                </span>
              )}
            </div>

            {/* Error / Success Feedback */}
            {geminiResult && (
              <div
                className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                  geminiResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/40 border-red-500/40 text-red-300'
                }`}
              >
                {geminiResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <span className="leading-snug">{geminiResult.message}</span>
              </div>
            )}
          </div>

          {/* Non-scary Callout: What if I don't generate this? */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowGeminiFaq(!showGeminiFaq)}
              className="text-[11px] text-gray-400 hover:text-gray-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <HelpCircle className="w-3 h-3 text-emerald-400" />
              <span>What happens if I don't add this key?</span>
              {showGeminiFaq ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showGeminiFaq && (
              <div className="mt-2 p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-gray-300 space-y-1 animate-in fade-in duration-150">
                <p>
                  You can still use Pose Cam as a <strong>regular full-sensor HD camera</strong> with touch-to-snap and native megapixels!
                </p>
                <p className="text-gray-400 text-[11px]">
                  However, the signature <strong>"Pose Me"</strong> AI button won't be able to analyze your scene or generate smart pose suggestions until this free key is provided.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 3. Step 2: Hugging Face Token (Completely Optional) */}
        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-b from-purple-950/20 to-black/40 p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 font-bold">
                2
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white">Studio Realism Token</h3>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-400/40 text-purple-300">
                    100% Optional
                  </span>
                </div>
                <p className="text-xs text-gray-300 mt-0.5">
                  Supercharges reference pose photos with 12-Billion parameter FLUX.1 studio photorealism.
                </p>
              </div>
            </div>
          </div>

          {/* Friendly Transparency Notice */}
          <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/20 text-xs text-purple-200 space-y-1.5">
            <div className="font-semibold text-purple-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <span>💡 You do NOT need this to get started!</span>
            </div>
            <p className="text-gray-300 leading-relaxed text-[11px]">
              Pose Cam already has an <strong>unlimited built-in Free AI engine</strong> that works automatically without any extra setup.
            </p>
            <p className="text-gray-400 leading-relaxed text-[11px]">
              <strong>Limitation to know:</strong> Hugging Face accounts receive ~15-20 trial generations on their free tier before requiring prepaid credits. You can skip this now and add it later anytime in Settings!
            </p>
          </div>

          {/* Quick Guide for HF */}
          <div className="rounded-xl bg-black/50 border border-white/10 p-3 text-xs space-y-2">
            <div className="font-semibold text-gray-200 text-[11px] uppercase tracking-wider text-purple-400">
              If you want FLUX.1 studio quality:
            </div>
            <ol className="space-y-1.5 text-gray-300 pl-1 text-[11px]">
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-purple-300 flex-shrink-0 mt-0.5">
                  1
                </span>
                <span>Open Hugging Face & create a free account.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-purple-300 flex-shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Create an Access Token with Type <strong>"Write"</strong> (or check <em>"Make calls to Inference Providers"</em>).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-purple-300 flex-shrink-0 mt-0.5">
                  3
                </span>
                <span>Paste below, or simply skip to use the Free AI engine.</span>
              </li>
            </ol>

            <a
              href="https://huggingface.co/settings/tokens"
              target="_blank"
              rel="noreferrer"
              className="mt-1 w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-[0.98] cursor-pointer"
            >
              <span>Get Free Hugging Face Token (Optional)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Token Input */}
          <div className="space-y-2">
            <div className="relative flex items-center">
              <KeyRound className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type={showHfKey ? 'text' : 'password'}
                placeholder="Paste hf_... token (optional)"
                value={hfToken}
                onChange={(e) => {
                  setHfToken(e.target.value);
                  setHfResult(null);
                }}
                className="w-full bg-black/70 border border-white/15 rounded-xl py-2 pl-9 pr-24 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 transition-colors"
              />
              <div className="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePasteHf}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="Paste from clipboard"
                >
                  <Clipboard className="w-3 h-3" />
                  <span>Paste</span>
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

            {/* Test HF Button */}
            {hfToken.trim() && (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestHf}
                  disabled={testingHf}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {testingHf ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-purple-400" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3 text-purple-400" />
                      <span>Test Token</span>
                    </>
                  )}
                </button>

                {hfResult?.success && (
                  <span className="text-xs text-purple-300 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                    FLUX.1 Active
                  </span>
                )}
              </div>
            )}

            {/* HF Result Feedback */}
            {hfResult && (
              <div
                className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                  hfResult.success
                    ? 'bg-purple-950/40 border-purple-500/40 text-purple-300'
                    : 'bg-red-950/40 border-red-500/40 text-red-300'
                }`}
              >
                {hfResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <span className="leading-snug">{hfResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* 4. Action Buttons Footer */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={handleFinish}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 text-black font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
          >
            {savedSuccess ? (
              <>
                <Check className="w-5 h-5" />
                <span>Ready! Opening Camera...</span>
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                <span>Start Shooting with Pose Cam</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-between text-xs text-gray-400 px-1 pt-1">
            <button
              type="button"
              onClick={handleSkip}
              className="text-gray-400 hover:text-white transition-colors cursor-pointer underline underline-offset-4"
            >
              Skip for now & explore camera
            </button>
            <span className="text-[11px] text-gray-400">
              ⚙️ Manage anytime in Settings
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
