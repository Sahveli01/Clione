"use client";

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

// Add style tag for character animation
if (typeof document !== 'undefined') {
  const styleId = 'processing-animation-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes fadeInChar {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

interface ProcessingAnimationProps {
  isVisible: boolean;
  currentStep: string;
  progress: number; // 0-100
}

const STAGED_MESSAGES = [
  "Encrypting locally...",
  "Fragmenting for Walrus 🦭...",
  "Securing on Sui Network...",
];

export default function ProcessingAnimation({ 
  isVisible, 
  currentStep, 
  progress 
}: ProcessingAnimationProps) {
  const [displayMessage, setDisplayMessage] = useState(STAGED_MESSAGES[0]);
  const [messageIndex, setMessageIndex] = useState(0);
  const [isFinalPhase, setIsFinalPhase] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setMessageIndex(0);
      setDisplayMessage(STAGED_MESSAGES[0]);
      setIsFinalPhase(false);
      setFadeIn(false);
      return;
    }

    // Determine which message to show based on currentStep
    const stepLower = currentStep.toLowerCase();
    let newMessage = STAGED_MESSAGES[0];
    let isFinal = false;

    if (stepLower.includes("encrypt") || stepLower.includes("key") || stepLower.includes("🔐") || stepLower.includes("🔒")) {
      newMessage = STAGED_MESSAGES[0];
    } else if (stepLower.includes("walrus") || stepLower.includes("🦭") || stepLower.includes("fragment") || stepLower.includes("upload") || stepLower.includes("payload")) {
      newMessage = STAGED_MESSAGES[1];
    } else if (stepLower.includes("sui") || stepLower.includes("listing") || stepLower.includes("transaction") || stepLower.includes("⛓️") || stepLower.includes("creating") || stepLower.includes("unlock")) {
      newMessage = STAGED_MESSAGES[2];
      isFinal = true;
    }

    // Trigger fade-in animation
    setFadeIn(false);
    setTimeout(() => {
      setDisplayMessage(newMessage);
      setIsFinalPhase(isFinal);
      setFadeIn(true);
    }, 100);
  }, [currentStep, isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl">
      <div className="text-center space-y-16 w-full max-w-2xl px-8">
        {/* Circular Logo Animation - Larger and More Dominant */}
        <div className="relative w-64 h-64 mx-auto">
          {/* Rotating Aura/Circle - Enhanced */}
          <div className="absolute inset-0 rounded-full border-4 border-transparent animate-spin-slow">
            <div className="absolute inset-0 rounded-full border-t-4 border-purple-500/60 border-r-4 border-pink-500/60 border-b-4 border-teal-500/60 border-l-4 border-purple-500/60"></div>
          </div>
          
          {/* Additional Rotating Ring */}
          <div className="absolute inset-2 rounded-full border-2 border-transparent animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '4s' }}>
            <div className="absolute inset-0 rounded-full border-t-2 border-teal-400/40 border-r-2 border-purple-400/40 border-b-2 border-pink-400/40 border-l-2 border-teal-400/40"></div>
          </div>
          
          {/* Pulsing Outer Ring - Enhanced */}
          <div className="absolute inset-0 rounded-full border-2 border-teal-500/40 animate-pulse"></div>
          
          {/* Inner Glow Circle - Enhanced */}
          <div className="absolute inset-6 rounded-full bg-gradient-to-br from-purple-500/30 via-pink-500/30 to-teal-500/30 animate-pulse"></div>
          
          {/* Center Logo/Icon - Larger */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-2xl shadow-purple-500/60 ring-4 ring-purple-500/20">
              <Zap className="w-16 h-16 text-white animate-pulse" />
            </div>
          </div>
        </div>

        {/* Dynamic Text Staging with Staggered Typing Animation */}
        <div className="space-y-6">
          <h3 
            className={`text-4xl md:text-5xl font-bold transition-all duration-1000 ${
              fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            } ${
              isFinalPhase 
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-purple-400 to-pink-400' 
                : 'text-white'
            }`}
            style={isFinalPhase && fadeIn ? {
              animation: 'pulse 2s ease-in-out infinite'
            } : {}}
          >
            {fadeIn ? (
              displayMessage.split('').map((char, index) => (
                <span
                  key={index}
                  className="inline-block"
                  style={{
                    animation: `fadeInChar 0.15s ease-out ${index * 0.03}s both`
                  }}
                >
                  {char === ' ' ? '\u00A0' : char}
                </span>
              ))
            ) : (
              <span className="opacity-0">{displayMessage}</span>
            )}
          </h3>
          <p className={`text-base text-gray-400 transition-opacity duration-700 delay-300 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
            Please wait while we process your request...
          </p>
        </div>

        {/* Progress Bar - Enhanced */}
        <div className="w-full max-w-lg mx-auto space-y-4">
          <div className="h-3 bg-gray-800/50 rounded-full overflow-hidden border border-gray-700/50 backdrop-blur-sm">
            <div 
              className="h-full bg-gradient-to-r from-teal-500 via-purple-500 to-pink-500 rounded-full transition-all duration-700 ease-out shadow-lg shadow-purple-500/50 relative overflow-hidden"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
            </div>
          </div>
          <p className="text-sm text-gray-400 font-medium">
            {Math.round(progress)}%
          </p>
        </div>
      </div>
    </div>
  );
}

